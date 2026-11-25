"""Offline tests: the Pronto sync never applies an old batch, and a hung or failed step is reported."""

import asyncio
import os
import sys
import tempfile
import time
import unittest
from unittest import mock

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..")))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "..", "pronto-sync")))

import prf_pronto_sync  # noqa: E402
import pronto_sync_worker as worker  # noqa: E402


def gather(artifacts_dir):
    return prf_pronto_sync._gather_pronto_items_for_pos(
        pos=["50117"],
        artifacts_dir=artifacts_dir,
        headless=True,
        max_scrolls=1,
        capture_screenshots=False,
        write_per_po_json=False,
        storage_state_path="",
        profile_dir="",
    )


class GatherTest(unittest.TestCase):
    def test_failed_login_does_not_reuse_the_previous_batch(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = os.path.join(tmp, "prf_items_batch.json")
            with open(old, "w") as f:
                f.write('{"results": [{"po": "old"}]}')

            async def login_fails(**_kwargs):
                return None  # pronto_access returns without writing a batch when navigation fails

            with mock.patch.object(prf_pronto_sync.pronto_access, "main", login_fails):
                with self.assertRaisesRegex(RuntimeError, "wrote no batch"):
                    gather(tmp)
            self.assertFalse(os.path.exists(old), "the previous batch must be removed")

    def test_fresh_batch_is_used(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "prf_items_batch.json")

            async def writes_batch(**_kwargs):
                with open(path, "w") as f:
                    f.write('{"results": []}')

            with mock.patch.object(prf_pronto_sync.pronto_access, "main", writes_batch):
                self.assertEqual(gather(tmp), path)


def fake_scripts_dir(body):
    tmp = tempfile.mkdtemp()
    with open(os.path.join(tmp, "prf_pronto_sync.py"), "w") as f:
        f.write(body)
    return tmp


class RunStepTest(unittest.TestCase):
    def run_step(self, body, timeout_seconds=30):
        step = worker.Step(name="items", args=[], enabled=True)
        with mock.patch.object(worker, "_resolve_scripts_dir", return_value=fake_scripts_dir(body)):
            return worker._run_step(step, timeout_seconds=timeout_seconds, stop_flag=[False])

    def test_success(self):
        result = self.run_step("print('ok')\n")
        self.assertEqual((result.exit_code, result.error), (0, None))

    def test_failure_reports_the_error_line(self):
        result = self.run_step(
            "print('Login clicked')\n"
            "raise RuntimeError('Pronto navigation not ready (likely login did not complete)')\n"
        )
        self.assertEqual(result.exit_code, 1)
        self.assertIn("items: RuntimeError: Pronto navigation not ready", result.error)

    def test_hung_step_is_stopped(self):
        started = time.monotonic()
        result = self.run_step("import time\nprint('waiting', flush=True)\ntime.sleep(60)\n", timeout_seconds=2)
        self.assertLess(time.monotonic() - started, 30)
        self.assertEqual(result.exit_code, worker.STEP_TIMEOUT_EXIT_CODE)
        self.assertIn("was stopped", result.error)

    def test_child_processes_are_stopped_with_the_step(self):
        marker = os.path.join(tempfile.mkdtemp(), "child_alive")
        body = (
            "import subprocess, sys, time\n"
            f"subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(4); open({marker!r}, \"w\").close()'])\n"
            "time.sleep(60)\n"
        )
        self.run_step(body, timeout_seconds=1)
        time.sleep(5)
        self.assertFalse(os.path.exists(marker), "the browser started by a hung step must be stopped too")


if __name__ == "__main__":
    unittest.main()
