import type { WorldResourceScope } from "./worldResourceScope";
import type { WorldRuntimePort } from "../spatial/worldRuntimePort";

export type WorldTouchSurfaceOptions = Readonly<{
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  resources: WorldResourceScope;
  world: WorldRuntimePort;
  look: (dx: number, dy: number) => void;
}>;

export type WorldTouchSurfaceInstaller = (options: WorldTouchSurfaceOptions) => void;
