import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

// Explicitly local, review-only device probe. See docs/scene-device-probe.md.
// No browser-wide cache clearing, tracing, other-tab inspection, or OS changes.
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = process.argv[2];
if (!output) throw new Error("Usage: node web/scripts/measure-scene-android.mjs <local-output.json>");
const base = "http://127.0.0.1:4173";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const property = name => execFileSync("adb", ["shell", "getprop", name], { encoding: "utf8" }).trim();
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const buildFiles = ["index.html", ...(await readdir(path.join(root, "web/dist/assets"))).sort().map(name => `assets/${name}`)];
const build = Object.fromEntries(await Promise.all(buildFiles.map(async name => [name, hash(await readFile(path.join(root, "web/dist", name)))])));
const device = { model: property("ro.product.model"), os: property("ro.build.version.release") };
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = await browser.contexts()[0].newPage();
page.setDefaultTimeout(20_000);
const cdp = await page.context().newCDPSession(page);
const report = {
  recordedAt: new Date().toISOString(), sourceRevision: git("rev-parse", "HEAD"),
  probeSha256: hash(await readFile(fileURLToPath(import.meta.url))), build,
  device: { ...device, browser: browser.version() },
  method: {
    application: "Production Vite review preview over adb reverse; new dedicated Chrome tab",
    api: "In-page synthetic fetch responses only; no API server or account writes",
    instrumentation: "Existing RAF callbacks, long-task observer, WebGL context-loss events and target-scoped CDP metrics; no concurrent recording",
    cache: "Per-target cache disabled for first-activation control, then ordinary warm cache; global browser cache NOT cleared",
    memory: "Target JS heap after forced GC at each exit; not isolated process PSS, peak memory or GPU bytes",
    network: "Selected scene CDP encodedDataLength includes protocol overhead; actual compression is recorded per response; remote transport not qualified as Wi-Fi/cellular",
    motion: "Browser prefers-reduced-motion emulation only; no OS animation or accessibility setting changes",
  },
  activation: {}, motion: [], cycles: [], reducedMotion: {}, errors: [],
  unknownOrOpen: ["Wi-Fi/cellular whole-page delivery", "Absolute GPU and peak process memory", "Shader/decode and input-to-paint attribution", "OS reduced motion", "TalkBack audible output, Touch Explorer and switch input", "Physical Safari realtime 3D and performance", "Owner S05 acceptance and production activation/rollback"],
};
const network = new Map();
let phase = "setup";
const selected = url => /\/(?:assets\/(?:GLTFLoader|ThreeSceneRenderer|SavedSceneRenderer|disposeScene|companionAssets\.generated)-[^/]+\.js|companion\/.*\.glb|scene-review\/(?:s02|s10)\/.*\.webp)$/.test(url.pathname);
cdp.on("Network.responseReceived", ({ requestId, response }) => {
  const url = new URL(response.url);
  if (![base, "https://sk7-companion.gkrry.com"].includes(url.origin) || !selected(url)) return;
  const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]));
  network.set(requestId, { phase, path: url.pathname, origin: url.origin === base ? "USB-local-preview" : url.origin,
    status: response.status, mimeType: response.mimeType, fromDiskCache: Boolean(response.fromDiskCache),
    fromServiceWorker: Boolean(response.fromServiceWorker), cacheControl: headers["cache-control"] ?? null,
    contentEncoding: headers["content-encoding"] ?? null, encodedDataLength: null });
});
cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
  const request = network.get(requestId);
  if (request) request.encodedDataLength = encodedDataLength;
});
page.on("pageerror", () => report.errors.push({ phase, type: "pageerror" }));

await page.addInitScript(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.origin !== "http://e2e.invalid") return originalFetch(input, init);
    const start_on = url.searchParams.get("start_on"), end_on = url.searchParams.get("end_on");
    const body = url.pathname.endsWith("/window")
      ? { start_on, end_on, blood_pressure_observations: [{ id: "synthetic-existing", observed_on: end_on, period: "morning", systolic: 118, diastolic: 76 }], challenge_events: [], challenge_checkins: [], active_challenge: null }
      : { id: "synthetic-device-save", ...JSON.parse(init?.body ?? "{}") };
    return new Response(JSON.stringify(body), { status: url.pathname.endsWith("/window") ? 200 : 201, headers: { "Content-Type": "application/json" } });
  };
  let rafCount = 0;
  let label = "initial";
  const frames = [], longTasks = [];
  let liveContexts = 0, rendererInfo = null;
  const seen = new WeakSet();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const context = getContext.apply(this, args);
    if (context && /^webgl/.test(args[0]) && !seen.has(context)) {
      seen.add(context);
      liveContexts++;
      const debug = context.getExtension("WEBGL_debug_renderer_info");
      if (debug) rendererInfo = context.getParameter(debug.UNMASKED_RENDERER_WEBGL);
      this.addEventListener("webglcontextlost", () => { liveContexts--; }, { once: true });
    }
    return context;
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => raf(time => {
    rafCount++;
    if (document.querySelector('[data-saved-scene-phase="celebrate"]')) frames.push({ label, time });
    callback(time);
  });
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) longTasks.push({ label, duration: entry.duration });
  }).observe({ type: "longtask", buffered: true });
  window.__sceneDeviceProbe = {
    mark: value => { label = value; },
    clearSamples: () => { frames.length = 0; longTasks.length = 0; },
    read: () => {
      return { rafCount, frames: [...frames], longTasks: [...longTasks], liveContexts,
        canvasCount: document.querySelectorAll("canvas").length,
        renderer: liveContexts ? rendererInfo : null,
        phase: document.querySelector("[data-saved-scene-phase]")?.getAttribute("data-saved-scene-phase") ?? null,
        celebrateCount: document.querySelector("[data-saved-scene-celebrate-count]")?.getAttribute("data-saved-scene-celebrate-count") ?? null,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        visibility: document.visibilityState,
      };
    },
  };
});

const mark = async value => { phase = value; await page.evaluate(value => window.__sceneDeviceProbe.mark(value), value); };
const snapshot = () => page.evaluate(() => window.__sceneDeviceProbe.read());
const summary = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, medianMs: sorted[Math.floor(sorted.length / 2)] ?? null,
    p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? null, maxMs: sorted.at(-1) ?? null,
    over33_4ms: values.filter(value => value > 33.4).length };
};
async function idleEvidence() {
  await page.waitForTimeout(250);
  const before = await snapshot();
  await page.waitForTimeout(500);
  const after = await snapshot();
  return { rafCallbacksOver500ms: after.rafCount - before.rafCount, liveContexts: after.liveContexts, canvasCount: after.canvasCount,
    horizontalOverflow: after.horizontalOverflow, visibility: after.visibility, renderer: after.renderer };
}
async function semanticExit() {
  await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.waitForTimeout(100);
  assert.equal((await snapshot()).liveContexts, 0);
  // Do not confuse probe-owned frame/long-task sample growth with retained app heap.
  await page.evaluate(() => window.__sceneDeviceProbe.clearSamples());
}
async function calendarReady() {
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready");
  assert.equal((await snapshot()).liveContexts, 1);
}
async function openForm() {
  await page.evaluate(() => { history.pushState(history.state, "", "?e2e=signed-in&screen=S04"); dispatchEvent(new PopStateEvent("popstate", { state: history.state })); });
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
}
async function save() {
  // CDP mouse hit-testing on Android can use stale visual-viewport coordinates
  // while the software keyboard closes. Use the button's keyboard activation.
  await page.getByRole("button", { name: "혈압 기록 저장", exact: true }).press("Enter");
  await expect(page.locator("[data-saved-scene-status]")).toHaveAttribute("data-saved-scene-status", "ready");
  await expect(page.locator("[data-saved-scene-phase]")).toHaveAttribute("data-saved-scene-phase", "idle");
}

async function goto(screen) {
  await page.goto(`${base}/?e2e=signed-in&screen=${screen}`);
  // A document-owned lock releases automatically when this test tab closes.
  await page.evaluate(async () => { window.__sceneDeviceWakeLock = await navigator.wakeLock.request("screen"); });
}

try {
  assert.match(await page.evaluate(() => navigator.userAgent), /Android/);
  await page.bringToFront();
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  for (const screen of ["S02", "S10", "S05"]) {
    phase = `${screen}-cache-disabled`;
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await goto(screen === "S05" ? "S04" : screen);
    await mark(phase);
    report.device.viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches }));
    if (screen === "S05") {
      await page.getByLabel(/수축기/).fill("120");
      await page.getByLabel(/이완기/).fill("80");
      await save();
    } else await calendarReady();
    const idle = await idleEvidence();
    assert.equal(idle.visibility, "visible"); assert.equal(idle.rafCallbacksOver500ms, 0);
    assert.equal(idle.horizontalOverflow, false);
    const current = await snapshot();
    report.activation[screen] = { idle, longTasksMs: current.longTasks.map(task => task.duration),
      frameIntervals: screen === "S05" ? summary(current.frames.slice(1).map((frame, index) => frame.time - current.frames[index].time)) : null };
    await semanticExit();
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
  }

  // Warm all three renderers before assessing retained heap over repeated visits.
  phase = "warm-baseline";
  await goto("S02");
  await calendarReady(); await semanticExit();
  await openForm(); await save(); await semanticExit();
  await page.evaluate(() => { history.pushState(history.state, "", "?e2e=signed-in&screen=S10"); dispatchEvent(new PopStateEvent("popstate", { state: history.state })); });
  await calendarReady(); await semanticExit();
  for (let cycle = 0; cycle <= 10; cycle++) {
    if (cycle) {
      await mark(`cycle-${cycle}`);
      for (const screen of ["S02", "S10"]) {
        await page.evaluate(screen => { history.pushState(history.state, "", `?e2e=signed-in&screen=${screen}`); dispatchEvent(new PopStateEvent("popstate", { state: history.state })); }, screen);
        await calendarReady(); await semanticExit();
      }
      await openForm(); await mark(`clip-${cycle}`); await save();
      const current = await snapshot();
      const times = current.frames.filter(frame => frame.label === `clip-${cycle}`).map(frame => frame.time);
      const idle = await idleEvidence();
      report.motion.push({ cycle, celebrateCount: current.celebrateCount, frameIntervals: summary(times.slice(1).map((time, index) => time - times[index])), idle });
      assert.equal(current.celebrateCount, "1"); assert.equal(idle.rafCallbacksOver500ms, 0);
      assert.equal(idle.liveContexts, 1); assert.equal(idle.horizontalOverflow, false);
      assert.ok(times.length > 1, "The clip must contain measured RAF callbacks");
      await semanticExit();
    }
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(metric => [metric.name, metric.value]));
    report.cycles.push({ cycle, liveContexts: (await snapshot()).liveContexts, jsHeapUsedBytes: metrics.JSHeapUsedSize, jsHeapTotalBytes: metrics.JSHeapTotalSize, nodes: metrics.Nodes });
    console.log(`Device cycle ${cycle}/10 complete`);
  }
  await mark("history-return");
  await page.goBack();
  await expect(page.locator("[data-saved-scene-status]")).toHaveAttribute("data-saved-scene-status", "ready");
  report.historyReturn = { ...(await idleEvidence()), celebrateCount: (await snapshot()).celebrateCount };
  assert.equal(report.historyReturn.celebrateCount, "0");

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const screen of ["S02", "S10"]) {
    await goto(screen);
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect(page.locator(".living-scene-fallback img")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    report.reducedMotion[screen] = await idleEvidence();
  }
  await openForm(); await save();
  report.reducedMotion.S05 = { ...(await idleEvidence()), celebrateCount: (await snapshot()).celebrateCount };
  assert.equal(report.reducedMotion.S05.celebrateCount, "0");
  await semanticExit();
  assert.deepEqual(report.errors, []);
  report.retainedHeapReview = {
    baselineBytes: report.cycles[0].jsHeapUsedBytes,
    finalBytes: report.cycles.at(-1).jsHeapUsedBytes,
    deltaBytes: report.cycles.at(-1).jsHeapUsedBytes - report.cycles[0].jsHeapUsedBytes,
    interpretation: "Observed aggregate includes browser, history, JIT and instrumentation. Context disposal is checked separately. Positive growth does not identify an application leak or satisfy the no-growth acceptance gate; retaining-path/GPU/peak-memory review remains open.",
  };
  report.completed = true;
} catch (error) {
  report.completed = false;
  report.failure = { phase, type: error.name, message: error.message.split("\n")[0] };
  report.failure.state = await page.evaluate(() => ({ screen: document.querySelector("[data-scene]")?.getAttribute("data-scene"),
    stageCount: document.querySelectorAll(".living-visual-stage").length, heading: document.querySelector("h1")?.textContent,
    buttons: [...document.querySelectorAll("[data-scene] button")].map(button => ({ label: button.textContent, disabled: button.disabled })),
    visibility: document.visibilityState, url: location.origin + location.pathname + location.search }));
  console.error(error.message);
  process.exitCode = 1;
} finally {
  report.network = [...network.values()];
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false }).catch(() => {});
  await page.close();
  // For a connected browser, close() disconnects Playwright; it does not close the user's Chrome.
  await browser.close();
  console.log(`Sanitized device observations: ${output}; completed=${report.completed}`);
}
