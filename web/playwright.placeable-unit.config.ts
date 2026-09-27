import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

// These specs use Node only: no page fixture, browser process, or listening server.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["placeable.contract.spec.ts", "placeable-world.contract.spec.ts", "placeable-experience.contract.spec.ts"],
  workers: 1,
  outputDir: path.join(tmpdir(), "sk7-placeable-unit-results"),
  reporter: "list",
});
