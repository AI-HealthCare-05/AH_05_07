import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error The dependency-free build guard is shared with Node verification.
import { modelV2Boundary } from "./scripts/model-v2-boundary.mjs";

export default defineConfig({
  plugins: [react(), modelV2Boundary()],
});
