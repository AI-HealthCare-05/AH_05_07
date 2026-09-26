export type MovementIntentSource = "none" | "keyboard" | "pointer";

export type MovementIntent = Readonly<{
  lateral: number;
  forward: number;
  magnitude: number;
  source: MovementIntentSource;
}>;

export type MovementClearReason =
  | "reset"
  | "pointer-cancel"
  | "lost-pointer-capture"
  | "blur"
  | "visibility-hidden"
  | "semantic-suspend";

export type MovementInputSnapshot = Readonly<{
  intent: MovementIntent;
  pressedKeys: readonly string[];
  pointerId: number | null;
  suspended: boolean;
  lastClearReason: MovementClearReason | null;
}>;

const KEY_AXES: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
});

/** Pointer Events uses a signed long; only -1 is reserved for a non-pointing-device event. */
export function isUsablePointerId(pointerId: number): boolean {
  return Number.isSafeInteger(pointerId) && pointerId !== -1;
}

function normalized(lateral: number, forward: number, source: MovementIntentSource): MovementIntent {
  if (!Number.isFinite(lateral) || !Number.isFinite(forward)) {
    throw new TypeError("movement axes must be finite");
  }
  const length = Math.hypot(lateral, forward);
  if (length <= 1e-12) {
    return Object.freeze({ lateral: 0, forward: 0, magnitude: 0, source: "none" as const });
  }
  const divisor = Math.max(1, length);
  const x = lateral / divisor;
  const z = forward / divisor;
  return Object.freeze({
    lateral: x,
    forward: z,
    magnitude: Math.hypot(x, z),
    source,
  });
}

/**
 * W1 movement-intent authority only.
 *
 * This controller does not know camera yaw, WorldSpace vectors, DOM geometry,
 * physics, React, RAF, or the existing CSS-pixel companion grab path. Task 5
 * may map this normalized lateral/forward intent into camera-relative WorldSpace.
 */
export class WorldMovementIntentController {
  readonly #pressedKeys = new Set<string>();
  #pointerId: number | null = null;
  #pointerIntent: MovementIntent | null = null;
  #hidden = false;
  #semanticSuspended = false;

  get #suspended(): boolean { return this.#hidden || this.#semanticSuspended; }
  #lastClearReason: MovementClearReason | null = null;

  get snapshot(): MovementInputSnapshot {
    return Object.freeze({
      intent: this.#currentIntent(),
      pressedKeys: Object.freeze([...this.#pressedKeys].sort()),
      pointerId: this.#pointerId,
      suspended: this.#suspended,
      lastClearReason: this.#lastClearReason,
    });
  }

  keyDown(code: string): boolean {
    if (this.#suspended || !Object.hasOwn(KEY_AXES, code)) return false;
    this.#pressedKeys.add(code);
    this.#lastClearReason = null;
    return true;
  }

  keyUp(code: string): boolean {
    if (!Object.hasOwn(KEY_AXES, code)) return false;
    const deleted = this.#pressedKeys.delete(code);
    if (deleted) this.#lastClearReason = null;
    return deleted;
  }

  beginPointer(pointerId: number): boolean {
    if (this.#suspended || !isUsablePointerId(pointerId) || this.#pointerId !== null) return false;
    this.#pointerId = pointerId;
    this.#pointerIntent = normalized(0, 0, "pointer");
    this.#lastClearReason = null;
    return true;
  }

  updatePointer(pointerId: number, lateral: number, forward: number): boolean {
    if (this.#suspended || pointerId !== this.#pointerId) return false;
    if (!Number.isFinite(lateral) || !Number.isFinite(forward)) {
      this.#clear("pointer-cancel");
      return false;
    }
    this.#pointerIntent = normalized(lateral, forward, "pointer");
    this.#lastClearReason = null;
    return true;
  }

  endPointer(pointerId: number): boolean {
    if (pointerId !== this.#pointerId) return false;
    this.#pointerId = null;
    this.#pointerIntent = null;
    return true;
  }

  cancelPointer(pointerId: number): boolean {
    if (pointerId !== this.#pointerId) return false;
    this.#clear("pointer-cancel");
    return true;
  }

  lostPointerCapture(pointerId: number): boolean {
    if (pointerId !== this.#pointerId) return false;
    this.#clear("lost-pointer-capture");
    return true;
  }

  blur(): void {
    this.#clear("blur");
  }

  setHidden(hidden: boolean): void {
    this.#hidden = hidden;
    if (hidden) this.#clear("visibility-hidden");
  }

  setSemanticSuspended(suspended: boolean): void {
    this.#semanticSuspended = suspended;
    if (suspended) this.#clear("semantic-suspend");
  }

  reset(): void {
    // Reset movement, not the environmental blockers still owned by the caller.
    this.#clear("reset");
  }

  #clear(reason: MovementClearReason): void {
    this.#pressedKeys.clear();
    this.#pointerId = null;
    this.#pointerIntent = null;
    this.#lastClearReason = reason;
  }

  #currentIntent(): MovementIntent {
    if (this.#suspended) return normalized(0, 0, "none");
    if (this.#pointerId !== null && this.#pointerIntent) return this.#pointerIntent;

    // WASD/arrow aliases describe directions, not extra speed or key votes.
    const has = (a: string, b: string) => this.#pressedKeys.has(a) || this.#pressedKeys.has(b);
    const lateral = Number(has("KeyD", "ArrowRight")) - Number(has("KeyA", "ArrowLeft"));
    const forward = Number(has("KeyW", "ArrowUp")) - Number(has("KeyS", "ArrowDown"));
    return normalized(lateral, forward, "keyboard");
  }
}
