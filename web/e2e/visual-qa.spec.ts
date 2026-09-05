import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
  { name: "boundary", width: 320, height: 844 },
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

test("reduced motion keeps the main scenes understandable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=VP-10");
  await page.getByRole("button", { name: "기록 찾아보기" }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await page.getByRole("button", { name: "입력 기반 위험군 선별 신호" }).click();
  await expect(page.locator('[data-scene="S11"]')).toContainText("아직 준비 중이에요");
});

test("R2 visual failures preserve the semantic journey and its controls", async ({ page }) => {
  await page.route("https://sk7-assets.gomdory.com/**", async (route) => route.abort("failed"));
  await page.goto("/?fixture=VP-10");

  await expect(page.locator('[data-scene="S02"]')).toContainText("오늘의 기록");
  await expect(page.getByRole("button", { name: "기록 찾아보기" })).toBeEnabled();
  await page.getByRole("button", { name: "기록 찾아보기" }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
});
