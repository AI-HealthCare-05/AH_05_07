import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { resolveSceneVisuals, visualAssetCatalog } from "../src/ui/r2VisualAssets";

const localWebp = readFile(new URL("../public/assets/moa-journey-map-v1-mobile.webp", import.meta.url));

const visualCases = [
  { screen: "S02", fixture: "VP-10", asset: "scene.S02.homeBase", cta: "button" },
  { screen: "S06", fixture: "VP-07a", asset: "scene.S06.challengeLocked", cta: "혈압 기록하기" },
  { screen: "S12", fixture: "VP-04", asset: "scene.S12.empty", cta: "혈압 기록하기" },
  { screen: "S13", fixture: "VP-11a", asset: "scene.S13.retry", cta: "다시 불러오기" },
] as const;

async function routeVisualAssets(page: Page, mode: "fulfill" | "abort") {
  const body = mode === "fulfill" ? await localWebp : undefined;
  await page.route("**/visual/v1/**", async (route) => {
    if (mode === "abort") return route.abort();
    return route.fulfill({ status: 200, contentType: "image/webp", body });
  });
}

async function openVisualCase(page: Page, item: (typeof visualCases)[number]) {
  if (item.screen === "S06") {
    await page.route("http://e2e.invalid/**", async (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (new URL(route.request().url()).pathname === "/api/v1/observations/window") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            start_on: "2026-09-02",
            end_on: "2026-09-08",
            blood_pressure_observations: [],
            challenge_events: [],
            active_challenge: {
              id: "visual-e2e-challenge",
              action_id: "walk-10-minutes",
              starts_on: "2026-09-02",
              ends_on: "2026-09-08",
              first_checkin_on: "2026-09-02",
              status: "active",
            },
            challenge_checkins: [{
              id: "visual-e2e-checkin",
              challenge_id: "visual-e2e-challenge",
              action_id: "walk-10-minutes",
              observed_on: "2026-09-02",
              status: "completed",
            }],
          }),
        });
      }
      return route.abort();
    });
    await page.goto("/?e2e=signed-in&screen=S06");
  } else {
    await page.goto(`/?fixture=${item.fixture}&screen=${item.screen}`);
  }
  await expect(page.locator(`[data-scene="${item.screen}"]`)).toBeVisible();
}

test("visual catalog maps approved runtime assets and keeps S05 saved inactive", async () => {
  expect(visualAssetCatalog["scene.S02.homeBase"].currentObjectKey).toBe("visual/v1/characters/sk7-character-base-cream-v01.webp");
  expect(visualAssetCatalog["scene.S02.homeBase"].plannedV2ObjectKey).toBe("visual/v2/scenes/s02/home-base.webp");
  expect(visualAssetCatalog["scene.S06.challengeLocked"].active).toBe(true);
  expect(visualAssetCatalog["scene.S12.empty"].active).toBe(true);
  expect(visualAssetCatalog["scene.S13.retry"].active).toBe(true);
  expect(visualAssetCatalog["scene.S05.saveSuccess"].active).toBe(false);
  expect(visualAssetCatalog["scene.S05.saveSuccess"].reason).toContain("production S05 companion");
});

test("visual assets never own state semantics", async ({ page }) => {
  await routeVisualAssets(page, "fulfill");
  for (const item of visualCases) {
    await openVisualCase(page, item);
    const image = page.locator(`[data-visual-asset-id="${item.asset}"]`);
    await expect(image).toHaveAttribute("alt", "");
    await expect(image).toHaveAttribute("aria-hidden", "true");
    await expect(image).toHaveAttribute("data-load-state", "ready");
    if (item.screen === "S02") await expect(page.locator(`[data-scene="${item.screen}"] .home-lead button`)).toBeVisible();
    else await expect(page.locator(`[data-scene="${item.screen}"]`).getByRole("button", { name: item.cta })).toBeVisible();
  }
});

test("blocked visual/v1 requests fall back quietly to live HTML and actions", async ({ page }) => {
  await routeVisualAssets(page, "abort");
  for (const item of visualCases) {
    await openVisualCase(page, item);
    await expect(page.locator(`[data-visual-asset-id="${item.asset}"]`)).toHaveCount(0);
    if (item.screen === "S02") await expect(page.locator(`[data-scene="${item.screen}"] .home-lead button`)).toBeVisible();
    else await expect(page.locator(`[data-scene="${item.screen}"]`).getByRole("button", { name: item.cta })).toBeVisible();
  }
});

for (const viewport of [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "boundary", width: 320, height: 568 },
  { name: "zoom-proxy", width: 683, height: 384 },
] as const) {
  test(`visual layers preserve responsive layout at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await routeVisualAssets(page, "fulfill");
    for (const item of visualCases) {
      await openVisualCase(page, item);
      const scene = page.locator(`[data-scene="${item.screen}"]`);
      const actions = item.screen === "S02" ? scene.locator(".home-lead button") : scene.getByRole("button", { name: item.cta });
      await expect(actions).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const nav = page.locator(".primary-nav");
      const navGeometry = await nav.evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return { fixed: style.position === "fixed", top: rect.top };
      });
      if (navGeometry.fixed) {
        await page.evaluate(() => document.scrollingElement?.scrollTo(0, document.scrollingElement?.scrollHeight ?? 0));
        const actionBottoms = await actions.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().bottom));
        expect(actionBottoms.every((bottom) => bottom <= navGeometry.top + 1)).toBe(true);
      }
      if (item.screen === "S02" && viewport.width === 1366) {
        const overlaps = await page.evaluate(() => {
          const visual = document.querySelector('[data-visual-asset-id="scene.S02.homeBase"]')?.getBoundingClientRect();
          const lead = document.querySelector(".home-lead button")?.getBoundingClientRect();
          const dates = [...document.querySelectorAll(".week-path li")].map((element) => element.getBoundingClientRect());
          if (!visual || !lead) return true;
          const intersects = (left: DOMRect, right: DOMRect) => left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
          return intersects(visual, lead) || dates.some((date) => intersects(visual, date));
        });
        expect(overlaps).toBe(false);
      }
    }
  });
}

test("S05 does not render the inactive 2D saved asset", async ({ page }) => {
  expect(resolveSceneVisuals("S05").illustration).toBeUndefined();
  expect(visualAssetCatalog["scene.S05.saveSuccess"].active).toBe(false);
});
