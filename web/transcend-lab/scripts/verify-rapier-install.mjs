import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageName = "@dimforge/rapier3d-compat";
const defaultRoot = fileURLToPath(new URL("../", import.meta.url));

export function verifyRapierInstall(root = defaultRoot) {
  const manifestPath = path.join(root, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const expected = manifest.dependencies?.[packageName];
  const locked = lock.packages?.[`node_modules/${packageName}`];
  if (!/^\d+\.\d+\.\d+$/.test(expected ?? "") || locked?.version !== expected
    || lock.packages?.[""]?.dependencies?.[packageName] !== expected || !locked?.integrity) {
    throw new Error("Rapier manifest and lock must declare the same exact integrity-pinned version");
  }
  const install = path.join(root, "node_modules", packageName);
  let entry;
  try {
    const localInstall = realpathSync(install);
    if (localInstall !== path.resolve(install)) throw new Error("symlinked dependency");
    const installed = JSON.parse(readFileSync(path.join(install, "package.json"), "utf8"));
    if (installed.name !== packageName || installed.version !== expected) throw new Error("wrong package/version");
    entry = realpathSync(createRequire(manifestPath).resolve(packageName));
    const relative = path.relative(localInstall, entry);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("parent fallback");
  } catch (cause) {
    throw new Error(`Lab must resolve its own ${packageName}@${expected}; run npm --prefix web/transcend-lab ci --ignore-scripts`, { cause });
  }
  return Object.freeze({ packageName, version: expected, entry });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyRapierInstall();
  console.log(`Verified Lab-local ${result.packageName}@${result.version}`);
}
