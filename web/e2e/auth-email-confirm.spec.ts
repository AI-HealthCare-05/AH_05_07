import { expect, test, type Page } from "@playwright/test";

type AuthConfirmHarness = {
  verifyBodies: unknown[];
};

async function installAuthConfirmHarness(page: Page, verifyStatus = 200) {
  await page.addInitScript(({ verifyStatus }) => {
    const nativeFetch = window.fetch.bind(window);
    const verifyBodies: unknown[] = [];
    Object.assign(window, { authConfirmHarness: { verifyBodies } });

    const base64Url = (value: unknown) =>
      btoa(JSON.stringify(value))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/u, "");

    window.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        window.location.href,
      );

      if (url.origin === "https://e2e.invalid" && url.pathname === "/auth/v1/verify") {
        const bodyText = typeof init?.body === "string"
          ? init.body
          : input instanceof Request
            ? await input.clone().text()
            : "";
        if (bodyText) verifyBodies.push(JSON.parse(bodyText));

        if (verifyStatus !== 200) {
          return Response.json(
            { code: 400, error_code: "otp_expired", msg: "Synthetic invalid token" },
            { status: verifyStatus },
          );
        }

        const now = Math.floor(Date.now() / 1000);
        const accessToken = [
          base64Url({ alg: "HS256", typ: "JWT" }),
          base64Url({
            aud: "authenticated",
            exp: now + 3600,
            role: "authenticated",
            sub: "auth-confirm-user",
          }),
          "synthetic-signature",
        ].join(".");

        return Response.json({
          access_token: accessToken,
          refresh_token: "synthetic-auth-confirm-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: "auth-confirm-user",
            aud: "authenticated",
            role: "authenticated",
            email: "synthetic@example.invalid",
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: {},
            identities: [],
            created_at: "2026-09-14T00:00:00Z",
            updated_at: "2026-09-14T00:00:00Z",
          },
        });
      }

      if (url.origin === "http://e2e.invalid" && url.pathname === "/api/v1/observations/window") {
        return Response.json({
          start_on: url.searchParams.get("start_on"),
          end_on: url.searchParams.get("end_on"),
          blood_pressure_observations: [],
          active_challenge: null,
          challenge_checkins: [],
          challenge_events: [],
        });
      }

      return nativeFetch(input, init);
    };
  }, { verifyStatus });
}

const verifyBodies = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { authConfirmHarness: AuthConfirmHarness }).authConfirmHarness.verifyBodies,
  );

const cleanLocation = (page: Page) =>
  page.evaluate(() => `${window.location.pathname}${window.location.search}${window.location.hash}`);

test("first-party auth confirmation exchanges the email token and scrubs it from browser history", async ({ page }) => {
  await installAuthConfirmHarness(page);

  await page.goto("/auth/confirm#token_hash=synthetic-email-token&type=email");

  await expect.poll(() => cleanLocation(page)).toBe("/");
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await expect.poll(async () => (await verifyBodies(page)).length).toBe(1);
  expect((await verifyBodies(page))[0]).toMatchObject({
    token_hash: "synthetic-email-token",
    type: "email",
  });
});

test("failed auth confirmation returns to a clean login URL without retaining the token", async ({ page }) => {
  await installAuthConfirmHarness(page, 400);

  await page.goto("/auth/confirm#token_hash=synthetic-expired-token&type=email");

  await expect.poll(() => cleanLocation(page)).toBe("/");
  await expect(page.getByLabel("이메일", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("새 로그인 링크를 요청해 주세요.");
  await expect.poll(async () => (await verifyBodies(page)).length).toBe(1);
});

test("query-string auth token is exchanged once and scrubbed from browser history", async ({ page }) => {
  await installAuthConfirmHarness(page);

  await page.goto("/auth/confirm?token_hash=synthetic-query-token&type=email");

  await expect.poll(() => cleanLocation(page)).toBe("/");
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await expect.poll(async () => (await verifyBodies(page)).length).toBe(1);
  expect((await verifyBodies(page))[0]).toMatchObject({
    token_hash: "synthetic-query-token",
    type: "email",
  });
});
