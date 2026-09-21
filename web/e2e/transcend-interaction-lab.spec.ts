import { expect, test, type Browser, type Page } from "@playwright/test";

import { PINNED_ACTIVE_ASSET } from "../transcend-lab/src/platform/embodiment/labEmbodimentPort";

async function openRunningLab(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "running");
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(1);
  await expect(page.getByTestId("logical-actor")).toHaveCount(1);
}

async function noTaskResources(page: Page) {
  return page.evaluate(() => window.__TRANSCEND_LAB__!.diagnostics());
}

test("isolated synthetic routing retains one actor, one writer, one backend, and no product state", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await openRunningLab(page);
  const initialUrl = page.url();
  const initialHistoryLength = await page.evaluate(() => history.length);

  const initial = await page.evaluate(() => ({
    state: window.__TRANSCEND_LAB__!.state(),
    world: window.__TRANSCEND_LAB__!.worldState(),
    diagnostics: window.__TRANSCEND_LAB__!.diagnostics(),
  }));
  expect(initial.state.pose?.anchorId).toBe("sunrise");
  expect(initial.state.snapshot?.anchors).toHaveLength(2);
  expect(initial.state.snapshot?.anchors.every((anchor) => anchor.arenaRevision === initial.state.snapshot?.revision)).toBe(true);
  expect(initial.world.lease).toBeNull();
  expect(initial.diagnostics).toMatchObject({ timers: 0, pendingLoads: 0, liveWebglContexts: 1 });
  expect(initial.diagnostics.listeners).toBeLessThanOrEqual(8);
  expect(initial.diagnostics.rafLoops).toBe(1);

  await page.evaluate(() => window.__TRANSCEND_LAB__!.toggleRoutes(100));
  const stressed = await page.evaluate(() => ({
    state: window.__TRANSCEND_LAB__!.state(),
    world: window.__TRANSCEND_LAB__!.worldState(),
    diagnostics: window.__TRANSCEND_LAB__!.diagnostics(),
  }));
  expect(stressed.state.routeToggleCount).toBe(100);
  expect(stressed.state.actorId).toBe("transcend-companion-actor-1");
  expect(stressed.state.pose?.arenaRevision).toBe(stressed.state.snapshot?.revision);
  expect(stressed.state.pose?.routeEpoch).toBe(stressed.state.routeEpoch);
  expect(stressed.state.transitionTrace).toEqual([
    "revoke-world-root",
    "advance-route-epoch",
    "retire-arena-snapshot",
    "measure-route-providers",
    "publish-arena-snapshot",
    "resolve-placement-intent",
    "apply-placement",
  ]);
  expect(stressed.world.lease).toBeNull();
  expect(stressed.diagnostics.liveWebglContexts).toBe(1);
  expect(stressed.diagnostics.rafLoops).toBe(1);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(1);
  await expect(page.getByTestId("logical-actor")).toHaveCount(1);

  const persistence = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    indexed: typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map((database) => database.name)
      : [],
    cookie: document.cookie,
    historyLength: history.length,
  }));
  expect(persistence).toEqual({
    local: [],
    session: [],
    indexed: [],
    cookie: "",
    historyLength: initialHistoryLength,
  });
  expect(page.url()).toBe(initialUrl);
  expect(await context.cookies()).toEqual([]);
  expect(requests.some((url) => /\/api\/|supabase|model-v2|auth|\.glb(?:\?|$)/i.test(url))).toBe(false);
});

test("drag, single-press, and keyboard relocation share anchors while cancellation is fenced", async ({ page }) => {
  await openRunningLab(page);
  await page.getByTestId("move-harbor").click();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).toBe("harbor");

  const handle = page.getByTestId("actor-move-handle");
  await handle.focus();
  await expect(handle).toBeFocused();
  await handle.press("ArrowRight");
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).toBe("sunrise");

  const harbor = await page.locator('[data-anchor-id="harbor"]').boundingBox();
  const handleBox = await handle.boundingBox();
  expect(harbor).not.toBeNull();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(harbor!.x + harbor!.width / 2, harbor!.y + harbor!.height / 2, { steps: 5 });
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).toBe("harbor");

  const afterDrag = await handle.boundingBox();
  await page.mouse.move(afterDrag!.x + afterDrag!.width / 2, afterDrag!.y + afterDrag!.height / 2);
  await page.mouse.down();
  await page.mouse.move(afterDrag!.x - 80, afterDrag!.y - 40);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("escape");
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).toBe("harbor");

  const cancelBox = await handle.boundingBox();
  await page.mouse.move(cancelBox!.x + cancelBox!.width / 2, cancelBox!.y + cancelBox!.height / 2);
  await page.mouse.down();
  const cancelPointerId = await handle.getAttribute("data-active-pointer-id");
  expect(cancelPointerId).not.toBeNull();
  await handle.dispatchEvent("pointercancel", {
    pointerId: Number(cancelPointerId),
    pointerType: "mouse",
    clientX: cancelBox!.x,
    clientY: cancelBox!.y,
  });
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("pointer-cancel");

  const lostBox = await handle.boundingBox();
  await page.mouse.move(lostBox!.x + lostBox!.width / 2, lostBox!.y + lostBox!.height / 2);
  await page.mouse.down();
  const lostPointerId = await handle.getAttribute("data-active-pointer-id");
  expect(lostPointerId).not.toBeNull();
  await handle.dispatchEvent("lostpointercapture", {
    pointerId: Number(lostPointerId),
    pointerType: "mouse",
  });
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("lost-pointer-capture");

  await page.getByTestId("actor-hit-envelope").click();
  await expect(page.getByTestId("lab-status")).toContainText("Tactile hit admitted");
});

test("native scroll and wheel remain uncancelled outside the bounded move handle", async ({ page }) => {
  await openRunningLab(page);
  const touchActions = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("*")]
    .filter((element) => getComputedStyle(element).touchAction === "none")
    .map((element) => ({
      testId: element.dataset.testid ?? null,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })));
  expect(touchActions).toHaveLength(1);
  expect(touchActions[0].testId).toBe("actor-move-handle");
  expect(touchActions[0].width * touchActions[0].height).toBeLessThan(2_000);

  const uncancelled = await page.getByTestId("outside-interaction-surface").evaluate((element) => {
    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 120, ctrlKey: true });
    return element.dispatchEvent(wheel) && !wheel.defaultPrevented;
  });
  expect(uncancelled).toBe(true);
  const before = await page.evaluate(() => scrollY);
  const revisionBeforeScroll = await page.getByTestId("transcend-lab").getAttribute("data-arena-revision");
  await page.mouse.move(10, 10);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  await expect.poll(async () => Number(await page.getByTestId("transcend-lab").getAttribute("data-arena-revision")))
    .toBeGreaterThan(Number(revisionBeforeScroll));
  const afterScroll = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterScroll.pose?.arenaRevision).toBe(afterScroll.snapshot?.revision);
});

test("hard-zone geometry re-resolves through control fallback and restores a safe pose", async ({ page }) => {
  await openRunningLab(page);
  const checkbox = page.getByLabel("Expand hard zone (exercise no-fit fallback)");
  await checkbox.check();
  await expect(page.getByTestId("logical-actor")).toHaveCount(0);
  await expect(page.locator("#relocation-controls")).toBeFocused();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).resolution).toEqual({
    kind: "control",
    controlId: "relocation-controls",
  });
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("arena-publication");
  await checkbox.uncheck();
  await expect(page.getByTestId("logical-actor")).toHaveCount(1);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).not.toBeNull();
});

test("asset admission requests only the fixed active URL and A/B evidence is schema-identical", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route(PINNED_ACTIVE_ASSET.url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "model/gltf-binary",
      body: Buffer.from([0x67, 0x6c, 0x54, 0x46]),
    });
  });
  await openRunningLab(page);
  await page.getByTestId("load-asset").click();
  await expect(page.getByTestId("lab-status")).toContainText(`Admitted ${PINNED_ACTIVE_ASSET.assetId}`);
  expect(requests.filter((url) => url.endsWith(".glb"))).toEqual([PINNED_ACTIVE_ASSET.url]);
  expect(requests.some((url) => /\/api\/|supabase|model-v2|auth/i.test(url))).toBe(false);

  await page.getByTestId("run-comparison").click();
  await expect(page.getByTestId("evidence-count")).toHaveText("4 metric records", { timeout: 30_000 });
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "stopped");
  const evidence = await page.evaluate(() => window.__TRANSCEND_LAB__!.state().evidence);
  expect(evidence).toHaveLength(4);
  expect(new Set(evidence.map((record) => record.backend))).toEqual(new Set(["movable-patch", "shared-stage"]));
  for (const backend of ["movable-patch", "shared-stage"] as const) {
    expect(evidence.filter((record) => record.backend === backend).map((record) => record.condition)).toEqual(["cold", "warm"]);
  }
  expect(new Set(evidence.map((record) => record.scenarioId)).size).toBe(1);
  expect(new Set(evidence.map((record) => record.scenarioHash)).size).toBe(1);
  expect(new Set(evidence.map((record) => JSON.stringify(record.commonClock))).size).toBe(1);
  expect(new Set(evidence.map((record) => JSON.stringify(record.inputTrace))).size).toBe(1);
  expect(evidence.every((record) => record.schemaVersion === "transcend-lab-metrics.v1")).toBe(true);
  expect(evidence.every((record) => record.asset.assetId === PINNED_ACTIVE_ASSET.assetId)).toBe(true);
  expect(evidence.every((record) => record.contextCounts.afterTeardown === 0)).toBe(true);
  expect(evidence.every((record) => record.drawActivity.draws > 0)).toBe(true);
  expect(evidence.every((record) => !record.clippingHardZone.clipped)).toBe(true);
  expect(evidence.every((record) => !record.clippingHardZone.hardZoneOverlap)).toBe(true);
  expect(evidence.every((record) => record.routeContinuity.toggles === 2 && record.routeContinuity.retained)).toBe(true);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  expect(await noTaskResources(page)).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});

test("reduced motion and forced colors preserve presence, controls, focus, and semantic status", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    reducedMotion: "reduce",
    forcedColors: "active",
  });
  const page = await context.newPage();
  try {
    await openRunningLab(page);
    const diagnostics = await noTaskResources(page);
    expect(diagnostics.rafLoops).toBe(0);
    expect(diagnostics.liveWebglContexts).toBe(1);
    await expect(page.getByTestId("logical-actor")).toHaveCount(1);
    await expect(page.getByTestId("actor-move-handle")).toBeVisible();
    await expect(page.getByTestId("lab-status")).toBeVisible();
    const move = page.getByTestId("move-harbor");
    await move.focus();
    await expect(move).toBeFocused();
    await move.click();
    expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).toBe("harbor");
  } finally {
    await context.close();
  }
});

test("renderer and load failures leave semantic controls usable; stop/reset drain and block late work", async ({ page }) => {
  await page.goto("/?rendererFailure=1");
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "error");
  await expect(page.getByTestId("renderer-error")).toContainText("forced movable-patch renderer failure");
  await expect(page.getByTestId("move-harbor")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reset" })).toBeEnabled();
  await page.getByTestId("move-harbor").click();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).toBe("harbor");
  expect(await page.locator('[data-lab-backend-mounted="true"]').count()).toBe(0);

  await page.route(PINNED_ACTIVE_ASSET.url, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: 200, contentType: "model/gltf-binary", body: Buffer.from([1, 2, 3]) });
  });
  await openRunningLab(page);
  await page.getByTestId("load-asset").click();
  await expect.poll(async () => (await noTaskResources(page)).pendingLoads).toBe(1);
  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).assetResult?.status).not.toBe("loaded");

  await page.evaluate(() => window.__TRANSCEND_LAB__!.start("shared-stage"));
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(1);
  const reset = await page.evaluate(() => window.__TRANSCEND_LAB__!.reset());
  expect(reset).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  await page.waitForTimeout(100);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).lifecycle).toBe("stopped");
});
