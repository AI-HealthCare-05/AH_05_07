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

function shiftKoreaDate(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00+09:00`);
  date.setDate(date.getDate() + offset);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
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

function recordBrowseWindow() {
  const observedOn = koreaToday();
  return {
    ...emptyWindow,
    active_challenge: {
      id: "e2e-browse-challenge",
      action_id: "walk-10-minutes",
      starts_on: observedOn,
      ends_on: observedOn,
      first_checkin_on: observedOn,
    },
    blood_pressure_observations: [
      { id: "e2e-browse-observation", observed_on: observedOn, period: "morning", systolic: 120, diastolic: 80 },
    ],
    challenge_checkins: [
      { id: "e2e-browse-checkin", challenge_id: "e2e-browse-challenge", action_id: "walk-10-minutes", observed_on: observedOn, status: "completed" },
    ],
    challenge_events: [
      { id: "e2e-browse-legacy", action_id: "sleep-routine", observed_on: shiftKoreaDate(observedOn, -1), status: "skipped" },
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

  await page.goto("/?e2e=signed-in&screen=S04");
  await expect(page.getByRole("heading", { name: "혈압 기록" })).toBeVisible();
  await page.getByLabel(/수축기/).fill("59");
  await page.getByLabel(/이완기/).fill("70");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();

  await expect(page.getByRole("alert")).toContainText("수축기 값은 60에서 260 사이의 정수로 입력해 주세요.");
  await expect(page.getByLabel(/수축기/)).toBeFocused();
  expect(saveRequests).toBe(0);
});

test("synthetic signed-in session returns to login after a 401 window response", async ({ page }) => {
  await routeApiWindow(page, 401, { detail: { code: "supabase_session_invalid" } });

  await page.goto("/?e2e=signed-in&screen=S04");
  await expect(page.getByRole("heading", { name: "오늘의 기록을 차분히 시작해요" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("로그인 시간이 만료되었습니다.");
});

test("synthetic signed-in load failure is not rendered as an empty record set", async ({ page }) => {
  await routeApiWindow(page, 503, { detail: { code: "request_failed" } });

  await page.goto("/?e2e=signed-in&screen=S04");
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

  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  const saveButton = page.locator("form.measurement-panel button[type=submit]");
  await saveButton.click();

  await expect(saveButton).toHaveText("저장 중");
  await expect(saveButton).toBeDisabled();
  expect(saveRequests).toBe(1);

  releaseSave?.();
  await expect(page.getByRole("status")).toContainText("저장 여부를 확인하지 못했어요.");
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

  await page.goto("/?e2e=signed-in&screen=S10");
  await expect(page.getByText("120/80 mmHg")).toBeVisible();
  await page.getByRole("button", { name: "새로고침" }).click();

  await expect(page.getByRole("status")).toContainText("새로고침하지 못했어요. 지금 보이는 기록은 그대로 유지됩니다.");
  await expect(page.getByText("120/80 mmHg")).toBeVisible();
  expect(windowRequests).toBe(2);
});

test("synthetic signed-in session reopens the selected prior window without a mutation", async ({ page }) => {
  const today = koreaToday();
  const currentStart = shiftKoreaDate(today, -6);
  const priorStart = shiftKoreaDate(today, -13);
  const priorEnd = shiftKoreaDate(today, -7);
  const requests: Array<{ start: string | null; end: string | null; method: string }> = [];

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
      requests.push({ start: url.searchParams.get("start_on"), end: url.searchParams.get("end_on"), method: request.method() });
      const isPrior = url.searchParams.get("start_on") === priorStart;
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        headers,
        body: JSON.stringify(isPrior
          ? { ...emptyWindow, start_on: priorStart, end_on: priorEnd, blood_pressure_observations: [{ id: "e2e-prior", observed_on: priorStart, period: "morning", systolic: 120, diastolic: 80 }] }
          : { ...emptyWindow, start_on: currentStart, end_on: today }),
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  await page.getByRole("button", { name: "이전 7일 보기" }).click();

  await expect(page).toHaveURL(/dashboard_window=prior/);
  await expect(page.getByText("이전 7일 기록을 읽기 전용으로 보고 있어요.")).toBeVisible();
  await expect(page.getByText("120/80 mmHg")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/dashboard_window=prior/);
  await expect(page.getByText("120/80 mmHg")).toBeVisible();
  await page.getByRole("button", { name: "현재 7일 보기" }).click();
  await expect(page).not.toHaveURL(/dashboard_window=prior/);

  expect(requests).toEqual([
    { start: currentStart, end: today, method: "GET" },
    { start: priorStart, end: priorEnd, method: "GET" },
    { start: priorStart, end: priorEnd, method: "GET" },
    { start: currentStart, end: today, method: "GET" },
  ]);
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

  await page.goto("/?e2e=signed-in&screen=S08");
  await page.locator('[data-record-lane="challenge"]').getByRole("button", { name: "상세 보기" }).click();
  await page.getByRole("button", { name: "수정" }).click();
  const editor = page.getByRole("status").filter({ hasText: "10분 걷기 상태" });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "건너뜀" }).click();

  await expect(page.getByRole("status")).toContainText("챌린지 상태를 수정했습니다.");
  await expect(page.locator('[data-record-detail-kind="challenge-checkin"]')).toContainText("건너뜀");
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

  await page.goto("/?e2e=signed-in&screen=S08");
  await page.locator('[data-record-lane="challenge"]').getByRole("button", { name: "상세 보기" }).click();
  await page.getByRole("button", { name: "삭제" }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "챌린지 기록을 삭제할까요?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "취소" }).click();
  await expect(confirmation).toHaveCount(0);
  expect(deleteRequests).toBe(0);

  await page.getByRole("button", { name: "삭제" }).click();
  await confirmation.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("status")).toContainText("챌린지 기록을 삭제했습니다.");
  await expect(page.locator('[data-record-lane="challenge"]')).toContainText("아직 챌린지 참여 기록이 없습니다.");
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

  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  const saveButton = page.locator("form.measurement-panel button[type=submit]");
  await saveButton.click();

  await expect(page.getByRole("status")).toContainText("저장 여부를 확인하지 못했어요.");
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

  await page.goto("/?e2e=signed-in&screen=S08");
  await page.locator('[data-record-lane="challenge"]').getByRole("button", { name: "상세 보기" }).click();
  await page.getByRole("button", { name: "수정" }).click();
  const editor = page.getByRole("status").filter({ hasText: "10분 걷기 상태" });
  await editor.getByRole("button", { name: "건너뜀" }).click();

  await expect(page.getByText("저장 여부를 확인하지 못했어요. 자동으로 다시 보내지 않았습니다. 기록을 새로고침해 확인해 주세요.")).toBeVisible();
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

  await page.goto("/?e2e=signed-in&screen=S08");
  await page.locator('[data-record-lane="challenge"]').getByRole("button", { name: "상세 보기" }).click();
  await page.getByRole("button", { name: "삭제" }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "챌린지 기록을 삭제할까요?" });
  await confirmation.getByRole("button", { name: "삭제" }).click();

  await expect(page.getByRole("status")).toContainText("삭제 여부를 확인하지 못했습니다.");
  await expect(page.getByText("챌린지 기록을 삭제했습니다.")).toHaveCount(0);
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "삭제" })).toBeEnabled();
  expect(deleteRequests).toBe(1);
});

test("synthetic signed-in session recovers a blood-pressure draft after the shared request timeout", async ({ page }) => {
  let saveRequests = 0;
  let releaseRequest: (() => void) | undefined;
  const pendingRequest = new Promise<void>((resolve) => { releaseRequest = resolve; });
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
      await pendingRequest;
      await route.abort().catch(() => undefined);
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  const saveButton = page.locator("form.measurement-panel button[type=submit]");
  await saveButton.click();

  await expect(page.getByText("저장 여부를 확인하지 못했어요. 자동으로 다시 보내지 않았습니다. 기록을 새로고침해 확인해 주세요.")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("혈압 기록을 저장했습니다.")).toHaveCount(0);
  await expect(page.getByLabel(/수축기/)).toHaveValue("120");
  await expect(page.getByLabel(/이완기/)).toHaveValue("80");
  await expect(saveButton).toBeEnabled();
  expect(saveRequests).toBe(1);
  releaseRequest?.();
});

test("synthetic signed-in session opens a separated record detail and starts only the owned current edit", async ({ page }) => {
  await routeApiWindow(page, 200, recordBrowseWindow());

  await page.goto("/?e2e=signed-in&screen=S08");
  const bloodPressureLane = page.locator('[data-record-lane="blood-pressure"]');
  await bloodPressureLane.getByRole("button", { name: "상세 보기" }).click();

  const detail = page.locator('[data-record-detail-kind="blood-pressure"]');
  await expect(detail).toContainText("혈압 관찰");
  await expect(detail).toContainText("120/80 mmHg");
  await detail.getByRole("button", { name: "수정" }).click();

  await expect(page.getByRole("heading", { name: "혈압 기록 수정" })).toBeVisible();
  await expect(page.getByLabel(/수축기/)).toHaveValue("120");
});

test("synthetic signed-in prior detail remains read-only without a mutation", async ({ page }) => {
  const requests: string[] = [];
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
      requests.push(request.method());
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(recordBrowseWindow()) });
      return;
    }
    requests.push(request.method());
    await route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  await page.getByRole("button", { name: "이전 7일 보기" }).click();
  await page.getByRole("button", { name: "기록 찾아보기" }).click();
  await page.locator('[data-record-lane="blood-pressure"]').getByRole("button", { name: "상세 보기" }).click();

  const detail = page.locator('[data-record-detail-kind="blood-pressure"]');
  await expect(detail).toContainText("이전 7일의 기록은 읽기 전용입니다.");
  await expect(detail.getByRole("button", { name: "수정" })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "삭제" })).toHaveCount(0);
  expect(requests).toEqual(["GET", "GET"]);
});

test("synthetic signed-in session tells the user when a selected record disappears after refresh", async ({ page }) => {
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
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(windowRequests === 1 ? recordBrowseWindow() : emptyWindow) });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S08");
  await page.locator('[data-record-lane="blood-pressure"]').getByRole("button", { name: "상세 보기" }).click();
  await page.getByRole("button", { name: "새로고침" }).click();

  await expect(page.getByRole("alert")).toContainText("선택한 기록을 찾을 수 없습니다.");
  await page.getByRole("button", { name: "목록으로 돌아가기" }).click();
  await expect(page.locator('[data-record-lane="blood-pressure"]')).toContainText("아직 혈압 관찰 기록이 없습니다.");
  expect(windowRequests).toBe(2);
});
