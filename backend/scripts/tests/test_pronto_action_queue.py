"""Offline tests for the Immediate Action queue (PO M094) parsers and its worker schedule."""

import os
import sys
import unittest

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..")))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "..", "pronto-sync")))

from pronto_queue_parse import card_value, label_value, parse_next_action_rows, parse_queue_rows  # noqa: E402
import pronto_sync_worker as worker  # noqa: E402

# Headers and rows as read from PO M094 on 2026-11-26 (account itmt).
QUEUE_HEADERS = [
    "Order No", "Backorder flag", "Supplier", "Whse", "Due", "Contract No.", "User", "Cost Category",
    "Req Total", "Currency", "Local Value", "Auth", "Group", "Type", "Document", "Action", "Buyer",
    "BI Approval", "Stock Group", "Coupa Id", "Coupa Supplier", "Chief CC Approval", "Priority",
    "Ordering Type", "Buyer allocation",
]
QUEUE_ROWS = [
    ["42300", "", "FAD100IDR", "WSPC", "20-MAR-2026", "", "itmt", "AMITCM18.6250", "28,165,000.00", "IDR",
     "1,676.49", "X", "MAMCHRCCIT", "P", "", "MAMCHRCCIT", "asadul.murtadlo", "", "Information Technology Supplie",
     "30900", "FAD100IDR", "", "", "", ""],
    ["53956", "", "REL100IDR", "SERV", "31-DEC-2027", "", "itmt", "MTIRMRMT266137", "740,000,000.00", "IDR",
     "40,760.12", "Y", "MAMCHRCCIT", "P", "", "MAMCHRCCIT", "ryanda.away", "Y", "Information Technology Softwar",
     "78409", "REL100IDR", "Y", "P3", "", "dittag"],
    [""] * 25,
]


class QueueParseTests(unittest.TestCase):
    def test_list_rows(self):
        rows = parse_queue_rows(QUEUE_HEADERS, QUEUE_ROWS)
        self.assertEqual([r["orderNo"] for r in rows], ["42300", "53956"])
        first = rows[0]
        self.assertEqual(first["supplier"], "FAD100IDR")
        self.assertEqual(first["reqTotal"], 28165000.0)
        self.assertEqual(first["currency"], "IDR")
        self.assertEqual(first["localValue"], 1676.49)
        self.assertEqual(first["dueDate"], "2026-03-20")
        self.assertEqual(first["auth"], "X")
        self.assertEqual(first["group"], "MAMCHRCCIT")
        self.assertEqual(first["buyer"], "asadul.murtadlo")
        self.assertEqual(rows[1]["priority"], "P3")

    def test_shortened_headers(self):
        headers = ["Order ...", "B...", "Supplier", "Whse", "Due", "Cost Category", "Req Total", "C...", "Au..."]
        rows = parse_queue_rows(headers, [["42300", "", "FAD100IDR", "WSPC", "20-MAR-2026", "AMIT", "1.00", "IDR", "X"]])
        self.assertEqual(rows[0]["orderNo"], "42300")
        self.assertEqual(rows[0]["costCategory"], "AMIT")
        self.assertEqual(rows[0]["currency"], "IDR")
        self.assertEqual(rows[0]["auth"], "X")

    def test_next_action_rows(self):
        entries = parse_next_action_rows(
            ["Name", "User", "Hierarchy"],
            [["Arthur Saul", "arthurs", ""], ["MTI IT", "itmt", "MAMCHRCCIT"], ["", "", ""], ["MTI IT", "itmt", "MAMCHRCCIT"]],
        )
        self.assertEqual(
            entries,
            [
                {"name": "Arthur Saul", "user": "arthurs", "hierarchy": ""},
                {"name": "MTI IT", "user": "itmt", "hierarchy": "MAMCHRCCIT"},
            ],
        )

    def test_card_value(self):
        self.assertEqual(card_value({"Requisition": " 42300 "}, "Requisition:"), "42300")
        self.assertEqual(card_value({"User": "itmt"}, "user"), "itmt")
        self.assertEqual(card_value({}, "User"), "")


class LabelValueTests(unittest.TestCase):
    # PRAS User Information on PO M094, as read on 2026-11-26.
    FIELDS = [
        ("x:5,y:19", "card-field pro-label label-normal bold align-right", "User:"),
        ("x:11,y:19", "card-field pro-label label-normal", "itmt"),
        ("x:30,y:19", "card-field pro-label label-normal bold align-right", "Group:"),
        ("x:37,y:19", "card-field pro-label label-normal", "MAMCHRCCIT"),
        ("x:59,y:19", "card-field pro-label label-normal bold align-right", "Req. Limit:"),
        ("x:71,y:19", "card-field pro-label label-normal", "1"),
    ]

    def test_pras_user(self):
        self.assertEqual(label_value(self.FIELDS, "User"), "itmt")
        self.assertEqual(label_value(self.FIELDS, "Group:"), "MAMCHRCCIT")
        self.assertEqual(label_value(self.FIELDS, "Missing"), "")


class QueueScheduleTests(unittest.TestCase):
    def test_queue_due(self):
        self.assertTrue(worker._queue_due(None, 3600, 10.0))
        self.assertFalse(worker._queue_due(100.0, 3600, 3000.0))
        self.assertTrue(worker._queue_due(100.0, 3600, 3700.0))

    def test_queue_step_runs_the_queue_script(self):
        step = worker._queue_step(worker._default_config_from_env())
        self.assertEqual(step.script, "pronto_action_queue.py")
        self.assertEqual(step.name, "queue")

    def test_sync_steps_keep_the_sync_script(self):
        steps = worker._build_steps(worker._default_config_from_env(), run_now_prf_no=None)
        self.assertTrue(all(s.script == "prf_pronto_sync.py" for s in steps))


if __name__ == "__main__":
    unittest.main()
