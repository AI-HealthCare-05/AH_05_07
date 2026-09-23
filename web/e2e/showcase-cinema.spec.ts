import { expect, test, type Page } from "@playwright/test";

const filmUrl =
  "https://sk7-companion.gkrry.com/showcase/v1/video/showcase-final-v1-9094ae558239.mp4";
const posterUrl =
  "https://sk7-companion.gkrry.com/showcase/v1/images/showcase-poster-public-v1-2b8e766efde1.jpg";

async function installSyntheticApi(page: Page) {
  await page.clock.setFixedTime(new Date("2026-09-11T03:00:00Z"));
  await page.route("http://e2e.invalid/**", async route => {
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
      const endOn = url.searchParams.get("end_on") ?? "2026-09-11";
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        headers,
        body: JSON.stringify({
          start_on: url.searchParams.get("start_on"),
          end_on: endOn,
          blood_pressure_observations: [{
            id: "cinema-synthetic-record",
            observed_on: endOn,
            period: "morning",
            systolic: 118,
            diastolic: 76,
          }],
          challenge_events: [],
          active_challenge: null,
          challenge_checkins: [],
        }),
      });
      return;
    }

    await route.abort();
  });
}

function showcaseEntry(page: Page) {
  return page.locator(".sk7-showcase-entry-button");
}

test.describe("SK7 cinema showcase portal", () => {
  test("keeps the signed-out landing intact and adds one lightweight Showcase entry", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.goto("/");

    await expect(page.locator('main.journey-login[data-scene="S01"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /측정한 혈압을 기록하고/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인 없이 30초 맛보기", exact: true })).toBeVisible();

    await expect(page.locator("#sk7-showcase-cinema-portal")).toHaveCount(1);
    const entry = showcaseEntry(page);
    await expect(entry).toHaveCount(1);
    await expect(entry).toBeVisible();
    await expect(entry).toContainText("SHOWCASE");
    await expect(entry).toContainText("Seven days can tell a story.");
    await expect(entry).toContainText("04:00");
    await expect(entry).toContainText("WATCH THE FILM");

    expect(pageErrors).toEqual([]);
  });

  test("opens a cinema dialog, attaches the film only after intent, and exposes a small details link", async ({ page }) => {
    const filmRequests: string[] = [];
    await page.route(filmUrl, async route => {
      filmRequests.push(route.request().url());
      await route.abort("failed");
    });

    await page.goto("/");
    const entry = showcaseEntry(page);
    await expect(entry).toBeVisible();
    expect(filmRequests).toEqual([]);
    const dialog = page.locator("dialog.sk7-cinema-dialog");
    const video = dialog.locator("video");
    await expect(video).not.toHaveAttribute("poster", /.+/);

    await entry.click();

    await expect(dialog).toHaveAttribute("open", "");
    await expect(dialog.getByRole("heading", { name: "Seven days can tell a story." })).toBeVisible();
    await expect(dialog.locator(".sk7-cinema-details")).toHaveAttribute("href", "/showcase/");

    await expect(video).toHaveAttribute("poster", posterUrl);
    await expect(video).toHaveAttribute("src", filmUrl);
    await expect.poll(() => filmRequests.length).toBeGreaterThan(0);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open", "");
    await expect(entry).toBeFocused();
    await expect(video).not.toHaveAttribute("src", /.+/);
    await expect(video).not.toHaveAttribute("poster", /.+/);
  });

  test("does not expose the Showcase entry inside the signed-in product journey", async ({ page }) => {
    await installSyntheticApi(page);
    await page.goto("/?e2e=signed-in&screen=S02");

    await expect(page.locator(".app-shell")).toHaveAttribute("data-screen", "S02", { timeout: 15_000 });
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    await expect(page.locator("#sk7-showcase-cinema-portal")).toBeHidden();
    await expect(page.locator(".sk7-showcase-entry")).toBeHidden();
  });

  test("details archive is a separate static destination with no product API traffic", async ({ page }) => {
    const productRequests: string[] = [];
    page.on("request", request => {
      if (/\/api\/v1\/|supabase|model-v2/i.test(request.url())) productRequests.push(request.url());
    });

    await page.goto("/showcase/");

    await expect(page.locator("#arrival-title")).toBeVisible();
    await expect(page.locator("#interpretation-title")).toContainText("분석은,");
    await expect(page.locator("#companion-title")).toContainText("기록 곁에,");
    await expect(page.locator(".sc-open-app").filter({ hasText: "서비스 열기" })).toHaveAttribute("href", "/");
    expect(productRequests).toEqual([]);
  });

  test("cinema composition has no horizontal overflow at 390 and 320", async ({ page }) => {
    for (const [width, height] of [[390, 844], [320, 568]] as const) {
      await page.setViewportSize({ width, height });
      await page.route(filmUrl, route => route.abort("failed"));
      await page.goto("/");

      const entry = showcaseEntry(page);
      await expect(entry).toBeVisible();
      await entry.click();

      const dialog = page.locator("dialog.sk7-cinema-dialog");
      await expect(dialog).toHaveAttribute("open", "");

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);

      await page.keyboard.press("Escape");
      await expect(dialog).not.toHaveAttribute("open", "");
    }
  });

  test("reduced motion and direct film deep-link remain usable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route(filmUrl, route => route.abort("failed"));
    await page.goto("/?showcase=film");

    const dialog = page.locator("dialog.sk7-cinema-dialog");
    await expect(dialog).toHaveAttribute("open", "", { timeout: 10_000 });
    await expect(dialog.locator(".sk7-cinema-details")).toBeVisible();
    await expect(dialog.locator(".sk7-cinema-seats")).toBeVisible();
  });
});
