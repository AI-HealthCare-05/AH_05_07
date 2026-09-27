import type { WorldRenderableAsset } from "../embodiment/worldRenderableAsset";
import type { WorldResourceScope } from "../runtime/worldResourceScope";
import type { WorldRuntimePort } from "../spatial/worldRuntimePort";

export type WorldPlayableClip = "idle" | "move";

export type WorldPlayableDiagnostics = Readonly<{
  mounted: boolean;
  clip: WorldPlayableClip | null;
  cameraOccluded: boolean;
  yawRadians: number;
  pitchRadians: number;
  renderCount: number;
  desiredCameraDistance: number;
  resolvedCameraDistance: number | null;
  actorYawRadians: number | null;
  reducedMotion: boolean;
  animationTimeSeconds: number;
  fixtureIds: readonly string[];
  destinationNear: boolean;
  overlayMarkerCount: number;
  overlaySegmentCount: number;
  renderedOverlayMarkerCount: number;
  renderedOverlaySegmentCount: number;
  renderedOverlayLabelCount: number;
  activeOverlayMarkerId: string | null;
}>;

export type WorldPlayableMountOptions = Readonly<{
  host: HTMLElement;
  resources: WorldResourceScope;
  world: WorldRuntimePort;
  asset: WorldRenderableAsset;
  reducedMotion: boolean;
  onFailure: (error: Error) => void;
}>;

export interface WorldPlayableStagePort {
  diagnostics(): WorldPlayableDiagnostics;
  mount(options: WorldPlayableMountOptions): Promise<void>;
  nudgeCamera(deltaYawRadians: number): void;
  zoomCamera(deltaMetres: number): boolean;
  resetCamera(): void;
  unmount(): void;
}
