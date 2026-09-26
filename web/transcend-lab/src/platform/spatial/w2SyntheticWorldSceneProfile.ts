import type { WorldSceneProfile } from "./worldSceneProfile";

export const W2_SYNTHETIC_WORLD_SCENE_PROFILE: WorldSceneProfile = Object.freeze({
  groundSize: 6,
  fixtures: Object.freeze([]),
  destination: Object.freeze({
    id: "w2-synthetic-marker",
    label: "Synthetic marker",
    x: 0,
    z: -1,
    radius: 0.75,
  }),
  copy: Object.freeze({
    canvasLabel: "W2 synthetic world. Use movement controls to explore.",
    destinationAhead: "Synthetic marker is ahead.",
    destinationNear: "At synthetic marker.",
    destinationAway: "Synthetic marker is nearby.",
  }),
  camera: Object.freeze({
    seed: Object.freeze({
      yawRadians: 0,
      pitchRadians: 0.24,
      minPitchRadians: -0.2,
      maxPitchRadians: 0.55,
      desiredDistance: 4,
      minDistance: 0.8,
      obstructionClearance: 0.08,
    }),
    shapeRadius: 0.25,
    distanceLimits: Object.freeze({ min: 2, max: 6 }),
    lookSensitivity: 0.005,
  }),
  actor: Object.freeze({
    modelHeight: 1.45,
    footOffset: 0.75,
    clips: Object.freeze({ idle: "idle", move: "move" }),
  }),
});
