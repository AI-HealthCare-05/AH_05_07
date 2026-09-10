import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "boundary", width: 320, height: 568 },
] as const;

for (const viewport of viewports) {
  test(`Calm Clay journey has no horizontal overflow at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/?fixture=VP-10");
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const controls = page.locator("button, input, select");
    const count = await controls.count();
    for (let index = 0; index < count; index += 1) {
      const box = await controls.nth(index).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: testInfo.outputPath(`r2-visual-${viewport.name}.png`), fullPage: true });
  });
}

test("S01 login gate remains usable at the smallest viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByLabel("이메일")).toBeInViewport();
  await expect(page.getByRole("button", { name: "이메일로 계속하기" })).toBeInViewport();
});

test("reduced motion keeps the main scenes understandable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=VP-10");
  await page.getByRole("button", { name: "기록 찾아보기" }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await page.getByRole("button", { name: "생활정보 기반 고혈압 선별 참고" }).click();
  await expect(page.locator('[data-scene="S11"]')).toContainText("아직 준비 중이에요");
});

test("mobile navigation stays reachable and never covers scene content", async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const screen of ["S02", "S04", "S08", "S10"] as const) {
      await page.goto(`/?fixture=VP-10&screen=${screen}`);
      const nav = page.locator(".primary-nav");
      await expect(nav).toBeVisible();
      const navGeometry = await nav.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return { position: style.position, bottom: box.bottom, viewportBottom: innerHeight, height: box.height, declaredHeight: style.getPropertyValue("--sk7-mobile-nav-height") };
      });
      expect(navGeometry.position).toBe("fixed");
      expect(navGeometry.bottom).toBeGreaterThanOrEqual(viewport.height - 1);
      expect(navGeometry.height).toBeGreaterThanOrEqual(72);
      expect(navGeometry.declaredHeight).toBe("4.75rem");
      await expect(nav.locator(".nav-label-short")).toHaveCount(5);
      await expect(nav.locator(".is-active")).toBeVisible();

      await page.evaluate(() => document.scrollingElement?.scrollTo(0, document.scrollingElement?.scrollHeight ?? 0));
      const lastContentControl = page.locator(`[data-scene="${screen}"] button, [data-scene="${screen}"] input, [data-scene="${screen}"] select, [data-scene="${screen}"] summary`).last();
      const contentGeometry = await lastContentControl.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const navRect = document.querySelector(".primary-nav")!.getBoundingClientRect();
        return { controlBottom: rect.bottom, navTop: navRect.top };
      });
      expect(contentGeometry.controlBottom).toBeLessThanOrEqual(contentGeometry.navTop + 1);
    }
  }
});

test("primary navigation remains usable from the middle of a long mobile recap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fixture=VP-10&screen=S10");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await expect(page.getByRole("button", { name: "오늘의 기록", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await expect(page).not.toHaveURL(/screen=/);
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
});

test("200% layout proxy keeps compact navigation labels readable", async ({ page }) => {
  await page.setViewportSize({ width: 683, height: 384 });
  await page.goto("/?fixture=VP-10&screen=S11");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const labels = page.locator(".primary-nav .nav-label-short");
  await expect(labels).toHaveCount(5);
  for (let index = 0; index < await labels.count(); index += 1) {
    const box = await labels.nth(index).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 99).toBeLessThan(40);
  }
});

test("S10 recap keeps separate facts in a compact grouped structure", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S10");
  const scene = page.locator('[data-scene="S10"]');
  await expect(scene).toBeVisible();
  const surfaceCount = await scene.locator(".recap-summary, .challenge-progress-card, .record-lane").count();
  expect(surfaceCount).toBeLessThanOrEqual(5);
  await expect(scene.getByText("챌린지 진행률이 아닙니다.", { exact: true })).toHaveCount(1);
  await expect(scene.locator('[data-dashboard-lane="blood-pressure"]')).toContainText("혈압 관찰");
  await expect(scene.locator('[data-dashboard-lane="challenge"]')).toContainText("최근 7일 챌린지 체크인 기록");
  await expect(scene.locator('[data-dashboard-lane="legacy"]')).toContainText("이전 방식의 기록");
});

test("programmatic H1 focus is quieter than interactive focus", async ({ page }) => {
  await page.goto("/?fixture=VP-10&screen=S04");
  const focus = await page.getByRole("heading", { level: 1 }).evaluate((element) => {
    const heading = element as HTMLElement;
    const button = document.querySelector("form button") as HTMLElement;
    button.focus();
    const buttonOutline = getComputedStyle(button);
    heading.focus();
    const headingOutline = getComputedStyle(heading);
    return { headingStyle: headingOutline.outlineStyle, headingWidth: headingOutline.outlineWidth, buttonWidth: buttonOutline.outlineWidth };
  });
  expect(focus.headingStyle).toBe("dotted");
  expect(focus.headingWidth).toBe("1px");
  expect(focus.buttonWidth).toBe("3px");
});
