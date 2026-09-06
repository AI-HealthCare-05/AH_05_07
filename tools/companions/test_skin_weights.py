"""Regression invariants for authored skin, without importing Blender or data tools."""

import ast
import math
import unittest
from pathlib import Path


def load_weights():
    # Execute only the pure weighting function: importing build.py requires Blender.
    tree = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "skin_weights")
    namespace = {}
    exec(compile(ast.Module(body=[function], type_ignores=[]), "skin_weights", "exec"), namespace)
    return namespace["skin_weights"]


class SkinWeightsTests(unittest.TestCase):
    def setUp(self):
        self.weights = load_weights()

    def test_normalized_nonnegative_at_most_four_influences(self):
        for x in (-0.6, -0.3, -0.1, -0.001, 0, 0.001, 0.1, 0.3, 0.6):
            for i in range(291):
                weights = self.weights((x, 0, i / 100))
                self.assertAlmostEqual(sum(weights.values()), 1)
                self.assertTrue(all(math.isfinite(v) and 0 <= v <= 1 for v in weights.values()))
                self.assertLessEqual(sum(v > 0 for v in weights.values()), 4)

    def test_no_weight_jump_across_hip_or_ankle_boundaries(self):
        for x in (-0.3, -0.1, 0, 0.1, 0.3):
            for z in (0.22, 0.26, 0.42, 0.60, 0.70, 0.84, 1.30, 1.45, 1.85):
                before = self.weights((x, 0, z - 1e-6))
                after = self.weights((x, 0, z + 1e-6))
                self.assertLess(
                    sum(abs(before.get(k, 0) - after.get(k, 0)) for k in before.keys() | after.keys()), 1e-4
                )

    def test_opposite_leg_motion_does_not_split_centerline(self):
        for z in (0.2, 0.35, 0.50, 0.59, 0.60, 0.7):
            positions = []
            for x in (-1e-6, 1e-6):
                weights = self.weights((x, 0, z))
                # Opposing synthetic translations stress left/right skin assignment.
                delta = sum(
                    v * (0.2 if k.endswith(".L") else -0.2 if k.endswith(".R") else 0) for k, v in weights.items()
                )
                positions.append(x + delta)
            self.assertLess(abs(positions[1] - positions[0]), 1e-4)


if __name__ == "__main__":
    unittest.main()
