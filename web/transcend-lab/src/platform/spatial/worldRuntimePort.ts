import type { MovementInputSnapshot } from "../behavior/worldMovementIntent";
import type {
  ThirdPersonCameraConfig,
  ThirdPersonCameraResult,
} from "./thirdPersonCamera";
import type { WorldPoint3 } from "./worldSpaceClock";

export type WorldRuntimeLifecycle = "stopped" | "loading" | "running" | "error";

export type WorldRuntimeSnapshot = Readonly<{
  lifecycle: WorldRuntimeLifecycle;
  position: WorldPoint3 | null;
  previousPosition: WorldPoint3 | null;
  input: MovementInputSnapshot;
}>;

/**
 * Minimal renderer/input-facing world runtime boundary.
 *
 * Rendering and DOM input do not need to know which concrete world profile or
 * physics fixture produced the state behind this port.
 */
export interface WorldRuntimePort {
  readonly snapshot: WorldRuntimeSnapshot;
  sample(frameTimeMilliseconds: number): number;
  key(code: string, pressed: boolean): boolean;
  beginPointer(id: number): boolean;
  updatePointer(id: number, lateral: number, forward: number): boolean;
  endPointer(id: number): boolean;
  setYaw(radians: number): void;
  camera(config: ThirdPersonCameraConfig, radius: number): ThirdPersonCameraResult | null;
  setHidden(hidden: boolean): void;
  blur(): void;
}
