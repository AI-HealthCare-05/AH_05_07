import type { Session } from "@supabase/supabase-js";

export const e2eHarnessEnabled = import.meta.env.VITE_SK7_E2E_MODE === "1";

export function allowsE2eFixture(): boolean {
  return e2eHarnessEnabled;
}

export function getE2eSession(value: string | null): Session | null {
  if (!e2eHarnessEnabled || value !== "signed-in") return null;

  return {
    access_token: "e2e-synthetic-access-token",
    refresh_token: "e2e-synthetic-refresh-token",
    expires_in: 3600,
    expires_at: 1_800_000_000,
    token_type: "bearer",
    user: {
      id: "e2e-synthetic-user",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-09-01T00:00:00.000Z",
    },
  } as Session;
}
