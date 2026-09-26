import type { WorldPlayableSession } from "../runtime/worldPlayableSession";
import { LIVING_WEEK_BOUND_METRES } from "./livingWeekLandmarks";
import {
  KinematicWorldKernel,
  type KinematicKernelConfig,
  type KinematicWorldProfile,
} from "./kinematicWorldKernel";
import { loadLabRapier, type RapierModule } from "./rapierRuntime";
import { worldPoint, type WorldPoint3 } from "./worldSpaceClock";

type PhysicsWorld = import("@dimforge/rapier3d-compat").World;

export const W4_LIVING_WEEK_WORLD_LIMIT_METRES = LIVING_WEEK_BOUND_METRES - 0.25;

const W4_CONFIG: KinematicKernelConfig = Object.freeze({
  stepSeconds: 1 / 60,
  speedMetresPerSecond: 2,
  gravityMetresPerSecondSquared: -9.81,
  terminalFallSpeed: 30,
  capsuleHalfHeight: 0.5,
  capsuleRadius: 0.25,
  contactOffset: 0.01,
  autostepMaxHeight: 0.35,
  autostepMinWidth: 0.2,
  snapToGroundDistance: 0.2,
  maxSlopeClimbRadians: Math.PI / 4,
  minSlopeSlideRadians: Math.PI / 3,
  worldLimit: W4_LIVING_WEEK_WORLD_LIMIT_METRES,
  minimumY: -4,
  maxFrameGapMilliseconds: 250,
});

const W4_SPAWN = worldPoint(0, 0.8, 0);

type W4PopulateContext = Readonly<{
  rapier: RapierModule;
  world: PhysicsWorld;
  fixture: "living-week";
}>;

function populateLivingWeekWorld({ rapier: R, world }: W4PopulateContext): WorldPoint3 {
  world.createCollider(new R.ColliderDesc(new R.HalfSpace({ x: 0, y: 1, z: 0 })));
  return W4_SPAWN;
}

const W4_PROFILE: KinematicWorldProfile<"living-week"> = Object.freeze({
  fixtures: Object.freeze(["living-week"] as const),
  defaultFixture: "living-week",
  recoveryPoint: W4_SPAWN,
  config: W4_CONFIG,
  populate: populateLivingWeekWorld,
});

export function createW4LivingWeekPlayableWorldSession(): WorldPlayableSession {
  const world = new KinematicWorldKernel(W4_PROFILE, loadLabRapier);
  return Object.freeze({
    runtime: world,
    start: () => world.start("living-week"),
    stop: () => world.stop(),
    setSemanticSuspended: (suspended: boolean) => world.setSemanticSuspended(suspended),
  });
}
