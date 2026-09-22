import type { ScreenId } from "../../ui/journey";
import type {
  PresencePlacementIntent,
  PresenceRenderOwner,
} from "./companionPresenceKernel";
import type {
  PresenceArenaRect,
  S02PresenceArenaSnapshot,
} from "./s02PresenceArena";
import {
  envelopeFromProjection,
  normalizedPlacementFromPoint,
  requestFromNormalizedPlacement,
  resolveS02FreePlacement,
  type PresenceActorEnvelope,
  type PresenceArenaPoint,
  type PresenceFreePlacementResult,
  type PresenceNormalizedPlacement,
} from "./s02PresencePlacement";

const GRAB_THRESHOLD_CSS_PX = 6;
const PLACEMENT_CLEARANCE_CSS_PX = 8;
const SPACE = "visual-viewport-css-px" as const;

const SAFE_PRESETS: readonly PresenceNormalizedPlacement[] = Object.freeze([
  Object.freeze({ x: 0.2, y: 0.72 }),
  Object.freeze({ x: 0.8, y: 0.72 }),
  Object.freeze({ x: 0.5, y: 0.28 }),
]);

export type PresenceSceneActorProjection = Readonly<{
  space: typeof SPACE;
  revision: number;
  stage: PresenceArenaRect;
  root: PresenceArenaPoint;
  visualEnvelope: PresenceArenaRect;
  hitRect: PresenceArenaRect;
}>;

export type PresenceSceneActorWriteRequest = Readonly<{
  assetUrl: string;
  point: PresenceArenaPoint;
}>;

export type PresenceSceneActorPort = Readonly<{
  assetUrl: string;
  project: (arenaRevision: number) => PresenceSceneActorProjection | null;
  write: (request: PresenceSceneActorWriteRequest) => boolean;
}>;

export type PresenceWorldRootFence = Readonly<{
  sessionEpoch: number;
  routeEpoch: number;
  arenaRevision: number;
  ownerGeneration: number;
  ownerToken: string;
  portIncarnation: number;
}>;

export type PresenceWorldRootLease = Readonly<{
  token: string;
  owner: string;
  acquisitionOrder: number;
  fence: PresenceWorldRootFence;
}>;

export type PresencePointerToken = Readonly<{
  token: string;
  pointerId: number;
  fence: PresenceWorldRootFence;
}>;

export type PresencePointerFinish = "ignored" | "tap" | "committed" | "restored";

export type PresenceSceneActorStatus =
  | "unavailable"
  | "ready"
  | "dragging"
  | "committed"
  | "corrected"
  | "restored"
  | "no-space";

export type PresenceSceneActorRuntimeSnapshot = Readonly<{
  enabled: boolean;
  status: PresenceSceneActorStatus;
  fence: PresenceWorldRootFence | null;
  projection: PresenceSceneActorProjection | null;
  committedNormalized: PresenceNormalizedPlacement | null;
  activePointerId: number | null;
  activePointerToken: string | null;
  dragging: boolean;
  leaseToken: string | null;
  portCount: 0 | 1;
  portIncarnation: number;
  writeCount: number;
  commitCount: number;
  revocationCount: number;
  lastRevocation: string | null;
  lastCorrectionDistance: number;
}>;

export type PresenceSceneActorHostPublication = Readonly<{
  screen: ScreenId;
  owner: PresenceRenderOwner;
  suspended: boolean;
  sessionEpoch: number;
  routeEpoch: number;
  arenaRevision: number;
  ownerGeneration: number;
  ownerToken: string | null;
  activeAssetId: string | null;
  activeAssetUrl: string | null;
  observedAssetId: string | null;
  arena: S02PresenceArenaSnapshot | null;
  placementIntent: PresencePlacementIntent | null;
  rememberPlacementIntent: (intent: PresencePlacementIntent) => void;
}>;

export type PresenceSceneActorHostConnection = Readonly<{
  publish: (publication: PresenceSceneActorHostPublication) => boolean;
  disconnect: () => boolean;
}>;

type PortRegistration = Readonly<{
  port: PresenceSceneActorPort;
  incarnation: number;
}>;

type PointerSession = Readonly<{
  publicToken: PresencePointerToken;
  startPointer: Readonly<{ x: number; y: number }>;
  startRoot: PresenceArenaPoint;
  envelope: PresenceActorEnvelope;
  lease: PresenceWorldRootLease | null;
  dragging: boolean;
  latestPlacement: PresenceFreePlacementResult | null;
}>;

type Listener = () => void;

function validEpoch(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function sameFence(
  left: PresenceWorldRootFence | null,
  right: PresenceWorldRootFence | null,
): boolean {
  if (!left || !right) return left === right;
  return left.sessionEpoch === right.sessionEpoch
    && left.routeEpoch === right.routeEpoch
    && left.arenaRevision === right.arenaRevision
    && left.ownerGeneration === right.ownerGeneration
    && left.ownerToken === right.ownerToken
    && left.portIncarnation === right.portIncarnation;
}

function freezeFence(fence: PresenceWorldRootFence): PresenceWorldRootFence {
  return Object.freeze({ ...fence });
}

function validRect(rect: PresenceArenaRect, revision: number): boolean {
  return rect.space === SPACE
    && rect.revision === revision
    && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && rect.width > 0
    && rect.height > 0;
}

function validProjection(
  projection: PresenceSceneActorProjection | null,
  revision: number,
): projection is PresenceSceneActorProjection {
  return Boolean(projection
    && projection.space === SPACE
    && projection.revision === revision
    && projection.root.space === SPACE
    && projection.root.revision === revision
    && Number.isFinite(projection.root.x)
    && Number.isFinite(projection.root.y)
    && validRect(projection.stage, revision)
    && validRect(projection.visualEnvelope, revision)
    && validRect(projection.hitRect, revision));
}

function normalizedFromIntent(
  intent: PresencePlacementIntent | null,
): PresenceNormalizedPlacement | null {
  const offset = intent?.normalizedOffset;
  if (
    intent?.preferredRole !== "today-sidecar"
    || !offset
    || !Number.isFinite(offset.x)
    || !Number.isFinite(offset.y)
  ) return null;
  return Object.freeze({
    x: Math.min(1, Math.max(0, offset.x)),
    y: Math.min(1, Math.max(0, offset.y)),
  });
}

function placementIntent(normalized: PresenceNormalizedPlacement): PresencePlacementIntent {
  return Object.freeze({
    preferredRole: "today-sidecar",
    preferredAnchorId: "today-sidecar",
    normalizedOffset: Object.freeze({ ...normalized }),
    fallbackOrder: Object.freeze(["anchor", "dock", "control", "hidden"] as const),
  });
}

function clientPointToArena(
  point: Readonly<{ x: number; y: number }>,
  viewport: PresenceArenaRect,
): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: point.x + viewport.x, y: point.y + viewport.y });
}

function pointInside(point: Readonly<{ x: number; y: number }>, rect: PresenceArenaRect): boolean {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function hostFenceKey(publication: PresenceSceneActorHostPublication | null): string {
  if (!publication) return "none";
  return JSON.stringify([
    publication.screen,
    publication.owner,
    publication.suspended,
    publication.sessionEpoch,
    publication.routeEpoch,
    publication.arenaRevision,
    publication.ownerGeneration,
    publication.ownerToken,
    publication.activeAssetId,
    publication.activeAssetUrl,
    publication.observedAssetId,
    publication.arena?.routeEpoch ?? null,
    publication.arena?.revision ?? null,
  ]);
}

function initialSnapshot(): PresenceSceneActorRuntimeSnapshot {
  return Object.freeze({
    enabled: false,
    status: "unavailable",
    fence: null,
    projection: null,
    committedNormalized: null,
    activePointerId: null,
    activePointerToken: null,
    dragging: false,
    leaseToken: null,
    portCount: 0,
    portIncarnation: 0,
    writeCount: 0,
    commitCount: 0,
    revocationCount: 0,
    lastRevocation: null,
    lastCorrectionDistance: 0,
  });
}

/**
 * The sole product writer authority for the migrated S02 actor world root.
 * Renderer lifecycle remains in ThreeSceneRenderer; this runtime owns only the
 * exact-token movement fence, safe placement, and committed placement intent.
 */
export class PresenceSceneActorRuntime {
  readonly #listeners = new Set<Listener>();
  #snapshot = initialSnapshot();
  #hostConnectionOrder = 0;
  #activeHostConnection: number | null = null;
  #host: PresenceSceneActorHostPublication | null = null;
  #portOrder = 0;
  #port: PortRegistration | null = null;
  #acquisitionOrder = 0;
  #lease: PresenceWorldRootLease | null = null;
  #pointerOrder = 0;
  #pointer: PointerSession | null = null;
  #projection: PresenceSceneActorProjection | null = null;
  #committedNormalized: PresenceNormalizedPlacement | null = null;
  #committedSessionEpoch: number | null = null;
  #presetCursor = -1;
  #status: PresenceSceneActorStatus = "unavailable";
  #writeCount = 0;
  #commitCount = 0;
  #revocationCount = 0;
  #lastRevocation: string | null = null;
  #lastCorrectionDistance = 0;

  get snapshot(): PresenceSceneActorRuntimeSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  connectHost(): PresenceSceneActorHostConnection {
    if (this.#activeHostConnection !== null) {
      throw new Error("PresenceSceneActorRuntime already has a host connection");
    }
    const connection = ++this.#hostConnectionOrder;
    this.#activeHostConnection = connection;
    return Object.freeze({
      publish: (publication) => this.#publishHost(connection, publication),
      disconnect: () => {
        if (this.#activeHostConnection !== connection) return false;
        this.#prepareFenceChange("host-disconnect");
        this.#activeHostConnection = null;
        this.#host = null;
        this.#projection = null;
        this.#status = "unavailable";
        this.#emit();
        return true;
      },
    });
  }

  registerPort(port: PresenceSceneActorPort): () => boolean {
    if (this.#port) throw new Error("S02 SceneActorPort is already registered");
    if (!port.assetUrl) throw new Error("S02 SceneActorPort requires an asset URL");
    this.#prepareFenceChange("port-register");
    const registration = Object.freeze({
      port,
      incarnation: ++this.#portOrder,
    });
    this.#port = registration;
    this.#reconcilePlacement("port-register");
    this.#emit();
    return () => {
      if (this.#port !== registration) return false;
      // Revoke and restore while the exact port still exists, before renderer disposal.
      this.#prepareFenceChange("port-unregister");
      this.#port = null;
      this.#projection = null;
      this.#status = "unavailable";
      this.#emit();
      return true;
    };
  }

  acquireWorldRootLease(owner: string): PresenceWorldRootLease | null {
    const lease = this.#acquire(owner);
    this.#emit();
    return lease;
  }

  writeWorldRoot(lease: PresenceWorldRootLease, point: PresenceArenaPoint): boolean {
    const wrote = this.#write(lease, point);
    this.#emit();
    return wrote;
  }

  releaseWorldRootLease(lease: PresenceWorldRootLease): boolean {
    const released = this.#release(lease);
    this.#emit();
    return released;
  }

  beginPointer(input: Readonly<{
    pointerId: number;
    clientX: number;
    clientY: number;
    button: number;
    isPrimary: boolean;
  }>): PresencePointerToken | null {
    const fence = this.#currentFence();
    const arena = this.#host?.arena;
    const projection = this.#projection;
    if (
      !fence
      || !arena
      || !projection
      || this.#pointer
      || input.button !== 0
      || !input.isPrimary
      || !Number.isSafeInteger(input.pointerId)
      || input.pointerId < 0
      || !Number.isFinite(input.clientX)
      || !Number.isFinite(input.clientY)
    ) return null;

    const point = clientPointToArena(
      { x: input.clientX, y: input.clientY },
      arena.viewport,
    );
    if (!pointInside(point, projection.hitRect)) return null;
    const pointerOrder = ++this.#pointerOrder;
    const publicToken = Object.freeze({
      token: `presence-pointer:${pointerOrder}:${input.pointerId}:${encodeURIComponent(fence.ownerToken)}`,
      pointerId: input.pointerId,
      fence: freezeFence(fence),
    });
    const envelope = envelopeFromProjection(projection.root, projection.visualEnvelope);
    if (!envelope) return null;
    this.#pointer = Object.freeze({
      publicToken,
      startPointer: point,
      startRoot: projection.root,
      envelope,
      lease: null,
      dragging: false,
      latestPlacement: null,
    });
    this.#status = "ready";
    this.#emit();
    return publicToken;
  }

  movePointer(
    token: PresencePointerToken,
    point: Readonly<{ clientX: number; clientY: number }>,
  ): boolean {
    const update = this.#updatePointer(token, point);
    this.#emit();
    return update === "written";
  }

  endPointer(
    token: PresencePointerToken,
    point: Readonly<{ clientX: number; clientY: number }>,
  ): PresencePointerFinish {
    const pointer = this.#pointer;
    if (!pointer || pointer.publicToken.token !== token.token) return "ignored";
    const update = this.#updatePointer(token, point);
    const current = this.#pointer;
    if (!current || current.publicToken.token !== token.token) {
      this.#emit();
      return "ignored";
    }
    if (!current.dragging) {
      this.#pointer = null;
      this.#status = this.#currentFence() ? "ready" : "unavailable";
      this.#emit();
      return "tap";
    }

    const placement = current.latestPlacement;
    if (
      update !== "failed"
      && placement?.kind === "placed"
      && current.lease
      && this.#host?.arena
    ) {
      const normalized = normalizedPlacementFromPoint(
        this.#host.arena,
        placement.point,
        current.envelope,
        PLACEMENT_CLEARANCE_CSS_PX,
      );
      if (normalized) {
        this.#committedNormalized = normalized;
        this.#committedSessionEpoch = current.publicToken.fence.sessionEpoch;
        this.#release(current.lease);
        this.#pointer = null;
        this.#commitNormalized(normalized);
        this.#status = placement.resolution === "adjusted" ? "corrected" : "committed";
        this.#lastCorrectionDistance = placement.correctionDistance;
        this.#emit();
        return "committed";
      }
    }

    this.#restorePointerAndRevoke("pointer-drop-no-space");
    this.#status = "restored";
    this.#emit();
    return "restored";
  }

  cancelPointer(
    token: PresencePointerToken,
    reason: "pointer-cancel" | "lost-pointer-capture" | "escape",
  ): boolean {
    if (!this.#pointer || this.#pointer.publicToken.token !== token.token) return false;
    this.#restorePointerAndRevoke(reason);
    this.#status = this.#currentFence() ? "restored" : "unavailable";
    this.#emit();
    return true;
  }

  cycleSafePreset(): boolean {
    const arena = this.#host?.arena;
    const fence = this.#currentFence();
    const projection = this.#projection;
    if (!arena || !fence || !projection || this.#pointer) return false;
    const envelope = envelopeFromProjection(projection.root, projection.visualEnvelope);
    if (!envelope) return false;

    for (let offset = 1; offset <= SAFE_PRESETS.length; offset += 1) {
      const index = (this.#presetCursor + offset) % SAFE_PRESETS.length;
      const request = requestFromNormalizedPlacement(
        arena,
        SAFE_PRESETS[index],
        envelope,
        PLACEMENT_CLEARANCE_CSS_PX,
      );
      if (!request) continue;
      const placement = resolveS02FreePlacement(
        arena,
        request,
        envelope,
        PLACEMENT_CLEARANCE_CSS_PX,
      );
      if (placement.kind !== "placed") continue;
      const lease = this.#acquire(`preset:${index}`);
      if (!lease || !this.#write(lease, placement.point)) {
        if (lease) this.#release(lease);
        continue;
      }
      const normalized = normalizedPlacementFromPoint(
        arena,
        placement.point,
        envelope,
        PLACEMENT_CLEARANCE_CSS_PX,
      );
      this.#release(lease);
      if (!normalized) continue;
      this.#presetCursor = index;
      this.#committedNormalized = normalized;
      this.#committedSessionEpoch = fence.sessionEpoch;
      this.#commitNormalized(normalized);
      this.#status = placement.resolution === "adjusted" ? "corrected" : "committed";
      this.#lastCorrectionDistance = placement.correctionDistance;
      this.#emit();
      return true;
    }

    this.#status = "no-space";
    this.#emit();
    return false;
  }

  dispose(): void {
    this.#prepareFenceChange("runtime-dispose");
    this.#activeHostConnection = null;
    this.#host = null;
    this.#port = null;
    this.#projection = null;
    this.#listeners.clear();
    this.#status = "unavailable";
    this.#snapshot = initialSnapshot();
  }

  #publishHost(
    connection: number,
    publication: PresenceSceneActorHostPublication,
  ): boolean {
    if (this.#activeHostConnection !== connection) return false;
    const previous = this.#host;
    const changed = hostFenceKey(previous) !== hostFenceKey(publication);
    const sessionChanged = previous !== null
      && previous.sessionEpoch !== publication.sessionEpoch;
    if (changed) this.#prepareFenceChange("host-publication-change");
    this.#host = publication;

    const remembered = normalizedFromIntent(publication.placementIntent);
    if (sessionChanged) {
      this.#committedNormalized = remembered;
      this.#committedSessionEpoch = remembered ? publication.sessionEpoch : null;
      this.#presetCursor = -1;
    } else if (remembered) {
      this.#committedNormalized = remembered;
      this.#committedSessionEpoch = publication.sessionEpoch;
    }

    this.#reconcilePlacement(changed ? "host-publication-change" : "host-refresh");
    this.#emit();
    return true;
  }

  #currentFence(): PresenceWorldRootFence | null {
    const host = this.#host;
    const registration = this.#port;
    const arena = host?.arena;
    if (
      !host
      || !registration
      || host.screen !== "S02"
      || host.owner !== "full-scene"
      || host.suspended
      || !validEpoch(host.sessionEpoch)
      || !validEpoch(host.routeEpoch)
      || !validEpoch(host.arenaRevision)
      || !validEpoch(host.ownerGeneration)
      || !host.ownerToken
      || !host.activeAssetId
      || !host.activeAssetUrl
      || host.observedAssetId !== host.activeAssetId
      || registration.port.assetUrl !== host.activeAssetUrl
      || !arena
      || arena.observedOwner !== "full-scene"
      || arena.routeEpoch !== host.routeEpoch
      || arena.revision !== host.arenaRevision
    ) return null;
    return freezeFence({
      sessionEpoch: host.sessionEpoch,
      routeEpoch: host.routeEpoch,
      arenaRevision: host.arenaRevision,
      ownerGeneration: host.ownerGeneration,
      ownerToken: host.ownerToken,
      portIncarnation: registration.incarnation,
    });
  }

  #acquire(owner: string): PresenceWorldRootLease | null {
    const fence = this.#currentFence();
    if (!fence || !owner) return null;
    const acquisitionOrder = ++this.#acquisitionOrder;
    const lease = Object.freeze({
      token: [
        "presence-world-root",
        fence.sessionEpoch,
        fence.routeEpoch,
        fence.arenaRevision,
        fence.ownerGeneration,
        encodeURIComponent(fence.ownerToken),
        fence.portIncarnation,
        acquisitionOrder,
        encodeURIComponent(owner),
      ].join(":"),
      owner,
      acquisitionOrder,
      fence,
    });
    this.#lease = lease;
    return lease;
  }

  #isExactLease(candidate: PresenceWorldRootLease): boolean {
    const currentFence = this.#currentFence();
    const current = this.#lease;
    return Boolean(current
      && currentFence
      && current.token === candidate.token
      && current.owner === candidate.owner
      && current.acquisitionOrder === candidate.acquisitionOrder
      && sameFence(current.fence, candidate.fence)
      && sameFence(candidate.fence, currentFence));
  }

  #write(lease: PresenceWorldRootLease, point: PresenceArenaPoint): boolean {
    const port = this.#port?.port;
    const host = this.#host;
    const fence = this.#currentFence();
    if (
      !port
      || !host?.activeAssetUrl
      || !fence
      || !this.#isExactLease(lease)
      || point.space !== SPACE
      || point.revision !== fence.arenaRevision
      || !Number.isFinite(point.x)
      || !Number.isFinite(point.y)
      || port.assetUrl !== host.activeAssetUrl
    ) return false;
    if (!port.write(Object.freeze({ assetUrl: host.activeAssetUrl, point }))) return false;
    const projection = port.project(fence.arenaRevision);
    if (!validProjection(projection, fence.arenaRevision)) return false;
    this.#projection = projection;
    this.#writeCount += 1;
    return true;
  }

  #release(lease: PresenceWorldRootLease): boolean {
    if (!this.#isExactLease(lease)) return false;
    this.#lease = null;
    return true;
  }

  #prepareFenceChange(reason: string): void {
    const pointer = this.#pointer;
    if (pointer?.lease && this.#isExactLease(pointer.lease)) {
      this.#restoreWithLease(pointer.lease, pointer.envelope);
    }
    this.#pointer = null;
    this.#lease = null;
    this.#revocationCount += 1;
    this.#lastRevocation = reason;
  }

  #restoreWithLease(
    lease: PresenceWorldRootLease,
    envelope: PresenceActorEnvelope,
  ): boolean {
    const arena = this.#host?.arena;
    const normalized = this.#committedNormalized;
    if (!arena || !normalized) return false;
    const request = requestFromNormalizedPlacement(
      arena,
      normalized,
      envelope,
      PLACEMENT_CLEARANCE_CSS_PX,
    );
    if (!request) return false;
    const placement = resolveS02FreePlacement(
      arena,
      request,
      envelope,
      PLACEMENT_CLEARANCE_CSS_PX,
    );
    return placement.kind === "placed" && this.#write(lease, placement.point);
  }

  #restorePointerAndRevoke(reason: string): void {
    const pointer = this.#pointer;
    if (pointer?.lease && this.#isExactLease(pointer.lease)) {
      this.#restoreWithLease(pointer.lease, pointer.envelope);
    }
    this.#pointer = null;
    this.#lease = null;
    this.#revocationCount += 1;
    this.#lastRevocation = reason;
  }

  #reconcilePlacement(reason: string): void {
    const fence = this.#currentFence();
    const arena = this.#host?.arena;
    const port = this.#port?.port;
    if (!fence || !arena || !port) {
      this.#projection = null;
      this.#status = "unavailable";
      return;
    }
    const projection = port.project(fence.arenaRevision);
    if (!validProjection(projection, fence.arenaRevision)) {
      this.#projection = null;
      this.#status = "unavailable";
      return;
    }
    this.#projection = projection;
    const envelope = envelopeFromProjection(projection.root, projection.visualEnvelope);
    if (!envelope) {
      this.#status = "unavailable";
      return;
    }

    const remembered = this.#committedSessionEpoch === fence.sessionEpoch
      ? this.#committedNormalized
      : normalizedFromIntent(this.#host?.placementIntent ?? null);
    const request = remembered
      ? requestFromNormalizedPlacement(
          arena,
          remembered,
          envelope,
          PLACEMENT_CLEARANCE_CSS_PX,
        )
      : Object.freeze({
          routeEpoch: arena.routeEpoch,
          arenaRevision: arena.revision,
          point: projection.root,
        });
    if (!request) {
      this.#status = "unavailable";
      return;
    }
    const placement = resolveS02FreePlacement(
      arena,
      request,
      envelope,
      PLACEMENT_CLEARANCE_CSS_PX,
    );
    if (placement.kind !== "placed") {
      this.#status = "no-space";
      return;
    }
    const lease = this.#acquire(`reconcile:${reason}`);
    const wrote = Boolean(lease && this.#write(lease, placement.point));
    if (lease) this.#release(lease);
    if (!wrote) {
      this.#status = "unavailable";
      return;
    }
    // Reprojection without a safety correction must preserve the committed
    // intent bit-for-bit across route return and Arena rebuilds.
    const normalized = remembered && placement.resolution === "unchanged"
      ? remembered
      : normalizedPlacementFromPoint(
          arena,
          placement.point,
          envelope,
          PLACEMENT_CLEARANCE_CSS_PX,
        );
    if (normalized) {
      this.#committedNormalized = normalized;
      this.#committedSessionEpoch = fence.sessionEpoch;
    }
    this.#lastCorrectionDistance = placement.correctionDistance;
    this.#status = "ready";
  }

  #updatePointer(
    token: PresencePointerToken,
    point: Readonly<{ clientX: number; clientY: number }>,
  ): "pending" | "written" | "no-space" | "failed" {
    const pointer = this.#pointer;
    const arena = this.#host?.arena;
    const fence = this.#currentFence();
    if (
      !pointer
      || pointer.publicToken.token !== token.token
      || token.pointerId !== pointer.publicToken.pointerId
      || !sameFence(pointer.publicToken.fence, fence)
      || !arena
      || !Number.isFinite(point.clientX)
      || !Number.isFinite(point.clientY)
    ) return "failed";

    const sample = clientPointToArena(
      { x: point.clientX, y: point.clientY },
      arena.viewport,
    );
    const deltaX = sample.x - pointer.startPointer.x;
    const deltaY = sample.y - pointer.startPointer.y;
    if (!pointer.dragging && Math.hypot(deltaX, deltaY) < GRAB_THRESHOLD_CSS_PX) {
      return "pending";
    }

    const lease = pointer.lease ?? this.#acquire(`pointer:${token.pointerId}:${token.token}`);
    if (!lease) return "failed";
    const request = Object.freeze({
      routeEpoch: arena.routeEpoch,
      arenaRevision: arena.revision,
      point: Object.freeze({
        space: SPACE,
        revision: arena.revision,
        // Preserve the initial pointer-to-root offset instead of teleporting.
        x: pointer.startRoot.x + deltaX,
        y: pointer.startRoot.y + deltaY,
      }),
    });
    const placement = resolveS02FreePlacement(
      arena,
      request,
      pointer.envelope,
      PLACEMENT_CLEARANCE_CSS_PX,
    );
    this.#pointer = Object.freeze({
      ...pointer,
      lease,
      dragging: true,
      latestPlacement: placement,
    });
    if (placement.kind !== "placed") {
      this.#status = "no-space";
      return "no-space";
    }
    if (!this.#write(lease, placement.point)) return "failed";
    this.#status = "dragging";
    this.#lastCorrectionDistance = placement.correctionDistance;
    return "written";
  }

  #commitNormalized(normalized: PresenceNormalizedPlacement): void {
    const host = this.#host;
    if (!host) return;
    const intent = placementIntent(normalized);
    this.#host = Object.freeze({ ...host, placementIntent: intent });
    this.#commitCount += 1;
    host.rememberPlacementIntent(intent);
  }

  #emit(): void {
    const fence = this.#currentFence();
    const enabled = Boolean(fence && this.#projection);
    this.#snapshot = Object.freeze({
      enabled,
      status: enabled ? this.#status : "unavailable",
      fence,
      projection: enabled ? this.#projection : null,
      committedNormalized: this.#committedNormalized,
      activePointerId: this.#pointer?.publicToken.pointerId ?? null,
      activePointerToken: this.#pointer?.publicToken.token ?? null,
      dragging: this.#pointer?.dragging ?? false,
      leaseToken: this.#lease?.token ?? null,
      portCount: this.#port ? 1 : 0,
      portIncarnation: this.#port?.incarnation ?? this.#portOrder,
      writeCount: this.#writeCount,
      commitCount: this.#commitCount,
      revocationCount: this.#revocationCount,
      lastRevocation: this.#lastRevocation,
      lastCorrectionDistance: this.#lastCorrectionDistance,
    });
    for (const listener of this.#listeners) listener();
  }
}
