import * as THREE from "three";

/** Dispose visit-owned resources; pass the renderer only at final teardown. */
export function disposeScene(root: THREE.Object3D, renderer?: THREE.WebGLRenderer) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      // Pinned Three 0.185.1 keeps a module-global DFG LUT outside material maps.
      // Its dispose listeners retain exited renderers, even after context loss.
      // Read the actual compiled uniform (a private import creates another LUT)
      // and release it BEFORE material/renderer properties are discarded.
      const properties = renderer?.properties.get(material) as { uniforms?: { dfgLUT?: { value?: unknown } } } | undefined;
      const lut = properties?.uniforms?.dfgLUT?.value;
      if (lut instanceof THREE.Texture && lut.name === "DFG_LUT") textures.add(lut);
    }
  });
  // Texture.dispose also releases other renderers' copies of this shared LUT;
  // Three uploads them again on their next draw. No texture contents change.
  skeletons.forEach((value) => value.dispose());
  textures.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  geometries.forEach((value) => value.dispose());
}
