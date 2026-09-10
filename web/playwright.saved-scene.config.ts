import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "saved-scene-review.spec.ts",
  outputDir: "./test-results/living-scene-review/s05",
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/living-scene-review/s05-report.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    launchOptions: { args: process.env.CI ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [] },
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    env: { VITE_API_BASE_URL: "http://e2e.invalid", VITE_SK7_E2E_MODE: "1", VITE_SK7_SCENE_MODE: "review", VITE_SK7_COMPANION_MODE: "production" },
    port: 4173,
    reuseExistingServer: false,
  },
});
