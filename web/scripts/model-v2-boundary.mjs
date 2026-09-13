import { normalizePath } from "vite";
import { realpathSync } from "node:fs";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { assertScope, modelDirectory, modelModules } from "./verify-model-v2-assets.mjs";

// Installed in BOTH production and parity builds through the same Vite config.
export function modelV2Boundary() {
  let root;
  let allowed;
  return {
    name: "model-v2-closed-module-boundary",
    enforce: "pre",
    configResolved(config) {
      root = realpathSync(resolve(config.configFile, "../../"));
      allowed = modelModules.map(name => normalizePath(resolve(root, modelDirectory, name)));
    },
    buildStart() { assertScope(root); },
    moduleParsed(module) {
      if (!allowed.includes(module.id)) return;
      for (const id of [...module.importedIds, ...module.dynamicallyImportedIds]) {
        assert.ok(allowed.includes(id), "Model V2 import escaped the verified module boundary");
      }
    },
    generateBundle() {
      // A changed alias/plugin must not silently redirect an otherwise sealed
      // import to a different module (inside or outside the closed directory).
      const ids = new Set(this.getModuleIds());
      for (const id of allowed) assert.ok(ids.has(id), "Model V2 production module was replaced or omitted");
      assertScope(root);
    },
  };
}
