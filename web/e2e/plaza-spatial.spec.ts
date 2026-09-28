import { expect, test, type Page } from "@playwright/test";
import { companionSpecies } from "../src/ui/companion";
import { getMySpaceCompanion } from "../src/ui/mySpaceCompanion";
import { MODEL_FORWARD_YAW_OFFSET } from "../src/placeable/plazaLocomotion";
import { createHash } from "node:crypto";
import { companionIdentityStorageKey } from "../src/ui/companionIdentity";

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
      (window as any).__plazaSample = { x: this.actor.position.x, z: this.actor.position.z, facing: this.actor.rotation.y,
        yaw: this.cameraRig.yaw, moving: this.locomotion.moving, engaged: this.cameraRig.engaged,
        actor: screen(this.actor.position.clone().setY(0.5)), pin: screen(this.pinwheel.position.clone().setY(1)), labels: this.labels() };
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
  await page.getByRole("link", { name: "오늘의 기록", exact: true }).focus();
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
    const garden = (await page.getByRole("button", { name: "정원 쉼터로 가기", exact: false }).boundingBox())!;
    expect(help.x + help.width <= garden.x || help.y + help.height <= garden.y || garden.y + garden.height <= help.y).toBe(true);
    const pad = (await page.getByRole("button", { name: "드래그하거나 방향키로 광장 걷기" }).boundingBox())!;
    const thumb = { id: 1, x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 };
    const camera = { id: 2, x: width * 0.67, y: height * 0.48 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb] });
    thumb.y -= 26;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb] });
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
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
    await expect(page.getByRole("link", { name: "오늘의 기록", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: test.info().outputPath(`touch-${width}.png`), scale: "css" });
    await page.locator(".plaza-help summary").tap();
    await page.getByRole("link", { name: "오늘의 기록", exact: true }).tap();
    await expect(page.getByTestId("placeable-world")).toHaveCount(0);
  } finally { await context.close(); }
});

test("R2 reduced motion, forced colors, context loss, retry and semantic escape", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await open(page);
  const before = await sample(page); await hold(page, "ArrowRight");
  expect((await sample(page)).x).toBeGreaterThan(before.x);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "neutral");
  await rotate(page, 1); expect((await sample(page)).yaw).toBeGreaterThan(0.4);
  await page.emulateMedia({ forcedColors: "active" });
  await page.getByRole("link", { name: "오늘의 기록", exact: true }).focus();
  await expect(page.getByRole("link", { name: "오늘의 기록", exact: true })).toBeFocused();
  await page.getByTestId("placeable-world-canvas").evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
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
    await page.getByRole("button", { name: "광장의 불빛 켜기", exact: true }).click();
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
  const today = page.getByRole("link", { name: "오늘의 기록", exact: true });
  await today.focus(); await expect(today).toBeFocused(); await expect(today).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: test.info().outputPath(`text-200-${width}.png`) });
  const surfaces = [".placeable-header", ".placeable-twilight", ".placeable-destination", ".placeable-companion",
    ".plaza-help", ".placeable-walk-pad", ".placeable-garden-path"];
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
  await page.getByRole("button", { name: "정원 쉼터로 가기", exact: false }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "광장으로 돌아가기", exact: true }).click();
  await today.click();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
});
