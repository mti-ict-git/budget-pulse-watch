"""Read the Pronto Immediate Action queue (PO M094) and send it to POMON.

Read-only. For every requisition in "Approve/Review Requisitions (Immediate Action Req'd)" it reads
the list row, Next Action By and Approval Status, then posts one snapshot to
POST /api/pronto-queue/snapshot. POMON matches the order numbers to its PRFs and split POs.

Safety rules (PO M094 has data-changing actions such as Approve, Correct, Cancel and Buyer):
- Rows are never clicked: clicking a cell opens supplier editing. The row cursor is moved with the
  list's First / Down navigation buttons instead.
- Only these controls are clicked: the toolbar labels Next Action By and Approval Status (exact
  match), the navigation buttons #pro-nav-first, #pro-nav-down and #pro-nav-page-down, and the card
  close button.
- Each card is checked against the expected order number (the Requisition field on Next Action By,
  the "Purchase Requisition - <no>" title on Approval Status). A mismatch is recorded as an error
  for that row instead of storing another requisition's data.

Environment: TARGET_URL, PRONTO_USERNAME, PRONTO_PASSWORD, POMON_BASE_URL, POMON_API_KEY,
PRONTO_HEADLESS (default true).
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import requests
from playwright.async_api import async_playwright

from pronto_access import (
    _click_login,
    _click_toolbar_button,
    _close_card,
    _current_function_code,
    _ensure_standard_grid,
    _locate_password,
    _locate_username,
    _navigate_menu,
    _open_function,
    _read_card_fields,
    _read_table,
    _set_visible_rows,
    _wait_for_function,
    _wait_for_label,
    _wait_for_table,
)
from pronto_po_parse import pair_card_fields, parse_approval_rows
from pronto_queue_parse import card_value, label_value, parse_next_action_rows, parse_queue_rows

QUEUE_FUNCTION = "PO M094"
QUEUE_MENU_PATH = ["Supply Chain", "Requisitions", "Approve/Review Requisitions"]
QUEUE_TITLE = "Immediate Action Req'd"
# Wide enough that the whole M094 toolbar (Approval Status is near its end) fits without scrolling.
VIEWPORT = {"width": 2400, "height": 1100}
MAX_ROWS = 200
MAX_NEXT_ACTION_PAGES = 30


def _log(message: str) -> None:
    print(message, flush=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


async def _screen_text(page, limit: int = 200) -> str:
    try:
        return re.sub(r"\s+", " ", await page.inner_text("body", timeout=3000)).strip()[:limit]
    except Exception:
        return ""


async def _login_once(page, url: str, username: str, password: str, menu_timeout_ms: int) -> Optional[str]:
    """One login attempt; returns None when the Pronto menu is shown, else what the screen showed."""
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_load_state("load", timeout=60000)
    if await _wait_for_label(page, "Supply Chain", 8000):
        return None
    u = await _locate_username(page)
    p = await _locate_password(page)
    if not (u and p):
        return f"login form not found; screen: {await _screen_text(page)!r}"
    _log("Login attempt")
    await u.fill(username)
    await p.fill(password)
    if not await _click_login(page):
        return "login button not found"
    # Pronto can take a while to open the session after a busy period (seen 2026-11-26 21:13,
    # right after a sync cycle); wait for the menu itself rather than for network idle.
    if await _wait_for_label(page, "Supply Chain", menu_timeout_ms):
        return None
    return f"menu did not appear within {menu_timeout_ms // 1000}s; screen: {await _screen_text(page)!r}"


async def _login(page, url: str, username: str, password: str) -> None:
    """Log in, retrying once after a pause: a slow or busy Pronto is the usual cause of a miss."""
    problem = await _login_once(page, url, username, password, 90000)
    if problem is None:
        return
    _log(f"Login did not complete ({problem}); retrying once")
    await page.wait_for_timeout(15000)
    retry = await _login_once(page, url, username, password, 90000)
    if retry is None:
        return
    raise RuntimeError(f"Pronto login failed twice: {retry}")


async def _sign_out(page, url: str) -> None:
    """End this Pronto session, so an hourly read does not leave sessions open. Best effort.

    The logout URL redirects, so goto can report ERR_ABORTED although the sign-out worked; the
    "Signed out" page is what counts.
    """
    root = re.sub(r"(https?://[^/]+).*", r"\1", url.strip())
    try:
        await page.goto(f"{root}/logout?exit=1&url=.", wait_until="domcontentloaded", timeout=15000)
    except Exception:
        pass
    try:
        await page.get_by_text("Signed out", exact=False).first.wait_for(timeout=10000)
        _log("Signed out of Pronto")
    except Exception:
        _log("Pronto sign-out not confirmed")


async def _queue_title_visible(page) -> bool:
    try:
        loc = page.get_by_text(re.compile(r"Approve/Review Requisitions \(Immediate Action Req'd\)"))
        for i in range(await loc.count()):
            if await loc.nth(i).is_visible():
                return True
    except Exception:
        return False
    return False


async def _open_queue(page, scan_timeout_ms: int) -> None:
    opened = await _open_function(page, QUEUE_FUNCTION)
    if not opened:
        opened = await _navigate_menu(page, QUEUE_MENU_PATH) and await _wait_for_function(page, QUEUE_FUNCTION)
    if not opened:
        raise RuntimeError("Could not open Approve/Review Requisitions (PO M094)")
    # The function first scans all requisitions ("Scanning Requisitions"), then shows the list.
    if await _wait_for_table(page, "Order No", scan_timeout_ms) is None:
        raise RuntimeError("Approve/Review Requisitions list did not load")
    if not await _queue_title_visible(page):
        raise RuntimeError("PO M094 did not open in Immediate Action Req'd mode")
    await _ensure_standard_grid(page)
    await _set_visible_rows(page, MAX_ROWS)


async def _back_to_queue(page) -> bool:
    """After closing a card, wait until the M094 list is the active screen again."""
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if await _current_function_code(page) == QUEUE_FUNCTION and await _queue_title_visible(page):
            if await _wait_for_table(page, "Order No", 1000) is not None:
                return True
        await page.wait_for_timeout(300)
    return False


async def _click_nav(page, button_id: str) -> str:
    """Click a list navigation button (`#pro-nav-first`, `#pro-nav-down`, ...) of the newest card.

    Returns "clicked", "disabled" (Pronto disables First on the first row and Down on the last), or
    "missing".
    """
    loc = page.locator(f"button#{button_id}")
    for i in range(await loc.count() - 1, -1, -1):
        el = loc.nth(i)
        if not await el.is_visible():
            continue
        if not await el.is_enabled():
            return "disabled"
        await el.click(timeout=10000)
        await page.wait_for_timeout(300)
        return "clicked"
    return "missing"


async def _select_row(page, index: int, settle_ms: int = 400) -> None:
    """Put the list cursor on row `index` (0-based) with First, then Down `index` times."""
    if await _click_nav(page, "pro-nav-first") == "missing":
        raise RuntimeError("first_button_not_found")
    await page.wait_for_timeout(settle_ms)
    for step in range(index):
        state = await _click_nav(page, "pro-nav-down")
        if state != "clicked":
            raise RuntimeError(f"down_button_{state}_at_row_{step + 1}")
        await page.wait_for_timeout(settle_ms)


async def _read_next_action_by(page, order_no: str) -> List[Dict[str, str]]:
    if not await _click_toolbar_button(page, "Next Action By"):
        raise RuntimeError("next_action_by_button_not_found")
    try:
        table = await _wait_for_table(page, "Hierarchy", 15000)
        if table is None:
            raise RuntimeError("next_action_by_table_not_visible")
        shown = card_value(pair_card_fields(await _read_card_fields(page)), "Requisition")
        if shown != order_no:
            raise RuntimeError(f"next_action_by_shows_{shown or 'unknown'}")
        await _set_visible_rows(page, MAX_ROWS)
        entries: List[Dict[str, str]] = []
        seen = set()
        last_page: Optional[str] = None
        for _ in range(MAX_NEXT_ACTION_PAGES):
            table = await _wait_for_table(page, "Hierarchy", 5000)
            if table is None:
                break
            headers, rows = await _read_table(table)
            page_key = json.dumps(rows)
            if page_key == last_page:
                break
            last_page = page_key
            for e in parse_next_action_rows(headers, rows):
                key = (e["name"], e["user"], e["hierarchy"])
                if key not in seen:
                    seen.add(key)
                    entries.append(e)
            # Long lists are paged; Page Down is disabled or stops changing the rows at the last page.
            if await _click_nav(page, "pro-nav-page-down") != "clicked":
                break
            await page.wait_for_timeout(500)
        return entries
    finally:
        await _close_card(page)


async def _approval_card_order_no(page, expected: str, timeout_ms: int = 5000) -> str:
    """Order number in the visible "Purchase Requisition - <no>" title; waits briefly for `expected`."""
    rx = re.compile(r"Purchase Requisition\s*-\s*(\d+)")
    deadline = time.monotonic() + timeout_ms / 1000
    seen = ""
    while True:
        loc = page.get_by_text(rx)
        for i in range(await loc.count() - 1, -1, -1):
            el = loc.nth(i)
            if await el.is_visible():
                m = rx.search((await el.inner_text()) or "")
                if m:
                    seen = m.group(1)
                    if seen == expected:
                        return seen
                    break
        if time.monotonic() >= deadline:
            return seen
        await page.wait_for_timeout(300)


async def _read_approval_status(page, order_no: str) -> List[Dict[str, object]]:
    if not await _click_toolbar_button(page, "Approval Status"):
        raise RuntimeError("approval_status_button_not_found")
    try:
        table = await _wait_for_table(page, "Approval User", 15000)
        if table is None:
            raise RuntimeError("approval_table_not_visible")
        shown = await _approval_card_order_no(page, order_no)
        if shown != order_no:
            raise RuntimeError(f"approval_status_shows_{shown or 'unknown'}")
        await _set_visible_rows(page, MAX_ROWS)
        table = await _wait_for_table(page, "Approval User", 5000) or table
        headers, rows = await _read_table(table)
        return parse_approval_rows(headers, rows)
    finally:
        await _close_card(page)


async def _read_on_row(page, index: int, moved: bool, reader, order_no: str):
    """Run a card reader for row `index`. The cursor is already there (`moved`); if the card shows
    another requisition (selection not settled yet), select the row again slowly and retry once."""
    try:
        return await reader(page, order_no)
    except Exception as first_error:
        if not await _back_to_queue(page):
            raise RuntimeError(f"queue_not_restored (first try: {first_error})")
        await _select_row(page, index, settle_ms=1200)
        try:
            return await reader(page, order_no)
        except Exception as e:
            raise RuntimeError(f"{e} (first try: {first_error})")


def _mark_not_read(rows: List[Dict[str, object]], start: int) -> None:
    for later in rows[start:]:
        later.setdefault("nextActionBy", [])
        later.setdefault("approvals", [])
        later["errors"] = ["not_read"]


async def gather_queue(page, scan_timeout_ms: int) -> Tuple[str, List[Dict[str, object]]]:
    await _open_queue(page, scan_timeout_ms)
    pronto_user = label_value(await _read_card_fields(page), "User")
    table = await _wait_for_table(page, "Order No", 5000)
    if table is None:
        raise RuntimeError("Approve/Review Requisitions list is not visible")
    headers, raw_rows = await _read_table(table)
    rows = parse_queue_rows(headers, raw_rows)
    _log(f"Immediate Action queue user={pronto_user or '?'} rows={len(rows)}")
    if rows:
        await _select_row(page, 0)
    for index, row in enumerate(rows):
        order_no = str(row["orderNo"])
        errors: List[str] = []
        row["nextActionBy"] = []
        row["approvals"] = []
        # Closing a card leaves the cursor on its row, so each next row is one Down away.
        if index > 0:
            state = await _click_nav(page, "pro-nav-down")
            await page.wait_for_timeout(600)
            if state != "clicked":
                errors.append(f"down_button_{state}")
        for key, reader in (("nextActionBy", _read_next_action_by), ("approvals", _read_approval_status)):
            try:
                row[key] = await _read_on_row(page, index, True, reader, order_no)
            except Exception as e:
                errors.append(f"{key}:{e}")
            if not await _back_to_queue(page):
                errors.append("queue_not_restored")
                break
        row["errors"] = errors
        _log(
            f"Queue row {order_no}: nextActionBy={len(row['nextActionBy'])} approvals={len(row['approvals'])}"
            + (f" errors={errors}" if errors else "")
        )
        if "queue_not_restored" in errors:
            _log("Could not return to the Immediate Action list; the remaining rows are not read")
            _mark_not_read(rows, index + 1)
            break
    return pronto_user, rows


def _post_snapshot(base_url: str, api_key: str, body: Dict[str, object]) -> None:
    url = base_url.rstrip("/") + "/api/pronto-queue/snapshot"
    resp = requests.post(
        url,
        headers={"x-api-key": api_key, "content-type": "application/json", "accept": "application/json"},
        json=body,
        timeout=60,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"POMON rejected the queue snapshot: HTTP {resp.status_code} {resp.text[:300]}")


async def run(args: argparse.Namespace) -> int:
    url = os.getenv("TARGET_URL", "https://newpronto.merdekacoppergold.com:8443/")
    username = os.getenv("PRONTO_USERNAME") or ""
    password = os.getenv("PRONTO_PASSWORD") or ""
    base_url = (os.getenv("POMON_BASE_URL") or "").strip()
    api_key = (os.getenv("POMON_API_KEY") or "").strip()
    if not username or not password:
        raise RuntimeError("PRONTO_USERNAME and PRONTO_PASSWORD are required")
    if not args.dry_run and not (base_url and api_key):
        raise RuntimeError("POMON_BASE_URL and POMON_API_KEY are required (or use --dry-run)")

    started = time.monotonic()
    error: Optional[str] = None
    pronto_user = ""
    rows: Optional[List[Dict[str, object]]] = None
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=args.headless, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(ignore_https_errors=True, viewport=VIEWPORT)
        page = await context.new_page()
        try:
            await _login(page, url, username, password)
            pronto_user, rows = await gather_queue(page, args.scan_timeout_seconds * 1000)
        except Exception as e:
            error = str(e)[:900] or type(e).__name__
            _log(f"Queue read failed: {error}")
        finally:
            await _sign_out(page, url)
            await browser.close()

    body: Dict[str, object] = {
        "checkedAt": _now_iso(),
        "prontoUser": pronto_user or None,
        "error": error,
        # null keeps the last good snapshot when the read failed before the list was read.
        "rows": rows,
        "durationMs": int((time.monotonic() - started) * 1000),
    }
    if args.dry_run:
        _log(json.dumps(body, ensure_ascii=False, indent=2))
    else:
        _post_snapshot(base_url, api_key, body)
        _log(f"Queue snapshot sent rows={len(rows) if rows is not None else 'unchanged'} error={bool(error)}")
    return 1 if error else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Read the Pronto Immediate Action queue (PO M094), read-only.")
    parser.add_argument("--dry-run", action="store_true", help="Print the snapshot instead of sending it to POMON")
    parser.add_argument("--pronto-headless", dest="headless", action="store_true", default=True)
    parser.add_argument("--no-pronto-headless", dest="headless", action="store_false")
    parser.add_argument("--scan-timeout-seconds", type=int, default=int(os.getenv("PRONTO_QUEUE_SCAN_TIMEOUT_SECONDS", "300")))
    args = parser.parse_args()
    try:
        return asyncio.run(run(args))
    except Exception as e:
        _log(f"Queue read error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
