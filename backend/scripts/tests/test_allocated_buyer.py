"""Offline test: PRF.AllocatedBuyer comes from "Buyer allocation", else "Officer" (decided 2026-11-16)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from prf_pronto_sync import SyncOptions, _allocated_buyer, _desired_update_from_pronto_row, _evaluate_fields  # noqa: E402


def options(buyer=True):
    return SyncOptions(
        sync_status=False,
        sync_requested_date=False,
        sync_required_date=False,
        sync_approval_date=False,
        sync_completion_date=False,
        sync_approved_by=False,
        sync_allocated_buyer=buyer,
        sync_vendor=False,
        sync_currency=False,
        sync_amounts=False,
        amount_source="order",
    )


class AllocatedBuyerTests(unittest.TestCase):
    def test_buyer_allocation_wins(self):
        self.assertEqual(_allocated_buyer({"Buyer allocation": " Buyer A ", "Officer": "Officer B"}), "Buyer A")

    def test_officer_is_the_fallback(self):
        self.assertEqual(_allocated_buyer({"Buyer allocation": "  ", "Officer": "Officer B"}), "Officer B")

    def test_none_when_both_empty(self):
        self.assertIsNone(_allocated_buyer({"Buyer allocation": "", "Officer": ""}))
        self.assertIsNone(_allocated_buyer({}))

    def test_desired_update_and_check(self):
        row = {"Buyer allocation": "", "Officer": "Officer B"}
        self.assertEqual(_desired_update_from_pronto_row(row, options()), {"AllocatedBuyer": "Officer B"})
        self.assertEqual(_desired_update_from_pronto_row(row, options(buyer=False)), {})
        _, checks = _evaluate_fields(row, {"AllocatedBuyer": None}, options())
        self.assertTrue(checks["AllocatedBuyer"]["changed"])
        self.assertEqual(checks["AllocatedBuyer"]["desired"], "Officer B")
        _, checks = _evaluate_fields(row, {"AllocatedBuyer": "Officer B"}, options())
        self.assertFalse(checks["AllocatedBuyer"]["changed"])


if __name__ == "__main__":
    unittest.main()
