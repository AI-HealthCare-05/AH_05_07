import { expect, test, type Page } from "@playwright/test";

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

type FoundationScreenId = (typeof screens)[number]["id"] | (typeof challengeFactScreens)[number]["id"];

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
