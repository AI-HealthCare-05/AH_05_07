"""Exercise contour specifications and mutation guards; Blender cutting is a separate probe."""

import ast
import math
import unittest
from pathlib import Path
from types import SimpleNamespace


def load_geometry():
    tree = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    names = {
        "marking_outline",
        "coat_marking_outlines",
        "outline_planes",
        "plane_distance",
        "inside_outline",
        "outline_bounds",
        "face_overlaps_marking",
        "stripe_planes",
        "stripe_material",
        "verify_marked_surface",
        "profile_front_y",
        "coat_profiles",
        "coat_front_y",
        "marking_point",
    }
    constants = {"MARKING_EMBED", "MARKING_RELIEF", "MARKING_OUTLINE_SEGMENTS", "MARKING_CUT_EPS"}
    nodes = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
        and node.name in names
        or isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id in constants for target in node.targets)
    ]
    namespace = {"math": math}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:marking_geometry", "exec"), namespace)
    return namespace


G = load_geometry()


class Vertex:
    def __init__(self, co, weights):
        self.co = co
        self.weights = weights
        self.is_valid = True

    def __getitem__(self, _):
        return self.weights


def guarded_fixture():
    old = Vertex((0, 0, 0), {0: 1.0})
    interpolated = Vertex((0.5, 0, 0), {0: 0.5, 1: 0.5})
    mesh = SimpleNamespace(verts=[old, interpolated], edges=[SimpleNamespace(is_manifold=True)])
    return mesh, {old: (tuple(old.co), dict(old.weights))}


class MarkingBoundaryTests(unittest.TestCase):
    def test_outline_matches_old_ideal_shell_crossing_without_enlarging_patch(self):
        cases = (
            ((0, -0.405, 1.14), (0.32, 0.064, 0.43), 0.13),
            ((0.41, -0.397, 2.18), (0.15, 0.05, 0.17), 0),
            ((0.25, -0.452, 2.22), (0.20, 0.05, 0.275), 0),
        )
        for center, radii, pear in cases:
            outline = G["marking_outline"](center, radii, pear)
            self.assertEqual(len(outline), 64)
            for x, z in outline:
                old_y = G["profile_front_y"](x, z, center, radii, pear)
                projected = G["marking_point"]("red_panda", (x, old_y, z), center, radii)
                self.assertAlmostEqual(projected[1], G["coat_front_y"]("red_panda", x, z), places=12)
                self.assertLess(abs(x - center[0]), radii[0])
                self.assertLess(abs(z - center[2]), radii[2])

    def test_convex_contour_halfplanes_and_subpixel_chord_error(self):
        for kind in ("red_panda", "otter", "penguin", "seal", "fox", "squirrel"):
            for outline in G["coat_marking_outlines"](kind):
                planes = G["outline_planes"](outline)
                for x, z in outline:
                    self.assertTrue(G["inside_outline"]((x, -0.4, z), planes))
                for a, b, c in zip(outline, outline[1:] + outline[:1], outline[2:] + outline[:2], strict=True):
                    self.assertGreater((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), 0)
                for _, normal in planes:
                    self.assertAlmostEqual(math.dist(normal, (0, 0, 0)), 1)
        center, radii = (0, 0, 0), (0.32, 0.06, 0.43)
        coarse = G["marking_outline"](center, radii, 0.13)
        fine = G["marking_outline"](center, radii, 0.13, segments=128)
        errors = [
            math.dist(fine[2 * i + 1], ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
            for i, (a, b) in enumerate(zip(coarse, coarse[1:] + coarse[:1], strict=True))
        ]
        self.assertLess(max(errors), 0.0005, "64-edge footprint error is below 0.27px at 1800px/3.5 units")

    def test_species_warp_matches_existing_footprint_and_unmarked_species_stay_unmarked(self):
        base = G["coat_marking_outlines"]("fox")[0]
        for kind, scale in (("otter", (0.88, 0.98)), ("penguin", (0.89, 0.95)), ("seal", (1.08, 0.64))):
            warped = G["coat_marking_outlines"](kind)[0]
            for a, b in zip(base, warped, strict=True):
                self.assertEqual(b, (a[0] * scale[0], a[1] * scale[1]))
        for kind in ("bear", "rabbit", "cat", "dog", "capybara", "hedgehog"):
            self.assertEqual(G["coat_marking_outlines"](kind), [])

    def test_coarse_face_crossing_contour_is_detected_even_with_outside_centroid(self):
        outline = G["marking_outline"]((0, 0, 0), (1, 1, 1))
        planes = G["outline_planes"](outline)
        triangle = ((-0.7, -0.5, 0), (0.7, -0.5, 0), (0, -0.5, 2))
        centroid = tuple(sum(p[index] for p in triangle) / 3 for index in range(3))
        self.assertFalse(G["inside_outline"](centroid, planes))
        self.assertTrue(G["inside_outline"]((0, -0.5, 0.1), planes))
        self.assertTrue(G["face_overlaps_marking"](triangle, G["outline_bounds"](outline)))
        self.assertTrue(
            any(
                min(G["plane_distance"](point, plane) for point in triangle) < -G["MARKING_CUT_EPS"]
                and max(G["plane_distance"](point, plane) for point in triangle) > G["MARKING_CUT_EPS"]
                for plane in planes
            )
        )

    def test_tail_planes_split_color_transitions_not_arbitrary_centroid_steps(self):
        planes = G["stripe_planes"](0.615, 1.50931)
        levels = [plane[0][2] for plane in planes]
        self.assertEqual(levels, [index / 12 for index in (9, 10, 12, 13, 15, 16, 18)])
        for level in levels:
            self.assertNotEqual(G["stripe_material"](level - 1e-6), G["stripe_material"](level + 1e-6))
        # A real edge spanning the 0.75 transition cannot retain one face-center color.
        self.assertNotEqual(G["stripe_material"](0.74), G["stripe_material"](0.76))
        plane = planes[0]
        a, b = (0, 0.4, 0.71), (0.1, 0.6, 0.81)
        da, db = G["plane_distance"](a, plane), G["plane_distance"](b, plane)
        fraction = da / (da - db)
        on_edge = tuple(x + (y - x) * fraction for x, y in zip(a, b, strict=True))
        self.assertGreater(fraction, 0)
        self.assertLess(fraction, 1)
        self.assertAlmostEqual(G["plane_distance"](on_edge, plane), 0)
        self.assertAlmostEqual(on_edge[2], 0.75)

    def test_invalid_contour_inputs_are_rejected(self):
        for options in (
            {"segments": 8},
            {"segments": 64.5},
            {"scale": (1,)},
            {"scale": (0, 1)},
            {"pear": math.nan},
            {"pear": 0.3},
        ):
            with self.subTest(options=options), self.assertRaises(ValueError):
                G["marking_outline"]((0, 0, 0), (1, 1, 1), **options)

    def test_valid_interpolated_skin_vertex_passes_guard(self):
        mesh, old = guarded_fixture()
        G["verify_marked_surface"](mesh, "deform", old)

    def test_opened_mesh_moved_old_vertex_and_changed_old_weights_are_rejected(self):
        mutations = (
            lambda mesh: setattr(mesh.edges[0], "is_manifold", False),
            lambda mesh: setattr(mesh.verts[0], "co", (0.001, 0, 0)),
            lambda mesh: setattr(mesh.verts[0], "is_valid", False),
            lambda mesh: setattr(mesh.verts[0], "weights", {0: 0.9, 1: 0.1}),
        )
        for mutate in mutations:
            mesh, old = guarded_fixture()
            mutate(mesh)
            with self.assertRaises(ValueError):
                G["verify_marked_surface"](mesh, "deform", old)

    def test_new_nonfinite_negative_unnormalized_or_over_four_weights_are_rejected(self):
        for weights in ({}, {0: math.nan}, {0: math.inf}, {0: 1.1, 1: -0.1}, {0: 0.7}, dict.fromkeys(range(5), 0.2)):
            mesh, old = guarded_fixture()
            mesh.verts[1].weights = weights
            with self.subTest(weights=weights), self.assertRaises(ValueError):
                G["verify_marked_surface"](mesh, "deform", old)


if __name__ == "__main__":
    unittest.main()
