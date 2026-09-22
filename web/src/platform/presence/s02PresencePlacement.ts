import type {
  PresenceArenaRect,
  S02PresenceArenaSnapshot,
} from "./s02PresenceArena";

export type PresenceArenaPoint = Readonly<{
  space: "visual-viewport-css-px";
  revision: number;
  x: number;
  y: number;
}>;

export type PresenceActorEnvelope = Readonly<{
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}>;

export type PresenceFreePlacementRequest = Readonly<{
  routeEpoch: number;
  arenaRevision: number;
  point: PresenceArenaPoint;
}>;

export type PresenceFreePlacementResult =
  | Readonly<{
      kind: "placed";
      point: PresenceArenaPoint;
      resolution: "unchanged" | "adjusted";
      correctionDistance: number;
    }>
  | Readonly<{ kind: "no-space"; reason: "envelope-too-large" | "occupied" }>
  | Readonly<{
      kind: "rejected";
      reason: "stale-request" | "invalid-input" | "inconsistent-snapshot";
    }>;

export type PresenceNormalizedPlacement = Readonly<{ x: number; y: number }>;

type Bounds = Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

const SPACE = "visual-viewport-css-px" as const;
const PLACEMENT_EPSILON_CSS_PX = 1e-6;

function nonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validRect(rect: PresenceArenaRect): boolean {
  return rect.space === SPACE
    && [rect.x, rect.y, rect.width, rect.height, rect.x + rect.width, rect.y + rect.height]
      .every(Number.isFinite)
    && rect.width >= 0
    && rect.height >= 0;
}

function movementRegion(snapshot: S02PresenceArenaSnapshot): PresenceArenaRect | null {
  const region = snapshot.anchors.find((anchor) => anchor.id === "today-sidecar")?.region ?? null;
  return region && validRect(region) ? region : null;
}

function consistent(snapshot: S02PresenceArenaSnapshot): boolean {
  const region = movementRegion(snapshot);
  if (
    snapshot.space !== SPACE
    || !nonNegativeInteger(snapshot.routeEpoch)
    || !nonNegativeInteger(snapshot.revision)
    || !validRect(snapshot.viewport)
    || snapshot.viewport.revision !== snapshot.revision
    || !region
    || region.revision !== snapshot.revision
  ) return false;

  const ids = new Set<string>();
  if (!snapshot.anchors.every((anchor) => {
    if (!anchor.id || ids.has(anchor.id)) return false;
    ids.add(anchor.id);
    return anchor.routeEpoch === snapshot.routeEpoch
      && anchor.arenaRevision === snapshot.revision
      && anchor.region.revision === snapshot.revision
      && validRect(anchor.region);
  })) return false;

  return snapshot.hardZones.every((zone) =>
    Boolean(zone.id)
    && zone.region.revision === snapshot.revision
    && validRect(zone.region));
}

function validEnvelope(envelope: PresenceActorEnvelope, clearance: number): boolean {
  return [
    envelope.width,
    envelope.height,
    envelope.offsetX,
    envelope.offsetY,
    clearance,
  ].every(Number.isFinite)
    && envelope.width > 0
    && envelope.height > 0
    && clearance >= 0;
}

function rootBounds(
  region: PresenceArenaRect,
  envelope: PresenceActorEnvelope,
  clearance: number,
): Bounds {
  return Object.freeze({
    minX: region.x + clearance + envelope.width / 2 - envelope.offsetX,
    maxX: region.x + region.width - clearance - envelope.width / 2 - envelope.offsetX,
    minY: region.y + clearance + envelope.height / 2 - envelope.offsetY,
    maxY: region.y + region.height - clearance - envelope.height / 2 - envelope.offsetY,
  });
}

function validBounds(bounds: Bounds): boolean {
  return Object.values(bounds).every(Number.isFinite);
}

function fits(bounds: Bounds): boolean {
  return bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function forbiddenRootRects(
  snapshot: S02PresenceArenaSnapshot,
  envelope: PresenceActorEnvelope,
  clearance: number,
): readonly Bounds[] {
  const halfWidth = envelope.width / 2 + clearance;
  const halfHeight = envelope.height / 2 + clearance;
  return Object.freeze(snapshot.hardZones
    .filter(({ region }) => region.width > 0 && region.height > 0)
    .map(({ region }) => Object.freeze({
      minX: region.x - halfWidth - envelope.offsetX,
      maxX: region.x + region.width + halfWidth - envelope.offsetX,
      minY: region.y - halfHeight - envelope.offsetY,
      maxY: region.y + region.height + halfHeight - envelope.offsetY,
    })));
}

function outsideObstacles(point: Readonly<{ x: number; y: number }>, obstacles: readonly Bounds[]): boolean {
  // Boundary contact is legal; the positive clearance keeps the silhouette away.
  return obstacles.every((rect) => point.x <= rect.minX
    || point.x >= rect.maxX
    || point.y <= rect.minY
    || point.y >= rect.maxY);
}

function rejected(
  reason: "stale-request" | "invalid-input" | "inconsistent-snapshot",
): PresenceFreePlacementResult {
  return Object.freeze({ kind: "rejected", reason });
}

function placed(
  snapshot: S02PresenceArenaSnapshot,
  request: PresenceFreePlacementRequest,
  point: Readonly<{ x: number; y: number }>,
): PresenceFreePlacementResult {
  const correctionDistance = Math.hypot(
    point.x - request.point.x,
    point.y - request.point.y,
  );
  if (!Number.isFinite(correctionDistance)) return rejected("invalid-input");
  return Object.freeze({
    kind: "placed",
    point: Object.freeze({
      space: SPACE,
      revision: snapshot.revision,
      x: point.x,
      y: point.y,
    }),
    resolution: correctionDistance <= PLACEMENT_EPSILON_CSS_PX ? "unchanged" : "adjusted",
    correctionDistance,
  });
}

/**
 * Resolve inside the `today-sidecar` Anchor only. Existing hard zones are
 * expanded by the actor envelope plus clearance. Equal-distance candidates are
 * considered in ascending x then y order, independent of provider order.
 */
export function resolveS02FreePlacement(
  snapshot: S02PresenceArenaSnapshot,
  request: PresenceFreePlacementRequest,
  envelope: PresenceActorEnvelope,
  clearance = 8,
): PresenceFreePlacementResult {
  if (!consistent(snapshot)) return rejected("inconsistent-snapshot");
  if (
    request.routeEpoch !== snapshot.routeEpoch
    || request.arenaRevision !== snapshot.revision
    || request.point.space !== SPACE
    || request.point.revision !== snapshot.revision
  ) return rejected("stale-request");
  if (
    !validEnvelope(envelope, clearance)
    || !Number.isFinite(request.point.x)
    || !Number.isFinite(request.point.y)
  ) return rejected("invalid-input");

  const region = movementRegion(snapshot)!;
  const bounds = rootBounds(region, envelope, clearance);
  if (!validBounds(bounds)) return rejected("invalid-input");
  if (!fits(bounds)) {
    return Object.freeze({ kind: "no-space", reason: "envelope-too-large" });
  }

  const obstacles = forbiddenRootRects(snapshot, envelope, clearance);
  if (!obstacles.every(validBounds)) return rejected("invalid-input");
  const target = Object.freeze({
    x: clamp(request.point.x, bounds.minX, bounds.maxX),
    y: clamp(request.point.y, bounds.minY, bounds.maxY),
  });
  if (outsideObstacles(target, obstacles)) return placed(snapshot, request, target);

  const xs = new Set([target.x, bounds.minX, bounds.maxX]);
  const ys = new Set([target.y, bounds.minY, bounds.maxY]);
  for (const rect of obstacles) {
    xs.add(clamp(rect.minX, bounds.minX, bounds.maxX));
    xs.add(clamp(rect.maxX, bounds.minX, bounds.maxX));
    ys.add(clamp(rect.minY, bounds.minY, bounds.maxY));
    ys.add(clamp(rect.maxY, bounds.minY, bounds.maxY));
  }

  let best: Readonly<{ x: number; y: number }> | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const x of [...xs].sort((left, right) => left - right)) {
    for (const y of [...ys].sort((top, bottom) => top - bottom)) {
      const candidate = Object.freeze({ x, y });
      if (!outsideObstacles(candidate, obstacles)) continue;
      const distance = Math.hypot(x - request.point.x, y - request.point.y);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  return best
    ? placed(snapshot, request, best)
    : Object.freeze({ kind: "no-space", reason: "occupied" });
}

export function envelopeFromProjection(
  root: PresenceArenaPoint,
  visualEnvelope: PresenceArenaRect,
): PresenceActorEnvelope | null {
  if (
    root.space !== SPACE
    || visualEnvelope.space !== SPACE
    || root.revision !== visualEnvelope.revision
    || !validRect(visualEnvelope)
    || visualEnvelope.width <= 0
    || visualEnvelope.height <= 0
  ) return null;
  return Object.freeze({
    width: visualEnvelope.width,
    height: visualEnvelope.height,
    offsetX: visualEnvelope.x + visualEnvelope.width / 2 - root.x,
    offsetY: visualEnvelope.y + visualEnvelope.height / 2 - root.y,
  });
}

export function normalizedPlacementFromPoint(
  snapshot: S02PresenceArenaSnapshot,
  point: PresenceArenaPoint,
  envelope: PresenceActorEnvelope,
  clearance = 8,
): PresenceNormalizedPlacement | null {
  if (
    !consistent(snapshot)
    || !validEnvelope(envelope, clearance)
    || point.space !== SPACE
    || point.revision !== snapshot.revision
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
  ) return null;
  const bounds = rootBounds(movementRegion(snapshot)!, envelope, clearance);
  if (!validBounds(bounds) || !fits(bounds)) return null;
  return Object.freeze({
    x: bounds.maxX === bounds.minX
      ? 0.5
      : clamp((point.x - bounds.minX) / (bounds.maxX - bounds.minX), 0, 1),
    y: bounds.maxY === bounds.minY
      ? 0.5
      : clamp((point.y - bounds.minY) / (bounds.maxY - bounds.minY), 0, 1),
  });
}

export function requestFromNormalizedPlacement(
  snapshot: S02PresenceArenaSnapshot,
  normalized: PresenceNormalizedPlacement,
  envelope: PresenceActorEnvelope,
  clearance = 8,
): PresenceFreePlacementRequest | null {
  if (
    !consistent(snapshot)
    || !validEnvelope(envelope, clearance)
    || !Number.isFinite(normalized.x)
    || !Number.isFinite(normalized.y)
    || normalized.x < 0
    || normalized.x > 1
    || normalized.y < 0
    || normalized.y > 1
  ) return null;
  const bounds = rootBounds(movementRegion(snapshot)!, envelope, clearance);
  if (!validBounds(bounds) || !fits(bounds)) return null;
  return Object.freeze({
    routeEpoch: snapshot.routeEpoch,
    arenaRevision: snapshot.revision,
    point: Object.freeze({
      space: SPACE,
      revision: snapshot.revision,
      x: bounds.minX + normalized.x * (bounds.maxX - bounds.minX),
      y: bounds.minY + normalized.y * (bounds.maxY - bounds.minY),
    }),
  });
}
