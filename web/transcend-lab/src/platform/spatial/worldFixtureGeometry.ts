export type WorldFixture = Readonly<{
  id: string;
  kind: "box" | "ramp";
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}>;

/** Ramp x is its low leading edge, unlike the centre used by boxes. */
export function rampVertices(fixture: WorldFixture): Float32Array {
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

