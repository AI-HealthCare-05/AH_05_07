import fs from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadInputs, verifySceneManifest, generateSceneSource } from "./verify-scene-manifest.mjs";

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
  ["S10 has no registered runtime", m => { m.recipes[1].screens = ["S10"]; }, /screen boundary/],
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
  assert.equal(budgets.length, 14);
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
  assert.throws(() => verifySceneManifest(manifest, { ...inputs, posters }), /local review URL/);
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
