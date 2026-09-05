"""Dependency-free safety and arithmetic controls; not performance or PostgreSQL evidence."""

import argparse
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from metrics import NoRedirect, percentile, request, summarize  # noqa: E402

spec = importlib.util.spec_from_file_location("local_runner", Path(__file__).with_name("run.py"))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class Controls(unittest.TestCase):
    def test_known_quantile(self):
        self.assertAlmostEqual(percentile([0, 10, 20, 30], 0.95), 28.5)
        self.assertEqual(percentile([7], 0.95), 7)
        self.assertIsNone(percentile([], 0.95))
        for bad in ([float("nan")], [float("inf")], [-1]):
            with self.assertRaises(ValueError):
                percentile(bad, 0.95)

    def test_expected_error_is_not_unexpected_failure(self):
        result = summarize([(503, {"sensitive": "discard"}, 10), (0, None, 20)], 503, "fault", 1, "a", "b")
        self.assertEqual(result["unexpected_rate"], 0.5)
        self.assertEqual(result["transport_error_count"], 1)
        self.assertNotIn("sensitive", str(result))
        with self.assertRaises(ValueError):
            summarize([], 200, "empty", 1, "a", "b")

    def test_only_loopback_no_redirect(self):
        for base in (
            "https://production.example",
            "http://localhost:12",
            "http://127.0.0.1:12@external.example",
            "http://127.0.0.1:12/path",
        ):
            with self.assertRaises(ValueError):
                request(base, "/live")
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, None, None, "https://external.example"))

    def test_no_inherited_production_configuration(self):
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://production.example",
                "DB_PASSWORD": "sensitive",
                "HTTP_PROXY": "http://external.example",
                "VITE_SUPABASE_URL": "https://production.example",
            },
        ):
            clean = runner.Run.clean_environment()
        for key in ("SUPABASE_URL", "DB_PASSWORD", "HTTP_PROXY", "VITE_SUPABASE_URL"):
            self.assertNotIn(key, clean)

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            sentinel = output / "verified.txt"
            sentinel.write_text("keep")
            with self.assertRaises(runner.StageError):
                runner.Run(argparse.Namespace(output=output))
            self.assertEqual(sentinel.read_text(), "keep")

    def test_remote_docker_is_rejected(self):
        for endpoint in ("ssh://production.example", "tcp://example.invalid:2376"):
            with self.assertRaises(runner.StageError):
                runner.require_local_docker(endpoint)
        runner.require_local_docker("npipe:////./pipe/dockerDesktopLinuxEngine")
        runner.require_local_docker("unix:///var/run/docker.sock")


if __name__ == "__main__":
    unittest.main()
