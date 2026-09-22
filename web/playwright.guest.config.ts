import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "guest-journey.spec.ts",
  outputDir: "./test-results/guest-journey",
  timeout: 90_000,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/guest-journey/report.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "npm run build -- --outDir test-results/guest-journey-build && npm run preview -- --outDir test-results/guest-journey-build --host 127.0.0.1 --port 4173 --strictPort",
    env: {
      VITE_SK7_UI_MODE: "journey",
      VITE_SK7_SCENE_MODE: "review",
      VITE_SK7_COMPANION_MODE: "review",
      VITE_SK7_E2E_MODE: "1",
      VITE_SK7_EVIDENCE_MODE: "",
      VITE_SK7_EVIDENCE_FIXTURE: "",
      VITE_API_BASE_URL: "http://e2e.invalid",
      VITE_SUPABASE_URL: "https://e2e.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-test-publishable-key",
    },
    port: 4173,
    reuseExistingServer: false,
  },
});
