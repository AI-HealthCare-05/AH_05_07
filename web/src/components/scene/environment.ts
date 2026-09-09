import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { SceneLandmark } from "../../ui/scenePolicy";

/** Repository-authored clay study. Acceptance remains review-only. */
export function createLandmark(id: SceneLandmark["id"]): THREE.Group {
  const root = new THREE.Group();
  const palette = { wood: 0xb68b69, woodLight: 0xd0ad86, stone: 0xd9d2bc, cream: 0xeee2c6,
    sage: 0x96ac86, leaf: 0xb7c39a, lavender: 0x8b839b, water: 0x9fc6bf, coral: 0xe9a08a };
  type Color = keyof typeof palette;
  const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) =>
    [key, new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 })])) as Record<Color, THREE.MeshStandardMaterial>;
  const batches = new Map<Color, THREE.BufferGeometry[]>();
  const add = (geometry: THREE.BufferGeometry, color: Color, position: number[], scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.applyMatrix4(matrix);
    const bucket = batches.get(color) ?? [];
    bucket.push(flat); batches.set(color, bucket);
  };
  const box = (size: number[], position: number[], color: Color = "wood", rotation = [0, 0, 0]) =>
    add(new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(...size) * 0.25), color, position, [1, 1, 1], rotation);
  const pebble = (position: number[], scale: number[], color: Color = "stone") =>
    add(new THREE.SphereGeometry(1, 16, 10), color, position, scale);
  const stem = (from: number[], to: number[], radius: number, color: Color = "wood") => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const geometry = new THREE.CylinderGeometry(radius * 0.8, radius, a.distanceTo(b), 10);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    add(geometry, color, a.add(b).multiplyScalar(0.5).toArray());
  };
  const rail = (points: number[][], color: Color = "wood", radius = 0.045) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), 16, radius, 6, false), color, [0, 0, 0]);
  const leaves = (x: number, y: number, z: number, size = 1) => {
    for (let index = 0; index < 5; index++) {
      const angle = index * Math.PI * 0.4;
      const leaf = new THREE.SphereGeometry(1, 12, 8);
      add(leaf, index % 2 ? "sage" : "leaf", [x + Math.cos(angle) * size * 0.12, y + size * 0.17, z + Math.sin(angle) * size * 0.12],
        [size * 0.09, size * 0.27, size * 0.07], [Math.sin(angle) * 0.65, 0, -Math.cos(angle) * 0.65]);
    }
  };
  const bench = (x: number, z: number) => {
    for (const dz of [-0.14, 0.02, 0.18]) box([1.05, 0.085, 0.13], [x, 0.43, z + dz], "woodLight");
    for (const dx of [-0.4, 0.4]) box([0.12, 0.32, 0.28], [x + dx, 0.24, z]);
    for (const y of [0.62, 0.77]) box([1.04, 0.1, 0.085], [x, y, z - 0.18], "woodLight");
    for (const dx of [-0.4, 0.4]) box([0.075, 0.5, 0.075], [x + dx, 0.54, z - 0.2]);
  };
  // Rounded clay island, a short path, and a few planted edges form one place.
  add(new THREE.LatheGeometry([[0, -0.15], [1.46, -0.15], [1.64, -0.1], [1.7, 0], [1.64, 0.09], [1.45, 0.12], [0, 0.12]].map(p => new THREE.Vector2(...p)), 48), "cream", [-0.3, 0, 0], [1.3, 1, 0.9]);
  for (let i = 0; i < 5; i++) {
    pebble([-0.82 + i * 0.36, 0.125, 0.96 - Math.sin(i * 0.65) * 0.13], [0.2, 0.045, 0.13], i % 2 ? "stone" : "woodLight");
  }
  pebble([1.1, 0.14, 0.22], [0.3, 0.1, 0.19]);
  pebble([1.29, 0.13, 0.37], [0.18, 0.075, 0.12]);
  leaves(1.12, 0.13, -0.4, 0.7);
  leaves(-1.18, 0.13, -0.25, 0.55);

  if (id === "garden-gate") {
    for (const x of [-0.68, 0.68]) {
      box([0.34, 0.18, 0.34], [x, 0.17, -0.12], "stone");
      box([0.19, 1.36, 0.2], [x, 0.87, -0.12]);
      box([0.31, 0.12, 0.32], [x, 1.5, -0.12], "woodLight");
    }
    box([1.8, 0.16, 0.32], [0, 1.48, -0.12], "woodLight");
    // Curved eaves and separate rolled tiles, rather than a flat rectangular cap.
    for (let i = 0; i < 11; i++) {
      const x = (i - 5) * 0.17;
      const edgeLift = Math.pow(Math.abs(x) / 0.85, 3) * 0.12;
      rail([[x, 1.61 + edgeLift, -0.62], [x, 1.76, -0.12], [x, 1.61 + edgeLift, 0.38]], "lavender", 0.085);
    }
    rail([[-1.03, 1.79, -0.12], [0, 1.85, -0.12], [1.03, 1.79, -0.12]], "lavender", 0.07);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) box([0.105, 0.6, 0.085], [side * (0.87 + i * 0.14), 0.43, -0.12], "woodLight");
      box([0.62, 0.09, 0.1], [side * 1.12, 0.68, -0.12]);
    }
  } else if (id === "herb-garden") {
    box([1.75, 0.25, 0.98], [0, 0.28, -0.16], "woodLight");
    box([1.53, 0.07, 0.79], [0, 0.4, -0.16], "wood");
    for (const x of [-0.53, 0, 0.53]) for (const z of [-0.42, 0.05]) leaves(x, 0.42, z, 0.9);
    // A small unlabelled terracotta planter anchors the near corner.
    add(new THREE.CylinderGeometry(0.22, 0.16, 0.29, 18), "coral", [0.95, 0.28, 0.54]);
    add(new THREE.TorusGeometry(0.21, 0.027, 6, 20), "coral", [0.95, 0.43, 0.54], [1, 1, 1], [Math.PI / 2, 0, 0]);
    leaves(0.95, 0.43, 0.54, 0.7);
  } else if (id === "shade-tree") {
    stem([0.33, 0.12, -0.45], [0.26, 1.58, -0.45], 0.14);
    stem([0.27, 0.96, -0.45], [-0.24, 1.61, -0.43], 0.065);
    stem([0.27, 1.13, -0.45], [0.73, 1.76, -0.47], 0.065);
    pebble([0.27, 1.87, -0.48], [0.73, 0.55, 0.57], "sage");
    pebble([-0.23, 1.68, -0.4], [0.51, 0.44, 0.44], "leaf");
    pebble([0.76, 1.75, -0.46], [0.48, 0.42, 0.43], "leaf");
    bench(0.12, 0.38);
  } else if (id === "footbridge") {
    pebble([0, 0.13, -0.13], [1.39, 0.035, 0.76], "water");
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 0.2;
      box([0.19, 0.12, 0.77], [x, 0.35 + (1 - (x / 0.9) ** 2) * 0.18, -0.12], "woodLight");
    }
    for (const z of [-0.56, 0.32]) {
      rail([[-0.96, 0.89, z], [0, 1.06, z], [0.96, 0.89, z]], "wood", 0.06);
      for (const x of [-0.88, 0, 0.88]) {
        box([0.1, 0.59, 0.1], [x, 0.62, z]);
        pebble([x, 0.95 + (x === 0 ? 0.13 : 0), z], [0.09, 0.06, 0.09], "woodLight");
      }
    }
    for (const x of [-1.18, 1.18]) pebble([x, 0.2, -0.08], [0.21, 0.13, 0.5]);
  } else if (id === "reading-shelter") {
    box([1.82, 0.16, 1.15], [0, 0.19, -0.17], "stone");
    for (const x of [-0.69, 0.69]) for (const z of [-0.57, 0.28]) box([0.11, 1.23, 0.11], [x, 0.89, z]);
    for (let i = 0; i < 7; i++) box([1.96, 0.12, 0.12], [0, 1.59, -0.74 + i * 0.2], "woodLight");
    for (const x of [-0.68, 0.68]) box([0.11, 0.14, 1.36], [x, 1.49, -0.14]);
    bench(0, -0.2);
    box([0.65, 0.09, 0.43], [0.2, 0.57, 0.58], "woodLight");
    box([0.11, 0.36, 0.13], [0.2, 0.35, 0.58]);
    box([0.31, 0.055, 0.22], [0.23, 0.65, 0.59], "lavender", [0, 0.13, 0]);
    box([0.27, 0.025, 0.19], [0.23, 0.678, 0.59], "cream", [0, 0.13, 0]);
  } else if (id === "pavilion") {
    box([1.76, 0.19, 1.25], [0, 0.23, -0.17], "stone");
    box([1.62, 0.07, 1.12], [0, 0.36, -0.17], "woodLight");
    for (const x of [-0.61, 0.61]) for (const z of [-0.56, 0.22]) {
      box([0.13, 1.05, 0.13], [x, 0.91, z]);
      box([0.28, 0.1, 0.28], [x, 1.43, z], "woodLight");
    }
    for (let i = 0; i < 11; i++) {
      const x = (i - 5) * 0.18;
      const lift = Math.pow(Math.abs(x) / 0.9, 3) * 0.15;
      rail([[x, 1.57 + lift, -0.89], [x * 0.83, 1.75, -0.49], [x * 0.72, 1.98, -0.17], [x * 0.83, 1.75, 0.15], [x, 1.57 + lift, 0.55]], "lavender", 0.09);
    }
    rail([[-0.8, 2.04, -0.17], [0, 2.06, -0.17], [0.8, 2.04, -0.17]], "lavender", 0.07);
    box([1.2, 0.085, 0.085], [0, 0.83, -0.57], "woodLight");
    for (const x of [-0.4, -0.13, 0.13, 0.4]) box([0.055, 0.39, 0.055], [x, 0.62, -0.57], "woodLight");
    box([0.62, 0.09, 0.27], [0, 0.16, 0.66], "stone");
  } else {
    box([1.9, 0.15, 0.88], [0, 0.24, -0.03], "woodLight");
    for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) box([0.018, 0.012, 0.8], [x, 0.322, -0.03], "wood");
    rail([[-0.9, 0.83, -0.46], [0, 0.86, -0.46], [0.9, 0.83, -0.46]], "wood", 0.055);
    for (const x of [-0.8, 0, 0.8]) box([0.08, 0.51, 0.08], [x, 0.58, -0.46]);
    // Fixed sculptural sunset, unrelated to measurements or completion.
    pebble([0.15, 1.21, -0.73], [0.43, 0.43, 0.11], "coral");
    pebble([-0.46, 0.48, -0.87], [0.68, 0.27, 0.13], "sage");
    pebble([0.6, 0.53, -0.89], [0.59, 0.32, 0.13], "leaf");
  }
  // Static scenery is merged by palette: one draw per used color, no per-prop RAF.
  for (const [color, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach(part => part.dispose());
    if (!geometry) throw new Error("Clay geometry attributes must match");
    root.add(new THREE.Mesh(geometry, materials[color]));
  }
  for (const color of Object.keys(materials) as Color[]) if (!batches.has(color)) materials[color].dispose();
  return root;
}
