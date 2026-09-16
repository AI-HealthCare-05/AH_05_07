import { expect, test, type Page, type Route } from "@playwright/test";

const headers = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const recordWindow = {
  start_on: "2026-08-31", end_on: "2026-09-06",
  blood_pressure_observations: [{ id: "synthetic-bp", observed_on: "2026-09-06", period: "morning", systolic: 120, diastolic: 80 }],
  challenge_events: [{ id: "synthetic-legacy", observed_on: "2026-09-05", action_id: "sleep-routine", status: "skipped" }],
  active_challenge: null, challenge_checkins: [],
};

async function reply(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockWindow(page: Page) {
  const mutations: string[] = [];
  await page.route("http://e2e.invalid/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "GET") return reply(route, recordWindow);
    mutations.push(route.request().method());
    return reply(route, { detail: { code: "observation_storage_not_ready" } }, 503);
  });
  return mutations;
}

async function openDetail(page: Page) {
  await page.goto("/?e2e=signed-in&screen=S08");
  await page.locator('[data-record-kind="blood-pressure"]').getByRole("button", { name: "상세 보기" }).click();
}

test("editing cancellation returns to the same record without writing", async ({ page }) => {
  const mutations = await mockWindow(page);
  await openDetail(page);
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByLabel(/수축기/).fill("121");
  await page.getByRole("button", { name: "수정 취소" }).click();
  await expect(page).toHaveURL(/screen=S09&record=blood-pressure%3Asynthetic-bp/);
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("120/80 mmHg");

  await page.goBack();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();

  await page.goForward();
  await expect(page.locator('[data-scene="S09"]')).toBeVisible();
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("120/80 mmHg");

  expect(mutations).toEqual([]);
});

test("delete confirmation has safe initial focus, modal keyboard boundary and Escape recovery", async ({ page }) => {
  const mutations = await mockWindow(page);
  await openDetail(page);
  const trigger = page.getByRole("button", { name: "삭제", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("아침 혈압 기록을 삭제할까요?");
  await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "삭제" })).toBeFocused();
  await page.keyboard.press("Tab");
  // Native dialog may place its focus sentinel on body before cycling.
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(mutations).toEqual([]);
});

test("deleting a record opened from seven-day recap returns to the recap context", async ({ page }) => {
  let deleted = false;
  let deleteRequests = 0;

  await page.clock.setFixedTime(new Date("2026-09-06T03:00:00Z"));

  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (request.method() === "GET" && url.pathname.endsWith("/window")) {
      await reply(
        route,
        deleted
          ? { ...recordWindow, blood_pressure_observations: [] }
          : recordWindow,
      );
      return;
    }

    if (
      request.method() === "DELETE"
      && url.pathname.endsWith("/blood-pressure/synthetic-bp")
    ) {
      deleteRequests += 1;
      deleted = true;
      await route.fulfill({ status: 204, headers });
      return;
    }

    await route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();

  await page
    .locator('[data-record-lane="blood-pressure"]')
    .getByRole("button", { name: /상세 보기/ })
    .click();

  await expect(page.locator('[data-scene="S09"]')).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "7일 돌아보기로 돌아가기",
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "삭제", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "삭제", exact: true }).click();

  await expect(page.locator('[data-scene="S10"]')).toBeVisible();
  await expect(page).toHaveURL(/screen=S10/);
  await expect(page).not.toHaveURL(/record=/);

  const bloodPressureLane = page.locator('[data-record-lane="blood-pressure"]');
  await expect(bloodPressureLane).toContainText(/혈압 관찰 기록이 없습니다\./);
  await expect(bloodPressureLane).not.toContainText("120/80 mmHg");

  expect(deleteRequests).toBe(1);
});

test("a late old-period response cannot replace the newly selected period", async ({ page }) => {
  let reads = 0;
  let releaseOld: (() => void) | undefined;
  const oldResponse = new Promise<void>((resolve) => { releaseOld = resolve; });
  await page.route("http://e2e.invalid/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    reads += 1;
    if (reads === 2) {
      await oldResponse;
      return reply(route, recordWindow);
    }
    return reply(route, reads === 1 ? recordWindow : { ...recordWindow, blood_pressure_observations: [] });
  });
  await page.goto("/?e2e=signed-in&screen=S10");
  await expect(page.getByText("120/80 mmHg")).toBeVisible();
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect.poll(() => reads).toBe(2);
  await page.getByRole("button", { name: "이전 7일 보기" }).click();
  await expect(page.locator('[data-dashboard-window="prior"]')).toBeVisible();
  await expect(page.locator('[data-record-lane="blood-pressure"]')).toContainText("아직 혈압 관찰 기록이 없습니다.");
  releaseOld?.();
  await page.waitForResponse((response) => response.url().includes("/observations/window"));
  await expect(page.getByText("120/80 mmHg")).toHaveCount(0);
  expect(reads).toBe(3);
});

test("prior records remain read-only and Today returns to the current period", async ({ page }) => {
  const mutations = await mockWindow(page);
  await page.goto("/?e2e=signed-in&screen=S08");
  await page.getByRole("button", { name: "이전 7일 보기" }).click();
  await expect(page.locator('[data-read-only-window]')).toContainText("읽기 전용");
  await page.locator('[data-record-kind="blood-pressure"]').getByRole("button", { name: "상세 보기" }).click();
  await expect(page.getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
  await page.locator('[data-read-only-window]').getByRole("button", { name: "현재 7일 보기" }).click();
  await expect(page).not.toHaveURL(/dashboard_window=prior/);
  await expect(page.locator('[data-read-only-window]')).toHaveCount(0);
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await page.locator('[data-record-kind="legacy"]').getByRole("button", { name: "상세 보기" }).click();
  await expect(page.locator('[data-record-detail-kind="legacy"]')).toContainText("날짜가 현재 7일에 포함되어도 수정하거나 삭제할 수 없어요.");
  expect(mutations).toEqual([]);
});

const localBloodPressureValidationCases = [
  {
    name: "missing date",
    observedOn: "",
    systolic: "120",
    diastolic: "80",
    invalid: "#observed-on",
    valid: ["#systolic", "#diastolic"],
    message: "날짜를 선택해 주세요.",
  },
  {
    name: "systolic range",
    observedOn: null,
    systolic: "261",
    diastolic: "80",
    invalid: "#systolic",
    valid: ["#observed-on", "#diastolic"],
    message: "수축기 값은 60에서 260 사이의 정수로 입력해 주세요.",
  },
  {
    name: "diastolic range",
    observedOn: null,
    systolic: "120",
    diastolic: "29",
    invalid: "#diastolic",
    valid: ["#observed-on", "#systolic"],
    message: "이완기 값은 30에서 160 사이의 정수로 입력해 주세요.",
  },
  {
    name: "systolic and diastolic relationship",
    observedOn: null,
    systolic: "80",
    diastolic: "90",
    invalid: "#systolic",
    valid: ["#observed-on", "#diastolic"],
    message: "수축기 값은 이완기 값보다 크게 입력해 주세요.",
  },
] as const;

for (const scenario of localBloodPressureValidationCases) {
  test(`S04 local validation targets only the field that needs correction: ${scenario.name}`, async ({ page }) => {
    const mutations = await mockWindow(page);
    await page.goto("/?e2e=signed-in&screen=S04");

    if (scenario.observedOn !== null) {
      await page.locator("#observed-on").fill(scenario.observedOn);
    }
    await page.locator("#systolic").fill(scenario.systolic);
    await page.locator("#diastolic").fill(scenario.diastolic);
    await page.getByRole("button", { name: "혈압 기록 저장" }).click();

    const invalid = page.locator(scenario.invalid);
    await expect(invalid).toBeFocused();
    await expect(invalid).toHaveAttribute("aria-invalid", "true");
    await expect(invalid).toHaveAttribute("aria-describedby", /\bblood-pressure-error\b/);
    await expect(page.getByRole("alert")).toHaveText(scenario.message);

    for (const selector of scenario.valid) {
      const field = page.locator(selector);
      await expect(field).not.toHaveAttribute("aria-invalid", "true");
      const describedBy = await field.getAttribute("aria-describedby");
      expect(describedBy ?? "").not.toMatch(/\bblood-pressure-error\b/);
    }

    await expect(page.locator("#systolic")).toHaveValue(scenario.systolic);
    await expect(page.locator("#diastolic")).toHaveValue(scenario.diastolic);
    expect(mutations).toEqual([]);
  });
}

test("reduced motion makes first-record navigation scroll immediate", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=VP-04");
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();

  await page.evaluate(() => {
    const originalScrollTo = window.scrollTo.bind(window);
    const trackedWindow = window as Window & { __sk7LastScrollBehavior?: ScrollBehavior };
    window.scrollTo = ((optionsOrX: ScrollToOptions | number, y?: number) => {
      if (typeof optionsOrX === "object") {
        trackedWindow.__sk7LastScrollBehavior = optionsOrX.behavior;
        originalScrollTo(optionsOrX);
        return;
      }
      originalScrollTo(optionsOrX, y ?? 0);
    }) as typeof window.scrollTo;
  });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "혈압 기록하기" }).click();

  expect(
    await page.evaluate(
      () => (window as Window & { __sk7LastScrollBehavior?: ScrollBehavior }).__sk7LastScrollBehavior,
    ),
  ).toBe("auto");
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await expect(page.locator('[data-scene="S04"] h1')).toBeFocused();
  await expect(page.locator('[data-scene="S04"] h1')).toBeInViewport();
});

test("422 input rejection is distinguished from an uncertain write", async ({ page }) => {
  let writes = 0;
  await page.route("http://e2e.invalid/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "GET") return reply(route, recordWindow);
    writes += 1;
    return reply(route, { detail: [{ type: "date_from_datetime_parsing" }] }, 422);
  });
  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect(page.getByRole("status")).toContainText("날짜와 값의 형식을 확인한 뒤 수정해 주세요.");
  await expect(page.getByText("처리 결과 확인 필요")).toHaveCount(0);
  await expect(page.getByLabel(/수축기/)).toHaveValue("120");
  expect(writes).toBe(1);
});

for (const viewport of [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
  { name: "320", width: 320, height: 844 },
  { name: "zoom-200-layout", width: 683, height: 384 },
]) {
  test(`record tasks and keyboard focus reflow at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockWindow(page);
    await openDetail(page);
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "취소" })).toBeInViewport();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#observed-on")).toBeFocused();
    for (let index = 0; index < 12; index += 1) {
      const visibleFocus = await page.evaluate(() => {
        const focused = document.activeElement as HTMLElement;
        const box = focused.getBoundingClientRect();
        const nav = document.querySelector(".primary-nav") as HTMLElement;
        const bottom = getComputedStyle(nav).position === "fixed" ? nav.getBoundingClientRect().top : innerHeight;
        return {
          tag: focused.tagName, field: focused.id,
          rectangle: [box.left, box.top, box.right, box.bottom], bottom,
          visible: box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= bottom
            && getComputedStyle(focused).outlineStyle !== "none",
        };
      });
      expect(visibleFocus.visible, JSON.stringify(visibleFocus)).toBe(true);
      if (await page.getByRole("button", { name: "수정 취소" }).evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    for (const screen of ["S02", "S04", "S08", "S10", "S11", "S14"]) {
      await page.goto(`/?fixture=VP-10&screen=${screen}`);
      await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-${screen}.png`), fullPage: true });
    }
  });
}

test("enlarged text retains content and the skip link reaches the scene", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/?fixture=VP-10&screen=S04");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "본문으로 건너뛰기" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#scene-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#observed-on")).toBeFocused();
});
