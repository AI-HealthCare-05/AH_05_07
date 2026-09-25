/** One metre-based fixture description for both Rapier and the Lab renderer. */
export type PlayableFixture = Readonly<{
  id: string;
  kind: "box" | "ramp";
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}>;

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

/** Ramp x is its low leading edge, unlike the centre used by boxes. */
export function rampVertices(fixture: PlayableFixture): Float32Array {
  if (fixture.kind !== "ramp") throw new TypeError("Expected a ramp fixture");
  const { x, z, width, height, depth } = fixture;
  if (![x, z, width, height, depth].every(Number.isFinite) || Math.min(width, height, depth) <= 0) {
    throw new RangeError("Ramp dimensions must be finite and positive");
  }
  const end = x + width;
  return new Float32Array([
    x, 0, z - depth / 2, end, 0, z - depth / 2, end, height, z - depth / 2,
    x, 0, z + depth / 2, end, 0, z + depth / 2, end, height, z + depth / 2,
  ]);
}

export const RAMP_TRIANGLES = Object.freeze([
  0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3,
  1, 2, 5, 1, 5, 4, 0, 3, 5, 0, 5, 2,
]);
