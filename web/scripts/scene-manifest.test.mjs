import fs from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadInputs, verifySceneManifest, generateSceneSource, selectPosterDelivery } from "./verify-scene-manifest.mjs";

const original = JSON.parse(fs.readFileSync(new URL("../src/ui/scene-manifest.v2.json", import.meta.url), "utf8"));
const inputs = loadInputs();
const cases = [
  ["schema version", m => { m.schemaVersion = 1; }, /schemaVersion/],
  ["unknown domain data", m => { m.systolic = 120; }, /unknown systolic/],
  ["duplicate asset identity", m => { m.assets.push(m.assets[0]); }, /duplicate id/],
  ["duplicate recipe identity", m => { m.recipes.push(m.recipes[0]); }, /duplicate id/],
  ["missing source", m => { delete m.assets[0].delivery; }, /oneOf/],
  ["ambiguous source", m => { m.assets[0].sourceModule = m.assets[2].sourceModule; }, /oneOf/],
  ["unregistered URL", m => { m.assets[0].delivery.url = "https://example.invalid/bear.glb"; }, /evidence mismatch/],
  ["source hash drift", m => { m.assets[0].provenance.sourceHash = "a".repeat(64); }, /provenance/],
  ["rights reference drift", m => { m.assets[0].provenance.rightsBasis = "unreviewed"; }, /provenance/],
  ["invented clip", m => { m.assets[0].clips[0].durationSeconds += 1; }, /clips/],
  ["unregistered decoder", m => { m.assets[0].decoderIds = ["missing-decoder"]; }, /decoder/],
  ["unregistered extension", m => { m.assets[0].extensionsRequired = ["KHR_draco_mesh_compression"]; }, /extension/],
  ["reference-only asset", m => { m.assets[0].status = "reference-only"; }, /ineligible/],
  ["unmeasured approval", m => { m.recipes[1].status = "approved"; }, /requires measurements/],
  ["unknown is not zero measurement", m => { m.recipes[1].measurement.encodedBytes = 0; }, /inconsistent measurement/],
  ["claimed measurement without environment", m => { m.recipes[1].measurement.status = "measured"; }, /inconsistent measurement/],
  ["missing asset reference", m => { m.recipes[1].assetIds[0] = "missing"; }, /missing asset/],
  ["missing fallback reference", m => { m.recipes[1].fallback.tier1RecipeId = "missing"; }, /fallback reference/],
  ["fallback cycle", m => { m.recipes[0].fallback.tier1RecipeId = m.recipes[1].id; }, /fallback reference|cycle/],
  ["fallback required", m => { m.recipes[1].fallback.tier1RecipeId = null; }, /poster fallback/],
  ["S05 remains isolated", m => { m.recipes[1].screens = ["S05"]; }, /screen boundary/],
  ["S11 has no registered runtime", m => { m.recipes[1].screens = ["S11"]; }, /screen boundary/],
  ["no celebration on S02", m => { m.recipes[1].motionPolicy = "s05-confirmed-save"; }, /realtime policy/],
  ["duplicate weekday selection", m => { m.recipes[2].landmarkId = m.recipes[1].landmarkId; }, /ambiguous landmark/],
  ["missing weekday", m => { m.recipes.pop(); }, /seven weekday|fallback reference/],
  ["inverted subject bounds", m => { m.recipes[1].compositions.mobile320.subjectMinHeight = 190; }, /focal-size/],
  ["subject clipping bounds", m => { m.recipes[1].compositions.mobile320.subjectMaxHeight = 201; }, /focal-size/],
  ["zero camera span", m => { m.recipes[1].compositions.desktop.camera.verticalSpan = 0; }, /oneOf/],
  ["degenerate camera", m => { const c = m.recipes[1].compositions.desktop.camera; c.target = c.position; }, /degenerate camera/],
];
for (const [name, mutate, message] of cases) test(`rejects ${name}`, () => {
  const manifest = structuredClone(original); mutate(manifest);
  // Validate the primary recipe before its captured fallback in these cases.
  manifest.recipes.sort((a, b) => Number(b.mode === "realtime") - Number(a.mode === "realtime"));
  assert.throws(() => verifySceneManifest(manifest, inputs), message);
});
test("registered manifest has seven budgeted weekdays and responsive fallbacks", () => {
  const budgets = verifySceneManifest(original, inputs);
  assert.equal(budgets.length, 28);
  assert.ok(budgets.every(item => item.plannedBytes > 0 && item.plannedBytes <= 900000));
  assert.equal(generateSceneSource(original, inputs), fs.readFileSync(new URL("../src/ui/sceneManifest.generated.ts", import.meta.url), "utf8"));
});
test("source module edits require a new pinned identity", () => {
  assert.throws(() => verifySceneManifest(original, { ...inputs, moduleBytes: Buffer.from("changed source") }), /module/);
});
test("budget includes the reachable fallback and renderer allowance", () => {
  const manifest = structuredClone(original);
  const posters = structuredClone(inputs.posters), posterBytes = new Map(inputs.posterBytes);
  const asset = manifest.assets[1], evidence = posters.posters.find(p => p.id === asset.id);
  // A valid RIFF metadata chunk increases transfer without changing dimensions.
  const chunk = Buffer.alloc(500008); chunk.write("JUNK"); chunk.writeUInt32LE(500000, 4);
  const bytes = Buffer.concat([posterBytes.get(asset.id), chunk]); bytes.writeUInt32LE(bytes.length - 8, 4);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const objectKey = asset.delivery.objectKey.replace(/[a-f0-9]{16}\.webp$/, `${sha256.slice(0, 16)}.webp`);
  asset.delivery = { ...asset.delivery, sha256, byteLength: bytes.length, objectKey, url: `/${objectKey}` };
  asset.provenance.sourceHash = sha256; evidence.delivery = asset.delivery; posterBytes.set(asset.id, bytes);
  assert.throws(() => verifySceneManifest(manifest, { ...inputs, posters, posterBytes }), /activation exceeds/);
});

test("one activation budgets the largest poster variant, not three downloads", () => {
  const budget = verifySceneManifest(original, inputs).find(b => b.recipeId === "s02-garden-gate");
  const fallback = original.recipes[0];
  const largest = Math.max(...fallback.assetIds.map(id => original.assets.find(a => a.id === id).delivery.byteLength));
  assert.equal(budget.plannedBytes, 250000 + original.assets[0].delivery.byteLength + original.assets[2].sourceModule.byteLength + largest);
});

for (const [name, mutate, message] of [
  ["wrong mobile profile", m => { m.recipes[0].compositions.mobile320.posterAssetId = m.recipes[0].compositions.desktop.posterAssetId; }, /poster profile/],
  ["wrong weekday fallback", m => { m.recipes[1].fallback.tier1RecipeId = m.recipes[2].fallback.tier1RecipeId; }, /fallback reference/],
  ["camera change without recapture", m => { m.recipes[1].compositions.desktop.camera.verticalSpan += 0.1; }, /capture composition/],
  ["fallback size drift", m => { m.recipes[0].compositions.mobile320.stageHeight += 1; }, /fallback composition/],
  ["unregistered profile asset", m => { m.recipes[0].compositions.mobile320.posterAssetId = "missing"; }, /poster profile/],
]) test(`rejects ${name}`, () => {
  const manifest = structuredClone(original); mutate(manifest);
  assert.throws(() => verifySceneManifest(manifest, inputs), message);
});

test("poster binaries are hashed, not trusted from metadata", () => {
  const posterBytes = new Map(inputs.posterBytes), id = original.assets[1].id;
  const bytes = Buffer.from(posterBytes.get(id)); bytes[bytes.length - 1] ^= 1; posterBytes.set(id, bytes);
  assert.throws(() => verifySceneManifest(original, { ...inputs, posterBytes }), /binary identity/);
});
test("poster dimensions are read from the WebP frame", () => {
  const posters = structuredClone(inputs.posters); posters.posters[0].width += 1;
  assert.throws(() => verifySceneManifest(original, { ...inputs, posters }), /dimensions/);
});
test("renderer changes require a fresh capture", () => {
  const sourceHashes = { ...inputs.sourceHashes, "web/src/components/scene/ThreeSceneRenderer.tsx": "a".repeat(64) };
  assert.throws(() => verifySceneManifest(original, { ...inputs, sourceHashes }), /render source hashes/);
});
test("matching metadata cannot authorize an arbitrary delivery URL", () => {
  const manifest = structuredClone(original), posters = structuredClone(inputs.posters);
  manifest.assets[1].delivery.url = posters.posters[0].delivery.url = "https://example.invalid/unreviewed.webp";
  assert.throws(() => verifySceneManifest(manifest, { ...inputs, posters }), /local capture URL/);
});
for (const [name, mutate, message] of [
  ["missing proof", i => { i.posterR2 = null; }, /R2 evidence/],
  ["wrong origin", i => { i.posterR2.publicOrigin = "https://example.invalid"; }, /R2 evidence/],
  ["wrong bucket", i => { i.posterR2.bucket = "other"; }, /R2 evidence/],
  ["unverified status", i => { i.posterR2.status = "pending"; }, /R2 evidence/],
  ["missing object", i => { i.posterR2.objects.shift(); }, /R2 binary/],
  ["duplicate object", i => { i.posterR2.objects.push(i.posterR2.objects[0]); }, /duplicate id/],
  ["HTTP error", i => { i.posterR2.objects[0].status = 403; }, /R2 binary/],
  ["different public bytes", i => { i.posterR2.objects[0].sha256 = "a".repeat(64); }, /R2 binary/],
  ["different byte count", i => { i.posterR2.objects[0].byteLength += 1; }, /R2 binary/],
  ["wrong MIME", i => { i.posterR2.objects[0].headers["content-type"] = "text/html"; }, /R2 delivery headers/],
  ["wrong CORS origin", i => { i.posterR2.objects[0].headers["access-control-allow-origin"] = "http://127.0.0.1:4175"; }, /R2 delivery headers/],
  ["unobserved cache policy", i => { i.posterR2.objects[0].headers["cache-control"] = "public, max-age=31536000, immutable"; }, /R2 delivery headers/],
]) test(`rejects R2 ${name}`, () => {
  const changed = { ...inputs, posterR2: structuredClone(inputs.posterR2) }; mutate(changed);
  assert.throws(() => verifySceneManifest(original, changed), message);
});
for (const suffix of ["?unregistered=1", "/../other.webp"]) test(`rejects a modified public URL: ${suffix}`, () => {
  const manifest = structuredClone(original), posterR2 = structuredClone(inputs.posterR2);
  manifest.assets[1].delivery.url += suffix;
  posterR2.objects[0].url = manifest.assets[1].delivery.url;
  assert.throws(() => verifySceneManifest(manifest, { ...inputs, posterR2 }), /registered poster URL/);
});
test("local authoring remains valid without R2 evidence", () => {
  const manifest = structuredClone(original);
  for (const asset of manifest.assets.filter(a => a.kind === "poster")) {
    asset.delivery = [...inputs.posters.posters, ...inputs.dioramaPosters.posters].find(p => p.id === asset.id).delivery;
  }
  assert.doesNotThrow(() => verifySceneManifest(manifest, { ...inputs, posterR2: null, dioramaR2: null }));
});
test("registration preserves verified delivery and keeps uncaptured public identities local", () => {
  for (const poster of inputs.posters.posters) {
    assert.deepEqual(selectPosterDelivery(poster, inputs.posterR2), original.assets.find(a => a.id === poster.id).delivery);
    assert.deepEqual(selectPosterDelivery(poster, null), poster.delivery);
  }
  const newPoster = structuredClone(inputs.posters.posters[0]); newPoster.delivery.sha256 = "a".repeat(64);
  assert.deepEqual(selectPosterDelivery(newPoster, inputs.posterR2), newPoster.delivery);
  const invalidProof = structuredClone(inputs.posterR2); invalidProof.objects[0].headers["content-type"] = "text/html";
  assert.throws(() => selectPosterDelivery(inputs.posters.posters[0], invalidProof), /R2 delivery headers/);
});
test("matching metadata cannot authorize a path outside the poster directory", () => {
  const manifest = structuredClone(original), posters = structuredClone(inputs.posters);
  manifest.assets[1].delivery.objectKey = posters.posters[0].delivery.objectKey = "../../private.webp";
  assert.throws(() => verifySceneManifest(manifest, { ...inputs, posters }), /object key/);
});

test("schema additions cannot silently bypass the supported keyword boundary", () => {
  const schema = structuredClone(inputs.schema);
  schema.$defs.asset.oneOf[0].anyOf = [];
  assert.throws(() => verifySceneManifest(original, { ...inputs, schema }), /unsupported schema keyword/);
});

test("object key order does not change source identity", () => {
  const manifest = structuredClone(original);
  manifest.assets[0].provenance = Object.fromEntries(Object.entries(manifest.assets[0].provenance).reverse());
  assert.doesNotThrow(() => verifySceneManifest(manifest, inputs));
});

const s10 = manifest => manifest.recipes.find(recipe => recipe.id === "s10-garden-gate");
for (const [name, mutate, message] of [
  ["S10 missing root environment", m => { delete s10(m).environmentAssetId; }, /environment reference/],
  ["S10 selecting S02 environment", m => { s10(m).environmentAssetId = "procedural-landmarks"; }, /environment reference/],
  ["S10 missing shared geometry dependency", m => { s10(m).assetIds = s10(m).assetIds.filter(id => id !== "procedural-landmarks"); }, /environment dependencies/],
  ["S10 borrowing S02 fallback", m => { s10(m).fallback.tier1RecipeId = "s02-garden-gate-poster"; }, /fallback reference/],
  ["S10 borrowing S02 poster composition", m => {
    const fallback = m.recipes.find(recipe => recipe.id === "s10-garden-gate-poster");
    fallback.assetIds = m.recipes[0].assetIds;
    fallback.compositions.mobile320.posterAssetId = m.recipes[0].compositions.mobile320.posterAssetId;
  }, /poster profile/],
]) test(`rejects ${name}`, () => {
  const manifest = structuredClone(original); mutate(manifest);
  assert.throws(() => verifySceneManifest(manifest, inputs), message);
});
test("S10 budgets both its composition module and shared landmark geometry", () => {
  const recipe = s10(original), fallback = original.recipes.find(r => r.id === recipe.fallback.tier1RecipeId);
  const byteLength = asset => (asset.delivery ?? asset.sourceModule).byteLength;
  const expected = 250000 + recipe.assetIds.reduce((sum, id) => sum + byteLength(original.assets.find(a => a.id === id)), 0)
    + Math.max(...fallback.assetIds.map(id => byteLength(original.assets.find(a => a.id === id))));
  assert.equal(verifySceneManifest(original, inputs).find(b => b.recipeId === recipe.id).plannedBytes, expected);
});
test("S10 source geometry cannot change without registration", () => {
  assert.throws(() => verifySceneManifest(original, { ...inputs, dioramaModuleBytes: Buffer.from("changed diorama") }), /module/);
});
for (const source of ["web/src/styles.css", "web/src/components/VisualStage.tsx", "web/src/ui/sceneRecipes.ts", "web/src/components/scene/disposeScene.ts"]) test(`poster capture pins ${source}`, () => {
  const sourceHashes = { ...inputs.sourceHashes, [source]: "a".repeat(64) };
  assert.throws(() => verifySceneManifest(original, { ...inputs, sourceHashes }), /render source hashes/);
});
