import { expect, test } from "@playwright/test";

for (const screen of ["S02", "S10"]) test(`unconfigured ${screen} sends no new renderer, geometry or poster requests`, async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/?fixture=VP-10&screen=${screen}`);
  await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
  await expect(page.locator(".living-visual-stage")).toHaveCount(0);
  expect(requests.filter((url) => /ThreeSceneRenderer|disposeScene|\.glb(?:\?|$)|\/scene-review\/(s02|s10)\//.test(url))).toEqual([]);
});
