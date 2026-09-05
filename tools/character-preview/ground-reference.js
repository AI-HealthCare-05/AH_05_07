// A fixed reference from the loaded GLB default pose, not a physics floor.
export function groundReference(min, max) {
  if (![...min, ...max].every(Number.isFinite) || min.length !== 3 || max.length !== 3 || min.some((v, i) => v > max[i])) throw Error('Invalid default-pose bounds');
  const span = Math.max(...min.map((v, i) => max[i] - v));
  if (!(span > 0)) throw Error('Empty default-pose bounds');
  return Object.freeze({ y: min[1], centerX: (min[0] + max[0]) / 2, centerZ: (min[2] + max[2]) / 2,
    size: span * 3, spacing: span * 3 / 20, centerY: (min[1] + max[1]) / 2,
    basis: 'loaded_glb_default_pose_precise_world_vertex_min_y', followsAnimation: false });
}
