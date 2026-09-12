import { expect, test, type Page, type Request } from "@playwright/test";
import { findSceneRecipe, sceneComposition, sceneProfile } from "../src/ui/sceneRecipes";
import { sceneLandmarks } from "../src/ui/scenePolicy";
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}
async function expectPoster(page: Page, landmark: string, width: number) {
  const profile = sceneProfile(width);
  const evidence = posterEvidence.posters.find(p => p.landmarkId === landmark && p.profile === profile)!;
  const recipe = findSceneRecipe("S10", landmark)!;
  await expect(page.locator("[data-poster-asset]")).toHaveAttribute("data-poster-asset", evidence.id);
  const image = page.locator(".living-scene-fallback img");
  await expect(image).toHaveAttribute("src", recipe.posters[profile].url);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 }).toBe(evidence.width);
  const box = (await image.boundingBox())!, area = (await stage(page).boundingBox())!;
  const bounds = evidence.subjectBounds;
  expect(box.x + (bounds.left + 1) / 2 * box.width).toBeGreaterThanOrEqual(area.x - 2);
  expect(box.x + (bounds.right + 1) / 2 * box.width).toBeLessThanOrEqual(area.x + area.width + 2);
  const height = (bounds.top - bounds.bottom) / 2 * box.height;
  const composition = sceneComposition(recipe, width);
  expectRelativeSubjectHeight(height, box.height, composition);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
}

for (const [width, height] of [[320, 568], [320, 844], [390, 844], [1366, 768]]) test(`S10 renders and measures its scene at ${width}x${height}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height });
  const completed: Request[] = [], errors: string[] = [];
  page.on("requestfinished", request => completed.push(request));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(fixtureUrl);
  await expectReady(page, "footbridge", width);
  await expect.poll(() => completed.filter(request => request.url().includes("/scene-review/s10/")).length, { timeout: 15000 }).toBe(1);
  const requests = await Promise.all(completed.filter(request => /ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)|\/scene-review\/s10\//.test(request.url()))
    .map(async request => ({ url: request.url(), ...await request.sizes() })));
  expect(requests.filter(request => /\.glb(?:\?|$)/.test(request.url))).toHaveLength(1);
  expect(requests.some(request => /ThreeSceneRenderer/.test(request.url))).toBe(true);
  expect(requests.some(request => /GLTFLoader/.test(request.url))).toBe(true);
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

for (const width of [320, 390, 1366]) test(`S10 reduced motion selects one weekday poster at ${width}px`, async ({ page }) => {
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
    await expectPoster(page, landmark.id, width);
    expect(requests.filter(url => /\/scene-review\/s10\//.test(url))).toHaveLength(1);
    expect(requests.filter(url => /ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)/.test(url))).toEqual([]);
  }
});

test("S10 responsive environment rebuild keeps one character load and bounded framing", async ({ page }) => {
  const glbs: string[] = [];
  page.on("request", request => { if (/\.glb(?:\?|$)/.test(request.url())) glbs.push(request.url()); });
  await page.goto(fixtureUrl);
  // The approved recap presentation keeps its compact frame through 680px;
  // crossing 681px changes the rendered stage and rebuilds the wide diorama.
  for (const width of [320, 350, 351, 580, 680, 681, 768, 1366, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectReady(page, "footbridge", width, width > 680 ? 7 : 2);
  }
  expect(glbs).toHaveLength(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 350, 351, 580, 581, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await stage(page).scrollIntoViewIfNeeded();
    await expectPoster(page, "footbridge", width);
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
  let failedRequests = 0;
  await page.route(failure === "chunk" ? "**/assets/ThreeSceneRenderer-*.js" : "**/*.glb", route => { failedRequests++; return route.abort(); });
  await page.goto(`/?fixture=VP-10&screen=${screen}`);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(1);
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
    await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  }
  expect(failedRequests).toBe(1);
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
