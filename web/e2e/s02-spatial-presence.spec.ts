import { expect, test, type Locator, type Page } from "@playwright/test";
import { companionAssetManifest } from "../src/ui/companionAssets.generated";
import type { CompanionSpecies } from "../src/ui/companion";

const url = "/?fixture=VP-10&screen=S02";

async function openSpatialS02(page: Page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.goto(url);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );
  const layer = page.locator('[data-presence-scene-actor-interaction="S02"]');
  await expect(layer).toHaveCount(1);
  await expect(layer.getByRole("button", { name: "동반자 움직이기", exact: true })).toBeVisible();
  await expect(layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true })).toBeVisible();
  expect(await layer.evaluate(element => element.closest('[aria-hidden="true"]'))).toBeNull();
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  await expect(host).toHaveAttribute("data-presence-world-root-enabled", "true");
  await expect(host).toHaveAttribute("data-presence-world-root-port-count", "1");
  return layer;
}

async function rootPoint(layer: Locator) {
  return {
    x: Number(await layer.getAttribute("data-presence-root-x")),
    y: Number(await layer.getAttribute("data-presence-root-y")),
  };
}

async function dragBy(page: Page, target: Locator, deltaX: number, deltaY: number) {
  const box = await target.boundingBox();
  if (!box) throw new Error("actor target has no box");
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + deltaX, start.y + deltaY, { steps: 4 });
  await page.mouse.up();
}

async function startCapturedDrag(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error("actor target has no box");
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 24, start.y - 10, { steps: 3 });
  await expect(target).toHaveAttribute("data-pointer-dragging", "true");
  return start;
}

for (const [width, height] of [[390, 844], [768, 900], [1366, 768]] as const) {
  test(`S02 fenced direct placement drags and commits at ${width}px`, async ({ page }) => {
    const layer = await openSpatialS02(page, width, height);
    const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });
    const before = await rootPoint(layer);
    const commits = Number(await layer.getAttribute("data-presence-commit-count"));

    await dragBy(page, target, width === 390 ? -18 : 28, -12);

    await expect.poll(async () => Number(
      await layer.getAttribute("data-presence-commit-count"),
    )).toBe(commits + 1);
    const after = await rootPoint(layer);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(6);
    await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
    await expect(page.locator(".living-three-scene")).toHaveAttribute(
      "data-scene-actor-owner",
      "s02-actor-v1",
    );
  });
}

test("S02 presentation controls stay visually quiet without losing semantics", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });
  const cycle = layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true });
  const status = layer.locator(".presence-scene-actor-status");

  await expect(target).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await target.hover();
  await expect(target).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(target).toHaveCSS("box-shadow", "none");
  await expect(target).toHaveCSS("transform", "none");

  await expect(cycle).toHaveAccessibleName("동반자 위치 바꾸기");
  expect((await cycle.textContent())?.trim()).toBe("");
  expect(await cycle.evaluate(element => Array.from(element.childNodes).some(node =>
    node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  ))).toBe(false);
  const cycleBox = await cycle.boundingBox();
  if (!cycleBox) throw new Error("alternative control is not measurable");
  expect(cycleBox.width).toBeGreaterThanOrEqual(44);
  expect(cycleBox.height).toBeGreaterThanOrEqual(44);
  await expect(cycle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(cycle.locator(".presence-scene-actor-cycle-mark")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(cycle.locator(".presence-scene-actor-cycle-mark i")).toHaveCount(3);

  await expect(status).toHaveAttribute("role", "status");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveClass(/\bsr-only\b/);
  expect(await status.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      position: style.position,
      width: style.width,
      height: style.height,
      overflow: style.overflow,
      clip: style.clip,
    };
  })).toEqual({
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0px, 0px, 0px, 0px)",
  });

  await target.focus();
  await page.keyboard.press("Tab");
  await expect(cycle).toBeFocused();
  expect(await cycle.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
});

test("unsafe S02 drop receives deterministic nearest-safe correction", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });
  const control = layer.locator(".presence-scene-actor-controls");
  const targetBox = await target.boundingBox();
  const controlBox = await control.boundingBox();
  if (!targetBox || !controlBox) throw new Error("spatial controls are not measurable");
  const root = await rootPoint(layer);
  const desired = {
    x: controlBox.x + controlBox.width / 2,
    y: controlBox.y + controlBox.height / 2,
  };
  const start = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    start.x + desired.x - root.x,
    start.y + desired.y - root.y,
    { steps: 5 },
  );
  await page.mouse.up();

  await expect(layer).toHaveAttribute("data-presence-spatial-status", "corrected");
  expect(Number(await layer.getAttribute("data-presence-correction-distance"))).toBeGreaterThan(0);
  const correctedTarget = await target.boundingBox();
  const correctedControl = await control.boundingBox();
  if (!correctedTarget || !correctedControl) throw new Error("corrected geometry unavailable");
  const overlaps = !(
    correctedTarget.x + correctedTarget.width <= correctedControl.x
    || correctedControl.x + correctedControl.width <= correctedTarget.x
    || correctedTarget.y + correctedTarget.height <= correctedControl.y
    || correctedControl.y + correctedControl.height <= correctedTarget.y
  );
  expect(overlaps).toBe(false);
});

test("cancel, lost capture, Escape, and route invalidation restore and fence old S02 pointers", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });

  const escapeBaseline = await rootPoint(layer);
  await startCapturedDrag(page, target);
  await page.keyboard.press("Escape");
  await expect(layer).toHaveAttribute("data-presence-spatial-status", "restored");
  await expect.poll(() => rootPoint(layer)).toEqual(escapeBaseline);
  await page.mouse.up();

  const cancelBaseline = await rootPoint(layer);
  await startCapturedDrag(page, target);
  const cancelPointerId = Number(await target.getAttribute("data-active-pointer-id"));
  await target.dispatchEvent("pointercancel", {
    pointerId: cancelPointerId,
    pointerType: "mouse",
    isPrimary: true,
    bubbles: true,
  });
  await expect.poll(() => rootPoint(layer)).toEqual(cancelBaseline);
  await page.mouse.up();

  const lostBaseline = await rootPoint(layer);
  await startCapturedDrag(page, target);
  const lostPointerId = Number(await target.getAttribute("data-active-pointer-id"));
  await target.evaluate((element: HTMLButtonElement, pointerId) => {
    if (!element.hasPointerCapture(pointerId)) throw new Error("pointer capture missing");
    element.releasePointerCapture(pointerId);
  }, lostPointerId);
  await target.dispatchEvent("lostpointercapture", {
    pointerId: lostPointerId,
    pointerType: "mouse",
    isPrimary: true,
    bubbles: true,
  });
  await expect(layer).toHaveAttribute("data-presence-spatial-status", "restored");
  await expect.poll(() => rootPoint(layer)).toEqual(lostBaseline);
  await page.mouse.up();

  await startCapturedDrag(page, target);
  await page.locator(".home-lead button").evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  const writesAfterRoute = Number(await host.getAttribute("data-presence-world-root-write-count"));
  await page.mouse.move(10, 10);
  await page.mouse.up();
  await expect(host).toHaveAttribute("data-presence-world-root-pointer", "none");
  await page.waitForTimeout(50);
  expect(Number(await host.getAttribute("data-presence-world-root-write-count")))
    .toBe(writesAfterRoute);
  await expect(page.getByRole("button", { name: "동반자 움직이기", exact: true })).toHaveCount(0);
});

test("normalized S02 placement survives route return and responsive Arena rebuild", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const cycle = layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true });
  await cycle.click();
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  await expect.poll(async () => Number(await host.getAttribute("data-presence-world-root-commit-count"))).toBe(1);
  const committed = {
    x: Number(await host.getAttribute("data-presence-placement-x")),
    y: Number(await host.getAttribute("data-presence-placement-y")),
  };

  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
  await page.getByRole("button", { name: /SK7.*오늘의 기록으로 이동/ }).click();
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );
  await expect.poll(async () => ({
    x: Number(await host.getAttribute("data-presence-placement-x")),
    y: Number(await host.getAttribute("data-presence-placement-y")),
  })).toEqual(committed);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);

  const arenaRevision = Number(await host.getAttribute("data-presence-arena-revision"));
  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(async () => Number(await host.getAttribute("data-presence-arena-revision")))
    .toBeGreaterThan(arenaRevision);
  await expect.poll(async () => ({
    x: Number(await host.getAttribute("data-presence-placement-x")),
    y: Number(await host.getAttribute("data-presence-placement-y")),
  })).toEqual(committed);
  await expect(page.locator(".living-three-scene canvas")).toHaveCount(1);
});

test("S02 alternative control supports pointer and keyboard through the same commit path", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const cycle = layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true });
  const settle = layer.locator(".presence-scene-actor-settle");
  await expect(settle).toHaveCount(1);
  await expect(settle).not.toHaveAttribute("data-presence-settle-active", /.+/);
  await cycle.click();
  await expect(layer).toHaveAttribute("data-presence-commit-count", "1");
  await expect(settle).toHaveAttribute("data-presence-settle-active", "1");
  await expect(settle).toHaveCSS("animation-name", "presence-scene-actor-settle");
  const settleDuration = await settle.evaluate(element =>
    Number.parseFloat(getComputedStyle(element).animationDuration) * 1000,
  );
  expect(settleDuration).toBeGreaterThanOrEqual(180);
  expect(settleDuration).toBeLessThanOrEqual(260);
  await cycle.focus();
  await expect(cycle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(layer).toHaveAttribute("data-presence-commit-count", "2");
  await expect(settle).toHaveAttribute("data-presence-settle-active", "2");
  await expect(layer.locator("[role=status]")).toHaveClass(/\bsr-only\b/);
});

test("reduced motion suppresses the S02 placement settle animation", async ({ page }) => {
  const layer = await openSpatialS02(page);
  await layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true }).click();
  await expect(layer).toHaveAttribute("data-presence-commit-count", "1");
  await expect(layer.locator(".presence-scene-actor-settle")).toHaveCount(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[data-presence-scene-actor-interaction="S02"]')).toHaveCount(0);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "poster",
  );
  const probe = page.locator("[data-presence-settle-reduced-motion-probe]");
  await page.locator(".living-visual-stage").evaluate(stage => {
    const element = document.createElement("span");
    element.className = "presence-scene-actor-settle";
    element.dataset.presenceSettleActive = "1";
    element.dataset.presenceSettleReducedMotionProbe = "true";
    stage.append(element);
  });
  await expect(probe).toHaveCSS("animation-name", "none");
  await expect(probe).toHaveCSS("opacity", "0");
});

test("only the S02 actor target suppresses touch gestures and outside wheel scroll remains native", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });
  const cycle = layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true });
  await expect(target).toHaveCSS("touch-action", "none");
  await expect(cycle).not.toHaveCSS("touch-action", "none");
  await expect(layer).toHaveCSS("pointer-events", "none");
  await expect(target).toHaveCSS("pointer-events", "auto");

  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(10, 10);
  await page.mouse.wheel(0, 360);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});

test("forced colors preserves S02 focus and the graphical alternative control", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });
  const cycle = layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true });
  await target.focus();
  await expect(target).toBeFocused();
  expect(await target.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Tab");
  await expect(cycle).toBeFocused();
  expect(await cycle.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await expect(cycle).toBeVisible();
  await expect(cycle).toHaveCSS("border-top-style", "solid");
  expect(await cycle.locator("i").first().evaluate(
    element => getComputedStyle(element).backgroundColor,
  )).not.toBe("rgba(0, 0, 0, 0)");
  await expect(layer.locator("[role=status]")).toHaveClass(/\bsr-only\b/);
  expect(await cycle.evaluate(element => getComputedStyle(element).color)).not.toBe("rgba(0, 0, 0, 0)");
});

const identitySpecies: CompanionSpecies[] = ["bear", "cat", "fox", "hedgehog"];

async function openS02WithSpecies(page: Page, species: CompanionSpecies, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((savedSpecies: string) => {
    localStorage.setItem("sk7-companion-species", savedSpecies);
  }, species);
  await page.goto(`${url}&companion_species=${species === "bear" ? "fox" : "bear"}`);
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
}

async function waitForSceneReady(stage: Locator, timeout = 20_000) {
  await expect(stage.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready", { timeout });
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", "realtime-ready");
}

async function assertNoAdmittedTarget(page: Page) {
  await expect(page.locator("[data-presence-scene-actor-interaction='S02']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "동반자 움직이기", exact: true })).toHaveCount(0);
}

async function assertAdmittedTarget(page: Page) {
  const layer = page.locator("[data-presence-scene-actor-interaction='S02']");
  await expect(layer).toHaveCount(1);
  await expect(layer.getByRole("button", { name: "동반자 움직이기", exact: true })).toBeVisible();
  return layer;
}

for (const species of identitySpecies) {
  test(`S02 first-paint identity is ${species} from ownership through ready`, async ({ page }) => {
    const glbRequests: string[] = [];
    page.on("request", request => {
      if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
    });
    await openS02WithSpecies(page, species);

    const stage = page.locator(".living-visual-stage");
    await expect(stage).toHaveAttribute("data-scene-selected-character-url", companionAssetManifest[species].lite.url);

    await waitForSceneReady(stage);
    await expect.poll(() => glbRequests.length).toBe(1);
    expect(glbRequests[0]).toBe(companionAssetManifest[species].lite.url);

    const host = page.locator('[data-companion-presence-host="shadow-v1"]');
    await expect(host).toHaveAttribute("data-presence-asset-id", companionAssetManifest[species].lite.assetId);
    await expect(host).toHaveAttribute("data-presence-observed-asset-id", companionAssetManifest[species].lite.assetId);
  });
}

for (const species of ["cat", "fox", "hedgehog"] as const) {
  test(`S02 ${species} loads the selected GLB and never a bear GLB or bear poster`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", request => requests.push(request.url()));
    await openS02WithSpecies(page, species);

    await waitForSceneReady(page.locator(".living-visual-stage"));

    const glbs = requests.filter(url => /\.glb(?:\?|$)/.test(url));
    expect(glbs).toHaveLength(1);
    expect(glbs[0]).toBe(companionAssetManifest[species].lite.url);
    expect(glbs[0]).not.toContain("/bear/");
    expect(requests.filter(url => /\/scene-review\/s02\/.*\.webp$/.test(url))).toHaveLength(0);
  });
}

test("S02 GPU-held port-before-reveal window keeps identity and admission neutral for cat", async ({ page }, testInfo) => {
  const species = "cat";
  const glbRequests: string[] = [];
  page.on("request", request => {
    if (/\.glb(?:\?|$)/.test(request.url())) glbRequests.push(request.url());
  });

  // Hold the GPU completion/reveal boundary after the GLB has loaded.
  await page.addInitScript(() => {
    const state = window as unknown as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow;
    const originalFenceSync = WebGL2RenderingContext.prototype.fenceSync;
    const originalClientWaitSync = WebGL2RenderingContext.prototype.clientWaitSync;
    const originalDeleteSync = WebGL2RenderingContext.prototype.deleteSync;
    const originalRequest = window.requestAnimationFrame.bind(window);
    const fences = new Set<WebGLSync>();
    const pendingReveal = new Map<number, FrameRequestCallback>();
    let nextFrame = -1;
    let fenceSignaled = false;
    let holdRevealFrame = false;
    state.pendingSceneGpuFences = 0;
    state.sceneGpuFencePolls = 0;
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
    state.signalSceneGpuFence = () => { fenceSignaled = true; };
    state.releaseSceneRevealFrame = () => {
      const first = pendingReveal.entries().next().value;
      if (!first) return false;
      const [frame, callback] = first;
      pendingReveal.delete(frame);
      originalRequest(callback);
      return true;
    };
  });

  await openS02WithSpecies(page, species);

  const stage = page.locator(".living-visual-stage");
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');

  // 1. selected cat GLB fully loads
  await expect.poll(() => glbRequests.length).toBe(1);
  expect(glbRequests[0]).toBe(companionAssetManifest[species].lite.url);

  // 2. S02 port is registered
  await expect.poll(() => host.getAttribute("data-presence-world-root-port-count")).toBe("1");
  await expect(host).toHaveAttribute("data-presence-world-root-port-incarnation", /.+/);

  // 3-7. held reveal boundary: visit loading, observed identity absent, no target
  await expect.poll(() => page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).pendingSceneGpuFences)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).sceneGpuFencePolls)).toBeGreaterThan(0);
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", "realtime-loading");
  await expect(stage.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "poster");
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
  await expect(page.locator(".living-scene-fallback--neutral")).toHaveCount(1);
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  await expect(page.locator(".living-three-scene")).toHaveCSS("opacity", "0");
  await assertNoAdmittedTarget(page);
  await page.screenshot({ path: testInfo.outputPath("cat-gpu-held-first-paint.png"), fullPage: true });
  await stage.screenshot({ path: testInfo.outputPath("cat-gpu-held-stage.png") });

  // 8. release GPU readiness
  await page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).signalSceneGpuFence?.());
  await expect.poll(() => page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).pendingSceneRevealFrames)).toBe(1);
  expect(await page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).pendingSceneGpuFences)).toBe(0);
  expect(await page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).releaseSceneRevealFrame?.())).toBe(true);

  // 9-11. wait exact current visit ready witness, then observe selected cat and admit target
  await waitForSceneReady(stage);
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", companionAssetManifest[species].lite.assetId);
  await page.screenshot({ path: testInfo.outputPath("cat-gpu-ready-first-paint.png"), fullPage: true });
  await stage.screenshot({ path: testInfo.outputPath("cat-gpu-ready-stage.png") });
  const layer = await assertAdmittedTarget(page);

  // 12. existing direct drag path remains green
  const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });
  const before = await rootPoint(layer);
  const commits = Number(await layer.getAttribute("data-presence-commit-count"));
  await dragBy(page, target, -18, -12);
  await expect.poll(async () => Number(await layer.getAttribute("data-presence-commit-count"))).toBe(commits + 1);
  const after = await rootPoint(layer);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(6);
});

test("S02 same-session A -> B visit race uses distinct tokens and stale A cannot admit B", async ({ page }) => {
  let documentNavigations = 0;
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentNavigations++; });
  await page.setViewportSize({ width: 390, height: 844 });

  // Hold the GPU reveal boundary so visit A stays at a controlled loading point.
  await page.addInitScript(() => {
    const state = window as unknown as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow;
    const originalFenceSync = WebGL2RenderingContext.prototype.fenceSync;
    const originalClientWaitSync = WebGL2RenderingContext.prototype.clientWaitSync;
    const originalDeleteSync = WebGL2RenderingContext.prototype.deleteSync;
    const originalRequest = window.requestAnimationFrame.bind(window);
    const fences = new Set<WebGLSync>();
    const pendingReveal = new Map<number, FrameRequestCallback>();
    let nextFrame = -1;
    let fenceSignaled = false;
    let holdRevealFrame = false;
    state.pendingSceneGpuFences = 0;
    state.sceneGpuFencePolls = 0;
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
    state.signalSceneGpuFence = () => { fenceSignaled = true; };
    state.releaseSceneRevealFrame = () => {
      const first = pendingReveal.entries().next().value;
      if (!first) return false;
      const [frame, callback] = first;
      pendingReveal.delete(frame);
      originalRequest(callback);
      return true;
    };
  });

  await page.addInitScript(() => {
    localStorage.setItem("sk7-companion-species", "cat");
  });
  await page.goto("/?fixture=VP-10&e2e=signed-in&screen=S02");

  const stage = page.locator(".living-visual-stage");
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  await stage.scrollIntoViewIfNeeded();

  // 1. Visit A starts and reaches the GPU-held loading point.
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", "realtime-loading");
  const visitA = await stage.getAttribute("data-scene-visit-token");
  expect(visitA).toBeTruthy();
  await expect.poll(() => page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).pendingSceneGpuFences)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).sceneGpuFencePolls)).toBeGreaterThan(0);
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
  await assertNoAdmittedTarget(page);

  // 2. Navigate through the app to S14, change companion, then return to S02.
  await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "설정", exact: true }).click();
  await page.locator("#companion-species").selectOption("fox");
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("sk7-companion-species"))).toBe("fox");

  // Wait for A's fence to be deleted before arming the global signal for B.
  await expect.poll(() => page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).pendingSceneGpuFences)).toBe(0);
  await page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).signalSceneGpuFence?.());

  await page.getByRole("button", { name: "SK7 · 하루의 사실을 차분하게 · 오늘의 기록으로 이동" }).click();
  await stage.scrollIntoViewIfNeeded();

  // 3. Visit B is active with a different token and is held at the reveal boundary.
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", "realtime-loading");
  const visitB = await stage.getAttribute("data-scene-visit-token");
  expect(visitB).toBeTruthy();
  expect(visitB).not.toBe(visitA);
  await expect.poll(() => page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).pendingSceneRevealFrames)).toBe(1);

  // A was physically disposed (its fence deleted). Pure channel tests cover
  // stale transitions; no production callback is fabricated after disposal.
  // B remains held and cannot publish identity or admit the target.
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
  await assertNoAdmittedTarget(page);
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
  await assertNoAdmittedTarget(page);

  // 5. Release B normally; only B becomes ready and interactive.
  await page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).signalSceneGpuFence?.());
  expect(await page.evaluate(() => (window as import("./sceneGpuTestHarness").SceneGpuTestHarnessWindow).releaseSceneRevealFrame?.())).toBe(true);
  await waitForSceneReady(stage);
  await expect(stage).toHaveAttribute("data-scene-selected-character-url", companionAssetManifest.fox.lite.url);
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", companionAssetManifest.fox.lite.assetId);
  await assertAdmittedTarget(page);
  expect(documentNavigations).toBe(1);
});

test("S02 realtime visit failure ends neutral with no admitted target or stale ready state", async ({ page }) => {
  let markStarted!: () => void;
  let releaseAbort!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  await page.route("**/*.glb*", async route => {
    markStarted();
    await new Promise<void>(resolve => { releaseAbort = resolve; });
    route.abort("timedout");
  });

  await openS02WithSpecies(page, "cat");
  await started;
  // Let enough lifecycle run for the visit to be meaningful, then force failure.
  await page.waitForTimeout(100);
  releaseAbort();

  const stage = page.locator(".living-visual-stage");
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", "fallback-neutral", { timeout: 20_000 });
  await expect(stage.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "fallback");
  await expect(page.locator(".living-scene-fallback--neutral")).toHaveCount(1);
  await expect(page.locator(".living-scene-fallback img")).toHaveCount(0);
  await assertNoAdmittedTarget(page);

  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
  await expect(host).toHaveAttribute("data-presence-world-root-port-count", "0");

  // Failure must survive a viewport resize and remain neutral (no old ready state returns).
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", "fallback-neutral");
  await assertNoAdmittedTarget(page);
});

test("S02 failed realtime visit persists through reduced-motion tier changes", async ({ page }) => {
  await page.route("**/*.glb*", route => route.abort("timedout"));
  await openS02WithSpecies(page, "cat");

  const stage = page.locator(".living-visual-stage");
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", "fallback-neutral", { timeout: 20_000 });

  for (const reducedMotion of ["reduce", "no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await expect(stage).toHaveAttribute("data-scene-first-paint-state", "fallback-neutral");
    await assertNoAdmittedTarget(page);
  }

  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
});

test("S02 in-memory companion selection changes owner-tree descriptor for the next visit", async ({ page }) => {
  // Start with cat ready in signed-in journey mode.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("sk7-companion-species", "cat"));
  await page.goto("/?fixture=VP-10&e2e=signed-in&screen=S02");

  const stage = page.locator(".living-visual-stage");
  await stage.scrollIntoViewIfNeeded();
  await waitForSceneReady(stage);
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", companionAssetManifest.cat.lite.assetId);

  // Change species in settings, then return to S02.
  await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "설정", exact: true }).click();
  await page.locator("#companion-species").selectOption("fox");
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("sk7-companion-species"))).toBe("fox");
  await page.getByRole("button", { name: "SK7 · 하루의 사실을 차분하게 · 오늘의 기록으로 이동" }).click();
  await stage.scrollIntoViewIfNeeded();

  // The new visit must start non-ready and use the fox descriptor.
  await expect(stage).toHaveAttribute("data-scene-selected-character-url", companionAssetManifest.fox.lite.url);
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", /realtime-loading|realtime-ready/);
  await expect(host).toHaveAttribute("data-presence-asset-id", companionAssetManifest.fox.lite.assetId);

  // Stale cat witness must not leak across the route boundary.
  await expect(host).not.toHaveAttribute("data-presence-observed-asset-id", companionAssetManifest.cat.lite.assetId);

  // Once fox is ready, the observed identity and target admit the fox.
  await waitForSceneReady(stage);
  await expect(host).toHaveAttribute("data-presence-observed-asset-id", companionAssetManifest.fox.lite.assetId);
  await assertAdmittedTarget(page);
});

test("S02 target stays transparent in normal/hover/active/pointer-down to avoid a white rectangle", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });
  const assertTransparentFill = async () => {
    await expect(target).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(target).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
  };
  await assertTransparentFill();
  await target.hover();
  await assertTransparentFill();
  const box = await target.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await assertTransparentFill();
    await page.mouse.up();
  }
  await target.focus();
  // Focus-visible outline is intentionally visible for keyboard users.
  expect(await target.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
});

for (const species of ["bear", "cat", "fox", "hedgehog"] as const) {
  for (const [width, height] of [[390, 844], [1366, 768]] as const) {
    test(`F1 visual capture ${species} at ${width}x${height}`, async ({ page }, testInfo) => {
      let releaseGlb!: () => void;
      let markGlbStarted!: () => void;
      const glbGate = new Promise<void>(resolve => { releaseGlb = resolve; });
      const glbStarted = new Promise<void>(resolve => { markGlbStarted = resolve; });
      await page.route("**/*.glb*", async route => {
        markGlbStarted();
        await glbGate;
        await route.continue();
      });

      await openS02WithSpecies(page, species, width, height);
      await glbStarted;

      const stage = page.locator(".living-visual-stage");
      const host = page.locator('[data-companion-presence-host="shadow-v1"]');
      await expect(stage).toHaveAttribute("data-scene-first-paint-state", "realtime-loading");
      await assertNoAdmittedTarget(page);
      await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
      await page.screenshot({ path: testInfo.outputPath(`${species}-${width}-held-first-paint.png`), fullPage: true });
      await stage.screenshot({ path: testInfo.outputPath(`${species}-${width}-held-stage.png`) });

      releaseGlb();
      await waitForSceneReady(stage);
      await expect(stage).toHaveAttribute("data-scene-selected-character-url", companionAssetManifest[species].lite.url);
      await expect(host).toHaveAttribute("data-presence-observed-asset-id", companionAssetManifest[species].lite.assetId);
      await assertAdmittedTarget(page);
      await page.screenshot({ path: testInfo.outputPath(`${species}-${width}-ready-selected.png`), fullPage: true });
      await stage.screenshot({ path: testInfo.outputPath(`${species}-${width}-ready-stage.png`) });
    });
  }
}


for (const failAfterReady of [false, true]) {
  test(`S02 real WebGL context loss ${failAfterReady ? "revokes ready" : "terminates loading"} across tiers`, async ({ page }) => {
    if (!failAfterReady) await page.addInitScript(() => {
      WebGL2RenderingContext.prototype.clientWaitSync = function () { return this.TIMEOUT_EXPIRED; };
    });
    await openS02WithSpecies(page, "cat");
    const stage = page.locator(".living-visual-stage");
    const host = page.locator('[data-companion-presence-host="shadow-v1"]');
    if (failAfterReady) {
      await waitForSceneReady(stage);
      await assertAdmittedTarget(page);
    } else {
      await expect(host).toHaveAttribute("data-presence-world-root-port-count", "1");
      await expect(stage).toHaveAttribute("data-scene-first-paint-state", "realtime-loading");
    }
    await page.locator(".living-three-scene canvas").evaluate((canvas: HTMLCanvasElement) => {
      const extension = canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("WEBGL_lose_context unavailable");
      extension.loseContext();
    });
    await expect(stage).toHaveAttribute("data-scene-first-paint-state", "fallback-neutral");
    await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
    await assertNoAdmittedTarget(page);
    for (const reducedMotion of ["reduce", "no-preference"] as const) {
      await page.emulateMedia({ reducedMotion });
      await expect(stage).toHaveAttribute("data-scene-first-paint-state", "fallback-neutral");
      await expect(page.locator(".living-three-scene canvas")).toHaveCount(0);
      await expect(host).toHaveAttribute("data-presence-observed-asset-id", "none");
      await assertNoAdmittedTarget(page);
    }
  });
}

test("S02 same recipe and identity SPA return and tier return create new realtime tokens", async ({ page }) => {
  await openS02WithSpecies(page, "cat");
  const stage = page.locator(".living-visual-stage");
  await waitForSceneReady(stage);
  const first = await stage.getAttribute("data-scene-visit-token");
  await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("button", { name: "SK7 · 하루의 사실을 차분하게 · 오늘의 기록으로 이동" }).click();
  await stage.scrollIntoViewIfNeeded();
  await waitForSceneReady(stage);
  const second = await stage.getAttribute("data-scene-visit-token");
  expect(second).not.toBe(first);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", "fallback-neutral");
  await assertNoAdmittedTarget(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(stage).not.toHaveAttribute("data-scene-visit-token", second!);
  await expect(stage).toHaveAttribute("data-scene-first-paint-state", /realtime-loading|realtime-ready/);
  await stage.scrollIntoViewIfNeeded();
  await waitForSceneReady(stage);
  expect(await stage.getAttribute("data-scene-visit-token")).not.toBe(second);
});
