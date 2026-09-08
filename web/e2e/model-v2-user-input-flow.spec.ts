import { expect, test, type Page } from "@playwright/test";

const emptyWindow = {
  start_on: "2026-09-02",
  end_on: "2026-09-08",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

async function routeModel(page: Page, modelStatus = 200) {
  let modelRequests = 0;
  let lastBody: unknown = null;

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
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        headers,
        body: JSON.stringify(emptyWindow),
      });
      return;
    }

    if (url.pathname === "/api/v1/model-v2/product-score") {
      modelRequests += 1;
      lastBody = request.postDataJSON();
      const body =
        modelStatus === 200
          ? {
              schema_version: "model-v2-r1-schema-v1",
              product_wording: "입력 기반 위험군 선별 신호",
            }
          : modelStatus === 422
            ? {
                detail: {
                  code: "model_v2_input_invalid",
                  message: "Model V2 input values are invalid.",
                },
              }
            : modelStatus === 401
              ? { detail: { code: "supabase_session_invalid" } }
              : {
                  detail: {
                    code: "model_not_ready",
                    message: "Model V2 scoring is not available.",
                  },
                };

      await route.fulfill({
        contentType: "application/json",
        status: modelStatus,
        headers,
        body: JSON.stringify(body),
      });
      return;
    }

    await route.abort();
  });

  return {
    requests: () => modelRequests,
    body: () => lastBody,
  };
}

async function fillValidForm(page: Page, age = "35") {
  await page.getByLabel("나이").fill(age);
  await page.getByLabel("성별").selectOption("1");
  await page.getByLabel(/키/).fill("170");
  await page.getByLabel(/몸무게/).fill("68");
  await page.getByLabel("흡연 상태").selectOption("never_smoked");
  await page.getByLabel("음주 빈도").selectOption("lt_monthly");
  await page.getByLabel("한 번 마실 때 음주량").selectOption("1_2_drinks");
  await page.getByLabel("최근 7일 걷기 일수").fill("4");
  await page.getByLabel(/걷는 날 하루 평균 시간/).fill("0");
  await page.getByLabel(/걷는 날 추가 시간/).fill("40");
  await page.getByLabel("최근 7일 근력운동").selectOption("2_days");
  await page.getByLabel("평일 취침 시간").fill("23:30");
  await page.getByLabel("평일 기상 시간").fill("07:00");
  await page.getByLabel("주말 취침 시간").fill("23:30");
  await page.getByLabel("주말 기상 시간").fill("08:00");
  await page.getByLabel("위 안내를 확인했습니다.").check();
}

test("authenticated S11 sends one transient product request and exposes no numeric result", async ({
  page,
}) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await fillValidForm(page);

  const submit = page.getByRole("button", { name: "신호 준비하기" });
  await submit.dblclick();

  await expect(
    page.locator('[data-model-v2-user-result="processed"]'),
  ).toBeVisible();
  expect(routed.requests()).toBe(1);
  expect(routed.body()).toMatchObject({
    age_years: 35,
    sex_knhanes: 1,
    height_cm: 170,
    weight_kg: 68,
    walking_days_7d: 4,
  });

  const sceneText = await page.locator('[data-scene="S11"]').innerText();
  expect(sceneText).not.toMatch(/\b0\.\d+\b/);
  expect(sceneText).not.toMatch(/\b\d{1,3}%\b/);
  expect(sceneText).not.toContain("저위험");
  expect(sceneText).not.toContain("중위험");
  expect(sceneText).not.toContain("고위험");

  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  const serialized = JSON.stringify(storage);
  expect(serialized).not.toContain("never_smoked");
  expect(serialized).not.toContain("170");
});

test("S11 blocks under-19 input before sending a request", async ({ page }) => {
  const routed = await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await fillValidForm(page, "18");

  await page.getByRole("button", { name: "신호 준비하기" }).click();

  await expect(page.getByRole("alert")).toContainText("만 19세 이상");
  expect(routed.requests()).toBe(0);
});

test("S11 shows explicit applicability limitation for age 80+", async ({
  page,
}) => {
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");

  await page.getByLabel("나이").fill("80");

  await expect(page.getByRole("status")).toContainText(
    "적용 가능성이 상대적으로 덜 확실",
  );
});

test("S11 maps 422 to a correctable input state without echoing raw values", async ({
  page,
}) => {
  const routed = await routeModel(page, 422);
  await page.goto("/?e2e=signed-in&screen=S11");
  await fillValidForm(page);

  await page.getByRole("button", { name: "신호 준비하기" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "입력 조합을 확인해 주세요",
  );
  await expect(page.getByLabel(/키/)).toHaveValue("170");
  await expect(page.getByRole("alert")).not.toContainText("170");
  expect(routed.requests()).toBe(1);
});

test("S11 maps 503 to unavailable without automatic retry", async ({
  page,
}) => {
  const routed = await routeModel(page, 503);
  await page.goto("/?e2e=signed-in&screen=S11");
  await fillValidForm(page);

  await page.getByRole("button", { name: "신호 준비하기" }).click();

  await expect(page.getByRole("status")).toContainText(
    "자동으로 다시 요청하지 않습니다",
  );
  expect(routed.requests()).toBe(1);
  await page.waitForTimeout(100);
  expect(routed.requests()).toBe(1);
});

test("S11 maps 401 to the existing signed-out recovery path", async ({
  page,
}) => {
  await routeModel(page, 401);
  await page.goto("/?e2e=signed-in&screen=S11");
  await fillValidForm(page);

  await page.getByRole("button", { name: "신호 준비하기" }).click();

  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
});

test("leaving S11 discards the transient draft and result", async ({
  page,
}) => {
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await page.getByLabel("나이").fill("35");

  await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await page
    .getByRole("button", { name: "입력 기반 위험군 선별 신호" })
    .click();

  await expect(page.getByLabel("나이")).toHaveValue("");
  await expect(
    page.locator('[data-model-v2-user-result="processed"]'),
  ).toHaveCount(0);
});

test("account switch discards prior-account transient Model V2 state", async ({
  page,
}) => {
  await routeModel(page);
  await page.goto("/?e2e=signed-in&screen=S11");
  await page.getByLabel("나이").fill("35");

  await page.evaluate(() => {
    const current = (window as unknown as { __dummy?: unknown }).__dummy;
    void current;
    window.dispatchEvent(
      new CustomEvent("sk7:e2e-session-change", {
        detail: {
          access_token: "e2e-synthetic-access-token-b",
          refresh_token: "e2e-synthetic-refresh-token-b",
          expires_in: 3600,
          expires_at: 1800000000,
          token_type: "bearer",
          user: {
            id: "e2e-synthetic-user-b",
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            created_at: "2026-09-08T00:00:00.000Z",
          },
        },
      }),
    );
  });

  await expect(page.locator('[aria-busy="true"]')).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await page
    .getByRole("button", { name: "입력 기반 위험군 선별 신호" })
    .click();
  await expect(page.getByLabel("나이")).toHaveValue("");
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
]) {
  test(`real-user S11 remains usable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await routeModel(page);
    await page.goto("/?e2e=signed-in&screen=S11");

    const scene = page.locator('[data-scene="S11"]');
    await expect(scene).toBeVisible();
    const box = await scene.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    await expect(
      page.getByRole("button", { name: "신호 준비하기" }),
    ).toBeVisible();
  });
}
