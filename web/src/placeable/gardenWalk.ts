import type { MovementIntent } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";

/** The existing E7 front-path envelope. This calculation has no mutable owner. */
export const GARDEN_WALK = Object.freeze({
  minX: -1.65,
  maxX: 1.65,
  minZ: 0.35,
  maxZ: 2.75,
  speed: 1.6,
  maxStepSeconds: 0.05,
});

export type GardenWalkPose = Readonly<{ x: number; z: number; facing: number }>;
export type GardenWalkStep = GardenWalkPose & Readonly<{ moving: boolean }>;

/** Resolve actual displacement first; a held key at a wall is not walking.
 * The caller (GardenScene) alone commits the returned world position/facing.
 */
export function advanceGardenWalk(
  pose: GardenWalkPose,
  seconds: number,
  intent: Pick<MovementIntent, "lateral" | "forward">,
  resting: boolean,
): GardenWalkStep {
  if (resting || !Number.isFinite(seconds) || seconds <= 0
    || !Number.isFinite(intent.lateral) || !Number.isFinite(intent.forward)) {
    return { ...pose, moving: false };
  }
  const dt = Math.min(seconds, GARDEN_WALK.maxStepSeconds);
  // Keep existing input normalization and diagonal semantics in the input owner.
  const x = Math.max(GARDEN_WALK.minX, Math.min(
    GARDEN_WALK.maxX, pose.x + intent.lateral * dt * GARDEN_WALK.speed,
  ));
  const z = Math.max(GARDEN_WALK.minZ, Math.min(
    GARDEN_WALK.maxZ, pose.z - intent.forward * dt * GARDEN_WALK.speed,
  ));
  const dx = x - pose.x, dz = z - pose.z;
  const moving = dx !== 0 || dz !== 0;
  return {
    x,
    z,
    // Active My Space lite actors use +Z forward, as in the qualified Plaza.
    facing: moving ? Math.atan2(dx, dz) : pose.facing,
    moving,
  };
}
