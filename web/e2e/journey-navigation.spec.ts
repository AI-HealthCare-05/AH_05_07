import { expect, test } from "@playwright/test";

const navigationLabels = ["오늘의 기록", "AI 분석", "기록 찾아보기", "7일 돌아보기", "설정"];
const primaryScreens = ["S02", "S11", "S08", "S10", "S14"];

test("AI primary navigation reaches S11 in one action from every primary screen", async ({ page }) => {
  for (const screen of primaryScreens) {
    await page.goto(`/?fixture=VP-10&screen=${screen}`);
    await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
    const nav = page.getByRole("navigation", { name: "주요 화면" });
    await expect(nav.getByRole("button")).toHaveCount(5);
    expect(await nav.getByRole("button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label")))).toEqual(navigationLabels);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute("aria-label", navigationLabels[primaryScreens.indexOf(screen)]);
    await nav.getByRole("button", { name: "AI 분석", exact: true }).click();
    await expect(page).toHaveURL(/screen=S11/);
    await expect(page.locator('[data-scene="S11"]')).toBeVisible();
    await expect(nav.getByRole("button", { name: "AI 분석" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("button", { name: "설정", exact: true })).not.toHaveAttribute("aria-current", "page");
  }
  await page.reload();
  await expect(page.locator('[data-scene="S11"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 분석" })).toHaveAttribute("aria-current", "page");
});

for (const width of [320, 390, 1366]) {
  test(`AI primary navigation fits and retains keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const screen of primaryScreens) {
      await page.goto(`/?fixture=VP-10&screen=${screen}`);
      await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      const labels = nav.locator(width < 768 ? ".nav-label-short" : ".nav-label-wide");
      await expect(labels).toHaveText(width < 768 ? ["오늘", "AI", "기록", "7일", "설정"] : navigationLabels);
      const geometry = await nav.evaluate(element => {
        const navBox = element.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth || element.scrollWidth > element.clientWidth,
          left: navBox.left, right: navBox.right,
          buttons: Array.from(element.querySelectorAll("button"), button => {
            const box = button.getBoundingClientRect();
            const label = Array.from(button.querySelectorAll("span")).find(span => getComputedStyle(span).display !== "none")!;
            const labelBox = label.getBoundingClientRect();
            return { width: box.width, height: box.height, left: box.left, right: box.right, labelLeft: labelBox.left, labelRight: labelBox.right, clipped: label.scrollWidth > label.clientWidth };
          }),
        };
      });
      expect(geometry.overflow).toBe(false);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      for (const button of geometry.buttons) {
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.labelLeft).toBeGreaterThanOrEqual(button.left);
        expect(button.labelRight).toBeLessThanOrEqual(button.right);
        expect(button.clipped).toBe(false);
      }
      const buttons = nav.getByRole("button");
      await buttons.first().focus();
      for (let index = 1; index < navigationLabels.length; index += 1) {
        await page.keyboard.press("Tab");
        await expect(buttons.nth(index)).toBeFocused();
        expect(await buttons.nth(index).evaluate(button => {
          const css = getComputedStyle(button);
          return button.matches(":focus-visible") && css.outlineStyle !== "none" && parseFloat(css.outlineWidth) >= 3;
        })).toBe(true);
      }
      for (let index = 0; index < 3; index += 1) await page.keyboard.press("Shift+Tab");
      await expect(nav.getByRole("button", { name: "AI 분석" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator('[data-scene="S11"]')).toBeVisible();
      await expect(nav.getByRole("button", { name: "AI 분석" })).toHaveAttribute("aria-current", "page");
    }
  });
}

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
    lead: "today-detail",
    secondary: ["blood-pressure", "challenge"],
    destinations: { "blood-pressure": "S04", challenge: "S03" },
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
    destinations: { "blood-pressure": "S04", challenge: "S06" },
  },
  {
    name: "BP 없음 / 새 active challenge 있음",
    window: {
      ...emptyWindow,
      active_challenge: { id: "matrix-challenge-new", action_id: "sleep-routine", starts_on: "2026-09-08", ends_on: "2026-09-14", first_checkin_on: null, status: "active" as const },
    },
    lead: "blood-pressure",
    secondary: ["challenge", "today-detail"],
    destinations: { challenge: "S06", "today-detail": "S07" },
  },
] as const;

test("primary journey navigation updates the URL and supports browser history", async ({ page }) => {
  await page.goto("/?fixture=VP-10");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();

  await page.getByRole("button", { name: "기록 찾아보기" }).click();
  await expect(page).toHaveURL(/screen=S08/);
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "7일 돌아보기", exact: true }).click();
  await expect(page).toHaveURL(/screen=S10/);
  await page.goBack();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();

  const nav = page.getByRole("navigation", { name: "주요 화면" });
  await expect(nav.getByRole("button")).toHaveCount(5);
  await nav.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.locator('[data-scene="S14"]')).toBeVisible();
  await expect(nav.getByRole("button", { name: "설정", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('[data-scene="S14"]')).not.toContainText("추가 도구");
  await expect(page.getByRole("button", { name: "선별 신호 도구 열기" })).toHaveCount(0);
  await nav.getByRole("button", { name: "AI 분석", exact: true }).click();
  await expect(page).toHaveURL(/screen=S11/);
  await expect(page.locator('[data-scene="S11"]')).toContainText("아직 준비 중이에요");
  await expect(nav.getByRole("button", { name: "AI 분석" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "설정", exact: true })).not.toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page.locator('[data-scene="S14"]')).toBeVisible();
  await expect(nav.getByRole("button", { name: "설정", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(page.locator('[data-scene="S11"]')).toBeVisible();
  await expect(nav.getByRole("button", { name: "AI 분석" })).toHaveAttribute("aria-current", "page");
});

test("record detail return follows browser history without adding a navigation loop", async ({ page }) => {
  await page.goto("/?fixture=VP-10");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();

  await page.getByRole("button", { name: "기록 찾아보기" }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  await page.locator('[data-record-kind="blood-pressure"]')
    .getByRole("button", { name: "상세 보기" })
    .first()
    .click();
  await expect(page.locator('[data-scene="S09"]')).toBeVisible();

  await page.getByRole("button", { name: "목록으로 돌아가기", exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  await page.goBack();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();

  await page.goForward();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  await page.goForward();
  await expect(page.locator('[data-scene="S09"]')).toBeVisible();
});

test("a selected fact opens its own URL-addressable detail screen", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S08");
  await page.locator('[data-record-kind="blood-pressure"]').getByRole("button", { name: "상세 보기" }).first().click();

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
