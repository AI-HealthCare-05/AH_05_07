import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

// Owning room supplies the running product outside the sandbox. No server is
// started here. Account fixtures expect the existing e2e.invalid public env.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "placeable-classic.spec.ts",
  workers: 1,
  outputDir: path.join(tmpdir(), "sk7-placeable-browser-results"),
  use: { baseURL: process.env.SK7_PLACEABLE_BASE_URL || "http://127.0.0.1:4173" },
});
