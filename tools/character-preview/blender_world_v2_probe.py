"""Blender-side structural probe for World v2 companion editable reimport."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy

EXPECTED_ACTIONS = {
    "celebrate",
    "curious",
    "greet",
    "idle",
    "move",
    "rest",
    "special",
}


def structural_state() -> dict:
    objects = list(bpy.context.scene.objects)

    meshes = [obj for obj in objects if obj.type == "MESH"]

    armatures = [obj for obj in objects if obj.type == "ARMATURE"]

    actions = sorted(action.name for action in bpy.data.actions)

    materials = sorted(material.name for material in bpy.data.materials)

    bones = sum(len(obj.data.bones) for obj in armatures)

    mesh_vertices = sum(len(obj.data.vertices) for obj in meshes)

    mesh_polygons = sum(len(obj.data.polygons) for obj in meshes)

    return {
        "blenderVersion": bpy.app.version_string,
        "objects": len(objects),
        "meshes": len(meshes),
        "armatures": len(armatures),
        "bones": bones,
        "actions": actions,
        "materials": materials,
        "meshVertices": mesh_vertices,
        "meshPolygons": mesh_polygons,
    }


def validate(state: dict) -> None:
    if state["meshes"] <= 0:
        raise RuntimeError("no mesh after Blender import/reopen")

    if state["armatures"] != 1:
        raise RuntimeError(f"expected one armature, got {state['armatures']}")

    if state["bones"] <= 0:
        raise RuntimeError("armature contains no bones")

    if state["meshVertices"] <= 0:
        raise RuntimeError("imported meshes contain no vertices")

    if state["meshPolygons"] <= 0:
        raise RuntimeError("imported meshes contain no polygons")

    missing = sorted(EXPECTED_ACTIONS - set(state["actions"]))

    if missing:
        raise RuntimeError(f"missing expected actions: {missing}")


def import_mode(
    glb: Path,
    blend: Path,
    report: Path,
) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    result = bpy.ops.import_scene.gltf(filepath=str(glb))

    if "FINISHED" not in result:
        raise RuntimeError(f"glTF import did not finish: {sorted(result)}")

    state = structural_state()
    validate(state)

    bpy.ops.wm.save_as_mainfile(filepath=str(blend))

    state["mode"] = "import-and-save"
    state["blendSaved"] = True

    report.write_text(
        json.dumps(
            state,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        "SK7_BLEND_IMPORT="
        + json.dumps(
            state,
            sort_keys=True,
        )
    )


def reopen_mode(
    report: Path,
) -> None:
    state = structural_state()
    validate(state)

    state["mode"] = "reopen"

    report.write_text(
        json.dumps(
            state,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        "SK7_BLEND_REOPEN="
        + json.dumps(
            state,
            sort_keys=True,
        )
    )


def main() -> int:
    args = sys.argv[sys.argv.index("--") + 1 :]

    if not args:
        raise RuntimeError("probe mode is required")

    mode = args[0]

    if mode == "import":
        if len(args) != 4:
            raise RuntimeError("import mode requires GLB BLEND REPORT")

        import_mode(
            Path(args[1]),
            Path(args[2]),
            Path(args[3]),
        )

        return 0

    if mode == "reopen":
        if len(args) != 2:
            raise RuntimeError("reopen mode requires REPORT")

        reopen_mode(Path(args[1]))

        return 0

    raise RuntimeError(f"unknown probe mode: {mode}")


if __name__ == "__main__":
    raise SystemExit(main())
