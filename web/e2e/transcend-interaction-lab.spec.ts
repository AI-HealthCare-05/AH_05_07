import { createHash } from "node:crypto";

import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { PINNED_ACTIVE_ASSET } from "../transcend-lab/src/platform/embodiment/labEmbodimentPort";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.config.metadata.transcendLab !== true, "dedicated Transcend Lab config only");
});

async function openRunningLab(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "running");
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(1);
  await expect(page.getByTestId("logical-actor")).toHaveCount(1);
}

async function noTaskResources(page: Page) {
  return page.evaluate(() => window.__TRANSCEND_LAB__!.diagnostics());
}

async function fetchExactPinnedBytes(request: APIRequestContext): Promise<Buffer> {
  const response = await request.get(PINNED_ACTIVE_ASSET.url);
  expect(response.ok()).toBe(true);
  const bytes = await response.body();
  expect(bytes.byteLength).toBe(PINNED_ACTIVE_ASSET.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(PINNED_ACTIVE_ASSET.sha256);
  return bytes;
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

test("body drag preserves grab offset, commits free intent, suppresses drag-click, and fences cancellation", async ({ page }) => {
  await openRunningLab(page);

  const body = page.getByTestId("actor-hit-envelope");
  const bodyBox = await body.boundingBox();
  expect(bodyBox).not.toBeNull();
  const startPose = (await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose!;
  const grabX = bodyBox!.x + bodyBox!.width * 0.72;
  const grabY = bodyBox!.y + bodyBox!.height * 0.28;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.point).toEqual(startPose.point);
  await page.mouse.move(grabX + 32, grabY + 24, { steps: 4 });
  const duringDrag = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(duringDrag.pointerDragging).toBe(true);
  expect(duringDrag.pose?.point.x).toBeCloseTo(startPose.point.x + 32, 4);
  expect(duringDrag.pose?.point.y).toBeCloseTo(startPose.point.y + 24, 4);
  await page.mouse.up();
  const dropped = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(dropped.intent.kind).toBe("free");
  expect(dropped.pose).toMatchObject({ anchorId: null, source: "free" });
  await expect(page.getByTestId("lab-status")).toContainText("Free placement committed");

  const afterDrag = await body.boundingBox();
  await page.mouse.move(afterDrag!.x + afterDrag!.width / 2, afterDrag!.y + afterDrag!.height / 2);
  await page.mouse.down();
  await page.mouse.move(afterDrag!.x - 80, afterDrag!.y - 40);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("escape");
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent).toEqual(dropped.intent);

  const cancelBox = await body.boundingBox();
  await page.mouse.move(cancelBox!.x + cancelBox!.width / 2, cancelBox!.y + cancelBox!.height / 2);
  await page.mouse.down();
  const cancelPointerId = await body.getAttribute("data-active-pointer-id");
  expect(cancelPointerId).not.toBeNull();
  await body.dispatchEvent("pointercancel", {
    pointerId: Number(cancelPointerId),
    pointerType: "mouse",
    clientX: cancelBox!.x,
    clientY: cancelBox!.y,
  });
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("pointer-cancel");

  const lostBox = await body.boundingBox();
  await page.mouse.move(lostBox!.x + lostBox!.width / 2, lostBox!.y + lostBox!.height / 2);
  await page.mouse.down();
  const lostPointerId = await body.getAttribute("data-active-pointer-id");
  expect(lostPointerId).not.toBeNull();
  await body.dispatchEvent("lostpointercapture", {
    pointerId: Number(lostPointerId),
    pointerType: "mouse",
  });
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("lost-pointer-capture");

  await body.click();
  await expect(page.getByTestId("lab-status")).toContainText("Tactile hit admitted");
});

test("synthetic touch and pen pointers use the same body-local free-placement path", async ({ page }) => {
  await openRunningLab(page);
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });

  let box = await page.getByTestId("actor-hit-envelope").boundingBox();
  expect(box).not.toBeNull();
  let x = box!.x + box!.width / 2;
  let y = box!.y + box!.height / 2;
  const beforeTouch = (await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose!.point;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 11, radiusX: 2, radiusY: 2, force: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 24, y: y + 18, id: 11, radiusX: 2, radiusY: 2, force: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const afterTouch = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterTouch.intent.kind).toBe("free");
  expect(afterTouch.pose).toMatchObject({ anchorId: null, source: "free" });
  expect(afterTouch.pose!.point.x).toBeGreaterThan(beforeTouch.x);

  box = await page.getByTestId("actor-hit-envelope").boundingBox();
  x = box!.x + box!.width / 2;
  y = box!.y + box!.height / 2;
  const beforePen = afterTouch.pose!.point;
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "pen",
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved", x: x - 20, y: y + 22, button: "none", buttons: 1, pointerType: "pen",
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: x - 20, y: y + 22, button: "left", buttons: 0, clickCount: 1, pointerType: "pen",
  });
  const afterPen = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterPen.intent.kind).toBe("free");
  expect(afterPen.pose).toMatchObject({ anchorId: null, source: "free" });
  expect(afterPen.pose!.point.x).toBeLessThan(beforePen.x);
});

test("free coordinate and keyboard alternatives reach non-anchor positions and carry normalized intent across routes", async ({ page }) => {
  await openRunningLab(page);
  const placements = [[15, 18], [82, 22], [24, 78]] as const;
  const observed = new Set<string>();
  for (const [x, y] of placements) {
    await page.getByTestId("free-position-x").fill(String(x));
    await page.getByTestId("free-position-y").fill(String(y));
    await page.getByTestId("apply-free-position").click();
    const state = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
    expect(state.intent).toEqual({ kind: "free", u: x / 100, v: y / 100 });
    expect(state.pose).toMatchObject({ anchorId: null, source: "free" });
    observed.add(`${state.pose!.point.x.toFixed(2)},${state.pose!.point.y.toFixed(2)}`);
  }
  expect(observed.size).toBe(3);

  const body = page.getByTestId("actor-hit-envelope");
  await body.focus();
  await expect(body).toBeFocused();
  const beforeNudge = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  await body.press("ArrowRight");
  const afterNudge = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterNudge.intent.kind).toBe("free");
  expect(afterNudge.pose!.point.x).toBeGreaterThan(beforeNudge.pose!.point.x);

  const carried = afterNudge.intent;
  await page.getByTestId("toggle-route").click();
  const afterRoute = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterRoute.intent).toEqual(carried);
  expect(afterRoute.pose).toMatchObject({ anchorId: null, source: "free" });

  await page.getByTestId("free-position-x").focus();
  const inputBefore = await page.getByTestId("free-position-x").inputValue();
  await page.getByTestId("free-position-x").press("ArrowUp");
  expect(Number(await page.getByTestId("free-position-x").inputValue())).toBe(Number(inputBefore) + 1);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent).toEqual(carried);
});

test("native scroll and wheel remain uncancelled outside the bounded companion body", async ({ page }) => {
  await openRunningLab(page);
  const touchActions = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("*")]
    .filter((element) => getComputedStyle(element).touchAction === "none")
    .map((element) => ({
      testId: element.dataset.testid ?? null,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })));
  expect(touchActions).toHaveLength(1);
  expect(touchActions[0].testId).toBe("actor-hit-envelope");
  expect(touchActions[0].width).toBe(136);
  expect(touchActions[0].height).toBe(152);
  expect(touchActions[0].width * touchActions[0].height).toBeLessThan(25_000);

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
  const initial = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(initial.snapshot?.hardZones.length).toBeGreaterThanOrEqual(3);
  const safe = await page.evaluate(() => {
    const state = window.__TRANSCEND_LAB__!.state();
    if (!state.pose || !state.snapshot) return false;
    const envelope = { x: state.pose.point.x - 68, y: state.pose.point.y - 120, width: 136, height: 152 };
    return state.snapshot.hardZones.every((zone) =>
      envelope.x + envelope.width <= zone.x
      || zone.x + zone.width <= envelope.x
      || envelope.y + envelope.height <= zone.y
      || zone.y + zone.height <= envelope.y);
  });
  expect(safe).toBe(true);
  await page.getByTestId("move-harbor").click();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent.kind).toBe("anchor");

  const checkbox = page.getByLabel("Expand hard zone (exercise no-fit fallback)");
  await checkbox.check();
  await expect(page.getByTestId("logical-actor")).toHaveCount(0);
  await expect(checkbox).toBeFocused();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).resolution).toEqual({
    kind: "control",
    controlId: "relocation-controls",
  });
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("arena-publication");
  await checkbox.uncheck();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByTestId("logical-actor")).toHaveCount(1);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).not.toBeNull();
});

test("exact pinned bytes parse into the real GLB for both backends and A/B evidence stays identical", async ({ page, request }) => {
  const pinnedBytes = await fetchExactPinnedBytes(request);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route(PINNED_ACTIVE_ASSET.url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "model/gltf-binary",
      body: pinnedBytes,
    });
  });
  await openRunningLab(page);
  await page.getByTestId("load-asset").click();
  await expect(page.getByTestId("lab-status")).toContainText("Actual bytes verified and displayed");
  await expect(page.getByTestId("representation-mode")).toContainText("verified-glb · clip idle");
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveAttribute("data-representation", "verified-glb");
  const loaded = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(loaded.assetResult).toMatchObject({
    status: "loaded",
    responseBytes: PINNED_ACTIVE_ASSET.bytes,
    sha256: PINNED_ACTIVE_ASSET.sha256,
    verification: "actual-response-sha256",
    container: "self-contained-glb-v2",
  });
  expect(loaded.representation).toMatchObject({
    mode: "verified-glb",
    assetId: PINNED_ACTIVE_ASSET.assetId,
    sha256: PINNED_ACTIVE_ASSET.sha256,
    clipName: "idle",
  });
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
  expect(evidence.every((record) => record.schemaVersion === "transcend-lab-metrics.v2")).toBe(true);
  expect(evidence.every((record) => record.asset.assetId === PINNED_ACTIVE_ASSET.assetId)).toBe(true);
  expect(evidence.every((record) => record.frameSampleMeaning === "cpu-render-submission-ms")).toBe(true);
  expect(evidence.every((record) => record.representation.mode === "verified-glb")).toBe(true);
  expect(new Set(evidence.map((record) => record.representation.sha256))).toEqual(new Set([PINNED_ACTIVE_ASSET.sha256]));
  expect(new Set(evidence.map((record) => record.representation.clipName))).toEqual(new Set(["idle"]));
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
    await expect(page.getByTestId("actor-hit-envelope")).toBeVisible();
    await expect(page.getByTestId("lab-status")).toBeVisible();
    const move = page.getByTestId("move-harbor");
    await move.focus();
    await expect(move).toBeFocused();
    await move.click();
    expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent).toMatchObject({
      kind: "anchor",
      preferredAnchorId: "harbor",
    });
  } finally {
    await context.close();
  }
});

test("a viewport smaller than 320x560 is measured as-is", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 280, height: 480 } });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "running");
    const state = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
    expect(state.snapshot?.viewport).toMatchObject({ x: 0, y: 0, width: 280, height: 480 });
    expect(state.snapshot?.viewport.width).toBeLessThan(320);
    expect(state.snapshot?.viewport.height).toBeLessThan(560);
  } finally {
    await context.close();
  }
});

test("rapid backend replacement followed by stop cannot revive an old owner", async ({ page }) => {
  await openRunningLab(page);
  await page.evaluate(async () => {
    const api = window.__TRANSCEND_LAB__!;
    await Promise.allSettled([
      api.selectBackend("shared-stage"),
      api.selectBackend("movable-patch"),
      api.stop(),
    ]);
  });
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "stopped");
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  expect(await noTaskResources(page)).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lease).toBeNull();
});

test("renderer and load failures leave semantic controls usable; stop/reset drain and block late work", async ({ page }) => {
  await page.goto("/?rendererFailure=1");
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "error");
  await expect(page.getByTestId("renderer-error")).toContainText("forced movable-patch renderer failure");
  await expect(page.getByTestId("move-harbor")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reset" })).toBeEnabled();
  await page.getByTestId("move-harbor").click();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent).toMatchObject({
    kind: "anchor",
    preferredAnchorId: "harbor",
  });
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
