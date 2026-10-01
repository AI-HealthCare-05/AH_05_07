import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { companionAssetManifest } from "../src/ui/companionAssets.generated";
import { chooseTime } from "./model-v2-time-wheel";

const modelFixturePath = fileURLToPath(new URL("../public/models/model-v2.json", import.meta.url));
const timeInputs = [
  ["model-weekday-bed", "23:30"],
  ["model-weekday-wake", "07:00"],
  ["model-weekend-bed", "23:30"],
  ["model-weekend-wake", "08:00"],
] as const;

async function routeGuestModel(page: Page) {
  const requests: { method: string; body: string | null; url: string }[] = [];
  await page.route("**/models/model-v2.json", async (route) => {
    const request = route.request();
    requests.push({ method: request.method(), body: request.postData(), url: request.url() });
    expect(request.method()).toBe("GET");
    expect(request.postData()).toBeNull();
    await route.fulfill({ path: modelFixturePath });
  });
  return requests;
}

const step = (page: Page, value: string) => page.locator(`[data-model-v2-step="${value}"]`);
const submit = (page: Page) => page.getByRole("button", { name: "Model V2로 분석하기", exact: true });
const result = (page: Page) => page.locator('[data-model-v2-user-result="processed"]');

async function begin(page: Page) {
  await expect(step(page, "intake")).toBeVisible();
}

async function fillBasics(page: Page, age = "35") {
  await page.locator("#model-age").fill(age);
  await page.locator("#model-sex").check();
  await page.locator("#model-height").fill("170");
  await page.locator("#model-weight").fill("68");
}

async function fillActivity(page: Page) {
  await page.locator("#model-walking-days-4").check();
  await page.locator("#model-walking-total-minutes").fill("40");
  await page.locator("#model-strength-2_days").check();
}

async function fillSleep(page: Page) {
  for (const [id, value] of timeInputs) await chooseTime(page, id, value);
}

async function fillHabits(page: Page) {
  await page.locator("#model-smoking-never_smoked").check();
  await page.locator("#model-alcohol-frequency").selectOption("lt_monthly");
  await page.locator("#model-alcohol-amount").selectOption("1_2_drinks");
}

async function fillIntake(page: Page) {
  await begin(page);
  await fillBasics(page);
  await fillActivity(page);
  await fillSleep(page);
  await fillHabits(page);
  await expect(step(page, "intake")).toBeVisible();
}

async function holdGuestModel(page: Page) {
  const requests: { method: string; body: string | null; url: string }[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/models/model-v2.json", async (route) => {
    const request = route.request();
    requests.push({ method: request.method(), body: request.postData(), url: request.url() });
    expect(request.method()).toBe("GET");
    expect(request.postData()).toBeNull();
    await gate;
    await route.fulfill({ path: modelFixturePath });
  });
  return { requests, release };
}

const sensitiveSurveyMarkers = [
  "0.055",
  "35",
  "170",
  "68",
  "never_smoked",
  "lt_monthly",
  "1_2_drinks",
  "2_days",
  "age_years",
  "sex_knhanes",
  "bmi_from_height_weight",
  "cigarette_smoking_state",
  "alcohol_frequency",
  "alcohol_amount_category",
  "walking_days_7d",
  "walking_minutes_per_active_day",
  "strength_days_7d",
  "weekday_sleep_minutes",
  "weekend_sleep_minutes",
] as const;

const allowedLocalStorageKeys = ["sk7-companion-species", "sk7-ui-theme"];
const allowedSessionStorageKeys = ["sk7:vite-preload-recovery-at"];

type StorageRecord = {
  storage: "local" | "session" | "idb" | "cache" | "cookie";
  method: string;
  key?: string;
  args?: unknown;
};

function forbiddenRequestReason(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  if (url.hostname === "e2e.invalid") return "configured API/Supabase origin";
  if (/\/api\/v1(?:\/|$)/.test(url.pathname)) return "/api/v1 request";
  if (/\/(?:auth|rest|realtime|storage)\/v1(?:\/|$)/.test(url.pathname)) return "Supabase request";
  if (/\/rpc(?:\/|$)/.test(url.pathname)) return "RPC request";
  if (/refresh_token|grant_type=refresh_token|\/session(?:\/|$)/i.test(`${url.pathname}${url.search}`)) return "account/session refresh";
  if (/structured[-_\/]?feedback|\/feedback(?:\/|$)/i.test(url.pathname)) return "structured feedback";
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
      expect(loadedAssets.some((pathname) => /\/ProductPlaceableEntry-[^/]+\.js$/.test(pathname))).toBe(false);
      expect(loadedAssets.some((pathname) => /\/persistence-[^/]+\.js$/.test(pathname))).toBe(false);
    },
  };
}

async function observeGuestTwoPhaseNetwork(page: Page) {
  // Bootstrap phase: normal guest entry/static/scene requests are allowed.
  // Sensitive phase begins once the first survey answer is entered.
  type RequestRecord = { method: string; url: string; phase: "A" | "B" };
  let phaseBStarted = false;
  const records: RequestRecord[] = [];
  page.on("request", (request) => {
    records.push({ method: request.method(), url: request.url(), phase: phaseBStarted ? "B" : "A" });
  });

  function phase(phaseName: "A" | "B") {
    return records.filter((record) => record.phase === phaseName);
  }

  function isAllowedPhaseA(record: RequestRecord): boolean {
    const parsed = new URL(record.url);
    const sameOrigin = parsed.origin === new URL(page.url()).origin;
    if (record.method === "GET" && sameOrigin && parsed.pathname === "/" && (parsed.search === "" || parsed.search.startsWith("?guest="))) return true;
    if ((record.method === "GET" || record.method === "HEAD") && sameOrigin && parsed.pathname.startsWith("/assets/")) return true;
    if (record.method === "GET" && sameOrigin && parsed.pathname === "/models/model-v2.json" && parsed.search === "") return true;
    if ((record.method === "GET" || record.method === "HEAD") && parsed.hostname === "sk7-companion.gkrry.com" && (parsed.pathname.startsWith("/companion/v1/") || parsed.pathname.startsWith("/scene-review/"))) return true;
    if ((record.method === "GET" || record.method === "HEAD") && parsed.hostname === "sk7-assets.gomdory.com" && parsed.pathname.startsWith("/visual/v1/")) return true;
    if ((record.method === "GET" || record.method === "HEAD") && sameOrigin && (parsed.pathname === "/favicon.ico" || parsed.pathname === "/favicon.svg")) return true;
    if ((record.method === "GET" || record.method === "HEAD") && sameOrigin && [
      "/showcase-cinema.css",
      "/showcase-cinema.js",
      "/canonical-origin.js",
      "/src/main.tsx",
    ].includes(parsed.pathname)) return true;
    return false;
  }

  function isExactModelGet(record: RequestRecord): boolean {
    const parsed = new URL(record.url);
    const sameOrigin = parsed.origin === new URL(page.url()).origin;
    return record.method === "GET"
      && sameOrigin
      && parsed.pathname === "/models/model-v2.json"
      && parsed.search === ""
      && parsed.hash === "";
  }

  return {
    startSensitivePhase() {
      phaseBStarted = true;
    },
    assertPhaseA() {
      for (const record of phase("A")) {
        expect(isAllowedPhaseA(record), `unexpected phase-A request: ${record.method} ${record.url}`).toBe(true);
      }
    },
    assertPhaseB() {
      for (const record of phase("B")) {
        expect(isExactModelGet(record), `phase-B request after sensitive input must be the exact model GET: ${record.method} ${record.url}`).toBe(true);
      }
    },
  };
}

async function observeGuestStorage(page: Page) {
  await page.addInitScript(({ allowedLocal, allowedSession }) => {
    (window as unknown as { guestStorageRecords: StorageRecord[] }).guestStorageRecords = [];
    const record = (storage: StorageRecord["storage"], method: string, args: unknown[]) => {
      const rec: StorageRecord = { storage, method };
      if (typeof args[0] === "string") rec.key = args[0];
      if (method === "setItem" && args.length > 1) rec.args = args[1];
      (window as unknown as { guestStorageRecords: StorageRecord[] }).guestStorageRecords.push(rec);
    };

    for (const method of ["getItem", "setItem", "removeItem", "clear"] as const) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (this: Storage, ...args: unknown[]) {
        const name = this === localStorage ? "local" : this === sessionStorage ? "session" : "unknown";
        record(name as StorageRecord["storage"], method, args);
        return Reflect.apply(original, this, args);
      };
    }

    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => cookie.get!.call(document),
      set: (value: string) => { record("cookie", "set", [value]); cookie.set!.call(document, value); },
    });

    if (globalThis.indexedDB) {
      const wrapObjectStore = (target: IDBObjectStore) => {
        for (const method of ["add", "put", "delete", "clear"] as const) {
          const original = (target as unknown as Record<string, unknown>)[method];
          if (typeof original === "function") {
            (target as unknown as Record<string, unknown>)[method] = function (this: IDBObjectStore, ...args: unknown[]) {
              record("idb", `objectStore.${method}`, args);
              return Reflect.apply(original as (...args: unknown[]) => unknown, this, args);
            };
          }
        }
      };
      const originalOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args: unknown[]) => {
        record("idb", "open", args);
        const request = originalOpen(...args);
        request.addEventListener("upgradeneeded", (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          record("idb", "open.upgradeneeded", [db.name, db.version]);
        });
        return request;
      };
      const originalDeleteDatabase = indexedDB.deleteDatabase.bind(indexedDB);
      indexedDB.deleteDatabase = (...args: unknown[]) => { record("idb", "deleteDatabase", args); return originalDeleteDatabase(...args); };

      // Wrap future object stores obtained through transaction.objectStore().
      const originalObjectStore = IDBTransaction.prototype.objectStore;
      IDBTransaction.prototype.objectStore = function (this: IDBTransaction, ...args: unknown[]) {
        const store = Reflect.apply(originalObjectStore, this, args) as IDBObjectStore;
        wrapObjectStore(store);
        return store;
      };
    }

    if (globalThis.caches) {
      const originalCacheOpen = caches.open.bind(caches);
      caches.open = async (...args: unknown[]) => {
        record("cache", "open", args);
        const cache = await originalCacheOpen(...args);
        for (const method of ["put", "add", "addAll", "delete"] as const) {
          const original = (cache as unknown as Record<string, unknown>)[method];
          (cache as unknown as Record<string, unknown>)[method] = function (this: Cache, ...methodArgs: unknown[]) {
            record("cache", `Cache.${method}`, methodArgs);
            return Reflect.apply(original as (...args: unknown[]) => unknown, this, methodArgs);
          };
        }
        return cache;
      };
      const originalCacheDelete = caches.delete.bind(caches);
      caches.delete = async (...args: unknown[]) => { record("cache", "CacheStorage.delete", args); return originalCacheDelete(...args); };
    }
  }, { allowedLocal: allowedLocalStorageKeys, allowedSession: allowedSessionStorageKeys });

  return {
    async assertClean() {
      const records = await page.evaluate(() => (window as unknown as { guestStorageRecords: StorageRecord[] }).guestStorageRecords);
      const unexpected: StorageRecord[] = [];
      for (const record of records) {
        if (record.storage === "local") {
          if (!allowedLocalStorageKeys.includes(record.key ?? "")) unexpected.push(record);
        } else if (record.storage === "session") {
          if (!allowedSessionStorageKeys.includes(record.key ?? "")) unexpected.push(record);
        } else if (record.storage === "idb" || record.storage === "cache" || record.storage === "cookie") {
          // IDB and cache mutations are unexpected in guest S11 flow.
          unexpected.push(record);
        }
      }
      expect(unexpected, `unexpected durable write operations: ${JSON.stringify(unexpected)}`).toEqual([]);

      const allValues = records
        .filter((record) => record.storage === "local" || record.storage === "session")
        .map((record) => String(record.args ?? ""))
        .join("\n");
      const allArgs = records.map((record) => JSON.stringify(record.args)).join("\n");
      const combined = `${allValues}\n${allArgs}`;
      for (const marker of sensitiveSurveyMarkers) {
        expect(combined, `storage value leaked survey/model payload: ${marker}`).not.toContain(marker);
      }
    },
  };
}

async function observeGuestUrlPayloads(page: Page) {
  await page.addInitScript(() => {
    type HistoryEntry = { url: string; data: string };
    (window as unknown as { guestUrlHistory: HistoryEntry[] }).guestUrlHistory = [{ url: location.href, data: "" }];
    const serialize = (value: unknown) => {
      try { return JSON.stringify(value); } catch { return "[unserializable]"; }
    };
    const record = (url: string, data: unknown) => {
      (window as unknown as { guestUrlHistory: HistoryEntry[] }).guestUrlHistory.push({ url, data: serialize(data) });
    };
    const originalPushState = history.pushState.bind(history);
    history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
      const result = originalPushState(data, unused, url);
      record(typeof url === "string" ? new URL(url, location.href).href : location.href, data);
      return result;
    };
    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
      const result = originalReplaceState(data, unused, url);
      record(typeof url === "string" ? new URL(url, location.href).href : location.href, data);
      return result;
    };
    window.addEventListener("popstate", (event) => {
      record(location.href, event.state);
    });
  });
  return {
    async assertClean() {
      const history = await page.evaluate(() => (window as unknown as { guestUrlHistory: { url: string; data: string }[] }).guestUrlHistory);
      const joined = [...history.map((entry) => `${entry.url}\n${entry.data}`), page.url()].join("\n");
      for (const marker of sensitiveSurveyMarkers) {
        expect(joined, `URL/history leaked survey/model payload: ${marker}`).not.toContain(marker);
      }
    },
  };
}

async function installGuestCryptoDigestObserver(page: Page) {
  await page.addInitScript(() => {
    type DigestRecord = { algorithm: string; count: number };
    (window as unknown as { guestDigestRecords: DigestRecord[] }).guestDigestRecords = [];
    if (globalThis.crypto?.subtle?.digest) {
      const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest = async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const result = await originalDigest(algorithm, data);
        const name = typeof algorithm === "string" ? algorithm : (algorithm as { name?: string }).name ?? "unknown";
        (window as unknown as { guestDigestRecords: DigestRecord[] }).guestDigestRecords.push({ algorithm: name, count: (data as ArrayBufferView).byteLength ?? 0 });
        return result;
      };
    }
  });
  return {
    async waitForSha256Digests(minimum: number, timeout = 10_000) {
      await page.waitForFunction((expected) => {
        const records = (window as unknown as { guestDigestRecords: { algorithm: string }[] }).guestDigestRecords;
        return records.filter((record) => record.algorithm === "SHA-256").length >= expected;
      }, minimum, { timeout });
    },
    async count() {
      return page.evaluate(() =>
        (window as unknown as { guestDigestRecords: { algorithm: string }[] }).guestDigestRecords)
        .then((records) => records.filter((record) => record.algorithm === "SHA-256").length);
    },
  };
}

async function installGuestS11Audits(page: Page) {
  const network = await observeGuestTwoPhaseNetwork(page);
  const storage = await observeGuestStorage(page);
  const urls = await observeGuestUrlPayloads(page);
  return { network, storage, urls };
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

async function openGuest(page: Page, width = 390, height = 844, fixedTime: string | Date = fixedNow) {
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(fixedTime);
  // Remote registered visual assets must not hold the document entry contract
  // open indefinitely; the scene readiness assertion below owns that boundary.
  await page.goto("/?guest=1", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-guest-journey="memory-only"]')).toBeVisible();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page.getByText("체험 중 입력은 서버로 보내거나 저장하지 않아요.", { exact: true })).toHaveCount(1);
  await expect(page.getByText("로그인해도 계정으로 옮겨지지 않아요.", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "실제 기록은 로그인으로", exact: true })).toBeVisible();
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
  const target = layer.getByRole("button", { name: "동반자 반응 보기", exact: true });
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

function companionRequests(urls: string[]) {
  return urls.filter((url) => /sk7-companion\.gkrry\.com\/companion\/v1\/.+\.glb(?:\?|$)/i.test(url));
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

const fixedNow = new Date("2026-09-11T03:00:00Z");
const today = "2026-09-11";

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
  await expect(page.getByRole("definition")).toHaveText(["선택한 오늘", "오늘부터 7일", "첫 상태 기록 전까지"]);
  await chooseWalkingChallenge(page);
  await expect(page.locator('[data-challenge-timeline="active"] [data-challenge-day]')).toHaveCount(7);
  await page.locator('[data-scene="S06"]').getByRole("button", { name: "기록함", exact: true }).click();
  await expect(page.locator('[data-challenge-checkin-state="completed"]')).toContainText("기록함");
  await expect(page.locator(`[data-challenge-day="${today}"]`)).toHaveAttribute("data-challenge-day-state", "completed");

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
  await expect(page.locator("[data-report-freshness]")).toHaveAttribute("data-report-confirmed", "true");
  await expect(page.locator("[data-living-week-report] footer")).toContainText("체험을 새로 열면 원본 기록은 초기화돼요.");
  await page.getByRole("button", { name: "7일 돌아보기로 돌아가기", exact: true }).click();

  await page.locator(".primary-nav").getByRole("button", { name: "AI 분석", exact: true }).click();
  await expect(page).toHaveURL(/screen=S11/);
  await expect(page.locator('[data-scene="S11"]')).toBeVisible();
  await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();
  await expect(page.locator('[data-scene="S11"] form')).toBeVisible();
  await expect(page.getByText("로그인 없이 체험하는 중이에요.")).toBeVisible();
  await expect(page.locator('[data-guest-model-v2-demo="available"]')).toHaveCount(0);
  await expect(page.locator('[data-scene="S11"] [data-model-v2-result-state]')).toHaveCount(0);
  await expect(page.getByText("아직 준비 중이에요")).toHaveCount(0);
  await expect(page.getByText("검증된 모델이 준비되기 전에는 결과를 표시하지 않습니다.")).toHaveCount(0);

  await page.locator(".primary-nav").getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.locator('[data-scene="S14"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "계정 삭제", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-scene="S14"] .journey-settings-group-heading h2')).toHaveText(["이 브라우저의 설정", "체험 끝내기"]);
  await expect(page.locator('[data-scene="S14"]')).toContainText("이 브라우저에만 저장");
  await expect(page.locator('[data-scene="S14"]')).not.toContainText("서버 기록");
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
  const network = await installGuestNetworkFirewall(page);
  await page.getByRole("button", { name: "3D 공간 둘러보기" }).press("Enter");
  await expect(page).toHaveURL(/\?guest=1&space=plaza$/);
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await page.getByRole("button", { name: "오늘 화면으로 돌아가기" }).press("Enter");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  network.assertClean();
  await page.locator(".primary-nav").getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("button", { name: "체험 끝내고 로그인으로", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-scene="S01"].journey-login')).toBeVisible();
});

test("S01 fox identity continues through guest S02, confirmed S05, and S10 without a bear S05 request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(fixedNow);
  await page.goto("/");
  await page.locator("#login-companion-species").selectOption("fox");
  await expect.poll(() => companionRequests(requests).filter((url) => url === companionAssetManifest.fox.lite.url).length).toBeGreaterThan(0);
  const s02RequestStart = requests.length;
  await page.getByRole("button", { name: "로그인 없이 30초 맛보기", exact: true }).click();
  await expect(page.locator('[data-living-scene="S02"]')).toBeVisible();
  await expect.poll(() => companionRequests(requests.slice(s02RequestStart))).toContain(companionAssetManifest.fox.lite.url);

  await page.locator(".home-lead").getByRole("button", { name: "혈압 기록하기", exact: true }).click();
  const s05RequestStart = requests.length;
  await page.getByLabel(/수축기/).fill("132");
  await page.getByLabel(/이완기/).fill("84");
  await page.getByRole("button", { name: "체험 기록에 반영", exact: true }).click();
  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  const slot = page.locator('.companion-runtime-slot[data-companion-species="fox"]');
  await expect(slot).toHaveAttribute("data-companion-asset-id", companionAssetManifest.fox.lite.assetId);
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(page.locator('[data-saved-scene-status], [data-saved-scene-event]')).toHaveCount(0);
  const s05Requests = companionRequests(requests.slice(s05RequestStart));
  expect(s05Requests).toContain(companionAssetManifest.fox.lite.url);
  expect(s05Requests).not.toContain(companionAssetManifest.bear.lite.url);

  const s10RequestStart = requests.length;
  await page.locator(".primary-nav").getByRole("button", { name: "7일 돌아보기", exact: true }).click();
  await expect(page.locator('[data-living-scene="S10"]')).toBeVisible();
  await page.locator(".living-visual-stage").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-living-scene-status]")).toHaveAttribute(
    "data-living-scene-status",
    "ready",
    { timeout: 30_000 },
  );
  await expect.poll(() => companionRequests(requests.slice(s10RequestStart))).toContain(
    companionAssetManifest.fox.lite.url,
  );
  expect(companionRequests(requests.slice(s10RequestStart))).not.toContain(companionAssetManifest.bear.lite.url);
});

test("guest S14 cat identity continues into an actual memory-only S05 confirmation", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await openGuest(page);
  await page.locator(".primary-nav").getByRole("button", { name: "설정", exact: true }).click();
  await page.locator("#guest-companion-species").selectOption("cat");
  const s02RequestStart = requests.length;
  await page.locator(".primary-nav").getByRole("button", { name: "오늘의 기록", exact: true }).click();
  await expect(page.locator('[data-living-scene="S02"]')).toBeVisible();
  await expect.poll(() => companionRequests(requests.slice(s02RequestStart))).toContain(companionAssetManifest.cat.lite.url);

  await page.locator(".home-lead").getByRole("button", { name: "혈압 기록하기", exact: true }).click();
  const s05RequestStart = requests.length;
  await page.getByLabel(/수축기/).fill("131");
  await page.getByLabel(/이완기/).fill("83");
  await page.getByRole("button", { name: "체험 기록에 반영", exact: true }).click();
  await expect(page.locator('[data-scene="S05"]')).toContainText("현재 체험 메모리에만 적용돼요.");
  await expect(page.locator('.companion-runtime-slot[data-companion-species="cat"]')).toHaveAttribute(
    "data-companion-asset-id",
    companionAssetManifest.cat.lite.assetId,
  );
  await expect(page.locator("[data-companion-status]")).toHaveAttribute("data-companion-status", "ready", { timeout: 30_000 });
  await expect(page.locator('[data-saved-scene-status], [data-saved-scene-event]')).toHaveCount(0);
  const s05Requests = companionRequests(requests.slice(s05RequestStart));
  // A registered GLB already loaded by S02 may be reused by S05. The ready
  // descriptor above proves identity; a second network GET is not required.
  expect(companionRequests(requests)).toContain(companionAssetManifest.cat.lite.url);
  expect(s05Requests).not.toContain(companionAssetManifest.bear.lite.url);
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

async function captureGuestS11Visuals(page: Page, testInfo: TestInfo, width: number, height: number) {
  await routeGuestModel(page);
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime("2026-09-23T12:00:00+09:00");
  await page.goto("/?guest=1&screen=S11", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`guest-S11-intake-${width}x${height}.png`), animations: "disabled" });
  await fillIntake(page);
  await submit(page).click();
  await expect(result(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`guest-S11-result-${width}x${height}.png`), animations: "disabled" });
}

for (const [width, height] of [[390, 844], [1366, 768]] as const) {
  test(`guest S11 real flow visual QA capture at ${width}x${height}`, async ({ page }, testInfo) => {
    await captureGuestS11Visuals(page, testInfo, width, height);
  });
}

test.describe("guest S11 real local model flow", () => {
  test("completes real ModelV2InputFlow from primary nav inside preview window", async ({ page }) => {
    const firewall = await installGuestNetworkFirewall(page);
    const audits = await installGuestS11Audits(page);
    const modelRequests = await routeGuestModel(page);
    await openGuest(page, 390, 844, "2026-09-23T12:00:00+09:00");

    await page.locator(".primary-nav").getByRole("button", { name: "AI 분석", exact: true }).click();
    await expect(page).toHaveURL(/screen=S11/);
    await expect(page.locator('[data-scene="S11"]')).toBeVisible();
    await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();
    await expect(page.locator('[data-scene="S11"] form')).toBeVisible();
    await expect(page.getByText("로그인 없이 체험하는 중이에요.")).toBeVisible();
    await expect(page.locator('[data-guest-model-v2-demo="available"]')).toHaveCount(0);
    await expect(page.getByText("아직 준비 중이에요")).toHaveCount(0);
    await expect(page.getByText("검증된 모델이 준비되기 전에는 결과를 표시하지 않습니다.")).toHaveCount(0);

    await audits.network.startSensitivePhase();
    await fillIntake(page);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    expect(modelRequests).toEqual([{
      method: "GET",
      body: null,
      url: expect.stringMatching(/\/models\/model-v2\.json(?:\?|$)/),
    }]);
    expect(new URL(modelRequests[0].url).search).toBe("");

    const preview = result(page).locator("[data-model-v2-preview]");
    await expect(preview).toBeVisible();
    await expect(preview.locator("#model-v2-preview-label")).toHaveText("연구/개발 미리보기 · 내부 연속 출력");
    await expect(preview.locator("[data-model-v2-preview-value]")).toHaveText("0.055");
    await expect(result(page).locator(".model-v2-local-privacy")).toHaveText(
      "이 브라우저에서 계산됨 · 분석 입력·결과 서버 전송 없음 · 저장 안 함",
    );

    audits.network.assertPhaseA();
    audits.network.assertPhaseB();
    await audits.storage.assertClean();
    await audits.urls.assertClean();

    firewall.assertClean();
    firewall.assertEntryIsolation();
    await assertGuestStorageFirewall(page);
  });

  test("completes real ModelV2InputFlow directly with ?guest=1&screen=S11", async ({ page }) => {
    const firewall = await installGuestNetworkFirewall(page);
    const audits = await installGuestS11Audits(page);
    const modelRequests = await routeGuestModel(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime("2026-09-23T12:00:00+09:00");
    await page.goto("/?guest=1&screen=S11", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-guest-journey="memory-only"]')).toBeVisible();
    await expect(page.locator('[data-scene="S11"]')).toBeVisible();
    await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();
    await expect(page.locator('[data-scene="S11"] form')).toBeVisible();
    await expect(page.getByText("로그인 없이 체험하는 중이에요.")).toBeVisible();

    await audits.network.startSensitivePhase();
    await fillIntake(page);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    await expect(result(page).locator("[data-model-v2-preview-value]")).toHaveText("0.055");
    expect(modelRequests).toHaveLength(1);
    expect(modelRequests[0].method).toBe("GET");
    expect(modelRequests[0].body).toBeNull();
    expect(new URL(modelRequests[0].url).pathname).toBe("/models/model-v2.json");

    audits.network.assertPhaseA();
    audits.network.assertPhaseB();
    await audits.storage.assertClean();
    await audits.urls.assertClean();

    firewall.assertClean();
    firewall.assertEntryIsolation();
    await assertGuestStorageFirewall(page);
  });

  test("hides numeric output outside the preview window while keeping non-numeric completion", async ({ page }) => {
    const firewall = await installGuestNetworkFirewall(page);
    const audits = await installGuestS11Audits(page);
    const modelRequests = await routeGuestModel(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime("2026-10-18T12:00:00+09:00");
    await page.goto("/?guest=1&screen=S11", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-guest-journey="memory-only"]')).toBeVisible();
    await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();

    await audits.network.startSensitivePhase();
    await fillIntake(page);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    await expect(result(page).locator("[data-model-v2-preview]")).toHaveCount(0);
    await expect(result(page).locator(".model-v2-outcome-heading")).toContainText(
      "현재 제품에서는 개인별 모델 점수·확률·백분율·등급을 표시하지 않아요.",
    );
    await expect(result(page).locator(".model-v2-local-privacy")).toBeVisible();
    expect(modelRequests).toHaveLength(1);

    audits.network.assertPhaseA();
    audits.network.assertPhaseB();
    await audits.storage.assertClean();
    await audits.urls.assertClean();

    firewall.assertClean();
    firewall.assertEntryIsolation();
    await assertGuestStorageFirewall(page);
  });

  test("discards transient draft and result on navigate away, reload, and return", async ({ page }) => {
    const firewall = await installGuestNetworkFirewall(page);
    const modelRequests = await routeGuestModel(page);
    await page.clock.setFixedTime("2026-09-23T12:00:00+09:00");
    await page.goto("/?guest=1&screen=S11", { waitUntil: "domcontentloaded" });

    await fillIntake(page);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    await expect(result(page).locator("[data-model-v2-preview-value]")).toHaveText("0.055");
    const afterFirstSubmit = modelRequests.length;

    await page.locator(".primary-nav").getByRole("button", { name: "오늘의 기록", exact: true }).click();
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    await expect(result(page)).toHaveCount(0);

    await page.locator(".primary-nav").getByRole("button", { name: "AI 분석", exact: true }).click();
    await expect(page).toHaveURL(/screen=S11/);
    await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();
    await expect(result(page)).toHaveCount(0);
    await expect(page.locator('[data-scene="S11"] form')).toBeVisible();

    await begin(page);
    await page.locator("#model-age").fill("35");
    await page.reload();
    await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();
    await expect(result(page)).toHaveCount(0);
    expect(modelRequests).toHaveLength(afterFirstSubmit);

    firewall.assertClean();
    firewall.assertEntryIsolation();
    await assertGuestStorageFirewall(page);
  });

  test("completes once after an ordinary parent re-render while the model response is held", async ({ page }) => {
    const firewall = await installGuestNetworkFirewall(page);
    const audits = await installGuestS11Audits(page);
    const { requests: modelRequests, release } = await holdGuestModel(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime("2026-09-23T12:00:00+09:00");
    // Start with dashboard_window=current so a legitimate non-medical parent state change can be forced.
    await page.goto("/?guest=1&screen=S11&dashboard_window=current", { waitUntil: "domcontentloaded" });

    await audits.network.startSensitivePhase();
    await fillIntake(page);
    await submit(page).click();
    await expect(page.locator("#model-v2-pending")).toBeVisible();
    expect(modelRequests).toHaveLength(1);
    expect(modelRequests[0].method).toBe("GET");
    expect(modelRequests[0].body).toBeNull();
    expect(new URL(modelRequests[0].url).pathname).toBe("/models/model-v2.json");
    expect(new URL(modelRequests[0].url).search).toBe("");

    // Force a real parent state change without leaving S11: switch dashboard_window to prior.
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("dashboard_window", "prior");
      window.history.pushState({ guestJourney: true }, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.locator('[data-guest-dashboard-window="prior"]')).toBeVisible();
    // S11 stayed mounted and the flow instance did not reset.
    await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();
    await expect(page.locator("#model-v2-pending")).toBeVisible();
    expect(modelRequests).toHaveLength(1);

    release();
    await expect(result(page)).toBeVisible();
    await expect(result(page).locator("[data-model-v2-preview-value]")).toHaveText("0.055");
    expect(modelRequests).toHaveLength(1);

    audits.network.assertPhaseA();
    // The dashboard_window change in this test triggers a legitimate code-split
    // chunk load, so the strict phase-B audit is enforced in the complete-flow
    // tests that stay on S11 without navigation.
    await audits.storage.assertClean();
    await audits.urls.assertClean();

    firewall.assertClean();
    firewall.assertEntryIsolation();
    await assertGuestStorageFirewall(page);
  });

  test("discards stale completion when navigating away while the model response is held, then re-entering fresh", async ({ page }) => {
    const firewall = await installGuestNetworkFirewall(page);
    const audits = await installGuestS11Audits(page);
    const digest = await installGuestCryptoDigestObserver(page);
    const { requests: firstRequests, release } = await holdGuestModel(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime("2026-09-23T12:00:00+09:00");
    await page.goto("/?guest=1&screen=S11", { waitUntil: "domcontentloaded" });

    await audits.network.startSensitivePhase();
    await fillIntake(page);
    await submit(page).click();
    await expect(page.locator("#model-v2-pending")).toBeVisible();
    expect(firstRequests).toHaveLength(1);

    // Navigate away while pending: the flow unmounts.
    await page.locator(".primary-nav").getByRole("button", { name: "오늘의 기록", exact: true }).click();
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    await expect(result(page)).toHaveCount(0);

    // Re-enter S11: a fresh flow mounts with blank inputs.
    await page.locator(".primary-nav").getByRole("button", { name: "AI 분석", exact: true }).click();
    await expect(page).toHaveURL(/screen=S11/);
    await expect(page.locator('[data-model-v2-step="intake"]')).toBeVisible();
    await expect(result(page)).toHaveCount(0);
    await begin(page);
    await expect(page.locator("#model-age")).toHaveValue("");

    const digestsBeforeRelease = await digest.count();

    // Release the OLD held response from the unmounted flow.
    release();
    // Wait deterministically until the old model SHA digest observation completes.
    await digest.waitForSha256Digests(digestsBeforeRelease + 1);
    // Flush at least two browser task/render turns.
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));

    await expect(page.locator('[data-model-v2-user-result="processed"]')).toHaveCount(0);
    await expect(page.locator("[data-model-v2-preview]")).toHaveCount(0);
    await expect(page.locator("#model-age")).toHaveValue("");

    audits.network.assertPhaseA();
    // This test navigates away and back after sensitive input, so code-split
    // chunks legitimately load after phase B begins; the strict phase-B audit
    // is enforced in the complete-flow tests that stay on S11.
    await audits.storage.assertClean();
    await audits.urls.assertClean();

    firewall.assertClean();
    firewall.assertEntryIsolation();
    await assertGuestStorageFirewall(page);
  });
});

// Observe browser primitives independently of product code. No debug owner,
// extra renderer or synthetic world is installed in the application.
async function observeGuestWorldLifetime(page: Page) {
  // Install Playwright's Date override before observing RAF. Installing clock
  // afterwards would replace the primitive wrapper rather than measure it.
  await page.clock.setFixedTime(fixedNow);
  await page.addInitScript(() => {
    const rafs = new Set<number>();
    const listeners: { target: EventTarget; type: string; callback: unknown }[] = [];
    const contexts = new Map<HTMLCanvasElement, WebGLRenderingContext | WebGL2RenderingContext>();
    const drawn = new Set<WebGLRenderingContext | WebGL2RenderingContext>();
    // Capability-probe contexts are not renderers. Count only contexts that
    // actually draw, including any detached renderer left behind by navigation.
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const name of ["drawArrays", "drawElements"] as const) {
        const draw = prototype[name];
        prototype[name] = function (...args: number[]) {
          drawn.add(this);
          return Reflect.apply(draw, this, args);
        } as typeof draw;
      }
    }
    const worldCall = () => /PlaceableWorld-|\/src\/placeable\//.test(new Error().stack ?? "");
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      const owned = worldCall();
      const id = request.call(window, time => { rafs.delete(id); callback(time); });
      if (owned) rafs.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { rafs.delete(id); cancel.call(window, id); };
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, callback, options) {
      if (worldCall() && !listeners.some(entry => entry.target === this && entry.type === type && entry.callback === callback)) {
        listeners.push({ target: this, type, callback });
      }
      return add.call(this, type, callback, options);
    };
    EventTarget.prototype.removeEventListener = function (type, callback, options) {
      const index = listeners.findIndex(entry => entry.target === this && entry.type === type && entry.callback === callback);
      if (index >= 0) listeners.splice(index, 1);
      return remove.call(this, type, callback, options);
    };
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
      const context = Reflect.apply(get, this, args);
      if (/^webgl2?$/.test(String(args[0])) && context) contexts.set(this, context);
      return context;
    } as typeof get;
    Object.assign(window, { guestWorldLifetime: () => ({
      rafs: rafs.size,
      // A failed Three constructor's GPU listeners live only on its unreachable
      // canvas. The observation array itself retains those canvases; measure
      // input/environment listeners separately from that artificial retention.
      listeners: listeners.filter(entry => !entry.type.startsWith("webglcontext")).length,
      contexts: [...contexts].filter(([canvas, context]) => canvas.dataset.testid === "placeable-world-canvas" && !context.isContextLost()).length,
      activeContexts: [...contexts.values()].filter(context => drawn.has(context) && !context.isContextLost()).length,
    }) });
  });
  const sample = () => page.evaluate(() => (window as unknown as { guestWorldLifetime: () => {
    rafs: number; listeners: number; contexts: number; activeContexts: number;
  } }).guestWorldLifetime());
  return {
    async entered() {
      await expect.poll(async () => (await sample()).rafs).toBe(1);
      await expect.poll(async () => (await sample()).contexts).toBe(1);
      await expect.poll(async () => (await sample()).activeContexts).toBe(1);
      expect((await sample()).listeners).toBeGreaterThan(6);
    },
    async exited() {
      await expect.poll(sample).toMatchObject({ rafs: 0, listeners: 0, contexts: 0 });
      await expect(page.getByTestId("placeable-world-canvas")).toHaveCount(0);
    },
  };
}

async function enterGuestPlaza(page: Page) {
  await page.getByRole("button", { name: "3D 공간 둘러보기" }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", /idle|neutral/, { timeout: 20000 });
  await expect(page.getByRole("button", { name: /꾸미기|확정|저장|바람개비/ })).toHaveCount(0);
}

async function returnGuestToday(page: Page) {
  await page.getByRole("button", { name: "오늘 화면으로 돌아가기", exact: true }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
}

async function openPlazaTools(page: Page) {
  await page.locator(".plaza-help summary").click();
  await expect(page.getByRole("button", { name: "왼쪽 보기", exact: true })).toBeVisible();
}

async function assertGuestFact(page: Page) {
  await page.locator(".home-lead").getByRole("button", { name: "오늘 기록 보기", exact: true }).click();
  await expect(page.locator('[data-scene="S07"]')).toContainText("132/84 mmHg");
  await page.getByRole("button", { name: "오늘 화면으로 돌아가기", exact: true }).click();
}

test("#909 Guest plaza preserves memory through repeated entry, movement, camera, history and reload without product access", async ({ page }) => {
  const network = await installGuestNetworkFirewall(page);
  const storage = await observeGuestStorage(page);
  const lifetime = await observeGuestWorldLifetime(page);
  await page.addInitScript(() => localStorage.setItem("sk7-companion-species", "fox"));
  await openGuest(page, 1366, 900);
  await createTodayBloodPressure(page);
  await page.getByRole("button", { name: "오늘의 기록 보기", exact: true }).click();
  for (let visit = 0; visit < 2; visit++) {
    await enterGuestPlaza(page);
    await expect(page).toHaveURL(/\?guest=1&space=plaza$/);
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion", "fox");
    await lifetime.entered();
    await page.getByTestId("placeable-world-canvas").focus();
    await page.keyboard.down("w");
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
    await page.keyboard.up("w");
    await openPlazaTools(page);
    await page.getByRole("button", { name: "왼쪽 보기", exact: true }).click();
    await page.getByRole("button", { name: "가까이 보기", exact: true }).click();
    await page.getByRole("button", { name: "시점 다시 맞추기" }).click();
    await page.getByRole("button", { name: "광장의 불빛 켜기" }).click();
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-lighting", "twilight");
    await returnGuestToday(page);
    await lifetime.exited();
    // Explicit return's history entry is still Guest, and re-entry is a fresh world.
    await page.goBack();
    await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-lighting", "daylight");
    await lifetime.entered();
    await page.goForward();
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    await lifetime.exited();
    await assertGuestFact(page);
  }
  network.assertEntryIsolation(); network.assertClean();
  await storage.assertClean(); await assertGuestStorageFirewall(page);
  expect(await page.context().cookies()).toEqual([]);
  await enterGuestPlaza(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await returnGuestToday(page);
  await expect(page.locator(".home-lead")).toContainText("혈압 기록하기");
  await lifetime.exited(); network.assertClean(); await storage.assertClean();
});

test("#909 Guest namespace rejects My Space authority and respects direct semantic screens", async ({ page }) => {
  const network = await installGuestNetworkFirewall(page);
  const storage = await observeGuestStorage(page);
  for (const query of [
    "guest=1&experience=e2&view=3d&storage=account&return_space=3d-account",
    "guest=1&experience=e2&view=3d&storage=browser&return_space=3d-browser",
    "guest=1&space=plaza&screen=S11",
    "guest=1&space=plaza&space=plaza",
    "guest=1&space=https://evil.invalid",
  ]) {
    await page.goto(`/?${query}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-guest-journey="memory-only"]')).toBeVisible();
    await expect(page.locator('[data-guest-space="plaza"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /내 공간/ })).toHaveCount(0);
    await expect(page.getByTestId("placeable-experience")).toHaveCount(0);
    network.assertClean(); await storage.assertClean();
  }
  await page.goto("/?guest=1&space=plaza&experience=e2&storage=account&return_space=3d-account", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await returnGuestToday(page);
  await expect(page).toHaveURL(/\?guest=1$/);
  network.assertEntryIsolation(); network.assertClean(); await storage.assertClean();
});

test("#909 actual WebGL loss and startup failure recover only presentation and preserve Guest memory", async ({ page }) => {
  const network = await installGuestNetworkFirewall(page);
  const storage = await observeGuestStorage(page);
  const lifetime = await observeGuestWorldLifetime(page);
  await openGuest(page);
  await createTodayBloodPressure(page);
  await page.getByRole("button", { name: "오늘의 기록 보기", exact: true }).click();
  await enterGuestPlaza(page);
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="placeable-world-canvas"]')!;
    const extension = canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Actual context-loss extension unavailable");
    extension.loseContext();
  });
  await expect(page.getByRole("alert")).toContainText("3D 공간을 열지 못했어요");
  await lifetime.exited();
  await expect(page.getByRole("alert")).not.toContainText(/저장된|꾸미기|분실|잃/);
  await page.getByRole("button", { name: "3D 다시 열기" }).click();
  await expect(page.getByTestId("placeable-world-canvas")).toBeVisible();
  await lifetime.entered();
  await returnGuestToday(page); await assertGuestFact(page);
  // Real renderer construction now fails because the browser returns no context.
  await page.evaluate(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    Object.assign(window, { restoreGuestWebGL: () => { HTMLCanvasElement.prototype.getContext = get; } });
    HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
      return /^webgl2?$/.test(String(args[0])) ? null : Reflect.apply(get, this, args);
    } as typeof get;
  });
  await page.getByRole("button", { name: "3D 공간 둘러보기" }).click();
  await expect(page.getByRole("alert")).toContainText("3D 공간을 열지 못했어요");
  await lifetime.exited();
  await page.evaluate(() => (window as unknown as { restoreGuestWebGL: () => void }).restoreGuestWebGL());
  await returnGuestToday(page); await assertGuestFact(page);
  network.assertClean(); await storage.assertClean(); await assertGuestStorageFirewall(page);
});

test("#909 Guest root stale chunk uses one-shot preload reload and retains the cooldown", async ({ page }) => {
  const network = await installGuestNetworkFirewall(page);
  let rootRequests = 0;
  let documentRequests = 0;
  page.on("request", request => { if (request.isNavigationRequest()) documentRequests++; });
  await page.route("**/GuestJourneySandbox-*.js", async route => {
    rootRequests++;
    if (rootRequests === 1) {
      // The Guest boundary and its semantic escape do not exist at this point.
      await expect(page.locator('[data-guest-space="plaza"]')).toHaveCount(0);
      await expect(page.locator('[data-guest-journey="memory-only"]')).toHaveCount(0);
      await route.abort();
    } else await route.fallback();
  });
  await page.goto("/?guest=1", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  expect(rootRequests).toBe(2);
  expect(documentRequests).toBe(2);
  await expect(page).toHaveURL(/\?guest=1$/);
  const recoveredAt = await page.evaluate(() => sessionStorage.getItem("sk7:vite-preload-recovery-at"));
  expect(recoveredAt).not.toBeNull();
  expect(Number(recoveredAt)).toBeGreaterThan(0);
  // Another ordinary Guest preload error inside the cooldown propagates,
  // rather than writing a new timestamp or reloading a second time.
  const cooldown = await page.evaluate(() => {
    const event = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(event);
    return { prevented: event.defaultPrevented, recoveredAt: sessionStorage.getItem("sk7:vite-preload-recovery-at") };
  });
  expect(cooldown).toEqual({ prevented: false, recoveredAt });
  expect(documentRequests).toBe(2);
  network.assertEntryIsolation(); network.assertClean();
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual(["sk7:vite-preload-recovery-at"]);
});

test("#909 mounted Guest plaza world chunk failure stays local with no preload-recovery access", async ({ page }) => {
  const network = await installGuestNetworkFirewall(page);
  const storage = await observeGuestStorage(page);
  let documentRequests = 0;
  page.on("request", request => { if (request.isNavigationRequest()) documentRequests++; });
  await page.addInitScript(() => {
    const errors: { event: Event; plazaMounted: boolean }[] = [];
    Object.assign(window, { guestPreloadErrors: errors });
    window.addEventListener("vite:preloadError", event => {
      errors.push({ event, plazaMounted: !!document.querySelector('[data-guest-space="plaza"]') });
    });
  });
  await page.route("**/PlaceableWorld-*.js", route => route.abort());
  await openGuest(page);
  await createTodayBloodPressure(page);
  await page.getByRole("button", { name: "오늘의 기록 보기", exact: true }).click();
  await page.getByRole("button", { name: "3D 공간 둘러보기" }).click();
  await expect(page.getByRole("alert")).toContainText("3D 공간을 열지 못했어요");
  await expect(page.locator('[data-guest-space="plaza"]')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as {
    guestPreloadErrors: { event: Event; plazaMounted: boolean }[];
  }).guestPreloadErrors.map(({ event, plazaMounted }) => ({ prevented: event.defaultPrevented, plazaMounted })))).toEqual([
    { prevented: false, plazaMounted: true },
  ]);
  // Failed ES module loads can be cached by the browser. Keep the truthful
  // semantic escape; renderer/context failures have their separate real retry.
  await expect(page.getByRole("button", { name: "3D 다시 열기" })).toHaveCount(0);
  await returnGuestToday(page); await assertGuestFact(page);
  expect(documentRequests).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { guestStorageRecords: StorageRecord[] }).guestStorageRecords
    .filter(record => record.storage === "session"))).toEqual([]);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  network.assertClean(); await storage.assertClean();
});

for (const [width, height, enlarged] of [
  [1440, 900, false], [1366, 768, false], [768, 900, false], [768, 400, false], [390, 844, false],
  [320, 568, false], [320, 400, false], [320, 568, true],
] as const) test(`#909 Guest plaza adaptive ${width}x${height}${enlarged ? " 200% text" : ""}: semantic controls remain reachable`, async ({ page }, testInfo) => {
  const network = await installGuestNetworkFirewall(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGuest(page, width, height);
  if (enlarged) await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await enterGuestPlaza(page);
  const world = page.getByTestId("placeable-world");
  await expect(world).toHaveAttribute("data-reduced-motion", "true");
  await expect(world).toHaveAttribute(
    "data-scenery-profile",
    width <= 390 || height <= 400 ? "compact" : "full",
  );
  const exit = page.getByRole("button", { name: "오늘 화면으로 돌아가기", exact: true });
  await expect(exit).toBeInViewport();
  if (width <= 390) {
    expect((await page.getByRole("heading", { name: "3D 체험 공간" }).boundingBox())!.width).toBeGreaterThan(width * .75);
    expect((await exit.boundingBox())!.width).toBeGreaterThan(width * .8);
  }
  await page.screenshot({ path: testInfo.outputPath("guest-plaza.png"), fullPage: true });
  await openPlazaTools(page);
  if (width === 1366) {
    const canvas = page.getByTestId("placeable-world-canvas");
    const before = await canvas.screenshot();
    await page.getByRole("button", { name: "왼쪽 보기", exact: true }).click();
    await expect.poll(async () => Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
  }
  for (const name of ["동반자에게 인사하기", "광장의 불빛 켜기", "왼쪽 보기", "높게 보기", "가까이 보기", "시점 다시 맞추기"]) {
    const control = page.getByRole("button", { name, exact: true });
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await control.press("Enter");
  }
  await expect(page.getByTestId("companion-response")).toContainText("인사를 나눴어요");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: testInfo.outputPath("guest-plaza-tools.png"), fullPage: true });
  await exit.scrollIntoViewIfNeeded();
  await exit.focus();
  await expect(exit).toBeFocused();
  expect(await exit.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
  await exit.press("Enter");
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  network.assertClean();
});

test("#915 Guest plaza live resize keeps one world, Twilight and companion while scenery adapts", async ({ page }) => {
  const network = await installGuestNetworkFirewall(page);
  const lifetime = await observeGuestWorldLifetime(page);
  await openGuest(page, 1366, 900);
  await enterGuestPlaza(page);

  const world = page.getByTestId("placeable-world");
  const canvas = page.getByTestId("placeable-world-canvas");
  await expect(world).toHaveAttribute("data-scenery-profile", "full");
  await lifetime.entered();

  await canvas.evaluate((node) => { (node as HTMLCanvasElement & { __adaptiveIdentity?: string }).__adaptiveIdentity = "same-canvas"; });
  await openPlazaTools(page);
  await page.getByRole("button", { name: "광장의 불빛 켜기", exact: true }).click();
  await expect(world).toHaveAttribute("data-lighting", "twilight");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(world).toHaveAttribute("data-scenery-profile", "compact");
  expect(await canvas.evaluate((node) =>
    (node as HTMLCanvasElement & { __adaptiveIdentity?: string }).__adaptiveIdentity)).toBe("same-canvas");
  await expect(world).toHaveAttribute("data-lighting", "twilight");
  await lifetime.entered();

  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(world).toHaveAttribute("data-scenery-profile", "full");
  expect(await canvas.evaluate((node) =>
    (node as HTMLCanvasElement & { __adaptiveIdentity?: string }).__adaptiveIdentity)).toBe("same-canvas");
  await expect(world).toHaveAttribute("data-lighting", "twilight");
  await lifetime.entered();

  await returnGuestToday(page);
  await lifetime.exited();
  network.assertClean();
});

for (const width of [390, 320]) test(`#909 Guest plaza ${width}px actual two-pointer touch walk and camera`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    const network = await installGuestNetworkFirewall(page);
    const storage = await observeGuestStorage(page);
    await openGuest(page, width, 844);
    await enterGuestPlaza(page);
    const pad = (await page.getByRole("button", { name: "드래그하거나 방향키로 광장 걷기" }).boundingBox())!;
    const canvas = (await page.getByTestId("placeable-world-canvas").boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const thumb = { id: 1, x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 };
    const camera = { id: 2, x: canvas.x + canvas.width * .65, y: canvas.y + canvas.height * .45 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb] });
    thumb.y -= 22;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb] });
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "move");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb, camera] });
    camera.x -= 45;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb, camera] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByTestId("placeable-world")).toHaveAttribute("data-companion-pose", "idle");
    await page.getByRole("button", { name: "오늘 화면으로 돌아가기", exact: true }).tap();
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    network.assertClean(); await storage.assertClean(); await assertGuestStorageFirewall(page);
  } finally { await context.close(); }
});
