import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// @ts-expect-error Dependency-free Node guard is tested directly.
import { assertLabIsolation, LAB_OUT_DIR, LAB_ROOT, WEB_ROOT } from "./scripts/isolation-guard.mjs";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const isolation = assertLabIsolation({
  root: configDirectory,
  outDir: path.resolve(configDirectory, "../.transcend-lab-dist"),
});
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: WEB_ROOT,
  encoding: "utf8",
}).trim();

function normalized(id: string): string {
  return id.replaceAll("\\", "/");
}

function moduleGraphPlugin(): Plugin {
  return {
    name: "transcend-lab-module-graph",
    apply: "build",
    generateBundle() {
      const modules = [...this.getModuleIds()].map((id) => {
        const info = this.getModuleInfo(id);
        return {
          id: normalized(id),
          isEntry: info?.isEntry ?? false,
          importedIds: (info?.importedIds ?? []).map(normalized).sort(),
          dynamicallyImportedIds: (info?.dynamicallyImportedIds ?? []).map(normalized).sort(),
        };
      }).sort((left, right) => left.id.localeCompare(right.id));
      this.emitFile({
        type: "asset",
        fileName: "transcend-module-graph.json",
        source: `${JSON.stringify({
          schemaVersion: "transcend-lab-module-graph.v1",
          sourceSha,
          root: normalized(isolation.root),
          outDir: normalized(isolation.outDir),
          modules,
        }, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  root: LAB_ROOT,
  publicDir: false,
  plugins: [react(), moduleGraphPlugin()],
  define: {
    __TRANSCEND_SOURCE_SHA__: JSON.stringify(sourceSha),
  },
  server: {
    host: "127.0.0.1",
    port: 4179,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4179,
    strictPort: true,
  },
  build: {
    outDir: LAB_OUT_DIR,
    emptyOutDir: true,
    manifest: true,
    sourcemap: false,
  },
});
