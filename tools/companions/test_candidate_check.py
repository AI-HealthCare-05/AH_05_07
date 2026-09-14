"""Synthetic tests for the pre-publish companion candidate wrapper."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from candidate_check import VARIANTS, run_candidate_check
from glb_audit import AuditError, CLIPS


class CandidateCheckTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="sk7-companion-candidate-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.repository = self.base / "repo"
        self.repository.mkdir()
        self.asset = self.base / "assets" / "bear-v999"
        self.asset.mkdir(parents=True)
        self.output = self.base / "reports" / "bear-v999-check"
        self.output.parent.mkdir()
        (self.asset / "standard.glb").write_bytes(b"synthetic-standard")
        (self.asset / "light.glb").write_bytes(b"synthetic-light")
        (self.asset / "generator.py").write_text("# synthetic; never execute\n", encoding="utf-8")
        self.manifest = {
            "species": "bear",
            "basis_commit": "a" * 40,
            "generator_repository_commit": "b" * 40,
            "generator_source_matches_commit": True,
            "source_script_sha256": hashlib.sha256((self.asset / "generator.py").read_bytes()).hexdigest(),
            "clips": list(CLIPS),
            "clip_duration_seconds": 4,
            "quality_status": "visual review pending",
            "human_review": "pending",
        }
        (self.asset / "asset-manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def fake_audit(self, asset_dir, variant, repository=None):
        payload = (Path(asset_dir) / f"{variant}.glb").read_bytes()
        triangles = 32000 if variant == "standard" else 13500
        return {
            "schema_version": 1,
            "status": "binary_contract_pass_visual_quality_not_certified",
            "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
            "skin_joints": 20,
            "geometry": {"triangles": triangles, "rendered_triangles": triangles, "materials": 3},
            "materials": {"textures": 0},
            "clips": {name: {"duration_seconds": 4} for name in CLIPS},
        }

    def test_both_variants_publish_one_bounded_summary(self):
        summary = run_candidate_check(self.asset, self.output, self.repository, self.fake_audit)
        self.assertEqual(summary["status"], "candidate_binary_pass_visual_review_required")
        self.assertEqual(summary["species"], "bear")
        self.assertEqual(set(summary["variants"]), set(VARIANTS))
        self.assertEqual(summary["variants"]["standard"]["triangles"], 32000)
        self.assertEqual(summary["variants"]["light"]["triangles"], 13500)
        self.assertEqual(set(summary["variants"]["standard"]["clip_durations_seconds"]), set(CLIPS))
        self.assertTrue((self.output / "standard-binary-audit.json").is_file())
        self.assertTrue((self.output / "light-binary-audit.json").is_file())
        self.assertTrue((self.output / "candidate-check.json").is_file())
        text = (self.output / "candidate-check.json").read_text(encoding="utf-8")
        self.assertNotIn(str(self.asset.resolve()), text)
        self.assertNotIn(str(self.repository.resolve()), text)

    def test_existing_output_is_preserved(self):
        self.output.mkdir()
        sentinel = self.output / "keep.txt"
        sentinel.write_text("keep", encoding="utf-8")
        with self.assertRaisesRegex(AuditError, "new_candidate_output_directory_required"):
            run_candidate_check(self.asset, self.output, self.repository, self.fake_audit)
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep")

    def test_audit_failure_publishes_no_result_directory(self):
        def failing_audit(asset_dir, variant, repository=None):
            if variant == "light":
                raise AuditError("synthetic_light_failure")
            return self.fake_audit(asset_dir, variant, repository)

        with self.assertRaisesRegex(AuditError, "synthetic_light_failure"):
            run_candidate_check(self.asset, self.output, self.repository, failing_audit)
        self.assertFalse(self.output.exists())

    def test_input_mutation_across_variant_audits_fails_closed(self):
        def mutating_audit(asset_dir, variant, repository=None):
            result = self.fake_audit(asset_dir, variant, repository)
            if variant == "standard":
                (Path(asset_dir) / "light.glb").write_bytes(b"changed-between-audits")
            return result

        with self.assertRaisesRegex(AuditError, "candidate_inputs_changed_during_check"):
            run_candidate_check(self.asset, self.output, self.repository, mutating_audit)
        self.assertFalse(self.output.exists())

    def test_mismatched_runtime_clip_contract_is_rejected(self):
        def mismatched_audit(asset_dir, variant, repository=None):
            result = self.fake_audit(asset_dir, variant, repository)
            if variant == "light":
                result["clips"].pop("special")
            return result

        with self.assertRaisesRegex(AuditError, "candidate_runtime_clip_contract"):
            run_candidate_check(self.asset, self.output, self.repository, mismatched_audit)
        self.assertFalse(self.output.exists())

    def test_empty_asset_dir_is_rejected_before_cwd_fallback(self):
        with self.assertRaisesRegex(AuditError, "candidate_asset_directory_required"):
            run_candidate_check("", self.output, self.repository, self.fake_audit)
        self.assertFalse(self.output.exists())

    def test_output_must_stay_outside_repository_and_inputs(self):
        inside_repo = self.repository / "candidate-check"
        with self.assertRaisesRegex(AuditError, "candidate_output_outside_repository"):
            run_candidate_check(self.asset, inside_repo, self.repository, self.fake_audit)

        inside_asset = self.asset / "candidate-check"
        with self.assertRaisesRegex(AuditError, "candidate_output_must_not_overlap_inputs"):
            run_candidate_check(self.asset, inside_asset, self.repository, self.fake_audit)


if __name__ == "__main__":
    unittest.main()
