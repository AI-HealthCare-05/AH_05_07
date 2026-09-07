import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/production-fixture-boundary.spec.ts", "**/companion-review.spec.ts"],
  workers: process.env.CI ? 1 : undefined,
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1",
    env: {
      VITE_API_BASE_URL: "http://e2e.invalid",
      VITE_SK7_E2E_MODE: "1",
    },
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
