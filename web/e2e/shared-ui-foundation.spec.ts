import { expect, test, type Page } from "@playwright/test";

const primaryTabs = ["S02", "S11", "S08", "S10", "S14"] as const;

async function shellPresentation(page: Page) {
  return page.evaluate(() => {
    const element = (selector: string) => document.querySelector<HTMLElement>(selector)!;
    const rect = (selector: string) => {
      const bounds = element(selector).getBoundingClientRect();
      return [bounds.x, bounds.y, bounds.width, bounds.height].map(value => Math.round(value * 100) / 100);
    };
    const styles = (selector: string, properties: string[]) => {
      const computed = getComputedStyle(element(selector));
      return properties.map(property => computed.getPropertyValue(property));
    };
    const brand = element(".brand-button");

    return {
      shell: styles(".app-shell", ["padding-inline", "background-color", "background-image"]),
      header: rect(".app-header"),
      brand: {
        rect: rect(".brand-button"),
        styles: styles(".brand-button", ["flex-direction", "gap"]),
        markRect: rect(".brand-mark"),
        nameRect: rect(".brand-button > span:last-child"),
        nameStyles: styles(".brand-button strong", ["font-size", "font-weight", "letter-spacing"]),
        markFirst: brand.firstElementChild?.classList.contains("brand-mark") === true,
      },
      contentStart: rect(".scene-viewport").slice(0, 3),
      navigation: {
        rect: rect(".primary-nav"),
        styles: styles(".primary-nav", ["position", "padding", "background-color", "border-radius", "box-shadow"]),
        cells: Array.from(document.querySelectorAll<HTMLElement>(".primary-nav button"), button => {
          const bounds = button.getBoundingClientRect();
          return [bounds.width, bounds.height].map(value => Math.round(value * 100) / 100);
        }),
        active: styles(".primary-nav .is-active", ["background-color", "color", "border-radius", "box-shadow"]),
      },
    };
  });
}

for (const viewport of [
  { name: "320-short", width: 320, height: 568 },
  { name: "390", width: 390, height: 844 },
]) {
  test(`primary tabs share one outer shell at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let reference: Awaited<ReturnType<typeof shellPresentation>> | undefined;

    for (const screen of primaryTabs) {
      await page.goto(`/?fixture=VP-10&screen=${screen}`);
      await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
      const presentation = await shellPresentation(page);

      expect(presentation.brand.markFirst).toBe(true);
      expect(presentation.brand.markRect[0] + presentation.brand.markRect[2]).toBeLessThanOrEqual(presentation.brand.nameRect[0]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (reference) expect(presentation).toEqual(reference);
      else reference = presentation;
    }
  });
}

test("loading and ready states keep the same outer shell", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-09-11T03:00:00Z"));
  let release!: () => void;
  const heldWindow = new Promise<void>(resolve => { release = resolve; });
  const headers = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
  await page.route("http://e2e.invalid/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    await heldWindow;
    return route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify({
        start_on: "2026-09-05",
        end_on: "2026-09-11",
        blood_pressure_observations: [{ id: "shell-observation", observed_on: "2026-09-11", period: "morning", systolic: 120, diastolic: 80 }],
        challenge_events: [],
        active_challenge: null,
        challenge_checkins: [],
      }),
    });
  });

  await page.goto("/?e2e=signed-in&screen=S02");
  await expect(page.locator('[data-journey-skeleton-family="today"]')).toBeVisible();
  const loading = await shellPresentation(page);
  release();
  await expect(page.locator(".journey-today")).toBeVisible();
  expect(await shellPresentation(page)).toEqual(loading);
});

const screens = [
  { id: "S12", url: "/?fixture=VP-04" },
  { id: "S13", url: "/?fixture=VP-11a" },
  { id: "S14", url: "/?fixture=VP-10&screen=S14" },
] as const;

const challengeFactScreens = [
  { id: "S03", url: "/?fixture=VP-07a&screen=S03" },
  { id: "S06", url: "/?fixture=VP-07a&screen=S06" },
  { id: "S07", url: "/?fixture=VP-07a&screen=S07" },
] as const;

const bloodPressureScreen = { id: "S04", url: "/?fixture=VP-10&screen=S04" } as const;

type FoundationScreenId = (typeof screens)[number]["id"] | (typeof challengeFactScreens)[number]["id"] | typeof bloodPressureScreen.id;

async function expectFoundation(page: Page, id: FoundationScreenId) {
  const scene = page.locator(`[data-scene="${id}"]`);
  await expect(scene).toBeVisible();
  await expect(scene).toHaveClass(/\bsurface\b/);
  await expect(scene.locator(":scope > .screen-header")).toHaveCount(1);
  if (id === "S12") await expect(scene.locator(".action-group")).toHaveCount(1);
  if (id === "S13") await expect(scene.locator(".status-notice")).toHaveCount(1);
  if (id === "S14") expect(await scene.locator(".section-header").count()).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const viewport of [
  { name: "320-short", width: 320, height: 568 },
  { name: "390", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
]) {
  test(`S04 shared foundation preserves the measurement form at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(bloodPressureScreen.url);
    await expectFoundation(page, bloodPressureScreen.id);

    const scene = page.locator('[data-scene="S04"]');
    const form = scene.locator(".measurement-panel");
    await expect(form.locator(".form-actions.action-group")).toHaveCount(1);
    await expect(form.locator(".measurement-guide.section-header")).toHaveCount(1);

    const formPresentation = await form.evaluate((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, borderTopStyle: style.borderTopStyle, boxShadow: style.boxShadow };
    });
    expect(formPresentation).toEqual({ backgroundColor: "rgba(0, 0, 0, 0)", borderTopStyle: "solid", boxShadow: "none" });

    const systolicBox = await scene.locator("#systolic").boundingBox();
    const diastolicBox = await scene.locator("#diastolic").boundingBox();
    expect(systolicBox).not.toBeNull();
    expect(diastolicBox).not.toBeNull();
    expect(Math.abs(systolicBox!.y - diastolicBox!.y)).toBeLessThanOrEqual(1);

    if (viewport.name === "320-short") {
      const pairBox = await scene.locator(".bp-measurement-pair").boundingBox();
      const saveButton = scene.getByRole("button", { name: "혈압 기록 저장" });
      const nav = page.locator(".primary-nav");
      const navBox = await nav.boundingBox();
      expect(pairBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(pairBox!.y + pairBox!.height).toBeLessThanOrEqual(navBox!.y);

      await saveButton.evaluate((element) => element.scrollIntoView({ block: "center" }));
      await expect(saveButton).toBeInViewport();
      const scrolledSaveBox = await saveButton.boundingBox();
      const scrolledNavBox = await nav.boundingBox();
      expect(scrolledSaveBox).not.toBeNull();
      expect(scrolledNavBox).not.toBeNull();
      expect(scrolledSaveBox!.y + scrolledSaveBox!.height).toBeLessThanOrEqual(scrolledNavBox!.y);
    }
  });
}

test("S04 help and validation reuse shared notice hierarchy", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    return route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify({
        start_on: "2026-09-14",
        end_on: "2026-09-20",
        blood_pressure_observations: [],
        active_challenge: null,
        challenge_checkins: [],
        challenge_events: [],
      }),
    });
  });
  await page.goto("/?e2e=signed-in&screen=S04");

  await page.locator("#observed-on").fill("2026-09-11");
  await expect(page.locator(".bp-draft-note.status-notice")).toBeVisible();
  await page.locator("#systolic").fill("59");
  await page.locator("#diastolic").fill("70");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect(page.locator("#blood-pressure-error.field-error.status-notice")).toBeVisible();
});

for (const viewport of [
  { name: "320", width: 320, height: 568 },
  { name: "390", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
]) {
  test(`S03/S06/S07 shared foundation reflows at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);

    for (const screen of challengeFactScreens) {
      await page.goto(screen.url);
      await expectFoundation(page, screen.id);
    }

    const s03 = page.locator('[data-scene="S03"]');
    await page.goto(challengeFactScreens[0].url);
    await expect(s03.locator('.challenge-choice-context.status-notice')).toHaveCount(1);
    await expect(s03.locator('.journey-challenge-actions.action-group')).toHaveCount(1);

    await page.goto(challengeFactScreens[1].url);
    const s06 = page.locator('[data-scene="S06"]');
    await expect(s06.locator('.journey-challenge-summary-card.section-header')).toHaveCount(2);
    await expect(s06.locator('.journey-challenge-next-actions.action-group')).toHaveCount(1);
    const s06CardStyle = await s06.locator('.journey-challenge-summary-card').first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, borderRadius: style.borderRadius, boxShadow: style.boxShadow };
    });
    expect(s06CardStyle).toEqual({ backgroundColor: "rgba(0, 0, 0, 0)", borderRadius: "0px", boxShadow: "none" });

    await page.goto(challengeFactScreens[2].url);
    const s07 = page.locator('[data-scene="S07"]');
    const factLanes = s07.locator('.fact-lanes > section');
    await expect(factLanes).toHaveCount(3);
    expect(await factLanes.evaluateAll((elements) => elements.every((element) => element.classList.contains("section-header")))).toBe(true);
    await expect(s07.locator('.journey-today-actions.action-group')).toHaveCount(1);
    const leadBox = await factLanes.first().boundingBox();
    const secondaryBox = await factLanes.nth(1).boundingBox();
    expect(leadBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    if (viewport.width > 820) expect(leadBox!.width).toBeGreaterThan(secondaryBox!.width);
    else expect(leadBox!.y).toBeLessThan(secondaryBox!.y);
    const factStyles = await factLanes.evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
    }));
    expect(factStyles).toEqual([
      { backgroundColor: "rgba(0, 0, 0, 0)", boxShadow: "none" },
      { backgroundColor: "rgba(0, 0, 0, 0)", boxShadow: "none" },
      { backgroundColor: "rgba(0, 0, 0, 0)", boxShadow: "none" },
    ]);
  });
}

for (const viewport of [
  { name: "320", width: 320, height: 568 },
  { name: "390", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
]) {
  test(`S12-S14 shared foundation reflows at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);

    for (const screen of screens) {
      await page.goto(screen.url);
      await expectFoundation(page, screen.id);
    }

    const settingsRows = page.locator(".journey-settings-section");
    if (await settingsRows.count()) {
      const rowPresentation = await settingsRows.first().evaluate((element) => {
        const style = getComputedStyle(element);
        return { boxShadow: style.boxShadow, borderTopStyle: style.borderTopStyle };
      });
      expect(rowPresentation.boxShadow).toBe("none");
      expect(rowPresentation.borderTopStyle).toBe("solid");
    }
  });
}

test("S12-S14 and account deletion dialog reflow with 200% text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const screen of screens) {
    await page.goto(screen.url);
    await page.locator("html").evaluate((element) => { element.style.fontSize = "200%"; });
    await expectFoundation(page, screen.id);
  }

  const trigger = page.getByRole("button", { name: "계정 삭제", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveClass(/\bsurface\b/);
  await expect(dialog.locator(":scope > .screen-header")).toHaveCount(1);
  await expect(dialog.locator(":scope > .action-group")).toHaveCount(1);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(trigger).toBeFocused();
});
