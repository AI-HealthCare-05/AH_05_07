import { expect, test, type Page, type Route } from "@playwright/test";
import { e2eSessionEventName } from "../src/lib/e2eHarness";

const headers = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const mixedWindow = {
  start_on: "2026-09-05", end_on: "2026-09-11",
  blood_pressure_observations: [
    { id: "explorer-bp-old", observed_on: "2026-09-08", period: "morning", systolic: 119, diastolic: 77 },
    { id: "explorer-bp-morning", observed_on: "2026-09-10", period: "morning", systolic: 118, diastolic: 76 },
    { id: "explorer-bp-evening", observed_on: "2026-09-10", period: "evening", systolic: 121, diastolic: 79 },
  ],
  active_challenge: { id: "explorer-active", action_id: "walk-10-minutes", starts_on: "2026-09-05", ends_on: "2026-09-11", first_checkin_on: "2026-09-10", status: "active" },
  challenge_checkins: [
    { id: "explorer-checkin-old", challenge_id: "explorer-active", observed_on: "2026-09-10", action_id: "walk-10-minutes", status: "completed" },
    { id: "explorer-checkin-new", challenge_id: "explorer-active", observed_on: "2026-09-11", action_id: "walk-10-minutes", status: "skipped" },
  ],
  challenge_events: [{ id: "explorer-legacy", observed_on: "2026-09-09", action_id: "sleep-routine", status: "skipped" }],
};
const emptyWindow = { ...mixedWindow, blood_pressure_observations: [], challenge_checkins: [], challenge_events: [], active_challenge: null };

async function reply(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, headers: { ...headers, "Access-Control-Allow-Origin": route.request().headers().origin ?? headers["Access-Control-Allow-Origin"] }, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockWindow(page: Page, body: unknown = mixedWindow) {
  const requests: string[] = [];
  await page.route("http://e2e.invalid/**", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Origin": request.headers().origin ?? headers["Access-Control-Allow-Origin"] } });
    requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    if (request.method() === "GET" && new URL(request.url()).pathname.endsWith("/window")) return reply(route, body);
    return route.abort();
  });
  return requests;
}

async function openExplorer(page: Page) {
  await page.goto("/?e2e=signed-in&screen=S08");
  await expect(page.locator(".record-explorer")).toBeVisible();
}

function rows(page: Page) { return page.locator(".record-explorer li[data-record-kind]"); }
function dateFilter(page: Page, day: number) {
  return page.getByRole("group", { name: "기록 날짜", exact: true }).getByRole("button", { name: new RegExp(`9월 ${day}일`) });
}
function eveningDetail(page: Page) {
  return page.getByRole("button", { name: /상세 보기 · 혈압 관찰 · 9월 10일.*저녁/ });
}

async function storageSnapshot(page: Page) {
  return page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-11T03:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("S08 chronologically groups separate facts and combines local type and date filters without persistence or requests", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = await mockWindow(page);
  await openExplorer(page);
  const explorer = page.locator(".record-explorer");
  await expect(rows(page)).toHaveCount(6);
  expect(await rows(page).evaluateAll(elements => elements.map(element => element.getAttribute("data-record-date"))))
    .toEqual(["2026-09-11", "2026-09-10", "2026-09-10", "2026-09-10", "2026-09-09", "2026-09-08"]);
  await expect(explorer).toContainText("최신 날짜순");
  for (const label of ["전체 6개", "혈압 3개", "챌린지 2개", "이전 방식 기록 1개"]) {
    await expect(explorer.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(eveningDetail(page)).toHaveAccessibleDescription(/121\/79 mmHg.*저녁.*수정 가능/);
  await page.screenshot({ path: testInfo.outputPath("s08-desktop-1440.png"), fullPage: true });
  const url = page.url();
  const storage = await storageSnapshot(page);
  const reads = [...requests];
  const pressure = explorer.getByRole("button", { name: "혈압 3개", exact: true });
  await pressure.focus();
  await page.keyboard.press("Enter");
  await expect(pressure).toHaveAttribute("aria-pressed", "true");
  await expect(pressure).toBeFocused();
  await expect(rows(page)).toHaveCount(3);
  await expect(explorer.getByRole("status")).toHaveText("전체 6개 중 3개 표시");
  await dateFilter(page, 10).click();
  await expect(dateFilter(page, 10)).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(2);
  await expect(explorer.getByRole("status")).toHaveText("전체 6개 중 2개 표시");
  await explorer.getByRole("button", { name: "챌린지 2개", exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toHaveAttribute("data-record-kind", "challenge-checkin");
  await expect(rows(page)).toContainText("기록함");
  await explorer.getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateFilter(page, 11).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(explorer).toContainText("선택한 조건에 맞는 기록이 없어요.");
  await expect(explorer).toContainText("이 기간에는 기록이 있지만 선택한 종류나 날짜의 기록은 없어요.");
  await expect(explorer.getByRole("status")).toHaveText("전체 6개 중 0개 표시");
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
  await explorer.getByRole("button", { name: "전체 기록 보기", exact: true }).click();
  await expect(rows(page)).toHaveCount(6);
  await expect(explorer.getByRole("button", { name: "전체 6개", exact: true })).toBeFocused();
  await expect(explorer.getByRole("button", { name: "전체 6개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(explorer.getByRole("button", { name: "모든 날짜", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).toBe(url);
  expect(await storageSnapshot(page)).toEqual(storage);
  expect(requests).toEqual(reads);
});

test("S08 supports a zero-count record class and distinguishes an entirely empty window", async ({ page }) => {
  await mockWindow(page, { ...mixedWindow, challenge_events: [] });
  await openExplorer(page);
  await page.getByRole("button", { name: "이전 방식 기록 0개", exact: true }).click();
  await expect(page.locator(".record-explorer")).toContainText("선택한 조건에 맞는 기록이 없어요.");
  await expect(page.locator(".record-explorer")).not.toContainText("이 7일에는 기록이 없어요.");
  await page.unroute("http://e2e.invalid/**");
  await mockWindow(page, emptyWindow);
  await page.reload();
  await expect(page.locator(".record-explorer")).toContainText("이 7일에는 기록이 없어요.");
  await expect(page.getByRole("button", { name: "전체 기록 보기", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
});

test("S08 to S09 restores local filters and the opened row on explicit return and browser history", async ({ page }) => {
  const requests = await mockWindow(page);
  await openExplorer(page);
  await page.getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateFilter(page, 10).click();
  await eveningDetail(page).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/screen=S09&record=blood-pressure%3Aexplorer-bp-evening/);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("121/79 mmHg");
  await expect(page.getByRole("button", { name: "수정", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  await expect(eveningDetail(page)).toBeFocused();
  await expect(dateFilter(page, 10)).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(2);
  await eveningDetail(page).click();
  await page.goBack();
  await expect(eveningDetail(page)).toBeFocused();
  await expect(page.getByRole("button", { name: "혈압 3개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dateFilter(page, 10)).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("121/79 mmHg");
  await page.goBack();
  await expect(eveningDetail(page)).toBeFocused();
  expect(requests).toEqual(["GET /api/v1/observations/window"]);
});

test("S08 range changes reset discovery filters and keep prior and legacy details read-only", async ({ page }) => {
  const requests = await mockWindow(page);
  await openExplorer(page);
  await page.getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateFilter(page, 10).click();
  await page.getByRole("button", { name: "이전 7일 보기", exact: true }).click();
  await expect(page.getByRole("button", { name: "전체 6개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "모든 날짜", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-dashboard-window="prior"]')).toContainText("읽기 전용");
  await page.getByRole("button", { name: "혈압 3개", exact: true }).click();
  await eveningDetail(page).click();
  await expect(page).toHaveURL(/dashboard_window=prior/);
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("이전 7일의 기록은 읽기 전용입니다.");
  await expect(page.getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  await page.getByRole("button", { name: "현재 7일 보기", exact: true }).click();
  await page.getByRole("button", { name: "이전 방식 기록 1개", exact: true }).click();
  await expect(rows(page).getByRole("button", { name: /상세 보기/ })).toHaveAccessibleDescription(/건너뜀.*읽기 전용/);
  await rows(page).getByRole("button", { name: /상세 보기/ }).click();
  await expect(page.locator('[data-record-detail-kind="legacy"]')).toContainText("이전 방식으로 남긴 기록은 읽기 전용입니다.");
  await expect(page.getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
  expect(requests).toEqual(Array(3).fill("GET /api/v1/observations/window"));
});

test("S08 keeps filters on token refresh and clears them after logout and a new session", async ({ page }) => {
  await mockWindow(page);
  await openExplorer(page);
  await page.getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateFilter(page, 10).click();
  const session = (accessToken: string) => ({
    access_token: accessToken, refresh_token: `${accessToken}-refresh`, expires_in: 3600,
    expires_at: 1_800_000_000, token_type: "bearer",
    user: { id: "e2e-synthetic-user", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-01T00:00:00.000Z" },
  });
  const dispatch = async (detail: ReturnType<typeof session> | null) => {
    await page.evaluate(([eventName, nextSession]) => {
      window.dispatchEvent(new CustomEvent(eventName, { detail: nextSession }));
    }, [e2eSessionEventName, detail] as const);
  };
  await dispatch(session("e2e-refreshed-token"));
  await expect(page.getByRole("button", { name: "혈압 3개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dateFilter(page, 10)).toHaveAttribute("aria-pressed", "true");
  await dispatch(null);
  await expect(page.locator(".record-explorer")).toHaveCount(0);
  await dispatch(session("e2e-new-session-token"));
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page.getByRole("button", { name: "전체 6개", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "모든 날짜", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(6);
});

test("S08 and S09 identify inactive and ended challenge check-ins as read-only", async ({ page }) => {
  for (const activeChallenge of [null, { ...mixedWindow.active_challenge, ends_on: "2026-09-10" }]) {
    await mockWindow(page, { ...mixedWindow, active_challenge: activeChallenge });
    await openExplorer(page);
    await page.getByRole("button", { name: "챌린지 2개", exact: true }).click();
    const checkin = rows(page).first().getByRole("button", { name: /상세 보기/ });
    await expect(checkin).toHaveAccessibleDescription(/건너뜀.*읽기 전용/);
    await checkin.click();
    await expect(page.locator('[data-record-detail-kind="challenge-checkin"]')).toContainText("현재 활성 챌린지에 속하지 않은 기록은 읽기 전용입니다.");
    await expect(page.getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
    await page.unroute("http://e2e.invalid/**");
  }
});

test("S08 return falls back to the heading if the opened record disappears", async ({ page }) => {
  let reads = 0;
  await page.route("http://e2e.invalid/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Origin": route.request().headers().origin ?? headers["Access-Control-Allow-Origin"] } });
    reads += 1;
    return reply(route, reads === 1 ? mixedWindow : emptyWindow);
  });
  await openExplorer(page);
  await eveningDetail(page).click();
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("선택한 기록을 찾을 수 없습니다.");
  await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.locator(".record-explorer")).toContainText("이 7일에는 기록이 없어요.");
});

test("S08 loading and initial failure do not claim a zero-record window", async ({ page }) => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://e2e.invalid/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Origin": route.request().headers().origin ?? headers["Access-Control-Allow-Origin"] } });
    await pending;
    return reply(route, {}, 503);
  });
  await page.goto("/?e2e=signed-in&screen=S08");
  await expect(page.getByRole("heading", { name: "선택한 7일을 불러오는 중이에요" })).toBeVisible();
  await expect(page.locator(".record-explorer")).toHaveCount(0);
  await expect(page.getByText(/전체 0개|이 7일에는 기록이 없어요/)).toHaveCount(0);
  release?.();
  await expect(page.getByRole("alert")).toContainText("아직 기록이 없다는 뜻은 아니에요.");
  await expect(page.locator(".record-explorer")).toHaveCount(0);
  await expect(page.getByText(/전체 0개|이 7일에는 기록이 없어요/)).toHaveCount(0);
});

test("S08 retains the loaded filtered rows after an S09 refresh failure", async ({ page }) => {
  let reads = 0;
  await page.route("http://e2e.invalid/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Origin": route.request().headers().origin ?? headers["Access-Control-Allow-Origin"] } });
    reads += 1;
    return reply(route, reads === 1 ? mixedWindow : {}, reads === 1 ? 200 : 503);
  });
  await openExplorer(page);
  await page.getByRole("button", { name: "혈압 3개", exact: true }).click();
  await dateFilter(page, 10).click();
  await eveningDetail(page).click();
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("지금 보이는 기록은 그대로 유지됩니다.");
  await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator(".record-explorer").getByRole("status")).toHaveText("전체 6개 중 2개 표시");
  await expect(eveningDetail(page)).toBeFocused();
  await expect(page.getByText("선택한 조건에 맞는 기록이 없어요.")).toHaveCount(0);
});

for (const width of [320, 360, 390, 430]) {
  test(`S08/S09 reflow with keyboard-accessible controls at ${width}px and 200% text`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await mockWindow(page);
    await openExplorer(page);
    for (const enlarged of [false, true]) {
      if (enlarged) await page.addStyleTag({ content: "html { font-size: 200%; }" });
      const controls = page.locator(".record-explorer button");
      const geometry = await controls.evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { name: element.textContent, width: rect.width, height: rect.height, left: rect.left, right: rect.right };
      }));
      for (const button of geometry) {
        expect(button.height, JSON.stringify(button)).toBeGreaterThanOrEqual(44);
        expect(button.left, JSON.stringify(button)).toBeGreaterThanOrEqual(0);
        expect(button.right, JSON.stringify(button)).toBeLessThanOrEqual(width + 1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 && !enlarged) await page.screenshot({ path: testInfo.outputPath("s08-mobile-390.png"), fullPage: true });
      await page.getByRole("heading", { level: 1 }).focus();
      for (let tab = 0; tab < 24; tab += 1) {
        await page.keyboard.press("Tab");
        if (await eveningDetail(page).evaluate(element => element === document.activeElement)) break;
      }
      await expect(eveningDetail(page)).toBeFocused();
      await expect(eveningDetail(page)).toBeInViewport();
      expect(await eveningDetail(page).evaluate(element => getComputedStyle(element).outlineStyle !== "none")).toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("121/79 mmHg");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 && !enlarged) await page.screenshot({ path: testInfo.outputPath("s09-mobile-390.png"), fullPage: true });
      await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
      await expect(eveningDetail(page)).toBeFocused();
      const returnedFocus = await eveningDetail(page).evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const navigation = document.querySelector(".primary-nav")!;
        const visibleBottom = getComputedStyle(navigation).position === "fixed" ? navigation.getBoundingClientRect().top : innerHeight;
        return { top: bounds.top, bottom: bounds.bottom, visibleBottom };
      });
      expect(returnedFocus.top, JSON.stringify(returnedFocus)).toBeGreaterThanOrEqual(0);
      expect(returnedFocus.bottom, JSON.stringify(returnedFocus)).toBeLessThanOrEqual(returnedFocus.visibleBottom);
    }
  });
}
