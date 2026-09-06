"""Mutated actual GLB bytes; synthetic graphics only, no Blender or model datasets."""

import copy
import hashlib
import json
import math
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from glb_audit import CLIPS, AuditError, audit_asset, audit_glb, load_json, write_report


def fixture(integer_weights=False):
    """One skinned triangle, two joints and seven four-second skeletal clips."""
    document = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0, 2]}],
        "nodes": [{"name": "root", "children": [1]}, {"name": "head"}, {"mesh": 0, "skin": 0}],
        "bufferViews": [],
        "accessors": [],
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.4, 0.2, 0.1, 1],
                    "roughnessFactor": 0.7,
                    "metallicFactor": 0,
                }
            }
        ],
    }
    binary, names = bytearray(), {}

    def accessor(name, rows, shape, component=5126, normalized=False):
        binary.extend(b"\0" * (-len(binary) % 4))
        offset = len(binary)
        code = {5126: "f", 5123: "H", 5121: "B"}[component]
        flat = [value for row in rows for value in row]
        binary.extend(struct.pack("<" + code * len(flat), *flat))
        view = len(document["bufferViews"])
        document["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(binary) - offset})
        index = len(document["accessors"])
        document["accessors"].append(
            {
                "bufferView": view,
                "componentType": component,
                "count": len(rows),
                "type": shape,
                "normalized": normalized,
            }
        )
        names[name] = index
        return index

    attributes = {
        "POSITION": accessor("positions", [(0, 0, 0), (1, 0, 0), (0, 1, 0)], "VEC3"),
        "NORMAL": accessor("normals", [(0, 0, 1)] * 3, "VEC3"),
        "JOINTS_0": accessor("joints", [(1, 0, 0, 0)] * 3, "VEC4", 5121),
        "WEIGHTS_0": accessor(
            "weights",
            [(255 if integer_weights else 1, 0, 0, 0)] * 3,
            "VEC4",
            5121 if integer_weights else 5126,
            integer_weights,
        ),
    }
    indices = accessor("indices", [(0,), (1,), (2,)], "SCALAR", 5123)
    identity = (1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
    inverse = accessor("inverse", [identity, identity], "MAT4")
    times = accessor("times", [(0,), (2,), (4,)], "SCALAR")
    output = accessor("motion", [(0, 0, 0), (0, 0.1, 0), (0, 0, 0)], "VEC3")
    document["skins"] = [{"joints": [0, 1], "inverseBindMatrices": inverse}]
    document["meshes"] = [{"primitives": [{"attributes": attributes, "indices": indices, "material": 0}]}]
    document["animations"] = [
        {
            "name": name,
            "channels": [{"sampler": 0, "target": {"node": 1, "path": "translation"}}],
            "samplers": [{"input": times, "output": output, "interpolation": "LINEAR"}],
        }
        for name in CLIPS
    ]
    document["buffers"] = [{"byteLength": len(binary)}]
    return document, binary, names


def pack(document, binary):
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    padded = bytes(binary) + b"\0" * (-len(binary) % 4)
    return (
        struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(padded))
        + struct.pack("<II", len(encoded), 0x4E4F534A)
        + encoded
        + struct.pack("<II", len(padded), 0x004E4942)
        + padded
    )


def change_binary(document, binary, index, values, code="f"):
    item = document["accessors"][index]
    start = document["bufferViews"][item["bufferView"]].get("byteOffset", 0) + item.get("byteOffset", 0)
    struct.pack_into("<" + code * len(values), binary, start, *values)


class BinaryAuditTests(unittest.TestCase):
    def setUp(self):
        self.document, self.binary, self.names = fixture()

    def reject(self, code):
        with self.assertRaisesRegex(AuditError, code):
            audit_glb(pack(self.document, self.binary))

    def test_embedded_skinned_fixture_and_normalized_integer_weights(self):
        for integer_weights in (False, True):
            document, binary, _ = fixture(integer_weights)
            result = audit_glb(pack(document, binary))
            self.assertEqual(result["geometry"]["triangles"], 1)
            self.assertEqual(result["geometry"]["weight_sum_max_error"], 0)
            self.assertEqual(set(result["clips"]), set(CLIPS))
            self.assertTrue(all(value["changing_non_root_deforming_joints"] == 1 for value in result["clips"].values()))

    def test_corrupt_glb_header_and_chunk_size(self):
        original = pack(self.document, self.binary)
        for offset, value, code in (
            (4, 1, "invalid_glb_header"),
            (8, len(original) - 4, "file_length_mismatch"),
            (12, len(original), "chunk_bounds"),
        ):
            corrupted = bytearray(original)
            struct.pack_into("<I", corrupted, offset, value)
            with self.subTest(offset=offset), self.assertRaisesRegex(AuditError, code):
                audit_glb(corrupted)
        with self.assertRaisesRegex(AuditError, "truncated_header"):
            audit_glb(original[:20])

    def test_view_and_accessor_bounds_are_checked_before_iteration(self):
        self.document["bufferViews"][0]["byteLength"] = len(self.binary) + 1
        self.reject("buffer_view_bounds")
        self.document, self.binary, self.names = fixture()
        self.document["accessors"][0]["count"] = 2**40
        self.reject("accessor_bounds")

    def test_misaligned_and_invalid_stride_rejected(self):
        self.document["accessors"][0]["byteOffset"] = 1
        self.reject("accessor_alignment")
        self.document["accessors"][0]["byteOffset"] = 0
        self.document["bufferViews"][0]["byteStride"] = 8
        self.reject("accessor_stride_too_small")

    def test_unused_nonfinite_accessor_is_not_ignored(self):
        self.document["bufferViews"].append({"buffer": 0, "byteOffset": len(self.binary), "byteLength": 4})
        self.document["accessors"].append(
            {"bufferView": len(self.document["bufferViews"]) - 1, "componentType": 5126, "count": 1, "type": "SCALAR"}
        )
        self.binary.extend(struct.pack("<f", math.nan))
        self.document["buffers"][0]["byteLength"] = len(self.binary)
        self.reject("nonfinite_accessor")

    def test_bad_skin_weights_rejected(self):
        for weights, code in (
            ((0, 0, 0, 0), "skin_weights_not_normalized"),
            ((-0.1, 1.1, 0, 0), "skin_weight_range"),
            ((math.inf, 0, 0, 0), "nonfinite_accessor"),
            ((math.nan, 0, 0, 0), "nonfinite_accessor"),
        ):
            with self.subTest(code=code):
                change_binary(self.document, self.binary, self.names["weights"], weights)
                self.reject(code)

    def test_even_zero_weight_joint_indices_must_reference_the_skin(self):
        change_binary(self.document, self.binary, self.names["joints"], (1, 9, 0, 0), "B")
        self.reject("invalid_reference")

    def test_non_normalized_integer_weights_and_missing_skin_are_rejected(self):
        self.document, self.binary, self.names = fixture(integer_weights=True)
        self.document["accessors"][self.names["weights"]]["normalized"] = False
        self.reject("integer_weights_must_be_normalized")
        self.document, self.binary, self.names = fixture()
        self.document["nodes"][2].pop("skin")
        self.reject("unreachable_or_unskinned_mesh")

    def test_vertex_and_inverse_bind_counts_must_match(self):
        self.document["accessors"][self.names["normals"]]["count"] = 2
        self.reject("vertex_attribute_count")
        self.document, self.binary, self.names = fixture()
        self.document["accessors"][self.names["inverse"]]["count"] = 1
        self.reject("inverse_bind_count")

    def test_triangle_index_outside_vertex_buffer_is_rejected(self):
        change_binary(self.document, self.binary, self.names["indices"], (0, 1, 3), "H")
        self.reject("triangle_index_bounds")

    def test_opposed_winding_diagnostic_but_zero_area_blocks(self):
        change_binary(self.document, self.binary, self.names["indices"], (0, 2, 1), "H")
        result = audit_glb(pack(self.document, self.binary))
        self.assertEqual(result["geometry"]["winding_opposes_vertex_normals"], 1)
        self.assertIn("visual_quality_not_certified", result["status"])
        change_binary(self.document, self.binary, self.names["indices"], (0, 0, 0), "H")
        self.reject("degenerate_triangles")

    def test_zero_and_nonunit_vertex_normals_block(self):
        for normal in ((0, 0, 0), (0, 0, 2)):
            with self.subTest(normal=normal):
                change_binary(self.document, self.binary, self.names["normals"], normal)
                self.reject("invalid_vertex_normals")

    def test_loop_endpoint_and_time_order_fail_closed(self):
        change_binary(self.document, self.binary, self.names["motion"], (0, 0, 0, 0, 0.1, 0, 0, 0.01, 0))
        self.reject("animation_loop_endpoint_mismatch")
        self.document, self.binary, self.names = fixture()
        change_binary(self.document, self.binary, self.names["times"], (0, 0, 4))
        self.reject("animation_time_not_increasing")
        change_binary(self.document, self.binary, self.names["times"], (0, 2, 3))
        self.reject("animation_duration_mismatch")
        # A four-second span starting at Blender frame 1 is still the wrong timeline.
        change_binary(self.document, self.binary, self.names["times"], (1 / 24, 2 + 1 / 24, 4 + 1 / 24))
        self.reject("animation_duration_mismatch")

    def test_constant_nonroot_or_only_moving_root_is_not_real_skeletal_motion(self):
        change_binary(self.document, self.binary, self.names["motion"], (0,) * 9)
        self.reject("no_changing_non_root_deforming_joint")
        self.document, self.binary, self.names = fixture()
        for animation in self.document["animations"]:
            animation["channels"][0]["target"]["node"] = 0
        self.reject("no_changing_non_root_deforming_joint")

    def test_root_translation_uses_world_axes_after_static_parent_rotation(self):
        self.document["nodes"].append({"children": [0], "rotation": [-math.sqrt(0.5), 0, 0, math.sqrt(0.5)]})
        self.document["scenes"][0]["nodes"] = [3, 2]
        for animation in self.document["animations"]:
            animation["channels"].append({"sampler": 0, "target": {"node": 0, "path": "translation"}})
        self.reject("horizontal_root_motion_not_in_place")
        change_binary(self.document, self.binary, self.names["motion"], (0, 0, 0, 0, 0, 0.1, 0, 0, 0))
        result = audit_glb(pack(self.document, self.binary))
        self.assertLess(result["clips"]["move"]["root_horizontal_max_delta"], 1e-5)
        self.document["nodes"][3].pop("rotation")
        self.reject("horizontal_root_motion_not_in_place")

    def test_motion_on_unweighted_unrelated_bone_is_not_sufficient(self):
        self.document["nodes"][0]["children"].append(3)
        self.document["nodes"].append({"name": "unused"})
        self.document["skins"][0]["joints"].append(3)
        inverse = self.document["accessors"][self.names["inverse"]]
        inverse["count"] = 3
        self.binary.extend(b"\0" * (-len(self.binary) % 4))
        start = len(self.binary)
        identity = (1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
        self.binary.extend(struct.pack("<48f", *(identity * 3)))
        inverse["bufferView"] = len(self.document["bufferViews"])
        self.document["bufferViews"].append({"buffer": 0, "byteOffset": start, "byteLength": 192})
        self.document["buffers"][0]["byteLength"] = len(self.binary)
        for animation in self.document["animations"]:
            animation["channels"][0]["target"]["node"] = 3
        self.reject("no_changing_non_root_deforming_joint")

    def test_quaternion_sign_equivalence_and_nonunit_rejection(self):
        self.binary.extend(b"\0" * (-len(self.binary) % 4))
        start = len(self.binary)
        values = [(0, 0, 0, 1), (0, 0, 0.2, math.sqrt(0.96)), (0, 0, 0, -1)]
        self.binary.extend(struct.pack("<12f", *(value for row in values for value in row)))
        self.document["bufferViews"].append({"buffer": 0, "byteOffset": start, "byteLength": 48})
        self.document["accessors"].append(
            {"bufferView": len(self.document["bufferViews"]) - 1, "componentType": 5126, "count": 3, "type": "VEC4"}
        )
        self.document["buffers"][0]["byteLength"] = len(self.binary)
        rotation = len(self.document["accessors"]) - 1
        for animation in self.document["animations"]:
            animation["channels"][0]["target"]["path"] = "rotation"
            animation["samplers"][0]["output"] = rotation
        result = audit_glb(pack(self.document, self.binary))
        self.assertEqual(result["clips"]["idle"]["loop_endpoint_max_delta"], 0)
        change_binary(self.document, self.binary, rotation, (0, 0, 0, 2))
        self.reject("animation_quaternion_not_unit")

    def test_duplicate_or_missing_clip_names_rejected(self):
        self.document["animations"][0]["name"] = "greet"
        self.reject("exact_seven_clips_required")
        self.document["animations"].pop()
        self.reject("exact_seven_clips_required")

    def test_external_uri_and_unsupported_sparse_extension_rejected(self):
        self.document["buffers"][0]["uri"] = "../do-not-read.bin"
        self.reject("external_or_data_uri_forbidden")
        self.document["buffers"][0].pop("uri")
        self.document["accessors"][0]["sparse"] = {"count": 1}
        self.reject("sparse_accessor_not_audited")
        self.document["accessors"][0].pop("sparse")
        self.document["extensionsUsed"] = ["KHR_draco_mesh_compression"]
        self.reject("extensions_not_audited")
        self.document.pop("extensionsUsed")
        self.document["meshes"][0]["extensions"] = {"not_declared_in_used_list": {}}
        self.reject("extensions_not_audited")

    def test_material_nonfinite_and_node_cycles_rejected(self):
        self.document["materials"][0]["pbrMetallicRoughness"]["roughnessFactor"] = math.nan
        self.reject("nonfinite_json")
        self.document["materials"][0]["pbrMetallicRoughness"]["roughnessFactor"] = 0.7
        self.document["nodes"][1]["children"] = [0]
        self.reject("node_cycle")

    def test_declared_integer_weight_bounds_are_raw_not_normalized(self):
        self.document, self.binary, self.names = fixture(integer_weights=True)
        weights = self.document["accessors"][self.names["weights"]]
        weights["min"] = [255, 0, 0, 0]
        weights["max"] = [255, 0, 0, 0]
        audit_glb(pack(self.document, self.binary))
        weights["max"] = [1, 0, 0, 0]
        self.reject("accessor_declared_bound_mismatch")

    def test_inverse_bind_must_be_affine_and_invertible(self):
        for matrix, code in (
            ((1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), "inverse_bind_not_affine"),
            ((0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), "singular_inverse_bind"),
        ):
            with self.subTest(code=code):
                change_binary(self.document, self.binary, self.names["inverse"], matrix)
                self.reject(code)

    def test_dangling_texture_reference_and_duplicate_json_keys_rejected(self):
        self.document["materials"][0]["normalTexture"] = {"index": 0}
        self.reject("invalid_reference")
        with self.assertRaisesRegex(AuditError, "duplicate_json_key"):
            load_json(b'{"asset":{"version":"2.0","version":"1.0"}}')

    def test_instance_count_and_negative_transform_are_reported(self):
        self.document["nodes"].append({"mesh": 0, "skin": 0, "scale": [-1, 1, 1]})
        self.document["scenes"][0]["nodes"].append(3)
        result = audit_glb(pack(self.document, self.binary))["geometry"]
        self.assertEqual(result["triangles"], 1)
        self.assertEqual(result["rendered_triangles"], 2)
        self.assertEqual(result["negative_local_transform_nodes"], 1)

    def make_asset(self, directory):
        payload = pack(self.document, self.binary)
        (directory / "standard.glb").write_bytes(payload)
        generator = b"# Original synthetic geometry fixture; never executed\n"
        (directory / "generator.py").write_bytes(generator)
        repository = directory / "repository"
        (repository / "tools/companions").mkdir(parents=True)
        (repository / "tools/companions/build.py").write_bytes(generator)

        def git(*args):
            return subprocess.run(
                ["git", "-C", str(repository), *args], capture_output=True, check=True, timeout=30
            ).stdout.strip()

        git("init", "--quiet")
        git("-c", "core.autocrlf=false", "add", "tools/companions/build.py")
        git(
            "-c",
            "user.name=Synthetic Audit",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "--quiet",
            "-m",
            "Synthetic GLB fixture",
        )
        commit = git("rev-parse", "HEAD").decode("ascii")
        manifest = {
            "basis_commit": commit,
            "generator_repository_commit": commit,
            "generator_source_matches_commit": True,
            "source_script_sha256": hashlib.sha256(generator).hexdigest(),
            "clips": list(CLIPS),
            "clip_duration_seconds": 4,
            "rig_bones": 2,
            "variants": {
                "standard": {
                    "file": "standard.glb",
                    "bytes": len(payload),
                    "sha256": hashlib.sha256(payload).hexdigest(),
                    "triangles": 1,
                    "textures": 0,
                }
            },
        }
        (directory / "asset-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        return manifest

    def test_asset_provenance_rechecks_exact_bytes_without_executing_generator(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            manifest = self.make_asset(directory)
            report = audit_asset(directory, "standard", directory / "repository")
            self.assertTrue(report["provenance"]["input_bytes_unchanged"])
            self.assertTrue(report["provenance"]["generator_git_bytes_match"])
            for key, value in (("sha256", "0" * 64), ("triangles", 5), ("textures", 1)):
                modified = copy.deepcopy(manifest)
                modified["variants"]["standard"][key] = value
                (directory / "asset-manifest.json").write_text(json.dumps(modified), encoding="utf-8")
                with self.subTest(key=key), self.assertRaises(AuditError):
                    audit_asset(directory, "standard", directory / "repository")
            (directory / "asset-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            (directory / "generator.py").write_text("# changed", encoding="utf-8")
            with self.assertRaisesRegex(AuditError, "generator_hash_mismatch"):
                audit_asset(directory, "standard", directory / "repository")
            manifest["source_script_sha256"] = hashlib.sha256(b"# changed").hexdigest()
            (directory / "asset-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(AuditError, "generator_git_bytes_mismatch"):
                audit_asset(directory, "standard", directory / "repository")

    def test_mid_audit_change_and_existing_report_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            self.make_asset(directory)
            real_read = Path.read_bytes
            calls = 0

            def changed(path):
                nonlocal calls
                data = real_read(path)
                if path.name == "standard.glb":
                    calls += 1
                    if calls == 2:
                        return data + b"changed"
                return data

            with (
                patch.object(Path, "read_bytes", changed),
                self.assertRaisesRegex(AuditError, "inputs_changed_during_audit"),
            ):
                audit_asset(directory, "standard", directory / "repository")
            output = directory / "report.json"
            write_report({"aggregate": True}, output)
            before = output.read_bytes()
            with self.assertRaisesRegex(AuditError, "new_output_file_required"):
                write_report({"aggregate": False}, output)
            self.assertEqual(output.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
