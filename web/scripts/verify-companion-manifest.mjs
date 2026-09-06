import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGeneratedSource } from "./generate-companion-manifest.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const evidencePath = path.resolve(scriptRoot, "..", "..", "docs", "evidence", "companion-r2-v1.json");
const generatedPath = path.resolve(scriptRoot, "..", "src", "ui", "companionAssets.generated.ts");
const expected = buildGeneratedSource(JSON.parse(fs.readFileSync(evidencePath, "utf8")));
const actual = fs.readFileSync(generatedPath, "utf8");
if (actual !== expected) {
  throw new Error("companionAssets.generated.ts is stale or differs from docs/evidence/companion-r2-v1.json");
}
console.log("companion manifest: 22/22 generated assets match evidence");
