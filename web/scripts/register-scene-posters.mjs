// Run after capture-scene-posters.mjs. Validate all authored outputs before writing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { generateSceneSource, loadInputs, selectPosterDelivery } from "./verify-scene-manifest.mjs";
import { sceneRegistrations } from "./scene-asset-inputs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const input = path.join(root, "web/src/ui/scene-manifest.v2.json");
const manifest = JSON.parse(fs.readFileSync(input, "utf8"));
const inputs = loadInputs();
const character = manifest.assets.find(asset => asset.kind === "character");
const environments = manifest.assets.filter(asset => asset.kind === "environment");
for (const environment of environments) {
  const bytes = fs.readFileSync(path.join(root, environment.sourceModule.path));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  environment.revision = "clay-001";
  environment.sourceModule = { ...environment.sourceModule, sha256, byteLength: bytes.length };
  environment.provenance.sourceHash = sha256;
}
const template = manifest.assets.find(asset => asset.kind === "poster");
const allPosters = [], allRecipes = [];
for (const [screen, registration] of Object.entries(sceneRegistrations)) {
  const evidence = screen === "S02" ? inputs.posters : inputs.dioramaPosters;
  const publicEvidence = screen === "S02" ? inputs.posterR2 : inputs.dioramaR2;
  const posters = evidence.posters.map(poster => ({ ...template, id: poster.id, revision: "clay-001", status: "review",
    delivery: selectPosterDelivery(poster, publicEvidence),
    provenance: { sourceAssetId: `render:${poster.id}`, sourceHash: poster.delivery.sha256, owner: "AI-HealthCare-05/AH_05_07", rightsBasis: "Repository-authored scene render with registered bear-lite; character rights retained", reviewReference: "https://github.com/AI-HealthCare-05/AH_05_07/issues/390" },
  }));
  const realtime = manifest.recipes.filter(recipe => recipe.mode === "realtime" && recipe.screens[0] === screen);
  const staticTemplate = manifest.recipes.find(recipe => recipe.mode === "static" && recipe.screens[0] === screen);
  const fallbacks = realtime.map(recipe => {
    const assetIds = [], compositions = {};
    for (const [profile, composition] of Object.entries(recipe.compositions)) {
      const poster = evidence.posters.find(entry => entry.landmarkId === recipe.landmarkId && entry.profile === profile);
      assetIds.push(poster.id);
      compositions[profile] = { ...composition, camera: null, projection: "poster", posterAssetId: poster.id };
    }
    const id = `${recipe.id}-poster`;
    recipe.fallback.tier1RecipeId = id;
    recipe.environmentAssetId = registration.environmentId;
    return { ...staticTemplate, id, landmarkId: recipe.landmarkId, assetIds, compositions };
  });
  allPosters.push(...posters);
  allRecipes.push(fallbacks[0], ...realtime, ...fallbacks.slice(1));
}
manifest.manifestRevision = allPosters.every(poster => poster.delivery.url.startsWith("https://")) ? "s02-s10-clay-r2-001" : "s02-s10-clay-review-001";
// Keep the established S02 entries in their existing order for reviewable diffs.
manifest.assets = [character, allPosters[0], environments[0], ...allPosters.slice(1, 21), environments[1], ...allPosters.slice(21)];
manifest.recipes = allRecipes;
const generated = generateSceneSource(manifest, inputs);
fs.writeFileSync(input, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(root, "web/src/ui/sceneManifest.generated.ts"), generated);
console.log("Registered 42 posters and 14 weekday fallback recipes; production gate remains off.");
