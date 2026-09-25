export const WORLD_SPACE = "world-metres" as const;

export type WorldPoint3 = Readonly<{
  space: typeof WORLD_SPACE;
  kind: "point";
  x: number;
  y: number;
  z: number;
}>;

export type WorldVector3 = Readonly<{
  space: typeof WORLD_SPACE;
  kind: "vector";
  x: number;
  y: number;
  z: number;
}>;

export type FixedStepClockSnapshot = Readonly<{
  stepSeconds: number;
  simulationSeconds: number;
  stepCount: number;
  accumulatorSeconds: number;
  interpolationAlpha: number;
  active: boolean;
  anchored: boolean;
}>;

type FixedStepCallback = (stepSeconds: number, stepCount: number) => void;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  return value;
}

function positive(value: number, label: string): number {
  const next = finite(value, label);
  if (next <= 0) {
    throw new RangeError(`${label} must be greater than zero`);
  }
  return next;
}

function coordinates(x: number, y: number, z: number) {
  return Object.freeze({
    x: finite(x, "x"),
    y: finite(y, "y"),
    z: finite(z, "z"),
  });
}

export function worldPoint(x: number, y: number, z: number): WorldPoint3 {
  return Object.freeze({
    space: WORLD_SPACE,
    kind: "point" as const,
    ...coordinates(x, y, z),
  });
}

export function worldVector(x: number, y: number, z: number): WorldVector3 {
  return Object.freeze({
    space: WORLD_SPACE,
    kind: "vector" as const,
    ...coordinates(x, y, z),
  });
}

export function translateWorldPoint(
  point: WorldPoint3,
  vector: WorldVector3,
): WorldPoint3 {
  if (point.space !== WORLD_SPACE || point.kind !== "point") {
    throw new Error("point must use WorldSpace metres");
  }
  if (vector.space !== WORLD_SPACE || vector.kind !== "vector") {
    throw new Error("vector must use WorldSpace metres");
  }
  return worldPoint(
    point.x + vector.x,
    point.y + vector.y,
    point.z + vector.z,
  );
}

/**
 * Pure fixed-step simulation clock for W1. It owns no RAF, DOM, React or physics
 * object. Callers provide monotonic frame timestamps and decide what each fixed
 * simulation step does.
 *
 * suspend() deliberately clears both the wall-clock anchor and any partial
 * accumulator. This fences visibility/stop discontinuities so background time
 * cannot be replayed as catch-up simulation after resume().
 */
export class FixedStepClock {
  readonly #stepSeconds: number;
  #simulationSeconds = 0;
  #stepCount = 0;
  #accumulatorSeconds = 0;
  #anchorMilliseconds: number | null = null;
  #active = false;

  constructor(stepSeconds: number) {
    this.#stepSeconds = positive(stepSeconds, "stepSeconds");
  }

  get snapshot(): FixedStepClockSnapshot {
    const interpolationAlpha = Math.min(
      1,
      Math.max(0, this.#accumulatorSeconds / this.#stepSeconds),
    );
    return Object.freeze({
      stepSeconds: this.#stepSeconds,
      simulationSeconds: this.#simulationSeconds,
      stepCount: this.#stepCount,
      accumulatorSeconds: this.#accumulatorSeconds,
      interpolationAlpha,
      active: this.#active,
      anchored: this.#anchorMilliseconds !== null,
    });
  }

  resume(frameTimeMilliseconds: number): void {
    this.#anchorMilliseconds = finite(frameTimeMilliseconds, "frameTimeMilliseconds");
    this.#accumulatorSeconds = 0;
    this.#active = true;
  }

  sample(frameTimeMilliseconds: number, step: FixedStepCallback): number {
    const frameTime = finite(frameTimeMilliseconds, "frameTimeMilliseconds");
    if (!this.#active || this.#anchorMilliseconds === null) {
      return 0;
    }
    if (frameTime < this.#anchorMilliseconds) {
      throw new RangeError("frameTimeMilliseconds must be monotonic");
    }

    const elapsedSeconds = (frameTime - this.#anchorMilliseconds) / 1000;
    this.#anchorMilliseconds = frameTime;
    this.#accumulatorSeconds += elapsedSeconds;

    let executed = 0;
    const epsilon = this.#stepSeconds * 1e-9;
    while (this.#accumulatorSeconds + epsilon >= this.#stepSeconds) {
      this.#accumulatorSeconds -= this.#stepSeconds;
      // Canonicalize either-sign round-off at a completed fixed step. Frame
      // partitioning must not leave different near-zero interpolation states.
      if (Math.abs(this.#accumulatorSeconds) < epsilon) {
        this.#accumulatorSeconds = 0;
      }
      this.#stepCount += 1;
      this.#simulationSeconds = this.#stepCount * this.#stepSeconds;
      step(this.#stepSeconds, this.#stepCount);
      executed += 1;
    }
    return executed;
  }

  suspend(): void {
    this.#active = false;
    this.#anchorMilliseconds = null;
    this.#accumulatorSeconds = 0;
  }

  reset(): void {
    this.#simulationSeconds = 0;
    this.#stepCount = 0;
    this.#accumulatorSeconds = 0;
    this.#anchorMilliseconds = null;
    this.#active = false;
  }
}
