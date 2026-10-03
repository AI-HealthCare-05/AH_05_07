import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { adaptProductInput, FEATURES } from "../src/lib/model-v2/adapter";
import { modelV2PresentationMode, visibleModelV2Output } from "../src/ui/modelV2VisibilityPolicy";
import { seoulDate } from "../src/lib/seoulDate";
import { assertModelPrivacy, observeModelPrivacy, startModelPrivacy } from "./model-v2-privacy";
import { chooseTime, expectTimeValue } from "./model-v2-time-wheel";

const modelFixturePath = fileURLToPath(new URL("../public/models/model-v2.json", import.meta.url));
const modelPath = "/api/v1/model-v2/product-score";
const emptyWindow = {
  start_on: "2026-09-02", end_on: "2026-09-08",
  blood_pressure_observations: [], challenge_events: [], active_challenge: null, challenge_checkins: [],
};
const intake = (page: Page) => page.locator('[data-model-v2-step="intake"]');
const result = (page: Page) => page.locator('[data-model-v2-user-result="processed"]');
const question = (page: Page, id: string) => page.locator('[data-model-v2-question="' + id + '"]');
const submit = (page: Page) => page.getByRole("button", { name: "Model V2로 분석하기", exact: true });

async function routeModel(page: Page, statuses: number[] = [200], holdFirst = false) {
  const requests: { method: string; body: string | null; url: string }[] = [];
  let settled = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    expect(path).not.toBe(modelPath);
    if (path === "/api/v1/observations/window") {
      await route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(emptyWindow) });
      return;
    }
    await route.abort();
  });
  await page.route("**/models/model-v2.json", async (route) => {
    const request = route.request();
    const index = requests.length;
    requests.push({ method: request.method(), body: request.postData(), url: request.url() });
    expect(request.method()).toBe("GET");
    expect(request.postData()).toBeNull();
    expect(await request.headerValue("authorization")).toBeNull();
    if (holdFirst && index === 0) await gate;
    const status = statuses[Math.min(index, statuses.length - 1)];
    if (status === 200) await route.fulfill({ path: modelFixturePath });
    else await route.fulfill({ status, body: "unavailable" });
    settled += 1;
  });
  return { requests, release, settled: () => settled };
}

async function openS11(page: Page, options: { guest?: boolean; instant?: string } = {}) {
  await page.clock.setFixedTime(options.instant ?? "2026-09-23T12:00:00+09:00");
  await page.goto(options.guest ? "/?guest=1&screen=S11" : "/?e2e=signed-in&screen=S11");
  await expect(intake(page)).toBeVisible();
}

async function fillStandard(page: Page, options: { age?: string; walking?: string; nonDrinking?: boolean; sameWeekend?: boolean } = {}) {
  await page.locator("#model-age").fill(options.age ?? "35");
  await page.locator("#model-sex").check();
  await page.locator("#model-height").fill("170");
  await page.locator("#model-weight").fill("68");
  await page.locator("#model-smoking-never_smoked").check();
  await page.locator("#model-alcohol-frequency").selectOption(options.nonDrinking === false ? "lt_monthly" : "none_past_year");
  if (options.nonDrinking === false) await page.locator("#model-alcohol-amount").selectOption("1_2_drinks");
  await page.locator(options.walking === "0" ? "#model-walking-days" : "#model-walking-days-4").check();
  if (options.walking !== "0") await page.locator("#model-walking-total-minutes").fill(options.walking ?? "40");
  await page.locator("#model-strength-2_days").check();
  await chooseTime(page, "model-weekday-bed", "23:30");
  await chooseTime(page, "model-weekday-wake", "07:00");
  if (options.sameWeekend === false) {
    await chooseTime(page, "model-weekend-bed", "23:30");
    await chooseTime(page, "model-weekend-wake", "08:00");
  } else {
    await page.locator("#model-weekend-same").check();
  }
}

async function changeSession(page: Page, differentUser = false) {
  await page.evaluate((switchUser) => {
    window.dispatchEvent(new CustomEvent("sk7:e2e-session-change", {
      detail: {
        access_token: switchUser ? "e2e-synthetic-access-token-b" : "e2e-refreshed-session-token",
        refresh_token: "e2e-refreshed-session-refresh",
        expires_in: 3600,
        expires_at: 1800000000,
        token_type: "bearer",
        user: {
          id: switchUser ? "e2e-synthetic-user-b" : "e2e-synthetic-user",
          app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-01T00:00:00.000Z",
        },
      },
    }));
  }, differentUser);
}

test("Model V2 preview policy remains KST-bound and fail closed", () => {
  for (const [instant, expected] of [
    ["2026-09-16T14:59:59.999Z", "non_numeric"],
    ["2026-09-16T15:00:00.000Z", "research_preview"],
    ["2026-10-17T14:59:59.999Z", "research_preview"],
    ["2026-10-17T15:00:00.000Z", "non_numeric"],
  ] as const) {
    const date = seoulDate(new Date(instant));
    expect(modelV2PresentationMode(date)).toBe(expected);
    expect(visibleModelV2Output(0.73149, date)).toBe(expected === "research_preview" ? 0.73149 : null);
  }
  for (const value of [null, NaN, Infinity, -Infinity]) {
    expect(visibleModelV2Output(value, "2026-09-23")).toBeNull();
  }
});

test("S11 exposes exactly 11 conceptual questions immediately and focuses the first missing answer", async ({ page }) => {
  await routeModel(page);
  await openS11(page);
  const disclosure = page.locator(".model-v2-intake-disclosure > p");
  await expect(disclosure).toHaveText(
    "연구/개발 미리보기로 ‘내부 연속 출력’을 소수로 표시합니다. 확률·진단·위험등급이나 치료·예방 효과가 아닙니다.",
  );
  await expect(disclosure).not.toContainText("2026년 10월 17일");
  await expect(disclosure).not.toContainText("KST");
  await expect(page.locator("[data-model-v2-question]")).toHaveCount(11);
  await expect(page.locator(".model-v2-intake-section > header p")).toHaveCount(0);
  await expect(page.locator(".model-v2-question-number")).toHaveText(
    Array.from({ length: 11 }, (_, index) => String(index + 1).padStart(2, "0")));
  await expect(question(page, "age")).toBeVisible();
  await expect(page.getByText("0 / 11 입력 완료").first()).toBeVisible();
  await expect(page.locator(".model-v2-intake-rail .model-v2-progress-caption")).toBeVisible();
  await expect(page.locator(".model-v2-intake-rail .model-v2-privacy-note")).toHaveCount(0);
  await expect(page.locator(".model-v2-final-action > *")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "입력 시작하기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다음", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "입력 확인하기" })).toHaveCount(0);
  await expect(page.locator("#model-notice-accepted")).toHaveCount(0);
  await submit(page).click();
  await expect(page.locator("#model-age")).toBeFocused();
  await expect(page.locator("#model-v2-input-error")).toContainText("만 나이");
  await page.locator("#model-age").fill("35");
  await expect(page.locator("#model-v2-input-error")).toHaveCount(0);
  await expect(page.getByText("1 / 11 입력 완료").first()).toBeVisible();
  await expect(question(page, "age").locator(".model-v2-question-complete [aria-hidden='true']")).toHaveText("✓");
  await expect(question(page, "age").locator(".model-v2-question-complete .sr-only")).toHaveText("입력 완료");
});

test("structural answers complete their questions without redundant zeros or non-applicable selection", async ({ page }) => {
  await routeModel(page);
  await openS11(page);
  await page.locator("#model-alcohol-frequency").selectOption("none_past_year");
  await expect(question(page, "alcoholAmount")).toContainText("해당 없음 · 자동 적용");
  await expect(question(page, "alcoholAmount")).toHaveAttribute("data-complete", "true");
  await expect(page.locator("#model-alcohol-amount")).toHaveCount(0);
  await page.locator("#model-alcohol-frequency").selectOption("lt_monthly");
  await expect(question(page, "alcoholAmount")).toHaveAttribute("data-complete", "false");
  await expect(page.locator("#model-alcohol-amount")).toBeVisible();
  await page.locator("#model-walking-days").check();
  await expect(question(page, "walkingDuration")).toContainText("하루 평균 0분 · 자동 적용");
  await expect(question(page, "walkingDuration")).toHaveAttribute("data-complete", "true");
  await page.locator("#model-walking-days-4").check();
  await expect(page.locator("#model-walking-total-minutes")).toHaveValue("");
  await expect(question(page, "walkingDuration")).toHaveAttribute("data-complete", "false");
  for (const minutes of ["40", "90", "1440"]) {
    await page.locator("#model-walking-total-minutes").fill(minutes);
    await expect(question(page, "walkingDuration")).toHaveAttribute("data-complete", "true");
  }
  await expect(question(page, "walkingDuration")).toContainText("24시간 00분");
  await page.locator("#model-walking-total-minutes").fill("1441");
  await expect(question(page, "walkingDuration")).toHaveAttribute("data-complete", "false");
});

test("weekday sleep is copied only after explicit choice, then can be edited separately", async ({ page }) => {
  await routeModel(page);
  await openS11(page);
  await chooseTime(page, "model-weekday-bed", "23:30");
  await chooseTime(page, "model-weekday-wake", "07:00");
  await expect(question(page, "weekendSleep")).toHaveAttribute("data-complete", "false");
  await page.locator("#model-weekend-same").check();
  await expect(question(page, "weekendSleep")).toHaveAttribute("data-complete", "true");
  await page.locator("#model-weekend-same").uncheck();
  await expect(question(page, "weekendSleep")).toHaveAttribute("data-complete", "false");
  await chooseTime(page, "model-weekend-bed", "23:30");
  await chooseTime(page, "model-weekend-wake", "08:00");
  await expectTimeValue(page, "model-weekend-wake", "08:00");
  await page.locator("#model-weekday-bed").click();
  await expect(page.locator("#model-weekday-bed-picker")).toBeVisible();
  await page.locator("#model-weekday-bed").click();
  await expect(page.locator("#model-weekday-bed-picker")).toHaveCount(0);
  await page.locator("#model-weekday-bed").click();
  await expect(page.locator("#model-weekday-bed-picker")).toBeVisible();
});

test("successful browser-local inference shows the execution receipt and keeps summaries separate", async ({ page }) => {
  await observeModelPrivacy(page);
  const model = await routeModel(page);
  await openS11(page);
  await fillStandard(page);
  await expect(page.getByText("11 / 11 입력 완료").first()).toBeVisible();
  const before = await startModelPrivacy(page);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await expect(result(page).locator("[data-model-v2-preview-value]")).toHaveText("0.047");
  await expect(result(page).locator("#model-v2-preview-label")).toHaveText("연구/개발 미리보기 · 내부 연속 출력");
  const receipt = result(page).locator("[data-model-v2-execution-receipt]");
  await expect(receipt).toContainText("Model V2");
  await expect(receipt).toContainText("모델 입력 11 / 11 사용");
  await expect(receipt).toContainText("브라우저 계산 완료");
  await expect(receipt).not.toContainText("서버 전송");
  await expect(result(page).locator(".model-v2-local-privacy")).toHaveText(
    "이 브라우저에서 계산됨 · 분석 입력·결과 서버 전송 없음 · 저장 안 함");
  await expect(result(page).locator(".model-v2-local-privacy + .model-v2-execution-receipt")).toHaveCount(1);
  await expect(result(page).locator(".model-v2-summary-heading h3")).toHaveText("입력 내용 요약");
  await expect(result(page).locator(".model-v2-outcome-kicker")).toHaveText("모델 결과와 별도");
  await expect(result(page).locator(".model-v2-meaning-limit")).toContainText("확률·백분율");
  await expect(result(page).locator(".model-v2-result-next")).toBeVisible();
  const details = result(page).locator("details[data-model-v2-research]");
  await details.locator("summary").click();
  await expect(details).toContainText("서버 계산을 기다리지 않고 바로 끝날 수 있어요.");
  const inputs = result(page).locator("details[data-model-v2-inputs]");
  await inputs.locator("summary").click();
  await expect(inputs.locator("[data-model-v2-feature]")).toHaveCount(11);
  expect(await inputs.locator("[data-model-v2-feature]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-model-v2-feature")))).toEqual([...FEATURES]);
  const values = Object.fromEntries(await inputs.locator("[data-model-v2-feature]").evaluateAll((nodes) =>
    nodes.map((node) => [node.getAttribute("data-model-v2-feature"), node.querySelector("dd")?.textContent])));
  expect(values.walking_minutes_per_active_day).toBe("40");
  expect(values.alcohol_amount_category).toBe("none");
  expect(values.weekend_sleep_minutes).toBe(values.weekday_sleep_minutes);
  expect(model.requests).toHaveLength(1);
  expect(new URL(model.requests[0].url).pathname).toBe("/models/model-v2.json");
  expect(new URL(model.requests[0].url).search).toBe("");
  await assertModelPrivacy(page, before, true);
});

test("pending state is truthful; failure has no receipt and retries only on explicit action", async ({ page }) => {
  const model = await routeModel(page, [503, 200], true);
  await openS11(page);
  await fillStandard(page);
  await submit(page).click();
  await expect(page.locator("#model-v2-pending")).toContainText("Model V2 실행 중");
  await expect(page.locator("#model-v2-pending")).toContainText("모델 파일을 확인하고 현재 11개 입력");
  await expect(intake(page).locator('button[type="submit"]')).toBeDisabled();
  await expect(page.locator("[data-model-v2-execution-receipt]")).toHaveCount(0);
  model.release();
  await expect(page.locator("#model-v2-unavailable")).toBeVisible();
  await expect(page.locator("[data-model-v2-execution-receipt]")).toHaveCount(0);
  expect(model.requests).toHaveLength(1);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await expect(result(page).locator("[data-model-v2-execution-receipt]")).toBeVisible();
  expect(model.requests).toHaveLength(2);
});

test("age eligibility, older caution and first-invalid focus are preserved", async ({ page }) => {
  await routeModel(page);
  await openS11(page);
  await fillStandard(page, { age: "18" });
  await expect(question(page, "age")).toHaveAttribute("data-complete", "false");
  await submit(page).click();
  await expect(page.locator("#model-age")).toBeFocused();
  await expect(page.locator("#model-v2-input-error")).toContainText("만 19세");
  await page.locator("#model-age").fill("80");
  await expect(page.locator(".notice-warning").first()).toContainText("만 80세 이상");
  await page.locator("#model-weight").fill("0");
  await submit(page).click();
  await expect(page.locator("#model-weight")).toBeFocused();
  await expect(question(page, "body").locator(".model-v2-question-error")).toContainText("몸무게는 0보다 큰 값");
  await page.locator("#model-weight").fill("70");
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("만 80세 이상");
});

test("preview expiry removes the number while keeping a truthful completed run", async ({ page }) => {
  await routeModel(page);
  await openS11(page);
  await fillStandard(page);
  await submit(page).click();
  await expect(result(page).locator("[data-model-v2-preview-value]")).toBeVisible();
  await page.clock.setFixedTime("2026-10-18T00:00:01+09:00");
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await expect(result(page).locator("[data-model-v2-preview-value]")).toHaveCount(0);
  await expect(result(page).locator("[data-model-v2-execution-receipt]")).toBeVisible();
});

test("reload discards the transient intake and result; Guest uses the same local flow", async ({ page }) => {
  await routeModel(page);
  await openS11(page, { guest: true });
  await expect(page.locator('[data-guest-journey="memory-only"]')).toBeVisible();
  await fillStandard(page, { walking: "0" });
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await page.reload();
  await expect(intake(page)).toBeVisible();
  await expect(page.getByText("0 / 11 입력 완료").first()).toBeVisible();
  await expect(result(page)).toHaveCount(0);
});

test("sign-out discards a pending run without showing a stale receipt", async ({ page }) => {
  const model = await routeModel(page, [200], true);
  try {
    await openS11(page);
    await fillStandard(page);
    await submit(page).click();
    await expect(page.locator("#model-v2-pending")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("sk7:e2e-session-change", { detail: null })));
    await expect(page.locator('[data-scene="S01"]')).toBeVisible();
    model.release();
    await expect.poll(model.settled).toBe(1);
    await expect(result(page)).toHaveCount(0);
    await expect(page.locator("[data-model-v2-execution-receipt]")).toHaveCount(0);
  } finally { model.release(); }
});

test("same-user refresh keeps pending completion; account switch starts a blank intake", async ({ page }) => {
  const model = await routeModel(page, [200], true);
  try {
    await openS11(page);
    await fillStandard(page);
    await submit(page).click();
    await expect(page.locator("#model-v2-pending")).toBeVisible();
    await changeSession(page);
    model.release();
    await expect(result(page)).toBeVisible();
    await changeSession(page, true);
    await expect(page.locator('[data-scene="S12"]')).toBeVisible();
    await page.getByRole("button", { name: "AI 분석", exact: true }).click();
    await expect(intake(page)).toBeVisible();
    await expect(page.locator("#model-age")).toHaveValue("");
    await expect(page.locator("[data-model-v2-execution-receipt]")).toHaveCount(0);
    expect(model.requests).toHaveLength(1);
  } finally { model.release(); }
});

for (const width of [1366, 768, 390, 320]) {
  test("intake remains usable without horizontal overflow at " + width + "px", async ({ page }) => {
    await routeModel(page);
    await page.setViewportSize({ width, height: 800 });
    await openS11(page);
    await expect(question(page, "age")).toBeVisible();
    await expect(question(page, "weekendSleep")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    if (width === 320) {
      const choices = await page.locator(".model-v2-choice").evaluateAll((nodes) => nodes.map((node) => ({
        fontSize: Number.parseFloat(getComputedStyle(node).fontSize), height: node.getBoundingClientRect().height,
      })));
      expect(choices.length).toBeGreaterThan(0);
      expect(Math.min(...choices.map((choice) => choice.fontSize))).toBeGreaterThanOrEqual(14);
      expect(Math.min(...choices.map((choice) => choice.height))).toBeGreaterThanOrEqual(44);
    }
  });
}

test("200% text, forced colors and reduced motion retain keyboard access", async ({ page }) => {
  await routeModel(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await openS11(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.locator("#model-age").focus();
  await page.keyboard.type("35");
  await expect(page.locator("#model-age")).toHaveValue("35");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the 11 questions still feed the frozen adapter in exact order", () => {
  const product = {
    age_years: 35, sex_knhanes: 1 as const, height_cm: 170, weight_kg: 68,
    cigarette_smoking_state: "never_smoked", alcohol_frequency: "none_past_year",
    alcohol_amount_category: "none", walking_days_7d: 0, walking_active_day_hours: 0,
    walking_active_day_minutes: 0, strength_days_7d: "2_days",
    weekday_bed_hour: 23, weekday_bed_minute: 30, weekday_wake_hour: 7, weekday_wake_minute: 0,
    weekend_bed_hour: 23, weekend_bed_minute: 30, weekend_wake_hour: 7, weekend_wake_minute: 0,
  };
  expect(Object.keys(adaptProductInput(product))).toEqual([...FEATURES]);
});

test("S11 hour detent carries AM/PM across the real 11-to-12 boundary", async ({ page }) => {
  await routeModel(page);
  await openS11(page);

  const id = "model-weekday-bed";
  await page.locator(`#${id}`).click();

  const picker = page.locator(`#${id}-picker`);
  const periodGroup = picker.getByRole("radiogroup", { name: "평일 취침 시간 오전 또는 오후" });
  const morning = periodGroup.getByRole("radio", { name: "오전", exact: true });
  const afternoon = periodGroup.getByRole("radio", { name: "오후", exact: true });
  const hourWheel = picker.getByRole("spinbutton", { name: "평일 취침 시간 시" });

  await morning.click();
  await hourWheel.getByRole("button", { name: "11시", exact: true }).click();
  await expect(morning).toHaveAttribute("aria-checked", "true");

  // 11 AM -> 12 PM crosses the meridiem boundary.
  await hourWheel.press("ArrowDown");
  await expect(hourWheel).toHaveAttribute("aria-valuetext", "12시");
  await expect(afternoon).toHaveAttribute("aria-checked", "true");

  // 12 PM -> 1 PM does not cross the meridiem boundary.
  await hourWheel.press("ArrowDown");
  await expect(hourWheel).toHaveAttribute("aria-valuetext", "1시");
  await expect(afternoon).toHaveAttribute("aria-checked", "true");

  // Reverse: 1 PM -> 12 PM stays PM, then 12 PM -> 11 AM flips.
  await hourWheel.press("ArrowUp");
  await expect(hourWheel).toHaveAttribute("aria-valuetext", "12시");
  await expect(afternoon).toHaveAttribute("aria-checked", "true");

  await hourWheel.press("ArrowUp");
  await expect(hourWheel).toHaveAttribute("aria-valuetext", "11시");
  await expect(morning).toHaveAttribute("aria-checked", "true");
});

test("S11 minute detent stays exact, wraps 59-to-00, and supports five-minute keyboard jumps", async ({ page }) => {
  await routeModel(page);
  await openS11(page);

  const id = "model-weekday-bed";
  await page.locator(`#${id}`).click();

  const picker = page.locator(`#${id}-picker`);
  const periodGroup = picker.getByRole("radiogroup", { name: "평일 취침 시간 오전 또는 오후" });
  const hourWheel = picker.getByRole("spinbutton", { name: "평일 취침 시간 시" });
  const minuteWheel = picker.getByRole("spinbutton", { name: "평일 취침 시간 분" });

  await periodGroup.getByRole("radio", { name: "오전", exact: true }).click();

  // The hour detent renders only the five slots around its current value.
  // Set 7시 through the already-tested keyboard detent path instead of
  // searching for a non-rendered distant hour button.
  await hourWheel.focus();
  await hourWheel.press("Home");
  for (let current = 1; current < 7; current += 1) {
    await hourWheel.press("ArrowDown");
  }
  await expect(hourWheel).toHaveAttribute("aria-valuetext", "7시");

  await minuteWheel.press("Home");
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "00분");
  await expectTimeValue(page, id, "07:00");

  await minuteWheel.press("ArrowDown");
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "01분");
  await expectTimeValue(page, id, "07:01");

  await minuteWheel.press("PageDown");
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "06분");
  await expectTimeValue(page, id, "07:06");

  await minuteWheel.press("End");
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "59분");
  await expectTimeValue(page, id, "07:59");

  await minuteWheel.press("ArrowDown");
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "00분");
  await expectTimeValue(page, id, "07:00");

  await minuteWheel.getByRole("button", { name: "02분", exact: true }).click();
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "02분");
  await expectTimeValue(page, id, "07:02");
});

test("S11 minute detent uses bounded 1-2-3 acceleration and still lands exactly", async ({ page }) => {
  await routeModel(page);
  await openS11(page);

  const id = "model-weekday-bed";
  await page.locator(`#${id}`).click();

  const picker = page.locator(`#${id}-picker`);
  const periodGroup = picker.getByRole("radiogroup", { name: "평일 취침 시간 오전 또는 오후" });
  const hourWheel = picker.getByRole("spinbutton", { name: "평일 취침 시간 시" });
  const minuteWheel = picker.getByRole("spinbutton", { name: "평일 취침 시간 분" });

  await periodGroup.getByRole("radio", { name: "오전", exact: true }).click();
  await hourWheel.focus();
  await hourWheel.press("Home");
  await expect(hourWheel).toHaveAttribute("aria-valuetext", "1시");

  await minuteWheel.focus();
  await minuteWheel.press("Home");
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "00분");

  const wheel = async (deltaY: number) => {
    await minuteWheel.evaluate((element, delta) => {
      element.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        deltaY: delta,
      }));
    }, deltaY);
    await page.waitForTimeout(60);
  };

  await wheel(40);
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "01분");

  await wheel(90);
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "03분");

  await wheel(180);
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "06분");
  await expectTimeValue(page, id, "01:06");

  await wheel(-180);
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "03분");

  await wheel(-90);
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "01분");

  await wheel(-40);
  await expect(minuteWheel).toHaveAttribute("aria-valuetext", "00분");
  await expectTimeValue(page, id, "01:00");
});


test("S11 time wheel detent keeps detent presentation after native touch tap", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium CDP is required for native touch input.");
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; SK7-E2E) AppleWebKit/537.36 Chrome/144 Mobile Safari/537.36",
  });
  const mobilePage = await context.newPage();
  const cdp = await context.newCDPSession(mobilePage);

  const touchTap = async (target: Locator) => {
    const box = await target.boundingBox();
    if (!box) throw new Error("The mobile control has no touch geometry.");
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ ...point, radiusX: 12, radiusY: 12 }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };

  try {
    await routeModel(mobilePage);
    await openS11(mobilePage);

    const id = "model-weekday-bed";
    await chooseTime(mobilePage, id, "07:00");
    await expectTimeValue(mobilePage, id, "07:00");

    const trigger = mobilePage.locator(`#${id}`);
    await touchTap(trigger);
    await expect(mobilePage.locator(`#${id}-picker`)).toHaveCount(0);
    await touchTap(trigger);
    const picker = mobilePage.locator(`#${id}-picker`);
    await expect(picker).toBeVisible();

    const minuteWheel = picker.getByRole("spinbutton", { name: "평일 취침 시간 분" });
    const zeroMinute = minuteWheel.getByRole("button", { name: "00분", exact: true });
    await expect(zeroMinute).toBeVisible();

    const beforeStyle = await zeroMinute.evaluate((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow, transform: style.transform };
    });

    await touchTap(zeroMinute);

    const afterStyle = await zeroMinute.evaluate((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow, transform: style.transform };
    });

    expect(afterStyle).toEqual(beforeStyle);
    await expectTimeValue(mobilePage, id, "07:00");

    // 59<->00 wrap and 11<->12 carry remain unchanged by the hover guard.
    await minuteWheel.press("End");
    await expect(minuteWheel).toHaveAttribute("aria-valuetext", "59분");
    await minuteWheel.press("ArrowDown");
    await expect(minuteWheel).toHaveAttribute("aria-valuetext", "00분");
    await expectTimeValue(mobilePage, id, "07:00");

    const hourWheel = picker.getByRole("spinbutton", { name: "평일 취침 시간 시" });
    await hourWheel.focus();
    await hourWheel.press("Home");
    for (let current = 1; current < 11; current += 1) await hourWheel.press("ArrowDown");
    await expect(hourWheel).toHaveAttribute("aria-valuetext", "11시");
    await hourWheel.press("ArrowDown");
    await expect(hourWheel).toHaveAttribute("aria-valuetext", "12시");
    const afternoon = picker.getByRole("radio", { name: "오후", exact: true });
    await expect(afternoon).toHaveAttribute("aria-checked", "true");
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("#934 complete transient inputs expose pre-run provenance before exactly one local execution", async ({ page }) => {
  await observeModelPrivacy(page);
  const model = await routeModel(page);
  await openS11(page);

  const review = page.locator("[data-model-v2-preflight-review]");
  await expect(review).toHaveCount(0);

  await fillStandard(page, { walking: "0" });
  await expect(page.getByText("11 / 11 입력 완료").first()).toBeVisible();
  await expect(review).toBeVisible();
  await expect(review.locator("[data-model-v2-review-item]")).toHaveCount(11);
  await expect(review.getByRole("heading", { name: "분석 전에 입력 내용을 확인해 주세요" })).toBeVisible();
  await expect(review).toContainText("아직 Model V2를 실행하지 않았어요");

  const alcoholAmount = review.locator('[data-model-v2-review-item="alcoholAmount"]');
  await expect(alcoholAmount).toHaveAttribute("data-review-source", "automatic");
  await expect(alcoholAmount).toContainText("해당 없음 · 자동 적용");

  const walkingDuration = review.locator('[data-model-v2-review-item="walkingDuration"]');
  await expect(walkingDuration).toHaveAttribute("data-review-source", "automatic");
  await expect(walkingDuration).toContainText("0분 · 자동 적용");

  const weekendSleep = review.locator('[data-model-v2-review-item="weekendSleep"]');
  await expect(weekendSleep).toHaveAttribute("data-review-source", "automatic");
  await expect(weekendSleep).toContainText("평일과 같음 · 자동 적용");

  await expect(review.locator('[data-model-v2-review-item="body"]')).toContainText("170 cm · 68 kg");
  await expect(review).not.toContainText(/확률|백분율|백분위|위험등급|진단|정상\/비정상/);

  expect(model.requests).toHaveLength(0);
  const before = await startModelPrivacy(page);

  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(model.requests).toHaveLength(1);
  expect(new URL(model.requests[0].url).pathname).toBe("/models/model-v2.json");
  await expect(result(page).locator("[data-model-v2-execution-receipt]"))
    .toContainText("모델 입력 11 / 11 사용");
  await assertModelPrivacy(page, before, true);
});

test("#934 pre-run review is a live projection of the draft and never becomes stale copied state", async ({ page }) => {
  const model = await routeModel(page);
  await openS11(page);
  await fillStandard(page, { nonDrinking: false, sameWeekend: true });

  const review = page.locator("[data-model-v2-preflight-review]");
  await expect(review).toBeVisible();
  expect(model.requests).toHaveLength(0);

  await expect(review.locator('[data-model-v2-review-item="age"]')).toContainText("35 세");
  await page.locator("#model-age").fill("36");
  await expect(review.locator('[data-model-v2-review-item="age"]')).toContainText("36 세");
  await expect(review.locator('[data-model-v2-review-item="age"]')).not.toContainText("35 세");

  const alcoholAmount = review.locator('[data-model-v2-review-item="alcoholAmount"]');
  await expect(alcoholAmount).toHaveAttribute("data-review-source", "entered");
  await expect(alcoholAmount).toContainText("1~2잔");
  await page.locator("#model-alcohol-frequency").selectOption("none_past_year");
  await expect(alcoholAmount).toHaveAttribute("data-review-source", "automatic");
  await expect(alcoholAmount).toContainText("해당 없음 · 자동 적용");

  await page.locator("#model-weekend-same").uncheck();
  await expect(review).toHaveCount(0);
  await chooseTime(page, "model-weekend-bed", "22:45");
  await chooseTime(page, "model-weekend-wake", "08:15");
  await expect(review).toBeVisible();

  const weekendSleep = review.locator('[data-model-v2-review-item="weekendSleep"]');
  await expect(weekendSleep).toHaveAttribute("data-review-source", "entered");
  await expect(weekendSleep).toContainText("오후 10:45 → 오전 8:15");
  await expect(weekendSleep).not.toContainText("자동 적용");

  expect(model.requests).toHaveLength(0);
});

test("#934 Guest pre-run review stays transient and reflows at actual 200-percent text", async ({ page }) => {
  const model = await routeModel(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await openS11(page, { guest: true });
  await fillStandard(page);

  const review = page.locator("[data-model-v2-preflight-review]");
  await expect(review).toBeVisible();
  expect(model.requests).toHaveLength(0);

  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await review.scrollIntoViewIfNeeded();

  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
  await expect(review).toHaveCSS("border-left-style", "solid");

  const submitButton = submit(page);
  await page.locator("#model-weekend-same").scrollIntoViewIfNeeded();
  await page.locator("#model-weekend-same").focus();
  await page.keyboard.press("Tab");
  await expect(submitButton).toBeFocused();

  expect(model.requests).toHaveLength(0);

  await page.reload();
  await expect(intake(page)).toBeVisible();
  await expect(page.getByText("0 / 11 입력 완료").first()).toBeVisible();
  await expect(page.locator("[data-model-v2-preflight-review]")).toHaveCount(0);
  expect(model.requests).toHaveLength(0);
});
