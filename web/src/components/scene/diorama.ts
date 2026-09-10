import * as THREE from "three";
import { createLandmark } from "./environment";
import { sceneLandmarks, type SceneLandmark } from "../../ui/scenePolicy";
import type { SceneProfile } from "../../ui/sceneRecipes";

/** Calendar scenery only. Record windows and challenge progress are not inputs. */
export function createDiorama(focal: SceneLandmark["id"], profile: SceneProfile): THREE.Group {
  const root = new THREE.Group();
  const index = sceneLandmarks.findIndex(landmark => landmark.id === focal);
  const placements = profile === "desktop"
    ? [
      { offset: 0, x: 0, z: 0, scale: 1 },
      { offset: -1, x: -3.15, z: -0.65, scale: 0.65 },
      { offset: 1, x: 3.3, z: -0.75, scale: 0.72 },
      { offset: -2, x: -4.9, z: -2.65, scale: 0.48 },
      { offset: -3, x: -2.15, z: -2.95, scale: 0.48 },
      { offset: 3, x: 0.65, z: -3.1, scale: 0.48 },
      { offset: 2, x: 3.55, z: -2.8, scale: 0.48 },
    ]
    : [{ offset: 0, x: 0, z: 0, scale: 1 }, { offset: 1, x: 3.3, z: -0.75, scale: 0.72 }];
  root.userData.landmarkIds = placements.map(placement => sceneLandmarks[(index + placement.offset + 7) % 7].id);
  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d2bc, roughness: 0.94 });
  for (const [order, placement] of placements.entries()) {
    const landmark = createLandmark(root.userData.landmarkIds[order]);
    landmark.name = order === 0 ? "focal-landmark" : "surrounding-landmark";
    landmark.position.set(placement.x, 0, placement.z);
    landmark.scale.setScalar(placement.scale);
    root.add(landmark);
    if (order === 0) continue;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.02, 0.4),
      new THREE.Vector3(placement.x * 0.55, 0.02, placement.z * 0.4 + 0.3),
      new THREE.Vector3(placement.x, 0.02, placement.z + 0.3),
    ]);
    const trail = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.16, 6, false), pathMaterial);
    trail.scale.y = 0.3;
    root.add(trail);
  }
  return root;
}
