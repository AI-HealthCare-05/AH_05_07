import { expect, test, type Page } from "@playwright/test";
import { e2eSessionEventName } from "../src/lib/e2eHarness";

// Synthetic fetch boundary; real decoder, 8-second deadline, session effects,
// request invalidation and recovery UI run in the browser.
type Failure = "network" | "timeout" | "body-timeout" | "invalid-json" | "body-type-error" | number;
type Step = { responseStatus?: number; failure?: Failure; hold?: boolean; measurement?: number };
type Call = { method: string; path: string; token: string; endOn: string | null };
type Harness = { sessionReady: boolean; calls: Call[]; aborted: number[]; release: (index: number) => void };
async function mockTransport(page: Page, steps: Step[], otherFailure: Failure = 503) {
  await page.addInitScript(({ steps, otherFailure, sessionEvent }) => {
    const nativeFetch = window.fetch.bind(window);
    const calls: Call[] = [], aborted: number[] = [], releases: (() => void)[] = [];
    const harness = { calls, aborted, sessionReady: false, release: (index: number) => releases[index]() };
    Object.assign(window, { bootstrapHarness: harness });
    const nativeAddEventListener = window.addEventListener.bind(window);
    window.addEventListener = (...args: Parameters<typeof window.addEventListener>) => {
      nativeAddEventListener(...args);
      if (args[0] === sessionEvent) harness.sessionReady = true;
    };
    let reads = 0;
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
      if (url.origin !== "http://e2e.invalid") return nativeFetch(input, init);
      const index = calls.length;
      calls.push({ method: init?.method ?? "GET", path: url.pathname, token: new Headers(init?.headers).get("Authorization") ?? "", endOn: url.searchParams.get("end_on") });
      const step = url.pathname === "/api/v1/observations/window" ? steps[reads++] ?? { failure: 503 } : { failure: otherFailure };
      const signal = init?.signal;
      signal?.addEventListener("abort", () => aborted.push(index), { once: true });
      if (step.hold) await new Promise<void>(resolve => { releases[index] = resolve; });
      if (step.failure === "network") throw new TypeError("Synthetic fetch rejection");
      if (step.failure === "timeout") return new Promise<Response>((_, reject) => {
        const abort = () => reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });
      if (step.failure === "body-timeout") return new Response(new ReadableStream({ start(controller) {
        const abort = () => controller.error(signal?.reason ?? new DOMException("Aborted", "AbortError"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      } }), { status: step.responseStatus ?? 200 });
      if (step.failure === "body-type-error") return new Response(new ReadableStream({ start(controller) { controller.error(new TypeError("Synthetic body failure")); } }));
      // Gateways need not return the API's JSON envelope.
      if (typeof step.failure === "number") return new Response("<html>unavailable</html>", { status: step.failure });
      if (step.failure === "invalid-json") return new Response("invalid JSON");
      return Response.json({
        start_on: url.searchParams.get("start_on"), end_on: url.searchParams.get("end_on"),
        blood_pressure_observations: step.measurement ? [{ id: "synthetic-bp", observed_on: url.searchParams.get("end_on"), period: "morning", systolic: step.measurement, diastolic: 80 }] : [],
        active_challenge: null, challenge_checkins: [], challenge_events: [],
      });
    };
  }, { steps, otherFailure, sessionEvent: e2eSessionEventName });
}
const calls = (page: Page) => page.evaluate(() => (window as unknown as { bootstrapHarness: Harness }).bootstrapHarness.calls);
async function release(page: Page, index: number) {
  await page.evaluate(index => (window as unknown as { bootstrapHarness: Harness }).bootstrapHarness.release(index), index);
  await page.clock.runFor(50);
}
async function changeSession(page: Page, userId: string | null, token = "synthetic-refreshed") {
  // A document load is not evidence that React's auth effect has subscribed.
  await expect.poll(() => page.evaluate(() => (window as unknown as { bootstrapHarness: Harness }).bootstrapHarness.sessionReady)).toBe(true);
  await page.evaluate(({ event, userId, token }) => window.dispatchEvent(new CustomEvent(event, { detail: userId ? {
    access_token: token, refresh_token: "synthetic-refresh", expires_in: 3600, token_type: "bearer",
    user: { id: userId, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-01T00:00:00Z" },
  } : null })), { event: e2eSessionEventName, userId, token });
}
async function expectCount(page: Page, count: number) {
  await expect.poll(async () => (await calls(page)).length).toBe(count);
}
async function finishTimeout(page: Page, index: number) {
  await expectCount(page, index + 1);
  await page.clock.runFor(7_999);
  expect(await page.evaluate(() => (window as unknown as { bootstrapHarness: Harness }).bootstrapHarness.aborted)).toEqual(Array.from({ length: index }, (_, i) => i));
  await page.clock.runFor(1);
  expect(await page.evaluate(() => (window as unknown as { bootstrapHarness: Harness }).bootstrapHarness.aborted)).toContain(index);
}
const timed = (failure: Failure) => failure === "timeout" || failure === "body-timeout";
const transient: Failure[] = ["network", "timeout", "body-timeout", 502, 503, 504];
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-14T03:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-14T03:00:00Z"));
});
for (const failure of transient) {
  for (const measurement of [undefined, 123]) {
    test(`${failure}: initial failure then success reaches ${measurement ? "ready" : "empty"}`, async ({ page }) => {
      await mockTransport(page, [{ failure }, { measurement }]);
      await page.goto("/");
      await changeSession(page, "synthetic-a");
      if (timed(failure)) await finishTimeout(page, 0);
      await expect(page.locator(`[data-scene="${measurement ? "S02" : "S12"}"]`)).toBeVisible();
      await page.clock.runFor(20_000);
      const requests = await calls(page);
      expect(requests).toHaveLength(2);
      expect(requests[0]).toEqual(requests[1]);
      expect(requests.every(call => call.method === "GET" && call.path === "/api/v1/observations/window")).toBe(true);
      await expect(page.locator('[data-scene="S13"]')).toHaveCount(0);
    });
  }
  test(`${failure}: second failure ends in S13 with no third request; manual recovery stays available`, async ({ page }) => {
    await mockTransport(page, [{ failure }, { failure }, {}]);
    await page.goto("/?e2e=signed-in");
    if (timed(failure)) { await finishTimeout(page, 0); await finishTimeout(page, 1); }
    await expect(page.locator('[data-scene="S13"]')).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("아직 기록이 없다는 뜻은 아니에요.");
    await page.clock.runFor(20_000);
    await expectCount(page, 2);
    await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
    await expect(page.locator('[data-scene="S12"]')).toBeVisible();
    await expectCount(page, 3);
  });
}
for (const failure of [400, 401, 403, 404, 409, 422, 429, 500, "invalid-json", "body-type-error"] as Failure[]) {
  test(`${failure}: non-transient initial failure is not retried`, async ({ page }) => {
    await mockTransport(page, [{ failure }, {}]);
    await page.goto("/?e2e=signed-in");
    await expect(page.locator(`[data-scene="${failure === 401 ? "S01" : "S13"}"]`)).toBeVisible();
    await page.clock.runFor(20_000);
    await expectCount(page, 1);
  });
}
for (const first of [401, 503]) {
  test(`${first}: stale-token and transient failures share one retry budget`, async ({ page }) => {
    await mockTransport(page, [{ failure: first, hold: true }, { failure: first === 401 ? 503 : 401, hold: true }, {}]);
    await page.goto("/?e2e=signed-in");
    await expectCount(page, 1);
    await changeSession(page, "e2e-synthetic-user", "synthetic-token-2");
    await release(page, 0);
    await expectCount(page, 2);
    expect((await calls(page))[1].token).toBe("Bearer synthetic-token-2");
    await changeSession(page, "e2e-synthetic-user", "synthetic-token-3");
    await release(page, 1);
    await expect(page.locator('[data-scene="S13"]')).toBeVisible();
    await page.clock.runFor(20_000);
    await expectCount(page, 2);
  });
}
for (const replacement of ["account-b", "same-user-new-generation"]) {
  for (const failure of [undefined, 503, 401]) {
    test(`${replacement}: pending retry ${failure ?? "success"} cannot commit or retry after session replacement`, async ({ page }) => {
      await mockTransport(page, [{ failure: 503 }, { hold: true, failure, measurement: 123 }, { measurement: 135 }]);
      await page.goto("/?e2e=signed-in&screen=S10");
      await expectCount(page, 2);
      await changeSession(page, null);
      await expect(page.locator('[data-scene="S01"]')).toBeVisible();
      await changeSession(page, replacement === "account-b" ? "synthetic-b" : "e2e-synthetic-user", "synthetic-new-generation");
      await expect(page.locator('[data-scene="S02"]')).toBeVisible();
      await page.getByRole("button", { name: "7일 돌아보기" }).click();
      await expect(page.getByText("135/80 mmHg")).toBeVisible();
      await release(page, 1);
      await page.clock.runFor(20_000);
      await expect(page.getByText("135/80 mmHg")).toBeVisible();
      await expect(page.getByText("123/80 mmHg")).toHaveCount(0);
      await expectCount(page, 3);
    });
  }
}
test("obsolete first transient failure cannot retry after account replacement", async ({ page }) => {
  await mockTransport(page, [{ failure: 503, hold: true }, {}]);
  await page.goto("/?e2e=signed-in");
  await expectCount(page, 1);
  await changeSession(page, "synthetic-b");
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await release(page, 0);
  await page.clock.runFor(20_000);
  await expectCount(page, 2);
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
});
for (const failure of [undefined, 503]) {
  test(`Seoul rollover invalidates pending retry ${failure ?? "success"}`, async ({ page }) => {
    await page.clock.setSystemTime(new Date("2026-09-14T14:59:59Z"));
    await mockTransport(page, [{ failure: 503 }, { hold: true, failure, measurement: 123 }, { measurement: 135 }]);
    await page.goto("/?e2e=signed-in&screen=S10");
    await expectCount(page, 2);
    await page.clock.runFor(1_000);
    await expect(page.getByText("135/80 mmHg")).toBeVisible();
    await release(page, 1);
    await expect(page.getByText("135/80 mmHg")).toBeVisible();
    await expect(page.getByText("123/80 mmHg")).toHaveCount(0);
    expect((await calls(page)).map(call => call.endOn)).toEqual(["2026-09-14", "2026-09-14", "2026-09-15"]);
  });
}
test("manual recovery from S13 does not gain transient automatic retries", async ({ page }) => {
  await mockTransport(page, [{ failure: 503 }, { failure: 503 }, { failure: 503 }, {}]);
  await page.goto("/?e2e=signed-in");
  await expect(page.locator('[data-scene="S13"]')).toBeVisible();
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expectCount(page, 3);
  await expect(page.locator('[data-scene="S13"]')).toBeVisible();
  await page.clock.runFor(20_000);
  await expectCount(page, 3);
});
for (const failure of transient) {
  test(`${failure}: observation write still executes once after bootstrap recovery`, async ({ page }) => {
    await mockTransport(page, [{ failure: 503 }, { measurement: 123 }], failure);
    await page.goto("/?e2e=signed-in&screen=S04");
    await page.getByLabel(/수축기/).fill("125");
    await page.getByLabel(/이완기/).fill("82");
    await page.getByRole("button", { name: "혈압 기록 저장" }).click();
    await expectCount(page, 3);
    if (timed(failure)) await page.clock.runFor(8_000);
    await expect(page.getByText("저장 여부를 확인하지 못했어요. 자동으로 다시 보내지 않았습니다. 기록을 새로고침해 확인해 주세요.")).toBeVisible();
    await page.clock.runFor(20_000);
    expect((await calls(page)).filter(call => call.method !== "GET")).toEqual([
      { method: "POST", path: "/api/v1/observations/blood-pressure", token: "Bearer e2e-synthetic-access-token", endOn: null },
    ]);
    await expectCount(page, 3);
  });
}

async function historyWindow(page: Page, windowName: "prior" | "current") {
  await page.evaluate(windowName => {
    const url = new URL(location.href);
    url.searchParams.set("screen", "S10");
    url.searchParams.set("dashboard_window", windowName);
    history.pushState(history.state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, windowName);
}
for (const failure of [undefined, 503]) {
  test(`window A to B to A invalidates pending retry ${failure ?? "success"}`, async ({ page }) => {
    await mockTransport(page, [{ failure: 503 }, { hold: true, failure, measurement: 123 }, { measurement: 135 }, { measurement: 145 }]);
    await page.goto("/?e2e=signed-in&screen=S10");
    await expectCount(page, 2);
    await historyWindow(page, "prior");
    await expect(page.getByText("135/80 mmHg")).toBeVisible();
    await historyWindow(page, "current");
    await expect(page.getByText("145/80 mmHg")).toBeVisible();
    await release(page, 1);
    await expect(page.getByText("145/80 mmHg")).toBeVisible();
    await expect(page.getByText("123/80 mmHg")).toHaveCount(0);
    expect((await calls(page)).map(call => call.endOn)).toEqual(["2026-09-14", "2026-09-14", "2026-09-07", "2026-09-14"]);
  });
}
test("subsequent window selection receives no transient retry even when it clears window data", async ({ page }) => {
  await mockTransport(page, [{ measurement: 123 }, { failure: 503 }, {}]);
  await page.goto("/?e2e=signed-in&screen=S10");
  await expect(page.getByText("123/80 mmHg")).toBeVisible();
  await historyWindow(page, "prior");
  await expect(page.locator('[data-scene="S13"]')).toBeVisible();
  await page.clock.runFor(20_000);
  await expectCount(page, 2);
});
for (const operation of ["export", "challenge", "delete-record"] as const) {
  test(`${operation}: transient failure after bootstrap recovery is not retried`, async ({ page }) => {
    await mockTransport(page, [{ failure: 503 }, { measurement: 123 }], "network");
    await page.goto(`/?e2e=signed-in&screen=${operation === "challenge" ? "S03" : "S10"}`);
    if (operation === "export") {
      await page.getByRole("button", { name: "현재 7일 내보내기" }).click();
      await expect(page.getByRole("status")).toContainText("파일을 내려받지 못했습니다.");
    } else if (operation === "challenge") {
      await page.getByRole("button", { name: /10분 걷기/ }).click();
      await expect(page.getByRole("status")).toContainText("저장 여부를 확인하지 못했어요.");
    } else {
      await page.getByRole("button", { name: "상세 보기" }).click();
      await page.getByRole("button", { name: "삭제", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText("삭제 여부를 확인하지 못했습니다.");
    }
    await page.clock.runFor(20_000);
    await expectCount(page, 3);
    const last = (await calls(page))[2];
    expect([last.method, last.path]).toEqual(operation === "export"
      ? ["GET", "/api/v1/observations/export"] : operation === "challenge"
        ? ["POST", "/api/v1/observations/challenges/active"] : ["DELETE", "/api/v1/observations/blood-pressure/synthetic-bp"]);
  });
}

for (const responseStatus of [400, 401, 403, 404, 409, 422, 429, 500]) {
  test(`${responseStatus}: a stalled error body does not turn an ordinary HTTP failure into a retriable timeout`, async ({ page }) => {
    await mockTransport(page, [{ failure: "body-timeout", responseStatus }, {}]);
    await page.goto("/?e2e=signed-in");
    await finishTimeout(page, 0);
    await expect(page.locator('[data-scene="S13"]')).toBeVisible();
    await page.clock.runFor(20_000);
    await expectCount(page, 1);
  });
}
test("503 with a stalled error body retains its bounded transient recovery", async ({ page }) => {
  await mockTransport(page, [{ failure: "body-timeout", responseStatus: 503 }, {}]);
  await page.goto("/?e2e=signed-in");
  await finishTimeout(page, 0);
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await expectCount(page, 2);
});
