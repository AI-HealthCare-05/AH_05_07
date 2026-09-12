import { expect, test } from "@playwright/test";

const headers = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const emptyWindow = {
  start_on: "2026-08-29",
  end_on: "2026-09-04",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

const matrixStates = [
  {
    name: "BP 없음 / active challenge 없음",
    window: { ...emptyWindow, challenge_events: [{ id: "matrix-legacy", observed_on: "2026-09-04", action_id: "sleep-routine", status: "completed" as const }] },
    lead: "blood-pressure",
    secondary: ["challenge", "today-detail"],
    destinations: { challenge: "S03", "today-detail": "S07" },
  },
  {
    name: "BP 있음 / active challenge 없음",
    window: {
      ...emptyWindow,
      blood_pressure_observations: [{ id: "matrix-bp", observed_on: "2026-09-08", period: "morning", systolic: 120, diastolic: 80 }],
    },
    lead: "challenge",
    secondary: ["blood-pressure", "today-detail"],
    destinations: { "blood-pressure": "S04", "today-detail": "S07" },
  },
  {
    name: "BP 있음 / active challenge 있음",
    window: {
      ...emptyWindow,
      blood_pressure_observations: [{ id: "matrix-bp-active", observed_on: "2026-09-08", period: "morning", systolic: 120, diastolic: 80 }],
      active_challenge: { id: "matrix-challenge", action_id: "walk-10-minutes", starts_on: "2026-09-01", ends_on: "2026-09-10", first_checkin_on: "2026-09-01", status: "active" as const },
    },
    lead: "today-detail",
    secondary: ["blood-pressure", "challenge"],
    destinations: { "blood-pressure": "S04", challenge: "S03" },
  },
] as const;

test("primary journey navigation updates the URL and supports browser history", async ({ page }) => {
  await page.goto("/?fixture=VP-10");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();

  await page.getByRole("button", { name: "기록 찾아보기" }).click();
  await expect(page).toHaveURL(/screen=S08/);
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  await page.getByRole("button", { name: "7일 돌아보기" }).click();
  await expect(page).toHaveURL(/screen=S10/);
  await page.goBack();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();

  await page.getByRole("button", { name: "생활정보 기반 고혈압 선별 참고" }).click();
  await expect(page.locator('[data-scene="S11"]')).toContainText("아직 준비 중이에요");
  await page.getByRole("button", { name: "설정과 도움말" }).click();
  await expect(page.locator('[data-scene="S14"]')).toBeVisible();
});

test("a selected fact opens its own URL-addressable detail screen", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S08");
  await page.locator('[data-record-kind="blood-pressure"]').getByRole("button", { name: /상세 보기/ }).first().click();

  await expect(page).toHaveURL(/screen=S09/);
  await expect(page).toHaveURL(/record=blood-pressure%3Afixture-bp-/);
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("•••/•• mmHg");
});

test("confirmed persistence alone opens the saved scene", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  let saved = false;
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
    if (url.pathname === "/api/v1/observations/blood-pressure" && request.method() === "POST") {
      saved = true;
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        headers,
        body: JSON.stringify({ id: "synthetic-saved", ...request.postDataJSON() }),
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();

  expect(saved).toBe(true);
  await expect(page.locator("[data-saved-scene-status]")).toHaveCount(0);
  expect(requests.filter(url => /SavedSceneRenderer|\.glb(?:\?|$)/.test(url))).toEqual([]);
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-scene="S05"]')).toHaveCount(0);
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
});

test.describe("S02 lead and secondary destination state matrix", () => {
  for (const state of matrixStates) {
    test(state.name, async ({ page }) => {
      await page.route("http://e2e.invalid/**", async (route) => {
        const request = route.request();
        if (request.method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers });
          return;
        }
        if (new URL(request.url()).pathname === "/api/v1/observations/window") {
          await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(state.window) });
          return;
        }
        await route.abort();
      });

      await page.clock.setFixedTime(
        new Date("2026-09-08T12:00:00+09:00"),
      );

      await page.goto("/?e2e=signed-in&screen=S02");
      await expect(page.locator('[data-scene="S02"]')).toBeVisible();
      const lead = page.locator(".home-lead");
      const secondary = page.locator(".home-links [data-home-concept]");
      await expect(lead).toHaveAttribute("data-home-concept", state.lead);
      await expect(secondary).toHaveCount(2);
      expect(await secondary.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-home-concept")))).toEqual(expect.arrayContaining(state.secondary));
      expect(await page.locator("[data-home-concept]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-home-concept")))).toHaveLength(3);
      expect(await page.locator("[data-home-concept]").evaluateAll((elements) => new Set(elements.map((element) => element.textContent?.trim())).size)).toBe(3);

      for (const key of state.secondary) {
        await page.locator(`.home-links [data-home-concept="${key}"]`).click();
        await expect(page).toHaveURL(new RegExp(`screen=${state.destinations[key]}`));
        await expect(page.locator(`[data-scene="${state.destinations[key]}"]`)).toBeVisible();
        await page.goBack();
        await expect(page.locator('[data-scene="S02"]')).toBeVisible();
      }
    });
  }
});
