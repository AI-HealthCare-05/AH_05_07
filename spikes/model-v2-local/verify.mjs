// Numeric oracle values travel only through local process/automation pipes.
// No traces, snapshots, score arrays, input logs or result files are written.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { platform, release, arch } from "node:os";
import { build, preview } from "../../web/node_modules/vite/dist/node/index.js";
import { chromium, firefox, webkit } from "../../web/node_modules/playwright/index.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(root, "../..");
const artifact = process.argv[2];
if (!artifact) throw new Error("Usage: node spikes/model-v2-local/verify.mjs /absolute/frozen-artifact.joblib");
const output = mkdtempSync(resolve(tmpdir(), "sk7-local-inference-"));
process.env.SK7_SPIKE_OUTPUT = output;
const python = resolve(repo, ".venv/bin/python");
function run(command, args, input) {
  const result = spawnSync(command, args, { cwd: repo, input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command.split("/").at(-1)} failed (${result.status}); child output suppressed to avoid raw values`);
  return result.stdout;
}
run(process.execPath, [resolve(repo, "web/node_modules/typescript/bin/tsc"), "-p", resolve(root, "tsconfig.json")]);
const manifest = JSON.parse(run(python, [resolve(root, "export.py"), "--artifact", artifact, "--output", output]));
const second = mkdtempSync(resolve(tmpdir(), "sk7-local-export-"));
run(python, [resolve(root, "export.py"), "--artifact", artifact, "--output", second]);
assert.ok(readFileSync(resolve(output, "model.json")).equals(readFileSync(resolve(second, "model.json"))), "export bytes differ");
const cases = JSON.parse(run(python, [resolve(root, "fixtures.py")]));
const oracle = JSON.parse(run(python, [resolve(root, "oracle.py"), "--artifact", artifact], JSON.stringify(cases)));
assert.equal(cases.length, oracle.length);
await build({ configFile: resolve(root, "vite.config.mjs"), logLevel: "error" });
const allowedAssetPaths = new Set(readdirSync(resolve(output, "build/assets")).map((name) => `/assets/${name}`));
const server = await preview({ configFile: resolve(root, "vite.config.mjs"), preview: { host: "127.0.0.1", port: 0, strictPort: true }, logLevel: "error" });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const productIndex = cases.findIndex((testCase, i) => testCase.kind === "product" && oracle[i].ok);
assert.ok(productIndex >= 0);
const product = cases[productIndex].input;
const summary = { canonicalSha256: manifest.canonical_sha256, exportSha256: manifest.sha256,
  artifactBytes: manifest.bytes, artifactGzipBytes: gzipSync(readFileSync(resolve(output, "model.json")), { level: 9 }).length,
  deterministicExport: true, cases: cases.length, validCases: oracle.filter((item) => item.ok).length,
  invalidCases: oracle.filter((item) => !item.ok).length, browsers: [], failures: {}, output };
summary.inputInvalidCases = oracle.filter((item) => item.error === "input_invalid").length;
summary.arithmeticFailureCases = oracle.filter((item) => item.error === "inference_unavailable").length;
summary.measuredAt = new Date().toISOString();
summary.sourceCommit = run("git", ["rev-parse", "HEAD"]).trim();
summary.sourceDirty = Boolean(run("git", ["status", "--porcelain"]).trim());
summary.environment = { node: process.version, os: platform(), release: release(), arch: arch(),
  playwright: JSON.parse(readFileSync(resolve(repo, "web/node_modules/playwright/package.json"))).version };
summary.sourceHashes = Object.fromEntries(["adapter.ts", "runtime.ts", "main.ts", "verification.ts", "verify.mjs", "export.py", "oracle.py", "fixtures.py", "vite.config.mjs", "index.html", "verification.html", "tsconfig.json"]
  .map((name) => [name, createHash("sha256").update(readFileSync(resolve(root, name))).digest("hex")]));

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
function assertStartupRequests(requests, label) {
  assert.ok(requests.every((request) => {
    const url = new URL(request.url());
    const allowedPath = ["/", "/verification.html", "/model.json"].includes(url.pathname) || allowedAssetPaths.has(url.pathname);
    return request.method() === "GET" && request.postData() === null && url.origin === base && !url.search && allowedPath
      && !Object.keys(cases[productIndex].input).some((key) => JSON.stringify(request.headers()).includes(key));
  }), `${label}: unapproved startup request/feature-bearing header`);
}
async function observe(context) {
  const requests = [];
  context.on("request", (request) => requests.push(request));
  await context.addInitScript(() => {
    const probe = { storage: 0, databases: 0, caches: 0, cookies: 0, beacons: 0, sockets: 0, eventSources: 0, serviceWorkers: 0, artifactParses: 0 };
    Object.assign(window, { privacyProbe: probe });
    for (const method of ["setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) { probe.storage++; return original.apply(this, args); };
    }
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => { probe.databases++; return open(...args); };
    if (globalThis.caches) { const openCache = caches.open.bind(caches); caches.open = (...args) => { probe.caches++; return openCache(...args); }; }
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (descriptor?.set) Object.defineProperty(Document.prototype, "cookie", { ...descriptor, set(value) { probe.cookies++; descriptor.set.call(this, value); } });
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (...args) => { probe.beacons++; return beacon(...args); };
    for (const [name, key] of [["WebSocket", "sockets"], ["EventSource", "eventSources"]]) {
      const Native = window[name];
      window[name] = new Proxy(Native, { construct(target, args) { probe[key]++; return Reflect.construct(target, args); } });
    }
    if (navigator.serviceWorker) { const register = navigator.serviceWorker.register.bind(navigator.serviceWorker); navigator.serviceWorker.register = (...args) => { probe.serviceWorkers++; return register(...args); }; }
    const parse = JSON.parse;
    JSON.parse = function (value, ...args) { if (typeof value === "string" && value.includes('"sk7-model-v2-local-v1"')) probe.artifactParses++; return parse.call(this, value, ...args); };
  });
  return requests;
}
async function assertNoPersistence(page, label) {
  const state = await page.evaluate(async () => ({ probe: window.privacyProbe, local: localStorage.length, session: sessionStorage.length,
    cookie: document.cookie, databases: typeof indexedDB.databases === "function" ? (await indexedDB.databases()).length : null,
    cacheKeys: globalThis.caches ? (await caches.keys()).length : 0 }));
  const { artifactParses: _parses, ...writes } = state.probe;
  assert.ok(Object.values(writes).every((n) => n === 0), `${label}: storage/egress API used`);
  assert.ok(state.local === 0 && state.session === 0 && !state.cookie && state.cacheKeys === 0 && (state.databases === 0 || state.databases === null), `${label}: persisted state found`);
}

try {
  for (const [name, engine] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]]) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext();
      const requests = await observe(context);
      const page = await context.newPage();
      await page.goto(`${base}/verification.html`);
      await page.waitForFunction(() => Boolean(window.verification));
      const before = requests.length;
      const results = await page.evaluate((inputCases) => window.verification.run(inputCases), cases);
      const parity = checkParity(results, name);
      const mutated = await page.evaluate((inputCases) => window.verification.mutated(inputCases), cases);
      assert.throws(() => checkParity(mutated, "coefficient mutant"), /numeric mismatch/, "coefficient mutation was not detected");
      assert.throws(() => checkParity(results.map((item) => item.ok ? { ...item, score: .5 } : item), "constant mutant"), /numeric mismatch/, "constant score was not detected");
      assert.throws(() => checkParity(results.slice(1), "truncated mutant"), /fixture count mismatch/);
      assert.equal(await page.evaluate((input) => window.verification.publicExecutionGuard(input), product), "inference_unavailable", "public path skipped actual inference");
      await context.setOffline(true);
      const warm = await page.evaluate((input) => window.verification.benchmark(input), product);
      await page.waitForTimeout(200);
      assert.equal(requests.length, before, `${name}: inference caused network requests`);
      assertStartupRequests(requests, name);
      await assertNoPersistence(page, name);
      const cold = [await page.evaluate(() => window.verification.coldLoadMs)];
      await context.close();
      for (let i = 0; i < 4; i += 1) {
        const fresh = await browser.newContext(); const coldPage = await fresh.newPage();
        await coldPage.goto(`${base}/verification.html`); await coldPage.waitForFunction(() => Boolean(window.verification));
        cold.push(await coldPage.evaluate(() => window.verification.coldLoadMs)); await fresh.close();
      }
      summary.browsers.push({ name, version: browser.version(), ...parity, numericMutationDetected: true, constantAndTruncatedMutationsDetected: true, publicExecutionGuard: true, offlineWarmInference: true, inferenceRequests: 0, persistenceOperations: 0,
        coldLoad: distribution(cold), warmProductInference: distribution(warm), warmSampling: "30 batches of 1000 complete adapter+inference calls; per-call batch means" });
    } finally { await browser.close(); }
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(); const requests = await observe(context); const page = await context.newPage();
    await page.goto(base); await page.waitForFunction(() => !document.querySelector("button").disabled);
    const before = requests.length;
    await page.locator("textarea").fill(JSON.stringify(product)); await page.locator("button").click();
    const shown = JSON.parse(await page.locator("output").textContent());
    assert.ok(JSON.stringify(shown) === JSON.stringify(oracle[productIndex].projection), "demo projection mismatch");
    await page.locator("textarea").fill(JSON.stringify({ ...product, sex_knhanes: "1.0" })); await page.locator("button").click();
    assert.ok((await page.locator("output").textContent()).startsWith("입력을 확인"), "invalid input not rejected");
    await page.waitForTimeout(200); assert.equal(requests.length, before, "demo submitted inputs"); await assertNoPersistence(page, "demo");
    // Positive controls prove the observers detect a deliberate synthetic leak.
    await page.route("**/egress-canary", (route) => route.abort());
    await page.evaluate(async () => { localStorage.setItem("synthetic-canary", "test"); localStorage.removeItem("synthetic-canary"); try { await fetch("/egress-canary", { method: "POST", headers: { "X-Synthetic-Feature": "test" }, body: "synthetic-only" }); } catch { /* expected */ } });
    assert.ok(requests.length > before && requests.at(-1).method() === "POST" && requests.at(-1).postData() === "synthetic-only", "network positive control failed");
    assert.ok((await page.evaluate(() => window.privacyProbe.storage)) === 2, "storage positive control failed");
    summary.failures.demoAndObserverControls = "PASS";
    await context.close();

    const modelBytes = readFileSync(resolve(output, "model.json"), "utf8");
    const changed = JSON.parse(modelBytes); changed.linear.weights[0] += .125;
    for (const failure of ["hash_mismatch", "missing", "malformed", "oversized", "oversized_stream", "crypto_unavailable", "stalled_body"]) {
      const ctx = await browser.newContext(); const reqs = await observe(ctx);
      if (failure === "crypto_unavailable") await ctx.addInitScript(() => Object.defineProperty(crypto, "subtle", { value: undefined }));
      if (failure === "stalled_body") await ctx.addInitScript(() => {
        const original = window.fetch;
        window.fetch = async (...args) => {
          const response = await original(...args);
          if (args[0] !== "/model.json") return response;
          return new Response(new ReadableStream({ start(controller) {
            controller.enqueue(new Uint8Array([123]));
            args[1].signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
          } }), { headers: { "Content-Type": "application/json" } });
        };
      });
      if (failure === "oversized_stream") await ctx.addInitScript(() => {
        const original = window.fetch;
        window.fetch = async (...args) => {
          const response = await original(...args);
          if (args[0] !== "/model.json") return response;
          return new Response(new ReadableStream({ start(controller) {
            controller.enqueue(new Uint8Array(16_384)); controller.enqueue(new Uint8Array(16_384)); controller.enqueue(new Uint8Array(1));
          }, cancel() { Object.assign(window, { oversizedStreamCancelled: true }); } }));
        };
      });
      if (!["crypto_unavailable", "stalled_body", "oversized_stream"].includes(failure)) await ctx.route("**/model.json", (route) => route.fulfill({
        status: failure === "missing" ? 404 : 200, contentType: "application/json",
        body: failure === "hash_mismatch" ? JSON.stringify(changed) : failure === "oversized" ? "x".repeat(32769) : "{",
      }));
      const p = await ctx.newPage(); await p.goto(base);
      await p.waitForFunction(() => document.querySelector("output").textContent.startsWith("모델을 확인할 수 없어"), undefined, { timeout: 10_000 });
      assert.ok(await p.locator("button").isDisabled(), `${failure}: inference became available`);
      const count = reqs.length; await p.waitForTimeout(200); assert.equal(reqs.length, count, `${failure}: automatic fallback/retry`);
      assertStartupRequests(reqs, failure);
      assert.equal(reqs.filter((request) => new URL(request.url()).pathname === "/model.json").length, failure === "crypto_unavailable" ? 0 : 1, `${failure}: unexpected model fetch/retry`);
      if (failure === "oversized_stream") assert.equal(await p.evaluate(() => window.oversizedStreamCancelled), true, "oversized reader was not cancelled");
      assert.equal(await p.evaluate(() => window.privacyProbe.artifactParses), 0, `${failure}: parsed artifact before verification`);
      await assertNoPersistence(p, failure); summary.failures[failure] = "PASS"; await ctx.close();
    }
  } finally { await browser.close(); }

  const buildFiles = [];
  function visit(dir) { for (const name of readdirSync(dir)) { const path = resolve(dir, name); if (statSync(path).isDirectory()) visit(path); else buildFiles.push(path); } }
  visit(resolve(output, "build"));
  summary.spikeBuild = buildFiles.map((path) => ({ file: path.slice(resolve(output, "build").length + 1), bytes: statSync(path).size, gzipBytes: gzipSync(readFileSync(path), { level: 9 }).length }));
  summary.productionRuntimeDependencyDelta = 0;
  summary.memory = "NOT_MEASURED";
  writeFileSync(resolve(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await new Promise((done) => server.httpServer.close(done));
}
