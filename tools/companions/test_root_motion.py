"""Exercise authored rest transforms and animation channels without Blender/export."""

import ast
import math
import unittest
from pathlib import Path
from types import SimpleNamespace


class Vector(list):
    x = property(lambda self: self[0], lambda self, value: self.__setitem__(0, value))
    y = property(lambda self: self[1], lambda self, value: self.__setitem__(1, value))
    z = property(lambda self: self[2], lambda self, value: self.__setitem__(2, value))


class Bone:
    def __init__(self, name, record):
        self.name, self.record = name, record

    def __setattr__(self, key, value):
        if key in ("head", "tail", "location", "rotation_euler", "scale"):
            value = Vector(value)
        super().__setattr__(key, value)

    def keyframe_insert(self, path, frame, group):
        self.record(self.name, path, frame, tuple(getattr(self, path)))


class Bones(dict):
    def __init__(self, record):
        super().__init__()
        self.record = record

    def __iter__(self):
        return iter(self.values())

    def new(self, name):
        self[name] = Bone(name, self.record)
        return self[name]


def authoring_fixture():
    """Stub storage/keyframe insertion only; execute the three real authoring functions."""
    rig = SimpleNamespace()
    tracks, actions, modes, objects = {}, {}, [], []

    def record(name, path, frame, value):
        tracks.setdefault(rig.animation_data.action.name, {}).setdefault((name, path), {})[frame] = value

    bones = Bones(record)
    rig.data = SimpleNamespace(edit_bones=bones)
    rig.pose = SimpleNamespace(bones=bones)
    rig.select_set = lambda selected: None
    rig.animation_data = SimpleNamespace(action=None)
    rig.animation_data_create = lambda: None

    def action_new(name):
        actions[name] = SimpleNamespace(name=name, slots=[])
        return actions[name]

    class Actions(dict):
        new = staticmethod(action_new)

        def __getitem__(self, name):
            return actions[name]

    bpy = SimpleNamespace(
        data=SimpleNamespace(
            armatures=SimpleNamespace(new=lambda name: rig.data),
            objects=SimpleNamespace(new=lambda name, data: rig),
            actions=Actions(),
        ),
        context=SimpleNamespace(
            collection=SimpleNamespace(objects=SimpleNamespace(link=lambda obj: None)),
            view_layer=SimpleNamespace(objects=SimpleNamespace(active=None)),
            scene=SimpleNamespace(objects=objects, frame_set=lambda frame: None),
        ),
        ops=SimpleNamespace(object=SimpleNamespace(mode_set=lambda mode: modes.append(mode))),
    )
    source = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    functions = {"rig_create", "species_proportions", "animate", "special_pose"}
    nodes = [
        node
        for node in source.body
        if isinstance(node, ast.FunctionDef)
        and node.name in functions
        or isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "CLIPS" for target in node.targets)
    ]
    namespace = {"bpy": bpy, "math": math}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:root_motion", "exec"), namespace)
    namespace["rig_create"]()
    return namespace, rig, tracks, objects, modes


def local_y_world_axis(root):
    # Blender bone local Y runs from head to tail. Roll does not change that axis.
    axis = [end - start for start, end in zip(root.head, root.tail, strict=True)]
    length = math.sqrt(sum(value * value for value in axis))
    return [value / length for value in axis]


class RootMotionTests(unittest.TestCase):
    def test_seal_authored_bounce_has_no_horizontal_displacement_after_shape_warp(self):
        namespace, rig, tracks, _, _ = authoring_fixture()
        root = rig.data.edit_bones["root"]
        namespace["species_proportions"](rig, "seal")
        namespace["animate"](rig, "seal")
        axis = local_y_world_axis(root)
        for clip, expected_height in (("move", 0.09), ("celebrate", 0.16)):
            locations = tracks[clip][("root", "location")]
            self.assertEqual(len(locations), 25)
            self.assertAlmostEqual(max(value[1] for value in locations.values()), expected_height)
            for frame, value in locations.items():
                with self.subTest(clip=clip, frame=frame):
                    self.assertEqual((value[0], value[2]), (0, 0))
                    self.assertEqual(tracks[clip][("root", "rotation_euler")][frame], (0, 0, 0))
                    delta = [component * value[1] for component in axis]
                    self.assertAlmostEqual(math.hypot(delta[0], delta[1]), 0, places=12)
                    self.assertAlmostEqual(delta[2], value[1], places=12)
        self.assertEqual(root.head, [0, 0, 0])
        self.assertEqual(root.tail, [0, 0, 0.25])

    def test_seal_mesh_and_non_root_anatomy_still_receive_the_existing_shape_warp(self):
        namespace, rig, _, objects, modes = authoring_fixture()
        sample = (0.5, 0.2, 0.9)
        vertex = SimpleNamespace(co=sample)
        foreign = SimpleNamespace(co=sample)
        objects.extend(
            [
                SimpleNamespace(type="MESH", parent=rig, data=SimpleNamespace(vertices=[vertex])),
                SimpleNamespace(type="MESH", parent=None, data=SimpleNamespace(vertices=[foreign])),
            ]
        )
        bone = rig.data.edit_bones["spine"]
        bone.head, bone.tail = sample, (0, 0, 1.8)
        namespace["species_proportions"](rig, "seal")
        for actual in (vertex.co, bone.head):
            for value, expected in zip(actual, (0.54, 0.46, 0.576), strict=True):
                self.assertAlmostEqual(value, expected)
        for value, expected in zip(bone.tail, (0, 0, 1.152), strict=True):
            self.assertAlmostEqual(value, expected)
        self.assertEqual(foreign.co, sample)
        self.assertEqual(modes[-2:], ["EDIT", "OBJECT"])

    def test_other_species_keep_their_root_scaling_and_vertical_axis(self):
        scales = {"rabbit": 1.05, "otter": 0.98, "capybara": 0.87, "hedgehog": 0.81, "penguin": 0.95}
        for kind in (
            "bear",
            "rabbit",
            "cat",
            "dog",
            "red_panda",
            "otter",
            "capybara",
            "hedgehog",
            "penguin",
            "fox",
            "squirrel",
        ):
            with self.subTest(kind=kind):
                namespace, rig, _, _, _ = authoring_fixture()
                namespace["species_proportions"](rig, kind)
                root = rig.data.edit_bones["root"]
                self.assertEqual(root.head, [0, 0, 0])
                self.assertEqual(root.tail, [0, 0, 0.25 * scales.get(kind, 1)])
                self.assertEqual(local_y_world_axis(root), [0, 0, 1])


if __name__ == "__main__":
    unittest.main()
