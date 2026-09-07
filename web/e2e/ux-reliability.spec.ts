import { expect, test, type Page, type Route } from "@playwright/test";

const headers = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const observationWindow = {
  start_on: "2026-08-31",
  end_on: "2026-09-06",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

async function reply(route: Route, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  await route.fulfill({ status, headers: { ...headers, ...extraHeaders }, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockExport(page: Page, status = 200) {
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/api/v1/observations/window") return reply(route, observationWindow);
    if (url.pathname === "/api/v1/observations/export") {
      if (status !== 200) return reply(route, { detail: { code: "request_failed" } }, status);
      return route.fulfill({ status: 200, headers: { ...headers, "Content-Disposition": "attachment; filename=records.json" }, contentType: "application/json", body: JSON.stringify({ records: [] }) });
    }
    return route.abort();
  });
}

test("export success notice clears on primary navigation and browser history", async ({ page }) => {
  await mockExport(page);
  await page.goto("/?e2e=signed-in&screen=S10");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "선택한 7일 내보내기" }).click();
  await download;
  await expect(page.getByRole("status")).toContainText("내보내기 파일을 준비했어요.");

  await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await expect(page.locator(".notice")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/screen=S10/);
  await expect(page.locator(".notice")).toHaveCount(0);
});

test("export error notice survives navigation", async ({ page }) => {
  await mockExport(page, 503);
  await page.goto("/?e2e=signed-in&screen=S10");
  await page.getByRole("button", { name: "선택한 7일 내보내기" }).click();
  await expect(page.getByRole("status")).toContainText("파일을 내려받지 못했습니다.");
  await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("파일을 내려받지 못했습니다.");
});

test("recent history and challenge progression use separate labels", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S02");
  const recentHistory = page.locator('[data-window-kind="recent-history"]');
  await expect(recentHistory).toContainText("최근 7일 기록");
  await expect(recentHistory).toContainText("챌린지 7일 진행과는 별도로");

  await page.goto("/?fixture=VP-10&screen=S10");
  await expect(page.locator('[aria-label="최근 7일 기록 구간"]')).toContainText("챌린지 진행률이 아닙니다.");
  await expect(page.locator("[data-challenge-progress]")).toContainText("7일 챌린지");
  await expect(page.locator("[data-challenge-progress]")).toContainText("체크인 기록 3개");
  await expect(page.locator('[data-dashboard-lane="challenge"]')).toContainText("최근 7일 챌린지 체크인 기록");
});
