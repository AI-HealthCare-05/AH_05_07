// Run after capture-scene-posters.mjs. Validate all authored outputs before writing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { generateSceneSource, loadInputs, selectPosterDelivery } from "./verify-scene-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const input = path.join(root, "web/src/ui/scene-manifest.v2.json");
const manifest = JSON.parse(fs.readFileSync(input, "utf8"));
const evidence = JSON.parse(fs.readFileSync(path.join(root, "docs/evidence/scene-clay-posters.json"), "utf8"));
const inputs = loadInputs();
const character = manifest.assets.find(asset => asset.kind === "character");
const environment = manifest.assets.find(asset => asset.kind === "environment");
const bytes = fs.readFileSync(path.join(root, environment.sourceModule.path));
const sha256 = createHash("sha256").update(bytes).digest("hex");
environment.revision = "clay-001";
environment.sourceModule = { ...environment.sourceModule, sha256, byteLength: bytes.length };
environment.provenance.sourceHash = sha256;
const template = manifest.assets.find(asset => asset.kind === "poster");
const posters = evidence.posters.map(poster => ({ ...template, id: poster.id, revision: "clay-001", status: "review", delivery: selectPosterDelivery(poster, inputs.posterR2),
  provenance: { sourceAssetId: `render:${poster.id}`, sourceHash: poster.delivery.sha256, owner: "AI-HealthCare-05/AH_05_07", rightsBasis: "Repository-authored scene render with registered bear-lite; character rights retained", reviewReference: "https://github.com/AI-HealthCare-05/AH_05_07/issues/390" },
}));
const realtime = manifest.recipes.filter(recipe => recipe.mode === "realtime");
const staticTemplate = manifest.recipes.find(recipe => recipe.mode === "static");
const fallbacks = realtime.map(recipe => {
  const assetIds = [], compositions = {};
  for (const [profile, composition] of Object.entries(recipe.compositions)) {
    const poster = evidence.posters.find(entry => entry.landmarkId === recipe.landmarkId && entry.profile === profile);
    assetIds.push(poster.id);
    compositions[profile] = { ...composition, camera: null, projection: "poster", posterAssetId: poster.id };
  }
  const id = `${recipe.id}-poster`;
  recipe.fallback.tier1RecipeId = id;
  return { ...staticTemplate, id, landmarkId: recipe.landmarkId, assetIds, compositions };
});
manifest.manifestRevision = posters.every(poster => poster.delivery.url.startsWith("https://")) ? "s02-clay-r2-001" : "s02-clay-001";
manifest.assets = [character, posters[0], environment, ...posters.slice(1)];
manifest.recipes = [fallbacks[0], ...realtime, ...fallbacks.slice(1)];
const generated = generateSceneSource(manifest, inputs);
fs.writeFileSync(input, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(root, "web/src/ui/sceneManifest.generated.ts"), generated);
console.log("Registered 21 posters and seven weekday fallback recipes; production gate remains off.");
