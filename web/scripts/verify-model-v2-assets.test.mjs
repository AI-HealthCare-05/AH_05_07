import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { guardedSources, verifyAssets } from "./verify-model-v2-assets.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
test("build guard rejects modified model bytes and expired canonical/adapter evidence", () => {
  verifyAssets();
  for (const mutation of ["web/public/models/model-v2.json", "app/services/model_v2_input_adapter.py", "web/src/lib/model-v2/adapter.ts"]) {
    const root = mkdtempSync(resolve(tmpdir(), "s11-guard-"));
    try {
      for (const path of [...guardedSources, "web/public/models/model-v2.json", "web/tests/model-v2/parity-seal.json"]) {
        mkdirSync(dirname(resolve(root, path)), { recursive: true });
        copyFileSync(resolve(repo, path), resolve(root, path));
      }
      appendFileSync(resolve(root, mutation), "\n");
      assert.throws(() => verifyAssets(root), /digest mismatch|evidence expired/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
