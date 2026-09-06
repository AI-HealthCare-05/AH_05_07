import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "companion-review.spec.ts",
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: {
      args: process.env.CI ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [],
    },
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
    env: {
      VITE_API_BASE_URL: "http://e2e.invalid",
      VITE_SK7_E2E_MODE: "1",
      VITE_SK7_COMPANION_MODE: "review",
    },
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
