import path from "node:path";

// Only these existing E1/generic seams may enter the optional product scene.
// The Lab shell, orchestrator, asset admission and physics runtime stay excluded.
export const E2_WORLD_SEAMS = Object.freeze([
  "platform/spatial/e1LivingCityEntrySceneProfile.ts",
  "platform/spatial/w4LivingWeekWorldSceneProfile.ts",
  "platform/spatial/livingWeekScenePlan.ts",
  "platform/spatial/livingWeekLandmarks.ts",
  "platform/spatial/livingWeekRenderProjection.ts",
  "platform/spatial/worldSpaceClock.ts",
  "platform/spatial/thirdPersonCamera.ts",
  "platform/behavior/worldMovementIntent.ts",
]);
const normalize = (id) => id.replaceAll("\\", "/").split("?")[0];
export function assertPlaceableModule(id) {
  const module = normalize(id);
  const seam = module.split("/transcend-lab/src/")[1];
  if (seam !== undefined && !E2_WORLD_SEAMS.includes(seam)) {
    throw new Error(`Product E2 imported a Lab module outside its narrow seams: ${seam}`);
  }
  if (/rapier/i.test(module)) throw new Error("Product E2 may not pull in the Lab physics runtime");
}

export function assertDefaultEntryIsolation(bundle) {
  const chunks = Object.values(bundle).filter((output) => output.type === "chunk");
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const isE2Runtime = (id) => /\/src\/placeable\/(?!contract\.ts$)/.test(normalize(id));
  const isWorld = (id) => /\/src\/placeable\/(?:PlaceableWorld|worldScene|worldInput|plazaLocomotion|plazaCamera|plazaPointerGesture|livingCityRenderDensity|livingChoiceMarker|companionActor)\./.test(normalize(id))
    || normalize(id).includes("/transcend-lab/src/");
  for (const entry of chunks.filter((chunk) => Object.keys(chunk.modules).some((id) =>
    /\/src\/(?:main|App|GuestJourneySandbox|placeable\/ProductPlaceableEntry)\.tsx$/.test(normalize(id))))) {
    const optionalEntry = !Object.keys(entry.modules).some((id) =>
      /\/src\/(?:main|App|GuestJourneySandbox)\.tsx$/.test(normalize(id)));
    const visited = new Set(), pending = [entry];
    while (pending.length) {
      const chunk = pending.pop();
      if (visited.has(chunk.fileName)) continue;
      visited.add(chunk.fileName);
      if (Object.keys(chunk.modules).some(optionalEntry ? isWorld : isE2Runtime)) {
        throw new Error(`Default/Classic entry eagerly executes E2 3D: ${entry.fileName} -> ${chunk.fileName}`);
      }
      for (const imported of chunk.imports) if (byFile.has(imported)) pending.push(byFile.get(imported));
    }
  }
}

export function placeableBoundary() {
  let webRoot;
  return {
    name: "placeable-opt-in-boundary",
    configResolved(config) { webRoot = normalize(path.resolve(config.root)); },
    moduleParsed(module) {
      assertPlaceableModule(module.id);
      // The scene/input can consume the value contract and generic world seams,
      // never the account composition, controller, API or health state.
      if (/\/src\/placeable\/(?:PlaceableWorld|worldScene|worldInput|plazaLocomotion|plazaCamera|plazaPointerGesture|livingCityRenderDensity|livingChoiceMarker|keepsakeMedia|contract|companionActor)\.(?:ts|tsx)$/.test(normalize(module.id))
        || /\/src\/ui\/(?:livingChoice|mySpaceCompanion|companionActiveAsset|companionSceneRegistry)\.ts$/.test(normalize(module.id))
        || normalize(module.id).includes("/transcend-lab/src/")) {
        for (const id of [...module.importedIds, ...module.dynamicallyImportedIds]) {
          const relative = normalize(id).slice(webRoot.length + 1);
          if (relative.startsWith("src/") && !/^src\/(?:placeable\/(?:contract|worldScene|worldInput|plazaLocomotion|plazaCamera|plazaPointerGesture|livingCityRenderDensity|livingChoiceMarker|keepsakeMedia|companionActor)|ui\/(?:livingChoice|mySpaceCompanion|companion|companionActiveAsset|companionAssets\.generated|companionSceneRegistry|sceneManifest\.generated)|components\/scene\/disposeScene)\.ts$/.test(relative)) {
            throw new Error(`E2 renderer imported product state: ${relative}`);
          }
        }
      }
    },
    generateBundle(_options, bundle) { assertDefaultEntryIsolation(bundle); },
  };
}
