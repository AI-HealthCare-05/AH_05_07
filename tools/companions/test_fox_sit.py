"""Check the actual pure FK relation; evaluated Blender poses are a separate probe."""

import ast
import math
import unittest
from pathlib import Path


def load_helpers():
    tree = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    nodes = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name in ("fox_sit_displacement", "root_relative_foot_basis")
    ]
    namespace = {"math": math}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:fox_sit", "exec"), namespace)
    return namespace


HELPERS = load_helpers()
SIT = HELPERS["fox_sit_displacement"]
FOOT_BASIS = HELPERS["root_relative_foot_basis"]


class Pose2D:
    """Independent rigid plane transform for pure noncommutative affine examples."""

    def __init__(self, angle=0, x=0, y=0):
        self.angle, self.x, self.y = angle, x, y

    def __matmul__(self, other):
        return Pose2D(
            self.angle + other.angle,
            self.x + math.cos(self.angle) * other.x - math.sin(self.angle) * other.y,
            self.y + math.sin(self.angle) * other.x + math.cos(self.angle) * other.y,
        )

    def inverted(self):
        return Pose2D(
            -self.angle,
            -math.cos(self.angle) * self.x - math.sin(self.angle) * self.y,
            math.sin(self.angle) * self.x - math.cos(self.angle) * self.y,
        )


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

    def test_reparented_channels_preserve_original_fk_world_point_and_direction(self):
        rest_root, rest_thigh, rest_foot = Pose2D(0.23, 0.3, -0.1), Pose2D(-0.12, 0.4, 0.6), Pose2D(-0.7, 0.4, 0.32)
        root_motion = Pose2D(0.13, 1, 0.2)
        posed_root = root_motion @ rest_root
        for angle in (-0.23, 0, 0.23):
            posed_thigh = root_motion @ rest_thigh @ Pose2D(angle)
            requested = Pose2D(-0.4 * angle)
            result = FOOT_BASIS(rest_foot, rest_thigh, posed_thigh, rest_root, posed_root, requested)
            actual = posed_root @ rest_root.inverted() @ rest_foot @ result
            # Independently rotate the rest foot offset around the posed thigh
            # hinge, then add the requested foot direction.
            dx, dy = rest_foot.x - rest_thigh.x, rest_foot.y - rest_thigh.y
            rotation = posed_thigh.angle - rest_thigh.angle
            expected_x = posed_thigh.x + math.cos(rotation) * dx - math.sin(rotation) * dy
            expected_y = posed_thigh.y + math.sin(rotation) * dx + math.cos(rotation) * dy
            expected_angle = posed_thigh.angle - rest_thigh.angle + rest_foot.angle + requested.angle
            self.assertAlmostEqual(actual.x, expected_x, places=12)
            self.assertAlmostEqual(actual.y, expected_y, places=12)
            self.assertAlmostEqual(actual.angle, expected_angle, places=12)

    def test_no_motion_keeps_identity_foot_channels_despite_nontrivial_rest_bases(self):
        root, thigh, foot = Pose2D(1.2, 0.2, 0.3), Pose2D(-0.4, 0.3, 0.63), Pose2D(-0.74, 0.3, 0.35)
        result = FOOT_BASIS(foot, thigh, thigh, root, root, Pose2D())
        self.assertAlmostEqual(result.angle, 0)
        self.assertAlmostEqual(result.x, 0)
        self.assertAlmostEqual(result.y, 0)

    def test_invalid_phase_and_length_fail_instead_of_guessing_ground_offset(self):
        for pulse, length in ((math.nan, 0.28), (1.1, 0.28), (-0.1, 0.28), (0.5, 0), (0.5, math.inf)):
            with self.subTest(pulse=pulse, length=length), self.assertRaises(ValueError):
                SIT(pulse, length)


if __name__ == "__main__":
    unittest.main()
