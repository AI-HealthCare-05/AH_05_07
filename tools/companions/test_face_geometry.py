"""Exercise actual pure geometry functions without importing Blender or creating assets."""

import ast
import math
import unittest
from collections import Counter
from pathlib import Path
from types import SimpleNamespace


def load_geometry():
    """Compile the actual authoring functions; only mesh creation is a data-return stub."""
    source = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    functions = {
        "surface",
        "coat_profiles",
        "profile_front_y",
        "coat_front_y",
        "eye_surface_offset",
        "face_warp_point",
        "warp_face",
        "marking_point",
        "conform_marking",
    }
    constants = {"MARKING_EMBED", "MARKING_RELIEF"}
    nodes = [
        node
        for node in source.body
        if isinstance(node, ast.FunctionDef)
        and node.name in functions
        or isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id in constants for target in node.targets)
    ]
    namespace = {
        "math": math,
        "mesh": lambda name, verts, faces, material: {"name": name, "vertices": verts, "faces": faces},
    }
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:pure_geometry", "exec"), namespace)
    return namespace


GEOMETRY = load_geometry()
MARKINGS = (
    ("red_panda", (0, -0.405, 1.14), (0.32, 0.064, 0.43), 0.13, 20, 32),
    ("fox", (0, -0.405, 1.14), (0.32, 0.064, 0.43), 0.13, 20, 32),
    ("penguin", (0, -0.405, 1.14), (0.32, 0.064, 0.43), 0.13, 20, 32),
    ("otter", (0, -0.405, 1.14), (0.32, 0.064, 0.43), 0.13, 20, 32),
    ("squirrel", (0, -0.405, 1.14), (0.32, 0.064, 0.43), 0.13, 20, 32),
    ("seal", (0, -0.405, 1.14), (0.32, 0.064, 0.43), 0.13, 20, 32),
    *(("red_panda", (sign * 0.41, -0.397, 2.18), (0.15, 0.05, 0.17), 0, 16, 24) for sign in (-1, 1)),
    *(("penguin", (sign * 0.25, -0.452, 2.22), (0.20, 0.050, 0.275), 0, 20, 32) for sign in (-1, 1)),
)


def signed_volume(vertices, faces):
    total = 0
    for face in faces:
        a = vertices[face[0]]
        for index in range(1, len(face) - 1):
            b, c = vertices[face[index]], vertices[face[index + 1]]
            total += (
                a[0] * (b[1] * c[2] - b[2] * c[1])
                + a[1] * (b[2] * c[0] - b[0] * c[2])
                + a[2] * (b[0] * c[1] - b[1] * c[0])
            ) / 6
    return total


class FaceGeometryTests(unittest.TestCase):
    def test_shallow_cranium_eyes_preserve_embedding_and_original_species_stay_fixed(self):
        reference = -0.487 + 0.040 - GEOMETRY["coat_front_y"]("bear", 0.25, 2.25)
        self.assertGreater(reference, 0.015)
        for kind in ("cat", "fox", "squirrel"):
            coat = GEOMETRY["coat_front_y"](kind, 0.25, 2.25)
            self.assertLess(-0.487 + 0.040 - coat, -0.02, "Reproduce the old detached eye centerline")
            offset = GEOMETRY["eye_surface_offset"](kind)
            self.assertAlmostEqual(-0.487 + offset + 0.040 - coat, reference)
            self.assertLess(-0.487 + offset - coat, 0, "Front hemisphere stays visible")
        coat = GEOMETRY["coat_front_y"]("capybara", 0.25, 2.25)
        offset = GEOMETRY["eye_surface_offset"]("capybara")
        self.assertAlmostEqual(-0.487 + offset + 0.040 - coat, reference)
        for kind in ("bear", "rabbit", "dog", "red_panda", "otter", "hedgehog", "penguin", "seal"):
            self.assertEqual(GEOMETRY["eye_surface_offset"](kind), 0)

    def test_profile_matches_known_ellipse_and_actual_rounded_pear_vertices(self):
        front = GEOMETRY["profile_front_y"]
        self.assertAlmostEqual(front(0.6, 0, (0, 0, 0), (1, 1, 1)), -0.8)
        self.assertEqual(front(0, 1, (0, 0, 0), (1, 1, 1)), 0)
        self.assertIsNone(front(2, 0, (0, 0, 0), (1, 1, 1)))
        for kind in ("bear", "cat", "capybara"):
            for center, radii, pear, flatten in GEOMETRY["coat_profiles"](kind):
                geometry = GEOMETRY["surface"]("profile", center, radii, None, pear=pear, flatten=flatten)
                for x, y, z in geometry["vertices"]:
                    if y < center[1] - 1e-5:
                        self.assertAlmostEqual(front(x, z, center, radii, pear, flatten), y, places=10)

    def test_bear_and_rabbit_coat_profiles_and_face_positions_are_preserved(self):
        original = (
            ((0, 0.015, 1.05), (0.60, 0.45, 0.81), 0.18, 1),
            ((0, -0.01, 2.10), (0.67, 0.51, 0.59), 0.10, 0.86),
            ((0, 0.025, 1.64), (0.39, 0.35, 0.4), 0, 1),
        )
        for kind in ("bear", "rabbit"):
            self.assertEqual(GEOMETRY["coat_profiles"](kind), original)
            for point in ((0, -0.642, 2.14), (0.025, -0.652, 2.035), (0.138, -0.621, 2.04)):
                self.assertEqual(GEOMETRY["face_warp_point"](kind, point, 0.3), point)

    def test_muzzle_nose_and_smile_keep_relative_front_clearance(self):
        front = GEOMETRY["profile_front_y"]
        warp = GEOMETRY["face_warp_point"]
        points = (
            (0, -0.696, 2.14),
            (0, -0.650, 2.105),
            (0.025, -0.652, 2.035),
            (0.082, -0.647, 2.005),
            (0.138, -0.621, 2.04),
        )
        for kind in ("cat", "fox", "squirrel", "capybara"):
            width = 0.39 if kind == "capybara" else 0.30
            for x, y, z in points:
                base_front = front(x, z, (0, -0.493, 2.06), (width, 0.15, 0.205), flatten=0.83)
                old_clearance = y - base_front
                new_front = warp(kind, (x, base_front, z), width)
                new_detail = warp(kind, (x, y, z), width)
                scale = 1.55 if kind == "capybara" else 1
                self.assertAlmostEqual(new_detail[1] - new_front[1], old_clearance * scale)
                self.assertEqual(new_detail[2], new_front[2])
                if x == 0:
                    self.assertLess(old_clearance, 0, "The authored nose and mouth centers protrude")
                # The outer mouth endpoint intentionally anchors inside the muzzle;
                # its signed clearance must be retained as well as the visible center.
                self.assertGreater((new_detail[1] - new_front[1]) * old_clearance, 0)

    def test_shared_vertex_warp_and_capybara_height_affine_are_applied(self):
        points = [(0, -0.493, 2.06), (0, -0.642, 2.14), (0.138, -0.621, 2.04)]
        obj = SimpleNamespace(
            data=SimpleNamespace(vertices=[SimpleNamespace(co=point) for point in points], update=lambda: None)
        )
        GEOMETRY["warp_face"](obj, "capybara", 0.39)
        for old, vertex in zip(points, obj.data.vertices, strict=True):
            self.assertAlmostEqual((vertex.co[1] + 0.49) / 1.55 - 0.49, old[1])
            self.assertAlmostEqual((vertex.co[2] - 2.06) / 0.83 + 2.06, old[2])
        self.assertAlmostEqual(obj.data.vertices[1].co[2], 2.1264)

    def test_coat_union_is_continuous_at_torso_neck_boundary(self):
        front = GEOMETRY["profile_front_y"]
        body, _, neck = GEOMETRY["coat_profiles"]("red_panda")
        lower, upper = 1.45, 1.6
        for _ in range(50):
            middle = (lower + upper) / 2
            if front(0, middle, *body) < front(0, middle, *neck):
                lower = middle
            else:
                upper = middle
        center = (lower + upper) / 2
        values = [GEOMETRY["coat_front_y"]("red_panda", 0, center + delta) for delta in (-1e-8, 0, 1e-8)]
        self.assertLess(max(values) - min(values), 1e-6)
        with self.assertRaises(ValueError):
            GEOMETRY["coat_front_y"]("red_panda", 100, 100)

    def test_marking_closed_topology_volume_and_supported_footprints(self):
        for kind, center, radii, pear, rings, segments in MARKINGS:
            with self.subTest(kind=kind, center=center):
                shape = GEOMETRY["surface"]("marking", center, radii, None, rings, segments, pear)
                obj = SimpleNamespace(
                    data=SimpleNamespace(
                        vertices=[SimpleNamespace(co=p) for p in shape["vertices"]], update=lambda: None
                    )
                )
                GEOMETRY["conform_marking"](obj, kind, center, radii)
                mapped = [vertex.co for vertex in obj.data.vertices]
                self.assertGreater(signed_volume(shape["vertices"], shape["faces"]), 0)
                self.assertGreater(signed_volume(mapped, shape["faces"]), 0)
                edges = Counter()
                for face in shape["faces"]:
                    for a, b in zip(face, (*face[1:], face[0]), strict=True):
                        edges[tuple(sorted((a, b)))] += 1
                self.assertTrue(all(count == 2 for count in edges.values()))
                for old, new in zip(shape["vertices"], mapped, strict=True):
                    self.assertTrue(all(math.isfinite(v) for v in new))
                    self.assertEqual((old[0], old[2]), (new[0], new[2]))
                    coat = GEOMETRY["coat_front_y"](kind, new[0], new[2])
                    self.assertGreaterEqual(new[1] - coat, -0.013)
                    if old[1] >= center[1] - 1e-12:
                        self.assertGreaterEqual(new[1] - coat, 0.04 - 1e-12)

    def test_rims_embed_and_front_back_thickness_remains_positive(self):
        for kind, center, radii, pear, _, _ in MARKINGS:
            for offset in (0, 0.2, 0.5, 0.8):
                x, z = center[0] + radii[0] * offset, center[2]
                old_front = GEOMETRY["profile_front_y"](x, z, center, radii, pear)
                old_back = 2 * center[1] - old_front
                a = GEOMETRY["marking_point"](kind, (x, old_front, z), center, radii)
                b = GEOMETRY["marking_point"](kind, (x, old_back, z), center, radii)
                self.assertGreater(b[1] - a[1], 0)
                self.assertAlmostEqual(b[1] - a[1], (old_back - old_front) * 0.052 / radii[1])
            for x, z in ((center[0] + radii[0], center[2]), (center[0], center[2] + radii[2])):
                rim = GEOMETRY["marking_point"](kind, (x, center[1], z), center, radii)
                self.assertAlmostEqual(rim[1] - GEOMETRY["coat_front_y"](kind, x, z), 0.04)

    def test_face_center_seam_and_marking_projection_are_continuous(self):
        left = GEOMETRY["face_warp_point"]("cat", (-1e-9, -0.65, 2.1), 0.3)
        right = GEOMETRY["face_warp_point"]("cat", (1e-9, -0.65, 2.1), 0.3)
        self.assertEqual(left[1:], right[1:])
        for kind, center, radii, _, _, _ in MARKINGS:
            points = [
                GEOMETRY["marking_point"](kind, (center[0] + offset, center[1], center[2]), center, radii)
                for offset in (-1e-8, 0, 1e-8)
            ]
            self.assertLess(max(p[1] for p in points) - min(p[1] for p in points), 1e-6)


if __name__ == "__main__":
    unittest.main()
