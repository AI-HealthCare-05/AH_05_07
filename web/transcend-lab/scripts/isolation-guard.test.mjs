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
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  const stagePort = readFileSync(
    path.join(LAB_ROOT, "src/platform/runtime/worldPlayableStagePort.ts"),
    "utf8",
  );
  const touch = readFileSync(path.join(LAB_ROOT, "src/worldTouchControls.ts"), "utf8");
  const touchPort = readFileSync(
    path.join(LAB_ROOT, "src/platform/runtime/worldTouchSurfacePort.ts"),
    "utf8",
  );
  assert.match(stage, /platform\/runtime\/worldPlayableStagePort/);
  assert.match(stagePort, /spatial\/worldRuntimePort/);
  assert.match(touch, /platform\/runtime\/worldTouchSurfacePort/);
  assert.match(touchPort, /spatial\/worldRuntimePort/);
  assert.doesNotMatch(stage + stagePort + touch + touchPort, /type KinematicWorld/);
});

test("playable renderer receives environment policy through the scene profile", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  const runtime = readFileSync(path.join(LAB_ROOT, "src/labRuntime.ts"), "utf8");
  assert.match(stage, /platform\/spatial\/worldSceneProfile/);
  assert.doesNotMatch(
    stage,
    /KINEMATIC_CONFIG|PLAYABLE_DESTINATION|playableWorldLayout|W1 3D world|station button|Open the station/,
  );
  assert.match(runtime, /W1_WORLD_SCENE_PROFILE/);
});

test("world renderer and touch input depend on the reusable resource scope", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  const stagePort = readFileSync(
    path.join(LAB_ROOT, "src/platform/runtime/worldPlayableStagePort.ts"),
    "utf8",
  );
  const touch = readFileSync(path.join(LAB_ROOT, "src/worldTouchControls.ts"), "utf8");
  const touchPort = readFileSync(
    path.join(LAB_ROOT, "src/platform/runtime/worldTouchSurfacePort.ts"),
    "utf8",
  );
  assert.match(stage, /platform\/runtime\/worldPlayableStagePort/);
  assert.match(stagePort, /runtime\/worldResourceScope/);
  assert.match(touch, /platform\/runtime\/worldTouchSurfacePort/);
  assert.match(touchPort, /worldResourceScope/);
  assert.doesNotMatch(stage + stagePort + touch + touchPort, /LabResourceLedger/);
});

test("playable renderer depends on generic render bytes and profile-owned clip names", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  const stagePort = readFileSync(
    path.join(LAB_ROOT, "src/platform/runtime/worldPlayableStagePort.ts"),
    "utf8",
  );
  assert.match(stagePort, /embodiment\/worldRenderableAsset/);
  assert.match(stage, /profile\.actor\.clips/);
  assert.doesNotMatch(stage + stagePort, /VerifiedPinnedAsset|labAssetAdmission/);
});

test("Lab orchestration retains the playable renderer through its stage port", () => {
  const runtime = readFileSync(path.join(LAB_ROOT, "src/labRuntime.ts"), "utf8");
  assert.match(runtime, /WorldPlayableStagePort/);
  assert.match(runtime, /new WorldPlayableStage\(/);
  assert.doesNotMatch(runtime, /#playableStage:\s*WorldPlayableStage\s*\|/);
});

test("playable renderer receives its touch surface from Lab composition", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  const runtime = readFileSync(path.join(LAB_ROOT, "src/labRuntime.ts"), "utf8");
  assert.match(stage, /WorldTouchSurfaceInstaller/);
  assert.doesNotMatch(stage, /worldTouchControls/);
  assert.match(runtime, /new WorldPlayableStage\(/);
  assert.match(runtime, /mountWorldTouchControls/);
});

test("Lab composition can inject an alternate world scene profile", () => {
  const component = readFileSync(path.join(LAB_ROOT, "src/CompanionInteractionLab.tsx"), "utf8");
  const runtime = readFileSync(path.join(LAB_ROOT, "src/labRuntime.ts"), "utf8");
  assert.match(component, /sceneProfile/);
  assert.match(component, /W2_SYNTHETIC_WORLD_SCENE_PROFILE/);
  assert.match(runtime, /playableSceneProfile/);
});

test("Lab composition can inject an alternate playable world session", () => {
  const component = readFileSync(path.join(LAB_ROOT, "src/CompanionInteractionLab.tsx"), "utf8");
  const runtime = readFileSync(path.join(LAB_ROOT, "src/labRuntime.ts"), "utf8");
  assert.match(component, /worldProfile/);
  assert.match(component, /createW2SyntheticPlayableWorldSession/);
  assert.match(runtime, /WorldPlayableSession/);
  assert.match(runtime, /#playableWorldSession/);
  assert.doesNotMatch(runtime, /#kinematicWorld\.start\("playable"\)/);
});

test("W2 world kernel facade exports only reusable world contracts", () => {
  const facade = readFileSync(path.join(LAB_ROOT, "src/platform/worldKernel.ts"), "utf8");
  for (const expected of [
    "kinematicWorldKernel",
    "worldRuntimePort",
    "worldSceneProfile",
    "worldSceneOverlayPlan",
    "worldPlayableSession",
    "worldPlayableStagePort",
    "worldTouchSurfacePort",
    "worldResourceScope",
    "worldRenderableAsset",
    "worldSpaceClock",
  ]) {
    assert.match(facade, new RegExp(expected));
  }
  assert.doesNotMatch(
    facade,
    /w1|labRuntime|LabResourceLedger|PINNED_ACTIVE_ASSET|CompanionInteractionLab|companionReviewCatalog|\.\.\/\.\.\/src/i,
  );
});

test("Lab composition can inject an optional reusable scene overlay plan", () => {
  const component = readFileSync(path.join(LAB_ROOT, "src/CompanionInteractionLab.tsx"), "utf8");
  const runtime = readFileSync(path.join(LAB_ROOT, "src/labRuntime.ts"), "utf8");
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  assert.match(component, /playableOverlayPlan/);
  assert.match(component, /LIVING_WEEK_SCENE_PLAN/);
  assert.match(runtime, /#playableOverlayPlan/);
  assert.match(runtime, /this\.#playableOverlayPlan/);
  assert.match(stage, /WorldSceneOverlayPlan/);
  assert.doesNotMatch(stage, /livingWeek|LIVING_WEEK/i);
});

test("playable renderer maps generic overlay markers into world-space marker meshes", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  assert.match(stage, /overlay-marker:\$\{marker\.id\}/);
  assert.match(stage, /marker\.position\.x/);
  assert.match(stage, /marker\.position\.y/);
  assert.match(stage, /marker\.position\.z/);
  assert.doesNotMatch(stage, /livingWeek|LIVING_WEEK/i);
});

test("playable renderer maps generic overlay segments into world-space line meshes", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  assert.match(stage, /overlay-segment:\$\{segment\.id\}/);
  assert.match(stage, /segment\.start\.x/);
  assert.match(stage, /segment\.start\.z/);
  assert.match(stage, /segment\.end\.x/);
  assert.match(stage, /segment\.end\.z/);
  assert.doesNotMatch(stage, /livingWeek|LIVING_WEEK/i);
});

test("playable renderer maps generic overlay marker labels into billboard sprites", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  assert.match(stage, /marker\.label/);
  assert.match(stage, /overlay-label:\$\{marker\.id\}/);
  assert.match(stage, /CanvasTexture/);
  assert.match(stage, /SpriteMaterial/);
  assert.doesNotMatch(stage, /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
});

test("Lab composition can select the bounded Living Week world shell", () => {
  const component = readFileSync(path.join(LAB_ROOT, "src/CompanionInteractionLab.tsx"), "utf8");
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  assert.match(component, /worldTrack/);
  assert.match(component, /W4_LIVING_WEEK_WORLD_SCENE_PROFILE/);
  assert.match(component, /createW4LivingWeekPlayableWorldSession/);
  assert.match(component, /LIVING_WEEK_SCENE_PLAN/);
  assert.doesNotMatch(stage, /W4_LIVING_WEEK|Living Week|living-week/);
});

test("playable renderer publishes generic overlay proximity semantics without W4 coupling", () => {
  const stage = readFileSync(path.join(LAB_ROOT, "src/worldPlayableStage.ts"), "utf8");
  assert.match(stage, /interactionRadiusMetres/);
  assert.match(stage, /activeOverlayMarkerId/);
  assert.match(stage, /world-overlay-status/);
  assert.match(stage, /Near \$\{activeOverlayMarker\.label\}\./);
  assert.doesNotMatch(stage, /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Living Week/);
});
