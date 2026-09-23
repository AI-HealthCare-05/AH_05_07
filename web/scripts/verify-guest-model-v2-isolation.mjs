import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const webSrc = resolve(repo, "web/src");

// Guest entry plus the shared Model V2 input/runtime path. The traversal starts
// here and follows runtime imports only (type-only imports are erased by build).
const defaultRoots = [
  resolve(webSrc, "GuestJourneySandbox.tsx"),
  resolve(webSrc, "components/ModelV2InputFlow.tsx"),
  resolve(webSrc, "lib/model-v2/runtime.ts"),
];

const forbiddenModules = [
  { pattern: /\/App\.tsx$/, name: "App.tsx" },
  { pattern: /\/lib\/api\.ts$/, name: "product API client module" },
  { pattern: /\/lib\/supabase\.ts$/, name: "Supabase client module" },
  { pattern: /\/lib\/authEmailConfirm\.ts$/, name: "Auth/session bootstrap module (authEmailConfirm)" },
  { pattern: /\/lib\/e2eHarness\.ts$/, name: "Auth/session bootstrap module (e2eHarness)" },
  { pattern: /^@supabase\/supabase-js$/, name: "Supabase runtime package" },
];

const runtimeExtensions = [".tsx", ".ts", ".jsx", ".js"];

function resolveImport(source, fromFile) {
  if (!source.startsWith(".")) return source;
  const base = resolve(dirname(fromFile), source);
  for (const ext of runtimeExtensions) {
    const candidate = base + ext;
    try {
      readFileSync(candidate);
      return candidate;
    } catch { /* continue */ }
  }
  for (const ext of runtimeExtensions) {
    const candidate = resolve(base, "index" + ext);
    try {
      readFileSync(candidate);
      return candidate;
    } catch { /* continue */ }
  }
  return source;
}

function isInlineTypeOnly(specifiers) {
  const inner = specifiers.replace(/^\{|\}$/g, "").trim();
  if (!inner) return false;
  const parts = inner.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.every((s) => s.startsWith("type "));
}

function parseImports(filePath) {
  const source = readFileSync(filePath, "utf8");
  // Strip comments to avoid false matches.
  const cleaned = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const imports = [];
  for (const statement of cleaned.split(";")) {
    const trimmed = statement.trim();
    if (!trimmed.startsWith("import")) continue;
    const match = trimmed.match(/^import\s+(?:type\s+)?(?:([\s\S]*?)\s+from\s+)?["']([^"']+)["']/);
    if (!match) continue;
    const specifiers = match[1] || "";
    const target = match[2];
    const typeOnly = trimmed.startsWith("import type") || isInlineTypeOnly(specifiers);
    imports.push({ source: target, typeOnly });
  }
  return imports;
}

export function guestModelV2IsolationForRoots(roots) {
  const visited = new Set();
  const runtimeModules = new Set();
  const violations = [];
  const queue = [...roots];

  function visit(modulePath) {
    if (visited.has(modulePath)) return;
    visited.add(modulePath);

    const isLocalSource = typeof modulePath === "string"
      && modulePath.startsWith("/")
      && runtimeExtensions.some((ext) => modulePath.endsWith(ext));
    for (const { pattern, name } of forbiddenModules) {
      if (pattern.test(modulePath)) violations.push({ module: modulePath, forbidden: name });
    }

    if (!isLocalSource) return;
    runtimeModules.add(modulePath);

    for (const imp of parseImports(modulePath)) {
      if (imp.typeOnly) continue;
      if (imp.source.endsWith(".css") || imp.source.endsWith(".json")) continue;
      queue.push(resolveImport(imp.source, modulePath));
    }
  }

  while (queue.length > 0) visit(queue.shift());

  return { runtimeModules: [...runtimeModules], violations };
}

export function guestModelV2Isolation() {
  return guestModelV2IsolationForRoots(defaultRoots);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { violations } = guestModelV2Isolation();
  if (violations.length > 0) {
    console.error("Guest Model V2 isolation violations:");
    for (const v of violations) console.error(`  ${v.forbidden}: ${v.module}`);
    process.exit(1);
  }
  console.log("Guest Model V2 isolation passed");
}
