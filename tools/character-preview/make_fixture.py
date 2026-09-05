"""Create a tiny synthetic two-bone GLB; never a completed animal or visual-quality result."""

import argparse
import json
import math
import struct
from pathlib import Path

NAMES = [
    ("bear", "곰"),
    ("rabbit", "토끼"),
    ("cat", "고양이"),
    ("dog", "강아지"),
    ("red-panda", "레서판다"),
    ("otter", "수달"),
    ("capybara", "카피바라"),
    ("hedgehog", "고슴도치"),
    ("penguin", "펭귄"),
    ("seal", "물범"),
    ("fox", "여우"),
    ("squirrel", "다람쥐"),
]
CLIPS = ("idle", "greet", "move", "curious", "celebrate", "rest", "special")


def make_fixture(output):
    output.mkdir(parents=True, exist_ok=False)
    blob = bytearray()
    views, accessors = [], []

    def accessor(values, fmt, kind, count, minimum=None, maximum=None):
        while len(blob) % 4:
            blob.append(0)
        raw = struct.pack("<" + fmt * len(values), *values)
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(raw)})
        blob.extend(raw)
        item = {
            "bufferView": len(views) - 1,
            "componentType": 5126 if fmt == "f" else 5123,
            "count": count,
            "type": kind,
        }
        if minimum is not None:
            item.update(min=minimum, max=maximum)
        accessors.append(item)
        return len(accessors) - 1

    vertices = [
        -0.5,
        0,
        -0.4,
        0.5,
        0,
        -0.4,
        0.5,
        2,
        -0.4,
        -0.5,
        2,
        -0.4,
        -0.5,
        0,
        0.4,
        0.5,
        0,
        0.4,
        0.5,
        2,
        0.4,
        -0.5,
        2,
        0.4,
    ]
    pos = accessor(vertices, "f", "VEC3", 8, [-0.5, 0, -0.4], [0.5, 2, 0.4])
    indices = accessor(
        [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3],
        "H",
        "SCALAR",
        36,
    )
    joints = accessor([value for v in range(8) for value in [1 if v in (2, 3, 6, 7) else 0, 0, 0, 0]], "H", "VEC4", 8)
    weights = accessor([1, 0, 0, 0] * 8, "f", "VEC4", 8)
    identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    inverse = identity.copy()
    inverse[13] = -1
    bind = accessor(identity + inverse, "f", "MAT4", 2)
    times = accessor([0, 0.5, 1, 1.5, 2], "f", "SCALAR", 5, [0], [2])
    rotations = accessor(
        [value for angle in [0, 0.3, 0, -0.3, 0] for value in [0, 0, math.sin(angle / 2), math.cos(angle / 2)]],
        "f",
        "VEC4",
        5,
    )
    document = {
        "asset": {"version": "2.0", "generator": "SK7 TEMPORARY SYNTHETIC FIXTURE"},
        "scene": 0,
        "scenes": [{"nodes": [0, 2]}],
        "nodes": [
            {"name": "fixture-root", "children": [1]},
            {"name": "fixture-joint", "translation": [0, 1, 0]},
            {"name": "temporary-block", "mesh": 0, "skin": 0},
        ],
        "skins": [{"inverseBindMatrices": bind, "joints": [0, 1]}],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": pos, "JOINTS_0": joints, "WEIGHTS_0": weights},
                        "indices": indices,
                        "material": 0,
                    }
                ]
            }
        ],
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.3, 0.55, 0.35, 1],
                    "metallicFactor": 0,
                    "roughnessFactor": 1,
                },
                "doubleSided": True,
            }
        ],
        "animations": [
            {
                "name": name,
                "samplers": [{"input": times, "output": rotations, "interpolation": "LINEAR"}],
                "channels": [{"sampler": 0, "target": {"node": 1, "path": "rotation"}}],
            }
            for name in CLIPS
        ],
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": views,
        "accessors": accessors,
    }
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    blob += b"\0" * (-len(blob) % 4)
    glb = (
        struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(blob))
        + struct.pack("<II", len(encoded), 0x4E4F534A)
        + encoded
        + struct.pack("<II", len(blob), 0x004E4942)
        + blob
    )
    (output / "temporary.glb").write_bytes(glb)
    animals = [
        {
            "id": key,
            "name": name,
            "status": "temporary_fixture" if index == 0 else "pending",
            "motion": "in_place",
            "hero": None,
            "standard": "temporary.glb" if index == 0 else None,
            "light": "temporary.glb" if index == 0 else None,
            "note": "임시 두 뼈대 합성 블록입니다. 실제 동물·품질 통과 수량이 아닙니다.",
        }
        for index, (key, name) in enumerate(NAMES)
    ]
    (output / "catalog.json").write_text(
        json.dumps(
            {"schema_version": 1, "source_commit": "synthetic_fixture_only", "animals": animals},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print("Temporary fixture created; completed animals: 0")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    make_fixture(args.output)
