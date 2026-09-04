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

function koreaToday(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date()).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function currentChallengeWindow(status: "completed" | "skipped") {
  const observedOn = koreaToday();
  return {
    ...emptyWindow,
    active_challenge: {
      id: "e2e-active-challenge",
      action_id: "walk-10-minutes",
      starts_on: observedOn,
      ends_on: observedOn,
      first_checkin_on: observedOn,
    },
    challenge_checkins: [
      {
        id: "e2e-current-checkin",
        challenge_id: "e2e-active-challenge",
        action_id: "walk-10-minutes",
        observed_on: observedOn,
        status,
      },
    ],
  };
}

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

test("synthetic signed-in session updates only the current owned check-in status", async ({ page }) => {
  let status: "completed" | "skipped" = "completed";
  let updateRequests = 0;
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
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(currentChallengeWindow(status)) });
      return;
    }
    if (url.pathname === "/api/v1/observations/challenges/checkins/e2e-current-checkin" && request.method() === "PUT") {
      expect(request.postDataJSON()).toEqual({ status: "skipped" });
      updateRequests += 1;
      status = "skipped";
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(currentChallengeWindow(status).challenge_checkins[0]) });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in");
  await page.getByRole("button", { name: "수정" }).click();
  const editor = page.getByRole("status").filter({ hasText: "10분 걷기 상태" });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "건너뜀" }).click();

  await expect(page.getByRole("status")).toContainText("챌린지 상태를 수정했습니다.");
  await expect(page.getByRole("heading", { name: "챌린지 참여" }).locator("..")).toContainText("건너뜀");
  expect(updateRequests).toBe(1);
});

test("synthetic signed-in session requires confirmation before deleting the current owned check-in", async ({ page }) => {
  let deleted = false;
  let deleteRequests = 0;
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
      const window = currentChallengeWindow("completed");
      if (deleted) window.challenge_checkins = [];
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(window) });
      return;
    }
    if (url.pathname === "/api/v1/observations/challenges/checkins/e2e-current-checkin" && request.method() === "DELETE") {
      deleteRequests += 1;
      deleted = true;
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in");
  await page.getByRole("button", { name: "삭제" }).click();
  const confirmation = page.getByRole("alert").filter({ hasText: "챌린지 기록을 삭제할까요?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "취소" }).click();
  await expect(confirmation).toHaveCount(0);
  expect(deleteRequests).toBe(0);

  await page.getByRole("button", { name: "삭제" }).click();
  await confirmation.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("status")).toContainText("챌린지 기록을 삭제했습니다.");
  await expect(page.getByRole("heading", { name: "챌린지 참여" }).locator("..")).toContainText("아직 챌린지 참여 기록이 없습니다.");
  expect(deleteRequests).toBe(1);
});

test("synthetic signed-in session keeps a blood-pressure draft after storage is unavailable", async ({ page }) => {
  let saveRequests = 0;
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
      await route.fulfill({ contentType: "application/json", status: 503, headers, body: JSON.stringify({ detail: { code: "observation_storage_not_ready" } }) });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  const saveButton = page.locator("form.measurement-panel button[type=submit]");
  await saveButton.click();

  await expect(page.getByRole("status")).toContainText("저장 여부를 확인하지 못했습니다.");
  await expect(page.getByText("혈압 기록을 저장했습니다.")).toHaveCount(0);
  await expect(page.getByLabel(/수축기/)).toHaveValue("120");
  await expect(page.getByLabel(/이완기/)).toHaveValue("80");
  await expect(saveButton).toBeEnabled();
  expect(saveRequests).toBe(1);
});

test("synthetic signed-in session keeps current check-in editing recoverable after storage is unavailable", async ({ page }) => {
  let updateRequests = 0;
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
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(currentChallengeWindow("completed")) });
      return;
    }
    if (url.pathname === "/api/v1/observations/challenges/checkins/e2e-current-checkin" && request.method() === "PUT") {
      updateRequests += 1;
      await route.fulfill({ contentType: "application/json", status: 503, headers, body: JSON.stringify({ detail: { code: "observation_storage_not_ready" } }) });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in");
  await page.getByRole("button", { name: "수정" }).click();
  const editor = page.getByRole("status").filter({ hasText: "10분 걷기 상태" });
  await editor.getByRole("button", { name: "건너뜀" }).click();

  await expect(page.getByText("저장 여부를 확인하지 못했습니다. 목록을 다시 불러온 뒤 필요한 경우 다시 시도해 주세요.")).toBeVisible();
  await expect(page.getByText("챌린지 상태를 수정했습니다.")).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("button", { name: "건너뜀" })).toBeEnabled();
  expect(updateRequests).toBe(1);
});

test("synthetic signed-in session keeps current check-in deletion recoverable after storage is unavailable", async ({ page }) => {
  let deleteRequests = 0;
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
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(currentChallengeWindow("completed")) });
      return;
    }
    if (url.pathname === "/api/v1/observations/challenges/checkins/e2e-current-checkin" && request.method() === "DELETE") {
      deleteRequests += 1;
      await route.fulfill({ contentType: "application/json", status: 503, headers, body: JSON.stringify({ detail: { code: "observation_storage_not_ready" } }) });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in");
  await page.getByRole("button", { name: "삭제" }).click();
  const confirmation = page.getByRole("alert").filter({ hasText: "챌린지 기록을 삭제할까요?" });
  await confirmation.getByRole("button", { name: "삭제" }).click();

  await expect(page.getByRole("status")).toContainText("삭제 여부를 확인하지 못했습니다.");
  await expect(page.getByText("챌린지 기록을 삭제했습니다.")).toHaveCount(0);
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "삭제" })).toBeEnabled();
  expect(deleteRequests).toBe(1);
});
