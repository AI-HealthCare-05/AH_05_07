import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
export const sealPath = "web/tests/model-v2/parity-seal.json";
export const modelDirectory = "web/src/lib/model-v2";
const pythonRulesPath = "scripts/model/model_v2_python_boundary.json";
export const pythonRules = JSON.parse(readFileSync(new URL("../../scripts/model/model_v2_python_boundary.json", import.meta.url)));
export const pythonDirectories = [...new Set([".", ...Object.keys(pythonRules.packages).map(name => name.replaceAll(".", "/"))])];
const ancestorDirectories = ["web/src", "web/src/lib", "web/src/components", "web/scripts", "web/tests", "web/tests/model-v2"];
export const modelModules = ["adapter.ts", "runtime.ts", "errors.ts", "manifest.json"];
export const guardedSources = [
  ...Object.values(pythonRules.modules), ...Object.values(pythonRules.packages).filter(Boolean),
  pythonRulesPath, "scripts/model/verify_model_v2_python_boundary.py",
  "scripts/model/export_model_v2_browser.py", "tests/model/browser_fixtures.py",
  "tests/model/browser_oracle.py", "tests/fixtures/model_v2_t2_source_answer_parity.json",
  "web/src/components/modelV2Draft.ts",
  ...modelModules.map(name => `${modelDirectory}/${name}`),
  "web/public/models/model-v2.json",
  "web/tests/model-v2/verification.ts", "web/tests/model-v2/index.html",
  "web/scripts/verify-model-v2-parity.mjs", "web/scripts/verify-model-v2-assets.mjs",
  "web/scripts/verify-model-v2-assets.test.mjs", "web/scripts/model-v2-boundary.mjs",
  "web/vite.config.ts", "web/tsconfig.json", "web/package.json", "web/package-lock.json",
  "pyproject.toml", "uv.lock", ".python-version", ".gitattributes", ".github/workflows/checks.yml",
].sort();
// The mirror omits canonical workflows as a class and owns its sync workflow.
// All other evidence sources remain mandatory; this is never missing-file tolerance.
const deploymentSources = guardedSources.filter(path => !path.startsWith(".github/workflows/"));
export const digest = bytes => createHash("sha256").update(bytes).digest("hex");
export function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}
function regularFile(root, path) {
  for (let parent = dirname(path); parent !== "."; parent = dirname(parent)) {
    assert.ok(lstatSync(resolve(root, parent)).isDirectory(), `${parent}: unexpected symlink/directory`);
  }
  assert.ok(lstatSync(resolve(root, path)).isFile(), `${path}: unexpected nonregular source`);
  return readFileSync(resolve(root, path));
}
function pythonCandidate(root, directory, basename, expected) {
  const candidates = readdirSync(resolve(root, directory)).filter(name => {
    const lower = name.toLowerCase();
    return lower === basename.toLowerCase() || lower.startsWith(`${basename.toLowerCase()}.`);
  }).sort();
  assert.deepEqual(candidates, expected ? [expected] : [], `unexpected Python resolution candidate: ${directory}/${basename}`);
  if (expected) {
    const stat = lstatSync(resolve(root, directory, expected));
    assert.ok(!stat.isSymbolicLink(), `unexpected Python symlink: ${directory}/${expected}`);
  }
}
export function assertPythonScope(root) {
  for (const [name, path] of Object.entries(pythonRules.modules)) {
    pythonCandidate(root, dirname(path), name.split(".").at(-1), path.split("/").at(-1));
    regularFile(root, path);
  }
  for (const [name, initializer] of Object.entries(pythonRules.packages)) {
    const path = name.replaceAll(".", "/");
    pythonCandidate(root, dirname(path), name.split(".").at(-1), name.split(".").at(-1));
    assert.ok(lstatSync(resolve(root, path)).isDirectory(), `unexpected Python package: ${path}`);
    pythonCandidate(root, path, "__init__", initializer ? "__init__.py" : null);
    if (initializer) regularFile(root, initializer);
  }
}
export function assertScope(root) {
  assertPythonScope(root);
  // Vite/esbuild searches ancestors for the nearest tsconfig; a new parent
  // config/package must not change transforms without expiring evidence.
  for (const directory of ancestorDirectories) {
    assert.deepEqual(readdirSync(resolve(root, directory)).filter(name =>
      /^(?:package\.json|[tj]sconfig(?:\..*)?\.json)$/i.test(name)), [], "unexpected ancestor resolution configuration");
  }
  // Closed inventory, not an extension denylist: covers .mjs/.js/.mts/.ts/
  // .jsx/.tsx/.json, arbitrary future extensions, package/index directories,
  // symlinks and case variants. Even unused additions require boundary review.
  assert.deepEqual(readdirSync(resolve(root, modelDirectory)).sort(), [...modelModules].sort(), "unexpected Model V2 module/scope");
  assert.deepEqual(readdirSync(resolve(root, "web/src/components")).filter(name => /^modelV2Draft(?:\.|$)/i.test(name)).sort(),
    ["modelV2Draft.ts"], "unexpected draft resolution candidate");
  assert.deepEqual(readdirSync(resolve(root, "web")).filter(name => /^(?:vite\.config(?:\.|$)|tsconfig(?:\.|$)|package(?:-lock)?\.json$)/i.test(name) && !name.endsWith(".tsbuildinfo")).sort(),
    ["package-lock.json", "package.json", "tsconfig.json", "vite.config.ts"], "unexpected resolution configuration");
}
export function captureSnapshot(root = repo) {
  return captureSources(root, guardedSources);
}
function captureSources(root, sources) {
  assertScope(root);
  const sha256 = {}, versions = {};
  for (const path of sources) {
    sha256[path] = digest(regularFile(root, path));
    const stat = lstatSync(resolve(root, path), { bigint: true });
    versions[path] = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs, stat.mode].join(":");
  }
  for (const path of [modelDirectory, ...ancestorDirectories, "web", ...pythonDirectories]) {
    const stat = lstatSync(resolve(root, path), { bigint: true });
    versions[`${path}/`] = [stat.dev, stat.ino, stat.mtimeNs, stat.ctimeNs, stat.mode].join(":");
  }
  return Object.freeze({ sha256: Object.freeze(sha256), versions: Object.freeze(versions) });
}
export function assertUnchanged(root, snapshot) {
  assert.deepEqual(captureSnapshot(root), snapshot, "source changed during canonical verification; evidence not updated");
}
function verifyPinnedAsset(root) {
  const manifest = JSON.parse(regularFile(root, `${modelDirectory}/manifest.json`));
  const bytes = regularFile(root, "web/public/models/model-v2.json");
  assert.equal(digest(bytes), manifest.sha256, "Model V2 build-pinned digest mismatch");
  assert.equal(bytes.length, manifest.bytes, "Model V2 byte count mismatch");
  return manifest;
}
export function sourceIdentity(root, snapshot, commit = git(root, "rev-parse", "HEAD").toString().trim()) {
  assert.match(commit, /^[a-f0-9]{40}$/, "invalid verification commit identity");
  for (const path of guardedSources) {
    assert.equal(digest(git(root, "show", `${commit}:${path}`)), snapshot.sha256[path], `${path}: source must match verification commit`);
  }
  // Bind absence and competing candidates in the committed tree too; hashes
  // alone cannot prove the resolution shape of a previously reviewed snapshot.
  const paths = git(root, "ls-tree", "-r", "--name-only", commit).toString().trim().split("\n");
  for (const [name, initializer] of Object.entries(pythonRules.packages)) {
    const directory = name.replaceAll(".", "/");
    const initCandidates = paths.filter(path => path.startsWith(`${directory}/`) &&
      /^__init__(?:\.|$)/i.test(path.slice(directory.length + 1).split("/")[0]));
    assert.deepEqual(initCandidates, initializer ? [initializer] : [], "unexpected committed Python initializer");
  }
  for (const [name, expected] of [...Object.entries(pythonRules.modules),
    ...Object.keys(pythonRules.packages).map(name => [name, name.replaceAll(".", "/")])]) {
    const directory = dirname(expected);
    const prefix = directory === "." ? "" : `${directory}/`;
    const basename = name.split(".").at(-1).toLowerCase();
    const candidates = [...new Set(paths.filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length).split("/")[0])
      .filter(part => part.toLowerCase() === basename || part.toLowerCase().startsWith(`${basename}.`)))].sort();
    assert.deepEqual(candidates, [expected.split("/").at(-1)], "unexpected committed Python resolution candidate");
  }
  const tree = git(root, "rev-parse", `${commit}^{tree}`).toString().trim();
  return { commit, tree };
}
export function materializeSnapshot(root, snapshot, source, output) {
  const destination = resolve(output, "source");
  mkdirSync(destination);
  const archive = resolve(output, "source.tar");
  const fd = openSync(archive, "wx");
  try { execFileSync("git", ["-C", root, "archive", source.commit], { stdio: ["ignore", fd, "pipe"] }); }
  finally { closeSync(fd); }
  execFileSync("tar", ["-xf", archive, "-C", destination]);
  assert.deepEqual(captureSnapshot(destination).sha256, snapshot.sha256, "verification archive differs from captured source");
  return realpathSync(destination);
}
export function verifyHistory(root, seal) {
  assert.deepEqual(sourceIdentity(root, { sha256: seal.sha256 }, seal.source.commit), seal.source, "source tree identity mismatch");
  // No ancestry requirement: a reviewed source commit survives squash merging.
  // CI fetches full history while this PR is open; after a squash the immutable
  // source object must remain fetchable (or be refreshed by a canonical run).
}
export function verifyAssets(root = repo, history = false, { deploymentSnapshot = false } = {}) {
  assert.ok(!(deploymentSnapshot && history), "deployment snapshot mode cannot verify canonical history");
  const manifest = verifyPinnedAsset(root);
  const sources = deploymentSnapshot ? deploymentSources : guardedSources;
  const snapshot = captureSources(root, sources);
  const seal = JSON.parse(readFileSync(resolve(root, sealPath)));
  assert.equal(seal.format, "sk7-parity-evidence-v2");
  assert.equal(seal.claim, "reviewed-local-run; not independent execution attestation");
  assert.equal(seal.canonicalSha256, manifest.canonical_sha256);
  assert.match(seal.source.commit, /^[a-f0-9]{40}$/);
  assert.match(seal.source.tree, /^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(seal.sha256).sort(), guardedSources, "parity seal scope mismatch");
  const expected = Object.fromEntries(sources.map(path => [path, seal.sha256[path]]));
  assert.deepEqual(snapshot.sha256, expected, "canonical parity evidence expired; rerun with frozen artifact and --seal");
  assert.equal(seal.summary.cases, seal.summary.success + seal.summary.inputInvalid + seal.summary.arithmeticFailure);
  assert.ok(seal.summary.success > 0 && seal.summary.inputInvalid > 0 && seal.summary.arithmeticFailure > 0);
  assert.deepEqual(seal.summary.browsers.map(row => row.name), ["chromium", "firefox", "webkit"]);
  for (const browser of seal.summary.browsers) {
    assert.equal(browser.mutationsRejected, 4);
    assert.equal(browser.publicExecutionGuard, true);
    assert.equal(browser.bmiEndpointFailClosed, true);
    assert.ok(browser.maxScoreError >= 0 && browser.maxScoreError <= 1e-12);
    assert.ok(Number.isFinite(browser.maxPreprocessError) && browser.maxPreprocessError >= 0);
  }
  if (history) verifyHistory(root, seal);
  return seal;
}
export function writeEvidence(root, snapshot, source, summary) {
  const manifest = verifyPinnedAsset(root);
  assert.deepEqual(sourceIdentity(root, snapshot, source.commit), source);
  const seal = { format: "sk7-parity-evidence-v2",
    claim: "reviewed-local-run; not independent execution attestation",
    source, canonicalSha256: manifest.canonical_sha256, sha256: snapshot.sha256, summary };
  // Last synchronous check before atomic publication. Never hash changed bytes
  // into evidence: the original snapshot is the only accepted source identity.
  assertUnchanged(root, snapshot);
  const destination = resolve(root, sealPath);
  writeFileSync(`${destination}.tmp`, JSON.stringify(seal, null, 2) + "\n", { flag: "wx" });
  renameSync(`${destination}.tmp`, destination);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.every(arg => ["--history", "--fetch-source", "--deployment-snapshot"].includes(arg)), "unknown verification option");
  const deploymentSnapshot = args.includes("--deployment-snapshot");
  assert.ok(!(deploymentSnapshot && (args.includes("--history") || args.includes("--fetch-source"))),
    "deployment snapshot mode cannot verify canonical history or fetch source");
  if (args.includes("--fetch-source")) {
    const { source } = JSON.parse(readFileSync(resolve(repo, sealPath)));
    assert.match(source.commit, /^[a-f0-9]{40}$/);
    try { git(repo, "cat-file", "-e", `${source.commit}^{commit}`); }
    catch { git(repo, "fetch", "--no-tags", "--depth=1", "origin", source.commit); }
  }
  verifyAssets(repo, args.includes("--history"), { deploymentSnapshot });
  console.log(`Model V2 ${deploymentSnapshot ? "deployment snapshot" : "canonical"} asset/source identity passed (reviewed evidence, not execution attestation)`);
}
