import { expect, test, type Page } from "@playwright/test";

import {
  CompanionPresenceKernel,
  type PresencePlacementIntent,
} from "../src/platform/presence/companionPresenceKernel";
import {
  buildS02PresenceArenaSnapshot,
} from "../src/platform/presence/s02PresenceArena";

const headers = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const companionOff = process.env.SK7_UI_TEST_COMPANION === "off";

async function openS02(page: Page) {
  await page.clock.setFixedTime(new Date("2026-09-11T03:00:00Z"));
  await page.route("http://e2e.invalid/**", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const url = new URL(request.url());
    if (url.pathname.endsWith("/window")) {
      await route.fulfill({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify({
          start_on: "2026-09-05",
          end_on: "2026-09-11",
          blood_pressure_observations: [],
          challenge_checkins: [],
          active_challenge: null,
          challenge_events: [{
            id: "synthetic-existing",
            observed_on: "2026-09-05",
            action_id: "walk-10-minutes",
            status: "completed",
          }],
        }),
      });
      return;
    }
    await route.abort();
  });
  await page.goto("/?e2e=signed-in&screen=S02");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
}

test("presence kernel keeps one actor and placement intent across route epochs with ABA-safe shadow owner tokens", () => {
  const kernel = new CompanionPresenceKernel({
    sessionEpoch: 7,
    route: "S02",
    actor: { actorId: "sk7-companion", assetId: "COMPANION-R2-001" },
    owner: "full-scene",
    observedAssetId: "COMPANION-R2-001",
  });
  const intent: PresencePlacementIntent = {
    preferredRole: "today-sidecar",
    preferredAnchorId: "today-sidecar",
    normalizedOffset: { x: 0.72, y: 0.48 },
    fallbackOrder: ["anchor", "dock", "control", "hidden"],
  };
  expect(kernel.rememberPlacementIntent(intent)).toBe(true);
  const first = kernel.snapshot;
  expect(first.presence?.actorId).toBe("sk7-companion");
  expect(first.owner).toBe("full-scene");
  expect(first.ownerToken).not.toBeNull();
  expect(kernel.publishArena(first.runtime.routeEpoch, 3)).toBe(true);
  expect(kernel.snapshot.runtime.arenaRevision).toBe(3);

  kernel.reconcile({
    sessionEpoch: 7,
    route: "S03",
    actor: { actorId: "sk7-companion", assetId: "COMPANION-R2-001" },
    owner: "none",
  });
  const middle = kernel.snapshot;
  expect(middle.runtime.routeEpoch).toBe(first.runtime.routeEpoch + 1);
  expect(middle.runtime.arenaRevision).toBe(0);
  expect(middle.presence?.placementIntent).toEqual(intent);
  expect(middle.presence?.actorId).toBe(first.presence?.actorId);

  kernel.reconcile({
    sessionEpoch: 7,
    route: "S02",
    actor: { actorId: "sk7-companion", assetId: "COMPANION-R2-001" },
    owner: "full-scene",
    observedAssetId: "COMPANION-R2-001",
  });
  const returned = kernel.snapshot;
  expect(returned.runtime.routeEpoch).toBe(middle.runtime.routeEpoch + 1);
  expect(returned.runtime.arenaRevision).toBe(0);
  expect(returned.presence?.placementIntent).toEqual(intent);
  expect(kernel.releaseOwner(first.ownerToken!)).toBe(false);
  expect(kernel.snapshot.ownerToken?.token).toBe(returned.ownerToken?.token);
});

test("session replacement invalidates route-local placement and stale owner token state", () => {
  const kernel = new CompanionPresenceKernel({
    sessionEpoch: 2,
    route: "S10",
    actor: { actorId: "sk7-companion", assetId: "COMPANION-R2-005" },
    owner: "full-scene",
    observedAssetId: "COMPANION-R2-005",
  });
  kernel.rememberPlacementIntent({
    preferredRole: "recap-observer",
    fallbackOrder: ["anchor", "dock", "control", "hidden"],
  });
  const old = kernel.snapshot.ownerToken!;
  kernel.reconcile({
    sessionEpoch: 3,
    route: "S10",
    actor: { actorId: "sk7-companion", assetId: "COMPANION-R2-005" },
    owner: "full-scene",
    observedAssetId: "COMPANION-R2-005",
  });
  expect(kernel.snapshot.runtime.routeEpoch).toBe(1);
  expect(kernel.snapshot.presence?.placementIntent).toBeNull();
  expect(kernel.releaseOwner(old)).toBe(false);
});

test("S02 arena snapshot stamps one revision across viewport, anchor and explicit hard zones", () => {
  const snapshot = buildS02PresenceArenaSnapshot({
    routeEpoch: 4,
    revision: 9,
    viewport: { x: 12, y: 30, width: 390, height: 700 },
    scene: { x: 170, y: 110, width: 205, height: 250 },
    hardZones: [
      { id: "today-primary-action", rect: { x: 24, y: 160, width: 130, height: 48 } },
      { id: "primary-navigation", rect: { x: 0, y: 650, width: 390, height: 80 } },
    ],
    observedOwner: "full-scene",
  });
  expect(snapshot.revision).toBe(9);
  expect(snapshot.viewport.revision).toBe(9);
  expect(snapshot.anchors).toHaveLength(1);
  expect(snapshot.anchors[0]).toMatchObject({
    id: "today-sidecar",
    role: "today-sidecar",
    routeEpoch: 4,
    arenaRevision: 9,
  });
  expect(snapshot.anchors[0].region.revision).toBe(9);
  expect(snapshot.hardZones.every(zone => zone.region.revision === 9)).toBe(true);
  expect(Object.isFrozen(snapshot)).toBe(true);
});

test("shadow presence host publishes S02 geometry without creating companion network or a second visible owner", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });
  await openS02(page);

  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  await expect(host).toHaveCount(1);
  if (companionOff) {
    await expect(host).toHaveAttribute("data-presence-actor-id", "none");
    await expect(host).toHaveAttribute("data-presence-asset-id", "none");
    await expect(host).toHaveAttribute("data-presence-owner-token", "none");
  } else {
    await expect(host).toHaveAttribute("data-presence-actor-id", "sk7-companion");
    expect(await host.getAttribute("data-presence-asset-id")).not.toBe("none");
  }
  await expect(host).toHaveAttribute("data-presence-owner", "none");
  await expect(host).toHaveAttribute("data-presence-owner-token", "none");
  await expect(host).toHaveAttribute("data-presence-lifecycle", "suspended");
  await expect(host).toHaveAttribute("data-presence-arena-status", "published");
  await expect(host).toHaveAttribute("data-presence-anchor-count", "1");
  await expect.poll(async () => Number(await host.getAttribute("data-presence-hard-zone-count"))).toBeGreaterThanOrEqual(2);
  const baselineHardZones = Number(await host.getAttribute("data-presence-hard-zone-count"));
  const firstEpoch = Number(await host.getAttribute("data-presence-route-epoch"));
  const firstActor = await host.getAttribute("data-presence-actor-id");
  const firstAsset = await host.getAttribute("data-presence-asset-id");

  expect(glbRequests).toEqual([]);
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
  await expect(page.locator("[data-saved-scene-status]")).toHaveCount(0);

  if (!companionOff) {
    await page.evaluate(() => {
      const viewport = document.querySelector(".scene-viewport");
      if (!viewport) throw new Error("scene viewport unavailable");
      const notice = document.createElement("div");
      notice.className = "notice";
      notice.dataset.presenceTestZone = "notice";
      notice.textContent = "측정 알림";
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.dataset.presenceTestZone = "dialog";
      dialog.textContent = "측정 대화상자";
      viewport.prepend(notice, dialog);
    });
    await expect.poll(
      async () => Number(await host.getAttribute("data-presence-hard-zone-count")),
    ).toBe(baselineHardZones + 2);
    await page.evaluate(() => {
      document.querySelectorAll("[data-presence-test-zone]").forEach(element => element.remove());
    });
    await expect.poll(
      async () => Number(await host.getAttribute("data-presence-hard-zone-count")),
    ).toBe(baselineHardZones);
  }

  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await expect.poll(async () => Number(await host.getAttribute("data-presence-route-epoch"))).toBe(firstEpoch + 1);
  await expect(host).toHaveAttribute("data-presence-arena-status", "unavailable");

  await page.getByRole("button", { name: /SK7.*오늘의 기록으로 이동/ }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect.poll(async () => Number(await host.getAttribute("data-presence-route-epoch"))).toBe(firstEpoch + 2);
  await expect(host).toHaveAttribute("data-presence-actor-id", firstActor!);
  await expect(host).toHaveAttribute("data-presence-asset-id", firstAsset!);
  expect(glbRequests).toEqual([]);
});

test("compact S02 keeps semantic task path while the shadow arena declines an invisible visual anchor", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openS02(page);
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  await expect(page.locator(".journey-view-frame")).toBeHidden();
  await expect(host).toHaveAttribute("data-presence-arena-status", "unavailable");
  await expect(host).toHaveAttribute("data-presence-anchor-count", "0");
  await expect(page.locator(".home-lead button")).toBeVisible();
  await expect(page.locator(".home-trail-dates")).toBeVisible();
});
