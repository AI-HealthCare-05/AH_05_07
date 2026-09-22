import { defineConfig } from "@playwright/test";

const companionOff = process.env.SK7_SCENE_TEST_COMPANION === "off";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/living-scene-review",
  testMatch: [
    "living-scene-review.spec.ts",
    "diorama-scene-review.spec.ts",
    "seoul-date-rollover.spec.ts",
    "s02-spatial-presence.spec.ts",
  ],
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/living-scene-review/report.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    launchOptions: { args: process.env.CI ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [] },
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    env: { VITE_API_BASE_URL: "http://e2e.invalid", VITE_SK7_E2E_MODE: "1", VITE_SK7_SCENE_MODE: "review", VITE_SK7_COMPANION_MODE: companionOff ? "off" : "review", VITE_SUPABASE_URL: "https://e2e.invalid", VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-test-publishable-key" },
    port: 4173,
    reuseExistingServer: false,
  },
});
