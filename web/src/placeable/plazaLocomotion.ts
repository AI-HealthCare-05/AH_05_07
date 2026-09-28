import { cameraRelativeMovement } from "../../transcend-lab/src/platform/spatial/thirdPersonCamera";
import type { MovementIntent } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";
import { LIVING_WEEK_SCENE_PLAN } from "../../transcend-lab/src/platform/spatial/livingWeekScenePlan";

export const PLAZA_LOCOMOTION = Object.freeze({ speed: 1.8, acceleration: 7.5, deceleration: 10, turnRate: 8 });
// Active lite GLBs face +Z: their paired Eye meshes sit ahead of the head/root
// on +Z after glTF export. The exact-asset browser calibration tests protect this.
export const MODEL_FORWARD_YAW_OFFSET = 0;
export const shortestYaw = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const clamp = (value: number, bound: number) => Math.max(-bound, Math.min(bound, value));

/** Planar, visit-owned movement. Animation never writes this position or velocity. */
export class PlazaLocomotion {
  velocity = { x: 0, z: 0 };
  yaw = 0;
  #targetYaw = 0;
  moving = false;
  stop() { this.velocity.x = 0; this.velocity.z = 0; this.moving = false; this.#targetYaw = this.yaw; }

  step(position: Readonly<{ x: number; z: number }>, intent: MovementIntent, cameraYaw: number, seconds: number, reduced: boolean) {
    const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, 0.05)) : 0;
    if (!dt) return position;
    const direction = cameraRelativeMovement(intent, cameraYaw);
    const targetX = direction.x * PLAZA_LOCOMOTION.speed, targetZ = direction.z * PLAZA_LOCOMOTION.speed;
    const dx = targetX - this.velocity.x, dz = targetZ - this.velocity.z;
    const braking = !intent.magnitude || targetX * this.velocity.x + targetZ * this.velocity.z < 0;
    const change = (braking ? PLAZA_LOCOMOTION.deceleration : PLAZA_LOCOMOTION.acceleration) * dt;
    const fraction = reduced ? 1 : Math.min(1, change / (Math.hypot(dx, dz) || 1));
    this.velocity.x += dx * fraction; this.velocity.z += dz * fraction;
    const bound = LIVING_WEEK_SCENE_PLAN.boundMetres - 0.35;
    const wantedX = position.x + this.velocity.x * dt, wantedZ = position.z + this.velocity.z * dt;
    const x = clamp(wantedX, bound), z = clamp(wantedZ, bound);
    if (x !== wantedX) this.velocity.x = 0;
    if (z !== wantedZ) this.velocity.z = 0;
    const movedX = x - position.x, movedZ = z - position.z;
    this.moving = Math.hypot(movedX, movedZ) / dt > 0.005;
    if (this.moving) {
      this.#targetYaw = Math.atan2(movedX, movedZ) + MODEL_FORWARD_YAW_OFFSET;
    }
    // A brief step still finishes facing its last actual travel direction. A
    // lifecycle stop freezes this target too, so blur never leaves a turn backlog.
    const delta = shortestYaw(this.yaw, this.#targetYaw);
    this.yaw += reduced ? delta : clamp(delta, PLAZA_LOCOMOTION.turnRate * dt);
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    return { x, z };
  }
}
