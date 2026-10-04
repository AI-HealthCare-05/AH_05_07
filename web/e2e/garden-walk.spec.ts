import { expect, test, type Page } from "@playwright/test";
import { Raycaster, Vector2 } from "three";
import { GardenScene } from "../src/placeable/gardenScene";
import { STORAGE_KEY } from "../src/placeable/persistence";

// Real production-preview interaction. No /src dynamic import, extra browser
// renderer, runtime instrumentation port or production debug state is needed.
test.use({ video: "on", viewport: { width: 1366, height: 900 } });
const plazaRoute = "/?experience=e2&view=3d&storage=browser";
const garden = (page: Page) => page.getByTestId("garden-nook");
const canvas = (page: Page) => page.getByTestId("garden-canvas");
const approach = (page: Page) => page.getByRole("button", { name: "정자 앞으로 이동하기", exact: true });
const rest = (page: Page) => page.getByRole("button", { name: "여기서 잠깐 쉬기", exact: true });
const leave = (page: Page) => page.getByRole("button", { name: "광장으로 돌아가기", exact: true });

type WriteWitness = { gardenCosmeticWrites: number };
async function observeWrites(page: Page) {
  let apiWrites = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/v1/cosmetics/placeable"
      && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) apiWrites++;
  });
  await page.addInitScript(key => {
    const witness = window as unknown as WriteWitness;
    witness.gardenCosmeticWrites = 0;
    const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) witness.gardenCosmeticWrites++;
      return set.call(this, name, value);
    };
    Storage.prototype.removeItem = function (name) {
      if (name === key) witness.gardenCosmeticWrites++;
      return remove.call(this, name);
    };
    const clear = Storage.prototype.clear;
    Storage.prototype.clear = function () {
      witness.gardenCosmeticWrites++;
      return clear.call(this);
    };
  }, STORAGE_KEY);
  return async () => {
    expect(apiWrites).toBe(0);
    expect(await page.evaluate(() => (window as unknown as WriteWitness).gardenCosmeticWrites)).toBe(0);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  };
}

async function enter(page: Page, expected = /idle|neutral/) {
  await page.goto(plazaRoute);
  await page.getByRole("button", { name: "정원 쉼터로 가기", exact: true }).click();
  await expect(garden(page)).toHaveAttribute("data-companion-pose", expected, { timeout: 20000 });
  await expect(canvas(page)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
}

// Node-side geometry finds a real authored pavilion hit on the unchanged fixed
// camera. This is not a test hook in the application and never loads browser TS.
async function pavilionTarget(page: Page) {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error("Garden canvas is not visible");
  const scene = new GardenScene();
  try {
    scene.resize(box.width / box.height);
    scene.scene.updateMatrixWorld(true);
    const ray = new Raycaster();
    for (const y of [0.15, 0.3, 0, 0.45, -0.15]) {
      for (const x of [0, -0.1, 0.1, -0.2, 0.2]) {
        ray.setFromCamera(new Vector2(x, y), scene.camera);
        if (ray.intersectObject(scene.pavilion, true).length) {
          return { x: box.x + (x + 1) * box.width / 2, y: box.y + (1 - y) * box.height / 2 };
        }
      }
    }
    throw new Error("No unobstructed authored pavilion raycast target found");
  } finally { scene.dispose(); }
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate(value => {
    Object.defineProperty(document, "hidden", { configurable: true, value });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test("Garden walk/rest keyboard travel uses move, stops on release and does not walk into a wall", async ({ page }) => {
  const noWrites = await observeWrites(page);
  await enter(page);
  await canvas(page).focus();
  await page.keyboard.down("ArrowUp");
  try {
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "move");
    await expect(page.getByTestId("garden-response")).toContainText("걷고 있어요");
    await page.screenshot({ path: test.info().outputPath("garden-walking.png"), scale: "css" });
  } finally { await page.keyboard.up("ArrowUp"); }
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");

  await canvas(page).focus();
  await page.keyboard.down("ArrowLeft");
  try {
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "move");
    // The same key remains down. Only actual post-clamp travel may drive gait.
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle", { timeout: 6000 });
  } finally { await page.keyboard.up("ArrowLeft"); }
  await noWrites();
});

test("Garden walk/rest explicit rest consumes held keys and returns only to fresh input", async ({ page }) => {
  const noWrites = await observeWrites(page);
  await enter(page);
  await approach(page).click();
  await expect(garden(page)).toHaveAttribute("data-at-pavilion", "true");
  await canvas(page).focus();
  await page.keyboard.down("ArrowRight");
  try {
    // Rest is an intentional command; it can stop a walk at the pavilion.
    await page.keyboard.press("Enter");
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "rest");
    await expect(page.getByRole("button", { name: "정원에서 드래그하거나 방향키로 걷기", exact: true }))
      .toBeDisabled();
    await page.keyboard.press("Enter");
    await page.screenshot({ path: test.info().outputPath("garden-resting.png"), scale: "css" });
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle", { timeout: 6000 });
    // Model the OS repeat of the key that was held through the rest. It is not
    // a fresh keydown and must not resurrect cleared movement intent.
    await canvas(page).dispatchEvent("keydown", { code: "ArrowRight", key: "ArrowRight", repeat: true });
    await page.waitForTimeout(200);
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");
    await expect(garden(page)).toHaveAttribute("data-at-pavilion", "true");
  } finally { await page.keyboard.up("ArrowRight"); }
  await page.keyboard.down("ArrowDown");
  try { await expect(garden(page)).toHaveAttribute("data-companion-pose", "move"); }
  finally { await page.keyboard.up("ArrowDown"); }
  await noWrites();
});

test("Garden walk/rest a dragged pavilion does not rest; a deliberate tap does", async ({ page }) => {
  const noWrites = await observeWrites(page);
  await enter(page);
  await approach(page).click();
  const point = await pavilionTarget(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  // Return to the starting point: total gesture history, not release distance,
  // determines that this was a drag rather than a tap.
  await page.mouse.move(point.x + 70, point.y + 8, { steps: 6 });
  await page.mouse.move(point.x, point.y, { steps: 6 });
  await page.mouse.up();
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");
  await expect(page.getByTestId("garden-response")).not.toContainText("쉬었어요");
  await page.mouse.click(point.x, point.y);
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "rest");
  await noWrites();
});

test("Garden walk/rest blur and hidden-page interruption do not replay motion or old rest", async ({ page }) => {
  const noWrites = await observeWrites(page);
  await enter(page);
  await canvas(page).focus();
  await page.keyboard.down("ArrowUp");
  try {
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "move");
    await leave(page).focus();
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");
    await canvas(page).focus();
    await canvas(page).dispatchEvent("keydown", { code: "ArrowUp", key: "ArrowUp", repeat: true });
    await page.waitForTimeout(150);
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");
  } finally { await page.keyboard.up("ArrowUp"); }

  await approach(page).click();
  await rest(page).click();
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "rest");
  await setHidden(page, true);
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "neutral");
  await setHidden(page, false);
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");
  await page.waitForTimeout(200);
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");
  await rest(page).click();
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "rest");
  await noWrites();
});

for (const width of [390, 320]) test(`Garden walk/rest ${width}px touch walk, static rest and semantic return`, async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    viewport: { width, height: 844 }, hasTouch: true, isMobile: true,
    recordVideo: { dir: test.info().outputPath(`touch-video-${width}`) },
  });
  const page = await context.newPage();
  try {
    const noWrites = await observeWrites(page);
    await enter(page);
    const pad = page.getByRole("button", { name: "정원에서 드래그하거나 방향키로 걷기", exact: true });
    const rect = await pad.boundingBox();
    if (!rect) throw new Error("Garden walking pad is unavailable");
    const cdp = await context.newCDPSession(page);
    const finger = { id: 1, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger] });
    finger.y -= rect.height * 0.3;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [finger] });
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "move");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");
    await approach(page).tap();
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "neutral");
    await expect(garden(page)).toHaveAttribute("data-reduced-motion", "true");
    await rest(page).tap();
    await expect(page.getByTestId("garden-response")).toContainText("잠깐 쉬었어요");
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "neutral");
    await expect(leave(page)).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`garden-touch-static-${width}.png`), scale: "css" });
    await noWrites();
    await leave(page).tap();
    await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
    await expect(page.getByRole("button", { name: "정원 쉼터로 가기", exact: true })).toBeFocused();
    await noWrites();
  } finally { await context.close(); }
});

test("Garden walk/rest renderer retry drops old input and retains independent exits", async ({ page }) => {
  const noWrites = await observeWrites(page);
  await enter(page);
  await canvas(page).focus();
  await page.keyboard.down("ArrowUp");
  try {
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "move");
    await canvas(page).evaluate((element: HTMLCanvasElement) => {
      const loss = element.getContext("webgl2")?.getExtension("WEBGL_lose_context");
      if (!loss) throw new Error("WebGL loss testing extension is unavailable");
      loss.loseContext();
    });
    await expect(page.getByRole("alert")).toContainText("정원 쉼터를 열지 못했어요");
    await expect(leave(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "오늘의 기록으로 가기", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "정원 다시 열기", exact: true }).click();
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle", { timeout: 20000 });
    await expect(garden(page)).toHaveAttribute("data-at-pavilion", "false");
    await expect(page.locator("canvas")).toHaveCount(1);
    await canvas(page).focus();
    await canvas(page).dispatchEvent("keydown", { code: "ArrowUp", key: "ArrowUp", repeat: true });
    await page.waitForTimeout(150);
    await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle");
  } finally { await page.keyboard.up("ArrowUp"); }
  await approach(page).click();
  await rest(page).click();
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "rest");
  await noWrites();
  await leave(page).click();
  await page.getByRole("button", { name: "정원 쉼터로 가기", exact: true }).click();
  await expect(garden(page)).toHaveAttribute("data-companion-pose", "idle", { timeout: 20000 });
  await expect(garden(page)).toHaveAttribute("data-at-pavilion", "false");
  await noWrites();
});

test("Garden walk/rest unavailable companion never fakes rest or blocks the semantic approach", async ({ page }) => {
  const noWrites = await observeWrites(page);
  await page.route("**/companion/v1/**", route => route.abort("failed"));
  await enter(page, /unavailable/);
  await expect(approach(page)).toBeEnabled();
  await approach(page).click();
  await expect(garden(page)).toHaveAttribute("data-at-pavilion", "true");
  await expect(rest(page)).toBeDisabled();
  await expect(page.getByTestId("garden-response")).toContainText("지금은 동반자를 볼 수 없어요");
  await expect(leave(page)).toBeEnabled();
  await noWrites();
});
