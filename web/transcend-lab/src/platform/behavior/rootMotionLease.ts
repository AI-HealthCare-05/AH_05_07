import type {
  ArenaRevision,
  ResolvedPose,
  RouteEpoch,
} from "../spatial/companionWorld";

export type WorldRootLease = Readonly<{
  token: string;
  sessionEpoch: number;
  routeEpoch: RouteEpoch;
  arenaRevision: ArenaRevision;
  owner: string;
  acquisitionOrder: number;
}>;

export type WorldRootFence = Readonly<{
  sessionEpoch: number;
  routeEpoch: RouteEpoch;
  arenaRevision: ArenaRevision;
}>;

export type WorldRootRevocationReason =
  | "arena-publication"
  | "route-change"
  | "stop"
  | "reset"
  | "hard-zone-invalidation"
  | "session-replacement"
  | "pointer-cancel"
  | "lost-pointer-capture"
  | "escape"
  | "renderer-transition";

export type WorldRootState = Readonly<{
  fence: WorldRootFence;
  lease: WorldRootLease | null;
  pose: ResolvedPose | null;
  acquisitionCount: number;
  revocationCount: number;
  lastRevocation: WorldRootRevocationReason | null;
}>;

type PoseListener = (pose: ResolvedPose | null) => void;

function validEpoch(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function frozenFence(fence: WorldRootFence): WorldRootFence {
  return Object.freeze({
    sessionEpoch: validEpoch(fence.sessionEpoch, "sessionEpoch"),
    routeEpoch: validEpoch(fence.routeEpoch, "routeEpoch"),
    arenaRevision: validEpoch(fence.arenaRevision, "arenaRevision"),
  });
}

function sameFence(left: WorldRootFence, right: WorldRootFence): boolean {
  return (
    left.sessionEpoch === right.sessionEpoch
    && left.routeEpoch === right.routeEpoch
    && left.arenaRevision === right.arenaRevision
  );
}

/**
 * The only Phase 1 writer authority. This object has no renderer lifecycle API.
 */
export class WorldRootLeaseManager {
  #fence: WorldRootFence;
  #lease: WorldRootLease | null = null;
  #pose: ResolvedPose | null = null;
  #acquisitionOrder = 0;
  #revocationCount = 0;
  #lastRevocation: WorldRootRevocationReason | null = null;
  readonly #listeners = new Set<PoseListener>();

  constructor(initialFence: WorldRootFence) {
    this.#fence = frozenFence(initialFence);
  }

  get state(): WorldRootState {
    return Object.freeze({
      fence: this.#fence,
      lease: this.#lease,
      pose: this.#pose,
      acquisitionCount: this.#acquisitionOrder,
      revocationCount: this.#revocationCount,
      lastRevocation: this.#lastRevocation,
    });
  }

  poseSource(): Readonly<{
    read: () => ResolvedPose | null;
    subscribe: (listener: PoseListener) => () => void;
  }> {
    return Object.freeze({
      read: () => this.#pose,
      subscribe: (listener: PoseListener) => {
        this.#listeners.add(listener);
        return () => {
          this.#listeners.delete(listener);
        };
      },
    });
  }

  publishArena(nextFence: WorldRootFence): void {
    this.revoke("arena-publication", true);
    this.#fence = frozenFence(nextFence);
  }

  replaceSession(nextSessionEpoch: number): void {
    validEpoch(nextSessionEpoch, "sessionEpoch");
    this.revoke("session-replacement", true);
    this.#fence = frozenFence({
      ...this.#fence,
      sessionEpoch: nextSessionEpoch,
    });
  }

  acquire(owner: string, requestedFence: WorldRootFence): WorldRootLease | null {
    if (!owner || !sameFence(this.#fence, requestedFence)) return null;
    const acquisitionOrder = this.#acquisitionOrder + 1;
    this.#acquisitionOrder = acquisitionOrder;
    const token = [
      "world-root",
      requestedFence.sessionEpoch,
      requestedFence.routeEpoch,
      requestedFence.arenaRevision,
      acquisitionOrder,
      encodeURIComponent(owner),
    ].join(":");
    this.#lease = Object.freeze({
      token,
      ...this.#fence,
      owner,
      acquisitionOrder,
    });
    return this.#lease;
  }

  renew(lease: WorldRootLease): boolean {
    return this.#isExactCurrent(lease);
  }

  write(lease: WorldRootLease, pose: ResolvedPose): boolean {
    if (
      !this.#isExactCurrent(lease)
      || pose.routeEpoch !== this.#fence.routeEpoch
      || pose.arenaRevision !== this.#fence.arenaRevision
      || pose.point.revision !== this.#fence.arenaRevision
    ) {
      return false;
    }
    this.#pose = pose;
    this.#emitPose();
    return true;
  }

  release(lease: WorldRootLease): boolean {
    if (!this.#isExactCurrent(lease)) return false;
    this.#lease = null;
    return true;
  }

  revoke(
    reason: WorldRootRevocationReason,
    clearPose = false,
  ): void {
    this.#lease = null;
    this.#revocationCount += 1;
    this.#lastRevocation = reason;
    if (clearPose && this.#pose !== null) {
      this.#pose = null;
      this.#emitPose();
    }
  }

  #isExactCurrent(candidate: WorldRootLease): boolean {
    const current = this.#lease;
    return Boolean(
      current
        && current.token === candidate.token
        && current.owner === candidate.owner
        && current.acquisitionOrder === candidate.acquisitionOrder
        && current.sessionEpoch === candidate.sessionEpoch
        && current.routeEpoch === candidate.routeEpoch
        && current.arenaRevision === candidate.arenaRevision
        && sameFence(current, this.#fence),
    );
  }

  #emitPose(): void {
    for (const listener of this.#listeners) listener(this.#pose);
  }
}
