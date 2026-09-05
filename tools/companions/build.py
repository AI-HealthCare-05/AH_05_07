"""Author original SK7 companions in Blender; never touches application/model data.

Run with Blender --background --factory-startup --python this_file -- --species bear --output NEW_DIR.
All meshes, skin weights, PBR materials and seven skeletal actions are editable.
"""

import argparse
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector

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


def tube(name, points, radii, mat, sides=20):
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
    modifier = obj.modifiers.new("Soft continuous contour", "SUBSURF")
    modifier.levels = 2
    apply(obj, modifier)
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
    if z < 0.60:
        a = min(1, max(0, (z - 0.26) / 0.30))
        return {f"thigh.{side}": a, f"foot.{side}": 1 - a}
    if z < 1.30:
        a = min(1, max(0, (z - 0.70) / 0.60))
        return {"hips": 1 - a, "spine": a}
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


def ear(name, x, kind, mat, inner, rig):  # noqa: C901 - explicit species sculpt profiles
    z = 2.6
    rx, rz = (0.21, 0.23)
    if kind == "rabbit":
        rx, rz, z = 0.15, 0.64, 2.96
    elif kind in ("cat", "fox", "red_panda"):
        rx, rz, z = 0.22, 0.33, 2.70
    elif kind in ("otter", "capybara", "hedgehog"):
        rx, rz = 0.12, 0.12
    if kind in ("seal", "penguin"):
        return
    if kind == "dog":
        rx, rz, z = 0.20, 0.43, 2.26
        x *= 1.23
    outer = surface(name, (x, 0, z), (rx, 0.14, rz), mat, pear=0.22 if kind in ("fox", "cat") else 0)
    # Sculpt the cavity into the closed shell itself; an overlay disk would float in side view.
    for vertex in outer.data.vertices:
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
    width = 0.60 if kind not in ("seal", "capybara", "hedgehog") else 0.68
    body = surface("Pear torso", (0, 0.015, 1.05), (width, 0.45, 0.81), base, pear=0.18)
    head_scale = (0.67, 0.51, 0.59)
    if kind in ("fox", "squirrel", "cat"):
        head_scale = (0.64, 0.47, 0.54)
    if kind == "capybara":
        head_scale = (0.66, 0.53, 0.49)
    head = surface("Cheek and cranium", (0, -0.01, 2.10), head_scale, base, pear=0.10, flatten=0.86)
    neck = surface("Neck transition", (0, 0.025, 1.64), (0.39, 0.35, 0.4), base)
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
            foot.data.materials.append(material("Ochre webbed feet", (0.72, 0.36, 0.09)))
            bind(foot, rig, fixed("foot." + s))
        else:
            parts += [leg, foot]
    skin = unite(parts, "Continuous sculpted skin")
    bind(skin, rig, lambda co: {"hips": 1.0} if kind == "seal" and co.z < 0.8 else skin_weights(co))
    for s, sign in (("L", 1), ("R", -1)):
        ear("ear." + s, sign * 0.50, kind, base, inner, rig)
        eyeball = surface("Eye " + s, (sign * 0.25, -0.487, 2.25), (0.047, 0.040, 0.068), eye, 16, 24)
        bind(eyeball, rig, fixed("blink." + s))
        glint = surface(
            "Eye catchlight " + s, (sign * 0.25 - 0.009, -0.523, 2.278), (0.010, 0.007, 0.012), cream, 8, 12
        )
        bind(glint, rig, fixed("blink." + s))
        if kind == "penguin":
            patch = surface("Ivory penguin face", (sign * 0.25, -0.452, 2.22), (0.20, 0.050, 0.275), cream, 20, 32)
            bind(patch, rig, fixed("head"))
        # Small separate toe grooves retain readability without busy surface noise.
        for i in range(0 if kind in ("seal", "penguin") else 3):
            groove = surface(
                "Paw toe inset", (sign * 0.30 + (i - 1) * 0.10, -0.402, 0.18), (0.010, 0.009, 0.024), inner, 8, 12
            )
            bind(groove, rig, fixed("foot." + s))
    muzzle_width = 0.30 if kind not in ("capybara", "seal", "otter") else 0.39
    muzzle = surface("Sculpted muzzle", (0, -0.493, 2.06), (muzzle_width, 0.15, 0.205), cream, 24, 40, flatten=0.83)
    if kind in ("fox", "cat", "squirrel"):
        for vertex in muzzle.data.vertices:
            vertex.co.y -= 0.07 * (1 - abs(vertex.co.x) / muzzle_width)
    if kind == "capybara":
        for vertex in muzzle.data.vertices:
            vertex.co.y = -0.49 + (vertex.co.y + 0.49) * 1.55
            vertex.co.z = 2.06 + (vertex.co.z - 2.06) * 0.83
    bind(muzzle, rig, fixed("head"))
    nose = surface(
        "Rounded triangular nose", (0, -0.642, 2.14), (0.093, 0.054, 0.061), dark, 16, 28, pear=-0.4, flatten=0.9
    )
    if kind == "penguin":
        nose.data.materials.clear()
        nose.data.materials.append(material("Warm beak", (0.77, 0.40, 0.10)))
        for vertex in nose.data.vertices:
            vertex.co.y = -0.58 + (vertex.co.y + 0.58) * 2.1
    bind(nose, rig, fixed("head"))
    if kind == "capybara":
        for vertex in nose.data.vertices:
            vertex.co.y -= 0.065
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
        bind(smile, rig, fixed("head"))
        if kind == "capybara":
            for vertex in smile.data.vertices:
                vertex.co.y -= 0.065
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
    if kind in ("red_panda", "fox", "penguin", "otter", "squirrel", "seal"):
        bib = surface("Chest bib", (0, -0.405, 1.14), (0.32, 0.064, 0.43), cream, 20, 32, pear=0.13)
        bind(bib, rig, skin_weights)
    if kind == "red_panda":
        for sign in (-1, 1):
            patch = surface("Panda cheek marking", (sign * 0.41, -0.397, 2.18), (0.15, 0.05, 0.17), cream, 16, 24)
            bind(patch, rig, fixed("head"))
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
    if kind == "capybara":
        tail_radii = [0.065, 0.06, 0.015]
    tail = tube("Species tail", tail_points, tail_radii, base)
    bind(
        tail,
        rig,
        lambda co: {"tail.01": max(0, 1 - min(1, (co.y - 0.6) / 0.4)), "tail.02": min(1, max(0, (co.y - 0.6) / 0.4))},
    )
    if kind in ("fox", "red_panda"):
        tail.data.materials.append(cream)
        for polygon in tail.data.polygons:
            center = polygon.center
            if (kind == "fox" and center.z > 1.33) or (kind == "red_panda" and int(center.z * 12) % 3 == 0):
                polygon.material_index = 1
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
                rig.pose.bones["root"].location.z = 0.045 * (1 - math.cos(2 * a))
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
                rig.pose.bones["root"].location.z = 0.08 * (1 - math.cos(2 * a))
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
        bones["root"].location.z = 0.17 * pulse**3
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
        bones["hips"].location.y = -0.10 * pulse
        bones["thigh.L"].rotation_euler.x = -0.3 * pulse
        bones["thigh.R"].rotation_euler.x = -0.3 * pulse
        bones["tail.01"].rotation_euler.z = 1.00 * pulse
        bones["tail.02"].rotation_euler.z = 0.95 * pulse


def triangles(objects):
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def export_variant(output, name, target):
    objs = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.parent]
    count = triangles(objs)
    ratio = min(1, target / count)
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
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE" or (obj.type == "MESH" and obj.parent):
            obj.select_set(True)
    path = output / f"{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
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
    return {
        "file": path.name,
        "triangles": triangles(objs),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "textures": 0,
        "material_mode": "PBR factors; no external textures",
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
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / "generator.py").write_bytes(Path(__file__).read_bytes())
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    rig = character(args.species)
    animate(rig, args.species)
    studio()
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 97
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "source.blend"))
    standard = export_variant(args.output, "standard", 32000)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "standard.blend"))
    if args.render:
        render_views(args.output)
    light = export_variant(args.output, "light", 13500)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "light.blend"))
    generator_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repository, text=True).strip()
    source_relative = Path(__file__).resolve().relative_to(repository).as_posix()
    source_status = subprocess.check_output(
        ["git", "status", "--porcelain", "--", source_relative], cwd=repository, text=True
    )
    manifest = {
        "species": args.species,
        "name_ko": COLORS[args.species][0],
        "generator": "Blender " + bpy.app.version_string,
        "basis_commit": "c46c772486a30319e594dbb9cf555263d5fba1a9",
        "generator_repository_commit": generator_commit,
        "generator_source_matches_commit": not bool(source_status.strip()),
        "source_script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
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
    (args.output / "asset-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("SK7_ASSET_AUTHORED", args.species, json.dumps(manifest["variants"]))


if __name__ == "__main__":
    main()
