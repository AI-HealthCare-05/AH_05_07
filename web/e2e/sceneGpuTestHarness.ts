export interface SceneGpuTestHarnessWindow extends Window {
  pendingSceneGpuFences?: number;
  sceneGpuFencePolls?: number;
  deletedSceneGpuFences?: number;
  pendingSceneRevealFrames?: number;
  pendingSceneGpuPollFrames?: number;
  canceledSceneGpuPollFrames?: number;
  signalSceneGpuFence?: () => void;
  releaseSceneRevealFrame?: () => boolean;
}

