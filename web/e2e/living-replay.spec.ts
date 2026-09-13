import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixtureScript = readFileSync(
  new URL("../scripts/journey-review-fixture.mjs", import.meta.url),
  "utf8",
).replace("export function", "function") + "\njourneyReviewFixture();";

async function installReviewMedia(page: Page) {
  await page.route("**/review-media/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace("/review-media", "");
    const response = await route.fetch({
      url: `https://sk7-companion.gkrry.com${pathname}`,
    });
    await route.fulfill({ response });
  });
}

async function openLivingReplay(page: Page) {
  await installReviewMedia(page);
  await page.clock.setFixedTime(new Date("2026-09-11T03:00:00Z"));
  await page.addInitScript({ content: fixtureScript });
  await page.goto(
    "/?e2e=signed-in&screen=S10&recap_fixture=mixed"
      + "&companion_species=bear&companion_variant=lite&companion_clip=idle",
  );
}

async function readLookNumber(runtime: Locator, attribute: string) {
  const raw = await runtime.getAttribute(attribute);
  if (raw === null) throw new Error(`Missing ${attribute}`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid ${attribute}: ${raw}`);
  return value;
}

async function readLookSnapshot(runtime: Locator) {
  return runtime.evaluate((element) => {
    const read = (attribute: string) => {
      const raw = element.getAttribute(attribute);
      if (raw === null) throw new Error(`Missing ${attribute}`);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Invalid ${attribute}: ${raw}`);
      return value;
    };

    return {
      totalYaw: read("data-companion-look-yaw"),
      totalPitch: read("data-companion-look-pitch"),
      headYaw: read("data-companion-look-head-yaw"),
      spineYaw: read("data-companion-look-spine-yaw"),
      headPitch: read("data-companion-look-head-pitch"),
      spinePitch: read("data-companion-look-spine-pitch"),
      maxYaw: read("data-companion-look-max-yaw"),
      maxPitch: read("data-companion-look-max-pitch"),
    };
  });
}

async function expectSpinePostureActive(runtime: Locator) {
  await expect.poll(
    async () => Math.max(
      Math.abs(await readLookNumber(runtime, "data-companion-look-spine-yaw")),
      Math.abs(await readLookNumber(runtime, "data-companion-look-spine-pitch")),
    ),
    { timeout: 2_000 },
  ).toBeGreaterThan(0.0005);
}

test("S10 day focus sends the same non-semantic living replay attention cue", async ({ page }) => {
  await openLivingReplay(page);

  const runtime = page.locator("[data-companion-status]");
  const buttons = page.locator(".seven-day-trail .trail-day-button");

  await expect(page.locator(".journey-recap")).toBeVisible();
  await expect(buttons).toHaveCount(7);
  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-companion-look-enabled", "true");
  await expect(runtime).toHaveAttribute("data-companion-look-posture", "head-spine");
  await expect(runtime).toHaveAttribute("data-companion-look-head-bone", "head");
  await expect(runtime).toHaveAttribute("data-companion-look-spine-bone", "spine");
  await expect(runtime).toHaveAttribute("data-companion-look-head-yaw-share", "0.78");
  await expect(runtime).toHaveAttribute("data-companion-look-spine-yaw-share", "0.22");
  await expect(runtime).toHaveAttribute("data-companion-look-head-pitch-share", "0.82");
  await expect(runtime).toHaveAttribute("data-companion-look-spine-pitch-share", "0.18");
  await expect(runtime).toHaveAttribute("data-companion-animation-clip", "idle");
  await expect(runtime).toHaveAttribute("data-companion-reaction-state", "idle");

  // These two fixture dates intentionally have different facts. The companion
  // receives only each activating button's screen position and uses the same cue.
  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue", "day-focus");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue-count", "1");
  await expect(runtime).toHaveAttribute("data-companion-look-state", "replay-cue");
  await expect(runtime).toHaveAttribute("data-companion-look-source", "replay");
  await expect(runtime).toHaveAttribute("data-companion-animation-clip", "idle");
  await expect(runtime).toHaveAttribute("data-companion-reaction-state", "idle");
  await expectSpinePostureActive(runtime);

  const {
    totalYaw,
    totalPitch,
    headYaw,
    spineYaw,
    headPitch,
    spinePitch,
    maxYaw,
    maxPitch,
  } = await readLookSnapshot(runtime);

  expect(Math.abs(headYaw + spineYaw - totalYaw)).toBeLessThan(0.0003);
  expect(Math.abs(headPitch + spinePitch - totalPitch)).toBeLessThan(0.0003);
  expect(Math.abs(totalYaw)).toBeLessThanOrEqual(maxYaw);
  expect(Math.abs(totalPitch)).toBeLessThanOrEqual(maxPitch);

  await buttons.nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue", "day-focus");
  await expect(runtime).toHaveAttribute("data-companion-replay-cue-count", "2");
  await expect(runtime).toHaveAttribute("data-companion-look-state", "replay-cue");
  await expect(runtime).toHaveAttribute("data-companion-look-source", "replay");
  await expect(runtime).toHaveAttribute("data-companion-animation-clip", "idle");
  await expect(runtime).toHaveAttribute("data-companion-reaction-state", "idle");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-screen", "S10");
});

test("S10 day focus attention remains presentation-only under touch input", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  try {
    await installReviewMedia(page);
    await page.clock.setFixedTime(new Date("2026-09-11T03:00:00Z"));
    await page.addInitScript({ content: fixtureScript });
    const url = new URL(
      "/?e2e=signed-in&screen=S10&recap_fixture=mixed"
        + "&companion_species=bear&companion_variant=lite&companion_clip=idle",
      baseURL ?? "http://127.0.0.1:4173",
    ).toString();
    await page.goto(url);

    const runtime = page.locator("[data-companion-status]");
    const buttons = page.locator(".seven-day-trail .trail-day-button");

    await expect(buttons).toHaveCount(7);
    await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });

    await buttons.nth(3).tap();
    await expect(buttons.nth(3)).toHaveAttribute("aria-pressed", "true");
    await expect(runtime).toHaveAttribute("data-companion-replay-cue", "day-focus");
    await expect(runtime).toHaveAttribute("data-companion-replay-cue-count", "1");
    await expect(runtime).toHaveAttribute("data-companion-look-state", "replay-cue");
    await expect(runtime).toHaveAttribute("data-companion-animation-clip", "idle");
    await expect(runtime).toHaveAttribute("data-companion-reaction-state", "idle");
    await expectSpinePostureActive(runtime);

    await expect(runtime).toHaveAttribute("data-companion-replay-cue", "none", { timeout: 2_500 });
    await expect(runtime).toHaveAttribute("data-companion-look-state", "centered", { timeout: 4_000 });
    await expect(runtime).toHaveAttribute("data-companion-look-head-yaw", "0.0000");
    await expect(runtime).toHaveAttribute("data-companion-look-spine-yaw", "0.0000");
    await expect(runtime).toHaveAttribute("data-companion-look-head-pitch", "0.0000");
    await expect(runtime).toHaveAttribute("data-companion-look-spine-pitch", "0.0000");
  } finally {
    await context.close();
  }
});

test("S10 day focus attention stays static under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLivingReplay(page);

  const runtime = page.locator("[data-companion-status]");
  const button = page.locator(".seven-day-trail .trail-day-button").nth(4);

  await expect(runtime).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-companion-look-enabled", "false");
  await expect(runtime).toHaveAttribute("data-companion-look-state", "disabled");
  await expect(runtime).toHaveAttribute("data-companion-motion", "stopped");

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(runtime).toHaveAttribute("data-companion-look-enabled", "false");
  await expect(runtime).toHaveAttribute("data-companion-motion", "stopped");
  await expect(runtime).toHaveAttribute("data-companion-animation-clip", "idle");
});
