import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
export const guardedSources = [
  "app/services/model_v2_input_adapter.py", "app/services/model_v2_inference.py",
  "app/apis/v1/model_v2_routers.py",
  "scripts/model/export_model_v2_browser.py", "tests/model/browser_fixtures.py",
  "tests/model/browser_oracle.py", "tests/fixtures/model_v2_t2_source_answer_parity.json",
  "web/src/components/modelV2Draft.ts",
  "web/src/lib/model-v2/adapter.ts", "web/src/lib/model-v2/runtime.ts",
  "web/src/lib/model-v2/errors.ts", "web/src/lib/model-v2/manifest.json",
  "web/tests/model-v2/verification.ts", "web/tests/model-v2/index.html",
  "web/scripts/verify-model-v2-parity.mjs", "web/scripts/verify-model-v2-assets.mjs",
];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
export function verifyAssets(root = repo) {
  const manifest = JSON.parse(readFileSync(resolve(root, "web/src/lib/model-v2/manifest.json")));
  const bytes = readFileSync(resolve(root, "web/public/models/model-v2.json"));
  assert.equal(digest(bytes), manifest.sha256, "Model V2 build-pinned digest mismatch");
  assert.equal(bytes.length, manifest.bytes, "Model V2 byte count mismatch");
  const seal = JSON.parse(readFileSync(resolve(root, "web/tests/model-v2/parity-seal.json")));
  assert.deepEqual(Object.keys(seal.sha256).sort(), [...guardedSources].sort(), "parity seal scope mismatch");
  for (const source of guardedSources) {
    assert.equal(digest(readFileSync(resolve(root, source))), seal.sha256[source],
      `${source}: canonical parity evidence expired; rerun verify-model-v2-parity.mjs with frozen artifact and --seal`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyAssets();
  console.log("Model V2 pinned asset and canonical parity source guard passed");
}
