import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { LAB_OUT_DIR, LAB_ROOT, PRODUCT_OUT_DIR, assertLabIsolation } from "./isolation-guard.mjs";

test("accepts only the dedicated root and output", () => {
  assert.equal(assertLabIsolation().root, LAB_ROOT);
  assert.equal(assertLabIsolation().outDir, LAB_OUT_DIR);
});

test("rejects web/dist as a direct output", () => {
  assert.throws(
    () => assertLabIsolation({ root: LAB_ROOT, outDir: PRODUCT_OUT_DIR }),
    /output must resolve exactly|may not resolve/,
  );
});

test("rejects a symlink alias to web/dist", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "transcend-isolation-"));
  try {
    const product = path.join(fixture, "dist");
    const alias = path.join(fixture, "alias");
    mkdirSync(product);
    symlinkSync(product, alias, "dir");
    assert.throws(
      () => assertLabIsolation({ root: LAB_ROOT, outDir: alias }),
      /output must resolve exactly|may not resolve/,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("world renderer and touch input depend on the reusable runtime port", () => {
  for (const relativePath of ["src/worldPlayableStage.ts", "src/worldTouchControls.ts"]) {
    const source = readFileSync(path.join(LAB_ROOT, relativePath), "utf8");
    assert.match(source, /platform\/spatial\/worldRuntimePort/);
    assert.doesNotMatch(source, /type KinematicWorld/);
  }
});

test("playable renderer receives environment policy through the scene profile", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  const runtime = readFileSync(path.join(LAB_ROOT, "src/labRuntime.ts"), "utf8");
  assert.match(stage, /platform\/spatial\/worldSceneProfile/);
  assert.doesNotMatch(stage, /KINEMATIC_CONFIG|PLAYABLE_DESTINATION|playableWorldLayout/);
  assert.match(runtime, /W1_WORLD_SCENE_PROFILE/);
});
