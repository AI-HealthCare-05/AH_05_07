import { expect, test, type Page } from "@playwright/test";
import { emptySnapshot } from "../src/placeable/contract";
import { STORAGE_KEY } from "../src/placeable/persistence";
import { companionSpecies } from "../src/ui/companion";
import { getMySpaceCompanion } from "../src/ui/mySpaceCompanion";
import { MODEL_FORWARD_YAW_OFFSET } from "../src/placeable/plazaLocomotion";
import { createHash } from "node:crypto";
import { companionIdentityStorageKey } from "../src/ui/companionIdentity";
import {
  resolveTodayGateProximity,
  TODAY_GATE_APPROACH_RADIUS,
} from "../src/placeable/worldScene";
import { E1_LIVING_CITY_ENTRY_SCENE_PROFILE } from "../transcend-lab/src/platform/spatial/e1LivingCityEntrySceneProfile";

// Secondary world actions are disclosed through the real semantic control.
async function worldTool(page: Page, name: string, exact?: boolean) {
  const button = page.getByRole("button", { name, exact, includeHidden: true });
  await button.waitFor({ state: "attached" });
  const tools = page.locator(".plaza-help");
  if (await tools.count() && await tools.getAttribute("open") === null) await tools.locator("summary").click();
  return button;
}

const route = "/?experience=e2&view=3d&storage=browser";
type Sample = { x: number; z: number; facing: number; yaw: number; moving: boolean; engaged: boolean;
  actor: { x: number; y: number }; pin: { x: number; y: number }; labels: { id: string; left: number; top: number; visible: boolean }[] };
const sample = (page: Page): Promise<Sample> => page.evaluate(() => (window as any).__plazaSample);

// Test-only observation of the real scene's existing RAF; no runtime debug hook or extra renderer.
async function open(page: Page) {
  await page.goto(route);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await page.evaluate(async () => {
    const sceneUrl = performance.getEntriesByType("resource").map(entry => entry.name)
      .filter(url => new URL(url).pathname === "/src/placeable/worldScene.ts").at(-1)!;
    const { PlaceableScene } = await new Function("url", "return import(url)")(sceneUrl);
    const step = PlaceableScene.prototype.step;
    PlaceableScene.prototype.step = function (...args: unknown[]) {
      const result = step.apply(this, args);
      const canvas = document.querySelector('canvas')!, rect = canvas.getBoundingClientRect();
      const screen = (point: any) => { point.project(this.camera); return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 }; };
      const pinHub = this.previewRotor.children.find((child: any) => child.geometry?.type === "SphereGeometry");
      if (!pinHub) throw new Error("test probe: pinwheel hub missing");
      (window as any).__plazaSample = { x: this.actor.position.x, z: this.actor.position.z, facing: this.actor.rotation.y,
        yaw: this.cameraRig.yaw, moving: this.locomotion.moving, engaged: this.cameraRig.engaged,
        actor: screen(this.actor.position.clone().setY(0.5)), pin: screen(pinHub.getWorldPosition(this.pinwheel.position.clone())), labels: this.labels() };
      return result;
    };
  });
  await expect.poll(() => sample(page)).toBeTruthy();
}
async function hold(page: Page, key: string, milliseconds = 450) {
  await page.getByTestId("placeable-world-canvas").focus();
  await page.keyboard.down(key); await page.waitForTimeout(milliseconds); await page.keyboard.up(key);
}
async function settle(page: Page) { await expect.poll(async () => (await sample(page)).moving).toBe(false); await page.waitForTimeout(800); }
async function rotate(page: Page, count: number) {
  await page.locator(".plaza-help summary").click();
  for (let n = 0; n < count; n++) await page.getByRole("button", { name: "오른쪽 보기", exact: true }).click();
  await page.waitForTimeout(800);
  await page.locator(".plaza-help summary").click();
}

test("#942 first step is explicit and only real locomotion dismisses it", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page);

  const world = page.getByTestId("placeable-world");
  const cue = page.getByTestId("plaza-first-step");
  const gate = page.locator('[data-world-label="today-gate"]');

  await expect(world).toHaveAttribute("data-first-step", "prompt");
  await expect(cue).toBeVisible();
  await expect(cue).toContainText("Today Gate로 걸어가 보세요.");
  await expect(cue).toContainText("방향키·WASD 또는 걷기 패드");
  await expect(gate).toHaveAttribute("data-arrival-highlight", "true");

  // Elapsed time alone never pretends that the user moved.
  await page.waitForTimeout(1250);
  await expect(world).toHaveAttribute("data-first-step", "prompt");
  await expect(cue).toBeVisible();

  await page.emulateMedia({ forcedColors: "active" });
  await expect(cue).toHaveCSS("border-top-style", "solid");
  await expect(gate).toHaveCSS("outline-style", "solid");
  await page.emulateMedia({ forcedColors: "none" });

  const before = await sample(page);
  await hold(page, "w", 160);

  await expect(world).toHaveAttribute("data-first-step", "acknowledged");
  await expect(cue).toContainText("첫걸음이 시작됐어요.");
  await expect(cue).toContainText("이제 광장을 자유롭게 둘러보세요.");

  const after = await sample(page);
  expect(after.z).toBeLessThan(before.z);

  await expect(world).toHaveAttribute("data-first-step", "complete", {
    timeout: 3000,
  });
  await expect(cue).toHaveCount(0);
  await expect(gate).not.toHaveAttribute("data-arrival-highlight", "true");
});

test("#948 bounded Today return re-enters Living City without replaying first-step onboarding", async ({ page }) => {
  await page.addInitScript(({ key, snapshot }) => {
    localStorage.setItem(key, JSON.stringify(snapshot));
    const original = Storage.prototype.setItem;
    Object.assign(window, { e948Writes: 0 });
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as unknown as { e948Writes: number }).e948Writes++;
      return original.call(this, name, value);
    };
  }, { key: STORAGE_KEY, snapshot: emptySnapshot() });

  const reentryRoute = `${route}&return_space=3d-browser`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(reentryRoute);

  const world = page.getByTestId("placeable-world");
  const cue = page.getByTestId("plaza-return-cue");
  const firstStep = page.getByTestId("plaza-first-step");
  const gate = page.locator('[data-world-label="today-gate"]');
  const today = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });

  await expect(world).toHaveAttribute("data-reentry", "true");
  await expect(world).toHaveAttribute("data-first-step", "complete");
  await expect(firstStep).toHaveCount(0);
  await expect(cue).toBeVisible();
  await expect(cue).toContainText("Today");
  await expect(cue).toContainText("Living City");
  await expect(cue).toContainText("내 공간으로 돌아왔어요.");
  await expect(cue).not.toContainText(/Today Gate|같은 자리|방금 있던 자리/);
  await expect(gate).not.toHaveAttribute("data-arrival-highlight", "true");
  await expect(today).toHaveAttribute("href", "?screen=S02&return_space=3d-browser");
  await expect(cue).toHaveCSS("animation-name", "plaza-return-entry");

  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.reload();
  await expect(world).toHaveAttribute("data-reentry", "true");
  await expect(world).toHaveAttribute("data-first-step", "complete");
  const reducedCue = page.getByTestId("plaza-return-cue");
  await expect(reducedCue).toBeVisible();
  await expect(reducedCue).toHaveCSS("animation-name", "none");
  await expect(reducedCue).toHaveCSS("border-top-style", "solid");

  await page.emulateMedia({ reducedMotion: "no-preference", forcedColors: "none" });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(reentryRoute);
    await expect(page.getByTestId("plaza-return-cue")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  expect(await page.evaluate(() => (window as unknown as { e948Writes: number }).e948Writes)).toBe(0);

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${route}&return_space=classic-browser`);
  await expect(world).toHaveAttribute("data-reentry", "false");
  await expect(world).toHaveAttribute("data-first-step", "prompt");
  await expect(page.getByTestId("plaza-return-cue")).toHaveCount(0);
  await expect(page.getByTestId("plaza-first-step")).toBeVisible();
});

test("#944 Today Gate uses the existing E1 radius and reverses after real arrival", async ({ page }) => {
  const gate = E1_LIVING_CITY_ENTRY_SCENE_PROFILE.destination;

  expect(resolveTodayGateProximity({ x: gate.x + gate.radius, z: gate.z }))
    .toBe("arrived");
  expect(resolveTodayGateProximity({ x: gate.x + gate.radius + 0.01, z: gate.z }))
    .toBe("approach");
  expect(resolveTodayGateProximity({ x: gate.x + TODAY_GATE_APPROACH_RADIUS, z: gate.z }))
    .toBe("approach");
  expect(resolveTodayGateProximity({ x: gate.x + TODAY_GATE_APPROACH_RADIUS + 0.01, z: gate.z }))
    .toBe("far");

  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page);

  const world = page.getByTestId("placeable-world");
  const canvas = page.getByTestId("placeable-world-canvas");
  const gateLabel = page.locator('[data-world-label="today-gate"]');
  const status = page.getByTestId("plaza-gate-status");
  const today = page.getByRole("link", {
    name: "오늘의 기록으로 가기",
    exact: true,
  });

  await expect(world).toHaveAttribute("data-gate-proximity", "far");
  await expect(status).toHaveCount(0);

  // Time alone cannot manufacture approach or arrival.
  await page.waitForTimeout(600);
  await expect(world).toHaveAttribute("data-gate-proximity", "far");

  // Walk straight toward the Gate until entering the derived approach envelope.
  await canvas.focus();
  await page.keyboard.down("w");
  try {
    await expect(world).toHaveAttribute("data-gate-proximity", "approach", {
      timeout: 4500,
    });
  } finally {
    await page.keyboard.up("w");
  }

  await expect(world).toHaveAttribute("data-first-step", "complete", {
    timeout: 3000,
  });
  await expect(status).toContainText("Today Gate가 가까워지고 있어요.");
  await expect(status).toContainText("조금만 더 걸어가 보세요.");

  // Arrival requires centering on the real Gate; straight-ahead alone cannot
  // satisfy the authoritative 0.85m radius from the authored start position.
  await canvas.focus();
  await page.keyboard.down("d");
  try {
    await expect.poll(async () => (await sample(page)).x, {
      timeout: 3500,
    }).toBeGreaterThan(-0.25);
  } finally {
    await page.keyboard.up("d");
  }

  await canvas.focus();
  await page.keyboard.down("w");
  try {
    await expect(world).toHaveAttribute("data-gate-proximity", "arrived", {
      timeout: 4000,
    });
  } finally {
    await page.keyboard.up("w");
  }

  await expect(status).toContainText("Today Gate에 도착했어요.");
  await expect(status).toContainText("오늘의 기록으로 이어갈 수 있어요.");
  await expect(today).toHaveAttribute(
    "href",
    "?screen=S02&return_space=3d-browser",
  );

  expect(
    await today.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).not.toBe("rgba(0, 0, 0, 0)");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(gateLabel).toHaveCSS("animation-name", "none");

  await page.emulateMedia({
    reducedMotion: "reduce",
    forcedColors: "active",
  });
  await expect(status).toHaveCSS("border-top-style", "solid");
  await expect(gateLabel).toHaveCSS("outline-style", "solid");

  await page.emulateMedia({
    reducedMotion: "no-preference",
    forcedColors: "none",
  });

  // Walking away must reverse the same visit-local state.
  await canvas.focus();
  await page.keyboard.down("s");
  try {
    await expect(world).toHaveAttribute("data-gate-proximity", "approach", {
      timeout: 2500,
    });
    await expect(world).toHaveAttribute("data-gate-proximity", "far", {
      timeout: 4000,
    });
  } finally {
    await page.keyboard.up("s");
  }

  await expect(status).toHaveCount(0);
  expect(
    await today.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0)");
});

test("R2 desktop actual locomotion, facing, 90/180 degree camera-relative control, stop, reset and label tracking", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 }); await open(page);
  const initial = await sample(page); expect(initial.engaged).toBe(false);
  await page.screenshot({ path: test.info().outputPath("arrival.png") });
  await hold(page, "w"); await settle(page);
  const forward = await sample(page); expect(forward.z).toBeLessThan(initial.z - 0.2);
  expect(Math.cos(forward.facing)).toBeLessThan(-0.9);
  await hold(page, "s", 700); await settle(page);
  expect(Math.cos((await sample(page)).facing)).toBeGreaterThan(0.9);
  await rotate(page, 3); const ninety = await sample(page);
  await hold(page, "ArrowUp"); await settle(page); const left = await sample(page);
  expect(left.x).toBeLessThan(ninety.x - 0.2); expect(Math.abs(left.z - ninety.z)).toBeLessThan(0.15);
  await rotate(page, 3); const half = await sample(page);
  await hold(page, "w"); await settle(page);
  expect((await sample(page)).z).toBeGreaterThan(half.z + 0.2);
  const label = page.locator('.placeable-world-label').first();
  expect((await sample(page)).labels[0].visible).toBe(false); await expect(label).toBeHidden();
  await page.locator(".plaza-help summary").click();
  await page.getByRole("button", { name: "시점 다시 맞추기" }).click(); await page.waitForTimeout(900);
  expect(Math.abs((await sample(page)).yaw)).toBeLessThan(0.1);
  await page.locator(".plaza-help summary").click();
  await hold(page, "d", 350); // Blur while moving must zero velocity, including deceleration.
  await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).focus();
  const stopped = await sample(page); await page.waitForTimeout(250);
  expect((await sample(page)).x).toBeCloseTo(stopped.x, 4);
  await page.screenshot({ path: test.info().outputPath("follow.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1366);
});

test("R2 raycast taps survive orbit; dragging companion/pinwheel never greets or spins", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 }); await open(page);
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "환영 바람개비 고르기" }).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("save-status")).toContainText("저장했어요");
  await expect.poll(async () => (await page.getByTestId("placeable-world-canvas").boundingBox())!.width).toBe(1366);
  await page.waitForTimeout(100); // ResizeObserver and the sampled camera now describe the full stage.
  const start = await sample(page);
  await page.mouse.click(start.actor.x, start.actor.y);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "greet");
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle", { timeout: 8000 });
  for (const target of ["actor", "pin"] as const) {
    const at = (await sample(page))[target], pulse = await page.getByTestId("placeable-world").getAttribute("data-pulse");
    await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 70, at.y + 15, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle");
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-pulse", pulse!);
  }
  const at = (await sample(page)).actor; await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "greet");
  const pin = (await sample(page)).pin; await page.mouse.click(pin.x, pin.y);
  await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
});

for (const [width, height] of [[390, 844], [320, 568]]) test(`R2 ${width}px two touch pointers coexist; controls and Today remain reachable`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await open(page); const before = await sample(page), cdp = await context.newCDPSession(page);
    const help = (await page.locator(".plaza-help summary").boundingBox())!;
    const garden = (await (await worldTool(page, "정원 쉼터로 가기", false)).boundingBox())!;
    expect(help.x + help.width <= garden.x || help.y + help.height <= garden.y || garden.y + garden.height <= help.y).toBe(true);
    await page.locator(".plaza-help summary").tap();
    const pad = (await page.getByRole("button", { name: "드래그하거나 방향키로 광장 걷기" }).boundingBox())!;
    const thumb = { id: 1, x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 };
    const canvas = (await page.getByTestId("placeable-world-canvas").boundingBox())!;
    const camera = { id: 2, x: canvas.x + canvas.width * 0.67, y: canvas.y + canvas.height * 0.48 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb] });
    thumb.y -= 26;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb] });
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-first-step", /acknowledged|complete/);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb, camera] });
    camera.x -= 80;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb, camera] });
    await page.waitForTimeout(350);
    expect((await sample(page)).yaw).toBeGreaterThan(before.yaw + 0.2);
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [thumb] });
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await settle(page);
    await page.locator(".plaza-help summary").tap();
    await page.getByRole("button", { name: "시점 다시 맞추기" }).tap();
    await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: test.info().outputPath(`touch-${width}.png`), scale: "css" });
    await page.locator(".plaza-help summary").tap();
    await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).tap();
    await expect(page.getByTestId("placeable-world")).toHaveCount(0);
  } finally { await context.close(); }
});

test("R2 reduced motion, forced colors, context loss, retry and semantic escape", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await open(page);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-first-step", "prompt");
  await expect(page.getByTestId("plaza-first-step")).toBeVisible();
  await expect(page.locator('[data-world-label="today-gate"]')).toHaveCSS("animation-name", "none");
  const before = await sample(page); await hold(page, "ArrowRight");
  expect((await sample(page)).x).toBeGreaterThan(before.x);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "neutral");
  await rotate(page, 1); expect((await sample(page)).yaw).toBeGreaterThan(0.4);
  await page.emulateMedia({ forcedColors: "active" });
  await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).focus();
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true })).toHaveCSS("outline-style", "solid");
  await page.screenshot({ path: test.info().outputPath("903-forced-colors-focus.png"), scale: "css" });
  await page.getByTestId("placeable-world-canvas").evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await page.getByRole("button", { name: "3D 다시 열기" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("903-world-failure.png"), scale: "css" });
  await page.getByRole("button", { name: "3D 다시 열기" }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "neutral");
  expect(await page.locator("canvas").count()).toBe(1);
  await page.getByRole("link", { name: "간단한 광장으로 보기" }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
});

test("R2 exact active GLBs calibrate +Z forward and retain existing move capability", async ({ page, request }) => {
  test.setTimeout(90000); await page.goto(route);
  expect(MODEL_FORWARD_YAW_OFFSET).toBe(0);
  for (const species of companionSpecies) {
    const asset = getMySpaceCompanion(species)!;
    const response = await request.get(asset.url); expect(response.ok()).toBe(true);
    const bytes = await response.body(); expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    const result = await page.evaluate(async (url) => {
      const { GLTFLoader } = await new Function("return import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js')")();
      const gltf = await new GLTFLoader().loadAsync(url); gltf.scene.updateMatrixWorld(true);
      const eyes: any[] = []; gltf.scene.traverse((o: any) => { if (/^Eye_[LR]$/.test(o.name)) eyes.push(o); });
      const positions = eyes.map(o => { o.geometry.computeBoundingBox(); return o.geometry.boundingBox.getCenter(o.position.clone()).applyMatrix4(o.matrixWorld).toArray(); });
      const move = gltf.animations.find((c: any) => c.name === "move");
      const names = gltf.animations.map((c: any) => c.name);
      const { disposeScene } = await new Function("return import('/src/components/scene/disposeScene.ts')")(); disposeScene(gltf.scene);
      return { positions, names, duration: move.duration, tracks: move.tracks.length };
    }, asset.url);
    expect(result.positions).toHaveLength(2);
    for (const eye of result.positions) { expect(eye[2]).toBeGreaterThan(0.25); expect(Math.abs(eye[0])).toBeLessThan(eye[2]); }
    expect(result.names).toContain("move"); expect(result.duration).toBeCloseTo(4); expect(result.tracks).toBeGreaterThan(0);
  }
});

test("R3 actual companion materials remain readable in both atmospheres with one bounded canvas", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(route);
  for (const species of companionSpecies) {
    await page.evaluate(({ key, species }) => localStorage.setItem(key, species), { key: companionIdentityStorageKey, species });
    await page.reload();
    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute("data-companion", species);
    await expect(world).toHaveAttribute("data-companion-pose", "neutral");
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await page.getByTestId("placeable-world-canvas").evaluate((canvas: HTMLCanvasElement) => canvas.width * canvas.height)).toBeLessThanOrEqual(2_000_000);
    // Still GLBs and exact arrival camera make these human visual-review artifacts.
    await page.screenshot({ path: test.info().outputPath(`${species}-daylight.png`) });
    await (await worldTool(page, "광장의 불빛 켜기", true)).click();
    await expect(world).toHaveAttribute("data-welcome-phase", "twilight");
    await page.screenshot({ path: test.info().outputPath(`${species}-twilight.png`) });
    const glbs = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name).filter(name => /\.glb(?:\?|$)/.test(name)));
    expect(glbs).toEqual([new URL(getMySpaceCompanion(species)!.url, page.url()).href]);
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 320]) test(`R3 ${width}px chrome, 200% text and safe-area controls remain reachable`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "neutral");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 44, bottom: 34, left: 0, right: 0 } });
  const pad = (await page.locator(".placeable-walk-pad").boundingBox())!;
  expect(pad.y + pad.height).toBeLessThanOrEqual(844 - 34);
  await page.screenshot({ path: test.info().outputPath(`safe-area-${width}.png`) });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const today = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });
  await today.focus(); await expect(today).toBeFocused(); await expect(today).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: test.info().outputPath(`text-200-${width}.png`) });
  const surfaces = [".placeable-header", ".placeable-destination", ".plaza-help > summary", ".placeable-walk-pad", ".plaza-first-step-cue"];
  const boxes = await Promise.all(surfaces.map(selector => page.locator(selector).boundingBox()));
  for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) {
    expect(a && b).toBeTruthy();
    expect(a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x || a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y,
      `${surfaces[i]} overlaps another control: ${JSON.stringify({ a, b })}`).toBe(true);
  }
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내 공간 꾸미기", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
  await (await worldTool(page, "정원 쉼터로 가기", false)).click();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "광장으로 돌아가기", exact: true }).click();
  await today.click();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
});
