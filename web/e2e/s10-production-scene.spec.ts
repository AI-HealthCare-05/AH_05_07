import { expect, test, type Page } from "@playwright/test";

import { companionAssetManifest } from "../src/ui/companionAssets.generated";

type SyntheticFacts = Readonly<{
  systolic?: number;
  diastolic?: number;
  challengeStatus?: "completed" | "skipped";
}>;

function sceneGlbRequests(urls: string[]) {
  return urls.filter(url =>
    /sk7-companion\.gkrry\.com\/companion\/v1\/.+\.glb(?:\?|$)/i.test(url),
  );
}

async function installSyntheticApi(page: Page, facts: SyntheticFacts = {}) {
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
            id: "synthetic-existing",
            observed_on: endOn,
            period: "morning",
            systolic: facts.systolic ?? 118,
            diastolic: facts.diastolic ?? 76,
          }],
          challenge_events: [],
          active_challenge: facts.challengeStatus ? {
            id: "synthetic-challenge",
            action_id: "walk-10-minutes",
            starts_on: endOn,
            ends_on: endOn,
          } : null,
          challenge_checkins: facts.challengeStatus ? [{
            id: "synthetic-checkin",
            challenge_id: "synthetic-challenge",
            observed_on: endOn,
            action_id: "walk-10-minutes",
            status: facts.challengeStatus,
          }] : [],
        }),
      });
      return;
    }

    await route.abort();
  });
}

async function openProductionS10(page: Page, species: string | null, query = "") {
  await page.clock.setFixedTime(new Date("2026-09-11T03:00:00Z"));
  if (species !== null) {
    await page.addInitScript(savedSpecies => {
      localStorage.setItem("sk7-companion-species", savedSpecies);
    }, species);
  }

  await page.goto(`/?e2e=signed-in&screen=S10${query}`);
  const stage = page.locator('.living-visual-stage[data-living-scene="S10"]');
  await stage.scrollIntoViewIfNeeded();
  return stage;
}

test("production S10 full scene owns saved identity and suppresses the separate companion", async ({ page }) => {
  await installSyntheticApi(page);

  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));

  const stage = await openProductionS10(
    page,
    "cat",
    "&companion_species=rabbit&companion_variant=standard&companion_clip=special",
  );

  await expect(page.locator(".journey-recap")).toBeVisible();
  await expect(stage).toHaveCount(1);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
  await expect(page.locator("[data-companion-canvas]")).toHaveCount(0);

  await expect.poll(() => sceneGlbRequests(requests)).toEqual([
    companionAssetManifest.cat.lite.url,
  ]);
  expect(sceneGlbRequests(requests)).not.toContain(
    companionAssetManifest.rabbit.standard.url,
  );
});

test("production S10 invalid saved identity fails safe to bear-lite with one owner", async ({ page }) => {
  await installSyntheticApi(page);
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));

  const stage = await openProductionS10(
    page,
    "seal",
    "&companion_species=fox&companion_variant=standard",
  );

  await expect(stage).toHaveCount(1);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );
  await expect.poll(() => sceneGlbRequests(requests)).toEqual([
    companionAssetManifest.bear.lite.url,
  ]);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
});

test("production S10 day focus reaches the unified scene as a bounded presentation cue", async ({ page }) => {
  await installSyntheticApi(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const stage = await openProductionS10(page, "fox");
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  const runtime = page.locator(".living-three-scene");
  const buttons = page.locator(".seven-day-trail .trail-day-button");

  await expect(buttons).toHaveCount(7);
  await expect(runtime).toHaveAttribute("data-scene-environment-owner", "three-scene");
  expect(await runtime.getAttribute("data-scene-actor-owner")).toBeNull();
  await expect(runtime).toHaveAttribute("data-companion-look-enabled", "true");
  await expect(runtime).toHaveAttribute("data-companion-look-posture", "head-spine");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue-count", "0");

  await stage.scrollIntoViewIfNeeded();
  await buttons.nth(2).evaluate((element: HTMLButtonElement) => element.click());

  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue", "day-focus");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue-count", "1");
  await expect(runtime).toHaveAttribute("data-companion-look-source", "replay");

  await expect.poll(async () => {
    const yaw = Number(await runtime.getAttribute("data-companion-look-spine-yaw") ?? "0");
    const pitch = Number(await runtime.getAttribute("data-companion-look-spine-pitch") ?? "0");
    return Math.max(Math.abs(yaw), Math.abs(pitch));
  }).toBeGreaterThan(0.0005);

  await expect(runtime).toHaveAttribute(
    "data-companion-replay-cue",
    "none",
    { timeout: 3_000 },
  );
  await expect(runtime).toHaveAttribute("data-companion-look-state", "centered");
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
});

test("production S10 reduced motion stays neutral fallback with no character GLB", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installSyntheticApi(page);

  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));

  const stage = await openProductionS10(page, "fox");
  await expect(stage).toHaveCount(1);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "poster",
  );
  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);

  await page.waitForTimeout(250);
  expect(sceneGlbRequests(requests)).toEqual([]);
});

test("failed production S10 GLB falls back without losing semantic record controls", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route(
    "https://sk7-companion.gkrry.com/companion/v1/**",
    route => route.abort("failed"),
  );

  const stage = await openProductionS10(page, "cat");
  await expect(stage).toHaveCount(1);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "fallback",
    { timeout: 20_000 },
  );
  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "7일 돌아보기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "기록 찾아보기", exact: true })).toBeVisible();
});

test("leaving production S10 disposes its scene canvas before the record explorer", async ({ page }) => {
  await installSyntheticApi(page);
  await openProductionS10(page, "cat");

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);

  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-screen", "S08");
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await expect(page.locator('[data-living-scene="S10"]')).toHaveCount(0);
});

test("production S10 health and challenge facts cannot choose the saved scene identity", async ({ page }) => {
  await installSyntheticApi(page, {
    systolic: 210,
    diastolic: 118,
    challengeStatus: "completed",
  });

  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));

  await openProductionS10(
    page,
    "fox",
    "&companion_species=bear&companion_variant=standard&companion_clip=special"
      + "&systolic=260&diastolic=160&risk=high&score=0.99&challenge_status=completed",
  );

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  await expect.poll(() => sceneGlbRequests(requests)).toEqual([
    companionAssetManifest.fox.lite.url,
  ]);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
});
