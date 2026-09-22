export const sceneCaptureProfiles = {
  mobile320: { viewportWidth: 320, viewportHeight: 844, stageWidth: 256 },
  mobile390: { viewportWidth: 390, viewportHeight: 844, stageWidth: 326 },
  desktop: { viewportWidth: 1366, viewportHeight: 900, stageWidth: 1069 },
};

const sharedCaptureSources = [
  "web/src/components/scene/environment.ts",
  "web/src/components/scene/ThreeSceneRenderer.tsx",
  "web/src/components/scene/s02SceneActor.ts",
  "web/src/components/scene/disposeScene.ts",
  "web/src/components/scene/scene-stage.css",
  "web/src/components/VisualStage.tsx",
  "web/src/ui/sceneRecipes.ts",
  "web/src/ui/companionSceneRegistry.ts",
  "web/src/ui/companionPresentationProfiles.ts",
  "web/src/ui/scenePolicy.ts",
  "web/scripts/scene-asset-inputs.mjs",
  "web/scripts/capture-scene-posters.mjs",
];

// These sources own the current visual relationship between the realtime scene
// and its canonical poster fallback. Capture orchestration and disposal remain
// provenance/behavior concerns, but do not define current pixel compatibility.
export const sceneRuntimeVisualSources = [
  "web/src/components/scene/scene-stage.css",
  "web/src/components/scene/ThreeSceneRenderer.tsx",
  "web/src/components/scene/s02SceneActor.ts",
  "web/src/components/scene/environment.ts",
  "web/src/components/scene/diorama.ts",
  "web/src/ui/sceneRecipes.ts",
  "web/src/ui/scenePolicy.ts",
  "web/src/ui/companionSceneRegistry.ts",
  "web/src/ui/companionPresentationProfiles.ts",
];

export const sceneRegistrations = {
  S02: { evidence: "docs/evidence/scene-clay-posters.json", publicEvidence: "docs/evidence/scene-clay-r2.json",
    directory: "scene-review/s02/v1", posterPrefix: "poster-", environmentId: "procedural-landmarks",
    environmentIds: ["procedural-landmarks"], captureSources: sharedCaptureSources },
  S10: { evidence: "docs/evidence/scene-diorama-posters.json", publicEvidence: "docs/evidence/scene-diorama-r2.json",
    directory: "scene-review/s10/v1", posterPrefix: "poster-s10-", environmentId: "calendar-diorama",
    environmentIds: ["procedural-landmarks", "calendar-diorama"], captureSources: [...sharedCaptureSources, "web/src/components/scene/diorama.ts"] },
};
