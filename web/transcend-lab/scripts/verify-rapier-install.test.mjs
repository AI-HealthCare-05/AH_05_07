import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyRapierInstall } from "./verify-rapier-install.mjs";

function fixture(t, { local = true, version = "0.20.0", lockVersion = "0.20.0" } = {}) {
  const base = realpathSync(mkdtempSync(path.join(tmpdir(), "w1-dependency-")));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, "lab");
  mkdirSync(root);
  const name = "@dimforge/rapier3d-compat";
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { [name]: "0.20.0" } }));
  writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ packages: {
    "": { dependencies: { [name]: "0.20.0" } },
    [`node_modules/${name}`]: { version: lockVersion, integrity: "sha512-fixture" },
  } }));
  function install(where, installedVersion) {
    const dir = path.join(where, "node_modules", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version: installedVersion, main: "index.js" }));
    writeFileSync(path.join(dir, "index.js"), "// synthetic resolution fixture\n");
    return dir;
  }
  const parent = install(base, "0.12.0");
  if (local) install(root, version);
  return { root, parent, name };
}

test("accepts the exact Lab-local package even with an old ancestor copy", t => {
  assert.equal(verifyRapierInstall(fixture(t).root).version, "0.20.0");
});
test("rejects missing Lab install rather than silently resolving ancestor 0.12", t => {
  assert.throws(() => verifyRapierInstall(fixture(t, { local: false }).root), /Lab must resolve its own/);
});
test("rejects locally installed version drift", t => {
  assert.throws(() => verifyRapierInstall(fixture(t, { version: "0.12.0" }).root), /Lab must resolve its own/);
});
test("rejects manifest and lock disagreement", t => {
  assert.throws(() => verifyRapierInstall(fixture(t, { lockVersion: "0.12.0" }).root), /same exact/);
});
test("rejects symlink fallback into another workspace", t => {
  const { root, parent, name } = fixture(t, { local: false });
  mkdirSync(path.join(root, "node_modules/@dimforge"), { recursive: true });
  symlinkSync(parent, path.join(root, "node_modules", name), "dir");
  assert.throws(() => verifyRapierInstall(root), /Lab must resolve its own/);
});
