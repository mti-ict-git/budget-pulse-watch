"""Offline test: item code map merges PO E001 Lines into the INV E071 result (case 51727/53851)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.dirname(__file__))

from prf_pronto_sync import _approval_payload, _build_pronto_item_code_map  # noqa: E402
from pronto_po_parse import parse_approval_rows, parse_po_lines  # noqa: E402
from test_pronto_po_parse import (  # noqa: E402
    APPROVAL_53851,
    APPROVAL_HEADERS,
    LINE_HEADERS,
    ROWS_51727,
    ROWS_53851,
    with_req,
)


def e071(code, order_no, desc, qty):
    """One INV E071 row plus its Detail dialog, as captured by pronto_access."""
    row = {"Requisition No.": "51727", "Order Number": order_no, "Description": desc, "Quantity": qty}
    detail = {
        "requisition_no": "51727",
        "description": desc,
        "dialog": {"Item code": code, "Qty required": qty, "Purchase Order No.": order_no},
    }
    return row, detail


E071 = [
    e071("7125-03-297513", "51727", "RACK, IR9042G-42U, INDORACK.", "1.0000"),
    e071("5935-03-229059", "53851", "SOCKET, ELEC, RPDU, 24 PORT, G", "2.0000"),
    e071("7030-03-288515", "53851", "VMware vSphere Foundation 1-Ye", "72.0000"),
    e071("7050-03-282054", "53851", "HUB, NETWORK, FIBER MANAGED", "2.0000"),
]


def pronto_result(with_po_details=True):
    result = {"po": "51727", "rows": [r for r, _ in E071], "details": [d for _, d in E071]}
    if with_po_details:
        result["po_details"] = {
            "51727": {
                "found": True,
                "lines": with_req(parse_po_lines(LINE_HEADERS, ROWS_51727), {2.0: "51727"}),
                "approvals": [],
            },
            "53851": {
                "found": True,
                "lines": with_req(
                    parse_po_lines(LINE_HEADERS, ROWS_53851), {s: "51727" for s in (3.0, 4.0, 5.0, 6.0, 7.0)}
                ),
                "approvals": parse_approval_rows(APPROVAL_HEADERS, APPROVAL_53851),
            },
        }
    return result


class MergeTests(unittest.TestCase):
    def test_without_po_details_the_dell_items_are_missing(self):
        code_map, _ = _build_pronto_item_code_map(pronto_result(with_po_details=False))
        self.assertEqual(len(code_map), 4)
        self.assertNotIn("7021-03-330869", code_map)
        self.assertNotIn("7025-03-309184", code_map)

    def test_po_lines_add_the_missing_split_items(self):
        code_map, issues = _build_pronto_item_code_map(pronto_result())
        self.assertEqual(len(code_map), 6)
        for code in ("7021-03-330869", "7025-03-309184"):
            self.assertEqual(code_map[code]["original_po"], "51727")
            self.assertEqual(code_map[code]["split_po"], "53851")
            self.assertEqual(code_map[code]["source"], "po_lines")
            self.assertEqual(code_map[code]["quantity"], 1)
        self.assertEqual(code_map["7021-03-330869"]["unit_price"], 1246250000.0)
        added = sorted(i["item_code"] for i in issues if i["type"] == "item_from_po_lines")
        self.assertEqual(added, ["7021-03-330869", "7025-03-309184"])

    def test_existing_e071_items_keep_their_values_and_gain_gl(self):
        code_map, _ = _build_pronto_item_code_map(pronto_result())
        vmware = code_map["7030-03-288515"]
        self.assertEqual(vmware["split_po"], "53851")
        self.assertEqual(vmware["quantity"], 72)
        self.assertEqual(vmware["description"], "VMware vSphere Foundation 1-Ye")  # E071 value kept
        self.assertEqual(vmware["gl_account"], "AMITCM35.6250")
        self.assertEqual(vmware["unit_price"], 4200000.0)  # filled from Lines
        self.assertEqual(code_map["7125-03-297513"]["split_po"], "")

    def test_po_not_found_is_reported(self):
        result = pronto_result()
        result["po_details"]["53851"] = {"found": False, "lines": [], "approvals": [], "errors": ["x"]}
        code_map, issues = _build_pronto_item_code_map(result)
        self.assertEqual(len(code_map), 4)
        self.assertIn("po_not_found_in_po_enquiry", [i["type"] for i in issues])

    def test_approval_payload(self):
        entries = pronto_result()["po_details"]["53851"]["approvals"]
        payload = _approval_payload("53851", entries)
        self.assertEqual(payload["poNumber"], "53851")
        self.assertEqual(len(payload["entries"]), 3)
        self.assertEqual(
            payload["entries"][2],
            {
                "lineNo": 3,
                "approvalUser": "Approver C",
                "actionAt": "2026-09-29T16:37:03",
                "actionAtRaw": "29-SEP-2026 16:37:03",
                "status": "Approve",
                "comment": "",
            },
        )


if __name__ == "__main__":
    unittest.main()
