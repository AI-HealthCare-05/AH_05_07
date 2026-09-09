import { expect, test } from "@playwright/test";

const url = "/?fixture=VP-10&screen=S02";
for (const [width, height] of [[320, 568], [320, 844], [390, 844], [1366, 768]]) {
  test(`review renders at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const assets: string[] = [];
    page.on("request", request => { if (/\.glb(?:\?|$)/.test(request.url())) assets.push(request.url()); });
    await page.goto(url);
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
    await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
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
