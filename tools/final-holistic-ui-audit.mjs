import { chromium } from "../web/node_modules/@playwright/test/index.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseURL = process.env.SK7_AUDIT_BASE_URL ?? "http://127.0.0.1:4173";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = process.env.SK7_AUDIT_OUTPUT_PATH ?? path.join(repoRoot, "docs", "ui", "final-holistic-design-backlog.json");
const screenshotRoot = process.env.SK7_AUDIT_SCREENSHOT_DIR ?? path.join(process.env.TEMP ?? "C:/Temp", "sk7-ui-final-audit");
const publicScreenshotRoot = "<local-temp>/sk7-ui-final-audit";

const viewports = [
  { id: "desktop", width: 1366, height: 768 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "mobile", width: 390, height: 844 },
  { id: "boundary", width: 320, height: 568 },
];

const zoomMethod = {
  id: "browser-zoom-layout-proxy-200",
  physicalReference: { width: 1366, height: 768 },
  cssViewport: { width: 683, height: 384 },
  rootFontOverride: false,
  note: "Layout proxy; not native browser zoom instrumentation.",
};

const zoomViewport = {
  id: "zoom-200",
  width: zoomMethod.cssViewport.width,
  height: zoomMethod.cssViewport.height,
};
const zoomLabel = "200% browser-zoom layout proxy";

const screens = [
  { id: "S01", url: "/" },
  { id: "S02", url: "/?fixture=VP-10&screen=S02" },
  { id: "S03", url: "/?fixture=VP-10&screen=S03" },
  { id: "S04", url: "/?fixture=VP-10&screen=S04" },
  { id: "S05", url: "/?fixture=VP-10&screen=S05&companion_species=bear&companion_variant=lite&companion_clip=celebrate&companion_context=save_success" },
  { id: "S06", url: "/?e2e=signed-in&screen=S06", routeWindow: "challenge-only" },
  { id: "S07", url: "/?fixture=VP-10&screen=S07" },
  { id: "S08", url: "/?fixture=VP-10&screen=S08" },
  { id: "S09", url: "/?fixture=VP-10&screen=S09&record=blood-pressure%3Afixture-bp-3" },
  { id: "S10", url: "/?fixture=VP-10&screen=S10" },
  { id: "S11", url: "/?fixture=VP-10&screen=S11" },
  { id: "S12", url: "/?fixture=VP-04" },
  { id: "S13", url: "/?fixture=VP-11a" },
  { id: "S14", url: "/?fixture=VP-10&screen=S14" },
];

const challengeOnlyWindow = {
  start_on: "2026-08-28",
  end_on: "2026-09-03",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: {
    id: "audit-challenge",
    action_id: "walk-10-minutes",
    starts_on: "2026-09-01",
    ends_on: "2026-09-07",
    first_checkin_on: "2026-09-01",
  },
  challenge_checkins: [
    { id: "audit-checkin", challenge_id: "audit-challenge", action_id: "walk-10-minutes", observed_on: "2026-09-01", status: "completed" },
  ],
};

function hasKorean(value) {
  return /[가-힣]/u.test(value);
}

async function textInventory(page, scene) {
  const candidates = await scene.locator("h1, h2, h3, p, button, label, summary, dt, dd, span").evaluateAll((elements) => elements
    .filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    })
    .map((element) => (element.textContent ?? "").replace(/\s+/gu, " ").trim())
    .filter(Boolean));
  const KoreanTexts = candidates.filter(hasKorean);
  return {
    longestVisibleKoreanCopy: KoreanTexts.sort((left, right) => right.length - left.length)[0] ?? "",
  };
}

async function installWindowRoute(page, routeWindow) {
  if (routeWindow !== "challenge-only") return;
  await page.route("http://e2e.invalid/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4173" } });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(challengeOnlyWindow) });
  });
}

async function inventoryPage(page, screenId, viewport, zoom) {
  const scene = page.locator(`[data-scene="${screenId}"]`);
  await scene.waitFor({ state: "visible" });
  await page.waitForTimeout(250);
  const inventory = await page.evaluate(() => {
    const scene = document.querySelector("[data-scene]");
    const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    });
    const primaryButtons = visible("[data-scene] button")
      .filter((element) => !element.matches(".secondary, .text-button, .danger, .record-action"));
    const cta = primaryButtons.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom > 0;
    });
    const ctaVisibility = cta
      ? (cta.getBoundingClientRect().bottom <= innerHeight ? "visible" : "partial")
      : primaryButtons.length ? "below-fold" : "none";
    return {
      visibleButtonsCount: visible("[data-scene] button").length,
      primaryActionsCount: primaryButtons.length,
      panelsCardsCount: visible("[data-scene] .feature-card, [data-scene] .choice-tile, [data-scene] .record-lane, [data-scene] .fact-lanes > section, [data-scene] .state-card, [data-scene] .record-detail, [data-scene] .recent-window-summary, [data-scene] .today-ribbon, [data-scene] .locked-challenge, [data-scene] .challenge-progress-card, [data-scene] .signal-card, [data-scene] .settings-grid > section, [data-scene] .measurement-panel, [data-scene] .window-nav, [data-scene] .recap-pan section").length,
      h1Count: visible("[data-scene] h1").length,
      h2Count: visible("[data-scene] h2").length,
      explanatoryParagraphsCount: visible("[data-scene] p:not(.eyebrow)").length,
      approximateAboveFoldCtaVisibility: ctaVisibility,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
      companionPresent: Boolean(document.querySelector(".companion-runtime-slot")),
      sceneWidth: scene?.getBoundingClientRect().width ?? 0,
    };
  });
  return {
    screen: screenId,
    viewport: viewport.id,
    width: viewport.width,
    height: viewport.height,
    zoom,
    ...inventory,
    ...(await textInventory(page, scene)),
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
fs.rmSync(screenshotRoot, { recursive: true, force: true });
fs.mkdirSync(screenshotRoot, { recursive: true });

try {
  for (const screen of screens) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await installWindowRoute(page, screen.routeWindow);
      await page.goto(`${baseURL}${screen.url}`, { waitUntil: "networkidle" });
      const expectedScene = screen.id === "S01" ? "S01" : screen.id;
      const result = await inventoryPage(page, expectedScene, viewport, "100%");
      const screenshotPath = path.join(screenshotRoot, `${screen.id}-${viewport.id}-100.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.push({ ...result, screenshot: path.basename(screenshotPath) });
      await page.close();
    }

    const page = await browser.newPage({ viewport: zoomViewport });
    await installWindowRoute(page, screen.routeWindow);
    await page.goto(`${baseURL}${screen.url}`, { waitUntil: "networkidle" });
    const result = await inventoryPage(page, screen.id, zoomViewport, zoomLabel);
    const screenshotPath = path.join(screenshotRoot, `${screen.id}-${zoomViewport.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({ ...result, screenshot: path.basename(screenshotPath) });
    await page.close();
  }
} finally {
  await browser.close();
}

const byScreen = Object.fromEntries(screens.map(({ id }) => [id, results.filter((result) => result.screen === id)]));
const backlog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
    source: {
      branch: process.env.SK7_AUDIT_BRANCH ?? "ux/final-holistic-design-audit",
    screens: screens.map(({ id }) => id),
    viewports: [...viewports, { ...zoomViewport, zoom: zoomLabel }],
    zoomMethod,
    screenshotCount: results.length,
    screenshotRoot: publicScreenshotRoot,
    note: "Inventory is an evidence aid, not an automatic design score. Screenshots stay in a local temp directory; JSON stores basenames only.",
  },
  inventory: byScreen,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(backlog, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, screenshotRoot, screenshotCount: results.length, screens: screens.length }, null, 2));
