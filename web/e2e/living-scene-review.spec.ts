import "./recap-candidate.cases";
import type { Request } from "@playwright/test";
import { findSceneRecipe, sceneComposition } from "../src/ui/sceneRecipes";
import { companionAssetManifest } from "../src/ui/companionAssets.generated";
import { companionSpecies } from "../src/ui/companion";
import { expect, test } from "@playwright/test";
import posterEvidence from "../../docs/evidence/scene-clay-posters.json" with { type: "json" };
import posterR2 from "../../docs/evidence/scene-clay-r2.json" with { type: "json" };
import type { Page } from "@playwright/test";

const url = "/?fixture=VP-10&screen=S02";
const s10Url = "/?fixture=VP-10&screen=S10";
function expectRelativeSubjectHeight(subjectHeight: number, stageHeight: number, composition: ReturnType<typeof sceneComposition>) {
  // The Living Journey frame intentionally scales the registered composition.
  // Preserve its approved subject-to-stage proportions instead of old absolute pixels.
  expect(subjectHeight / stageHeight).toBeGreaterThanOrEqual(composition.subjectMinHeight / composition.stageHeight);
  expect(subjectHeight / stageHeight).toBeLessThanOrEqual(composition.subjectMaxHeight / composition.stageHeight);
}
async function completedSceneNetwork(completed: Request[]) {
  // WebGL readiness does not imply completion of the independent CDN poster.
  await expect.poll(() => completed.filter(request => /\/scene-review\/s02\//.test(request.url())).length, { timeout: 15000 }).toBe(1);
  return Promise.all(completed.filter(request => /ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)|\/scene-review\/s02\//.test(request.url()))
    .map(async request => ({ url: request.url(), ...await request.sizes() })));
}

test("short 320x568 journey yields decorative realtime scene before core UI", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const requests: string[] = [];
  page.on("request", request => {
    if (/ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)/.test(request.url())) requests.push(request.url());
  });
  await page.goto(url);
  await expect(page.locator(".journey-view-frame")).toBeHidden();
  await expect(page.locator(".journey-view-caption")).toBeHidden();
  await expect(page.locator(".home-lead button")).toBeVisible();
  await expect(page.locator(".home-trail-dates")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});


test("S02 keeps its decoded poster over a hidden canvas until the first GPU frame is ready", async ({ page }) => {
  let releaseGlb!: () => void;
  let markGlbStarted!: () => void;
  const glbGate = new Promise<void>(resolve => { releaseGlb = resolve; });
  const glbStarted = new Promise<void>(resolve => { markGlbStarted = resolve; });

  await page.route("**/*.glb*", async route => {
    markGlbStarted();
    await glbGate;
    await route.continue();
  });

  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await glbStarted;

  const runtime = page.locator("[data-living-scene-status]");
  const canvas = page.locator(".living-three-scene canvas");
  const poster = page.locator(".living-scene-fallback img");

  await expect(runtime).toHaveAttribute("data-living-scene-status", "poster");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveCSS("visibility", "hidden");
  await expect(poster).toHaveCount(1);
  await poster.evaluate((image: HTMLImageElement) => image.decode());
  await expect(poster).toBeVisible();

  releaseGlb();

  await expect(runtime).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );
  await expect(canvas).toHaveCSS("visibility", "visible");
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
});

for (const [width, height] of [[320, 844], [390, 844], [1366, 768]]) {
  test(`review renders at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const completed: Request[] = [];
    page.on("requestfinished", request => completed.push(request));
    const assets: string[] = [];
    page.on("request", request => { if (/\.glb(?:\?|$)/.test(request.url())) assets.push(request.url()); });
    await page.goto(url);
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
    await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
    // VP-10 uses the fixed synthetic 2026-09-03 (Thursday) presentation date.
    await expect(page.locator("[data-scene-recipe]")).toHaveAttribute("data-scene-recipe", "s02-footbridge");
    const bounds = JSON.parse((await page.locator("[data-subject-bounds]").getAttribute("data-subject-bounds"))!);
    expect(bounds.left).toBeGreaterThanOrEqual(-1);
    expect(bounds.right).toBeLessThanOrEqual(1);
    expect(bounds.bottom).toBeGreaterThanOrEqual(-1);
    expect(bounds.top).toBeLessThanOrEqual(1);
    const composition = sceneComposition(findSceneRecipe("S02", "footbridge")!, width);
    const stageHeight = await page.locator(".living-visual-stage").evaluate(element => element.clientHeight);
    expectRelativeSubjectHeight(bounds.height, stageHeight, composition);
    const network = await completedSceneNetwork(completed);
    expect(network.filter(request => /\.glb(?:\?|$)/.test(request.url))).toHaveLength(1);
    expect(network.some(request => /GLTFLoader/.test(request.url))).toBe(true);
    expect(network.some(request => /ThreeSceneRenderer/.test(request.url))).toBe(true);
    expect(network.filter(request => /\/scene-review\/s02\//.test(request.url))).toHaveLength(1);
    await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
    await testInfo.attach("scene-network", { body: JSON.stringify({ viewport: { width, height }, source: "Vite production preview, cold browser context; responseBodySize is encoded body, headers separate; not device acceptance", bounds, requests: network }, null, 2), contentType: "application/json" });
    expect(assets).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("scene.png"), fullPage: true });
  });
}



test("login companion choice carries into the same-tab S02 scene", async ({ page }) => {
  const apiHeaders = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };

  await page.route("http://e2e.invalid/api/v1/observations/window**", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: apiHeaders });
    }

    const requestUrl = new URL(request.url());

    return route.fulfill({
      status: 200,
      headers: apiHeaders,
      contentType: "application/json",
      body: JSON.stringify({
        start_on: requestUrl.searchParams.get("start_on"),
        end_on: requestUrl.searchParams.get("end_on"),
        blood_pressure_observations: [],
        challenge_checkins: [],
        active_challenge: null,
        // Keep S02 truthful instead of routing the empty window to S12.
        challenge_events: [{
          id: "synthetic-existing-legacy",
          observed_on: "2026-09-05",
          action_id: "walk-10-minutes",
          status: "completed",
        }],
      }),
    });
  });

  // Routing GLBs disables HTTP cache for these requests, so the S02 handoff
  // remains observable even after the login narrator has loaded the same asset.
  await page.route("**/*.glb*", route => route.continue());

  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });

  // Query says bear, but user preference must own the identity.
  await page.goto("/?screen=S02&companion_species=bear");

  const picker = page.locator("#login-companion-species");
  const narrator = page.locator("[data-login-companion]");

  await expect(picker).toBeVisible();
  await picker.selectOption("fox");

  await expect(picker).toHaveValue("fox");
  await expect(narrator).toHaveAttribute("data-login-companion-species", "fox");
  await expect(narrator.locator("[data-companion-status]")).toHaveAttribute(
    "data-companion-status",
    "ready",
    { timeout: 20_000 },
  );

  expect(
    await page.evaluate(() => localStorage.getItem("sk7-companion-species")),
  ).toBe("fox");

  const requestsBeforeSession = glbRequests.length;

  // Simulate the successful auth handoff without navigating or reloading.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("sk7:e2e-session-change", {
      detail: {
        access_token: "e2e-synthetic-access-token",
        refresh_token: "e2e-synthetic-refresh-token",
        expires_in: 3600,
        expires_at: 1800000000,
        token_type: "bearer",
        user: {
          id: "e2e-synthetic-user",
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: "2026-09-01T00:00:00.000Z",
        },
      },
    }));
  });

  await expect(page.locator(".journey-today")).toBeVisible();
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  await expect.poll(
    () => glbRequests.slice(requestsBeforeSession),
  ).toEqual([companionAssetManifest.fox.lite.url]);

  // S02 takes over as the single visual owner after login.
  await expect(page.locator("[data-login-companion]")).toHaveCount(0);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);

  expect(
    await page.evaluate(() => localStorage.getItem("sk7-companion-species")),
  ).toBe("fox");
});

for (const species of companionSpecies) {
  test(`S02 renders saved ${species} identity across supported viewports`, async ({ page }) => {
    await page.addInitScript((savedSpecies: string) => {
      localStorage.setItem("sk7-companion-species", savedSpecies);
    }, species);

    const glbRequests: string[] = [];
    page.on("request", request => {
      if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
    });

    // A conflicting query must never choose the S02 identity or variant.
    const querySpecies = species === "bear" ? "fox" : "bear";
    await page.goto(
      `${url}&companion_species=${querySpecies}&companion_variant=standard&companion_clip=special`,
    );
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
      "data-living-scene-status",
      "ready",
      { timeout: 20_000 },
    );

    await expect.poll(() => glbRequests.length).toBe(1);
    expect(glbRequests[0]).toBe(companionAssetManifest[species].lite.url);

    // S02 scene remains the only visual owner.
    await expect(page.locator("[data-companion-status]")).toHaveCount(0);
    await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);

    for (const [width, height] of [
      [320, 844],
      [390, 844],
      [1366, 768],
    ] as const) {
      await page.setViewportSize({ width, height });

      // Wait until Three.js has processed this ResizeObserver turn.
      // canvas intrinsic dimensions are updated by renderer.setSize() in the
      // same resize pass that redraws and refreshes data-subject-bounds.
      await expect.poll(async () => {
        return page.locator(".living-three-scene canvas").evaluate((canvas: HTMLCanvasElement) => {
          const host = canvas.parentElement;
          if (!host) return false;
          const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
          const expectedWidth = Math.floor(host.clientWidth * dpr);
          const expectedHeight = Math.floor(host.clientHeight * dpr);
          return Math.abs(canvas.width - expectedWidth) <= 1
            && Math.abs(canvas.height - expectedHeight) <= 1;
        });
      }).toBe(true);

      await page.evaluate(() => new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));

      await expect.poll(async () => {
        const raw = await page.locator("[data-subject-bounds]").getAttribute("data-subject-bounds");
        if (!raw) return false;
        const bounds = JSON.parse(raw);
        return bounds.left >= -1
          && bounds.right <= 1
          && bounds.bottom >= -1
          && bounds.top <= 1;
      }).toBe(true);

      const bounds = JSON.parse(
        (await page.locator("[data-subject-bounds]").getAttribute("data-subject-bounds"))!,
      );
      const composition = sceneComposition(findSceneRecipe("S02", "footbridge")!, width);
      const stageHeight = await page.locator(".living-visual-stage").evaluate(
        element => element.clientHeight,
      );

      expectRelativeSubjectHeight(bounds.height, stageHeight, composition);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
    }
  });
}

test("S02 invalid saved identity falls back to bear-lite", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sk7-companion-species", "seal");
  });

  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });

  await page.goto(`${url}&companion_species=fox&companion_variant=standard`);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  await expect.poll(() => glbRequests.length).toBe(1);
  expect(glbRequests[0]).toBe(companionAssetManifest.bear.lite.url);
});


test("S02 reduced motion keeps the selected identity on the static fallback without loading a GLB", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.addInitScript(() => {
    localStorage.setItem("sk7-companion-species", "fox");
  });

  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });

  await page.goto(`${url}&companion_species=bear`);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-living-scene-status]"))
    .toHaveAttribute("data-living-scene-status", "poster");

  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);

  await page.waitForTimeout(300);
  expect(glbRequests).toEqual([]);

  expect(
    await page.evaluate(() => localStorage.getItem("sk7-companion-species")),
  ).toBe("fox");
});

const s10ViewportRepresentatives = new Set(["bear", "fox", "hedgehog"]);

for (const species of companionSpecies) {
  test(`S10 review scene owns saved ${species} identity without a second companion renderer`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((savedSpecies: string) => {
      localStorage.setItem("sk7-companion-species", savedSpecies);
    }, species);

    const glbRequests: string[] = [];
    page.on("request", request => {
      if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
    });

    const querySpecies = species === "bear" ? "fox" : "bear";
    await page.goto(
      `${s10Url}&companion_species=${querySpecies}&companion_variant=standard&companion_clip=special`,
    );
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
      "data-living-scene-status",
      "ready",
      { timeout: 20_000 },
    );

    await expect.poll(() => glbRequests.length).toBe(1);
    expect(glbRequests[0]).toBe(companionAssetManifest[species].lite.url);

    await expect(page.locator("[data-companion-status]")).toHaveCount(0);
    await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);

    const assertBounds = async () => {
      await expect.poll(async () => {
        const raw = await page.locator("[data-subject-bounds]").getAttribute("data-subject-bounds");
        if (!raw) return false;
        const bounds = JSON.parse(raw);
        return bounds.left >= -1
          && bounds.right <= 1
          && bounds.bottom >= -1
          && bounds.top <= 1;
      }).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    };

    await assertBounds();

    if (s10ViewportRepresentatives.has(species)) {
      for (const [width, height] of [
        [320, 844],
        [390, 844],
        [1366, 768],
      ] as const) {
        await page.setViewportSize({ width, height });
        await expect.poll(async () => {
          return page.locator(".living-three-scene canvas").evaluate((canvas: HTMLCanvasElement) => {
            const host = canvas.parentElement;
            if (!host) return false;
            const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
            return Math.abs(canvas.width - Math.floor(host.clientWidth * dpr)) <= 1
              && Math.abs(canvas.height - Math.floor(host.clientHeight * dpr)) <= 1;
          });
        }).toBe(true);
        await page.evaluate(() => new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));
        await assertBounds();
      }
    }
  });
}

test("S10 invalid saved identity fails safe to bear-lite", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sk7-companion-species", "seal");
  });

  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });

  await page.goto(`${s10Url}&companion_species=fox`);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );
  await expect.poll(() => glbRequests.length).toBe(1);
  expect(glbRequests[0]).toBe(companionAssetManifest.bear.lite.url);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
});

test("S10 reduced motion keeps the unified owner on the poster without loading a GLB", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("sk7-companion-species", "fox");
  });

  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });

  await page.goto(`${s10Url}&companion_species=bear`);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "poster",
  );
  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);

  await page.waitForTimeout(300);
  expect(glbRequests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("sk7-companion-species"))).toBe("fox");
});


test("S10 unified review scene receives bounded presentation-only day-focus attention", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("sk7-companion-species", "fox");
  });

  await page.goto(s10Url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  const runtime = page.locator(".living-three-scene");
  const buttons = page.locator(".seven-day-trail .trail-day-button");

  await expect(buttons).toHaveCount(7);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
  await expect(runtime).toHaveAttribute("data-companion-look-enabled", "true");
  await expect(runtime).toHaveAttribute("data-companion-look-posture", "head-spine");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue-count", "0");

  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue", "day-focus");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue-count", "1");
  await expect(runtime).toHaveAttribute("data-companion-look-source", "replay");

  await expect.poll(async () => {
    const yaw = Number(await runtime.getAttribute("data-companion-look-spine-yaw") ?? "0");
    const pitch = Number(await runtime.getAttribute("data-companion-look-spine-pitch") ?? "0");
    return Math.max(Math.abs(yaw), Math.abs(pitch));
  }, { timeout: 2_000 }).toBeGreaterThan(0.0005);

  const totalYaw = Math.abs(Number(await runtime.getAttribute("data-companion-look-yaw")));
  const totalPitch = Math.abs(Number(await runtime.getAttribute("data-companion-look-pitch")));
  const maxYaw = Number(await runtime.getAttribute("data-companion-look-max-yaw"));
  const maxPitch = Number(await runtime.getAttribute("data-companion-look-max-pitch"));
  expect(totalYaw).toBeLessThanOrEqual(maxYaw);
  expect(totalPitch).toBeLessThanOrEqual(maxPitch);

  await expect(runtime).toHaveAttribute("data-companion-replay-cue", "none", { timeout: 3_000 });
  await expect(runtime).toHaveAttribute("data-companion-look-state", "centered");
  await expect(runtime).toHaveAttribute("data-companion-look-yaw", "0.0000");
  await expect(runtime).toHaveAttribute("data-companion-look-pitch", "0.0000");

  // Selecting the first day expands detail content and can push the decorative
  // scene outside the IntersectionObserver viewport. The scene intentionally
  // ignores attention cues while it is not visible, so restore that explicit
  // runtime precondition without scrolling the keyboard target back over it.
  const stage = page.locator(".living-visual-stage");
  await stage.scrollIntoViewIfNeeded();
  await expect.poll(async () => stage.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  })).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await buttons.nth(2).evaluate((element: HTMLButtonElement) => {
    element.focus({ preventScroll: true });
  });
  await expect(buttons.nth(2)).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue-count", "2");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue", "day-focus");
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
});


test("S02 companion-off stays poster-only and requests no character GLB", async ({ page }) => {
  test.skip(
    process.env.SK7_SCENE_TEST_COMPANION !== "off",
    "requires an explicit companion-off scene build",
  );
  await page.addInitScript(() => {
    localStorage.setItem("sk7-companion-species", "fox");
  });

  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });

  await page.goto(`${url}&companion_species=fox`);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-living-scene-status]"))
    .toHaveAttribute("data-living-scene-status", "poster");

  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);

  await page.waitForTimeout(300);
  expect(glbRequests).toEqual([]);

  // Turning presentation off must not erase the user's identity preference.
  expect(
    await page.evaluate(() => localStorage.getItem("sk7-companion-species")),
  ).toBe("fox");
});

test("ready WebGL does not wait for a pending poster transfer", async ({ page }) => {
  const completed: Request[] = [];
  page.on("requestfinished", request => completed.push(request));
  let releasePoster!: () => void;
  const posterGate = new Promise<void>(resolve => { releasePoster = resolve; });
  let posterStarted = false;
  await page.route("**/scene-review/s02/v1/*.webp", async route => {
    posterStarted = true;
    await posterGate;
    await route.continue();
  });
  try {
    // 320x568 intentionally suppresses decorative scene media so the core UI
    // clears the fixed navigation. Exercise this WebGL handoff contract at the
    // narrowest viewport where the scene is intentionally active.
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect.poll(() => posterStarted).toBe(true);
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
    await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
    expect(completed.filter(request => /\/scene-review\/s02\//.test(request.url()))).toHaveLength(0);
    const observation = completedSceneNetwork(completed);
    releasePoster();
    const network = await observation;
    expect(network.filter(request => /\/scene-review\/s02\//.test(request.url))).toHaveLength(1);
    expect(network.filter(request => /\.glb(?:\?|$)/.test(request.url))).toHaveLength(1);
  } finally {
    releasePoster();
  }
});

test("poster remains visible until the GPU-settled frame is handed off", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & {
      pendingSceneGpuFences?: number;
      sceneGpuFencePolls?: number;
      deletedSceneGpuFences?: number;
      pendingSceneRevealFrames?: number;
      signalSceneGpuFence?: () => void;
      releaseSceneRevealFrame?: () => boolean;
    };
    const originalFenceSync = WebGL2RenderingContext.prototype.fenceSync;
    const originalClientWaitSync = WebGL2RenderingContext.prototype.clientWaitSync;
    const originalDeleteSync = WebGL2RenderingContext.prototype.deleteSync;
    const originalRequest = window.requestAnimationFrame.bind(window);
    const originalCancel = window.cancelAnimationFrame.bind(window);
    const fences = new Set<WebGLSync>();
    const pendingReveal = new Map<number, FrameRequestCallback>();
    let nextFrame = -1;
    let fenceSignaled = false;
    let holdRevealFrame = false;
    state.pendingSceneGpuFences = 0;
    state.sceneGpuFencePolls = 0;
    state.deletedSceneGpuFences = 0;
    state.pendingSceneRevealFrames = 0;
    WebGL2RenderingContext.prototype.fenceSync = function (condition, flags) {
      const sync = originalFenceSync.call(this, condition, flags);
      if (sync) {
        fences.add(sync);
        state.pendingSceneGpuFences = fences.size;
      }
      return sync;
    };
    WebGL2RenderingContext.prototype.clientWaitSync = function (sync, flags, timeout) {
      if (!fences.has(sync)) return originalClientWaitSync.call(this, sync, flags, timeout);
      state.sceneGpuFencePolls = (state.sceneGpuFencePolls ?? 0) + 1;
      if (!fenceSignaled) return this.TIMEOUT_EXPIRED;
      holdRevealFrame = true;
      return this.CONDITION_SATISFIED;
    };
    WebGL2RenderingContext.prototype.deleteSync = function (sync) {
      if (fences.delete(sync)) {
        state.pendingSceneGpuFences = fences.size;
        state.deletedSceneGpuFences = (state.deletedSceneGpuFences ?? 0) + 1;
      }
      originalDeleteSync.call(this, sync);
    };
    window.requestAnimationFrame = callback => {
      if (holdRevealFrame) {
        holdRevealFrame = false;
        const frame = nextFrame--;
        pendingReveal.set(frame, callback);
        state.pendingSceneRevealFrames = pendingReveal.size;
        return frame;
      }
      return originalRequest(callback);
    };
    window.cancelAnimationFrame = frame => {
      if (pendingReveal.delete(frame)) state.pendingSceneRevealFrames = pendingReveal.size;
      else originalCancel(frame);
    };
    state.signalSceneGpuFence = () => { fenceSignaled = true; };
    state.releaseSceneRevealFrame = () => {
      const first = pendingReveal.entries().next().value;
      if (!first) return false;
      const [frame, callback] = first;
      pendingReveal.delete(frame);
      state.pendingSceneRevealFrames = pendingReveal.size;
      originalRequest(callback);
      return true;
    };
  });
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (window as Window & { pendingSceneGpuFences?: number }).pendingSceneGpuFences)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as Window & { sceneGpuFencePolls?: number }).sceneGpuFencePolls)).toBeGreaterThan(0);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "poster");
  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-three-scene")).toHaveCSS("opacity", "0");
  await page.evaluate(() => (window as Window & { signalSceneGpuFence?: () => void }).signalSceneGpuFence?.());
  await expect.poll(() => page.evaluate(() => (window as Window & { pendingSceneRevealFrames?: number }).pendingSceneRevealFrames)).toBe(1);
  expect(await page.evaluate(() => (window as Window & { pendingSceneGpuFences?: number }).pendingSceneGpuFences)).toBe(0);
  expect(await page.evaluate(() => (window as Window & { deletedSceneGpuFences?: number }).deletedSceneGpuFences)).toBe(1);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "poster");
  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-three-scene")).toHaveCSS("opacity", "0");
  expect(await page.evaluate(() => (window as Window & { releaseSceneRevealFrame?: () => boolean }).releaseSceneRevealFrame?.())).toBe(true);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready");
  await expect(page.locator(".living-scene-fallback")).toHaveCount(0);
  await expect(page.locator(".living-three-scene")).toHaveCSS("opacity", "1");
});

test("an unavailable GPU fence fails safely to the poster", async ({ page }) => {
  await page.addInitScript(() => {
    WebGL2RenderingContext.prototype.fenceSync = () => null;
  });
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-scene-fallback")).toHaveCount(1);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
});

test("leaving during GPU warm-up cancels polling and deletes the fence", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & {
      pendingSceneGpuPollFrames?: number;
      canceledSceneGpuPollFrames?: number;
      deletedSceneGpuFences?: number;
    };
    const originalDeleteSync = WebGL2RenderingContext.prototype.deleteSync;
    const originalRequest = window.requestAnimationFrame.bind(window);
    const originalCancel = window.cancelAnimationFrame.bind(window);
    const pendingPoll = new Map<number, FrameRequestCallback>();
    let nextFrame = -1000;
    let holdNextPoll = false;
    state.pendingSceneGpuPollFrames = 0;
    state.canceledSceneGpuPollFrames = 0;
    state.deletedSceneGpuFences = 0;
    WebGL2RenderingContext.prototype.clientWaitSync = function () {
      holdNextPoll = true;
      return this.TIMEOUT_EXPIRED;
    };
    WebGL2RenderingContext.prototype.deleteSync = function (sync) {
      state.deletedSceneGpuFences = (state.deletedSceneGpuFences ?? 0) + 1;
      originalDeleteSync.call(this, sync);
    };
    window.requestAnimationFrame = callback => {
      if (holdNextPoll) {
        holdNextPoll = false;
        const frame = nextFrame--;
        pendingPoll.set(frame, callback);
        state.pendingSceneGpuPollFrames = pendingPoll.size;
        return frame;
      }
      return originalRequest(callback);
    };
    window.cancelAnimationFrame = frame => {
      if (pendingPoll.delete(frame)) {
        state.pendingSceneGpuPollFrames = pendingPoll.size;
        state.canceledSceneGpuPollFrames = (state.canceledSceneGpuPollFrames ?? 0) + 1;
      } else originalCancel(frame);
    };
  });
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (window as Window & { pendingSceneGpuPollFrames?: number }).pendingSceneGpuPollFrames)).toBe(1);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "poster");
  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { pendingSceneGpuPollFrames?: number }).pendingSceneGpuPollFrames)).toBe(0);
  expect(await page.evaluate(() => (window as Window & { canceledSceneGpuPollFrames?: number }).canceledSceneGpuPollFrames)).toBe(1);
  expect(await page.evaluate(() => (window as Window & { deletedSceneGpuFences?: number }).deletedSceneGpuFences)).toBe(1);
});

test("GLB and poster failures preserve the task controls", async ({ page }) => {
  await page.route("**/*.glb", route => route.abort());
  await page.route(/\.(png|webp|avif)(\?|$)/, route => route.abort());
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
});

test("reduced motion never imports the renderer or requests GLB", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator(".living-scene-fallback")).toBeVisible();
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  expect(requests.filter(url => /ThreeSceneRenderer|disposeScene|\.glb(?:\?|$)/.test(url))).toEqual([]);
});


test("context loss disposes the canvas and leaves navigation available", async ({ page }) => {
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
  await page.locator(".living-three-scene canvas").evaluate(canvas => canvas.dispatchEvent(new Event("webglcontextlost")));
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
});


for (const width of [320, 390, 1366]) test(`each weekday renders its registered recipe at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const landmarks = ["garden-gate", "herb-garden", "shade-tree", "footbridge", "reading-shelter", "pavilion", "sunset-overlook"];
  await page.setViewportSize({ width, height: 844 });
  await page.route("http://e2e.invalid/**", route => {
    const requestUrl = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/json", headers: {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    }, body: JSON.stringify({ start_on: requestUrl.searchParams.get("start_on"), end_on: requestUrl.searchParams.get("end_on"),
      blood_pressure_observations: [], active_challenge: null, challenge_checkins: [],
      challenge_events: [{ id: "synthetic-weekday", observed_on: requestUrl.searchParams.get("end_on"), action_id: "walk-10-minutes", status: "skipped" }],
    }) });
  });
  for (let index = 0; index < landmarks.length; index++) {
    const day = String(index + 7).padStart(2, "0");
    await page.clock.setFixedTime(new Date(`2026-09-${day}T03:00:00Z`));
    await page.goto("/?e2e=signed-in&screen=S02");
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-scene-recipe]")).toHaveAttribute("data-scene-recipe", `s02-${landmarks[index]}`);
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout: 20000 });
    const bounds = JSON.parse((await page.locator("[data-subject-bounds]").getAttribute("data-subject-bounds"))!);
    const composition = sceneComposition(findSceneRecipe("S02", landmarks[index])!, width);
    expect(bounds.left).toBeGreaterThanOrEqual(-1); expect(bounds.right).toBeLessThanOrEqual(1);
    expect(bounds.bottom).toBeGreaterThanOrEqual(-1); expect(bounds.top).toBeLessThanOrEqual(1);
    const stageHeight = await page.locator(".living-visual-stage").evaluate(element => element.clientHeight);
    expectRelativeSubjectHeight(bounds.height, stageHeight, composition);
    await page.locator(".living-visual-stage").screenshot({ path: testInfo.outputPath(`${landmarks[index]}-${width}.png`) });
  }
});

async function syntheticCalendar(page: Page) {
  await page.route("http://e2e.invalid/**", route => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type" }, body: JSON.stringify({
      start_on: url.searchParams.get("start_on"), end_on: url.searchParams.get("end_on"), blood_pressure_observations: [], active_challenge: null, challenge_checkins: [],
      challenge_events: [{ id: "synthetic-poster", observed_on: url.searchParams.get("end_on"), action_id: "walk-10-minutes", status: "skipped" }],
    }) });
  });
}

async function expectPoster(page: Page, landmarkId: string, width: number) {
  const profile = width <= 350 ? "mobile320" : width <= 580 ? "mobile390" : "desktop";
  const evidence = posterEvidence.posters.find(p => p.landmarkId === landmarkId && p.profile === profile)!;
  await expect(page.locator("[data-poster-asset]")).toHaveAttribute("data-poster-asset", evidence.id);
  const image = page.locator(".living-scene-fallback img");
  await expect(image).toHaveAttribute("src", posterR2.objects.find(p => p.id === evidence.id)!.url);
  // Public CDN delivery can outlast Playwright's default five-second assertion.
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 }).toBe(evidence.width);
  const stage = (await page.locator(".living-visual-stage").boundingBox())!;
  const box = (await image.boundingBox())!;
  const { left, right, top, bottom } = evidence.subjectBounds;
  // The orthographic camera and poster both preserve vertical scale. At widths
  // between masters only horizontal margins crop; the focal subject stays whole.
  expect(box.x + (left + 1) / 2 * box.width).toBeGreaterThanOrEqual(stage.x - 2);
  expect(box.x + (right + 1) / 2 * box.width).toBeLessThanOrEqual(stage.x + stage.width + 2);
  expect(box.y + (1 - top) / 2 * box.height).toBeGreaterThanOrEqual(stage.y - 2);
  expect(box.y + (1 - bottom) / 2 * box.height).toBeLessThanOrEqual(stage.y + stage.height + 2);
  const composition = sceneComposition(findSceneRecipe("S02", landmarkId)!, width);
  const subjectHeight = (top - bottom) / 2 * box.height;
  expectRelativeSubjectHeight(subjectHeight, stage.height, composition);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}

for (const width of [320, 390, 1366]) test(`all weekday posters select one matching asset at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await syntheticCalendar(page);
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  const landmarks = ["garden-gate", "herb-garden", "shade-tree", "footbridge", "reading-shelter", "pavilion", "sunset-overlook"];
  for (const [index, landmark] of landmarks.entries()) {
    requests.length = 0;
    await page.clock.setFixedTime(new Date(`2026-09-${String(index + 7).padStart(2, "0")}T03:00:00Z`));
    await page.goto("/?e2e=signed-in&screen=S02");
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expectPoster(page, landmark, width);
    expect(requests.filter(url => url.includes("/scene-review/s02/"))).toHaveLength(1);
    expect(requests.filter(url => /ThreeSceneRenderer|GLTFLoader|disposeScene|\.glb(?:\?|$)/.test(url))).toEqual([]);
    await page.locator(".living-visual-stage").screenshot({ path: testInfo.outputPath(`${landmark}-poster-${width}.png`) });
  }
});

test("public poster permits browser CORS and returns the registered bytes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  const poster = posterR2.objects[0];
  const response = await page.evaluate(async publicUrl => {
    const result = await fetch(publicUrl, { mode: "cors", redirect: "error" });
    const bytes = await result.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return { status: result.status, mime: result.headers.get("content-type"), cache: result.headers.get("cache-control"),
      byteLength: bytes.byteLength, sha256: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("") };
  }, poster.url);
  expect(response).toEqual({ status: 200, mime: "image/webp", cache: "max-age=14400", byteLength: poster.byteLength, sha256: poster.sha256 });
});

test("poster preserves relative focal scale across responsive breakpoints", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  for (const width of [320, 350, 351, 580, 581, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
    await expectPoster(page, "footbridge", width);
  }
});

test("poster failure resets for a new profile and Seoul weekday", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await syntheticCalendar(page);
  await page.route("**/scene-review/s02/v1/*-mobile320-*.webp", route => route.abort());
  await page.clock.setFixedTime(new Date("2026-09-07T03:00:00Z"));
  await page.goto("/?e2e=signed-in&screen=S02");
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-poster-asset]")).toHaveAttribute("data-poster-asset", "poster-garden-gate-mobile320");
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectPoster(page, "garden-gate", 390);
  await page.clock.setFixedTime(new Date("2026-09-08T03:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expectPoster(page, "herb-garden", 390);
  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
});
