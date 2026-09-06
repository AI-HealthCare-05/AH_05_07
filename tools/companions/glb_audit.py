"""Independent, dependency-free audit of the uncompressed SK7 companion GLB profile.

Uses actual binary accessor values, not Blender's import result. This is deliberately
not a general glTF validator: unsupported sparse/compressed/morph data fails closed.
Spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
Geometry diagnostics do not establish visual quality, foot contact or no penetration.
"""

import argparse
import hashlib
import json
import math
import os
import platform
import re
import struct
import subprocess
import tempfile
from pathlib import Path

CLIPS = ("idle", "greet", "move", "curious", "celebrate", "rest", "special")
TOLERANCE = 1e-5
WEIGHT_TOLERANCE = 1e-4
COMPONENTS = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


class AuditError(ValueError):
    """A bounded audit failure; messages never contain file contents or vectors."""


def require(condition, code):
    if not condition:
        raise AuditError(code)


def integer(value, minimum=0):
    require(type(value) is int and value >= minimum, "invalid_integer")
    return value


def reference(items, index):
    integer(index)
    require(index < len(items), "invalid_reference")
    return items[index]


def finite_json(value):
    if isinstance(value, float):
        require(math.isfinite(value), "nonfinite_json")
    elif isinstance(value, dict):
        require("uri" not in value, "external_or_data_uri_forbidden")
        require(not value.get("extensions"), "extensions_not_audited")
        for child in value.values():
            finite_json(child)
    elif isinstance(value, list):
        for child in value:
            finite_json(child)


def load_json(payload):
    def unique_object(pairs):
        require(len({key for key, _ in pairs}) == len(pairs), "duplicate_json_key")
        return dict(pairs)

    try:
        value = json.loads(payload, object_pairs_hook=unique_object)
    except AuditError:
        raise
    except (ValueError, UnicodeError) as error:
        raise AuditError("invalid_json") from error
    finite_json(value)
    require(isinstance(value, dict), "json_object_required")
    return value


def parse_glb(payload):
    require(len(payload) >= 28, "truncated_header")
    magic, version, length = struct.unpack_from("<III", payload)
    require(magic == 0x46546C67 and version == 2, "invalid_glb_header")
    require(length == len(payload), "file_length_mismatch")
    offset, chunks = 12, []
    while offset < length:
        require(offset + 8 <= length, "truncated_chunk_header")
        size, kind = struct.unpack_from("<II", payload, offset)
        require(size % 4 == 0 and offset + 8 + size <= length, "chunk_bounds")
        chunks.append((kind, payload[offset + 8 : offset + 8 + size]))
        offset += 8 + size
    require([kind for kind, _ in chunks] == [0x4E4F534A, 0x004E4942], "expected_json_and_bin_chunks")
    document = load_json(chunks[0][1])
    require(document.get("asset", {}).get("version") == "2.0", "unsupported_asset_version")
    require(not document.get("extensionsRequired") and not document.get("extensionsUsed"), "extensions_not_audited")
    buffers = document.get("buffers", [])
    require(len(buffers) == 1, "single_embedded_buffer_required")
    size = integer(buffers[0].get("byteLength"), 1)
    binary = chunks[1][1]
    require(size <= len(binary) <= size + 3 and not any(binary[size:]), "bin_length_or_padding")
    return document, binary[:size]


class Accessors:
    def __init__(self, document, binary):
        self.items = document.get("accessors", [])
        self.views = document.get("bufferViews", [])
        self.binary = binary
        self.cache = {}
        require(self.items and self.views, "binary_geometry_required")
        for view in self.views:
            require(view.get("buffer") == 0, "invalid_buffer_reference")
            start, length = integer(view.get("byteOffset", 0)), integer(view.get("byteLength"), 1)
            require(start + length <= len(binary), "buffer_view_bounds")
            if "byteStride" in view:
                stride = integer(view["byteStride"], 4)
                require(stride <= 252 and stride % 4 == 0, "invalid_byte_stride")
        for index in range(len(self.items)):
            self.values(index)

    def values(self, index):  # noqa: C901 - binary bounds and normalization are intentionally explicit
        accessor = reference(self.items, index)
        if index in self.cache:
            return self.cache[index]
        require("sparse" not in accessor, "sparse_accessor_not_audited")
        component, shape = accessor.get("componentType"), accessor.get("type")
        require(component in COMPONENTS and shape in WIDTHS, "unsupported_accessor_layout")
        code, size = COMPONENTS[component]
        require(shape != "MAT4" or component == 5126, "matrix_layout_not_audited")
        normalized = accessor.get("normalized", False)
        require(type(normalized) is bool, "invalid_normalized_flag")
        require(not normalized or component in (5120, 5121, 5122, 5123), "invalid_normalization")
        count = integer(accessor.get("count"), 1)
        view = reference(self.views, accessor.get("bufferView"))
        start, width = integer(accessor.get("byteOffset", 0)), WIDTHS[shape]
        stride = view.get("byteStride", width * size)
        absolute = view.get("byteOffset", 0) + start
        require(start % size == 0 and absolute % size == 0 and stride % size == 0, "accessor_alignment")
        require(stride >= width * size, "accessor_stride_too_small")
        require(start + (count - 1) * stride + width * size <= view["byteLength"], "accessor_bounds")
        values = []
        actual_bounds = {"min": [math.inf] * width, "max": [-math.inf] * width}
        for row in range(count):
            data = struct.unpack_from("<" + code * width, self.binary, absolute + row * stride)
            require(all(math.isfinite(v) for v in data), "nonfinite_accessor")
            for column, value in enumerate(data):
                actual_bounds["min"][column] = min(actual_bounds["min"][column], value)
                actual_bounds["max"][column] = max(actual_bounds["max"][column], value)
            if normalized:
                divisor = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[component]
                data = tuple(max(-1, value / divisor) for value in data)
            values.append(data)
        for key in ("min", "max"):
            if key in accessor:
                declared = accessor[key]
                require(len(declared) == width, "accessor_declared_bound_width")
                # glTF min/max describe raw values even when normalized.
                require(
                    all(
                        math.isclose(a, b, rel_tol=TOLERANCE, abs_tol=TOLERANCE)
                        for a, b in zip(actual_bounds[key], declared, strict=True)
                    ),
                    "accessor_declared_bound_mismatch",
                )
        self.cache[index] = values
        return values

    def typed(self, index, shape, components, normalized=None):
        item = reference(self.items, index)
        require(item.get("type") == shape and item.get("componentType") in components, "accessor_semantic_type")
        if normalized is not None:
            require(item.get("normalized", False) is normalized, "accessor_semantic_normalization")
        return self.values(index)


def node_graph(document):
    nodes = document.get("nodes", [])
    require(nodes, "nodes_required")
    parents = {}
    for index, node in enumerate(nodes):
        children = node.get("children", [])
        require(len(children) == len(set(children)), "duplicate_child")
        for child in children:
            reference(nodes, child)
            require(child not in parents, "multiple_node_parents")
            parents[child] = index
        for field, size in (("translation", 3), ("scale", 3), ("rotation", 4), ("matrix", 16)):
            if field in node:
                require(len(node[field]) == size, "node_transform_width")
        require(
            "matrix" not in node or not any(key in node for key in ("translation", "scale", "rotation")),
            "mixed_node_transform",
        )
        if "rotation" in node:
            require(abs(math.hypot(*node["rotation"]) - 1) <= WEIGHT_TOLERANCE, "node_quaternion_not_unit")
    for start in range(len(nodes)):
        seen, current = set(), start
        while current in parents:
            require(current not in seen, "node_cycle")
            seen.add(current)
            current = parents[current]
    scene = reference(document.get("scenes", []), document.get("scene", 0))
    roots = scene.get("nodes", [])
    require(roots and len(roots) == len(set(roots)), "invalid_scene_roots")
    reachable, pending = set(), list(roots)
    for root in roots:
        reference(nodes, root)
        require(root not in parents, "scene_root_has_parent")
    while pending:
        current = pending.pop()
        reachable.add(current)
        pending.extend(nodes[current].get("children", []))
    return nodes, parents, reachable


def norm(vector):
    return math.sqrt(sum(value * value for value in vector))


def determinant3(matrix):
    a, b, c, d, e, f, g, h, i = (matrix[index] for index in (0, 4, 8, 1, 5, 9, 2, 6, 10))
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)


def triangle_diagnostics(positions, normals, indices):
    result = {"triangles": len(indices) // 3, "degenerate_triangles": 0, "winding_opposes_vertex_normals": 0}
    for index in range(0, len(indices), 3):
        ia, ib, ic = indices[index : index + 3]
        a, b, c = positions[ia], positions[ib], positions[ic]
        u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
        cross = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
        twice_area = norm(cross)
        result["degenerate_triangles"] += twice_area <= 2e-12
        averaged = [normals[ia][i] + normals[ib][i] + normals[ic][i] for i in range(3)]
        # 3D area has no negative sign; this diagnostic uses the supplied normals as orientation reference.
        result["winding_opposes_vertex_normals"] += sum(
            cross[i] * averaged[i] for i in range(3)
        ) < -TOLERANCE * twice_area * norm(averaged)
    return result


def skin_weights(attributes, accessors, joints):
    require(
        not any(key.startswith(("JOINTS_", "WEIGHTS_")) and key not in ("JOINTS_0", "WEIGHTS_0") for key in attributes),
        "additional_skin_sets_not_audited",
    )
    joint_values = accessors.typed(attributes.get("JOINTS_0"), "VEC4", (5121, 5123), False)
    weights_index = attributes.get("WEIGHTS_0")
    item = reference(accessors.items, weights_index)
    weights = accessors.typed(weights_index, "VEC4", (5121, 5123, 5126))
    require(item["componentType"] == 5126 or item.get("normalized") is True, "integer_weights_must_be_normalized")
    require(len(joint_values) == len(weights), "skin_attribute_count")
    used, maximum_error = set(), 0.0
    for joint_row, row in zip(joint_values, weights, strict=True):
        require(all(0 <= value <= 1 for value in row), "skin_weight_range")
        maximum_error = max(maximum_error, abs(sum(row) - 1))
        require(abs(sum(row) - 1) <= WEIGHT_TOLERANCE, "skin_weights_not_normalized")
        for joint, weight in zip(joint_row, row, strict=True):
            reference(joints, joint)
            if weight > 0:
                used.add(joints[joint])
    return used, maximum_error


def geometry(document, accessors, nodes, reachable, joints):  # noqa: C901 - independent mesh semantic checks
    meshes, materials = document.get("meshes", []), document.get("materials", [])
    require(meshes and materials, "meshes_and_materials_required")
    instances = [(i, node) for i, node in enumerate(nodes) if "mesh" in node]
    require(instances, "mesh_instance_required")
    require({node["mesh"] for _, node in instances} == set(range(len(meshes))), "unreferenced_mesh")
    for index, node in instances:
        reference(meshes, node["mesh"])
        require(index in reachable and node.get("skin") == 0, "unreachable_or_unskinned_mesh")
    totals = {
        "triangles": 0,
        "degenerate_triangles": 0,
        "winding_opposes_vertex_normals": 0,
        "vertices": 0,
        "zero_normals": 0,
        "non_unit_normals": 0,
        "primitives": 0,
    }
    used, maximum_error = set(), 0.0
    per_mesh_triangles = []
    for mesh in meshes:
        before = totals["triangles"]
        require(mesh.get("primitives") and "weights" not in mesh, "empty_or_morphed_mesh")
        for primitive in mesh["primitives"]:
            require(primitive.get("mode", 4) == 4 and not primitive.get("targets"), "triangles_without_morphs_required")
            reference(materials, primitive.get("material"))
            attributes = primitive.get("attributes", {})
            positions = accessors.typed(attributes.get("POSITION"), "VEC3", (5126,), False)
            normals = accessors.typed(attributes.get("NORMAL"), "VEC3", (5126,), False)
            require(
                all(len(accessors.values(index)) == len(positions) for index in attributes.values()),
                "vertex_attribute_count",
            )
            weighted, error = skin_weights(attributes, accessors, joints)
            used.update(weighted)
            maximum_error = max(error, maximum_error)
            indices = (
                list(range(len(positions)))
                if "indices" not in primitive
                else [row[0] for row in accessors.typed(primitive["indices"], "SCALAR", (5121, 5123, 5125), False)]
            )
            require(len(indices) % 3 == 0 and all(value < len(positions) for value in indices), "triangle_index_bounds")
            for key, value in triangle_diagnostics(positions, normals, indices).items():
                totals[key] += value
            totals["vertices"] += len(positions)
            totals["primitives"] += 1
            totals["zero_normals"] += sum(norm(row) <= 1e-12 for row in normals)
            totals["non_unit_normals"] += sum(abs(norm(row) - 1) > 1e-3 for row in normals)
        per_mesh_triangles.append(totals["triangles"] - before)
    totals["rendered_triangles"] = sum(per_mesh_triangles[node["mesh"]] for _, node in instances)
    totals["negative_local_transform_nodes"] = sum(
        determinant3(node["matrix"]) < 0 if "matrix" in node else math.prod(node.get("scale", [1, 1, 1])) < 0
        for node in nodes
    )
    totals.update(
        meshes=len(meshes), mesh_instances=len(instances), materials=len(materials), weight_sum_max_error=maximum_error
    )
    require(totals["degenerate_triangles"] == 0, "degenerate_triangles")
    require(totals["zero_normals"] == 0 and totals["non_unit_normals"] == 0, "invalid_vertex_normals")
    return totals, used


def material_audit(document, accessors):
    textures = document.get("textures", [])
    for material in document.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        rgba = pbr.get("baseColorFactor", [1, 1, 1, 1])
        require(len(rgba) == 4 and all(0 <= value <= 1 for value in rgba), "material_color_range")
        require(
            all(0 <= pbr.get(key, 1) <= 1 for key in ("metallicFactor", "roughnessFactor")), "material_factor_range"
        )
        for container, names in (
            (pbr, ("baseColorTexture", "metallicRoughnessTexture")),
            (material, ("normalTexture", "occlusionTexture", "emissiveTexture")),
        ):
            for name in names:
                if name in container:
                    reference(textures, container[name].get("index"))
    images = document.get("images", [])
    for image in images:
        reference(accessors.views, image.get("bufferView"))
        require(image.get("mimeType") in ("image/png", "image/jpeg"), "unsupported_embedded_image")
    for texture in textures:
        reference(images, texture.get("source"))
    return {
        "images": len(images),
        "textures": len(document.get("textures", [])),
        "external_uris": 0,
        "double_sided_materials": sum(
            material.get("doubleSided", False) is True for material in document.get("materials", [])
        ),
    }


def vector_delta(left, right, rotation=False):
    delta = max(abs(a - b) for a, b in zip(left, right, strict=True))
    if rotation:
        delta = min(delta, max(abs(a + b) for a, b in zip(left, right, strict=True)))
    return delta


def parent_world_direction(vector, node, nodes, parents):
    """Transform a translation difference through static ancestors, excluding offsets."""
    while node in parents:
        node = parents[node]
        ancestor = nodes[node]
        if "matrix" in ancestor:
            matrix = ancestor["matrix"]
            vector = [sum(matrix[row + column * 4] * vector[column] for column in range(3)) for row in range(3)]
        else:
            vector = [value * scale for value, scale in zip(vector, ancestor.get("scale", [1, 1, 1]), strict=True)]
            x, y, z, w = ancestor.get("rotation", [0, 0, 0, 1])
            vx, vy, vz = vector
            cross = [2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)]
            vector = [
                vx + w * cross[0] + y * cross[2] - z * cross[1],
                vy + w * cross[1] + z * cross[0] - x * cross[2],
                vz + w * cross[2] + x * cross[1] - y * cross[0],
            ]
        require(all(math.isfinite(value) for value in vector), "nonfinite_world_motion")
    return vector


def animation_audit(document, accessors, nodes, joints, parents, weighted, duration):  # noqa: C901 - explicit animation proof
    animations = document.get("animations", [])
    require(
        len(animations) == len(CLIPS) and {a.get("name") for a in animations} == set(CLIPS),
        "exact_seven_clips_required",
    )
    roots = {joint for joint in joints if parents.get(joint) not in joints}
    require(len(roots) == 1, "single_joint_root_required")
    affecting = set(weighted)
    for joint in weighted:
        while joint in parents:
            joint = parents[joint]
            affecting.add(joint)
    results = {}
    for animation in animations:
        channels, samplers = animation.get("channels", []), animation.get("samplers", [])
        require(channels and samplers, "empty_animation")
        seen, changing = set(), set()
        loop_delta, root_horizontal_delta = 0.0, 0.0
        first_times, last_times, sample_counts = [], [], []
        for channel in channels:
            target = channel.get("target", {})
            node, path = target.get("node"), target.get("path")
            reference(nodes, node)
            require(node in joints and path in ("translation", "rotation", "scale"), "non_skeletal_animation_target")
            require((node, path) not in seen and "matrix" not in nodes[node], "duplicate_or_matrix_animation_target")
            seen.add((node, path))
            sampler = reference(samplers, channel.get("sampler"))
            require(sampler.get("interpolation", "LINEAR") in ("LINEAR", "STEP"), "interpolation_not_audited")
            times = [row[0] for row in accessors.typed(sampler.get("input"), "SCALAR", (5126,), False)]
            values = accessors.typed(sampler.get("output"), "VEC4" if path == "rotation" else "VEC3", (5126,), False)
            require(len(times) == len(values) and len(times) >= 2, "animation_sample_count")
            require(all(b > a for a, b in zip(times, times[1:], strict=False)), "animation_time_not_increasing")
            require(
                abs(times[0]) <= TOLERANCE and abs(times[-1] - duration) <= TOLERANCE, "animation_duration_mismatch"
            )
            first_times.append(times[0])
            last_times.append(times[-1])
            sample_counts.append(len(times))
            if path == "rotation":
                require(all(abs(norm(row) - 1) <= WEIGHT_TOLERANCE for row in values), "animation_quaternion_not_unit")
            if path == "scale":
                require(all(component > 0 for row in values for component in row), "nonpositive_animated_scale")
            delta = vector_delta(values[0], values[-1], path == "rotation")
            loop_delta = max(loop_delta, delta)
            require(delta <= TOLERANCE, "animation_loop_endpoint_mismatch")
            variation = max(vector_delta(values[0], row, path == "rotation") for row in values)
            if node not in roots and node in affecting and variation > TOLERANCE:
                changing.add(node)
            if node in roots and path == "translation":
                # glTF is Y-up. Local translation must first traverse static parent transforms.
                differences = (
                    parent_world_direction([row[i] - values[0][i] for i in range(3)], node, nodes, parents)
                    for row in values
                )
                horizontal = max(max(abs(row[i]) for i in (0, 2)) for row in differences)
                root_horizontal_delta = max(root_horizontal_delta, horizontal)
                require(horizontal <= TOLERANCE, "horizontal_root_motion_not_in_place")
        require(changing, "no_changing_non_root_deforming_joint")
        require({c["sampler"] for c in channels} == set(range(len(samplers))), "unused_animation_sampler")
        results[animation["name"]] = {
            "duration_seconds": duration,
            "first_sample_seconds": min(first_times),
            "last_sample_seconds": max(last_times),
            "sampler_key_count_min": min(sample_counts),
            "sampler_key_count_max": max(sample_counts),
            "channels": len(channels),
            "changing_non_root_deforming_joints": len(changing),
            "loop_endpoint_max_delta": loop_delta,
            "root_horizontal_max_delta": root_horizontal_delta,
        }
    return results


def audit_glb(payload, duration=4.0):
    require(math.isfinite(duration) and duration > 0, "invalid_expected_duration")
    document, binary = parse_glb(payload)
    accessors = Accessors(document, binary)
    nodes, parents, reachable = node_graph(document)
    skins = document.get("skins", [])
    require(len(skins) == 1, "single_skin_required")
    joints = skins[0].get("joints", [])
    require(len(joints) >= 2 and len(set(joints)) == len(joints), "invalid_skin_joints")
    for joint in joints:
        reference(nodes, joint)
        require(joint in reachable, "unreachable_joint")
    matrices = accessors.typed(skins[0].get("inverseBindMatrices"), "MAT4", (5126,), False)
    require(len(matrices) == len(joints), "inverse_bind_count")
    for matrix in matrices:
        require(
            all(abs(matrix[index]) <= TOLERANCE for index in (3, 7, 11)) and abs(matrix[15] - 1) <= TOLERANCE,
            "inverse_bind_not_affine",
        )
        require(abs(determinant3(matrix)) > 1e-12, "singular_inverse_bind")
    geometry_result, weighted = geometry(document, accessors, nodes, reachable, joints)
    return {
        "schema_version": 1,
        "status": "binary_contract_pass_visual_quality_not_certified",
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "accessors": len(accessors.items),
        "nodes": len(nodes),
        "skin_joints": len(joints),
        "weighted_joints": len(weighted),
        "geometry": geometry_result,
        "materials": material_audit(document, accessors),
        "clips": animation_audit(document, accessors, nodes, joints, parents, weighted, duration),
        "tolerances": {
            "loop_and_time_absolute": TOLERANCE,
            "skin_sum_and_quaternion_norm_absolute": WEIGHT_TOLERANCE,
            "vertex_normal_norm_absolute": 1e-3,
            "degenerate_triangle_area_maximum": 1e-12,
        },
        "limitations": [
            "No image pixel, scene collision, silhouette, foot sliding or clinical/model validation",
            "3D triangle area is unsigned; winding opposition is relative to supplied vertex normals",
            "Stored TRS sample endpoints are checked; velocity continuity is not certified",
            "Only uncompressed nonsparse skeletal LINEAR/STEP GLB profile is audited",
        ],
    }


def audit_asset(asset_dir, variant, repository=None):
    require(variant in ("standard", "light"), "invalid_variant")
    asset_dir = Path(asset_dir).resolve()
    paths = [asset_dir / name for name in (f"{variant}.glb", "asset-manifest.json", "generator.py")]
    require(all(path.resolve().parent == asset_dir and path.is_file() for path in paths), "asset_file_boundary")
    snapshots = [path.read_bytes() for path in paths]
    payload, manifest_bytes, generator_bytes = snapshots
    manifest = load_json(manifest_bytes)
    require(re.fullmatch(r"[0-9a-f]{40}", manifest.get("basis_commit", "")), "invalid_basis_commit")
    generator_commit = manifest.get("generator_repository_commit", "")
    require(re.fullmatch(r"[0-9a-f]{40}", generator_commit), "invalid_generator_commit")
    require(manifest.get("generator_source_matches_commit") is True, "generator_alignment_not_declared")
    require(
        hashlib.sha256(generator_bytes).hexdigest() == manifest.get("source_script_sha256"), "generator_hash_mismatch"
    )
    repository = Path(repository) if repository is not None else Path(__file__).resolve().parents[2]
    for commit in (manifest["basis_commit"], generator_commit):
        result = subprocess.run(
            ["git", "-C", str(repository), "cat-file", "-t", commit], capture_output=True, timeout=30, check=False
        )
        require(result.returncode == 0 and result.stdout.strip() == b"commit", "provenance_commit_not_found")
    git_blob = subprocess.run(
        ["git", "-C", str(repository), "cat-file", "blob", f"{generator_commit}:tools/companions/build.py"],
        capture_output=True,
        timeout=30,
        check=False,
    )
    require(git_blob.returncode == 0 and git_blob.stdout == generator_bytes, "generator_git_bytes_mismatch")
    entry = manifest.get("variants", {}).get(variant, {})
    require(entry.get("file") == paths[0].name, "manifest_variant_filename")
    require(
        entry.get("bytes") == len(payload) and entry.get("sha256") == hashlib.sha256(payload).hexdigest(),
        "manifest_asset_hash_mismatch",
    )
    require(
        manifest.get("clips") == list(CLIPS) and manifest.get("clip_duration_seconds") == 4,
        "manifest_animation_contract",
    )
    result = audit_glb(payload)
    require(result["geometry"]["triangles"] == entry.get("triangles"), "manifest_triangle_count")
    require(result["materials"]["textures"] == entry.get("textures"), "manifest_texture_count")
    require(result["skin_joints"] == manifest.get("rig_bones"), "manifest_joint_count")
    require([path.read_bytes() for path in paths] == snapshots, "inputs_changed_during_audit")
    result["provenance"] = {
        "variant": variant,
        "source_basis_commit": manifest["basis_commit"],
        "generator_repository_commit": generator_commit,
        "basis_commit_check": "existing_git_commit",
        "generator_git_bytes_match": True,
        "generator_sha256": manifest["source_script_sha256"],
        "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "input_bytes_unchanged": True,
        "auditor_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "python": platform.python_version(),
    }
    return result


def write_report(result, output):
    """Stage and verify JSON, then atomically publish without replacing any old file."""
    output = Path(output)
    require(output.parent.is_dir() and not output.exists(), "new_output_file_required")
    payload = json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=output.parent, suffix=".pending", delete=False
    ) as stream:
        temporary = Path(stream.name)
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    require(json.loads(temporary.read_text(encoding="utf-8")) == result, "staged_report_mismatch")
    os.link(temporary, output)
    temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset-dir", type=Path, required=True)
    parser.add_argument("--variant", choices=("standard", "light"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--repository", type=Path, help="Defaults to the repository containing this auditor")
    args = parser.parse_args()
    try:
        result = audit_asset(args.asset_dir, args.variant, args.repository)
        write_report(result, args.output)
    except (
        AuditError,
        OSError,
        KeyError,
        TypeError,
        AttributeError,
        IndexError,
        OverflowError,
        RecursionError,
        struct.error,
        subprocess.TimeoutExpired,
    ) as error:
        print("SK7_GLB_AUDIT_FAIL", str(error) if isinstance(error, AuditError) else type(error).__name__)
        return 1
    print(
        "SK7_GLB_BINARY_AUDIT_PASS",
        args.variant,
        result["geometry"]["triangles"],
        "triangles",
        len(result["clips"]),
        "clips",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
