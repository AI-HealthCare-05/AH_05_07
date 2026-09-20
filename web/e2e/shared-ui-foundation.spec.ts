import { expect, test, type Page } from "@playwright/test";

const screens = [
  { id: "S12", url: "/?fixture=VP-04" },
  { id: "S13", url: "/?fixture=VP-11a" },
  { id: "S14", url: "/?fixture=VP-10&screen=S14" },
] as const;

async function expectFoundation(page: Page, id: (typeof screens)[number]["id"]) {
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
