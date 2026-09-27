import { fileURLToPath } from "node:url";
import { build } from "vite";
import { placeableBoundary } from "./placeable-boundary.mjs";

// Compile the actual product with its existing Vite/Model V2 boundary intact,
// and assert the optional scene's module/chunk graph. Does not start a server.
await build({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  plugins: [placeableBoundary()],
});
