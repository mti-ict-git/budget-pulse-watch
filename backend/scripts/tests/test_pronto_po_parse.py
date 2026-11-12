"""Offline tests for pronto_po_parse using screen data captured from Pronto on 2026-11-11
(requisition 51727, original PO 51727 and split PO 53851)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pronto_po_parse import (  # noqa: E402
    apply_line_detail,
    items_for_requisition,
    pair_card_fields,
    parse_approval_rows,
    parse_po_lines,
    parse_pronto_datetime,
)

LINE_HEADERS = [
    "Seq", "Item Code", "Ordered", "Unit", "In Transit", "Received", "Backorder", "Item Price",
    "Item Price ( Original )", "Discount", "Line Total", "Supp Code", "GL Account", "Notes",
    "Note Description", "Item Description",
]


def note(seq, text):
    return [seq, "Note Line", "", "", "", "", "", "", "0.0000", "0.00%", "", "", "", "", text, ""]


def item(seq, code, qty, unit, price, total, gl, desc):
    return [seq, code, qty, unit, "0.0000", "0.0000", "0.0000", price, price, "0.00%", total, code, gl, "", "", desc]


ROWS_51727 = [
    note("1.00", "Project Description/Area: AIM"),
    item("2.00", "7125-03-297513", "1.0000", "EACH", "8400000.0000", "8400000.00", "AMITCM16.6250",
         "RACK, IR9042G-42U, INDORACK"),
    note("8.00", "PRF DRC KENDARI MTI"),
    note("9.00", "=" * 60),
    note("10.00", "Request By: Adhi Surahman / Reni Sitepu IT"),
    [""] * 16,
]

ROWS_53851 = [
    note("1.00", "Project Description/Area: AIM"),
    item("3.00", "5935-03-229059", "2.0000", "EACH", "1246250.0000", "2492500.00", "AMITCM16.6250",
         "SOCKET, ELEC, RPDU, 24 PORT,"),
    note("3.10", "SOCKET, ELEC, RPDU, 24 PORT, GERMANY."),
    item("4.00", "7021-03-330869", "1.0000", "EACH", "1246250000.0000", "1246250000.00", "AMITCM35.6250",
         "COMPUTER, POWEREDGE R670,"),
    item("5.00", "7025-03-309184", "1.0000", "SET", "1792000000.0000", "1792000000.00", "AMITCM35.6250",
         "DRIVE, DISK, DELL, P/N ME5224"),
    item("6.00", "7030-03-288515", "72.00", "PCS", "4200000.0000", "302400000.00", "AMITCM35.6250",
         "SOFTWARE, VMWARE VSPHERE"),
    item("7.00", "7050-03-282054", "2.0000", "EACH", "31067000.0000", "62134000.00", "AMITCM16.6250",
         "HUB, NETWORK, FIBER MANAGED"),
    note("8.00", "PRF DRC KENDARI MTI"),
]

# Line Detail of 53851 seq 4 as (name, class, text) of label.card-field elements.
DETAIL_R670 = [
    ("x:1,y:18", "card-field pro-label label-normal align-right", "Item Desc:"),
    ("x:12,y:18", "card-field pro-label label-normal sunken", "COMPUTER, POWEREDGE R670,"),
    ("x:12,y:19", "card-field pro-label label-normal sunken", "ASPER670, 2.5IN CHASSIS C"),
    ("x:12,y:20", "card-field pro-label label-normal sunken", "/W UP TO 8 SAS4/SATA DRIV"),
    ("x:49,y:18", "card-field pro-label label-normal align-right", "Ordered:"),
    ("x:58,y:18", "card-field pro-label label-normal sunken align-right", "1.0000"),
    ("x:49,y:19", "card-field pro-label label-normal align-right", "Transit:"),
    ("x:58,y:19", "card-field pro-label label-normal sunken align-right", "0.0000"),
    ("x:90,y:19", "card-field pro-label label-normal align-right", "Unit:"),
    ("x:96,y:19", "card-field pro-label label-normal sunken", "EACH"),
    ("x:1,y:21", "card-field pro-label label-normal align-right", "On Hand:"),
    ("x:12,y:21", "card-field pro-label label-normal sunken align-right", "0.0000"),
    ("x:1,y:24", "card-field pro-label label-normal align-right", "Supp Code:"),
    ("x:12,y:24", "card-field pro-label label-normal sunken", "7021-03-330869"),
    ("x:47,y:24", "card-field pro-label label-normal align-right", "Req'n No:"),
    ("x:58,y:24", "card-field pro-label label-normal sunken align-right", "51727"),
    ("x:1,y:26", "card-field pro-label label-normal align-right", "GL Acct:"),
    ("x:12,y:26", "card-field pro-label label-normal sunken", "AMITCM35.6250"),
    ("x:47,y:25", "card-field pro-label label-normal align-right", "Req'n For:"),
    ("x:58,y:25", "card-field pro-label label-normal sunken no-text", ""),
]

APPROVAL_HEADERS = ["Approval User", "Date Time", "Status", "Comment"]
APPROVAL_53851 = [
    ["MTI IT", "10-SEP-2026 08:52:28", "New Order", ""],
    ["MTI IT", "10-SEP-2026 09:01:03", "Acknowledge", ""],
    ["Approver C", "29-SEP-2026 16:37:03", "Approve", ""],
    ["", "", "", ""],
]


def with_req(lines, req_by_seq):
    return [apply_line_detail(l, {"Req'n No": req_by_seq.get(l["seq"], "")}) if not l["is_note"] else l for l in lines]


class ParseTests(unittest.TestCase):
    def test_datetime(self):
        self.assertEqual(parse_pronto_datetime("10-SEP-2026 08:52:28"), "2026-09-10T08:52:28")
        self.assertEqual(parse_pronto_datetime("27-NOV-2026"), "2026-11-27T00:00:00")
        self.assertIsNone(parse_pronto_datetime("not a date"))

    def test_lines_skip_blank_rows_and_flag_notes(self):
        lines = parse_po_lines(LINE_HEADERS, ROWS_51727)
        self.assertEqual([l["seq"] for l in lines], [1.0, 2.0, 8.0, 9.0, 10.0])
        rack = lines[1]
        self.assertFalse(rack["is_note"])
        self.assertEqual(rack["item_code"], "7125-03-297513")
        self.assertEqual(rack["gl_account"], "AMITCM16.6250")
        self.assertEqual(rack["line_total"], 8400000.0)
        self.assertTrue(lines[0]["is_note"])
        self.assertEqual(lines[0]["item_code"], "")

    def test_card_fields_pair_same_row_and_multiline(self):
        detail = pair_card_fields(DETAIL_R670)
        self.assertEqual(detail["Req'n No"], "51727")
        self.assertEqual(detail["Supp Code"], "7021-03-330869")
        self.assertEqual(detail["GL Acct"], "AMITCM35.6250")
        self.assertEqual(detail["Unit"], "EACH")
        self.assertEqual(detail["Transit"], "0.0000")
        self.assertEqual(
            detail["Item Desc"],
            "COMPUTER, POWEREDGE R670, ASPER670, 2.5IN CHASSIS C /W UP TO 8 SAS4/SATA DRIV",
        )
        self.assertEqual(detail["Req'n For"], "")

    def test_split_po_items_are_all_found(self):
        lines_51727 = with_req(parse_po_lines(LINE_HEADERS, ROWS_51727), {2.0: "51727"})
        lines_53851 = with_req(
            parse_po_lines(LINE_HEADERS, ROWS_53851), {s: "51727" for s in (3.0, 4.0, 5.0, 6.0, 7.0)}
        )
        items = items_for_requisition(
            {"51727": {"found": True, "lines": lines_51727}, "53851": {"found": True, "lines": lines_53851}},
            "51727",
        )
        self.assertEqual(len(items), 6)
        self.assertEqual(items["7125-03-297513"]["split_po"], "")
        for code in ("5935-03-229059", "7021-03-330869", "7025-03-309184", "7030-03-288515", "7050-03-282054"):
            self.assertEqual(items[code]["original_po"], "51727")
            self.assertEqual(items[code]["split_po"], "53851")
        self.assertEqual(items["7030-03-288515"]["quantity"], 72)
        self.assertEqual(items["7025-03-309184"]["unit"], "SET")
        self.assertEqual(items["7021-03-330869"]["gl_account"], "AMITCM35.6250")
        total = sum(i["line_total"] for i in items.values())
        self.assertEqual(total, 8400000.0 + 3405276500.0)

    def test_lines_of_other_requisitions_are_ignored(self):
        lines = with_req(parse_po_lines(LINE_HEADERS, ROWS_53851), {4.0: "99999"})
        items = items_for_requisition({"53851": {"found": True, "lines": lines}}, "51727")
        self.assertNotIn("7021-03-330869", items)
        # Lines without a captured Req'n No are not trusted on a PO with another number.
        self.assertEqual(items, {})

    def test_po_not_found_is_skipped(self):
        lines = parse_po_lines(LINE_HEADERS, ROWS_51727)
        self.assertEqual(items_for_requisition({"51727": {"found": False, "lines": lines}}, "51727"), {})

    def test_approval_rows(self):
        entries = parse_approval_rows(APPROVAL_HEADERS, APPROVAL_53851)
        self.assertEqual(len(entries), 3)
        self.assertEqual(entries[0]["status"], "New Order")
        self.assertEqual(entries[2]["approval_user"], "Approver C")
        self.assertEqual(entries[2]["action_at"], "2026-09-29T16:37:03")
        self.assertEqual([e["line_no"] for e in entries], [1, 2, 3])


if __name__ == "__main__":
    unittest.main()
