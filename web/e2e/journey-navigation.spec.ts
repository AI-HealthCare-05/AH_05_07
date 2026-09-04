import { expect, test } from "@playwright/test";

const emptyWindow = {
  start_on: "2026-08-29",
  end_on: "2026-09-04",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

test("primary journey navigation updates the URL and supports browser history", async ({ page }) => {
  await page.goto("/?fixture=VP-10");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();

  await page.getByRole("button", { name: "기록 찾아보기" }).click();
  await expect(page).toHaveURL(/screen=S08/);
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  await page.getByRole("button", { name: "7일 돌아보기" }).click();
  await expect(page).toHaveURL(/screen=S10/);
  await page.goBack();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();

  await page.getByRole("button", { name: "입력 기반 위험군 선별 신호" }).click();
  await expect(page.locator('[data-scene="S11"]')).toContainText("아직 준비 중이에요");
  await page.getByRole("button", { name: "설정과 도움말" }).click();
  await expect(page.locator('[data-scene="S14"]')).toBeVisible();
});

test("a selected fact opens its own URL-addressable detail screen", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S08");
  await page.locator('[data-record-lane="blood-pressure"]').getByRole("button", { name: "상세 보기" }).first().click();

  await expect(page).toHaveURL(/screen=S09/);
  await expect(page).toHaveURL(/record=blood-pressure%3Afixture-bp-/);
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("•••/•• mmHg");
});

test("confirmed persistence alone opens the saved scene", async ({ page }) => {
  let saved = false;
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === "/api/v1/observations/window") {
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(emptyWindow) });
      return;
    }
    if (url.pathname === "/api/v1/observations/blood-pressure" && request.method() === "POST") {
      saved = true;
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        headers,
        body: JSON.stringify({ id: "synthetic-saved", ...request.postDataJSON() }),
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();

  expect(saved).toBe(true);
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-scene="S05"]')).toHaveCount(0);
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
});
