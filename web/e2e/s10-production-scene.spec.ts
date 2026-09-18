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
