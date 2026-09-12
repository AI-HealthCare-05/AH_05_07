import "./recap-candidate.cases";
import type { Request } from "@playwright/test";
import { findSceneRecipe, sceneComposition } from "../src/ui/sceneRecipes";
import { expect, test } from "@playwright/test";
import posterEvidence from "../../docs/evidence/scene-clay-posters.json" with { type: "json" };
import posterR2 from "../../docs/evidence/scene-clay-r2.json" with { type: "json" };
import type { Page } from "@playwright/test";

const url = "/?fixture=VP-10&screen=S02";
function expectRelativeSubjectHeight(subjectHeight: number, stageHeight: number, composition: ReturnType<typeof sceneComposition>) {
  // The Living Journey frame intentionally scales the registered composition.
  // Preserve its approved subject-to-stage proportions instead of old absolute pixels.
  expect(subjectHeight / stageHeight).toBeGreaterThanOrEqual(composition.subjectMinHeight / composition.stageHeight);
  expect(subjectHeight / stageHeight).toBeLessThanOrEqual(composition.subjectMaxHeight / composition.stageHeight);
}
async function completedSceneNetwork(completed: Request[]) {
  // WebGL readiness does not imply completion of the independent CDN poster.
  await expect.poll(() => completed.filter(request => /\/scene-review\/s02\//.test(request.url())).length, { timeout: 15000 }).toBe(1);
  return Promise.all(completed.filter(request => /ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)|\/scene-review\/s02\//.test(request.url()))
    .map(async request => ({ url: request.url(), ...await request.sizes() })));
}

for (const [width, height] of [[320, 568], [320, 844], [390, 844], [1366, 768]]) {
  test(`review renders at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const completed: Request[] = [];
    page.on("requestfinished", request => completed.push(request));
    const assets: string[] = [];
    page.on("request", request => { if (/\.glb(?:\?|$)/.test(request.url())) assets.push(request.url()); });
    await page.goto(url);
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
    await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
    // VP-10 uses the fixed synthetic 2026-09-03 (Thursday) presentation date.
    await expect(page.locator("[data-scene-recipe]")).toHaveAttribute("data-scene-recipe", "s02-footbridge");
    const bounds = JSON.parse((await page.locator("[data-subject-bounds]").getAttribute("data-subject-bounds"))!);
    expect(bounds.left).toBeGreaterThanOrEqual(-1);
    expect(bounds.right).toBeLessThanOrEqual(1);
    expect(bounds.bottom).toBeGreaterThanOrEqual(-1);
    expect(bounds.top).toBeLessThanOrEqual(1);
    const composition = sceneComposition(findSceneRecipe("S02", "footbridge")!, width);
    const stageHeight = await page.locator(".living-visual-stage").evaluate(element => element.clientHeight);
    expectRelativeSubjectHeight(bounds.height, stageHeight, composition);
    const network = await completedSceneNetwork(completed);
    expect(network.filter(request => /\.glb(?:\?|$)/.test(request.url))).toHaveLength(1);
    expect(network.some(request => /GLTFLoader/.test(request.url))).toBe(true);
    expect(network.some(request => /ThreeSceneRenderer/.test(request.url))).toBe(true);
    expect(network.filter(request => /\/scene-review\/s02\//.test(request.url))).toHaveLength(1);
    await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
    await testInfo.attach("scene-network", { body: JSON.stringify({ viewport: { width, height }, source: "Vite production preview, cold browser context; responseBodySize is encoded body, headers separate; not device acceptance", bounds, requests: network }, null, 2), contentType: "application/json" });
    expect(assets).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("scene.png"), fullPage: true });
  });
}

test("ready WebGL does not wait for a pending poster transfer", async ({ page }) => {
  const completed: Request[] = [];
  page.on("requestfinished", request => completed.push(request));
  let releasePoster!: () => void;
  const posterGate = new Promise<void>(resolve => { releasePoster = resolve; });
  let posterStarted = false;
  await page.route("**/scene-review/s02/v1/*.webp", async route => {
    posterStarted = true;
    await posterGate;
    await route.continue();
  });
  try {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect.poll(() => posterStarted).toBe(true);
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
    await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
    expect(completed.filter(request => /\/scene-review\/s02\//.test(request.url()))).toHaveLength(0);
    const observation = completedSceneNetwork(completed);
    releasePoster();
    const network = await observation;
    expect(network.filter(request => /\/scene-review\/s02\//.test(request.url))).toHaveLength(1);
    expect(network.filter(request => /\.glb(?:\?|$)/.test(request.url))).toHaveLength(1);
  } finally {
    releasePoster();
  }
});

test("GLB and poster failures preserve the task controls", async ({ page }) => {
  await page.route("**/*.glb", route => route.abort());
  await page.route(/\.(png|webp|avif)(\?|$)/, route => route.abort());
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
});

test("reduced motion never imports the renderer or requests GLB", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator(".living-scene-fallback")).toBeVisible();
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  expect(requests.filter(url => /ThreeSceneRenderer|disposeScene|\.glb(?:\?|$)/.test(url))).toEqual([]);
});


test("context loss disposes the canvas and leaves navigation available", async ({ page }) => {
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
  await page.locator(".living-three-scene canvas").evaluate(canvas => canvas.dispatchEvent(new Event("webglcontextlost")));
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
});


for (const width of [320, 390, 1366]) test(`each weekday renders its registered recipe at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const landmarks = ["garden-gate", "herb-garden", "shade-tree", "footbridge", "reading-shelter", "pavilion", "sunset-overlook"];
  await page.setViewportSize({ width, height: 844 });
  await page.route("http://e2e.invalid/**", route => {
    const requestUrl = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/json", headers: {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    }, body: JSON.stringify({ start_on: requestUrl.searchParams.get("start_on"), end_on: requestUrl.searchParams.get("end_on"),
      blood_pressure_observations: [], active_challenge: null, challenge_checkins: [],
      challenge_events: [{ id: "synthetic-weekday", observed_on: requestUrl.searchParams.get("end_on"), action_id: "walk-10-minutes", status: "skipped" }],
    }) });
  });
  for (let index = 0; index < landmarks.length; index++) {
    const day = String(index + 7).padStart(2, "0");
    await page.clock.setFixedTime(new Date(`2026-09-${day}T03:00:00Z`));
    await page.goto("/?e2e=signed-in&screen=S02");
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-scene-recipe]")).toHaveAttribute("data-scene-recipe", `s02-${landmarks[index]}`);
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
    const bounds = JSON.parse((await page.locator("[data-subject-bounds]").getAttribute("data-subject-bounds"))!);
    const composition = sceneComposition(findSceneRecipe("S02", landmarks[index])!, width);
    expect(bounds.left).toBeGreaterThanOrEqual(-1); expect(bounds.right).toBeLessThanOrEqual(1);
    expect(bounds.bottom).toBeGreaterThanOrEqual(-1); expect(bounds.top).toBeLessThanOrEqual(1);
    const stageHeight = await page.locator(".living-visual-stage").evaluate(element => element.clientHeight);
    expectRelativeSubjectHeight(bounds.height, stageHeight, composition);
    await page.locator(".living-visual-stage").screenshot({ path: testInfo.outputPath(`${landmarks[index]}-${width}.png`) });
  }
});

async function syntheticCalendar(page: Page) {
  await page.route("http://e2e.invalid/**", route => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type" }, body: JSON.stringify({
      start_on: url.searchParams.get("start_on"), end_on: url.searchParams.get("end_on"), blood_pressure_observations: [], active_challenge: null, challenge_checkins: [],
      challenge_events: [{ id: "synthetic-poster", observed_on: url.searchParams.get("end_on"), action_id: "walk-10-minutes", status: "skipped" }],
    }) });
  });
}

async function expectPoster(page: Page, landmarkId: string, width: number) {
  const profile = width <= 350 ? "mobile320" : width <= 580 ? "mobile390" : "desktop";
  const evidence = posterEvidence.posters.find(p => p.landmarkId === landmarkId && p.profile === profile)!;
  await expect(page.locator("[data-poster-asset]")).toHaveAttribute("data-poster-asset", evidence.id);
  const image = page.locator(".living-scene-fallback img");
  await expect(image).toHaveAttribute("src", posterR2.objects.find(p => p.id === evidence.id)!.url);
  // Public CDN delivery can outlast Playwright's default five-second assertion.
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 }).toBe(evidence.width);
  const stage = (await page.locator(".living-visual-stage").boundingBox())!;
  const box = (await image.boundingBox())!;
  const { left, right, top, bottom } = evidence.subjectBounds;
  // The orthographic camera and poster both preserve vertical scale. At widths
  // between masters only horizontal margins crop; the focal subject stays whole.
  expect(box.x + (left + 1) / 2 * box.width).toBeGreaterThanOrEqual(stage.x - 2);
  expect(box.x + (right + 1) / 2 * box.width).toBeLessThanOrEqual(stage.x + stage.width + 2);
  expect(box.y + (1 - top) / 2 * box.height).toBeGreaterThanOrEqual(stage.y - 2);
  expect(box.y + (1 - bottom) / 2 * box.height).toBeLessThanOrEqual(stage.y + stage.height + 2);
  const composition = sceneComposition(findSceneRecipe("S02", landmarkId)!, width);
  const subjectHeight = (top - bottom) / 2 * box.height;
  expectRelativeSubjectHeight(subjectHeight, stage.height, composition);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}

for (const width of [320, 390, 1366]) test(`all weekday posters select one matching asset at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await syntheticCalendar(page);
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  const landmarks = ["garden-gate", "herb-garden", "shade-tree", "footbridge", "reading-shelter", "pavilion", "sunset-overlook"];
  for (const [index, landmark] of landmarks.entries()) {
    requests.length = 0;
    await page.clock.setFixedTime(new Date(`2026-09-${String(index + 7).padStart(2, "0")}T03:00:00Z`));
    await page.goto("/?e2e=signed-in&screen=S02");
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expectPoster(page, landmark, width);
    expect(requests.filter(url => url.includes("/scene-review/s02/"))).toHaveLength(1);
    expect(requests.filter(url => /ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)/.test(url))).toEqual([]);
    await page.locator(".living-visual-stage").screenshot({ path: testInfo.outputPath(`${landmark}-poster-${width}.png`) });
  }
});

test("public poster permits browser CORS and returns the registered bytes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  const poster = posterR2.objects[0];
  const response = await page.evaluate(async publicUrl => {
    const result = await fetch(publicUrl, { mode: "cors", redirect: "error" });
    const bytes = await result.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return { status: result.status, mime: result.headers.get("content-type"), cache: result.headers.get("cache-control"),
      byteLength: bytes.byteLength, sha256: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("") };
  }, poster.url);
  expect(response).toEqual({ status: 200, mime: "image/webp", cache: "max-age=14400", byteLength: poster.byteLength, sha256: poster.sha256 });
});

test("poster preserves relative focal scale across responsive breakpoints", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  for (const width of [320, 350, 351, 580, 581, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expectPoster(page, "footbridge", width);
  }
});

test("poster failure resets for a new profile and Seoul weekday", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await syntheticCalendar(page);
  await page.route("**/scene-review/s02/v1/*-mobile320-*.webp", route => route.abort());
  await page.clock.setFixedTime(new Date("2026-09-07T03:00:00Z"));
  await page.goto("/?e2e=signed-in&screen=S02");
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-poster-asset]")).toHaveAttribute("data-poster-asset", "poster-garden-gate-mobile320");
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectPoster(page, "garden-gate", 390);
  await page.clock.setFixedTime(new Date("2026-09-08T03:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expectPoster(page, "herb-garden", 390);
  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
});
