import {
  WORLD_SPACE,
  type WorldPoint3,
  type WorldVector3,
  worldPoint,
  worldVector,
} from "./worldSpaceClock";

export type CameraRelativeMoveIntent = Readonly<{
  lateral: number;
  forward: number;
}>;

export type CameraObstacle = Readonly<{
  id: string;
  min: WorldPoint3;
  max: WorldPoint3;
}>;

export type ThirdPersonCameraConfig = Readonly<{
  yawRadians: number;
  pitchRadians: number;
  minPitchRadians: number;
  maxPitchRadians: number;
  desiredDistance: number;
  minDistance: number;
  obstructionClearance: number;
}>;

export type ThirdPersonCameraResult = Readonly<{
  focus: WorldPoint3;
  position: WorldPoint3;
  yawRadians: number;
  pitchRadians: number;
  desiredDistance: number;
  resolvedDistance: number;
  occluded: boolean;
  obstructionId: string | null;
}>;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function positive(value: number, label: string): number {
  const next = finite(value, label);
  if (next <= 0) throw new RangeError(`${label} must be greater than zero`);
  return next;
}

function validatePoint(point: WorldPoint3, label: string): WorldPoint3 {
  if (point.space !== WORLD_SPACE || point.kind !== "point") {
    throw new Error(`${label} must be a WorldSpace point`);
  }
  finite(point.x, `${label}.x`);
  finite(point.y, `${label}.y`);
  finite(point.z, `${label}.z`);
  return point;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizedHorizontal(x: number, z: number): readonly [number, number] {
  const length = Math.hypot(x, z);
  if (length <= 1e-12) return [0, 0] as const;
  const divisor = Math.max(1, length);
  return [x / divisor, z / divisor] as const;
}

export function cameraRelativeMovement(
  intent: CameraRelativeMoveIntent,
  yawRadians: number,
): WorldVector3 {
  const lateral = finite(intent.lateral, "intent.lateral");
  const forward = finite(intent.forward, "intent.forward");
  const yaw = finite(yawRadians, "yawRadians");
  const [inputLateral, inputForward] = normalizedHorizontal(lateral, forward);

  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const rightX = cos;
  const rightZ = -sin;
  const forwardX = -sin;
  const forwardZ = -cos;
  return worldVector(
    rightX * inputLateral + forwardX * inputForward,
    0,
    rightZ * inputLateral + forwardZ * inputForward,
  );
}

export function cameraObstacle(
  id: string,
  min: WorldPoint3,
  max: WorldPoint3,
): CameraObstacle {
  if (!id.trim()) throw new Error("camera obstacle id must not be empty");
  validatePoint(min, "obstacle.min");
  validatePoint(max, "obstacle.max");
  if (min.x > max.x || min.y > max.y || min.z > max.z) {
    throw new RangeError("camera obstacle min must not exceed max");
  }
  return Object.freeze({ id, min, max });
}

function segmentEntryFraction(
  start: WorldPoint3,
  end: WorldPoint3,
  obstacle: CameraObstacle,
): number | null {
  let lower = 0;
  let upper = 1;
  const axes = ["x", "y", "z"] as const;

  for (const axis of axes) {
    const origin = start[axis];
    const delta = end[axis] - origin;
    const min = obstacle.min[axis];
    const max = obstacle.max[axis];

    if (Math.abs(delta) <= 1e-12) {
      if (origin < min || origin > max) return null;
      continue;
    }

    let a = (min - origin) / delta;
    let b = (max - origin) / delta;
    if (a > b) [a, b] = [b, a];
    lower = Math.max(lower, a);
    upper = Math.min(upper, b);
    if (lower > upper) return null;
  }

  return lower >= 0 && lower <= 1 ? lower : null;
}

function validateConfig(config: ThirdPersonCameraConfig): Readonly<{
  yaw: number;
  pitch: number;
  desiredDistance: number;
  minDistance: number;
  clearance: number;
}> {
  const yaw = finite(config.yawRadians, "yawRadians");
  const minPitch = finite(config.minPitchRadians, "minPitchRadians");
  const maxPitch = finite(config.maxPitchRadians, "maxPitchRadians");
  if (minPitch > maxPitch) throw new RangeError("minPitchRadians must not exceed maxPitchRadians");
  const pitch = clamp(finite(config.pitchRadians, "pitchRadians"), minPitch, maxPitch);
  const desiredDistance = positive(config.desiredDistance, "desiredDistance");
  const minDistance = positive(config.minDistance, "minDistance");
  if (minDistance > desiredDistance) {
    throw new RangeError("minDistance must not exceed desiredDistance");
  }
  const clearance = finite(config.obstructionClearance, "obstructionClearance");
  if (clearance < 0) throw new RangeError("obstructionClearance must be non-negative");
  return Object.freeze({ yaw, pitch, desiredDistance, minDistance, clearance });
}

function pointAlongBoom(
  focus: WorldPoint3,
  yaw: number,
  pitch: number,
  distance: number,
): WorldPoint3 {
  const horizontal = Math.cos(pitch) * distance;
  return worldPoint(
    focus.x + Math.sin(yaw) * horizontal,
    focus.y + Math.sin(pitch) * distance,
    focus.z + Math.cos(yaw) * horizontal,
  );
}

export function resolveThirdPersonCamera(
  focusPoint: WorldPoint3,
  config: ThirdPersonCameraConfig,
  obstacles: readonly CameraObstacle[] = [],
): ThirdPersonCameraResult {
  const focus = validatePoint(focusPoint, "focus");
  const resolved = validateConfig(config);
  const desiredPosition = pointAlongBoom(
    focus,
    resolved.yaw,
    resolved.pitch,
    resolved.desiredDistance,
  );

  const hits = obstacles.map((obstacle) => {
    cameraObstacle(obstacle.id, obstacle.min, obstacle.max);
    return Object.freeze({
      obstacle,
      fraction: segmentEntryFraction(focus, desiredPosition, obstacle),
    });
  }).filter((entry): entry is Readonly<{
    obstacle: CameraObstacle;
    fraction: number;
  }> => entry.fraction !== null)
    .sort((left, right) =>
      left.fraction - right.fraction || left.obstacle.id.localeCompare(right.obstacle.id),
    );

  const nearest = hits[0] ?? null;
  const hitDistance = nearest ? nearest.fraction * resolved.desiredDistance : resolved.desiredDistance;
  const resolvedDistance = nearest
    ? Math.max(resolved.minDistance, hitDistance - resolved.clearance)
    : resolved.desiredDistance;

  return Object.freeze({
    focus,
    position: pointAlongBoom(focus, resolved.yaw, resolved.pitch, resolvedDistance),
    yawRadians: resolved.yaw,
    pitchRadians: resolved.pitch,
    desiredDistance: resolved.desiredDistance,
    resolvedDistance,
    occluded: nearest !== null,
    obstructionId: nearest?.obstacle.id ?? null,
  });
}
