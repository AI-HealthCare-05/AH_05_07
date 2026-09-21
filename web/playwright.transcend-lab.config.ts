import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "transcend-presence-contract.spec.ts",
    "transcend-interaction-lab.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "line" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4179",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview",
    cwd: path.join(webDirectory, "transcend-lab"),
    url: "http://127.0.0.1:4179",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
