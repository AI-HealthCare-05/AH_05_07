// Actual canonical Python diagnostics stay in pipes, never in traces/results files.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { build, preview } from "vite";
import { chromium, firefox, webkit } from "playwright";
import { guardedSources } from "./verify-model-v2-assets.mjs";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const artifact = process.argv[2];
if (!artifact) throw new Error("Pass the actual frozen model-v2-r1-a.joblib path");
const output = mkdtempSync(resolve(tmpdir(), "sk7-s11-parity-"));
const python = process.env.SK7_PYTHON || resolve(repo, ".venv/bin/python");
function run(args, input) {
  const result = spawnSync(python, args, { cwd: repo, input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error("Canonical subprocess failed; raw output suppressed");
  return result.stdout;
}
run(["scripts/model/export_model_v2_browser.py", "--artifact", artifact, "--output", output]);
assert.ok(readFileSync(resolve(output, "model.json")).equals(readFileSync(resolve(repo, "web/public/models/model-v2.json"))), "production asset differs from canonical export");
const cases = JSON.parse(run(["tests/model/browser_fixtures.py"]));
const oracle = JSON.parse(run(["tests/model/browser_oracle.py", "--artifact", artifact], JSON.stringify(cases)));
const config = {
  configFile: false, root: resolve(repo, "web/tests/model-v2"), publicDir: resolve(repo, "web/public"),
  build: { target: "es2022", outDir: resolve(output, "build"), emptyOutDir: true }, logLevel: "error",
};
await build(config);
const server = await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } });
const url = `http://127.0.0.1:${server.httpServer.address().port}`;
const summary = { cases: cases.length, success: oracle.filter(r => r.ok).length,
  inputInvalid: oracle.filter(r => r.error === "input_invalid").length,
  arithmeticFailure: oracle.filter(r => r.error === "inference_unavailable").length, browsers: [] };
function checkParity(results, label) {
  assert.equal(results.length, oracle.length, `${label}: fixture count mismatch`);
  let maxScoreError = 0;
  let maxPreprocessError = 0;
  for (let i = 0; i < results.length; i += 1) {
    const actual = results[i], expected = oracle[i];
    assert.ok(actual.ok === expected.ok, `${label}: outcome mismatch case ${i} (${cases[i].name})`);
    if (!expected.ok) { assert.ok(actual.error === expected.error, `${label}: error class mismatch case ${i}`); continue; }
    assert.ok(JSON.stringify(actual.projection) === JSON.stringify(expected.projection), `${label}: public projection mismatch case ${i}`);
    for (const key of Object.keys(expected.semantic)) {
      const a = actual.semantic[key], b = expected.semantic[key];
      assert.ok(typeof b === "number" ? Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)) : a === b,
        `${label}: semantic mismatch case ${i}, field ${key}`);
    }
    assert.ok(actual.preprocessed.length === expected.preprocessed.length, `${label}: width mismatch case ${i}`);
    for (let j = 0; j < expected.preprocessed.length; j += 1) {
      const error = Math.abs(actual.preprocessed[j] - expected.preprocessed[j]);
      assert.ok(error <= 1e-12 * Math.max(1, Math.abs(expected.preprocessed[j])), `${label}: preprocessing mismatch case ${i}, column ${j}`);
      maxPreprocessError = Math.max(maxPreprocessError, error);
    }
    const error = Math.abs(actual.score - expected.score);
    assert.ok(error <= 1e-12, `${label}: numeric mismatch case ${i}`);
    maxScoreError = Math.max(maxScoreError, error);
  }
  return { maxScoreError, maxPreprocessError };
}
function distribution(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { n: sorted.length, medianMs: sorted[Math.ceil(sorted.length * .5) - 1], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], minMs: sorted[0], maxMs: sorted.at(-1) };
}

try {
  for (const [name, engine] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]]) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(url);
      await page.waitForFunction(() => Boolean(window.verification));
      const results = await page.evaluate(c => window.verification.run(c), cases);
      const parity = checkParity(results, name);
      const mutants = await page.evaluate(c => window.verification.mutated(c), cases);
      assert.throws(() => checkParity(mutants, "coefficient mutant"), /numeric mismatch/);
      assert.throws(() => checkParity(results.map(r => r.ok ? { ...r, score: .5 } : r), "constant mutant"), /numeric mismatch/);
      assert.throws(() => checkParity(results.slice(1), "truncated mutant"), /fixture count mismatch/);
      const preprocessedMutant = structuredClone(results);
      preprocessedMutant.find(r => r.ok).preprocessed[0] += 1;
      assert.throws(() => checkParity(preprocessedMutant, "preprocessing mutant"), /preprocessing mismatch/);
      const product = cases.find((c, i) => c.kind === "product" && oracle[i].ok).input;
      assert.equal(await page.evaluate(p => window.verification.publicExecutionGuard(p), product), "inference_unavailable");
      // Exercise the unchanged S11 draft -> exact 19-field DTO, including review edits.
      for (const update of [{}, { weight_kg: 69 }, { cigarette_smoking_state: "former_currently_not_smoking" },
        { walking_active_day_minutes: 45 }, { weekend_wake_minute: 15 }, { age_years: 35.5, height_cm: .5, weight_kg: .5 }]) {
        const input = { ...product, ...update };
        const clock = (prefix, phase) => `${String(input[`${prefix}_${phase}_hour`]).padStart(2, "0")}:${String(input[`${prefix}_${phase}_minute`]).padStart(2, "0")}`;
        const draft = Object.fromEntries(Object.entries({ age: input.age_years, sex: input.sex_knhanes,
          height: input.height_cm, weight: input.weight_kg, smoking: input.cigarette_smoking_state,
          alcoholFrequency: input.alcohol_frequency, alcoholAmount: input.alcohol_amount_category,
          walkingDays: input.walking_days_7d, walkingHours: input.walking_active_day_hours,
          walkingMinutes: input.walking_active_day_minutes, strengthDays: input.strength_days_7d,
          weekdayBed: clock("weekday", "bed"), weekdayWake: clock("weekday", "wake"),
          weekendBed: clock("weekend", "bed"), weekendWake: clock("weekend", "wake"),
        }).map(([key, value]) => [key, String(value)]));
        assert.ok(JSON.stringify(await page.evaluate(d => window.verification.draftPayload(d), draft)) === JSON.stringify(input), "S11 transient DTO drift");
      }
      const warm = await page.evaluate(p => window.verification.benchmark(p), product);
      summary.browsers.push({ name, version: browser.version(), ...parity,
        mutationsRejected: 4, publicExecutionGuard: true,
        coldLoadMs: await page.evaluate(() => window.verification.coldLoadMs), warm: distribution(warm) });
    } finally { await browser.close(); }
  }
  if (process.argv.includes("--seal")) {
    const seal = { description: "Canonical parity passed for these exact sources; rerun with actual artifact after changes.",
      sha256: Object.fromEntries(guardedSources.map(path => [path, createHash("sha256").update(readFileSync(resolve(repo, path))).digest("hex")])) };
    writeFileSync(resolve(repo, "web/tests/model-v2/parity-seal.json"), JSON.stringify(seal, null, 2) + "\n");
  }
  console.log(JSON.stringify(summary, null, 2));
} finally { await new Promise(done => server.httpServer.close(done)); }
