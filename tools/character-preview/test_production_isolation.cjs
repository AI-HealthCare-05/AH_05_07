const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inspectStaticGraph } = require('./production-isolation.cjs');

function fixture(run) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'sk7-isolation-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  const write = (name, source) => fs.writeFileSync(path.join(dist, 'assets', name), source);
  try { run(dist, write); } finally { fs.rmSync(dist, { recursive: true, force: true }); }
}
test('lazy preload filename references are not static Three code', () => fixture((dist, write) => {
  write('index.js', 'const deps=["assets/GLTFLoader-abc.js"]; export const open=()=>import("./GLTFLoader-abc.js");');
  write('GLTFLoader-abc.js', 'console.log("THREE.GLTFLoader");');
  assert.equal(inspectStaticGraph(path.join(dist, 'assets/index.js'), dist).length, 1);
}));
test('direct static imports still reject Three implementation', () => fixture((dist, write) => {
  write('index.js', 'import "./GLTFLoader-abc.js";');
  write('GLTFLoader-abc.js', 'console.log("THREE.GLTFLoader");');
  assert.throws(() => inspectStaticGraph(path.join(dist, 'assets/index.js'), dist), /statically included/);
}));
test('transitive re-exports cannot hide static Three code', () => fixture((dist, write) => {
  write('index.js', 'export * from "./shared.js";');
  write('shared.js', 'export { model } from "./renderer.js";');
  write('renderer.js', 'export const model = "THREE.WebGLRenderer";');
  assert.throws(() => inspectStaticGraph(path.join(dist, 'assets/index.js'), dist), /statically included/);
}));
test('inline Three code remains rejected', () => fixture((dist, write) => {
  write('index.js', 'console.log("THREE.GLTFLoader");');
  assert.throws(() => inspectStaticGraph(path.join(dist, 'assets/index.js'), dist), /statically included/);
}));
test('static cycles terminate and paths cannot escape dist', () => fixture((dist, write) => {
  write('index.js', 'import "./other.js";'); write('other.js', 'import "./index.js";');
  assert.equal(inspectStaticGraph(path.join(dist, 'assets/index.js'), dist).length, 2);
  write('other.js', 'import "../../outside.js";');
  assert.throws(() => inspectStaticGraph(path.join(dist, 'assets/index.js'), dist), /escapes/);
}));
