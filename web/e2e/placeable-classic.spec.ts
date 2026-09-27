import { expect, test, type Page } from "@playwright/test";
import { emptySnapshot, fingerprint, type Operation, type Snapshot } from "../src/placeable/contract";
import { STORAGE_KEY } from "../src/placeable/persistence";
import { PlaceableScene } from "../src/placeable/worldScene";
import { Vector3 } from "three";
import { getMySpaceCompanion } from "../src/ui/mySpaceCompanion";

const browserRoute = "/?experience=e2&view=classic&storage=browser";
const saved = async (op: Operation): Promise<Snapshot> => ({ ...emptySnapshot(), revision: op.expectedRevision + 1,
  schemaVersion: op.schemaVersion, layoutId: op.layoutId, selection: op.selection, latestOperationId: op.operationId, latestFingerprint: await fingerprint(op) });
const readLocal = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), STORAGE_KEY);
const confirm = async (page: Page) => {
  await page.getByRole("button", { name: "Confirm placement", exact: true }).click();
  await expect(page.getByTestId("save-status")).toContainText("Saved");
};

const companionRoute = "/?experience=e2&view=3d&storage=browser";
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
  await button.focus(); await page.keyboard.press("Enter"); await expect(world).toHaveAttribute("data-companion-pose", "greet");
  await expect(world).toHaveAttribute("data-companion-pose", "idle", { timeout: 10000 });
  await expect(page.getByTestId("companion-response")).toContainText("인사를 나눴어요");
  expect(await readLocal(page)).toEqual(before);
  expect(await page.evaluate(() => (window as unknown as { e5Writes: string[] }).e5Writes)).toEqual(initialWrites);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
  await expect(world).toHaveAttribute("data-keepsake", "quiet-moon-v1");
  await expect(world).toHaveAttribute("data-color", "teal");
  await page.getByRole("button", { name: "Spin pinwheel", exact: true }).click();
  await expect(page.getByTestId("placeable-feedback")).toContainText("Your pinwheel answers");
  await page.getByRole("link", { name: "Classic plaza", exact: true }).click();
  await expect(page.getByTestId("classic-keepsake")).toBeVisible();
  await page.getByRole("link", { name: "Enter 3D plaza" }).click();
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
  await expect(page.getByTestId("companion-response")).toContainText("Today Gate");
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  expect(await readLocal(page)).toBeNull();
  await page.getByRole("button", { name: "Choose welcome pinwheel" }).click(); await confirm(page);
  await page.getByRole("button", { name: "Spin pinwheel", exact: true }).click();
  await expect(page.getByTestId("placeable-feedback")).toContainText("Your pinwheel answers");
  const before = await readLocal(page);
  await expect(page.getByRole("link", { name: /Classic Today/ })).toHaveAttribute("aria-disabled", "false");
  await page.getByRole("link", { name: "Classic plaza", exact: true }).click();
  await expect(page.getByTestId("classic-pinwheel")).toBeVisible(); expect(await readLocal(page)).toEqual(before);
});

test("browser experience previews, cancels, confirms, interacts, leaves/returns, moves, recolors and removes", async ({ page }) => {
  await page.goto(browserRoute);
  await expect(page.getByTestId("storage-label")).toContainText("this browser and site, not your account");
  await expect(page.getByTestId("confirmed-placement")).toHaveText("Confirmed: Unplaced");
  expect(await readLocal(page)).toBeNull();
  await page.getByRole("button", { name: "Choose welcome pinwheel" }).click();
  await expect(page.getByTestId("classic-plaza")).toHaveAttribute("data-preview", "true");
  await expect(page.getByTestId("classic-pinwheel")).toBeVisible();
  expect(await readLocal(page)).toBeNull();
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await expect(page.getByTestId("classic-pinwheel")).toHaveCount(0);
  await page.getByRole("button", { name: "Choose welcome pinwheel" }).click(); await confirm(page);
  const first = await readLocal(page);
  await page.getByRole("button", { name: "Spin pinwheel", exact: true }).click();
  await expect(page.getByTestId("placeable-feedback")).toHaveText("A plaza breeze. Your pinwheel answers.");
  expect(await readLocal(page)).toEqual(first);
  await page.getByRole("button", { name: "Gate right", exact: true }).click();
  await expect(page.locator(".pinwheel-spin")).toHaveCount(0);
  await expect(page.getByTestId("save-status")).not.toContainText("Saved");
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await page.getByRole("link", { name: "Leave plaza" }).click(); await page.goto(browserRoute);
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "coral");
  await page.getByRole("button", { name: "Gate right", exact: true }).click();
  await page.getByRole("button", { name: "teal", exact: true }).click();
  expect(await readLocal(page)).toEqual(first); await confirm(page); await page.reload();
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-socket", "gate-right");
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "teal");
  await page.getByRole("button", { name: "Remove pinwheel" }).click(); await confirm(page); await page.reload();
  await expect(page.getByTestId("confirmed-placement")).toHaveText("Confirmed: Unplaced");
  expect((await readLocal(page)).revision).toBe(3);
});

test("Classic keyboard, reduced motion and unavailable audio retain visual interaction", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: undefined });
  });
  await page.goto(browserRoute);
  const choose = page.getByRole("button", { name: "Choose welcome pinwheel" });
  await expect(choose).toBeEnabled(); await choose.focus(); await page.keyboard.press("Enter");
  await confirm(page);
  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect(page.getByTestId("audio-status")).toContainText("unavailable");
  await page.getByRole("button", { name: "Spin pinwheel", exact: true }).click();
  await expect(page.getByTestId("placeable-feedback")).toContainText("Your pinwheel answers");
  await expect(page.locator(".pinwheel-spin")).toHaveCSS("animation-name", "none");
});

test("3D uses the same saved value, previews actual sockets, pauses controls and supports reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(browserRoute);
  await page.getByRole("button", { name: "Choose welcome pinwheel" }).click(); await confirm(page);
  await page.getByRole("link", { name: "Enter 3D plaza" }).click();
  const world = page.getByTestId("placeable-world"), canvas = page.getByTestId("placeable-world-canvas");
  await expect(canvas).toBeVisible(); await expect(world).toHaveAttribute("data-color", "coral");
  await expect(world).toHaveAttribute("data-reduced-motion", "true");
  await canvas.focus(); await expect(world).toHaveAttribute("data-suspended", "false");
  const first = await readLocal(page); await page.keyboard.press("Enter");
  await expect(page.getByTestId("placeable-feedback")).toContainText("Your pinwheel answers");
  expect(await readLocal(page)).toEqual(first);
  await page.getByRole("button", { name: "Plaza edge", exact: true }).click();
  await page.getByRole("button", { name: "sunflower", exact: true }).click();
  await expect(world).toHaveAttribute("data-preview", "true");
  await expect(world).toHaveAttribute("data-socket", "plaza-edge");
  await expect(world).toHaveAttribute("data-suspended", "true");
  await expect(page.getByRole("button", { name: "Drag to walk", exact: false })).toBeDisabled();
  expect(await readLocal(page)).toEqual(first); await confirm(page); await page.reload();
  await expect(world).toHaveAttribute("data-color", "sunflower");
  await expect(world).toHaveAttribute("data-socket", "plaza-edge");
  await page.getByRole("link", { name: "Classic plaza", exact: true }).click();
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
  await page.getByRole("button", { name: "Choose welcome pinwheel" }).click(); await confirm(page);
  const before = await readLocal(page);
  await page.getByRole("link", { name: "Enter 3D plaza" }).click();
  const canvas = page.getByTestId("placeable-world-canvas"); await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Context-loss exercise needs WEBGL_lose_context");
    extension.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D plaza could not start");
  await expect(canvas).toHaveCount(0); expect(await readLocal(page)).toEqual(before);
  await page.getByRole("button", { name: "Retry 3D" }).click(); await expect(canvas).toBeVisible();
  expect(await readLocal(page)).toEqual(before);
});

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS" };
async function accountRoute(page: Page, behavior: "conflict" | "unknown" | "read-error" | "normal") {
  const owner = "00000000-0000-4000-8000-000000000810";
  const user = { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const token = [Buffer.from('{"alg":"none"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: owner, exp: 4102444800 })).toString("base64url"), "synthetic"].join(".");
  await page.addInitScript(({ token, user }) => localStorage.setItem("sb-e2e-auth-token", JSON.stringify({
    access_token: token, refresh_token: "synthetic-refresh", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user,
  })), { token, user });
  await page.route("https://e2e.invalid/auth/v1/**", (route) => route.fulfill({ status: route.request().method() === "OPTIONS" ? 204 : 200,
    headers: cors, contentType: "application/json", body: route.request().method() === "OPTIONS" ? "" : JSON.stringify(user) }));
  let snapshot = emptySnapshot(), puts = 0, reads = 0;
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (request.method() === "GET") {
      reads++;
      return route.fulfill({ status: behavior === "read-error" && reads === 1 ? 503 : 200, headers: cors, contentType: "application/json",
        body: JSON.stringify(behavior === "read-error" && reads === 1 ? { detail: { code: "read_unavailable" } } : snapshot) });
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
  return { get puts() { return puts; }, get reads() { return reads; } };
}

for (const behavior of ["conflict", "unknown", "read-error"] as const) {
  test(`verified account ${behavior} keeps browser storage separate and requires confirmation`, async ({ page }) => {
    const account = await accountRoute(page, behavior);
    await page.goto("/?experience=e2&view=classic&storage=account");
    await expect(page.getByTestId("storage-label")).toContainText("Account storage");
    if (behavior === "read-error") {
      await expect(page.getByTestId("save-status")).toContainText("unavailable");
      await page.getByRole("button", { name: "Check saved state" }).click();
    }
    await page.getByRole("button", { name: "Choose welcome pinwheel" }).click();
    await page.getByRole("button", { name: "Confirm placement", exact: true }).click();
    if (behavior === "conflict") {
      await expect(page.getByTestId("save-status")).toContainText("newer placement");
      expect(account.puts).toBe(1);
      await page.getByRole("button", { name: "Keep preview and use latest revision" }).click(); await confirm(page);
    }
    await expect(page.getByTestId("save-status")).toHaveText("Saved to your account.");
    expect(account.puts).toBe(behavior === "conflict" ? 2 : 1);
    if (behavior === "unknown") expect(account.reads).toBe(2);
    expect(await readLocal(page)).toBeNull();
  });
}


// The new experience uses this existing suite, which nightly-core already runs.
// These API/session fixtures prove client behavior, not live account integration.
async function classicTodaySession(page: Page, actionId: string | null = null) {
  const account = await accountRoute(page, "normal");
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
    await expect(page.getByTestId("confirmed-placement")).toHaveText("Confirmed: Unplaced");
    await page.getByRole("button", { name: "Choose welcome pinwheel" }).click(); await confirm(page);
    await page.getByRole("button", { name: "Gate right", exact: true }).click();
    await page.getByRole("button", { name: "teal", exact: true }).click(); await confirm(page);
    const stored = await readLocal(page), writes = account.puts;
    await page.reload(); await expect(world).toHaveAttribute("data-choice", choice);
    await expect(world).toHaveAttribute("data-color", "teal");
    await expect(world).toHaveAttribute("data-socket", "gate-right");
    await page.getByRole("link", { name: "Classic plaza", exact: true }).click();
    await expect(page.getByTestId("classic-living-choice")).toHaveAttribute("data-choice", choice);
    await page.getByRole("link", { name: "Classic Today" }).click(); await expectClassicToday(page);
    await page.getByRole("link", { name: "Return to My Space" }).click();
    await expect(page.getByTestId("classic-living-choice")).toHaveCount(0);
    await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "teal");
    expect(await readLocal(page)).toEqual(stored); expect(account.puts).toBe(writes);
    expect(JSON.stringify(stored)).not.toContain("living_choice");
    await page.getByRole("button", { name: "Remove pinwheel" }).click(); await confirm(page);
    await expect(page.getByTestId("confirmed-placement")).toHaveText("Confirmed: Unplaced");
  });
}

test("no active choice and forged hints preserve the default plaza on direct entry and refresh", async ({ page }) => {
  await classicTodaySession(page);
  await page.goto("/?screen=S02&return_space=3d-browser"); await expectClassicToday(page);
  await expect(page.getByRole("link", { name: "이 선택을 내 공간에 가져가기" })).toHaveCount(0);
  await page.getByRole("link", { name: "Return to My Space" }).click();
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
  await expect(page.getByRole("alert")).toContainText("3D plaza could not start");
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "ready");
  await page.getByRole("link", { name: "Classic plaza", exact: true }).click();
  await expect(page.getByTestId("classic-living-choice")).toHaveAttribute("data-choice", "sleep-routine");
  await page.getByRole("button", { name: "Choose welcome pinwheel" }).click(); await confirm(page);
  await page.getByRole("link", { name: "Classic Today" }).click(); await expectClassicToday(page);
  await page.getByRole("link", { name: "Return to My Space" }).click();
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
    const pad = page.getByRole("button", { name: "Drag to walk" });
    await pad.tap(); await expect(world).toHaveAttribute("data-suspended", "false");
    const cdp = await context.newCDPSession(page), box = (await pad.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x + 15, y: point.y - 15 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.getByRole("button", { name: "Choose welcome pinwheel" }).tap();
    await page.getByRole("button", { name: "Confirm placement", exact: true }).tap();
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    await page.getByRole("button", { name: "Spin pinwheel", exact: true }).tap();
    await expect(page.getByTestId("placeable-feedback")).toContainText("Your pinwheel answers");
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
    await page.getByRole("button", { name: "Choose welcome pinwheel" }).click();
    await page.getByRole("button", { name: "teal", exact: true }).click();
    await page.getByRole("button", { name: "Gate right", exact: true }).click();
    await expect(page.getByRole("link", { name: "Classic Today" })).toHaveAttribute("aria-disabled", "true");
    await confirm(page);
    const local = await readLocal(page), writes = account.puts, reads = account.reads;
    await page.getByRole("link", { name: "Classic Today" }).focus(); await page.keyboard.press("Enter");
    await expectClassicToday(page);
    await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
    const back = page.getByRole("link", { name: "Return to My Space" });
    await expect(back).toHaveAttribute("href", `?experience=e2&view=3d&storage=${mode}`);
    await back.focus(); await page.keyboard.press("Enter");
    const world = page.getByTestId("placeable-world");
    await expect(world).toHaveAttribute("data-color", "teal");
    await expect(world).toHaveAttribute("data-socket", "gate-right");
    await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-mode", mode);
    expect(await readLocal(page)).toEqual(local); expect(account.puts).toBe(writes);
    expect(account.reads).toBe(mode === "account" ? reads + 1 : 0);
    await page.getByRole("button", { name: "Spin pinwheel", exact: true }).click();
    await expect(page.getByTestId("placeable-feedback")).toContainText("Your pinwheel answers");
    await page.getByRole("button", { name: "Plaza edge", exact: true }).click();
    await page.getByRole("button", { name: "coral", exact: true }).click(); await confirm(page);
    await expect(world).toHaveAttribute("data-socket", "plaza-edge");
    await expect(world).toHaveAttribute("data-color", "coral");
    await page.getByRole("button", { name: "Remove pinwheel" }).click(); await confirm(page);
    await expect(world).toHaveAttribute("data-color", "unplaced");
  });
}

test("WebGL failure retains Classic fallback and its Today return path", async ({ page }) => {
  await classicTodaySession(page);
  await page.goto(browserRoute);
  await page.getByRole("button", { name: "Choose welcome pinwheel" }).click(); await confirm(page);
  const local = await readLocal(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.getByRole("link", { name: "Enter 3D plaza" }).click();
  await expect(page.getByRole("alert")).toContainText("3D plaza could not start");
  await page.getByRole("link", { name: "Classic plaza", exact: true }).click();
  await page.getByRole("link", { name: "Classic Today" }).click();
  await expectClassicToday(page);
  await page.getByRole("link", { name: "Return to My Space" }).click();
  await expect(page.getByTestId("classic-pinwheel")).toHaveAttribute("data-color", "coral");
  expect(await readLocal(page)).toEqual(local);
});

test("signed-out Today keeps a semantic return; an account return never falls back to browser", async ({ page }) => {
  await page.goto(browserRoute);
  await page.getByRole("link", { name: "Classic Today" }).click();
  await expect(page.getByRole("link", { name: "Return to My Space" })).toBeVisible();
  await page.getByRole("link", { name: "Return to My Space" }).click();
  await expect(page.getByTestId("confirmed-placement")).toHaveText("Confirmed: Unplaced");
  await page.goto("/?screen=S02&return_space=3d-account");
  await page.getByRole("link", { name: "Return to My Space" }).click();
  await expect(page.getByRole("status")).toContainText("Sign in to use account storage");
  await expect(page.getByTestId("placeable-experience")).toHaveCount(0);
  expect(await readLocal(page)).toBeNull();
});

test.describe("touch return", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("touch Classic round trip stays muted, reduced-motion and usable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await classicTodaySession(page);
    await page.goto(browserRoute);
    await page.getByRole("button", { name: "Choose welcome pinwheel" }).tap();
    await page.getByRole("button", { name: "Confirm placement", exact: true }).tap();
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    const local = await readLocal(page);
    await page.getByRole("link", { name: "Classic Today" }).tap();
    await expectClassicToday(page);
    await page.getByRole("link", { name: "Return to My Space" }).tap();
    await page.getByRole("button", { name: "Spin pinwheel", exact: true }).tap();
    await expect(page.getByTestId("audio-status")).toHaveText("Sound: muted");
    await expect(page.locator(".pinwheel-spin")).toHaveCSS("animation-name", "none");
    expect(await readLocal(page)).toEqual(local);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});


test("Today return is absent while editing a record and survives the existing in-app back path", async ({ page }) => {
  await classicTodaySession(page);
  await page.goto("/?screen=S02&return_space=classic-browser");
  await expectClassicToday(page);
  await expect(page.getByRole("link", { name: "Return to My Space" })).toBeVisible();
  await page.locator('button[data-home-destination="S04"]').click();
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to My Space" })).toHaveCount(0);
  await page.getByRole("button", { name: "SK7 · 하루의 사실을 차분하게 · 오늘의 기록으로 이동", exact: true }).click();
  await expect(page.getByRole("link", { name: "Return to My Space" })).toBeVisible();
});

test("UNKNOWN cannot announce a breeze or hand off an unresolved write", async ({ page }) => {
  await accountRoute(page, "normal");
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (route.request().method() === "PUT") return route.abort("failed");
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(emptySnapshot()) });
  });
  await page.goto("/?experience=e2&view=classic&storage=account");
  await page.getByRole("button", { name: "Choose welcome pinwheel" }).click();
  await page.getByRole("button", { name: "Confirm placement", exact: true }).click();
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-phase", "unknown");
  await expect(page.getByTestId("save-status")).not.toContainText("Saved");
  await expect(page.getByRole("link", { name: "Classic Today" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Spin pinwheel", exact: true })).toBeDisabled();
  await expect(page.getByTestId("placeable-feedback")).not.toContainText("answers");
  await expect(page.getByRole("button", { name: "Check saved state" })).toBeEnabled();
});

const keepsakeCases = [
  ["walk-10-minutes", "plaza-ribbon-v1", "광장의 리본"],
  ["sleep-routine", "quiet-moon-v1", "고요한 달"],
  ["low-sodium-meal", "garden-leaf-v1", "정원의 잎"],
] as const;
for (const [choice, asset, label] of keepsakeCases) {
  test(`E4 ${asset}: keep migrates v1, restores without hint, coexists and removes`, async ({ page }) => {
    await page.goto(`${browserRoute}&living_choice=${choice}`);
    await page.getByRole("button", { name: "Choose welcome pinwheel" }).click(); await confirm(page);
    const v1 = await readLocal(page); expect(v1.schemaVersion).toBe("placeable.v1");
    await page.getByRole("button", { name: "이 문양을 내 공간에 남기기" }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByTestId("keepsake-preview")).toContainText(label); expect(await readLocal(page)).toEqual(v1);
    await page.getByRole("button", { name: "Confirm placement", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByTestId("save-status")).toContainText("Saved");
    const stored = await readLocal(page);
    expect(stored).toMatchObject({ revision: 2, schemaVersion: "placeable.v2", selection: { pinwheel: v1.selection, keepsake: asset } });
    expect(JSON.stringify(stored)).not.toContain(choice);
    await page.getByRole("link", { name: "Leave plaza" }).click(); await page.goto(browserRoute); await page.reload();
    await expect(page.getByTestId("classic-keepsake")).toHaveAttribute("data-asset", asset);
    await expect(page.getByTestId("classic-pinwheel")).toBeVisible();
    await expect(page.getByTestId("confirmed-keepsake")).toHaveText(label);
    await page.getByRole("button", { name: "남긴 문양 제거" }).click(); expect(await readLocal(page)).toEqual(stored);
    await confirm(page); await page.reload();
    await expect(page.getByTestId("classic-keepsake")).toHaveCount(0);
    await expect(page.getByTestId("classic-pinwheel")).toBeVisible();
    expect((await readLocal(page)).selection).toEqual({ pinwheel: v1.selection, keepsake: null });
  });
}
test("E4 replacement and WebGL failure retain keepsake with Classic removal", async ({ page }) => {
  await page.goto(`${browserRoute}&living_choice=walk-10-minutes`);
  await page.getByRole("button", { name: "이 문양을 내 공간에 남기기" }).click(); await confirm(page);
  await page.goto(`${browserRoute}&living_choice=sleep-routine`);
  await expect(page.getByTestId("classic-keepsake")).toHaveAttribute("data-asset", "plaza-ribbon-v1");
  await page.getByRole("button", { name: "이 문양으로 바꾸기" }).click();
  await expect(page.getByTestId("classic-keepsake")).toHaveAttribute("data-asset", "quiet-moon-v1"); await confirm(page);
  await page.getByRole("link", { name: "Enter 3D plaza" }).click();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-keepsake", "quiet-moon-v1");
  const canvas = page.getByTestId("placeable-world-canvas"); await expect(canvas).toBeVisible(); const before = await readLocal(page);
  await canvas.evaluate((element) => (element as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
  await expect(page.getByRole("alert")).toContainText("3D plaza could not start");
  await page.getByRole("link", { name: "Classic plaza", exact: true }).click();
  await expect(page.getByTestId("confirmed-keepsake")).toHaveText("고요한 달"); expect(await readLocal(page)).toEqual(before);
  await page.getByRole("button", { name: "남긴 문양 제거" }).click(); await confirm(page);
  expect((await readLocal(page)).selection.keepsake).toBeNull();
});
for (const behavior of ["normal", "conflict", "unknown"] as const) {
  test(`E4 account ${behavior}: keep/reload stays separate from browser snapshot`, async ({ page }) => {
    const account = await accountRoute(page, behavior);
    await page.goto(`${browserRoute}&living_choice=walk-10-minutes`);
    await page.getByRole("button", { name: "이 문양을 내 공간에 남기기" }).click(); await confirm(page); const local = await readLocal(page);
    await page.goto("/?experience=e2&view=classic&storage=account&living_choice=sleep-routine");
    await page.getByRole("button", { name: "이 문양을 내 공간에 남기기" }).click();
    await page.getByRole("button", { name: "Confirm placement", exact: true }).click();
    if (behavior === "conflict") {
      await expect(page.getByTestId("save-status")).toContainText("newer placement");
      await page.getByRole("button", { name: "Keep preview and use latest revision" }).click(); await confirm(page);
    } else await expect(page.getByTestId("save-status")).toContainText("Saved to your account");
    await page.reload(); await expect(page.getByTestId("confirmed-keepsake")).toHaveText("고요한 달");
    expect(await readLocal(page)).toEqual(local); expect(account.puts).toBe(behavior === "conflict" ? 2 : 1);
  });
}
test("E4 touch and reduced motion: keep/remove stays muted and fits narrow screen", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(`${browserRoute}&living_choice=low-sodium-meal`);
    await page.getByRole("button", { name: "이 문양을 내 공간에 남기기" }).tap();
    await page.getByRole("button", { name: "Confirm placement", exact: true }).tap();
    await expect(page.getByTestId("confirmed-keepsake")).toHaveText("정원의 잎");
    await expect(page.getByTestId("audio-status")).toHaveText("Sound: muted");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "남긴 문양 제거" }).tap(); await page.getByRole("button", { name: "Confirm placement", exact: true }).tap();
    await expect(page.getByTestId("confirmed-keepsake")).toHaveText("아직 남긴 문양이 없어요.");
  } finally { await context.close(); }
});
