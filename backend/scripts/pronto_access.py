import asyncio
import argparse
import os
import re
import json
import time
from typing import List, Optional, Dict, Tuple
from dotenv import load_dotenv
import requests
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError, Locator


def _dbg(enabled: bool, message: str) -> None:
    if enabled:
        print(message, flush=True)


def _report_progress(step: str, event: str, index: int, total: int, payload: Dict[str, object]) -> None:
    base_url = (os.getenv("POMON_BASE_URL") or "").strip()
    api_key = (os.getenv("POMON_API_KEY") or "").strip()
    if not base_url or not api_key:
        return
    url = base_url.rstrip("/") + "/api/settings/pronto-sync/progress"
    try:
        requests.post(
            url,
            headers={"x-api-key": api_key, "content-type": "application/json", "accept": "application/json"},
            json={"step": step, "event": event, "index": index, "total": total, "payload": payload},
            timeout=3,
        )
    except Exception:
        return


async def _first_available(locators: List[Locator]) -> Optional[Locator]:
    for loc in locators:
        try:
            if await loc.count() > 0:
                return loc.first
        except Exception:
            continue
    return None


async def _find_clickable(page, label: str) -> Optional[Locator]:
    rx_exact = re.compile(rf"^{re.escape(label)}$", re.IGNORECASE)
    rx_any = re.compile(rf"{re.escape(label)}", re.IGNORECASE)
    candidates = [
        page.get_by_role("button", name=rx_exact),
        page.get_by_role("link", name=rx_exact),
        page.get_by_role("menuitem", name=rx_exact),
        page.get_by_role("treeitem", name=rx_exact),
        page.get_by_text(label, exact=True),
        page.get_by_role("button", name=rx_any),
        page.get_by_role("link", name=rx_any),
        page.get_by_role("menuitem", name=rx_any),
        page.get_by_role("treeitem", name=rx_any),
        page.get_by_text(label, exact=False),
    ]
    found = await _first_available(candidates)
    if found:
        return found
    navs = page.locator("nav")
    try:
        if await navs.count() > 0:
            for i in range(await navs.count()):
                nav = navs.nth(i)
                cand = await _first_available(
                    [
                        nav.get_by_role("link", name=rx_any),
                        nav.get_by_role("menuitem", name=rx_any),
                        nav.get_by_role("treeitem", name=rx_any),
                        nav.get_by_text(label, exact=False),
                    ]
                )
                if cand:
                    return cand
    except Exception:
        pass
    return None


async def _locate_username(page) -> Optional[Locator]:
    candidates = [
        page.get_by_label("Username"),
        page.get_by_label("User name"),
        page.locator("input[name='username']"),
        page.locator("#username"),
        page.locator("input[type='text']"),
    ]
    return await _first_available(candidates)


async def _locate_password(page) -> Optional[Locator]:
    candidates = [
        page.get_by_label("Password"),
        page.locator("input[name='password']"),
        page.locator("#password"),
        page.locator("input[type='password']"),
    ]
    return await _first_available(candidates)


async def _click_login(page) -> bool:
    label_variants = ["Sign in", "Log in", "Login", "SIGN IN", "LOG IN"]
    candidates: List[Locator] = []
    for name in label_variants:
        candidates.append(page.get_by_role("button", name=re.compile(rf"^{re.escape(name)}$", re.IGNORECASE)))
        candidates.append(page.get_by_role("button", name=re.compile(rf"{re.escape(name)}", re.IGNORECASE)))
    candidates.extend(
        [
            page.locator("button[type='submit']"),
            page.locator("input[type='submit']"),
            page.locator("button"),
        ]
    )
    for loc in candidates:
        try:
            if await loc.count() > 0:
                await loc.first.click(timeout=5000)
                return True
        except Exception:
            continue
    return False


async def _navigate_menu(page, path: List[str]) -> bool:
    for i, label in enumerate(path):
        try:
            item = await _find_clickable(page, label)
            if not item:
                return False
            success = False
            for _ in range(3):
                try:
                    await item.scroll_into_view_if_needed(timeout=5000)
                except Exception:
                    pass
                await item.click(timeout=10000)
                await page.wait_for_timeout(600)
                if i + 1 < len(path):
                    nxt = await _find_clickable(page, path[i + 1])
                    if nxt:
                        success = True
                        break
                else:
                    success = True
                    break
            if not success:
                return False
        except Exception:
            return False
    return True


async def _click_find(page) -> bool:
    loc = await _find_clickable(page, "Find")
    if not loc:
        return False
    try:
        await loc.click(timeout=10000)
        await page.wait_for_timeout(300)
        return True
    except Exception:
        return False


async def _click_detail(page) -> bool:
    loc = await _find_clickable(page, "Detail")
    if not loc:
        return False
    try:
        await loc.click(timeout=10000)
        await page.wait_for_timeout(300)
        return True
    except Exception:
        return False


async def _is_find_dialog_open(page) -> bool:
    try:
        ok = page.get_by_role("button", name=re.compile(r"^OK$", re.IGNORECASE))
        cancel = page.get_by_role("button", name=re.compile(r"^Cancel$", re.IGNORECASE))
        return (await ok.count()) > 0 and (await cancel.count()) > 0
    except Exception:
        return False


async def _exit_find_dialog(page) -> None:
    try:
        if not await _is_find_dialog_open(page):
            return
        cancel = page.get_by_role("button", name=re.compile(r"^Cancel$", re.IGNORECASE))
        if await cancel.count() > 0:
            await cancel.first.click(timeout=5000)
            await page.wait_for_timeout(300)
    except Exception:
        return None


async def _apply_requisition_find(page, requisition_number: str) -> Tuple[bool, Dict[str, object]]:
    stats: Dict[str, object] = {}
    try:
        t0 = time.monotonic()
        ok_find = await _click_find(page)
        stats["click_find_ok"] = ok_find
        stats["click_find_ms"] = int((time.monotonic() - t0) * 1000)
        if not ok_find:
            return False, stats
        t_wait0 = time.monotonic()
        while int((time.monotonic() - t_wait0) * 1000) < 8000:
            if await _is_find_dialog_open(page):
                break
            await page.wait_for_timeout(200)
        stats["find_dialog_open"] = await _is_find_dialog_open(page)
        stats["wait_find_dialog_ms"] = int((time.monotonic() - t_wait0) * 1000)
        if not stats["find_dialog_open"]:
            return False, stats

        table = await _locate_table_by_column(
            page,
            re.compile(r"^Requisition\s*No\.?$", re.IGNORECASE),
            header_text_fallback="Requisition No.",
        )
        editor = None
        if table:
            editor = await _first_available(
                [
                    table.locator("xpath=.//tbody//input[1]:visible"),
                    table.locator("input:visible"),
                ]
            )
        if not editor:
            editor = await _first_available([page.locator("input:visible")])
        if not editor:
            return False, stats

        t_fill0 = time.monotonic()
        try:
            await editor.fill("")
        except Exception:
            pass
        await editor.fill(requisition_number)
        stats["fill_ms"] = int((time.monotonic() - t_fill0) * 1000)

        t_ok0 = time.monotonic()
        await _click_ok(page)
        stats["click_ok_ms"] = int((time.monotonic() - t_ok0) * 1000)

        t_close0 = time.monotonic()
        while int((time.monotonic() - t_close0) * 1000) < 8000:
            if not await _is_find_dialog_open(page):
                break
            await page.wait_for_timeout(200)
        stats["find_dialog_closed"] = not await _is_find_dialog_open(page)
        stats["wait_close_ms"] = int((time.monotonic() - t_close0) * 1000)
        try:
            table2 = await _locate_table_by_column(
                page,
                re.compile(r"^Requisition\s*No\.?$", re.IGNORECASE),
                header_text_fallback="Requisition No.",
            )
            peek: List[str] = []
            if table2:
                rows = table2.locator("xpath=.//tbody/tr")
                rc = await rows.count()
                for i in range(min(rc, 6)):
                    try:
                        txt = await rows.nth(i).locator("xpath=./td[1]").inner_text()
                    except Exception:
                        txt = ""
                    peek.append((txt or "").strip())
            stats["peek_reqno"] = peek
        except Exception:
            pass
        return bool(stats["find_dialog_closed"]), stats
    except Exception:
        return False, stats


async def _fill_po_number(page, po_number: str) -> bool:
    try:
        await _activate_order_cell(page)
        editor = await _first_available(
            [
                page.locator("table input[aria-label*='Order' i]:visible"),
                page.locator("input[aria-label='Order No']:visible"),
                page.locator("table input[type='text']:visible"),
                page.locator("[contenteditable='true']:visible"),
                page.locator("input:focus"),
            ]
        )
        if editor:
            try:
                await editor.fill("")
            except Exception:
                pass
            await editor.fill(po_number)
        else:
            try:
                await page.keyboard.press("Meta+A")
            except Exception:
                pass
            try:
                await page.keyboard.press("Control+A")
            except Exception:
                pass
            try:
                await page.keyboard.press("Backspace")
            except Exception:
                pass
            await page.keyboard.type(po_number, delay=20)
        await _press_enter_twice(page, 300)
        #await page.keyboard.press("Tab")
        #await page.keyboard.press("Tab")
        #await page.keyboard.press("Tab")
        return True
    except Exception:
        return False


def _norm_header(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip().lower()


async def _locate_table_by_column(page, header_rx: re.Pattern, header_text_fallback: Optional[str] = None) -> Optional[Locator]:
    try:
        try:
            tables = page.locator("table:visible")
            tcount = await tables.count()
            for i in range(min(tcount, 12)):
                t = tables.nth(i)
                try:
                    if await t.get_by_role("columnheader", name=header_rx).count() > 0:
                        return t
                except Exception:
                    pass
                if header_text_fallback:
                    try:
                        if await t.locator(f"xpath=.//th[normalize-space()={json.dumps(header_text_fallback)}]").count() > 0:
                            return t
                    except Exception:
                        pass
        except Exception:
            pass

        anchor = page.get_by_role("columnheader", name=header_rx)
        table = None
        if await anchor.count() > 0:
            table = anchor.first.locator("xpath=ancestor::table")
        if not table and header_text_fallback:
            table = page.locator(f"xpath=//table[.//th[normalize-space()={json.dumps(header_text_fallback)}]]")
        if table and await table.count() > 0:
            return table.first
        return None
    except Exception:
        return None


async def _activate_first_cell_by_column(page, header_rx: re.Pattern, header_text_fallback: Optional[str] = None) -> Optional[Locator]:
    try:
        table = await _locate_table_by_column(page, header_rx, header_text_fallback)
        if not table:
            return None
        first_cell = table.locator("xpath=.//tbody/tr[1]/td[1]")
        if await first_cell.count() == 0:
            first_cell = table.locator("xpath=.//tr[2]/td[1]")
        if await first_cell.count() > 0:
            await first_cell.first.dblclick()
            await page.wait_for_timeout(200)
            return first_cell.first
        return None
    except Exception:
        return None


async def _fill_requisition_number(page, requisition_number: str) -> bool:
    try:
        await _activate_first_cell_by_column(
            page, re.compile(r"^Requisition\s*No\.?$", re.IGNORECASE), header_text_fallback="Requisition No."
        )
        editor = await _first_available(
            [
                page.locator("table input[aria-label*='Requisition' i]:visible"),
                page.locator("table input[aria-label*='Req' i]:visible"),
                page.locator("table input[type='text']:visible"),
                page.locator("[contenteditable='true']:visible"),
                page.locator("input:focus"),
            ]
        )
        if editor:
            try:
                await editor.fill("")
            except Exception:
                pass
            await editor.fill(requisition_number)
        else:
            try:
                await page.keyboard.press("Meta+A")
            except Exception:
                pass
            try:
                await page.keyboard.press("Control+A")
            except Exception:
                pass
            try:
                await page.keyboard.press("Backspace")
            except Exception:
                pass
            await page.keyboard.type(requisition_number, delay=20)
        await _press_enter_twice(page, 300)
        return True
    except Exception:
        return False


async def _extract_all_rows_by_column(
    page,
    header_rx: re.Pattern,
    header_text_fallback: Optional[str] = None,
    max_scrolls: int = 60,
    stats: Optional[Dict[str, object]] = None,
) -> Tuple[List[str], List[Dict[str, str]]]:
    try:
        t0 = time.monotonic()
        table = await _locate_table_by_column(page, header_rx, header_text_fallback)
        if not table:
            return [], []

        headers: List[str] = []
        header_nodes = table.get_by_role("columnheader")
        count_h = await header_nodes.count()
        if count_h == 0:
            header_nodes = table.locator("xpath=.//th")
            count_h = await header_nodes.count()
        for i in range(count_h):
            t = await header_nodes.nth(i).inner_text()
            headers.append(t.strip())

        def _row_to_dict(values: List[str]) -> Dict[str, str]:
            result: Dict[str, str] = {}
            for i in range(min(len(values), len(headers))):
                key = headers[i] if headers[i] else f"col_{i}"
                result[key] = values[i].strip()
            for i in range(len(headers), len(values)):
                result[f"col_{i}"] = values[i].strip()
            return result

        seen: set = set()
        rows_out: List[Dict[str, str]] = []
        extract_calls = 0

        async def extract_visible() -> int:
            nonlocal extract_calls
            extract_calls += 1
            rows = table.get_by_role("row")
            if await rows.count() == 0:
                rows = table.locator("xpath=.//tr")
            added = 0
            row_count = await rows.count()
            for i in range(row_count):
                row = rows.nth(i)
                try:
                    if await row.get_by_role("columnheader").count() > 0:
                        continue
                except Exception:
                    pass
                cells = row.get_by_role("cell")
                cell_count = await cells.count()
                if cell_count == 0:
                    cells = row.locator("xpath=.//td")
                    cell_count = await cells.count()
                if cell_count == 0:
                    continue
                vals: List[str] = []
                for c in range(cell_count):
                    try:
                        txt = await cells.nth(c).inner_text()
                    except Exception:
                        txt = ""
                    vals.append((txt or "").strip())
                key = "|".join(vals)
                if not key.strip():
                    continue
                if key in seen:
                    continue
                seen.add(key)
                rows_out.append(_row_to_dict(vals))
                added += 1
            return added

        await extract_visible()

        try:
            first_cell = table.locator("xpath=.//tbody/tr[1]/td[1]")
            if await first_cell.count() == 0:
                first_cell = table.locator("xpath=.//tr[2]/td[1]")
            if await first_cell.count() > 0:
                await first_cell.first.click(timeout=3000)
        except Exception:
            pass

        scrolls_done = 0
        stagnant = 0
        for _ in range(max_scrolls):
            scrolls_done += 1
            try:
                await page.keyboard.press("PageDown")
            except Exception:
                try:
                    await page.mouse.wheel(0, 800)
                except Exception:
                    break
            await page.wait_for_timeout(350)
            added = await extract_visible()
            if added == 0:
                stagnant += 1
            else:
                stagnant = 0
            if stagnant >= 2:
                break
        if stats is not None:
            stats["extract_ms"] = int((time.monotonic() - t0) * 1000)
            stats["rows_unique"] = len(rows_out)
            stats["scrolls_done"] = scrolls_done
            stats["stagnant_break"] = stagnant
            stats["extract_calls"] = extract_calls

        return headers, rows_out
    except Exception:
        return [], []


async def _extract_matching_rows_by_column_value(
    page,
    header_rx: re.Pattern,
    target_value: str,
    header_text_fallback: Optional[str] = None,
    max_scrolls: int = 60,
    stats: Optional[Dict[str, object]] = None,
) -> Tuple[List[str], List[Dict[str, str]]]:
    try:
        t0 = time.monotonic()
        table = await _locate_table_by_column(page, header_rx, header_text_fallback)
        if not table:
            return [], []

        headers: List[str] = []
        header_nodes = table.get_by_role("columnheader")
        count_h = await header_nodes.count()
        if count_h == 0:
            header_nodes = table.locator("xpath=.//th")
            count_h = await header_nodes.count()
        for i in range(count_h):
            t = await header_nodes.nth(i).inner_text()
            headers.append(t.strip())

        col_idx = None
        for i, h in enumerate(headers):
            if header_rx.match(h or ""):
                col_idx = i
                break
        if col_idx is None:
            for i, h in enumerate(headers):
                if _norm_header(h).startswith("requisition no"):
                    col_idx = i
                    break
        if col_idx is None:
            return headers, []

        def _row_to_dict(values: List[str]) -> Dict[str, str]:
            result: Dict[str, str] = {}
            for i in range(min(len(values), len(headers))):
                key = headers[i] if headers[i] else f"col_{i}"
                result[key] = values[i].strip()
            for i in range(len(headers), len(values)):
                result[f"col_{i}"] = values[i].strip()
            return result

        target_value = (target_value or "").strip()
        target_num = int(target_value) if target_value.isdigit() else None

        matches: List[Dict[str, str]] = []
        seen_match: set = set()
        rows_scanned = 0
        extract_calls = 0

        async def scan_visible() -> Tuple[int, Optional[int], Optional[int]]:
            nonlocal rows_scanned, extract_calls
            extract_calls += 1
            rows = table.get_by_role("row")
            if await rows.count() == 0:
                rows = table.locator("xpath=.//tr")
            row_count = await rows.count()
            added = 0
            vmin = None
            vmax = None
            for i in range(row_count):
                row = rows.nth(i)
                try:
                    if await row.get_by_role("columnheader").count() > 0:
                        continue
                except Exception:
                    pass
                cells = row.get_by_role("cell")
                cell_count = await cells.count()
                if cell_count == 0:
                    cells = row.locator("xpath=.//td")
                    cell_count = await cells.count()
                if cell_count == 0 or col_idx >= cell_count:
                    continue
                rows_scanned += 1
                try:
                    req_txt = (await cells.nth(col_idx).inner_text() or "").strip()
                except Exception:
                    req_txt = ""
                if req_txt.isdigit():
                    n = int(req_txt)
                    vmin = n if vmin is None else min(vmin, n)
                    vmax = n if vmax is None else max(vmax, n)
                if req_txt != target_value:
                    continue
                vals: List[str] = []
                for c in range(cell_count):
                    try:
                        txt = await cells.nth(c).inner_text()
                    except Exception:
                        txt = ""
                    vals.append((txt or "").strip())
                key = "|".join(vals)
                if not key.strip():
                    continue
                if key in seen_match:
                    continue
                seen_match.add(key)
                matches.append(_row_to_dict(vals))
                added += 1
            return added, vmin, vmax

        try:
            first_cell = table.locator("xpath=.//tbody/tr[1]/td[1]")
            if await first_cell.count() == 0:
                first_cell = table.locator("xpath=.//tr[2]/td[1]")
            if await first_cell.count() > 0:
                await first_cell.first.click(timeout=3000)
        except Exception:
            pass

        added, vmin, vmax = await scan_visible()
        scrolls_done = 0
        stagnant = 0
        for _ in range(max_scrolls):
            if target_num is not None and vmin is not None and vmin > target_num and len(matches) > 0:
                break
            if target_num is not None and vmax is not None and vmax < target_num and len(matches) == 0:
                pass
            scrolls_done += 1
            try:
                await page.keyboard.press("PageDown")
            except Exception:
                try:
                    await page.mouse.wheel(0, 800)
                except Exception:
                    break
            await page.wait_for_timeout(150)
            added, vmin, vmax = await scan_visible()
            if added == 0 and len(matches) > 0:
                stagnant += 1
            elif added > 0:
                stagnant = 0
            if stagnant >= 2:
                break

        if stats is not None:
            stats["scan_ms"] = int((time.monotonic() - t0) * 1000)
            stats["matches"] = len(matches)
            stats["rows_scanned"] = rows_scanned
            stats["scrolls_done"] = scrolls_done
            stats["stagnant_break"] = stagnant
            stats["extract_calls"] = extract_calls
            stats["mode"] = "match_only"

        return headers, matches
    except Exception:
        return [], []


async def _select_requisition_row(page, requisition_no: str, description: Optional[str]) -> bool:
    try:
        table = await _locate_table_by_column(
            page,
            re.compile(r"^Requisition\s*No\.?$", re.IGNORECASE),
            header_text_fallback="Requisition No.",
        )
        if not table:
            return False

        if description:
            for exact in (True, False):
                try:
                    cell = table.get_by_text(description, exact=exact)
                    if await cell.count() > 0:
                        try:
                            await cell.first.scroll_into_view_if_needed(timeout=3000)
                        except Exception:
                            pass
                        await cell.first.click(timeout=5000)
                        await page.wait_for_timeout(200)
                        return True
                except Exception:
                    continue

        for exact in (True, False):
            try:
                cell = table.get_by_text(requisition_no, exact=exact)
                if await cell.count() > 0:
                    try:
                        await cell.first.scroll_into_view_if_needed(timeout=3000)
                    except Exception:
                        pass
                    await cell.first.click(timeout=5000)
                    await page.wait_for_timeout(200)
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False


async def _select_requisition_row_by_occurrence(page, requisition_no: str, occurrence: int) -> bool:
    try:
        table = await _locate_table_by_column(
            page,
            re.compile(r"^Requisition\s*No\.?$", re.IGNORECASE),
            header_text_fallback="Requisition No.",
        )
        if not table:
            return False
        rows = table.locator("xpath=.//tbody/tr")
        rc = await rows.count()
        seen = 0
        for i in range(rc):
            r = rows.nth(i)
            try:
                first = await r.locator("xpath=./td[1]").inner_text()
            except Exception:
                first = ""
            if (first or "").strip() != requisition_no:
                continue
            seen += 1
            if seen == max(1, occurrence):
                try:
                    await r.scroll_into_view_if_needed(timeout=3000)
                except Exception:
                    pass
                try:
                    await r.click(timeout=5000)
                except Exception:
                    try:
                        await r.locator("xpath=./td[1]").click(timeout=5000)
                    except Exception:
                        return False
                await page.wait_for_timeout(200)
                return True
        return False
    except Exception:
        return False

async def _extract_detail_fields(page, max_fields: int = 250) -> Dict[str, str]:
    result: Dict[str, str] = {}
    fields = page.locator("input:visible, textarea:visible, select:visible")
    try:
        count = await fields.count()
    except Exception:
        return result
    for i in range(min(count, max_fields)):
        f = fields.nth(i)
        try:
            tag = await f.evaluate("el => el.tagName.toLowerCase()")
        except Exception:
            continue
        label = ""
        try:
            label = (await f.get_attribute("aria-label")) or ""
        except Exception:
            label = ""
        if not label:
            try:
                label = (await f.get_attribute("placeholder")) or ""
            except Exception:
                label = ""
        if not label:
            try:
                fid = (await f.get_attribute("id")) or ""
                if fid:
                    lab = page.locator(f"label[for={json.dumps(fid)}]:visible")
                    if await lab.count() > 0:
                        label = (await lab.first.inner_text() or "").strip()
            except Exception:
                label = ""
        if not label:
            try:
                label = (await f.get_attribute("name")) or ""
            except Exception:
                label = ""
        if not label:
            label = f"field_{i}"

        value = ""
        try:
            if tag == "select":
                value = await f.evaluate("el => (el.options && el.selectedIndex >= 0) ? (el.options[el.selectedIndex].textContent || '') : (el.value || '')")
            else:
                value = await f.input_value()
        except Exception:
            value = ""
        key = label.strip()
        if key and key not in result:
            result[key] = (value or "").strip()
    return result


async def _extract_dialog_kv(page) -> Dict[str, str]:
    try:
        txt = ""
        container = None
        dlg = page.get_by_role("dialog")
        if await dlg.count() > 0:
            try:
                txt = await dlg.first.inner_text()
            except Exception:
                txt = ""
        if not txt:
            title = page.get_by_text(re.compile(r"^Requisition Enquiry$", re.IGNORECASE))
            if await title.count() > 0:
                container = title.first.locator("xpath=ancestor::*[.//button[normalize-space()='OK']][1]")
                if await container.count() > 0:
                    container = container.first
                    txt = await container.inner_text()
                else:
                    container = title.first.locator("xpath=ancestor::*[self::div or self::section][1]").first
                    txt = await container.inner_text()
        if not txt:
            return {}
        out: Dict[str, str] = {}
        if container is not None:
            try:
                items = container.locator("label.card-field")
                n = await items.count()
                by_y: Dict[str, List[Tuple[int, str, str, str]]] = {}
                rx = re.compile(r"y:(\d+)")
                for i in range(min(n, 200)):
                    it = items.nth(i)
                    try:
                        name_attr = (await it.get_attribute("name")) or ""
                    except Exception:
                        name_attr = ""
                    m = rx.search(name_attr)
                    if not m:
                        continue
                    y = m.group(1)
                    try:
                        cls = (await it.get_attribute("class")) or ""
                    except Exception:
                        cls = ""
                    try:
                        title = (await it.get_attribute("title")) or ""
                    except Exception:
                        title = ""
                    try:
                        text = (await it.inner_text()) or ""
                    except Exception:
                        text = ""
                    try:
                        x_m = re.search(r"x:(\d+)", name_attr)
                        x = int(x_m.group(1)) if x_m else 0
                    except Exception:
                        x = 0
                    by_y.setdefault(y, []).append((x, cls, title.strip(), text.strip()))
                for _, group in by_y.items():
                    group_sorted = sorted(group, key=lambda t: t[0])
                    key = ""
                    for _, _, title, text in group_sorted:
                        cand = title or text
                        if cand.endswith(":"):
                            key = cand.rstrip(":").strip()
                            break
                    if not key:
                        continue
                    val = ""
                    for _, cls, title, text in reversed(group_sorted):
                        if "sunken" in (cls or "") or (title and not title.endswith(":")):
                            val = title or text
                            if val and val != "\xa0":
                                break
                    val = (val or "").replace("\xa0", "").strip()
                    if key and val and key not in out:
                        out[key] = val
                if out:
                    return out
            except Exception:
                pass

        if container is not None:
            try:
                rows = container.locator("xpath=.//tr[.//input or .//textarea or .//select]")
                rc = await rows.count()
                if rc > 0:
                    for i in range(rc):
                        r = rows.nth(i)
                        try:
                            label = await r.locator("xpath=./td[1]").inner_text()
                        except Exception:
                            label = ""
                        key = (label or "").strip().rstrip(":").strip()
                        if not key:
                            continue
                        field = r.locator("input, textarea, select").first
                        val = ""
                        try:
                            tag = await field.evaluate("el => el.tagName.toLowerCase()")
                        except Exception:
                            tag = ""
                        try:
                            if tag == "select":
                                val = await field.evaluate(
                                    "el => (el.options && el.selectedIndex >= 0) ? (el.options[el.selectedIndex].textContent || '') : (el.value || '')"
                                )
                            else:
                                val = await field.input_value()
                        except Exception:
                            val = ""
                        if key and val and key not in out:
                            out[key] = (val or "").strip()
                    if out:
                        return out
            except Exception:
                pass

        lines = [ln.strip() for ln in (txt or "").splitlines() if ln.strip()]
        known_labels = {
            "requisition no.",
            "date of requisition",
            "item code",
            "description",
            "work order no.",
            "qty required",
            "qty issued",
            "estimated price",
            "status",
            "user id",
            "needed by",
            "purchase order no.",
            "expected deliv. date",
            "suggested supplier",
            "comments",
        }
        i = 0
        while i < len(lines):
            line = lines[i]
            if not line or ":" not in line:
                norm = line.rstrip(":").strip().lower()
                if norm in known_labels and i + 1 < len(lines):
                    val = lines[i + 1].strip()
                    if val and val.rstrip(":").strip().lower() not in known_labels and ":" not in val:
                        out[line.rstrip(":").strip()] = val
                        i += 2
                        continue
                i += 1
                continue
            k, v = line.split(":", 1)
            key = k.strip()
            val = v.strip()
            if not key:
                i += 1
                continue
            if not val and i + 1 < len(lines):
                nxt = lines[i + 1]
                if nxt and ":" not in nxt:
                    val = nxt
                    i += 1
            if key not in out and val:
                out[key] = val
            i += 1
        return out
    except Exception:
        return {}

async def _focus_order_cell(page) -> None:
    try:
        header = page.get_by_role("columnheader", name=re.compile(r"^Order", re.IGNORECASE))
        box = None
        if await header.count() > 0:
            box = await header.first.bounding_box()
        if box:
            x = box["x"] + 10
            y = box["y"] + box["height"] + 20
            await page.mouse.click(x, y, click_count=1)
    except Exception:
        return None


async def _click_ok(page) -> None:
    try:
        ok = await _first_available(
            [
                page.get_by_role("button", name=re.compile(r"^OK", re.IGNORECASE)),
                page.get_by_text(re.compile(r"^OK", re.IGNORECASE)),
            ]
        )
        if ok:
            await ok.click(timeout=5000)
    except Exception:
        return None


async def _press_enter_twice(page, delay_ms: int = 600) -> None:
    try:
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(delay_ms)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(delay_ms)
    except Exception:
        return None


async def _ensure_standard_grid(page) -> None:
    try:
        std = await _first_available(
            [
                page.get_by_text("Standard", exact=True),
                page.get_by_role("button", name=re.compile(r"^Standard$", re.IGNORECASE)),
                page.get_by_role("tab", name=re.compile(r"^Standard$", re.IGNORECASE)),
            ]
        )
        if std:
            await std.click(timeout=5000)
            await page.wait_for_timeout(300)
    except Exception:
        return None


async def _extract_top_row_orders(page) -> Dict[str, str]:
    try:
        anchor = page.get_by_role("columnheader", name=re.compile(r"^Order\\s*No$", re.IGNORECASE))
        table = None
        if await anchor.count() > 0:
            table = anchor.first.locator("xpath=ancestor::table")
        if not table:
            table = page.locator("xpath=//table[.//th[normalize-space()='Order No']]")
        headers: List[str] = []
        header_nodes = table.get_by_role("columnheader")
        count_h = await header_nodes.count()
        if count_h == 0:
            header_nodes = table.locator("xpath=.//th")
            count_h = await header_nodes.count()
        for i in range(count_h):
            t = await header_nodes.nth(i).inner_text()
            headers.append(t.strip())
        rows = table.get_by_role("row")
        if await rows.count() == 0:
            rows = table.locator("xpath=.//tr")
        top_row = rows.nth(1) if await rows.count() > 1 else rows.first
        result: Dict[str, str] = {}
        cells = top_row.get_by_role("cell")
        cell_count = await cells.count()
        if cell_count == 0:
            cells = top_row.locator("xpath=.//td")
            cell_count = await cells.count()
        for i in range(min(cell_count, len(headers))):
            key = headers[i] if headers[i] else f"col_{i}"
            val = await cells.nth(i).inner_text()
            result[key] = val.strip()
        return result
    except Exception:
        return {}

async def _ensure_purchase_orders(page) -> bool:
    try:
        title = page.get_by_text(re.compile(r"^Purchase Orders", re.IGNORECASE))
        if await title.count() > 0:
            return True
        ok = await _navigate_menu(page, ["Supply Chain", "Purchasing", "Purchase Orders"])
        await page.wait_for_timeout(500)
        return ok
    except Exception:
        return False

async def _shortcut_find(page) -> bool:
    try:
        await page.keyboard.press("f")
        await page.wait_for_timeout(200)
        return True
    except Exception:
        return False

async def _is_orders_grid_active(page) -> bool:
    try:
        hdr = page.get_by_role("columnheader", name=re.compile(r"^Order\\s*No$", re.IGNORECASE))
        return (await hdr.count()) > 0
    except Exception:
        return False

async def _ensure_orders_find_mode(page) -> None:
    try:
        if not await _is_orders_grid_active(page):
            await _ensure_purchase_orders(page)
        await _click_find(page)
        await page.wait_for_timeout(300)
    except Exception:
        return None

async def _wait_order_cell_value(page, expected_regex: Optional[re.Pattern] = None, timeout_ms: int = 12000) -> bool:
    try:
        start = time.monotonic()
        while int((time.monotonic() - start) * 1000) < timeout_ms:
            table = await _extract_top_row_orders(page)
            val = table.get("Order No", "")
            if val and (expected_regex is None or expected_regex.match(val)):
                return True
            await page.wait_for_timeout(300)
        return False
    except Exception:
        return False

async def _activate_order_cell(page) -> Optional[Locator]:
    try:
        anchor = page.get_by_role("columnheader", name=re.compile(r"^Order\\s*No$", re.IGNORECASE))
        table = None
        if await anchor.count() > 0:
            table = anchor.first.locator("xpath=ancestor::table")
        if not table:
            table = page.locator("xpath=//table[.//th[normalize-space()='Order No']]")
        first_cell = table.locator("xpath=.//tbody/tr[1]/td[1]")
        if await first_cell.count() == 0:
            first_cell = table.locator("xpath=.//tr[2]/td[1]")
        if await first_cell.count() > 0:
            await first_cell.first.dblclick()
            await page.wait_for_timeout(200)
            return first_cell.first
    except Exception:
        return None
    return None

async def _wait_for_label(page, label: str, timeout_ms: int = 15000) -> bool:
    elapsed = 0
    step = 500
    while elapsed < timeout_ms:
        item = await _find_clickable(page, label)
        if item:
            try:
                await item.scroll_into_view_if_needed(timeout=3000)
            except Exception:
                pass
            return True
        await page.wait_for_timeout(step)
        elapsed += step
    return False


async def main(*, check_item: bool = False, debug: bool = False, max_scrolls: int = 60) -> None:
    load_dotenv()
    if os.path.exists(".env.pronto"):
        load_dotenv(".env.pronto", override=False)
    url = os.getenv("TARGET_URL", "https://newpronto.merdekacoppergold.com:8443/")
    username = os.getenv("PRONTO_USERNAME")
    password = os.getenv("PRONTO_PASSWORD")
    po_number = os.getenv("PRONTO_PO_NUMBER", "41898")
    po_list_raw = os.getenv("PRONTO_PO_LIST")
    capture_screenshots_raw = os.getenv("PRONTO_CAPTURE_SCREENSHOTS")
    capture_screenshots = True
    if capture_screenshots_raw is not None:
        capture_screenshots = capture_screenshots_raw.strip().lower() in {"1", "true", "yes", "y", "on"}
    write_per_po_json_raw = os.getenv("PRONTO_WRITE_PER_PO_JSON")
    write_per_po_json = True
    if write_per_po_json_raw is not None:
        write_per_po_json = write_per_po_json_raw.strip().lower() in {"1", "true", "yes", "y", "on"}
    po_list: List[str] = []
    if po_list_raw:
        for part in re.split(r"[,\s]+", po_list_raw.strip()):
            if part:
                po_list.append(part)
    async with async_playwright() as p:
        headless_raw = os.getenv("PRONTO_HEADLESS")
        headless = False
        if headless_raw is not None:
            v = headless_raw.strip().lower()
            headless = v in {"1", "true", "yes", "y", "on"}
        browser = await p.chromium.launch(headless=headless, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        def _console_handler(msg) -> None:
            t = msg.text
            if "wss://localhost:3000" in t or "WebSocket connection" in t:
                return
        page.on("console", _console_handler)
        try:
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            status = resp.status if resp else "n/a"
            print(f"Navigated to {url} status={status}")
            await page.wait_for_load_state("load", timeout=60000)
            title = await page.title()
            print(f"Title: {title}", flush=True)
            artifacts_dir = os.getenv("ARTIFACTS_DIR", "artifacts").strip() or "artifacts"
            try:
                os.makedirs(artifacts_dir, exist_ok=True)
            except OSError:
                artifacts_dir = os.path.join(os.getenv("TMPDIR", "/tmp"), "python-service-artifacts")
                os.makedirs(artifacts_dir, exist_ok=True)
            login_path = os.path.join(artifacts_dir, "pronto_login.png")
            if capture_screenshots:
                await page.screenshot(path=login_path, full_page=True)
                print(f"Saved screenshot to {login_path}", flush=True)
            if username and password:
                print("Login attempt", flush=True)
                u = await _locate_username(page)
                p_loc = await _locate_password(page)
                if u and p_loc:
                    print("Login fields found", flush=True)
                    await u.fill(username)
                    await p_loc.fill(password)
                    clicked = await _click_login(page)
                    if clicked:
                        print("Login clicked", flush=True)
                        try:
                            await page.wait_for_load_state("networkidle", timeout=60000)
                        except PlaywrightTimeoutError:
                            pass
                    print("Waiting for left navigation", flush=True)
                    ready = await _wait_for_label(page, "Supply Chain", 20000)
                    if not ready:
                        print("Left navigation not ready", flush=True)
                    if check_item:
                        _dbg(debug, "Mode: check-item")
                        ok = await _navigate_menu(
                            page,
                            ["Supply Chain", "Requisitions", "Requisition and P/O Enquiry", "Requisition Number"],
                        )
                        await page.wait_for_timeout(1000)
                        requisition_path = os.path.join(artifacts_dir, "pronto_requisition_number.png")
                        if capture_screenshots:
                            await page.screenshot(path=requisition_path, full_page=True)
                            print(f"Saved screenshot to {requisition_path}", flush=True)
                        if not ok:
                            print("Failed to navigate to Supply Chain > Requisitions > Requisition and P/O Enquiry > Requisition Number", flush=True)
                            return
                        targets = po_list if po_list else [po_number]
                        batch_results: List[Dict[str, object]] = []
                        total_targets = len(targets)
                        for idx_target, item in enumerate(targets, start=1):
                            _dbg(debug, f"PRF start po={item}")
                            print(f"PRF gather {idx_target}/{total_targets} po={item}", flush=True)
                            _report_progress("items", "gather", idx_target, total_targets, {"po": item})
                            t0 = time.monotonic()
                            ok_find, find_stats = await _apply_requisition_find(page, item)
                            _dbg(debug, f"apply_find ok={ok_find} stats={find_stats}")
                            await _ensure_standard_grid(page)
                            extract_stats: Dict[str, object] = {}
                            headers, filtered = await _extract_matching_rows_by_column_value(
                                page,
                                re.compile(r"^Requisition\s*No\.?$", re.IGNORECASE),
                                item,
                                header_text_fallback="Requisition No.",
                                max_scrolls=max_scrolls,
                                stats=extract_stats,
                            )
                            if filtered:
                                try:
                                    await _apply_requisition_find(page, item)
                                except Exception:
                                    pass
                                await _ensure_standard_grid(page)
                            details: List[Dict[str, object]] = []
                            for idx, row in enumerate(filtered):
                                await _exit_find_dialog(page)
                                req_no = (row.get("Requisition No.") or row.get("Requisition No") or "").strip()
                                desc = (row.get("Description") or "").strip() or None
                                if not req_no:
                                    continue
                                t_detail0 = time.monotonic()
                                sel_ok = await _select_requisition_row_by_occurrence(page, req_no, idx + 1)
                                if not sel_ok:
                                    sel_ok = await _select_requisition_row(page, req_no, desc)
                                detail_ok = False
                                fields: Dict[str, str] = {}
                                dialog: Dict[str, str] = {}
                                if sel_ok:
                                    detail_ok = await _click_detail(page)
                                    if detail_ok:
                                        await page.wait_for_timeout(300)
                                        try:
                                            await page.get_by_text(re.compile(r"^Requisition Enquiry$", re.IGNORECASE)).first.wait_for(timeout=5000)
                                        except Exception:
                                            pass
                                        if debug:
                                            try:
                                                title = page.get_by_text(re.compile(r"^Requisition Enquiry$", re.IGNORECASE))
                                                if await title.count() > 0:
                                                    container = title.first.locator("xpath=ancestor::*[.//button[normalize-space()='OK']][1]")
                                                    if await container.count() > 0:
                                                        html = await container.first.inner_html()
                                                        html_path = os.path.join(artifacts_dir, f"prf_detail_{item}_{idx+1}.html")
                                                        with open(html_path, "w", encoding="utf-8") as f:
                                                            f.write(html)
                                            except Exception:
                                                pass
                                        dialog = await _extract_dialog_kv(page)
                                        fields = await _extract_detail_fields(page)
                                dt_detail_ms = int((time.monotonic() - t_detail0) * 1000)
                                shot_path = os.path.join(artifacts_dir, f"prf_detail_{item}_{idx+1}.png")
                                if capture_screenshots:
                                    try:
                                        await page.screenshot(path=shot_path, full_page=True)
                                    except Exception:
                                        shot_path = ""
                                else:
                                    shot_path = ""
                                try:
                                    await _click_ok(page)
                                    await page.wait_for_timeout(300)
                                except Exception:
                                    pass
                                details.append(
                                    {
                                        "requisition_no": req_no,
                                        "description": desc or "",
                                        "selected_ok": sel_ok,
                                        "detail_open_ok": detail_ok,
                                        "detail_ms": dt_detail_ms,
                                        "dialog": dialog,
                                        "fields": fields,
                                        "screenshot": shot_path,
                                    }
                                )
                                try:
                                    await _click_find(page)
                                    await page.wait_for_timeout(200)
                                    await _exit_find_dialog(page)
                                except Exception:
                                    pass
                            dt_ms = int((time.monotonic() - t0) * 1000)
                            result_obj: Dict[str, object] = {
                                "po": item,
                                "duration_ms": dt_ms,
                                "rows": filtered,
                                "details": details,
                                "stats": {
                                    "find": find_stats,
                                    "find_ok": ok_find,
                                    "rows_filtered": len(filtered),
                                    "extract": extract_stats,
                                    "details_count": len(details),
                                },
                            }
                            batch_results.append(result_obj)
                            if write_per_po_json:
                                out_path = os.path.join(artifacts_dir, f"prf_items_{item}.json")
                                with open(out_path, "w", encoding="utf-8") as f:
                                    json.dump(result_obj, f, ensure_ascii=False, indent=2)
                                print(f"Saved PRF items to {out_path}", flush=True)
                            print(
                                f"PRF done {idx_target}/{total_targets} po={item} duration_ms={dt_ms} rows={len(filtered)} details={len(details)}",
                                flush=True,
                            )
                            _report_progress(
                                "items",
                                "done",
                                idx_target,
                                total_targets,
                                {"po": item, "duration_ms": dt_ms, "rows": len(filtered), "details": len(details)},
                            )
                            _dbg(debug, f"PRF done po={item} duration_ms={dt_ms} rows={len(filtered)}")
                        out_batch = os.path.join(artifacts_dir, "prf_items_batch.json")
                        with open(out_batch, "w", encoding="utf-8") as f:
                            json.dump({"results": batch_results}, f, ensure_ascii=False, indent=2)
                        print(f"Saved PRF batch results to {out_batch}", flush=True)
                        return
                else:
                    print("Login fields not found", flush=True)
                    step1 = await _navigate_menu(page, ["Supply Chain"])
                    await page.wait_for_timeout(500)
                    await page.screenshot(path="artifacts/pronto_after_supply_chain.png", full_page=True)
                    step2 = False
                    if step1:
                        step2 = await _navigate_menu(page, ["Purchasing"])
                    await page.wait_for_timeout(500)
                    await page.screenshot(path="artifacts/pronto_after_purchasing.png", full_page=True)
                    step3 = False
                    if step2:
                        step3 = await _navigate_menu(page, ["Purchase Orders"])
                    await page.wait_for_timeout(1000)
                    await page.screenshot(path="artifacts/pronto_post_login.png", full_page=True)
                    if step3:
                        await page.screenshot(path="artifacts/pronto_purchase_orders.png", full_page=True)
                        find_ok = await _click_find(page)
                        if find_ok:
                            await page.wait_for_timeout(400)
                            if po_list:
                                batch_results: List[Dict[str, object]] = []
                                for item in po_list:
                                    t0 = time.monotonic()
                                    await _ensure_orders_find_mode(page)
                                    ok = await _fill_po_number(page, item)
                                    if ok:
                                        try:
                                            await page.wait_for_load_state("networkidle", timeout=60000)
                                            try:
                                                await page.get_by_text(re.compile(rf"^{re.escape(item)}$")).first.wait_for(timeout=15000)
                                            except Exception:
                                                pass
                                            await _click_ok(page)
                                            await _ensure_standard_grid(page)
                                            await _wait_order_cell_value(page, re.compile(r"^\d+$"))
                                        except PlaywrightTimeoutError:
                                            pass
                                        try:
                                            result = await _extract_top_row_orders(page)
                                            dt_ms = int((time.monotonic() - t0) * 1000)
                                            batch_results.append({"po": item, "duration_ms": dt_ms, "row": result})
                                        except Exception:
                                            dt_ms = int((time.monotonic() - t0) * 1000)
                                            batch_results.append({"po": item, "duration_ms": dt_ms, "row": {}})
                                    else:
                                        batch_results.append({"po": item, "duration_ms": 0, "row": {}})
                                os.makedirs("artifacts", exist_ok=True)
                                with open("artifacts/po_batch.json", "w", encoding="utf-8") as f:
                                    json.dump({"results": batch_results}, f, ensure_ascii=False, indent=2)
                                print("Saved batch results to artifacts/po_batch.json")
                                try:
                                    durations = [int(r.get("duration_ms", 0)) for r in batch_results]
                                    durations_sorted = sorted(durations)
                                    summary = {
                                        "count": len(durations),
                                        "min_ms": durations_sorted[0] if durations_sorted else 0,
                                        "max_ms": durations_sorted[-1] if durations_sorted else 0,
                                        "avg_ms": int(sum(durations) / len(durations)) if durations else 0,
                                        "median_ms": durations_sorted[len(durations_sorted) // 2] if durations_sorted else 0,
                                    }
                                    with open("artifacts/po_batch_summary.json", "w", encoding="utf-8") as f:
                                        json.dump(summary, f, ensure_ascii=False, indent=2)
                                    print("Saved batch summary to artifacts/po_batch_summary.json")
                                except Exception:
                                    pass
                            else:
                                filled = await _fill_po_number(page, po_number)
                                if filled:
                                    try:
                                        await page.wait_for_load_state("networkidle", timeout=60000)
                                        try:
                                            await page.get_by_text(re.compile(rf"^{re.escape(po_number)}$")).first.wait_for(timeout=15000)
                                        except Exception:
                                            pass
                                        await _click_ok(page)
                                        await _ensure_standard_grid(page)
                                    except PlaywrightTimeoutError:
                                        pass
                        try:
                            result = await _extract_top_row_orders(page)
                            os.makedirs("artifacts", exist_ok=True)
                            with open("artifacts/po_top_row.json", "w", encoding="utf-8") as f:
                                json.dump(result, f, ensure_ascii=False, indent=2)
                            print("Saved top row to artifacts/po_top_row.json")
                        except Exception:
                            pass
                        await page.screenshot(path="artifacts/pronto_po.png", full_page=True)
                        print("Saved screenshot to artifacts/pronto_po.png")
                    else:
                        print("Failed to navigate to Supply Chain > Purchasing > Purchase Orders")
        except PlaywrightTimeoutError:
            print("Navigation timed out")
        finally:
            await context.close()
            await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-item", action="store_true")
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--max-scrolls", type=int, default=60)
    args = parser.parse_args()
    asyncio.run(main(check_item=args.check_item, debug=args.debug, max_scrolls=args.max_scrolls))
