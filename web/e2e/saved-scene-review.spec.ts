import "./journey-candidate.cases";
import { createHash } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
import { companionAssetManifest } from "../src/ui/companionAssets.generated";
import { allowsSavedScene, createSavedSceneEvent } from "../src/ui/savedScene";
import { allScreenIds } from "../src/ui/journey";
import { e2eSessionEventName } from "../src/lib/e2eHarness";

const assetUrl = companionAssetManifest.bear.lite.url;
const runtime = (page: Page) => page.locator("[data-saved-scene-status]");
const character = (page: Page) => page.locator("[data-saved-scene-renderer]");
const headers = { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS" };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

// Fetch the real, immutable GLB once before scene timers start; behavior tests
// still use the real renderer. Live transport remains covered by the existing CI step.
let assetBody: Buffer;
test.beforeAll(async ({ request }) => {
  const asset = companionAssetManifest.bear.lite;
  const response = await request.get(assetUrl, { headers: { Origin: headers["Access-Control-Allow-Origin"] } });
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).toBe(headers["Access-Control-Allow-Origin"]);
  assetBody = await response.body();
  expect(assetBody.length).toBe(asset.bytes);
  expect(createHash("sha256").update(assetBody).digest("hex")).toBe(asset.sha256);
  await response.dispose();
});

async function setup(page: Page) {
  await page.route(assetUrl, route => route.fulfill({ status: 200, headers, contentType: "model/gltf-binary", body: assetBody }));
  const state = {
    posts: 0, windows: 0, urls: [] as string[], errors: [] as string[],
    outcome: "ok" as "ok" | "unknown" | "conflict" | "invalid-json",
    saveGate: null as ReturnType<typeof deferred> | null,
    refreshGate: null as ReturnType<typeof deferred> | null,
    refreshError: false,
  };
  await page.clock.setFixedTime(new Date("2026-09-10T03:00:00Z"));
  await page.addInitScript(() => {
    let starts = 0;
    let rafs = 0;
    const mediaChanges: boolean[] = [];
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", event => mediaChanges.push(event.matches));
    const seen = new WeakSet<Element>();
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => { rafs++; return original(callback); };
    new MutationObserver(() => {
      document.querySelectorAll('[data-saved-scene-celebrate-count="1"]').forEach(node => {
        if (!seen.has(node)) { seen.add(node); starts++; }
      });
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-saved-scene-celebrate-count"] });
    Object.defineProperty(window, "__savedSceneEvidence", { value: () => ({ starts, rafs, mediaChanges }) });
  });
  page.on("request", request => state.urls.push(request.url()));
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("http://e2e.invalid/**", async route => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const url = new URL(req.url());
    if (url.pathname.endsWith("/window")) {
      state.windows++;
      if (state.posts) {
        await state.refreshGate?.promise;
        if (state.refreshError) return json(route, {}, 503);
      }
      return json(route, {
        start_on: url.searchParams.get("start_on"), end_on: url.searchParams.get("end_on"),
        blood_pressure_observations: [{ id: "synthetic-existing", observed_on: "2026-09-10", period: "morning", systolic: 118, diastolic: 76 }],
        challenge_events: [], challenge_checkins: [],
        active_challenge: { id: "synthetic-challenge", action_id: "walk-10-minutes", starts_on: "2026-09-10", ends_on: "2026-09-16", first_checkin_on: null },
      });
    }
    if (req.method() === "POST" || req.method() === "PUT") {
      state.posts++;
      await state.saveGate?.promise;
      if (state.outcome === "unknown") return route.abort("failed");
      if (state.outcome === "conflict") return json(route, { code: "observation_conflict" }, 409);
      if (state.outcome === "invalid-json") return route.fulfill({ status: 201, headers, contentType: "application/json", body: "{" });
      return json(route, { id: "synthetic-saved", ...req.postDataJSON() }, 201);
    }
    return route.abort();
  });
  return state;
}
async function openForm(page: Page) {
  await page.goto("/?e2e=signed-in&screen=S04&companion_species=cat&companion_variant=standard&companion_clip=greet");
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
}
async function submit(page: Page) { await page.getByRole("button", { name: "혈압 기록 저장" }).click(); }
async function ready(page: Page) {
  await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();
  await expect(runtime(page)).toHaveAttribute("data-saved-scene-status", "ready", { timeout: 20_000 });
  await expect(page.locator("[data-companion-status]")).toHaveCount(0);
  await expect(page.locator(".companion-runtime-slot")).toHaveCount(1);
}
async function evidence(page: Page) {
  return page.evaluate(() => (window as unknown as { __savedSceneEvidence: () => { starts: number; rafs: number; mediaChanges: boolean[] } }).__savedSceneEvidence());
}
async function expectStarts(page: Page, count: number) { await expect.poll(async () => (await evidence(page)).starts).toBe(count); }
async function hidden(page: Page, value: boolean) {
  await page.evaluate(hidden => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: hidden ? "hidden" : "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, value);
}
const glbs = (urls: string[]) => urls.filter(url => /\.glb(?:\?|$)/.test(url));
async function returnVisit(page: Page) {
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(runtime(page)).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
}

test("saved scene gate needs exact review, S05 and a host confirmation; event claim cannot repeat", () => {
  for (const screen of allScreenIds) for (const gate of [undefined, "off", "production", "Review", "review"]) {
    expect(allowsSavedScene(gate, screen, true)).toBe(gate === "review" && screen === "S05");
    expect(allowsSavedScene(gate, screen, false)).toBe(false);
  }
  const event = createSavedSceneEvent();
  expect(event.claim()).toBe(true);
  expect(event.claim()).toBe(false);
  const skipped = createSavedSceneEvent();
  skipped.skip();
  expect(skipped.claim()).toBe(false);
});

test("direct S05 query and fixture cannot create a real saved-scene event", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/?e2e=signed-in&screen=S05&companion_context=save_success");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(runtime(page)).toHaveCount(0);
  expect(state.urls.filter(url => /SavedSceneRenderer/.test(url))).toEqual([]);
  await page.goto("/?fixture=VP-10&screen=S05&companion_context=save_success");
  await expect(runtime(page)).toHaveCount(0);
});

test("persistence and refresh pending keep S04; one confirmed event settles to idle with no RAF", async ({ page }) => {
  const state = await setup(page);
  state.saveGate = deferred(); state.refreshGate = deferred();
  await openForm(page);
  await submit(page);
  await expect.poll(() => state.posts).toBe(1);
  await expect(runtime(page)).toHaveCount(0);
  expect(glbs(state.urls)).toEqual([]);
  await expect(page.getByRole("button", { name: "저장 중" })).toBeDisabled();
  state.saveGate.release();
  await expect.poll(() => state.windows).toBe(2);
  await expect(runtime(page)).toHaveCount(0);
  state.refreshGate.release();
  await ready(page);
  await expectStarts(page, 1);
  await expect(character(page)).toHaveAttribute("data-saved-scene-phase", "idle");
  await page.waitForTimeout(150);
  const before = await evidence(page);
  await page.waitForTimeout(250);
  expect((await evidence(page)).rafs).toBe(before.rafs);
  expect(glbs(state.urls)).toEqual([assetUrl]);
  expect(state.urls.filter(url => /CompanionReviewRenderer/.test(url))).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const outcome of ["unknown", "conflict", "invalid-json"] as const) {
  test(`${outcome} save never celebrates; explicit successful retry creates one event`, async ({ page }) => {
    const state = await setup(page); state.outcome = outcome;
    await openForm(page); await submit(page);
    await expect(page.getByRole("status")).toBeVisible();
    await expect(runtime(page)).toHaveCount(0);
    expect(glbs(state.urls)).toEqual([]);
    expect(state.posts).toBe(1);
    await expect(page.getByLabel(/수축기/)).toHaveValue("120");
    state.outcome = "ok";
    await submit(page); await ready(page); await expectStarts(page, 1);
    expect(state.posts).toBe(2);
  });
}

test("8-second API timeout, late success and refresh cannot create confirmation or auto retry", async ({ page }) => {
  const state = await setup(page); state.saveGate = deferred();
  await openForm(page); await submit(page);
  await expect(page.getByText("저장 여부를 확인하지 못했어요.", { exact: false })).toBeVisible({ timeout: 11_000 });
  state.saveGate.release();
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByRole("button", { name: "다시 불러오기", exact: true })).toBeEnabled();
  await expect(runtime(page)).toHaveCount(0);
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  expect(state.posts).toBe(1);
  expect(glbs(state.urls)).toEqual([]);
});

test("confirmed save remains truthful when its refresh fails; recovery does not replay", async ({ page }) => {
  const state = await setup(page); state.refreshError = true;
  await openForm(page); await submit(page); await ready(page); await expectStarts(page, 1);
  await expect(page.getByText("최신 여부 미확인", { exact: true })).toBeVisible();
  state.refreshError = false;
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByText("최신 여부 미확인", { exact: true })).toHaveCount(0);
  await expectStarts(page, 1);
  expect(glbs(state.urls)).toEqual([assetUrl]);
});

test("remount/back/forward and viewport changes never replay or refetch; next save is independent", async ({ page }) => {
  const state = await setup(page);
  await openForm(page); await submit(page); await ready(page); await expectStarts(page, 1);
  const canvas = await page.locator("[data-saved-scene-renderer] canvas").elementHandle();
  for (const width of [320, 390, 1366]) await page.setViewportSize({ width, height: 844 });
  expect(await canvas!.evaluate(node => node === document.querySelector("[data-saved-scene-renderer] canvas"))).toBe(true);
  for (let i = 0; i < 3; i++) {
    await returnVisit(page); await ready(page);
    await expect(character(page)).toHaveAttribute("data-saved-scene-phase", "idle");
    await page.goForward(); await expect(runtime(page)).toHaveCount(0);
    await page.goBack(); await ready(page);
  }
  await expectStarts(page, 1);
  expect(glbs(state.urls)).toEqual([assetUrl]);
  await page.getByRole("button", { name: "계속 기록하기", exact: true }).click();
  await page.getByLabel(/수축기/).fill("125"); await page.getByLabel(/이완기/).fill("82");
  await submit(page); await ready(page); await expectStarts(page, 2);
  expect(glbs(state.urls)).toEqual([assetUrl]);
  expect(state.posts).toBe(2);
  expect(state.errors).toEqual([]);
});

for (const when of ["before-save", "loading", "playing", "refresh-pending"] as const) for (const interruption of ["reduce", "hidden"] as const) {
  test(`${interruption} at ${when} consumes the opportunity and never queues a replay`, async ({ page }) => {
    const state = await setup(page);
    const gate = deferred();
    let assetRequested = false;
    if (when === "loading") await page.route(assetUrl, async route => { assetRequested = true; await gate.promise; await route.fallback(); });
    if (when === "refresh-pending") state.refreshGate = gate;
    const change = async (active: boolean) => {
      if (interruption === "hidden") return hidden(page, active);
      const previous = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
      await page.emulateMedia({ reducedMotion: active ? "reduce" : "no-preference" });
      // Await the actual browser preference event before reversing it.
      if (previous !== active) await expect.poll(async () => (await evidence(page)).mediaChanges.at(-1)).toBe(active);
    };
    await openForm(page);
    if (when === "before-save") await change(true);
    await submit(page);
    if (when === "before-save") await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();
    if (when === "loading") await expect.poll(() => assetRequested).toBe(true);
    if (when === "playing") { await ready(page); await expectStarts(page, 1); }
    if (when === "refresh-pending") await expect.poll(() => state.windows).toBe(2);
    if (when !== "before-save") await change(true);
    if (when === "refresh-pending") {
      // Even a brief interruption before S05 mounts consumes the opportunity.
      await change(false);
      gate.release();
    } else {
      gate.release();
      if (interruption === "hidden") await change(false);
    }
    await ready(page);
    await expect(character(page)).toHaveAttribute("data-saved-scene-phase", "idle");
    await change(false);
    await page.waitForTimeout(150);
    await expectStarts(page, when === "playing" ? 1 : 0);
    expect(glbs(state.urls)).toEqual([assetUrl]);
    expect(state.posts).toBe(1);
  });
}

for (const failure of ["glb", "chunk", "corrupt", "webgl", "context", "load-timeout"] as const) {
  test(`${failure} stays at CSS across motion changes and return; semantic controls survive`, async ({ page }) => {
    const state = await setup(page);
    const gate = deferred();
    if (failure === "glb") await page.route(assetUrl, route => route.abort());
    if (failure === "corrupt") await page.route(assetUrl, route => route.fulfill({ status: 200, headers, contentType: "model/gltf-binary", body: "invalid" }));
    if (failure === "chunk") await page.route("**/SavedSceneRenderer-*.js", route => route.abort());
    if (failure === "load-timeout") await page.route(assetUrl, async route => { await gate.promise; await route.fallback(); });
    if (failure === "webgl") await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args) {
        if (String(args[0]).startsWith("webgl")) return null;
        return original.apply(this, args as Parameters<typeof original>);
      } as typeof original;
    });
    await openForm(page); await submit(page);
    if (failure === "context") {
      await ready(page);
      await page.locator("[data-saved-scene-renderer] canvas").evaluate(canvas => {
        (canvas as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext();
      });
    }
    await expect(runtime(page)).toHaveAttribute("data-saved-scene-status", "fallback", { timeout: 18_000 });
    gate.release();
    const before = glbs(state.urls).length;
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await returnVisit(page);
    await expect(runtime(page)).toHaveAttribute("data-saved-scene-status", "fallback");
    await expect(page.locator("[data-saved-scene-renderer] canvas")).toHaveCount(0);
    expect(glbs(state.urls)).toHaveLength(before);
    await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();
    await page.getByRole("button", { name: "계속 기록하기" }).click();
    await expect(page.getByLabel(/수축기/)).toBeVisible();
    expect(state.posts).toBe(1);
  });
}

for (const label of ["기록함", "건너뜀"]) test(`confirmed ${label} uses the same one-shot presentation`, async ({ page }) => {
  const state = await setup(page);
  await page.goto("/?e2e=signed-in&screen=S07");
  await page.getByRole("button", { name: label, exact: true }).click();
  await ready(page); await expectStarts(page, 1);
  expect(state.posts).toBe(1);
  expect(glbs(state.urls)).toEqual([assetUrl]);
});

test("session replacement drops an already confirmed event while refresh is pending", async ({ page }) => {
  const state = await setup(page); state.refreshGate = deferred();
  await openForm(page); await submit(page);
  await expect.poll(() => state.windows).toBe(2);
  await page.evaluate(name => window.dispatchEvent(new CustomEvent(name, { detail: null })), e2eSessionEventName);
  state.refreshGate.release();
  await expect(page.getByRole("button", { name: "로그인 링크 받기" })).toBeVisible();
  await expect(runtime(page)).toHaveCount(0);
  expect(glbs(state.urls)).toEqual([]);
});

for (const [width, height] of [[320, 568], [390, 844], [1366, 900]]) test(`S05 keyboard and decorative bounds at ${width}x${height}`, async ({ page }, info) => {
  const state = await setup(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openForm(page); await submit(page); await ready(page);
  await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeFocused();
  await expect(runtime(page)).toHaveAttribute("aria-hidden", "true");
  expect(await runtime(page).locator("button, a, [tabindex]").count()).toBe(0);
  const boxes = await page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
    return { slot: box(".companion-runtime-slot"), cta: box(".split-actions"), nav: box(".primary-nav"), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  expect(boxes.overflow).toBe(false);
  expect(overlap(boxes.slot, boxes.cta)).toBe(false);
  expect(overlap(boxes.slot, boxes.nav)).toBe(false);
  await page.screenshot({ path: info.outputPath("s05.png"), fullPage: true });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "오늘의 기록 보기" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "혈압 기록 저장" })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test("saving from a scrolled form shows S05 before its one celebration opportunity", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 402, height: 714 });
  const assetGate = deferred();
  await page.route(assetUrl, async route => { await assetGate.promise; await route.fallback(); });
  await openForm(page);
  const save = page.getByRole("button", { name: "혈압 기록 저장", exact: true });
  await save.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await save.press("Enter");
  await expect(page.getByRole("heading", { name: "기록을 저장했어요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "오늘의 기록 보기", exact: true })).toBeEnabled();
  expect((await runtime(page).boundingBox())!.y).toBeGreaterThanOrEqual(0);
  assetGate.release();
  await ready(page);
  await expectStarts(page, 1);
  await expect(character(page)).toHaveAttribute("data-saved-scene-phase", "idle");
  await returnVisit(page); await ready(page);
  await expectStarts(page, 1);
});

test("offscreen interruption stops rendering and route exit releases every context", async ({ page }) => {
  const state = await setup(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const contexts = new Set<WebGLRenderingContext>();
    Object.assign(window, { sceneContexts: contexts });
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      const context = original.apply(this, args);
      if (context && (args[0] === "webgl" || args[0] === "webgl2")) contexts.add(context as WebGLRenderingContext);
      return context;
    } as typeof original;
  });
  const live = () => page.evaluate(() => [...(window as Window & { sceneContexts: Set<WebGLRenderingContext> }).sceneContexts].filter(context => !context.isContextLost()).length);
  await openForm(page); await submit(page); await ready(page); await expectStarts(page, 1);
  await expect.poll(live).toBe(1);
  await runtime(page).evaluate(node => { (node as HTMLElement).style.top = "3000px"; });
  await expect(character(page)).toHaveAttribute("data-saved-scene-phase", "idle");
  await page.waitForTimeout(100);
  const before = await evidence(page);
  await page.waitForTimeout(200);
  expect((await evidence(page)).rafs).toBe(before.rafs);
  await runtime(page).evaluate(node => { (node as HTMLElement).style.top = ""; });
  await expectStarts(page, 1);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
    await expect.poll(live).toBe(0);
    await page.goBack(); await ready(page);
    await expect.poll(live).toBe(1);
  }
  expect(glbs(state.urls)).toEqual([assetUrl]);
});

test("exited S02 S10 and S05 canvases are garbage collectible across repeat visits", async ({ page }) => {
  const state = await setup(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const seen = new WeakSet<HTMLCanvasElement>();
    const refs: WeakRef<HTMLCanvasElement>[] = [];
    Object.assign(window, { sceneCanvasCounts: () => ({ created: refs.length, retained: refs.filter(ref => ref.deref()).length }) });
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      const context = original.apply(this, args);
      if (context && /^webgl/.test(args[0]) && !seen.has(this)) {
        seen.add(this); refs.push(new WeakRef(this));
      }
      return context;
    } as typeof original;
  });
  const cdp = await page.context().newCDPSession(page);
  await page.goto("/?e2e=signed-in&screen=S08");
  const route = async (screen: string) => {
    await page.evaluate(screen => {
      history.pushState(history.state, "", `?e2e=signed-in&screen=${screen}`);
      dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    }, screen);
    await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
  };
  const exit = async () => {
    await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "기록 찾아보기", exact: true }).click();
    await expect(page.locator('[data-scene="S08"]')).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  };
  for (let i = 1; i <= 3; i++) {
    for (const screen of ["S02", "S10"]) {
      await route(screen);
      await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
      await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", "ready");
      await exit();
    }
    await route("S04");
    await page.getByLabel(/수축기/).fill("120");
    await page.getByLabel(/이완기/).fill("80");
    await submit(page); await ready(page); await exit();
    await expect.poll(async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      return page.evaluate(() => (window as unknown as { sceneCanvasCounts: () => { created: number; retained: number } }).sceneCanvasCounts());
    }).toEqual({ created: i * 3, retained: 0 });
  }
  expect(state.errors).toEqual([]);
  await cdp.detach();
});

test("leaving while the renderer chunk is pending consumes the visit without a late mount", async ({ page }) => {
  const state = await setup(page);
  const gate = deferred();
  let requested = false;
  await page.route("**/SavedSceneRenderer-*.js", async route => { requested = true; await gate.promise; await route.continue(); });
  await openForm(page); await submit(page);
  await expect.poll(() => requested).toBe(true);
  await returnVisit(page);
  await expect(runtime(page)).toHaveAttribute("data-saved-scene-status", "fallback");
  gate.release();
  await page.waitForTimeout(150);
  await expect(character(page)).toHaveCount(0);
  expect(glbs(state.urls)).toEqual([]);
});

test("page reload forgets confirmation and does not restore a saved event from URL or storage", async ({ page }) => {
  const state = await setup(page);
  await openForm(page); await submit(page); await ready(page);
  await page.reload();
  await expect(page.locator('[data-scene="S05"]')).toHaveCount(0);
  await expect(runtime(page)).toHaveCount(0);
  expect(state.posts).toBe(1);
  const savedKeys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter(key => /saved|celebrat/i.test(key)));
  expect(savedKeys).toEqual([]);
});

test("late mutation response after logout cannot issue a saved event", async ({ page }) => {
  const state = await setup(page); state.saveGate = deferred();
  await openForm(page); await submit(page);
  await expect.poll(() => state.posts).toBe(1);
  await page.evaluate(name => window.dispatchEvent(new CustomEvent(name, { detail: null })), e2eSessionEventName);
  state.saveGate.release();
  await expect(page.getByRole("button", { name: "로그인 링크 받기" })).toBeVisible();
  await expect(runtime(page)).toHaveCount(0);
  expect(glbs(state.urls)).toEqual([]);
});

test("200 percent zoom and total media failure preserve keyboard completion", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 640, height: 900 });
  await page.route(/\.(glb|webp|png)(\?|$)/, route => route.abort());
  await openForm(page); await submit(page);
  await expect(runtime(page)).toHaveAttribute("data-saved-scene-status", "fallback");
  // CSS zoom checks layout/reflow only, not a physical browser zoom acceptance.
  await page.locator("html").evaluate(element => { element.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole("button", { name: "계속 기록하기" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "혈압 기록 저장" })).toBeVisible();
});

test("a fresh confirmation replaces a failed old S05 visit only after refresh completes", async ({ page }) => {
  const state = await setup(page);
  let failAsset = true;
  await page.route(assetUrl, route => failAsset ? route.abort() : route.fallback());
  await openForm(page); await submit(page);
  await expect(runtime(page)).toHaveAttribute("data-saved-scene-status", "fallback");
  await page.getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await page.getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await page.getByRole("button", { name: /혈압 관찰 ·/ }).click();
  await page.getByLabel(/수축기/).fill("125"); await page.getByLabel(/이완기/).fill("82");
  state.refreshGate = deferred();
  await submit(page);
  await expect.poll(() => state.windows).toBe(3);
  for (let i = 0; i < 3; i++) await page.goBack();
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  await expect(runtime(page)).toHaveAttribute("data-saved-scene-status", "fallback");
  await expectStarts(page, 0);
  failAsset = false;
  state.refreshGate.release();
  await ready(page); await expectStarts(page, 1);
  expect(state.posts).toBe(2);
});
