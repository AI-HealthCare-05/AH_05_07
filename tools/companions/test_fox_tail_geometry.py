"""Actual authored tail cage and independent two-hinge skin deformation; no Blender."""

import ast
import math
import unittest
from collections import Counter
from pathlib import Path
from types import SimpleNamespace

from test_face_geometry import signed_volume
from test_root_motion import authoring_fixture


def helpers():
    tree = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    names = {
        "fox_tail_specs",
        "fox_tail_geometry",
        "fox_tail_weights",
        "fox_tail_bones",
        "fox_wrap_angles",
        "fox_sit_displacement",
        "coat_profiles",
        "profile_front_y",
        "coat_front_y",
        "coat_back_y",
        "tail_color_planes",
        "tail_color_material",
        "tail_color_coordinate",
        "stripe_planes",
        "stripe_material",
    }
    nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
    result = {"math": math}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:fox_tail", "exec"), result)
    return result


G = helpers()


def rotate(point, pivot, angle):
    x, y, z = (point[i] - pivot[i] for i in range(3))
    return (
        pivot[0] + x * math.cos(angle) - y * math.sin(angle),
        pivot[1] + x * math.sin(angle) + y * math.cos(angle),
        pivot[2] + z,
    )


def deformed(point, pulse):
    """Independent global-Z FK and linear blend of the two actual vertex groups."""
    _, root, joint = G["fox_tail_bones"]()[0]
    a, b = G["fox_wrap_angles"](pulse)
    first = rotate(point, root, a)
    second = rotate(rotate(point, joint, b), root, a)
    weights = G["fox_tail_weights"](SimpleNamespace(x=point[0], y=point[1], z=point[2]))
    _, shift = G["fox_sit_displacement"](pulse, 0.28)
    return tuple(first[i] * weights["tail.01"] + second[i] * weights["tail.02"] + shift[i] for i in range(3))


class FoxTailGeometryTests(unittest.TestCase):
    def test_actual_cage_is_closed_consistently_wound_and_positive_volume(self):
        vertices, faces = G["fox_tail_geometry"]()
        edges, directions = Counter(), Counter()
        for face in faces:
            for a, b in zip(face, (*face[1:], face[0]), strict=True):
                edge = tuple(sorted((a, b)))
                edges[edge] += 1
                directions[edge] += 1 if a < b else -1
        self.assertTrue(all(count == 2 for count in edges.values()))
        self.assertTrue(all(direction == 0 for direction in directions.values()))
        self.assertGreater(signed_volume(vertices, faces), 0)
        # Every ring starts at its vertical top, even where the Y tangent begins
        # curving. A fallback-frame sign flip would reverse these offsets.
        centers, radii = G["fox_tail_specs"]()
        for index, (center, radius) in enumerate(zip(centers, radii, strict=True)):
            self.assertAlmostEqual(vertices[index * 20][2] - center[2], radius)
            self.assertEqual(vertices[index * 20][:2], center[:2])

    def test_actual_two_bone_weights_are_bounded_smooth_and_restore_all_vertices(self):
        vertices, _ = G["fox_tail_geometry"]()
        for point in vertices:
            weights = G["fox_tail_weights"](SimpleNamespace(x=point[0], y=point[1], z=point[2]))
            self.assertEqual(set(weights), {"tail.01", "tail.02"})
            self.assertAlmostEqual(sum(weights.values()), 1)
            self.assertTrue(all(math.isfinite(w) and 0 <= w <= 1 for w in weights.values()))
            for a, b in zip(deformed(point, 0), point, strict=True):
                self.assertAlmostEqual(a, b, places=12)
        for boundary in (1.04, 1.44):
            samples = [
                G["fox_tail_weights"](SimpleNamespace(y=boundary + step))["tail.02"] for step in (-1e-8, 0, 1e-8)
            ]
            self.assertLess(max(samples) - min(samples), 1e-12)

    def test_tail_tip_reaches_front_while_joint_routes_around_right_flank(self):
        centers, _ = G["fox_tail_specs"]()
        tip = deformed(centers[-1], 1)
        _, shift = G["fox_sit_displacement"](1, 0.28)
        relative = tuple(tip[i] - shift[i] for i in range(3))
        self.assertGreater(relative[0], 0)
        self.assertLess(relative[0], 0.4)
        self.assertLess(relative[1], G["coat_front_y"]("fox", relative[0], relative[2]) - 0.20)
        joint = deformed(centers[5], 1)
        self.assertGreater(joint[0], 0.85)
        # These are geometric outcomes, not arbitrary success angles: zero yaw
        # and the original short rear hook cannot satisfy the front endpoint.
        self.assertGreater(deformed(centers[-1], 0)[1], 2)

    def test_base_cap_stays_inside_authored_coat_and_floor_clear_at_all_sampled_phases(self):
        vertices, faces = G["fox_tail_geometry"]()
        for index in range(97):
            pulse = (1 - math.cos(2 * math.pi * index / 96)) / 2
            points = [deformed(point, pulse) for point in vertices]
            _, shift = G["fox_sit_displacement"](pulse, 0.28)
            self.assertGreater(min(p[2] for p in points), 0.25)
            self.assertGreater(signed_volume(points, faces), 0)
            for point in points[:20]:
                x, y, z = (point[i] - shift[i] for i in range(3))
                self.assertGreater(y, G["coat_front_y"]("fox", x, z))
                self.assertLess(y, G["coat_back_y"]("fox", x, z))
            for face in faces:
                a = points[face[0]]
                for offset in range(1, len(face) - 1):
                    b, c = points[face[offset]], points[face[offset + 1]]
                    ab, ac = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
                    cross = [
                        ab[1] * ac[2] - ab[2] * ac[1],
                        ab[2] * ac[0] - ab[0] * ac[2],
                        ab[0] * ac[1] - ab[1] * ac[0],
                    ]
                    self.assertGreater(sum(v * v for v in cross), 1e-12)

    def test_fox_reuses_twenty_bones_and_preserves_planted_foot_parenting(self):
        namespace, rig, _, _, modes = authoring_fixture()
        namespace.update(G)
        tree = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
        character = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "character")
        setup = next(n for n in character.body if isinstance(n, ast.If) and ast.unparse(n.test) == "kind == 'fox'")
        namespace.update({"rig": rig, "kind": "fox"})
        exec(compile(ast.Module(body=[setup], type_ignores=[]), "build.py:fox_setup", "exec"), namespace)
        self.assertEqual(len(rig.data.edit_bones), 20)
        for name, head, tail in G["fox_tail_bones"]():
            self.assertEqual(tuple(rig.data.edit_bones[name].head), head)
            self.assertEqual(tuple(rig.data.edit_bones[name].tail), tail)
        self.assertIs(rig.data.edit_bones["tail.01"].parent, rig.data.edit_bones["hips"])
        self.assertIs(rig.data.edit_bones["tail.02"].parent, rig.data.edit_bones["tail.01"])
        for side in ("L", "R"):
            self.assertIs(rig.data.edit_bones[f"foot.{side}"].parent, rig.data.edit_bones["root"])
        self.assertEqual(modes[-2:], ["EDIT", "OBJECT"])

    def test_distal_surface_stays_outside_authored_body_union_during_wrap(self):
        vertices, _ = G["fox_tail_geometry"]()
        # The proximal root is intentionally buried. Inspect the bending joint
        # and distal surface, where an outside route around the flank is needed.
        samples = [point for point in vertices if point[1] >= 1.24]
        for index in range(97):
            pulse = (1 - math.cos(2 * math.pi * index / 96)) / 2
            _, shift = G["fox_sit_displacement"](pulse, 0.28)
            for point in samples:
                moved = deformed(point, pulse)
                x, y, z = (moved[i] - shift[i] for i in range(3))
                for profile in G["coat_profiles"]("fox"):
                    front = G["profile_front_y"](x, z, *profile)
                    if front is not None:
                        self.assertFalse(front < y < 2 * profile[0][1] - front, (index, point, (x, y, z)))

    def test_tip_marking_uses_distal_rest_length_and_angles_fail_closed(self):
        centers, _ = G["fox_tail_specs"]()
        self.assertFalse(G["tail_color_material"]("fox_tail", G["tail_color_coordinate"]("fox_tail", centers[0])))
        self.assertTrue(G["tail_color_material"]("fox_tail", G["tail_color_coordinate"]("fox_tail", centers[-1])))
        self.assertEqual(G["tail_color_planes"]("fox_tail", 0.2, 2.5), [((0, 2.13, 0), (0, 1, 0))])
        for value in (math.nan, math.inf, -0.1, 1.1):
            with self.assertRaises(ValueError):
                G["fox_wrap_angles"](value)
        for value in (0, 3.5, True):
            with self.assertRaises(ValueError):
                G["fox_tail_geometry"](value)


if __name__ == "__main__":
    unittest.main()
