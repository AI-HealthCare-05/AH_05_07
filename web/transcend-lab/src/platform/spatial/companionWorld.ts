export const ARENA_SPACE = "visual-viewport-css-px" as const;

export type ArenaRevision = number;
export type RouteEpoch = number;

export type UntaggedPoint = Readonly<{
  x: number;
  y: number;
}>;

export type UntaggedRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type ArenaPoint = Readonly<{
  space: typeof ARENA_SPACE;
  revision: ArenaRevision;
  x: number;
  y: number;
}>;

export type ArenaRect = Readonly<{
  space: typeof ARENA_SPACE;
  revision: ArenaRevision;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type PlacementFallback = "anchor" | "dock" | "control" | "hidden";

export type AnchorPlacementIntent = Readonly<{
  kind: "anchor";
  preferredRole: string | null;
  preferredAnchorId?: string;
  normalizedOffset?: Readonly<{ x: number; y: number }>;
  fallbackOrder: readonly PlacementFallback[];
}>;

export type FreePlacementIntent = Readonly<{
  kind: "free";
  // Normalized inside the envelope-feasible root range, never against an anchor region.
  u: number;
  v: number;
}>;

export type PlacementIntent = AnchorPlacementIntent | FreePlacementIntent;

export type CompanionAnchor = Readonly<{
  id: string;
  routeEpoch: RouteEpoch;
  arenaRevision: ArenaRevision;
  role: string;
  priority: number;
  region: ArenaRect;
}>;

export type ResolvedPose = Readonly<{
  routeEpoch: RouteEpoch;
  arenaRevision: ArenaRevision;
  point: ArenaPoint;
  anchorId: string | null;
  source: "anchor" | "free" | "dock" | "fallback";
}>;

export type ArenaSnapshot = Readonly<{
  space: typeof ARENA_SPACE;
  routeEpoch: RouteEpoch;
  revision: ArenaRevision;
  viewport: ArenaRect;
  anchors: readonly CompanionAnchor[];
  hardZones: readonly ArenaRect[];
}>;

export type MeasuredAnchor = Readonly<{
  id: string;
  role: string;
  priority: number;
  region: UntaggedRect;
}>;

export type ActorEnvelope = Readonly<{
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
}>;

export type ActorEnvelopes = Readonly<{
  visualAction: ActorEnvelope;
  tactileHit: ActorEnvelope;
  relocationHandle: ActorEnvelope;
}>;

export type PlacementEnvironment = Readonly<{
  dockRegion?: UntaggedRect;
  controlId?: string;
}>;

export type PlacementResolution =
  | Readonly<{ kind: "pose"; pose: ResolvedPose }>
  | Readonly<{ kind: "control"; controlId: string }>
  | Readonly<{ kind: "hidden" }>;

export type ArenaTransitionStep =
  | "revoke-world-root"
  | "advance-route-epoch"
  | "retire-arena-snapshot"
  | "measure-route-providers"
  | "publish-arena-snapshot"
  | "resolve-placement-intent"
  | "apply-placement";

export type ArenaTransitionHooks = Readonly<{
  revokeWorldRoot: () => void;
  retireSnapshot: () => void;
  measureSnapshot: (nextRouteEpoch: RouteEpoch) => ArenaSnapshot;
  publishSnapshot: (snapshot: ArenaSnapshot) => void;
  resolveIntent: (
    intent: PlacementIntent,
    snapshot: ArenaSnapshot,
  ) => PlacementResolution;
  applyPlacement: (resolution: PlacementResolution) => void;
}>;

export type ArenaTransitionResult = Readonly<{
  routeEpoch: RouteEpoch;
  snapshot: ArenaSnapshot;
  resolution: PlacementResolution;
  trace: readonly ArenaTransitionStep[];
}>;

type AnchorProvider = () => readonly MeasuredAnchor[];
type HardZoneProvider = () => readonly UntaggedRect[];

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  return value;
}

function validateRect(rect: UntaggedRect, label: string): UntaggedRect {
  const next = {
    x: finite(rect.x, `${label}.x`),
    y: finite(rect.y, `${label}.y`),
    width: finite(rect.width, `${label}.width`),
    height: finite(rect.height, `${label}.height`),
  };
  if (next.width < 0 || next.height < 0) {
    throw new RangeError(`${label} dimensions must be non-negative`);
  }
  return Object.freeze(next);
}

function tagRect(rect: UntaggedRect, revision: ArenaRevision): ArenaRect {
  const measured = validateRect(rect, "arena rect");
  return Object.freeze({
    space: ARENA_SPACE,
    revision,
    ...measured,
  });
}

function freezeIntent(intent: AnchorPlacementIntent): AnchorPlacementIntent {
  const normalizedOffset = intent.normalizedOffset
    ? Object.freeze({
        x: clamp01(intent.normalizedOffset.x),
        y: clamp01(intent.normalizedOffset.y),
      })
    : undefined;
  return Object.freeze({
    kind: "anchor",
    preferredRole: intent.preferredRole,
    ...(intent.preferredAnchorId
      ? { preferredAnchorId: intent.preferredAnchorId }
      : {}),
    ...(normalizedOffset ? { normalizedOffset } : {}),
    fallbackOrder: Object.freeze([...intent.fallbackOrder]),
  });
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/**
 * Providers retain untagged geometry. A publish call measures the complete
 * provider set and stamps every value with one revision before exposure.
 */
export class ArenaSnapshotBuilder {
  readonly #anchorProviders = new Map<string, AnchorProvider>();
  readonly #hardZoneProviders = new Map<string, HardZoneProvider>();
  #viewportProvider: () => UntaggedRect;
  #nextRevision: ArenaRevision;

  constructor(
    viewportProvider: () => UntaggedRect,
    initialRevision: ArenaRevision = 0,
  ) {
    this.#viewportProvider = viewportProvider;
    this.#nextRevision = initialRevision;
  }

  setViewportProvider(provider: () => UntaggedRect): void {
    this.#viewportProvider = provider;
  }

  registerAnchorProvider(id: string, provider: AnchorProvider): () => boolean {
    if (!id || this.#anchorProviders.has(id)) {
      throw new Error(`duplicate or empty anchor provider id: ${id}`);
    }
    this.#anchorProviders.set(id, provider);
    return () => this.#anchorProviders.delete(id);
  }

  registerHardZoneProvider(id: string, provider: HardZoneProvider): () => boolean {
    if (!id || this.#hardZoneProviders.has(id)) {
      throw new Error(`duplicate or empty hard-zone provider id: ${id}`);
    }
    this.#hardZoneProviders.set(id, provider);
    return () => this.#hardZoneProviders.delete(id);
  }

  publish(routeEpoch: RouteEpoch): ArenaSnapshot {
    if (!Number.isInteger(routeEpoch) || routeEpoch < 0) {
      throw new RangeError("routeEpoch must be a non-negative integer");
    }
    const revision = this.#nextRevision + 1;
    const measuredAnchors = [...this.#anchorProviders.entries()].flatMap(
      ([providerId, provider]) =>
        provider().map((anchor, index) => ({
          providerId,
          index,
          anchor,
        })),
    );
    const ids = new Set<string>();
    const anchors = measuredAnchors.map(({ providerId, index, anchor }) => {
      if (!anchor.id || ids.has(anchor.id)) {
        throw new Error(`duplicate or empty anchor id: ${anchor.id}`);
      }
      ids.add(anchor.id);
      return Object.freeze({
        id: anchor.id,
        routeEpoch,
        arenaRevision: revision,
        role: anchor.role,
        priority: finite(anchor.priority, `${providerId}[${index}].priority`),
        region: tagRect(
          validateRect(anchor.region, `${providerId}[${index}].region`),
          revision,
        ),
      });
    });
    const hardZones = [...this.#hardZoneProviders.entries()].flatMap(
      ([providerId, provider]) =>
        provider().map((rect, index) =>
          tagRect(validateRect(rect, `${providerId}[${index}]`), revision),
        ),
    );
    const snapshot = Object.freeze({
      space: ARENA_SPACE,
      routeEpoch,
      revision,
      viewport: tagRect(this.#viewportProvider(), revision),
      anchors: Object.freeze(anchors),
      hardZones: Object.freeze(hardZones),
    });
    assertSnapshotConsistent(snapshot);
    this.#nextRevision = revision;
    return snapshot;
  }
}

export function assertSnapshotConsistent(snapshot: ArenaSnapshot): void {
  if (snapshot.space !== ARENA_SPACE) {
    throw new Error("unsupported Arena coordinate space");
  }
  if (snapshot.viewport.revision !== snapshot.revision) {
    throw new Error("viewport revision does not match ArenaSnapshot");
  }
  for (const anchor of snapshot.anchors) {
    if (
      anchor.routeEpoch !== snapshot.routeEpoch
      || anchor.arenaRevision !== snapshot.revision
      || anchor.region.revision !== snapshot.revision
      || anchor.region.space !== snapshot.space
    ) {
      throw new Error(`anchor ${anchor.id} mixes Arena revisions`);
    }
  }
  for (const zone of snapshot.hardZones) {
    if (zone.revision !== snapshot.revision || zone.space !== snapshot.space) {
      throw new Error("hard zone mixes Arena revisions");
    }
  }
}

export function isPointCurrent(
  snapshot: ArenaSnapshot,
  point: ArenaPoint,
): boolean {
  return point.space === snapshot.space && point.revision === snapshot.revision;
}

export function isPoseCurrent(
  snapshot: ArenaSnapshot,
  pose: ResolvedPose,
): boolean {
  return (
    pose.routeEpoch === snapshot.routeEpoch
    && pose.arenaRevision === snapshot.revision
    && isPointCurrent(snapshot, pose.point)
  );
}

export function envelopeRect(
  point: ArenaPoint,
  envelope: ActorEnvelope,
): ArenaRect {
  const width = Math.max(0, finite(envelope.width, "envelope.width"));
  const height = Math.max(0, finite(envelope.height, "envelope.height"));
  const offsetX = finite(envelope.offsetX ?? 0, "envelope.offsetX");
  const offsetY = finite(envelope.offsetY ?? 0, "envelope.offsetY");
  return Object.freeze({
    space: point.space,
    revision: point.revision,
    x: point.x - width / 2 + offsetX,
    y: point.y - height / 2 + offsetY,
    width,
    height,
  });
}

export function rectsOverlap(a: ArenaRect, b: ArenaRect): boolean {
  if (a.space !== b.space || a.revision !== b.revision) {
    throw new Error("cannot compare geometry across Arena revisions");
  }
  return !(
    a.x + a.width <= b.x
    || b.x + b.width <= a.x
    || a.y + a.height <= b.y
    || b.y + b.height <= a.y
  );
}

function rectContains(outer: ArenaRect, inner: ArenaRect): boolean {
  if (outer.space !== inner.space || outer.revision !== inner.revision) {
    throw new Error("cannot compare geometry across Arena revisions");
  }
  return (
    inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
  );
}

function pointForRegion(
  region: ArenaRect,
  normalizedOffset: AnchorPlacementIntent["normalizedOffset"],
): ArenaPoint {
  const offset = normalizedOffset ?? { x: 0.5, y: 0.5 };
  return Object.freeze({
    space: ARENA_SPACE,
    revision: region.revision,
    x: region.x + region.width * clamp01(offset.x),
    y: region.y + region.height * clamp01(offset.y),
  });
}

function poseAt(
  snapshot: ArenaSnapshot,
  point: ArenaPoint,
  anchorId: string | null,
  source: ResolvedPose["source"],
): ResolvedPose {
  return Object.freeze({
    routeEpoch: snapshot.routeEpoch,
    arenaRevision: snapshot.revision,
    point,
    anchorId,
    source,
  });
}

function isSafePoint(
  snapshot: ArenaSnapshot,
  point: ArenaPoint,
  visualActionEnvelope: ActorEnvelope,
): boolean {
  if (!isPointCurrent(snapshot, point)) return false;
  const occupied = envelopeRect(point, visualActionEnvelope);
  return (
    rectContains(snapshot.viewport, occupied)
    && snapshot.hardZones.every((zone) => !rectsOverlap(occupied, zone))
  );
}

export function deterministicAnchors(
  snapshot: ArenaSnapshot,
  intent: AnchorPlacementIntent,
): readonly CompanionAnchor[] {
  const sorted = [...snapshot.anchors].sort(
    (left, right) => right.priority - left.priority || compareIds(left.id, right.id),
  );
  const preferred = intent.preferredAnchorId
    ? sorted.filter((anchor) => anchor.id === intent.preferredAnchorId)
    : [];
  const role = intent.preferredRole
    ? sorted.filter(
        (anchor) =>
          anchor.role === intent.preferredRole && anchor.id !== intent.preferredAnchorId,
      )
    : [];
  const remainder = sorted.filter(
    (anchor) => !preferred.includes(anchor) && !role.includes(anchor),
  );
  return Object.freeze([...preferred, ...role, ...remainder]);
}

export function resolvePlacement(
  snapshot: ArenaSnapshot,
  rawIntent: AnchorPlacementIntent,
  envelopes: ActorEnvelopes,
  environment: PlacementEnvironment = {},
): PlacementResolution {
  assertSnapshotConsistent(snapshot);
  const intent = freezeIntent(rawIntent);
  for (const fallback of intent.fallbackOrder) {
    if (fallback === "anchor") {
      for (const anchor of deterministicAnchors(snapshot, intent)) {
        const point = pointForRegion(anchor.region, intent.normalizedOffset);
        if (isSafePoint(snapshot, point, envelopes.visualAction)) {
          return Object.freeze({
            kind: "pose" as const,
            pose: poseAt(snapshot, point, anchor.id, "anchor"),
          });
        }
      }
    }
    if (fallback === "dock" && environment.dockRegion) {
      const dock = tagRect(environment.dockRegion, snapshot.revision);
      const point = pointForRegion(dock, intent.normalizedOffset);
      if (isSafePoint(snapshot, point, envelopes.visualAction)) {
        return Object.freeze({
          kind: "pose" as const,
          pose: poseAt(snapshot, point, null, "dock"),
        });
      }
    }
    if (fallback === "control" && environment.controlId) {
      return Object.freeze({ kind: "control" as const, controlId: environment.controlId });
    }
    if (fallback === "hidden") {
      return Object.freeze({ kind: "hidden" as const });
    }
  }
  return environment.controlId
    ? Object.freeze({ kind: "control" as const, controlId: environment.controlId })
    : Object.freeze({ kind: "hidden" as const });
}

export function transitionArenaRoute(
  currentRouteEpoch: RouteEpoch,
  intent: PlacementIntent,
  hooks: ArenaTransitionHooks,
): ArenaTransitionResult {
  const trace: ArenaTransitionStep[] = [];
  hooks.revokeWorldRoot();
  trace.push("revoke-world-root");
  const routeEpoch = currentRouteEpoch + 1;
  trace.push("advance-route-epoch");
  hooks.retireSnapshot();
  trace.push("retire-arena-snapshot");
  const snapshot = hooks.measureSnapshot(routeEpoch);
  trace.push("measure-route-providers");
  if (snapshot.routeEpoch !== routeEpoch) {
    throw new Error("measured snapshot has the wrong route epoch");
  }
  hooks.publishSnapshot(snapshot);
  trace.push("publish-arena-snapshot");
  const resolution = hooks.resolveIntent(intent, snapshot);
  trace.push("resolve-placement-intent");
  hooks.applyPlacement(resolution);
  trace.push("apply-placement");
  return Object.freeze({
    routeEpoch,
    snapshot,
    resolution,
    trace: Object.freeze(trace),
  });
}

export function nearestSafeAnchorIntent(
  snapshot: ArenaSnapshot,
  point: UntaggedPoint,
  fallbackOrder: readonly PlacementFallback[] = [
    "anchor",
    "dock",
    "control",
    "hidden",
  ],
): AnchorPlacementIntent {
  const [nearest] = [...snapshot.anchors].sort((left, right) => {
    const leftCenter = pointForRegion(left.region, undefined);
    const rightCenter = pointForRegion(right.region, undefined);
    const leftDistance = Math.hypot(leftCenter.x - point.x, leftCenter.y - point.y);
    const rightDistance = Math.hypot(rightCenter.x - point.x, rightCenter.y - point.y);
    return leftDistance - rightDistance || compareIds(left.id, right.id);
  });
  return Object.freeze({
    kind: "anchor",
    preferredRole: nearest?.role ?? null,
    ...(nearest ? { preferredAnchorId: nearest.id } : {}),
    fallbackOrder: Object.freeze([...fallbackOrder]),
  });
}

function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
