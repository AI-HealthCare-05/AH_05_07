import { expect, test, type Page } from "@playwright/test";

import {
  CompanionPresenceKernel,
  type PresencePlacementIntent,
} from "../src/platform/presence/companionPresenceKernel";
import {
  buildS02PresenceArenaSnapshot,
  type S02PresenceArenaSnapshot,
} from "../src/platform/presence/s02PresenceArena";
import {
  PresenceSceneActorRuntime,
  type PresenceSceneActorHostConnection,
  type PresenceSceneActorPort,
} from "../src/platform/presence/presenceSceneActorRuntime";
import {
  resolveS02FreePlacement,
  type PresenceArenaPoint,
} from "../src/platform/presence/s02PresencePlacement";

const headers = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const companionOff = process.env.SK7_UI_TEST_COMPANION === "off";

function spatialArena(
  revision: number,
  hardZones: readonly Readonly<{
    id: string;
    rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  }>[] = [],
): S02PresenceArenaSnapshot {
  return buildS02PresenceArenaSnapshot({
    routeEpoch: 1,
    revision,
    viewport: { x: 0, y: 0, width: 240, height: 220 },
    scene: { x: 20, y: 20, width: 200, height: 180 },
    hardZones,
    observedOwner: "full-scene",
  });
}

function fakePort(assetUrl: string, initial: Readonly<{ x: number; y: number }>) {
  let root = { ...initial };
  const writes: PresenceArenaPoint[] = [];
  const port: PresenceSceneActorPort = {
    assetUrl,
    project: revision => ({
      space: "visual-viewport-css-px",
      revision,
      stage: { space: "visual-viewport-css-px", revision, x: 20, y: 20, width: 200, height: 180 },
      root: { space: "visual-viewport-css-px", revision, x: root.x, y: root.y },
      visualEnvelope: {
        space: "visual-viewport-css-px",
        revision,
        x: root.x - 20,
        y: root.y - 60,
        width: 40,
        height: 60,
      },
      hitRect: {
        space: "visual-viewport-css-px",
        revision,
        x: root.x - 20,
        y: root.y - 60,
        width: 40,
        height: 60,
      },
    }),
    write: request => {
      if (request.assetUrl !== assetUrl) return false;
      root = { x: request.point.x, y: request.point.y };
      writes.push(request.point);
      return true;
    },
  };
  return { port, writes, root: () => root };
}

function publishSpatialHost(
  connection: PresenceSceneActorHostConnection,
  arena: S02PresenceArenaSnapshot,
  options: Readonly<{
    assetUrl?: string;
    ownerToken?: string;
    ownerGeneration?: number;
    sessionEpoch?: number;
  }> = {},
  commits: PresencePlacementIntent[] = [],
) {
  return connection.publish({
    screen: "S02",
    owner: "full-scene",
    suspended: false,
    sessionEpoch: options.sessionEpoch ?? 1,
    routeEpoch: arena.routeEpoch,
    arenaRevision: arena.revision,
    ownerGeneration: options.ownerGeneration ?? 1,
    ownerToken: options.ownerToken ?? `owner-${arena.revision}`,
    activeAssetId: "ACTIVE-001",
    activeAssetUrl: options.assetUrl ?? "https://asset.invalid/active.glb",
    observedAssetId: "ACTIVE-001",
    arena,
    placementIntent: null,
    rememberPlacementIntent: intent => commits.push(intent),
  });
}

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

test("S02 world-root lease is exact-token, ABA-safe, and fenced by every host and port generation", () => {
  const runtime = new PresenceSceneActorRuntime();
  const connection = runtime.connectHost();
  const firstPort = fakePort("https://asset.invalid/active.glb", { x: 110, y: 150 });
  const unregisterFirst = runtime.registerPort(firstPort.port);
  expect(publishSpatialHost(connection, spatialArena(1))).toBe(true);

  const firstFence = runtime.snapshot.fence!;
  expect(Object.keys(firstFence).sort()).toEqual([
    "arenaRevision",
    "ownerGeneration",
    "ownerToken",
    "portIncarnation",
    "routeEpoch",
    "sessionEpoch",
  ]);
  const t1 = runtime.acquireWorldRootLease("pointer-1")!;
  const t2 = runtime.acquireWorldRootLease("pointer-2")!;
  const currentPoint: PresenceArenaPoint = {
    space: "visual-viewport-css-px",
    revision: 1,
    x: 120,
    y: 150,
  };
  expect(runtime.releaseWorldRootLease(t1)).toBe(false);
  expect(runtime.writeWorldRoot(t1, currentPoint)).toBe(false);
  expect(runtime.writeWorldRoot(t2, currentPoint)).toBe(true);

  expect(publishSpatialHost(connection, spatialArena(2), {
    ownerToken: "owner-next",
    ownerGeneration: 2,
  })).toBe(true);
  const writesAfterFenceChange = firstPort.writes.length;
  expect(runtime.writeWorldRoot(t2, { ...currentPoint, revision: 2 })).toBe(false);
  expect(firstPort.writes).toHaveLength(writesAfterFenceChange);

  // Even if every host field returns to its old values, the revoked token
  // cannot reappear as current authority.
  expect(publishSpatialHost(connection, spatialArena(1))).toBe(true);
  expect(runtime.writeWorldRoot(t2, currentPoint)).toBe(false);

  const prePortAba = runtime.acquireWorldRootLease("before-port-aba")!;
  expect(unregisterFirst()).toBe(true);
  const secondPort = fakePort("https://asset.invalid/active.glb", firstPort.root());
  runtime.registerPort(secondPort.port);
  expect(runtime.snapshot.fence?.portIncarnation).toBeGreaterThan(firstFence.portIncarnation);
  expect(runtime.writeWorldRoot(prePortAba, currentPoint)).toBe(false);
  expect(runtime.releaseWorldRootLease(t1)).toBe(false);
});

test("S02 world-root port fails closed when its loaded asset URL differs from active authority", () => {
  const runtime = new PresenceSceneActorRuntime();
  const connection = runtime.connectHost();
  const mismatched = fakePort("https://asset.invalid/stale.glb", { x: 110, y: 150 });
  runtime.registerPort(mismatched.port);
  publishSpatialHost(connection, spatialArena(1), {
    assetUrl: "https://asset.invalid/active.glb",
  });

  expect(runtime.snapshot.enabled).toBe(false);
  expect(runtime.snapshot.fence).toBeNull();
  expect(runtime.acquireWorldRootLease("mismatch")).toBeNull();
  expect(mismatched.writes).toEqual([]);
});

test("S02 nearest-safe placement uses today-sidecar, 8px clearance, and x-then-y ties", () => {
  const arena = spatialArena(3, [
    { id: "center-obstacle", rect: { x: 100, y: 90, width: 20, height: 20 } },
  ]);
  const result = resolveS02FreePlacement(arena, {
    routeEpoch: 1,
    arenaRevision: 3,
    point: { space: "visual-viewport-css-px", revision: 3, x: 110, y: 100 },
  }, { width: 20, height: 20, offsetX: 0, offsetY: 0 }, 8);

  expect(result).toMatchObject({
    kind: "placed",
    resolution: "adjusted",
    point: { x: 82, y: 100 },
  });

  const noSpace = resolveS02FreePlacement(spatialArena(4, [
    { id: "occupied", rect: { x: 0, y: 0, width: 240, height: 220 } },
  ]), {
    routeEpoch: 1,
    arenaRevision: 4,
    point: { space: "visual-viewport-css-px", revision: 4, x: 110, y: 100 },
  }, { width: 20, height: 20, offsetX: 0, offsetY: 0 }, 8);
  expect(noSpace).toEqual({ kind: "no-space", reason: "occupied" });
});

test("S02 direct grab waits for 6px, preserves grab offset, commits only on up, and rejects stale pointer tokens", () => {
  const runtime = new PresenceSceneActorRuntime();
  const connection = runtime.connectHost();
  const port = fakePort("https://asset.invalid/active.glb", { x: 100, y: 150 });
  runtime.registerPort(port.port);
  const commits: PresencePlacementIntent[] = [];
  publishSpatialHost(connection, spatialArena(1), {}, commits);
  const baselineCommits = runtime.snapshot.commitCount;

  const tap = runtime.beginPointer({
    pointerId: 3,
    clientX: 108,
    clientY: 125,
    button: 0,
    isPrimary: true,
  })!;
  expect(runtime.movePointer(tap, { clientX: 113, clientY: 125 })).toBe(false);
  expect(runtime.snapshot.leaseToken).toBeNull();
  expect(runtime.endPointer(tap, { clientX: 113, clientY: 125 })).toBe("tap");
  expect(runtime.snapshot.commitCount).toBe(baselineCommits);

  const dragStart = port.root();
  const drag = runtime.beginPointer({
    pointerId: 4,
    clientX: dragStart.x + 8,
    clientY: dragStart.y - 25,
    button: 0,
    isPrimary: true,
  })!;
  expect(runtime.movePointer(drag, {
    clientX: dragStart.x + 28,
    clientY: dragStart.y - 15,
  })).toBe(true);
  expect(port.root().x).toBeCloseTo(dragStart.x + 20);
  expect(port.root().y).toBeCloseTo(dragStart.y + 10);
  expect(runtime.snapshot.commitCount).toBe(baselineCommits);
  expect(runtime.endPointer(drag, {
    clientX: dragStart.x + 28,
    clientY: dragStart.y - 15,
  })).toBe("committed");
  expect(runtime.snapshot.commitCount).toBe(baselineCommits + 1);
  expect(commits).toHaveLength(1);

  const stale = runtime.beginPointer({
    pointerId: 5,
    clientX: port.root().x,
    clientY: port.root().y - 20,
    button: 0,
    isPrimary: true,
  })!;
  publishSpatialHost(connection, spatialArena(2), {
    ownerToken: "new-owner-token",
    ownerGeneration: 2,
  }, commits);
  const writesAfterInvalidation = port.writes.length;
  expect(runtime.movePointer(stale, { clientX: port.root().x + 40, clientY: port.root().y })).toBe(false);
  expect(runtime.endPointer(stale, { clientX: port.root().x + 40, clientY: port.root().y })).toBe("ignored");
  expect(port.writes).toHaveLength(writesAfterInvalidation);
});

test("S02 Arena invalidation restores the committed safe root before a no-space revision", () => {
  const runtime = new PresenceSceneActorRuntime();
  const connection = runtime.connectHost();
  const port = fakePort("https://asset.invalid/active.glb", { x: 100, y: 150 });
  runtime.registerPort(port.port);
  publishSpatialHost(connection, spatialArena(1));
  const committed = port.root();

  const pointer = runtime.beginPointer({
    pointerId: 9,
    clientX: committed.x,
    clientY: committed.y - 20,
    button: 0,
    isPrimary: true,
  })!;
  expect(runtime.movePointer(pointer, {
    clientX: committed.x + 30,
    clientY: committed.y - 20,
  })).toBe(true);
  expect(port.root()).not.toEqual(committed);

  publishSpatialHost(connection, spatialArena(2, [
    { id: "occupied", rect: { x: 0, y: 0, width: 240, height: 220 } },
  ]), { ownerToken: "owner-blocked", ownerGeneration: 2 });

  expect(port.root()).toEqual(committed);
  expect(runtime.snapshot.status).toBe("no-space");
  expect(runtime.snapshot.activePointerToken).toBeNull();
  expect(runtime.movePointer(pointer, {
    clientX: committed.x + 60,
    clientY: committed.y,
  })).toBe(false);
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
  await expect(page.getByRole("button", { name: "동반자 움직이기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "동반자 위치 바꾸기", exact: true })).toHaveCount(0);

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
  await expect(page.getByRole("button", { name: "동반자 움직이기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "동반자 위치 바꾸기", exact: true })).toHaveCount(0);
  await expect(page.locator(".home-lead button")).toBeVisible();
  await expect(page.locator(".home-trail-dates")).toBeVisible();
});
