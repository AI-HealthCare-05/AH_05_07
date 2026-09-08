import { expect, test, type Page } from "@playwright/test";

const emptyWindow = {
  start_on: "2026-08-28",
  end_on: "2026-09-03",
  blood_pressure_observations: [],
  challenge_events: [],
  active_challenge: null,
  challenge_checkins: [],
};

const accountA = {
  access_token: "e2e-synthetic-access-token",
  refresh_token: "e2e-synthetic-refresh-token",
  expires_in: 3600,
  expires_at: 1_800_000_000,
  token_type: "bearer",
  user: { id: "e2e-synthetic-user", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-09-01T00:00:00.000Z" },
};

const accountB = { ...accountA, access_token: "e2e-account-b-token", user: { ...accountA.user, id: "e2e-account-b" } };

function headers() {
  return {
    "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
}

async function dispatchSession(page: Page, session: unknown) {
  await page.evaluate(([eventName, nextSession]) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail: nextSession }));
  }, ["sk7:e2e-session-change", session] as const);
}

test("account removal needs two confirmations, freezes mutations, clears history, and lands on S01", async ({ page }) => {
  let deleteRequests = 0;
  let releaseDelete!: () => void;
  const pendingDelete = new Promise<void>((resolve) => { releaseDelete = resolve; });

  await page.route("**://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: headers() });
    if (url.pathname === "/api/v1/observations/window") {
      return route.fulfill({ status: 200, headers: headers(), contentType: "application/json", body: JSON.stringify(emptyWindow) });
    }
    if (url.pathname === "/api/v1/account" && request.method() === "DELETE") {
      deleteRequests += 1;
      await pendingDelete;
      return route.fulfill({ status: 204, headers: headers() });
    }
    if (url.pathname === "/auth/v1/logout" && request.method() === "POST") {
      return route.fulfill({ status: 500, headers: headers(), contentType: "application/json", body: JSON.stringify({ error: "synthetic local sign-out failure" }) });
    }
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S14&record=old-record");
  const deleteButton = page.getByRole("button", { name: "계정 삭제" });
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("계정이 삭제됩니다.");
  await expect(dialog.getByRole("button", { name: "최종 삭제" })).toHaveCount(0);
  expect(deleteRequests).toBe(0);

  await dialog.getByRole("button", { name: "계속" }).click();
  await expect(dialog).toContainText("계정을 영구 삭제할까요?");
  await dialog.getByRole("button", { name: "최종 삭제" }).click();
  await expect(dialog.getByRole("button", { name: "삭제 처리 중" })).toBeDisabled();
  await expect(deleteButton).toBeDisabled();
  expect(deleteRequests).toBe(1);

  releaseDelete();
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/\?e2e=signed-in$/);
  expect(await page.evaluate(() => ({ state: window.history.state, search: window.location.search }))).toEqual({ state: { sk7UserId: null }, search: "?e2e=signed-in" });
  expect(deleteRequests).toBe(1);
});
test("lost response is neutral until server-backed validation, then explicit retry is allowed", async ({ page }) => {
  let deleteRequests = 0;
  await page.route("**://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: headers() });
    if (url.pathname === "/api/v1/observations/window") return route.fulfill({ status: 200, headers: headers(), contentType: "application/json", body: JSON.stringify(emptyWindow) });
    if (url.pathname === "/api/v1/account" && request.method() === "DELETE") {
      deleteRequests += 1;
      if (deleteRequests === 1) return route.abort();
      return route.fulfill({ status: 204, headers: headers() });
    }
    if (url.pathname === "/auth/v1/user" && request.method() === "GET") {
      return route.fulfill({ status: 200, headers: headers(), contentType: "application/json", body: JSON.stringify(accountA.user) });
    }
    if (url.pathname === "/auth/v1/logout" && request.method() === "POST") return route.fulfill({ status: 204, headers: headers() });
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S14");
  await page.getByRole("button", { name: "계정 삭제" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "계속" }).click();
  await dialog.getByRole("button", { name: "최종 삭제" }).click();

  await expect(dialog).toContainText("계정이 아직 유효한 것으로 확인됐어요.");
  expect(deleteRequests).toBe(1);
  await dialog.getByRole("button", { name: "최종 삭제" }).click();
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  expect(deleteRequests).toBe(2);
});

test("ambiguous lost response stays neutral and terminal invalid session completes cleanup without restoring A state", async ({ page }) => {
  let mode: "ambiguous" | "terminal" = "ambiguous";
  let deleteRequests = 0;
  await page.route("**://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: headers() });
    if (url.pathname === "/api/v1/observations/window") {
      const body = mode === "terminal" ? { ...emptyWindow, blood_pressure_observations: [{ id: "b-only", observed_on: "2026-09-02", period: "morning", systolic: 130, diastolic: 85 }] } : emptyWindow;
      return route.fulfill({ status: 200, headers: headers(), contentType: "application/json", body: JSON.stringify(body) });
    }
    if (url.pathname === "/api/v1/account" && request.method() === "DELETE") {
      deleteRequests += 1;
      return route.abort();
    }
    if (url.pathname === "/auth/v1/user" && request.method() === "GET") {
      if (mode === "ambiguous") return route.abort();
      return route.fulfill({ status: 401, headers: headers(), contentType: "application/json", body: JSON.stringify({ error: "user not found" }) });
    }
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S14");
  await page.getByRole("button", { name: "계정 삭제" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "계속" }).click();
  await dialog.getByRole("button", { name: "최종 삭제" }).click();
  await expect(dialog).toContainText("삭제 요청 결과를 확인하지 못했어요.");
  expect(deleteRequests).toBe(1);

  mode = "terminal";
  await dialog.getByRole("button", { name: "최종 삭제" }).click();
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  expect(deleteRequests).toBe(2);

  await dispatchSession(page, accountB);
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page.getByText("120/80 mmHg")).toHaveCount(0);
});

test("an in-flight pre-deletion window response cannot restore the deleted account", async ({ page }) => {
  let windowRequests = 0;
  let releaseRefresh!: () => void;
  const pendingRefresh = new Promise<void>((resolve) => { releaseRefresh = resolve; });

  await page.route("**://e2e.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: headers() });
    if (url.pathname === "/api/v1/observations/window") {
      windowRequests += 1;
      if (windowRequests === 2) await pendingRefresh;
      return route.fulfill({
        status: 200,
        headers: headers(),
        contentType: "application/json",
        body: JSON.stringify({ ...emptyWindow, blood_pressure_observations: [{ id: "old-account-record", observed_on: "2026-09-02", period: "morning", systolic: 120, diastolic: 80 }] }),
      });
    }
    if (url.pathname === "/api/v1/account" && request.method() === "DELETE") return route.fulfill({ status: 204, headers: headers() });
    if (url.pathname === "/auth/v1/logout" && request.method() === "POST") return route.fulfill({ status: 204, headers: headers() });
    return route.abort();
  });

  await page.goto("/?e2e=signed-in&screen=S10");
  await expect(page.getByText("120/80 mmHg")).toBeVisible();
  await page.getByRole("button", { name: "새로고침" }).click();
  await page.getByRole("button", { name: "설정과 도움말" }).click();
  await page.getByRole("button", { name: "계정 삭제" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "계속" }).click();
  await dialog.getByRole("button", { name: "최종 삭제" }).click();
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
  releaseRefresh();
  await page.waitForTimeout(100);
  expect(windowRequests).toBe(2);
  await expect(page.locator('[data-scene="S01"]')).toBeVisible();
});
