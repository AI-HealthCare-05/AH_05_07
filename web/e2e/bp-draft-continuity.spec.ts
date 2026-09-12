import { expect, test, type Page, type Request } from "@playwright/test";
import { e2eSessionEventName } from "../src/lib/e2eHarness";
import { emptyBloodPressureDraft, isMeaningfulBloodPressureDraft } from "../src/components/useNewBloodPressureDraft";

const today = "2026-09-12";
const restoredCopy = "작성 중인 기록을 이어서 보여드리고 있어요.";
const accountA = {
  access_token: "e2e-synthetic-access-token", refresh_token: "e2e-synthetic-refresh-token",
  expires_in: 3600, expires_at: 1_800_000_000, token_type: "bearer",
  user: { id: "e2e-synthetic-user", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-01T00:00:00Z" },
};
const accountB = { ...accountA, access_token: "e2e-account-b-token", user: { ...accountA.user, id: "e2e-account-b" } };
const record = { id: "synthetic-existing", observed_on: today, period: "morning", systolic: 120, diastolic: 80 };
const sampleDraft = { observedOn: "2026-09-11", period: "evening", systolic: "137", diastolic: "87" };
type Reply = { status?: number; body?: unknown };

async function mockApi(page: Page, write?: (request: Request) => Promise<Reply>, existing = false) {
  const writes: Request[] = [];
  const reads: string[] = [];
  await page.route("**://e2e.invalid/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-supabase-api-version",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/api/v1/observations/window") {
      reads.push(url.search);
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify({
        start_on: url.searchParams.get("start_on"), end_on: url.searchParams.get("end_on"),
        blood_pressure_observations: existing ? [record] : [], active_challenge: null, challenge_checkins: [], challenge_events: [],
      }) });
    }
    writes.push(request);
    const reply = await write?.(request) ?? { status: 201, body: { id: "synthetic-created", ...request.postDataJSON() } };
    await route.fulfill({ status: reply.status ?? 200, headers, contentType: "application/json", body: reply.status === 204 ? undefined : JSON.stringify(reply.body ?? {}) }).catch(() => undefined);
  });
  return { writes, reads };
}

async function dispatchSession(page: Page, session: unknown) {
  await page.evaluate(({ eventName, session }) => window.dispatchEvent(new CustomEvent(eventName, { detail: session })), { eventName: e2eSessionEventName, session });
}
async function enter(page: Page) {
  await page.goto("/?e2e=signed-in&screen=S04");
  await expect(page.locator("#systolic")).toBeEnabled();
}
async function fillDraft(page: Page) {
  await page.locator("#observed-on").fill(sampleDraft.observedOn);
  await page.locator("#period").selectOption(sampleDraft.period);
  await page.locator("#systolic").fill(sampleDraft.systolic);
  await page.locator("#diastolic").fill(sampleDraft.diastolic);
}
async function expectDraft(page: Page) {
  await expect(page.locator("#observed-on")).toHaveValue(sampleDraft.observedOn);
  await expect(page.locator("#period")).toHaveValue(sampleDraft.period);
  await expect(page.locator("#systolic")).toHaveValue(sampleDraft.systolic);
  await expect(page.locator("#diastolic")).toHaveValue(sampleDraft.diastolic);
}
async function expectFresh(page: Page, date = today) {
  await expect(page.locator("#observed-on")).toHaveValue(date);
  await expect(page.locator("#period")).toHaveValue("morning");
  await expect(page.locator("#systolic")).toHaveValue("");
  await expect(page.locator("#diastolic")).toHaveValue("");
  await expect(page.getByText(restoredCopy)).toHaveCount(0);
}
async function leaveAndReturn(page: Page) {
  await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await page.locator('[data-scene="S02"], [data-scene="S12"]').getByRole("button", { name: /혈압 기록하기|혈압 관찰/ }).first().click();
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
}
async function openEdit(page: Page) {
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await page.locator('[data-record-kind="blood-pressure"]').getByRole("button", { name: "상세 보기" }).click();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await expect(page.getByRole("heading", { name: "혈압 기록 수정" })).toBeVisible();
}
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test.use({ timezoneId: "America/Los_Angeles", reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(`${today}T12:00:00+09:00`)); });

test("meaningful includes date-only and period-only edits, but excludes all initial defaults", () => {
  const fresh = emptyBloodPressureDraft(today);
  expect(isMeaningfulBloodPressureDraft(fresh, today)).toBe(false);
  for (const edit of [{ observedOn: "2026-09-11" }, { period: "evening" as const }, { systolic: "1" }, { diastolic: "0" }]) {
    expect(isMeaningfulBloodPressureDraft({ ...fresh, ...edit }, today)).toBe(true);
  }
});

test("new draft survives primary/secondary navigation and Back/Forward without requests or focus theft", async ({ page }) => {
  const api = await mockApi(page);
  await enter(page);
  await fillDraft(page);
  await expect(page.getByText(restoredCopy)).toHaveCount(0);
  const readCount = api.reads.length;
  await leaveAndReturn(page);
  await expectDraft(page);
  await expect(page.locator('.bp-draft-note [role="status"]')).toHaveText(restoredCopy);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.goBack();
  await page.goForward();
  await expectDraft(page);
  await page.locator("#systolic").focus();
  await page.locator("#systolic").fill("138");
  await expect(page.locator("#systolic")).toBeFocused();
  await expect(page.locator('.bp-draft-note [role="status"]')).toHaveCount(1);
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await page.goBack();
  await expect(page.locator("#systolic")).toHaveValue("138");
  expect(api.reads).toHaveLength(readCount);
  expect(api.writes).toHaveLength(0);
});

test("defaults and reverted edits are not labeled restored", async ({ page }) => {
  await mockApi(page);
  await enter(page);
  await leaveAndReturn(page);
  await expectFresh(page);
  await page.locator("#period").selectOption("evening");
  await leaveAndReturn(page);
  await expect(page.getByText(restoredCopy)).toBeVisible();
  await page.locator("#period").selectOption("morning");
  await leaveAndReturn(page);
  await expectFresh(page);
});

test("confirmed POST alone clears new draft; pending navigation does not", async ({ page }) => {
  const pending = deferred();
  const api = await mockApi(page, async request => {
    await pending.promise;
    return { status: 201, body: { id: "synthetic-created", ...request.postDataJSON() } };
  });
  await enter(page);
  await fillDraft(page);
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect.poll(() => api.writes.length).toBe(1);
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await page.goBack();
  await expectDraft(page);
  await page.getByText("새로 입력하기", { exact: true }).click();
  await expect(page.getByRole("button", { name: "초안 지우기" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "저장 중" })).toBeDisabled();
  pending.release();
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  await page.getByRole("button", { name: "계속 기록하기" }).click();
  await expectFresh(page);
  await page.goBack();
  await page.goBack();
  await expectFresh(page);
  expect(api.writes).toHaveLength(1);
});

for (const failure of [
  { status: 422, code: "validation_error", message: "날짜와 값의 형식을 확인한 뒤 수정해 주세요.", uncertain: false },
  { status: 409, code: "observation_conflict", message: "같은 날짜와 시간대에 이미 기록이 있습니다.", uncertain: false },
  { status: 503, code: "storage_unavailable", message: "저장 여부를 확인하지 못했어요.", uncertain: true },
]) {
  test(`${failure.status} retains values and recovery semantics across navigation without retry`, async ({ page }) => {
    const api = await mockApi(page, async () => ({ status: failure.status, body: { detail: { code: failure.code } } }));
    await enter(page);
    await fillDraft(page);
    await page.getByRole("button", { name: "혈압 기록 저장" }).click();
    await expect(page.locator(".notice")).toContainText(failure.message);
    await leaveAndReturn(page);
    await expectDraft(page);
    await expect(page.locator(".notice")).toContainText(failure.message);
    await expect(page.getByText(restoredCopy)).toBeVisible();
    await expect(page.locator('[data-scene="S05"]')).toHaveCount(0);
    if (failure.uncertain) {
      const reads = api.reads.length;
      await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
      await expect.poll(() => api.reads.length).toBe(reads + 1);
      await expectDraft(page);
      await expect(page.getByText("처리 결과 확인 필요")).toBeVisible();
    }
    expect(api.writes).toHaveLength(1);
  });
}

test("actual eight-second deadline retains draft and uncertainty after returning, without retry", async ({ page }) => {
  const pending = deferred();
  const api = await mockApi(page, async () => { await pending.promise; return { status: 201 }; });
  await enter(page);
  await fillDraft(page);
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page.getByText("처리 결과 확인 필요")).toBeVisible({ timeout: 11_000 });
  await page.goBack();
  await expectDraft(page);
  await expect(page.locator(".notice")).toContainText("자동으로 다시 보내지 않았습니다.");
  await expect(page.getByRole("button", { name: "혈압 기록 저장" })).toBeEnabled();
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expectDraft(page);
  expect(api.writes).toHaveLength(1);
  pending.release();
  await expect(page.locator('[data-scene="S05"]')).toHaveCount(0);
});

test("local validation retains fields without issuing a write", async ({ page }) => {
  const api = await mockApi(page);
  await enter(page);
  await fillDraft(page);
  await page.locator("#systolic").fill("1");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect(page.getByRole("alert")).toContainText("60에서 260");
  await leaveAndReturn(page);
  await expect(page.locator("#systolic")).toHaveValue("1");
  await expect(page.getByRole("alert")).toContainText("60에서 260");
  expect(api.writes).toHaveLength(0);
});

for (const boundary of ["logout", "signed-out", "different-user", "account-deletion"] as const) {
  test(`${boundary} clears draft before a subsequent account can enter S04`, async ({ page }) => {
    await mockApi(page, async () => ({ status: 204 }));
    await enter(page);
    await fillDraft(page);
    if (boundary === "logout") await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    if (boundary === "signed-out") await dispatchSession(page, null);
    if (boundary === "account-deletion") {
      await page.getByRole("button", { name: "설정과 도움말" }).click();
      await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "계속", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "최종 삭제", exact: true }).click();
    }
    if (boundary !== "different-user") await expect(page.locator('[data-scene="S01"]')).toBeVisible();
    await dispatchSession(page, accountB);
    await page.getByRole("button", { name: "혈압 기록하기", exact: true }).click();
    await expectFresh(page);
    await page.goBack();
    await expect(page.getByText(restoredCopy)).toHaveCount(0);
    await dispatchSession(page, accountA);
    await page.getByRole("button", { name: "혈압 기록하기", exact: true }).click();
    await expectFresh(page);
  });
}

test("same-user token refresh preserves meaningful draft on S04 and while away", async ({ page }) => {
  await mockApi(page);
  await enter(page);
  await fillDraft(page);
  await dispatchSession(page, { ...accountA, access_token: "e2e-refreshed-token-1" });
  await expectDraft(page);
  await expect(page.getByText(restoredCopy)).toHaveCount(0);
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await dispatchSession(page, { ...accountA, access_token: "e2e-refreshed-token-2" });
  await page.goBack();
  await expectDraft(page);
  await expect(page.getByText(restoredCopy)).toBeVisible();
});

test("late A save cannot clear B draft or present A success", async ({ page }) => {
  const pending = deferred();
  const api = await mockApi(page, async () => { await pending.promise; return { status: 201, body: record }; });
  await enter(page);
  await fillDraft(page);
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect.poll(() => api.writes.length).toBe(1);
  await dispatchSession(page, accountB);
  await page.getByRole("button", { name: "혈압 기록하기", exact: true }).click();
  await expectFresh(page);
  await page.locator("#systolic").fill("145");
  const finished = page.waitForEvent("requestfinished", request => request === api.writes[0]);
  pending.release();
  await finished;
  await leaveAndReturn(page);
  await expect(page.locator("#systolic")).toHaveValue("145");
  await expect(page.locator('[data-scene="S05"]')).toHaveCount(0);
  expect(api.writes).toHaveLength(1);
});

async function storageSnapshot(page: Page) {
  return page.evaluate(async () => ({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie,
    databases: (await indexedDB.databases()).map(database => database.name), history: history.state, search: location.search, hash: location.hash }));
}

test("draft never enters browser storage/history/URL; reload and a new tab start fresh", async ({ page, context }) => {
  const api = await mockApi(page);
  await enter(page);
  const before = await storageSnapshot(page);
  await fillDraft(page);
  await leaveAndReturn(page);
  expect(await storageSnapshot(page)).toEqual(before);
  expect(api.writes).toHaveLength(0);
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date(`${today}T12:00:00+09:00`));
  await mockApi(other);
  await enter(other);
  await expectFresh(other);
  await expectDraft(page);
  await other.close();
  await page.reload();
  await expectFresh(page);
});

for (const meaningful of [true, false]) {
  test(`Seoul rollover ${meaningful ? "preserves meaningful date exactly" : "updates only untouched defaults"}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${today}T23:58:00+09:00`));
    await mockApi(page);
    await enter(page);
    if (meaningful) await page.locator("#systolic").fill("137");
    await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
    await page.clock.setFixedTime(new Date("2026-09-13T00:01:00+09:00"));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await page.goBack();
    if (meaningful) {
      await expect(page.locator("#observed-on")).toHaveValue(today);
      await expect(page.locator("#systolic")).toHaveValue("137");
      await expect(page.locator("#bp-draft-date-help")).toContainText("오늘(2026-09-13)");
      await expect(page.locator("#observed-on")).toHaveAttribute("aria-describedby", "bp-draft-date-help");
    } else await expectFresh(page, "2026-09-13");
  });
}

for (const outcome of ["cancel", "save"] as const) {
  test(`existing-record edit ${outcome} stays separate from parked new draft`, async ({ page }) => {
    const api = await mockApi(page, undefined, true);
    await enter(page);
    await fillDraft(page);
    await openEdit(page);
    await expect(page.locator("#systolic")).toHaveValue("120");
    await expect(page.getByText(restoredCopy)).toHaveCount(0);
    await page.locator("#systolic").fill("123");
    await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
    await page.goBack();
    await expect(page.locator("#systolic")).toHaveValue("123");
    await expect(page.getByRole("heading", { name: "혈압 기록 수정" })).toBeVisible();
    if (outcome === "cancel") {
      await page.getByRole("button", { name: "수정 취소" }).click();
      await expect(page.locator('[data-scene="S09"]')).toBeVisible();
      await leaveAndReturn(page);
      expect(api.writes).toHaveLength(0);
    } else {
      await page.getByRole("button", { name: "변경 저장" }).click();
      await expect(page.locator('[data-scene="S05"]')).toBeVisible();
      await page.getByRole("button", { name: "계속 기록하기" }).click();
      expect(api.writes).toHaveLength(1);
      expect(api.writes[0].method()).toBe("PUT");
      expect(api.writes[0].postDataJSON()).toMatchObject({ observed_on: today, period: "morning", systolic: 123, diastolic: 80 });
    }
    await expectDraft(page);
    await expect(page.getByText(restoredCopy)).toBeVisible();
  });
}

test("uncertain new write keeps its recovery action after an unrelated edit succeeds", async ({ page }) => {
  const api = await mockApi(page, async request => request.method() === "POST" ? { status: 503 } : { status: 200, body: record }, true);
  await enter(page);
  await fillDraft(page);
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect(page.getByText("처리 결과 확인 필요")).toBeVisible();
  await openEdit(page);
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  await page.getByRole("button", { name: "계속 기록하기" }).click();
  await expectDraft(page);
  await expect(page.getByText("처리 결과 확인 필요")).toBeVisible();
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expectDraft(page);
  expect(api.writes.map(request => request.method())).toEqual(["POST", "PUT"]);
});

test("discard requires an explicit expanded action, resets defaults and preserves uncertain recovery", async ({ page }) => {
  const api = await mockApi(page, async () => ({ status: 503 }));
  await enter(page);
  await fillDraft(page);
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect(page.getByText("처리 결과 확인 필요")).toBeVisible();
  await leaveAndReturn(page);
  await expect(page.getByRole("button", { name: "초안 지우기" })).not.toBeVisible();
  await page.getByText("새로 입력하기", { exact: true }).click();
  await expect(page.locator(".bp-draft-reset")).toContainText("저장된 기록에는 영향을 주지 않아요.");
  await page.getByRole("button", { name: "초안 지우기" }).click();
  await expectFresh(page);
  await expect(page.locator("#observed-on")).toBeFocused();
  await expect(page.getByText("처리 결과 확인 필요")).toBeVisible();
  expect(api.writes).toHaveLength(1);
});

for (const width of [320, 390, 430]) {
  test(`restored form reflows at ${width}px and 200% root text`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await mockApi(page);
    await enter(page);
    await fillDraft(page);
    await leaveAndReturn(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expectDraft(page);
    await expect(page.getByText(restoredCopy)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const form = page.locator(".measurement-panel");
    const fields = form.locator("input, select, button[type=submit]");
    for (const field of await fields.all()) {
      await field.scrollIntoViewIfNeeded();
      await expect(field).toBeInViewport();
      expect(await field.evaluate(element => { const bounds = element.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; })).toBe(true);
    }
    for (const input of await form.locator('input[type="number"]').all()) {
      expect(await input.evaluate(element => {
        const field = element as HTMLInputElement;
        const style = getComputedStyle(field);
        const context = document.createElement("canvas").getContext("2d")!;
        context.font = style.font;
        const textWidth = context.measureText(field.value).width + (parseFloat(style.letterSpacing) || 0) * field.value.length;
        return textWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 16 <= field.clientWidth;
      })).toBe(true);
    }
    await page.locator(".bp-draft-note").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`draft-${width}-200.png`), fullPage: true });
  });
}
