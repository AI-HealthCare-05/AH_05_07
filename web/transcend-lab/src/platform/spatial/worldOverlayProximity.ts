import type { WorldSceneOverlayMarker, WorldSceneOverlayPlan } from "./worldSceneOverlayPlan";
import type { WorldPoint3 } from "./worldSpaceClock";

export function nearestActiveOverlayMarker(
  plan: WorldSceneOverlayPlan | null,
  position: WorldPoint3,
): WorldSceneOverlayMarker | null {
  let nearest: WorldSceneOverlayMarker | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const marker of plan?.markers ?? []) {
    const radius = marker.interactionRadiusMetres;
    if (!Number.isFinite(radius) || radius <= 0) continue;
    const dx = position.x - marker.position.x;
    const dz = position.z - marker.position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared > radius * radius) continue;
    const isCloser = distanceSquared < nearestDistanceSquared - 1e-12;
    const isTie = Math.abs(distanceSquared - nearestDistanceSquared) <= 1e-12;
    if (isCloser || (isTie && nearest !== null && marker.id < nearest.id) || nearest === null) {
      nearest = marker;
      nearestDistanceSquared = distanceSquared;
    }
  }
  return nearest;
}
