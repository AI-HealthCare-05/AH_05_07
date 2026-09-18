import base64
import json
import tempfile
import unittest
from pathlib import Path

from build_visual_review_package import (
    CLIPS,
    SCREENS,
    SPECIES,
    VIEWER_VARIANTS,
    VIEWPORTS,
    build_package,
)

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


class VisualReviewPackageTests(unittest.TestCase):
    def fixture(self, root: Path):
        candidate_root = root / "candidate"
        prequal_root = root / "prequal"
        screen_root = root / "screen"

        candidate_root.mkdir()
        prequal_root.mkdir()
        (screen_root / "playwright").mkdir(parents=True)

        candidates = []
        asset_manifest = []

        for species in SPECIES:
            for viewer_variant in VIEWER_VARIANTS:
                canonical_variant = "lite" if viewer_variant == "light" else "standard"
                marker = f"{species}-{canonical_variant}"
                digest = (marker.encode().hex() + "0" * 64)[:64]

                candidates.append(
                    {
                        "candidateId": f"CAND-{species}-{canonical_variant}",
                        "speciesKey": species,
                        "candidateVersion": "v002",
                        "candidateVariantKey": canonical_variant,
                        "viewerVariant": viewer_variant,
                        "sourceRevision": "world-v2-001",
                        "sha256": digest,
                        "bytes": 123,
                        "reviewFile": f"{species}/{viewer_variant}.glb",
                    }
                )

                asset_manifest.append(
                    {
                        "animal": species,
                        "variant": viewer_variant,
                        "file": f"{species}/{viewer_variant}.glb",
                        "sha256": digest,
                    }
                )

                for clip in CLIPS:
                    (prequal_root / f"{species}-{viewer_variant}-{clip}.png").write_bytes(PNG)

        (candidate_root / "candidate-review-input.json").write_text(
            json.dumps(
                {
                    "documentType": "COMPANION_CANDIDATE_BROWSER_REVIEW_INPUT",
                    "status": "prepared-not-qualified",
                    "family": "world-v2",
                    "speciesCount": 4,
                    "candidateCount": 8,
                    "candidates": candidates,
                    "runtimeActivation": False,
                    "productionQualified": False,
                }
            ),
            encoding="utf-8",
        )

        (prequal_root / "candidate-qualification.json").write_text(
            json.dumps(
                {
                    "status": "passed",
                    "family": "world-v2",
                    "candidateCount": 8,
                    "clipVariantChecks": 56,
                    "productionReady": False,
                }
            ),
            encoding="utf-8",
        )

        (prequal_root / "verification.json").write_text(
            json.dumps(
                {
                    "status": "passed",
                    "availableAnimalsTested": 4,
                    "clipVariantChecks": 56,
                    "assetManifest": asset_manifest,
                }
            ),
            encoding="utf-8",
        )

        records = []

        for species in SPECIES:
            lite = next(
                item for item in candidates if item["speciesKey"] == species and item["viewerVariant"] == "light"
            )

            for screen in SCREENS:
                for width, height in VIEWPORTS:
                    folder = screen_root / "playwright" / f"{species}-{screen}-{width}x{height}"
                    folder.mkdir()

                    (folder / "candidate-screen.png").write_bytes(PNG)

                    records.append(
                        {
                            "status": "passed",
                            "species": species,
                            "candidateId": lite["candidateId"],
                            "candidateSha256": lite["sha256"],
                            "screen": screen,
                            "viewport": {
                                "width": width,
                                "height": height,
                            },
                            "renderer": "fixture",
                            "subjectBounds": None
                            if screen == "S01"
                            else {
                                "left": -0.5,
                                "right": 0.5,
                                "bottom": -0.5,
                                "top": 0.5,
                            },
                            "activeRequestCount": 1,
                            "layoutOverflow": False,
                        }
                    )

        (screen_root / "screen-integration.json").write_text(
            json.dumps(
                {
                    "status": "passed",
                    "expectedCases": 36,
                    "passedCases": 36,
                    "failedCases": 0,
                    "productionReady": False,
                    "records": records,
                }
            ),
            encoding="utf-8",
        )

        return candidate_root, prequal_root, screen_root

    def test_builds_92_image_review_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            candidate, prequal, screen = self.fixture(root)
            output = root / "package"

            result = build_package(candidate, prequal, screen, output)

            self.assertEqual(result["screenImages"], 36)
            self.assertEqual(result["poseImages"], 56)
            self.assertEqual(result["images"], 92)

            manifest = json.loads((output / "review-manifest.json").read_text(encoding="utf-8"))

            self.assertEqual(manifest["imageCount"], 92)
            self.assertFalse(manifest["productionReady"])
            self.assertFalse(manifest["productionActivationApproved"])

            decision = json.loads((output / "decision-template.json").read_text(encoding="utf-8"))

            self.assertEqual(decision["status"], "pending-human-review")
            self.assertEqual(len(decision["species"]), 4)
            self.assertFalse(decision["productionActivationApproved"])

            self.assertTrue((output / "index.html").is_file())

    def test_refuses_existing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            candidate, prequal, screen = self.fixture(root)
            output = root / "package"
            output.mkdir()

            with self.assertRaisesRegex(ValueError, "already exists"):
                build_package(candidate, prequal, screen, output)


if __name__ == "__main__":
    unittest.main()
