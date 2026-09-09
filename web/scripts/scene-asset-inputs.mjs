const sharedSources = [
  "web/src/components/scene/environment.ts",
  "web/src/components/scene/ThreeSceneRenderer.tsx",
  "web/src/components/VisualStage.tsx",
  "web/src/ui/sceneRecipes.ts",
  "web/src/ui/scenePolicy.ts",
  "web/src/styles.css",
  "web/scripts/capture-scene-posters.mjs",
];

export const sceneRegistrations = {
  S02: { evidence: "docs/evidence/scene-clay-posters.json", publicEvidence: "docs/evidence/scene-clay-r2.json",
    directory: "scene-review/s02/v1", posterPrefix: "poster-", environmentId: "procedural-landmarks",
    environmentIds: ["procedural-landmarks"], sources: sharedSources },
  S10: { evidence: "docs/evidence/scene-diorama-posters.json", publicEvidence: "docs/evidence/scene-diorama-r2.json",
    directory: "scene-review/s10/v1", posterPrefix: "poster-s10-", environmentId: "calendar-diorama",
    environmentIds: ["procedural-landmarks", "calendar-diorama"], sources: [...sharedSources, "web/src/components/scene/diorama.ts"] },
};
