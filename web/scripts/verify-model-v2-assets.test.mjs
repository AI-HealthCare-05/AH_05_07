import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, appendFileSync, readFileSync, realpathSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { captureSnapshot, digest, git, guardedSources, materializeSnapshot, sealPath, sourceIdentity, verifyAssets, writeEvidence } from "./verify-model-v2-assets.mjs";

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
    git(root, "init", "-q");
    commit(root);
    const snapshot = captureSnapshot(root);
    const source = sourceIdentity(root, snapshot);
    writeEvidence(root, snapshot, source, summary);
    return run({ root, snapshot, source });
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
  for (const candidate of ["web/vite.config.js", "web/tsconfig.build.json", "web/src/components/modelV2Draft.js"]) {
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
