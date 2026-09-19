import unittest

from blender_reimport_world_v2 import (
    EXPECTED_ACTIONS,
    archive_member,
    structural_key,
    validate_report,
)


class BlenderReimportBoundaryTests(unittest.TestCase):
    def test_archive_member_requires_unique_world_path(self):
        names = ["root/02_World_Factory/SK7_World_Factory_v2/assets/companions/koala-world-v2-001-lite.glb"]

        member = archive_member(
            names,
            "koala-world-v2-001-lite.glb",
        )

        self.assertEqual(
            member,
            names[0],
        )

    def test_archive_member_rejects_duplicates(self):
        suffix = "02_World_Factory/SK7_World_Factory_v2/assets/companions/koala-world-v2-001-lite.glb"

        with self.assertRaisesRegex(
            ValueError,
            "exactly one",
        ):
            archive_member(
                [
                    "a/" + suffix,
                    "b/" + suffix,
                ],
                "koala-world-v2-001-lite.glb",
            )

    def test_report_requires_one_armature_and_all_actions(self):
        report = {
            "objects": 3,
            "meshes": 1,
            "armatures": 1,
            "bones": 12,
            "actions": sorted(EXPECTED_ACTIONS),
            "materials": [
                "body",
            ],
            "meshVertices": 100,
            "meshPolygons": 80,
        }

        validate_report(report)

        broken = {
            **report,
            "armatures": 0,
        }

        with self.assertRaisesRegex(
            ValueError,
            "one armature",
        ):
            validate_report(broken)

    def test_structural_key_ignores_mode_metadata(self):
        base = {
            "objects": 3,
            "meshes": 1,
            "armatures": 1,
            "bones": 12,
            "actions": sorted(EXPECTED_ACTIONS),
            "materials": [
                "body",
            ],
            "meshVertices": 100,
            "meshPolygons": 80,
            "mode": "import",
            "blenderVersion": "fixture",
        }

        reopened = {
            **base,
            "mode": "reopen",
        }

        self.assertEqual(
            structural_key(base),
            structural_key(reopened),
        )


if __name__ == "__main__":
    unittest.main()
