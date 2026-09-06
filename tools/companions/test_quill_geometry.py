"""Synthetic geometry checks; no Blender evaluation, graphics files, or renders."""

import ast
import math
import unittest
from collections import Counter, defaultdict
from pathlib import Path


def load_geometry():
    source = ast.parse(Path(__file__).with_name("build.py").read_text(encoding="utf-8"))
    functions = {
        "coat_profiles",
        "profile_front_y",
        "coat_back_y",
        "coat_x_interval",
        "attach_quill_points",
        "skin_weights",
        "hedgehog_quill_specs",
    }
    nodes = [
        node
        for node in source.body
        if isinstance(node, ast.FunctionDef)
        and node.name in functions
        or isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "QUILL_BASE_EMBED" for target in node.targets)
    ]
    namespace = {"math": math}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "build.py:quill_geometry", "exec"), namespace)
    return namespace


GEOMETRY = load_geometry()


def mean(points):
    return tuple(sum(point[axis] for point in points) / len(points) for axis in range(len(points[0])))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def normalize(point):
    length = math.sqrt(sum(value * value for value in point))
    return tuple(value / length for value in point)


def quill_fixture(row, col):
    """Actual authored quill cage with extra scalar base/tip tag coordinates."""
    spec = GEOMETRY["hedgehog_quill_specs"]()[row * 11 + col]
    return quill_cage(spec["points"], spec["radii"])


def legacy_quill_fixture(row, col):
    """Retain the detached old cage as a negative regression fixture."""
    angle = math.pi * (0.1 + 0.8 * col / 10)
    z = 0.77 + row * 0.205
    radius = 0.54 if z < 1.65 else 0.58
    x, y = radius * math.cos(angle), 0.04 + 0.41 * math.sin(angle)
    centers = [(x, y, z), (x * 1.13, y + 0.11, z + 0.10), (x * 1.18, y + 0.18, z + 0.22)]
    return quill_cage(centers, (0.07, 0.052, 0.006))


def quill_cage(centers, radii):
    """Pure tangent rings and interpolated tags; no Blender allocation emulation."""
    points = []
    for ring, (center, radius) in enumerate(zip(centers, radii, strict=True)):
        before, after = centers[max(0, ring - 1)], centers[min(2, ring + 1)]
        tangent = normalize(tuple(b - a for a, b in zip(before, after, strict=True)))
        axis = normalize(cross(tangent, (0, 1, 0)))
        other = normalize(cross(tangent, axis))
        for side in range(8):
            angle = side * math.pi / 4
            point = tuple(
                center[index] + radius * (axis[index] * math.cos(angle) + other[index] * math.sin(angle))
                for index in range(3)
            )
            points.append((*point, float(ring == 0), float(ring == 2)))
    faces = [
        (ring * 8 + side, ring * 8 + (side + 1) % 8, (ring + 1) * 8 + (side + 1) % 8, (ring + 1) * 8 + side)
        for ring in range(2)
        for side in range(8)
    ]
    faces.extend((tuple(reversed(range(8))), tuple(range(16, 24))))
    return points, faces


def subdivide(points, faces):
    """Closed Catmull-Clark geometry with linearly interpolated group tags.

    Actual Blender groups retained old-vertex weights and used edge/face means;
    smoothing those tags with the geometry hid high crown base-band vertices.
    This is still a geometry approximation, not byte-identical OpenSubdiv output.
    """
    face_points = [mean([points[index] for index in face]) for face in faces]
    edges, neighbors, incident = defaultdict(list), defaultdict(set), defaultdict(list)
    for index, face in enumerate(faces):
        for a, b in zip(face, (*face[1:], face[0]), strict=True):
            edges[tuple(sorted((a, b)))].append(index)
            neighbors[a].add(b)
            neighbors[b].add(a)
            incident[a].append(index)
    if any(len(adjacent) != 2 for adjacent in edges.values()):
        raise ValueError("Fixture must be closed")
    mapped = []
    for index, point in enumerate(points):
        count = len(neighbors[index])
        face_mean = mean([face_points[face] for face in incident[index]])
        edge_mean = mean([mean([point, points[other]]) for other in neighbors[index]])
        geometry = tuple(
            (face_mean[axis] + 2 * edge_mean[axis] + (count - 3) * point[axis]) / count for axis in range(3)
        )
        mapped.append((*geometry, *point[3:]))
    edge_ids = {}
    for edge, adjacent in edges.items():
        edge_ids[edge] = len(mapped)
        geometry = mean([points[edge[0]][:3], points[edge[1]][:3], *(face_points[index][:3] for index in adjacent)])
        tags = mean([points[edge[0]][3:], points[edge[1]][3:]])
        mapped.append((*geometry, *tags))
    face_start = len(mapped)
    mapped.extend(face_points)
    quads = []
    for index, face in enumerate(faces):
        for corner, vertex in enumerate(face):
            following, previous = face[(corner + 1) % len(face)], face[corner - 1]
            quads.append(
                (
                    vertex,
                    edge_ids[tuple(sorted((vertex, following)))],
                    face_start + index,
                    edge_ids[tuple(sorted((previous, vertex)))],
                )
            )
    return mapped, quads


def evaluate_fixture(row, col, levels=2, legacy=False):
    points, faces = legacy_quill_fixture(row, col) if legacy else quill_fixture(row, col)
    for _ in range(levels):
        points, faces = subdivide(points, faces)
    coordinates = [point[:3] for point in points]
    base, tip = [point[3] for point in points], [point[4] for point in points]
    attached, offset = GEOMETRY["attach_quill_points"](coordinates, base, tip)
    return coordinates, attached, faces, base, tip, offset


def topology_measurements(points, faces):
    edges, volume, areas = Counter(), 0, []
    for face in faces:
        for a, b in zip(face, (*face[1:], face[0]), strict=True):
            edges[tuple(sorted((a, b)))] += 1
        a = points[face[0]]
        for index in range(1, len(face) - 1):
            b, c = points[face[index]], points[face[index + 1]]
            normal = cross(tuple(b[i] - a[i] for i in range(3)), tuple(c[i] - a[i] for i in range(3)))
            areas.append(math.sqrt(sum(value * value for value in normal)) / 2)
            volume += sum(a[i] * cross(b, c)[i] for i in range(3)) / 6
    return min(areas), volume, set(edges.values())


class QuillGeometryTests(unittest.TestCase):
    def test_rear_profile_uses_torso_head_neck_union(self):
        back = GEOMETRY["coat_back_y"]
        self.assertAlmostEqual(back("hedgehog", 0, 1.05), 0.465)
        self.assertAlmostEqual(back("hedgehog", 0, 2.10), 0.46)
        # The torso/neck join is continuous, including the originally detached row.
        for z in (1.50, 1.59, 1.70):
            values = [back("hedgehog", 0, z + offset) for offset in (-1e-8, 0, 1e-8)]
            self.assertLess(max(values) - min(values), 1e-6)

    def test_every_subdivided_base_band_vertex_embeds_and_tip_skin_are_preserved(self):
        for row in range(7):
            for col in range(11):
                with self.subTest(row=row, col=col):
                    before, after, _, base, tip, offset = evaluate_fixture(row, col)
                    self.assertLessEqual(offset[1], 0)
                    base_count = tip_count = 0
                    for old, new, root, end in zip(before, after, base, tip, strict=True):
                        self.assertEqual(new[2], old[2])
                        self.assertEqual(GEOMETRY["skin_weights"](old), GEOMETRY["skin_weights"](new))
                        weights = [value for value in GEOMETRY["skin_weights"](new).values() if value > 0]
                        self.assertLessEqual(len(weights), 4)
                        self.assertAlmostEqual(sum(weights), 1)
                        self.assertTrue(all(math.isfinite(value) and 0 < value <= 1 for value in weights))
                        if root >= 0.5:
                            base_count += 1
                            self.assertAlmostEqual(new[0] - old[0], offset[0])
                            self.assertAlmostEqual(new[1] - old[1], offset[1])
                            clearance = GEOMETRY["coat_back_y"]("hedgehog", new[0], new[2]) - new[1]
                            self.assertGreaterEqual(clearance, 0.04 - 1e-12)
                            lower, upper = GEOMETRY["coat_x_interval"]("hedgehog", new[2])
                            self.assertGreaterEqual(min(new[0] - lower, upper - new[0]), 0.04 - 1e-12)
                            fronts = [
                                value
                                for profile in GEOMETRY["coat_profiles"]("hedgehog")
                                if (value := GEOMETRY["profile_front_y"](new[0], new[2], *profile)) is not None
                            ]
                            self.assertGreater(new[1], min(fronts), "Base must not cross through the front coat")
                        if end >= 0.5 or root <= 0.125:
                            tip_count += 1
                            self.assertEqual(old, new)
                    self.assertGreater(base_count, 8)
                    self.assertGreater(tip_count, 8)

    def test_base_face_interior_samples_are_embedded_too(self):
        for row in range(7):
            for col in range(11):
                _, after, faces, base, _, _ = evaluate_fixture(row, col)
                for face in faces:
                    if min(base[index] for index in face) < 0.5:
                        continue
                    samples = [mean([after[index] for index in face])]
                    samples.extend(mean([after[a], after[b]]) for a, b in zip(face, (*face[1:], face[0]), strict=True))
                    for point in samples:
                        self.assertGreater(
                            GEOMETRY["coat_back_y"]("hedgehog", point[0], point[2]) - point[1],
                            0.03,
                            (row, col, point),
                        )

    def test_subdivided_closed_shapes_retain_positive_volume_and_nonzero_faces(self):
        for row in range(7):
            for col in range(11):
                with self.subTest(row=row, col=col):
                    before, after, faces, _, _, _ = evaluate_fixture(row, col)
                    for shape in (before, after):
                        area, volume, edge_counts = topology_measurements(shape, faces)
                        self.assertGreater(area, 1e-10)
                        self.assertGreater(volume, 0)
                        self.assertEqual(edge_counts, {2})

    def test_original_detached_quill_and_center_only_repair_are_detected(self):
        before, after, _, base, _, _ = evaluate_fixture(4, 5, levels=0, legacy=True)
        back = GEOMETRY["coat_back_y"]
        self.assertGreater(min(point[1] - back("hedgehog", point[0], point[2]) for point in before), 0.0279)
        center = mean([point for point, weight in zip(before, base, strict=True) if weight >= 0.5])
        center_offset = center[1] - back("hedgehog", center[0], center[2]) + 0.04
        residual = [
            back("hedgehog", point[0], point[2]) - (point[1] - center_offset)
            for point, weight in zip(before, base, strict=True)
            if weight >= 0.5
        ]
        self.assertLess(min(residual), 0, "Moving the center leaves an exposed ring edge")
        self.assertGreaterEqual(
            min(
                back("hedgehog", point[0], point[2]) - point[1]
                for point, weight in zip(after, base, strict=True)
                if weight >= 0.5
            ),
            0.04 - 1e-12,
        )

    def test_blend_is_continuous_and_already_embedded_shape_is_unchanged(self):
        attach = GEOMETRY["attach_quill_points"]
        point = (0, 0.5, 1.59)
        for boundary in (0.125, 0.5):
            values = []
            for weight in (boundary - 1e-8, boundary, boundary + 1e-8):
                result, _ = attach([point, point], [1, weight], [0, 0])
                values.append(result[1][1])
            self.assertLess(max(values) - min(values), 1e-10)
        points = [(0, 0.1, 1.59), (0, 0.6, 1.75), (0, 0.64, 1.8)]
        result, offset = attach(points, [1, 0.25, 0], [0, 0.2, 1])
        self.assertEqual(offset, (0, 0, 0))
        self.assertEqual(result, points)

    def test_invalid_coordinates_tags_and_unsupported_footprint_fail_closed(self):
        attach = GEOMETRY["attach_quill_points"]
        for point in ((0, math.nan, 1.5), (0, math.inf, 1.5), (0, 0.5), (100, 0.5, 100)):
            with self.subTest(point=point), self.assertRaises(ValueError):
                attach([point], [1], [0])
        for base, tip in (([math.nan], [0]), ([1.1], [0]), ([1], [0.5]), ([0], [1]), ([1], [])):
            with self.subTest(base=base, tip=tip), self.assertRaises(ValueError):
                attach([(0, 0.5, 1.5)], base, tip)
        with self.assertRaises(ValueError):
            attach([], [], [])


if __name__ == "__main__":
    unittest.main()
