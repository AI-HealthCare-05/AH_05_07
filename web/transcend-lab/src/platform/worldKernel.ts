export {
  KinematicWorldKernel,
  type KinematicKernelConfig,
  type KinematicWorldProfile,
} from "./spatial/kinematicWorldKernel";

export {
  type WorldRuntimeLifecycle,
  type WorldRuntimePort,
  type WorldRuntimeSnapshot,
} from "./spatial/worldRuntimePort";

export {
  type WorldSceneDestination,
  type WorldSceneProfile,
} from "./spatial/worldSceneProfile";

export {
  RAMP_TRIANGLES,
  rampVertices,
  type WorldFixture,
} from "./spatial/worldFixtureGeometry";

export {
  type WorldPlayableSession,
} from "./runtime/worldPlayableSession";

export {
  type WorldPlayableClip,
  type WorldPlayableDiagnostics,
  type WorldPlayableMountOptions,
  type WorldPlayableStagePort,
} from "./runtime/worldPlayableStagePort";

export {
  type WorldTouchSurfaceInstaller,
  type WorldTouchSurfaceOptions,
} from "./runtime/worldTouchSurfacePort";

export {
  type WorldResourceLoad,
  type WorldResourceScope,
} from "./runtime/worldResourceScope";

export {
  type WorldRenderableAsset,
} from "./embodiment/worldRenderableAsset";

export {
  FixedStepClock,
  WORLD_SPACE,
  translateWorldPoint,
  worldPoint,
  worldVector,
  type WorldPoint3,
  type WorldVector3,
} from "./spatial/worldSpaceClock";
