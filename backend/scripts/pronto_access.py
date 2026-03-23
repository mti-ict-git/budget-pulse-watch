import asyncio
import os
import re
import json
import time
from typing import List, Optional, Dict, Tuple
from dotenv import load_dotenv
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError, Locator


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
        await _press_enter_twice(page, 700)
        await page.keyboard.press("Tab")
        await page.keyboard.press("Tab")
        await page.keyboard.press("Tab")
        return True
    except Exception:
        return False


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


async def main() -> None:
    load_dotenv()
    url = os.getenv("TARGET_URL", "https://newpronto.merdekacoppergold.com:8443/")
    username = os.getenv("PRONTO_USERNAME")
    password = os.getenv("PRONTO_PASSWORD")
    po_number = os.getenv("PRONTO_PO_NUMBER", "41898")
    po_list_raw = os.getenv("PRONTO_PO_LIST")
    po_list: List[str] = []
    if po_list_raw:
        for part in re.split(r"[,\s]+", po_list_raw.strip()):
            if part:
                po_list.append(part)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
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
            print(f"Title: {title}")
            os.makedirs("artifacts", exist_ok=True)
            await page.screenshot(path="artifacts/pronto_login.png", full_page=True)
            print("Saved screenshot to artifacts/pronto_login.png")
            if username and password:
                u = await _locate_username(page)
                p_loc = await _locate_password(page)
                if u and p_loc:
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
                        print("Left navigation not ready")
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
    asyncio.run(main())
