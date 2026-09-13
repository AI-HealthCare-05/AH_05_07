import { defineConfig } from "@playwright/test";

const useSoftwareWebGL = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "companion-review.spec.ts",
  grep: /all approved species and variants expose exactly the seven runtime clip names/,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: {
      args: useSoftwareWebGL ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [],
    },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    env: {
      VITE_API_BASE_URL: "http://e2e.invalid",
      VITE_SK7_E2E_MODE: "1",
      VITE_SK7_COMPANION_MODE: "review",
    },
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
