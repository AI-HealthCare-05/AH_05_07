import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "production-fixture-boundary.spec.ts",
  workers: process.env.CI ? 1 : undefined,
  use: { baseURL: "http://127.0.0.1:4174" },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4174",
    port: 4174,
    reuseExistingServer: !process.env.CI,
  },
});
