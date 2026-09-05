"""Fresh Blender GLB import, skeletal/geometry audit and visual review renders."""

import argparse
import hashlib
import json
import math
import struct
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from build import CLIPS, studio  # noqa: E402

VIEWS = {
    "front": (0, -7, 2.1),
    "side": (7, 0, 2.1),
    "back": (0, 7, 2.1),
    "hero": (4.4, -7, 3.0),
}


def parse_views(value):
    names = tuple(name.strip() for name in value.split(","))
    if not names or len(set(names)) != len(names) or any(name not in VIEWS for name in names):
        raise argparse.ArgumentTypeError("Use unique comma-separated front,side,back,hero view names")
    return names


def render_png(scene, path, audit, view, clip=None):
    if path.exists():
        raise FileExistsError("Review output already exists; use --output with a new directory")
    scene.render.filepath = str(path)
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    payload = path.read_bytes()
    assert payload[:8] == b"\x89PNG\r\n\x1a\n" and payload[12:16] == b"IHDR", "Expected a PNG render"
    width, height = struct.unpack_from(">II", payload, 16)
    audit["renders"].append(
        {
            "file": path.name,
            "sha256": hashlib.sha256(payload).hexdigest(),
            "dimensions": [width, height],
            "view": view,
            "clip": clip,
            "frame": scene.frame_current,
            "engine": scene.render.engine,
        }
    )


def main():  # noqa: C901 - sequential Blender import, deformation and render checks
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", type=Path, required=True)
    parser.add_argument("--variant", choices=("standard", "light"), default="standard")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--poses", action="store_true")
    parser.add_argument("--clip", choices=CLIPS)
    parser.add_argument("--engine", choices=("CYCLES", "BLENDER_EEVEE_NEXT"), default="CYCLES")
    parser.add_argument("--output", type=Path, help="New external directory for review PNGs and JSON; must not exist")
    parser.add_argument(
        "--views", type=parse_views, help="Comma-separated views for --render; default front,side,back,hero"
    )
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    if args.views is not None and not args.render:
        parser.error("--views requires --render")
    selected_views = args.views if args.views is not None else tuple(VIEWS)
    repository = Path(__file__).resolve().parents[2]
    args.asset = args.asset.resolve()
    output = args.output.resolve() if args.output is not None else args.asset
    if output.is_relative_to(repository) or repository.is_relative_to(output):
        parser.error("Review output must be outside the repository and cannot be its ancestor")
    if args.output is not None and output.exists():
        parser.error("--output must be a new directory; existing review results are preserved")
    planned = [output / f"{args.variant}-reimport-check.json"]
    if args.render:
        planned.extend(output / f"{args.variant}-{view}.png" for view in selected_views)
    if args.poses:
        planned.extend(
            output / f"{args.variant}-{clip}-{label}.png"
            for clip in CLIPS
            if args.clip is None or args.clip == clip
            for label in ("quarter", "mid")
        )
    if any(path.exists() for path in planned):
        parser.error("A planned PNG or report already exists; use --output with a new directory")
    input_path = args.asset / (args.variant + ".glb")
    input_hash = hashlib.sha256(input_path.read_bytes()).hexdigest()
    review_bytes = Path(__file__).read_bytes()
    studio_bytes = Path(__file__).with_name("build.py").read_bytes()
    source_commit = (
        subprocess.run(["git", "-C", str(repository), "rev-parse", "HEAD"], capture_output=True, check=True, timeout=30)
        .stdout.decode("ascii")
        .strip()
    )
    committed_review = subprocess.run(
        ["git", "-C", str(repository), "cat-file", "blob", f"{source_commit}:tools/companions/review.py"],
        capture_output=True,
        check=True,
        timeout=30,
    ).stdout
    if args.output is not None:
        output.mkdir()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(input_path))
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
        "input_glb_sha256": input_hash,
        "review_script_sha256": hashlib.sha256(review_bytes).hexdigest(),
        "studio_script_sha256": hashlib.sha256(studio_bytes).hexdigest(),
        "source_commit": source_commit,
        "review_source_matches_commit": review_bytes == committed_review,
        "blender_version": bpy.app.version_string,
        "engine": args.engine,
        "selected_views": list(selected_views) if args.render else [],
        "pose_view": "hero" if args.poses else None,
        "renders": [],
        "rigs": len(rigs),
        "bones": len(rig.data.bones),
        "meshes": len(objects),
        "materials": len({mat.name for obj in objects for mat in obj.data.materials}),
        "clips": {},
        "human_review": "pending",
    }
    studio()
    scene = bpy.context.scene
    scene.render.engine = args.engine
    scene.render.resolution_x, scene.render.resolution_y = 900, 1050
    scene.cycles.samples = 16
    camera = scene.camera
    camera.location = (4.4, -7, 3.0)
    camera.rotation_euler = (Vector((0, 0.08, 1.60)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
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
                render_png(scene, output / f"{args.variant}-{clip}-{label}.png", audit, "hero", clip)
    rig.animation_data.action = actions["idle"]
    rig.animation_data.action_slot = actions["idle"].slots[0]
    scene.frame_set(1)
    if args.render:
        scene.render.resolution_x, scene.render.resolution_y = 1600, 1800
        scene.cycles.samples = 24
        scene.render.resolution_percentage = 100
        for name in selected_views:
            camera.location = VIEWS[name]
            camera.rotation_euler = (Vector((0, 0.08, 1.60)) - camera.location).to_track_quat("-Z", "Y").to_euler()
            bpy.context.view_layer.update()
            render_png(scene, output / f"{args.variant}-{name}.png", audit, name, "idle")
    assert hashlib.sha256(input_path.read_bytes()).hexdigest() == input_hash, "Input GLB changed during review"
    assert Path(__file__).read_bytes() == review_bytes, "Review source changed during execution"
    assert Path(__file__).with_name("build.py").read_bytes() == studio_bytes, "Studio source changed during execution"
    audit["input_glb_unchanged"] = True
    with (output / f"{args.variant}-reimport-check.json").open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(audit, allow_nan=False, indent=2) + "\n")
    print("SK7_FRESH_IMPORT_PASS", json.dumps(audit))


if __name__ == "__main__":
    main()
