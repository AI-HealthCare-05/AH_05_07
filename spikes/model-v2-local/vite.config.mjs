import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = process.env.SK7_SPIKE_OUTPUT;
if (!output) throw new Error("SK7_SPIKE_OUTPUT must name an external export directory");
const manifest = JSON.parse(readFileSync(resolve(output, "manifest.json"), "utf8"));
function serveModel(server) {
  server.middlewares.use((request, response, next) => {
    if (request.url !== "/model.json") return next();
    if (request.method !== "GET") { response.writeHead(405).end(); return; }
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.end(readFileSync(resolve(output, "model.json")));
  });
}
export default {
  root,
  define: { __MODEL_SHA__: JSON.stringify(manifest.sha256) },
  plugins: [{ name: "external-frozen-model", configureServer: serveModel, configurePreviewServer: serveModel }],
  build: {
    target: "es2022", outDir: resolve(output, "build"), emptyOutDir: false,
    rollupOptions: { input: { demo: resolve(root, "index.html"), verification: resolve(root, "verification.html") } },
  },
};
