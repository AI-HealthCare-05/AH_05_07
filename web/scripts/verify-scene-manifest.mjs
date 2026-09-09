import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { buildGeneratedSource as verifyCompanionEvidence } from "./generate-companion-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, label) => requireValue(isDeepStrictEqual(actual, expected), `${label}: evidence mismatch`);

// Deliberately limited to the keywords used in the checked-in scene schema.
// An unsupported keyword fails the build; this is not a general JSON Schema API.
const keywords = new Set(["$schema", "title", "$defs", "$ref", "type", "properties", "additionalProperties", "required", "items", "const", "enum", "pattern", "minLength", "minimum", "maximum", "exclusiveMinimum", "minItems", "maxItems", "uniqueItems", "oneOf"]);
function assertSupportedSchema(schema) {
  for (const key of Object.keys(schema)) requireValue(keywords.has(key), `unsupported schema keyword: ${key}`);
  for (const children of [schema.properties, schema.$defs]) {
    for (const child of Object.values(children ?? {})) assertSupportedSchema(child);
  }
  for (const child of schema.oneOf ?? []) assertSupportedSchema(child);
  if (schema.items) assertSupportedSchema(schema.items);
}

export function validateStructure(value, schema, document = schema, label = "manifest") {
  for (const key of Object.keys(schema)) requireValue(keywords.has(key), `unsupported schema keyword: ${key}`);
  if (schema.$ref) {
    requireValue(schema.$ref.startsWith("#/$defs/"), "only local schema definitions are allowed");
    const target = document.$defs[schema.$ref.slice(8)];
    requireValue(target, `unknown schema reference ${schema.$ref}`);
    validateStructure(value, target, document, label);
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(candidate => {
      try { validateStructure(value, candidate, document, label); return true; } catch { return false; }
    });
    requireValue(matches.length === 1, `${label}: oneOf must match exactly once`);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    requireValue(types.some(type => type === "null" ? value === null : type === "array" ? Array.isArray(value) : type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value) : type === "integer" ? Number.isInteger(value) : typeof value === type), `${label}: invalid type`);
  }
  if ("const" in schema) equal(value, schema.const, label);
  if (schema.enum) requireValue(schema.enum.includes(value), `${label}: invalid enum`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined) requireValue(value.length >= schema.minLength, `${label}: too short`);
    if (schema.pattern) requireValue(new RegExp(schema.pattern).test(value), `${label}: invalid pattern`);
  }
  if (typeof value === "number") {
    requireValue(Number.isFinite(value), `${label}: non-finite number`);
    if (schema.minimum !== undefined) requireValue(value >= schema.minimum, `${label}: below minimum`);
    if (schema.maximum !== undefined) requireValue(value <= schema.maximum, `${label}: above maximum`);
    if (schema.exclusiveMinimum !== undefined) requireValue(value > schema.exclusiveMinimum, `${label}: below exclusive minimum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) requireValue(value.length >= schema.minItems, `${label}: missing items`);
    if (schema.maxItems !== undefined) requireValue(value.length <= schema.maxItems, `${label}: excess items`);
    if (schema.uniqueItems) requireValue(new Set(value.map(item => JSON.stringify(item))).size === value.length, `${label}: duplicate items`);
    if (schema.items) value.forEach((item, index) => validateStructure(item, schema.items, document, `${label}[${index}]`));
  } else if (value !== null && typeof value === "object") {
    for (const key of schema.required ?? []) requireValue(Object.hasOwn(value, key), `${label}: missing ${key}`);
    for (const key of Object.keys(value)) {
      if (schema.additionalProperties === false) requireValue(Object.hasOwn(schema.properties, key), `${label}: unknown ${key}`);
      if (schema.properties?.[key]) validateStructure(value[key], schema.properties[key], document, `${label}.${key}`);
    }
  }
}

export function loadInputs() {
  return {
    schema: read("docs/scene-asset-manifest-v2.schema.json"),
    companion: read("docs/evidence/companion-r2-v1.json"),
    forensics: read("docs/evidence/scene-glb-forensics.json"),
    poster: read("docs/evidence/scene-poster-source.json"),
    moduleBytes: fs.readFileSync(path.join(root, "web/src/components/scene/environment.ts")),
  };
}

function uniqueById(items, label) {
  const result = new Map(items.map(item => [item.id, item]));
  requireValue(result.size === items.length, `${label}: duplicate id`);
  return result;
}
function verifyMeasurement(item) {
  const { status, environment, ...numbers } = item.measurement;
  requireValue(status === "unmeasured" ? environment === null && Object.values(numbers).every(value => value === null) : Boolean(environment?.trim()) && Object.values(numbers).every(value => typeof value === "number"), `${item.id}: inconsistent measurement`);
  if (item.status === "approved") requireValue(status === "measured", `${item.id}: approved entry requires measurements`);
}

export function verifySceneManifest(manifest, inputs = loadInputs()) {
  assertSupportedSchema(inputs.schema);
  validateStructure(manifest, inputs.schema);
  verifyCompanionEvidence(inputs.companion);
  const assets = uniqueById(manifest.assets, "assets");
  const recipes = uniqueById(manifest.recipes, "recipes");
  requireValue(assets.size === 3 && ["character", "poster", "environment"].every(kind => manifest.assets.filter(asset => asset.kind === kind).length === 1), "exactly one registered character, poster and environment required");
  for (const asset of assets.values()) {
    verifyMeasurement(asset);
    requireValue(asset.decoderIds.length === 0 && asset.extensionsRequired.length === 0, `${asset.id}: decoder/extension support not registered`);
    if (asset.kind === "character") {
      const source = inputs.companion.objects.find(item => item.asset_id === asset.provenance.sourceAssetId);
      requireValue(source?.species === "bear" && source.variant === "lite", `${asset.id}: unregistered character`);
      equal(asset.delivery, { url: `${inputs.companion.runtime_delivery.custom_domain}/${source.r2_object_key}`, objectKey: source.r2_object_key, sha256: source.sha256, byteLength: source.bytes, mime: source.mime }, asset.id);
      equal(asset.provenance, { sourceAssetId: source.asset_id, sourceHash: source.sha256, owner: source.owner, rightsBasis: source.rights_basis, reviewReference: inputs.companion.rights_decision_reference }, `${asset.id} provenance`);
      const evidence = inputs.forensics.assets.find(item => item.asset_id === source.asset_id);
      requireValue(evidence?.sha256 === source.sha256 && evidence.bytes === source.bytes && evidence.external_dependencies.length === 0 && evidence.extensions_required.length === 0, `${asset.id}: invalid forensics`);
      equal(asset.clips, evidence.animation_clips.map(clip => ({ name: clip.name, durationSeconds: clip.duration_seconds, rootMotion: "unknown" })), `${asset.id} clips`);
    } else if (asset.kind === "poster") {
      const evidence = inputs.poster;
      equal(asset.delivery, Object.fromEntries(["url", "objectKey", "sha256", "byteLength", "mime"].map(key => [key, evidence[key]])), asset.id);
      equal(asset.provenance, { sourceAssetId: evidence.sourceAssetId, sourceHash: evidence.sha256, owner: evidence.owner, rightsBasis: evidence.rightsBasis, reviewReference: evidence.reviewReference }, `${asset.id} provenance`);
      requireValue(asset.clips.length === 0, `${asset.id}: image cannot contain clips`);
    } else {
      requireValue(asset.kind === "environment" && asset.status === "review" && asset.clips.length === 0, `${asset.id}: unregistered asset kind or approval`);
      const sha256 = createHash("sha256").update(inputs.moduleBytes).digest("hex");
      const modulePath = "web/src/components/scene/environment.ts";
      equal(asset.sourceModule, { path: modulePath, sha256, byteLength: inputs.moduleBytes.length }, `${asset.id} module`);
      equal(asset.provenance, { sourceAssetId: modulePath, sourceHash: sha256, owner: "AI-HealthCare-05/AH_05_07", rightsBasis: "Repository-authored procedural review geometry", reviewReference: "https://github.com/AI-HealthCare-05/AH_05_07/issues/390" }, `${asset.id} provenance`);
    }
  }
  const selections = new Set();
  const budgets = [];
  for (const recipe of recipes.values()) {
    verifyMeasurement(recipe);
    // This implementation registers S02 only. S10 and S05 require their own recipes and acceptance.
    equal(recipe.screens, ["S02"], `${recipe.id} screen boundary`);
    const selected = recipe.assetIds.map(id => { requireValue(assets.has(id), `${recipe.id}: missing asset ${id}`); return assets.get(id); });
    requireValue(selected.every(asset => asset.status !== "reference-only" && (recipe.status !== "approved" || asset.status === "approved")), `${recipe.id}: ineligible asset status`);
    if (recipe.mode === "realtime") {
      requireValue(recipe.landmarkId !== null && recipe.maxTier === 2 && recipe.motionPolicy === "neutral-static", `${recipe.id}: unsupported realtime policy`);
      requireValue(selected.length === 2 && selected.filter(a => a.kind === "character").length === 1 && selected.filter(a => a.kind === "environment").length === 1, `${recipe.id}: realtime assets must be one character and one environment`);
      requireValue(!selections.has(recipe.landmarkId), `${recipe.id}: ambiguous landmark selection`);
      selections.add(recipe.landmarkId);
    } else {
      requireValue(recipe.mode === "static" && recipe.maxTier === 1 && recipe.motionPolicy === "none" && recipe.landmarkId === null, `${recipe.id}: unsupported fallback policy`);
      requireValue(selected.length === 1 && selected[0].kind === "poster", `${recipe.id}: static recipe requires one poster`);
    }
    for (const composition of Object.values(recipe.compositions)) {
      requireValue(composition.subjectMinHeight <= composition.subjectMaxHeight && composition.subjectMaxHeight <= composition.stageHeight, `${recipe.id}: invalid focal-size bounds`);
      requireValue(recipe.mode === "realtime" ? composition.projection === "orthographic" && composition.camera !== null : composition.projection === "poster" && composition.camera === null, `${recipe.id}: incompatible camera`);
      if (composition.camera) requireValue(composition.camera.position.some((n, i) => n !== composition.camera.target[i]), `${recipe.id}: degenerate camera`);
    }
    const visited = new Set();
    const reachableAssets = new Set();
    let current = recipe;
    while (current) {
      requireValue(!visited.has(current.id), `${recipe.id}: fallback cycle`);
      visited.add(current.id);
      current.assetIds.forEach(id => reachableAssets.add(id));
      const fallbackId = current.fallback.tier1RecipeId;
      if (fallbackId === null) break;
      const fallback = recipes.get(fallbackId);
      requireValue(fallback && fallback.maxTier < current.maxTier && fallback.mode === "static" && current.screens.every(s => fallback.screens.includes(s)), `${recipe.id}: invalid fallback reference`);
      if (recipe.status === "approved") requireValue(fallback.status === "approved", `${recipe.id}: fallback is not approved`);
      current = fallback;
    }
    if (recipe.mode === "realtime") requireValue(visited.size === 2, `${recipe.id}: poster fallback required`);
    // Conservative planning check. 250KB reserves renderer/loader code; it is NOT measured transfer.
    const plannedBytes = (recipe.mode === "realtime" ? 250000 : 0) + [...reachableAssets].reduce((sum, id) => { const a = assets.get(id); requireValue(a, `${recipe.id}: missing fallback asset`); return sum + (a.delivery ?? a.sourceModule).byteLength; }, 0);
    requireValue(plannedBytes <= 900000, `${recipe.id}: planned activation exceeds 900000 bytes`);
    if (recipe.measurement.status === "measured") requireValue(recipe.measurement.encodedBytes <= 900000, `${recipe.id}: measured activation exceeds budget`);
    budgets.push({ recipeId: recipe.id, plannedBytes });
  }
  requireValue(selections.size === 7 && recipes.size === 8, "all seven weekday landmarks require a unique recipe");
  return budgets;
}

export function generateSceneSource(manifest, inputs = loadInputs()) {
  verifySceneManifest(manifest, inputs);
  return `// Generated by scripts/verify-scene-manifest.mjs --write; do not edit.\nexport const sceneManifest = ${JSON.stringify(manifest, null, 2)} as const;\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = read("web/src/ui/scene-manifest.v2.json");
  const expected = generateSceneSource(manifest);
  const output = path.join(root, "web/src/ui/sceneManifest.generated.ts");
  if (process.argv.includes("--write")) fs.writeFileSync(output, expected);
  else requireValue(fs.readFileSync(output, "utf8") === expected, "sceneManifest.generated.ts is stale");
  console.log(JSON.stringify({ assets: manifest.assets.length, recipes: manifest.recipes.length, status: "review-only", budgets: verifySceneManifest(manifest) }));
}
