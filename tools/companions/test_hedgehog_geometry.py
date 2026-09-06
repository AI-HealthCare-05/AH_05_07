"""Hedgehog geometry and authored loops; actual Blender/render QA stays separate."""

import ast
import math
import unittest
from pathlib import Path

from test_face_geometry import signed_volume
from test_quill_geometry import GEOMETRY, topology_measurements
from test_root_motion import authoring_fixture


def face_geometry():
    tree = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    names = {
        "hedgehog_face",
        "closed_taper",
        "coat_profiles",
        "profile_front_y",
        "coat_front_y",
        "eye_surface_offset",
        "surface",
        "fixed",
    }
    nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
    made = []

    def mesh(name, vertices, faces, material):
        obj = {"name": name, "vertices": vertices, "faces": faces, "material": material}
        made.append(obj)
        return obj

    namespace = {"math": math, "mesh": mesh, "bind": lambda obj, _rig, weights: obj.update(weights=weights(None))}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:hedgehog_face", "exec"), namespace)
    return namespace, made


def ray_front_y(obj, x, z):
    """Intersect the actual snout's triangulated faces along Y at the nose axis."""
    values = []
    for face in obj["faces"]:
        for i in range(1, len(face) - 1):
            a, b, c = (obj["vertices"][index] for index in (face[0], face[i], face[i + 1]))
            det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
            if abs(det) < 1e-14:
                continue
            u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det
            v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det
            if min(u, v, 1 - u - v) >= -1e-10:
                values.append(u * a[1] + v * b[1] + (1 - u - v) * c[1])
    return min(values)


class HedgehogGeometryTests(unittest.TestCase):
    def test_pointed_snout_embeds_in_smaller_head_and_small_nose_crosses_its_actual_surface(self):
        g, made = face_geometry()
        g["hedgehog_face"](None, "cream", "dark")
        self.assertEqual([obj["name"] for obj in made], ["Hedgehog pointed snout", "Hedgehog tip nose"])
        snout, nose = made
        for obj in made:
            self.assertEqual(obj["weights"], {"head": 1.0})
            self.assertGreater(signed_volume(obj["vertices"], obj["faces"]), 0)
            area, _, edges = topology_measurements(obj["vertices"], obj["faces"])
            self.assertGreater(area, 1e-10)
            self.assertEqual(edges, {2})
        for x, y, z in snout["vertices"][1:25]:
            self.assertAlmostEqual(y - g["coat_front_y"]("hedgehog", x, z), 0.06)
        widths = [max(abs(p[0]) for p in snout["vertices"][1 + i * 24 : 1 + (i + 1) * 24]) for i in range(4)]
        self.assertTrue(all(a > b for a, b in zip(widths[:-1], widths[1:], strict=True)))
        front = ray_front_y(snout, 0, 2.09)
        self.assertLess(min(p[1] for p in nose["vertices"]), front)
        self.assertGreater(max(p[1] for p in nose["vertices"]), front)
        self.assertLess(max(abs(p[0]) for p in nose["vertices"]), widths[-2])

    def test_eyes_remain_embedded_in_changed_cranium(self):
        g, _ = face_geometry()
        bear, hedgehog = (g["coat_profiles"](kind)[1] for kind in ("bear", "hedgehog"))
        self.assertLess(hedgehog[1][0], bear[1][0])
        self.assertLess(hedgehog[1][2], bear[1][2])
        original = -0.487 + 0.040 - g["coat_front_y"]("bear", 0.25, 2.25)
        new = -0.487 + g["eye_surface_offset"]("hedgehog") + 0.040 - g["coat_front_y"]("hedgehog", 0.25, 2.25)
        self.assertAlmostEqual(new, original)
        self.assertGreater(new, 0.015)

    def test_deterministic_staggered_back_and_crown_replace_aligned_comb_rows(self):
        specs = GEOMETRY["hedgehog_quill_specs"]()
        self.assertEqual(specs, GEOMETRY["hedgehog_quill_specs"]())
        self.assertEqual(len(specs), 77)
        self.assertEqual(sum(s["region"] == "crown" for s in specs), 22)
        self.assertEqual(len({s["points"][0][2] for s in specs}), 77)
        lengths = [math.dist(s["points"][0], s["points"][-1]) for s in specs]
        self.assertGreater(max(lengths) - min(lengths), 0.04)
        self.assertGreater(min(lengths), 0.20)
        self.assertLess(max(lengths), 0.30)
        self.assertTrue(all(s["radii"][0] > s["radii"][1] > s["radii"][2] > 0 for s in specs))
        back_heights = [s["points"][0][2] for s in specs if s["region"] == "back"]
        self.assertGreater(max(back_heights) - min(back_heights), 1.40)
        for spec in specs:
            base, _, tip = spec["points"]
            self.assertGreater(tip[1], base[1])
            self.assertGreater(tip[2], base[2])

    def test_crown_projects_outside_authored_head_silhouette_without_claiming_render_visibility(self):
        profile = GEOMETRY["coat_profiles"]("hedgehog")[1]
        specs = [spec for spec in GEOMETRY["hedgehog_quill_specs"]() if spec["region"] == "crown"]
        outside = [
            spec
            for spec in specs
            if GEOMETRY["profile_front_y"](spec["points"][-1][0], spec["points"][-1][2], *profile) is None
        ]
        self.assertGreaterEqual(len(outside), 10)
        self.assertGreater(max(s["points"][-1][2] for s in specs), profile[0][2] + profile[1][2] + 0.10)
        self.assertTrue(any(s["points"][-1][0] < -0.2 for s in outside))
        self.assertTrue(any(s["points"][-1][0] > 0.2 for s in outside))

    def test_all_seven_authored_channels_keep_finite_matching_loop_endpoints_on_twenty_bones(self):
        g, rig, tracks, _, _ = authoring_fixture()
        g["species_proportions"](rig, "hedgehog")
        g["animate"](rig, "hedgehog")
        self.assertEqual(len(rig.data.edit_bones), 20)
        self.assertEqual(set(tracks), set(g["CLIPS"]))
        for clip, channels in tracks.items():
            with self.subTest(clip=clip):
                self.assertEqual(len(channels), 60)
                for keys in channels.values():
                    self.assertTrue(all(math.isfinite(v) for value in keys.values() for v in value))
                    for first, last in zip(keys[min(keys)], keys[max(keys)], strict=True):
                        self.assertAlmostEqual(first, last, places=12)
        self.assertTrue(
            any(
                max(abs(value) for value in keys[49]) > 0
                for (name, channel), keys in tracks["special"].items()
                if channel == "rotation_euler" and name in ("spine", "head")
            )
        )


if __name__ == "__main__":
    unittest.main()
