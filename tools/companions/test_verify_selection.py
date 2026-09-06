"""Synthetic tests for the read-only selected companion inventory verifier."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from glb_audit import CLIPS, AuditError
from inventory import create_inventory
from verify_selection import verify


class VerifySelectionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="sk7-selected-inventory-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "assets"
        self.root.mkdir()
        self.identifiers = (
            "bear",
            "rabbit",
            "cat",
            "dog",
            "red_panda",
            "otter",
            "capybara",
            "hedgehog",
            "penguin",
            "fox",
            "squirrel",
        )
        animals = []
        for identifier in self.identifiers:
            candidate = self.root / f"{identifier}-v001"
            candidate.mkdir()
            generator = f"# shared synthetic generator for {identifier}\n".encode()
            (candidate / "generator.py").write_bytes(generator)
            for filename in (
                "source.blend",
                "rigged.blend",
                "standard.blend",
                "light.blend",
                "standard.glb",
                "light.glb",
                "standard-front.png",
            ):
                (candidate / filename).write_bytes(f"synthetic {identifier} {filename}".encode())
            manifest = {
                "species": identifier,
                "basis_commit": "a" * 40,
                "generator_repository_commit": "b" * 40,
                "generator_source_matches_commit": True,
                "source_script_sha256": hashlib.sha256(generator).hexdigest(),
                "generator": "Synthetic declaration only",
                "clips": list(CLIPS),
                "clip_duration_seconds": 4,
                "variants": {
                    variant: {
                        "file": f"{variant}.glb",
                        "triangles": 1,
                        "textures": 0,
                        "bytes": (candidate / f"{variant}.glb").stat().st_size,
                        "sha256": hashlib.sha256((candidate / f"{variant}.glb").read_bytes()).hexdigest(),
                    }
                    for variant in ("standard", "light")
                },
            }
            (candidate / "asset-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            animals.append(
                {
                    "id": identifier,
                    "status": "passed",
                    "standard": f"{identifier}-v001/standard.glb",
                    "light": f"{identifier}-v001/light.glb",
                    "hero": f"{identifier}-v001/standard-front.png",
                }
            )
        # The production inventory records the existing failed candidate as an
        # unselected directory without opening its contents.
        (self.root / "seal-v001").mkdir()
        animals.append({"id": "seal", "status": "needs_revision", "standard": None, "light": None, "hero": None})
        (self.root / "catalog.json").write_text(
            json.dumps({"schema_version": 1, "source_commit": "a" * 40, "animals": animals}), encoding="utf-8"
        )
        self.inventory = Path(temporary.name) / "selected-inventory.json"
        self.inventory.write_text(json.dumps(create_inventory(self.root)), encoding="utf-8")
        self.checkpoint = Path(temporary.name) / "checkpoint.json"
        self.checkpoint.write_text(
            json.dumps(
                {
                    "asset_inventory": {
                        "path": self.inventory.name,
                        "bytes": self.inventory.stat().st_size,
                        "sha256": hashlib.sha256(self.inventory.read_bytes()).hexdigest(),
                    }
                }
            ),
            encoding="utf-8",
        )

    def test_accepts_matching_selected_inventory(self):
        result = verify(self.inventory, self.root, self.checkpoint)
        self.assertEqual(result["selected_candidate_count"], 11)
        self.assertEqual(result["unique_logical_clip_count"], 77)
        self.assertEqual(result["seal"], "needs_revision_not_selected")

    def test_rejects_missing_selected_file(self):
        (self.root / "bear-v001" / "light.glb").unlink()
        with self.assertRaisesRegex(AuditError, "candidate_packaging_status_mismatch"):
            verify(self.inventory, self.root, self.checkpoint)

    def test_rejects_extra_known_selected_file(self):
        (self.root / "bear-v001" / "motion-preview.webm").write_bytes(b"unexpected synthetic file")
        with self.assertRaisesRegex(AuditError, "inventory_file_manifest_mismatch"):
            verify(self.inventory, self.root, self.checkpoint)

    def test_rejects_seal_selection_in_inventory(self):
        payload = json.loads(self.inventory.read_text(encoding="utf-8"))
        seal = next(row for row in payload["candidates"] if row["id"] == "seal")
        seal["selection"] = "seal-v001"
        self.inventory.write_text(json.dumps(payload), encoding="utf-8")
        with self.assertRaisesRegex(AuditError, "checkpoint_inventory_(size|digest)_mismatch"):
            verify(self.inventory, self.root, self.checkpoint)


if __name__ == "__main__":
    unittest.main()
