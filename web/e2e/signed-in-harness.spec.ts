import { expect, test, type Page } from "@playwright/test";

const emptyWindow = {
  start_on: "2026-08-28",
  end_on: "2026-09-03",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

async function routeApiWindow(page: Page, status: number, body: unknown, onSave?: () => void) {
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
      await route.fulfill({ contentType: "application/json", status, headers, body: JSON.stringify(body) });
      return;
    }
    if (url.pathname === "/api/v1/observations/blood-pressure" && request.method() === "POST") {
      onSave?.();
    }
    await route.abort();
  });
}

test("synthetic signed-in session keeps invalid measurement in the browser", async ({ page }) => {
  let saveRequests = 0;
  await routeApiWindow(page, 200, emptyWindow, () => { saveRequests += 1; });

  await page.goto("/?e2e=signed-in");
  await expect(page.getByRole("heading", { name: "7일 기록" })).toBeVisible();
  await page.getByLabel(/수축기/).fill("59");
  await page.getByLabel(/이완기/).fill("70");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();

  await expect(page.getByRole("alert")).toContainText("수축기 값은 60에서 260 사이의 정수로 입력해 주세요.");
  await expect(page.getByLabel(/수축기/)).toBeFocused();
  expect(saveRequests).toBe(0);
});

test("synthetic signed-in session returns to login after a 401 window response", async ({ page }) => {
  await routeApiWindow(page, 401, { detail: { code: "supabase_session_invalid" } });

  await page.goto("/?e2e=signed-in");
  await expect(page.getByRole("heading", { name: "입력 기반 위험군 선별 신호" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("로그인 시간이 만료되었습니다.");
});

test("synthetic signed-in load failure is not rendered as an empty record set", async ({ page }) => {
  await routeApiWindow(page, 503, { detail: { code: "request_failed" } });

  await page.goto("/?e2e=signed-in");
  await expect(page.getByRole("alert")).toContainText("아직 기록이 없다는 뜻은 아니에요.");
  await expect(page.getByText("아직 혈압 관찰 기록이 없습니다.")).toHaveCount(0);
});
