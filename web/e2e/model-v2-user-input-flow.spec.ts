import { expect, test, type Page } from "@playwright/test";

const emptyWindow = {
  start_on: "2026-09-02",
  end_on: "2026-09-08",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};
const modelPath = "/api/v1/model-v2/product-score";
const validPayload = {
  age_years: 35,
  sex_knhanes: 1,
  height_cm: 170,
  weight_kg: 68,
  cigarette_smoking_state: "never_smoked",
  alcohol_frequency: "lt_monthly",
  alcohol_amount_category: "1_2_drinks",
  walking_days_7d: 4,
  walking_active_day_hours: 0,
  walking_active_day_minutes: 40,
  strength_days_7d: "2_days",
  weekday_bed_hour: 23,
  weekday_bed_minute: 30,
  weekday_wake_hour: 7,
  weekday_wake_minute: 0,
  weekend_bed_hour: 23,
  weekend_bed_minute: 30,
  weekend_wake_hour: 8,
  weekend_wake_minute: 0,
};
const timeInputs = [
  ["model-weekday-bed", "23:30"],
  ["model-weekday-wake", "07:00"],
  ["model-weekend-bed", "23:30"],
  ["model-weekend-wake", "08:00"],
] as const;

type Step = "intro" | "basics" | "habits" | "activity" | "sleep" | "review";
const stepTitles = {
  basics: "기본 정보", habits: "생활 습관", activity: "활동", sleep: "수면", review: "입력 확인",
};

async function routeModel(page: Page, options: { statuses?: number[]; holdFirst?: boolean } = {}) {
  const requests: { body: unknown; authorization: string | null }[] = [];
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
    if (url.pathname === modelPath) {
      expect(request.method()).toBe("POST");
      const index = requests.length;
      requests.push({ body: request.postDataJSON(), authorization: await request.headerValue("authorization") });
      const status = statuses[Math.min(index, statuses.length - 1)];
      if (options.holdFirst && index === 0) await firstPending;
      const body = status === 200
        ? { schema_version: "model-v2-r1-schema-v1", product_wording: "입력 기반 위험군 선별 신호" }
        : status === 422
          ? { detail: {
              code: "model_v2_input_invalid",
              message: "Rejected height_cm=170, never_smoked at /secret/model.joblib",
              loc: ["body", "height_cm"],
              input: { height_cm: 170, cigarette_smoking_state: "never_smoked" },
            } }
          : status === 401
            ? { detail: { code: "supabase_session_invalid" } }
            : { detail: { code: "model_not_ready", message: "Model V2 scoring is not available." } };
      try {
        await route.fulfill({ contentType: "application/json", status, headers, body: JSON.stringify(body) });
      } finally {
        settled += 1;
      }
      return;
    }
    await route.abort();
  });
  return { requests, releaseFirst, settled: () => settled };
}

const step = (page: Page, value: Step) => page.locator(`[data-model-v2-step="${value}"]`);
const next = (page: Page) => page.getByRole("button", { name: "다음", exact: true });
const previous = (page: Page) => page.getByRole("button", { name: "이전", exact: true });
const submit = (page: Page) => page.getByRole("button", { name: "생활정보 분석하기", exact: true });
const result = (page: Page) => page.locator('[data-model-v2-user-result="processed"]');

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
  await page.getByLabel("나이", { exact: true }).fill(age);
  await page.getByLabel("성별", { exact: true }).selectOption("1");
  await page.locator("#model-height").fill("170");
  await page.locator("#model-weight").fill("68");
}

async function fillHabits(page: Page) {
  await page.getByLabel("흡연 상태").selectOption("never_smoked");
  await page.getByLabel("음주 빈도").selectOption("lt_monthly");
  await page.getByLabel("한 번 마실 때 음주량").selectOption("1_2_drinks");
}

async function fillActivity(page: Page) {
  await page.getByLabel("최근 7일 걷기 일수").fill("4");
  await page.locator("#model-walking-hours").fill("0");
  await page.locator("#model-walking-minutes").fill("40");
  await page.getByLabel("최근 7일 근력운동").selectOption("2_days");
}

async function fillSleep(page: Page) {
  for (const [id, value] of timeInputs) await page.locator(`#${id}`).fill(value);
}

async function toSleep(page: Page, age = "35") {
  await begin(page);
  await fillBasics(page, age);
  await next(page).click();
  await expectStep(page, "habits");
  await fillHabits(page);
  await next(page).click();
  await expectStep(page, "activity");
  await fillActivity(page);
  await next(page).click();
  await expectStep(page, "sleep");
}

async function toReview(page: Page, age = "35", consent = true) {
  await toSleep(page, age);
  await fillSleep(page);
  await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
  await expectStep(page, "review");
  if (consent) await page.getByLabel("위 안내를 확인했습니다.").check();
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

async function assertFitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const controls = step(page, await page.locator("[data-model-v2-step]").getAttribute("data-model-v2-step") as Step)
    .locator("input, select, button");
  for (const control of await controls.all()) {
    const geometry = await control.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, viewport: innerWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);
  }
}

test("S11 requires explicit review submission and preserves the exact 19-field transient contract", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  const storageBefore = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  await expect(step(page, "intro")).toBeVisible();
  await expect(page.locator('[data-scene="S11"]')).toContainText("입력 기반 위험군 선별 신호");
  await expect(page.locator("#model-age")).toHaveCount(0);
  await expect(submit(page)).toHaveCount(0);
  await toReview(page);
  expect(routed.requests).toHaveLength(0);
  await expect(page.locator('.model-v2-progress li[data-complete="true"]')).toHaveCount(4);
  const review = step(page, "review");
  for (const text of ["35", "남성", "170", "68", "비흡연", "월 1회 미만", "1~2잔", "40", "23:30", "07:00", "08:00"]) {
    await expect(review).toContainText(text);
  }
  await expect(review).not.toContainText(/BMI|체질량지수|저위험|중위험|고위험/);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests).toEqual([{ body: validPayload, authorization: "Bearer e2e-synthetic-access-token" }]);
  await expect(result(page)).toContainText("생활정보 분석이 완료되었습니다.");
  await expect(result(page)).not.toContainText(/\b0\.\d+\b|\b\d{1,3}%\b|저위험|중위험|고위험/);
  await expect(submit(page)).toHaveCount(0);
  await expect(page.locator('.model-v2-progress li[data-complete="true"]')).toHaveCount(5);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storageBefore);
  expect(new URL(page.url()).searchParams.toString()).toBe("e2e=signed-in&screen=S11");
});

test("S11 prevents double submission and freezes review edits while analysis is pending", async ({ page }) => {
  const routed = await routeModel(page, { holdFirst: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await submit(page).dblclick();
    await expect(page.getByRole("button", { name: "생활정보 분석 중", exact: true })).toBeDisabled();
    await expect(page.getByLabel("위 안내를 확인했습니다.")).toBeDisabled();
    for (const title of ["기본 정보", "생활 습관", "활동", "수면"]) {
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
  await toSleep(page);
  await fillSleep(page);
  await previous(page).click();
  await expectStep(page, "activity");
  for (const [id, value] of [["model-walking-days", "4"], ["model-walking-hours", "0"], ["model-walking-minutes", "40"], ["model-strength", "2_days"]]) {
    await expect(page.locator(`#${id}`)).toHaveValue(value);
  }
  await previous(page).click();
  await expectStep(page, "habits");
  for (const [id, value] of [["model-smoking", "never_smoked"], ["model-alcohol-frequency", "lt_monthly"], ["model-alcohol-amount", "1_2_drinks"]]) {
    await expect(page.locator(`#${id}`)).toHaveValue(value);
  }
  await previous(page).click();
  await expectStep(page, "basics");
  for (const [id, value] of [["model-age", "35"], ["model-sex", "1"], ["model-height", "170"], ["model-weight", "68"]]) {
    await expect(page.locator(`#${id}`)).toHaveValue(value);
  }
  await next(page).click();
  await next(page).click();
  await next(page).click();
  await expectStep(page, "sleep");
  for (const [id, value] of timeInputs) await expect(page.locator(`#${id}`)).toHaveValue(value);
  expect(routed.requests).toHaveLength(0);
});

test("S11 review edits return directly to review and submit only the corrected values", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  const edits = [
    { step: "basics", title: "기본 정보", id: "model-weight", value: "69", text: "69" },
    { step: "habits", title: "생활 습관", id: "model-smoking", value: "former_currently_not_smoking", text: "과거 흡연, 현재 금연" },
    { step: "activity", title: "활동", id: "model-walking-minutes", value: "45", text: "45" },
    { step: "sleep", title: "수면", id: "model-weekend-wake", value: "08:15", text: "08:15" },
  ] as const;
  for (const edit of edits) {
    await page.getByRole("button", { name: `${edit.title} 수정`, exact: true }).click();
    await expectStep(page, edit.step);
    if (edit.step === "habits") await page.locator(`#${edit.id}`).selectOption(edit.value);
    else await page.locator(`#${edit.id}`).fill(edit.value);
    await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
    await expectStep(page, "review");
    await expect(step(page, "review")).toContainText(edit.text);
    expect(routed.requests).toHaveLength(0);
  }
  await page.getByLabel("위 안내를 확인했습니다.").check();
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests[0].body).toEqual({ ...validPayload, weight_kg: 69, cigarette_smoking_state: "former_currently_not_smoking", walking_active_day_minutes: 45, weekend_wake_minute: 15 });
});

test("S11 native keyboard navigation focuses each new heading and Enter in a field never advances", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await page.getByRole("button", { name: "입력 시작하기" }).focus();
  await page.keyboard.press("Enter");
  await expectStep(page, "basics");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("나이", { exact: true })).toBeFocused();
  await fillBasics(page);
  await page.locator("#model-weight").press("Enter");
  await expect(step(page, "basics")).toBeVisible();
  await next(page).focus();
  await page.keyboard.press("Enter");
  await expectStep(page, "habits");
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
    ["model-smoking", () => fillHabits(page)],
    ["model-walking-days", () => fillActivity(page)],
  ] as const) {
    await next(page).click();
    const field = page.locator(`#${id}`);
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
    await expect(page.locator("form.measurement-panel")).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
    await expect(page.locator("#model-v2-input-error")).toBeVisible();
    await fill();
    await expectErrorCleanup(page);
    await next(page).click();
  }
  await expectStep(page, "sleep");
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
  await expectStep(page, "habits");
  expect(routed.requests).toHaveLength(0);
});

test("S11 retains the age-80 applicability notice through review without blocking an eligible request", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page, "80");
  await expect(page.locator('[data-scene="S11"]')).toContainText("적용 근거가 상대적으로 약합니다");
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests[0].body).toEqual({ ...validPayload, age_years: 80 });
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
  expect(routed.requests[0].body).toEqual({ ...validPayload, age_years: 35.5, height_cm: 0.5, weight_kg: 0.5 });
});

test("S11 makes all four time fields explicit and focuses every incomplete clock value locally", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);
  for (const [id] of timeInputs) await expect(page.locator(`#${id}-status`)).toHaveText("시간 선택 필요");
  await fillSleep(page);
  for (const [id, value] of timeInputs) {
    const field = page.locator(`#${id}`);
    await expect(page.locator(`#${id}-status`)).toHaveText("선택 완료");
    await expect(field).toHaveAttribute("data-time-complete", "true");
    await field.fill("");
    await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAttribute("aria-describedby", new RegExp(`${id}-status.*model-v2-input-error`));
    await expect(page.getByRole("alert")).toContainText("시간 항목을 모두 선택해 주세요");
    await expect(page.locator(`#${id}-status`)).toHaveText("시간 선택 필요");
    await field.fill(value);
    await expectErrorCleanup(page);
  }
  expect(routed.requests).toHaveLength(0);
});

test("S11 preserves browser midnight in all four clocks without research-clock rewriting", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toSleep(page);
  for (const [id] of timeInputs) {
    await page.locator(`#${id}`).fill("00:00");
    await expect(page.locator(`#${id}-status`)).toHaveText("선택 완료");
  }
  await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
  await page.getByLabel("위 안내를 확인했습니다.").check();
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests[0].body).toEqual({ ...validPayload, weekday_bed_hour: 0, weekday_bed_minute: 0, weekday_wake_hour: 0, weekend_bed_hour: 0, weekend_bed_minute: 0, weekend_wake_hour: 0 });
});

test("S11 links missing review acknowledgement to the focused checkbox and clears the error on correction", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page, "35", false);
  await submit(page).click();
  const consent = page.getByLabel("위 안내를 확인했습니다.");
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

test("S11 keeps generic 422 on review with focused safe copy, editable groups and a deliberate corrected retry", async ({ page }) => {
  const routed = await routeModel(page, { statuses: [422, 200] });
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await submit(page).click();
  const error = page.locator("#model-v2-input-error");
  await expect(error).toContainText("입력 조합을 확인해 주세요");
  await expect(error).toBeFocused();
  await expect(error).not.toContainText(/170|height_cm|never_smoked|model_v2_input_invalid|\/secret\/model\.joblib/);
  await expect(step(page, "review")).toBeVisible();
  await expect(page.locator('form.measurement-panel [aria-invalid="true"]')).toHaveCount(0);
  for (const title of ["기본 정보", "생활 습관", "활동", "수면"]) await expect(page.getByRole("button", { name: `${title} 수정`, exact: true })).toBeEnabled();
  await expect(page.locator("form.measurement-panel")).toHaveAttribute("aria-describedby", /\bmodel-v2-input-error\b/);
  expect(routed.requests).toHaveLength(1);
  await page.getByRole("button", { name: "기본 정보 수정", exact: true }).click();
  await expect(page.locator("#model-height")).toHaveValue("170");
  await expect(page.locator("#model-height")).not.toHaveAttribute("aria-invalid");
  await page.locator("#model-height").fill("171");
  await expectErrorCleanup(page);
  await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  await page.getByLabel("위 안내를 확인했습니다.").check();
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests).toHaveLength(2);
  expect(routed.requests[1].body).toEqual({ ...validPayload, height_cm: 171 });
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
  await page.waitForTimeout(150);
  expect(routed.requests).toHaveLength(1);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(routed.requests).toHaveLength(2);
  expect(routed.requests[1].body).toEqual(validPayload);
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
    await expect(page.getByRole("status").filter({ hasText: "자동으로 다시 요청하지 않습니다" })).toBeVisible();
    expect(routed.requests).toHaveLength(1);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    expect(routed.requests).toHaveLength(2);
    expect(routed.requests[1].body).toEqual(validPayload);
  } finally {
    routed.releaseFirst();
  }
});

test("S11 maps 401 to the existing signed-out recovery path", async ({ page }) => {
  const routed = await routeModel(page, { statuses: [401] });
  await page.goto("/?e2e=signed-in&screen=S11");
  await toReview(page);
  await submit(page).click();
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  expect(routed.requests).toHaveLength(1);
});

test("S11 ignores stale 401 after a same-user token refresh and retains a usable review", async ({ page }) => {
  const routed = await routeModel(page, { statuses: [401, 200], holdFirst: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await submit(page).click();
    await expect(page.getByRole("button", { name: "생활정보 분석 중", exact: true })).toBeDisabled();
    await expect.poll(() => routed.requests.length).toBe(1);
    expect(routed.requests[0].authorization).toBe("Bearer e2e-synthetic-access-token");
    await changeSession(page);
    routed.releaseFirst();
    await expect(submit(page)).toBeEnabled();
    await expect(step(page, "review")).toBeVisible();
    await expect(page.locator('[data-scene="S01"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "로그아웃", exact: true })).toBeEnabled();
    await expect(page.locator("form.measurement-panel :disabled")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(routed.requests).toHaveLength(1);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    expect(routed.requests).toHaveLength(2);
    expect(routed.requests[1]).toEqual({ body: validPayload, authorization: "Bearer e2e-refreshed-session-token" });
  } finally {
    routed.releaseFirst();
  }
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
  expect(routed.requests).toHaveLength(0);
});

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
    await page.getByRole("button", { name: "생활정보 기반 고혈압 선별 참고", exact: true }).click();
    await expect(step(page, "intro")).toBeVisible();
    await expect(result(page)).toHaveCount(0);
    if (!completed) {
      await begin(page);
      await expect(page.locator("#model-age")).toHaveValue("");
      await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
      await page.getByRole("button", { name: "생활정보 기반 고혈압 선별 참고", exact: true }).click();
    }
  }
  expect(routed.requests).toHaveLength(1);
});

test("account switch discards the previous account draft and ignores its pending result", async ({ page }) => {
  const routed = await routeModel(page, { holdFirst: true });
  try {
    await page.goto("/?e2e=signed-in&screen=S11");
    await toReview(page);
    await submit(page).click();
    await expect(page.getByRole("button", { name: "생활정보 분석 중", exact: true })).toBeDisabled();
    await changeSession(page, true);
    await expect(page.locator('[data-scene="S12"]')).toBeVisible();
    routed.releaseFirst();
    await expect.poll(routed.settled).toBe(1);
    await page.getByRole("button", { name: "생활정보 기반 고혈압 선별 참고", exact: true }).click();
    await expect(step(page, "intro")).toBeVisible();
    await begin(page);
    await expect(page.locator("#model-age")).toHaveValue("");
    await expect(result(page)).toHaveCount(0);
    expect(routed.requests).toHaveLength(1);
  } finally {
    routed.releaseFirst();
  }
});

for (const width of [320, 390, 430]) {
  test(`S11 every input step and review remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await routeModel(page);
    await page.goto("/?e2e=signed-in&screen=S11");
    await assertFitsViewport(page);
    await begin(page);
    await fillBasics(page);
    await assertFitsViewport(page);
    await next(page).click();
    await fillHabits(page);
    await assertFitsViewport(page);
    await next(page).click();
    await fillActivity(page);
    await assertFitsViewport(page);
    await next(page).click();
    await fillSleep(page);
    await assertFitsViewport(page);
    await page.getByRole("button", { name: "입력 확인하기", exact: true }).click();
    await assertFitsViewport(page);
    await page.getByLabel("위 안내를 확인했습니다.").check();
    await submit(page).click();
    await expect(result(page)).toBeVisible();
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
  await page.getByRole("button", { name: "수면 수정", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expectStep(page, "sleep");
  await assertFitsViewport(page);
  await page.getByRole("button", { name: "입력 확인으로 돌아가기", exact: true }).click();
  await expectStep(page, "review");
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
