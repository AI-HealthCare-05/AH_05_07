import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LAB_OUT_DIR, LAB_ROOT, WEB_ROOT, assertLabIsolation } from "./isolation-guard.mjs";

const PRODUCT_DIRECT_SEAMS = Object.freeze([
  "src/ui/companionRuntimeMembership.ts",
  "src/ui/companionReviewCatalog.ts",
]);
const PRODUCT_CLOSURE = Object.freeze([
  ...PRODUCT_DIRECT_SEAMS,
  "src/ui/companion.ts",
  "src/ui/companionActiveAsset.ts",
  "src/ui/companionAssets.generated.ts",
  "src/ui/companionSceneRegistry.ts",
  "src/ui/sceneManifest.generated.ts",
  "asset-candidates/companion-review-catalog.v1.json",
]);
const TYPE_ONLY_CLOSURE = "src/ui/journey.ts";
const ALLOWED_PACKAGES = new Set(["@dimforge/rapier3d-compat", "react", "react-dom", "scheduler", "three"]);
const DENIED_PATTERNS = [
  /\/src\/App\.tsx$/,
  /\/src\/components\/SceneShell\.tsx$/,
  /CompanionReviewRenderer/,
  /SavedSceneRenderer/,
  /useSavedSceneEvent/,
  /\/src\/lib\/(?:api|supabase|auth)/i,
  /model-v2/i,
  /@supabase\/supabase-js/i,
  /\/src\/(?:styles|modern-palette|theme-presets)\.css$/,
];

function cleanId(id) {
  return id.split("?", 1)[0].replaceAll("\\", "/");
}

function absolute(relative) {
  return cleanId(path.resolve(WEB_ROOT, relative));
}

function within(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function packageName(id) {
  const marker = "/node_modules/";
  const index = id.lastIndexOf(marker);
  if (index < 0) return null;
  const tail = id.slice(index + marker.length).replace(/^\.pnpm\/[^/]+\/node_modules\//, "");
  const parts = tail.split("/");
  return parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

function describeModule(id) {
  const cleaned = cleanId(id);
  if (cleaned.startsWith("\0") || cleaned.startsWith("virtual:")) {
    return { kind: "virtual", id: cleaned };
  }
  const pkg = packageName(cleaned);
  if (pkg) return { kind: "package", id: cleaned, packageName: pkg };
  if (within(cleanId(LAB_ROOT), cleaned)) return { kind: "lab", id: cleaned };
  const closure = PRODUCT_CLOSURE.map(absolute);
  if (closure.includes(cleaned)) return { kind: "product-closure", id: cleaned };
  if (cleaned === absolute(TYPE_ONLY_CLOSURE)) return { kind: "type-only", id: cleaned };
  if (within(cleanId(WEB_ROOT), cleaned)) return { kind: "forbidden-web", id: cleaned };
  return { kind: "external-file", id: cleaned };
}

export function validateModuleGraph(graph) {
  const errors = [];
  if (graph.schemaVersion !== "transcend-lab-module-graph.v1") {
    errors.push("unexpected graph schema version");
  }
  try {
    assertLabIsolation({ root: graph.root, outDir: graph.outDir });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "invalid graph paths");
  }
  if (!Array.isArray(graph.modules) || graph.modules.length === 0) {
    errors.push("module graph is empty");
    return errors;
  }

  const byId = new Map(graph.modules.map((module) => [cleanId(module.id), module]));
  const directSeamsSeen = new Set();
  for (const module of graph.modules) {
    const descriptor = describeModule(module.id);
    if (DENIED_PATTERNS.some((pattern) => pattern.test(descriptor.id))) {
      errors.push(`explicitly denied module: ${descriptor.id}`);
    }
    if (descriptor.kind === "package" && !ALLOWED_PACKAGES.has(descriptor.packageName)) {
      errors.push(`package is outside the Lab allowlist: ${descriptor.packageName}`);
    }
    if (descriptor.kind === "forbidden-web" || descriptor.kind === "external-file") {
      errors.push(`file is outside the Lab/closure boundary: ${descriptor.id}`);
    }
    if (descriptor.kind === "type-only") {
      errors.push(`type-only compiler dependency entered executable graph: ${descriptor.id}`);
    }
    for (const seam of PRODUCT_DIRECT_SEAMS) {
      if (descriptor.id === absolute(seam)) directSeamsSeen.add(seam);
    }

    const imports = [...(module.importedIds ?? []), ...(module.dynamicallyImportedIds ?? [])];
    for (const importedId of imports) {
      const imported = describeModule(importedId);
      if (
        descriptor.kind === "lab"
        && imported.kind === "product-closure"
        && !PRODUCT_DIRECT_SEAMS.some((seam) => imported.id === absolute(seam))
      ) {
        errors.push(`Lab directly imports a closure member outside the read-only seams: ${imported.id}`);
      }
      const cleanedImport = cleanId(importedId);
      if (!byId.has(cleanedImport) && imported.kind !== "virtual" && imported.kind !== "package") {
        errors.push(`graph edge target is missing: ${cleanedImport}`);
      }
    }
  }
  for (const seam of PRODUCT_DIRECT_SEAMS) {
    if (!directSeamsSeen.has(seam)) errors.push(`required read-only seam is absent from executable graph: ${seam}`);
  }

  const entries = graph.modules.filter((module) => module.isEntry).map((module) => cleanId(module.id));
  if (entries.length === 0) errors.push("module graph has no executable entry");
  const reachable = new Set();
  const pending = [...entries];
  while (pending.length) {
    const id = pending.pop();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    const module = byId.get(id);
    if (!module) continue;
    for (const imported of [...(module.importedIds ?? []), ...(module.dynamicallyImportedIds ?? [])]) {
      const cleaned = cleanId(imported);
      if (byId.has(cleaned)) pending.push(cleaned);
    }
  }
  for (const module of graph.modules) {
    const descriptor = describeModule(module.id);
    if (
      descriptor.kind !== "virtual"
      && descriptor.kind !== "package"
      && !reachable.has(cleanId(module.id))
    ) {
      errors.push(`unreachable source module was emitted: ${cleanId(module.id)}`);
    }
  }
  return [...new Set(errors)].sort();
}

export function verifyGraphFile(graphPath = path.join(LAB_OUT_DIR, "transcend-module-graph.json")) {
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  const errors = validateModuleGraph(graph);
  if (errors.length) {
    throw new Error(`Transcend Lab module graph rejected:\n- ${errors.join("\n- ")}`);
  }
  return graph;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const graph = verifyGraphFile(process.argv[2]);
  process.stdout.write(
    `Transcend Lab module graph verified: ${graph.modules.length} transitive modules at ${graph.sourceSha}\n`,
  );
}
