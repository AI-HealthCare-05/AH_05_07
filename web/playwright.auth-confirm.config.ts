import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth-email-confirm.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4197" },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4197",
    env: {
      VITE_API_BASE_URL: "http://e2e.invalid",
      VITE_SUPABASE_URL: "https://e2e.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-test-publishable-key",
      VITE_SK7_E2E_MODE: "1",
    },
    port: 4197,
    reuseExistingServer: false,
  },
});
