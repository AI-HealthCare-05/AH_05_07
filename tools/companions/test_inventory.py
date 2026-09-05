"""Synthetic packaging fixtures only; no Blender, real assets or private datasets."""

import copy
import hashlib
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from glb_audit import CLIPS, AuditError, write_report
from inventory import create_inventory, main


class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="sk7-graphics-inventory-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "assets"
        self.root.mkdir()
        self.candidate = self.root / "bear-v001"
        self.candidate.mkdir()
        for name in (
            "source.blend",
            "standard.blend",
            "light.blend",
            "standard.glb",
            "light.glb",
            "standard-front.png",
        ):
            (self.candidate / name).write_bytes(b"Synthetic graphics packaging fixture: " + name.encode("ascii"))
        (self.candidate / "generator.py").write_bytes(b"# synthetic; never execute\n")
        self.manifest = {
            "species": "bear",
            "basis_commit": "a" * 40,
            "generator_repository_commit": "b" * 40,
            "generator_source_matches_commit": True,
            "source_script_sha256": hashlib.sha256((self.candidate / "generator.py").read_bytes()).hexdigest(),
            "generator": "Synthetic Blender declaration; no execution",
            "clips": list(CLIPS),
            "clip_duration_seconds": 4,
            "quality_status": "visual review pending",
            "human_review": "pending",
            "variants": {
                variant: {
                    "file": f"{variant}.glb",
                    "triangles": 1,
                    "textures": 0,
                    "bytes": len((self.candidate / f"{variant}.glb").read_bytes()),
                    "sha256": hashlib.sha256((self.candidate / f"{variant}.glb").read_bytes()).hexdigest(),
                }
                for variant in ("standard", "light")
            },
        }
        self.catalog = {
            "schema_version": 1,
            "source_commit": "a" * 40,
            "animals": [
                {
                    "id": "bear",
                    "name": "Synthetic bear",
                    "status": "review_candidate",
                    "standard": "bear-v001/standard.glb",
                    "light": "bear-v001/light.glb",
                    "hero": "bear-v001/standard-front.png",
                },
                {
                    "id": "rabbit",
                    "name": "Synthetic rabbit",
                    "status": "pending",
                    "standard": None,
                    "light": None,
                    "hero": None,
                },
            ],
        }
        self.save_controls()

    def save_controls(self):
        (self.root / "catalog.json").write_text(json.dumps(self.catalog), encoding="utf-8")
        (self.candidate / "asset-manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def test_selected_files_are_counted_without_quality_or_pending_inflation(self):
        prior = self.root / "rabbit-v001"
        prior.mkdir()
        (prior / "standard.glb").write_bytes(b"Unselected must never be hashed")
        (self.candidate / "private-notes.txt").write_bytes(b"Unrecognized must never be read")
        (self.candidate / ".hidden.png").write_bytes(b"Hidden must never be read")
        original_open = Path.open

        def guarded(path, *args, **kwargs):
            self.assertFalse(path.is_relative_to(prior), "unselected contents were opened")
            self.assertNotIn(path.name, {"private-notes.txt", ".hidden.png"})
            return original_open(path, *args, **kwargs)

        with patch.object(Path, "open", guarded):
            report = create_inventory(self.root)
        self.assertEqual(report["summary"]["present_variant_files"], {"standard": 1, "light": 1})
        self.assertEqual(report["summary"]["manifest_declared_candidate_clip_count"], 7)
        self.assertEqual(report["summary"]["catalog_status_counts"], {"pending": 1, "review_candidate": 1})
        self.assertFalse(report["summary"]["quality_or_completion_count_inferred"])
        self.assertEqual(report["candidates"][1]["selection"], "not_selected")
        self.assertFalse(report["unselected_candidates_not_counted"][0]["counted"])
        self.assertFalse(report["unselected_candidates_not_counted"][0]["contents_read"])
        self.assertEqual(len(report["candidates"][0]["files"]), 8)

    def test_traversal_absolute_unc_drive_and_hidden_paths_are_rejected(self):
        for path in (
            "../standard.glb",
            "/bear-v001/standard.glb",
            "C:/bear-v001/standard.glb",
            "C:standard.glb",
            "\\\\server\\share\\standard.glb",
            "bear-v001/../standard.glb",
            "bear-v001//standard.glb",
            ".hidden/standard.glb",
            "bear-v001\\standard.glb",
        ):
            with self.subTest(path=path):
                self.catalog["animals"][0]["standard"] = path
                self.save_controls()
                with self.assertRaises(AuditError):
                    create_inventory(self.root)

    def test_rigged_checkpoint_is_optional_but_inventoried_when_present(self):
        before = create_inventory(self.root)
        self.assertEqual(before["candidates"][0]["missing_artifacts"], [])
        payload = b"Synthetic rest-rig checkpoint"
        (self.candidate / "rigged.blend").write_bytes(payload)
        report = create_inventory(self.root)
        checkpoint = next(file for file in report["candidates"][0]["files"] if file["path"].endswith("/rigged.blend"))
        self.assertEqual(checkpoint["format"], "blend")
        self.assertEqual(checkpoint["bytes"], len(payload))
        self.assertEqual(checkpoint["sha256"], hashlib.sha256(payload).hexdigest())
        self.assertEqual(report["summary"]["known_artifact_files"], before["summary"]["known_artifact_files"] + 1)

    def test_catalog_cannot_read_unknown_files_or_mix_candidates(self):
        for key, value in (
            ("hero", "bear-v001/notes.json"),
            ("standard", "bear-v001/generator.py"),
            ("light", "bear-v002/light.glb"),
        ):
            with self.subTest(value=value):
                original = copy.deepcopy(self.catalog)
                self.catalog["animals"][0][key] = value
                self.save_controls()
                with self.assertRaises(AuditError):
                    create_inventory(self.root)
                self.catalog = original

    def test_resolved_file_escape_is_rejected_before_open(self):
        target = self.candidate / "standard.glb"
        outside = self.base / "outside.glb"
        original_resolve = Path.resolve
        original_open = Path.open

        def resolved(path, *args, **kwargs):
            return outside if path == target else original_resolve(path, *args, **kwargs)

        def guarded(path, *args, **kwargs):
            self.assertNotEqual(path, target)
            self.assertNotEqual(path, outside)
            return original_open(path, *args, **kwargs)

        with (
            patch.object(Path, "resolve", resolved),
            patch.object(Path, "open", guarded),
            self.assertRaisesRegex(AuditError, "artifact_path_escape"),
        ):
            create_inventory(self.root)

    def test_real_symlink_directory_escape_is_rejected_when_supported(self):
        outside = self.base / "outside"
        outside.mkdir()
        link = self.root / "rabbit-v002"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except OSError as error:
            if os.name != "nt":
                self.skipTest(f"This host cannot create a directory symlink: {type(error).__name__}")
            # A local NTFS junction needs no administrator symlink privilege.
            # Both endpoints are fresh synthetic-fixture children of this test's temporary directory.
            result = subprocess.run(
                ["cmd", "/d", "/c", "mklink", "/J", str(link), str(outside)],
                capture_output=True,
                check=False,
                timeout=30,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            if result.returncode != 0:
                self.skipTest("This filesystem cannot create a directory symlink or junction")
        self.catalog["animals"][1]["standard"] = "rabbit-v002/standard.glb"
        self.save_controls()
        with self.assertRaisesRegex(AuditError, "artifact_path_escape"):
            create_inventory(self.root)

    def test_tampered_same_size_glb_and_generator_are_rejected(self):
        for filename, code in (
            ("standard.glb", "generated_asset_digest_mismatch"),
            ("generator.py", "generator_digest_mismatch"),
        ):
            with self.subTest(filename=filename):
                path = self.candidate / filename
                original = path.read_bytes()
                path.write_bytes(b"X" + original[1:])
                with self.assertRaisesRegex(AuditError, code):
                    create_inventory(self.root)
                path.write_bytes(original)

    def test_missing_candidate_or_required_files_are_explicit_not_passed(self):
        (self.candidate / "light.glb").unlink()
        report = create_inventory(self.root)
        self.assertEqual(report["candidates"][0]["packaging_status"], "missing_artifacts")
        self.assertIn("bear-v001/light.glb", report["candidates"][0]["missing_artifacts"])
        self.assertEqual(report["summary"]["present_variant_files"]["light"], 0)
        self.catalog["animals"][1]["standard"] = "rabbit-v002/standard.glb"
        self.save_controls()
        report = create_inventory(self.root)
        self.assertEqual(report["summary"]["candidates_with_missing_artifacts"], 2)
        self.assertIsNone(report["candidates"][1]["generated_manifest"])

    def test_manifest_identity_clip_contract_and_counts_cannot_be_fabricated(self):
        for change in (
            {"species": "rabbit"},
            {"clips": ["idle"]},
            {"generator_source_matches_commit": False},
            {"basis_commit": "wrong"},
        ):
            with self.subTest(change=change):
                original = copy.deepcopy(self.manifest)
                self.manifest.update(change)
                self.save_controls()
                with self.assertRaises(AuditError):
                    create_inventory(self.root)
                self.manifest = original
        self.manifest["variants"]["standard"]["triangles"] = float("nan")
        self.save_controls()
        with self.assertRaises(AuditError):
            create_inventory(self.root)

    def test_control_change_during_inventory_is_rejected(self):
        original = Path.read_bytes
        count = 0

        def changed(path):
            nonlocal count
            data = original(path)
            if path.name == "catalog.json":
                count += 1
                if count == 2:
                    return data + b" "
            return data

        with (
            patch.object(Path, "read_bytes", changed),
            self.assertRaisesRegex(AuditError, "catalog_or_manifest_changed_during_inventory"),
        ):
            create_inventory(self.root)

    def test_duplicate_catalog_identity_rejected(self):
        self.catalog["animals"].append(copy.deepcopy(self.catalog["animals"][0]))
        self.save_controls()
        with self.assertRaisesRegex(AuditError, "catalog_unique_ids"):
            create_inventory(self.root)

    def test_manifest_change_between_hash_and_parse_is_rejected(self):
        original = Path.read_bytes

        def changed(path):
            data = original(path)
            return (
                data.replace(b"visual review pending", b"visual review changed")
                if path.name == "asset-manifest.json"
                else data
            )

        with (
            patch.object(Path, "read_bytes", changed),
            self.assertRaisesRegex(AuditError, "manifest_changed_between_hash_and_parse"),
        ):
            create_inventory(self.root)

    def test_noncontrol_file_mutation_after_hash_is_rejected(self):
        original = Path.read_bytes
        target = self.candidate / "source.blend"

        def changed(path):
            data = original(path)
            if path.name == "asset-manifest.json":
                target.write_bytes(b"changed after file hashing")
            return data

        with (
            patch.object(Path, "read_bytes", changed),
            self.assertRaisesRegex(AuditError, "artifact_stat_changed_during_inventory"),
        ):
            create_inventory(self.root)

    def test_exclusive_output_preserves_previous_report_and_skips_input_hashing(self):
        output = self.base / "inventory.json"
        write_report(create_inventory(self.root), output)
        original = output.read_bytes()
        with (
            patch("sys.argv", ["inventory.py", "--assets", str(self.root), "--output", str(output)]),
            patch("inventory.create_inventory", side_effect=AssertionError("Must reject output first")),
        ):
            self.assertEqual(main(), 1)
        self.assertEqual(output.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
