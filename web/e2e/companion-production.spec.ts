import { expect, test, type Page } from "@playwright/test";

import { companionAssetManifest } from "../src/ui/companionAssets.generated";

const productionAssetUrl = companionAssetManifest.bear.lite.url;
const emptyWindow = {
  start_on: "2026-09-01",
  end_on: "2026-09-07",
  blood_pressure_observations: [{ id: "synthetic-existing", observed_on: "2026-09-07", period: "morning", systolic: 118, diastolic: 76 }],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

function companionRequests(urls: string[]) {
  return urls.filter((url) => /sk7-companion\.gkrry\.com\/companion\/v1\/.+\.glb(?:\?|$)/i.test(url));
}

async function installSyntheticApi(page: Page) {
  await page.route("http://e2e.invalid/**", async (route) => {
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
      await route.fulfill({ contentType: "application/json", status: 200, headers, body: JSON.stringify(emptyWindow) });
      return;
    }
    if (url.pathname === "/api/v1/observations/blood-pressure" && request.method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        headers,
        body: JSON.stringify({ id: "synthetic-saved", ...request.postDataJSON() }),
      });
      return;
    }
    await route.abort();
  });
}

async function saveFromS04(page: Page) {
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
}

test("production S05 loads bear-lite once after confirmed save and transitions celebrate to idle", async ({ page }) => {
  await installSyntheticApi(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/?e2e=signed-in&screen=S05&companion_species=cat&companion_variant=standard&companion_clip=greet");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  expect(companionRequests(requests)).toEqual([]);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
  expect(requests.filter((url) => /CompanionReviewRenderer/i.test(url))).toEqual([]);

  await page.goto("/?e2e=signed-in&screen=S04&companion_species=cat&companion_variant=standard&companion_clip=greet");
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  const assetResponsePromise = page.waitForResponse((response) => response.url() === productionAssetUrl);
  await saveFromS04(page);
  const assetResponse = await assetResponsePromise;
  expect(assetResponse.status()).toBe(200);
  expect(assetResponse.headers()["content-type"]).toBe("model/gltf-binary");
  expect(assetResponse.headers()["cf-mitigated"]).toBeUndefined();
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  expect(companionRequests(requests)).toEqual([productionAssetUrl]);
  expect(requests.filter((url) => /CompanionReviewRenderer/i.test(url))).toHaveLength(1);
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-phase", "celebrate");
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-celebrate-count", "1");
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-phase", "idle", { timeout: 30_000 });
  await page.waitForTimeout(150);
  expect(companionRequests(requests)).toHaveLength(1);
  expect(await page.locator("[data-companion-status]").getAttribute("data-companion-celebrate-count")).toBe("1");
  expect(await page.locator("[data-companion-canvas]").getAttribute("aria-hidden")).toBe("true");
  expect(await page.locator("[data-companion-canvas]").getAttribute("tabindex")).toBeNull();
  expect(await page.locator("[data-companion-canvas]").evaluate((canvas) => getComputedStyle(canvas).pointerEvents)).toBe("none");
});

test("production excludes every non-S05 screen and ignores query overrides", async ({ page }) => {
  await installSyntheticApi(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  for (const screen of ["S02", "S03", "S04", "S06", "S07", "S08", "S09", "S10", "S11", "S12", "S13", "S14"] as const) {
    requests.length = 0;
    await page.goto(`/?e2e=signed-in&screen=${screen}&companion_species=rabbit&companion_variant=standard&companion_clip=greet&companion_context=save_success`);
    await expect(page.locator(".app-shell")).not.toHaveAttribute("data-screen", "S05");
    expect(companionRequests(requests)).toEqual([]);
    await expect(page.locator("[data-companion-status]")).toHaveCount(0);
  }
});

test("production reduced motion keeps a neutral static companion without an RAF loop", async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      calls += 1;
      return original(callback);
    };
    Object.defineProperty(window, "__companionRafCalls", { value: () => calls });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installSyntheticApi(page);
  await page.goto("/?e2e=signed-in&screen=S04");
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await saveFromS04(page);
  const runtime = page.locator("[data-companion-status]");
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-companion-motion", "stopped");
  await expect(runtime).toHaveAttribute("data-companion-phase", "idle");
  expect(await runtime.getAttribute("data-companion-celebrate-count")).toBe("0");
  const before = await page.evaluate(() => (window as unknown as { __companionRafCalls: () => number }).__companionRafCalls());
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => (window as unknown as { __companionRafCalls: () => number }).__companionRafCalls());
  expect(after).toBe(before);
});

test("failed production GLB removes only the decorative companion", async ({ page }) => {
  await installSyntheticApi(page);
  await page.route("https://sk7-companion.gkrry.com/companion/v1/**", (route) => route.abort("failed"));
  await page.goto("/?e2e=signed-in&screen=S04");
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await saveFromS04(page);
  await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "오늘의 기록 보기" })).toBeVisible();
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "error", { timeout: 30_000 });
});

test("production S05 slot stays inside the scene and clear of CTA and bottom navigation", async ({ page }) => {
  await installSyntheticApi(page);
  for (const [width, height] of [[1366, 900], [390, 844], [320, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/?e2e=signed-in&screen=S04");
    await expect(page.locator('[data-scene="S04"]')).toBeVisible();
    await saveFromS04(page);
    await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
    const boxes = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector(selector);
        const box = element?.getBoundingClientRect();
        return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null;
      };
      return {
        scene: read('[data-scene="S05"]'),
        slot: read(".companion-runtime-slot"),
        cta: read('[data-scene="S05"] .split-actions'),
        nav: read(".primary-nav"),
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(boxes.scrollWidth).toBeLessThanOrEqual(width);
    expect(boxes.scene).not.toBeNull();
    expect(boxes.slot).not.toBeNull();
    expect(boxes.slot!.left).toBeGreaterThanOrEqual(boxes.scene!.left);
    expect(boxes.slot!.right).toBeLessThanOrEqual(boxes.scene!.right);
    expect(boxes.slot!.top).toBeGreaterThanOrEqual(boxes.scene!.top);
    expect(boxes.slot!.bottom).toBeLessThanOrEqual(boxes.scene!.bottom);
    const overlaps = (a: NonNullable<typeof boxes.slot>, b: NonNullable<typeof boxes.cta>) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    expect(overlaps(boxes.slot!, boxes.cta!)).toBe(false);
    expect(overlaps(boxes.slot!, boxes.nav!)).toBe(false);
  }
});
