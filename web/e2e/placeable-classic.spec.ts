import { expect, test, type Page } from "@playwright/test";
import { emptySnapshot, fingerprint, type Operation, type Snapshot } from "../src/placeable/contract";
import { STORAGE_KEY } from "../src/placeable/persistence";
import { PlaceableScene } from "../src/placeable/worldScene";
import { Vector3 } from "three";
import { getMySpaceCompanion } from "../src/ui/mySpaceCompanion";
import { GardenScene } from "../src/placeable/gardenScene";

// Editing is explicit in immersive 3D; Classic retains its inline controls.
async function editorButton(page: Page, name: string, exact?: boolean) {
  await page.getByTestId("placeable-experience").waitFor();
  const opener = page.getByRole("button", { name: "꾸미기", exact: true });
  if (await opener.count() && await opener.getAttribute("aria-expanded") === "false") await opener.click();
  return page.getByRole("button", { name, exact });
}

// Secondary world actions are disclosed through the real semantic control.
async function worldTool(page: Page, name: string, exact?: boolean) {
  const button = page.getByRole("button", { name, exact, includeHidden: true });
  await button.waitFor({ state: "attached" });
  const tools = page.locator(".plaza-help");
  if (await tools.count() && await tools.getAttribute("open") === null) await tools.locator("summary").click();
  return button;
}

const browserRoute = "/?experience=e2&view=classic&storage=browser";
const saved = async (op: Operation): Promise<Snapshot> => ({ ...emptySnapshot(), revision: op.expectedRevision + 1,
  schemaVersion: op.schemaVersion, layoutId: op.layoutId, selection: op.selection, latestOperationId: op.operationId, latestFingerprint: await fingerprint(op) });
const readLocal = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), STORAGE_KEY);
const confirm = async (page: Page) => {
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("save-status")).toContainText("저장했어요");
};

const companionRoute = "/?experience=e2&view=3d&storage=browser";

for (const mobile of [false, true]) test(`Plaza immersive ${mobile ? "mobile touch" : "desktop keyboard"}: edit, preview, cancel, confirmed save and destinations`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 2 });
  const page = await context.newPage(), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(companionRoute + "&living_choice=sleep-routine");
    const main = page.getByTestId("placeable-experience"), canvas = page.getByTestId("placeable-world-canvas");
    const editor = page.getByRole("region", { name: "내 공간 꾸미기", includeHidden: true });
    const open = page.getByRole("button", { name: "꾸미기", exact: true });
    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute("data-companion-pose", "idle", { timeout: 15000 });
    await expect(world).toHaveAttribute("data-scenery-profile", mobile ? "compact" : "full");
    await expect(editor).toBeHidden();
    const rect = (await canvas.boundingBox())!;
    expect(rect.height).toBeGreaterThan((mobile ? 844 : 960) * 0.6);
    expect(await canvas.evaluate((c: HTMLCanvasElement) => c.width * c.height)).toBeLessThanOrEqual(2_000_000);
    if (mobile) await open.tap(); else { await open.focus(); await page.keyboard.press("Enter"); }
    await expect(page.getByRole("heading", { name: "내 공간 꾸미기" })).toBeFocused();
    await page.getByRole("button", { name: "환영 바람개비 고르기" }).click();
    await expect(page.getByTestId("draft-placement")).toContainText("저장 전");
    expect(await readLocal(page)).toBeNull();
    await page.getByRole("button", { name: "청록", exact: true }).click();
    await page.getByRole("button", { name: "입구 오른쪽", exact: true }).click();
    await expect(world).toHaveAttribute("data-preview", "true");
    await expect(world).toHaveAttribute("data-color", "teal");
    await expect(world).toHaveAttribute("data-socket", "gate-right");
    await expect(page.getByTestId("draft-placement")).toContainText("미리보기: 청록 · 입구 오른쪽");
    expect(await readLocal(page)).toBeNull();
    await page.screenshot({ path: test.info().outputPath(`plaza-${mobile ? "mobile" : "desktop"}-preview.png`) });
    if (mobile) await page.getByRole("button", { name: "미리보기 취소" }).tap(); else await page.keyboard.press("Escape");
    await expect(editor).toBeHidden(); await expect(open).toBeFocused();
    await expect(world).toHaveAttribute("data-preview", "false");
    expect(await readLocal(page)).toBeNull();
    await (await editorButton(page, "환영 바람개비 고르기")).click();
    await page.getByRole("button", { name: "청록", exact: true }).click();
    await page.getByRole("button", { name: "입구 오른쪽", exact: true }).click();
    await confirm(page); await expect(editor).toBeHidden(); await expect(open).toBeFocused();
    await (await editorButton(page, "이 문양을 내 공간에 남기기")).click(); await confirm(page);
    const before = await readLocal(page);
    if (mobile) {
      await page.setViewportSize({ width: 320, height: 844 });
      const exit = (await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).boundingBox())!;
      const light = (await (await worldTool(page, "광장의 불빛 켜기")).boundingBox())!;
      const spin = (await (await worldTool(page, "바람개비 돌리기", true)).boundingBox())!;
      const walk = (await page.getByRole("button", { name: "드래그하거나 방향키로 광장 걷기", exact: false }).boundingBox())!;
      expect(exit.width).toBeGreaterThanOrEqual(44);
      expect(light.height).toBeGreaterThanOrEqual(44);
      expect(spin.height).toBeGreaterThanOrEqual(44);
      expect(walk.width).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
      await page.screenshot({ path: test.info().outputPath("plaza-320.png"), scale: "css" });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await (await worldTool(page, "바람개비 돌리기", true)).click();
    await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
    await page.screenshot({ path: test.info().outputPath(`plaza-${mobile ? "mobile" : "desktop"}-daylight.png`) });
    await (await worldTool(page, "광장의 불빛 켜기")).click();
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-welcome-phase", "twilight");
    await page.screenshot({ path: test.info().outputPath(`plaza-${mobile ? "mobile" : "desktop"}-twilight.png`) });
    await (await worldTool(page, "정원 쉼터로 가기")).click();
    await expect(page.getByTestId("garden-canvas")).toBeVisible();
    await page.getByRole("button", { name: "광장으로 돌아가기" }).click();
    await expect(main).toHaveAttribute("data-phase", "ready"); await expect(editor).toBeHidden();
    await expect(page.getByRole("button", { name: "정원 쉼터로 가기" })).toBeFocused();
    expect(await readLocal(page)).toEqual(before);
    await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: false }).click();
    await expect(main).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("#917 reduced motion keeps pinwheel preview static, semantic and unsaved", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(companionRoute);

  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute("data-companion-pose", "neutral", { timeout: 15000 });
  await expect(world).toHaveAttribute("data-reduced-motion", "true");

  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await page.getByRole("button", { name: "청록", exact: true }).click();
  await page.getByRole("button", { name: "입구 오른쪽", exact: true }).click();

  await expect(world).toHaveAttribute("data-preview", "true");
  await expect(world).toHaveAttribute("data-color", "teal");
  await expect(world).toHaveAttribute("data-socket", "gate-right");
  await expect(page.getByTestId("draft-placement")).toContainText("저장 전");
  expect(await readLocal(page)).toBeNull();

  await page.getByRole("button", { name: "미리보기 취소" }).click();
  await expect(world).toHaveAttribute("data-preview", "false");
  expect(await readLocal(page)).toBeNull();
});

for (const behavior of ["unknown", "conflict"] as const) test(`Plaza immersive ${behavior}: recovery stays visible and cannot become a saved response`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await accountRoute(page, behavior, false);
  await page.goto("/?experience=e2&view=3d&storage=account");
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", behavior);
  await expect(page.getByRole("region", { name: "내 공간 꾸미기" })).toBeVisible();
  await expect(page.getByTestId("save-status")).toBeInViewport();
  await expect(page.getByTestId("save-status")).not.toContainText("저장했어요");
  await expect(page.getByTestId("draft-placement")).toContainText("저장 전");
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true })).toHaveAttribute("aria-disabled", "true");
  if (behavior === "unknown") {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "취소하고 닫기" })).toBeDisabled();
    await page.getByRole("button", { name: "저장된 상태 확인" }).click();
    await expect(page.getByTestId("save-status")).toContainText("저장 결과를 확인할 수 없어요");
  } else {
    await page.getByRole("button", { name: "미리보기를 유지하고 최근 저장 상태 사용" }).click();
    await confirm(page);
    await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toHaveAttribute("aria-expanded", "false");
  }
});

async function companionPoint(page: Page) {
  const canvas = page.getByTestId("placeable-world-canvas"); await canvas.scrollIntoViewIfNeeded();
  const rect = (await canvas.boundingBox())!, scene = new PlaceableScene();
  scene.resize(rect.width / rect.height);
  const point = new Vector3(scene.actor.position.x, 0.5, scene.actor.position.z).project(scene.camera);
  scene.dispose();
  return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
}

test("E5 actual default lite: pointer and keyboard greet return to idle without writes; cosmetics and re-entry survive", async ({ page }) => {
  const snapshot = await saved({ operationId: "00000000-0000-4000-8000-000000000818", expectedRevision: 0, schemaVersion: "placeable.v2", layoutId: "e1-plaza.v2",
    selection: { pinwheel: { assetId: "welcome-pinwheel-v1", color: "teal", socketId: "gate-right" }, keepsake: "quiet-moon-v1" } });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    const original = Storage.prototype.setItem;
    Object.assign(window, { e5Writes: [] });
    Storage.prototype.setItem = function (key, value) {
      (window as unknown as { e5Writes: string[] }).e5Writes.push(key); original.call(this, key, value);
    };
  }, { key: STORAGE_KEY, value: snapshot });
  const requests: string[] = [], writes: string[] = [], errors: string[] = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.endsWith(".glb")) requests.push(r.url()); if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(companionRoute + "&livingChoice=walk-10-minutes&companionSpecies=fox&assetUrl=https://forged.invalid/a.glb");
  const world = page.getByTestId("placeable-world"), button = page.getByRole("button", { name: "동반자에게 인사하기" });
  await expect(world).toHaveAttribute("data-companion-pose", "idle", { timeout: 15000 });
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  expect(requests).toEqual([getMySpaceCompanion("bear")!.url]);
  // The existing auth SDK may probe browser storage during entry initialization.
  // Only explicit companion interactions are under the no-write assertion.
  const initialWrites = await page.evaluate(() => (window as unknown as { e5Writes: string[] }).e5Writes);
  const before = await readLocal(page), point = await companionPoint(page);
  await page.mouse.click(point.x, point.y); await expect(world).toHaveAttribute("data-companion-pose", "greet");
  await expect(world).toHaveAttribute("data-companion-pose", "idle", { timeout: 10000 });
  await worldTool(page, "동반자에게 인사하기");
  await button.focus(); await page.keyboard.press("Enter"); await expect(world).toHaveAttribute("data-companion-pose", "greet");
  await expect(world).toHaveAttribute("data-companion-pose", "idle", { timeout: 10000 });
  await expect(page.getByTestId("companion-response")).toContainText("인사를 나눴어요");
  expect(await readLocal(page)).toEqual(before);
  expect(await page.evaluate(() => (window as unknown as { e5Writes: string[] }).e5Writes)).toEqual(initialWrites);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
  await expect(world).toHaveAttribute("data-keepsake", "quiet-moon-v1");
  await expect(world).toHaveAttribute("data-color", "teal");
  await (await worldTool(page, "바람개비 돌리기", true)).click();
  await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await expect(page.getByTestId("classic-keepsake")).toBeVisible();
  await page.getByRole("link", { name: "3D 광장으로 보기" }).click();
  await expect(world).toHaveAttribute("data-companion-pose", "idle", { timeout: 15000 });
  await expect(page.getByTestId("companion-response")).toContainText("함께 있어요");
  expect(await readLocal(page)).toEqual(before);
});

test("E5 actual non-default lite supports touch, live reduced-motion changes and desktop/mobile framing", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => localStorage.setItem("sk7-companion-species", "rabbit"));
    await page.goto(companionRoute);
    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute("data-companion", "rabbit");
    await expect(world).toHaveAttribute("data-companion-pose", "neutral", { timeout: 15000 });
    const point = await companionPoint(page); await page.touchscreen.tap(point.x, point.y);
    await expect(page.getByTestId("companion-response")).toContainText("인사를 나눴어요");
    await expect(world).toHaveAttribute("data-companion-pose", "neutral");
    expect(await readLocal(page)).toBeNull();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(world).toHaveAttribute("data-companion-pose", "idle");
    const active = await companionPoint(page); await page.touchscreen.tap(active.x, active.y);
    await expect(world).toHaveAttribute("data-companion-pose", "greet");
    await expect(world).toHaveAttribute("data-companion-pose", "idle", { timeout: 10000 });
    for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.getByTestId("placeable-world-canvas").screenshot({ path: test.info().outputPath(`e5-rabbit-${viewport.width}.png`) });
      const point = await companionPoint(page); await page.touchscreen.tap(point.x, point.y);
      await expect(world).toHaveAttribute("data-companion-pose", "greet");
      await page.emulateMedia({ reducedMotion: "reduce" }); await expect(world).toHaveAttribute("data-companion-pose", "neutral");
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
  } finally { await context.close(); }
});

for (const preference of ["invalid", "blocked"]) test(`E5 ${preference} preference uses safe bear without repairing storage`, async ({ page }) => {
  await page.addInitScript((kind) => {
    localStorage.setItem("sk7-companion-species", "invalid");
    if (kind === "blocked") {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) { if (key === "sk7-companion-species") throw new Error("blocked"); return original.call(this, key); };
    }
  }, preference);
  await page.goto(companionRoute);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion", "bear");
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle", { timeout: 15000 });
  expect(await readLocal(page)).toBeNull();
  if (preference === "invalid") expect(await page.evaluate(() => localStorage.getItem("sk7-companion-species"))).toBe("invalid");
});

for (const failure of ["network", "clips"]) test(`E5 ${failure} failure is local and preserves placement, Gate and Classic`, async ({ page }) => {
  await page.route("**/companion/v1/**", async (route) => {
    if (failure === "network") await route.abort("failed");
    else await route.fulfill({ contentType: "model/gltf+json", body: JSON.stringify({ asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [] }], nodes: [], animations: [] }) });
  });
  await page.goto(companionRoute);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "unavailable");
  await expect(page.getByTestId("companion-response")).toContainText("오늘의 기록");
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  expect(await readLocal(page)).toBeNull();
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  await (await worldTool(page, "바람개비 돌리기", true)).click();
  await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
  const before = await readLocal(page);
  await expect(page.getByRole("link", { name: /오늘의 기록으로 가기/ })).toHaveAttribute("aria-disabled", "false");
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await expect(page.getByTestId("classic-pinwheel")).toBeVisible(); expect(await readLocal(page)).toEqual(before);
});

test("browser experience previews, cancels, confirms, interacts, leaves/returns, moves, recolors and removes", async ({ page }) => {
  await page.goto(browserRoute);
  await expect(page.getByTestId("storage-label")).toContainText("이 브라우저에만 저장");
  await expect(page.getByTestId("confirmed-placement")).toHaveText("저장 상태: 바람개비 없음");
  expect(await readLocal(page)).toBeNull();
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await expect(page.getByTestId("classic-plaza")).toHaveAttribute("data-preview", "true");
  await expect(page.getByTestId("classic-pinwheel")).toBeVisible();
  expect(await readLocal(page)).toBeNull();
  await page.getByRole("button", { name: "미리보기 취소" }).click();
  await expect(page.getByTestId("classic-pinwheel")).toHaveCount(0);
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  const first = await readLocal(page);
  await (await worldTool(page, "바람개비 돌리기", true)).click();
  await expect(page.getByTestId("placeable-feedback")).toHaveText("광장에 바람이 불어 바람개비가 돌아가요.");
  expect(await readLocal(page)).toEqual(first);
  await (await editorButton(page, "입구 오른쪽", true)).click();
  await expect(page.locator(".pinwheel-spin")).toHaveCount(0);
  await expect(page.getByTestId("save-status")).not.toContainText("저장했어요");
  await page.getByRole("button", { name: "미리보기 취소" }).click();
  await page.getByRole("link", { name: "오늘의 기록", exact: true }).click(); await page.goto(browserRoute);
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "coral");
  await (await editorButton(page, "입구 오른쪽", true)).click();
  await (await editorButton(page, "청록", true)).click();
  expect(await readLocal(page)).toEqual(first); await confirm(page); await page.reload();
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-socket", "gate-right");
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "teal");
  await (await editorButton(page, "바람개비 치우기")).click(); await confirm(page); await page.reload();
  await expect(page.getByTestId("confirmed-placement")).toHaveText("저장 상태: 바람개비 없음");
  expect((await readLocal(page)).revision).toBe(3);
});

test("Classic keyboard, reduced motion and unavailable audio retain visual interaction", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: undefined });
  });
  await page.goto(browserRoute);
  const choose = (await editorButton(page, "환영 바람개비 고르기"));
  await expect(choose).toBeEnabled(); await choose.focus(); await page.keyboard.press("Enter");
  await confirm(page);
  await (await editorButton(page, "소리 켜기")).click();
  await expect(page.getByTestId("audio-status")).toContainText("사용할 수 없음");
  await (await worldTool(page, "바람개비 돌리기", true)).click();
  await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
  await expect(page.locator(".pinwheel-spin")).toHaveCSS("animation-name", "none");
});

test("3D uses the same saved value, previews actual sockets, pauses controls and supports reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(browserRoute);
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  await page.getByRole("link", { name: "3D 광장으로 보기" }).click();
  const world = page.getByTestId("placeable-world"), canvas = page.getByTestId("placeable-world-canvas");
  await expect(canvas).toBeVisible(); await expect(world).toHaveAttribute("data-color", "coral");
  await expect(world).toHaveAttribute("data-reduced-motion", "true");
  await canvas.focus(); await expect(world).toHaveAttribute("data-suspended", "false");
  const first = await readLocal(page); await page.keyboard.press("Enter");
  await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
  expect(await readLocal(page)).toEqual(first);
  await (await editorButton(page, "광장 가장자리", true)).click();
  await (await editorButton(page, "해바라기", true)).click();
  await expect(world).toHaveAttribute("data-preview", "true");
  await expect(world).toHaveAttribute("data-socket", "plaza-edge");
  await expect(world).toHaveAttribute("data-suspended", "true");
  await expect(page.getByRole("button", { name: "드래그하거나 방향키로 광장 걷기", exact: false })).toBeDisabled();
  expect(await readLocal(page)).toEqual(first); await confirm(page); await page.reload();
  await expect(world).toHaveAttribute("data-color", "sunflower");
  await expect(world).toHaveAttribute("data-socket", "plaza-edge");
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "sunflower");
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-socket", "plaza-edge");
});

test("default and Classic URLs never request or mount E2", async ({ page }) => {
  const requested: string[] = []; page.on("request", (request) => requested.push(request.url()));
  for (const path of ["/", "/?screen=S02", "/?experience=e2&screen=S07"]) {
    await page.goto(path); await expect(page.getByTestId("placeable-experience")).toHaveCount(0);
  }
  expect(requested.filter((url) => /ProductPlaceableEntry|PlaceableWorld/.test(url))).toEqual([]);
});

test("lost WebGL context releases the scene and retries without changing the confirmed placement", async ({ page }) => {
  await page.goto(browserRoute);
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  const before = await readLocal(page);
  await page.getByRole("link", { name: "3D 광장으로 보기" }).click();
  const canvas = page.getByTestId("placeable-world-canvas"); await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Context-loss exercise needs WEBGL_lose_context");
    extension.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await expect(canvas).toHaveCount(0); expect(await readLocal(page)).toEqual(before);
  await page.getByRole("button", { name: "3D 다시 열기" }).click(); await expect(canvas).toBeVisible();
  expect(await readLocal(page)).toEqual(before);
});

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS" };
async function accountRoute(page: Page, behavior: "conflict" | "unknown" | "read-error" | "normal", confirmUnknownOnRead = true, initialSnapshot = emptySnapshot()) {
  const owner = "00000000-0000-4000-8000-000000000810";
  const user = { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const token = [Buffer.from('{"alg":"none"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: owner, exp: 4102444800 })).toString("base64url"), "synthetic"].join(".");
  await page.addInitScript(({ token, user }) => localStorage.setItem("sb-e2e-auth-token", JSON.stringify({
    access_token: token, refresh_token: "synthetic-refresh", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user,
  })), { token, user });
  await page.route("https://e2e.invalid/auth/v1/**", (route) => route.fulfill({ status: route.request().method() === "OPTIONS" ? 204 : 200,
    headers: cors, contentType: "application/json", body: route.request().method() === "OPTIONS" ? "" : JSON.stringify(user) }));
  let snapshot = initialSnapshot, puts = 0, reads = 0;
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (request.method() === "GET") {
      reads++;
      return route.fulfill({ status: behavior === "read-error" && reads === 1 ? 503 : 200, headers: cors, contentType: "application/json",
        body: JSON.stringify(behavior === "read-error" && reads === 1 ? { detail: { code: "read_unavailable" } }
          : behavior === "unknown" && !confirmUnknownOnRead ? emptySnapshot() : snapshot) });
    }
    puts++; const op = request.postDataJSON() as Operation;
    if (behavior === "conflict" && puts === 1) {
      snapshot = await saved({ ...op, operationId: crypto.randomUUID(), selection: op.schemaVersion === "placeable.v2" ? { pinwheel: null, keepsake: null } : null });
      return route.fulfill({ status: 409, headers: cors, contentType: "application/json", body: JSON.stringify({ detail: { code: "revision_conflict" } }) });
    }
    snapshot = await saved(op);
    if (behavior === "unknown") return route.abort("failed");
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(snapshot) });
  });
  return { get puts() { return puts; }, get reads() { return reads; }, get revision() { return snapshot.revision; } };
}

for (const behavior of ["conflict", "unknown", "read-error"] as const) {
  test(`verified account ${behavior} keeps browser storage separate and requires confirmation`, async ({ page }) => {
    const account = await accountRoute(page, behavior);
    await page.goto("/?experience=e2&view=classic&storage=account");
    await expect(page.getByTestId("storage-label")).toContainText("계정 공간");
    if (behavior === "read-error") {
      await expect(page.getByTestId("save-status")).toContainText("꾸미기 저장소에 연결할 수 없어요");
      await page.getByRole("button", { name: "저장된 상태 확인" }).click();
    }
    await (await editorButton(page, "환영 바람개비 고르기")).click();
    await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
    if (behavior === "conflict") {
      await expect(page.getByTestId("save-status")).toContainText("더 최근에 저장된 꾸미기");
      expect(account.puts).toBe(1);
      await page.getByRole("button", { name: "미리보기를 유지하고 최근 저장 상태 사용" }).click(); await confirm(page);
    }
    await expect(page.getByTestId("save-status")).toContainText("계정 공간에 저장했어요.");
    expect(account.puts).toBe(behavior === "conflict" ? 2 : 1);
    if (behavior === "unknown") expect(account.reads).toBe(2);
    expect(await readLocal(page)).toBeNull();
  });
}


// The new experience uses this existing suite, which nightly-core already runs.
// These API/session fixtures prove client behavior, not live account integration.
async function classicTodaySession(page: Page, actionId: string | null = null, snapshot = emptySnapshot()) {
  const account = await accountRoute(page, "normal", true, snapshot);
  await page.route("http://e2e.invalid/api/v1/observations/window**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: route.request().method() === "OPTIONS" ? 204 : 200,
      headers: cors, contentType: "application/json", body: JSON.stringify({
        start_on: url.searchParams.get("start_on"), end_on: url.searchParams.get("end_on"),
        blood_pressure_observations: [{ id: "synthetic-existing", observed_on: url.searchParams.get("end_on"),
          period: "morning", systolic: 118, diastolic: 76 }],
        challenge_events: [], active_challenge: actionId ? {
          id: "synthetic-choice", action_id: actionId, starts_on: url.searchParams.get("end_on"),
          ends_on: "2099-12-31", first_checkin_on: null, status: "active",
        } : null, challenge_checkins: [],
      }) });
  });
  return account;
}

for (const [index, choice] of ["walk-10-minutes", "sleep-routine", "low-sodium-meal"].entries()) {
  test(`Living Choice ${choice}: explicit Today handoff, same visit, independent placement and return`, async ({ page }) => {
    const account = await classicTodaySession(page, choice);
    const mode = index === 1 ? "account" : "browser";
    await page.goto(`/?screen=S02&return_space=3d-${mode}`); await expectClassicToday(page);
    const bring = page.getByRole("link", { name: "이 선택을 내 공간에 가져가기" });
    await expect(bring).toHaveAttribute("href", `?experience=e2&view=3d&storage=${mode}&living_choice=${choice}`);
    expect(account.puts).toBe(0); expect(await readLocal(page)).toBeNull();
    // Keyboard and pointer both use the same explicit link, not automatic entry.
    if (index === 0) { await bring.focus(); await page.keyboard.press("Enter"); } else await bring.click();
    const world = page.getByTestId("placeable-world");
    await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
    await expect(world).toHaveAttribute("data-choice", choice);
    await expect(page.getByTestId("confirmed-placement")).toHaveText("저장 상태: 바람개비 없음");
    await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
    await (await editorButton(page, "입구 오른쪽", true)).click();
    await (await editorButton(page, "청록", true)).click(); await confirm(page);
    const stored = await readLocal(page), writes = account.puts;
    await page.reload(); await expect(world).toHaveAttribute("data-choice", choice);
    await expect(world).toHaveAttribute("data-color", "teal");
    await expect(world).toHaveAttribute("data-socket", "gate-right");
    await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
    await expect(page.getByTestId("classic-living-choice")).toHaveAttribute("data-choice", choice);
    await page.getByRole("link", { name: "오늘의 기록으로 가기" }).click(); await expectClassicToday(page);
    await page.getByRole("link", { name: "내 공간으로 돌아가기" }).click();
    await expect(page.getByTestId("classic-living-choice")).toHaveCount(0);
    await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "teal");
    expect(await readLocal(page)).toEqual(stored); expect(account.puts).toBe(writes);
    expect(JSON.stringify(stored)).not.toContain("living_choice");
    await (await editorButton(page, "바람개비 치우기")).click(); await confirm(page);
    await expect(page.getByTestId("confirmed-placement")).toHaveText("저장 상태: 바람개비 없음");
  });
}

test("no active choice and forged hints preserve the default plaza on direct entry and refresh", async ({ page }) => {
  await classicTodaySession(page);
  await page.goto("/?screen=S02&return_space=3d-browser"); await expectClassicToday(page);
  await expect(page.getByRole("link", { name: "이 선택을 내 공간에 가져가기" })).toHaveCount(0);
  await page.getByRole("link", { name: "내 공간으로 돌아가기" }).click();
  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute("data-choice", "none");
  await page.reload(); await expect(world).toHaveAttribute("data-choice", "none");
  for (const hint of ["completed", "https://evil.invalid", "walk-10-minutes&living_choice=sleep-routine"]) {
    await page.goto(`/?experience=e2&view=3d&storage=browser&living_choice=${hint}`);
    await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
    await expect(world).toHaveAttribute("data-choice", "none");
    await expect(page.locator(".placeable-stage .placeable-choice-note")).toHaveCount(0);
    await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
    expect(await readLocal(page)).toBeNull();
  }
});

test("Living Choice with WebGL failure retains Classic controls and Today", async ({ page }) => {
  await classicTodaySession(page, "sleep-routine");
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      return type.startsWith("webgl") ? null : Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/?screen=S02"); await expectClassicToday(page);
  await page.getByRole("link", { name: "이 선택을 내 공간에 가져가기" }).click();
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await expect(page.getByTestId("classic-living-choice")).toHaveAttribute("data-choice", "sleep-routine");
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  await page.getByRole("link", { name: "오늘의 기록으로 가기" }).click(); await expectClassicToday(page);
  await page.getByRole("link", { name: "내 공간으로 돌아가기" }).click();
  await expect(page.getByTestId("classic-pinwheel")).toBeVisible();
});

test("touch and reduced motion retain the still choice, walk pad and placement controls", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await classicTodaySession(page, "low-sodium-meal");
    await page.goto("/?screen=S02"); await expectClassicToday(page);
    await page.getByRole("link", { name: "이 선택을 내 공간에 가져가기" }).tap();
    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute("data-choice", "low-sodium-meal");
    await expect(world).toHaveAttribute("data-reduced-motion", "true");
    const pad = page.getByRole("button", { name: "드래그하거나 방향키로 광장 걷기" });
    await pad.tap(); await expect(world).toHaveAttribute("data-suspended", "false");
    const cdp = await context.newCDPSession(page), box = (await pad.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x + 15, y: point.y - 15 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await (await editorButton(page, "환영 바람개비 고르기")).tap();
    await page.getByRole("button", { name: "배치 확정하기", exact: true }).tap();
    await expect(page.getByTestId("save-status")).toContainText("저장했어요");
    await (await worldTool(page, "바람개비 돌리기", true)).tap();
    await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
    await expect(world).toHaveAttribute("data-choice", "low-sodium-meal");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await context.close(); }
});

async function expectClassicToday(page: Page) {
  await expect(page.locator('[data-scene="S01"], [data-scene="S02"]')).toBeVisible();
  // App's existing E2E mode intentionally ignores SDK sessions. Bind its
  // explicit synthetic-session hook; E2 still performs its own verification.
  await page.evaluate(() => {
    const raw = localStorage.getItem("sb-e2e-auth-token");
    if (raw) window.dispatchEvent(new CustomEvent("sk7:e2e-session-change", { detail: JSON.parse(raw) }));
  });
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
}

for (const mode of ["browser", "account"] as const) {
  test(`${mode} confirmed 3D placement completes keyboard Today round trip without changing storage`, async ({ page }) => {
    const account = await classicTodaySession(page);
    await page.goto(`/?experience=e2&view=3d&storage=${mode}`);
    await (await editorButton(page, "환영 바람개비 고르기")).click();
    await (await editorButton(page, "청록", true)).click();
    await (await editorButton(page, "입구 오른쪽", true)).click();
    await expect(page.getByRole("link", { name: "오늘의 기록으로 가기" })).toHaveAttribute("aria-disabled", "true");
    await confirm(page);
    const local = await readLocal(page), writes = account.puts, reads = account.reads;
    await page.getByRole("link", { name: "오늘의 기록으로 가기" }).focus(); await page.keyboard.press("Enter");
    await expectClassicToday(page);
    await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
    const back = page.getByRole("link", { name: "내 공간으로 돌아가기" });
    await expect(back).toHaveAttribute("href", `?experience=e2&view=3d&storage=${mode}`);
    await back.focus(); await page.keyboard.press("Enter");
    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute("data-color", "teal");
    await expect(world).toHaveAttribute("data-socket", "gate-right");
    await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-mode", mode);
    expect(await readLocal(page)).toEqual(local); expect(account.puts).toBe(writes);
    expect(account.reads).toBe(mode === "account" ? reads + 1 : 0);
    await (await worldTool(page, "바람개비 돌리기", true)).click();
    await expect(page.getByTestId("placeable-feedback")).toContainText("바람개비가 돌아가요");
    await (await editorButton(page, "광장 가장자리", true)).click();
    await (await editorButton(page, "코랄", true)).click(); await confirm(page);
    await expect(world).toHaveAttribute("data-socket", "plaza-edge");
    await expect(world).toHaveAttribute("data-color", "coral");
    await (await editorButton(page, "바람개비 치우기")).click(); await confirm(page);
    await expect(world).toHaveAttribute("data-color", "unplaced");
  });
}

test("WebGL failure retains Classic fallback and its Today return path", async ({ page }) => {
  await classicTodaySession(page);
  await page.goto(browserRoute);
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  const local = await readLocal(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.getByRole("link", { name: "3D 광장으로 보기" }).click();
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await page.getByRole("link", { name: "오늘의 기록으로 가기" }).click();
  await expectClassicToday(page);
  await page.getByRole("link", { name: "내 공간으로 돌아가기" }).click();
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "coral");
  expect(await readLocal(page)).toEqual(local);
});

test("signed-out Today keeps a semantic return; an account return never falls back to browser", async ({ page }) => {
  await page.goto(browserRoute);
  await page.getByRole("link", { name: "오늘의 기록으로 가기" }).click();
  await expect(page.getByRole("link", { name: "내 공간으로 돌아가기" })).toBeVisible();
  await page.getByRole("link", { name: "내 공간으로 돌아가기" }).click();
  await expect(page.getByTestId("confirmed-placement")).toHaveText("저장 상태: 바람개비 없음");
  await page.goto("/?screen=S02&return_space=3d-account");
  await page.getByRole("link", { name: "내 공간으로 돌아가기" }).click();
  await expect(page.getByRole("status")).toContainText("계정 공간을 이용하려면 다시 로그인해 주세요");
  await expect(page.getByTestId("placeable-experience")).toHaveCount(0);
  expect(await readLocal(page)).toBeNull();
});

test.describe("touch return", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("touch Classic round trip stays muted, reduced-motion and usable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await classicTodaySession(page);
    await page.goto(browserRoute);
    await (await editorButton(page, "환영 바람개비 고르기")).tap();
    await page.getByRole("button", { name: "배치 확정하기", exact: true }).tap();
    await expect(page.getByTestId("save-status")).toContainText("저장했어요");
    const local = await readLocal(page);
    await page.getByRole("link", { name: "오늘의 기록으로 가기" }).tap();
    await expectClassicToday(page);
    await page.getByRole("link", { name: "내 공간으로 돌아가기" }).tap();
    await (await worldTool(page, "바람개비 돌리기", true)).tap();
    await expect(page.getByTestId("audio-status")).toHaveText("소리: 꺼짐");
    await expect(page.locator(".pinwheel-spin")).toHaveCSS("animation-name", "none");
    expect(await readLocal(page)).toEqual(local);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});


test("Today return is absent while editing a record and survives the existing in-app back path", async ({ page }) => {
  await classicTodaySession(page);
  await page.goto("/?screen=S02&return_space=classic-browser");
  await expectClassicToday(page);
  await expect(page.getByRole("link", { name: "내 공간으로 돌아가기" })).toBeVisible();
  await page.locator('button[data-home-destination="S04"]').click();
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "내 공간으로 돌아가기" })).toHaveCount(0);
  await page.getByRole("button", { name: "SK7 · 하루의 사실을 차분하게 · 오늘의 기록으로 이동", exact: true }).click();
  await expect(page.getByRole("link", { name: "내 공간으로 돌아가기" })).toBeVisible();
});

test("UNKNOWN cannot announce a breeze or hand off an unresolved write", async ({ page }) => {
  await accountRoute(page, "normal");
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (route.request().method() === "PUT") return route.abort("failed");
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(emptySnapshot()) });
  });
  await page.goto("/?experience=e2&view=classic&storage=account");
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "unknown");
  await expect(page.getByTestId("save-status")).not.toContainText("저장했어요");
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기" })).toHaveAttribute("aria-disabled", "true");
  await expect((await worldTool(page, "바람개비 돌리기", true))).toBeDisabled();
  await expect(page.getByTestId("placeable-feedback")).not.toContainText("바람개비가 돌아가요");
  await expect(page.getByRole("button", { name: "저장된 상태 확인" })).toBeEnabled();
});

const keepsakeCases = [
  ["walk-10-minutes", "plaza-ribbon-v1", "광장의 리본"],
  ["sleep-routine", "quiet-moon-v1", "고요한 달"],
  ["low-sodium-meal", "garden-leaf-v1", "정원의 잎"],
] as const;
for (const [choice, asset, label] of keepsakeCases) {
  test(`E4 ${asset}: keep migrates v1, restores without hint, coexists and removes`, async ({ page }) => {
    await page.goto(`${browserRoute}&living_choice=${choice}`);
    await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
    const v1 = await readLocal(page); expect(v1.schemaVersion).toBe("placeable.v1");
    await (await editorButton(page, "이 문양을 내 공간에 남기기")).focus(); await page.keyboard.press("Enter");
    await expect(page.getByTestId("keepsake-preview")).toContainText(label); expect(await readLocal(page)).toEqual(v1);
    await page.getByRole("button", { name: "배치 확정하기", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByTestId("save-status")).toContainText("저장했어요");
    const stored = await readLocal(page);
    expect(stored).toMatchObject({ revision: 2, schemaVersion: "placeable.v2", selection: { pinwheel: v1.selection, keepsake: asset } });
    expect(JSON.stringify(stored)).not.toContain(choice);
    await page.getByRole("link", { name: "오늘의 기록", exact: true }).click(); await page.goto(browserRoute); await page.reload();
    await expect(page.getByTestId("classic-keepsake")).toHaveAttribute("data-asset", asset);
    await expect(page.getByTestId("classic-pinwheel")).toBeVisible();
    await expect(page.getByTestId("confirmed-keepsake")).toHaveText(label);
    await (await editorButton(page, "남긴 문양 제거")).click(); expect(await readLocal(page)).toEqual(stored);
    await confirm(page); await page.reload();
    await expect(page.getByTestId("classic-keepsake")).toHaveCount(0);
    await expect(page.getByTestId("classic-pinwheel")).toBeVisible();
    expect((await readLocal(page)).selection).toEqual({ pinwheel: v1.selection, keepsake: null });
  });
}
test("E4 replacement and WebGL failure retain keepsake with Classic removal", async ({ page }) => {
  await page.goto(`${browserRoute}&living_choice=walk-10-minutes`);
  await (await editorButton(page, "이 문양을 내 공간에 남기기")).click(); await confirm(page);
  await page.goto(`${browserRoute}&living_choice=sleep-routine`);
  await expect(page.getByTestId("classic-keepsake")).toHaveAttribute("data-asset", "plaza-ribbon-v1");
  await (await editorButton(page, "이 문양으로 바꾸기")).click();
  await expect(page.getByTestId("classic-keepsake")).toHaveAttribute("data-asset", "quiet-moon-v1"); await confirm(page);
  await page.getByRole("link", { name: "3D 광장으로 보기" }).click();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-keepsake", "quiet-moon-v1");
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle");
  await page.screenshot({ path: test.info().outputPath("903-keepsake-only.png"), scale: "css" });
  const canvas = page.getByTestId("placeable-world-canvas"); await expect(canvas).toBeVisible(); const before = await readLocal(page);
  await canvas.evaluate((element) => (element as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await expect(page.getByTestId("confirmed-keepsake")).toHaveText("고요한 달"); expect(await readLocal(page)).toEqual(before);
  await (await editorButton(page, "남긴 문양 제거")).click(); await confirm(page);
  expect((await readLocal(page)).selection.keepsake).toBeNull();
});
for (const behavior of ["normal", "conflict", "unknown"] as const) {
  test(`E4 account ${behavior}: keep/reload stays separate from browser snapshot`, async ({ page }) => {
    const account = await accountRoute(page, behavior);
    await page.goto(`${browserRoute}&living_choice=walk-10-minutes`);
    await (await editorButton(page, "이 문양을 내 공간에 남기기")).click(); await confirm(page); const local = await readLocal(page);
    await page.goto("/?experience=e2&view=classic&storage=account&living_choice=sleep-routine");
    await (await editorButton(page, "이 문양을 내 공간에 남기기")).click();
    await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
    if (behavior === "conflict") {
      await expect(page.getByTestId("save-status")).toContainText("더 최근에 저장된 꾸미기");
      await page.getByRole("button", { name: "미리보기를 유지하고 최근 저장 상태 사용" }).click(); await confirm(page);
    } else await expect(page.getByTestId("save-status")).toContainText("계정 공간에 저장했어요");
    await page.reload(); await expect(page.getByTestId("confirmed-keepsake")).toHaveText("고요한 달");
    expect(await readLocal(page)).toEqual(local); expect(account.puts).toBe(behavior === "conflict" ? 2 : 1);
  });
}
test("E4 touch and reduced motion: keep/remove stays muted and fits narrow screen", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(`${browserRoute}&living_choice=low-sodium-meal`);
    await (await editorButton(page, "이 문양을 내 공간에 남기기")).tap();
    await page.getByRole("button", { name: "배치 확정하기", exact: true }).tap();
    await expect(page.getByTestId("confirmed-keepsake")).toHaveText("정원의 잎");
    await expect(page.getByTestId("audio-status")).toHaveText("소리: 꺼짐");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await (await editorButton(page, "남긴 문양 제거")).tap(); await page.getByRole("button", { name: "배치 확정하기", exact: true }).tap();
    await expect(page.getByTestId("confirmed-keepsake")).toHaveText("아직 남긴 문양이 없어요.");
  } finally { await context.close(); }
});

// E6 stays in the existing scheduled/manual placeable surface; no new visual CI.
test("E6 explicit keyboard/pointer welcome is reversible, visit-local and makes zero storage writes", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(companionRoute + "&living_choice=sleep-routine");
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  await (await editorButton(page, "이 문양을 내 공간에 남기기")).click(); await confirm(page);
  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute("data-companion-pose", "idle", { timeout: 15000 });
  const before = await readLocal(page), status = await page.getByTestId("save-status").textContent();
  const writes: string[] = [];
  page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url()); });
  await page.evaluate(() => {
    Object.assign(window, { e6Writes: 0 }); const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      (window as unknown as { e6Writes: number }).e6Writes++; original.call(this, key, value);
    };
  });
  await expect(world).toHaveAttribute("data-lighting", "daylight");
  await page.getByTestId("placeable-world-canvas").screenshot({ path: test.info().outputPath("e6-daylight-desktop.png") });
  const light = (await worldTool(page, "광장의 불빛 켜기"));
  await light.focus(); await page.keyboard.press("Enter");
  await expect(world).toHaveAttribute("data-companion-pose", "greet");
  await expect(world).toHaveAttribute("data-welcome-phase", "twilight");
  await expect(page.getByTestId("audio-status")).toHaveText("소리: 꺼짐");
  await expect(world).toHaveAttribute("data-keepsake", "quiet-moon-v1");
  await expect(world).toHaveAttribute("data-color", "coral");
  await page.getByTestId("placeable-world-canvas").screenshot({ path: test.info().outputPath("e6-twilight-desktop.png") });
  await (await worldTool(page, "낮의 광장으로 돌아가기")).click();
  await expect(world).toHaveAttribute("data-lighting", "daylight");
  await light.focus(); await page.keyboard.press("Space");
  await expect(world).toHaveAttribute("data-welcome-phase", "twilight");
  expect(await readLocal(page)).toEqual(before); expect(writes).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { e6Writes: number }).e6Writes)).toBe(0);
  await expect(page.getByTestId("save-status")).toHaveText(status!);
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await expect(page.getByTestId("classic-keepsake")).toBeVisible();
  await page.getByRole("link", { name: "3D 광장으로 보기" }).click();
  await expect(world).toHaveAttribute("data-lighting", "daylight");
  await expect(world).toHaveAttribute("data-welcome-phase", "daylight");
  expect(await readLocal(page)).toEqual(before);
});

test("E6 mobile touch and live reduced motion retain the final hierarchy without choreography", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(companionRoute + "&living_choice=walk-10-minutes");
    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute("data-companion-pose", "neutral", { timeout: 15000 });
    await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
    const before = await readLocal(page);
    await (await worldTool(page, "광장의 불빛 켜기")).tap();
    await expect(world).toHaveAttribute("data-welcome-phase", "twilight");
    await expect(world).toHaveAttribute("data-companion-pose", "neutral");
    await expect(page.getByTestId("companion-response")).toContainText("인사를 나눴어요");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByTestId("placeable-world-canvas").screenshot({ path: test.info().outputPath(`e6-twilight-mobile-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect((await worldTool(page, "낮의 광장으로 돌아가기"))).toBeVisible();
    }
    await (await worldTool(page, "낮의 광장으로 돌아가기")).tap();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await (await worldTool(page, "광장의 불빛 켜기")).tap();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(world).toHaveAttribute("data-welcome-phase", "twilight");
    await expect(world).toHaveAttribute("data-companion-pose", "neutral");
    expect(await readLocal(page)).toEqual(before);
  } finally { await context.close(); }
});

test("#919 latest audio enable attempt owns the UI status and hidden-page mute cannot be replayed", async ({ page }) => {
  await page.addInitScript(() => {
    const pending: Array<{ resolve: () => void; reject: () => void }> = [];

    class DeferredAudioContext {
      state = "suspended";
      currentTime = 0;
      destination = {};
      resume = () => new Promise<void>((resolve, reject) => {
        pending.push({
          resolve: () => {
            if (this.state !== "closed") this.state = "running";
            resolve();
          },
          reject: () => reject(new Error("stale audio enable")),
        });
      });
      close = async () => { this.state = "closed"; };
      createGain = () => ({
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      });
      createOscillator = () => ({
        frequency: { value: 0 },
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
        onended: null,
      });
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: DeferredAudioContext,
    });

    Object.assign(window, {
      audioResumeCount: () => pending.length,
      resolveAudioResume: (index: number) => pending[index]?.resolve(),
      rejectAudioResume: (index: number) => pending[index]?.reject(),
    });
  });

  await page.goto(companionRoute);

  const sound = await editorButton(page, "소리 켜기");
  await sound.click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { audioResumeCount: () => number }).audioResumeCount())).toBe(1);

  // The UI is still muted while resume is pending, so a second deliberate click
  // starts a newer enable attempt.
  await sound.click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { audioResumeCount: () => number }).audioResumeCount())).toBe(2);

  // Newer enable succeeds first.
  await page.evaluate(() =>
    (window as unknown as { resolveAudioResume: (index: number) => void }).resolveAudioResume(1));
  await expect(page.getByTestId("audio-status")).toHaveText("소리: 켜짐");

  // Older failure arrives later and must not replace ready or close its context.
  await page.evaluate(() =>
    (window as unknown as { rejectAudioResume: (index: number) => void }).rejectAudioResume(0));
  await expect(page.getByTestId("audio-status")).toHaveText("소리: 켜짐");

  await (await editorButton(page, "소리 끄기")).click();
  await expect(page.getByTestId("audio-status")).toHaveText("소리: 꺼짐");

  // Start another enable, then hide the page before it resolves.
  await (await editorButton(page, "소리 켜기")).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { audioResumeCount: () => number }).audioResumeCount())).toBe(3);

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("audio-status")).toHaveText("소리: 꺼짐");

  await page.evaluate(() =>
    (window as unknown as { resolveAudioResume: (index: number) => void }).resolveAudioResume(2));
  await expect(page.getByTestId("audio-status")).toHaveText("소리: 꺼짐");
});

test("E6 enabled audio plays one short motif per activation; muted and unavailable stay visual", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { e6Tones: 0 });
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      (window as unknown as { e6Tones: number }).e6Tones++; start.apply(this, args);
    };
  });
  await page.goto(companionRoute);
  const light = (await worldTool(page, "광장의 불빛 켜기"));
  const day = page.getByRole("button", { name: "낮의 광장으로 돌아가기" });
  await light.click(); await day.click();
  expect(await page.evaluate(() => (window as unknown as { e6Tones: number }).e6Tones)).toBe(0);
  await (await editorButton(page, "소리 켜기")).click();
  await expect(page.getByTestId("audio-status")).toHaveText("소리: 켜짐");
  await light.click();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-welcome-phase", "twilight");
  expect(await page.evaluate(() => (window as unknown as { e6Tones: number }).e6Tones)).toBe(3);
  await (await editorButton(page, "소리 끄기")).click(); await day.click(); await light.click();
  expect(await page.evaluate(() => (window as unknown as { e6Tones: number }).e6Tones)).toBe(3);
  await page.reload();
  await page.evaluate(() => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: undefined });
  });
  await (await editorButton(page, "소리 켜기")).click();
  await expect(page.getByTestId("audio-status")).toContainText("사용할 수 없음"); await (await worldTool(page, "광장의 불빛 켜기")).click();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-welcome-phase", "twilight");
});

for (const behavior of ["normal", "unknown", "conflict"] as const) test(`E6 account ${behavior} preserves revisions and truthful save status`, async ({ page }) => {
  const account = await accountRoute(page, behavior, false);
  await page.goto("/?experience=e2&view=3d&storage=account");
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", behavior === "normal" ? "ready" : behavior);
  const writes = account.puts, reads = account.reads, revision = account.revision, browser = await readLocal(page);
  const status = await page.getByTestId("save-status").textContent();
  await (await worldTool(page, "광장의 불빛 켜기")).click();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-welcome-phase", "twilight");
  await (await worldTool(page, "낮의 광장으로 돌아가기")).click();
  expect(account.puts).toBe(writes); expect(account.reads).toBe(reads); expect(await readLocal(page)).toEqual(browser);
  expect(account.revision).toBe(revision);
  await expect(page.getByTestId("save-status")).toHaveText(status!);
  if (behavior !== "normal") {
    await expect(page.getByTestId("save-status")).not.toContainText("저장했어요");
    await expect(page.getByTestId("draft-placement")).toBeVisible();
  }
});

test("E6 companion and WebGL failures stay independent; interrupted welcome cannot leak into retry", async ({ page }) => {
  await page.route("**/companion/v1/**", (route) => route.abort("failed"));
  await page.goto(companionRoute);
  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute("data-companion-pose", "unavailable");
  await (await worldTool(page, "광장의 불빛 켜기")).click();
  await expect(world).toHaveAttribute("data-welcome-phase", "twilight");
  await expect(page.getByRole("link", { name: /오늘의 기록으로 가기/ })).toHaveAttribute("aria-disabled", "false");
  await (await worldTool(page, "낮의 광장으로 돌아가기")).click();
  await (await worldTool(page, "광장의 불빛 켜기")).click();
  await page.getByTestId("placeable-world-canvas").evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext("webgl2")!; gl.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await expect(page.getByTestId("twilight-status")).toContainText("간단한 광장");
  await page.getByRole("button", { name: "3D 다시 열기" }).click();
  await expect(world).toHaveAttribute("data-lighting", "daylight");
  await expect(world).toHaveAttribute("data-welcome-phase", "daylight");
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await expect(page.getByTestId("classic-pinwheel")).toBeVisible();
});

// E7 inherits nightly/manual core discovery through this existing spec; no new CI gate.
const enterGarden = async (page: Page) => (await worldTool(page, "정원 쉼터로 가기"));
const returnGarden = (page: Page) => page.getByRole("button", { name: "광장으로 돌아가기" });
const gardenRest = (page: Page) => page.getByRole("button", { name: "여기서 잠깐 쉬기" });
async function gardenCompanionPoint(page: Page) {
  const canvas = page.getByTestId("garden-canvas"); await canvas.scrollIntoViewIfNeeded();
  const rect = (await canvas.boundingBox())!, scene = new GardenScene(); scene.resize(rect.width / rect.height); scene.approach();
  const point = new Vector3(0, 0.65, 0.4).project(scene.camera); scene.dispose();
  return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
}

async function expectImmersiveGarden(page: Page) {
  const canvas = page.getByTestId("garden-canvas");
  await expect.poll(async () => canvas.evaluate((element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.width - innerWidth) < 2 && Math.abs(rect.height - innerHeight) < 2;
  })).toBe(true);
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.width * element.height)).toBeLessThanOrEqual(2_000_000);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  for (const control of [returnGarden(page), page.getByRole("link", { name: "오늘의 기록으로 가기" }),
    page.getByRole("button", { name: "정자 앞으로 이동하기" }), gardenRest(page)]) {
    await expect(control).toBeInViewport();
  }
}

test("E7 desktop explicit entry, actual keyboard walking, pointer rest and return preserve browser cosmetics without writes", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("sk7-companion-species", "rabbit"));
  await page.goto(companionRoute + "&living_choice=sleep-routine");
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  await (await editorButton(page, "이 문양을 내 공간에 남기기")).click(); await confirm(page);
  const before = await readLocal(page);
  await page.evaluate(() => {
    Object.assign(window, { e7Writes: 0 }); const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { (window as unknown as { e7Writes: number }).e7Writes++; original.call(this, key, value); };
  });
  page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) requests.push(request.url()); });
  await (await enterGarden(page)).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /정원 쉼터/ })).toBeFocused();
  await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
  const garden = page.getByTestId("garden-nook"), canvas = page.getByTestId("garden-canvas");
  await expect(garden).toHaveAttribute("data-companion", "rabbit");
  await expect(garden).toHaveAttribute("data-companion-pose", "idle", { timeout: 15000 });
  await expect(gardenRest(page)).toBeDisabled();
  await expectImmersiveGarden(page);
  await canvas.focus(); await page.keyboard.down("ArrowRight"); await page.waitForTimeout(400); await page.keyboard.up("ArrowRight");
  await page.keyboard.down("ArrowUp"); await expect(garden).toHaveAttribute("data-at-pavilion", "true"); await page.keyboard.up("ArrowUp");
  await page.keyboard.press("Enter"); await expect(garden).toHaveAttribute("data-companion-pose", "rest");
  await expect(garden).toHaveAttribute("data-companion-pose", "idle", { timeout: 6000 });
  // Recenter by walking away and taking the accessible approach, then hit the actual GLB.
  await canvas.focus(); await page.keyboard.down("ArrowDown"); await expect(garden).toHaveAttribute("data-at-pavilion", "false"); await page.keyboard.up("ArrowDown");
  await page.getByRole("button", { name: "정자 앞으로 이동하기" }).click();
  const point = await gardenCompanionPoint(page); await page.mouse.click(point.x, point.y);
  await expect(garden).toHaveAttribute("data-companion-pose", "rest");
  await expect(garden).toHaveAttribute("data-companion-pose", "idle", { timeout: 6000 });
  await page.screenshot({ path: test.info().outputPath("e7-garden-desktop.png") });
  await returnGarden(page).click(); await expect(await enterGarden(page)).toBeFocused();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-keepsake", "quiet-moon-v1");
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-color", "coral");
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-choice", "sleep-routine");
  expect(await readLocal(page)).toEqual(before); expect(requests).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { e7Writes: number }).e7Writes)).toBe(0);
});

test("E7 mobile touch walking, rest, live reduced motion, 320px framing and semantic return", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(companionRoute); await (await enterGarden(page)).tap();
    const garden = page.getByTestId("garden-nook");
    await expect(garden).toHaveAttribute("data-companion-pose", "neutral", { timeout: 15000 });
    const pad = page.getByRole("button", { name: "정원에서 드래그하거나 방향키로 걷기" });
    const rect = (await pad.boundingBox())!;
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: rect.x + rect.width * 0.7, y: rect.y + 1 }] });
    await expect(garden).toHaveAttribute("data-at-pavilion", "true");
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await gardenRest(page).tap(); await expect(page.getByTestId("garden-response")).toContainText("잠깐 쉬었어요");
    await expect(garden).toHaveAttribute("data-companion-pose", "neutral");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expectImmersiveGarden(page);
      await page.screenshot({ path: test.info().outputPath(`e7-garden-mobile-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(returnGarden(page)).toBeVisible();
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await gardenRest(page).tap(); await expect(garden).toHaveAttribute("data-companion-pose", "rest");
    await page.emulateMedia({ reducedMotion: "reduce" }); await expect(garden).toHaveAttribute("data-companion-pose", "neutral");
    await returnGarden(page).tap(); expect(await readLocal(page)).toBeNull();
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-reduced-motion", "true");
  } finally { await context.close(); }
});

for (const behavior of ["normal", "unknown", "conflict"] as const) test(`E7 account ${behavior} retains revision, browser separation and pending guard`, async ({ page }) => {
  const account = await accountRoute(page, behavior, false);
  await page.goto("/?experience=e2&view=classic&storage=account&living_choice=walk-10-minutes");
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await expect(await enterGarden(page)).toBeDisabled();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", behavior === "normal" ? "ready" : behavior);
  if (behavior === "normal") { await (await editorButton(page, "이 문양을 내 공간에 남기기")).click(); await confirm(page); }
  const writes = account.puts, reads = account.reads, revision = account.revision, before = await readLocal(page);
  if (behavior === "normal") {
    await (await enterGarden(page)).click(); await expect(page.getByTestId("garden-canvas")).toBeVisible();
    await returnGarden(page).click();
    await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "coral");
    await expect(page.getByTestId("classic-keepsake")).toHaveAttribute("data-asset", "plaza-ribbon-v1");
  } else await expect(await enterGarden(page)).toBeDisabled();
  expect(account.puts).toBe(writes); expect(account.reads).toBe(reads); expect(account.revision).toBe(revision);
  expect(await readLocal(page)).toEqual(before);
});

test("E7 companion failure and real context loss isolate the garden, retry and return without persistence error", async ({ page }) => {
  await page.route("**/companion/v1/**", (route) => route.abort("failed"));
  await page.goto(companionRoute); await (await enterGarden(page)).click();
  const garden = page.getByTestId("garden-nook"), canvas = page.getByTestId("garden-canvas");
  await expect(garden).toHaveAttribute("data-companion-pose", "unavailable");
  await expect(canvas).toBeVisible(); await expect(gardenRest(page)).toBeDisabled();
  await page.getByRole("button", { name: "정자 앞으로 이동하기" }).click();
  await expect(garden).toHaveAttribute("data-at-pavilion", "true");
  await canvas.evaluate((canvas: HTMLCanvasElement) => canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
  await expect(page.getByRole("alert")).toContainText("정원 쉼터를 열지 못했어요"); await expect(canvas).toHaveCount(0);
  await expect(returnGarden(page)).toBeEnabled(); await expect(page.getByRole("link", { name: "오늘의 기록으로 가기" })).toHaveAttribute("href", "?screen=S02&return_space=3d-browser");
  await page.getByRole("button", { name: "정원 다시 열기" }).click(); await expect(canvas).toBeVisible();
  await expect(garden).toHaveAttribute("data-at-pavilion", "false");
  await returnGarden(page).click(); await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  expect(await readLocal(page)).toBeNull();
});

test("E7 repeated scene teardown leaves one renderer, one RAF and no stale rest", async ({ page }) => {
  await page.addInitScript(() => {
    const pending = new Set<number>(), request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    Object.assign(window, { e7Rafs: pending });
    window.requestAnimationFrame = (callback) => {
      const id = request.call(window, (time) => { pending.delete(id); callback(time); }); pending.add(id); return id;
    };
    window.cancelAnimationFrame = (id) => { pending.delete(id); cancel.call(window, id); };
  });
  await page.goto(companionRoute);
  for (let visit = 0; visit < 3; visit++) {
    await (await enterGarden(page)).click(); await expect(page.getByTestId("garden-canvas")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    if (visit === 1) {
      await expect(page.getByTestId("garden-nook")).toHaveAttribute("data-companion-pose", "idle", { timeout: 15000 });
      await page.getByRole("button", { name: "정자 앞으로 이동하기" }).click(); await gardenRest(page).click();
    }
    await returnGarden(page).click(); await expect(page.getByTestId("garden-canvas")).toHaveCount(0);
    await expect(page.getByTestId("placeable-world-canvas")).toBeVisible(); await expect(page.locator("canvas")).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { e7Rafs: Set<number> }).e7Rafs.size)).toBe(1);
  }
  await (await enterGarden(page)).click(); await expect(page.getByTestId("garden-nook")).toHaveAttribute("data-companion-pose", "idle", { timeout: 15000 });
  await expect(page.getByTestId("garden-nook")).toHaveAttribute("data-at-pavilion", "false");
  expect(await readLocal(page)).toBeNull();
});

test("E7 lazy chunk and renderer startup failure keep independent semantic exits", async ({ page }) => {
  const chunks: string[] = [];
  page.on("request", (request) => { if (/GardenNook-.*\.js/.test(request.url())) chunks.push(request.url()); });
  await page.goto(browserRoute);
  await expect(await enterGarden(page)).toBeVisible(); expect(chunks).toEqual([]);
  await page.route("**/GardenNook-*.js", (route) => route.abort("failed"));
  await (await enterGarden(page)).click(); await expect(page.getByRole("alert")).toContainText("정원 쉼터를 열지 못했어요");
  expect(await page.evaluate(() => sessionStorage.getItem("sk7:vite-preload-recovery-at"))).toBeNull();
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기" })).toHaveAttribute("href", "?screen=S02&return_space=classic-browser");
  await returnGarden(page).click(); await expect(page.getByTestId("classic-plaza")).toBeVisible();
  await page.unroute("**/GardenNook-*.js"); await page.reload();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      return kind === "webgl2" ? null : original.call(this, kind, ...args);
    } as typeof original;
  });
  await (await enterGarden(page)).click(); await expect(page.getByRole("alert")).toContainText("정원 쉼터를 열지 못했어요");
  await returnGarden(page).click(); await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  expect(await readLocal(page)).toBeNull();
  // Outside this optional visit, the existing one-shot stale-bundle recovery still owns errors.
  await Promise.all([page.waitForEvent("framenavigated"), page.evaluate(() => {
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
  })]);
  expect(await page.evaluate(() => sessionStorage.getItem("sk7:vite-preload-recovery-at"))).not.toBeNull();
});


// E8 stays in the existing nightly/manual core suite. Synthetic API/SDK fixtures
// exercise the real entry/controller/renderers; they are not production proof.
for (const mobile of [false, true]) test(`E8 ${mobile ? "mobile touch" : "desktop keyboard"}: ordinary Today enters verified account space and returns without writes`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 }, hasTouch: mobile, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    const snapshot = await saved({ operationId: "00000000-0000-4000-8000-000000000824", expectedRevision: 4,
      schemaVersion: "placeable.v2", layoutId: "e1-plaza.v2",
      selection: { pinwheel: { assetId: "welcome-pinwheel-v1", color: "teal", socketId: "gate-right" }, keepsake: "quiet-moon-v1" } });
    const account = await classicTodaySession(page, null, snapshot);
    await page.addInitScript((key) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, "browser-state-must-stay-separate");
      localStorage.setItem("sk7-companion-species", "rabbit");
      const original = Storage.prototype.setItem;
      Object.assign(window, { e8CosmeticWrites: 0 });
      Storage.prototype.setItem = function (name, value) {
        if (name === key || name === "sk7-companion-species") (window as unknown as { e8CosmeticWrites: number }).e8CosmeticWrites++;
        original.call(this, name, value);
      };
    }, STORAGE_KEY);
    let verified = 0;
    page.on("response", response => { if (response.url().includes("/auth/v1/user") && response.status() === 200) verified++; });
    await page.goto("/?screen=S02"); await expectClassicToday(page);
    const entry = page.getByRole("link", { name: "내 공간으로 가기" });
    await expect(entry).toHaveAttribute("href", "?experience=e2&view=3d&storage=account");
    await expect(page.getByRole("link", { name: "이 선택을 내 공간에 가져가기" })).toHaveCount(0);
    expect(account.reads).toBe(0); expect(account.puts).toBe(0);
    await entry.scrollIntoViewIfNeeded();
    const rect = (await entry.boundingBox())!; expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.journey-view-frame img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode().catch(() => undefined))));
    await page.screenshot({ path: test.info().outputPath(`e8-today-${mobile ? "mobile" : "desktop"}.png`) });
    const enter = async () => { if (mobile) await entry.tap(); else { await entry.focus(); await page.keyboard.press("Enter"); } };
    await enter();
    const world = page.getByTestId("placeable-world");
    await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-mode", "account");
    await expect(world).toHaveAttribute("data-color", "teal");
    await expect(world).toHaveAttribute("data-socket", "gate-right");
    await expect(world).toHaveAttribute("data-keepsake", "quiet-moon-v1");
    await expect(world).toHaveAttribute("data-companion", "rabbit");
    await expect(world).toHaveAttribute("data-companion-pose", "neutral", { timeout: 15000 });
    expect(verified).toBeGreaterThan(0); expect(account.reads).toBe(1);
    await (await worldTool(page, "동반자에게 인사하기")).click();
    await expect(page.getByTestId("companion-response")).toContainText("인사를 나눴어요");
    await (await worldTool(page, "광장의 불빛 켜기")).click();
    await expect(world).toHaveAttribute("data-lighting", "twilight");
    await (await enterGarden(page)).click(); await expect(page.getByTestId("garden-canvas")).toBeVisible();
    await returnGarden(page).click();
    await expect(world).toHaveAttribute("data-keepsake", "quiet-moon-v1");
    await page.screenshot({ path: test.info().outputPath(`e8-my-space-${mobile ? "mobile" : "desktop"}.png`) });
    const today = page.getByRole("link", { name: "오늘의 기록으로 가기" });
    if (mobile) await today.tap(); else { await today.focus(); await page.keyboard.press("Enter"); }
    await expectClassicToday(page);
    await expect(page.getByRole("link", { name: "내 공간으로 돌아가기" })).toHaveAttribute("href", "?experience=e2&view=3d&storage=account");
    await page.goBack(); await expect(world).toHaveAttribute("data-color", "teal");
    await page.goForward(); await expectClassicToday(page);
    await page.getByRole("link", { name: "내 공간으로 돌아가기" }).click();
    await expect(world).toHaveAttribute("data-keepsake", "quiet-moon-v1");
    expect(account.puts).toBe(0); expect(account.revision).toBe(5);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe("browser-state-must-stay-separate");
    expect(await page.evaluate(() => localStorage.getItem("sk7-companion-species"))).toBe("rabbit");
    expect(await page.evaluate(() => (window as unknown as { e8CosmeticWrites: number }).e8CosmeticWrites)).toBe(0);
    if (mobile) {
      await page.getByRole("link", { name: "오늘의 기록으로 가기" }).tap(); await expectClassicToday(page);
      await page.setViewportSize({ width: 320, height: 640 });
      await page.getByRole("link", { name: "내 공간으로 돌아가기" }).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath("e8-today-320.png") });
    }
  } finally { await context.close(); }
});

test("E8 account unavailable never reads browser placement; explicit browser-only recovery preserves its return", async ({ page }) => {
  const account = await classicTodaySession(page);
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: "placeable.v1", layoutId: "e1-plaza.v1", revision: 0, selection: null, latestOperationId: null, latestFingerprint: null }));
    const original = Storage.prototype.getItem;
    Object.assign(window, { e8BrowserReads: 0 });
    Storage.prototype.getItem = function (name) {
      if (name === key) (window as unknown as { e8BrowserReads: number }).e8BrowserReads++;
      return original.call(this, name);
    };
  }, STORAGE_KEY);
  await page.goto("/?screen=S02"); await expectClassicToday(page);
  await page.route("https://e2e.invalid/auth/v1/user", route => route.fulfill({ status: 503, headers: cors, contentType: "application/json", body: '{"message":"unavailable"}' }));
  await page.getByRole("link", { name: "내 공간으로 가기" }).click();
  await expect(page.getByRole("status")).toContainText("계정 공간을 불러올 수 없어요");
  await expect(page.getByRole("button", { name: "계정 공간 다시 확인" })).toBeVisible();
  await expect(page.getByRole("link", { name: "오늘의 기록으로 돌아가기" })).toHaveAttribute("href", "/?screen=S02");
  expect(account.reads).toBe(0); expect(account.puts).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { e8BrowserReads: number }).e8BrowserReads)).toBe(0);
  await page.getByRole("link", { name: "이 브라우저의 공간으로 계속하기" }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-mode", "browser");
  await page.getByRole("link", { name: "오늘의 기록으로 가기" }).click(); await expectClassicToday(page);
  await expect(page.getByRole("link", { name: "내 공간으로 돌아가기" })).toHaveAttribute("href", "?experience=e2&view=3d&storage=browser");
});

test("E8 live account session loss removes the space without browser fallback", async ({ page }) => {
  const account = await classicTodaySession(page);
  await page.goto("/?screen=S02"); await expectClassicToday(page);
  await page.getByRole("link", { name: "내 공간으로 가기" }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-mode", "account");
  // Use the existing App logout in a second tab so the real SDK broadcasts loss.
  const other = await page.context().newPage();
  await classicTodaySession(other);
  await other.goto("/?screen=S02"); await expectClassicToday(other);
  await other.getByRole("button", { name: "설정", exact: true }).click();
  await other.getByRole("button", { name: "이 기기에서 로그아웃", exact: true }).click();
  await expect(other.locator('[data-scene="S01"]')).toBeVisible();
  await other.close();
  await expect(page.getByTestId("placeable-experience")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("계정 공간을 이용하려면 다시 로그인해 주세요");
  await expect(page.getByRole("link", { name: "이 브라우저의 공간으로 계속하기" })).toBeVisible();
  expect(account.puts).toBe(0); expect(await readLocal(page)).toBeNull();
});

test("E8 WebGL failure retains account 간단한 광장으로 보기 and 오늘의 기록으로 가기 exits", async ({ page }) => {
  const account = await classicTodaySession(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      return type.includes("webgl") ? null : original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto("/?screen=S02"); await expectClassicToday(page);
  await page.getByRole("link", { name: "내 공간으로 가기" }).click();
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기" })).toBeVisible();
  await page.getByRole("link", { name: "간단한 광장으로 보기", exact: true }).click();
  await expect(page.getByTestId("classic-plaza")).toBeVisible();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-mode", "account");
  await page.getByRole("link", { name: "오늘의 기록으로 가기" }).click(); await expectClassicToday(page);
  await expect(page.getByRole("link", { name: "내 공간으로 돌아가기" })).toHaveAttribute("href", "?experience=e2&view=classic&storage=account");
  expect(account.puts).toBe(0);
});

test("E8 guest and signed-out journeys gain no account entry or placeable requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (/cosmetics\/placeable|ProductPlaceableEntry/.test(request.url())) requests.push(request.url()); });
  for (const url of ["/?screen=S02", "/?guest=1"]) {
    await page.goto(url);
    await expect(page.locator('[data-scene="S01"], [data-scene="S02"]')).toBeVisible();
    await expect(page.getByRole("navigation", { name: "SK7 홈 전환" })).toHaveCount(0);
  }
  expect(requests).toEqual([]);
});

test("E8 empty Today still exposes account entry and ignores arbitrary return URLs", async ({ page }) => {
  const account = await classicTodaySession(page);
  await page.route("http://e2e.invalid/api/v1/observations/window**", route => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: route.request().method() === "OPTIONS" ? 204 : 200, headers: cors,
      contentType: "application/json", body: JSON.stringify({ start_on: url.searchParams.get("start_on"), end_on: url.searchParams.get("end_on"),
        blood_pressure_observations: [], challenge_events: [], active_challenge: null, challenge_checkins: [] }) });
  });
  await page.goto("/?screen=S02&return_space=https://forged.invalid&return_url=https://forged.invalid");
  await expect(page.locator('[data-scene="S01"], [data-scene="S12"]')).toBeVisible();
  await page.evaluate(() => {
    const raw = localStorage.getItem("sb-e2e-auth-token");
    if (raw) window.dispatchEvent(new CustomEvent("sk7:e2e-session-change", { detail: JSON.parse(raw) }));
  });
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "내 공간으로 가기" })).toHaveAttribute("href", "?experience=e2&view=3d&storage=account");
  expect(account.reads).toBe(0); expect(account.puts).toBe(0);
});

// #903: geometry witnesses complement the interaction/receipt cases above.
for (const [width, height] of [[1440, 900], [1366, 768], [768, 1024], [390, 844], [320, 844], [320, 568]]) {
  test(`903 arrival ${width}x${height}: primary clearance, disclosure and editor focus`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(companionRoute);
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle");
    const edit = page.getByRole("button", { name: "꾸미기", exact: true });
    const today = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });
    const tools = page.locator(".plaza-help > summary");
    // Count the semantic destination, including any differently named duplicate.
    await expect(page.getByRole("link", { name: /오늘의 기록/ })).toHaveCount(1);
    await expect(page.getByRole("link").filter({ hasText: "오늘의 기록" })).toHaveClass("placeable-today");
    const measure = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect.poll(() => page.locator(".placeable-world-label:visible").evaluateAll(labels => {
        const controls = Array.from(document.querySelectorAll(
          ".placeable-walk-pad, .plaza-help > summary, .plaza-help[open] .plaza-tools-content, .plaza-companion-status[data-notice=true], .placeable-world-caption",
        )).map(node => node.getBoundingClientRect());
        return labels.every(label => { const b = label.getBoundingClientRect(); return controls.every(r =>
          b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom); });
      })).toBe(true);
      for (const control of [edit, today, tools, page.locator(".placeable-walk-pad")]) {
        await control.scrollIntoViewIfNeeded();
        const box = (await control.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
        expect(await control.evaluate(el => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        })).toBe(true);
      }
      const boxes = await Promise.all([today, edit, tools, page.locator(".placeable-walk-pad")].map(el => el.boundingBox()));
      for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) {
        expect(a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x || a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y).toBe(true);
      }
    };
    await measure();
    await page.screenshot({ path: test.info().outputPath(`903-arrival-${width}-${height}.png`), scale: "css" });
    await tools.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "광장의 불빛 켜기" })).toBeVisible();
    const panel = (await page.locator(".plaza-tools-content").boundingBox())!;
    const dock = (await page.locator(".placeable-destination").boundingBox())!;
    const header = (await page.locator(".placeable-header").boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(panel.y + panel.height).toBeLessThanOrEqual(dock.y);
    await expect.poll(async () => page.locator(".placeable-world-label:visible").evaluateAll(labels => {
      const r = document.querySelector(".plaza-tools-content")!.getBoundingClientRect();
      return labels.every(label => { const b = label.getBoundingClientRect(); return b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom; });
    })).toBe(true);
    await tools.click(); await measure();
    await edit.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "내 공간 꾸미기", exact: true })).toBeFocused();
    await expect(page.getByRole("heading", { name: "내 공간 꾸미기", exact: true })).toBeInViewport();
    await page.keyboard.press("Escape"); await expect(edit).toBeFocused(); await expect(edit).toBeInViewport();
    expect(await readLocal(page)).toBeNull();
    await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
    await expect(edit).toBeInViewport();
    expect(await page.locator("main").evaluate(el => el.scrollTop)).toBe(0);
    await measure();
    await page.screenshot({ path: test.info().outputPath(`903-confirmed-${width}-${height}.png`), scale: "css" });
  });
}

test("903 delayed then unavailable companion preserves arrival actions without writes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/companion/v1/**", async route => { await pending; await route.abort("failed"); });
  await page.goto(companionRoute);
  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute("data-companion-pose", "loading");
  await expect(page.getByTestId("companion-response")).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("903-companion-loading.png") });
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내 공간 꾸미기" })).toBeFocused();
  await page.keyboard.press("Escape");
  release(); await expect(world).toHaveAttribute("data-companion-pose", "unavailable");
  await expect(page.getByTestId("companion-response")).toContainText("계속 이용");
  await page.screenshot({ path: test.info().outputPath("903-companion-unavailable.png") });
  expect(await readLocal(page)).toBeNull();
  await page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true }).click();
  await expect(world).toHaveCount(0);
});


test("903 account loading keeps scope and primary actions truthful without writes", async ({ page }) => {
  const account = await accountRoute(page, "normal");
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", async route => {
    if (route.request().method() === "GET") await pending;
    await route.fallback();
  });
  await page.goto("/?experience=e2&view=3d&storage=account");
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "loading");
  await expect(page.locator(".plaza-scope")).toContainText("계정 공간");
  await expect(page.getByTestId("save-status")).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("903-account-loading.png"), scale: "css" });
  release();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await page.keyboard.press("Escape");
  expect(account.puts).toBe(0); expect(await readLocal(page)).toBeNull();
  await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
  expect(account.puts).toBe(1); expect(account.revision).toBe(1); expect(await readLocal(page)).toBeNull();
  await page.screenshot({ path: test.info().outputPath("903-account-pinwheel.png"), scale: "css" });
});


test("904 Today remains direct in Garden and Classic while 3D has one semantic exit", async ({ page }) => {
  await page.goto(companionRoute);
  await expect(page.getByRole("link", { name: /오늘의 기록/ })).toHaveCount(1);
  const href = await page.locator(".placeable-today").getAttribute("href");
  await (await worldTool(page, "정원 쉼터로 가기")).click();
  const gardenToday = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });
  await expect(gardenToday).toBeVisible();
  await expect(gardenToday).toHaveAttribute("href", href!);
  await gardenToday.click();
  await expect(page.getByTestId("garden-experience")).toHaveCount(0);
  await page.goto(browserRoute);
  const classicToday = page.getByRole("link", { name: "오늘의 기록", exact: true });
  await expect(classicToday).toBeVisible();
  await classicToday.click();
  await expect(page.getByTestId("placeable-experience")).toHaveCount(0);
});

test("904 label clearance has no steady-frame DOM geometry reads", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(companionRoute);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle");
  await expect(page.locator(".placeable-world-label").first()).toBeVisible();
  const steadyReads = () => page.evaluate(async () => {
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    // Allow resize/disclosure/text-reflow observers to settle before the idle witness.
    for (let i = 0; i < 4; i++) await frame();
    const original = Element.prototype.getBoundingClientRect;
    let reads = 0;
    Element.prototype.getBoundingClientRect = function () {
      if (this.matches(".placeable-world-host, .placeable-world-label, .placeable-walk-pad, .plaza-help > summary, .plaza-tools-content, .plaza-companion-status, .placeable-world-caption")) reads++;
      return original.call(this);
    };
    try { for (let i = 0; i < 20; i++) await frame(); return reads; }
    finally { Element.prototype.getBoundingClientRect = original; }
  });
  expect(await steadyReads()).toBe(0);
  await (await worldTool(page, "왼쪽 보기", true)).click();
  expect(await steadyReads()).toBe(0);
  await page.locator(".plaza-help > summary").click();
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await expect(page.locator(".placeable-world-caption")).toBeVisible();
  expect(await steadyReads()).toBe(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await steadyReads()).toBe(0);
});

// #905: observe writes independently of the displayed preview, using synthetic scopes.
async function observePreviewWrites(page: Page) {
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    (window as any).__previewWrites = 0;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as any).__previewWrites++;
      return original.call(this, name, value);
    };
  }, STORAGE_KEY);
  return () => page.evaluate(() => (window as any).__previewWrites as number);
}

for (const mode of ["browser", "account"] as const) {
  for (const [name, key, previewText] of [
    ["바람개비 치우기", "Enter", "미리보기: 바람개비 치우기"],
    ["남긴 문양 제거", "Space", "문양 제거 · 저장 전 미리보기"],
  ]) test(`#905 ${mode}: ${name} keeps keyboard focus visible after preview insertion`, async ({ page }) => {
    const account = await accountRoute(page, "normal"), writes = await observePreviewWrites(page);
    await page.setViewportSize({ width: 320, height: mode === "browser" ? 480 : 568 });
    await page.goto(`/?experience=e2&view=3d&storage=${mode}&living_choice=sleep-routine`);
    if (mode === "account") await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await (await editorButton(page, "환영 바람개비 고르기")).click(); await confirm(page);
    await (await editorButton(page, "이 문양을 내 공간에 남기기")).click(); await confirm(page);
    const local = await readLocal(page), localWrites = await writes(), accountWrites = account.puts;
    expect(localWrites).toBe(mode === "browser" ? 2 : 0);
    expect(accountWrites).toBe(mode === "account" ? 2 : 0);
    const noNewWrites = async () => {
      expect(await writes()).toBe(localWrites); expect(account.puts).toBe(accountWrites);
      expect(await readLocal(page)).toEqual(local);
    };
    const trigger = await editorButton(page, name, true), draft = page.getByTestId("draft-placement");
    await expect(draft).toHaveCount(0);
    await trigger.focus();
    await expect(trigger).toBeFocused(); await expect(trigger).toBeInViewport({ ratio: 1 });
    await page.keyboard.press(key);
    await expect(draft).toContainText(previewText);
    // No locator action or test scroll after activation: the product must keep
    // the same semantic control focused and fully visible on its own.
    await expect(trigger).toBeFocused(); await expect(trigger).toBeInViewport({ ratio: 1 });
    await noNewWrites();
    await page.screenshot({ path: test.info().outputPath("905-removal-preview-focus.png") });
    const cancel = page.getByRole("button", { name: "미리보기 취소", exact: true });
    await cancel.focus(); await page.keyboard.press("Enter");
    await expect(draft).toHaveCount(0);
    await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
    await noNewWrites();
  });
}

for (const mode of ["browser", "account"] as const) test(`#905 ${mode}: each preview action writes zero; latest input, cancel, reopen and confirm stay separate`, async ({ page }) => {
  const account = await accountRoute(page, "normal"), writes = await observePreviewWrites(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/?experience=e2&view=3d&storage=${mode}`);
  const world = page.getByTestId("placeable-world"), preview = page.getByTestId("pinwheel-preview");
  const noWrites = async () => { expect(await writes()).toBe(0); expect(account.puts).toBe(0); };
  await page.getByRole("button", { name: "꾸미기", exact: true }).click(); await noWrites();
  const choose = page.getByRole("button", { name: "환영 바람개비 고르기" });
  await choose.focus(); await page.keyboard.press("Enter"); await noWrites();
  await expect(choose).toBeFocused();
  await expect(preview).toContainText("코랄 바람개비");
  await page.getByRole("button", { name: "청록", exact: true }).click(); await noWrites();
  await page.getByRole("button", { name: "입구 오른쪽", exact: true }).click(); await noWrites();
  for (const name of ["코랄", "입구 왼쪽", "해바라기", "광장 가장자리", "청록", "입구 오른쪽"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(preview).toHaveAttribute("data-color", "teal");
  await expect(preview).toHaveAttribute("data-socket", "gate-right");
  await expect(world).toHaveAttribute("data-color", "teal");
  await expect(world).toHaveAttribute("data-socket", "gate-right");
  await expect(world).toHaveAttribute("data-pulse", "0");
  const marker = page.locator('.placeable-world-label[data-preview-selected=true]');
  await expect(marker).toHaveText("미리보기 · 입구 오른쪽");
  await expect(marker).toBeVisible();
  await expect(page.locator('.pinwheel-choices [aria-pressed=true]')).toHaveCount(2);
  await noWrites();
  expect(await preview.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press("Escape"); await noWrites();
  await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
  await expect(preview).toHaveCount(0); await expect(marker).toHaveCount(0);
  await expect(world).toHaveAttribute("data-color", "unplaced");
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await expect(preview).toHaveAttribute("data-color", "coral");
  await confirm(page);
  expect(await writes()).toBe(mode === "browser" ? 1 : 0); expect(account.puts).toBe(mode === "account" ? 1 : 0);
  const local = await readLocal(page);
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await expect(preview).toHaveCount(0); await expect(marker).toHaveCount(0);
  await page.getByRole("button", { name: "청록", exact: true }).click();
  await expect(page.getByTestId("confirmed-placement")).toContainText("코랄");
  await expect(preview).toContainText("청록");
  await page.getByRole("button", { name: "미리보기 취소", exact: true }).click();
  await expect(world).toHaveAttribute("data-color", "coral");
  expect(await readLocal(page)).toEqual(local);
  expect(await writes()).toBe(mode === "browser" ? 1 : 0); expect(account.puts).toBe(mode === "account" ? 1 : 0);
  await (await editorButton(page, "청록", true)).click(); await confirm(page);
  expect(await writes()).toBe(mode === "browser" ? 2 : 0); expect(account.puts).toBe(mode === "account" ? 2 : 0);
  await page.reload(); await expect(world).toHaveAttribute("data-color", "teal");
  await expect(preview).toHaveCount(0); await expect(marker).toHaveCount(0);
  await expect(world).toHaveAttribute("data-pulse", "0");
  if (mode === "browser") expect(account.reads).toBe(0);
  else expect(await readLocal(page)).toBeNull();
});

for (const [width, height] of [[1366, 900], [390, 844], [320, 568], [320, 480]]) test(`#905 ${width}x${height}: preview, choices and actions reflow with real touch targets`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 400, isMobile: width < 400 });
  const page = await context.newPage();
  try {
    await page.goto(companionRoute);
    await (await editorButton(page, "환영 바람개비 고르기")).click();
    await page.getByRole("button", { name: "광장 가장자리", exact: true }).click();
    await page.getByRole("button", { name: "해바라기", exact: true }).click();
    await expect(page.getByTestId("pinwheel-preview")).toContainText("해바라기 바람개비");
    const controls = page.locator('.pinwheel-choices button, .placeable-draft button');
    for (const button of await controls.all()) {
      await button.scrollIntoViewIfNeeded(); const rect = (await button.boundingBox())!;
      expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      expect(await button.evaluate(node => {
        const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.getByTestId("pinwheel-preview").scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`905-preview-${width}-${height}.png`) });
    const cancel = page.getByRole("button", { name: "미리보기 취소", exact: true });
    if (width < 400) await cancel.tap(); else await cancel.click();
    await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
  } finally { await context.close(); }
});

test("#905 reduced motion, forced colors, keyboard and 200% text preserve static selection and focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto(companionRoute);
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "neutral");
  const open = page.getByRole("button", { name: "꾸미기", exact: true });
  await open.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "내 공간 꾸미기", exact: true })).toBeFocused();
  const teal = page.getByRole("button", { name: "청록", exact: true });
  await page.getByRole("button", { name: "코랄", exact: true }).focus(); await page.keyboard.press("Tab");
  await expect(teal).toBeFocused(); await page.keyboard.press("Space");
  await expect(teal).toHaveAttribute("aria-pressed", "true");
  await expect(teal).toBeFocused(); await expect(teal).toBeInViewport();
  await expect(teal.locator('.pinwheel-selected-mark')).toBeVisible();
  await expect(teal).toHaveCSS("outline-style", "solid");
  await expect(teal).toHaveCSS("border-width", "2px");
  const preview = page.getByTestId("pinwheel-preview");
  await expect(preview).toHaveCSS("border-style", "dashed");
  expect(await preview.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await page.screenshot({ path: test.info().outputPath("905-forced-colors-keyboard.png") });
  await page.emulateMedia({ forcedColors: "none" });
  // Text-only enlargement, intentionally not represented as browser zoom.
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.setViewportSize({ width: 320, height: 568 });
  for (const name of ["입구 오른쪽", "해바라기", "미리보기 취소"]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded(); await button.focus(); await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  }
  await expect(open).toBeFocused();
  await page.keyboard.press("Enter"); await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "환영 바람개비 고르기" }).click();
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("905-text-200.png") });
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("save-status")).toContainText("저장했어요");
});

test("#905 saving and WebGL failure keep the candidate static and recovery separate", async ({ page }) => {
  await accountRoute(page, "normal");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", async route => {
    if (route.request().method() === "PUT") await held;
    await route.fallback();
  });
  await page.goto("/?experience=e2&view=3d&storage=account");
  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await page.getByTestId("placeable-world-canvas").evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");
  await expect(page.getByTestId("pinwheel-preview")).toContainText("저장 전 미리보기");
  await page.getByRole("button", { name: "청록", exact: true }).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "saving");
  await expect(page.getByTestId("save-status")).toContainText("저장하고 있어요");
  await expect(page.getByRole("button", { name: "미리보기 취소", exact: true })).toBeDisabled();
  await expect(page.getByTestId("pinwheel-preview")).toHaveAttribute("data-color", "teal");
  release(); await expect(page.getByTestId("save-status")).toContainText("계정 공간에 저장했어요");
  await expect(page.getByTestId("pinwheel-preview")).toHaveCount(0);
});

// #907 counts real DOM acknowledgement transitions, not screenshots or saved=true.
async function observeReceiptAccent(page: Page) {
  await page.addInitScript(() => {
    (window as any).__receiptStarts = 0;
    (window as any).__receiptNoticeStarts = 0;
    let active = false, notice = false;
    new MutationObserver(() => {
      const next = Boolean(document.querySelector('[data-testid="save-status"][data-pinwheel-receipt="true"]'));
      if (next && !active) (window as any).__receiptStarts++;
      active = next;
      const nextNotice = Boolean(document.querySelector('[data-testid="save-status"]')?.textContent?.includes("저장했어요"));
      if (nextNotice && !notice) (window as any).__receiptNoticeStarts++;
      notice = nextNotice;
    }).observe(document, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["data-pinwheel-receipt"] });
  });
  return () => page.evaluate(() => (window as any).__receiptStarts as number);
}
const receiptNoticeStarts = (page: Page) => page.evaluate(() => (window as any).__receiptNoticeStarts as number);
async function expectStableSaved(page: Page, mode: "browser" | "account") {
  const status = page.getByTestId("save-status");
  await expect(status).toContainText(mode === "browser" ? "이 브라우저에 저장된 꾸미기예요." : "계정 공간에 저장된 꾸미기예요.");
  await expect(status).not.toContainText("저장했어요");
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "false");
}
for (const mode of ["browser", "account"] as const) for (const view of ["classic", "3d"] as const) {
  test(`#907 ${mode} ${view}: exact direct save acknowledges once; reload, views and history do not replay`, async ({ page }) => {
    const account = await accountRoute(page, "normal"), writes = await observePreviewWrites(page), starts = await observeReceiptAccent(page);
    await page.goto(`/?experience=e2&view=${view}&storage=${mode}`);
    const status = page.getByTestId("save-status");
    await (await editorButton(page, "환영 바람개비 고르기")).click(); expect(await starts()).toBe(0);
    await confirm(page); await expect(status).toHaveAttribute("data-pinwheel-receipt", "true");
    expect(await starts()).toBe(1); await expect(status).toContainText(mode === "browser" ? "이 브라우저에 저장했어요" : "계정 공간에 저장했어요");
    if (view === "3d") {
      await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
      await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-pulse", "0");
    } else await expect(status).toBeFocused();
    const message = await status.textContent();
    const notices = await receiptNoticeStarts(page);
    await expect(status).toHaveAttribute("data-pinwheel-receipt", "false", { timeout: 5000 });
    await expect(status.locator(".pinwheel-receipt-check")).toBeHidden();
    expect(await status.textContent()).toBe(message); // Expiry adds no live-region message.
    expect(await receiptNoticeStarts(page)).toBe(notices);
    expect(await starts()).toBe(1);
    expect(await writes()).toBe(mode === "browser" ? 1 : 0); expect(account.puts).toBe(mode === "account" ? 1 : 0);
    const snapshot = mode === "browser" ? await readLocal(page) : null;
    if (snapshot) expect(Object.keys(snapshot).sort()).toEqual(Object.keys(emptySnapshot()).sort());
    await page.reload(); await expect(status).toContainText("저장된 꾸미기예요");
    await expect(status).toHaveAttribute("data-pinwheel-receipt", "false"); expect(await starts()).toBe(0); expect(await writes()).toBe(0);
    await page.getByRole("link", { name: view === "3d" ? "간단한 광장으로 보기" : "3D 광장으로 보기", exact: true }).click();
    await expect(status).toContainText("저장된 꾸미기예요"); expect(await starts()).toBe(0);
    await page.goBack(); await expectStableSaved(page, mode); expect(await starts()).toBe(0);
    await page.goForward(); await expectStableSaved(page, mode); expect(await starts()).toBe(0);
    expect(await receiptNoticeStarts(page)).toBe(0);
    expect(account.puts).toBe(mode === "account" ? 1 : 0);
    if (mode === "browser") { expect(account.reads).toBe(0); expect(await readLocal(page)).toEqual(snapshot); }
    else expect(await readLocal(page)).toBeNull();
  });
}
test("#907 UNKNOWN, old read, exact explicit reconciliation: one acknowledgement and one PUT", async ({ page }) => {
  const account = await accountRoute(page, "unknown", false), starts = await observeReceiptAccent(page);
  let operation: Operation | undefined, exactRead = false;
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", async route => {
    if (route.request().method() === "PUT") operation = route.request().postDataJSON();
    if (route.request().method() === "GET" && exactRead) return route.fulfill({ status: 200, headers: cors, json: await saved(operation!) });
    await route.fallback();
  });
  await page.goto("/?experience=e2&view=3d&storage=account");
  await (await editorButton(page, "청록", true)).click(); await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  const main = page.getByTestId("placeable-experience"), status = page.getByTestId("save-status");
  await expect(main).toHaveAttribute("data-phase", "unknown"); await expect(status).toContainText("저장 결과를 확인할 수 없어요");
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "false"); expect(await starts()).toBe(0);
  await page.getByRole("button", { name: "저장된 상태 확인", exact: true }).click();
  await expect(main).toHaveAttribute("data-phase", "unknown"); expect(await starts()).toBe(0); expect(account.puts).toBe(1);
  exactRead = true; await page.getByRole("button", { name: "저장된 상태 확인", exact: true }).click();
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "true"); await expect(status).toContainText("계정 공간에 저장했어요");
  expect(await starts()).toBe(1); expect(account.puts).toBe(1); expect(await readLocal(page)).toBeNull();
  await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "false", { timeout: 5000 }); expect(await starts()).toBe(1);
});
for (const wrong of ["operation", "fingerprint", "conflict"] as const) test(`#907 ${wrong}: same-looking state never acknowledges or claims success`, async ({ page }) => {
  await accountRoute(page, "normal"); const starts = await observeReceiptAccent(page);
  let snapshot = emptySnapshot(), puts = 0;
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fallback();
    if (request.method() === "PUT") {
      puts++; snapshot = { ...await saved(request.postDataJSON()), ...(wrong === "fingerprint"
        ? { latestFingerprint: "f".repeat(64) } : { latestOperationId: crypto.randomUUID() }) };
      if (wrong === "conflict") return route.fulfill({ status: 409, headers: cors, json: { detail: { code: "revision_conflict" } } });
    }
    return route.fulfill({ status: 200, headers: cors, json: snapshot });
  });
  await page.goto("/?experience=e2&view=3d&storage=account");
  await (await editorButton(page, "청록", true)).click(); await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "conflict");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-pinwheel-receipt", "false");
  await expect(page.getByTestId("save-status")).not.toContainText("저장했어요");
  await expect(page.getByTestId("save-status")).toBeInViewport(); expect(await starts()).toBe(0); expect(puts).toBe(1);
});
test("#907 newer operation replaces accent; Garden, page restore and scope changes never replay", async ({ page }) => {
  const account = await accountRoute(page, "normal"), starts = await observeReceiptAccent(page), writes = await observePreviewWrites(page);
  await page.goto(browserRoute); await page.clock.install(); await page.clock.pauseAt(new Date());
  const status = page.getByTestId("save-status");
  await page.getByRole("button", { name: "청록", exact: true }).click(); await confirm(page);
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "true"); expect(await starts()).toBe(1);
  await page.clock.runFor(1200);
  await page.getByRole("button", { name: "코랄", exact: true }).click(); await expect(status).toHaveAttribute("data-pinwheel-receipt", "false");
  await expect(status).not.toContainText("저장했어요");
  await confirm(page); await expect(status).toHaveAttribute("data-pinwheel-receipt", "true"); expect(await starts()).toBe(2); expect(await writes()).toBe(2);
  await page.clock.runFor(1201); // The previous timer must not clear the newer receipt.
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "true");
  await page.getByRole("button", { name: "정원 쉼터로 가기", exact: false }).click();
  await page.getByRole("button", { name: "광장으로 돌아가기", exact: true }).click();
  await expectStableSaved(page, "browser"); expect(await starts()).toBe(2);
  expect(await receiptNoticeStarts(page)).toBe(2); expect(await writes()).toBe(2);
  await page.clock.runFor(2500); await expect(status).toHaveAttribute("data-pinwheel-receipt", "false");
  await page.getByRole("button", { name: "청록", exact: true }).click(); await confirm(page);
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "true"); expect(await starts()).toBe(3);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "false");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expectStableSaved(page, "browser"); expect(await receiptNoticeStarts(page)).toBe(3);
  expect(await starts()).toBe(3); expect(await writes()).toBe(3); await page.clock.resume();
  await page.getByRole("link", { name: "계정 공간 사용하기", exact: true }).click();
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "false"); expect(await starts()).toBe(0); expect(account.puts).toBe(0);
  await page.getByRole("link", { name: "이 브라우저의 공간 사용하기", exact: true }).click();
  await expectStableSaved(page, "browser"); expect(await starts()).toBe(0); expect(await receiptNoticeStarts(page)).toBe(0);
});
test("#907 keepsake add, replacement, removal and mixed save remain static", async ({ page }) => {
  const starts = await observeReceiptAccent(page), writes = await observePreviewWrites(page);
  await page.goto(browserRoute + "&living_choice=sleep-routine"); const status = page.getByTestId("save-status");
  await page.getByRole("button", { name: "이 문양을 내 공간에 남기기", exact: true }).click(); await confirm(page);
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "false"); expect(await starts()).toBe(0); expect(await writes()).toBe(1);
  await page.goto(browserRoute + "&living_choice=walk-10-minutes");
  await page.getByRole("button", { name: "이 문양으로 바꾸기", exact: true }).click(); await confirm(page);
  await page.getByRole("button", { name: "남긴 문양 제거", exact: true }).click(); await confirm(page);
  await page.getByRole("button", { name: "이 문양을 내 공간에 남기기", exact: true }).click();
  await page.getByRole("button", { name: "청록", exact: true }).click(); await confirm(page);
  await expect(status).toHaveAttribute("data-pinwheel-receipt", "false"); expect(await starts()).toBe(0); expect(await writes()).toBe(3);
  expect(await page.getByTestId("classic-keepsake").evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  const notices = await receiptNoticeStarts(page), snapshot = await readLocal(page);
  await page.getByRole("button", { name: "정원 쉼터로 가기", exact: false }).click();
  await page.getByRole("button", { name: "광장으로 돌아가기", exact: true }).click();
  await expectStableSaved(page, "browser"); expect(await receiptNoticeStarts(page)).toBe(notices);
  expect(await starts()).toBe(0); expect(await writes()).toBe(3); expect(await readLocal(page)).toEqual(snapshot);
});
for (const [width, height, accessible] of [[1366, 900, false], [390, 844, false], [320, 568, true], [320, 480, false]] as const) {
  test(`#907 ${width}x${height}: receipt reflows with controls${accessible ? ", reduced motion, forced colors and 200% text" : ""}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    if (accessible) await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
    await page.goto(companionRoute);
    if (accessible) await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await (await editorButton(page, "청록", true)).click();
    const confirmButton = page.getByRole("button", { name: "배치 확정하기", exact: true });
    await confirmButton.focus(); await page.keyboard.press("Enter");
    const status = page.getByTestId("save-status");
    await expect(status).toHaveAttribute("data-pinwheel-receipt", "true");
    await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
    expect(await status.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
    await expect(status.locator(".pinwheel-receipt-check")).toBeVisible();
    if (accessible) {
      await expect(status).toHaveCSS("border-style", "solid");
      await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toHaveCSS("outline-style", "solid");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const a = (await status.boundingBox())!;
    for (const locator of [page.locator(".placeable-destination"), page.locator(".placeable-walk-pad")]) {
      const b = await locator.boundingBox();
      if (b) expect(Math.min(a.x + a.width, b.x + b.width) <= Math.max(a.x, b.x)
        || Math.min(a.y + a.height, b.y + b.height) <= Math.max(a.y, b.y)).toBe(true);
    }
    await status.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`907-receipt-${width}-${height}.png`) });
    await page.getByRole("button", { name: "꾸미기", exact: true }).click();
    await page.getByRole("button", { name: "해바라기", exact: true }).click();
    await expect(status).toHaveAttribute("data-pinwheel-receipt", "false");
    await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "꾸미기", exact: true })).toBeFocused();
  });
}

for (const slot of ["pinwheel", "keepsake"] as const) for (const interruption of ["hidden", "pagehide"] as const) {
  test(`#907 ${slot} receipt during ${interruption} is skipped and restoration cannot replay semantics`, async ({ page }) => {
    const account = await accountRoute(page, "normal"), starts = await observeReceiptAccent(page);
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", async route => {
      if (route.request().method() === "PUT") await held;
      await route.fallback();
    });
    await page.goto("/?experience=e2&view=classic&storage=account&living_choice=sleep-routine");
    await page.getByRole("button", { name: slot === "pinwheel" ? "청록" : "이 문양을 내 공간에 남기기", exact: true }).click();
    await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
    const status = page.getByTestId("save-status");
    await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "saving");
    await expect(status).toHaveAttribute("data-pinwheel-receipt", "false"); expect(await starts()).toBe(0);
    // Controlled visibility fixture; this is not a claim about OS suspension timing.
    await interruptReceipt(page, interruption);
    release(); await expectStableSaved(page, "account");
    expect(await starts()).toBe(0); expect(await receiptNoticeStarts(page)).toBe(0);
    await restoreReceipt(page, interruption);
    await expectStableSaved(page, "account"); expect(await starts()).toBe(0);
    expect(await receiptNoticeStarts(page)).toBe(0); expect(account.puts).toBe(1); expect(await readLocal(page)).toBeNull();
    await page.getByRole("button", { name: "코랄", exact: true }).click(); await confirm(page);
    await expect(status).toHaveAttribute("data-pinwheel-receipt", "true"); expect(await starts()).toBe(1);
    await interruptReceipt(page, interruption); await expectStableSaved(page, "account");
    await restoreReceipt(page, interruption);
    await expectStableSaved(page, "account"); expect(await starts()).toBe(1);
    expect(await receiptNoticeStarts(page)).toBe(1); expect(account.puts).toBe(2); expect(await readLocal(page)).toBeNull();
  });
}

async function interruptReceipt(page: Page, interruption: "hidden" | "pagehide") {
  await page.evaluate(interruption => {
    if (interruption === "pagehide") window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    else {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }
  }, interruption);
}
async function restoreReceipt(page: Page, interruption: "hidden" | "pagehide") {
  await page.evaluate(interruption => {
    if (interruption === "pagehide") window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    else {
      Reflect.deleteProperty(document, "hidden"); document.dispatchEvent(new Event("visibilitychange"));
    }
  }, interruption);
}

for (const mode of ["browser", "account"] as const) for (const view of ["classic", "3d"] as const) for (const slot of ["pinwheel", "keepsake"] as const) {
  test(`#907 ${mode} ${view} ${slot}: exact notice stays through expiry, Garden and interruptions retire it`, async ({ page }) => {
    const account = await accountRoute(page, "normal"), starts = await observeReceiptAccent(page), writes = await observePreviewWrites(page);
    await page.goto(`/?experience=e2&view=${view}&storage=${mode}&living_choice=sleep-routine`);
    const status = page.getByTestId("save-status");
    await (await editorButton(page, slot === "pinwheel" ? "청록" : "이 문양을 내 공간에 남기기", true)).click();
    await page.clock.install({ time: new Date("2026-09-30T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-09-30T00:01:00Z"));
    await confirm(page);
    await expect(status).toHaveAttribute("data-pinwheel-receipt", String(slot === "pinwheel"));
    expect(await starts()).toBe(slot === "pinwheel" ? 1 : 0); expect(await receiptNoticeStarts(page)).toBe(1);
    expect(await status.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
    const message = await status.textContent(), snapshot = await readLocal(page);
    await page.clock.runFor(2401);
    await expect(status).toHaveAttribute("data-pinwheel-receipt", "false");
    expect(await status.textContent()).toBe(message); expect(await receiptNoticeStarts(page)).toBe(1);
    await (await worldTool(page, "정원 쉼터로 가기")).click();
    await expect(page.getByTestId("garden-experience")).toBeVisible();
    await page.getByRole("button", { name: "광장으로 돌아가기", exact: true }).click();
    await expectStableSaved(page, mode); expect(await receiptNoticeStarts(page)).toBe(1);
    for (const interruption of ["hidden", "pagehide"] as const) {
      // New exact saves are eligible again; interruptions clear both local lifetimes.
      await (await editorButton(page, slot === "pinwheel" ? "해바라기" : "남긴 문양 제거", true)).click();
      await confirm(page); const notices = await receiptNoticeStarts(page), accents = await starts();
      await interruptReceipt(page, interruption); await expectStableSaved(page, mode);
      await restoreReceipt(page, interruption); await expectStableSaved(page, mode);
      expect(await receiptNoticeStarts(page)).toBe(notices); expect(await starts()).toBe(accents);
      if (slot === "keepsake") {
        await (await editorButton(page, "이 문양을 내 공간에 남기기", true)).click(); await confirm(page);
      }
    }
    const expectedWrites = slot === "pinwheel" ? 3 : 5;
    expect(await starts()).toBe(slot === "pinwheel" ? 3 : 0);
    expect(await writes()).toBe(mode === "browser" ? expectedWrites : 0);
    expect(account.puts).toBe(mode === "account" ? expectedWrites : 0);
    if (mode === "browser") expect((await readLocal(page)).revision).toBe(snapshot.revision + expectedWrites - 1);
    else expect(await readLocal(page)).toBeNull();
    await page.clock.resume();
  });
}

test("#930 Today-My Space round trip exposes exact identity and destination focus without extra history", async ({ page }) => {
  await classicTodaySession(page);

  await page.goto("/?screen=S02");
  await expectClassicToday(page);
  await expect(page.locator("#S02-title")).toBeFocused();

  const entryNav = page.locator(".today-my-space");
  await expect(entryNav).toHaveAttribute("data-my-space-intent", "enter");
  await expect(entryNav).toHaveAttribute("data-my-space-view", "3d");
  await expect(entryNav).toHaveAttribute("data-my-space-storage", "account");
  await expect(entryNav).toContainText("계정 공간");
  await expect(entryNav).toContainText("3D 광장");

  const entry = page.getByRole("link", { name: "내 공간으로 가기" });
  await entry.focus();
  await page.keyboard.press("Enter");

  const spaceHeading = page.getByRole("heading", { level: 1, name: /내 공간/ });
  await expect(spaceHeading).toBeFocused();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-mode", "account");
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-view", "3d");

  const today = page.getByRole("link", { name: "오늘의 기록으로 가기" });
  await today.focus();
  await page.keyboard.press("Enter");

  await expectClassicToday(page);
  await expect(page.locator("#S02-title")).toBeFocused();

  const returnNav = page.locator(".today-my-space");
  await expect(returnNav).toHaveAttribute("data-my-space-intent", "return");
  await expect(returnNav).toHaveAttribute("data-my-space-view", "3d");
  await expect(returnNav).toHaveAttribute("data-my-space-storage", "account");
  await expect(returnNav).toContainText("계정 공간");
  await expect(returnNav).toContainText("3D 광장");

  const returnLink = page.getByRole("link", { name: "내 공간으로 돌아가기" });
  await expect(returnLink).toHaveAttribute(
    "href",
    "?experience=e2&view=3d&storage=account",
  );

  // One explicit full-page transition is one browser-history step.
  await page.goBack();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-view", "3d");

  await page.goForward();
  await expectClassicToday(page);
  await expect(returnNav).toHaveAttribute("data-my-space-intent", "return");

  await returnLink.click();
  await expect(spaceHeading).toBeFocused();
});

test("#930 blocked draft and unknown save keep My Space ownership and focus truthful handoff", async ({ page }) => {
  await page.goto(companionRoute);

  await (await editorButton(page, "환영 바람개비 고르기")).click();
  const draftExit = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });

  await expect(draftExit).toHaveAttribute("aria-disabled", "true");
  await draftExit.focus();
  await page.keyboard.press("Enter");

  const handoff = page.locator(".placeable-handoff-note");
  await expect(handoff).toBeFocused();
  await expect(handoff).toContainText("미리보기를 먼저 마무리해 주세요");
  await expect(page.getByTestId("draft-placement")).toBeVisible();
  await expect(page).toHaveURL(/experience=e2/);

  await accountRoute(page, "unknown", false);
  await page.goto("/?experience=e2&view=3d&storage=account");

  await (await editorButton(page, "환영 바람개비 고르기")).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "unknown");

  const unknownExit = page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true });
  await expect(unknownExit).toHaveAttribute("aria-disabled", "true");
  await unknownExit.focus();
  await page.keyboard.press("Enter");

  await expect(handoff).toBeFocused();
  await expect(handoff).toContainText("저장 결과를 먼저 확인해 주세요");
  await expect(page.getByTestId("draft-placement")).toBeVisible();
  await expect(page).toHaveURL(/experience=e2/);
});

test("#930 transition UI reflows at 320 and actual 200-percent text enlargement", async ({ page }) => {
  await classicTodaySession(page);

  for (const viewport of [
    { width: 320, height: 844, label: "320", textPercent: 100 },
    { width: 320, height: 568, label: "text-200", textPercent: 200 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/?screen=S02");
    await expectClassicToday(page);

    if (viewport.textPercent === 200) {
      // Match the repository's established actual text-enlargement evidence.
      // This is text-only enlargement, intentionally not claimed as browser zoom.
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
    }

    const nav = page.locator(".today-my-space");
    const entry = page.getByRole("link", { name: "내 공간으로 가기" });

    await nav.scrollIntoViewIfNeeded();
    await expect(nav).toHaveAttribute("data-my-space-view", "3d");
    await expect(nav).toHaveAttribute("data-my-space-storage", "account");
    await expect(entry).toBeVisible();

    const entryBox = await entry.boundingBox();
    expect(entryBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.emulateMedia({ forcedColors: "active" });
    await entry.focus();
    await expect(entry).toBeFocused();
    expect(await entry.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await page.emulateMedia({ forcedColors: "none" });

    await entry.click();

    await expect(page.getByRole("heading", { level: 1, name: /내 공간/ })).toBeFocused();
    const today = page.getByRole("link", { name: "오늘의 기록으로 가기" });
    await today.scrollIntoViewIfNeeded();

    const todayBox = await today.boundingBox();
    expect(todayBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.screenshot({
      path: test.info().outputPath(`930-transition-${viewport.label}.png`),
      scale: "css",
    });
  }
});

test("#932 confirmed empty is a normal editable state, not a recovery state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(browserRoute);

  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  const identity = page.getByTestId("placeable-state-identity");
  await expect(identity).toHaveAttribute("data-state", "empty");
  await expect(identity).toHaveAttribute("data-storage", "browser");
  await expect(identity).toContainText("아직 저장된 꾸미기가 없어요");
  await expect(identity).toContainText("이 브라우저의 공간은 정상적으로 확인됐어요");
  await expect(identity).not.toContainText(/확인할 수 없|이 버전에서/);

  await expect(page.getByTestId("confirmed-placement")).toHaveText("저장 상태: 바람개비 없음");
  await expect(page.getByTestId("confirmed-keepsake")).toHaveText("아직 남긴 문양이 없어요.");
  await expect(page.getByRole("button", { name: "환영 바람개비 고르기" })).toBeEnabled();
  expect(await readLocal(page)).toBeNull();
});

test("#932 browser unavailable and unsupported states never masquerade as empty or write repairs", async ({ browser }) => {
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.addInitScript((key) => {
        const originalGet = Storage.prototype.getItem;
        const originalSet = Storage.prototype.setItem;
        Object.assign(window, { e932Writes: 0 });
        Storage.prototype.getItem = function (name) {
          if (name === key) throw new DOMException("blocked");
          return originalGet.call(this, name);
        };
        Storage.prototype.setItem = function (name, value) {
          if (name === key) (window as unknown as { e932Writes: number }).e932Writes++;
          return originalSet.call(this, name, value);
        };
      }, STORAGE_KEY);

      await page.goto(browserRoute);
      await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "unavailable");

      const identity = page.getByTestId("placeable-state-identity");
      await expect(identity).toHaveAttribute("data-state", "unavailable");
      await expect(identity).toHaveAttribute("data-storage", "browser");
      await expect(identity).toContainText("저장 상태를 지금 확인할 수 없어요");
      await expect(identity).toContainText("비어 있다는 뜻은 아니에요");
      await expect(page.locator(".placeable-map-caption")).toHaveText("저장 상태 확인 필요");
      await expect(page.getByRole("button", { name: "환영 바람개비 고르기" })).toBeDisabled();
      expect(await page.evaluate(() => (window as unknown as { e932Writes: number }).e932Writes)).toBe(0);
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const future = {
      schemaVersion: "placeable.v9",
      layoutId: "e1-plaza.v9",
      revision: 7,
      selection: { future: true },
      latestOperationId: "00000000-0000-4000-8000-000000000932",
      latestFingerprint: "9".repeat(64),
    };
    const raw = JSON.stringify(future);

    try {
      await page.addInitScript(({ key, raw }) => {
        localStorage.setItem(key, raw);
        const original = Storage.prototype.setItem;
        Object.assign(window, { e932Writes: 0 });
        Storage.prototype.setItem = function (name, value) {
          if (name === key) (window as unknown as { e932Writes: number }).e932Writes++;
          return original.call(this, name, value);
        };
      }, { key: STORAGE_KEY, raw });

      await page.goto(browserRoute);
      await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "unsupported");

      const identity = page.getByTestId("placeable-state-identity");
      await expect(identity).toHaveAttribute("data-state", "unsupported");
      await expect(identity).toHaveAttribute("data-storage", "browser");
      await expect(identity).toContainText("저장된 꾸미기는 그대로 보존하고 있어요");
      await expect(identity).toContainText("비어 있는 공간으로 간주하지 않아요");
      await expect(page.locator(".placeable-map-caption"))
        .toHaveText("저장된 꾸미기 · 이 버전에서 표시 보류");
      await expect(page.getByTestId("confirmed-placement")).toContainText("새 형식 그대로 보존");
      await expect(page.getByTestId("confirmed-keepsake")).toContainText("그대로 보존");
      await expect(page.getByRole("button", { name: "환영 바람개비 고르기" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "남긴 문양 제거" })).toBeDisabled();

      expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
      expect(await page.evaluate(() => (window as unknown as { e932Writes: number }).e932Writes)).toBe(0);

      const retry = page.getByRole("button", { name: "저장된 상태 확인" });
      await retry.click();
      await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "unsupported");
      expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
      expect(await page.evaluate(() => (window as unknown as { e932Writes: number }).e932Writes)).toBe(0);

      await page.setViewportSize({ width: 320, height: 568 });
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await page.emulateMedia({ forcedColors: "active" });

      await identity.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(identity).toHaveCSS("border-left-style", "solid");

      await retry.scrollIntoViewIfNeeded();

      // :focus-visible is a keyboard-modality claim. Programmatic focus alone
      // does not guarantee it, so reach the recovery action through real Tab input.
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      for (let index = 0; index < 30; index++) {
        if (await retry.evaluate((element) => element === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }

      await expect(retry).toBeFocused();
      await expect(retry).toHaveCSS("outline-style", "solid");

      await page.emulateMedia({ forcedColors: "none" });
    } finally {
      await context.close();
    }
  }
});

test("#932 account read failure remains account-unavailable and never falls back to browser", async ({ page }) => {
  const account = await accountRoute(page, "read-error");
  await page.goto("/?experience=e2&view=classic&storage=account");

  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "unavailable");
  const identity = page.getByTestId("placeable-state-identity");
  await expect(identity).toHaveAttribute("data-state", "unavailable");
  await expect(identity).toHaveAttribute("data-storage", "account");
  await expect(identity).toContainText("계정 공간을 지금 안전하게 확인하거나 변경할 수 없어요");
  await expect(identity).toContainText("비어 있다는 뜻은 아니에요");

  await expect(page.getByTestId("storage-label")).toContainText("계정 공간에 저장");
  await expect(page.getByTestId("confirmed-placement")).toHaveText("저장 상태: 아직 확인 전");
  expect(account.puts).toBe(0);
  expect(await readLocal(page)).toBeNull();
});

test("#932 companion representation failure preserves confirmed cosmetics and performs no repair write", async ({ page }) => {
  const snapshot = await saved({
    operationId: "00000000-0000-4000-8000-000000000932",
    expectedRevision: 3,
    schemaVersion: "placeable.v2",
    layoutId: "e1-plaza.v2",
    selection: {
      pinwheel: { assetId: "welcome-pinwheel-v1", color: "teal", socketId: "gate-right" },
      keepsake: "quiet-moon-v1",
    },
  });

  await page.addInitScript(({ key, snapshot }) => {
    localStorage.setItem(key, JSON.stringify(snapshot));
    const original = Storage.prototype.setItem;
    Object.assign(window, { e932Writes: 0 });
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as unknown as { e932Writes: number }).e932Writes++;
      return original.call(this, name, value);
    };
  }, { key: STORAGE_KEY, snapshot });

  await page.route("**/companion/v1/**", route => route.abort("failed"));
  await page.goto(companionRoute);

  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute("data-companion-pose", "unavailable", { timeout: 15000 });
  await expect(world).toHaveAttribute("data-color", "teal");
  await expect(world).toHaveAttribute("data-socket", "gate-right");
  await expect(world).toHaveAttribute("data-keepsake", "quiet-moon-v1");

  await expect(page.getByTestId("companion-response")).toContainText("동반자 모습만 지금 불러오지 못했어요");
  await expect(page.getByTestId("companion-response")).toContainText("꾸미기 상태가 바뀌지는 않아요");
  await expect(page.getByTestId("save-status")).toContainText("이 브라우저에 저장된 꾸미기예요");
  await expect(page.getByTestId("placeable-state-identity")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "오늘의 기록으로 가기" })).toBeVisible();

  expect(await readLocal(page)).toEqual(snapshot);
  expect(await page.evaluate(() => (window as unknown as { e932Writes: number }).e932Writes)).toBe(0);
});
