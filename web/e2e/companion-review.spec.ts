import { expect, test, type Page } from "@playwright/test";

import { companionClips, companionExcludedScreens, companionSpecies, companionVariants } from "../src/ui/companion";
import { companionAssetManifest } from "../src/ui/companionAssets.generated";

const selection = "companion_species=bear&companion_variant=lite&companion_clip=idle";
const fixture = "fixture=VP-10";

function reviewUrl(screen: string, query = selection) {
  return `/?${fixture}&screen=${screen}&${query}`;
}

function companionRequests(urls: string[]) {
  return urls.filter((url) => /sk7-assets\.gomdory\.com\/companion\/v1\/.+\.glb(?:\?|$)/i.test(url));
}

const companionRequestPattern = /sk7-assets\.gomdory\.com\/companion\/v1\//i;
const companionDiagnosticPages = new WeakMap<Page, { flush: () => Promise<void> }>();

function selectedHeaders(headers: Record<string, string>, names: string[]) {
  return Object.fromEntries(names.map((name) => [name, headers[name] ?? "<missing>"]));
}

function attachCompanionDiagnostics(page: Page, testTitle: string) {
  const requests: Array<Record<string, unknown>> = [];
  const responses: Array<Record<string, unknown>> = [];
  const responseUrls = new Set<string>();
  const failures: Array<Record<string, unknown>> = [];
  const consoleMessages: Array<Record<string, string>> = [];
  const pageErrors: string[] = [];
  const headerReads: Promise<void>[] = [];

  page.on("request", (request) => {
    if (!companionRequestPattern.test(request.url())) return;
    const url = request.url();
    const headers = request.allHeaders().then((allHeaders) => {
      requests.push({
        url,
        method: request.method(),
        headers: selectedHeaders(allHeaders, ["origin", "referer", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "user-agent"]),
      });
    });
    headerReads.push(headers);
  });

  page.on("response", (response) => {
    if (!companionRequestPattern.test(response.url())) return;
    const url = response.url();
    responseUrls.add(url);
    const headers = response.allHeaders().then((allHeaders) => {
      responses.push({
        url,
        status: response.status(),
        headers: selectedHeaders(allHeaders, ["access-control-allow-origin", "access-control-allow-methods", "content-type", "cache-control", "cf-cache-status", "cf-mitigated", "location"]),
      });
    });
    headerReads.push(headers);
  });

  page.on("requestfailed", (request) => {
    if (!companionRequestPattern.test(request.url())) return;
    failures.push({
      url: request.url(),
      errorText: request.failure()?.errorText ?? "<missing>",
      responseSeen: responseUrls.has(request.url()),
    });
  });

  page.on("console", (message) => {
    if (! ["error", "warning"].includes(message.type())) return;
    const text = message.text();
    if (!/companion|r2|cors|orb|corp|csp|network/i.test(text)) return;
    consoleMessages.push({ type: message.type(), text });
  });

  page.on("pageerror", (error) => pageErrors.push(error.message));

  return {
    flush: async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await Promise.allSettled(headerReads);
      if (!requests.length && !responses.length && !failures.length && !consoleMessages.length && !pageErrors.length) return;
      console.log(
        "companion Playwright diagnostics",
        JSON.stringify({
          testTitle,
          gltfLoaderReached: testTitle !== "diagnostic: browser fetch for companion R2" && requests.length > 0,
          requests,
          responses,
          failures,
          console: consoleMessages,
          pageerror: pageErrors,
        }),
      );
    },
  };
}

test.beforeEach(async ({ page }, testInfo) => {
  companionDiagnosticPages.set(page, attachCompanionDiagnostics(page, testInfo.title));
});

test.afterEach(async ({ page }) => {
  await companionDiagnosticPages.get(page)?.flush();
});

test("diagnostic: browser fetch for companion R2", async ({ page }) => {
  await page.goto(`/?${fixture}&screen=S02`);
  const result = await page.evaluate(async (url) => {
    try {
      const response = await fetch(url, { mode: "cors" });
      return {
        outcome: "succeeded",
        status: response.status,
        type: response.type,
        url: response.url,
        contentType: response.headers.get("content-type"),
        error: null,
      };
    } catch (error) {
      return {
        outcome: "failed",
        status: null,
        type: null,
        url,
        contentType: null,
        error: {
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }, "https://sk7-assets.gomdory.com/companion/v1/bear/v007/lite.glb");
  console.log("companion Chromium manual fetch", JSON.stringify(result));
  console.log(
    "companion diagnostic classification",
    result.outcome === "failed" ? "BROWSER_POLICY_OR_BROWSER_PATH" : "CHROMIUM_PAGE_FETCH_SUCCESS",
  );
});

test("review mode is fail-closed without a complete explicit selection", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/?${fixture}&screen=S02`);
  await expect(page.getByRole("heading", { name: "오늘의 기록" })).toBeVisible();
  expect(companionRequests(requests)).toEqual([]);

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
