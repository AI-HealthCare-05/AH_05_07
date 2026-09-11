import { expect, test, type Page } from "@playwright/test";

import { e2eSessionEventName } from "../src/lib/e2eHarness";

const emptyWindow = {
  start_on: "2026-08-28",
  end_on: "2026-09-03",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

function session(userId: string, accessToken: string) {
  return {
    access_token: accessToken,
    refresh_token: `${accessToken}-refresh`,
    expires_in: 3600,
    expires_at: 1_800_000_000,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-09-01T00:00:00.000Z",
    },
  };
}

const accountA = session("e2e-synthetic-user", "e2e-synthetic-access-token");
const accountARefreshed = session("e2e-synthetic-user", "e2e-token-a-refreshed");
const accountB = session("e2e-account-b", "e2e-token-b");

function windowWithMeasurement(id: string, systolic: number, diastolic: number) {
  return {
    ...emptyWindow,
    blood_pressure_observations: [{ id, observed_on: "2026-09-08", period: "morning", systolic, diastolic }],
  };
}

async function dispatchSession(page: Page, nextSession: ReturnType<typeof session> | null) {
  await page.evaluate(([eventName, detail]) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }, [e2eSessionEventName, nextSession] as const);
}

async function routeWindow(page: Page, resolveWindow: (token: string) => unknown) {
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === "/api/v1/observations/window") {
      const token = request.headers().authorization?.replace("Bearer ", "") ?? "";
      await route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(resolveWindow(token)) });
      return;
    }
    await route.abort();
  });
}

test("normal synthetic sign-in keeps the existing empty-state routing", async ({ page }) => {
  await routeWindow(page, () => emptyWindow);
  await page.goto("/");
  await dispatchSession(page, accountA);

  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await expect(page.locator('[data-scene="S02"]')).toHaveCount(0);
});

test("A to logout to B clears private records and keeps only B window", async ({ page }) => {
  await routeWindow(page, (token) => token === accountB.access_token ? windowWithMeasurement("b-record", 130, 85) : windowWithMeasurement("a-record", 120, 80));
  await page.goto("/?e2e=signed-in&screen=S10");
  await expect(page.getByText("120/80 mmHg")).toBeVisible();

  await dispatchSession(page, null);
  await dispatchSession(page, accountB);

  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await page.getByRole("button", { name: "7일 돌아보기" }).click();
  await expect(page.getByText("130/85 mmHg")).toBeVisible();
  await expect(page.getByText("120/80 mmHg")).toHaveCount(0);
});

test("delayed A window response cannot update B state", async ({ page }) => {
  let releaseA!: () => void;
  const pendingA = new Promise<void>((resolve) => { releaseA = resolve; });
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname !== "/api/v1/observations/window") return route.abort();
    const token = request.headers().authorization?.replace("Bearer ", "") ?? "";
    if (token === accountA.access_token) await pendingA;
    await route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(token === accountB.access_token ? windowWithMeasurement("b-record", 130, 85) : windowWithMeasurement("a-record", 120, 80)) });
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  await dispatchSession(page, null);
  await dispatchSession(page, accountB);
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await page.getByRole("button", { name: "7일 돌아보기" }).click();
  await expect(page.getByText("130/85 mmHg")).toBeVisible();
  releaseA();
  await page.waitForTimeout(100);
  await expect(page.getByText("130/85 mmHg")).toBeVisible();
  await expect(page.getByText("120/80 mmHg")).toHaveCount(0);
});

test("delayed A mutation has no stale notice, navigation, refresh, or retry in B", async ({ page }) => {
  let releaseMutation!: () => void;
  const pendingMutation = new Promise<void>((resolve) => { releaseMutation = resolve; });
  let mutationRequests = 0;
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/api/v1/observations/window") return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(windowWithMeasurement("b-record", 130, 85)) });
    if (url.pathname === "/api/v1/observations/blood-pressure" && request.method() === "POST") {
      mutationRequests += 1;
      await pendingMutation;
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify({ id: "a-created", ...JSON.parse(request.postData() ?? "{}") }) });
    }
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S04");
  await page.getByLabel(/수축기/).fill("120");
  await page.getByLabel(/이완기/).fill("80");
  await page.getByRole("button", { name: "혈압 기록 저장" }).click();
  await expect(page.getByRole("button", { name: "저장 중" })).toBeDisabled();
  await dispatchSession(page, null);
  await dispatchSession(page, accountB);
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  releaseMutation();
  await page.waitForTimeout(100);
  expect(mutationRequests).toBe(1);
  await expect(page.getByText("혈압 기록을 수정했습니다.")).toHaveCount(0);
  await expect(page.getByText("혈압 기록을 저장했습니다.")).toHaveCount(0);
});

test("same-user token refresh preserves the current private detail", async ({ page }) => {
  await routeWindow(page, () => windowWithMeasurement("a-record", 120, 80));
  await page.goto("/?e2e=signed-in&screen=S09&record=blood-pressure:a-record");
  await expect(page.locator('[data-scene="S09"]')).toContainText("120/80 mmHg");
  await dispatchSession(page, accountARefreshed);
  await expect(page.locator('[data-scene="S09"]')).toContainText("120/80 mmHg");
  await expect(page.locator('[data-scene="S09"]')).toBeVisible();
});


test("same-user token refresh during initial load keeps the pending successful window", async ({ page }) => {
  let releaseInitial!: () => void;
  let markInitialStarted!: () => void;

  const initialPending = new Promise<void>((resolve) => {
    releaseInitial = resolve;
  });
  const initialStarted = new Promise<void>((resolve) => {
    markInitialStarted = resolve;
  });

  let windowRequests = 0;
  const requestTokens: string[] = [];

  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname !== "/api/v1/observations/window") {
      await route.abort();
      return;
    }

    windowRequests += 1;
    const token =
      request.headers().authorization?.replace("Bearer ", "") ?? "";
    requestTokens.push(token);

    if (windowRequests === 1) {
      markInitialStarted();
      await initialPending;
      await route.fulfill({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify(windowWithMeasurement("initial-record", 120, 80)),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      headers,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code: "request_failed" } }),
    });
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  await initialStarted;

  await dispatchSession(page, accountARefreshed);
  await page.waitForTimeout(100);

  releaseInitial();

  await expect(page.locator('[data-scene="S10"]')).toContainText(
    "120/80 mmHg",
  );
  expect(windowRequests).toBe(1);
  expect(requestTokens).toEqual([accountA.access_token]);
});


test("same-user token refresh retries an initial stale-token window once with the newer token", async ({ page }) => {
  let releaseInitial!: () => void;
  let markInitialStarted!: () => void;

  const initialPending = new Promise<void>((resolve) => {
    releaseInitial = resolve;
  });
  const initialStarted = new Promise<void>((resolve) => {
    markInitialStarted = resolve;
  });

  const requestTokens: string[] = [];

  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname !== "/api/v1/observations/window") {
      await route.abort();
      return;
    }

    const token =
      request.headers().authorization?.replace("Bearer ", "") ?? "";
    requestTokens.push(token);

    if (requestTokens.length === 1) {
      markInitialStarted();
      await initialPending;
      await route.fulfill({
        status: 401,
        headers,
        contentType: "application/json",
        body: JSON.stringify({
          detail: { code: "supabase_session_invalid" },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify(
        windowWithMeasurement("refreshed-record", 121, 81),
      ),
    });
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  await initialStarted;

  await dispatchSession(page, accountARefreshed);
  releaseInitial();

  await expect(page.locator('[data-scene="S10"]')).toContainText(
    "121/81 mmHg",
  );

  expect(requestTokens).toEqual([
    accountA.access_token,
    accountARefreshed.access_token,
  ]);
});

test("export timeout shows bounded warning and re-enables the button", async ({ page }) => {
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/api/v1/observations/window") return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(windowWithMeasurement("b-record", 130, 85)) });
    if (url.pathname === "/api/v1/observations/export") {
      await new Promise((resolve) => setTimeout(resolve, 9_000));
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(emptyWindow) });
    }
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  const exportButton = page.getByRole("button", { name: "선택한 7일 내보내기" });
  await exportButton.click();
  await expect(page.getByRole("status")).toContainText("파일을 내려받지 못했습니다.", { timeout: 10_000 });
  await expect(exportButton).toBeEnabled();
});

test("export times out when headers arrive but the blob body stalls", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (
        new URL(url, window.location.href).pathname ===
        "/api/v1/observations/export"
      ) {
        const requestCount =
          Number(sessionStorage.getItem("e2e-body-stall-export-requests") ?? "0") + 1;
        sessionStorage.setItem(
          "e2e-body-stall-export-requests",
          String(requestCount),
        );

        const signal = init?.signal;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const abort = () =>
              controller.error(
                signal?.reason ?? new DOMException("Aborted", "AbortError"),
              );

            if (signal?.aborted) {
              abort();
            } else {
              signal?.addEventListener("abort", abort, { once: true });
            }
          },
        });

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="observations.json"',
          },
        });
      }

      return nativeFetch(input, init);
    };
  });

  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/api/v1/observations/window") {
      await route.fulfill({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify(windowWithMeasurement("b-record", 130, 85)),
      });
      return;
    }

    await route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S10");

  const exportButton = page.getByRole("button", {
    name: "선택한 7일 내보내기",
  });
  await exportButton.click();

  await expect(page.getByRole("status")).toContainText(
    "파일을 내려받지 못했습니다.",
    { timeout: 10_000 },
  );
  await expect(exportButton).toBeEnabled();

  const requestCount = await page.evaluate(() =>
    Number(sessionStorage.getItem("e2e-body-stall-export-requests") ?? "0"),
  );
  expect(requestCount).toBe(1);
});

test("stale export cannot download or show success after account change", async ({ page }) => {
  let releaseExport!: () => void;
  const pendingExport = new Promise<void>((resolve) => { releaseExport = resolve; });
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/api/v1/observations/window") return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(windowWithMeasurement("b-record", 130, 85)) });
    if (url.pathname === "/api/v1/observations/export") {
      await pendingExport;
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(emptyWindow) });
    }
    return route.abort();
  });
  let downloads = 0;
  page.on("download", () => { downloads += 1; });

  await page.goto("/?e2e=signed-in&screen=S10");
  await page.getByRole("button", { name: "선택한 7일 내보내기" }).click();
  await expect(page.getByRole("button", { name: "내보내는 중" })).toBeDisabled();
  await dispatchSession(page, null);
  await dispatchSession(page, accountB);
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  releaseExport();
  await page.waitForTimeout(100);
  expect(downloads).toBe(0);
  await expect(page.getByText("내보내기 파일을 준비했어요.")).toHaveCount(0);
});

test("Back cannot restore A private detail after switching to B", async ({ page }) => {
  await routeWindow(page, () => windowWithMeasurement("a-record", 120, 80));
  await page.goto("/?e2e=signed-in&screen=S10");
  await page.getByRole("button", { name: "상세 보기" }).first().click();
  await expect(page.locator('[data-scene="S09"]')).toBeVisible();
  await dispatchSession(page, null);
  await dispatchSession(page, accountB);
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page.locator('[data-scene="S09"]')).toHaveCount(0);
});

test("S01 and S14 explain retention, account, and local export boundaries", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-scene="S01"]')).toContainText("공용 기기에서는 사용을 마친 뒤 로그아웃해 주세요.");
  await routeWindow(page, () => emptyWindow);
  await page.goto("/?e2e=signed-in&screen=S14");
  await expect(page.locator('[data-scene="S14"]')).toContainText("혈압 관찰과 챌린지 제품 기록은 30일 동안 보관돼요");
  await expect(page.locator('[data-scene="S14"]')).toContainText("이메일 링크로 로그인한 계정의 기록을 확인해요");
  await expect(page.locator('[data-scene="S14"]')).toContainText("계정과 저장된 혈압 관찰·챌린지 제품 기록이 삭제되며, 되돌릴 수 없어요");
  await expect(page.locator('[data-scene="S14"]')).toContainText("내보낸 JSON은 기기에 남고, 사용자가 직접 관리해요");
});

test("S01 and S14 remain usable at 320px and 390px", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "이메일", exact: true })).toBeInViewport();
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await routeWindow(page, () => emptyWindow);
    await page.goto("/?e2e=signed-in&screen=S14");
    await expect(page.locator('[data-scene="S14"]')).toBeVisible();
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});
