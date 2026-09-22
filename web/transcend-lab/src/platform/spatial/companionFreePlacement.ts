import type {
  ActorEnvelope,
  ArenaPoint,
  ArenaSnapshot,
  FreePlacementIntent,
  UntaggedPoint,
  UntaggedRect,
} from "./companionWorld";

/** Lab-only resolver. It never writes world pose, acquires a lease, or activates an asset. */
export type FreePlacementRequest = Readonly<{
  routeEpoch: number;
  arenaRevision: number;
  point: ArenaPoint;
}>;

export type FreePlacementResult =
  | Readonly<{
      kind: "placed";
      point: ArenaPoint;
      resolution: "unchanged" | "adjusted";
      correctionDistance: number;
    }>
  | Readonly<{ kind: "no-space"; reason: "envelope-too-large" | "occupied" }>
  | Readonly<{
      kind: "rejected";
      reason: "stale-request" | "invalid-input" | "inconsistent-snapshot";
    }>;

type Bounds = Readonly<{ minX: number; maxX: number; minY: number; maxY: number }>;
type ForbiddenRootRect = Bounds;
const SPACE = "visual-viewport-css-px" as const;

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validRect(rect: UntaggedRect): boolean {
  return [rect.x, rect.y, rect.width, rect.height, rect.x + rect.width, rect.y + rect.height]
    .every(Number.isFinite) && rect.width >= 0 && rect.height >= 0;
}

function consistent(snapshot: ArenaSnapshot): boolean {
  if (
    snapshot.space !== SPACE
    || !nonnegativeInteger(snapshot.routeEpoch)
    || !nonnegativeInteger(snapshot.revision)
    || snapshot.viewport.space !== SPACE
    || snapshot.viewport.revision !== snapshot.revision
    || !validRect(snapshot.viewport)
  ) return false;
  if (!snapshot.hardZones.every((zone) =>
    zone.space === SPACE && zone.revision === snapshot.revision && validRect(zone))) return false;
  const seen = new Set<string>();
  return snapshot.anchors.every((anchor) => {
    if (!anchor.id || seen.has(anchor.id)) return false;
    seen.add(anchor.id);
    return anchor.routeEpoch === snapshot.routeEpoch
      && anchor.arenaRevision === snapshot.revision
      && anchor.region.space === SPACE
      && anchor.region.revision === snapshot.revision
      && validRect(anchor.region);
  });
}

function validEnvelope(envelope: ActorEnvelope, clearance: number): boolean {
  return [envelope.width, envelope.height, envelope.offsetX ?? 0, envelope.offsetY ?? 0, clearance]
    .every(Number.isFinite)
    && envelope.width > 0 && envelope.height > 0 && clearance >= 0;
}

function rootBounds(snapshot: ArenaSnapshot, envelope: ActorEnvelope, clearance: number): Bounds {
  const { x, y, width, height } = snapshot.viewport;
  const offsetX = envelope.offsetX ?? 0;
  const offsetY = envelope.offsetY ?? 0;
  return {
    minX: x + clearance + envelope.width / 2 - offsetX,
    maxX: x + width - clearance - envelope.width / 2 - offsetX,
    minY: y + clearance + envelope.height / 2 - offsetY,
    maxY: y + height - clearance - envelope.height / 2 - offsetY,
  };
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

function forbiddenRects(
  snapshot: ArenaSnapshot,
  envelope: ActorEnvelope,
  clearance: number,
): readonly ForbiddenRootRect[] {
  const halfWidth = envelope.width / 2 + clearance;
  const halfHeight = envelope.height / 2 + clearance;
  const offsetX = envelope.offsetX ?? 0;
  const offsetY = envelope.offsetY ?? 0;
  return snapshot.hardZones
    .filter((zone) => zone.width > 0 && zone.height > 0)
    .map((zone) => ({
      minX: zone.x - halfWidth - offsetX,
      maxX: zone.x + zone.width + halfWidth - offsetX,
      minY: zone.y - halfHeight - offsetY,
      maxY: zone.y + zone.height + halfHeight - offsetY,
    }));
}

function outsideObstacles(point: UntaggedPoint, obstacles: readonly ForbiddenRootRect[]): boolean {
  // Boundary contact is legal; positive clearance keeps the actual silhouette away from the UI.
  return obstacles.every((rect) => point.x <= rect.minX || point.x >= rect.maxX
    || point.y <= rect.minY || point.y >= rect.maxY);
}

function rejection(reason: "stale-request" | "invalid-input" | "inconsistent-snapshot"): FreePlacementResult {
  return Object.freeze({ kind: "rejected", reason });
}

function placed(snapshot: ArenaSnapshot, request: FreePlacementRequest, point: UntaggedPoint): FreePlacementResult {
  const distance = Math.hypot(point.x - request.point.x, point.y - request.point.y);
  if (!Number.isFinite(distance)) return rejection("invalid-input");
  return Object.freeze({
    kind: "placed",
    point: Object.freeze({ space: SPACE, revision: snapshot.revision, x: point.x, y: point.y }),
    resolution: distance === 0 ? "unchanged" : "adjusted",
    correctionDistance: distance,
  });
}

/**
 * Keep an already safe position exactly. Otherwise choose the closest safe root
 * for an axis-aligned rectangular visual/action envelope and rectangular hard zones.
 *
 * The nearest point lies on a viewport/expanded-obstacle boundary, on an
 * intersection of those boundaries, or at the requested coordinate along a free
 * axis. Testing their Cartesian product handles overlapping zones without greedy
 * push-out oscillation. Equal-distance ties use x, then y, not provider order.
 *
 * O(z^3) worst case; intended for the small, explicitly registered Lab zone set.
 * This is final placement, not pathfinding, physics, or a continuous collision solver.
 */
export function resolveFreePlacement(
  snapshot: ArenaSnapshot,
  request: FreePlacementRequest,
  envelope: ActorEnvelope,
  clearance = 8,
): FreePlacementResult {
  if (!consistent(snapshot)) return rejection("inconsistent-snapshot");
  if (
    request.routeEpoch !== snapshot.routeEpoch
    || request.arenaRevision !== snapshot.revision
    || request.point.revision !== snapshot.revision
    || request.point.space !== snapshot.space
  ) return rejection("stale-request");
  if (!validEnvelope(envelope, clearance)
    || !Number.isFinite(request.point.x) || !Number.isFinite(request.point.y)) {
    return rejection("invalid-input");
  }
  const bounds = rootBounds(snapshot, envelope, clearance);
  if (!validBounds(bounds)) return rejection("invalid-input");
  if (!fits(bounds)) return Object.freeze({ kind: "no-space", reason: "envelope-too-large" });
  const obstacles = forbiddenRects(snapshot, envelope, clearance);
  if (!obstacles.every(validBounds)) return rejection("invalid-input");
  const target = {
    x: clamp(request.point.x, bounds.minX, bounds.maxX),
    y: clamp(request.point.y, bounds.minY, bounds.maxY),
  };
  if (outsideObstacles(target, obstacles)) return placed(snapshot, request, target);

  const xs = new Set([target.x, bounds.minX, bounds.maxX]);
  const ys = new Set([target.y, bounds.minY, bounds.maxY]);
  for (const rect of obstacles) {
    xs.add(clamp(rect.minX, bounds.minX, bounds.maxX));
    xs.add(clamp(rect.maxX, bounds.minX, bounds.maxX));
    ys.add(clamp(rect.minY, bounds.minY, bounds.maxY));
    ys.add(clamp(rect.maxY, bounds.minY, bounds.maxY));
  }
  let best: UntaggedPoint | null = null;
  let bestDistance = Infinity;
  for (const x of [...xs].sort((left, right) => left - right)) {
    for (const y of [...ys].sort((top, bottom) => top - bottom)) {
      const point = { x, y };
      if (!outsideObstacles(point, obstacles)) continue;
      const distance = Math.hypot(x - request.point.x, y - request.point.y);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
  }
  return best ? placed(snapshot, request, best) : Object.freeze({ kind: "no-space", reason: "occupied" });
}

/** Preserve a committed FREE position independently of route-local anchor identity. */
export function freeIntentFromPoint(
  snapshot: ArenaSnapshot,
  point: ArenaPoint,
  envelope: ActorEnvelope,
  clearance = 8,
): FreePlacementIntent | null {
  if (!consistent(snapshot) || !validEnvelope(envelope, clearance)
    || point.space !== SPACE || point.revision !== snapshot.revision
    || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const bounds = rootBounds(snapshot, envelope, clearance);
  if (!validBounds(bounds) || !fits(bounds)) return null;
  const u = bounds.maxX === bounds.minX ? 0.5
    : clamp((point.x - bounds.minX) / (bounds.maxX - bounds.minX), 0, 1);
  const v = bounds.maxY === bounds.minY ? 0.5
    : clamp((point.y - bounds.minY) / (bounds.maxY - bounds.minY), 0, 1);
  return Object.freeze({ kind: "free", u, v });
}

/** Reproject intent into CURRENT geometry; the returned request still needs safety resolution. */
export function requestFromFreeIntent(
  snapshot: ArenaSnapshot,
  intent: FreePlacementIntent,
  envelope: ActorEnvelope,
  clearance = 8,
): FreePlacementRequest | null {
  if (!consistent(snapshot) || !validEnvelope(envelope, clearance)
    || intent.kind !== "free" || !Number.isFinite(intent.u) || !Number.isFinite(intent.v)
    || intent.u < 0 || intent.u > 1 || intent.v < 0 || intent.v > 1) return null;
  const bounds = rootBounds(snapshot, envelope, clearance);
  if (!validBounds(bounds) || !fits(bounds)) return null;
  return Object.freeze({
    routeEpoch: snapshot.routeEpoch,
    arenaRevision: snapshot.revision,
    point: Object.freeze({
      space: SPACE,
      revision: snapshot.revision,
      x: bounds.minX + intent.u * (bounds.maxX - bounds.minX),
      y: bounds.minY + intent.v * (bounds.maxY - bounds.minY),
    }),
  });
}
