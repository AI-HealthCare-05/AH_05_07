import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from verify_visual_review_decision import verify


class VisualDecisionTests(unittest.TestCase):
    def fixture(self, root: Path):
        candidates = []

        for species in ("koala", "mouse", "owl", "pig"):
            for variant in ("lite", "standard"):
                candidates.append(
                    {
                        "speciesKey": species,
                        "variantKey": variant,
                        "candidateId": f"CAND-{species}-{variant}",
                        "sha256": (f"{species}-{variant}".encode().hex() + "0" * 64)[:64],
                    }
                )

        manifest = root / "review-manifest.json"
        manifest.write_text(
            json.dumps(
                {
                    "documentType": "COMPANION_WORLD_V2_VISUAL_REVIEW_PACKAGE",
                    "candidates": candidates,
                }
            ),
            encoding="utf-8",
        )

        manifest_sha = hashlib.sha256(manifest.read_bytes()).hexdigest()

        entries = []

        for species in ("koala", "mouse", "owl", "pig"):
            lite = next(item for item in candidates if item["speciesKey"] == species and item["variantKey"] == "lite")
            standard = next(
                item for item in candidates if item["speciesKey"] == species and item["variantKey"] == "standard"
            )

            entries.append(
                {
                    "speciesKey": species,
                    "liteCandidateId": lite["candidateId"],
                    "liteSha256": lite["sha256"],
                    "standardCandidateId": standard["candidateId"],
                    "standardSha256": standard["sha256"],
                    "decision": "pending",
                    "silhouette": "pending",
                    "motion": "pending",
                    "screenFit": {
                        "S01": "pending",
                        "S02": "pending",
                        "S10": "pending",
                    },
                    "notes": "",
                }
            )

        decision = root / "decision.json"
        decision.write_text(
            json.dumps(
                {
                    "documentType": "COMPANION_WORLD_V2_VISUAL_REVIEW_DECISION",
                    "status": "pending-human-review",
                    "reviewPackageManifestSha256": manifest_sha,
                    "species": entries,
                    "overallDecision": "pending",
                    "reviewer": "",
                    "reviewedAt": "",
                    "productionActivationApproved": False,
                }
            ),
            encoding="utf-8",
        )

        return manifest, decision

    def test_pending_template_is_structurally_valid(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, decision = self.fixture(root)

            result = verify(decision, manifest, allow_pending=True)

            self.assertEqual(result["status"], "valid-pending")
            self.assertFalse(result["productionActivationApproved"])

    def test_pending_template_is_not_completed_review(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, decision = self.fixture(root)

            with self.assertRaisesRegex(ValueError, "still pending"):
                verify(decision, manifest)

    def test_visual_review_cannot_activate_production(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, decision = self.fixture(root)

            data = json.loads(decision.read_text(encoding="utf-8"))
            data["productionActivationApproved"] = True
            decision.write_text(json.dumps(data), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "cannot approve production"):
                verify(decision, manifest, allow_pending=True)


if __name__ == "__main__":
    unittest.main()
