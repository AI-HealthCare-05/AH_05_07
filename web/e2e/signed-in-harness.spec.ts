import { expect, test, type Page } from "@playwright/test";

const emptyWindow = {
  start_on: "2026-08-28",
  end_on: "2026-09-03",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

const previousWindow = {
  ...emptyWindow,
  blood_pressure_observations: [
    { id: "e2e-previous-observation", observed_on: "2026-09-02", period: "morning", systolic: 120, diastolic: 80 },
  ],
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

test("synthetic signed-in session blocks a duplicate save and does not claim an uncertain save succeeded", async ({ page }) => {
  let saveRequests = 0;
  let releaseSave: (() => void) | undefined;
  const pendingSave = new Promise<void>((resolve) => { releaseSave = resolve; });

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
      saveRequests += 1;
      await pendingSave;
      await route.fulfill({ contentType: "application/json", status: 503, headers, body: JSON.stringify({ detail: { code: "request_failed" } }) });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  const saveButton = page.locator("form.measurement-panel button[type=submit]");
  await saveButton.click();

  await expect(saveButton).toHaveText("저장 중");
  await expect(saveButton).toBeDisabled();
  expect(saveRequests).toBe(1);

  releaseSave?.();
  await expect(page.getByRole("status")).toContainText("저장 여부를 확인하지 못했습니다.");
  await expect(page.getByText("혈압 기록을 저장했습니다.")).toHaveCount(0);
  await expect(saveButton).toBeEnabled();
  expect(saveRequests).toBe(1);
});

test("synthetic signed-in refresh failure retains the previously loaded records", async ({ page }) => {
  let windowRequests = 0;
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
      windowRequests += 1;
      const isInitialLoad = windowRequests === 1;
      await route.fulfill({
        contentType: "application/json",
        status: isInitialLoad ? 200 : 503,
        headers,
        body: JSON.stringify(isInitialLoad ? previousWindow : { detail: { code: "request_failed" } }),
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in");
  await expect(page.getByText("120/80 mmHg")).toBeVisible();
  await page.getByRole("button", { name: "새로고침" }).click();

  await expect(page.getByRole("status")).toContainText("새로고침에 실패했습니다. 이전에 불러온 기록을 표시하고 있어요.");
  await expect(page.getByText("120/80 mmHg")).toBeVisible();
  expect(windowRequests).toBe(2);
});
