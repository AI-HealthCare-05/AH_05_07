import { expect, test } from "@playwright/test";

test("production build ignores a fixture query parameter", async ({ page }) => {
  await page.goto("/?fixture=VP-10");
  await expect(page.getByRole("heading", { name: "7일 기록" })).toHaveCount(0);
  await expect(page.getByText("웹 환경변수를 설정한 뒤 시작할 수 있습니다.")).toBeVisible();
});

test("production build cannot enable the journey candidate or signed-in harness from a URL", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto("/?e2e=signed-in&screen=S02&scene=review&VITE_SK7_SCENE_MODE=review");
  await expect(page.getByText("웹 환경변수를 설정한 뒤 시작할 수 있습니다.")).toBeVisible();
  await expect(page.locator(".journey-candidate, [data-saved-scene-status], [data-living-scene]")).toHaveCount(0);
  expect(requests.some(url => url.includes("e2e.invalid"))).toBe(false);
});


test("production build cannot open the recap candidate or synthetic records by URL", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto("/?e2e=signed-in&screen=S10&recap_fixture=mixed&scene=review&VITE_SK7_SCENE_MODE=review");
  await expect(page.getByText("웹 환경변수를 설정한 뒤 시작할 수 있습니다.")).toBeVisible();
  await expect(page.locator(".journey-recap, [data-saved-scene-status], [data-living-scene], [data-dashboard-lane]")).toHaveCount(0);
  expect(requests.some(url => url.includes("e2e.invalid"))).toBe(false);
});
