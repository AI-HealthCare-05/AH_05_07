import { expect, test } from "@playwright/test";

test("unconfigured Living Journey sends no new renderer, geometry or poster requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/?fixture=VP-10&screen=S02");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page.locator(".living-visual-stage")).toHaveCount(0);
  expect(requests.filter((url) => /ThreeSceneRenderer|\.glb(?:\?|$)|\/scene-review\/s02\//.test(url))).toEqual([]);
});
