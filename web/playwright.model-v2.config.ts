import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: ["model-v2-user-input-flow.spec.ts", "model-v2-result-state.spec.ts"],
  projects: ["chromium", "firefox", "webkit"].map(browserName => ({
    name: browserName, use: { browserName: browserName as "chromium" | "firefox" | "webkit" },
  })),
  workers: 3,
  use: { ...base.use, trace: "off", screenshot: "off", video: "off" },
});
