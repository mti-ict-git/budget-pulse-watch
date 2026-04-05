import argparse
import asyncio
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv
from playwright.async_api import TimeoutError as PlaywrightTimeoutError, async_playwright

import pronto_access
from pronto_access import (
    _click_find,
    _click_login,
    _ensure_orders_find_mode,
    _ensure_standard_grid,
    _extract_top_row_orders,
    _fill_po_number,
    _locate_password,
    _locate_username,
    _navigate_menu,
    _wait_order_cell_value,
    _wait_for_label,
)

def _parse_part_code(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    m = re.search(r"\b\d{4}-\d{2}-\d{6}\b", text)
    if m:
        return m.group(0)
    return None


def _extract_pomon_part_code(item: Dict[str, object]) -> Optional[str]:
    item_code = item.get("ItemCode")
    if isinstance(item_code, str):
        s = item_code.strip()
        if s:
            return s
    for k in ("Description", "ItemName", "Notes", "Specifications"):
        v = item.get(k)
        if isinstance(v, str):
            code = _parse_part_code(v)
            if code:
                return code
    return None


def _parse_required_qty_int(raw: Optional[str]) -> Tuple[Optional[int], Optional[str]]:
    if raw is None:
        return None, None
    f = _parse_float(raw)
    if f is None:
        return None, "invalid_number"
    rounded = round(f)
    if abs(f - rounded) > 1e-9:
        return None, "non_integer"
    return int(rounded), None


def _get_case_insensitive(d: Dict[str, object], key: str) -> Optional[str]:
    direct = d.get(key)
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    target = key.strip().lower()
    for k, v in d.items():
        if isinstance(k, str) and k.strip().lower() == target and isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _norm_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    s = value.strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def _read_pronto_prf_items_batch(path: str) -> Dict[str, object]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _build_pronto_item_code_map(pronto_result: Dict[str, object]) -> Tuple[Dict[str, Dict[str, object]], List[Dict[str, object]]]:
    rows = pronto_result.get("rows")
    details = pronto_result.get("details")
    if not isinstance(rows, list):
        rows = []
    if not isinstance(details, list):
        details = []

    used_rows: set = set()
    by_code: Dict[str, Dict[str, object]] = {}
    issues: List[Dict[str, object]] = []

    def find_row_for_detail(detail_obj: Dict[str, object], idx: int) -> Optional[Dict[str, object]]:
        ddesc = str(detail_obj.get("description") or "").strip()
        if ddesc:
            for i, r in enumerate(rows):
                if i in used_rows or not isinstance(r, dict):
                    continue
                if str(r.get("Description") or "").strip() == ddesc:
                    used_rows.add(i)
                    return r
        if idx < len(rows) and idx not in used_rows and isinstance(rows[idx], dict):
            used_rows.add(idx)
            return rows[idx]
        return None

    for i, d in enumerate(details):
        if not isinstance(d, dict):
            continue
        dialog = d.get("dialog")
        if not isinstance(dialog, dict):
            dialog = {}
        item_code = dialog.get("Item code")
        if not isinstance(item_code, str) or not item_code.strip():
            issues.append({"type": "missing_item_code", "index": i})
            continue
        item_code = item_code.strip()

        original_po = d.get("requisition_no")
        original_po = str(original_po).strip() if original_po is not None else ""
        if not original_po:
            issues.append({"type": "missing_original_po", "item_code": item_code, "index": i})
            continue

        row = find_row_for_detail(d, i)
        purchase_order_no = _get_case_insensitive(dialog, "Purchase Order No.") or ""
        order_no = purchase_order_no
        if not order_no and isinstance(row, dict):
            order_no = str(row.get("Order Number") or "").strip()
        split_po = order_no if order_no and order_no != original_po else ""

        qty_raw = dialog.get("Qty required")
        qty_int, qty_issue = _parse_required_qty_int(str(qty_raw) if qty_raw is not None else None)
        if qty_issue:
            issues.append({"type": "qty_skipped", "item_code": item_code, "raw": qty_raw, "reason": qty_issue})

        description = _get_case_insensitive(dialog, "Description") or str(d.get("description") or "").strip()
        est_price_raw = _get_case_insensitive(dialog, "Estimated price")
        est_price = _parse_float(est_price_raw) if est_price_raw else None

        by_code[item_code] = {
            "item_code": item_code,
            "original_po": original_po,
            "split_po": split_po,
            "quantity": qty_int,
            "description": description,
            "unit_price": est_price,
            "dialog": dialog,
            "row": row if isinstance(row, dict) else {},
        }

    return by_code, issues


def _fetch_prf_by_prfno(base_url: str, api_key: str, prf_no: str) -> Dict[str, object]:
    headers = _http_headers(api_key)
    url = f"{base_url}/api/prfs/prfno/{prf_no}"
    resp = requests.get(url, headers=headers, timeout=60)
    resp.raise_for_status()
    payload = resp.json()
    data = payload.get("data", {})
    if isinstance(data, dict):
        return data
    return {}


def _fetch_prf_items(base_url: str, api_key: str, prf_id: int) -> List[Dict[str, object]]:
    headers = _http_headers(api_key)
    url = f"{base_url}/api/prfs/{prf_id}/items"
    resp = requests.get(url, headers=headers, timeout=60)
    resp.raise_for_status()
    payload = resp.json()
    data = payload.get("data", [])
    if isinstance(data, list):
        out: List[Dict[str, object]] = []
        for it in data:
            if isinstance(it, dict):
                out.append(it)
        return out
    return []


def _update_prf_item(base_url: str, api_key: str, item_id: int, payload: Dict[str, object]) -> None:
    headers = _http_headers(api_key)
    url = f"{base_url}/api/prfs/items/{item_id}"
    resp = requests.put(url, headers=headers, data=json.dumps(payload), timeout=60)
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "")[:1200]
        raise RuntimeError(f"Update item failed status={resp.status_code} url={url} body={body}") from e


def _delete_prf_item(base_url: str, api_key: str, item_id: int) -> None:
    headers = _http_headers(api_key)
    url = f"{base_url}/api/prfs/items/{item_id}"
    resp = requests.delete(url, headers=headers, timeout=60)
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "")[:1200]
        raise RuntimeError(f"Delete item failed status={resp.status_code} url={url} body={body}") from e


def _add_prf_items(base_url: str, api_key: str, prf_id: int, items: List[Dict[str, object]]) -> List[Dict[str, object]]:
    headers = _http_headers(api_key)
    url = f"{base_url}/api/prfs/{prf_id}/items"
    resp = requests.post(url, headers=headers, data=json.dumps({"items": items}), timeout=60)
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "")[:1200]
        raise RuntimeError(f"Add items failed status={resp.status_code} url={url} body={body}") from e
    payload = resp.json()
    data = payload.get("data", [])
    if isinstance(data, list):
        out: List[Dict[str, object]] = []
        for it in data:
            if isinstance(it, dict):
                out.append(it)
        return out
    return []


def _setenv_temp(pairs: Dict[str, str]) -> Dict[str, Optional[str]]:
    old: Dict[str, Optional[str]] = {}
    for k, v in pairs.items():
        old[k] = os.environ.get(k)
        os.environ[k] = v
    return old


def _restore_env(old: Dict[str, Optional[str]]) -> None:
    for k, v in old.items():
        if v is None:
            try:
                del os.environ[k]
            except KeyError:
                pass
        else:
            os.environ[k] = v


def _gather_pronto_items_for_pos(
    *,
    pos: List[str],
    artifacts_dir: str,
    headless: bool,
    max_scrolls: int,
    capture_screenshots: bool,
    write_per_po_json: bool,
) -> str:
    po_list = ",".join([p.strip() for p in pos if p.strip()])
    if not po_list:
        raise RuntimeError("Empty PO list for Pronto gather")
    print(
        "Pronto gather "
        + json.dumps(
            {
                "pos": len([p for p in pos if p.strip()]),
                "headless": bool(headless),
                "max_scrolls": int(max_scrolls),
                "screenshots": bool(capture_screenshots),
                "per_po_json": bool(write_per_po_json),
                "artifacts_dir": artifacts_dir,
            }
        ),
        flush=True,
    )
    env = {
        "PRONTO_PO_LIST": po_list,
        "ARTIFACTS_DIR": artifacts_dir,
        "PRONTO_HEADLESS": "1" if headless else "0",
        "PRONTO_CAPTURE_SCREENSHOTS": "1" if capture_screenshots else "0",
        "PRONTO_WRITE_PER_PO_JSON": "1" if write_per_po_json else "0",
    }
    old = _setenv_temp(env)
    try:
        asyncio.run(pronto_access.main(check_item=True, debug=False, max_scrolls=max_scrolls))
    finally:
        _restore_env(old)
    out_path = os.path.join(artifacts_dir, "prf_items_batch.json")
    print(f"Pronto gather done batch={out_path}", flush=True)
    return out_path


@dataclass(frozen=True)
class PrfSummary:
    prf_id: int
    prf_no: str
    budget_year: Optional[int]
    status: Optional[str]


@dataclass(frozen=True)
class SyncCandidate:
    prf: PrfSummary
    order_no: str


def _parse_bool(raw: Optional[str], default: bool) -> bool:
    if raw is None:
        return default
    v = raw.strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "no", "n", "off"}:
        return False
    return default


def _parse_float(raw: Optional[str]) -> Optional[float]:
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    s = s.replace(",", "")
    s = re.sub(r"[^\d.\-]", "", s)
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _normalize_amount(value: object) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        return _parse_float(value)
    return None


def _parse_pronto_date(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    for fmt in ("%d-%b-%Y", "%d-%B-%Y"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%dT00:00:00.000Z")
        except ValueError:
            continue
    return None


def _normalize_prf_datetime(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
            return f"{s}T00:00:00.000Z"
        iso = s.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(iso)
            if dt.tzinfo is None:
                return dt.strftime("%Y-%m-%dT00:00:00.000Z")
            utc_dt = dt.astimezone(timezone.utc)
            return utc_dt.strftime("%Y-%m-%dT00:00:00.000Z")
        except ValueError:
            m = re.match(r"^(\d{4}-\d{2}-\d{2})", s)
            if m:
                return f"{m.group(1)}T00:00:00.000Z"
            return None
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            return dt.strftime("%Y-%m-%dT00:00:00.000Z")
        utc_dt = dt.astimezone(timezone.utc)
        return utc_dt.strftime("%Y-%m-%dT00:00:00.000Z")
    return None


def _values_equal(field: str, prf_value: object, desired_value: object) -> bool:
    if field in {"ApprovalDate", "CompletionDate", "RequiredDate", "DateSubmit"}:
        return _normalize_prf_datetime(prf_value) == _normalize_prf_datetime(desired_value)
    if field in {"ActualAmount", "RequestedAmount", "ApprovedAmount"}:
        a = _normalize_amount(prf_value)
        b = _normalize_amount(desired_value)
        if a is None and b is None:
            return True
        if a is None or b is None:
            return False
        return abs(a - b) < 1e-6
    return prf_value == desired_value


def _clean_base_url(value: str) -> str:
    s = value.strip()
    s = s.replace("\\n", "")
    s = s.replace("\n", "")
    s = s.replace("\r", "")
    s = s.replace("`", "")
    s = s.replace("\\", "")
    s = s.strip()
    s = s.strip("\"'")
    s = re.sub(r"\s+", "", s)
    s = s.rstrip("/").rstrip("\\")
    return s


def _ensure_writable_dir(path: str) -> str:
    p = path.strip()
    if not p:
        p = "artifacts"
    try:
        os.makedirs(p, exist_ok=True)
        test_path = os.path.join(p, ".write_test")
        with open(test_path, "w", encoding="utf-8") as f:
            f.write("ok")
        try:
            os.remove(test_path)
        except OSError:
            pass
        return p
    except OSError:
        tmp_root = os.getenv("TMPDIR", "/tmp")
        fallback = os.path.join(tmp_root, "python-service-artifacts")
        os.makedirs(fallback, exist_ok=True)
        return fallback


def _mask(value: Optional[str]) -> str:
    if not value:
        return ""
    return "***"


def _http_headers(api_key: str) -> Dict[str, str]:
    return {
        "x-api-key": api_key,
        "x-sync-source": "pronto",
        "accept": "application/json",
        "content-type": "application/json",
    }


def _is_completed_status(value: object) -> bool:
    if not isinstance(value, str):
        return False
    return value.strip().lower() == "completed"


def _fetch_all_prfs(base_url: str, api_key: str, limit: int) -> List[Dict[str, object]]:
    out: List[Dict[str, object]] = []
    page = 1
    headers = _http_headers(api_key)
    while True:
        url = f"{base_url}/api/prfs/with-items?page={page}&limit={limit}"
        resp = requests.get(url, headers=headers, timeout=60)
        resp.raise_for_status()
        payload = resp.json()
        batch = payload.get("data", [])
        if not isinstance(batch, list):
            break
        for item in batch:
            if isinstance(item, dict):
                out.append(item)
        pagination = payload.get("pagination", {})
        if not isinstance(pagination, dict):
            break
        total_pages = pagination.get("totalPages")
        if isinstance(total_pages, int) and page >= total_pages:
            break
        if not batch:
            break
        page += 1
    return out


def _extract_prf_summary(prf_obj: Dict[str, object]) -> Optional[PrfSummary]:
    prf_id = prf_obj.get("PRFID")
    prf_no = prf_obj.get("PRFNo")
    budget_year = prf_obj.get("BudgetYear")
    status = prf_obj.get("Status")
    if not isinstance(prf_id, int):
        return None
    if not isinstance(prf_no, str) or not prf_no.strip():
        return None
    by: Optional[int]
    if isinstance(budget_year, int):
        by = budget_year
    else:
        by = None
    st: Optional[str]
    if isinstance(status, str) and status.strip():
        st = status.strip()
    else:
        st = None
    return PrfSummary(prf_id=prf_id, prf_no=prf_no.strip(), budget_year=by, status=st)


def _is_numeric_order_no(value: str) -> bool:
    return bool(re.fullmatch(r"\d+", value.strip()))


def _build_candidates(prfs: List[PrfSummary], target_budget_year: int) -> List[SyncCandidate]:
    out: List[SyncCandidate] = []
    for p in prfs:
        if p.budget_year != target_budget_year:
            continue
        if p.status and _is_completed_status(p.status):
            continue
        if not _is_numeric_order_no(p.prf_no):
            continue
        out.append(SyncCandidate(prf=p, order_no=p.prf_no))
    return out


@dataclass(frozen=True)
class SyncOptions:
    sync_status: bool
    sync_requested_date: bool
    sync_required_date: bool
    sync_approval_date: bool
    sync_completion_date: bool
    sync_approved_by: bool
    sync_vendor: bool
    sync_currency: bool
    sync_amounts: bool
    amount_source: str


def _desired_update_from_pronto_row(row: Dict[str, str], options: SyncOptions) -> Dict[str, object]:
    desired: Dict[str, object] = {}

    if options.sync_vendor:
        vendor_name = row.get("Supplier Name") or row.get("Supplier")
        if vendor_name:
            desired["VendorName"] = vendor_name

        vendor_contact = row.get("Supplier Trading Name and Address") or row.get("Supplier")
        if vendor_contact:
            desired["VendorContact"] = vendor_contact

    if options.sync_currency:
        currency = row.get("Currency")
        if currency in {"IDR", "USD"}:
            desired["CurrencyCode"] = currency

    if options.sync_status:
        status = row.get("Status")
        if status:
            desired["Status"] = status

    if options.sync_approved_by:
        approved_by = row.get("Approver")
        if approved_by:
            desired["ApprovedByName"] = approved_by.strip()

    if options.sync_requested_date:
        request_date = _parse_pronto_date(row.get("Ordered"))
        if request_date:
            desired["DateSubmit"] = request_date

    if options.sync_required_date:
        required_date = _parse_pronto_date(row.get("Due"))
        if required_date:
            desired["RequiredDate"] = required_date

    if options.sync_approval_date:
        approval_date = _parse_pronto_date(row.get("Req. Approval Date"))
        if approval_date:
            desired["ApprovalDate"] = approval_date

    if options.sync_completion_date:
        completion_date = _parse_pronto_date(row.get("Received"))
        if completion_date:
            desired["CompletionDate"] = completion_date

    if options.sync_amounts:
        received_total = _parse_float(row.get("Received Total"))
        order_total = _parse_float(row.get("Order Total"))
        if options.amount_source == "received":
            actual_amount = received_total
        elif options.amount_source == "order":
            actual_amount = order_total
        elif options.amount_source == "received_if_positive_else_none":
            actual_amount = received_total if received_total is not None and received_total > 0 else None
        else:
            actual_amount = (
                received_total
                if received_total is not None and received_total > 0
                else order_total
            )
        if actual_amount is not None:
            desired["ActualAmount"] = actual_amount

    return desired


def _evaluate_fields(
    row: Dict[str, str], current: Dict[str, object], options: SyncOptions
) -> Tuple[Dict[str, object], Dict[str, Dict[str, object]]]:
    desired = _desired_update_from_pronto_row(row, options)
    checks: Dict[str, Dict[str, object]] = {}

    def add_check(field: str, enabled: bool, pronto_value: Optional[str], candidate_value: object) -> None:
        prf_value = current.get(field)
        changed = not _values_equal(field, prf_value, candidate_value) if enabled else False
        checks[field] = {
            "enabled": enabled,
            "prf": prf_value,
            "pronto": pronto_value,
            "candidate": candidate_value,
            "desired": candidate_value if enabled else None,
            "changed": changed,
        }

    pronto_status = row.get("Status")
    add_check(
        "Status",
        options.sync_status,
        pronto_status,
        pronto_status,
    )
    pronto_approver = row.get("Approver")
    approved_by_candidate: Optional[str] = None
    if pronto_approver and pronto_approver.strip():
        approved_by_candidate = pronto_approver.strip()
    add_check(
        "ApprovedByName",
        options.sync_approved_by,
        pronto_approver,
        approved_by_candidate,
    )

    vendor_name_src = row.get("Supplier Name") or row.get("Supplier")
    add_check(
        "VendorName",
        options.sync_vendor,
        vendor_name_src,
        vendor_name_src,
    )
    vendor_contact_src = row.get("Supplier Trading Name and Address") or row.get("Supplier")
    add_check(
        "VendorContact",
        options.sync_vendor,
        vendor_contact_src,
        vendor_contact_src,
    )

    pronto_currency = row.get("Currency")
    add_check(
        "CurrencyCode",
        options.sync_currency,
        pronto_currency,
        pronto_currency,
    )

    pronto_req_approval_date = row.get("Req. Approval Date")
    approval_date_candidate = _parse_pronto_date(pronto_req_approval_date)
    add_check(
        "ApprovalDate",
        options.sync_approval_date,
        pronto_req_approval_date,
        approval_date_candidate,
    )
    pronto_received = row.get("Received")
    completion_date_candidate = _parse_pronto_date(pronto_received)
    add_check(
        "CompletionDate",
        options.sync_completion_date,
        pronto_received,
        completion_date_candidate,
    )

    amount_src = row.get("Received Total") if _parse_float(row.get("Received Total")) is not None else row.get("Order Total")
    received_total = _parse_float(row.get("Received Total"))
    order_total = _parse_float(row.get("Order Total"))
    if options.amount_source == "received":
        actual_amount_candidate = received_total
        amount_src = row.get("Received Total")
    elif options.amount_source == "order":
        actual_amount_candidate = order_total
        amount_src = row.get("Order Total")
    elif options.amount_source == "received_if_positive_else_none":
        actual_amount_candidate = received_total if received_total is not None and received_total > 0 else None
        amount_src = row.get("Received Total")
    else:
        actual_amount_candidate = (
            received_total
            if received_total is not None and received_total > 0
            else order_total
        )
        amount_src = row.get("Received Total") if received_total is not None and received_total > 0 else row.get("Order Total")
    add_check(
        "ActualAmount",
        options.sync_amounts,
        amount_src,
        actual_amount_candidate,
    )

    pronto_due = row.get("Due")
    required_date_candidate = _parse_pronto_date(pronto_due)
    add_check(
        "RequiredDate",
        options.sync_required_date,
        pronto_due,
        required_date_candidate,
    )
    pronto_ordered = row.get("Ordered")
    request_date_candidate = _parse_pronto_date(pronto_ordered)
    add_check(
        "DateSubmit",
        options.sync_requested_date,
        pronto_ordered,
        request_date_candidate,
    )

    return desired, checks


def _diff_fields(current: Dict[str, object], desired: Dict[str, object]) -> Dict[str, Tuple[object, object]]:
    changes: Dict[str, Tuple[object, object]] = {}
    for k, new_v in desired.items():
        old_v = current.get(k)
        if not _values_equal(k, old_v, new_v):
            changes[k] = (old_v, new_v)
    return changes


def _fetch_prf_detail(base_url: str, api_key: str, prf_id: int) -> Dict[str, object]:
    headers = _http_headers(api_key)
    url = f"{base_url}/api/prfs/{prf_id}"
    resp = requests.get(url, headers=headers, timeout=60)
    resp.raise_for_status()
    payload = resp.json()
    data = payload.get("data", {})
    if isinstance(data, dict):
        return data
    return {}


def _update_prf(base_url: str, api_key: str, prf_no: str, payload: Dict[str, object]) -> None:
    headers = _http_headers(api_key)
    url = f"{base_url}/api/prfs/prfno/{prf_no}"
    resp = requests.put(url, headers=headers, data=json.dumps(payload), timeout=60)
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "")[:1200]
        raise RuntimeError(
            f"Update failed status={resp.status_code} url={url} body={body}"
        ) from e


async def _fetch_pronto_rows_live(
    *,
    target_url: str,
    username: str,
    password: str,
    order_nos: List[str],
    headless: bool,
    artifacts_dir: str,
) -> Dict[str, Dict[str, str]]:
    os.makedirs(artifacts_dir, exist_ok=True)
    results: Dict[str, Dict[str, str]] = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        try:
            await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_load_state("load", timeout=60000)

            os.makedirs(artifacts_dir, exist_ok=True)
            await page.screenshot(path=os.path.join(artifacts_dir, "pronto_sync_login.png"), full_page=True)

            u = await _locate_username(page)
            p_loc = await _locate_password(page)
            if not u or not p_loc:
                raise RuntimeError("Cannot locate Pronto username/password fields")
            await u.fill(username)
            await p_loc.fill(password)
            clicked = await _click_login(page)
            if clicked:
                try:
                    await page.wait_for_load_state("networkidle", timeout=60000)
                except PlaywrightTimeoutError:
                    pass

            ready = await _wait_for_label(page, "Supply Chain", 20000)
            if not ready:
                raise RuntimeError("Pronto navigation not ready")

            ok = await _navigate_menu(page, ["Supply Chain", "Purchasing", "Purchase Orders"])
            if not ok:
                raise RuntimeError("Failed to navigate to Purchase Orders")

            await page.wait_for_timeout(800)
            await page.screenshot(path=os.path.join(artifacts_dir, "pronto_sync_purchase_orders.png"), full_page=True)
            await _ensure_orders_find_mode(page)
            await _ensure_standard_grid(page)

            for idx, order_no in enumerate(order_nos, start=1):
                t0 = time.monotonic()
                await _ensure_orders_find_mode(page)
                filled = await _fill_po_number(page, order_no)
                if not filled:
                    continue
                try:
                    await _wait_order_cell_value(page, expected_regex=re.compile(rf"^{re.escape(order_no)}$"), timeout_ms=8000)
                except Exception:
                    pass
                row = await _extract_top_row_orders(page)
                if row:
                    results[order_no] = {str(k): str(v) for k, v in row.items()}
                dt_ms = int((time.monotonic() - t0) * 1000)
                if idx % 25 == 0:
                    await page.screenshot(
                        path=os.path.join(artifacts_dir, f"pronto_sync_progress_{idx}.png"), full_page=True
                    )
                print(f"Pronto {idx}/{len(order_nos)} order={order_no} duration_ms={dt_ms}")
        finally:
            await context.close()
            await browser.close()
    return results


def _read_pronto_rows_json(path: str) -> Dict[str, Dict[str, str]]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    results: Dict[str, Dict[str, str]] = {}
    payload_results = raw.get("results")
    if isinstance(payload_results, list):
        for item in payload_results:
            if not isinstance(item, dict):
                continue
            po = item.get("po")
            row = item.get("row")
            if isinstance(po, str) and isinstance(row, dict):
                results[po] = {str(k): str(v) for k, v in row.items()}
    else:
        for k, v in raw.items():
            if isinstance(k, str) and isinstance(v, dict):
                results[k] = {str(kk): str(vv) for kk, vv in v.items()}
    return results


def _write_json(path: str, data: object) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main() -> int:
    load_dotenv()
    if os.path.exists(".env.pronto"):
        load_dotenv(".env.pronto", override=False)

    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("POMON_BASE_URL", "http://localhost:3001"))
    parser.add_argument("--api-key", default=os.getenv("POMON_API_KEY", ""))
    parser.add_argument("--sync-prf-items", action="store_true")
    parser.add_argument("--prfno", default=os.getenv("POMON_PRFNO", ""))
    parser.add_argument("--po-no", default=os.getenv("POMON_PO_NO", ""))
    parser.add_argument("--pronto-items-json", default=os.getenv("PRONTO_ITEMS_JSON", os.path.join("artifacts", "prf_items_batch.json")))
    parser.add_argument("--pronto-items-max-scrolls", type=int, default=int(os.getenv("PRONTO_ITEMS_MAX_SCROLLS", "80")))
    parser.add_argument(
        "--sync-item-description",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_ITEM_DESCRIPTION"), False),
    )
    parser.add_argument(
        "--add-missing-item",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("ADD_MISSING_ITEM"), False),
    )
    parser.add_argument(
        "--replace-item",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("REPLACE_ITEM"), False),
    )
    parser.add_argument(
        "--default-purchase-cost-code",
        default=os.getenv("DEFAULT_PURCHASE_COST_CODE", ""),
    )
    parser.add_argument("--log-every", type=int, default=int(os.getenv("POMON_LOG_EVERY", "25")))
    parser.add_argument("--budget-year", type=int, default=int(os.getenv("POMON_BUDGET_YEAR", "2026")))
    parser.add_argument("--limit", type=int, default=int(os.getenv("POMON_LIMIT", "1000")))
    parser.add_argument("--max-prfs", type=int, default=0)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--artifacts-dir", default=os.getenv("ARTIFACTS_DIR", "artifacts"))
    parser.add_argument("--pronto-source", choices=["live", "json"], default=os.getenv("PRONTO_SOURCE", "live"))
    parser.add_argument("--pronto-json", default=os.getenv("PRONTO_JSON", os.path.join("artifacts", "po_batch.json")))
    parser.add_argument("--pronto-url", default=os.getenv("TARGET_URL", "https://newpronto.merdekacoppergold.com:8443/"))
    parser.add_argument("--pronto-username", default=os.getenv("PRONTO_USERNAME", ""))
    parser.add_argument("--pronto-password", default=os.getenv("PRONTO_PASSWORD", ""))
    parser.add_argument(
        "--pronto-screenshots",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("PRONTO_CAPTURE_SCREENSHOTS"), True),
    )
    parser.add_argument(
        "--pronto-per-po-json",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("PRONTO_WRITE_PER_PO_JSON"), True),
    )
    parser.add_argument(
        "--pronto-headless",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("PRONTO_HEADLESS"), True),
    )
    parser.add_argument(
        "--amount-source",
        choices=["received_if_positive_else_order", "received", "order", "received_if_positive_else_none"],
        default=os.getenv("POMON_AMOUNT_SOURCE", "received_if_positive_else_order"),
    )
    parser.add_argument(
        "--report-all-fields",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("REPORT_ALL_FIELDS"), True),
    )
    parser.add_argument(
        "--sync-status",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_STATUS"), True),
    )
    parser.add_argument(
        "--sync-approved-by",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_APPROVED_BY"), True),
    )
    parser.add_argument(
        "--sync-vendor",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_VENDOR"), True),
    )
    parser.add_argument(
        "--sync-currency",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_CURRENCY"), True),
    )
    parser.add_argument(
        "--sync-approval-date",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_APPROVAL_DATE"), True),
    )
    parser.add_argument(
        "--sync-completion-date",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_COMPLETION_DATE"), True),
    )
    parser.add_argument(
        "--sync-amounts",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_AMOUNTS"), True),
    )
    parser.add_argument(
        "--sync-required-date",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_REQUIRED_DATE"), False),
    )
    parser.add_argument(
        "--sync-request-date",
        action=argparse.BooleanOptionalAction,
        default=_parse_bool(os.getenv("SYNC_REQUEST_DATE"), False),
    )
    args = parser.parse_args()

    if not args.api_key:
        raise SystemExit("Missing POMON_API_KEY")

    args.base_url = _clean_base_url(str(args.base_url))
    args.artifacts_dir = _ensure_writable_dir(str(args.artifacts_dir))

    is_dry_run = args.dry_run or not args.apply

    if bool(args.sync_prf_items):
        prfno = str(args.prfno).strip()
        po_no = str(args.po_no).strip()
        pronto_items_json = str(args.pronto_items_json).strip()
        pronto_items_max_scrolls = int(args.pronto_items_max_scrolls)
        log_every = max(1, int(args.log_every))
        if not pronto_items_json:
            raise SystemExit("Missing --pronto-items-json")
        pronto_by_po: Dict[str, Dict[str, object]] = {}

        def sync_one_prf(*, prf_id: int, prf_no: str, po: str) -> Dict[str, object]:
            prf_detail = _fetch_prf_detail(args.base_url, args.api_key, prf_id)
            if _is_completed_status(prf_detail.get("Status")):
                return {
                    "prfId": prf_id,
                    "prfNo": prf_no,
                    "po": po,
                    "status": "skipped_completed",
                    "counts": {
                        "pomon_items": 0,
                        "matched": 0,
                        "unmatched": 0,
                        "changes": 0,
                        "skipped_qty": 0,
                        "applied": 0,
                        "apply_failed": 0,
                    },
                    "issues": [],
                    "items": [],
                }
            pomon_items = _fetch_prf_items(args.base_url, args.api_key, prf_id)
            pronto_match = pronto_by_po.get(po)
            if not isinstance(pronto_match, dict):
                return {
                    "prfId": prf_id,
                    "prfNo": prf_no,
                    "po": po,
                    "status": "missing_pronto_items",
                }

            code_map, issues = _build_pronto_item_code_map(pronto_match)
            out_rows: List[Dict[str, object]] = []
            missing_items_out: List[Dict[str, object]] = []
            pronto_by_desc: Dict[str, Dict[str, object]] = {}
            duplicate_descs: set = set()
            for _code, mapped_obj in code_map.items():
                if not isinstance(mapped_obj, dict):
                    continue
                ddesc = _norm_text(mapped_obj.get("description"))
                if not ddesc:
                    continue
                if ddesc in pronto_by_desc:
                    duplicate_descs.add(ddesc)
                    continue
                pronto_by_desc[ddesc] = mapped_obj
            counts = {
                "pomon_items": len(pomon_items),
                "matched": 0,
                "unmatched": 0,
                "changes": 0,
                "skipped_qty": 0,
                "applied": 0,
                "apply_failed": 0,
                "missing_pronto_items": 0,
                "missing_added": 0,
                "missing_add_failed": 0,
            }
            pomon_part_codes = set()
            for pit in pomon_items:
                pcode = _extract_pomon_part_code(pit)
                if pcode:
                    pomon_part_codes.add(pcode)

            if bool(args.replace_item):
                existing_item_ids: List[int] = []
                existing_by_code: Dict[str, Dict[str, object]] = {}
                for pit in pomon_items:
                    raw_id = pit.get("PRFItemID") or pit.get("id")
                    if isinstance(raw_id, int):
                        existing_item_ids.append(raw_id)
                    elif isinstance(raw_id, str) and raw_id.isdigit():
                        existing_item_ids.append(int(raw_id))
                    code = _extract_pomon_part_code(pit)
                    if code and code not in existing_by_code:
                        existing_by_code[code] = pit

                prf_cost_code = str(prf_detail.get("PurchaseCostCode") or "").strip()
                override_cost_code = str(getattr(args, "default_purchase_cost_code", "") or "").strip()
                if override_cost_code:
                    prf_cost_code = override_cost_code
                prf_coa_id = prf_detail.get("COAID")
                prf_budget_year = prf_detail.get("BudgetYear")
                fallback_item = pomon_items[0] if pomon_items else {}
                if not prf_cost_code and isinstance(fallback_item, dict):
                    prf_cost_code = str(fallback_item.get("PurchaseCostCode") or "").strip()
                if not isinstance(prf_coa_id, int) and isinstance(fallback_item, dict):
                    prf_coa_id = fallback_item.get("COAID")
                if not isinstance(prf_budget_year, int) and isinstance(fallback_item, dict):
                    prf_budget_year = fallback_item.get("BudgetYear")

                replace_plan: List[Dict[str, object]] = []
                items_to_create: List[Dict[str, object]] = []
                for item_code, mapped in code_map.items():
                    desc = str(mapped.get("description") or "").strip()
                    name = desc[:200] if desc else item_code
                    item_desc = (desc[:1000] if desc else "") or None
                    qty = mapped.get("quantity")
                    qty_num = qty if isinstance(qty, int) and qty > 0 else 1

                    unit_price = None
                    prev = existing_by_code.get(item_code)
                    if isinstance(prev, dict):
                        unit_price = prev.get("UnitPrice")
                    if unit_price is None:
                        unit_price = mapped.get("unit_price")
                    unit_price_num = float(unit_price) if isinstance(unit_price, (int, float)) else None

                    split_po = str(mapped.get("split_po") or "").strip() or None
                    original_po = str(mapped.get("original_po") or "").strip() or None

                    reasons: List[str] = []
                    if unit_price_num is None or unit_price_num <= 0:
                        reasons.append("missing_or_non_positive_unit_price")
                    if split_po and not original_po:
                        reasons.append("split_po_requires_original_po")

                    desired_item: Dict[str, object] = {
                        "ItemName": name,
                        "Description": item_desc,
                        "ItemCode": item_code,
                        "Quantity": qty_num,
                        "UnitPrice": unit_price_num,
                        "Specifications": None,
                        "PurchaseCostCode": prf_cost_code or None,
                        "COAID": prf_coa_id if isinstance(prf_coa_id, int) else None,
                        "BudgetYear": prf_budget_year if isinstance(prf_budget_year, int) else None,
                        "OriginalPONumber": original_po,
                        "SplitPONumber": split_po,
                    }
                    replace_plan.append({"itemCode": item_code, "desired": desired_item, "reasons": reasons})
                    if not reasons:
                        items_to_create.append(desired_item)

                replace_counts = {
                    "replace_existing_items": len(existing_item_ids),
                    "replace_pronto_items": len(code_map),
                    "replace_ready_to_create": len(items_to_create),
                    "replace_blocked_items": len([r for r in replace_plan if isinstance(r.get("reasons"), list) and len(r.get("reasons")) > 0]),
                    "replace_deleted": 0,
                    "replace_delete_failed": 0,
                    "replace_created": 0,
                    "replace_create_failed": 0,
                }
                counts.update(replace_counts)

                if is_dry_run:
                    return {
                        "prfId": prf_id,
                        "prfNo": prf_no,
                        "po": po,
                        "status": "replace_planned",
                        "counts": counts,
                        "issues": issues,
                        "items": [],
                        "missingItems": [],
                        "replaceItems": replace_plan,
                    }

                if counts["replace_blocked_items"] > 0:
                    return {
                        "prfId": prf_id,
                        "prfNo": prf_no,
                        "po": po,
                        "status": "replace_blocked",
                        "counts": counts,
                        "issues": issues,
                        "items": [],
                        "missingItems": [],
                        "replaceItems": replace_plan,
                    }

                for item_id_int in existing_item_ids:
                    try:
                        _delete_prf_item(args.base_url, args.api_key, item_id_int)
                        counts["replace_deleted"] += 1
                    except Exception:
                        counts["replace_delete_failed"] += 1

                if counts["replace_delete_failed"] > 0:
                    return {
                        "prfId": prf_id,
                        "prfNo": prf_no,
                        "po": po,
                        "status": "replace_delete_failed",
                        "counts": counts,
                        "issues": issues,
                        "items": [],
                        "missingItems": [],
                        "replaceItems": replace_plan,
                    }

                chunk_size = 50
                for i in range(0, len(items_to_create), chunk_size):
                    chunk = items_to_create[i : i + chunk_size]
                    try:
                        created = _add_prf_items(args.base_url, args.api_key, prf_id, chunk)
                        counts["replace_created"] += len(created)
                    except Exception:
                        counts["replace_create_failed"] += len(chunk)

                return {
                    "prfId": prf_id,
                    "prfNo": prf_no,
                    "po": po,
                    "status": "replaced",
                    "counts": counts,
                    "issues": issues,
                    "items": [],
                    "missingItems": [],
                    "replaceItems": replace_plan,
                }
            for it in pomon_items:
                item_id = it.get("PRFItemID") or it.get("id")
                item_id_int = None
                if isinstance(item_id, int):
                    item_id_int = item_id
                elif isinstance(item_id, str) and item_id.isdigit():
                    item_id_int = int(item_id)
                part_code = _extract_pomon_part_code(it)
                mapped = code_map.get(part_code) if part_code else None
                if not mapped and bool(args.sync_item_description):
                    current_desc = _norm_text(it.get("Description"))
                    if current_desc and current_desc in pronto_by_desc and current_desc not in duplicate_descs:
                        mapped = pronto_by_desc[current_desc]
                desired: Dict[str, object] = {}
                skipped: List[str] = []
                if mapped:
                    counts["matched"] += 1
                    desired["OriginalPONumber"] = mapped.get("original_po")
                    desired["ItemCode"] = mapped.get("item_code")
                    split_po = str(mapped.get("split_po") or "").strip()
                    if split_po:
                        desired["SplitPONumber"] = split_po
                    qty = mapped.get("quantity")
                    if isinstance(qty, int):
                        desired["Quantity"] = qty
                    else:
                        skipped.append("quantity_non_integer_or_missing")
                        counts["skipped_qty"] += 1
                    if bool(args.sync_item_description):
                        ddesc = str(mapped.get("description") or "").strip()
                        if ddesc:
                            desired["ItemName"] = ddesc[:200]
                else:
                    counts["unmatched"] += 1

                fields_to_check = ["OriginalPONumber", "SplitPONumber", "Quantity"]
                if bool(args.sync_item_description):
                    fields_to_check.append("ItemName")
                fields_to_check.append("ItemCode")
                current_subset = {k: it.get(k) for k in fields_to_check}
                changes = _diff_fields(current_subset, desired) if desired else {}
                if changes:
                    counts["changes"] += 1
                applied = False
                apply_error = ""
                if desired and changes and not is_dry_run and item_id_int is not None:
                    try:
                        _update_prf_item(args.base_url, args.api_key, item_id_int, desired)
                        applied = True
                        counts["applied"] += 1
                    except Exception as e:
                        apply_error = (str(e) or type(e).__name__)[:800]
                        counts["apply_failed"] += 1
                        print(
                            "PRF item apply failed "
                            + json.dumps(
                                {
                                    "prfNo": prf_no,
                                    "po": po,
                                    "prfItemId": item_id_int,
                                    "partCode": part_code or "",
                                    "error": apply_error,
                                }
                            ),
                            flush=True,
                        )
                out_rows.append(
                    {
                        "prfItemId": item_id,
                        "partCode": part_code or "",
                        "matched": bool(mapped),
                        "current": current_subset,
                        "desired": desired,
                        "changes": {k: {"from": v[0], "to": v[1]} for k, v in changes.items()},
                        "skipped": skipped,
                        "applied": applied,
                        "applyError": apply_error,
                    }
                )

            if bool(args.add_missing_item):
                prf_cost_code = str(prf_detail.get("PurchaseCostCode") or "").strip()
                override_cost_code = str(getattr(args, "default_purchase_cost_code", "") or "").strip()
                if override_cost_code:
                    prf_cost_code = override_cost_code
                prf_coa_id = prf_detail.get("COAID")
                prf_budget_year = prf_detail.get("BudgetYear")
                fallback_item = pomon_items[0] if pomon_items else {}
                if not prf_cost_code and isinstance(fallback_item, dict):
                    prf_cost_code = str(fallback_item.get("PurchaseCostCode") or "").strip()
                if not isinstance(prf_coa_id, int) and isinstance(fallback_item, dict):
                    prf_coa_id = fallback_item.get("COAID")
                if not isinstance(prf_budget_year, int) and isinstance(fallback_item, dict):
                    prf_budget_year = fallback_item.get("BudgetYear")

                for item_code, mapped in code_map.items():
                    if item_code in pomon_part_codes:
                        continue
                    counts["missing_pronto_items"] += 1
                    desc = str(mapped.get("description") or "").strip()
                    item_name = (desc[:200] if desc else item_code) or item_code
                    item_desc = desc[:1000] if desc else ""
                    unit_price = mapped.get("unit_price")
                    unit_price_num = float(unit_price) if isinstance(unit_price, (int, float)) else None
                    qty = mapped.get("quantity")
                    qty_num = qty if isinstance(qty, int) and qty > 0 else 1

                    reasons: List[str] = []
                    if unit_price_num is None or unit_price_num <= 0:
                        reasons.append("missing_or_non_positive_unit_price")

                    desired_item: Dict[str, object] = {
                        "ItemName": item_name,
                        "Description": item_desc or None,
                        "ItemCode": item_code,
                        "Quantity": qty_num,
                        "UnitPrice": unit_price_num,
                        "Specifications": None,
                        "PurchaseCostCode": prf_cost_code or None,
                        "COAID": prf_coa_id if isinstance(prf_coa_id, int) else None,
                        "BudgetYear": prf_budget_year if isinstance(prf_budget_year, int) else None,
                        "OriginalPONumber": str(mapped.get("original_po") or "").strip() or None,
                        "SplitPONumber": str(mapped.get("split_po") or "").strip() or None,
                    }

                    added = False
                    add_error = ""
                    added_ids: List[object] = []
                    if not is_dry_run and not reasons:
                        try:
                            created = _add_prf_items(args.base_url, args.api_key, prf_id, [desired_item])
                            added = True
                            counts["missing_added"] += 1
                            for c in created:
                                if isinstance(c, dict):
                                    added_ids.append(c.get("PRFItemID") or c.get("id"))
                        except Exception as e:
                            add_error = type(e).__name__
                            counts["missing_add_failed"] += 1
                    missing_items_out.append(
                        {
                            "itemCode": item_code,
                            "desired": desired_item,
                            "reasons": reasons,
                            "added": added,
                            "addedItemIds": added_ids,
                            "addError": add_error,
                        }
                    )

            return {
                "prfId": prf_id,
                "prfNo": prf_no,
                "po": po,
                "status": "ok",
                "counts": counts,
                "issues": issues,
                "items": out_rows,
                "missingItems": missing_items_out,
            }

        if prfno:
            if not po_no:
                po_no = prfno
            headless = bool(args.pronto_headless)
            if args.pronto_source == "live":
                pronto_items_json = _gather_pronto_items_for_pos(
                    pos=[po_no],
                    artifacts_dir=args.artifacts_dir,
                    headless=headless,
                    max_scrolls=pronto_items_max_scrolls,
                    capture_screenshots=bool(args.pronto_screenshots),
                    write_per_po_json=bool(args.pronto_per_po_json),
                )
            if not os.path.exists(pronto_items_json):
                raise SystemExit(f"Missing pronto items json: {pronto_items_json}")
            batch = _read_pronto_prf_items_batch(pronto_items_json)
            results = batch.get("results")
            if not isinstance(results, list):
                raise SystemExit("Invalid pronto items batch format")
            pronto_by_po.clear()
            for r in results:
                if not isinstance(r, dict):
                    continue
                po = str(r.get("po") or "").strip()
                if po:
                    pronto_by_po[po] = r
            print(
                "Config "
                + json.dumps(
                    {
                        "base_url": args.base_url,
                        "api_key": _mask(args.api_key),
                        "mode": "sync_prf_items_single",
                        "dry_run": bool(is_dry_run),
                        "prfno": prfno,
                        "po_no": po_no,
                        "pronto_items_json": pronto_items_json,
                        "artifacts_dir": args.artifacts_dir,
                    }
                )
            )

            prf = _fetch_prf_by_prfno(args.base_url, args.api_key, prfno)
            prf_id_raw = prf.get("PRFID") or prf.get("id")
            if isinstance(prf_id_raw, int):
                prf_id = prf_id_raw
            elif isinstance(prf_id_raw, str) and prf_id_raw.isdigit():
                prf_id = int(prf_id_raw)
            else:
                raise SystemExit("Cannot resolve PRFID for PRFNo")

            report = {
                "mode": "sync_prf_items",
                "dryRun": bool(is_dry_run),
                "result": sync_one_prf(prf_id=prf_id, prf_no=prfno, po=po_no),
            }
            out_path = os.path.join(args.artifacts_dir, f"prf_item_sync_dryrun_{prfno}.json")
            _write_json(out_path, report)
            print(f"Wrote report {out_path}")
            return 0

        print(
            "Config "
            + json.dumps(
                {
                    "base_url": args.base_url,
                    "api_key": _mask(args.api_key),
                    "mode": "sync_prf_items_budget_year",
                    "dry_run": bool(is_dry_run),
                    "budget_year": args.budget_year,
                    "limit": args.limit,
                    "max_prfs": args.max_prfs,
                    "pronto_items_json": pronto_items_json,
                    "artifacts_dir": args.artifacts_dir,
                }
            )
        )

        prf_objs = _fetch_all_prfs(args.base_url, args.api_key, args.limit)
        prf_summaries: List[PrfSummary] = []
        for obj in prf_objs:
            if isinstance(obj, dict):
                s = _extract_prf_summary(obj)
                if s:
                    prf_summaries.append(s)
        candidates = _build_candidates(prf_summaries, int(args.budget_year))
        if args.max_prfs and args.max_prfs > 0:
            candidates = candidates[: args.max_prfs]

        headless = bool(args.pronto_headless)
        if args.pronto_source == "live":
            pos = [c.order_no for c in candidates]
            pronto_items_json = _gather_pronto_items_for_pos(
                pos=pos,
                artifacts_dir=args.artifacts_dir,
                headless=headless,
                max_scrolls=pronto_items_max_scrolls,
                capture_screenshots=bool(args.pronto_screenshots),
                write_per_po_json=bool(args.pronto_per_po_json),
            )
        if not os.path.exists(pronto_items_json):
            raise SystemExit(f"Missing pronto items json: {pronto_items_json}")
        batch = _read_pronto_prf_items_batch(pronto_items_json)
        results = batch.get("results")
        if not isinstance(results, list):
            raise SystemExit("Invalid pronto items batch format")
        pronto_by_po.clear()
        for r in results:
            if not isinstance(r, dict):
                continue
            po = str(r.get("po") or "").strip()
            if po:
                pronto_by_po[po] = r

        report_rows: List[Dict[str, object]] = []
        total = len(candidates)
        totals = {
            "ok": 0,
            "missing_pronto_items": 0,
            "changes": 0,
            "applied": 0,
            "apply_failed": 0,
            "matched": 0,
            "unmatched": 0,
            "skipped_qty": 0,
        }
        for idx, cand in enumerate(candidates, start=1):
            po = cand.order_no
            r = sync_one_prf(prf_id=cand.prf.prf_id, prf_no=cand.prf.prf_no, po=po)
            report_rows.append(r)
            status = str(r.get("status") or "")
            if status == "ok":
                totals["ok"] += 1
                c = r.get("counts")
                if isinstance(c, dict):
                    totals["changes"] += int(c.get("changes") or 0)
                    totals["applied"] += int(c.get("applied") or 0)
                    totals["apply_failed"] += int(c.get("apply_failed") or 0)
                    totals["matched"] += int(c.get("matched") or 0)
                    totals["unmatched"] += int(c.get("unmatched") or 0)
                    totals["skipped_qty"] += int(c.get("skipped_qty") or 0)
            elif status == "missing_pronto_items":
                totals["missing_pronto_items"] += 1

            if idx % log_every == 0 or idx == total:
                c = r.get("counts") if isinstance(r, dict) else None
                print(
                    "PRF items progress "
                    + json.dumps(
                        {
                            "index": idx,
                            "total": total,
                            "prfNo": cand.prf.prf_no,
                            "po": po,
                            "status": status,
                            "changes": int(c.get("changes") or 0) if isinstance(c, dict) else 0,
                            "applied": int(c.get("applied") or 0) if isinstance(c, dict) else 0,
                            "apply_failed": int(c.get("apply_failed") or 0) if isinstance(c, dict) else 0,
                            "matched": int(c.get("matched") or 0) if isinstance(c, dict) else 0,
                            "unmatched": int(c.get("unmatched") or 0) if isinstance(c, dict) else 0,
                            "skipped_qty": int(c.get("skipped_qty") or 0) if isinstance(c, dict) else 0,
                        }
                    ),
                    flush=True,
                )

        out = {
            "mode": "sync_prf_items",
            "dryRun": bool(is_dry_run),
            "budgetYear": int(args.budget_year),
            "candidates": total,
            "pronto_items_json": pronto_items_json,
            "results": report_rows,
        }
        out_path = os.path.join(args.artifacts_dir, f"prf_item_sync_dryrun_{int(args.budget_year)}.json")
        _write_json(out_path, out)
        print("PRF items summary " + json.dumps(totals), flush=True)
        print(f"Wrote report {out_path}")
        return 0

    print(
        "Config "
        + json.dumps(
            {
                "base_url": args.base_url,
                "api_key": _mask(args.api_key),
                "prfno": str(args.prfno).strip() or None,
                "budget_year": args.budget_year,
                "limit": args.limit,
                "max_prfs": args.max_prfs,
                "apply": bool(args.apply),
                "dry_run": bool(is_dry_run),
                "pronto_source": args.pronto_source,
                "report_all_fields": bool(args.report_all_fields),
                "sync": {
                    "status": bool(args.sync_status),
                    "approved_by_name": bool(args.sync_approved_by),
                    "vendor": bool(args.sync_vendor),
                    "currency": bool(args.sync_currency),
                    "approval_date": bool(args.sync_approval_date),
                    "completion_date": bool(args.sync_completion_date),
                    "amounts": bool(args.sync_amounts),
                    "amount_source": str(args.amount_source),
                    "required_date": bool(args.sync_required_date),
                    "request_date": bool(args.sync_request_date),
                },
            }
        )
    )

    prf_objs = _fetch_all_prfs(args.base_url, args.api_key, args.limit)
    prf_summaries: List[PrfSummary] = []
    for obj in prf_objs:
        if isinstance(obj, dict):
            s = _extract_prf_summary(obj)
            if s:
                prf_summaries.append(s)

    candidates = _build_candidates(prf_summaries, args.budget_year)
    prfno = str(args.prfno).strip()
    if prfno:
        candidates = [c for c in candidates if c.prf.prf_no == prfno]
        if not candidates:
            out = {
                "mode": "sync_prf_header",
                "dryRun": bool(is_dry_run),
                "budgetYear": int(args.budget_year),
                "candidates": 0,
                "results": [
                    {
                        "prfNo": prfno,
                        "prfId": None,
                        "orderNo": prfno,
                        "status": "no_candidate_for_prfno",
                    }
                ],
            }
            out_path = os.path.join(args.artifacts_dir, f"prf_pronto_sync_{int(args.budget_year)}.json")
            _write_json(out_path, out)
            print(f"PRFs total={len(prf_summaries)} candidates=0 budget_year={args.budget_year}")
            print(f"Wrote report {out_path}")
            return 0
    if args.max_prfs and args.max_prfs > 0:
        candidates = candidates[: args.max_prfs]

    order_nos = [c.order_no for c in candidates]
    print(f"PRFs total={len(prf_summaries)} candidates={len(candidates)} budget_year={args.budget_year}")

    pronto_rows: Dict[str, Dict[str, str]]
    if args.pronto_source == "json":
        pronto_rows = _read_pronto_rows_json(args.pronto_json)
    else:
        if not args.pronto_username or not args.pronto_password:
            raise SystemExit("Missing PRONTO_USERNAME/PRONTO_PASSWORD")
        headless = bool(args.pronto_headless)
        pronto_rows = asyncio.run(
            _fetch_pronto_rows_live(
                target_url=args.pronto_url,
                username=args.pronto_username,
                password=args.pronto_password,
                order_nos=order_nos,
                headless=headless,
                artifacts_dir=args.artifacts_dir,
            )
        )

    report_rows: List[Dict[str, object]] = []
    options = SyncOptions(
        sync_status=bool(args.sync_status),
        sync_requested_date=bool(args.sync_request_date),
        sync_required_date=bool(args.sync_required_date),
        sync_approval_date=bool(args.sync_approval_date),
        sync_completion_date=bool(args.sync_completion_date),
        sync_approved_by=bool(args.sync_approved_by),
        sync_vendor=bool(args.sync_vendor),
        sync_currency=bool(args.sync_currency),
        sync_amounts=bool(args.sync_amounts),
        amount_source=str(args.amount_source),
    )

    for idx, cand in enumerate(candidates, start=1):
        row = pronto_rows.get(cand.order_no)
        if not row:
            report_rows.append(
                {
                    "prfNo": cand.prf.prf_no,
                    "prfId": cand.prf.prf_id,
                    "orderNo": cand.order_no,
                    "status": "missing_pronto_row",
                }
            )
            continue

        current = _fetch_prf_detail(args.base_url, args.api_key, cand.prf.prf_id)
        if _is_completed_status(current.get("Status")):
            report_rows.append(
                {
                    "prfNo": cand.prf.prf_no,
                    "prfId": cand.prf.prf_id,
                    "orderNo": cand.order_no,
                    "status": "skipped_completed",
                }
            )
            continue
        desired, evaluated = _evaluate_fields(row, current, options)
        changes = _diff_fields(current, desired)
        if not desired:
            row_out: Dict[str, object] = {
                "prfNo": cand.prf.prf_no,
                "prfId": cand.prf.prf_id,
                "orderNo": cand.order_no,
                "status": "no_desired_fields",
            }
            if args.report_all_fields:
                row_out["evaluated"] = evaluated
                row_out["prontoRow"] = row
            report_rows.append(row_out)
            continue
        if not changes:
            row_out = {
                "prfNo": cand.prf.prf_no,
                "prfId": cand.prf.prf_id,
                "orderNo": cand.order_no,
                "status": "no_change",
            }
            if args.report_all_fields:
                row_out["evaluated"] = evaluated
                row_out["desiredPayload"] = desired
                row_out["prontoRow"] = row
            report_rows.append(row_out)
            continue

        if is_dry_run:
            row_out = {
                "prfNo": cand.prf.prf_no,
                "prfId": cand.prf.prf_id,
                "orderNo": cand.order_no,
                "status": "dry_run",
                "changes": {k: {"from": v[0], "to": v[1]} for k, v in changes.items()},
            }
            if args.report_all_fields:
                row_out["evaluated"] = evaluated
                row_out["desiredPayload"] = desired
                row_out["prontoRow"] = row
            report_rows.append(row_out)
            print(f"[DRY] {idx}/{len(candidates)} prfNo={cand.prf.prf_no} changed={list(changes.keys())}")
            continue

        t0 = time.monotonic()
        _update_prf(args.base_url, args.api_key, cand.prf.prf_no, desired)
        dt_ms = int((time.monotonic() - t0) * 1000)
        report_rows.append(
            {
                "prfNo": cand.prf.prf_no,
                "prfId": cand.prf.prf_id,
                "orderNo": cand.order_no,
                "status": "updated",
                "durationMs": dt_ms,
                "updatedFields": list(desired.keys()),
            }
        )
        print(f"[UPD] {idx}/{len(candidates)} prfNo={cand.prf.prf_no} duration_ms={dt_ms}")

    out_path = os.path.join(args.artifacts_dir, f"prf_pronto_sync_{args.budget_year}.json")
    _write_json(out_path, {"budgetYear": args.budget_year, "dryRun": is_dry_run, "results": report_rows})
    print(f"Wrote report {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
