import { expect, test, type Page } from "@playwright/test";

const headers = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const today = "2026-09-11";

function windowWithActiveChallenge(options: { checkin?: "completed" | "skipped"; firstCheckin?: string | null; endsOn?: string; startOn?: string; endOn?: string; legacyObservedOn?: string } = {}) {
  const challenge = {
    id: "challenge-daily-active",
    action_id: "walk-10-minutes",
    starts_on: "2026-09-09",
    ends_on: options.endsOn ?? "2026-09-15",
    first_checkin_on: options.firstCheckin === undefined ? "2026-09-09" : options.firstCheckin,
    status: "active",
  };
  return {
    start_on: options.startOn ?? "2026-09-05",
    end_on: options.endOn ?? today,
    blood_pressure_observations: [],
    active_challenge: challenge,
    challenge_checkins: options.checkin ? [{ id: "challenge-daily-checkin", challenge_id: challenge.id, action_id: challenge.action_id, observed_on: today, status: options.checkin }] : [],
    challenge_events: [{ id: "challenge-daily-legacy", action_id: "sleep-routine", observed_on: options.legacyObservedOn ?? "2026-09-08", status: "skipped" }],
  };
}

async function setJourneyTime(page: Page) {
  await page.clock.setFixedTime(new Date("2026-09-11T03:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
}

test("S03 saves an existing action request once without premature selection", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setJourneyTime(page);
  let selectedAction: string | null = null;
  let selectionRequests = 0;
  let releaseSelection: (() => void) | undefined;
  const selectionPending = new Promise<void>((resolve) => { releaseSelection = resolve; });
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/window")) {
      const active = selectedAction
        ? { ...windowWithActiveChallenge({ firstCheckin: null }), active_challenge: { ...windowWithActiveChallenge({ firstCheckin: null }).active_challenge, action_id: selectedAction } }
        : { start_on: "2026-09-05", end_on: today, blood_pressure_observations: [], active_challenge: null, challenge_checkins: [], challenge_events: [] };
      if (selectedAction) expect(active.active_challenge.first_checkin_on).toBeNull();
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(active) });
    }
    if (url.pathname.endsWith("/challenges/active") && request.method() === "POST") {
      selectionRequests += 1;
      selectedAction = request.postDataJSON().action_id;
      await selectionPending;
      return route.fulfill({ status: 201, headers, contentType: "application/json", body: JSON.stringify({ id: "challenge-daily-active", action_id: selectedAction }) });
    }
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S03");
  await expect(page.getByRole("heading", { name: "이어갈 행동을 골라요" })).toBeVisible();
  await page.locator("html").evaluate((html) => { html.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole("button", { name: /10분 걷기/ }).click();
  await expect(page.getByText("선택한 행동을 저장하고 있어요.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /선택 저장 중/ })).toHaveCount(3);
  await expect(page.getByText("선택됨", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /수면 시간 지키기/ })).toBeDisabled();
  await expect(page.locator('[data-scene="S03"]').getByRole("button", { name: "오늘의 기록으로 돌아가기", exact: true })).toBeDisabled();
  expect(selectionRequests).toBe(1);

  releaseSelection!();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  expect(selectionRequests).toBe(1);
  await page.goto("/?e2e=signed-in&screen=S03");
  await expect(page.getByRole("button", { name: /10분 걷기/ })).toBeEnabled();
});

test("S03 and S06 open S07 read-only, then S07 records one independent challenge status", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setJourneyTime(page);
  let checkin: "completed" | "skipped" | undefined;
  let checkinRequests = 0;
  const nonGetRequests: string[] = [];
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() !== "GET") nonGetRequests.push(`${request.method()} ${url.pathname}`);
    if (url.pathname.endsWith("/window")) return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(windowWithActiveChallenge({ checkin })) });
    if (url.pathname.endsWith("/challenges/active/checkins") && request.method() === "POST") {
      checkinRequests += 1;
      const payload = request.postDataJSON();
      expect(payload).toEqual({ observed_on: today, status: "completed" });
      checkin = payload.status;
      return route.fulfill({ status: 201, headers, contentType: "application/json", body: JSON.stringify({ id: "challenge-daily-checkin", challenge_id: "challenge-daily-active", action_id: "walk-10-minutes", ...payload }) });
    }
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S03");
  await expect(page.getByText("선택됨 · 변경 불가", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "오늘 상태 확인·기록하기" }).click();
  await expect(page.locator('[data-scene="S07"]')).toBeVisible();
  expect(nonGetRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  await page.goto("/?e2e=signed-in&screen=S06");
  await expect(page.getByRole("heading", { name: "선택한 행동을 확인해요" })).toBeVisible();
  await expect(page.locator('[data-challenge-period="active"]')).toContainText("2026-09-09");
  await expect(page.locator('[data-challenge-period="active"]')).toContainText("2026-09-15");
  await page.getByRole("button", { name: "오늘 상태 확인·기록하기" }).click();
  await expect(page.locator('[data-scene="S07"]')).toBeVisible();
  expect(nonGetRequests).toEqual([]);

  await expect(page.getByText("오늘 상태를 저장해요.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "기록함", exact: true }).click();
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  expect(checkinRequests).toBe(1);
  expect(nonGetRequests).toEqual(["POST /api/v1/observations/challenges/active/checkins"]);
});

test("prior S03/S07 keep read navigation and its selected range without writes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setJourneyTime(page);
  const methods: string[] = [];
  const windowRequests: Array<{ startOn: string | null; endOn: string | null }> = [];
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    methods.push(request.method());
    if (url.pathname.endsWith("/window")) {
      const startOn = url.searchParams.get("start_on");
      const endOn = url.searchParams.get("end_on");
      windowRequests.push({ startOn, endOn });
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(windowWithActiveChallenge({ startOn: startOn!, endOn: endOn!, legacyObservedOn: "2026-09-01" })) });
    }
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S07&dashboard_window=prior");
  const s07 = page.locator('[data-scene="S07"]');
  await expect(page.locator('[data-today-scope="prior"]')).toContainText("오늘의 실제 기록 상태를 확인하거나 새로 남길 수 없어요.");
  await expect(page.getByText("오늘 상태 미확인", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "기록함", exact: true })).toHaveCount(0);
  await expect(page.getByText("선택한 7일의 이전 방식 기록 · 읽기 전용.", { exact: false })).toBeVisible();
  await expect(s07.getByRole("button", { name: "기록 찾아보기", exact: true })).toBeEnabled();
  await expect(s07.getByRole("button", { name: "오늘의 기록으로 돌아가기", exact: true })).toBeEnabled();
  await s07.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page).toHaveURL(/screen=S08/);
  await expect(page).toHaveURL(/dashboard_window=prior/);
  await page.goBack();
  await expect(page.locator('[data-scene="S07"]')).toBeVisible();
  await page.locator('[data-scene="S07"]').getByRole("button", { name: "오늘의 기록으로 돌아가기", exact: true }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page).toHaveURL(/dashboard_window=prior/);

  await page.goto("/?e2e=signed-in&screen=S03&dashboard_window=prior");
  await expect(page.getByRole("button", { name: "오늘의 기록으로 돌아가기", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "오늘의 기록으로 돌아가기", exact: true }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page).toHaveURL(/dashboard_window=prior/);
  expect(windowRequests).toHaveLength(2);
  expect(windowRequests.every((request) => request.startOn === "2026-08-29" && request.endOn === "2026-09-04")).toBe(true);
  await page.locator('[data-read-only-window]').getByRole("button", { name: "현재 7일 보기", exact: true }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page).not.toHaveURL(/dashboard_window=prior/);
  await expect.poll(() => windowRequests.length).toBe(3);
  expect(windowRequests[2]).toEqual({ startOn: "2026-09-05", endOn: "2026-09-11" });
  expect(methods.every((method) => method === "GET")).toBe(true);
});

for (const status of ["completed", "skipped"] as const) test(`S07 keeps today's ${status} status separate from blood pressure`, async ({ page }) => {
  await setJourneyTime(page);
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/window")) return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(windowWithActiveChallenge({ checkin: status })) });
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S07");
  await expect(page.locator('[data-today-scope="current"]')).toContainText("현재 7일 · 오늘 포함");
  await expect(page.getByText(`오늘 상태 · ${status === "completed" ? "기록함" : "건너뜀"}`, { exact: true })).toBeVisible();
  await expect(page.getByText("오늘 기록 없음", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "기록함", exact: true })).toHaveCount(0);
});

test("S06 identifies an ended challenge without offering today's status recording", async ({ page }) => {
  await setJourneyTime(page);
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/window")) return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(windowWithActiveChallenge({ endsOn: "2026-09-10" })) });
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S06");
  await expect(page.getByRole("heading", { name: "종료된 챌린지를 확인해요" })).toBeVisible();
  await expect(page.locator('[data-challenge-period="ended"]')).toContainText("종료된 챌린지");
  await expect(page.getByText("챌린지 종료", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "오늘 상태 확인·기록하기" })).toHaveCount(0);
});
