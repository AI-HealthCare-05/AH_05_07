import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { resolveModelV2Continuation, type ModelV2ContinuationState } from "../src/components/modelV2Continuation";
import { expect, test, type Page } from "@playwright/test";
import { adaptProductInput, FEATURES } from "../src/lib/model-v2/adapter";
import { modelV2PresentationMode, visibleModelV2Output } from "../src/ui/modelV2VisibilityPolicy";
import { seoulDate } from "../src/lib/seoulDate";
import { assertModelPrivacy, observeModelPrivacy, startModelPrivacy } from "./model-v2-privacy";
import { chooseMinuteByKeyboard, chooseTime, expectTimeValue } from "./model-v2-time-wheel";

const emptyWindow = {
  start_on: "2026-09-02",
  end_on: "2026-09-08",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};
const modelPath = "/api/v1/model-v2/product-score";
const modelFixturePath = fileURLToPath(new URL("../public/models/model-v2.json", import.meta.url));
const timeInputs = [
  ["model-weekday-bed", "23:30"],
  ["model-weekday-wake", "07:00"],
  ["model-weekend-bed", "23:30"],
  ["model-weekend-wake", "08:00"],
] as const;

test("Model V2 presentation policy is KST-bound, transient and fail closed", () => {
  for (const [instant, expected] of [
    ["2026-09-16T14:59:59.999Z", "non_numeric"],
    ["2026-09-16T15:00:00.000Z", "research_preview"],
    ["2026-10-17T14:59:59.999Z", "research_preview"],
    ["2026-10-17T15:00:00.000Z", "non_numeric"],
  ] as const) {
    const kstDate = seoulDate(new Date(instant));
    expect(modelV2PresentationMode(kstDate)).toBe(expected);
    expect(visibleModelV2Output(0.73149, kstDate)).toBe(expected === "research_preview" ? 0.73149 : null);
  }
  for (const invalid of ["", "2026-9-17", "2026-09-31", "2026-09-17extra", "not-a-date"]) {
    expect(modelV2PresentationMode(invalid)).toBe("non_numeric");
    expect(visibleModelV2Output(0.73149, invalid)).toBeNull();
  }
  for (const output of [null, NaN, Infinity, -Infinity]) {
    expect(visibleModelV2Output(output, "2026-09-17")).toBeNull();
  }
});

test("S11 continuation accepts only explicit app facts and is independent of numeric visibility", () => {
  const source = readFileSync(new URL("../src/components/modelV2Continuation.ts", import.meta.url), "utf8");
  expect(source).toContain("resolveModelV2Continuation(state: ModelV2ContinuationState)");
  expect(source).not.toMatch(/\b(import|previewOutput|draft|features|localStorage|sessionStorage|indexedDB|fetch)\b/);
  for (const bloodPressure of ["missing", "exists"] as const) {
    for (const challenge of ["none", "ended", "active_pending", "active_recorded"] as const) {
      const state: ModelV2ContinuationState = { freshness: "confirmed", bloodPressure, challenge };
      const expectedKey = bloodPressure === "missing" ? "record-blood-pressure"
        : challenge === "active_pending" ? "record-challenge" : "review-today";
      const expected = resolveModelV2Continuation(state);
      expect(expected.key).toBe(expectedKey);
      expect(expected.destination).toBe(bloodPressure === "missing" ? "S04" : "S07");
      // The display value is a separate fact; it is never an argument to the resolver.
      for (const previewOutput of [0.123, 0.731, 0.999, null]) {
        const outcome = { previewOutput, continuation: resolveModelV2Continuation(state) };
        expect(outcome.continuation).toEqual(expected);
      }
    }
  }
  expect(resolveModelV2Continuation({ freshness: "retained_or_unconfirmed" })).toMatchObject({
    key: "confirm-today", destination: "S02", actionLabel: "오늘 화면에서 확인하기",
  });
});

type Step = "intro" | "basics" | "habits" | "activity" | "sleep" | "review";
const stepTitles = {
  basics: "기본 정보", activity: "최근 7일 활동", sleep: "평일·주말 수면", habits: "흡연·음주", review: "입력 확인",
};

async function routeModel(page: Page, options: { statuses?: number[]; holdFirst?: boolean; skipClock?: boolean } = {}) {
  if (!options.skipClock) await page.clock.setFixedTime("2026-09-17T12:00:00+09:00");
  const requests: { method: string; body: string | null }[] = [];
  let settled = 0;
  let releaseFirst!: () => void;
  const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const statuses = options.statuses ?? [200];
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
    };
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204, headers }); return; }
    // Any feature-bearing server inference is a regression, including fallback.
    expect(url.pathname).not.toBe(modelPath);
    if (url.pathname === "/api/v1/observations/window") {
      await route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(emptyWindow) });
      return;
    }
    await route.abort();
  });
  await page.route("**/models/model-v2.json", async (route) => {
    const request = route.request();
    const index = requests.length;
    requests.push({ method: request.method(), body: request.postData() });
    expect(request.method()).toBe("GET");
    expect(request.postData()).toBeNull();
    expect(await request.headerValue("authorization")).toBeNull();
    if (options.holdFirst && index === 0) await firstPending;
    try {
      const status = statuses[Math.min(index, statuses.length - 1)];
      if (status === 200) await route.fulfill({ path: modelFixturePath });
      else await route.fulfill({ status, body: "unavailable" });
    } finally { settled += 1; }
  });
  return { requests, releaseFirst, settled: () => settled };
}

const step = (page: Page, value: Step) => page.locator(`[data-model-v2-step="${value}"]`);
const next = (page: Page) => page.getByRole("button", { name: "다음", exact: true });
const previous = (page: Page) => page.getByRole("button", { name: "이전", exact: true });
const submit = (page: Page) => page.getByRole("button", { name: "생활정보 분석하기", exact: true });
const result = (page: Page) => page.locator('[data-model-v2-user-result="processed"]');

async function openTechnicalDetails(page: Page) {
  const disclosure = result(page).locator("details[data-model-v2-research]");
  if (await disclosure.getAttribute("open") === null) await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
}

async function openModelInputs(page: Page) {
  const disclosure = result(page).locator("details[data-model-v2-inputs]");
  if (await disclosure.getAttribute("open") === null) await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(disclosure.locator("[data-model-v2-feature]")).toHaveCount(11);
}

async function expectStep(page: Page, value: Exclude<Step, "intro">) {
  await expect(step(page, value)).toBeVisible();
  await expect(page.locator("h2#model-v2-step-title")).toHaveText(stepTitles[value]);
  await expect(page.locator("#model-v2-step-title")).toBeFocused();
  await expect(page.locator('[aria-current="step"]')).toContainText(stepTitles[value]);
}

async function begin(page: Page) {
  await page.getByRole("button", { name: "입력 시작하기" }).click();
  await expectStep(page, "basics");
}

async function fillBasics(page: Page, age = "35") {
  await page.getByLabel("만 나이", { exact: true }).fill(age);
  await page.getByLabel("성별", { exact: true }).selectOption("1");
  await page.locator("#model-height").fill("170");
  await page.locator("#model-weight").fill("68");
}

async function fillHabits(page: Page) {
  await page.getByLabel("일반담배(궐련) 흡연 상태는 어떤가요?", { exact: true }).selectOption("never_smoked");
  await page.getByLabel("최근 1년 동안 술을 얼마나 자주 마셨나요?", { exact: true }).selectOption("lt_monthly");
  await page.getByLabel("술을 마실 때, 보통 한 번에 몇 잔 마시나요?", { exact: true }).selectOption("1_2_drinks");
}

async function fillActivity(page: Page) {
  await page.getByLabel("최근 7일 동안 걸은 날은 며칠인가요?", { exact: true }).fill("4");
  await page.locator("#model-walking-hours").fill("0");
  await page.locator("#model-walking-minutes").fill("40");
  await page.getByLabel("최근 7일 동안 근력운동을 한 날은 며칠인가요?", { exact: true }).selectOption("2_days");
}

async function fillSleep(page: Page) {
  for (const [id, value] of timeInputs) await chooseTime(page, id, value);
}

async function toSleep(page: Page, age = "35") {
  await begin(page);
  await fillBasics(page, age);
  await next(page).click();
  await expectStep(page, "activity");
  await fillActivity(page);
  await next(page).click();
  await expectStep(page, "sleep");
}

test("S11 groups walking duration and weekday/weekend clocks without inventing answers", async ({ page }) => {
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await begin(page);
  await expect(page.locator("#model-height")).toHaveAccessibleDescription("키와 몸무게는 알고 있는 측정값을 입력해 주세요.");
  await fillBasics(page);
  await next(page).click();
  await expectStep(page, "activity");
  const walking = page.getByRole("group", { name: "그중 걷는 날에는 하루 평균 얼마나 걸었나요?", exact: true });
  await expect(walking).toBeVisible();
  await expect(walking.getByLabel("시간", { exact: true })).toHaveValue("");
  await expect(walking.getByLabel("분", { exact: true })).toHaveValue("");
  await expect(walking).toContainText("걷지 않은 날은 평균에 넣지 않아요. 예를 들어 40분은 0시간 40분으로 입력해 주세요.");
  await expect(walking).toContainText("걷기 일수가 0일이면 시간과 분도 모두 0으로 입력해 주세요.");
  await expect(page.locator("#model-walking-days")).toHaveAccessibleDescription("같은 날 여러 번 걸었어도 하루로 세어 주세요.");
  await expect(page.locator('#model-strength option[value="0_days"]')).toHaveText("하지 않았어요 · 0일");
  await fillActivity(page);
  await next(page).click();
  await expectStep(page, "sleep");
  for (const [period, prefix] of [["평일", "weekday"], ["주말", "weekend"]]) {
    const group = page.getByRole("group", { name: `${period}에는 보통 몇 시에 취침하고 기상하나요?`, exact: true });
    await expect(group).toBeVisible();
    for (const part of ["bed", "wake"]) await expect(group.locator(`#model-${prefix}-${part}`)).toHaveAttribute("data-time-complete", "false");
  }
  await expect(step(page, "sleep")).toContainText("각 시각의 오전·오후를 확인해 주세요. 자정은 오전 12:00이에요.");
  await expect(step(page, "sleep")).toContainText("시간을 억지로 정하지 않아도 돼요.");
  await expect(step(page, "sleep")).toContainText("네 시각을 정하기 어려운 경우에는 이 도구를 건너뛰어도 혈압 기록과 다른 기능은 그대로 이용할 수 있어요.");
  await fillSleep(page);
  await next(page).click();
  await expectStep(page, "habits");
  await expect(next(page)).toHaveCount(0);
  await fillHabits(page);
  await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
  await expectStep(page, "review");
});

async function toHabits(page: Page, age = "35") {
  await toSleep(page, age);
  await fillSleep(page);
  await next(page).click();
  await expectStep(page, "habits");
}

async function toReview(page: Page, age = "35", consent = true) {
  await toHabits(page, age);
  await fillHabits(page);
  await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
  await expectStep(page, "review");
  if (consent) await page.getByLabel("입력과 결과가 저장되지 않는다는 안내를 확인했어요.").check();
}

async function expectErrorCleanup(page: Page) {
  await expect(page.locator("#model-v2-input-error")).toHaveCount(0);
  await expect(page.locator('[aria-describedby~="model-v2-input-error"]')).toHaveCount(0);
  expect(await page.locator("[aria-describedby]").evaluateAll((elements) =>
    elements.flatMap((element) => (element.getAttribute("aria-describedby") ?? "").split(/\s+/)
      .filter((id) => id && !document.getElementById(id))),
  )).toEqual([]);
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

async function dispatchVisibilityChange(page: Page, state: "hidden" | "visible") {
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

async function observePreviewInsertion(page: Page) {
  await page.evaluate(() => {
    new MutationObserver(mutations => {
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement && (node.matches("[data-model-v2-preview]")
          || node.querySelector("[data-model-v2-preview]"))) {
          (window as unknown as { previewInserted?: boolean }).previewInserted = true;
        }
      }
    }).observe(document.body, { subtree: true, childList: true });
  });
}

async function dispatchPageshow(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
}

async function assertFitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const controls = step(page, await page.locator("[data-model-v2-step]").getAttribute("data-model-v2-step") as Step)
    .locator("input:visible, select:visible, button:visible, summary:visible");
  for (const control of await controls.all()) {
    const geometry = await control.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, viewport: innerWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);
  }
}

async function assertResultKeyboardAccess(page: Page) {
  // macOS WebKit's native Tab skips buttons; Option+Tab includes all controls.
  // Keep the same ordered focus/viewport assertions on every platform.
  const tabKey = process.platform === "darwin" && test.info().project.use.browserName === "webkit"
    ? "Alt+Tab" : "Tab";
  await expect(page.locator("#model-v2-result-title")).toBeFocused();
  for (const name of ["혈압 기록 남기기", "오늘의 기록으로 돌아가기"]) {
    await page.keyboard.press(tabKey);
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeFocused();
    await expect(button).toBeInViewport();
  }
  const research = result(page).locator("details[data-model-v2-research]");
  await page.keyboard.press(tabKey);
  await expect(research.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(research).toHaveAttribute("open", "");
  await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();
  await expect(research).toContainText("소수점 셋째 자리 표시는 화면 표시용 반올림");
  const inputs = result(page).locator("details[data-model-v2-inputs]");
  await page.keyboard.press(tabKey);
  await expect(inputs.locator("summary")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(inputs).toHaveAttribute("open", "");
  await expect(inputs.locator("[data-model-v2-feature]")).toHaveCount(11);
  await assertFitsViewport(page);
  await page.keyboard.press("Enter");
  await expect(inputs).not.toHaveAttribute("open");
  await expect(inputs.locator("dl")).toBeHidden();
  await page.keyboard.press(`Shift+${tabKey}`);
  await expect(research.locator("summary")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(research).not.toHaveAttribute("open");
  await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();
  await assertFitsViewport(page);
}

test("S11 non-drinking frequency auto-selects and locks alcohol amount", async ({ page }) => {
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toHabits(page);

  const frequency = page.getByLabel("최근 1년 동안 술을 얼마나 자주 마셨나요?", { exact: true });
  const amount = page.getByLabel("술을 마실 때, 보통 한 번에 몇 잔 마시나요?", { exact: true });

  await frequency.selectOption("none_past_year");
  await expect(amount).toHaveValue("none");
  await expect(amount).toBeDisabled();
  await expect(amount).toHaveAccessibleDescription("음주량은 ‘해당 없음’으로 처리돼요. 따로 답하지 않아도 돼요.");

  await frequency.selectOption("lifetime_nonapplicable");
  await expect(amount).toHaveValue("none");
  await expect(amount).toBeDisabled();
  await expect(amount).toHaveAccessibleDescription("음주량은 ‘해당 없음’으로 처리돼요. 따로 답하지 않아도 돼요.");

  await frequency.selectOption("lt_monthly");
  await expect(amount).toBeEnabled();
  await expect(amount).toHaveValue("");
  await expect(amount).toHaveAccessibleDescription("보통 한 번에 마시는 양을 선택해 주세요.");
  await expect(page.locator("#model-smoking option")).toHaveText([
    "선택", "현재 매일 피워요", "현재 가끔 피워요", "전에 피웠지만 지금은 피우지 않아요", "피운 적이 없어요",
  ]);
  await expect(frequency.locator("option")).toHaveText([
    "선택", "최근 1년 동안 마시지 않았어요", "한 달에 1번 미만", "한 달에 1번 정도", "한 달에 2~4번",
    "일주일에 2~3번", "일주일에 4번 이상", "술을 마신 적이 없어요",
  ]);
});

test("S11 time picker keeps internal pointer events and closes on outside pointer", async ({ page }) => {
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);

  const id = "model-weekday-bed";
  const trigger = page.locator(`#${id}`);
  await chooseTime(page, id, "23:30");

  await expect(page.locator(`#${id}-picker`)).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expectTimeValue(page, id, "23:30");

  const nextId = "model-weekday-wake";
  const nextTrigger = page.locator(`#${nextId}`);
  await nextTrigger.click();

  await expect(page.locator(`#${id}-picker`)).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(`#${nextId}-picker`)).toBeVisible();
  await expect(nextTrigger).toHaveAttribute("aria-expanded", "true");

  await page.locator(".model-v2-step-heading").click({ position: { x: 8, y: 8 } });

  await expect(page.locator(`#${nextId}-picker`)).toHaveCount(0);
  await expect(nextTrigger).toHaveAttribute("aria-expanded", "false");
  await expectTimeValue(page, id, "23:30");
});

test("S11 requires explicit review submission and completes locally without sending transient inputs", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  const storageBefore = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  await expect(step(page, "intro")).toBeVisible();
  await expect(page.locator('[data-scene="S11"]')).toContainText("입력 기반 위험군 선별 신호");
  const intro = step(page, "intro");
  await expect(intro).toContainText("기본 정보·활동·수면·생활습관을 입력합니다.");
  await expect(intro).toContainText("이번 입력과 결과는 저장되지 않으며 화면을 나가거나 새로고침하면 사라집니다.");
  await expect(intro).toContainText("이 값은 확률·진단·위험등급이 아니며 치료·예방 효과를 뜻하지 않습니다.");
  const dataUse = intro.locator(".model-v2-notice-details");
  await expect(dataUse).not.toHaveAttribute("open");
  await expect(dataUse).toContainText("입력은 생활정보 정리와 입력 기반 위험군 선별 신호 계산에만 사용해요.");
  await expect(dataUse).toContainText("혈압 기록은 별도로 저장되며, 이 도구를 건너뛰어도 기록과 챌린지를 이용할 수 있어요.");
  await expect(page.getByRole("button", { name: "입력 시작하기", exact: true })).toBeVisible();
  await expect(page.locator("#model-v2-step-title")).toHaveText("생활정보를 입력해요");
  await expect(page.locator(".model-v2-progress li > span:nth-child(2)")).toHaveText([
    "기본 정보", "최근 7일 활동", "평일·주말 수면", "흡연·음주", "입력 확인",
  ]);
  await expect(dataUse).toContainText("질문은 기본 정보, 최근 7일 활동, 평일·주말 수면, 흡연·음주와 입력 확인으로 구성돼요.");
  await expect(page.locator("#model-age")).toHaveCount(0);
  await expect(submit(page)).toHaveCount(0);
  await toReview(page);
  await expect(step(page, "review")).toContainText("분석 전 마지막 확인");
  await expect(step(page, "review")).toContainText("입력한 내용이 맞는지 확인해 주세요. 수정한 뒤 이 화면으로 돌아올 수 있어요.");
  expect(routed.requests).toHaveLength(0);
  await expect(page.locator('.model-v2-progress li[data-complete="true"]')).toHaveCount(4);
  const review = step(page, "review");
  await expect(review.locator(".model-v2-review-group h3")).toHaveText(["기본 정보", "최근 7일 활동", "평일·주말 수면", "흡연·음주"]);
  await expect(review.locator("dt")).toHaveCount(15);
  expect(await review.locator("dt").allTextContents()).not.toEqual(expect.arrayContaining([expect.stringMatching(/인가요|어떤가요/)]));
  await expect(review).toContainText("이번 입력과 결과는 저장되지 않아요. 화면을 나가거나 새로고침하면 사라져요.");
  for (const text of ["35", "남성", "170", "68", "비흡연", "월 1회 미만", "1~2잔", "40", "오후 11:30", "오전 7:00", "오전 8:00"]) {
    await expect(review).toContainText(text);
  }
  await expect(review).not.toContainText(/BMI|체질량지수|저위험|중위험|고위험/);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests).toEqual([{ method: "GET", body: null }]);
  await expect(page.locator("#model-v2-result-title")).toHaveText("연구 모델 분석 결과");
  await expect(page.locator("#model-v2-result-title")).toBeFocused();
  await expect(result(page)).not.toHaveAttribute("role", "status");
  await expect(result(page)).not.toHaveAttribute("aria-live");
  await expect(result(page).locator('[role="status"], [aria-live]')).toHaveCount(0);
  await expect(result(page).locator("h3")).toHaveText([
    "오늘의 생활 패턴을 정리했어요", "활동", "수면", "생활 습관", "체격 참고", "다음 한 걸음", "처리 방식과 입력 상세",
  ]);
  const activity = result(page).getByRole("region", { name: "활동", exact: true });
  await expect(activity.locator("dd")).toHaveText(["4일", "40분", "약 160분", "2일"]);
  await expect(activity).toContainText("입력한 걷기 일수에 걷는 날 하루 평균 시간을 곱한 단순 계산값이에요.");
  const sleep = result(page).getByRole("region", { name: "수면", exact: true });
  await expect(sleep.locator(".model-v2-result-clock")).toHaveText(["오후 11:30 → 오전 7:00", "오후 11:30 → 오전 8:00"]);
  await expect(sleep.locator("dd").nth(0)).toContainText("7시간 30분");
  await expect(sleep.locator("dd").nth(1)).toContainText("8시간 30분");
  await expect(sleep).toContainText("주말이 평일보다 1시간 길어요.");
  await expect(sleep).toContainText("입력한 취침·기상 시각 사이의 간격이에요.");
  const habits = result(page).getByRole("region", { name: "생활 습관", exact: true });
  await expect(habits.locator("dd")).toHaveText(["비흡연", "월 1회 미만 · 한 번 1~2잔"]);
  await expect(result(page)).not.toContainText(/어떤가요|마셨나요|마시나요|권장량|건강 목표|충분|부족|과체중|비만/);
  const body = result(page).getByRole("region", { name: "체격 참고", exact: true });
  await expect(body.locator("dd")).toHaveText(["170 cm", "68 kg", "23.5"]);
  await expect(body).toContainText("입력한 키와 몸무게로 계산한 참고값이에요.");
  await expect(result(page).locator("details[data-model-v2-research]")).not.toHaveAttribute("open");
  await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();
  await expect(result(page).locator("details[data-model-v2-inputs]")).not.toHaveAttribute("open");
  await expect(result(page).getByText("모델에 사용된 입력 보기", { exact: true })).toBeVisible();
  await expect(result(page)).toContainText("이번 입력과 결과는 저장되지 않아 기록 목록에서 다시 볼 수 없어요. 화면을 나가거나 새로고침하면 사라져요.");
  const preview = result(page).locator("[data-model-v2-preview]");
  await expect(preview).toBeVisible();
  await expect(preview.locator("#model-v2-preview-label")).toHaveText("연구/개발 미리보기 · 내부 연속 출력");
  const previewValue = preview.locator("[data-model-v2-preview-value]");
  await expect(previewValue).toHaveCount(1);
  await expect(previewValue).toHaveText(/^\d\.\d{3}$/);
  // Frozen public asset + this exact synthetic survey, independently evaluated.
  await expect(previewValue).toHaveText("0.055");
  await expect(previewValue).toBeInViewport();
  expect(await previewValue.evaluate(node => node.closest("details"))).toBeNull();
  expect(await result(page).evaluate(node => {
    const value = node.querySelector("[data-model-v2-preview-value]")!;
    const summary = node.querySelector(".model-v2-summary-heading")!;
    return Boolean(value.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING)
      && value.getBoundingClientRect().bottom < summary.getBoundingClientRect().top;
  })).toBe(true);
  await expect(result(page).locator(".model-v2-local-privacy")).toBeVisible();
  await expect(result(page).locator(".model-v2-local-privacy")).toHaveText("이 브라우저에서 계산됨 · 분석 입력·결과 서버 전송 없음 · 저장 안 함");
  await expect(preview).toContainText("입력한 생활정보를 이 기기에서 Model V2가 처리해 만든 연속 출력입니다.");
  await expect(preview.locator(".model-v2-result-disclaimer")).toBeVisible();
  await expect(preview).toContainText("이 값은 확률·백분율·백분위, 진단, 정상/비정상 판정, 위험군 등급, 중증도 또는 향후 고혈압 발생 가능성을 뜻하지 않습니다. 치료·예방 효과를 뜻하지 않습니다.");
  await openTechnicalDetails(page);
  const technical = result(page).locator("details[data-model-v2-research]");
  await expect(technical).toContainText("소수점 셋째 자리 표시는 화면 표시용 반올림이며, 판단 기준이나 등급을 뜻하지 않습니다.");
  await expect(technical).toContainText("계산에 필요한 모델 파일은 네트워크에서 받을 수 있어요.");
  await technical.locator("summary").click();
  await expect(previewValue).toBeVisible();
  await expect(preview).not.toContainText("%");
  await expect(preview.locator("[data-model-v2-preview-band], .model-v2-preview-band")).toHaveCount(0);
  await expect(preview).not.toContainText(/저위험|중위험|고위험/);
  await openModelInputs(page);
  const entries = result(page).locator("[data-model-v2-feature]");
  expect(await entries.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-model-v2-feature")))).toEqual([...FEATURES]);
  await expect(entries.locator("dt code")).toHaveText([...FEATURES]);
  const canonical = adaptProductInput({
    age_years: 35, sex_knhanes: 1, height_cm: 170, weight_kg: 68,
    cigarette_smoking_state: "never_smoked", alcohol_frequency: "lt_monthly", alcohol_amount_category: "1_2_drinks",
    walking_days_7d: 4, walking_active_day_hours: 0, walking_active_day_minutes: 40, strength_days_7d: "2_days",
    weekday_bed_hour: 23, weekday_bed_minute: 30, weekday_wake_hour: 7, weekday_wake_minute: 0,
    weekend_bed_hour: 23, weekend_bed_minute: 30, weekend_wake_hour: 8, weekend_wake_minute: 0,
  });
  await expect(entries.locator("dd")).toHaveText(FEATURES.map(feature => String(canonical[feature])));
  await expect(result(page).locator('[data-model-v2-feature="bmi_from_height_weight"] dd')).not.toHaveText("23.5");
  await expect(page.getByRole("button", { name: "오늘의 기록으로 돌아가기", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "혈압 기록 남기기", exact: true })).toBeVisible();
  await expect(submit(page)).toHaveCount(0);
  await expect(page.locator('.model-v2-progress li[data-complete="true"]')).toHaveCount(5);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storageBefore);
  expect(new URL(page.url()).searchParams.toString()).toBe("e2e=signed-in&screen=S11");

  await page.getByRole("button", { name: "혈압 기록 남기기", exact: true }).click();
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await expect(result(page)).toHaveCount(0);
  await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
});

for (const example of [
  { name: "zero walking and equal sleep intervals", days: "0", hours: "0", minutes: "0", weekly: "약 0분", daily: "0분", bed: "23:30", wake: "07:00", weekendWake: "07:00", weekdayDuration: "7시간 30분", weekendDuration: "7시간 30분", comparison: "입력한 평일·주말 수면 구간의 길이가 같아요." },
  { name: "walking hours and shorter weekend interval after midnight", days: "3", hours: "1", minutes: "20", weekly: "약 240분", daily: "1시간 20분", bed: "00:30", wake: "07:00", weekendWake: "06:00", weekdayDuration: "6시간 30분", weekendDuration: "5시간 30분", comparison: "주말이 평일보다 1시간 짧아요." },
]) {
  test(`S11 result preserves arithmetic for ${example.name}`, async ({ page }) => {
    await routeModel(page);
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await page.getByRole("button", { name: "최근 7일 활동 수정", exact: true }).click();
    await page.locator("#model-walking-days").fill(example.days);
    await page.locator("#model-walking-hours").fill(example.hours);
    await page.locator("#model-walking-minutes").fill(example.minutes);
    await page.locator("#model-strength").selectOption("5_plus_days");
    await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
    await page.getByRole("button", { name: "평일·주말 수면 수정", exact: true }).click();
    for (const [id, value] of [
      ["model-weekday-bed", example.bed], ["model-weekday-wake", example.wake],
      ["model-weekend-bed", example.bed], ["model-weekend-wake", example.weekendWake],
    ]) await chooseTime(page, id, value);
    await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    await expect(result(page).getByRole("region", { name: "활동", exact: true }).locator("dd")).toHaveText([
      `${example.days}일`, example.daily, example.weekly, "5일 이상",
    ]);
    const sleep = result(page).getByRole("region", { name: "수면", exact: true });
    await expect(sleep.locator("dd").nth(0)).toContainText(example.weekdayDuration);
    await expect(sleep.locator("dd").nth(1)).toContainText(example.weekendDuration);
    await expect(sleep.locator(".model-v2-sleep-comparison")).toHaveText(example.comparison);
    await openModelInputs(page);
    await expect(result(page).locator('[data-model-v2-feature="walking_minutes_per_active_day"] dd')).toHaveText(String(Number(example.hours) * 60 + Number(example.minutes)));
    await expect(result(page).locator('[data-model-v2-feature="strength_days_7d"] dd')).toHaveText("5_plus_days");
  });
}

test.describe("S11 preview window", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  for (const { name, time, expectPreview } of [
    { name: "start minus 1 ms", time: "2026-09-16T23:59:59.999+09:00", expectPreview: false },
    { name: "exact start", time: "2026-09-17T00:00:00+09:00", expectPreview: true },
    { name: "end minus 1 ms", time: "2026-10-17T23:59:59.999+09:00", expectPreview: true },
    { name: "exclusive end", time: "2026-10-18T00:00:00+09:00", expectPreview: false },
    { name: "later date", time: "2026-10-18T12:00:00+09:00", expectPreview: false },
  ] as const) {
    test(`S11 preview obeys the inclusive KST calendar window at ${name}`, async ({ page }) => {
      await page.clock.setFixedTime(time);
      const routed = await routeModel(page, { skipClock: true });
      await page.goto("/?e2e=signed-in&screen=S11");
      await toReview(page);
      await submit(page).click();
      await expect(result(page)).toBeVisible();
      expect(routed.requests).toEqual([{ method: "GET", body: null }]);
      const preview = result(page).locator("[data-model-v2-preview]");
      const note = result(page).locator(".model-v2-outcome-heading");
      await expect(result(page).locator("details[data-model-v2-research]")).not.toHaveAttribute("open");
      if (expectPreview) {
        await expect(preview).toBeVisible();
        await expect(preview.locator("#model-v2-preview-label")).toHaveText("연구/개발 미리보기 · 내부 연속 출력");
        await expect(preview.locator("[data-model-v2-preview-value]")).toHaveText(/^\d\.\d{3}$/);
      } else {
        await expect(preview).toHaveCount(0);
        await expect(note).toContainText("현재 제품에서는 개인별 모델 점수·확률·백분율·등급을 표시하지 않아요.");
      }
      await expect(result(page).getByRole("heading", { name: "오늘의 생활 패턴을 정리했어요" })).toBeVisible();
      await expect(result(page).locator("[data-model-v2-continuation]")).toHaveAttribute("data-model-v2-continuation", "record-blood-pressure");
      await result(page).getByRole("button", { name: "혈압 기록 남기기", exact: true }).click();
      await expect(page.locator("#S04-title")).toBeFocused();
    });
  }
});

test("S11 preview expires while a completed result remains open", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-17T23:58:00+09:00") });
  const routed = await routeModel(page, { skipClock: true });
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  const preview = result(page).locator("[data-model-v2-preview]");
  await expect(preview).toBeVisible();
  expect(routed.requests).toHaveLength(1);

  await page.clock.pauseAt(new Date("2026-10-17T23:59:59+09:00"));
  await dispatchPageshow(page);
  await page.clock.runFor(999);
  await expect(preview).toBeVisible();

  await page.clock.runFor(1);
  await expect(preview).toHaveCount(0);
  await expect(result(page).locator(".model-v2-outcome-heading")).toContainText("현재 제품에서는 개인별 모델 점수·확률·백분율·등급을 표시하지 않아요.");
  expect(routed.requests).toHaveLength(1);
});

for (const event of ["visibilitychange", "pageshow"] as const) {
  test(`S11 preview expires on ${event} after jumping past the window boundary`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-17T23:58:00+09:00") });
    const routed = await routeModel(page, { skipClock: true });
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();

    await page.clock.setSystemTime(new Date("2026-10-18T00:00:01+09:00"));
    if (event === "visibilitychange") {
      await dispatchVisibilityChange(page, "hidden");
      await dispatchVisibilityChange(page, "visible");
    } else {
      await dispatchPageshow(page);
    }
    await expect(result(page).locator("[data-model-v2-preview]")).toHaveCount(0);
    await expect(result(page).locator(".model-v2-outcome-heading")).toContainText("현재 제품에서는 개인별 모델 점수·확률·백분율·등급을 표시하지 않아요.");
    expect(routed.requests).toHaveLength(1);
  });
}

test("S11 pending completion after preview expiry stays non-numeric", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-17T23:59:55+09:00") });
  const routed = await routeModel(page, { holdFirst: true, skipClock: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await observePreviewInsertion(page);
    await submit(page).click();
    await expect.poll(() => routed.requests.length).toBe(1);
    await page.clock.setSystemTime(new Date("2026-10-18T00:00:05+09:00"));
    routed.releaseFirst();
    await expect.poll(routed.settled).toBe(1);
    await expect(result(page)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { previewInserted?: boolean }).previewInserted ?? false)).toBe(false);
    await expect(result(page).locator("[data-model-v2-preview]")).toHaveCount(0);
    await expect(result(page).locator(".model-v2-outcome-heading")).toContainText("현재 제품에서는 개인별 모델 점수·확률·백분율·등급을 표시하지 않아요.");
  } finally {
    routed.releaseFirst();
  }
});

test("S11 prevents double submission and freezes review edits while analysis is pending", async ({ page }) => {
  const routed = await routeModel(page, { holdFirst: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await submit(page).dblclick();
    await expect(page.getByRole("button", { name: "생활정보 분석 중", exact: true })).toBeDisabled();
    await expect(page.getByLabel("입력과 결과가 저장되지 않는다는 안내를 확인했어요.")).toBeDisabled();
    for (const title of ["기본 정보", "최근 7일 활동", "평일·주말 수면", "흡연·음주"]) {
      await expect(page.getByRole("button", { name: `${title} 수정`, exact: true })).toBeDisabled();
    }
    expect(routed.requests).toHaveLength(1);
    routed.releaseFirst();
    await expect(result(page)).toBeVisible();
    expect(routed.requests).toHaveLength(1);
  } finally {
    routed.releaseFirst();
  }
});

test("S11 previous navigation preserves every completed step without issuing a request", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  const values = {
    basics: [["model-age", "35"], ["model-sex", "1"], ["model-height", "170"], ["model-weight", "68"]],
    activity: [["model-walking-days", "4"], ["model-walking-hours", "0"], ["model-walking-minutes", "40"], ["model-strength", "2_days"]],
    habits: [["model-smoking", "never_smoked"], ["model-alcohol-frequency", "lt_monthly"], ["model-alcohol-amount", "1_2_drinks"]],
  };
  async function expectValues(current: "basics" | "activity" | "sleep" | "habits") {
    await expectStep(page, current);
    if (current === "sleep") {
      for (const [id, value] of timeInputs) await expectTimeValue(page, id, value);
    } else {
      for (const [id, value] of values[current]) await expect(page.locator(`#${id}`)).toHaveValue(value);
    }
  }
  for (const current of ["habits", "sleep", "activity", "basics"] as const) {
    await previous(page).click();
    await expectValues(current);
  }
  for (const current of ["activity", "sleep", "habits"] as const) {
    await next(page).click();
    await expectValues(current);
  }
  await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
  await expectStep(page, "review");
  await expect(page.getByLabel("입력과 결과가 저장되지 않는다는 안내를 확인했어요.")).toBeChecked();
  expect(routed.requests).toHaveLength(0);
});

test("S11 review edits return directly to review and submit only the corrected values", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  const edits = [
    { step: "basics", title: "기본 정보", id: "model-weight", value: "69", text: "69" },
    { step: "habits", title: "흡연·음주", id: "model-smoking", value: "former_currently_not_smoking", text: "과거 흡연, 현재 금연" },
    { step: "activity", title: "최근 7일 활동", id: "model-walking-minutes", value: "45", text: "45" },
    { step: "sleep", title: "평일·주말 수면", id: "model-weekend-wake", value: "08:15", text: "오전 8:15" },
  ] as const;
  for (const edit of edits) {
    await page.getByRole("button", { name: `${edit.title} 수정`, exact: true }).click();
    await expectStep(page, edit.step);
    if (edit.step === "habits") await page.locator(`#${edit.id}`).selectOption(edit.value);
    else if (edit.step === "sleep") await chooseTime(page, edit.id, edit.value);
    else await page.locator(`#${edit.id}`).fill(edit.value);
    await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
    await expectStep(page, "review");
    await expect(step(page, "review")).toContainText(edit.text);
    expect(routed.requests).toHaveLength(0);
  }
  await page.getByLabel("입력과 결과가 저장되지 않는다는 안내를 확인했어요.").check();
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests.every(request => request.method === "GET" && request.body === null)).toBe(true);
});

test("S11 native keyboard navigation focuses each new heading and Enter in a field never advances", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await page.getByRole("button", { name: "입력 시작하기" }).focus();
  await page.keyboard.press("Enter");
  await expectStep(page, "basics");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("만 나이", { exact: true })).toBeFocused();
  await fillBasics(page);
  await page.locator("#model-weight").press("Enter");
  await expect(step(page, "basics")).toBeVisible();
  await next(page).focus();
  await page.keyboard.press("Enter");
  await expectStep(page, "activity");
  await previous(page).focus();
  await page.keyboard.press("Enter");
  await expectStep(page, "basics");
  expect(routed.requests).toHaveLength(0);
});

test("S11 validates each incomplete input step locally, focuses the control and cleans error references", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await begin(page);
  for (const [id, fill] of [
    ["model-age", () => fillBasics(page)],
    ["model-walking-days", () => fillActivity(page)],
    ["model-weekday-bed", () => fillSleep(page)],
    ["model-smoking", () => fillHabits(page)],
  ] as const) {
    await page.getByRole("button", { name: /^(다음|입력 확인하기)$/ }).click();
    const field = page.locator(`#${id}`);
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
    await expect(page.locator("form.measurement-panel")).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
    await expect(page.locator("#model-v2-input-error")).toBeVisible();
    await fill();
    await expectErrorCleanup(page);
    await page.getByRole("button", { name: /^(다음|입력 확인하기)$/ }).click();
  }
  await expectStep(page, "review");
  expect(routed.requests).toHaveLength(0);
});

test("S11 blocks under-19 input at basic information and focuses age", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await begin(page);
  await fillBasics(page, "18");
  await next(page).click();
  await expect(step(page, "basics")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("만 19세 이상");
  await expect(page.locator("#model-age")).toBeFocused();
  await expect(page.locator("#model-age")).toHaveAttribute("aria-invalid", "true");
  await page.locator("#model-age").fill("35");
  await expectErrorCleanup(page);
  await next(page).click();
  await expectStep(page, "activity");
  expect(routed.requests).toHaveLength(0);
});

test("S11 retains the age-80 applicability notice through review and visible result without blocking an eligible request", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page, "80");
  await expect(page.locator('[data-scene="S11"]')).toContainText("적용 근거가 상대적으로 약합니다");
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("적용 근거가 상대적으로 약합니다");
  await expect(result(page).locator("[data-model-v2-preview-value]")).toBeVisible();
  expect(routed.requests.every(request => request.method === "GET" && request.body === null)).toBe(true);
});

test("S11 preserves existing fractional and positive input semantics without new HTML eligibility restrictions", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page, "35.5");
  await page.getByRole("button", { name: "기본 정보 수정", exact: true }).click();
  await page.locator("#model-height").fill("0.5");
  await page.locator("#model-weight").fill("0.5");
  await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  await expectStep(page, "review");
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests.every(request => request.method === "GET" && request.body === null)).toBe(true);
});

test("S11 time wheels keep a blank draft blank until all three explicit selections are made", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);
  const id = "model-weekday-bed";
  await expect(page.locator(`#${id}`)).toContainText("시간 선택");
  await page.locator(`#${id}`).click();
  const picker = page.locator(`#${id}-picker`);
  const periodGroup = picker.getByRole("radiogroup", { name: "평일 취침 시간 오전 또는 오후" });
  await expect(periodGroup).toBeVisible();
  await expect(periodGroup.getByRole("radio", { name: "오전" })).toBeVisible();
  await expect(periodGroup.getByRole("radio", { name: "오후" })).toBeVisible();
  await expect(picker.getByRole("spinbutton", { name: "평일 취침 시간 시" })).toBeVisible();
  await expect(picker.getByRole("spinbutton", { name: "평일 취침 시간 분" })).toBeVisible();
  const afternoon = periodGroup.getByRole("radio", { name: "오후" });
  await afternoon.click();
  await expect(afternoon).toHaveAttribute("aria-checked", "true");

  const hourWheel = picker.getByRole("spinbutton", { name: "평일 취침 시간 시" });
  await hourWheel.getByRole("button", { name: "11시", exact: true }).click();
  await expect(hourWheel).toHaveAttribute("aria-valuetext", "11시");

  await expect(page.locator(`#${id}`)).toContainText("시간 선택");

  await chooseMinuteByKeyboard(page, id, 30);
  await expectTimeValue(page, id, "23:30");
  await expect(page.locator(`#${id}-status`)).toHaveText("선택 완료");
  expect(routed.requests).toHaveLength(0);
});

test("S11 time wheels support keyboard selection, exact 12-hour conversion, and local-only scoring", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);
  await page.locator("#model-weekday-bed").click();
  const periodGroup = page.locator("#model-weekday-bed-picker").getByRole("radiogroup", { name: "평일 취침 시간 오전 또는 오후" });
  const morning = periodGroup.getByRole("radio", { name: "오전", exact: true });
  await morning.focus();
  await morning.press("Space");
  await expect(morning).toHaveAttribute("aria-checked", "true");
  await morning.press("ArrowRight");
  await expect(periodGroup.getByRole("radio", { name: "오후", exact: true })).toHaveAttribute("aria-checked", "true");
  await chooseTime(page, "model-weekday-bed", "00:15");
  await chooseTime(page, "model-weekday-wake", "12:15");
  await chooseTime(page, "model-weekend-bed", "23:59");
  await chooseTime(page, "model-weekend-wake", "00:00");
  await next(page).click();
  await expectStep(page, "habits");
  await fillHabits(page);
  await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
  await expect(step(page, "review")).toContainText("오전 12:15");
  await expect(step(page, "review")).toContainText("오후 12:15");
  await expect(step(page, "review")).toContainText("오후 11:59");
  await page.getByLabel("입력과 결과가 저장되지 않는다는 안내를 확인했어요.").check();
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests.every(request => request.method === "GET" && request.body === null)).toBe(true);
});

test("S11 links missing review acknowledgement to the focused checkbox and clears the error on correction", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page, "35", false);
  await submit(page).click();
  const consent = page.getByLabel("입력과 결과가 저장되지 않는다는 안내를 확인했어요.");
  await expect(consent).toBeFocused();
  await expect(consent).toHaveAttribute("aria-invalid", "true");
  await expect(consent).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(routed.requests).toHaveLength(0);
  await consent.check();
  await expectErrorCleanup(page);
  await expect(consent).not.toHaveAttribute("aria-invalid");
});

test("S11 refuses an incomplete review edit and leaves the relevant field reachable without submitting", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await page.getByRole("button", { name: "기본 정보 수정", exact: true }).click();
  await page.locator("#model-height").fill("");
  await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  await expect(step(page, "basics")).toBeVisible();
  await expect(page.locator("#model-height")).toBeFocused();
  await expect(page.locator("#model-height")).toHaveAttribute("aria-invalid", "true");
  await expect(submit(page)).toHaveCount(0);
  expect(routed.requests).toHaveLength(0);
  await page.locator("#model-height").fill("171");
  await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  await expectStep(page, "review");
  await expect(step(page, "review")).toContainText("171");
});

test("S11 catches walking hours and normalizes non-drinking amount during review edits before completing locally", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  const requests: { path: string; method: string; body: string | null }[] = [];
  page.on("request", request => requests.push({
    path: new URL(request.url()).pathname, method: request.method(), body: request.postData(),
  }));
  const returnToReview = page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true });

  await page.getByRole("button", { name: "최근 7일 활동 수정", exact: true }).click();
  await page.locator("#model-walking-days").fill("5");
  const hours = page.locator("#model-walking-hours");
  await hours.fill("30");
  await returnToReview.click();
  await expect(step(page, "activity")).toBeVisible();
  await expect(hours).toBeFocused();
  await expect(hours).toHaveAttribute("aria-invalid", "true");
  await expect(hours).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
  await expect(page.getByRole("alert")).toHaveText("시간은 0~24 중 소수점 없이 입력해 주세요.");
  expect(requests).toEqual([]);

  await hours.fill("0");
  await page.locator("#model-walking-minutes").fill("40");
  await expectErrorCleanup(page);
  await expect(hours).not.toHaveAttribute("aria-invalid");
  await returnToReview.click();
  await expectStep(page, "review");

  await page.getByRole("button", { name: "흡연·음주 수정", exact: true }).click();
  await page.locator("#model-alcohol-frequency").selectOption("none_past_year");
  const amount = page.locator("#model-alcohol-amount");
  await expect(amount).toHaveValue("none");
  await expect(amount).toBeDisabled();
  expect(requests).toEqual([]);
  await returnToReview.click();
  await expectStep(page, "review");
  await expect(step(page, "review")).toContainText("해당 없음");

  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests).toEqual([{ method: "GET", body: null }]);
  expect(requests).toEqual([{ path: "/models/model-v2.json", method: "GET", body: null }]);
});

test("S11 activity requires whole numbers in each walking range and accepts both endpoints", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  for (const [id, maximum, guidance] of [
    ["model-walking-days", 7, "걷기 일수는 0~7일 중 소수점 없이 입력해 주세요."],
    ["model-walking-hours", 24, "시간은 0~24 중 소수점 없이 입력해 주세요."],
    ["model-walking-minutes", 59, "분은 0~59 중 소수점 없이 입력해 주세요."],
  ] as const) {
    await page.getByRole("button", { name: "최근 7일 활동 수정", exact: true }).click();
    const field = page.locator(`#${id}`);
    for (const value of ["-1", "0.5", String(maximum + 1)]) {
      await field.fill(value);
      await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
      await expect(step(page, "activity")).toBeVisible();
      await expect(field).toBeFocused();
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("alert")).toHaveText(guidance);
    }
    for (const value of ["0", String(maximum)]) {
      await field.fill(value);
      await expectErrorCleanup(page);
      await expect(field).not.toHaveAttribute("aria-invalid");
      await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
      await expectStep(page, "review");
      await page.getByRole("button", { name: "최근 7일 활동 수정", exact: true }).click();
    }
    // Restore an ordinary valid combination before checking the next field.
    await fillActivity(page);
    await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  }
  expect(routed.requests).toHaveLength(0);
});

test("S11 habits normalizes lifetime non-drinking and validates every drinking frequency before advancing", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toHabits(page);
  await fillHabits(page);
  const amount = page.locator("#model-alcohol-amount");

  for (const frequency of ["lifetime_nonapplicable", "lt_monthly", "monthly_once", "monthly_2_4", "weekly_2_3", "weekly_4_plus"]) {
    const nonDrinking = frequency === "lifetime_nonapplicable";
    await page.locator("#model-alcohol-frequency").selectOption(frequency);

    if (nonDrinking) {
      await expect(amount).toHaveValue("none");
      await expect(amount).toBeDisabled();
      await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
      await expectStep(page, "review");
      await previous(page).click();
      continue;
    }

    await expect(amount).toBeEnabled();
    await amount.selectOption("none");
    await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
    await expect(step(page, "habits")).toBeVisible();
    await expect(amount).toBeFocused();
    await expect(amount).toHaveAttribute("aria-invalid", "true");
    await expect(amount).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
    await expect(page.getByRole("alert")).toHaveText(
      "술을 마셨다고 답한 경우에는 ‘해당 없음’을 선택할 수 없어요. 보통 한 번에 마시는 양을 선택해 주세요.",
    );
    await amount.selectOption("1_2_drinks");
    await expectErrorCleanup(page);
    await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
    await expectStep(page, "review");
    await previous(page).click();
  }

  expect(routed.requests).toHaveLength(0);
});

test("S11 keeps invalid combinations on review with focused safe copy, editable groups and a deliberate corrected retry", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await page.getByRole("button", { name: "최근 7일 활동 수정", exact: true }).click();
  await page.locator("#model-walking-days").fill("0");
  await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  await submit(page).click();
  const error = page.locator("#model-v2-input-error");
  await expect(error).toContainText("입력 조합을 확인해 주세요");
  await expect(error).toBeFocused();
  await expect(error).not.toContainText(/170|height_cm|never_smoked|model_v2_input_invalid|\/secret\/model\.joblib/);
  await expect(step(page, "review")).toBeVisible();
  await expect(page.locator('form.measurement-panel [aria-invalid="true"]')).toHaveCount(0);
  for (const title of ["기본 정보", "최근 7일 활동", "평일·주말 수면", "흡연·음주"]) await expect(page.getByRole("button", { name: `${title} 수정`, exact: true })).toBeEnabled();
  await expect(page.locator("form.measurement-panel")).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
  expect(routed.requests).toHaveLength(0);
  await page.getByRole("button", { name: "최근 7일 활동 수정", exact: true }).click();
  await expect(page.locator("#model-walking-days")).toHaveValue("0");
  await expect(page.locator("#model-walking-days")).not.toHaveAttribute("aria-invalid");
  await page.locator("#model-walking-days").fill("4");
  await expectErrorCleanup(page);
  await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  await page.getByLabel("입력과 결과가 저장되지 않는다는 안내를 확인했어요.").check();
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests).toHaveLength(1);
  expect(routed.requests.every(request => request.method === "GET" && request.body === null)).toBe(true);
});

test("S11 keeps 503 unavailable recoverable with retained review values and no automatic retry", async ({ page }) => {
  const routed = await routeModel(page, { statuses: [503, 200] });
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await submit(page).click();
  await expect(page.getByRole("status").filter({ hasText: "자동으로 다시 요청하지 않습니다" })).toBeVisible();
  await expect(step(page, "review")).toBeVisible();
  await expect(submit(page)).toBeEnabled();
  await expect(result(page)).toHaveCount(0);
  await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
  await page.waitForTimeout(150);
  expect(routed.requests).toHaveLength(1);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests).toHaveLength(2);
  expect(routed.requests.every(request => request.method === "GET" && request.body === null)).toBe(true);
});

test("S11 timeout never turns late success into completion and permits only an explicit retry", async ({ page }) => {
  const routed = await routeModel(page, { holdFirst: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await submit(page).click();
    await expect(page.getByRole("status").filter({ hasText: "자동으로 다시 요청하지 않습니다" })).toBeVisible({ timeout: 11_000 });
    await expect(submit(page)).toBeEnabled();
    await expect(step(page, "review")).toBeVisible();
    expect(routed.requests).toHaveLength(1);
    routed.releaseFirst();
    await expect.poll(routed.settled).toBe(1);
    await expect(result(page)).toHaveCount(0);
    await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "자동으로 다시 요청하지 않습니다" })).toBeVisible();
    expect(routed.requests).toHaveLength(1);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    expect(routed.requests).toHaveLength(2);
    expect(routed.requests.every(request => request.method === "GET" && request.body === null)).toBe(true);
  } finally {
    routed.releaseFirst();
  }
});

test("S11 sign-out discards pending local inference and returns to signed-out recovery", async ({ page }) => {
  const routed = await routeModel(page, { holdFirst: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await observePreviewInsertion(page);
    await submit(page).click();
    await expect.poll(() => routed.requests.length).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("sk7:e2e-session-change", { detail: null })));
    await expect(page.locator('[data-scene="S01"]')).toBeVisible();
    routed.releaseFirst();
    await expect.poll(routed.settled).toBe(1);
    await expect(result(page)).toHaveCount(0);
    await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { previewInserted?: boolean }).previewInserted ?? false)).toBe(false);
  } finally { routed.releaseFirst(); }
});

test("S11 same-user token refresh preserves pending local completion", async ({ page }) => {
  const routed = await routeModel(page, { holdFirst: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await submit(page).click();
    await expect.poll(() => routed.requests.length).toBe(1);
    await changeSession(page);
    routed.releaseFirst();
    await expect(result(page)).toBeVisible();
    await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();
    await expect(page.locator('[data-scene="S01"]')).toHaveCount(0);
    expect(routed.requests).toEqual([{ method: "GET", body: null }]);
  } finally { routed.releaseFirst(); }
});

test("S11 reload discards a reviewed draft and acknowledgement", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await page.reload();
  await expect(step(page, "intro")).toBeVisible();
  await begin(page);
  await expect(page.locator("#model-age")).toHaveValue("");
  await expect(page.locator("#model-sex")).toHaveValue("");
  await expect(result(page)).toHaveCount(0);
  await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
  expect(routed.requests).toHaveLength(0);
});

test("S11 reload discards a completed visible result without recomputing it", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await submit(page).click();
  await expect(result(page).locator("[data-model-v2-preview-value]")).toBeVisible();
  await page.reload();
  await expect(step(page, "intro")).toBeVisible();
  await expect(page.locator("[data-model-v2-preview-value]")).toHaveCount(0);
  await begin(page);
  await expect(page.locator("#model-age")).toHaveValue("");
  expect(routed.requests).toHaveLength(1);
});

for (const syntheticState of ["not_ready", "result_available_not_user_visible"]) {
  test(`S11 signed-in result ignores synthetic ${syntheticState}`, async ({ page }) => {
    await routeModel(page);
    await page.goto(`/?e2e=signed-in&screen=S11&model_v2_state=${syntheticState}`);
    await toReview(page);
    await submit(page).click();
    await expect(result(page).locator("[data-model-v2-preview-value]")).toHaveText("0.055");
    await expect(result(page).locator("[data-model-v2-preview-value]")).toBeVisible();
    await expect(page.locator("[data-model-v2-synthetic-result]")).toHaveCount(0);
  });
}

test("leaving S11 discards the transient draft and the completed result on return", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  for (const completed of [false, true]) {
    if (completed) {
      await toReview(page);
      await submit(page).click();
      await expect(result(page)).toBeVisible();
    }
    await page.getByRole("button", { name: completed ? "오늘의 기록으로 돌아가기" : "오늘의 기록", exact: true }).click();
    await page.getByRole("button", { name: "AI 분석", exact: true }).click();
    await expect(step(page, "intro")).toBeVisible();
    await expect(result(page)).toHaveCount(0);
    await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
    if (!completed) {
      await begin(page);
      await expect(page.locator("#model-age")).toHaveValue("");
      await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
      await page.getByRole("button", { name: "AI 분석", exact: true }).click();
    }
  }
  expect(routed.requests).toHaveLength(1);
});

test("account switch discards the previous account draft and ignores its pending result", async ({ page }) => {
  const routed = await routeModel(page, { holdFirst: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await observePreviewInsertion(page);
    await submit(page).click();
    await expect(page.getByRole("button", { name: "생활정보 분석 중", exact: true })).toBeDisabled();
    await changeSession(page, true);
    await expect(page.locator('[data-scene="S12"]')).toBeVisible();
    routed.releaseFirst();
    await expect.poll(routed.settled).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { previewInserted?: boolean }).previewInserted ?? false)).toBe(false);
    await page.getByRole("button", { name: "AI 분석", exact: true }).click();
    await expect(step(page, "intro")).toBeVisible();
    await begin(page);
    await expect(page.locator("#model-age")).toHaveValue("");
    await expect(result(page)).toHaveCount(0);
    await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
    expect(routed.requests).toHaveLength(1);
  } finally {
    routed.releaseFirst();
  }
});

test("S11 sign-out discards a completed visible preview and blank draft", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("sk7:e2e-session-change", { detail: null })));
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  await page.goto("/?e2e=signed-in&screen=S11");
  await expect(step(page, "intro")).toBeVisible();
  await expect(result(page)).toHaveCount(0);
  await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
  await begin(page);
  await expect(page.locator("#model-age")).toHaveValue("");
  expect(routed.requests).toHaveLength(1);
});

test("S11 account switch discards a completed visible preview and blank draft", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();
  await changeSession(page, true);
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await page.getByRole("button", { name: "AI 분석", exact: true }).click();
  await expect(step(page, "intro")).toBeVisible();
  await expect(result(page)).toHaveCount(0);
  await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
  await begin(page);
  await expect(page.locator("#model-age")).toHaveValue("");
  expect(routed.requests).toHaveLength(1);
});

for (const width of [320, 390, 430]) {
  test(`S11 every input step, review and result remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await routeModel(page);
    await page.goto("/?e2e=signed-in&screen=S11");
    await assertFitsViewport(page);
    await begin(page);
    await fillBasics(page);
    await assertFitsViewport(page);
    await next(page).click();
    await fillActivity(page);
    await assertFitsViewport(page);
    await next(page).click();
    await fillSleep(page);
    await assertFitsViewport(page);
    await next(page).click();
    await fillHabits(page);
    await assertFitsViewport(page);
    await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
    await assertFitsViewport(page);
    await page.getByLabel("입력과 결과가 저장되지 않는다는 안내를 확인했어요.").check();
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    await assertResultKeyboardAccess(page);
    await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test("S11 supports 200% text and reduced motion through keyboard navigation, review and completion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await assertFitsViewport(page);
  await toReview(page);
  await assertFitsViewport(page);
  await page.getByRole("button", { name: "평일·주말 수면 수정", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expectStep(page, "sleep");
  await page.locator("#model-weekday-bed").click();
  const reducedMotionPicker = page.locator("#model-weekday-bed-picker");
  await expect(reducedMotionPicker).toBeVisible();

  const reducedHour = reducedMotionPicker.locator(".model-v2-hour-detent button").first();
  const reducedMinute = reducedMotionPicker.locator(".model-v2-minute-detent button").first();
  await expect(reducedHour).toHaveCSS("transition-duration", "0s");
  await expect(reducedMinute).toHaveCSS("transition-duration", "0s");

  await assertFitsViewport(page);
  await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  await expectStep(page, "review");
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await assertResultKeyboardAccess(page);
  await expect(result(page).locator("[data-model-v2-preview]")).toBeVisible();
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("S11 time picker fits at 320px without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);
  await page.locator("#model-weekday-bed").click();
  await expect(page.locator("#model-weekday-bed-picker")).toBeVisible();
  await assertFitsViewport(page);
});

// Observe the actual built S11 flow; no test-only inference facade is installed.
test("S11 directly proves no inference egress or model persistence and hashes before parsing", async ({ page }) => {
  await observeModelPrivacy(page);
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await expect(step(page, "intro")).toBeVisible();
  const before = await startModelPrivacy(page);
  await toReview(page);
  const requests: { url: string; method: string; body: string | null }[] = [];
  page.on("request", request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
  const consoleEvents: unknown[] = [];
  page.on("console", () => { consoleEvents.push(null); });
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests).toEqual([{ method: "GET", body: null }]);
  const preview = result(page).locator("[data-model-v2-preview]");
  await expect(preview).toBeVisible();
  await expect(preview.locator("#model-v2-preview-label")).toHaveText("연구/개발 미리보기 · 내부 연속 출력");
  await expect(preview.locator("[data-model-v2-preview-value]")).toHaveText(/^\d\.\d{3}$/);
  await openModelInputs(page);
  expect(requests).toEqual([{ url: "http://127.0.0.1:4173/models/model-v2.json", method: "GET", body: null }]);
  await assertModelPrivacy(page, before, true);
  expect(consoleEvents).toHaveLength(0);
  expect(new URL(page.url()).searchParams.toString()).toBe("e2e=signed-in&screen=S11");
  // Positive controls prove the same observers detect a synthetic leak.
  await page.route("**/synthetic-egress-canary", route => route.fulfill({ body: "ok" }));
  await page.evaluate(async () => {
    localStorage.setItem("synthetic-canary", "fixture");
    document.cookie = "synthetic_canary=fixture";
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("synthetic-canary", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("values");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.transaction("values", "readwrite").objectStore("values").put("fixture", "canary");
    db.close();
    if (globalThis.caches) await (await caches.open("synthetic-canary")).put("/canary", new Response("fixture"));
    await fetch("/synthetic-egress-canary", { method: "POST", body: "synthetic-fixture" });
  });
  const probe = await page.evaluate(() => (window as unknown as { modelPrivacy: Record<string, number> }).modelPrivacy);
  expect([probe.storage, probe.idb, probe.cache, probe.cookie].every(count => count > 0)).toBe(true);
  expect(requests.at(-1)?.method).toBe("POST");
});

for (const failure of ["missing", "hash_mismatch", "malformed", "oversized", "oversized_stream", "crypto_unavailable", "stalled_body", "stalled_digest", "arithmetic"] as const) {
  test(`S11 ${failure} fails closed without persistence, disclosure or server fallback`, async ({ page }) => {
    await observeModelPrivacy(page);
    const routed = await routeModel(page);
    if (failure === "crypto_unavailable") await page.addInitScript(() => Object.defineProperty(crypto, "subtle", { value: undefined }));
    if (failure === "stalled_digest") await page.addInitScript(() => { crypto.subtle.digest = () => new Promise(() => {}); });
    if (failure === "stalled_body" || failure === "oversized_stream") await page.addInitScript((mode) => {
      const fetchOriginal = window.fetch;
      window.fetch = async (...args) => {
        if (!String(args[0]).endsWith("/models/model-v2.json")) return fetchOriginal(...args);
        await fetchOriginal(...args);
        return new Response(new ReadableStream({ start(controller) {
          controller.enqueue(new Uint8Array(mode === "oversized_stream" ? 32769 : 1));
          // Intentionally never close and ignore abort: the application deadline must still settle.
        } }));
      };
    }, failure);
    if (["missing", "hash_mismatch", "malformed", "oversized"].includes(failure)) await page.route("**/models/model-v2.json", async route => {
      const response = await route.fetch();
      const bytes = await response.text();
      await route.fulfill({ status: failure === "missing" ? 404 : 200, contentType: "application/json",
        body: failure === "oversized" ? "x".repeat(32769) : failure === "malformed" ? "{" : bytes + " " });
    });
    await page.goto("/?e2e=signed-in&screen=S11");
    await expect(step(page, "intro")).toBeVisible();
    const before = await startModelPrivacy(page);
    await toReview(page);
    if (failure === "arithmetic") {
      await page.getByRole("button", { name: "기본 정보 수정", exact: true }).click();
      await page.locator("#model-height").fill("1e-200");
      await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
    }
    const requests: string[] = [];
    page.on("request", request => { requests.push(new URL(request.url()).pathname); expect(request.method()).toBe("GET"); expect(request.postData()).toBeNull(); });
    await submit(page).click();
    await expect(page.locator("#model-v2-unavailable")).toBeVisible({ timeout: 11_000 });
    await expect(result(page)).toHaveCount(0);
    await expect(page.locator("[data-model-v2-feature]")).toHaveCount(0);
    await expect(submit(page)).toBeEnabled();
    await expect(page.locator("#model-v2-unavailable")).not.toContainText(/height_cm|1e-200|SHA-256|model-v2.json/);
    expect(requests).toEqual(["crypto_unavailable", "arithmetic"].includes(failure) ? [] : ["/models/model-v2.json"]);
    await assertModelPrivacy(page, before, false);
    const count = routed.requests.length;
    await page.waitForTimeout(100);
    expect(routed.requests.length).toBe(count);
  });
}

test("S11 hour detent carries AM/PM across the real 11-to-12 boundary", async ({ page }) => {
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);

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
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);

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
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);

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
