import { expect, test, type Locator, type Page } from "@playwright/test";
import { companionAssetManifest } from "../src/ui/companionAssets.generated";
import type { CompanionSpecies } from "../src/ui/companion";

const url = "/?fixture=VP-10&screen=S02";
const frameSelector = '[data-scene="S02"] [data-scene-reserved-box="true"]';

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
  await expect(layer.getByRole("button", { name: "동반자 반응 보기", exact: true })).toBeVisible();
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

async function worldRootPosition(page: Page) {
  const scene = page.locator(".living-three-scene");
  await expect(scene).toHaveAttribute("data-companion-world-root-x", /-?\d/);
  await expect(scene).toHaveAttribute("data-companion-world-root-y", /-?\d/);
  await expect(scene).toHaveAttribute("data-companion-world-root-z", /-?\d/);
  return {
    x: Number(await scene.getAttribute("data-companion-world-root-x")),
    y: Number(await scene.getAttribute("data-companion-world-root-y")),
    z: Number(await scene.getAttribute("data-companion-world-root-z")),
  };
}

async function tapActor(
  page: Page,
  target: Locator,
  mode: "mouse" | "touch" = "mouse",
) {
  const box = await target.boundingBox();
  if (!box) throw new Error("S02 actor target is not measurable");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (mode === "touch") await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
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

async function dragTowardFrameEdge(page: Page, layer: Locator, edge: "left" | "right" | "top" | "bottom") {
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const frame = await page.locator(frameSelector).boundingBox();
  const actor = await target.boundingBox();
  if (!frame || !actor) throw new Error("visible S02 geometry is unavailable");
  const root = await rootPoint(layer);
  const minX = root.x + frame.x + 8 - actor.x;
  const maxX = root.x + frame.x + frame.width - 8 - actor.x - actor.width;
  const minY = root.y + frame.y + 8 - actor.y;
  const maxY = root.y + frame.y + frame.height - 8 - actor.y - actor.height;
  // Top-left and top-right avoid the position-control hard zone; bottom-left
  // explores the full remaining vertical edge.
  const desired = {
    left: { x: minX - 2, y: minY + 2 },
    right: { x: maxX + 2, y: minY + 2 },
    top: { x: minX + 2, y: minY - 2 },
    bottom: { x: minX + 2, y: maxY + 2 },
  }[edge];
  const start = { x: actor.x + actor.width / 2, y: actor.y + actor.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + desired.x - root.x, start.y + desired.y - root.y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await layer.getAttribute("data-presence-commit-count")))
    .toBeGreaterThan(0);
  const settled = await target.boundingBox();
  const control = await layer.locator(".presence-scene-actor-controls").boundingBox();
  if (!settled || !control) throw new Error("settled S02 geometry is unavailable");
  expect(settled.width).toBeCloseTo(actor.width, 0);
  expect(settled.height).toBeCloseTo(actor.height, 0);
  expect(settled.x).toBeGreaterThanOrEqual(frame.x + 7);
  expect(settled.y).toBeGreaterThanOrEqual(frame.y + 7);
  expect(settled.x + settled.width).toBeLessThanOrEqual(frame.x + frame.width - 7);
  expect(settled.y + settled.height).toBeLessThanOrEqual(frame.y + frame.height - 7);
  expect(
    settled.x + settled.width <= control.x
      || control.x + control.width <= settled.x
      || settled.y + settled.height <= control.y
      || control.y + control.height <= settled.y,
  ).toBe(true);
  return settled;
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

for (const [width, height] of [[320, 844], [390, 844], [768, 900], [1366, 768]] as const) {
  test(`S02 fenced direct placement drags and commits at ${width}px`, async ({ page }) => {
    const layer = await openSpatialS02(page, width, height);
    const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
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

for (const [species, width, height] of [
  ["bear", 320, 844], ["cat", 320, 844], ["dog", 320, 844],
  ["capybara", 320, 844], ["fox", 320, 844], ["hedgehog", 320, 844],
  ["bear", 390, 844], ["bear", 768, 900],
  ["bear", 1366, 768],
] as const) {
  test(`S02 ${species} reaches the safe frame edges at ${width}px`, async ({ page }) => {
    await page.addInitScript((savedSpecies: string) => {
      localStorage.setItem("sk7-companion-species", savedSpecies);
    }, species);
    const layer = await openSpatialS02(page, width, height);
    const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
    const frame = await page.locator(frameSelector).boundingBox();
    const initial = await target.boundingBox();
    if (!frame || !initial) throw new Error("initial S02 geometry is unavailable");
    const nominalX = frame.width - initial.width - 16;
    const nominalY = frame.height - initial.height - 16;
    expect(nominalX).toBeGreaterThan(100);
    expect(nominalY).toBeGreaterThan(width <= 390 ? 70 : 90);

    if (width === 320 && species === "bear") {
      const root = await rootPoint(layer);
      await target.click();
      await expect(layer).toHaveAttribute("data-presence-commit-count", "0");
      expect(await rootPoint(layer)).toEqual(root);
    }

    const left = await dragTowardFrameEdge(page, layer, "left");
    const right = await dragTowardFrameEdge(page, layer, "right");
    const top = await dragTowardFrameEdge(page, layer, "top");
    const bottom = await dragTowardFrameEdge(page, layer, "bottom");
    expect(left.x).toBeLessThanOrEqual(frame.x + 11);
    expect(right.x + right.width).toBeGreaterThanOrEqual(frame.x + frame.width - 11);
    expect(top.y).toBeLessThanOrEqual(frame.y + 11);
    expect(bottom.y + bottom.height).toBeGreaterThanOrEqual(frame.y + frame.height - 11);
    expect(right.x - left.x).toBeGreaterThan(nominalX * 0.95);
    expect(bottom.y - top.y).toBeGreaterThan(nominalY * 0.95);
  });
}

test("short 320px S02 keeps its intentionally hidden frame and interaction hidden", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(url);
  await expect(page.locator(frameSelector)).toBeHidden();
  await expect(page.locator('[data-presence-scene-actor-interaction="S02"]')).toHaveCount(0);
});

test("S02 presentation controls stay visually quiet without losing semantics", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
  const cycle = layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true });
  const status = layer.locator(".presence-scene-actor-status");

  await expect(target).toHaveAccessibleName("동반자 반응 보기");
  await expect(target).toHaveAccessibleDescription(/누르면 동반자가 반응하고.*드래그하면 위치를 바꿔요/);

  await expect(tactile).toHaveAccessibleName("동반자 만져보기");
  await expect(tactile).toHaveAttribute("aria-pressed", "false");
  const tactileBox = await tactile.boundingBox();
  if (!tactileBox) throw new Error("tactile control is not measurable");
  expect(tactileBox.width).toBeGreaterThanOrEqual(44);
  expect(tactileBox.height).toBeGreaterThanOrEqual(44);
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
  await expect(tactile).toBeFocused();
  expect(await tactile.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Tab");
  await expect(cycle).toBeFocused();
  expect(await cycle.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
});

test("#921 pointer, keyboard and rapid retap acknowledge locally while drag keeps root authority", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const scene = page.locator(".living-three-scene");
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');
  const worldRootBefore = await worldRootPosition(page);
  const arenaBefore = Number(await host.getAttribute("data-presence-arena-revision"));
  const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
  const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));
  const tapsBefore = Number(await layer.getAttribute("data-presence-tap-count"));
  const reactionsBefore = Number(await scene.getAttribute("data-companion-tap-reaction-count"));

  // Real pointer tap: semantic count and local render response advance while
  // root coordinates/write/commit authority remain unchanged.
  await tapActor(page, target);
  await expect(layer).toHaveAttribute("data-presence-tap-count", String(tapsBefore + 1));
  expect(await worldRootPosition(page)).toEqual(worldRootBefore);
  expect(Number(await host.getAttribute("data-presence-arena-revision"))).toBe(arenaBefore);
  await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
  await expect.poll(async () =>
    Number(await scene.getAttribute("data-companion-tap-reaction-count"))
  ).toBe(reactionsBefore + 1);
  await expect.poll(async () =>
    Math.abs(Number(await scene.getAttribute("data-companion-tap-reaction-offset-y")))
  ).toBeGreaterThan(0);
  expect(Math.abs(Number(await scene.getAttribute("data-companion-tap-reaction-offset-y"))))
    .toBeLessThanOrEqual(0.071);

  // Keyboard activation is the semantic equivalent and does not pass through
  // the pointer path or move the root.
  await target.focus();
  const keyboardWorldRootBefore = await worldRootPosition(page);
  const keyboardArenaBefore = Number(await host.getAttribute("data-presence-arena-revision"));
  const keyboardWritesBefore = Number(await layer.getAttribute("data-presence-write-count"));
  const keyboardCommitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));
  const keyboardTapsBefore = Number(await layer.getAttribute("data-presence-tap-count"));

  await page.keyboard.press("Enter");

  await expect(layer).toHaveAttribute("data-presence-tap-count", String(keyboardTapsBefore + 1));
  expect(await worldRootPosition(page)).toEqual(keyboardWorldRootBefore);
  expect(Number(await host.getAttribute("data-presence-arena-revision"))).toBe(keyboardArenaBefore);
  await expect(layer).toHaveAttribute("data-presence-write-count", String(keyboardWritesBefore));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(keyboardCommitsBefore));

  // Rapid retaps replace/restart one owner. They do not queue persistent loops.
  await tapActor(page, target);
  await tapActor(page, target);
  await tapActor(page, target);
  await expect(layer).toHaveAttribute("data-presence-tap-count", String(tapsBefore + 5));
  await expect.poll(async () =>
    Number(await scene.getAttribute("data-companion-tap-reaction-count"))
  ).toBe(reactionsBefore + 5);
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-active", "true");
  await page.waitForTimeout(450);
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-active", "false");
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-offset-y", "0.0000");

  // Start a new acknowledgement, then cross the existing 6px drag threshold.
  // Root relocation wins and cancels local reaction without admitting another tap.
  await tapActor(page, target);
  const tapsBeforeDrag = Number(await layer.getAttribute("data-presence-tap-count"));
  const commitsBeforeDrag = Number(await layer.getAttribute("data-presence-commit-count"));
  const rootBeforeDrag = await worldRootPosition(page);
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-active", "true");
  await dragBy(page, target, 30, 10);
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-active", "false");
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-offset-y", "0.0000");
  await expect(layer).toHaveAttribute("data-presence-tap-count", String(tapsBeforeDrag));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBeforeDrag + 1));
  expect(await worldRootPosition(page)).not.toEqual(rootBeforeDrag);

  // Route teardown owns the final cancellation. No old reaction DOM survives.
  await tapActor(page, target);
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-active", "true");
  await page.locator(".home-lead button").click();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
  await expect(page.locator('[data-presence-scene-actor-interaction="S02"]')).toHaveCount(0);
  await expect(page.locator(".living-three-scene")).toHaveCount(0);
});

test("#921 mobile touch tap acknowledges without root relocation", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    const layer = await openSpatialS02(page);
    const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
    const host = page.locator('[data-companion-presence-host="shadow-v1"]');
    const worldRootBefore = await worldRootPosition(page);
    const arenaBefore = Number(await host.getAttribute("data-presence-arena-revision"));
    const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
    const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));
    const tapsBefore = Number(await layer.getAttribute("data-presence-tap-count"));

    await tapActor(page, target, "touch");

    await expect(layer).toHaveAttribute("data-presence-tap-count", String(tapsBefore + 1));
    expect(await worldRootPosition(page)).toEqual(worldRootBefore);
    expect(Number(await host.getAttribute("data-presence-arena-revision"))).toBe(arenaBefore);
    await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
    await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
  } finally {
    await context.close();
  }
});

test("unsafe S02 drop receives deterministic nearest-safe correction", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
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
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });

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
  await expect(page.getByRole("button", { name: "동반자 반응 보기", exact: true })).toHaveCount(0);
});

test("normalized S02 placement survives route return and responsive Arena rebuild", async ({ page }) => {
  const layer = await openSpatialS02(page, 320, 844);
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
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Number(await host.getAttribute("data-presence-arena-revision")))
    .toBeGreaterThan(arenaRevision);
  await expect.poll(async () => ({
    x: Number(await host.getAttribute("data-presence-placement-x")),
    y: Number(await host.getAttribute("data-presence-placement-y")),
  })).toEqual(committed);
  const mobileRevision = Number(await host.getAttribute("data-presence-arena-revision"));
  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(async () => Number(await host.getAttribute("data-presence-arena-revision")))
    .toBeGreaterThan(mobileRevision);
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
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
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
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
  const cycle = layer.getByRole("button", { name: "동반자 위치 바꾸기", exact: true });
  await target.focus();
  await expect(target).toBeFocused();
  expect(await target.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");

  await page.keyboard.press("Tab");
  await expect(tactile).toBeFocused();
  expect(await tactile.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await expect(tactile).toBeVisible();
  await expect(tactile).toHaveCSS("border-top-style", "solid");
  expect(await tactile.evaluate(element => getComputedStyle(element).color))
    .not.toBe("rgba(0, 0, 0, 0)");

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
  await expect(page.getByRole("button", { name: "동반자 반응 보기", exact: true })).toHaveCount(0);
}

async function assertAdmittedTarget(page: Page) {
  const layer = page.locator("[data-presence-scene-actor-interaction='S02']");
  await expect(layer).toHaveCount(1);
  await expect(layer.getByRole("button", { name: "동반자 반응 보기", exact: true })).toBeVisible();
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
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
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
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
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

// #923 tactile-play browser evidence

async function tactileTransform(scene: Locator) {
  return {
    x: Number(await scene.getAttribute("data-companion-tactile-x")),
    y: Number(await scene.getAttribute("data-companion-tactile-y")),
    rotationZ: Number(await scene.getAttribute("data-companion-tactile-rotation-z")),
    scaleX: Number(await scene.getAttribute("data-companion-tactile-scale-x")),
    scaleY: Number(await scene.getAttribute("data-companion-tactile-scale-y")),
    scaleZ: Number(await scene.getAttribute("data-companion-tactile-scale-z")),
  };
}

async function expectTactileNeutral(scene: Locator) {
  await expect.poll(async () => ({
    active: await scene.getAttribute("data-companion-tactile-active"),
    settling: await scene.getAttribute("data-companion-tactile-settling"),
    x: await scene.getAttribute("data-companion-tactile-x"),
    y: await scene.getAttribute("data-companion-tactile-y"),
    rotationZ: await scene.getAttribute("data-companion-tactile-rotation-z"),
    scaleX: await scene.getAttribute("data-companion-tactile-scale-x"),
    scaleY: await scene.getAttribute("data-companion-tactile-scale-y"),
    scaleZ: await scene.getAttribute("data-companion-tactile-scale-z"),
  })).toEqual({
    active: "false",
    settling: "false",
    x: "0.0000",
    y: "0.0000",
    rotationZ: "0.0000",
    scaleX: "1.0000",
    scaleY: "1.0000",
    scaleZ: "1.0000",
  });
}

async function beginTactileMouseDrag(
  page: Page,
  target: Locator,
  deltaX = 34,
  deltaY = -22,
) {
  const box = await target.boundingBox();
  if (!box) throw new Error("tactile actor target has no box");
  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    start.x + deltaX,
    start.y + deltaY,
    { steps: 4 },
  );
  return start;
}

function tactilePointerId(token: string | null) {
  if (!token || token === "none") throw new Error("active tactile token is unavailable");
  const pointerId = Number(token.split(":")[2]);
  if (!Number.isInteger(pointerId)) throw new Error(`invalid tactile token: ${token}`);
  return pointerId;
}

async function expectTactileChanged(scene: Locator) {
  await expect.poll(async () => {
    const value = await tactileTransform(scene);
    return Math.max(
      Math.abs(value.x),
      Math.abs(value.y),
      Math.abs(value.rotationZ),
      Math.abs(value.scaleX - 1),
      Math.abs(value.scaleY - 1),
      Math.abs(value.scaleZ - 1),
    );
  }).toBeGreaterThan(0.0001);
}

test("#923 tactile desktop drag changes reactionRoot only, stays bounded, settles exact neutral, and OFF restores #921 grammar", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
  const scene = page.locator(".living-three-scene");
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');

  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "off");
  await expect(tactile).toHaveAttribute("aria-pressed", "false");
  await expectTactileNeutral(scene);

  const tactileBox = await tactile.boundingBox();
  if (!tactileBox) throw new Error("tactile control is not measurable");
  expect(tactileBox.width).toBeGreaterThanOrEqual(44);
  expect(tactileBox.height).toBeGreaterThanOrEqual(44);

  const arenaBefore = Number(await host.getAttribute("data-presence-arena-revision"));
  const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
  const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));
  const tapsBefore = Number(await layer.getAttribute("data-presence-tap-count"));
  const worldBefore = await worldRootPosition(page);

  await tactile.click();

  await expect(tactile).toHaveAttribute("aria-pressed", "true");
  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "on");
  expect(Number(await host.getAttribute("data-presence-arena-revision"))).toBe(arenaBefore);

  await beginTactileMouseDrag(page, target);

  await expect(layer).not.toHaveAttribute("data-presence-tactile-pointer", "none");
  await expect(scene).toHaveAttribute("data-companion-tactile-active", "true");
  await expect(host).toHaveAttribute("data-presence-world-root-pointer", "none");
  await expectTactileChanged(scene);

  const deformation = await tactileTransform(scene);

  expect(Math.abs(deformation.x)).toBeLessThanOrEqual(0.0601);
  expect(Math.abs(deformation.y)).toBeLessThanOrEqual(0.0451);
  expect(Math.abs(deformation.rotationZ)).toBeLessThanOrEqual(0.0751);
  expect(deformation.scaleX).toBeLessThanOrEqual(1.0251);
  expect(deformation.scaleY).toBeGreaterThanOrEqual(0.9649);
  expect(deformation.scaleZ).toBeLessThanOrEqual(1.0151);

  expect(await worldRootPosition(page)).toEqual(worldBefore);
  expect(Number(await host.getAttribute("data-presence-arena-revision"))).toBe(arenaBefore);
  await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
  await expect(layer).toHaveAttribute("data-presence-tap-count", String(tapsBefore));

  await page.mouse.up();

  await expect(scene).toHaveAttribute("data-companion-tactile-settling", "true");
  await expectTactileNeutral(scene);

  expect(await worldRootPosition(page)).toEqual(worldBefore);
  await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));

  // Explicitly leave tactile mode. The original #921 grammar must return.
  await tactile.click();
  await expect(tactile).toHaveAttribute("aria-pressed", "false");
  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "off");

  const tapsBeforeNormal = Number(await layer.getAttribute("data-presence-tap-count"));
  await tapActor(page, target);
  await expect(layer).toHaveAttribute(
    "data-presence-tap-count",
    String(tapsBeforeNormal + 1),
  );

  const commitsBeforeNormalDrag = Number(await layer.getAttribute("data-presence-commit-count"));
  const normalWorldBefore = await worldRootPosition(page);

  await dragBy(page, target, 28, 10);

  await expect(layer).toHaveAttribute(
    "data-presence-commit-count",
    String(commitsBeforeNormalDrag + 1),
  );
  expect(await worldRootPosition(page)).not.toEqual(normalWorldBefore);
});

test("#923 tactile keyboard Enter and Space pulse locally without world-root authority", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
  const scene = page.locator(".living-three-scene");
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');

  await tactile.click();
  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "on");

  const worldBefore = await worldRootPosition(page);
  const arenaBefore = Number(await host.getAttribute("data-presence-arena-revision"));
  const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
  const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));
  const tapsBefore = Number(await layer.getAttribute("data-presence-tap-count"));
  const pulsesBefore = Number(await layer.getAttribute("data-presence-tactile-pulse-count"));

  await target.focus();
  await page.keyboard.press("Enter");

  await expect(layer).toHaveAttribute(
    "data-presence-tactile-pulse-count",
    String(pulsesBefore + 1),
  );
  await expectTactileChanged(scene);
  await expectTactileNeutral(scene);

  await target.focus();
  await page.keyboard.press("Space");

  await expect(layer).toHaveAttribute(
    "data-presence-tactile-pulse-count",
    String(pulsesBefore + 2),
  );
  await expectTactileChanged(scene);
  await expectTactileNeutral(scene);

  expect(await worldRootPosition(page)).toEqual(worldBefore);
  expect(Number(await host.getAttribute("data-presence-arena-revision"))).toBe(arenaBefore);
  await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
  await expect(layer).toHaveAttribute("data-presence-tap-count", String(tapsBefore));
  await expect(host).toHaveAttribute("data-presence-world-root-pointer", "none");
});

test("#923 tactile rapid replacement defeats stale settle and Escape, pointercancel, lost capture all neutralize", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
  const scene = page.locator(".living-three-scene");
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');

  await tactile.click();

  const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
  const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));
  const worldBefore = await worldRootPosition(page);

  // Gesture 1 enters settle.
  await beginTactileMouseDrag(page, target, 30, -18);
  await expectTactileChanged(scene);
  await page.mouse.up();
  await expect(scene).toHaveAttribute("data-companion-tactile-settling", "true");

  // Gesture 2 must replace that settle. Hold it longer than an old settle window:
  // a stale callback must not reset this newer active deformation.
  await beginTactileMouseDrag(page, target, -31, 19);
  await expect(scene).toHaveAttribute("data-companion-tactile-active", "true");
  await expect(scene).toHaveAttribute("data-companion-tactile-settling", "false");
  await expectTactileChanged(scene);
  await page.waitForTimeout(420);
  await expect(scene).toHaveAttribute("data-companion-tactile-active", "true");
  await expectTactileChanged(scene);

  // Escape cancels the newer active gesture to exact neutral.
  await page.keyboard.press("Escape");
  await expect(layer).toHaveAttribute("data-presence-tactile-pointer", "none");
  await expectTactileNeutral(scene);
  await page.mouse.up();

  // pointercancel
  await beginTactileMouseDrag(page, target, 28, -17);
  const cancelId = tactilePointerId(
    await layer.getAttribute("data-presence-tactile-pointer"),
  );
  await target.dispatchEvent("pointercancel", {
    pointerId: cancelId,
    pointerType: "mouse",
    button: 0,
    isPrimary: true,
    bubbles: true,
  });
  await expect(layer).toHaveAttribute("data-presence-tactile-pointer", "none");
  await expectTactileNeutral(scene);
  await page.mouse.up();

  // lostpointercapture
  await beginTactileMouseDrag(page, target, -27, -16);
  const lostId = tactilePointerId(
    await layer.getAttribute("data-presence-tactile-pointer"),
  );
  await target.evaluate((element: HTMLButtonElement, pointerId) => {
    if (!element.hasPointerCapture(pointerId)) {
      throw new Error(`tactile pointer ${pointerId} is not captured`);
    }
    element.releasePointerCapture(pointerId);
  }, lostId);
  await target.dispatchEvent("lostpointercapture", {
    pointerId: lostId,
    pointerType: "mouse",
    isPrimary: true,
    bubbles: true,
  });
  await expect(layer).toHaveAttribute("data-presence-tactile-pointer", "none");
  await expectTactileNeutral(scene);
  await page.mouse.up();

  expect(await worldRootPosition(page)).toEqual(worldBefore);
  await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
  await expect(host).toHaveAttribute("data-presence-world-root-pointer", "none");
});

test("#923 tactile mobile touch drag deforms locally without relocation", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  try {
    const layer = await openSpatialS02(page);
    const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
    const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
    const scene = page.locator(".living-three-scene");
    const host = page.locator('[data-companion-presence-host="shadow-v1"]');

    await tactile.click();

    const box = await target.boundingBox();
    if (!box) throw new Error("mobile tactile target has no box");

    const start = {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    };

    const worldBefore = await worldRootPosition(page);
    const arenaBefore = Number(await host.getAttribute("data-presence-arena-revision"));
    const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
    const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));

    const cdp = await context.newCDPSession(page);

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start.x, y: start.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x + 17, y: start.y - 10 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x + 34, y: start.y - 20 }],
    });

    await expect(layer).not.toHaveAttribute("data-presence-tactile-pointer", "none");
    await expect(scene).toHaveAttribute("data-companion-tactile-active", "true");
    await expectTactileChanged(scene);

    const deformation = await tactileTransform(scene);
    expect(Math.abs(deformation.x)).toBeLessThanOrEqual(0.0601);
    expect(Math.abs(deformation.y)).toBeLessThanOrEqual(0.0451);
    expect(Math.abs(deformation.rotationZ)).toBeLessThanOrEqual(0.0751);

    expect(await worldRootPosition(page)).toEqual(worldBefore);
    expect(Number(await host.getAttribute("data-presence-arena-revision"))).toBe(arenaBefore);
    await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
    await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
    await expect(host).toHaveAttribute("data-presence-world-root-pointer", "none");

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expectTactileNeutral(scene);
    await cdp.detach();
  } finally {
    await context.close();
  }
});

for (const species of ["cat", "fox", "hedgehog"] as const) {
  test(`#923 tactile stays species-agnostic for ${species}`, async ({ page }) => {
    await openS02WithSpecies(page, species);
    await waitForSceneReady(page.locator(".living-visual-stage"));

    const layer = await assertAdmittedTarget(page);
    const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
    const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
    const scene = page.locator(".living-three-scene");

    const worldBefore = await worldRootPosition(page);
    const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
    const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));

    await tactile.click();
    await beginTactileMouseDrag(page, target, 26, -15);

    await expect(scene).toHaveAttribute("data-companion-tactile-active", "true");
    await expectTactileChanged(scene);
    expect(await worldRootPosition(page)).toEqual(worldBefore);

    await page.mouse.up();
    await expectTactileNeutral(scene);

    await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
    await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
  });
}

test("#923 tactile reduced-motion owner teardown returns with mode OFF and neutral reactionRoot", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });

  await tactile.click();
  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "on");

  await page.emulateMedia({ reducedMotion: "reduce" });

  await expect(page.locator('[data-presence-scene-actor-interaction="S02"]')).toHaveCount(0);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "poster",
  );

  await page.emulateMedia({ reducedMotion: "no-preference" });

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  const returned = page.locator('[data-presence-scene-actor-interaction="S02"]');
  await expect(returned).toHaveCount(1);
  await expect(returned).toHaveAttribute("data-presence-tactile-mode", "off");
  await expect(
    returned.getByRole("button", { name: "동반자 만져보기", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expectTactileNeutral(page.locator(".living-three-scene"));
});

test("#923 tactile route teardown cannot persist intent or local deformation across return", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
  const scene = page.locator(".living-three-scene");

  await tactile.click();
  await beginTactileMouseDrag(page, target, 32, -18);
  await expect(scene).toHaveAttribute("data-companion-tactile-active", "true");
  await expectTactileChanged(scene);

  await page.locator(".home-lead button").evaluate(
    (button: HTMLButtonElement) => button.click(),
  );

  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
  await expect(page.locator('[data-presence-scene-actor-interaction="S02"]')).toHaveCount(0);
  await page.mouse.up();

  await page.getByRole("button", { name: /SK7.*오늘의 기록으로 이동/ }).click();
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  const returned = page.locator('[data-presence-scene-actor-interaction="S02"]');
  await expect(returned).toHaveCount(1);
  await expect(returned).toHaveAttribute("data-presence-tactile-mode", "off");
  await expect(
    returned.getByRole("button", { name: "동반자 만져보기", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expectTactileNeutral(page.locator(".living-three-scene"));
});


test("#923 page hidden cancels active tactile ownership and visibility return stays OFF neutral", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
  const scene = page.locator(".living-three-scene");
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');

  await tactile.click();
  await expect(tactile).toHaveAttribute("aria-pressed", "true");
  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "on");

  const worldBefore = await worldRootPosition(page);
  const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
  const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));

  await beginTactileMouseDrag(page, target, 32, -19);

  await expect(layer).not.toHaveAttribute("data-presence-tactile-pointer", "none");
  await expect(scene).toHaveAttribute("data-companion-tactile-active", "true");
  await expectTactileChanged(scene);

  // Deterministically exercise the browser visibilitychange contract.
  // The own-property override exists only while listeners synchronously run.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    try {
      document.dispatchEvent(new Event("visibilitychange"));
    } finally {
      Reflect.deleteProperty(document, "hidden");
    }
  });

  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "off");
  await expect(tactile).toHaveAttribute("aria-pressed", "false");
  await expect(layer).toHaveAttribute("data-presence-tactile-pointer", "none");
  await expect(host).toHaveAttribute("data-presence-world-root-pointer", "none");
  await expectTactileNeutral(scene);

  expect(await worldRootPosition(page)).toEqual(worldBefore);
  await expect(layer).toHaveAttribute(
    "data-presence-write-count",
    String(writesBefore),
  );
  await expect(layer).toHaveAttribute(
    "data-presence-commit-count",
    String(commitsBefore),
  );

  // Release the physical mouse after ownership has already been revoked.
  // It must not revive either grammar.
  await page.mouse.up();

  // Visibility return has no persisted tactile intent.
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "off");
  await expect(tactile).toHaveAttribute("aria-pressed", "false");
  await expect(layer).toHaveAttribute("data-presence-tactile-pointer", "none");
  await expectTactileNeutral(scene);
});


// #925 bounded primary-action attention browser evidence

async function attentionTransform(scene: Locator) {
  return {
    yaw: Number(await scene.getAttribute("data-companion-attention-yaw")),
    pitch: Number(await scene.getAttribute("data-companion-attention-pitch")),
    headYaw: Number(await scene.getAttribute("data-companion-attention-head-yaw")),
    spineYaw: Number(await scene.getAttribute("data-companion-attention-spine-yaw")),
    headPitch: Number(await scene.getAttribute("data-companion-attention-head-pitch")),
    spinePitch: Number(await scene.getAttribute("data-companion-attention-spine-pitch")),
    maxYaw: Number(await scene.getAttribute("data-companion-attention-max-yaw")),
    maxPitch: Number(await scene.getAttribute("data-companion-attention-max-pitch")),
  };
}

async function expectAttentionNeutral(scene: Locator) {
  await expect.poll(async () => ({
    active: await scene.getAttribute("data-companion-attention-active"),
    yaw: await scene.getAttribute("data-companion-attention-yaw"),
    pitch: await scene.getAttribute("data-companion-attention-pitch"),
    headYaw: await scene.getAttribute("data-companion-attention-head-yaw"),
    spineYaw: await scene.getAttribute("data-companion-attention-spine-yaw"),
    headPitch: await scene.getAttribute("data-companion-attention-head-pitch"),
    spinePitch: await scene.getAttribute("data-companion-attention-spine-pitch"),
  })).toEqual({
    active: "false",
    yaw: "0.0000",
    pitch: "0.0000",
    headYaw: "0.0000",
    spineYaw: "0.0000",
    headPitch: "0.0000",
    spinePitch: "0.0000",
  });
}

async function expectAttentionChanged(scene: Locator) {
  await expect.poll(async () => {
    const value = await attentionTransform(scene);
    return Math.max(
      Math.abs(value.yaw),
      Math.abs(value.pitch),
      Math.abs(value.headYaw),
      Math.abs(value.spineYaw),
      Math.abs(value.headPitch),
      Math.abs(value.spinePitch),
    );
  }).toBeGreaterThan(0.0001);
}

async function triggerPrimaryAttention(page: Page) {
  const primary = page.locator('[data-scene="S02"] .home-lead button');
  await expect(primary).toBeVisible();

  await primary.evaluate((element: HTMLButtonElement) => {
    element.blur();
    element.focus({ preventScroll: true });
  });

  return primary;
}

async function expectReactionRootNeutralDuringAttention(scene: Locator) {
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-active", "false");
  await expect(scene).toHaveAttribute("data-companion-tap-reaction-offset-y", "0.0000");
  expect(await tactileTransform(scene)).toEqual({
    x: 0,
    y: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  });
}

test("#925 primary-action focus sends position-only attention and changes bones without root authority", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const scene = page.locator(".living-three-scene");
  const host = page.locator('[data-companion-presence-host="shadow-v1"]');

  await expect(scene).toHaveAttribute("data-companion-attention-available", "true");
  await expect(scene).toHaveAttribute("data-companion-attention-posture", "head-spine");
  await expect(scene).toHaveAttribute("data-companion-attention-head-bone", "head");
  await expect(scene).toHaveAttribute("data-companion-attention-spine-bone", "spine");
  await expectAttentionNeutral(scene);

  await page.evaluate(() => {
    const events: unknown[] = [];
    Object.defineProperty(window, "__s02AttentionEvents", {
      configurable: true,
      value: events,
    });
    window.addEventListener("sk7:s02-primary-attention", (event) => {
      events.push((event as CustomEvent).detail);
    });
  });

  const primary = page.locator('[data-scene="S02"] .home-lead button');
  const primaryBox = await primary.boundingBox();
  if (!primaryBox) throw new Error("S02 primary action is not measurable");

  const worldBefore = await worldRootPosition(page);
  const arenaBefore = Number(await host.getAttribute("data-presence-arena-revision"));
  const writesBefore = Number(await layer.getAttribute("data-presence-write-count"));
  const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));
  const attentionBefore = Number(await scene.getAttribute("data-companion-attention-count"));

  await triggerPrimaryAttention(page);

  await expect(scene).toHaveAttribute(
    "data-companion-attention-count",
    String(attentionBefore + 1),
  );
  await expect(scene).toHaveAttribute("data-companion-attention-active", "true");
  await expectAttentionChanged(scene);

  const eventDetail = await page.evaluate(() => {
    const events = (window as unknown as {
      __s02AttentionEvents: Array<Record<string, unknown>>;
    }).__s02AttentionEvents;
    return events.at(-1);
  });

  expect(eventDetail).toBeTruthy();
  expect(Object.keys(eventDetail!).sort()).toEqual([
    "clientX",
    "clientY",
    "kind",
  ]);
  expect(eventDetail!.kind).toBe("primary-action");
  expect(Number(eventDetail!.clientX)).toBeCloseTo(
    primaryBox.x + primaryBox.width / 2,
    0,
  );
  expect(Number(eventDetail!.clientY)).toBeCloseTo(
    primaryBox.y + primaryBox.height / 2,
    0,
  );

  const attention = await attentionTransform(scene);
  expect(Math.abs(attention.yaw)).toBeLessThanOrEqual(0.1101);
  expect(Math.abs(attention.pitch)).toBeLessThanOrEqual(0.0501);
  expect(attention.maxYaw).toBeLessThanOrEqual(0.16);
  expect(attention.maxPitch).toBeLessThanOrEqual(0.075);
  expect(Math.abs(attention.headYaw + attention.spineYaw - attention.yaw))
    .toBeLessThan(0.0003);
  expect(Math.abs(attention.headPitch + attention.spinePitch - attention.pitch))
    .toBeLessThan(0.0003);

  await expectReactionRootNeutralDuringAttention(scene);
  expect(await worldRootPosition(page)).toEqual(worldBefore);
  expect(Number(await host.getAttribute("data-presence-arena-revision"))).toBe(arenaBefore);
  await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
  await expect(host).toHaveAttribute("data-presence-world-root-pointer", "none");

  await expectAttentionNeutral(scene);

  expect(await worldRootPosition(page)).toEqual(worldBefore);
  await expectReactionRootNeutralDuringAttention(scene);
  await expect(layer).toHaveAttribute("data-presence-write-count", String(writesBefore));
  await expect(layer).toHaveAttribute("data-presence-commit-count", String(commitsBefore));
});

test("#925 tap tactile and relocation each preempt attention without replaying it", async ({ page }) => {
  const layer = await openSpatialS02(page);
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
  const tactile = layer.getByRole("button", { name: "동반자 만져보기", exact: true });
  const scene = page.locator(".living-three-scene");

  // Tap precedence.
  await triggerPrimaryAttention(page);
  await expectAttentionChanged(scene);
  const tapsBefore = Number(await layer.getAttribute("data-presence-tap-count"));

  await tapActor(page, target);

  await expectAttentionNeutral(scene);
  await expect(layer).toHaveAttribute(
    "data-presence-tap-count",
    String(tapsBefore + 1),
  );
  await expect.poll(
    async () => scene.getAttribute("data-companion-tap-reaction-active"),
  ).toBe("false");

  // Tactile precedence.
  await tactile.click();
  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "on");

  await triggerPrimaryAttention(page);
  await expectAttentionChanged(scene);

  await beginTactileMouseDrag(page, target, 28, -17);

  await expectAttentionNeutral(scene);
  await expect(scene).toHaveAttribute("data-companion-tactile-active", "true");
  await expectTactileChanged(scene);

  await page.mouse.up();
  await expectTactileNeutral(scene);

  await tactile.click();
  await expect(layer).toHaveAttribute("data-presence-tactile-mode", "off");

  // Relocation precedence.
  await triggerPrimaryAttention(page);
  await expectAttentionChanged(scene);

  const commitsBefore = Number(await layer.getAttribute("data-presence-commit-count"));
  const worldBefore = await worldRootPosition(page);

  await dragBy(page, target, 28, 10);

  await expectAttentionNeutral(scene);
  await expect(layer).toHaveAttribute(
    "data-presence-commit-count",
    String(commitsBefore + 1),
  );
  expect(await worldRootPosition(page)).not.toEqual(worldBefore);

  // Suppressed/cancelled attention never replays after direct interaction ends.
  const attentionCount = await scene.getAttribute("data-companion-attention-count");
  await page.waitForTimeout(850);
  await expect(scene).toHaveAttribute(
    "data-companion-attention-count",
    attentionCount!,
  );
  await expectAttentionNeutral(scene);
});

test("#925 rapid primary attention replaces stale cue instead of queueing", async ({ page }) => {
  await openSpatialS02(page);
  const scene = page.locator(".living-three-scene");

  const before = Number(await scene.getAttribute("data-companion-attention-count"));

  await triggerPrimaryAttention(page);
  await expect(scene).toHaveAttribute(
    "data-companion-attention-count",
    String(before + 1),
  );
  await expectAttentionChanged(scene);

  // Let cue 1 age far enough that its original completion would occur while
  // cue 2 is still valid.
  await page.waitForTimeout(420);

  await triggerPrimaryAttention(page);
  await expect(scene).toHaveAttribute(
    "data-companion-attention-count",
    String(before + 2),
  );
  await expectAttentionChanged(scene);

  // Cue 1 would now be expired. Its stale callback must not neutralize cue 2.
  await page.waitForTimeout(420);
  await expect(scene).toHaveAttribute("data-companion-attention-active", "true");
  await expectAttentionChanged(scene);

  await expectAttentionNeutral(scene);
});

test("#925 blur hidden and route teardown leave no stale attention intent", async ({ page }) => {
  await openSpatialS02(page);
  const scene = page.locator(".living-three-scene");

  await triggerPrimaryAttention(page);
  await expectAttentionChanged(scene);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
  });
  await expectAttentionNeutral(scene);

  await triggerPrimaryAttention(page);
  await expectAttentionChanged(scene);

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    try {
      document.dispatchEvent(new Event("visibilitychange"));
    } finally {
      Reflect.deleteProperty(document, "hidden");
    }
  });
  await expectAttentionNeutral(scene);

  // Visibility return must not revive the old cue.
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(120);
  await expectAttentionNeutral(scene);

  // Route teardown while a fresh cue is active.
  const primary = await triggerPrimaryAttention(page);
  await expectAttentionChanged(scene);

  await primary.evaluate((button: HTMLButtonElement) => button.click());

  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
  await expect(page.locator(".living-three-scene")).toHaveCount(0);

  await page.getByRole(
    "button",
    { name: /SK7.*오늘의 기록으로 이동/ },
  ).click();

  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  const returnedScene = page.locator(".living-three-scene");
  await expect(returnedScene).toHaveAttribute(
    "data-companion-attention-count",
    "0",
  );
  await expectAttentionNeutral(returnedScene);
});

for (const species of ["cat", "fox", "hedgehog"] as const) {
  test(`#925 attention capability is species-agnostic for ${species}`, async ({ page }) => {
    await page.addInitScript((savedSpecies: string) => {
      localStorage.setItem("sk7-companion-species", savedSpecies);
    }, species);

    await openSpatialS02(page);

    const scene = page.locator(".living-three-scene");

    await expect(scene).toHaveAttribute(
      "data-companion-attention-available",
      "true",
    );
    await expect(scene).toHaveAttribute(
      "data-companion-attention-posture",
      "head-spine",
    );
    await expect(scene).toHaveAttribute(
      "data-companion-attention-head-bone",
      "head",
    );
    await expect(scene).toHaveAttribute(
      "data-companion-attention-spine-bone",
      "spine",
    );

    await triggerPrimaryAttention(page);
    await expectAttentionChanged(scene);

    const value = await attentionTransform(scene);
    expect(Math.abs(value.yaw)).toBeLessThanOrEqual(0.1101);
    expect(Math.abs(value.pitch)).toBeLessThanOrEqual(0.0501);

    await expectAttentionNeutral(scene);
  });
}

test("#925 reduced-motion fallback cannot retain or replay attention", async ({ page }) => {
  // Start from the already-proven realtime S02 path so the scene is inside the
  // viewport and its IntersectionObserver owner has actually been activated.
  await openSpatialS02(page);

  const scene = page.locator(".living-three-scene");

  // Prove there is a real attention cue to tear down.
  await triggerPrimaryAttention(page);
  await expect(scene).toHaveAttribute("data-companion-attention-active", "true");
  await expectAttentionChanged(scene);

  // Reduced motion removes the realtime owner entirely.
  await page.emulateMedia({ reducedMotion: "reduce" });

  await expect(
    page.locator('[data-presence-scene-actor-interaction="S02"]'),
  ).toHaveCount(0);
  await expect(page.locator(".living-three-scene")).toHaveCount(0);
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "poster",
  );

  // The semantic primary action still works and may dispatch its presentation
  // event, but there is no realtime attention owner that can retain the intent.
  await triggerPrimaryAttention(page);
  await page.waitForTimeout(120);
  await expect(page.locator(".living-three-scene")).toHaveCount(0);

  // Return to the existing realtime policy. Because the scene was already
  // viewport-admitted before reduced motion, the replacement owner can become
  // active without introducing a new scrolling requirement.
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );

  const returnedScene = page.locator(".living-three-scene");
  await expect(returnedScene).toHaveCount(1);

  // Neither the pre-teardown cue nor the event dispatched while reduced may
  // survive into the new renderer owner.
  await expect(returnedScene).toHaveAttribute(
    "data-companion-attention-count",
    "0",
  );
  await expectAttentionNeutral(returnedScene);
});
