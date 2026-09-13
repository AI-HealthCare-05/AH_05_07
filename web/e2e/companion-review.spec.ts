import { expect, test } from "@playwright/test";

import { companionClips, companionExcludedScreens, companionSpecies, companionVariants } from "../src/ui/companion";
import { companionAssetManifest } from "../src/ui/companionAssets.generated";

const selection = "companion_species=bear&companion_variant=lite&companion_clip=idle";
const fixture = "fixture=VP-10";

function reviewUrl(screen: string, query = selection) {
  return `/?${fixture}&screen=${screen}&${query}`;
}

function companionRequests(urls: string[]) {
  return urls.filter((url) => /sk7-companion\.gkrry\.com\/companion\/v1\/.+\.glb(?:\?|$)/i.test(url));
}

test("review mode is fail-closed without a complete explicit selection", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/?${fixture}&screen=S02`);
  await expect(page.getByRole("heading", { name: "오늘의 기록" })).toBeVisible();
  expect(companionRequests(requests)).toEqual([]);

  const responsePromise = page.waitForResponse((response) => response.url() === companionAssetManifest.bear.lite.url);
  const fetchPromise = page.evaluate(async (url) => {
    try {
      const response = await fetch(url, { mode: "cors" });
      return {
        outcome: "succeeded",
        status: response.status,
        type: response.type,
        url: response.url,
        contentType: response.headers.get("content-type"),
        cfMitigated: response.headers.get("cf-mitigated"),
      };
    } catch (error) {
      return {
        outcome: "failed",
        status: null,
        type: null,
        url,
        contentType: null,
        cfMitigated: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, companionAssetManifest.bear.lite.url);
  const [manualResponse, manualFetch] = await Promise.all([responsePromise, fetchPromise]);
  expect(manualResponse.status()).toBe(200);
  expect(manualFetch.outcome).toBe("succeeded");
  expect(manualFetch.status).toBe(200);
  expect(manualFetch.type).toBe("cors");
  expect(manualFetch.url).toBe(companionAssetManifest.bear.lite.url);
  expect(manualFetch.contentType).toBe("model/gltf-binary");
  expect(manualFetch.cfMitigated).toBeNull();
  expect(manualResponse.headers()["content-type"]).toBe("model/gltf-binary");
  expect(manualResponse.headers()["cf-mitigated"]).toBeUndefined();

  requests.length = 0;
  await page.goto(reviewUrl("S02", "companion_species=not-a-species&companion_variant=lite&companion_clip=idle"));
  await expect(page.getByRole("heading", { name: "오늘의 기록" })).toBeVisible();
  expect(companionRequests(requests)).toEqual([]);

  for (const screen of companionExcludedScreens) {
    requests.length = 0;
    const screenFixture = screen === "S12" || screen === "S13" ? "fixture=VP-04" : fixture;
    await page.goto(`/?${screenFixture}&screen=${screen}&${selection}`);
    expect(companionRequests(requests)).toEqual([]);
  }
});

test("each approved review screen can load one explicit asset", async ({ page }) => {
  const cases = [
    ["S02", "companion_species=bear&companion_variant=lite&companion_clip=idle"],
    ["S03", "companion_species=bear&companion_variant=lite&companion_clip=idle"],
    ["S05", "companion_species=bear&companion_variant=lite&companion_clip=celebrate&companion_context=save_success"],
    ["S10", "companion_species=bear&companion_variant=lite&companion_clip=idle"],
  ] as const;
  for (const [screen, query] of cases) {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(reviewUrl(screen, query));
    await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
    await expect(page.locator('[data-companion-framing]')).toHaveAttribute('data-companion-framing', 'default');
    expect(companionRequests(requests)).toHaveLength(1);
  }
});

test("valid review selection requests exactly one approved GLB", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(reviewUrl("S02"));
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  expect(companionRequests(requests)).toHaveLength(1);
  expect(companionRequests(requests)[0]).toBe(companionAssetManifest.bear.lite.url);
  expect(await page.locator("[data-companion-canvas]").getAttribute("tabindex")).toBeNull();
  expect(await page.locator("[data-companion-canvas]").evaluate((canvas) => getComputedStyle(canvas).pointerEvents)).toBe("auto");
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-interaction-enabled", "true");
});

test("S10 living replay adds bounded head look and suspends it during tactile drag", async ({ page }) => {
  await page.goto(reviewUrl("S10"));
  const runtime = page.locator("[data-companion-status]");
  const slot = page.locator(".companion-runtime-slot");
  const canvas = page.locator("[data-companion-canvas]");

  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(slot).toHaveAttribute("data-companion-attention-look", "true");
  await expect(runtime).toHaveAttribute("data-companion-look-enabled", "true");
  await expect(runtime).toHaveAttribute("data-companion-look-bone", "head");
  await expect(runtime).toHaveAttribute("data-companion-look-state", "centered");

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  await page.mouse.move(viewport!.width * 0.86, viewport!.height * 0.24);
  await expect.poll(
    async () => Math.abs(Number(await runtime.getAttribute("data-companion-look-yaw"))),
    { timeout: 2_000 },
  ).toBeGreaterThan(0.035);
  await expect.poll(
    async () => Math.abs(Number(await runtime.getAttribute("data-companion-look-pitch"))),
    { timeout: 2_000 },
  ).toBeGreaterThan(0.015);

  const maxYaw = Number(await runtime.getAttribute("data-companion-look-max-yaw"));
  const maxPitch = Number(await runtime.getAttribute("data-companion-look-max-pitch"));
  expect(Math.abs(Number(await runtime.getAttribute("data-companion-look-yaw")))).toBeLessThanOrEqual(maxYaw + 0.005);
  expect(Math.abs(Number(await runtime.getAttribute("data-companion-look-pitch")))).toBeLessThanOrEqual(maxPitch + 0.005);

  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await expect(runtime).toHaveAttribute("data-companion-interaction", "dragging");
  await expect(runtime).toHaveAttribute("data-companion-look-state", "suspended");
  await page.mouse.up();
  await expect.poll(
    async () => runtime.getAttribute("data-companion-interaction"),
    { timeout: 4_000 },
  ).toBe("idle");

  await page.mouse.move(viewport!.width / 2, viewport!.height / 2);
  await expect.poll(
    async () => Math.abs(Number(await runtime.getAttribute("data-companion-look-yaw"))),
    { timeout: 2_000 },
  ).toBeLessThan(0.02);
  await expect.poll(
    async () => Math.abs(Number(await runtime.getAttribute("data-companion-look-pitch"))),
    { timeout: 2_000 },
  ).toBeLessThan(0.02);
});

test("attention look stays fail-closed outside S10 and under reduced motion", async ({ page }) => {
  await page.goto(reviewUrl("S02"));
  let runtime = page.locator("[data-companion-status]");
  let slot = page.locator(".companion-runtime-slot");
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(slot).toHaveAttribute("data-companion-attention-look", "false");
  await expect(runtime).toHaveAttribute("data-companion-look-enabled", "false");
  await expect(runtime).toHaveAttribute("data-companion-look-state", "disabled");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(reviewUrl("S10"));
  runtime = page.locator("[data-companion-status]");
  slot = page.locator(".companion-runtime-slot");
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(slot).toHaveAttribute("data-companion-attention-look", "false");
  await expect(runtime).toHaveAttribute("data-companion-look-enabled", "false");
  await expect(runtime).toHaveAttribute("data-companion-look-state", "disabled");
});

test("bear-lite idle can be grabbed and springs back without product-state changes", async ({ page }) => {
  await page.goto(reviewUrl("S02"));
  const runtime = page.locator("[data-companion-status]");
  const canvas = page.locator("[data-companion-canvas]");
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-companion-interaction", "idle");
  await expect(runtime).toHaveAttribute("data-companion-proxy", "head-body-feet");
  await expect(page.locator(".companion-runtime-slot")).toHaveAttribute("data-companion-interactive", "true");
  expect(await page.locator(".companion-runtime-slot").evaluate((slot) => getComputedStyle(slot).pointerEvents)).toBe("auto");
  expect(await runtime.evaluate((host) => getComputedStyle(host).pointerEvents)).toBe("auto");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);

  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await expect(runtime).toHaveAttribute("data-companion-interaction", "dragging");
  expect(await runtime.getAttribute("data-companion-input-route")).toBe("pointer");
  await page.mouse.move(centerX + Math.min(72, box!.width * 0.22), centerY - Math.min(36, box!.height * 0.16), { steps: 5 });
  await expect.poll(async () => Math.abs(Number(await runtime.getAttribute("data-companion-offset-x")))).toBeGreaterThan(0.03);
  await page.mouse.up();
  await expect.poll(async () => runtime.getAttribute("data-companion-interaction"), { timeout: 4_000 }).toBe("idle");
  expect(Math.abs(Number(await runtime.getAttribute("data-companion-offset-x")))).toBeLessThan(0.01);
  expect(Math.abs(Number(await runtime.getAttribute("data-companion-offset-y")))).toBeLessThan(0.01);
  await expect(page.getByRole("button", { name: "혈압 관찰" })).toBeVisible();
});

test("head body and feet use distinct tactile reaction profiles", async ({ page }) => {
  await page.goto(reviewUrl("S02"));
  const runtime = page.locator("[data-companion-status]");
  const canvas = page.locator("[data-companion-canvas]");
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await canvas.scrollIntoViewIfNeeded();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;

  const cases = [
    { zone: "head", ratio: 0.18, reactionClip: "curious" },
    { zone: "body", ratio: 0.52, reactionClip: "greet" },
    { zone: "feet", ratio: 0.86, reactionClip: "rest" },
  ] as const;

  for (const { zone, ratio, reactionClip } of cases) {
    const y = box!.y + box!.height * ratio;
    await page.mouse.move(x, y);
    await page.mouse.down();

    await expect(runtime).toHaveAttribute("data-companion-interaction", "dragging");
    await expect(runtime).toHaveAttribute("data-companion-grab-zone", zone);
    await expect(runtime).toHaveAttribute("data-companion-reaction-profile", zone);
    await expect(runtime).toHaveAttribute("data-companion-reaction-state", "active");
    await expect(runtime).toHaveAttribute("data-companion-reaction-clip", reactionClip);
    await expect(runtime).toHaveAttribute("data-companion-animation-clip", reactionClip);

    await page.mouse.move(x + 44, y - 28, { steps: 4 });
    await expect.poll(async () => Math.abs(Number(await runtime.getAttribute("data-companion-offset-x"))))
      .toBeGreaterThan(0.015);

    await page.mouse.up();
    await expect.poll(async () => runtime.getAttribute("data-companion-interaction"), { timeout: 4_000 })
      .toBe("idle");

    await expect(runtime).toHaveAttribute("data-companion-grab-zone", "none");
    await expect(runtime).toHaveAttribute("data-companion-reaction-state", "idle");
    await expect(runtime).toHaveAttribute("data-companion-reaction-clip", "idle");
    await expect(runtime).toHaveAttribute("data-companion-animation-clip", "idle");
  }
});

test("touch tap keeps a visible head reaction before returning to idle", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  try {
    const url = new URL(reviewUrl("S02"), baseURL ?? "http://127.0.0.1:4173").toString();
    await page.goto(url);

    const runtime = page.locator("[data-companion-status]");
    const canvas = page.locator("[data-companion-canvas]");
    const slot = page.locator(".companion-runtime-slot");

    await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
    await expect(runtime).toHaveAttribute("data-companion-min-reaction-ms", "300");
    expect(await slot.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");

    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height * 0.18;

    await page.touchscreen.tap(x, y);

    await expect(runtime).toHaveAttribute("data-companion-pointer-type", "touch");
    await expect(runtime).toHaveAttribute("data-companion-reaction-clip", "curious");
    await expect(runtime).toHaveAttribute("data-companion-reaction-state", "active");

    await page.waitForTimeout(120);
    await expect(runtime).toHaveAttribute("data-companion-reaction-state", "active");

    await expect.poll(
      async () => runtime.getAttribute("data-companion-reaction-state"),
      { timeout: 1_500 },
    ).toBe("idle");
    await expect(runtime).toHaveAttribute("data-companion-animation-clip", "idle");
  } finally {
    await context.close();
  }
});

test("feet remain more anchored than body under the same large vertical drag", async ({ page }) => {
  await page.goto(reviewUrl("S02"));
  const runtime = page.locator("[data-companion-status]");
  const canvas = page.locator("[data-companion-canvas]");
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await canvas.scrollIntoViewIfNeeded();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;

  const dragAndSample = async (zone: "body" | "feet", ratio: number) => {
    const y = box!.y + box!.height * ratio;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(runtime).toHaveAttribute("data-companion-grab-zone", zone);
    await page.mouse.move(x + 12, y - 180, { steps: 6 });
    await expect.poll(async () => Math.abs(Number(await runtime.getAttribute("data-companion-offset-y"))))
      .toBeGreaterThan(0.05);
    await page.waitForTimeout(260);
    const offset = Math.abs(Number(await runtime.getAttribute("data-companion-offset-y")));
    const tilt = Math.abs(Number(await runtime.getAttribute("data-companion-tilt-z")));
    await page.mouse.up();
    await expect.poll(async () => runtime.getAttribute("data-companion-interaction"), { timeout: 4_000 })
      .toBe("idle");
    return { offset, tilt };
  };

  const body = await dragAndSample("body", 0.52);
  const feet = await dragAndSample("feet", 0.86);

  expect(body.offset).toBeGreaterThan(feet.offset + 0.08);
  expect(await runtime.getAttribute("data-companion-reaction-profile")).toBe("none");
});

test("tactile interaction stays bounded to review bear-lite idle", async ({ page }) => {
  await page.goto(reviewUrl("S02", "companion_species=rabbit&companion_variant=lite&companion_clip=idle"));
  const runtime = page.locator("[data-companion-status]");
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-companion-interaction-enabled", "false");
  await expect(runtime).toHaveAttribute("data-companion-reaction-state", "disabled");
  expect(await page.locator("[data-companion-canvas]").evaluate((canvas) => getComputedStyle(canvas).pointerEvents)).toBe("none");
});

test("clip policy allows general clips, gates conditional clips, and blocks special", async ({ page }) => {
  for (const clip of ["idle", "greet", "curious", "rest"]) {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto(reviewUrl("S02", `companion_species=bear&companion_variant=lite&companion_clip=${clip}`));
    await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
    expect(companionRequests(urls)).toHaveLength(1);
  }

  const blockedCases = [
    ["S02", "celebrate", ""],
    ["S02", "move", ""],
    ["S02", "special", ""],
  ] as const;
  for (const [screen, clip, context] of blockedCases) {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    const suffix = context ? `&companion_context=${context}` : "";
    await page.goto(reviewUrl(screen, `companion_species=bear&companion_variant=lite&companion_clip=${clip}${suffix}`));
    await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
    expect(companionRequests(urls)).toEqual([]);
  }

  const saveUrls: string[] = [];
  page.on("request", (request) => saveUrls.push(request.url()));
  await page.goto(reviewUrl("S05", "companion_species=bear&companion_variant=lite&companion_clip=celebrate&companion_context=save_success"));
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  expect(companionRequests(saveUrls)).toHaveLength(1);

  const moveUrls: string[] = [];
  page.on("request", (request) => moveUrls.push(request.url()));
  await page.goto(reviewUrl("S02", "companion_species=bear&companion_variant=lite&companion_clip=move&companion_context=non_semantic"));
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  expect(companionRequests(moveUrls)).toHaveLength(1);
});

test("all approved species and variants expose exactly the seven runtime clip names", async ({ page }) => {
  test.setTimeout(180_000);
  const expected = [...companionClips].sort();
  for (const species of companionSpecies) {
    for (const variant of companionVariants) {
      await page.goto(reviewUrl("S02", `companion_species=${species}&companion_variant=${variant}&companion_clip=idle`));
      const runtime = page.locator("[data-companion-status]");
      await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
      expect((await runtime.getAttribute("data-companion-clip-names"))?.split(",").sort()).toEqual(expected);
    }
  }
});

test("reduced motion renders a static companion without an animation loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(reviewUrl("S02"));
  const runtime = page.locator("[data-companion-status]");
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-companion-motion", "stopped");
  await expect(page.locator("[data-companion-canvas]")).toHaveAttribute("aria-hidden", "true");
  await expect(runtime).toHaveAttribute("data-companion-interaction-enabled", "false");
  await expect(runtime).toHaveAttribute("data-companion-reaction-state", "disabled");
  expect(await page.locator("[data-companion-canvas]").evaluate((canvas) => getComputedStyle(canvas).pointerEvents)).toBe("none");
});

test("404 and abort failures remove only the decorative companion", async ({ browser }) => {
  for (const failure of ["404", "abort"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.route("**/companion/v1/**", async (route) => {
      if (failure === "404") await route.fulfill({ status: 404, body: "not found" });
      else await route.abort("failed");
    });
    await page.goto(reviewUrl("S02"));
    await expect(page.getByRole("heading", { name: "오늘의 기록" })).toBeVisible();
    await expect(page.getByRole("button", { name: "혈압 관찰" })).toBeVisible();
    await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "error", { timeout: 30_000 });
    expect(pageErrors).toEqual([]);
    await context.close();
  }
});

test("review slot preserves responsive core layout at 1366, 390, and 320", async ({ page }) => {
  for (const width of [1366, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1366 ? 900 : 844 });
    await page.goto(reviewUrl("S02"));
    await expect(page.getByRole("heading", { name: "오늘의 기록" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const scene = page.locator('[data-scene="S02"]');
    const sceneBox = await scene.boundingBox();
    const companionBox = await page.locator(".companion-runtime-slot").boundingBox();
    expect(sceneBox).not.toBeNull();
    expect(companionBox).not.toBeNull();
    expect(companionBox!.x + companionBox!.width).toBeLessThanOrEqual(sceneBox!.x + sceneBox!.width + 1);
    expect(companionBox!.y + companionBox!.height).toBeLessThanOrEqual(sceneBox!.y + sceneBox!.height + 1);
    await expect(page.getByRole("button", { name: "혈압 관찰" })).toBeVisible();
  }
});

test("S05 companion stays in its reserved slot beside confirmation and actions", async ({ page }) => {
  for (const width of [1366, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1366 ? 900 : 844 });
    await page.goto(reviewUrl("S05", "companion_species=bear&companion_variant=lite&companion_clip=celebrate&companion_context=save_success"));
    await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
    const scene = page.locator('[data-scene="S05"]');
    const companion = page.locator(".companion-runtime-slot");
    const title = scene.getByRole("heading", { name: "기록을 저장했어요" });
    const action = scene.getByRole("button", { name: "오늘의 기록 보기" });
    const boxes = await Promise.all([companion.boundingBox(), title.boundingBox(), action.boundingBox()]);
    expect(boxes.every(Boolean)).toBe(true);
    const [companionBox, titleBox, actionBox] = boxes as [{ x: number; y: number; width: number; height: number }, { x: number; y: number; width: number; height: number }, { x: number; y: number; width: number; height: number }];
    const overlaps = (left: typeof companionBox, right: typeof companionBox) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
    expect(overlaps(companionBox, titleBox)).toBe(false);
    expect(overlaps(companionBox, actionBox)).toBe(false);
  }
});
