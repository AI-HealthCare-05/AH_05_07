import { expect, test, type Page, type Request } from "@playwright/test";

import type { ObservationWindow } from "../src/lib/api-contract";
import { e2eSessionEventName } from "../src/lib/e2eHarness";

const beforeMidnight = new Date("2026-09-13T14:59:59Z"); // Sunday in Seoul, morning in LA.
const oldBounds = { start_on: "2026-09-07", end_on: "2026-09-13" };
const newBounds = { start_on: "2026-09-08", end_on: "2026-09-14" };
type Read = { bounds: typeof oldBounds; token: string; request: Request };
type Reply = { status?: number; body?: unknown };

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

function observationWindow(bounds: typeof oldBounds, systolic = 120): ObservationWindow {
  return {
    ...bounds,
    blood_pressure_observations: [{ id: "synthetic-bp", observed_on: bounds.end_on, period: "morning", systolic, diastolic: 80 }],
    active_challenge: null, challenge_checkins: [], challenge_events: [],
  };
}

async function mockApi(page: Page, options: {
  read?: (read: Read, index: number) => Promise<Reply>;
  write?: (request: Request) => Promise<Reply>;
} = {}) {
  const reads: Read[] = [];
  const writes: Request[] = [];
  await page.route("http://e2e.invalid/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    let reply: Reply;
    if (url.pathname === "/api/v1/observations/window") {
      const read = { bounds: { start_on: url.searchParams.get("start_on")!, end_on: url.searchParams.get("end_on")! }, token: request.headers().authorization, request };
      reads.push(read);
      reply = await options.read?.(read, reads.length) ?? { body: observationWindow(read.bounds) };
    } else if (request.method() === "POST") {
      writes.push(request);
      reply = await options.write?.(request) ?? { body: { id: "synthetic-created", ...request.postDataJSON() } };
    } else return route.abort();
    return route.fulfill({ status: reply.status ?? 200, headers, contentType: "application/json", body: JSON.stringify(reply.body ?? {}) });
  });
  return { reads, writes };
}

async function expectHome(page: Page, day: number, recipe: string) {
  const date = `2026-09-${String(day).padStart(2, "0")}`;
  const home = page.locator('[data-scene="S02"]');
  await expect(home.locator(`time[datetime="${date}"]`).first()).toBeVisible();
  await expect(home.locator('[data-living-scene="S02"]')).toHaveAttribute("data-scene-date", date);
  await expect(home.locator('[data-living-scene="S02"]')).toHaveAttribute("data-scene-recipe", `s02-${recipe}`);
}

async function visibility(page: Page, state: "hidden" | "visible") {
  await page.evaluate(value => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

async function pageshow(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
}

async function dispatchSession(page: Page, userId: string, accessToken: string) {
  // The browser harness is build-gated; this event contains synthetic values only.
  await page.evaluate(({ eventName, userId, accessToken }) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail: {
      access_token: accessToken, refresh_token: `${accessToken}-refresh`, expires_in: 3600,
      expires_at: 1_800_000_000, token_type: "bearer",
      user: { id: userId, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-01T00:00:00Z" },
    } }));
  }, { eventName: e2eSessionEventName, userId, accessToken });
}

async function finishRequest(page: Page, request: Request, release: () => void) {
  const finished = page.waitForEvent("requestfinished", { predicate: candidate => candidate === request });
  release();
  await finished;
  // Allow fetch body parsing and React's scheduled commit before checking absence.
  await page.clock.runFor(50);
}

test.use({ timezoneId: "America/Los_Angeles", reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-13T14:59:50Z") });
  await page.clock.pauseAt(beforeMidnight);
});

test("Seoul midnight advances HTML, S02 and bounds together without a Sunday reward", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/?e2e=signed-in&screen=S02");
  await expectHome(page, 13, "sunset-overlook");
  await page.evaluate(() => {
    const samples: string[] = [];
    Object.assign(window, { dateSceneSamples: samples });
    new MutationObserver(() => {
      const scene = document.querySelector('[data-living-scene="S02"]');
      const day = scene?.getAttribute("data-scene-date");
      const recipe = scene?.getAttribute("data-scene-recipe");
      if (day && recipe) samples.push(`${day}|${recipe}`);
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await page.clock.runFor(999);
  await expectHome(page, 13, "sunset-overlook");
  await page.clock.runFor(1);
  await expectHome(page, 14, "garden-gate");
  await expect.poll(() => api.reads.length).toBe(2);
  expect(api.reads.map(read => read.bounds)).toEqual([oldBounds, newBounds]);
  const samples = await page.evaluate(() => (window as unknown as { dateSceneSamples: string[] }).dateSceneSamples);
  expect(samples.length).toBeGreaterThan(0);
  expect(samples.every(sample => sample.startsWith("2026-09-13|") ? sample.endsWith("sunset-overlook") : sample === "2026-09-14|s02-garden-gate")).toBe(true);
  expect(api.writes).toHaveLength(0);
  await expect(page.locator('[data-scene="S05"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="오늘의 별도 기록 상태"]')).toContainText("혈압 관찰1건");
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await expectHome(page, 15, "herb-garden");
  await expect.poll(() => api.reads.length).toBe(3);
  expect(api.reads[2].bounds).toEqual({ start_on: "2026-09-09", end_on: "2026-09-15" });
});

test("active WebGL scene replaces its weekday canvas at midnight with HTML still usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setSystemTime(new Date("2026-09-13T14:59:30Z"));
  await mockApi(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?e2e=signed-in&screen=S02");
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  const expectReady = async () => {
    await expect.poll(async () => {
      // Let React's lazy/Suspense work run under the paused browser clock.
      await page.clock.runFor(100);
      return page.locator("[data-living-scene-status]").getAttribute("data-living-scene-status");
    }, { timeout: 20000 }).toBe("ready");
  };
  await expectReady();
  await expectHome(page, 13, "sunset-overlook");
  await page.locator(".living-three-scene canvas").evaluate(canvas => canvas.setAttribute("data-old-canvas", "true"));
  await page.clock.fastForward(await page.evaluate(() => Date.parse("2026-09-13T15:00:00Z") - Date.now()));
  await expectHome(page, 14, "garden-gate");
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expectReady();
  await expect(page.locator("[data-old-canvas]")).toHaveCount(0);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
  await page.locator('[data-home-destination="S04"]').click();
  await expect(page.getByRole("button", { name: "혈압 기록 저장" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const event of ["visibilitychange", "pageshow"] as const) {
  test(`${event} catches up after suspended timers and does not duplicate same-day reads`, async ({ page }) => {
    const api = await mockApi(page);
    await page.goto("/?e2e=signed-in&screen=S02");
    await expectHome(page, 13, "sunset-overlook");
    await visibility(page, "hidden");
    await page.clock.setSystemTime(new Date("2026-09-16T03:00:00Z"));
    await expectHome(page, 13, "sunset-overlook");
    const wake = () => event === "pageshow" ? pageshow(page) : visibility(page, "visible");
    await wake();
    await expectHome(page, 16, "shade-tree");
    await expect.poll(() => api.reads.length).toBe(2);
    expect(api.reads[1].bounds).toEqual({ start_on: "2026-09-10", end_on: "2026-09-16" });
    await wake();
    await page.clock.runFor(1000);
    expect(api.reads).toHaveLength(2);
  });
}

for (const [from, to] of [["2026-12-31", "2027-01-01"], ["2028-02-28", "2028-02-29"]]) {
  test(`midnight calendar arithmetic handles ${to} outside the Seoul timezone`, async ({ page }) => {
    await page.clock.setSystemTime(new Date(`${from}T23:59:59+09:00`));
    const api = await mockApi(page);
    await page.goto("/?e2e=signed-in&screen=S10");
    await expect(page.locator('[data-scene="S10"]')).toBeVisible();
    await page.clock.runFor(1000);
    await expect.poll(() => api.reads.length).toBe(2);
    expect(api.reads[1].bounds.end_on).toBe(to);
  });
}

test("fixed evidence asOf ignores midnight and page recovery", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/?fixture=VP-10&screen=S02");
  await expectHome(page, 3, "footbridge");
  await page.clock.runFor(1000);
  await page.clock.setSystemTime(new Date("2026-09-16T03:00:00Z"));
  await visibility(page, "visible");
  await pageshow(page);
  await expectHome(page, 3, "footbridge");
  expect(api.reads).toHaveLength(0);
});

for (const draft of ["blood-pressure", "model-v2"] as const) {
  test(`${draft} draft stays mounted during midnight refresh and a load failure`, async ({ page }) => {
    const gate = deferred();
    const api = await mockApi(page, { read: async (read, index) => {
      if (index === 1) return { body: observationWindow(read.bounds) };
      await gate.promise;
      return { status: 503 };
    } });
    await page.goto(`/?e2e=signed-in&screen=${draft === "blood-pressure" ? "S04" : "S11"}`);
    if (draft === "blood-pressure") {
      await page.getByLabel("날짜", { exact: true }).fill("2026-09-12");
      await page.getByLabel("시간대").selectOption("evening");
      await page.getByLabel(/수축기/).fill("125");
      await page.getByLabel(/이완기/).fill("82");
    } else {
      await page.getByRole("button", { name: "입력 시작하기" }).click();
      await page.getByLabel("나이").fill("35");
      await page.getByLabel("성별", { exact: true }).selectOption("1");
      await page.getByLabel(/키/).fill("170");
      await page.getByLabel(/몸무게/).fill("68");
      await page.getByRole("button", { name: "다음", exact: true }).click();
      await page.getByLabel("흡연 상태").selectOption("never_smoked");
      await page.getByLabel("음주 빈도").selectOption("lt_monthly");
      await page.getByLabel("한 번 마실 때 음주량").selectOption("1_2_drinks");
      await page.getByRole("button", { name: "다음", exact: true }).click();
      await page.getByLabel("최근 7일 걷기 일수").fill("4");
      await page.locator("#model-walking-hours").fill("0");
      await page.locator("#model-walking-minutes").fill("40");
      await page.getByLabel("최근 7일 근력운동").selectOption("2_days");
      await page.getByRole("button", { name: "다음", exact: true }).click();
      await page.locator("#model-weekday-bed").fill("23:30");
      await page.locator("#model-weekday-wake").fill("07:00");
      await page.locator("#model-weekend-bed").fill("23:30");
      await page.locator("#model-weekend-wake").fill("08:00");
      await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
      await page.getByLabel("위 안내를 확인했습니다.").check();
      await page.getByRole("button", { name: "기본 정보 수정", exact: true }).click();
    }
    const field = draft === "blood-pressure" ? page.getByLabel(/수축기/) : page.getByLabel("나이");
    await field.evaluate(element => element.setAttribute("data-draft-node", "original"));
    await page.clock.runFor(1000);
    await expect.poll(() => api.reads.length).toBe(2);
    await expect(field).toHaveAttribute("data-draft-node", "original");
    await finishRequest(page, api.reads[1].request, gate.release);
    await expect(page.getByText("최신 여부를 확인하지 못했어요")).toBeVisible();
    await expect(field).toHaveAttribute("data-draft-node", "original");
    if (draft === "blood-pressure") {
      await expect(page.getByLabel("날짜", { exact: true })).toHaveValue("2026-09-12");
      await expect(page.getByLabel("시간대")).toHaveValue("evening");
      await expect(field).toHaveValue("125");
      await expect(page.getByLabel(/이완기/)).toHaveValue("82");
    } else {
      await expect(field).toHaveValue("35");
      await expect(page.getByLabel(/키/)).toHaveValue("170");
      await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
      await expect(page.getByLabel("위 안내를 확인했습니다.")).toBeChecked();
    }
    expect(api.writes).toHaveLength(0);
  });
}

for (const status of [200, 401, 503]) {
  test(`pre-midnight window response ${status} cannot overwrite the new window or session`, async ({ page }) => {
    const gate = deferred();
    const api = await mockApi(page, { read: async (read, index) => {
      if (index === 1) {
        await gate.promise;
        return { status, body: status === 200 ? observationWindow(read.bounds, 199) : { detail: { code: status === 401 ? "supabase_session_invalid" : "storage_unavailable" } } };
      }
      return { body: observationWindow(read.bounds, 121) };
    } });
    await page.goto("/?e2e=signed-in&screen=S10");
    await expect.poll(() => api.reads.length).toBe(1);
    await page.clock.runFor(1000);
    await expect(page.getByText("121/80 mmHg")).toBeVisible();
    await finishRequest(page, api.reads[0].request, gate.release);
    await expect(page.getByText("121/80 mmHg")).toBeVisible();
    await expect(page.getByText("199/80 mmHg")).toHaveCount(0);
    await expect(page.locator('[data-scene="S01"], [data-scene="S13"], .notice-warning')).toHaveCount(0);
    expect(api.reads.map(read => read.bounds)).toEqual([oldBounds, newBounds]);
  });
}

test("late save keeps its payload date but refreshes current bounds with the newest token", async ({ page }) => {
  const gate = deferred();
  const api = await mockApi(page, { write: async request => {
    await gate.promise;
    return { body: { id: "synthetic-saved", ...request.postDataJSON() } };
  } });
  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("125");
  await page.getByLabel(/이완기/).fill("82");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect.poll(() => api.writes.length).toBe(1);
  await page.clock.runFor(1000);
  await expect.poll(() => api.reads.length).toBe(2);
  await dispatchSession(page, "e2e-synthetic-user", "synthetic-new-token");
  await expect.poll(() => api.reads.length).toBe(3);
  await finishRequest(page, api.writes[0], gate.release);
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  expect(api.writes[0].postDataJSON()).toEqual({ observed_on: "2026-09-13", period: "morning", systolic: 125, diastolic: 82 });
  expect(api.writes).toHaveLength(1);
  expect(api.reads.map(read => read.bounds)).toEqual([oldBounds, newBounds, newBounds, newBounds]);
  expect(api.reads[3].token).toBe("Bearer synthetic-new-token");
  await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await expectHome(page, 14, "garden-gate");
  await page.locator('[data-home-destination="S04"]').click();
  await expect(page.getByLabel("날짜", { exact: true })).toHaveValue("2026-09-14");
  await expect(page.getByLabel(/수축기/)).toHaveValue("");
});

test("prior window rollover and back navigation reject a late request for the same bounds", async ({ page }) => {
  const gate = deferred();
  const api = await mockApi(page, { read: async (read, index) => {
    if (index === 2) { await gate.promise; return { body: observationWindow(read.bounds, 199) }; }
    return { body: observationWindow(read.bounds, 121) };
  } });
  await page.goto("/?e2e=signed-in&screen=S10&dashboard_window=prior");
  await expect(page.getByText("121/80 mmHg")).toBeVisible();
  await page.clock.runFor(1000);
  await expect.poll(() => api.reads.length).toBe(2);
  expect(api.reads[1].bounds).toEqual({ start_on: "2026-09-01", end_on: "2026-09-07" });
  await page.getByRole("button", { name: "현재 7일 보기" }).click();
  await expect(page.getByText("121/80 mmHg")).toBeVisible();
  await page.goBack();
  await expect(page.locator("[data-dashboard-window]")).toHaveAttribute("data-dashboard-window", "prior");
  await expect.poll(() => api.reads.length).toBe(4);
  expect(api.reads[3].bounds).toEqual(api.reads[1].bounds);
  await finishRequest(page, api.reads[1].request, gate.release);
  await expect(page.getByText("199/80 mmHg")).toHaveCount(0);
  await expect(page.getByText("121/80 mmHg")).toBeVisible();
});

test("post-midnight account change resets drafts to the current date and rejects old save completion", async ({ page }) => {
  const gate = deferred();
  const api = await mockApi(page, { write: async () => { await gate.promise; return { body: { id: "synthetic-old-account" } }; } });
  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("125");
  await page.getByLabel(/이완기/).fill("82");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect.poll(() => api.writes.length).toBe(1);
  await page.clock.runFor(1000);
  await expect.poll(() => api.reads.length).toBe(2);
  await dispatchSession(page, "synthetic-account-b", "synthetic-token-b");
  await expectHome(page, 14, "garden-gate");
  await expect.poll(() => api.reads.length).toBe(3);
  await finishRequest(page, api.writes[0], gate.release);
  await expectHome(page, 14, "garden-gate");
  expect(api.reads).toHaveLength(3);
  await page.locator('[data-home-destination="S04"]').click();
  await expect(page.getByLabel("날짜", { exact: true })).toHaveValue("2026-09-14");
  await expect(page.getByLabel(/수축기/)).toHaveValue("");
});
