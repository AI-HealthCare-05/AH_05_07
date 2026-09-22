import type { ArenaPoint, UntaggedPoint } from "../spatial/companionWorld";
import type { FreePlacementRequest } from "../spatial/companionFreePlacement";
import type { WorldRootFence } from "./rootMotionLease";

export type GrabSample = Readonly<{ pointerId: number; point: UntaggedPoint }>;
export type GrabState = Readonly<{
  pointerId: number;
  fence: WorldRootFence;
  startPointer: UntaggedPoint;
  startActor: ArenaPoint;
  threshold: number;
  dragging: boolean;
}>;
export type GrabUpdate =
  | Readonly<{ kind: "ignored"; state: GrabState }>
  | Readonly<{ kind: "pending"; state: GrabState }>
  | Readonly<{ kind: "drag"; state: GrabState; request: FreePlacementRequest }>
  | Readonly<{ kind: "cancelled"; reason: "stale-fence" | "invalid-sample" }>;
export type GrabFinish =
  | Readonly<{ kind: "ignored"; state: GrabState }>
  | Readonly<{ kind: "tap" }>
  | Readonly<{ kind: "drop"; request: FreePlacementRequest }>
  | Readonly<{ kind: "cancelled"; reason: "stale-fence" | "invalid-sample" }>;

function validPoint(point: UntaggedPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function validFence(fence: WorldRootFence): boolean {
  return [fence.sessionEpoch, fence.routeEpoch, fence.arenaRevision]
    .every((value) => Number.isSafeInteger(value) && value >= 0);
}

function sameFence(left: WorldRootFence, right: WorldRootFence): boolean {
  return left.sessionEpoch === right.sessionEpoch && left.routeEpoch === right.routeEpoch
    && left.arenaRevision === right.arenaRevision;
}

/** Pure gesture proposal only: no pointer capture, lease acquisition, timer, DOM, or world write. */
export function beginGrab(input: Readonly<{
  sample: GrabSample;
  actor: ArenaPoint;
  fence: WorldRootFence;
  button: number;
  isPrimary: boolean;
  threshold?: number;
}>): GrabState | null {
  const threshold = input.threshold ?? 6;
  if (!input.isPrimary || input.button !== 0
    || !Number.isSafeInteger(input.sample.pointerId) || input.sample.pointerId < 0
    || !validPoint(input.sample.point) || !validPoint(input.actor) || !validFence(input.fence)
    || input.actor.space !== "visual-viewport-css-px"
    || input.actor.revision !== input.fence.arenaRevision
    || !Number.isFinite(threshold) || threshold <= 0) return null;
  return Object.freeze({
    pointerId: input.sample.pointerId,
    fence: Object.freeze({ ...input.fence }),
    startPointer: Object.freeze({ ...input.sample.point }),
    startActor: Object.freeze({ ...input.actor }),
    threshold,
    dragging: false,
  });
}

export function moveGrab(state: GrabState, sample: GrabSample, currentFence: WorldRootFence): GrabUpdate {
  if (!sameFence(state.fence, currentFence)) return Object.freeze({ kind: "cancelled", reason: "stale-fence" });
  if (sample.pointerId !== state.pointerId) return Object.freeze({ kind: "ignored", state });
  if (!validPoint(sample.point)) return Object.freeze({ kind: "cancelled", reason: "invalid-sample" });
  const deltaX = sample.point.x - state.startPointer.x;
  const deltaY = sample.point.y - state.startPointer.y;
  if (!state.dragging && Math.hypot(deltaX, deltaY) < state.threshold) {
    return Object.freeze({ kind: "pending", state });
  }
  const next = state.dragging ? state : Object.freeze({ ...state, dragging: true });
  // Preserve the original grab point. Do not teleport the actor's root under the pointer.
  const point = Object.freeze({
    space: state.startActor.space,
    revision: state.fence.arenaRevision,
    x: state.startActor.x + deltaX,
    y: state.startActor.y + deltaY,
  });
  if (!validPoint(point)) return Object.freeze({ kind: "cancelled", reason: "invalid-sample" });
  return Object.freeze({
    kind: "drag",
    state: next,
    request: Object.freeze({ routeEpoch: state.fence.routeEpoch, arenaRevision: state.fence.arenaRevision, point }),
  });
}

export function finishGrab(state: GrabState, sample: GrabSample, currentFence: WorldRootFence): GrabFinish {
  const update = moveGrab(state, sample, currentFence);
  if (update.kind === "pending") return Object.freeze({ kind: "tap" });
  if (update.kind === "drag") return Object.freeze({ kind: "drop", request: update.request });
  return update;
}
