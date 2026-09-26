import { KINEMATIC_CONFIG } from "./kinematicWorld";
import { PLAYABLE_DESTINATION, playableWorldLayout } from "./playableWorldLayout";
import type { WorldSceneProfile } from "./worldSceneProfile";

export const W1_WORLD_SCENE_PROFILE: WorldSceneProfile = Object.freeze({
  groundSize: KINEMATIC_CONFIG.worldLimit * 2,
  fixtures: playableWorldLayout(KINEMATIC_CONFIG),
  destination: PLAYABLE_DESTINATION,
  camera: Object.freeze({
    seed: Object.freeze({
      yawRadians: -Math.PI / 12,
      pitchRadians: 0.28,
      minPitchRadians: -0.22,
      maxPitchRadians: 0.58,
      desiredDistance: 5,
      minDistance: 0.8,
      obstructionClearance: 0.08,
    }),
    shapeRadius: 0.25,
    distanceLimits: Object.freeze({ min: 2.5, max: 8 }),
    lookSensitivity: 0.005,
  }),
  actor: Object.freeze({
    modelHeight: 1.45,
    footOffset: KINEMATIC_CONFIG.capsuleHalfHeight + KINEMATIC_CONFIG.capsuleRadius,
  }),
});
