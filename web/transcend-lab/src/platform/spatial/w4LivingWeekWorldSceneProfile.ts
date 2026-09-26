import { LIVING_WEEK_LANDMARKS } from "./livingWeekLandmarks";
import { LIVING_WEEK_SCENE_PLAN } from "./livingWeekScenePlan";
import type { WorldSceneProfile } from "./worldSceneProfile";

const MONDAY = LIVING_WEEK_LANDMARKS[0];

export const W4_LIVING_WEEK_WORLD_SCENE_PROFILE: WorldSceneProfile = Object.freeze({
  groundSize: LIVING_WEEK_SCENE_PLAN.groundSizeMetres,
  fixtures: Object.freeze([]),
  destination: Object.freeze({
    id: MONDAY.id,
    label: MONDAY.label,
    x: MONDAY.position.x,
    z: MONDAY.position.z,
    radius: 0.7,
  }),
  copy: Object.freeze({
    canvasLabel: "Living Week world. Seven weekday landmarks are connected in sequence.",
    destinationAhead: "Monday is the first landmark in the Living Week path.",
    destinationNear: "At Monday, the first Living Week landmark.",
    destinationAway: "Monday is the first landmark in the Living Week path.",
  }),
  camera: Object.freeze({
    seed: Object.freeze({
      yawRadians: -Math.PI / 5,
      pitchRadians: 0.52,
      minPitchRadians: -0.18,
      maxPitchRadians: 0.76,
      desiredDistance: 7.2,
      minDistance: 1,
      obstructionClearance: 0.08,
    }),
    shapeRadius: 0.25,
    distanceLimits: Object.freeze({ min: 3.5, max: 10 }),
    lookSensitivity: 0.005,
  }),
  actor: Object.freeze({
    modelHeight: 1.45,
    footOffset: 0.75,
    clips: Object.freeze({ idle: "idle", move: "move" }),
  }),
});
