"""Regression for decimated joint unions; the existing post-cut guard stays strict."""

import ast
import math
import unittest
from pathlib import Path


def load_limiter():
    source = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    nodes = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name == "limited_skin_weights"]
    namespace = {"math": math}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:skin_limit", "exec"), namespace)
    return namespace["limited_skin_weights"]


LIMIT = load_limiter()


class SkinLimitTests(unittest.TestCase):
    def test_midpoint_of_valid_neighbors_can_need_five_joints_and_is_explicitly_limited(self):
        left, right = {0: 0.5, 1: 0.3, 2: 0.2}, {0: 0.4, 3: 0.4, 4: 0.2}
        merged = {joint: (left.get(joint, 0) + right.get(joint, 0)) / 2 for joint in left.keys() | right.keys()}
        self.assertEqual(len(merged), 5)
        limited, discarded = LIMIT(merged)
        self.assertEqual(set(limited), {0, 1, 2, 3})
        self.assertAlmostEqual(discarded, 0.1)
        self.assertAlmostEqual(limited[0], 0.5)
        self.assertAlmostEqual(limited[1], 1 / 6)
        self.assertAlmostEqual(limited[2], 1 / 9)
        self.assertAlmostEqual(limited[3], 2 / 9)
        self.assertAlmostEqual(sum(limited.values()), 1)

    def test_small_fifth_weight_is_removed_with_reported_mass_not_hidden(self):
        old = {0: 0.7493, 1: 0.1, 2: 0.09, 3: 0.06, 4: 0.0007}
        limited, discarded = LIMIT(old)
        self.assertEqual(len(limited), 4)
        self.assertAlmostEqual(discarded, 0.0007)
        for joint in limited:
            self.assertAlmostEqual(limited[joint] / limited[0], old[joint] / old[0])
        # For translations bounded by one unit, the weight L1 change bounds the
        # skin displacement; report the discarded mass instead of claiming zero change.
        change = sum(abs(old.get(joint, 0) - limited.get(joint, 0)) for joint in old)
        self.assertAlmostEqual(change, 2 * discarded)

    def test_already_valid_weights_remain_exact_and_second_application_changes_nothing(self):
        for weights in ({0: 1.0}, {5: 0.4, 7: 0.6}, {3: 0.2, 1: 0.3, 7: 0.5, 9: 0.0}):
            result, discarded = LIMIT(weights)
            self.assertEqual(result, weights)
            self.assertEqual(discarded, 0)
        first, _ = LIMIT(dict.fromkeys(range(5), 0.2))
        second, discarded = LIMIT(first)
        self.assertEqual(first, second)
        self.assertEqual(discarded, 0)

    def test_equal_weights_use_joint_index_tie_breaking_independent_of_mapping_order(self):
        a = LIMIT({4: 0.2, 3: 0.2, 2: 0.2, 1: 0.2, 0: 0.2})
        b = LIMIT(dict.fromkeys(range(5), 0.2))
        self.assertEqual(a, b)
        self.assertEqual(a[0], dict.fromkeys(range(4), 0.25))
        self.assertAlmostEqual(a[1], 0.2)

    def test_missing_nonfinite_negative_and_unnormalized_inputs_are_not_repaired(self):
        for weights in ({}, {0: 0.0}, {0: math.nan}, {0: math.inf}, {0: 1.1, 1: -0.1}, {0: 0.6, 1: 0.3}):
            with self.subTest(weights=weights), self.assertRaises(ValueError):
                LIMIT(weights)


if __name__ == "__main__":
    unittest.main()
