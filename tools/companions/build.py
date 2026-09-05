"""Author original SK7 companions in Blender; never touches application/model data.

Run with Blender --background --factory-startup --python this_file -- --species bear --output NEW_DIR.
All meshes, skin weights, PBR materials and seven skeletal actions are editable.
"""

import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

CLIPS = ("idle", "greet", "move", "curious", "celebrate", "rest", "special")
COLORS = {
    "bear": ("곰", (0.28, 0.14, 0.07), (0.72, 0.51, 0.29)),
    "rabbit": ("토끼", (0.72, 0.64, 0.51), (0.93, 0.81, 0.64)),
    "cat": ("고양이", (0.30, 0.39, 0.43), (0.73, 0.78, 0.74)),
    "dog": ("강아지", (0.57, 0.31, 0.13), (0.90, 0.74, 0.49)),
    "red_panda": ("레서판다", (0.52, 0.16, 0.07), (0.91, 0.77, 0.57)),
    "otter": ("수달", (0.25, 0.17, 0.12), (0.67, 0.52, 0.35)),
    "capybara": ("카피바라", (0.44, 0.32, 0.19), (0.65, 0.51, 0.32)),
    "hedgehog": ("고슴도치", (0.53, 0.39, 0.25), (0.83, 0.70, 0.50)),
    "penguin": ("펭귄", (0.06, 0.12, 0.16), (0.89, 0.87, 0.75)),
    "seal": ("물범", (0.43, 0.56, 0.59), (0.75, 0.84, 0.81)),
    "fox": ("여우", (0.65, 0.25, 0.09), (0.94, 0.79, 0.57)),
    "squirrel": ("다람쥐", (0.40, 0.21, 0.11), (0.81, 0.64, 0.41)),
}
SPECIAL = {
    "bear": "small clap",
    "rabbit": "ear flutter and small hop",
    "cat": "stretch",
    "dog": "tail-wag welcome",
    "red_panda": "peek",
    "otter": "paw rub",
    "capybara": "slow nod",
    "hedgehog": "curl and extend",
    "penguin": "waddle greeting",
    "seal": "flipper clap",
    "fox": "tail-wrap sit",
    "squirrel": "scan and small hop",
}
MARKING_EMBED = 0.04  # About 1.5 times the 0.026 sculpt voxel, allowing for remesh shrink.
MARKING_RELIEF = 0.012
QUILL_BASE_EMBED = 0.04
MARKING_OUTLINE_SEGMENTS = 64
MARKING_CUT_EPS = 1e-5  # Well below a display pixel, above float32 near-coincident edge spacing.


def coat_profiles(kind):
    """The same authored profiles drive the coat geometry and marking projection."""
    width = 0.68 if kind in ("seal", "capybara", "hedgehog") else 0.60
    head = (0.64, 0.47, 0.54) if kind in ("fox", "squirrel", "cat") else (0.67, 0.51, 0.59)
    if kind == "capybara":
        head = (0.60, 0.62, 0.46)
    return (
        ((0, 0.015, 1.05), (width, 0.45, 0.81), 0.18, 1),
        ((0, -0.01, 2.10), head, 0.10, 0.70 if kind == "capybara" else 0.86),
        ((0, 0.025, 1.64), (0.39, 0.35, 0.4), 0, 1),
    )


def profile_front_y(x, z, center, radii, pear=0, flatten=1):
    """Analytic front (-Y) of surface(), including pear and rounded cross section."""
    height = (z - center[2]) / radii[2]
    if abs(height) > 1 + 1e-12:
        return None
    height = max(-1, min(1, height))
    radial = math.sqrt(max(0, 1 - height * height)) * (1 - pear * height)
    if radial <= 1e-12:
        return center[1] if abs(x - center[0]) <= 1e-12 else None
    lateral = abs((x - center[0]) / (radii[0] * radial))
    if lateral > 1 + 1e-12:
        return None
    depth = radii[1] * radial * max(0, 1 - min(1, lateral) ** (2 / flatten)) ** (flatten / 2)
    return center[1] - depth


def coat_front_y(kind, x, z):
    fronts = [profile_front_y(x, z, *profile) for profile in coat_profiles(kind)]
    supported = [front for front in fronts if front is not None]
    if not supported:
        raise ValueError("Marking lies outside authored coat profiles")
    return min(supported)


def eye_surface_offset(kind):
    """Preserve eye embedding when a species has a different cranium profile."""
    if kind not in ("cat", "fox", "squirrel", "capybara"):
        return 0.0
    return coat_front_y(kind, 0.25, 2.25) - coat_front_y("bear", 0.25, 2.25)


def face_warp_point(kind, point, muzzle_width):
    """Apply one shared deformation to the muzzle and attached nose/mouth surfaces."""
    x, y, z = point
    if kind in ("fox", "cat", "squirrel"):
        y -= 0.07 * (1 - abs(x) / muzzle_width)
    return x, y, z


def warp_face(obj, kind, muzzle_width):
    for vertex in obj.data.vertices:
        vertex.co = face_warp_point(kind, vertex.co, muzzle_width)
    obj.data.update()


def marking_point(kind, point, center, radii):
    """Keep X/Z and closed topology; strictly positive Y scale preserves thickness.

    Rim vertices sink into the analytic coat by MARKING_EMBED. Only the central
    front cap stands proud; the back shell remains embedded. Projection precedes
    the shared species warp. Final remeshed coat contact still needs render QA.
    """
    x, y, z = point
    depth = (y - center[1]) / radii[1]
    return x, coat_front_y(kind, x, z) + MARKING_EMBED + (MARKING_EMBED + MARKING_RELIEF) * depth, z


def conform_marking(obj, kind, center, radii):
    for vertex in obj.data.vertices:
        vertex.co = marking_point(kind, vertex.co, center, radii)
    obj.data.update()


def marking_outline(center, radii, pear=0, scale=(1, 1), segments=MARKING_OUTLINE_SEGMENTS):
    """Outline of the former shell's ideal exposed cap, without offset geometry.

    The old shell crossed its analytic coat at normalized depth
    -EMBED / (EMBED + RELIEF). Preserve that footprint as a material boundary;
    remesh shrink and independent decimation can no longer move the crossing.
    """
    if not isinstance(segments, int) or segments < 12 or len(center) != 3 or len(radii) != 3 or len(scale) != 2:
        raise ValueError("Invalid marking contour specification")
    if any(not math.isfinite(value) for value in (*center, *radii, pear, *scale)):
        raise ValueError("Non-finite marking contour")
    if min(*radii, *scale) <= 0 or abs(pear) > 0.2:
        raise ValueError("Marking radii and scales must be positive")
    depth = MARKING_EMBED / (MARKING_EMBED + MARKING_RELIEF)
    outline = []
    for index in range(segments):
        angle = 2 * math.pi * index / segments
        x, z = math.cos(angle), math.sin(angle)
        lower, upper = 0.0, 1.0
        for _ in range(48):
            radius = (lower + upper) / 2
            height = radius * z
            signed = (1 - height * height) * (1 - pear * height) ** 2 - (radius * x) ** 2 - depth**2
            if signed > 0:
                lower = radius
            else:
                upper = radius
        radius = (lower + upper) / 2
        outline.append(((center[0] + radii[0] * radius * x) * scale[0], (center[2] + radii[2] * radius * z) * scale[1]))
    return outline


def coat_marking_outlines(kind):
    if kind not in ("red_panda", "fox", "penguin", "otter", "squirrel", "seal"):
        return []
    # Match the existing shared X/Z warp; no shape or bone transform changes.
    scale = {"otter": (0.88, 0.98), "penguin": (0.89, 0.95), "seal": (1.08, 0.64)}.get(kind, (1, 1))
    result = [marking_outline((0, -0.405, 1.14), (0.32, 0.064, 0.43), 0.13, scale)]
    if kind == "red_panda":
        result += [marking_outline((sign * 0.41, -0.397, 2.18), (0.15, 0.05, 0.17), scale=scale) for sign in (-1, 1)]
    elif kind == "penguin":
        result += [marking_outline((sign * 0.25, -0.452, 2.22), (0.20, 0.050, 0.275), scale=scale) for sign in (-1, 1)]
    return result


def outline_planes(outline):
    """Unit inward half-planes of the convex X/Z contour."""
    result = []
    for (x, z), (next_x, next_z) in zip(outline, (*outline[1:], outline[0]), strict=True):
        dx, dz = next_x - x, next_z - z
        length = math.hypot(dx, dz)
        if length <= 1e-12:
            raise ValueError("Degenerate marking edge")
        result.append(((x, 0, z), (-dz / length, 0, dx / length)))
    return result


def plane_distance(point, plane):
    origin, normal = plane
    return sum((point[index] - origin[index]) * normal[index] for index in range(3))


def inside_outline(point, planes):
    return all(plane_distance(point, plane) >= -MARKING_CUT_EPS for plane in planes)


def outline_bounds(outline):
    return (
        min(p[0] for p in outline),
        max(p[0] for p in outline),
        min(p[1] for p in outline),
        max(p[1] for p in outline),
    )


def face_overlaps_marking(points, bounds):
    left, right, bottom, top = bounds
    return not (
        max(point[0] for point in points) < left
        or min(point[0] for point in points) > right
        or max(point[2] for point in points) < bottom
        or min(point[2] for point in points) > top
    )


def face_meets_outline_edge(points, distances, segment):
    """Limit a supporting-plane cut to faces crossed by its finite contour edge."""
    (x, z), (next_x, next_z) = segment
    dx, dz = next_x - x, next_z - z
    length = math.hypot(dx, dz)
    positions = []
    for index, point in enumerate(points):
        following = (index + 1) % len(points)
        a, b = distances[index], distances[following]
        if abs(a) <= MARKING_CUT_EPS:
            positions.append(((point[0] - x) * dx + (point[2] - z) * dz) / length)
        if a * b < 0:
            fraction = a / (a - b)
            other = points[following]
            crossing = [point[axis] + fraction * (other[axis] - point[axis]) for axis in (0, 2)]
            positions.append(((crossing[0] - x) * dx + (crossing[1] - z) * dz) / length)
    return bool(positions) and min(positions) <= length + MARKING_CUT_EPS and max(positions) >= -MARKING_CUT_EPS


def stripe_planes(lower, upper):
    """Only true transitions of the existing floor(z*12)%3 color rule."""
    return [
        ((0, 0, index / 12), (0, 0, 1))
        for index in range(math.floor(lower * 12) + 1, math.ceil(upper * 12))
        if index % 3 in (0, 1)
    ]


def stripe_material(z):
    return int(math.floor(z * 12)) % 3 == 0


def tail_color_planes(pattern, lower, upper):
    if pattern == "red_panda_tail":
        return stripe_planes(lower, upper)
    if pattern == "fox_tail":
        return [((0, 0, 1.33), (0, 0, 1))] if lower < 1.33 < upper else []
    raise ValueError("Unknown tail material pattern")


def tail_color_material(pattern, z):
    if pattern == "red_panda_tail":
        return stripe_material(z)
    if pattern == "fox_tail":
        return z > 1.33
    raise ValueError("Unknown tail material pattern")


def cut_surface_plane(bm, plane, bounds=None, segment=None):
    """Cut shared edges without deleting either side or creating overlay shells."""
    bm.normal_update()
    faces = []
    for face in bm.faces:
        points = [vertex.co for vertex in face.verts]
        if bounds is not None and (face.normal.y >= 0 or not face_overlaps_marking(points, bounds)):
            continue
        distances = [plane_distance(point, plane) for point in points]
        if min(distances) < -MARKING_CUT_EPS and max(distances) > MARKING_CUT_EPS:
            if segment is None or face_meets_outline_edge(points, distances, segment):
                faces.append(face)
    if faces:
        # BMesh splits shared edges in adjacent faces too. The shared topology
        # and interpolated deform custom-data are retained by the operator.
        bm.verts.index_update()
        bm.edges.index_update()
        bm.faces.index_update()
        # Stable index order avoids depending on BM element pointer/set order.
        vertices = sorted({vertex for face in faces for vertex in face.verts}, key=lambda vertex: vertex.index)
        edges = sorted({edge for face in faces for edge in face.edges}, key=lambda edge: edge.index)
        geometry = [*vertices, *edges, *sorted(faces, key=lambda face: face.index)]
        bmesh.ops.bisect_plane(
            bm,
            geom=geometry,
            dist=MARKING_CUT_EPS,
            plane_co=plane[0],
            plane_no=plane[1],
            clear_inner=False,
            clear_outer=False,
        )


def verify_marked_surface(bm, deform, original):
    if any(not edge.is_manifold for edge in bm.edges):
        raise ValueError("Material boundary cut opened the coat")
    for vertex, (coordinate, weights) in original.items():
        if not vertex.is_valid or math.dist(vertex.co, coordinate) > 1e-7 or dict(vertex[deform]) != weights:
            raise ValueError("Material boundary cut changed an existing vertex or its skin weights")
    for vertex in bm.verts:
        values = list(vertex[deform].values())
        if (
            not values
            or any(not math.isfinite(value) or value < 0 for value in values)
            or abs(sum(values) - 1) > 1e-5
            or sum(value > 1e-8 for value in values) > 4
        ):
            raise ValueError("Material boundary cut produced invalid skin weights")


def limited_skin_weights(weights):
    """Make decimator-created group unions match the existing four-weight GLB export.

    Valid vertices remain byte-for-byte unchanged. This does not repair missing,
    non-finite, negative or unnormalized inputs by guessing replacement weights.
    """
    values = list(weights.values())
    if not values or any(not math.isfinite(value) or value < 0 for value in values) or abs(sum(values) - 1) > 1e-5:
        raise ValueError("Decimated skin has missing, non-finite, negative or unnormalized weights")
    if sum(value > 1e-8 for value in values) <= 4:
        return dict(weights), 0.0
    # As in the existing GLB export, retain the four largest weights and normalize.
    # Vertex group indices explicitly break ties; never depend on set order.
    retained = sorted(weights.items(), key=lambda item: (-item[1], item[0]))[:4]
    total = math.fsum(value for _, value in retained)
    discarded = math.fsum(value for joint, value in weights.items() if joint not in dict(retained))
    return {joint: value / total for joint, value in retained}, discarded


def prepare_decimated_skin(obj):
    """Explicit pre-cut skin cleanup; coordinates and already-valid weights stay fixed."""
    bm = bmesh.new()
    summary = {"object": obj.name, "vertices_changed": 0, "maximum_discarded_weight": 0.0}
    try:
        bm.from_mesh(obj.data)
        deform = bm.verts.layers.deform.active
        if deform is None:
            raise ValueError("Decimated mesh is missing authored skin weights")
        for vertex in bm.verts:
            old = dict(vertex[deform])
            limited, discarded = limited_skin_weights(old)
            if limited != old:
                for joint in old:
                    del vertex[deform][joint]
                for joint, weight in limited.items():
                    vertex[deform][joint] = weight
                summary["vertices_changed"] += 1
                summary["maximum_discarded_weight"] = max(summary["maximum_discarded_weight"], discarded)
        if summary["vertices_changed"]:
            bm.to_mesh(obj.data)
            obj.data.update()
    finally:
        bm.free()
    return summary


def paint_surface_markings(obj):
    """Reapply exact color boundaries to the actual source/standard/light surface.

    Existing positions and weights are guarded; new edge points interpolate the
    same closed surface. Actual Blender import/render QA remains mandatory.
    """
    pattern = obj.get("sk7_surface_pattern")
    if not pattern:
        return
    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data)
        deform = bm.verts.layers.deform.active
        if deform is None:
            raise ValueError("Surface markings require the existing skin weights")
        original = {vertex: (tuple(vertex.co), dict(vertex[deform])) for vertex in bm.verts}
        bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method="FIXED", ngon_method="EAR_CLIP")
        regions = []
        tail_pattern = pattern in ("red_panda_tail", "fox_tail")
        if tail_pattern:
            for plane in tail_color_planes(pattern, min(v.co.z for v in bm.verts), max(v.co.z for v in bm.verts)):
                cut_surface_plane(bm, plane)
        else:
            outlines = coat_marking_outlines(pattern)
            if not outlines:
                raise ValueError("Unknown coat marking pattern")
            regions = [outline_planes(outline) for outline in outlines]
            for outline, planes in zip(outlines, regions, strict=True):
                segments = zip(outline, (*outline[1:], outline[0]), strict=True)
                for plane, segment in zip(planes, segments, strict=True):
                    cut_surface_plane(bm, plane, outline_bounds(outline), segment)
        # Classify final triangles once; export/reapplication must not choose a
        # different side from the center of an untriangulated boundary polygon.
        bmesh.ops.triangulate(
            bm, faces=[face for face in bm.faces if len(face.verts) > 3], quad_method="BEAUTY", ngon_method="BEAUTY"
        )
        bm.normal_update()
        for face in bm.faces:
            center = face.calc_center_median()
            marked = (
                tail_color_material(pattern, center.z)
                if tail_pattern
                else face.normal.y < 0 and any(inside_outline(center, planes) for planes in regions)
            )
            face.material_index = obj["sk7_marking_material"] if marked else 0
        verify_marked_surface(bm, deform, original)
        bm.normal_update()
        bm.to_mesh(obj.data)
        obj.data.update()
    finally:
        bm.free()


def coat_back_y(kind, x, z):
    """Rear (+Y) of the same authored coat union used for front markings."""
    backs = []
    for profile in coat_profiles(kind):
        front = profile_front_y(x, z, *profile)
        if front is not None:
            backs.append(2 * profile[0][1] - front)
    if not backs:
        raise ValueError("Quill base lies outside authored coat profiles")
    return max(backs)


def coat_x_interval(kind, z):
    """Authored horizontal footprint at Z; used to seat shoulder-edge quills."""
    intervals = []
    for center, radii, pear, _ in coat_profiles(kind):
        height = (z - center[2]) / radii[2]
        if abs(height) < 1:
            width = radii[0] * math.sqrt(1 - height * height) * (1 - pear * height)
            intervals.append((center[0] - width, center[0] + width))
    if not intervals:
        raise ValueError("Quill base lies outside authored coat height")
    return min(interval[0] for interval in intervals), max(interval[1] for interval in intervals)


def attach_quill_points(points, base_weights, tip_weights):
    """Translate the whole evaluated base band, sizing offset by its worst vertex.

    Temporary subdivision-interpolated tags identify the base and tip, not skin
    influences. Uniform translation preserves the base shape and thickness;
    the transition fades toward the unchanged tip. Lateral movement is only
    needed by shoulder-edge bases outside the coat footprint. Skin binding
    remains the existing rule; those heights are independent of X.
    """
    if not points or len(points) != len(base_weights) or len(points) != len(tip_weights):
        raise ValueError("Invalid quill attachment samples")
    if any(len(point) != 3 or any(not math.isfinite(value) for value in point) for point in points):
        raise ValueError("Invalid quill attachment coordinates")
    if any(not math.isfinite(value) or not 0 <= value <= 1 for value in (*base_weights, *tip_weights)):
        raise ValueError("Invalid quill attachment weights")
    if any(base >= 0.5 and tip >= 0.5 for base, tip in zip(base_weights, tip_weights, strict=True)):
        raise ValueError("Overlapping quill base and tip tags")
    bases = [point for point, weight in zip(points, base_weights, strict=True) if weight >= 0.5]
    if not bases:
        raise ValueError("Quill base tag was lost")
    intervals = [coat_x_interval("hedgehog", point[2]) for point in bases]
    lower = max(interval[0] + QUILL_BASE_EMBED - point[0] for point, interval in zip(bases, intervals, strict=True))
    upper = min(interval[1] - QUILL_BASE_EMBED - point[0] for point, interval in zip(bases, intervals, strict=True))
    if lower > upper:
        raise ValueError("Quill base cannot fit inside authored coat footprint")
    shift_x = min(upper, max(lower, 0))
    offset = max(
        0,
        *(point[1] - coat_back_y("hedgehog", point[0] + shift_x, point[2]) + QUILL_BASE_EMBED for point in bases),
    )
    result = []
    for point, base, tip in zip(points, base_weights, tip_weights, strict=True):
        if tip >= 0.5 or base <= 0.125:
            result.append(tuple(point))
            continue
        fraction = min(1, (base - 0.125) / 0.375)
        blend = fraction * fraction * (3 - 2 * fraction)
        result.append((point[0] + shift_x * blend, point[1] - offset * blend, point[2]))
    return result, (shift_x, -offset, 0)


def material(name, color, roughness=0.7):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = True
    return obj


def surface(name, center, radii, mat, rings=28, segments=48, pear=0, flatten=1):
    """Closed sculptural quad surface: variable radial profile and rounded-square cross section."""
    verts = [(center[0], center[1], center[2] - radii[2])]
    for j in range(1, rings):
        phi = math.pi * j / rings
        z = -math.cos(phi)
        radial = math.sin(phi) * (1 - pear * z)
        for i in range(segments):
            a = 2 * math.pi * i / segments
            x, y = math.cos(a), math.sin(a)
            x = math.copysign(abs(x) ** flatten, x)
            y = math.copysign(abs(y) ** flatten, y)
            verts.append(
                (center[0] + radii[0] * radial * x, center[1] + radii[1] * radial * y, center[2] + radii[2] * z)
            )
    top = len(verts)
    verts.append((center[0], center[1], center[2] + radii[2]))
    faces = []
    for i in range(segments):
        faces.append((0, 1 + (i + 1) % segments, 1 + i))
    for j in range(rings - 2):
        start = 1 + j * segments
        for i in range(segments):
            nxt = (i + 1) % segments
            faces.append((start + i, start + nxt, start + segments + nxt, start + segments + i))
    last = 1 + (rings - 2) * segments
    for i in range(segments):
        faces.append((last + i, last + (i + 1) % segments, top))
    return mesh(name, verts, faces, mat)


def tube(name, points, radii, mat, sides=20, attach_quill=False):
    verts, faces = [], []
    for j, point in enumerate(points):
        tangent = Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(0, j - 1)])
        tangent.normalize()
        axis = tangent.cross(Vector((0, 1, 0)))
        if axis.length < 0.01:
            axis = tangent.cross(Vector((1, 0, 0)))
        axis.normalize()
        other = tangent.cross(axis).normalized()
        for i in range(sides):
            a = 2 * math.pi * i / sides
            p = Vector(point) + radii[j] * (axis * math.cos(a) + other * math.sin(a))
            verts.append(tuple(p))
    for j in range(len(points) - 1):
        for i in range(sides):
            a, b = j * sides + i, j * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces += [tuple(reversed(range(sides))), tuple((len(points) - 1) * sides + i for i in range(sides))]
    obj = mesh(name, verts, faces, mat)
    if attach_quill:
        base_tag = obj.vertex_groups.new(name="Temporary quill base")
        base_tag.add(list(range(sides)), 1, "REPLACE")
        tip_tag = obj.vertex_groups.new(name="Temporary quill tip")
        tip_tag.add(list(range((len(points) - 1) * sides, len(points) * sides)), 1, "REPLACE")
    modifier = obj.modifiers.new("Soft continuous contour", "SUBSURF")
    modifier.levels = 2
    apply(obj, modifier)
    if attach_quill:
        # Inspect all evaluated base-band vertices after subdivision, not only
        # the center or the original cage. Preserve topology and the tip band.
        coordinates = [tuple(vertex.co) for vertex in obj.data.vertices]
        memberships = [{group.group: group.weight for group in vertex.groups} for vertex in obj.data.vertices]
        projected, _ = attach_quill_points(
            coordinates,
            [groups.get(base_tag.index, 0) for groups in memberships],
            [groups.get(tip_tag.index, 0) for groups in memberships],
        )
        for vertex, coordinate in zip(obj.data.vertices, projected, strict=True):
            vertex.co = coordinate
        obj.vertex_groups.remove(tip_tag)
        obj.vertex_groups.remove(base_tag)
        obj.data.update()
    return obj


def apply(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def unite(objects, name, voxel=0.026):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = objects[0]
    obj.name = name
    remesh = obj.modifiers.new("Sculpt union", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    apply(obj, remesh)
    smooth = obj.modifiers.new("Sculpt polish", "SMOOTH")
    smooth.factor, smooth.iterations = 1.3, 7
    apply(obj, smooth)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def bind(obj, rig, weights):
    obj.parent = rig
    groups = {}
    for vertex in obj.data.vertices:
        for name, value in weights(vertex.co).items():
            if name not in groups:
                groups[name] = obj.vertex_groups.new(name=name)
            groups[name].add([vertex.index], value, "REPLACE")
    mod = obj.modifiers.new("Skeletal deformation", "ARMATURE")
    mod.object = rig


def fixed(name):
    return lambda _: {name: 1.0}


def rig_create():
    data = bpy.data.armatures.new("Companion anatomy")
    rig = bpy.data.objects.new("CompanionRig", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    specs = [
        ("root", (0, 0, 0), (0, 0, 0.25), None),
        ("hips", (0, 0, 0.45), (0, 0, 1.0), "root"),
        ("spine", (0, 0, 1.0), (0, 0, 1.55), "hips"),
        ("head", (0, 0, 1.55), (0, 0, 2.4), "spine"),
        ("tail.01", (0, 0.34, 0.7), (0, 0.78, 0.82), "hips"),
        ("tail.02", (0, 0.78, 0.82), (0, 1.25, 1.3), "tail.01"),
    ]
    for s, x in (("L", 1), ("R", -1)):
        specs.extend(
            [
                (f"upper_arm.{s}", (x * 0.54, 0, 1.6), (x * 0.77, -0.015, 1.22), "spine"),
                (f"forearm.{s}", (x * 0.77, -0.015, 1.22), (x * 0.82, -0.12, 0.83), f"upper_arm.{s}"),
                (f"hand.{s}", (x * 0.82, -0.12, 0.83), (x * 0.82, -0.13, 0.65), f"forearm.{s}"),
                (f"thigh.{s}", (x * 0.29, 0, 0.63), (x * 0.3, 0, 0.35), "hips"),
                (f"foot.{s}", (x * 0.3, 0, 0.35), (x * 0.3, -0.24, 0.13), f"thigh.{s}"),
                (f"ear.{s}", (x * 0.48, 0, 2.48), (x * 0.59, 0, 2.79), "head"),
                (f"blink.{s}", (x * 0.255, -0.52, 2.25), (x * 0.255, -0.52, 2.35), "head"),
            ]
        )
    for name, head, tail, parent in specs:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
    rig.show_in_front = True
    return rig


def skin_weights(co):
    x, _, z = co
    side = "L" if x > 0 else "R"

    def smooth(lower, upper, value):
        t = min(1, max(0, (value - lower) / (upper - lower)))
        return t * t * (3 - 2 * t)

    if z < 1.30:
        a = min(1, max(0, (z - 0.70) / 0.60))
        # Continuous hip/thigh transition on the unified skin. The old hard z=.60
        # boundary folded neighboring faces during the in-place step. Fade leg
        # influence toward the centerline too, so opposite legs cannot tear it.
        leg = (1 - smooth(0.42, 0.84, z)) * smooth(0.015, 0.20, abs(x))
        foot = leg * (1 - smooth(0.22, 0.42, z))
        return {
            "hips": (1 - a) * (1 - leg),
            "spine": a * (1 - leg),
            f"thigh.{side}": leg - foot,
            f"foot.{side}": foot,
        }
    a = min(1, max(0, (z - 1.45) / 0.4))
    return {"spine": 1 - a, "head": a}


def arm_weights(co, side):
    """A dedicated limb surface avoids assigning torso-flank vertices to an arm."""
    z = co.z
    if z > 1.15:
        a = max(0, min(1, (z - 1.15) / 0.25))
        return {f"upper_arm.{side}": a, f"forearm.{side}": 1 - a}
    a = max(0, min(1, (z - 0.76) / 0.24))
    return {f"forearm.{side}": a, f"hand.{side}": 1 - a}


def pointed_ear_point(point, center, radii, sign):
    """Closed rounded-triangle shell, with a broad buried root and a tapered tip."""
    x, y, z = point
    height = max(-1, min(1, (z - center[2]) / radii[2]))
    radial = math.sqrt(max(0, 1 - height * height))
    # The lower rounded part is embedded in the cranium. The visible upper
    # contour narrows almost linearly, unlike the previous tall oval profile.
    width = radii[0] * (
        math.sqrt(max(0, 1 - ((height + 0.2) / 0.8) ** 2)) if height < -0.2 else ((1 - height) / 1.2) ** 0.85
    )
    lateral = (x - center[0]) / (radii[0] * radial) if radial > 1e-8 else 0
    lean = sign * 0.055 * (height + 1) / 2
    x = center[0] + lean + width * lateral
    cavity = lateral * lateral + ((height - 0.1) / 0.82) ** 2
    if y < center[1] and cavity < 1:
        y += 0.085 * (1 - cavity) ** 2
    return x, y, z


def small_ear_center(kind, x, radius):
    """Seat a small ear into its own cranium instead of the bear's fixed height."""
    if kind not in ("otter", "capybara", "hedgehog") or radius <= 0:
        raise ValueError("Expected a supported small ear and positive radius")
    center, radii, pear, flatten = coat_profiles(kind)[1]
    lower, upper = center[2], center[2] + radii[2]
    for _ in range(48):
        middle = (lower + upper) / 2
        if profile_front_y(x, middle, center, radii, pear, flatten) is None:
            upper = middle
        else:
            lower = middle
    # Lower 70% of the radius overlaps the head. The existing hollow ear shell
    # and its pivot both follow this seat; species warp later moves both too.
    return x, 0, lower + radius * 0.30


def capybara_face(rig, coat, dark):
    """Broad blunt rostrum, small paired nostrils, and one quiet mouth line."""
    center, radii, flatten = (0, -0.55, 2.055), (0.38, 0.36, 0.185), 0.55
    muzzle = surface("Capybara blunt rostrum", center, radii, coat, 28, 48, flatten=flatten)
    bind(muzzle, rig, fixed("head"))
    for sign in (-1, 1):
        x, z = sign * 0.16, 2.14
        y = profile_front_y(x, z, center, radii, flatten=flatten)
        nostril = surface("Capybara nostril", (x, y + 0.003, z), (0.027, 0.013, 0.018), dark, 12, 20)
        bind(nostril, rig, fixed("head"))
    mouth_points = []
    for x, z in ((-0.15, 1.985), (-0.075, 1.971), (0, 1.968), (0.075, 1.971), (0.15, 1.985)):
        mouth_points.append((x, profile_front_y(x, z, center, radii, flatten=flatten) + 0.001, z))
    mouth = tube("Capybara quiet mouth", mouth_points, [0.007] * len(mouth_points), dark, 8)
    bind(mouth, rig, fixed("head"))


def ear(name, x, kind, mat, inner, rig):  # noqa: C901 - explicit species sculpt profiles
    z = 2.6
    rx, rz = (0.21, 0.23)
    if kind == "rabbit":
        rx, rz, z = 0.15, 0.64, 2.96
    elif kind == "cat":
        rx, rz, z = 0.26, 0.31, 2.57
        x *= 0.90
    elif kind == "fox":
        rx, rz, z = 0.25, 0.37, 2.65
        x *= 0.92
    elif kind == "red_panda":
        rx, rz, z = 0.22, 0.33, 2.70
    elif kind in ("otter", "capybara", "hedgehog"):
        rx, rz = 0.12, 0.12
        if kind == "capybara":
            x *= 0.90
        x, _, z = small_ear_center(kind, x, rz)
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bone = rig.data.edit_bones[name]
        bone.head = (x, 0, z - 0.08)
        bone.tail = (x + (0.045 if x > 0 else -0.045), 0, z + 0.15)
        bpy.ops.object.mode_set(mode="OBJECT")
    if kind in ("seal", "penguin"):
        return
    if kind == "dog":
        rx, rz, z = 0.20, 0.43, 2.26
        x *= 1.23
    outer = surface(name, (x, 0, z), (rx, 0.14, rz), mat)
    # Sculpt the cavity into the closed shell itself; an overlay disk would float in side view.
    for vertex in outer.data.vertices:
        if kind in ("cat", "fox"):
            vertex.co = pointed_ear_point(vertex.co, (x, 0, z), (rx, 0.14, rz), 1 if x > 0 else -1)
            continue
        r = math.sqrt(((vertex.co.x - x) / rx) ** 2 + ((vertex.co.z - z) / rz) ** 2)
        if vertex.co.y < 0 and r < 0.82:
            vertex.co.y += 0.115 * (1 - (r / 0.82) ** 2) ** 2
    outer.data.update()
    # One continuous coat lets cavity lighting define the inset; a per-face color
    # threshold produced a stair-step boundary after web decimation.
    bind(outer, rig, fixed(name))


def character(kind):  # noqa: C901 - authored anatomy and markings, not application control flow
    body_color, cream_color = COLORS[kind][1:]
    base = material("Matte coat", body_color)
    cream = material("Warm face and chest", cream_color)
    dark = material("Espresso details", (0.022, 0.014, 0.010), 0.4)
    eye = material("Soft glossy eyes", (0.007, 0.006, 0.005), 0.23)
    inner = material("Inner ear", tuple(v * 0.60 for v in body_color))
    rig = rig_create()
    body_profile, head_profile, neck_profile = coat_profiles(kind)
    body = surface("Pear torso", *body_profile[:2], base, pear=body_profile[2], flatten=body_profile[3])
    head = surface("Cheek and cranium", *head_profile[:2], base, pear=head_profile[2], flatten=head_profile[3])
    neck = surface("Neck transition", *neck_profile[:2], base, pear=neck_profile[2], flatten=neck_profile[3])
    parts = [body, head, neck]
    for s, sign in (("L", 1), ("R", -1)):
        arm = tube(
            "Sculpt arm",
            [
                (sign * 0.39, 0.02, 1.57),
                (sign * 0.50, 0.02, 1.58),
                (sign * 0.69, 0, 1.42),
                (sign * 0.78, -0.015, 1.20),
                (sign * 0.82, -0.09, 0.94),
                (sign * 0.81, -0.14, 0.73),
            ],
            [0.14, 0.19, 0.185, 0.16, 0.15, 0.08],
            base,
        )
        if kind in ("seal", "penguin"):
            for vertex in arm.data.vertices:
                vertex.co.y *= 0.58
                vertex.co.x *= 1.12
        leg = surface("Hind leg", (sign * 0.30, 0.02, 0.45), (0.245, 0.26, 0.33), base)
        foot = surface("Broad grounded paw", (sign * 0.30, -0.10, 0.19), (0.255, 0.34, 0.16), base, flatten=0.75)
        bind(arm, rig, lambda co, side=s: arm_weights(co, side))
        if kind == "seal":
            bpy.data.objects.remove(leg, do_unlink=True)
            bpy.data.objects.remove(foot, do_unlink=True)
        elif kind == "penguin":
            parts.append(leg)
            foot.data.materials.clear()
            foot.data.materials.append(material("Ochre feet", (0.72, 0.36, 0.09)))
            bind(foot, rig, fixed("foot." + s))
        else:
            parts += [leg, foot]
    skin = unite(parts, "Continuous sculpted skin")
    bind(skin, rig, lambda co: {"hips": 1.0} if kind == "seal" and co.z < 0.8 else skin_weights(co))
    for s, sign in (("L", 1), ("R", -1)):
        ear("ear." + s, sign * 0.50, kind, base, inner, rig)
        eye_offset = eye_surface_offset(kind)
        eyeball = surface("Eye " + s, (sign * 0.25, -0.487 + eye_offset, 2.25), (0.047, 0.040, 0.068), eye, 16, 24)
        bind(eyeball, rig, fixed("blink." + s))
        glint = surface(
            "Eye catchlight " + s,
            (sign * 0.25 - 0.009, -0.523 + eye_offset, 2.278),
            (0.010, 0.007, 0.012),
            cream,
            8,
            12,
        )
        bind(glint, rig, fixed("blink." + s))
        # Small separate toe grooves retain readability without busy surface noise.
        for i in range(0 if kind in ("seal", "penguin") else 3):
            groove = surface(
                "Paw toe inset", (sign * 0.30 + (i - 1) * 0.10, -0.402, 0.18), (0.010, 0.009, 0.024), inner, 8, 12
            )
            bind(groove, rig, fixed("foot." + s))
    muzzle_width = 0.30 if kind not in ("capybara", "seal", "otter") else 0.39
    if kind == "capybara":
        capybara_face(rig, base, dark)
    else:
        muzzle = surface("Sculpted muzzle", (0, -0.493, 2.06), (muzzle_width, 0.15, 0.205), cream, 24, 40, flatten=0.83)
        warp_face(muzzle, kind, muzzle_width)
        bind(muzzle, rig, fixed("head"))
        nose = surface(
            "Rounded triangular nose", (0, -0.642, 2.14), (0.093, 0.054, 0.061), dark, 16, 28, pear=-0.4, flatten=0.9
        )
        if kind == "penguin":
            nose.data.materials.clear()
            nose.data.materials.append(material("Warm beak", (0.77, 0.40, 0.10)))
            for vertex in nose.data.vertices:
                vertex.co.y = -0.58 + (vertex.co.y + 0.58) * 2.1
        warp_face(nose, kind, muzzle_width)
        bind(nose, rig, fixed("head"))
        for sign in (-1, 1):
            smile = tube(
                "Quiet smile",
                [
                    (0, -0.650, 2.105),
                    (sign * 0.025, -0.652, 2.035),
                    (sign * 0.082, -0.647, 2.005),
                    (sign * 0.138, -0.621, 2.04),
                ],
                [0.009] * 4,
                dark,
                8,
            )
            warp_face(smile, kind, muzzle_width)
            bind(smile, rig, fixed("head"))
            if kind in ("seal", "otter", "cat"):
                for level in range(3):
                    whisker = tube(
                        "Short sculpted whisker",
                        [
                            (sign * 0.23, -0.60, 2.07 - level * 0.035),
                            (sign * 0.36, -0.63, 2.09 - level * 0.045),
                            (sign * 0.44, -0.60, 2.12 - level * 0.055),
                        ],
                        [0.005, 0.004, 0.002],
                        inner,
                        6,
                    )
                    bind(whisker, rig, fixed("head"))
    tail_points = [(0, 0.39, 0.77), (0, 0.65, 0.78), (0, 0.73, 0.81)]
    tail_radii = [0.14, 0.16, 0.035]
    if kind in ("fox", "red_panda", "squirrel", "cat", "dog", "otter"):
        tail_points = [(0, 0.34, 0.73), (0, 0.60, 0.70), (0.04, 0.9, 0.83), (0.08, 1.08, 1.15), (0.09, 1.02, 1.52)]
        tail_radii = [0.11, 0.15, 0.21, 0.23, 0.025]
        if kind == "cat":
            tail_radii = [0.075, 0.08, 0.08, 0.08, 0.02]
        elif kind == "squirrel":
            tail_points += [(0.08, 0.74, 1.90), (0, 0.58, 1.93)]
            tail_radii = [0.13, 0.2, 0.30, 0.37, 0.36, 0.24, 0.03]
        elif kind == "otter":
            tail_points = [(0, 0.38, 0.65), (0, 0.63, 0.42), (0, 0.96, 0.27), (0, 1.28, 0.2)]
            tail_radii = [0.18, 0.16, 0.11, 0.018]
    if kind != "capybara":
        tail = tube("Species tail", tail_points, tail_radii, base)
        bind(
            tail,
            rig,
            lambda co: {
                "tail.01": max(0, 1 - min(1, (co.y - 0.6) / 0.4)),
                "tail.02": min(1, max(0, (co.y - 0.6) / 0.4)),
            },
        )
    if kind == "hedgehog":
        for row in range(7):
            for col in range(11):
                a = math.pi * (0.1 + 0.8 * col / 10)
                z = 0.77 + row * 0.205
                radius = 0.54 if z < 1.65 else 0.58
                x, y = radius * math.cos(a), 0.04 + 0.41 * math.sin(a)
                quill = tube(
                    "Soft sculpted quill",
                    [(x, y, z), (x * 1.13, y + 0.11, z + 0.10), (x * 1.18, y + 0.18, z + 0.22)],
                    [0.07, 0.052, 0.006],
                    inner,
                    8,
                    attach_quill=True,
                )
                bind(quill, rig, skin_weights)
    if kind == "seal":
        bpy.data.objects.remove(tail, do_unlink=True)
        for sign in (-1, 1):
            fin = tube(
                "Split rear fluke",
                [(0, 0.38, 0.72), (sign * 0.15, 0.74, 0.54), (sign * 0.27, 1.1, 0.34), (sign * 0.38, 1.23, 0.33)],
                [0.16, 0.19, 0.22, 0.04],
                base,
            )
            for vertex in fin.data.vertices:
                vertex.co.z = 0.52 + (vertex.co.z - 0.52) * 0.45
            bind(fin, rig, fixed("tail.01"))
    species_proportions(rig, kind)
    if coat_marking_outlines(kind):
        skin["sk7_surface_pattern"] = kind
        skin.data.materials.append(cream)
        skin["sk7_marking_material"] = len(skin.data.materials) - 1
        paint_surface_markings(skin)
    if kind in ("red_panda", "fox"):
        tail["sk7_surface_pattern"] = kind + "_tail"
        tail.data.materials.append(cream)
        tail["sk7_marking_material"] = len(tail.data.materials) - 1
        paint_surface_markings(tail)
    return rig


def species_proportions(rig, kind):  # noqa: C901 - anatomical warp applied identically to mesh and rig
    """Apply the same authored anatomical warp to rest geometry and bone endpoints."""

    def point(co):
        x, y, z = co
        if kind == "seal":
            return (x * 1.08, y * 1.35 + 0.38 * max(0, 1 - z / 1.8), z * 0.64)
        if kind == "capybara":
            return (x * 1.04, y * 1.10, z * 0.87)
        if kind == "hedgehog":
            return (x * 1.07, y * 1.06, z * 0.81)
        if kind == "penguin":
            return (x * 0.89, y, z * 0.95)
        if kind == "rabbit":
            return (x * 0.86, y * 0.94, z * 1.05)
        if kind == "otter":
            return (x * 0.88, y, z * 0.98)
        return tuple(co)

    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.parent == rig:
            for vertex in obj.data.vertices:
                vertex.co = point(vertex.co)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in rig.data.edit_bones:
        bone.head, bone.tail = point(bone.head), point(bone.tail)
    bpy.ops.object.mode_set(mode="OBJECT")


def animate(rig, kind):  # noqa: C901 - seven explicit authored pose tracks
    for clip in CLIPS:
        action = bpy.data.actions.new(clip)
        action.use_fake_user = True
        rig.animation_data_create()
        rig.animation_data.action = action
        for frame in range(1, 98, 4):
            t = (frame - 1) / 96
            a = 2 * math.pi * t if frame != 97 else 0
            sin, pulse = math.sin(a), (1 - math.cos(a)) / 2
            for bone in rig.pose.bones:
                bone.location = (0, 0, 0)
                bone.rotation_euler = (0, 0, 0)
                bone.scale = (1, 1, 1)
            rig.pose.bones["spine"].rotation_euler.x = 0.014 * sin
            rig.pose.bones["head"].rotation_euler.z = 0.017 * sin
            blink = 1 - 0.93 * max(0, 1 - abs(t - 0.46) / 0.045)
            for side in ("L", "R"):
                rig.pose.bones[f"blink.{side}"].scale.y = blink
            if clip == "greet":
                rig.pose.bones["upper_arm.L"].rotation_euler.z = -1.90 * pulse
                rig.pose.bones["forearm.L"].rotation_euler.y = 0.24 * math.sin(3 * a) * pulse
                rig.pose.bones["head"].rotation_euler.z = -0.12 * pulse
            elif clip == "move":
                for side, sign in (("L", 1), ("R", -1)):
                    rig.pose.bones[f"thigh.{side}"].rotation_euler.x = 0.23 * sin * sign
                    rig.pose.bones[f"foot.{side}"].rotation_euler.x = -0.12 * sin * sign
                    rig.pose.bones[f"upper_arm.{side}"].rotation_euler.x = -0.24 * sin * sign
                rig.pose.bones["root"].location.y = 0.045 * (1 - math.cos(2 * a))
                rig.pose.bones["tail.01"].rotation_euler.z = 0.1 * sin
                if kind == "penguin":
                    rig.pose.bones["spine"].rotation_euler.z = 0.10 * sin
                elif kind == "seal":
                    for side in ("L", "R"):
                        rig.pose.bones[f"upper_arm.{side}"].rotation_euler.x = 0.22 * sin
            elif clip == "curious":
                rig.pose.bones["head"].rotation_euler.y = 0.45 * sin
                rig.pose.bones["head"].rotation_euler.z = 0.10 * math.sin(2 * a)
                rig.pose.bones["ear.L"].rotation_euler.x = 0.14 * pulse
                rig.pose.bones["ear.R"].rotation_euler.x = -0.08 * pulse
            elif clip == "celebrate":
                rig.pose.bones["upper_arm.L"].rotation_euler.z = -0.90 * pulse
                rig.pose.bones["upper_arm.R"].rotation_euler.z = 0.90 * pulse
                rig.pose.bones["root"].location.y = 0.08 * (1 - math.cos(2 * a))
                rig.pose.bones["head"].rotation_euler.x = -0.09 * pulse
            elif clip == "rest":
                rig.pose.bones["head"].rotation_euler.x = 0.15 * pulse
                rig.pose.bones["spine"].rotation_euler.x = 0.045 * pulse
                for side in ("L", "R"):
                    rig.pose.bones[f"blink.{side}"].scale.y = 1 - 0.9 * pulse
            elif clip == "special":
                special_pose(rig, kind, a, pulse)
            for bone in rig.pose.bones:
                for path in ("location", "rotation_euler", "scale"):
                    bone.keyframe_insert(path, frame=frame, group=bone.name)
        for slot in action.slots:
            for layer in action.layers:
                for strip in layer.strips:
                    for curve in strip.channelbag(slot).fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation = "LINEAR"
    rig.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(1)


def fox_sit_displacement(pulse, vertical_leg_length):
    """Sagittal FK: bend the thighs while keeping both foot heads at rest XYZ."""
    if (
        not math.isfinite(pulse)
        or not 0 <= pulse <= 1
        or not math.isfinite(vertical_leg_length)
        or vertical_leg_length <= 0
    ):
        raise ValueError("Invalid fox sit phase or rest leg length")
    angle = -0.9 * pulse
    return angle, (0, -vertical_leg_length * math.sin(angle), -vertical_leg_length * (1 - math.cos(angle)))


def special_pose(rig, kind, a, pulse):  # noqa: C901 - species motion design table
    bones = rig.pose.bones
    if kind in ("bear", "otter", "seal"):
        for side, sign in (("L", 1), ("R", -1)):
            bones[f"upper_arm.{side}"].rotation_euler.x = -0.95 * pulse
            bones[f"upper_arm.{side}"].rotation_euler.z = sign * 0.28 * pulse
            bones[f"forearm.{side}"].rotation_euler.z = sign * (0.8 + 0.18 * math.sin(4 * a)) * pulse
            if kind == "otter":
                bones[f"hand.{side}"].rotation_euler.x = sign * 0.25 * math.sin(5 * a) * pulse
    elif kind in ("rabbit", "squirrel"):
        bones["root"].location.y = 0.17 * pulse**3
        bones["ear.L"].rotation_euler.x = 0.23 * math.sin(2 * a)
        bones["ear.R"].rotation_euler.x = -0.17 * math.sin(2 * a)
        bones["head"].rotation_euler.y = 0.3 * math.sin(2 * a) if kind == "squirrel" else 0.03 * math.sin(a)
    elif kind == "cat":
        bones["spine"].rotation_euler.x = 0.17 * pulse
        for side, sign in (("L", 1), ("R", -1)):
            bones[f"upper_arm.{side}"].rotation_euler.z = -sign * 1.7 * pulse
        bones["tail.01"].rotation_euler.z = 0.14 * math.sin(a)
    elif kind == "dog":
        bones["tail.01"].rotation_euler.z = 0.40 * math.sin(5 * a) * pulse
        bones["tail.02"].rotation_euler.z = 0.20 * math.sin(5 * a) * pulse
        bones["head"].rotation_euler.z = 0.1 * math.sin(a)
    elif kind == "red_panda":
        bones["spine"].rotation_euler.z = 0.16 * math.sin(a)
        bones["head"].rotation_euler.y = 0.32 * math.sin(a)
        bones["head"].location.y = 0.07 * pulse
    elif kind == "capybara":
        bones["head"].rotation_euler.x = 0.18 * math.sin(a)
    elif kind == "hedgehog":
        bones["spine"].rotation_euler.x = 0.32 * pulse
        bones["head"].rotation_euler.x = 0.28 * pulse
        for side, sign in (("L", 1), ("R", -1)):
            bones[f"forearm.{side}"].rotation_euler.z = sign * 0.6 * pulse
    elif kind == "penguin":
        bones["spine"].rotation_euler.z = 0.15 * math.sin(2 * a) * pulse
        bones["upper_arm.L"].rotation_euler.z = -1.1 * pulse
        bones["forearm.L"].rotation_euler.x = 0.18 * math.sin(4 * a) * pulse
    elif kind == "fox":
        # Both authored legs have the same Y/Z offsets; a world-X hinge keeps
        # their small opposite X slants intact. Convert through the actual rest
        # bases instead of assuming local X axes or pelvis translation axes.
        length = bones["thigh.L"].bone.head_local.z - bones["foot.L"].bone.head_local.z
        angle, displacement = fox_sit_displacement(pulse, length)
        hips_basis = bones["hips"].bone.matrix_local.to_3x3()
        bones["hips"].location = hips_basis.inverted() @ Vector(displacement)
        for side in ("L", "R"):
            for name, rotation in (("thigh", angle), ("foot", -angle)):
                bone = bones[f"{name}.{side}"]
                basis = bone.bone.matrix_local.to_3x3()
                bone.rotation_euler = (basis.inverted() @ Matrix.Rotation(rotation, 3, "X") @ basis).to_euler("XYZ")
        bones["tail.01"].rotation_euler.z = 1.00 * pulse
        bones["tail.02"].rotation_euler.z = 0.95 * pulse


def triangles(objects):
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def publish_stage(staged, final, signature):
    """Publish a minimally readable container exclusively; full QA still follows."""
    with staged.open("rb") as stream:
        header = stream.read(16)
    if len(header) < 16 or not header.startswith(signature):
        raise ValueError("Incomplete staged asset container; preserve it for diagnosis")
    os.link(staged, final)  # Exclusive publication: an existing result cannot be replaced.
    staged.unlink()


def save_blend(output, name):
    staged = output / (".stage-" + name)
    bpy.ops.wm.save_as_mainfile(filepath=str(staged))
    publish_stage(staged, output / name, b"BLENDER")


def export_variant(output, name, target):
    objs = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.parent]
    count = triangles(objs)
    ratio = min(1, target / count)
    skin_cleanup = []
    for obj in objs:
        if len(obj.data.polygons) > 100:
            dec = obj.modifiers.new("Web silhouette reduction", "DECIMATE")
            dec.ratio = ratio
            # Armature deformation remains live; reduce the rest mesh only.
            index = list(obj.modifiers).index(dec)
            bpy.context.view_layer.objects.active = obj
            for _ in range(index):
                bpy.ops.object.modifier_move_up(modifier=dec.name)
            apply(obj, dec)
            summary = prepare_decimated_skin(obj)
            if summary["vertices_changed"]:
                skin_cleanup.append(summary)
        paint_surface_markings(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE" or (obj.type == "MESH" and obj.parent):
            obj.select_set(True)
    path = output / f"{name}.glb"
    staged = output / f".stage-{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(staged),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_morph=False,
        export_all_influences=False,
        export_def_bones=True,
        export_force_sampling=True,
        export_anim_slide_to_zero=True,
        export_optimize_animation_size=True,
    )
    publish_stage(staged, path, b"glTF")
    return {
        "file": path.name,
        "triangles": triangles(objs),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "textures": 0,
        "material_mode": "PBR factors; no external textures",
        "skin_influence_cleanup": skin_cleanup,
    }


def studio():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 3
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1400
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "AgX"
    scene.world.color = (0.32, 0.32, 0.32)
    for name, loc, energy, size in (
        ("Large soft key", (-3, -4, 6), 480, 4),
        ("Gentle fill", (4, -2, 3), 230, 3),
        ("Rim", (1, 3, 4), 430, 3),
    ):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.shape, light.size = energy, "DISK", size
        obj = bpy.data.objects.new(name, light)
        bpy.context.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 1.3)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    data = bpy.data.cameras.new("Review camera")
    camera = bpy.data.objects.new("Review camera", data)
    bpy.context.collection.objects.link(camera)
    data.type, data.ortho_scale = "ORTHO", 3.75
    scene.camera = camera


def render_views(output):
    scene = bpy.context.scene
    camera = scene.camera
    for name, loc in (("front", (0, -7, 2.1)), ("side", (7, 0, 2.1)), ("back", (0, 7, 2.1)), ("hero", (4.4, -7, 3.0))):
        camera.location = loc
        camera.rotation_euler = (Vector((0, 0.08, 1.60)) - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(output / f"{name}.png")
        bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--species", choices=COLORS, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    repository = Path(__file__).resolve().parents[2]
    target = args.output.resolve()
    if target.is_relative_to(repository) or repository.is_relative_to(target):
        parser.error("Asset output must be outside and must not contain the repository")
    source_path = Path(__file__).resolve()
    source_bytes = source_path.read_bytes()
    source_relative = source_path.relative_to(repository).as_posix()
    generator_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repository, text=True).strip()
    committed_source = subprocess.check_output(["git", "show", f"{generator_commit}:{source_relative}"], cwd=repository)
    if committed_source != source_bytes:
        parser.error("Freeze the exact authoring source bytes in Git before generating assets")
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / "generator.py").write_bytes(source_bytes)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    rig = character(args.species)
    save_blend(args.output, "rigged.blend")
    animate(rig, args.species)
    studio()
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 97
    save_blend(args.output, "source.blend")
    standard = export_variant(args.output, "standard", 32000)
    save_blend(args.output, "standard.blend")
    if args.render:
        render_views(args.output)
    light = export_variant(args.output, "light", 13500)
    save_blend(args.output, "light.blend")
    final_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repository, text=True).strip()
    if final_commit != generator_commit or source_path.read_bytes() != source_bytes:
        raise RuntimeError("Authoring source or execution commit changed; candidate remains unverified")
    manifest = {
        "species": args.species,
        "name_ko": COLORS[args.species][0],
        "generator": "Blender " + bpy.app.version_string,
        "basis_commit": "c46c772486a30319e594dbb9cf555263d5fba1a9",
        "generator_repository_commit": generator_commit,
        "generator_source_matches_commit": True,
        "source_script_sha256": hashlib.sha256(source_bytes).hexdigest(),
        "clips": list(CLIPS),
        "clip_duration_seconds": 4,
        "fps": 24,
        "motion_mode": "in-place; vertical body bounce only, no horizontal root travel",
        "special": SPECIAL[args.species],
        "variants": {"standard": standard, "light": light},
        "quality_status": "pending independent import and visual/motion/browser QA",
        "human_review": "pending",
        "original_geometry": True,
        "paid_generation": False,
        "rig_bones": len(rig.data.bones),
    }
    staged_manifest = args.output / ".stage-asset-manifest.json"
    staged_manifest.write_text(json.dumps(manifest, ensure_ascii=False, allow_nan=False, indent=2), encoding="utf-8")
    assert json.loads(staged_manifest.read_bytes()) == manifest
    publish_stage(staged_manifest, args.output / "asset-manifest.json", b"{")
    print("SK7_ASSET_AUTHORED", args.species, json.dumps(manifest["variants"]))


if __name__ == "__main__":
    main()
