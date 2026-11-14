"""Browser test: PO E001 recovers after "Record not found" (production 2026-11-14, PO 41562).

Runs against a static page that copies the Pronto Xi markup seen live on 2026-11-15: a message box
with its own OK (`button.pro-button`) on top of Find mode (toolbar `#pro-nav-ok` / `#pro-nav-cancel`).
Skipped when Playwright or its Chromium is not installed.
"""

import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from playwright.async_api import async_playwright
except ImportError:  # pragma: no cover
    async_playwright = None

import pronto_access as pa  # noqa: E402

PAGE = """
<div class="card-header-toolbar-module-function">PO E001</div>
<button class="page-close" onclick="window.closed = (window.closed || 0) + 1">x</button>
<table><thead><tr><th>Order No</th><th>Status</th></tr></thead>
  <tbody><tr class="dg-row"><td>41562</td><td></td></tr></tbody></table>
<div id="entry">
  <button id="pro-nav-ok" class="btn ok" onclick="window.resubmitted = true">OK</button>
  <button id="pro-nav-cancel" class="btn cancel"
    onclick="document.getElementById('entry').remove(); window.findCancelled = true">Cancel</button>
</div>
<div id="msg">
  <div class="field-row"><label class="card-field" title="Record not found with key specified">
    <span>Record not found with key specified</span></label></div>
  <div class="field-value"><button class="card-field pro-button"
    onclick="document.getElementById('msg').remove()">OK</button></div>
</div>
"""


def run(coro_fn):
    async def main():
        async with async_playwright() as p:
            try:
                browser = await p.chromium.launch(headless=True)
            except Exception as e:  # Chromium not installed
                raise unittest.SkipTest(f"chromium unavailable: {e}")
            page = await browser.new_page()
            await page.set_content(PAGE)
            try:
                return await coro_fn(page)
            finally:
                await browser.close()

    return asyncio.run(main())


@unittest.skipIf(async_playwright is None, "playwright not installed")
class RecoveryTests(unittest.TestCase):
    def test_dismiss_clicks_the_message_ok_not_the_find_ok(self):
        async def check(page):
            text = await pa._dismiss_message_box(page)
            return text, await page.evaluate("window.resubmitted === true"), await page.locator("#msg").count()

        text, resubmitted, msg_left = run(check)
        self.assertEqual(text, "Record not found with key specified")
        self.assertFalse(resubmitted)
        self.assertEqual(msg_left, 0)

    def test_ensure_po_list_leaves_find_mode_without_closing_the_list(self):
        async def check(page):
            ready, actions = await pa._ensure_po_list(page)
            return ready, actions, await page.evaluate(
                "({cancelled: window.findCancelled === true, resubmitted: window.resubmitted === true, closed: window.closed || 0})"
            )

        ready, actions, flags = run(check)
        self.assertTrue(ready)
        self.assertEqual(actions, ["message_dismissed", "find_cancelled"])
        self.assertTrue(flags["cancelled"])
        self.assertFalse(flags["resubmitted"])
        self.assertEqual(flags["closed"], 0)

    def test_ensure_po_list_is_a_no_op_on_a_clean_list(self):
        async def check(page):
            await page.evaluate("document.getElementById('msg').remove(); document.getElementById('entry').remove()")
            return await pa._ensure_po_list(page)

        ready, actions = run(check)
        self.assertTrue(ready)
        self.assertEqual(actions, [])


if __name__ == "__main__":
    unittest.main()
