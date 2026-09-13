import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, renameSync, copyFileSync, appendFileSync, readFileSync, realpathSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertUnchanged, pythonRules, captureSnapshot, digest, git, guardedSources, materializeSnapshot, sealPath, sourceIdentity, verifyAssets, writeEvidence } from "./verify-model-v2-assets.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
// Harness aggregates exercise evidence mechanics; they are never real parity evidence.
const summary = { cases: 3, success: 1, inputInvalid: 1, arithmeticFailure: 1,
  browsers: ["chromium", "firefox", "webkit"].map(name => ({ name, mutationsRejected: 4,
    publicExecutionGuard: true, bmiEndpointFailClosed: true, maxScoreError: 0, maxPreprocessError: 0 })) };
function commit(root) {
  git(root, "add", ".");
  git(root, "-c", "user.name=Evidence test", "-c", "user.email=evidence@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", "Synthetic harness source");
}
function fixture(run) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "s11-guard-")));
  try {
    for (const path of guardedSources) {
      mkdirSync(dirname(resolve(root, path)), { recursive: true });
      copyFileSync(resolve(repo, path), resolve(root, path));
    }
    // TypeScript build output is not a competing resolution configuration.
    writeFileSync(resolve(root, "web/tsconfig.tsbuildinfo"), "{}");
    git(root, "init", "-q");
    commit(root);
    const snapshot = captureSnapshot(root);
    const source = sourceIdentity(root, snapshot);
    writeEvidence(root, snapshot, source, summary);
    return run({ root, snapshot: captureSnapshot(root), source });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test("unchanged committed snapshot seals and verifies including Git source identity", () => fixture(({ root, snapshot }) => {
  assert.deepEqual(verifyAssets(root, true).sha256, snapshot.sha256);
}));

test("stale asset, Python and browser bytes are rejected", () => {
  for (const path of ["web/public/models/model-v2.json", "app/services/model_v2_input_adapter.py", "web/src/lib/model-v2/adapter.ts"]) {
    fixture(({ root }) => {
      appendFileSync(resolve(root, path), "\n");
      assert.throws(() => verifyAssets(root), /digest mismatch|evidence expired/);
    });
  }
});

test("manually relabeling source hashes cannot relabel immutable verification commit", () => fixture(({ root }) => {
  const path = "web/src/lib/model-v2/adapter.ts";
  appendFileSync(resolve(root, path), "\n// unverified edit\n");
  const seal = JSON.parse(readFileSync(resolve(root, sealPath)));
  seal.sha256[path] = digest(readFileSync(resolve(root, path)));
  writeFileSync(resolve(root, sealPath), JSON.stringify(seal));
  verifyAssets(root); // Hash equality alone still proves no execution history.
  assert.throws(() => verifyAssets(root, true), /source must match verification commit/);
}));

test("honest claim: a repository writer can fabricate a new commit and run report", () => fixture(({ root }) => {
  appendFileSync(resolve(root, "web/src/lib/model-v2/adapter.ts"), "\n// fabricated run\n");
  commit(root);
  const snapshot = captureSnapshot(root);
  // Deliberately no oracle. A Git commit is not a signature by a trusted runner.
  writeEvidence(root, snapshot, sourceIdentity(root, snapshot), summary);
  assert.equal(verifyAssets(root, true).claim, "reviewed-local-run; not independent execution attestation");
}));

test("all unexpected resolution candidates, directories and symlinks are rejected", () => {
  for (const name of ["adapter.js", "adapter.mjs", "adapter.mts", "adapter.jsx", "adapter.tsx", "adapter.json", "adapter.cjs", "adapter.cts", "Adapter.ts", "new-helper.ts", "package.json", "adapter"]) {
    fixture(({ root }) => {
      const path = resolve(root, "web/src/lib/model-v2", name);
      if (name === "adapter") mkdirSync(path); else writeFileSync(path, "export {};\n");
      assert.throws(() => verifyAssets(root), /unexpected Model V2 module|evidence expired/);
    });
  }
  fixture(({ root }) => {
    const adapter = resolve(root, "web/src/lib/model-v2/adapter.ts");
    const original = resolve(root, "original.ts");
    copyFileSync(adapter, original);
    rmSync(adapter);
    symlinkSync(original, adapter);
    assert.throws(() => verifyAssets(root), /nonregular source/);
  });
  for (const candidate of ["web/vite.config.js", "web/tsconfig.build.json", "web/src/components/modelV2Draft.js", "web/src/tsconfig.json", "web/src/lib/package.json", "web/tests/tsconfig.json"]) {
    fixture(({ root }) => {
      writeFileSync(resolve(root, candidate), "{}");
      assert.throws(() => verifyAssets(root), /unexpected .*resolution/);
    });
  }
});

test("intervening bound source/config/asset/scope changes abort without updating evidence", () => {
  for (const path of [...guardedSources, "web/src/lib/model-v2/adapter.js", "web/vite.config.mjs"]) {
    fixture(({ root, snapshot, source }) => {
      const before = readFileSync(resolve(root, sealPath));
      appendFileSync(resolve(root, path), "\n");
      assert.throws(() => writeEvidence(root, snapshot, source, summary), /source changed|digest mismatch|unexpected/);
      assert.deepEqual(readFileSync(resolve(root, sealPath)), before);
    });
  }
});

test("actual verification archive remains fixed even across edit-and-restore", () => fixture(({ root, snapshot, source }) => {
  const output = mkdtempSync(resolve(tmpdir(), "s11-snapshot-test-"));
  try {
    const archived = materializeSnapshot(root, snapshot, source, output);
    const path = "web/src/lib/model-v2/adapter.ts";
    const original = readFileSync(resolve(root, path));
    appendFileSync(resolve(root, path), "\n// changed while verifying\n");
    assert.deepEqual(captureSnapshot(archived).sha256, snapshot.sha256);
    const before = readFileSync(resolve(root, sealPath));
    assert.throws(() => writeEvidence(root, snapshot, source, summary), /source changed/);
    assert.deepEqual(readFileSync(resolve(root, sealPath)), before);
    writeFileSync(resolve(root, path), original);
    // Even restored bytes retain a changed file version (ctime/inode/mtime).
    assert.throws(() => writeEvidence(root, snapshot, source, summary), /source changed/);
    assert.deepEqual(readFileSync(resolve(root, sealPath)), before);
    // A fresh run may capture the restored committed source again.
    writeEvidence(root, captureSnapshot(root), source, summary);
    verifyAssets(root, true);
  } finally { rmSync(output, { recursive: true, force: true }); }
}));


test("real Vite graph rejects a configured replacement outside the closed directory", () => fixture(({ root }) => {
  symlinkSync(resolve(repo, "web/node_modules"), resolve(root, "web/node_modules"), "dir");
  const script = `import { build } from "vite";
    import { resolve } from "node:path";
    const root = process.argv[1];
    await build({ configFile: resolve(root, "web/vite.config.ts"),
      root: resolve(root, "web/tests/model-v2"), logLevel: "silent",
      build: { target: "es2022", outDir: resolve(root, "bundle") } });`;
  const build = () => spawnSync(process.execPath, ["--input-type=module", "-e", script, root],
    { cwd: resolve(repo, "web"), encoding: "utf8" });
  const original = build();
  assert.equal(original.status, 0, original.stderr);
  const config = resolve(root, "web/vite.config.ts");
  writeFileSync(resolve(root, "replacement.ts"), 'export * from "./web/src/lib/model-v2/adapter.ts";\n');
  writeFileSync(config, readFileSync(config, "utf8").replace("plugins:",
    `resolve: { alias: { "./adapter": ${JSON.stringify(resolve(root, "replacement.ts"))} } }, plugins:`));
  const mutant = build();
  assert.notEqual(mutant.status, 0);
  assert.match(mutant.stderr, /escaped the verified module boundary/);
}));


test("a shadow candidate added and removed during verification still expires the run", () => fixture(({ root, snapshot, source }) => {
  const before = readFileSync(resolve(root, sealPath));
  const path = resolve(root, "web/src/lib/model-v2/adapter.js");
  writeFileSync(path, "export {};\n");
  rmSync(path);
  assert.throws(() => writeEvidence(root, snapshot, source, summary), /source changed/);
  assert.deepEqual(readFileSync(resolve(root, sealPath)), before);
}));

// A real Python package takes precedence over the unchanged, hash-guarded .py.
const shadowAdapter = `from pathlib import Path
exec(compile(Path(__file__).resolve().parents[1].joinpath("model_v2_input_adapter.py").read_bytes(), "canonical-adapter", "exec"))
_original = adapt_product_input_v2
def adapt_product_input_v2(value):
    result = _original(value)
    result["bmi_from_height_weight"] *= 1.01
    return result
`;
function addPythonShadow(root) {
  const path = resolve(root, "app/services/model_v2_input_adapter");
  mkdirSync(path);
  writeFileSync(resolve(path, "__init__.py"), shadowAdapter);
  return path;
}
const python = process.env.SK7_PYTHON || "python3";
function probe(root, args = []) {
  return spawnSync(python, ["-I", "-B", "-X", `pycache_prefix=${resolve(root, "unused-bytecode")}`,
    resolve(root, "scripts/model/verify_model_v2_python_boundary.py"), ...args], { cwd: tmpdir(), encoding: "utf8" });
}
function rejectsPublication(root, snapshot, source) {
  const before = readFileSync(resolve(root, sealPath));
  assert.throws(() => writeEvidence(root, snapshot, source, summary), /source changed|unexpected Python|nonregular|symlink/);
  assert.deepEqual(readFileSync(resolve(root, sealPath)), before);
}

test("Python resolution probe passes unchanged materialized Git snapshot", () => fixture(({ root, snapshot, source }) => {
  const output = mkdtempSync(resolve(tmpdir(), "s11-python-snapshot-"));
  try {
    const archived = materializeSnapshot(root, snapshot, source, output);
    const result = probe(archived);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(captureSnapshot(archived).sha256, snapshot.sha256);
  } finally { rmSync(output, { recursive: true, force: true }); }
}));

test("reported BMI-changing Python package wins import but cannot refresh evidence", () => fixture(({ root, snapshot, source }) => {
  const path = addPythonShadow(root);
  const script = `import sys, runpy, json
sys.path.insert(0, sys.argv[1])
from app.services import model_v2_input_adapter as adapter
base = runpy.run_path(sys.argv[1] + "/tests/model/browser_fixtures.py")["PRODUCT_BASE"]
assert adapter.__file__.endswith("model_v2_input_adapter/__init__.py")
assert adapter.adapt_product_input_v2(base)["bmi_from_height_weight"] == adapter._original(base)["bmi_from_height_weight"] * 1.01
print("shadow changed contract-valid BMI")`;
  const result = spawnSync(python, ["-I", "-B", "-c", script, root], { cwd: tmpdir(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /shadow changed contract-valid BMI/);
  assert.throws(() => captureSnapshot(root), /unexpected Python resolution/); // present before capture
  assert.throws(() => verifyAssets(root), /unexpected Python resolution/);
  assert.notEqual(probe(root).status, 0); // independent real Python resolution rejects too
  rejectsPublication(root, snapshot, source); // added after capture
  rmSync(path, { recursive: true });
  rejectsPublication(root, snapshot, source); // added then removed
}));

test("Python shadow in verification archive is rejected, including transient addition", () => fixture(({ root, snapshot, source }) => {
  const output = mkdtempSync(resolve(tmpdir(), "s11-python-drift-"));
  try {
    const archived = materializeSnapshot(root, snapshot, source, output);
    const captured = captureSnapshot(archived);
    const path = addPythonShadow(archived);
    assert.throws(() => assertUnchanged(archived, captured), /unexpected Python/);
    assert.notEqual(probe(archived).status, 0);
    rmSync(path, { recursive: true });
    assert.throws(() => assertUnchanged(archived, captured), /source changed/);
  } finally { rmSync(output, { recursive: true, force: true }); }
}));

test("every scoped Python module rejects package, extension, bytecode and case competitors", () => {
  for (const path of Object.values(pythonRules.modules)) {
    fixture(({ root, snapshot, source }) => {
      const base = resolve(root, path.slice(0, -3));
      for (const suffix of ["", ".so", ".abi3.so", ".pyd", ".pyc"]) {
        const candidate = base + suffix;
        if (suffix) writeFileSync(candidate, "competing module");
        else { mkdirSync(candidate); writeFileSync(resolve(candidate, "__init__.py"), "# replacement\n"); }
        assert.throws(() => captureSnapshot(root), /unexpected Python resolution/);
        rejectsPublication(root, snapshot, source);
        rmSync(candidate, { recursive: true });
      }
      // Different extension keeps this distinct even on case-insensitive macOS.
      const candidate = resolve(dirname(base), base.split("/").at(-1).toUpperCase() + ".pyd");
      writeFileSync(candidate, "competing case variant");
      assert.throws(() => captureSnapshot(root), /unexpected Python resolution/);
      rmSync(candidate);
      const original = readFileSync(base + ".py");
      rmSync(base + ".py");
      mkdirSync(base + ".py");
      assert.throws(() => captureSnapshot(root), /nonregular/);
      rmSync(base + ".py", { recursive: true });
      writeFileSync(base + ".py", original);
      rejectsPublication(root, snapshot, source);
    });
  }
});

test("existing and absent parent initializers and parent module competitors are bound", () => {
  for (const [name, initializer] of Object.entries(pythonRules.packages)) {
    fixture(({ root, snapshot, source }) => {
      const directory = name.replaceAll(".", "/");
      const path = resolve(root, directory, "__init__.py");
      const original = initializer ? readFileSync(path) : null;
      writeFileSync(path, "# changed initializer\n");
      rejectsPublication(root, snapshot, source);
      if (original) writeFileSync(path, original); else rmSync(path);
      rejectsPublication(root, snapshot, source); // restore/absence does not reset running capture
      const candidate = resolve(root, `${directory}.py`);
      writeFileSync(candidate, "# parent replacement\n");
      assert.throws(() => captureSnapshot(root), /unexpected Python resolution/);
    });
  }
});

test("Python package symlinks, source symlinks and initializer replacements fail closed", () => fixture(({ root, snapshot, source }) => {
  const directory = resolve(root, "app/services/model_v2_input_adapter");
  symlinkSync(resolve(root, "app/services"), directory, "dir");
  assert.throws(() => captureSnapshot(root), /unexpected Python/);
  rmSync(directory);
  const path = resolve(root, "app/services/model_v2_input_adapter.py");
  const target = resolve(root, "original.py");
  copyFileSync(path, target);
  rmSync(path);
  symlinkSync(target, path);
  assert.throws(() => captureSnapshot(root), /Python symlink|nonregular/);
  assert.notEqual(probe(root).status, 0);
  rmSync(path);
  copyFileSync(target, path);
  const initializer = resolve(root, "app/services/__init__.py");
  rmSync(initializer);
  mkdirSync(initializer);
  assert.throws(() => captureSnapshot(root), /nonregular/);
  rejectsPublication(root, snapshot, source);
}));

test("Git identity rejects a committed shadow or added namespace initializer hidden in live tree", () => {
  for (const candidate of ["app/services/model_v2_input_adapter/__init__.py", "scripts/model/__init__.py"]) {
    fixture(({ root }) => {
      mkdirSync(dirname(resolve(root, candidate)), { recursive: true });
      writeFileSync(resolve(root, candidate), "# committed competing resolution\n");
      commit(root);
      if (candidate.includes("model_v2_input_adapter/")) rmSync(dirname(resolve(root, candidate)), { recursive: true });
      else rmSync(resolve(root, candidate));
      const snapshot = captureSnapshot(root);
      assert.throws(() => sourceIdentity(root, snapshot), /unexpected committed Python/);
    });
  }
});

test("probe checks actual imported file, shape and search path after canonical entry", () => fixture(({ root }) => {
  const entry = "tests/model/browser_fixtures.py";
  const baseline = probe(root, [entry]);
  assert.equal(baseline.status, 0, baseline.stderr);
  const original = readFileSync(resolve(root, entry), "utf8");
  for (const mutation of [
    'import app.services.model_v2_input_adapter as m; m.__file__ = "/tmp/outside.py"',
    'import app.services.model_v2_input_adapter as m; m.__spec__.submodule_search_locations = ["/tmp"]',
    'import app.services as m; m.__path__ = ["/tmp"]',
  ]) {
    writeFileSync(resolve(root, entry), original + "\n" + mutation + "\n");
    const result = probe(root, [entry]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Python import boundary rejected/);
  }
}));

test("parent package symlink replacement cannot preserve the resolution boundary", () => fixture(({ root, snapshot, source }) => {
  const path = resolve(root, "app/services");
  const target = resolve(root, "saved-services");
  renameSync(path, target);
  symlinkSync(target, path, "dir");
  assert.throws(() => captureSnapshot(root), /symlink/);
  assert.notEqual(probe(root).status, 0);
  rejectsPublication(root, snapshot, source);
}));
