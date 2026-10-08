import { expect, test, type Page } from "@playwright/test";

import { e2eSessionEventName } from "../src/lib/e2eHarness";
import { DATA_SCOPE_LABELS } from "../src/ui/dataScope";

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

const emptyPlaceableSnapshot = {
  revision: 0,
  schemaVersion: "placeable.v1",
  layoutId: "e1-plaza.v1",
  selection: null,
  latestOperationId: null,
  latestFingerprint: null,
};

async function routeRejectedAppWindow(page: Page) {
  const apiHeaders = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
  const authHeaders = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };

  await page.route("https://e2e.invalid/auth/v1/logout?scope=local", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: authHeaders });
    }
    return route.fulfill({ status: 204, headers: authHeaders });
  });

  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: apiHeaders });
    }
    if (url.pathname !== "/api/v1/observations/window") return route.abort();

    return route.fulfill({
      status: 401,
      headers: apiHeaders,
      contentType: "application/json",
      body: JSON.stringify({
        detail: { code: "supabase_session_invalid" },
      }),
    });
  });
}

async function routeAccountMySpace(
  page: Page,
  rejection: "none" | "session-invalid" | "owner-deleted" = "none",
) {
  await page.addInitScript((value) => {
    localStorage.setItem("sb-e2e-auth-token", JSON.stringify(value));
  }, accountA);

  const headers = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
  };

  await page.route("https://e2e.invalid/auth/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers });
    }
    if (url.pathname === "/auth/v1/user") {
      return route.fulfill({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify(accountA.user),
      });
    }
    if (url.pathname === "/auth/v1/logout") {
      return route.fulfill({ status: 204, headers });
    }
    return route.abort();
  });

  let puts = 0;
  await page.route("http://e2e.invalid/api/v1/cosmetics/placeable", async (route) => {
    const request = route.request();

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers });
    }
    if (request.method() === "GET") {
      return route.fulfill({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify(emptyPlaceableSnapshot),
      });
    }

    puts += 1;

    if (rejection === "session-invalid") {
      return route.fulfill({
        status: 401,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ detail: { code: "session_invalid" } }),
      });
    }
    if (rejection === "owner-deleted") {
      return route.fulfill({
        status: 410,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ detail: { code: "owner_deleted" } }),
      });
    }

    return route.fulfill({
      status: 500,
      headers,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code: "unexpected_test_write" } }),
    });
  });

  return {
    get puts() {
      return puts;
    },
  };
}

test("normal synthetic sign-in keeps the existing empty-state routing", async ({ page }) => {
  await routeWindow(page, () => emptyWindow);
  await page.goto("/");
  // The normal App is now an intentional lazy entry. Wait for its S01 surface
  // before exercising the synthetic session event owned by that App.
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
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
  await expect(page.locator(".app-shell")).toHaveAttribute("data-screen", "S10");
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

test("#991 rejected token A cleanup cannot erase newer same-user token B", async ({ page }) => {
  let releaseLogout!: () => void;
  let markLogoutStarted!: () => void;

  const pendingLogout = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  const logoutStarted = new Promise<void>((resolve) => {
    markLogoutStarted = resolve;
  });

  let logoutCalls = 0;

  await page.addInitScript((value) => {
    localStorage.setItem("sb-e2e-auth-token", JSON.stringify(value));
  }, accountA);

  const authHeaders = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };

  await page.route(
    "https://e2e.invalid/auth/v1/logout?scope=local",
    async (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: authHeaders });
      }

      logoutCalls += 1;
      expect(route.request().headers().authorization)
        .toBe(`Bearer ${accountA.access_token}`);

      markLogoutStarted();
      await pendingLogout;

      await route.fulfill({
        status: 204,
        headers: authHeaders,
      });
    },
  );

  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    };

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers });
    }

    if (url.pathname !== "/api/v1/observations/window") {
      return route.abort();
    }

    const token =
      request.headers().authorization?.replace("Bearer ", "") ?? "";

    if (token === accountA.access_token) {
      return route.fulfill({
        status: 401,
        headers,
        contentType: "application/json",
        body: JSON.stringify({
          detail: { code: "supabase_session_invalid" },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify(
        windowWithMeasurement("refreshed-record", 121, 81),
      ),
    });
  });

  await page.goto("/?e2e=signed-in&screen=S10");

  await logoutStarted;

  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem("sb-e2e-auth-token")),
  ).toBeNull();

  const refreshedWindow = page.waitForRequest((request) => (
    new URL(request.url()).pathname === "/api/v1/observations/window"
    && request.headers().authorization
      === `Bearer ${accountARefreshed.access_token}`
  ));

  await page.evaluate(([eventName, session]) => {
    localStorage.setItem(
      "sb-e2e-auth-token",
      JSON.stringify(session),
    );

    const channel = new BroadcastChannel("sb-e2e-auth-token");
    channel.postMessage({
      event: "TOKEN_REFRESHED",
      session,
    });
    channel.close();

    window.dispatchEvent(
      new CustomEvent(eventName, { detail: session }),
    );
  }, [e2eSessionEventName, accountARefreshed] as const);

  await refreshedWindow;

  await expect(
    page.locator('[data-scene="S02"], [data-scene="S12"]'),
  ).toBeVisible();

  releaseLogout();

  await expect.poll(() =>
    page.evaluate(() => {
      const raw = localStorage.getItem("sb-e2e-auth-token");
      return raw ? JSON.parse(raw).access_token : null;
    }),
  ).toBe(accountARefreshed.access_token);

  expect(logoutCalls).toBe(1);
});


test("#993 App rejection withdraws another App tab still bound to token A", async ({ page, context }) => {
  const peer = await context.newPage();
  await routeWindow(peer, () => windowWithMeasurement("peer-a", 120, 80));
  await peer.goto("/?e2e=signed-in&screen=S10");
  await expect(peer.locator('[data-scene="S10"]')).toBeVisible();

  await routeRejectedAppWindow(page);
  await page.goto("/?e2e=signed-in&screen=S10");

  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  await expect(peer.locator('[data-scene="S01"]')).toBeVisible();

  const peerRecovery = peer.locator('[data-recovery-kind="session-expired"]');
  await expect(peerRecovery).toContainText("로그인 시간이 만료되었습니다.");
  await expect(peerRecovery).toContainText("계정이나 기록이 삭제됐다는 뜻은 아니에요.");

  await peer.close();
});

test("#993 App rejection withdraws account My Space still bound to token A", async ({ page, context }) => {
  const peer = await context.newPage();
  const mySpace = await routeAccountMySpace(peer);
  await peer.goto("/?experience=e2&view=classic&storage=account");
  await expect(peer.getByTestId("placeable-experience")).toHaveAttribute("data-mode", "account");

  await routeRejectedAppWindow(page);
  await page.goto("/?e2e=signed-in&screen=S10");

  await expect(peer.getByTestId("placeable-experience")).toHaveCount(0);
  await expect(
    peer.locator("main.placeable-entry-recovery").getByRole("status"),
  ).toContainText("계정 공간을 이용하려면 다시 로그인해 주세요.");
  expect(mySpace.puts).toBe(0);

  await peer.close();
});

test("#993 My Space rejection withdraws App still bound to token A", async ({ page, context }) => {
  const app = await context.newPage();
  await routeWindow(app, () => windowWithMeasurement("app-a", 120, 80));
  await app.goto("/?e2e=signed-in&screen=S10");
  await expect(app.locator('[data-scene="S10"]')).toBeVisible();

  const mySpace = await routeAccountMySpace(page, "session-invalid");
  await page.goto("/?experience=e2&view=classic&storage=account");
  await expect(page.getByTestId("placeable-experience")).toHaveAttribute("data-mode", "account");

  await page.getByRole("button", { name: "환영 바람개비 고르기" }).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();

  await expect(app.locator('[data-scene="S01"]')).toBeVisible();
  await expect(app.locator('[data-recovery-kind="session-expired"]'))
    .toContainText("로그인 시간이 만료되었습니다.");
  expect(mySpace.puts).toBe(1);

  await app.close();
});

test("#993 owner-deleted from My Space remains terminal in App", async ({ page, context }) => {
  const app = await context.newPage();
  await routeWindow(app, () => windowWithMeasurement("app-a", 120, 80));
  await app.goto("/?e2e=signed-in&screen=S10");
  await expect(app.locator('[data-scene="S10"]')).toBeVisible();

  const mySpace = await routeAccountMySpace(page, "owner-deleted");
  await page.goto("/?experience=e2&view=classic&storage=account");

  await page.getByRole("button", { name: "환영 바람개비 고르기" }).click();
  await page.getByRole("button", { name: "배치 확정하기", exact: true }).click();

  await expect(app.locator('[data-scene="S01"]')).toBeVisible();
  await expect(app.getByRole("heading", { name: "계정을 삭제했어요", exact: true })).toBeVisible();
  await expect(app.locator('[data-recovery-kind="session-expired"]')).toHaveCount(0);
  expect(mySpace.puts).toBe(1);

  await app.close();
});

test("#993 App receiver ignores malformed and stale token-A rejection after refresh to B", async ({ page }) => {
  await routeWindow(page, () => windowWithMeasurement("current", 121, 81));
  await page.goto("/?e2e=signed-in&screen=S10");
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();

  await dispatchSession(page, accountARefreshed);
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();

  await page.evaluate(() => {
    const channel = new BroadcastChannel("sk7:authoritative-session-rejection:v1");
    channel.postMessage({
      version: 1,
      tokenFingerprint: "not-a-digest",
      reason: "session-invalid",
    });
    channel.postMessage({
      version: 1,
      tokenFingerprint: "0".repeat(64),
      reason: "session-invalid",
    });
    channel.close();
  });

  await page.evaluate(async (token) => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );
    const tokenFingerprint = Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");

    const channel = new BroadcastChannel(
      "sk7:authoritative-session-rejection:v1",
    );
    channel.postMessage({
      version: 1,
      tokenFingerprint,
      reason: "session-invalid",
    });
    channel.close();
  }, accountA.access_token);

  await page.waitForTimeout(100);
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();
  await expect(page.locator('[data-scene="S01"]')).toHaveCount(0);
});

test("#993 App receiver rechecks the current token after asynchronous fingerprinting", async ({ page }) => {
  await page.addInitScript(() => {
    const subtle = crypto.subtle;
    const nativeDigest = subtle.digest.bind(subtle);

    let hold = false;
    let started = false;
    let release: (() => void) | null = null;

    Object.defineProperty(subtle, "digest", {
      configurable: true,
      value: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        if (hold) {
          started = true;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return nativeDigest(algorithm, data);
      },
    });

    const target = window as unknown as {
      e2eRejectionDigestGate: {
        enable: () => void;
        started: () => boolean;
        release: () => void;
      };
    };

    target.e2eRejectionDigestGate = {
      enable() {
        hold = true;
        started = false;
        release = null;
      },
      started() {
        return started;
      },
      release() {
        const pending = release;
        release = null;
        hold = false;
        pending?.();
      },
    };
  });

  await routeWindow(page, () => windowWithMeasurement("current", 121, 81));
  await page.goto("/?e2e=signed-in&screen=S10");
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();

  const tokenFingerprint = await page.evaluate(async (token) => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );
    return Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
  }, accountA.access_token);

  await page.evaluate((fingerprint) => {
    const target = window as unknown as {
      e2eRejectionDigestGate: {
        enable: () => void;
      };
    };

    target.e2eRejectionDigestGate.enable();

    const channel = new BroadcastChannel(
      "sk7:authoritative-session-rejection:v1",
    );
    channel.postMessage({
      version: 1,
      tokenFingerprint: fingerprint,
      reason: "session-invalid",
    });
    channel.close();
  }, tokenFingerprint);

  await expect.poll(() => page.evaluate(() => {
    const target = window as unknown as {
      e2eRejectionDigestGate: {
        started: () => boolean;
      };
    };
    return target.e2eRejectionDigestGate.started();
  })).toBe(true);

  await dispatchSession(page, accountARefreshed);
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();

  await page.evaluate(() => {
    const target = window as unknown as {
      e2eRejectionDigestGate: {
        release: () => void;
      };
    };
    target.e2eRejectionDigestGate.release();
  });

  await page.waitForTimeout(100);

  await expect(page.locator('[data-scene="S10"]')).toBeVisible();
  await expect(page.locator('[data-scene="S01"]')).toHaveCount(0);
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
  const exportButton = page.getByRole("button", { name: "현재 7일 내보내기" });
  await exportButton.click();
  const recovery = page.locator('[data-recovery-kind="export-failure"]');
  await expect(recovery).toContainText("계정 기록은 변경되지 않았어요.", { timeout: 10_000 });
  await expect(recovery).toContainText("파일 생성 또는 다운로드만 완료되지 않았어요.");
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
    name: "현재 7일 내보내기",
  });
  await exportButton.click();

  const recovery = page.locator('[data-recovery-kind="export-failure"]');
  await expect(recovery).toContainText("계정 기록은 변경되지 않았어요.", { timeout: 10_000 });
  await expect(recovery).toContainText("파일 생성 또는 다운로드만 완료되지 않았어요.");
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
  await page.getByRole("button", { name: "현재 7일 내보내기" }).click();
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
  await expect(page.locator('[data-scene="S01"]')).toContainText("측정한 혈압을 기록하고");
  await expect(page.locator('[data-scene="S01"]')).toContainText("같은 브라우저에서는 로그인 상태가 유지되면 다시 로그인하지 않고 기록을 이어갈 수 있어요.");
  await expect(page.locator('[data-scene="S01"]')).toContainText("공용 기기에서는 사용을 마친 뒤 로그아웃해 주세요.");
  await routeWindow(page, () => emptyWindow);
  await page.goto("/?e2e=signed-in&screen=S14");
  const settings = page.locator('[data-scene="S14"]');
  await expect(page.locator(".app-header").getByRole("button", { name: "로그아웃", exact: true })).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "이 기기에서 로그아웃", exact: true })).toBeVisible();
  await expect(settings).toContainText("로그아웃해도 계정과 서버 기록은 삭제되지 않아요.");
  await expect(settings).toContainText("30일");
  await expect(settings).toContainText("이메일");
  await expect(settings).toContainText("혈압 관찰");
  await expect(settings).toContainText("챌린지 기록");
  await expect(settings).toContainText("계정 삭제");
  await expect(settings).toContainText("JSON");
  await expect(settings).toContainText("PDF");
  await expect(settings).toContainText("인쇄물");
  await expect(settings.getByRole("heading", { name: "이 브라우저의 개인화", exact: true })).toBeVisible();
  await expect(settings.locator('[data-boundary="account"]')).toContainText("계정 My Space");
  await expect(settings.locator('[data-boundary="browser"]')).toContainText("브라우저 My Space");
  await expect(settings.locator('[data-boundary="device"]')).toContainText("내 기기");
  await expect(settings.locator('[data-boundary="transient"]')).toContainText("Model V2 입력 · 결과");
  await expect(settings).toContainText("전체 계정 백업이 아니며");
  await expect(settings.locator(".journey-settings-group-heading h2")).toHaveText([
    "계정에 저장되는 것", "내 기기의 사본", "이 브라우저의 개인화", "이 기기에서 로그아웃", "계정 삭제",
  ]);
  await expect(settings.locator(".journey-settings-deletion-facts")).toContainText("계정 소유 제품 기록");
  await expect(settings.locator(".journey-settings-deletion-facts")).toContainText("자동 삭제되지 않음");
});

test("S14 exports the exact recent 30-calendar-date range without mutating records", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-28T03:00:00Z"));
  const requests: Array<{ method: string; url: string }> = [];
  await page.route("http://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Expose-Headers": "Content-Disposition",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    requests.push({ method: request.method(), url: request.url() });
    if (url.pathname === "/api/v1/observations/window") return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(emptyWindow) });
    if (url.pathname === "/api/v1/observations/export") return route.fulfill({ status: 200, headers: { ...headers, "Content-Disposition": 'attachment; filename="recent-30-days.json"' }, contentType: "application/json", body: JSON.stringify(emptyWindow) });
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S14");
  const settings = page.locator('[data-scene="S14"]');
  await expect(settings).toContainText("2026-08-30");
  await expect(settings).toContainText("2026-09-28");
  const download = page.waitForEvent("download");
  await settings.getByRole("button", { name: "최근 30일 JSON 내려받기", exact: true }).click();
  await download;

  const exportRequest = requests.find(({ url }) => new URL(url).pathname === "/api/v1/observations/export");
  expect(exportRequest?.method).toBe("GET");
  expect(new URL(exportRequest!.url).searchParams.get("start_on")).toBe("2026-08-30");
  expect(new URL(exportRequest!.url).searchParams.get("end_on")).toBe("2026-09-28");
  expect(requests.every(({ method }) => method === "GET")).toBe(true);
  await expect(page.getByText("최근 30일 날짜 범위 JSON을 준비했어요.")).toBeVisible();
});

test("browser personalization reset clears only the four allowlisted local keys", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sk7-ui-theme", "warm");
    localStorage.setItem("sk7-starting-home", "my-space");
    localStorage.setItem("sk7-companion-species", "rabbit");
    localStorage.setItem("sk7:placeable:v1", "browser-space");
    localStorage.setItem("unrelated-preference-sentinel", "keep");
  });
  await routeWindow(page, () => emptyWindow);
  await page.goto("/?e2e=signed-in&screen=S14");

  await page.getByRole("button", { name: "초기화 범위 확인", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("로그인·서버 기록·계정 My Space");
  await expect(dialog).toContainText("내 기기 파일");
  await dialog.getByRole("button", { name: "이 브라우저만 초기화", exact: true }).click();

  expect(await page.evaluate(() => ({
    theme: localStorage.getItem("sk7-ui-theme"),
    home: localStorage.getItem("sk7-starting-home"),
    companion: localStorage.getItem("sk7-companion-species"),
    space: localStorage.getItem("sk7:placeable:v1"),
    unrelated: localStorage.getItem("unrelated-preference-sentinel"),
    renderedTheme: document.documentElement.dataset.sk7Theme,
  }))).toEqual({ theme: null, home: null, companion: null, space: null, unrelated: "keep", renderedTheme: "cloud" });
  await expect(page.locator('[data-scene="S14"]')).toBeVisible();
  await expect(page.getByRole("radio", { name: /내 공간 · My Space/ })).toBeChecked();
  const companion = page.getByLabel("캐릭터 선택");
  if (await companion.count()) await expect(companion).toHaveValue("bear");
  await expect(page.getByText("계정과 서버 기록은 변경되지 않았어요.")).toBeVisible();
});

test("browser personalization reset reports storage failure without claiming completion", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sk7-ui-theme", "warm");
    localStorage.setItem("sk7-starting-home", "my-space");
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === "sk7-starting-home") throw new Error("blocked");
      return removeItem.call(this, key);
    };
  });
  await routeWindow(page, () => emptyWindow);
  await page.goto("/?e2e=signed-in&screen=S14");
  await page.getByRole("button", { name: "초기화 범위 확인", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "이 브라우저만 초기화", exact: true }).click();
  await expect(dialog).toContainText("초기화를 완료하지 못했어요");
  await expect(page.getByText("이 브라우저의 개인화를 초기화했어요.")).toHaveCount(0);
});

test("S01 and S14 remain usable at 320px and 390px", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/");
    const email = page.getByRole("textbox", { name: "이메일", exact: true });
    await email.scrollIntoViewIfNeeded();
    await expect(email).toBeVisible();
    await expect(email).toBeInViewport();
    await email.fill("journey@example.com");
    await expect(email).toHaveValue("journey@example.com");
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await routeWindow(page, () => emptyWindow);
    await page.goto("/?e2e=signed-in&screen=S14");
    await expect(page.locator('[data-scene="S14"]')).toBeVisible();
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});

test("#938 lifecycle decisions use one exact four-scope vocabulary", async ({ page }) => {
  expect(DATA_SCOPE_LABELS).toEqual({
    account: "계정",
    browser: "이 브라우저",
    visit: "이번 방문",
    deviceFile: "내 기기 파일",
  });

  await routeWindow(page, () => emptyWindow);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?e2e=signed-in&screen=S14");

  const scene = page.locator('[data-scene="S14"]');

  await expect(scene.locator('[data-boundary="account"] [data-scope-label="account"]'))
    .toHaveText("계정");
  await expect(scene.locator('[data-boundary="browser"] [data-scope-label="browser"]'))
    .toHaveText("이 브라우저");
  await expect(scene.locator('[data-boundary="transient"] [data-scope-label="visit"]'))
    .toHaveText("이번 방문");
  await expect(scene.locator('[data-boundary="device"] [data-scope-label="device-file"]'))
    .toHaveText("내 기기 파일");

  await page.getByRole("button", { name: "초기화 범위 확인" }).click();

  const reset = page.getByRole("dialog");

  await expect(reset.locator('[data-scope-label="browser"]').first())
    .toHaveText("이 브라우저");
  await expect(reset).toContainText("내 기기 파일");
  await expect(reset).not.toContainText("이 기기에서만");

  await reset.getByRole("button", { name: "취소" }).click();

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.emulateMedia({ forcedColors: "active" });

  await scene.locator('[data-boundary="device"]').scrollIntoViewIfNeeded();

  expect(await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )).toBeLessThanOrEqual(1);

  const resetButton = page.getByRole("button", { name: "초기화 범위 확인" });
  await resetButton.scrollIntoViewIfNeeded();
  await resetButton.focus();
  await expect(resetButton).toBeFocused();
});
