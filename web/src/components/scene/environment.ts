import * as THREE from "three";
import type { SceneLandmark } from "../../ui/scenePolicy";

/** Procedural review geometry; not an approved production environment asset. */
export function createLandmark(id: SceneLandmark["id"]): THREE.Group {
  const root = new THREE.Group();
  const materials = {
    wood: new THREE.MeshStandardMaterial({ color: 0xb88759, roughness: 0.95 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xded4bf, roughness: 1 }),
    sage: new THREE.MeshStandardMaterial({ color: 0xa5b59a, roughness: 1 }),
    lavender: new THREE.MeshStandardMaterial({ color: 0x958ca5, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0xa7c8c2, roughness: 0.85 }),
    coral: new THREE.MeshStandardMaterial({ color: 0xe58468, roughness: 1 }),
  };
  type Material = keyof typeof materials;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: Material = "wood") => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const canopy = (x: number, y: number, z: number, radius: number, material: Material = "sage") => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), materials[material]);
    mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.45, 0.14, 32), materials.stone);
  base.position.y = -0.04; root.add(base);
  if (id === "garden-gate") {
    for (const x of [-0.72, 0.72]) box(0.18, 1.55, 0.22, x, 0.78, 0);
    box(1.95, 0.18, 0.45, 0, 1.56, 0);
    box(2.1, 0.12, 0.68, 0, 1.71, 0, "lavender");
  } else if (id === "herb-garden") {
    box(1.8, 0.24, 1, 0, 0.15, 0, "wood");
    for (const x of [-0.55, 0, 0.55]) { canopy(x, 0.52, 0.08, 0.4); canopy(x, 0.4, -0.3, 0.25); }
  } else if (id === "shade-tree") {
    box(0.23, 1.65, 0.23, 0.3, 0.82, -0.3);
    canopy(0.3, 1.9, -0.3, 0.9);
    box(1.2, 0.13, 0.42, -0.15, 0.45, 0.55);
    for (const x of [-0.6, 0.3]) box(0.12, 0.4, 0.3, x, 0.22, 0.55);
  } else if (id === "footbridge") {
    box(2.4, 0.035, 1.3, 0, 0.06, 0, "water");
    box(1.65, 0.16, 0.72, 0, 0.32, 0);
    for (const z of [-0.43, 0.43]) {
      box(1.85, 0.1, 0.1, 0, 0.9, z);
      for (const x of [-0.75, 0.75]) box(0.1, 0.65, 0.1, x, 0.58, z);
    }
  } else if (id === "reading-shelter" || id === "pavilion") {
    const pavilion = id === "pavilion";
    box(1.75, 0.18, 1.25, 0, 0.16, 0, "stone");
    for (const x of [-0.65, 0.65]) for (const z of [-0.43, 0.43]) box(0.12, 1.15, 0.12, x, 0.82, z);
    box(1.6, 0.15, 0.38, 0, 0.44, -0.3);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(pavilion ? 1.38 : 1.2, pavilion ? 0.6 : 0.35, 4), materials[pavilion ? "lavender" : "wood"]);
    roof.rotation.y = Math.PI / 4; roof.position.y = 1.65; root.add(roof);
  } else {
    box(2, 0.16, 1.3, 0, 0.16, 0, "stone");
    box(1.8, 0.09, 0.09, 0, 0.82, -0.48);
    for (const x of [-0.8, 0, 0.8]) box(0.08, 0.65, 0.08, x, 0.48, -0.48);
    canopy(0.35, 1.4, -0.7, 0.43, "coral");
  }
  // Dispose unused palette materials now; used resources belong to the scene.
  const used = new Set<THREE.Material>();
  root.traverse((object) => { if (object instanceof THREE.Mesh) used.add(object.material); });
  Object.values(materials).filter((material) => !used.has(material)).forEach((material) => material.dispose());
  return root;
}
