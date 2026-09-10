import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { finished } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const [mode, buildDirectory, outputDirectory, count = "30"] = process.argv.slice(2);
assert.ok(["review", "off"].includes(mode) && buildDirectory && outputDirectory,
  "Usage: node web/scripts/profile-scene-memory.mjs <review|off> <build-directory> <private-output-directory> [cycles]");
const cycles = Number(count);
assert.ok(Number.isInteger(cycles) && cycles >= 10 && cycles <= 50);
const base = "http://127.0.0.1:4173";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const files = ["index.html", ...(await readdir(path.join(buildDirectory, "assets"))).sort().map(name => `assets/${name}`)];
const sources = ["web/package-lock.json", "web/scripts/scene-asset-inputs.mjs", ...(await readdir(path.join(root, "web/src"), { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile()).map(entry => path.relative(root, path.join(entry.parentPath, entry.name)))].sort();
const report = {
  sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  // HEAD alone does not identify an uncommitted candidate. Preserve exact source
  // and build identities; the operator must build from this source before running.
  sourceFiles: Object.fromEntries(await Promise.all(sources.map(async name => [name, hash(await readFile(path.join(root, name)))]))),
  probeSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  mode, companionMode: "off", recordedAt: new Date().toISOString(), hostOs: process.platform,
  device: { model: execFileSync("adb", ["shell", "getprop", "ro.product.model"], { encoding: "utf8" }).trim(),
    os: execFileSync("adb", ["shell", "getprop", "ro.build.version.release"], { encoding: "utf8" }).trim() },
  build: Object.fromEntries(await Promise.all(files.map(async name => [name, hash(await readFile(path.join(buildDirectory, name)))]))),
  method: "Physical Android Chrome, dedicated tab, synthetic in-page API; five warmup cycles; snapshots after forced GC at 0/10/final cycles. Heap snapshots are profiling runs, not frame-rate measurements. Raw snapshots must remain private/local.",
  samples: [], errors: [],
};
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = await browser.contexts()[0].newPage();
page.setDefaultTimeout(20_000);
const cdp = await page.context().newCDPSession(page);
let phase = "setup";
page.on("pageerror", () => report.errors.push({ phase, type: "pageerror" }));
await page.addInitScript(() => {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.origin !== "http://e2e.invalid") return original(input, init);
    assertSyntheticMethod(init?.method ?? (input instanceof Request ? input.method : "GET"));
    const start_on = url.searchParams.get("start_on"), end_on = url.searchParams.get("end_on");
    const body = url.pathname.endsWith("/window")
      ? { start_on, end_on, blood_pressure_observations: [{ id: "synthetic-existing", observed_on: end_on, period: "morning", systolic: 118, diastolic: 76 }], challenge_events: [], challenge_checkins: [], active_challenge: null }
      : { id: "synthetic-save", ...JSON.parse(init?.body ?? "{}") };
    return new Response(JSON.stringify(body), { status: url.pathname.endsWith("/window") ? 200 : 201, headers: { "Content-Type": "application/json" } });
  };
  function assertSyntheticMethod(method) {
    if (!["GET", "POST"].includes(method)) throw new Error("Unexpected synthetic API method");
  }
  let liveContexts = 0, contextCreations = 0;
  const seen = new WeakSet();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const context = getContext.apply(this, args);
    if (context && /^webgl/.test(args[0]) && !seen.has(context)) {
      seen.add(context); liveContexts++; contextCreations++;
      this.addEventListener("webglcontextlost", () => { liveContexts--; }, { once: true });
    }
    return context;
  };
  window.__sceneMemoryCounts = () => ({ liveContexts, contextCreations, domCanvases: document.querySelectorAll("canvas").length });
});

async function route(screen) {
  await page.evaluate(screen => {
    history.pushState(history.state, "", `?e2e=signed-in&screen=${screen}`);
    dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  }, screen);
  await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
}
async function exitScene() {
  await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__sceneMemoryCounts().liveContexts)).toBe(0);
  await expect(page.locator("canvas")).toHaveCount(0);
}
async function cycle() {
  for (const screen of ["S02", "S10"]) {
    await route(screen);
    if (mode === "review") {
      await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
      await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready");
    } else await expect(page.locator(".living-visual-stage")).toHaveCount(0);
    await exitScene();
  }
  await route("S04");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  await page.getByRole("button", { name: "혈압 기록 저장", exact: true }).press("Enter");
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  if (mode === "review") {
    await expect(page.locator("[data-saved-scene-status]")).toHaveAttribute("data-saved-scene-status", "ready");
    await expect(page.locator("[data-saved-scene-phase]")).toHaveAttribute("data-saved-scene-phase", "idle");
  } else {
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.waitForTimeout(4500);
  }
  await exitScene();
}
async function sample(iteration, takeSnapshot) {
  await page.waitForTimeout(250);
  await cdp.send("HeapProfiler.collectGarbage");
  const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(metric => [metric.name, metric.value]));
  const counters = await page.evaluate(() => window.__sceneMemoryCounts());
  assert.equal(counters.contextCreations, mode === "review" ? (iteration + 5) * 3 : 0);
  assert.equal(counters.liveContexts, 0);
  assert.equal(counters.domCanvases, 0);
  const sample = { iteration, ...counters, jsHeapUsedBytes: metrics.JSHeapUsedSize, nodes: metrics.Nodes,
    documents: metrics.Documents, eventListeners: metrics.JSEventListeners };
  if (takeSnapshot) {
    const name = `${mode}-${iteration}.heapsnapshot`;
    const stream = createWriteStream(path.join(outputDirectory, name), { mode: 0o600 });
    const onChunk = ({ chunk }) => stream.write(chunk);
    cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
    try { await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false }); }
    finally { cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk); stream.end(); await finished(stream); }
    sample.localSnapshot = name;
  }
  report.samples.push(sample);
  console.log(`${mode}: ${iteration} measured cycles; heap=${sample.jsHeapUsedBytes}, nodes=${sample.nodes}, contexts=${sample.liveContexts}`);
}

try {
  assert.match(await page.evaluate(() => navigator.userAgent), /Android/);
  await cdp.send("Performance.enable");
  await page.bringToFront();
  await page.goto(`${base}/?e2e=signed-in&screen=S08`);
  await page.evaluate(async () => { window.__sceneMemoryWakeLock = await navigator.wakeLock.request("screen"); });
  report.device = { ...report.device, ...await page.evaluate(() => ({ userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, screenWakeLock: !window.__sceneMemoryWakeLock.released })) };
  phase = "warmup";
  for (let i = 0; i < 5; i++) await cycle();
  await sample(0, true);
  for (let i = 1; i <= cycles; i++) {
    phase = `cycle-${i}`;
    await cycle();
    await sample(i, i === 10 || i === cycles);
  }
  assert.deepEqual(report.errors, []);
  report.completed = true;
} catch (error) {
  report.completed = false;
  report.failure = { phase, name: error.name, message: error.message.split("\n")[0] };
  report.failure.state = await page.evaluate(() => ({ visibility: document.visibilityState,
    screen: document.querySelector("[data-scene]")?.getAttribute("data-scene"),
    stageCount: document.querySelectorAll(".living-visual-stage").length }));
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await writeFile(path.join(outputDirectory, `${mode}-metrics.json`), JSON.stringify(report, null, 2) + "\n");
  await page.close();
  await browser.close();
}
