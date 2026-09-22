import { expect, test, type Locator, type Page } from "@playwright/test";

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
