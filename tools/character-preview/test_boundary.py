"""Reject network/drive/traversal names before touching the filesystem."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from serve import contained


class PathBoundaryTests(unittest.TestCase):
    def test_unsafe_names_never_reach_filesystem(self):
        root = Path("local-assets")
        names = [
            "//host/share/file.png",
            r"\\host\share\file.png",
            "C:/file.png",
            "C:file.png",
            "bear/file.png:stream",
            "/file.png",
            "../file.png",
            "bear/../file.png",
            r"bear\file.png",
            "bear//file.png",
            "./file.png",
            "file\x00.png",
            "",
            None,
        ]
        with (
            patch.object(Path, "resolve", side_effect=AssertionError("resolve called")),
            patch.object(Path, "is_file", side_effect=AssertionError("is_file called")),
        ):
            for name in names:
                with self.subTest(name=name), self.assertRaises(ValueError):
                    contained(root, name)

    def test_valid_nested_file_and_missing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / "bear").mkdir()
            target = root / "bear" / "hero.png"
            target.write_bytes(b"synthetic path fixture")
            self.assertEqual(contained(root, "bear/hero.png"), target)
            with self.assertRaises(ValueError):
                contained(root, "bear/missing.png")


if __name__ == "__main__":
    unittest.main()
