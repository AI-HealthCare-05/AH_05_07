import { resolveThirdPersonCamera, type CameraObstacle } from "../../transcend-lab/src/platform/spatial/thirdPersonCamera";
import { worldPoint } from "../../transcend-lab/src/platform/spatial/worldSpaceClock";
import { shortestYaw } from "./plazaLocomotion";

export const PLAZA_CAMERA = Object.freeze({ minPitch: 0.24, maxPitch: 0.9, pitch: 0.4,
  distance: 8.5, minDistance: 5, maxDistance: 12, obstructionDistance: 1.6, clearance: 0.35,
  sensitivity: 0.005, damping: 10, focusDamping: 7 });
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** One camera rig, stepped by the world's existing RAF. Arrival is exactly authored. */
export class PlazaCameraRig {
  engaged = false;
  yaw = Math.atan2(0.45, 10.15);
  pitch: number = PLAZA_CAMERA.pitch;
  distance: number = PLAZA_CAMERA.distance;
  occluded = false;
  #boomDistance: number | null = null;
  #targetYaw = this.yaw;
  #targetPitch = this.pitch;
  #targetDistance = this.distance;
  #aspect = 1;
  #paused = false;
  #focus = { x: 0, y: 1.1, z: -0.65 };

  resize(aspect: number) { this.#aspect = Math.max(0.1, aspect); }
  engage() { this.engaged = true; this.#paused = false; }
  orbit(dx: number, dy: number) {
    if (![dx, dy].every(Number.isFinite)) return;
    this.engage(); this.#targetYaw += dx;
    this.#targetPitch = clamp(this.#targetPitch + dy, PLAZA_CAMERA.minPitch, PLAZA_CAMERA.maxPitch);
  }
  zoom(delta: number) {
    if (!Number.isFinite(delta)) return;
    this.engage(); this.#targetDistance = clamp(this.#targetDistance + delta, PLAZA_CAMERA.minDistance, PLAZA_CAMERA.maxDistance);
  }
  reset() {
    this.#paused = false;
    this.#targetYaw = Math.atan2(0.45, 10.15);
    this.#targetPitch = PLAZA_CAMERA.pitch; this.#targetDistance = PLAZA_CAMERA.distance;
  }
  stop() {
    // Blur/hidden/suspension cannot accumulate an orbit to replay on return.
    if (!this.engaged) return;
    this.#paused = true;
    this.#targetYaw = this.yaw; this.#targetPitch = this.pitch; this.#targetDistance = this.distance;
  }
  step(actor: Readonly<{ x: number; z: number }>, seconds: number, reduced: boolean, obstacles: readonly CameraObstacle[] = []) {
    if (!this.engaged) {
      const scale = Math.max(1, 0.67 / this.#aspect);
      const dy = 4.2 * scale - 1.1, dz = 9.5 * scale + 0.65;
      this.yaw = this.#targetYaw = Math.atan2(0.45, dz);
      this.pitch = Math.atan2(dy, Math.hypot(0.45, dz));
      this.distance = Math.hypot(0.45, dy, dz);
      return { position: { x: 0.45, y: 4.2 * scale, z: 9.5 * scale }, focus: this.#focus };
    }
    const dt = !this.#paused && Number.isFinite(seconds) ? clamp(seconds, 0, 0.05) : 0;
    const blend = this.#paused ? 0 : reduced ? 1 : 1 - Math.exp(-PLAZA_CAMERA.damping * dt);
    const focusBlend = this.#paused ? 0 : reduced ? 1 : 1 - Math.exp(-PLAZA_CAMERA.focusDamping * dt);
    this.yaw += shortestYaw(this.yaw, this.#targetYaw) * blend;
    this.pitch += (this.#targetPitch - this.pitch) * blend;
    this.distance += (this.#targetDistance - this.distance) * blend;
    const focus = { x: actor.x, y: 0.85, z: actor.z - 0.35 };
    for (const axis of ["x", "y", "z"] as const) this.#focus[axis] += (focus[axis] - this.#focus[axis]) * focusBlend;
    const portrait = Math.max(1, Math.min(1.45, 0.6 / this.#aspect));
    const focusPoint = worldPoint(this.#focus.x, this.#focus.y, this.#focus.z);
    const config = {
      yawRadians: this.yaw, pitchRadians: this.pitch, minPitchRadians: PLAZA_CAMERA.minPitch,
      maxPitchRadians: PLAZA_CAMERA.maxPitch, desiredDistance: this.distance * portrait,
      minDistance: PLAZA_CAMERA.obstructionDistance, obstructionClearance: PLAZA_CAMERA.clearance,
    };
    const resolved = resolveThirdPersonCamera(focusPoint, config, obstacles);
    this.occluded = resolved.occluded;
    // Retract immediately before an authored obstruction; ease back out only
    // once the boom is clear. This reuses the Lab's bounded pure segment solver.
    const previous = this.#boomDistance ?? config.desiredDistance;
    this.#boomDistance = Math.min(resolved.resolvedDistance, previous + (config.desiredDistance - previous) * blend);
    return resolveThirdPersonCamera(focusPoint, { ...config, desiredDistance: this.#boomDistance });
  }
}
