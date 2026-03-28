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

from pronto_access import (
    _click_find,
    _click_login,
    _click_ok,
    _ensure_orders_find_mode,
    _ensure_standard_grid,
    _extract_top_row_orders,
    _fill_po_number,
    _locate_password,
    _locate_username,
    _navigate_menu,
    _wait_for_label,
)


@dataclass(frozen=True)
class PrfSummary:
    prf_id: int
    prf_no: str
    budget_year: Optional[int]


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
    if len(value) <= 6:
        return "*" * len(value)
    return value[:3] + "*" * (len(value) - 6) + value[-3:]


def _http_headers(api_key: str) -> Dict[str, str]:
    return {
        "x-api-key": api_key,
        "x-sync-source": "pronto",
        "accept": "application/json",
        "content-type": "application/json",
    }


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
    if not isinstance(prf_id, int):
        return None
    if not isinstance(prf_no, str) or not prf_no.strip():
        return None
    by: Optional[int]
    if isinstance(budget_year, int):
        by = budget_year
    else:
        by = None
    return PrfSummary(prf_id=prf_id, prf_no=prf_no.strip(), budget_year=by)


def _is_numeric_order_no(value: str) -> bool:
    return bool(re.fullmatch(r"\d+", value.strip()))


def _build_candidates(prfs: List[PrfSummary], target_budget_year: int) -> List[SyncCandidate]:
    out: List[SyncCandidate] = []
    for p in prfs:
        if p.budget_year != target_budget_year:
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

            find_ok = await _click_find(page)
            if not find_ok:
                raise RuntimeError("Cannot open Find dialog")

            for idx, order_no in enumerate(order_nos, start=1):
                t0 = time.monotonic()
                await _ensure_orders_find_mode(page)
                filled = await _fill_po_number(page, order_no)
                if not filled:
                    continue
                try:
                    await page.wait_for_load_state("networkidle", timeout=60000)
                except PlaywrightTimeoutError:
                    pass
                await _click_ok(page)
                await _ensure_standard_grid(page)
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

    print(
        "Config "
        + json.dumps(
            {
                "base_url": args.base_url,
                "api_key": _mask(args.api_key),
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
