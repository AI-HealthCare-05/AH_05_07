import { expect, test, type Page, type Route } from "@playwright/test";

import { e2eSessionEventName } from "../src/lib/e2eHarness";

const headers = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const emptyWindow = {
  start_on: "2026-09-06", end_on: "2026-09-12",
  blood_pressure_observations: [], challenge_checkins: [], challenge_events: [], active_challenge: null,
};
const records = {
  ...emptyWindow,
  blood_pressure_observations: [
    { id: "explorer-older-bp", observed_on: "2026-09-09", period: "morning", systolic: 119, diastolic: 77 },
    { id: "explorer-morning", observed_on: "2026-09-11", period: "morning", systolic: 118, diastolic: 76 },
    { id: "explorer-evening", observed_on: "2026-09-11", period: "evening", systolic: 121, diastolic: 79 },
  ],
  active_challenge: {
    id: "explorer-active", action_id: "walk-10-minutes", starts_on: "2026-09-06", ends_on: "2026-09-12",
    first_checkin_on: "2026-09-10", status: "active",
  },
  challenge_checkins: [
    { id: "explorer-checkin", challenge_id: "explorer-active", observed_on: "2026-09-10", action_id: "walk-10-minutes", status: "completed" },
    { id: "explorer-inactive", challenge_id: "explorer-previous", observed_on: "2026-09-08", action_id: "sleep-routine", status: "skipped" },
  ],
  challenge_events: [{ id: "explorer-legacy", observed_on: "2026-09-08", action_id: "sleep-routine", status: "completed" }],
};

const explorer = (page: Page) => page.locator('[data-scene="S08"]');
const rows = (page: Page) => explorer(page).locator("[data-record-kind]");
const types = (page: Page) => page.getByRole("group", { name: "기록 종류", exact: true });
const dates = (page: Page) => page.getByRole("group", { name: "기록 날짜", exact: true });
const dateButton = (page: Page, day: number) => dates(page).getByRole("button", { name: new RegExp(`9월 ${day}일`) });

async function reply(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockWindow(page: Page, body: unknown = records) {
  const requests: { method: string; path: string; search: string }[] = [];
  await page.route("http://e2e.invalid/**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    requests.push({ method: request.method(), path: url.pathname, search: url.search });
    if (url.pathname.endsWith("/window") && request.method() === "GET") return reply(route, typeof body === "function" ? body(url) : body);
    return route.abort();
  });
  return requests;
}

async function openExplorer(page: Page) {
  await page.clock.setFixedTime(new Date("2026-09-12T12:00:00+09:00"));
  await page.goto("/?e2e=signed-in&screen=S08");
  await expect(explorer(page)).toBeVisible();
}

test("chronological records retain independent facts and counts; type/date intersections stay local", async ({ page }) => {
  const requests = await mockWindow(page);
  await openExplorer(page);
  await expect(rows(page)).toHaveCount(6);
  expect(await rows(page).evaluateAll(elements => elements.map(element => element.getAttribute("data-record-date")))).toEqual([
    "2026-09-11", "2026-09-11", "2026-09-10", "2026-09-09", "2026-09-08", "2026-09-08",
  ]);
  await expect(rows(page).nth(0)).toContainText("아침");
  await expect(rows(page).nth(1)).toContainText("저녁");
  for (const label of ["전체 6개", "혈압 3개", "챌린지 2개", "이전 방식 기록 1개"]) {
    await expect(types(page).getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  const initialUrl = page.url();
  const initialStorage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  await types(page).getByRole("button", { name: "혈압 3개", exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(explorer(page).getByRole("status")).toContainText("전체 6개 중 3개 표시");
  await expect(types(page).getByRole("button", { name: "혈압 3개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dateButton(page, 11).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(explorer(page).getByRole("status")).toContainText("전체 6개 중 2개 표시");
  await expect(dateButton(page, 11)).toHaveAttribute("aria-pressed", "true");
  await expect(types(page).getByRole("button", { name: "전체 6개", exact: true })).toBeVisible();
  await types(page).getByRole("button", { name: "챌린지 2개", exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(explorer(page).getByRole("status")).toContainText("전체 6개 중 0개 표시");
  await expect(explorer(page).getByRole("status")).toHaveAttribute("aria-live", "polite");
  await expect(explorer(page).getByText("이 기간에는 기록이 있지만 선택한 조건에 맞는 기록은 없어요. 전체 기록 보기로 조건을 해제해 주세요.", { exact: true })).toBeVisible();
  await expect(explorer(page)).not.toContainText("이 기간에 남긴 기록이 없어요.");
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
  await explorer(page).getByRole("button", { name: "전체 기록 보기", exact: true }).click();
  await expect(rows(page)).toHaveCount(6);
  await expect(explorer(page).getByRole("status")).toContainText("전체 6개");
  await expect(explorer(page).getByRole("status")).not.toContainText("중");
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(initialStorage);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ method: "GET", path: "/api/v1/observations/window" });
  expect(new URLSearchParams(requests[0].search).get("start_on")).toBe("2026-09-06");
  expect(new URLSearchParams(requests[0].search).get("end_on")).toBe("2026-09-12");
});

test("a loaded window without records has its own empty state even with an active challenge", async ({ page }) => {
  await mockWindow(page, { ...emptyWindow, active_challenge: records.active_challenge });
  await openExplorer(page);
  await expect(explorer(page)).toContainText("이 기간에 남긴 기록이 없어요.");
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
  await expect(explorer(page).getByRole("button", { name: "전체 기록 보기", exact: true })).toHaveCount(0);
});

test("deleting the last matching record retains filters and focuses recovery without implying the whole window is empty", async ({ page }) => {
  let deleted = false;
  const mutations: { method: string; path: string }[] = [];
  await page.route("http://e2e.invalid/**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "GET" && url.pathname.endsWith("/window")) {
      return reply(route, {
        ...records,
        // Another type remains on this date after deleting its only check-in.
        blood_pressure_observations: records.blood_pressure_observations.map(record => record.id === "explorer-older-bp" ? { ...record, observed_on: "2026-09-10" } : record),
        challenge_checkins: records.challenge_checkins.filter(record => !deleted || record.id !== "explorer-checkin"),
      });
    }
    mutations.push({ method: request.method(), path: url.pathname });
    if (request.method() === "DELETE" && url.pathname === "/api/v1/observations/challenges/checkins/explorer-checkin") {
      deleted = true;
      return route.fulfill({ status: 204, headers });
    }
    return route.abort();
  });
  await openExplorer(page);
  await types(page).getByRole("button", { name: "챌린지 2개", exact: true }).click();
  await dateButton(page, 10).click();
  await expect(rows(page)).toHaveCount(1);
  await rows(page).getByRole("button", { name: /상세 보기/ }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  const confirmation = page.getByRole("dialog");
  await expect(confirmation).toContainText("챌린지 기록을 삭제할까요?");
  await expect(confirmation.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  expect(mutations).toEqual([]);
  await confirmation.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(explorer(page)).toBeVisible();
  await expect(types(page).getByRole("button", { name: "챌린지 1개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dateButton(page, 10)).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(0);
  await expect(explorer(page).getByRole("status")).toContainText("전체 5개 중 0개 표시");
  await expect(explorer(page).getByText("이 기간에는 기록이 있지만 선택한 조건에 맞는 기록은 없어요. 전체 기록 보기로 조건을 해제해 주세요.", { exact: true })).toBeVisible();
  await expect(explorer(page)).not.toContainText("이 기간에 남긴 기록이 없어요.");
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
  const reset = explorer(page).getByRole("button", { name: "전체 기록 보기", exact: true });
  await expect(reset).toBeFocused();
  await reset.press("Enter");
  await expect(rows(page)).toHaveCount(5);
  await expect(types(page).getByRole("button", { name: "전체 5개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dates(page).getByRole("button", { name: "모든 날짜", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(mutations).toEqual([{ method: "DELETE", path: "/api/v1/observations/challenges/checkins/explorer-checkin" }]);
});

test("detail return and browser history retain filter, date, record focus and scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests = await mockWindow(page);
  await openExplorer(page);
  await types(page).getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateButton(page, 11).click();
  const trigger = explorer(page).getByRole("button", { name: /상세 보기 · 혈압 관찰 · 9월 11일.*저녁/ });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  const originScroll = await page.evaluate(() => scrollY);
  await trigger.press("Enter");
  await expect(page).toHaveURL(/record=blood-pressure%3Aexplorer-evening/);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("121/79 mmHg");
  await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(types(page).getByRole("button", { name: "혈압 3개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dateButton(page, 11)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - originScroll)).toBeLessThanOrEqual(2);
  await trigger.press("Enter");
  await expect(page.locator('[data-scene="S09"]')).toBeVisible();
  await page.goBack();
  await expect(trigger).toBeFocused();
  await expect(rows(page)).toHaveCount(2);
  await page.goForward();
  await expect(page).toHaveURL(/record=blood-pressure%3Aexplorer-evening/);
  expect(requests).toHaveLength(1);
});

test("current records expose existing actions while legacy and inactive check-ins remain read-only", async ({ page }) => {
  const requests = await mockWindow(page);
  await openExplorer(page);
  for (const record of [
    { kind: "blood-pressure", day: "2026-09-11", editable: true },
    { kind: "challenge-checkin", day: "2026-09-10", editable: true },
    { kind: "challenge-checkin", day: "2026-09-08", editable: false },
    { kind: "legacy", day: "2026-09-08", editable: false },
  ]) {
    const row = explorer(page).locator(`[data-record-kind="${record.kind}"][data-record-date="${record.day}"]`).first();
    if (!record.editable) await expect(row).toContainText("읽기 전용");
    await row.getByRole("button", { name: /상세 보기/ }).click();
    const detail = page.locator(`[data-record-detail-kind="${record.kind}"]`);
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("button", { name: "수정", exact: true })).toHaveCount(record.editable ? 1 : 0);
    await expect(detail.getByRole("button", { name: "삭제", exact: true })).toHaveCount(record.editable ? 1 : 0);
    if (!record.editable) await expect(detail).toContainText("읽기 전용");
    await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  }
  expect(requests).toHaveLength(1);
});

test("prior range resets local filters and keeps all prior detail actions read-only", async ({ page }) => {
  const requests = await mockWindow(page, (url: URL) => {
    if (url.searchParams.get("start_on") !== "2026-08-30") return records;
    const priorDate = (date: string) => new Date(Date.parse(`${date}T12:00:00+09:00`) - 7 * 86_400_000).toISOString().slice(0, 10);
    return {
      ...records, start_on: "2026-08-30", end_on: "2026-09-05",
      blood_pressure_observations: records.blood_pressure_observations.map(record => ({ ...record, observed_on: priorDate(record.observed_on) })),
      challenge_checkins: records.challenge_checkins.map(record => ({ ...record, observed_on: priorDate(record.observed_on) })),
      challenge_events: records.challenge_events.map(record => ({ ...record, observed_on: priorDate(record.observed_on) })),
    };
  });
  await openExplorer(page);
  await types(page).getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateButton(page, 11).click();
  await page.getByRole("button", { name: "이전 7일 보기", exact: true }).click();
  await expect(types(page).getByRole("button", { name: "전체 6개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(6);
  await types(page).getByRole("button", { name: "챌린지 2개", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await rows(page).first().getByRole("button", { name: /상세 보기/ }).click();
  await expect(page).toHaveURL(/dashboard_window=prior/);
  await expect(page.locator('[data-record-detail-kind="challenge-checkin"]')).toContainText("읽기 전용");
  await expect(page.getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  await expect(types(page).getByRole("button", { name: "챌린지 2개", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(requests).toHaveLength(2);
  expect(requests.every(request => request.method === "GET")).toBe(true);
  expect(new URLSearchParams(requests[1].search).get("start_on")).toBe("2026-08-30");
  expect(new URLSearchParams(requests[1].search).get("end_on")).toBe("2026-09-05");
});

test("initial loading and request failure never present a zero-record explorer", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://e2e.invalid/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    await pending;
    return reply(route, {}, 503);
  });
  await page.goto("/?e2e=signed-in&screen=S08");
  await expect(page.getByRole("heading", { name: "선택한 7일을 불러오는 중이에요" })).toBeVisible();
  await expect(types(page)).toHaveCount(0);
  await expect(page.getByText(/전체 0개|이 기간에 남긴 기록이 없어요/)).toHaveCount(0);
  release();
  await expect(page.locator('[data-scene="S13"]')).toBeVisible();
  await expect(page.getByText(/전체 0개|이 기간에 남긴 기록이 없어요/)).toHaveCount(0);
});

test("failed refresh preserves loaded explorer records, counts and local context", async ({ page }) => {
  let reads = 0;
  await page.route("http://e2e.invalid/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    reads += 1;
    return reply(route, reads === 1 ? records : {}, reads === 1 ? 200 : 503);
  });
  await openExplorer(page);
  await types(page).getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateButton(page, 11).click();
  await rows(page).first().getByRole("button", { name: /상세 보기/ }).click();
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByText("최신 여부를 확인하지 못했어요")).toBeVisible();
  await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(types(page).getByRole("button", { name: "혈압 3개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dateButton(page, 11)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("최신 여부를 확인하지 못했어요")).toBeVisible();
  expect(reads).toBe(2);
});

test("same-account token refresh preserves filters, but another account clears explorer context", async ({ page }) => {
  const requests = await mockWindow(page);
  await openExplorer(page);
  await types(page).getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateButton(page, 11).click();
  async function changeSession(userId: string, accessToken: string) {
    await page.evaluate(([eventName, userId, accessToken]) => window.dispatchEvent(new CustomEvent(eventName, { detail: {
      access_token: accessToken, refresh_token: "synthetic-refresh", expires_in: 3600, expires_at: 1_800_000_000,
      token_type: "bearer", user: { id: userId, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-01T00:00:00Z" },
    } })), [e2eSessionEventName, userId, accessToken]);
  }
  await changeSession("e2e-synthetic-user", "explorer-refreshed-token");
  await expect(types(page).getByRole("button", { name: "혈압 3개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dateButton(page, 11)).toHaveAttribute("aria-pressed", "true");
  await changeSession("explorer-other-user", "explorer-other-token");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(types(page).getByRole("button", { name: "전체 6개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(6);
  expect(requests.every(request => request.method === "GET")).toBe(true);
});

for (const width of [320, 390, 430, 1366]) {
  test(`explorer controls and detail reflow without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockWindow(page);
    await openExplorer(page);
    if (width === 320 || width === 1366) await page.addStyleTag({ content: "html { font-size: 200%; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const filter = types(page).getByRole("button", { name: "혈압 3개", exact: true });
    await filter.focus();
    await page.keyboard.press("Enter");
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    expect(await filter.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
    for (const control of await types(page).getByRole("button").all()) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(40);
    }
    await rows(page).first().getByRole("button", { name: /상세 보기/ }).click();
    await expect(page.locator('[data-scene="S09"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
    await expect(rows(page)).toHaveCount(3);
  });
}
