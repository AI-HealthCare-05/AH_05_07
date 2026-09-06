"""Test actual penguin mesh construction without Blender or rendering.

Analytic overlap and closed winding do not replace remesh, animation or visual QA.
"""

import ast
import math
import unittest
from collections import Counter
from pathlib import Path

from test_face_geometry import signed_volume
from test_marking_boundaries import G as MARKINGS


def geometry():
    tree = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    names = {
        "closed_taper",
        "penguin_beak",
        "penguin_tail",
        "penguin_tail_weights",
        "coat_profiles",
        "profile_front_y",
        "coat_front_y",
        "fixed",
    }
    nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
    made = []

    def mesh(name, vertices, faces, material):
        obj = {"name": name, "vertices": vertices, "faces": faces, "material": material}
        made.append(obj)
        return obj

    def bind(obj, _rig, weights):
        obj["weights"] = [
            weights(type("Coordinate", (), dict(zip(("x", "y", "z"), point, strict=True)))())
            for point in obj["vertices"]
        ]

    namespace = {"math": math, "mesh": mesh, "bind": bind}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:penguin_geometry", "exec"), namespace)
    # Execute the actual character face/tail dispatch. Mesh adapters only collect
    # inputs for unrelated mammalian paths, while the two penguin meshes are real.
    character = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "character")
    start = next(
        i
        for i, n in enumerate(character.body)
        if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "muzzle_width" for t in n.targets)
    )
    end = next(
        i for i, n in enumerate(character.body) if isinstance(n, ast.If) and ast.unparse(n.test) == "kind == 'hedgehog'"
    )
    dispatch = ast.FunctionDef(
        name="dispatch",
        args=ast.arguments(posonlyargs=[], args=[ast.arg(arg="kind")], kwonlyargs=[], kw_defaults=[], defaults=[]),
        body=character.body[start:end],
        decorator_list=[],
    )
    namespace.update(
        {
            "rig": None,
            "base": "coat",
            "dark": "dark",
            "cream": "cream",
            "inner": "inner",
            "surface": lambda name, *_args, **_kwargs: mesh(name, [(0, 0, 0)], [], None),
            "tube": lambda name, points, *_args, **_kwargs: mesh(name, points, [], None),
            "warp_face": lambda *_args: None,
            "material": lambda name, color: (name, color),
            "capybara_face": lambda *_args: mesh("Capybara blunt rostrum", [(0, 0, 0)], [], None),
        }
    )
    exec(
        compile(
            ast.fix_missing_locations(ast.Module(body=[dispatch], type_ignores=[])),
            "build.py:face_tail_dispatch",
            "exec",
        ),
        namespace,
    )
    return namespace, made


class PenguinGeometryTests(unittest.TestCase):
    def test_bill_and_tail_are_closed_consistently_wound_positive_volume_meshes(self):
        g, _ = geometry()
        for name in ("penguin_beak", "penguin_tail"):
            with self.subTest(name=name):
                obj = g[name](None)
                vertices, faces = obj["vertices"], obj["faces"]
                self.assertTrue(all(math.isfinite(value) for point in vertices for value in point))
                self.assertGreater(signed_volume(vertices, faces), 0)
                edges, directions = Counter(), Counter()
                for face in faces:
                    self.assertEqual(len(set(face)), len(face))
                    for a, b in zip(face, (*face[1:], face[0]), strict=True):
                        edge = tuple(sorted((a, b)))
                        edges[edge] += 1
                        directions[edge] += 1 if a < b else -1
                    a, b, c = (vertices[i] for i in face[:3])
                    ab, ac = tuple(b[i] - a[i] for i in range(3)), tuple(c[i] - a[i] for i in range(3))
                    cross = (
                        ab[1] * ac[2] - ab[2] * ac[1],
                        ab[2] * ac[0] - ab[0] * ac[2],
                        ab[0] * ac[1] - ab[1] * ac[0],
                    )
                    self.assertGreater(sum(value * value for value in cross), 1e-14)
                self.assertTrue(all(count == 2 for count in edges.values()))
                self.assertTrue(all(direction == 0 for direction in directions.values()))

    def test_bill_base_embeds_in_cranium_and_visible_tip_stays_below_eyes(self):
        g, _ = geometry()
        vertices = g["penguin_beak"](None)["vertices"]
        for x, y, z in vertices[1:25]:
            self.assertAlmostEqual(y - g["coat_front_y"]("penguin", x, z), 0.06)
        tip = vertices[-1]
        self.assertLess(tip[1], g["coat_front_y"]("penguin", tip[0], tip[2]) - 0.20)
        self.assertLess(max(point[2] for point in vertices), 2.25)
        self.assertGreater(min(point[2] for point in vertices), 2.0)
        # Cross sections taper toward the front instead of forming a nose ball.
        widths = [max(abs(p[0]) for p in vertices[1 + i * 24 : 1 + (i + 1) * 24]) for i in range(4)]
        self.assertTrue(all(a > b for a, b in zip(widths[:-1], widths[1:], strict=True)))

    def test_short_tail_base_embeds_in_torso_and_tapers_above_ground(self):
        g, _ = geometry()
        vertices = g["penguin_tail"](None)["vertices"]
        body = g["coat_profiles"]("penguin")[0]
        for x, y, z in vertices[1:25]:
            back = 2 * body[0][1] - g["profile_front_y"](x, z, *body)
            self.assertAlmostEqual(back - y, 0.06)
        self.assertLess(max(p[2] for p in vertices), 0.65)
        self.assertGreater(min(p[2] for p in vertices), 0.40)
        self.assertLess(max(p[1] for p in vertices), 0.80)
        widths = [max(abs(p[0]) for p in vertices[1 + i * 24 : 1 + (i + 1) * 24]) for i in range(3)]
        self.assertTrue(all(a > b for a, b in zip(widths[:-1], widths[1:], strict=True)))

    def test_actual_penguin_dispatch_excludes_mammal_muzzle_and_smile_and_retains_skin_controls(self):
        g, made = geometry()
        g["dispatch"]("penguin")
        self.assertEqual([o["name"] for o in made], ["Penguin attached bill", "Penguin short tail"])
        self.assertTrue(all(weights == {"head": 1.0} for weights in made[0]["weights"]))
        for weights in made[1]["weights"]:
            self.assertEqual(set(weights), {"tail.01", "tail.02"})
            self.assertAlmostEqual(sum(weights.values()), 1)
            self.assertTrue(all(0 <= value <= 1 for value in weights.values()))

    def test_other_species_keep_existing_face_and_tail_dispatch(self):
        for kind in ("bear", "rabbit", "cat", "dog", "red_panda", "otter", "seal", "fox", "squirrel"):
            with self.subTest(kind=kind):
                g, made = geometry()
                g["dispatch"](kind)
                names = [obj["name"] for obj in made]
                self.assertIn("Sculpted muzzle", names)
                self.assertEqual(names.count("Quiet smile"), 2)
                self.assertIn("Species tail", names)
                self.assertFalse(any(name.startswith("Penguin ") for name in names))
        g, made = geometry()
        g["dispatch"]("capybara")
        self.assertEqual([o["name"] for o in made], ["Capybara blunt rostrum"])

    def test_broad_chest_outline_stays_on_supported_skin_and_eye_surrounds_stay_fixed(self):
        outlines = MARKINGS["coat_marking_outlines"]("penguin")
        chest = outlines[0]
        # Test the expanded actual material contour in unwarped coordinates.
        xs, zs = [p[0] / 0.89 for p in chest], [p[1] / 0.95 for p in chest]
        self.assertGreater(max(xs) - min(xs), 0.60)
        self.assertGreater(max(zs) - min(zs), 1.0)
        for x, z in zip(xs, zs, strict=True):
            self.assertTrue(math.isfinite(MARKINGS["coat_front_y"]("penguin", x, z)))
        expected = [
            MARKINGS["marking_outline"]((sign * 0.25, -0.452, 2.22), (0.20, 0.050, 0.275), scale=(0.89, 0.95))
            for sign in (-1, 1)
        ]
        self.assertEqual(outlines[1:], expected)


if __name__ == "__main__":
    unittest.main()
