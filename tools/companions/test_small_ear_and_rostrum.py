"""Geometry invariants for the floating-small-ear and bear-like capybara defects."""

import ast
import math
import unittest
from pathlib import Path

from test_face_geometry import signed_volume


def geometry():
    source = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    names = {"coat_profiles", "profile_front_y", "small_ear_center", "capybara_face", "surface", "fixed"}
    nodes = [n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in names]
    made = []

    def mesh(name, vertices, faces, material):
        obj = {"name": name, "vertices": vertices, "faces": faces}
        made.append(obj)
        return obj

    def tube(name, points, radii, material, sides):
        obj = {"name": name, "points": points, "radii": radii}
        made.append(obj)
        return obj

    namespace = {"math": math, "mesh": mesh, "tube": tube, "bind": lambda *_: None}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:small_geometry", "exec"), namespace)
    return namespace, made


class SmallEarAndRostrumTests(unittest.TestCase):
    def test_ear_base_and_rotation_pivot_are_inside_the_actual_cranium(self):
        g, _ = geometry()
        for kind in ("otter", "capybara", "hedgehog"):
            for sign in (-1, 1):
                x = sign * (0.45 if kind == "capybara" else 0.5)
                center = g["small_ear_center"](kind, x, 0.12)
                profile = g["coat_profiles"](kind)[1]
                for z in (center[2] - 0.12, center[2] - 0.08):
                    front = g["profile_front_y"](x, z, *profile)
                    self.assertIsNotNone(front)
                    self.assertLess(front, -0.05)
                    self.assertGreater(2 * profile[0][1] - front, 0.05)
                self.assertLess(center[2], 2.6)
        for kind, radius in (("bear", 0.12), ("capybara", 0)):
            with self.assertRaises(ValueError):
                g["small_ear_center"](kind, 0.45, radius)

    def test_old_capybara_fixed_ear_height_reproduces_missing_head_contact(self):
        g, _ = geometry()
        original_head = ((0, -0.01, 2.10), (0.66, 0.53, 0.49), 0.10, 0.86)
        # The original bottom pole has no cranium beneath it at the same X/Z.
        self.assertIsNone(g["profile_front_y"](0.5, 2.6 - 0.12, *original_head))

    def test_blunt_rostrum_is_closed_and_attached_details_follow_its_surface(self):
        g, made = geometry()
        g["capybara_face"](None, None, None)
        muzzle, left, right, mouth = made
        self.assertGreater(signed_volume(muzzle["vertices"], muzzle["faces"]), 0)
        extent = [max(v[i] for v in muzzle["vertices"]) - min(v[i] for v in muzzle["vertices"]) for i in range(3)]
        self.assertGreater(extent[1], 1.8 * extent[2])
        self.assertGreater(extent[0], 1.8 * extent[2])
        self.assertLess(min(v[1] for v in muzzle["vertices"]), -0.85)
        for obj in (left, right):
            self.assertGreater(signed_volume(obj["vertices"], obj["faces"]), 0)
            center = tuple(
                (max(v[i] for v in obj["vertices"]) + min(v[i] for v in obj["vertices"])) / 2 for i in range(3)
            )
            front = g["profile_front_y"](center[0], center[2], (0, -0.55, 2.055), (0.38, 0.36, 0.185), flatten=0.55)
            self.assertLess(min(v[1] for v in obj["vertices"]), front)
            self.assertGreater(max(v[1] for v in obj["vertices"]), front)
        for point, radius in zip(mouth["points"], mouth["radii"], strict=True):
            front = g["profile_front_y"](point[0], point[2], (0, -0.55, 2.055), (0.38, 0.36, 0.185), flatten=0.55)
            self.assertLess(abs(point[1] - front), radius)


if __name__ == "__main__":
    unittest.main()
