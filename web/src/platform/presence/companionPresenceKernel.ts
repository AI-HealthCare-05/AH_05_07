import type { ScreenId } from "../../ui/journey";

export type PresenceFallback = "anchor" | "dock" | "control" | "hidden";

export type PresencePlacementIntent = Readonly<{
  preferredRole: string | null;
  preferredAnchorId?: string;
  normalizedOffset?: Readonly<{ x: number; y: number }>;
  fallbackOrder: readonly PresenceFallback[];
}>;

export type PresenceRenderOwner =
  | "none"
  | "legacy-slot"
  | "saved-scene"
  | "full-scene";

export type CompanionPresence = Readonly<{
  sessionEpoch: number;
  actorId: string;
  assetId: string;
  mode: "quiet" | "companion" | "play";
  lifecycle: "suspended" | "present" | "transitioning";
  placementIntent: PresencePlacementIntent | null;
}>;

export type PresenceRuntimeEpochs = Readonly<{
  sessionEpoch: number;
  routeEpoch: number;
  arenaRevision: number;
  ownerGeneration: number;
}>;

export type PresenceOwnerToken = Readonly<{
  token: string;
  sessionEpoch: number;
  routeEpoch: number;
  ownerGeneration: number;
  owner: Exclude<PresenceRenderOwner, "none">;
  observedAssetId: string | null;
}>;

export type PresenceKernelSnapshot = Readonly<{
  presence: CompanionPresence | null;
  route: ScreenId;
  runtime: PresenceRuntimeEpochs;
  owner: PresenceRenderOwner;
  ownerToken: PresenceOwnerToken | null;
  observedAssetId: string | null;
  handoffCount: number;
}>;

export type PresenceKernelInput = Readonly<{
  sessionEpoch: number;
  route: ScreenId;
  actor: Readonly<{ actorId: string; assetId: string }> | null;
  owner: PresenceRenderOwner;
  observedAssetId?: string | null;
  suspended?: boolean;
}>;

export type PresenceOwnerHandoff = Readonly<{
  from: PresenceRenderOwner;
  to: PresenceRenderOwner;
  sessionEpoch: number;
  routeEpoch: number;
  ownerGeneration: number;
  token: PresenceOwnerToken | null;
}>;

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function freezeIntent(intent: PresencePlacementIntent | null): PresencePlacementIntent | null {
  if (!intent) return null;
  const normalizedOffset = intent.normalizedOffset
    ? Object.freeze({
        x: clamp01(intent.normalizedOffset.x),
        y: clamp01(intent.normalizedOffset.y),
      })
    : undefined;
  return Object.freeze({
    preferredRole: intent.preferredRole,
    ...(intent.preferredAnchorId ? { preferredAnchorId: intent.preferredAnchorId } : {}),
    ...(normalizedOffset ? { normalizedOffset } : {}),
    fallbackOrder: Object.freeze([...intent.fallbackOrder]),
  });
}

function ownerToken(
  sessionEpoch: number,
  routeEpoch: number,
  ownerGeneration: number,
  owner: PresenceRenderOwner,
  observedAssetId: string | null,
): PresenceOwnerToken | null {
  if (owner === "none") return null;
  return Object.freeze({
    token: `presence:${sessionEpoch}:${routeEpoch}:${ownerGeneration}:${owner}:${observedAssetId ?? "none"}`,
    sessionEpoch,
    routeEpoch,
    ownerGeneration,
    owner,
    observedAssetId,
  });
}

function sameActor(
  left: CompanionPresence | null,
  right: PresenceKernelInput["actor"],
): boolean {
  if (!left || !right) return left === null && right === null;
  return left.actorId === right.actorId && left.assetId === right.assetId;
}

function freezeSnapshot(snapshot: {
  presence: CompanionPresence | null;
  route: ScreenId;
  runtime: PresenceRuntimeEpochs;
  owner: PresenceRenderOwner;
  ownerToken: PresenceOwnerToken | null;
  observedAssetId: string | null;
  handoffCount: number;
}): PresenceKernelSnapshot {
  return Object.freeze({
    ...snapshot,
    runtime: Object.freeze({ ...snapshot.runtime }),
    presence: snapshot.presence
      ? Object.freeze({
          ...snapshot.presence,
          placementIntent: freezeIntent(snapshot.presence.placementIntent),
        })
      : null,
  });
}

/**
 * Phase 2 shadow kernel.
 *
 * It owns logical identity and deterministic epochs only. It never mounts,
 * reveals, hides, moves, loads or disposes a renderer. `owner` is an observed
 * description of the existing product owner, and the token is rehearsal-only.
 */
export class CompanionPresenceKernel {
  #snapshot: PresenceKernelSnapshot;

  constructor(input: PresenceKernelInput) {
    const sessionEpoch = nonNegativeInteger(input.sessionEpoch, "sessionEpoch");
    const routeEpoch = 1;
    const ownerGeneration = 0;
    const observedAssetId = input.observedAssetId ?? null;
    const presence = input.actor
      ? Object.freeze({
          sessionEpoch,
          actorId: input.actor.actorId,
          assetId: input.actor.assetId,
          mode: "companion" as const,
          lifecycle: (input.suspended || input.owner === "none" ? "suspended" : "present") as CompanionPresence["lifecycle"],
          placementIntent: null,
        })
      : null;
    this.#snapshot = freezeSnapshot({
      presence,
      route: input.route,
      runtime: { sessionEpoch, routeEpoch, arenaRevision: 0, ownerGeneration },
      owner: "none",
      ownerToken: null,
      observedAssetId: null,
      handoffCount: 0,
    });
    this.reconcile(input);
  }

  get snapshot(): PresenceKernelSnapshot {
    return this.#snapshot;
  }

  reconcile(input: PresenceKernelInput): Readonly<{
    snapshot: PresenceKernelSnapshot;
    handoff: PresenceOwnerHandoff | null;
  }> {
    const current = this.#snapshot;
    const sessionEpoch = nonNegativeInteger(input.sessionEpoch, "sessionEpoch");
    const sessionChanged = sessionEpoch !== current.runtime.sessionEpoch;
    const routeChanged = sessionChanged || input.route !== current.route;
    const actorChanged = !sameActor(current.presence, input.actor);
    const observedAssetId = input.observedAssetId ?? null;
    const ownerChanged = input.owner !== current.owner || observedAssetId !== current.observedAssetId;
    const ownerFenceChanged = sessionChanged || routeChanged || actorChanged || ownerChanged;

    const routeEpoch = sessionChanged
      ? 1
      : routeChanged
        ? current.runtime.routeEpoch + 1
        : current.runtime.routeEpoch;
    const arenaRevision = routeChanged ? 0 : current.runtime.arenaRevision;
    const ownerGeneration = sessionChanged
      ? input.owner === "none" ? 0 : 1
      : ownerFenceChanged
        ? current.runtime.ownerGeneration + 1
        : current.runtime.ownerGeneration;

    const previousIntent = sessionChanged ? null : current.presence?.placementIntent ?? null;
    const presence = input.actor
      ? Object.freeze({
          sessionEpoch,
          actorId: input.actor.actorId,
          assetId: input.actor.assetId,
          mode: "companion" as const,
          lifecycle: (input.suspended || input.owner === "none" ? "suspended" : "present") as CompanionPresence["lifecycle"],
          placementIntent: freezeIntent(previousIntent),
        })
      : null;

    const nextToken = ownerToken(
      sessionEpoch,
      routeEpoch,
      ownerGeneration,
      input.owner,
      observedAssetId,
    );
    const handoff = ownerFenceChanged
      ? Object.freeze({
          from: current.owner,
          to: input.owner,
          sessionEpoch,
          routeEpoch,
          ownerGeneration,
          token: nextToken,
        })
      : null;

    this.#snapshot = freezeSnapshot({
      presence,
      route: input.route,
      runtime: { sessionEpoch, routeEpoch, arenaRevision, ownerGeneration },
      owner: input.owner,
      ownerToken: nextToken,
      observedAssetId,
      handoffCount: sessionChanged
        ? input.owner === "none" ? 0 : 1
        : current.handoffCount + (ownerFenceChanged ? 1 : 0),
    });
    return Object.freeze({ snapshot: this.#snapshot, handoff });
  }

  rememberPlacementIntent(intent: PresencePlacementIntent | null): boolean {
    const current = this.#snapshot;
    if (!current.presence) return false;
    this.#snapshot = freezeSnapshot({
      ...current,
      presence: {
        ...current.presence,
        placementIntent: freezeIntent(intent),
      },
    });
    return true;
  }

  publishArena(routeEpoch: number, revision: number): boolean {
    const current = this.#snapshot;
    nonNegativeInteger(routeEpoch, "routeEpoch");
    nonNegativeInteger(revision, "arenaRevision");
    if (routeEpoch !== current.runtime.routeEpoch) return false;
    if (revision < current.runtime.arenaRevision) return false;
    if (revision === current.runtime.arenaRevision) return true;
    this.#snapshot = freezeSnapshot({
      ...current,
      runtime: {
        ...current.runtime,
        arenaRevision: revision,
      },
    });
    return true;
  }

  /** Shadow-only exact-token release used to rehearse ABA safety. */
  releaseOwner(token: PresenceOwnerToken): boolean {
    const current = this.#snapshot;
    if (!current.ownerToken || token.token !== current.ownerToken.token) return false;
    this.#snapshot = freezeSnapshot({
      ...current,
      owner: "none",
      ownerToken: null,
      observedAssetId: null,
      presence: current.presence
        ? { ...current.presence, lifecycle: "suspended" }
        : null,
    });
    return true;
  }
}
