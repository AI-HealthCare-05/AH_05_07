import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const LAB_ROOT = path.resolve(scriptDirectory, "..");
export const WEB_ROOT = path.resolve(LAB_ROOT, "..");
export const LAB_OUT_DIR = path.resolve(WEB_ROOT, ".transcend-lab-dist");
export const PRODUCT_OUT_DIR = path.resolve(WEB_ROOT, "dist");

export function canonicalizePotentialPath(target) {
  const absolute = path.resolve(target);
  const tail = [];
  let cursor = absolute;
  while (!existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    tail.unshift(path.basename(cursor));
    cursor = parent;
  }
  const canonicalBase = existsSync(cursor) ? realpathSync.native(cursor) : cursor;
  return path.resolve(canonicalBase, ...tail);
}

function samePath(left, right) {
  return canonicalizePotentialPath(left) === canonicalizePotentialPath(right);
}

function inside(parent, child) {
  const relative = path.relative(canonicalizePotentialPath(parent), canonicalizePotentialPath(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertLabIsolation({ root = LAB_ROOT, outDir = LAB_OUT_DIR } = {}) {
  if (!samePath(root, LAB_ROOT)) {
    throw new Error(`Transcend Lab root must resolve exactly to ${LAB_ROOT}`);
  }
  if (!samePath(outDir, LAB_OUT_DIR)) {
    throw new Error(`Transcend Lab output must resolve exactly to ${LAB_OUT_DIR}`);
  }
  if (samePath(outDir, PRODUCT_OUT_DIR) || inside(PRODUCT_OUT_DIR, outDir)) {
    throw new Error("Transcend Lab output may not resolve to or inside web/dist");
  }
  if (inside(outDir, PRODUCT_OUT_DIR)) {
    throw new Error("web/dist may not resolve inside the Transcend Lab output");
  }
  return Object.freeze({
    root: canonicalizePotentialPath(root),
    outDir: canonicalizePotentialPath(outDir),
    productOutDir: canonicalizePotentialPath(PRODUCT_OUT_DIR),
  });
}
