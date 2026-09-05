"""Fresh Blender GLB import, skeletal/geometry audit and visual review renders."""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from build import CLIPS, studio  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", type=Path, required=True)
    parser.add_argument("--variant", choices=("standard", "light"), default="standard")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--poses", action="store_true")
    parser.add_argument("--clip", choices=CLIPS)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(args.asset / (args.variant + ".glb")))
    rigs = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    assert len(rigs) == 1
    rig = rigs[0]
    actions = {action.name: action for action in bpy.data.actions}
    assert set(actions) == set(CLIPS), set(actions)
    # Blender's importer adds a hidden Icosphere bone-display widget, not a GLB mesh.
    widgets = {bone.custom_shape for bone in rig.pose.bones if bone.custom_shape}
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj not in widgets]
    assert all(obj.vertex_groups and any(mod.type == "ARMATURE" for mod in obj.modifiers) for obj in objects)
    assert all(all(math.isfinite(v) for v in vertex.co) for obj in objects for vertex in obj.data.vertices)
    assert all(obj.data.materials for obj in objects)
    audit = {
        "fresh_glb_import": True,
        "variant": args.variant,
        "rigs": len(rigs),
        "bones": len(rig.data.bones),
        "meshes": len(objects),
        "materials": len({mat.name for obj in objects for mat in obj.data.materials}),
        "clips": {},
        "human_review": "pending",
    }
    studio()
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = 900, 1050
    scene.cycles.samples = 16
    camera = scene.camera
    camera.location = (4.4, -7, 3.0)
    camera.rotation_euler = (Vector((0, 0.08, 1.60)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    for clip, action in actions.items():
        for track in rig.animation_data.nla_tracks:
            track.mute = True
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        start, end = [round(v) for v in action.frame_range]
        snapshots = []
        lowest = 100
        frames = [round(start + (end - start) * i / 12) for i in range(13)]
        for frame in frames:
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            snapshots.append([list(bone.matrix) for bone in rig.pose.bones])
            graph = bpy.context.evaluated_depsgraph_get()
            for obj in objects:
                evaluated = obj.evaluated_get(graph)
                coords = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
                assert all(all(math.isfinite(v) for v in co) for co in coords)
                lowest = min(lowest, min(co.z for co in coords))
        loop_delta = max(
            abs(a - b)
            for ma, mb in zip(snapshots[0], snapshots[-1], strict=True)
            for ra, rb in zip(ma, mb, strict=True)
            for a, b in zip(ra, rb, strict=True)
        )
        assert loop_delta < 1e-5, (clip, loop_delta)
        audit["clips"][clip] = {
            "frames": [start, end],
            "loop_matrix_max_delta": loop_delta,
            "finite_deformation_samples": len(frames),
            "sample_min_z": lowest,
        }
        if args.poses and (args.clip is None or args.clip == clip):
            for label, frame in (("quarter", round(start + (end - start) * 0.25)), ("mid", round((start + end) / 2))):
                scene.frame_set(frame)
                scene.render.resolution_percentage = 55
                scene.render.filepath = str(args.asset / f"{args.variant}-{clip}-{label}.png")
                bpy.ops.render.render(write_still=True)
    rig.animation_data.action = actions["idle"]
    rig.animation_data.action_slot = actions["idle"].slots[0]
    scene.frame_set(1)
    if args.render:
        scene.render.resolution_x, scene.render.resolution_y = 1600, 1800
        scene.cycles.samples = 24
        scene.render.resolution_percentage = 100
        for name, loc in (
            ("front", (0, -7, 2.1)),
            ("side", (7, 0, 2.1)),
            ("back", (0, 7, 2.1)),
            ("hero", (4.4, -7, 3.0)),
        ):
            camera.location = loc
            camera.rotation_euler = (Vector((0, 0.08, 1.60)) - camera.location).to_track_quat("-Z", "Y").to_euler()
            scene.render.filepath = str(args.asset / f"{args.variant}-{name}.png")
            bpy.ops.render.render(write_still=True)
    (args.asset / f"{args.variant}-reimport-check.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print("SK7_FRESH_IMPORT_PASS", json.dumps(audit))


if __name__ == "__main__":
    main()
