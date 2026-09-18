import hashlib
import json
import struct
import tempfile
import unittest
import zipfile
from pathlib import Path

from prepare_candidate_review import prepare


def fake_glb(marker):
    document = json.dumps(
        {
            "asset": {
                "version": "2.0"
            },
            "scene": 0,
            "scenes": [
                {}
            ],
            "extras": {
                "fixture": marker
            },
        },
        separators=(",", ":"),
    ).encode("utf-8")

    document += (
        b" " * (-len(document) % 4)
    )

    total = (
        12
        + 8
        + len(document)
    )

    return (
        struct.pack(
            "<III",
            0x46546C67,
            2,
            total,
        )
        + struct.pack(
            "<II",
            len(document),
            0x4E4F534A,
        )
        + document
    )


class CandidateReviewBridgeTests(
    unittest.TestCase
):
    def make_fixture(
        self,
        root,
        bad_sha=False,
        unsafe=False,
    ):
        archive = root / "master.zip"
        inventory = root / "candidates.json"

        candidates = []

        species_list = [
            "koala",
            "mouse",
            "pig",
            "owl",
        ]

        with zipfile.ZipFile(
            archive,
            "w",
        ) as zf:
            for species in species_list:
                for variant in (
                    "lite",
                    "standard",
                ):
                    glb = fake_glb(
                        f"{species}:{variant}"
                    )

                    source = (
                        "SK7_Asset_Factory_"
                        "Master_20260918/"
                        "02_World_Factory/"
                        "assets/"
                        f"{species}-"
                        f"{variant}.glb"
                    )

                    zf.writestr(
                        source,
                        glb,
                    )

                    digest = hashlib.sha256(
                        glb
                    ).hexdigest()

                    is_target = (
                        species == "koala"
                        and variant == "lite"
                    )

                    candidates.append({
                        "candidateId":
                            (
                                "COMPANION-CAND-"
                                f"{species.upper()}-"
                                "V002-"
                                f"{variant.upper()}"
                            ),
                        "speciesKey":
                            species,
                        "version":
                            "v002",
                        "variantKey":
                            variant,
                        "sourceFile":
                            (
                                "../unsafe.glb"
                                if unsafe
                                and is_target
                                else source
                            ),
                        "sha256":
                            (
                                "0" * 64
                                if bad_sha
                                and is_target
                                else digest
                            ),
                        "bytes":
                            len(glb),
                        "clips": [
                            "celebrate",
                            "curious",
                            "greet",
                            "idle",
                            "move",
                            "rest",
                            "special",
                        ],
                        "status":
                            "review",
                        "provenance": {
                            "owner":
                                "emotigom",
                            "rightsBasis":
                                "test fixture",
                            "sourceRevision":
                                "world-v2-001",
                        },
                    })

        inventory.write_text(
            json.dumps({
                "schemaVersion": 1,
                "status": "staging",
                "purpose":
                    "fixture candidate "
                    "review inventory",
                "candidates":
                    candidates,
            }),
            encoding="utf-8",
        )

        return (
            inventory,
            archive,
        )

    def test_prepares_world_family_without_activation(
        self,
    ):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            inventory, archive = (
                self.make_fixture(
                    root
                )
            )

            output = (
                root
                / "review-assets"
            )

            result = prepare(
                inventory,
                archive,
                output,
                "world-v2",
                hashlib.sha256(
                    archive.read_bytes()
                ).hexdigest(),
            )

            self.assertEqual(
                result["candidateCount"],
                8,
            )

            self.assertEqual(
                result["speciesCount"],
                4,
            )

            self.assertFalse(
                result[
                    "runtimeActivation"
                ]
            )

            self.assertFalse(
                result[
                    "productionQualified"
                ]
            )

            catalog = json.loads(
                (
                    output
                    / "catalog.json"
                ).read_text(
                    encoding="utf-8"
                )
            )

            self.assertEqual(
                len(
                    catalog[
                        "animals"
                    ]
                ),
                12,
            )

            available = [
                animal
                for animal in catalog[
                    "animals"
                ]
                if animal["standard"]
                and animal["light"]
            ]

            self.assertEqual(
                len(available),
                4,
            )

            self.assertEqual(
                {
                    animal["id"]
                    for animal
                    in available
                },
                {
                    "koala",
                    "mouse",
                    "pig",
                    "owl",
                },
            )

            for animal in available:
                self.assertTrue(
                    (
                        output
                        / animal[
                            "standard"
                        ]
                    ).is_file()
                )

                self.assertTrue(
                    (
                        output
                        / animal[
                            "light"
                        ]
                    ).is_file()
                )

    def test_sha_mismatch_leaves_no_finished_output(
        self,
    ):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            inventory, archive = (
                self.make_fixture(
                    root,
                    bad_sha=True,
                )
            )

            output = (
                root
                / "review-assets"
            )

            with self.assertRaisesRegex(
                ValueError,
                "SHA-256 mismatch",
            ):
                prepare(
                    inventory,
                    archive,
                    output,
                    "world-v2",
                )

            self.assertFalse(
                output.exists()
            )

    def test_traversal_source_is_rejected(
        self,
    ):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            inventory, archive = (
                self.make_fixture(
                    root,
                    unsafe=True,
                )
            )

            output = (
                root
                / "review-assets"
            )

            with self.assertRaisesRegex(
                ValueError,
                "unsafe",
            ):
                prepare(
                    inventory,
                    archive,
                    output,
                    "world-v2",
                )

            self.assertFalse(
                output.exists()
            )

    def test_output_inside_repository_is_rejected(
        self,
    ):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            inventory, archive = (
                self.make_fixture(
                    root
                )
            )

            repository_output = (
                Path(__file__)
                .resolve()
                .parents[2]
                / "candidate-review-output"
            )

            with self.assertRaisesRegex(
                ValueError,
                "outside the repository",
            ):
                prepare(
                    inventory,
                    archive,
                    repository_output,
                    "world-v2",
                )


if __name__ == "__main__":
    unittest.main()
