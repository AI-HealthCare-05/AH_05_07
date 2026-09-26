import type { WorldPlayableSession } from "../runtime/worldPlayableSession";
import {
  KinematicWorldKernel,
  type KinematicKernelConfig,
  type KinematicWorldProfile,
} from "./kinematicWorldKernel";
import { loadLabRapier, type RapierModule } from "./rapierRuntime";
import { worldPoint, type WorldPoint3 } from "./worldSpaceClock";

type PhysicsWorld = import("@dimforge/rapier3d-compat").World;

const SYNTHETIC_CONFIG: KinematicKernelConfig = Object.freeze({
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
  worldLimit: 3,
  minimumY: -4,
  maxFrameGapMilliseconds: 250,
});

const SYNTHETIC_SPAWN = worldPoint(0, 0.8, 0);

type SyntheticPopulateContext = Readonly<{
  rapier: RapierModule;
  world: PhysicsWorld;
  fixture: "synthetic";
}>;

function populateSyntheticWorld({ rapier: R, world }: SyntheticPopulateContext): WorldPoint3 {
  world.createCollider(new R.ColliderDesc(new R.HalfSpace({ x: 0, y: 1, z: 0 })));
  return SYNTHETIC_SPAWN;
}

const SYNTHETIC_PROFILE: KinematicWorldProfile<"synthetic"> = Object.freeze({
  fixtures: Object.freeze(["synthetic"] as const),
  defaultFixture: "synthetic",
  recoveryPoint: SYNTHETIC_SPAWN,
  config: SYNTHETIC_CONFIG,
  populate: populateSyntheticWorld,
});

export function createW2SyntheticPlayableWorldSession(): WorldPlayableSession {
  const world = new KinematicWorldKernel(SYNTHETIC_PROFILE, loadLabRapier);
  return Object.freeze({
    runtime: world,
    start: () => world.start("synthetic"),
    stop: () => world.stop(),
    setSemanticSuspended: (suspended: boolean) => world.setSemanticSuspended(suspended),
  });
}
