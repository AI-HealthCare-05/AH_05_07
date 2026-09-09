import type { Request } from "@playwright/test";
import { findSceneRecipe, sceneComposition } from "../src/ui/sceneRecipes";
import { expect, test } from "@playwright/test";

const url = "/?fixture=VP-10&screen=S02";
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
    expect(bounds.height).toBeGreaterThanOrEqual(composition.subjectMinHeight);
    expect(bounds.height).toBeLessThanOrEqual(composition.subjectMaxHeight);
    const network = await Promise.all(completed.filter(request => /ThreeSceneRenderer|GLTFLoader|\.glb(?:\?|$)|sk7-character-base-cream-v01/.test(request.url())).map(async request => ({ url: request.url(), ...await request.sizes() })));
    expect(network.filter(request => /\.glb(?:\?|$)/.test(request.url))).toHaveLength(1);
    expect(network.some(request => /GLTFLoader/.test(request.url))).toBe(true);
    expect(network.some(request => /ThreeSceneRenderer/.test(request.url))).toBe(true);
    await testInfo.attach("scene-network", { body: JSON.stringify({ viewport: { width, height }, source: "Vite production preview, cold browser context; responseBodySize is encoded body, headers separate; not device acceptance", bounds, requests: network }, null, 2), contentType: "application/json" });
    expect(assets).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("scene.png"), fullPage: true });
  });
}

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
  expect(requests.filter(url => /ThreeSceneRenderer|\.glb(?:\?|$)/.test(url))).toEqual([]);
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


test("each weekday renders its registered mobile recipe", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const landmarks = ["garden-gate", "herb-garden", "shade-tree", "footbridge", "reading-shelter", "pavilion", "sunset-overlook"];
  await page.setViewportSize({ width: 320, height: 844 });
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
    await page.locator(".living-visual-stage").screenshot({ path: testInfo.outputPath(`${landmarks[index]}-320.png`) });
  }
});
