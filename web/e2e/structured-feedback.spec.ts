import { expect, test, type Page } from "@playwright/test";

type FeedbackMode = "success" | "duplicate" | "network" | "session";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

async function installApi(page: Page, mode: FeedbackMode) {
  const feedbackBodies: unknown[] = [];

  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (url.pathname === "/api/v1/observations/window") {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          start_on: url.searchParams.get("start_on"),
          end_on: url.searchParams.get("end_on"),
          blood_pressure_observations: [],
          challenge_events: [],
          active_challenge: null,
          challenge_checkins: [],
        }),
      });
      return;
    }

    if (url.pathname === "/api/v1/feedback" && request.method() === "POST") {
      feedbackBodies.push(request.postDataJSON());

      if (mode === "network") {
        await route.abort("failed");
        return;
      }

      if (mode === "session") {
        await route.fulfill({
          status: 401,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            detail: {
              code: "supabase_session_invalid",
              message: "Session is no longer valid.",
            },
          }),
        });
        return;
      }

      if (mode === "duplicate") {
        await route.fulfill({
          status: 409,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            detail: {
              code: "feedback_already_submitted",
              message: "Feedback was already submitted for this surface today.",
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({ status: "saved", submitted_on: "2026-09-16" }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code: "not_found" } }),
    });
  });

  return feedbackBodies;
}

test("S10 sends one structured comprehension response and locks after confirmed save", async ({ page }) => {
  const bodies = await installApi(page, "success");

  await page.goto("/?e2e=signed-in&screen=S10");

  const feedback = page.locator("[data-structured-feedback]");
  await expect(feedback.getByRole("heading", { name: "이 7일 기록을 이해하기 쉬웠나요?" })).toBeVisible();

  await feedback.getByRole("button", { name: "이해하기 쉬웠어요" }).click();

  await expect(feedback.getByRole("status")).toContainText("의견을 남겼어요.");
  expect(bodies).toEqual([{ surface: "seven_day_recap", response: "clear" }]);

  await expect(feedback.getByRole("button", { name: "이해하기 쉬웠어요" })).toBeDisabled();
  await expect(feedback.getByRole("button", { name: "조금 애매했어요" })).toBeDisabled();
  await expect(feedback.getByRole("button", { name: "이해하기 어려웠어요" })).toBeDisabled();
});

test("S10 reports a same-day duplicate without creating a second success state", async ({ page }) => {
  const bodies = await installApi(page, "duplicate");

  await page.goto("/?e2e=signed-in&screen=S10");

  const feedback = page.locator("[data-structured-feedback]");
  await feedback.getByRole("button", { name: "조금 애매했어요" }).click();

  await expect(feedback.getByRole("status")).toContainText("오늘은 이미 이 화면에 대한 의견을 남겼어요.");
  expect(bodies).toEqual([{ surface: "seven_day_recap", response: "unclear" }]);
  await expect(feedback.getByRole("button", { name: "이해하기 쉬웠어요" })).toBeDisabled();
});

test("S10 keeps a network-uncertain feedback write explicitly unconfirmed", async ({ page }) => {
  const bodies = await installApi(page, "network");

  await page.goto("/?e2e=signed-in&screen=S10");

  const feedback = page.locator("[data-structured-feedback]");
  await feedback.getByRole("button", { name: "이해하기 어려웠어요" }).click();

  await expect(feedback.getByRole("status")).toContainText("저장 여부를 확인할 수 없어요.");
  await expect(feedback).not.toContainText("의견을 남겼어요.");
  expect(bodies).toEqual([{ surface: "seven_day_recap", response: "hard_to_understand" }]);
  await expect(feedback.getByRole("button", { name: "이해하기 어려웠어요" })).toBeEnabled();
});

test("S10 feedback session expiry returns to the existing sign-in recovery flow", async ({ page }) => {
  await installApi(page, "session");

  await page.goto("/?e2e=signed-in&screen=S10");
  const feedback = page.locator("[data-structured-feedback]");
  await feedback.getByRole("button", { name: "이해하기 쉬웠어요" }).click();

  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  await expect(page.getByText("로그인 시간이 만료되었습니다. 이메일 링크로 다시 로그인해 주세요.")).toBeVisible();
});
