import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const fixedNow = new Date("2026-09-11T03:00:00Z");
const today = "2026-09-11";

// These are the only browser-local keys guest mode may read or update. Both
// localStorage keys are non-medical presentation preferences; the session key
// is main.tsx's existing stale-Vite-chunk recovery timestamp.
const allowedLocalStorageKeys = ["sk7-companion-species", "sk7-ui-theme"];
const allowedSessionStorageKeys = ["sk7:vite-preload-recovery-at"];

function forbiddenRequestReason(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  if (url.hostname === "e2e.invalid") return "configured API/Supabase origin";
  if (/\/api\/v1(?:\/|$)/.test(url.pathname)) return "/api/v1 request";
  if (/\/(?:auth|rest|realtime|storage)\/v1(?:\/|$)/.test(url.pathname)) return "Supabase request";
  if (/\/rpc(?:\/|$)/.test(url.pathname)) return "RPC request";
  if (/refresh_token|grant_type=refresh_token|\/session(?:\/|$)/i.test(`${url.pathname}${url.search}`)) return "account/session refresh";
  if (/structured[-_/]?feedback|\/feedback(?:\/|$)/i.test(url.pathname)) return "structured feedback";
  return null;
}

async function installGuestNetworkFirewall(page: Page) {
  const violations: { reason: string; method: string; url: string }[] = [];
  const loadedAssets: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (/\/assets\/.+\.(?:js|css)$/.test(pathname)) loadedAssets.push(pathname);
    const reason = forbiddenRequestReason(request.url());
    if (!reason) return route.continue();
    violations.push({ reason, method: request.method(), url: request.url() });
    return route.fulfill({ status: 599, body: "guest network firewall" });
  });
  return {
    assertClean() {
      expect(violations, "guest mode attempted a forbidden product/auth/backend request").toEqual([]);
    },
    assertEntryIsolation() {
      expect(
        loadedAssets.some((pathname) => /\/GuestJourneySandbox-[^/]+\.js$/.test(pathname)),
        `loaded assets: ${loadedAssets.join(", ")}`,
      ).toBe(true);
      expect(loadedAssets.some((pathname) => /\/App-[^/]+\.(?:js|css)$/.test(pathname))).toBe(false);
    },
  };
}

async function assertGuestStorageFirewall(page: Page) {
  const snapshot = await page.evaluate(async ({ allowedLocal, allowedSession }) => {
    const entries = (storage: Storage) => Object.fromEntries(
      Array.from({ length: storage.length }, (_, index) => storage.key(index))
        .filter((key): key is string => Boolean(key))
        .map((key) => [key, storage.getItem(key)]),
    );
    const local = entries(localStorage);
    const session = entries(sessionStorage);
    const indexedDatabases = typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map((database) => database.name ?? "(unnamed)")
      : ["enumeration-unavailable"];
    const cacheNames = "caches" in window ? await caches.keys() : [];
    return {
      local,
      session,
      unexpectedLocal: Object.keys(local).filter((key) => !allowedLocal.includes(key)),
      unexpectedSession: Object.keys(session).filter((key) => !allowedSession.includes(key)),
      indexedDatabases,
      cacheNames,
      cookies: document.cookie,
    };
  }, { allowedLocal: allowedLocalStorageKeys, allowedSession: allowedSessionStorageKeys });

  expect(snapshot.unexpectedLocal).toEqual([]);
  expect(snapshot.unexpectedSession).toEqual([]);
  expect(snapshot.indexedDatabases).toEqual([]);
  expect(snapshot.cacheNames).toEqual([]);
  expect(snapshot.cookies).toBe("");
  expect(JSON.stringify({ local: snapshot.local, session: snapshot.session }))
    .not.toMatch(/132|84|143|91|walk-10-minutes|sleep-routine|low-sodium-meal|completed|skipped/);
}

async function openGuest(page: Page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(fixedNow);
  await page.goto("/?guest=1");
  await expect(page.locator('[data-guest-journey="memory-only"]')).toBeVisible();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page.getByText("체험 중 입력은 서버로 보내거나 저장하지 않아요.", { exact: true })).toHaveCount(1);
}

async function waitForGuestSpatialActor(page: Page) {
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 20_000 },
  );
  const layer = page.locator('[data-presence-scene-actor-interaction="S02"]');
  await expect(layer).toHaveCount(1);
  return layer;
}

async function rootPoint(layer: Locator) {
  return {
    x: Number(await layer.getAttribute("data-presence-root-x")),
    y: Number(await layer.getAttribute("data-presence-root-y")),
  };
}

async function dragActor(page: Page, layer: Locator) {
  const target = layer.getByRole("button", { name: "동반자 움직이기", exact: true });
  const box = await target.boundingBox();
  if (!box) throw new Error("guest S02 actor target has no bounds");
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const before = await rootPoint(layer);
  const commits = Number(await layer.getAttribute("data-presence-commit-count"));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 18, start.y - 12, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Number(await layer.getAttribute("data-presence-commit-count"))).toBe(commits + 1);
  const after = await rootPoint(layer);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(6);
}

async function createTodayBloodPressure(page: Page, systolic = "132", diastolic = "84") {
  await page.locator(".home-lead").getByRole("button", { name: "혈압 기록하기", exact: true }).click();
  await expect(page.locator('[data-scene="S04"]')).toBeVisible();
  await page.getByLabel(/수축기/).fill(systolic);
  await page.getByLabel(/이완기/).fill(diastolic);
  await page.getByRole("button", { name: "체험 기록에 반영", exact: true }).click();
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
}

async function chooseWalkingChallenge(page: Page) {
  await page.locator('button:has([data-choice="walk-10-minutes"])').click();
  await expect(page.locator('[data-scene="S06"]')).toBeVisible();
}

async function openTodayRecord(page: Page, kind: "blood-pressure" | "challenge-checkin") {
  const row = page.locator(`[data-record-kind="${kind}"][data-record-date="${today}"]`).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /상세 보기/ }).click();
  await expect(page.locator('[data-scene="S09"]')).toBeVisible();
}

test("guest full journey is memory-only, keeps #713 direct placement, and reload resets it", async ({ page }) => {
  const firewall = await installGuestNetworkFirewall(page);
  await openGuest(page);

  const actor = await waitForGuestSpatialActor(page);
  await dragActor(page, actor);
  await expect(page.locator(".living-three-scene")).toHaveAttribute("data-scene-actor-owner", "s02-actor-v1");

  await createTodayBloodPressure(page);
  await expect(page.locator('[data-saved-scene-status], [data-saved-scene-event]')).toHaveCount(0);
  await expect(page.locator('[data-scene="S05"]')).toContainText("현재 체험 메모리에만 적용돼요.");
  await page.getByRole("button", { name: "오늘의 기록 보기", exact: true }).click();
  await page.locator(".home-lead").getByRole("button", { name: "오늘 기록 보기", exact: true }).click();
  await expect(page.locator('[data-scene="S07"]')).toContainText("132/84 mmHg");

  await page.getByRole("button", { name: "행동 고르기", exact: true }).click();
  await expect(page.locator('[data-scene="S03"]')).toBeVisible();
  await chooseWalkingChallenge(page);
  await page.locator('[data-scene="S06"]').getByRole("button", { name: "기록함", exact: true }).click();
  await expect(page.locator('[data-challenge-checkin-state="completed"]')).toContainText("기록함");

  await page.locator(".primary-nav").getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
  await expect(page.locator(`[data-record-kind="blood-pressure"][data-record-date="${today}"]`)).toContainText("132/84 mmHg");
  await expect(page.locator(`[data-record-kind="challenge-checkin"][data-record-date="${today}"]`)).toContainText("10분 걷기");
  await openTodayRecord(page, "blood-pressure");
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("132/84 mmHg");

  await page.locator(".primary-nav").getByRole("button", { name: "7일 돌아보기", exact: true }).click();
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();
  await expect(page.locator('[data-dashboard-window="current"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /내보내기|새로고침/ })).toHaveCount(0);
  await page.getByRole("button", { name: "이전 7일 보기", exact: true }).click();
  await expect(page.locator('[data-dashboard-window="prior"]')).toBeVisible();
  await expect(page.locator('[data-week-fact="observation-count"]')).not.toHaveText("0건");
  await page.getByRole("button", { name: "7일 리포트 보기", exact: true }).click();
  await expect(page.locator("[data-living-week-report]")).toBeVisible();
  await expect(page.locator("[data-living-week-report]")).toContainText("현재 체험 메모리에 반영된 7일 기록이에요.");
  await page.getByRole("button", { name: "7일 돌아보기로 돌아가기", exact: true }).click();

  await page.locator(".primary-nav").getByRole("button", { name: "AI 분석", exact: true }).click();
  await expect(page.locator('[data-scene="S11"] [data-model-v2-synthetic-result]')).toHaveAttribute("data-model-v2-result-state", "not_ready");
  await expect(page.locator('[data-scene="S11"] form')).toHaveCount(0);

  await page.locator(".primary-nav").getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.locator('[data-scene="S14"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "계정 삭제", exact: true })).toHaveCount(0);
  await expect(page.getByText(/30일 보관|서버 내보내기/)).toHaveCount(0);
  await page.locator('input[name="sk7-theme-preset"][value="warm"]').check();
  await page.locator("#guest-companion-species").selectOption("cat");
  await page.locator(".primary-nav").getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await page.clock.fastForward(31_000);
  await expect(page.locator('[data-guest-journey="memory-only"]')).toBeVisible();

  firewall.assertClean();
  firewall.assertEntryIsolation();
  await assertGuestStorageFirewall(page);

  await page.reload();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page.locator(".home-lead")).toContainText("오늘 혈압 기록");
  await expect(page.locator(".home-lead")).toContainText("혈압 기록하기");
  await expect(page.getByText("132/84 mmHg", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-guest-companion-species="cat"]')).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-sk7-theme", "warm");
  firewall.assertClean();
  firewall.assertEntryIsolation();
  await assertGuestStorageFirewall(page);
});

test("guest BP and challenge records support create, edit, update, and delete only in memory", async ({ page }) => {
  const firewall = await installGuestNetworkFirewall(page);
  await openGuest(page);

  await createTodayBloodPressure(page, "142", "92");
  await page.getByRole("button", { name: "오늘의 기록 보기", exact: true }).click();
  await page.locator(".primary-nav").getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await openTodayRecord(page, "blood-pressure");
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByLabel(/수축기/).fill("143");
  await page.getByLabel(/이완기/).fill("91");
  await page.getByRole("button", { name: "변경 반영", exact: true }).click();
  await expect(page.locator('[data-record-detail-kind="blood-pressure"]')).toContainText("143/91 mmHg");
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.locator(`[data-record-kind="blood-pressure"][data-record-date="${today}"]`)).toHaveCount(0);

  await page.locator(".primary-nav").getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await page.locator('[data-home-concept="challenge"]').click();
  await chooseWalkingChallenge(page);
  await page.locator('[data-scene="S06"]').getByRole("button", { name: "기록함", exact: true }).click();
  await page.locator(".primary-nav").getByRole("button", { name: "기록 찾아보기", exact: true }).click();
  await openTodayRecord(page, "challenge-checkin");
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.locator(".confirmation").getByRole("button", { name: "건너뜀", exact: true }).click();
  await expect(page.locator('[data-record-detail-kind="challenge-checkin"]')).toContainText("건너뜀");
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.locator(`[data-record-kind="challenge-checkin"][data-record-date="${today}"]`)).toHaveCount(0);

  firewall.assertClean();
  await assertGuestStorageFirewall(page);
});

test("S01 entry uses the canonical isolated guest query and S14 can end the guest visit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(fixedNow);
  await page.goto("/");
  await page.getByRole("button", { name: "로그인 없이 30초 맛보기", exact: true }).click();
  await expect(page).toHaveURL(/\?guest=1$/);
  await expect(page.locator('[data-guest-journey="memory-only"]')).toBeVisible();
  await page.locator(".primary-nav").getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("button", { name: "체험 끝내고 로그인으로", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-scene="S01"].journey-login')).toBeVisible();
});

async function captureGuestVisuals(page: Page, testInfo: TestInfo, width: number, height: number) {
  await openGuest(page, width, height);
  if (width >= 390) {
    await expect(page.locator("[data-living-scene-status]")).toHaveAttribute("data-living-scene-status", /ready|poster/, { timeout: 20_000 });
    // "ready" means the model and renderer are mounted; allow the first
    // compositor frames to land before preserving visual-QA evidence.
    await page.waitForTimeout(1_000);
  }
  await page.screenshot({ path: testInfo.outputPath(`guest-S02-${width}x${height}.png`), animations: "disabled" });

  await page.locator(".home-lead").getByRole("button", { name: "혈압 기록하기", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath(`guest-S04-${width}x${height}.png`), animations: "disabled" });
  await page.getByLabel(/수축기/).fill("132");
  await page.getByLabel(/이완기/).fill("84");
  await page.getByRole("button", { name: "체험 기록에 반영", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath(`guest-S05-${width}x${height}.png`), animations: "disabled" });

  await page.locator(".primary-nav").getByRole("button", { name: "7일 돌아보기", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath(`guest-S10-${width}x${height}.png`), animations: "disabled" });
  await page.locator(".primary-nav").getByRole("button", { name: "설정", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath(`guest-S14-${width}x${height}.png`), animations: "disabled" });
}

for (const [width, height] of [[390, 844], [1366, 768]] as const) {
  test(`guest visual QA capture at ${width}x${height}`, async ({ page }, testInfo) => {
    await captureGuestVisuals(page, testInfo, width, height);
  });
}
