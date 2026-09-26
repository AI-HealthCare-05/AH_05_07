import type { WorldFixture } from "./worldFixtureGeometry";

export type PlayableFixture = WorldFixture;
export { rampVertices, RAMP_TRIANGLES } from "./worldFixtureGeometry";

type FixtureTuning = Readonly<{
  allowedStepHeight: number;
  blockedStepHeight: number;
  allowedSlopeRadians: number;
  blockedSlopeRadians: number;
  slopeRun: number;
}>;

export const PLAYABLE_DESTINATION = Object.freeze({
  id: "grove-station", label: "Grove station", x: 0, z: -3, radius: 0.9,
});

export function playableWorldLayout(tuning: FixtureTuning): readonly PlayableFixture[] {
  return Object.freeze([
    { id: "camera-pillar", kind: "box", x: 0.32, z: 2, width: 0.24, height: 4, depth: 0.08 },
    { id: "wall", kind: "box", x: 3, z: 0, width: 0.3, height: 3, depth: 5 },
    { id: "step-allowed", kind: "box", x: -3.5, z: 1.5, width: 1.5, height: tuning.allowedStepHeight, depth: 1.6 },
    { id: "step-blocked", kind: "box", x: -3.5, z: 4, width: 1.5, height: tuning.blockedStepHeight, depth: 1.6 },
    { id: "slope-allowed", kind: "ramp", x: -6, z: -4.5, width: tuning.slopeRun,
      height: Math.tan(tuning.allowedSlopeRadians) * tuning.slopeRun, depth: 1.6 },
    { id: "slope-blocked", kind: "ramp", x: -6, z: -7, width: tuning.slopeRun,
      height: Math.tan(tuning.blockedSlopeRadians) * tuning.slopeRun, depth: 1.6 },
  ].map((fixture) => Object.freeze(fixture as PlayableFixture)));
}
