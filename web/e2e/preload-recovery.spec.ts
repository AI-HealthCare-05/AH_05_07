import { expect, test } from "@playwright/test";

const LOAD_COUNT_KEY = "sk7:e2e-preload-document-load-count";

test("#993 mounted My Space owns optional world chunk recovery without a page reload", async ({ page }) => {
  await page.addInitScript((key) => {
    const next = Number(sessionStorage.getItem(key) ?? "0") + 1;
    sessionStorage.setItem(key, String(next));
  }, LOAD_COUNT_KEY);

  let failedWorldChunks = 0;
  await page.route("**/assets/PlaceableWorld-*.js", async (route) => {
    failedWorldChunks += 1;
    await route.abort("failed");
  });

  await page.goto("/?experience=e2&view=3d&storage=browser");

  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-view", "3d");
  await expect(page.getByRole("alert")).toContainText("3D 광장을 열지 못했어요");

  expect(failedWorldChunks).toBeGreaterThan(0);

  const documentLoads = await page.evaluate(
    (key) => Number(sessionStorage.getItem(key) ?? "0"),
    LOAD_COUNT_KEY,
  );

  // A mounted My Space parent already owns truthful local recovery.
  // Global preload recovery must not reload that parent first.
  expect(documentLoads).toBe(1);
});


test("#993 global preload recovery still reloads when no local owner is mounted", async ({ page }) => {
  await page.addInitScript((key) => {
    const next = Number(sessionStorage.getItem(key) ?? "0") + 1;
    sessionStorage.setItem(key, String(next));
  }, LOAD_COUNT_KEY);

  await page.goto("/");
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();

  const reloaded = page.waitForEvent("domcontentloaded");

  await page.evaluate(() => {
    window.setTimeout(() => {
      window.dispatchEvent(
        new Event("vite:preloadError", { cancelable: true }),
      );
    }, 0);
  });

  await reloaded;

  await expect.poll(() => page.evaluate(
    (key) => Number(sessionStorage.getItem(key) ?? "0"),
    LOAD_COUNT_KEY,
  )).toBe(2);
});
