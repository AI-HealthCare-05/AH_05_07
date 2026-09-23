import { expect, test, type Page, type Request } from "@playwright/test";
import { findSceneRecipe, sceneComposition, sceneProfile } from "../src/ui/sceneRecipes";
import { sceneLandmarks } from "../src/ui/scenePolicy";
import { companionAssetManifest } from "../src/ui/companionAssets.generated";
import posterEvidence from "../../docs/evidence/scene-diorama-posters.json" with { type: "json" };

const fixtureUrl = "/?fixture=VP-10&screen=S10";
const stage = (page: Page) => page.locator('.living-visual-stage[data-living-scene="S10"]');
function expectRelativeSubjectHeight(subjectHeight: number, stageHeight: number, composition: ReturnType<typeof sceneComposition>) {
  // The Living Journey frame intentionally scales the registered composition.
  // Preserve its approved subject-to-stage proportions instead of old absolute pixels.
  expect(subjectHeight / stageHeight).toBeGreaterThanOrEqual(composition.subjectMinHeight / composition.stageHeight);
  expect(subjectHeight / stageHeight).toBeLessThanOrEqual(composition.subjectMaxHeight / composition.stageHeight);
}
async function mockCalendar(page: Page, state = { variant: 0, fail: false }) {
  const reads: string[] = [];
  await page.route("http://e2e.invalid/**", route => {
    const url = new URL(route.request().url());
    const headers = { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    reads.push(url.search);
    const start_on = url.searchParams.get("start_on"), end_on = url.searchParams.get("end_on");
    return route.fulfill({ status: state.fail ? 503 : 200, headers, contentType: "application/json", body: JSON.stringify({ start_on, end_on,
      blood_pressure_observations: state.variant ? [{ id: "synthetic-bp", observed_on: end_on, period: "morning", systolic: 160, diastolic: 90 }] : [],
      active_challenge: state.variant ? { id: "synthetic-challenge", action_id: "walk-10-minutes", starts_on: start_on, ends_on: end_on, first_checkin_on: end_on, status: "active" } : null,
      challenge_checkins: state.variant ? [{ id: "synthetic-checkin", challenge_id: "synthetic-challenge", action_id: "walk-10-minutes", observed_on: end_on, status: "skipped" }] : [],
      challenge_events: [{ id: "synthetic-legacy", observed_on: end_on, action_id: "walk-10-minutes", status: "completed" }],
    }) });
  });
  return reads;
}
async function expectReady(page: Page, landmark: string, width: number, expectedLandmarks = width > 580 ? 7 : 2) {
  await stage(page).scrollIntoViewIfNeeded();
  await expect(stage(page)).toHaveAttribute("data-scene-recipe", `s10-${landmark}`);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
  const renderer = page.locator(".living-three-scene");
  await expect(renderer).toHaveAttribute("data-environment-kind", "diorama");
  await expect.poll(async () => JSON.parse((await renderer.getAttribute("data-environment-landmarks"))!).length).toBe(expectedLandmarks);
  const landmarks = JSON.parse((await renderer.getAttribute("data-environment-landmarks"))!);
  expect(landmarks[0]).toBe(landmark);
  expect(new Set(landmarks).size).toBe(expectedLandmarks);
  const bounds = JSON.parse((await renderer.getAttribute("data-subject-bounds"))!);
  expect(bounds.left).toBeGreaterThanOrEqual(-1); expect(bounds.right).toBeLessThanOrEqual(1);
  expect(bounds.bottom).toBeGreaterThanOrEqual(-1); expect(bounds.top).toBeLessThanOrEqual(1);
  const composition = sceneComposition(findSceneRecipe("S10", landmark)!, width);
  const stageHeight = await stage(page).evaluate(element => element.clientHeight);
  expectRelativeSubjectHeight(bounds.height, stageHeight, composition);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  await expect(stage(page)).toHaveAttribute("data-scene-first-paint-state", "realtime-ready");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}
async function expectNeutralFallback(page: Page) {
  await expect(stage(page)).toHaveAttribute("data-scene-first-paint-state", "fallback-neutral");
  await expect(page.locator("[data-poster-asset]")).toHaveAttribute("data-poster-asset", "none");
  await expect(page.locator(".living-scene-fallback--neutral")).toHaveCount(1);
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
}

test("S10 non-bear first paint holds neutral fallback until the exact selected actor is ready", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("sk7-companion-species", "fox");
    const originalWait = WebGL2RenderingContext.prototype.clientWaitSync;
    let released = false;
    (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).signalSceneGpuFence = () => { released = true; };
    WebGL2RenderingContext.prototype.clientWaitSync = function (sync, flags, timeout) {
      const state = window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow;
      state.sceneGpuFencePolls = (state.sceneGpuFencePolls ?? 0) + 1;
      return released ? originalWait.call(this, sync, flags, timeout) : this.TIMEOUT_EXPIRED;
    };
  });
  await mockCalendar(page);

  let releaseGlb!: () => void;
  let markGlbStarted!: () => void;
  const glbGate = new Promise<void>(resolve => { releaseGlb = resolve; });
  const glbStarted = new Promise<void>(resolve => { markGlbStarted = resolve; });
  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });
  await page.route("**/*.glb*", async route => {
    markGlbStarted();
    await glbGate;
    await route.continue();
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  await stage(page).scrollIntoViewIfNeeded();
  await glbStarted;

  const runtime = page.locator("[data-living-scene-status]");
  const visualStage = stage(page);
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');

  // Held reveal boundary: neutral fallback, loading visit, no observed identity yet.
  await expect(visualStage).toHaveAttribute("data-scene-first-paint-state", "realtime-loading");
  await expect(runtime).toHaveAttribute("data-living-scene-status", "poster");
  await expect(page.locator(".living-scene-fallback--neutral")).toHaveCount(1);
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");

  releaseGlb();
  await expect.poll(() => page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).sceneGpuFencePolls ?? 0)).toBeGreaterThan(0);
  await expect(visualStage).toHaveAttribute("data-scene-first-paint-state", "realtime-loading");
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
  await expect(page.locator(".living-three-scene")).toHaveCSS("opacity", "0");
  await page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).signalSceneGpuFence?.());

  await expect(runtime).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
  await expect(visualStage).toHaveAttribute("data-scene-first-paint-state", "realtime-ready");
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
  await expect(page.locator(".living-scene-fallback")).toHaveCount(0);
  await expect.poll(() => glbRequests.length).toBe(1);
  expect(glbRequests[0]).toBe(companionAssetManifest.fox.lite.url);
  await expect(page.getByRole("button", { name: "동반자 움직이기", exact: true })).toHaveCount(0);
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", companionAssetManifest.fox.lite.assetId);
});

for (const [width, height] of [[320, 568], [320, 844], [390, 844], [1366, 768]]) test(`S10 renders and measures its scene at ${width}x${height}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height });
  const completed: Request[] = [], errors: string[] = [];
  page.on("requestfinished", request => completed.push(request));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(fixtureUrl);
  await expectReady(page, "footbridge", width);
  // F1: identity-bound S10 first paint does not request the historical bear-bearing poster.
  const requests = await Promise.all(completed.filter(request => /ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)|\/scene-review\/s10\//.test(request.url()))
    .map(async request => ({ url: request.url(), ...await request.sizes() })));
  expect(requests.filter(request => /\.glb(?:\?|$)/.test(request.url))).toHaveLength(1);
  expect(requests.some(request => /ThreeSceneRenderer/.test(request.url))).toBe(true);
  expect(requests.some(request => /GLTFLoader/.test(request.url))).toBe(true);
  expect(requests.filter(request => /\/scene-review\/s10\//.test(request.url))).toHaveLength(0);
  expect(requests.reduce((sum, request) => sum + request.responseBodySize, 0)).toBeLessThanOrEqual(900000);
  expect(errors).toEqual([]);
  await testInfo.attach("s10-scene-network", { body: JSON.stringify({ viewport: { width, height }, requests,
    environment: await page.locator(".living-three-scene").evaluate(element => ({ drawCalls: element.getAttribute("data-draw-calls"), triangles: element.getAttribute("data-triangles"), landmarks: JSON.parse(element.getAttribute("data-environment-landmarks")!) })) }, null, 2), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("s10.png"), fullPage: true });
});

for (const width of [320, 390, 1366]) test(`S10 seven weekday compositions stay framed at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width, height: 844 });
  await mockCalendar(page);
  for (const [index, landmark] of sceneLandmarks.entries()) {
    await page.clock.setFixedTime(new Date(`2026-09-${String(index + 7).padStart(2, "0")}T03:00:00Z`));
    await page.goto("/?e2e=signed-in&screen=S10");
    await expectReady(page, landmark.id, width);
    await stage(page).screenshot({ path: testInfo.outputPath(`${landmark.id}-${width}.png`) });
  }
});

for (const width of [320, 390, 1366]) test(`S10 reduced motion uses identity-neutral fallback at ${width}px`, async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockCalendar(page);
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  for (const [index, landmark] of sceneLandmarks.entries()) {
    requests.length = 0;
    await page.clock.setFixedTime(new Date(`2026-09-${String(index + 7).padStart(2, "0")}T03:00:00Z`));
    await page.goto("/?e2e=signed-in&screen=S10");
    await stage(page).scrollIntoViewIfNeeded();
    await expectNeutralFallback(page);
    expect(requests.filter(url => /\/scene-review\/s10\//.test(url))).toHaveLength(0);
    expect(requests.filter(url => /ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)/.test(url))).toEqual([]);
  }
});

test("S10 responsive environment rebuild keeps one character load and bounded framing", async ({ page }) => {
  const glbs: string[] = [];
  page.on("request", request => { if (/\.glb(?:\?|$)/.test(request.url())) glbs.push(request.url()); });
  await page.goto(fixtureUrl);
  // The compact recap stage now has an explicit <=580px presentation profile.
  // Keep checking the later 680/681 layout transition too, but the diorama
  // environment follows the established scene profile boundary at 580/581.
  for (const width of [320, 350, 351, 580, 581, 680, 681, 768, 1366, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectReady(page, "footbridge", width);
  }
  expect(glbs).toHaveLength(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 350, 351, 580, 581, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await stage(page).scrollIntoViewIfNeeded();
    await expectNeutralFallback(page);
  }
});

test("S10 facts and prior windows cannot change the calendar scenery", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = { variant: 0, fail: false };
  await mockCalendar(page, state);
  await page.clock.setFixedTime(new Date("2026-09-10T03:00:00Z"));
  await page.goto("/?e2e=signed-in&screen=S10");
  await expectReady(page, "footbridge", 390);
  await page.evaluate(() => Object.assign(window, { originalSceneCanvas: document.querySelector(".living-three-scene canvas") }));
  const landmarks = await page.locator(".living-three-scene").getAttribute("data-environment-landmarks");
  state.variant = 1;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.locator('[data-dashboard-lane="blood-pressure"] strong')).toHaveText("1");
  await expect(page.locator('[data-dashboard-lane="challenge"] strong')).toHaveText("1");
  expect(await page.evaluate(() => document.querySelector(".living-three-scene canvas") === (window as Window & { originalSceneCanvas?: Element }).originalSceneCanvas)).toBe(true);
  // Selecting another window intentionally replaces the scene with the existing loading UI.
  await page.getByRole("button", { name: "이전 7일 보기", exact: true }).click();
  await expect(page.locator("[data-dashboard-window]")).toHaveAttribute("data-dashboard-window", "prior");
  await expect(page.locator("[data-dashboard-window] strong")).toContainText("9월 3일");
  await expect(stage(page)).toHaveAttribute("data-scene-date", "2026-09-10");
  await expectReady(page, "footbridge", 390);
  expect(await page.locator(".living-three-scene").getAttribute("data-environment-landmarks")).toBe(landmarks);
});

test("S10 midnight advances current calendar scenery while the prior record range remains distinct", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-09-13T14:59:50Z") });
  await page.clock.pauseAt(new Date("2026-09-13T14:59:59Z"));
  await mockCalendar(page);
  await page.goto("/?e2e=signed-in&screen=S10");
  await page.getByRole("button", { name: "이전 7일 보기", exact: true }).click();
  await expect(stage(page)).toHaveAttribute("data-scene-date", "2026-09-13");
  await expect(stage(page)).toHaveAttribute("data-scene-recipe", "s10-sunset-overlook");
  await page.clock.runFor(1100);
  await expect(stage(page)).toHaveAttribute("data-scene-date", "2026-09-14");
  await expect(stage(page)).toHaveAttribute("data-scene-recipe", "s10-garden-gate");
  await expect(page.locator("[data-dashboard-window] strong")).toContainText("9월 7일");
  await expect(page.locator("[data-dashboard-window]")).toHaveAttribute("data-dashboard-window", "prior");
});

for (const screen of ["S02", "S10"]) for (const failure of ["chunk", "GLB"]) test(`${screen} ${failure} failure has one fallback and motion changes do not retry failed 3D`, async ({ page }) => {
  let failedRequests = 0, navigations = 0;
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; });
  await page.route(failure === "chunk" ? "**/assets/ThreeSceneRenderer-*.js" : "**/*.glb", route => { failedRequests++; return route.abort(); });
  await page.goto(`/?fixture=VP-10&screen=${screen}`);
  const visualStage = page.locator(".living-visual-stage");
  if (failure === "chunk") {
    // A failed Vite preload intentionally reloads once. The first activation may therefore
    // detach the stage while Playwright is scrolling it; that interruption is the recovery
    // contract, not a scene failure. Wait for that one reload, then activate the stable visit.
    try {
      await visualStage.scrollIntoViewIfNeeded();
    } catch (error) {
      const message = String(error);
      if (!/Element is not attached|Execution context was destroyed|navigation/i.test(message)) throw error;
    }
    await expect.poll(() => navigations).toBe(2);
    await page.waitForLoadState("domcontentloaded");
    await visualStage.scrollIntoViewIfNeeded();
  } else {
    await visualStage.scrollIntoViewIfNeeded();
  }
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-scene-fallback--neutral")).toHaveCount(1);
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
    await expect(page.locator(".living-scene-fallback--neutral")).toHaveCount(1);
  }
  expect(failedRequests).toBe(failure === "chunk" ? 2 : 1);
  expect(navigations).toBe(failure === "chunk" ? 2 : 1);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
});

test("S10 all media failures leave record refresh and navigation usable", async ({ page }) => {
  await mockCalendar(page);
  await page.route("**/*.glb", route => route.abort());
  await page.route(/\/scene-review\/(s02|s10)\/.*\.webp$/, route => route.abort());
  await page.goto("/?e2e=signed-in&screen=S10");
  await stage(page).scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.locator('[data-dashboard-lane="legacy"] strong')).toHaveText("1");
  await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
});

test("S10 public poster permits browser CORS with exact registered bytes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Start without an <img> request: its no-CORS memory-cache entry cannot prove CORS delivery.
  await page.goto("/?fixture=VP-10&screen=S08");
  const poster = posterEvidence.posters.find(entry => entry.landmarkId === "footbridge" && entry.profile === "desktop")!;
  const publicUrl = findSceneRecipe("S10", "footbridge")!.posters.desktop.url;
  expect(publicUrl).toBe(`https://sk7-companion.gkrry.com/${poster.delivery.objectKey}`);
  const response = await page.evaluate(async url => {
    const result = await fetch(url, { mode: "cors", redirect: "error" });
    const bytes = await result.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return { status: result.status, mime: result.headers.get("content-type"), cache: result.headers.get("cache-control"),
      byteLength: bytes.byteLength, sha256: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("") };
  }, publicUrl);
  expect(response).toEqual({ status: 200, mime: "image/webp", cache: "max-age=14400", byteLength: poster.delivery.byteLength, sha256: poster.delivery.sha256 });
});

test("S02 and S10 route exits release old WebGL contexts", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const contexts = new Set<WebGLRenderingContext | WebGL2RenderingContext>();
    Object.assign(window, { sceneContexts: contexts });
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      const context = original.apply(this, args);
      if (context && (args[0] === "webgl" || args[0] === "webgl2")) contexts.add(context as WebGLRenderingContext);
      return context;
    } as typeof original;
  });
  const liveContexts = () => page.evaluate(() => [...(window as Window & { sceneContexts: Set<WebGLRenderingContext> }).sceneContexts].filter(context => !context.isContextLost()).length);
  await page.goto(fixtureUrl);
  const navigation = page.getByRole("navigation", { name: "주요 화면" });
  for (const name of ["7일 돌아보기", "오늘의 기록", "7일 돌아보기", "오늘의 기록"]) {
    await navigation.getByRole("button", { name, exact: true }).click();
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
    await expect.poll(liveContexts).toBe(1);
    await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
  }
  await navigation.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect.poll(liveContexts).toBe(0);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
});
