"""Check the actual pure FK relation; evaluated Blender poses are a separate probe."""

import ast
import math
import unittest
from pathlib import Path


def load_sit():
    tree = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    fn = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "fox_sit_displacement")
    namespace = {"math": math}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), "build.py:fox_sit", "exec"), namespace)
    return namespace["fox_sit_displacement"]


SIT = load_sit()


class FoxSitTests(unittest.TestCase):
    def test_pelvis_compensation_keeps_left_and_right_foot_xyz_for_all_sampled_phases(self):
        for index in range(49):
            pulse = (1 - math.cos(2 * math.pi * index / 48)) / 2
            angle, shift = SIT(pulse, 0.28)
            for sign in (-1, 1):
                hip = (sign * 0.29, 0, 0.63)
                foot = (sign * 0.30, 0, 0.35)
                dx, dy, dz = (foot[axis] - hip[axis] for axis in range(3))
                rotated = (dx, dy * math.cos(angle) - dz * math.sin(angle), dy * math.sin(angle) + dz * math.cos(angle))
                solved = tuple(hip[axis] + shift[axis] + rotated[axis] for axis in range(3))
                for actual, expected in zip(solved, foot, strict=True):
                    self.assertAlmostEqual(actual, expected, places=12)

    def test_sitting_moves_pelvis_back_and_down_and_returns_to_start(self):
        self.assertEqual(SIT(0, 0.28), (-0.0, (0, 0.0, -0.0)))
        angle, shift = SIT(1, 0.28)
        self.assertEqual(angle, -0.9)
        self.assertAlmostEqual(shift[1], 0.21933153469569537)
        self.assertAlmostEqual(shift[2], -0.10594920888421397)
        self.assertEqual(shift[0], 0)

    def test_world_hinge_and_inverse_foot_rotation_cancel_orientation(self):
        # Independent unit vectors, including an inclined foot bone, must return
        # to their original direction under the opposite world-X rotation.
        for pulse in (0, 0.1, 0.5, 0.9, 1):
            angle, _ = SIT(pulse, 0.28)
            for vector in ((1, 0, 0), (0, 1, 0), (0, -0.24, -0.22)):
                x, y, z = vector
                a = (x, y * math.cos(angle) - z * math.sin(angle), y * math.sin(angle) + z * math.cos(angle))
                restored = (
                    a[0],
                    a[1] * math.cos(-angle) - a[2] * math.sin(-angle),
                    a[1] * math.sin(-angle) + a[2] * math.cos(-angle),
                )
                for actual, expected in zip(restored, vector, strict=True):
                    self.assertAlmostEqual(actual, expected, places=12)

    def test_invalid_phase_and_length_fail_instead_of_guessing_ground_offset(self):
        for pulse, length in ((math.nan, 0.28), (1.1, 0.28), (-0.1, 0.28), (0.5, 0), (0.5, math.inf)):
            with self.subTest(pulse=pulse, length=length), self.assertRaises(ValueError):
                SIT(pulse, length)


if __name__ == "__main__":
    unittest.main()
