"""Validate tapered ear shells without Blender; actual species recognition needs renders."""

import ast
import math
import unittest
from collections import Counter
from pathlib import Path


def geometry_functions():
    source = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    nodes = [
        node
        for node in source.body
        if isinstance(node, ast.FunctionDef) and node.name in {"surface", "pointed_ear_point"}
    ]
    namespace = {"math": math, "mesh": lambda name, vertices, faces, mat: (vertices, faces)}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:ear_geometry", "exec"), namespace)
    return namespace


FUNCTIONS = geometry_functions()


class EarGeometryTests(unittest.TestCase):
    def test_both_species_keep_closed_nondegenerate_finite_shells(self):
        for center, radii in (((0.45, 0, 2.57), (0.26, 0.14, 0.31)), ((0.46, 0, 2.65), (0.25, 0.14, 0.37))):
            vertices, faces = FUNCTIONS["surface"]("ear", center, radii, None)
            mapped = [FUNCTIONS["pointed_ear_point"](point, center, radii, 1) for point in vertices]
            edges = Counter()
            volume = 0
            for face in faces:
                for a, b in zip(face, (*face[1:], face[0]), strict=True):
                    edges[tuple(sorted((a, b)))] += 1
                a = mapped[face[0]]
                for i in range(1, len(face) - 1):
                    b, c = mapped[face[i]], mapped[face[i + 1]]
                    ab, ac = [b[j] - a[j] for j in range(3)], [c[j] - a[j] for j in range(3)]
                    cross = [
                        ab[1] * ac[2] - ab[2] * ac[1],
                        ab[2] * ac[0] - ab[0] * ac[2],
                        ab[0] * ac[1] - ab[1] * ac[0],
                    ]
                    self.assertGreater(sum(value * value for value in cross), 1e-16)
                    volume += (
                        a[0] * (b[1] * c[2] - b[2] * c[1])
                        + a[1] * (b[2] * c[0] - b[0] * c[2])
                        + a[2] * (b[0] * c[1] - b[1] * c[0])
                    ) / 6
            self.assertTrue(all(count == 2 for count in edges.values()))
            self.assertGreater(volume, 0)
            self.assertTrue(all(math.isfinite(value) for point in mapped for value in point))

    def test_visible_upper_profile_tapers_and_base_stays_inside_cranium_height(self):
        center, radii = (0.45, 0, 2.57), (0.26, 0.14, 0.31)
        widths = []
        for height in (0, 0.3, 0.6, 0.9):
            radial = math.sqrt(1 - height * height)
            left = FUNCTIONS["pointed_ear_point"](
                (center[0] - radii[0] * radial, 0, center[2] + radii[2] * height), center, radii, 1
            )
            right = FUNCTIONS["pointed_ear_point"](
                (center[0] + radii[0] * radial, 0, center[2] + radii[2] * height), center, radii, 1
            )
            widths.append(right[0] - left[0])
        self.assertEqual(widths, sorted(widths, reverse=True))
        self.assertLess(widths[-1] / widths[0], 0.2)
        self.assertLess(center[2] - radii[2], 2.4)
        self.assertLess(center[2] + radii[2], 2.9)

    def test_mirrored_shell_and_front_cavity_do_not_cross_back_surface(self):
        center, radii = (0.45, 0, 2.57), (0.26, 0.14, 0.31)
        vertices, _ = FUNCTIONS["surface"]("ear", center, radii, None)
        for point in vertices:
            mapped = FUNCTIONS["pointed_ear_point"](point, center, radii, 1)
            mirrored = FUNCTIONS["pointed_ear_point"](
                (-point[0], point[1], point[2]), (-center[0], 0, center[2]), radii, -1
            )
            for actual, expected in zip(mirrored, (-mapped[0], mapped[1], mapped[2]), strict=True):
                self.assertAlmostEqual(actual, expected)
            if point[1] < -1e-8:
                self.assertLess(mapped[1], 0)


if __name__ == "__main__":
    unittest.main()
