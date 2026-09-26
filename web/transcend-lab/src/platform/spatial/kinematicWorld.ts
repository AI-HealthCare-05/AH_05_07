import {
  KinematicWorldKernel,
  type KinematicWorldProfile,
} from "./kinematicWorldKernel";
import { playableWorldLayout, rampVertices } from "./playableWorldLayout";
import { loadLabRapier, type RapierModule } from "./rapierRuntime";
import { worldPoint, type WorldPoint3 } from "./worldSpaceClock";

type PhysicsWorld = import("@dimforge/rapier3d-compat").World;

export const WORLD_FIXTURES = Object.freeze([
  "flat",
  "wall",
  "playable",
  "camera-obstruction",
  "slope-allowed",
  "slope-blocked",
  "step-allowed",
  "step-blocked",
  "recovery",
] as const);
export type WorldFixtureName = (typeof WORLD_FIXTURES)[number];

/** Recorded synthetic tuning, not production/physical-device performance gates. */
export const KINEMATIC_CONFIG = Object.freeze({
  groundShape: "halfspace-y-up" as const,
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
  obstacleFrontX: 1.5,
  allowedStepHeight: 0.2,
  blockedStepHeight: 0.6,
  allowedSlopeRadians: Math.PI / 9,
  blockedSlopeRadians: Math.PI / 3,
  slopeRun: 3,
  worldLimit: 10,
  minimumY: -8,
  maxFrameGapMilliseconds: 250,
});

const SPAWN = worldPoint(0, 0.8, 0);

type W1PopulateContext = Readonly<{
  rapier: RapierModule;
  world: PhysicsWorld;
  fixture: WorldFixtureName;
}>;

function populateW1Fixture({
  rapier: R,
  world,
  fixture,
}: W1PopulateContext): WorldPoint3 {
  world.createCollider(new R.ColliderDesc(new R.HalfSpace({ x: 0, y: 1, z: 0 })));
  const front = KINEMATIC_CONFIG.obstacleFrontX;

  if (fixture === "playable") {
    for (const shape of playableWorldLayout(KINEMATIC_CONFIG)) {
      const descriptor = shape.kind === "box"
        ? R.ColliderDesc.cuboid(shape.width / 2, shape.height / 2, shape.depth / 2)
          .setTranslation(shape.x, shape.height / 2, shape.z)
        : R.ColliderDesc.convexHull(rampVertices(shape));
      if (!descriptor) throw new Error(`Invalid playable fixture: ${shape.id}`);
      world.createCollider(descriptor);
    }
  } else if (fixture === "wall") {
    world.createCollider(
      R.ColliderDesc.cuboid(0.15, 1.5, 4).setTranslation(front + 0.15, 1.5, 0),
    );
  } else if (fixture === "camera-obstruction") {
    world.createCollider(
      R.ColliderDesc.cuboid(0.12, 2, 0.04).setTranslation(0.32, 2, 2),
    );
  } else if (fixture === "step-allowed" || fixture === "step-blocked") {
    const height = fixture === "step-allowed"
      ? KINEMATIC_CONFIG.allowedStepHeight
      : KINEMATIC_CONFIG.blockedStepHeight;
    world.createCollider(
      R.ColliderDesc.cuboid(0.75, height / 2, 2)
        .setTranslation(front + 0.75, height / 2, 0),
    );
  } else if (fixture === "slope-allowed" || fixture === "slope-blocked") {
    const angle = fixture === "slope-allowed"
      ? KINEMATIC_CONFIG.allowedSlopeRadians
      : KINEMATIC_CONFIG.blockedSlopeRadians;
    const end = front + KINEMATIC_CONFIG.slopeRun;
    const height = Math.tan(angle) * KINEMATIC_CONFIG.slopeRun;
    const ramp = R.ColliderDesc.convexHull(new Float32Array([
      front, 0, -2,
      end, 0, -2,
      end, height, -2,
      front, 0, 2,
      end, 0, 2,
      end, height, 2,
    ]));
    if (!ramp) throw new Error("Invalid synthetic slope hull");
    world.createCollider(ramp);
  }

  return fixture === "recovery" ? worldPoint(0, -10, 0) : SPAWN;
}

const W1_KINEMATIC_PROFILE: KinematicWorldProfile<WorldFixtureName> = Object.freeze({
  fixtures: WORLD_FIXTURES,
  defaultFixture: "flat",
  recoveryPoint: SPAWN,
  config: KINEMATIC_CONFIG,
  populate: populateW1Fixture,
});

/**
 * W1 compatibility adapter around the reusable W2 kinematic kernel.
 *
 * Existing Lab callers keep the same fixture names, constructor loader seam,
 * lifecycle API and diagnostics while W1-specific geometry remains outside the
 * generic kernel.
 */
export class KinematicWorld extends KinematicWorldKernel<WorldFixtureName> {
  constructor(loadRapier: () => Promise<RapierModule> = loadLabRapier) {
    super(W1_KINEMATIC_PROFILE, loadRapier);
  }
}

export type KinematicWorldTestApi = ReturnType<KinematicWorld["testApi"]>;
