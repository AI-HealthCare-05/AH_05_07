import { createHash } from "node:crypto";

import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { KinematicWorld, KINEMATIC_CONFIG } from "../transcend-lab/src/platform/spatial/kinematicWorld";
import { PLAYABLE_DESTINATION, playableWorldLayout, rampVertices, RAMP_TRIANGLES } from "../transcend-lab/src/platform/spatial/playableWorldLayout";
import type { RapierModule } from "../transcend-lab/src/platform/spatial/rapierRuntime";
import { WorldMovementIntentController } from "../transcend-lab/src/platform/behavior/worldMovementIntent";
import {
  cameraObstacle,
  cameraRelativeMovement,
  resolveThirdPersonCamera,
} from "../transcend-lab/src/platform/spatial/thirdPersonCamera";
import { PINNED_ACTIVE_ASSET } from "../transcend-lab/src/platform/embodiment/labEmbodimentPort";
import {
  FixedStepClock,
  WORLD_SPACE,
  translateWorldPoint,
  worldPoint,
  worldVector,
} from "../transcend-lab/src/platform/spatial/worldSpaceClock";
import { companionReviewCatalog } from "../src/ui/companionReviewCatalog";
import { getCompanionRuntimeMembership } from "../src/ui/companionRuntimeMembership";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.config.metadata.transcendLab !== true, "dedicated Transcend Lab config only");
});

async function openRunningLab(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "running");
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(1);
  await expect(page.getByTestId("logical-actor")).toHaveCount(1);
}

async function noTaskResources(page: Page) {
  return page.evaluate(() => window.__TRANSCEND_LAB__!.diagnostics());
}

async function fetchExactPinnedBytes(request: APIRequestContext): Promise<Buffer> {
  const response = await request.get(PINNED_ACTIVE_ASSET.url);
  expect(response.ok()).toBe(true);
  const bytes = await response.body();
  expect(bytes.byteLength).toBe(PINNED_ACTIVE_ASSET.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(PINNED_ACTIVE_ASSET.sha256);
  return bytes;
}

async function fetchExactReviewBytes(
  request: APIRequestContext,
  asset: (typeof companionReviewCatalog.entries)[number],
): Promise<Buffer> {
  const response = await request.get(asset.url);
  expect(response.ok()).toBe(true);
  const bytes = await response.body();
  expect(bytes.byteLength).toBe(asset.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
  return bytes;
}

test("W1 WorldSpace remains metre-tagged and explicit", () => {
  const start = worldPoint(1, 2, 3);
  const moved = translateWorldPoint(start, worldVector(0.5, -1, 2));
  expect(start).toEqual({ space: WORLD_SPACE, kind: "point", x: 1, y: 2, z: 3 });
  expect(moved).toEqual({ space: WORLD_SPACE, kind: "point", x: 1.5, y: 1, z: 5 });
  expect(() => worldPoint(Number.NaN, 0, 0)).toThrow("x must be finite");
});

test("W1 fixed-step clock is display-rate independent and reset-replay deterministic", () => {
  const runForOneSecond = (displayHz: number) => {
    const clock = new FixedStepClock(1 / 60);
    let distanceMetres = 0;
    clock.resume(0);
    for (let frame = 1; frame <= displayHz; frame += 1) {
      clock.sample(frame * (1000 / displayHz), (stepSeconds) => {
        distanceMetres += 2 * stepSeconds;
      });
    }
    return { distanceMetres, snapshot: clock.snapshot };
  };

  const at60 = runForOneSecond(60);
  const at120 = runForOneSecond(120);
  expect(at60.snapshot.stepCount).toBe(60);
  expect(at120.snapshot.stepCount).toBe(60);
  expect(at60.snapshot.simulationSeconds).toBeCloseTo(1, 10);
  expect(at120.snapshot.simulationSeconds).toBeCloseTo(1, 10);
  expect(at60.distanceMetres).toBeCloseTo(2, 10);
  expect(at120.distanceMetres).toBeCloseTo(2, 10);

  const replayClock = new FixedStepClock(1 / 60);
  const replay = () => {
    replayClock.resume(100);
    for (const frameTime of [108, 116, 124, 132, 140, 148, 156, 164, 172, 180, 188, 196, 204]) {
      replayClock.sample(frameTime, () => undefined);
    }
    return replayClock.snapshot;
  };
  const first = replay();
  replayClock.reset();
  expect(replay()).toEqual(first);
});

test("W1 fixed-step suspension fences hidden time instead of catching up", () => {
  const clock = new FixedStepClock(1 / 60);
  let executed = 0;
  clock.resume(0);
  clock.sample(10, () => { executed += 1; });
  clock.suspend();

  clock.resume(5000);
  clock.sample(5017, () => { executed += 1; });
  expect(executed).toBe(1);
  expect(clock.snapshot.stepCount).toBe(1);
  expect(clock.snapshot.simulationSeconds).toBeCloseTo(1 / 60, 10);
});


test("W1 input normalizes keyboard diagonals and opposing keys deterministically", () => {
  const input = new WorldMovementIntentController();
  expect(input.keyDown("KeyW")).toBe(true);
  expect(input.keyDown("KeyD")).toBe(true);
  expect(input.keyDown("KeyW")).toBe(true);
  expect(input.snapshot.intent).toMatchObject({ source: "keyboard", magnitude: 1 });
  expect(input.snapshot.intent.lateral).toBeCloseTo(Math.SQRT1_2, 12);
  expect(input.snapshot.intent.forward).toBeCloseTo(Math.SQRT1_2, 12);
  expect(input.snapshot.pressedKeys).toEqual(["KeyD", "KeyW"]);

  input.keyDown("KeyS");
  expect(input.snapshot.intent).toEqual({ lateral: 1, forward: 0, magnitude: 1, source: "keyboard" });
  input.keyUp("KeyD");
  input.keyUp("KeyW");
  input.keyUp("KeyS");
  expect(input.snapshot.intent).toEqual({ lateral: 0, forward: 0, magnitude: 0, source: "none" });
  expect(input.keyDown("Space")).toBe(false);
});

test("W1 input fences exact pointer ownership and fail-closes abnormal pointer loss", () => {
  const input = new WorldMovementIntentController();
  expect(input.beginPointer(7)).toBe(true);
  expect(input.beginPointer(8)).toBe(false);
  expect(input.updatePointer(8, 1, 0)).toBe(false);
  expect(input.updatePointer(7, 3, 4)).toBe(true);
  expect(input.snapshot.intent.source).toBe("pointer");
  expect(input.snapshot.intent.lateral).toBeCloseTo(0.6, 12);
  expect(input.snapshot.intent.forward).toBeCloseTo(0.8, 12);
  expect(input.snapshot.intent.magnitude).toBeCloseTo(1, 12);

  input.keyDown("KeyW");
  expect(input.snapshot.intent.source).toBe("pointer");
  expect(input.cancelPointer(7)).toBe(true);
  expect(input.snapshot).toMatchObject({
    intent: { lateral: 0, forward: 0, magnitude: 0, source: "none" },
    pressedKeys: [],
    pointerId: null,
    lastClearReason: "pointer-cancel",
  });

  expect(input.beginPointer(9)).toBe(true);
  input.updatePointer(9, -1, 0.5);
  expect(input.lostPointerCapture(9)).toBe(true);
  expect(input.snapshot.intent.magnitude).toBe(0);
  expect(input.snapshot.lastClearReason).toBe("lost-pointer-capture");
});

test("W1 input blur visibility and semantic suspension never restore stale movement", () => {
  const input = new WorldMovementIntentController();
  input.keyDown("ArrowUp");
  input.beginPointer(11);
  input.updatePointer(11, 0.4, 0.7);
  input.blur();
  expect(input.snapshot.intent.magnitude).toBe(0);
  expect(input.snapshot.lastClearReason).toBe("blur");

  input.keyDown("KeyA");
  input.setHidden(true);
  expect(input.snapshot).toMatchObject({ suspended: true, pointerId: null, pressedKeys: [] });
  expect(input.keyDown("KeyW")).toBe(false);
  expect(input.beginPointer(12)).toBe(false);
  input.setHidden(false);
  expect(input.snapshot.intent.magnitude).toBe(0);
  expect(input.snapshot.suspended).toBe(false);

  input.keyDown("KeyD");
  input.setSemanticSuspended(true);
  expect(input.snapshot.intent.magnitude).toBe(0);
  expect(input.snapshot.lastClearReason).toBe("semantic-suspend");
  input.setSemanticSuspended(false);
  expect(input.snapshot.intent.magnitude).toBe(0);

  input.keyDown("KeyS");
  input.reset();
  expect(input.snapshot).toEqual({
    intent: { lateral: 0, forward: 0, magnitude: 0, source: "none" },
    pressedKeys: [],
    pointerId: null,
    suspended: false,
    lastClearReason: "reset",
  });
});


test("W1 camera maps normalized movement intent relative to yaw", () => {
  const forwardAtZero = cameraRelativeMovement({ lateral: 0, forward: 1 }, 0);
  expect(forwardAtZero).toEqual({ space: WORLD_SPACE, kind: "vector", x: 0, y: 0, z: -1 });

  const forwardAtQuarterTurn = cameraRelativeMovement({ lateral: 0, forward: 1 }, Math.PI / 2);
  expect(forwardAtQuarterTurn.x).toBeCloseTo(-1, 12);
  expect(forwardAtQuarterTurn.z).toBeCloseTo(0, 12);

  const diagonal = cameraRelativeMovement({ lateral: 1, forward: 1 }, Math.PI / 4);
  expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1, 12);
  expect(diagonal.y).toBe(0);
});

test("W1 camera resolves above and behind focus then shortens before nearest surrogate obstruction", () => {
  const focus = worldPoint(0, 1, 0);
  const config = {
    yawRadians: 0,
    pitchRadians: Math.PI / 6,
    minPitchRadians: 0,
    maxPitchRadians: Math.PI / 3,
    desiredDistance: 6,
    minDistance: 1,
    obstructionClearance: 0.2,
  };
  const wall = cameraObstacle("wall", worldPoint(-1, 1, 2.4), worldPoint(1, 5, 3));
  const farColumn = cameraObstacle("far-column", worldPoint(-0.5, 2, 4.2), worldPoint(0.5, 6, 4.6));

  const blocked = resolveThirdPersonCamera(focus, config, [farColumn, wall]);
  expect(blocked.occluded).toBe(true);
  expect(blocked.obstructionId).toBe("wall");
  expect(blocked.resolvedDistance).toBeLessThan(blocked.desiredDistance);
  expect(blocked.position.y).toBeGreaterThan(focus.y);
  expect(blocked.position.z).toBeLessThan(wall.min.z);

  const clear = resolveThirdPersonCamera(focus, config, []);
  expect(clear).toMatchObject({ occluded: false, obstructionId: null, resolvedDistance: 6 });
  expect(clear.position.y).toBeGreaterThan(focus.y);
  expect(clear.position.z).toBeGreaterThan(blocked.position.z);
});

test("W1 camera obstruction ordering is deterministic and pitch is clamped", () => {
  const focus = worldPoint(0, 0, 0);
  const config = {
    yawRadians: 0,
    pitchRadians: Math.PI,
    minPitchRadians: 0.1,
    maxPitchRadians: 0.5,
    desiredDistance: 8,
    minDistance: 1,
    obstructionClearance: 0.1,
  };
  const a = cameraObstacle("a", worldPoint(-1, 0, 2), worldPoint(1, 6, 2.5));
  const b = cameraObstacle("b", worldPoint(-1, 0, 2), worldPoint(1, 6, 2.5));

  const first = resolveThirdPersonCamera(focus, config, [b, a]);
  const second = resolveThirdPersonCamera(focus, config, [a, b]);
  expect(first.obstructionId).toBe("a");
  expect(second.obstructionId).toBe("a");
  expect(first.position).toEqual(second.position);
  expect(first.pitchRadians).toBe(0.5);
});


test("W1 Rapier spike executes in the browser, owns the fixture, and drains explicitly", async ({ page }) => {
  await openRunningLab(page);
  const result = await page.evaluate(() => window.__TRANSCEND_LAB__!.runRapierSpike());
  expect(result).toMatchObject({
    status: "ready",
    colliderCount: 5,
    liveWorld: true,
    liveController: true,
  });
  if (result.status !== "ready") throw new Error("Rapier spike did not become ready");
  expect(result.runtimeVersion).toBe("0.20.0");
  expect(result.wall.x).toBeGreaterThanOrEqual(0);
  expect(result.wall.x).toBeLessThan(2);
  for (const movement of [result.wall, result.step, result.slope, result.groundedProbe]) {
    expect([movement.x, movement.y, movement.z].every(Number.isFinite)).toBe(true);
  }

  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stopRapierSpike());
  expect(stopped).toMatchObject({ liveWorld: false, liveController: false });
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.rapierSpikeState()))).toEqual(stopped);
});

test("W1 Rapier spike generation fence prevents stale async import revival and repeated teardown leaks", async ({ page }) => {
  await openRunningLab(page);
  const stale = await page.evaluate(async () => {
    const api = window.__TRANSCEND_LAB__!;
    const pending = api.runRapierSpike();
    api.stopRapierSpike();
    return pending;
  });
  expect(stale).toMatchObject({ status: "stale", liveWorld: false, liveController: false });
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.rapierSpikeState()))).toMatchObject({
    liveWorld: false,
    liveController: false,
  });

  for (let index = 0; index < 3; index += 1) {
    const ready = await page.evaluate(() => window.__TRANSCEND_LAB__!.runRapierSpike());
    expect(ready.status).toBe("ready");
    const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stopRapierSpike());
    expect(stopped).toMatchObject({ liveWorld: false, liveController: false });
  }

  await page.evaluate(() => window.__TRANSCEND_LAB__!.runRapierSpike());
  await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.rapierSpikeState()))).toMatchObject({
    liveWorld: false,
    liveController: false,
  });
});

test("W1 input composes hidden and semantic blockers and preserves them through reset", () => {
  for (const reverse of [false, true]) {
    const input = new WorldMovementIntentController();
    input.keyDown("KeyW");
    input.setHidden(true);
    input.setSemanticSuspended(true);
    if (reverse) input.setSemanticSuspended(false);
    else input.setHidden(false);
    expect(input.snapshot.suspended).toBe(true);
    input.reset();
    expect(input.snapshot.suspended).toBe(true);
    expect(input.keyDown("KeyW")).toBe(false);
    if (reverse) input.setHidden(false);
    else input.setSemanticSuspended(false);
    expect(input.snapshot.intent.magnitude).toBe(0);
    expect(input.snapshot.suspended).toBe(false);
  }
});

test("W1 input aliases cannot overweight opposites and invalid pointer movement fails closed", () => {
  const input = new WorldMovementIntentController();
  for (const key of ["KeyW", "ArrowUp", "KeyS"]) input.keyDown(key);
  expect(input.snapshot.intent.magnitude).toBe(0);
  expect(input.keyDown("toString")).toBe(false);
  expect(input.keyDown("__proto__")).toBe(false);
  input.beginPointer(3);
  input.updatePointer(3, 0.5, 0.5);
  expect(input.updatePointer(3, Number.NaN, 1)).toBe(false);
  expect(input.snapshot.intent.magnitude).toBe(0);
  expect(input.snapshot.pointerId).toBeNull();
});

test("W1 camera shape cast catches near-edge Rapier obstruction and restores clear boom", async ({ page }) => {
  await openRunningLab(page);
  const result = await page.evaluate(async () => {
    const physics = window.__TRANSCEND_LAB__!.kinematic;
    const config = {
      yawRadians: 0,
      pitchRadians: 0.15,
      minPitchRadians: -0.2,
      maxPitchRadians: 0.6,
      desiredDistance: 4,
      minDistance: 0.8,
      obstructionClearance: 0.05,
    };
    await physics.start("camera-obstruction");
    const blocked = physics.camera(config, 0.25);
    let rejectedRadius = false;
    try { physics.camera(config, 0); } catch { rejectedRadius = true; }
    const afterRejectedRadius = physics.state();
    await physics.start("flat");
    const clear = physics.camera(config, 0.25);
    physics.stop();
    return { blocked, clear, rejectedRadius, afterRejectedRadius, stopped: physics.state() };
  });

  expect(result.blocked).not.toBeNull();
  expect(result.blocked).toMatchObject({ occluded: true, desiredDistance: 4 });
  expect(result.blocked!.obstructionId).toMatch(/^rapier:/);
  expect(result.blocked!.resolvedDistance).toBeGreaterThanOrEqual(0.8);
  expect(result.blocked!.resolvedDistance).toBeLessThan(4);
  expect(result.clear).toMatchObject({ occluded: false, obstructionId: null, resolvedDistance: 4 });
  expect(result.clear!.position.z).toBeGreaterThan(result.blocked!.position.z);
  expect(result.rejectedRadius).toBe(true);
  expect(result.afterRejectedRadius.lifecycle).toBe("running");
  expect(result.stopped.resources).toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
});

test("W1 desktop playable moves the verified bear and preserves exclusive renderer ownership", async ({ page, request }) => {
  const pinnedBytes = await fetchExactPinnedBytes(request);
  const requests: string[] = [];
  page.on("request", (browserRequest) => requests.push(browserRequest.url()));
  await page.route(PINNED_ACTIVE_ASSET.url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "model/gltf-binary",
      body: pinnedBytes,
    });
  });

  await openRunningLab(page);
  await page.getByTestId("start-world-playable").click();

  const stage = page.getByTestId("world-playable-stage");
  const canvas = page.getByTestId("world-playable-canvas");
  await expect(stage).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  await expect(canvas).toBeFocused();
  await expect(stage).toHaveAttribute("data-playable-clip", "idle");
  await expect(stage).toHaveAttribute("data-camera-occluded", "false");
  // Safe spawn does not remove the near-edge collision fixture: aim at it explicitly.
  await page.evaluate(() => {
    const api = window.__TRANSCEND_LAB__!;
    api.playableCameraNudge(-api.playableDiagnostics()!.yawRadians);
  });
  await expect(stage).toHaveAttribute("data-camera-occluded", "true");
  await page.evaluate(() => window.__TRANSCEND_LAB__!.playableCameraReset());
  await expect(stage).toHaveAttribute("data-camera-occluded", "false");

  const started = await page.evaluate(() => ({
    state: window.__TRANSCEND_LAB__!.state(),
    physics: window.__TRANSCEND_LAB__!.kinematic.state(),
    playable: window.__TRANSCEND_LAB__!.playableDiagnostics(),
  }));
  expect(started.state.playable).toBe(true);
  expect(started.state.assetResult).toMatchObject({
    status: "loaded",
    assetId: PINNED_ACTIVE_ASSET.assetId,
    authority: "review-catalog",
    clipName: "move",
    sha256: PINNED_ACTIVE_ASSET.sha256,
  });
  expect(started.physics.lifecycle).toBe("running");
  expect(started.playable).toMatchObject({ mounted: true, clip: "idle", cameraOccluded: false });
  const startZ = started.physics.position!.z;

  await page.keyboard.down("w");
  await expect(stage).toHaveAttribute("data-playable-clip", "move");
  await expect.poll(async () => (
    await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().position!.z)
  )).toBeLessThan(startZ - 0.1);
  await page.keyboard.up("w");
  await expect(stage).toHaveAttribute("data-playable-clip", "idle");

  const yawBefore = (await page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()))!.yawRadians;
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + canvasBox!.width / 2 + 80, canvasBox!.y + canvasBox!.height / 2);
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics());
  expect(afterDrag!.yawRadians).toBeLessThan(yawBefore);

  await page.getByTestId("world-camera-toggle").click();
  await page.getByRole("button", { name: "Camera right" }).click();
  const cameraAfter = await page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics());
  expect(cameraAfter!.yawRadians).toBeLessThan(afterDrag!.yawRadians);
  expect(cameraAfter!.cameraOccluded).toBe(false);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().input.pressedKeys))).toEqual([]);

  expect(requests.filter((url) => url.endsWith(".glb"))).toEqual([PINNED_ACTIVE_ASSET.url]);
  expect(requests.some((url) => /\/api\/|supabase|model-v2|auth/i.test(url))).toBe(false);

  await page.getByTestId("exit-world-playable").click();
  await expect(stage).toHaveCount(0);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(1);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).playable).toBe(false);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state())).resources)
    .toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });

  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});

test("W1 desktop playable cancellation and overlapping starts retain only the latest owner", async ({ page, request }) => {
  const pinnedBytes = await fetchExactPinnedBytes(request);
  await page.route(PINNED_ACTIVE_ASSET.url, (route) => route.fulfill({
    status: 200, contentType: "model/gltf-binary", body: pinnedBytes,
  }));
  await openRunningLab(page);
  for (const action of ["stop", "reset"] as const) {
    const result = await page.evaluate(async (method) => {
      const api = window.__TRANSCEND_LAB__!;
      const pending = api.startPlayable();
      const drained = await api[method]();
      const admission = await pending;
      return { drained, admission, state: api.state(), physics: api.kinematic.state() };
    }, action);
    expect(result.admission.status).toBe("cancelled");
    expect(result.state).toMatchObject({ playable: false, lifecycle: "stopped", assetLoading: false });
    expect(result.drained).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
    expect(result.physics.resources).toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
    await expect(page.getByTestId("world-playable-stage")).toHaveCount(0);
  }
  const overlap = await page.evaluate(async () => {
    const api = window.__TRANSCEND_LAB__!;
    const admissions = await Promise.all([api.startPlayable(), api.startPlayable()]);
    return { admissions, state: api.state(), physics: api.kinematic.state() };
  });
  expect(overlap.admissions.map((entry) => entry.status)).toEqual(["cancelled", "loaded"]);
  expect(overlap.state).toMatchObject({ playable: true, lifecycle: "running", assetLoading: false });
  expect(overlap.physics.resources.worlds).toBe(1);
  await expect(page.getByTestId("world-playable-stage")).toHaveCount(1);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});

test("W1 desktop playable context loss releases the world and keeps retry controls usable", async ({ page, request }) => {
  const pinnedBytes = await fetchExactPinnedBytes(request);
  await page.route(PINNED_ACTIVE_ASSET.url, (route) => route.fulfill({
    status: 200, contentType: "model/gltf-binary", body: pinnedBytes,
  }));
  await openRunningLab(page);
  await page.getByTestId("start-world-playable").click();
  await expect.poll(() => page.evaluate(() => window.__TRANSCEND_LAB__!.state().playable)).toBe(true);
  const lost = await page.getByTestId("world-playable-canvas").evaluate((element) => {
    const extension = (element as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  expect(lost).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__TRANSCEND_LAB__!.state().lifecycle)).toBe("error");
  await expect(page.getByTestId("world-playable-stage")).toHaveCount(0);
  await expect(page.getByTestId("start-world-playable")).toBeVisible();
  await expect(page.getByTestId("start-world-playable")).toBeEnabled();
  const state = await page.evaluate(() => ({
    lab: window.__TRANSCEND_LAB__!.state(), physics: window.__TRANSCEND_LAB__!.kinematic.state(),
  }));
  expect(state.lab).toMatchObject({ playable: false, assetLoading: false });
  expect(state.lab.error).toContain("context lost");
  expect(state.physics.resources).toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
  await page.getByTestId("start-world-playable").click();
  await expect.poll(() => page.evaluate(() => window.__TRANSCEND_LAB__!.state().playable)).toBe(true);
  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});

async function openTouchPlayable(browser: Browser, request: APIRequestContext, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const bytes = await fetchExactPinnedBytes(request);
  await page.route(PINNED_ACTIVE_ASSET.url, route => route.fulfill({ status: 200, contentType: "model/gltf-binary", body: bytes }));
  await openRunningLab(page);
  await page.getByTestId("start-world-playable").click();
  await expect(page.getByTestId("world-playable-stage")).toHaveAttribute("data-playable-clip", "idle");
  const move = page.getByTestId("world-touch-move");
  const look = page.getByTestId("world-touch-look");
  await expect(move).toBeVisible();
  await expect(look).toBeVisible();
  const m = (await move.boundingBox())!;
  const l = (await look.boundingBox())!;
  const first = { x: m.x + m.width / 2, y: m.y + m.height / 2, id: 11 };
  const second = { x: l.x + l.width / 2, y: l.y + l.height / 2, id: 22 };
  const cdp = await context.newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel", touchPoints: typeof first[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  return { context, page, move, look, first, second, send };
}

test("W1 touch pads keep move and look owners independent with browser multi-touch dispatch", async ({ browser, request, baseURL }) => {
  const h = await openTouchPlayable(browser, request, baseURL);
  try {
    const { page, move, look, first, second, send } = h;
    const start = await page.evaluate(() => ({ z: window.__TRANSCEND_LAB__!.kinematic.state().position!.z,
      yaw: window.__TRANSCEND_LAB__!.playableDiagnostics()!.yawRadians }));
    await send("touchStart", [first]);
    await send("touchStart", [first, second]);
    await expect(move).toHaveAttribute("data-pointer-id", /[0-9]+/);
    await expect(look).toHaveAttribute("data-pointer-id", /[0-9]+/);
    const moving = { ...first, y: first.y - 32 };
    await send("touchMove", [moving, { ...second, x: second.x + 22 }]);
    await expect.poll(() => page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().position!.z)).toBeLessThan(start.z - 0.05);
    const active = await page.evaluate(() => ({ input: window.__TRANSCEND_LAB__!.kinematic.state().input,
      yaw: window.__TRANSCEND_LAB__!.playableDiagnostics()!.yawRadians }));
    expect(active.input.intent.source).toBe("pointer");
    expect(active.input.intent.magnitude).toBeGreaterThan(0);
    expect(active.input.intent.magnitude).toBeLessThanOrEqual(1);
    expect(active.yaw).toBeLessThan(start.yaw);
    await send("touchEnd", [{ ...second, x: second.x + 22 }]); // End the right contact only.
    await expect(look).not.toHaveAttribute("data-pointer-id", /.+/);
    expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().input)).intent.magnitude).toBeGreaterThan(0);
    await send("touchEnd", []);
    await expect(move).not.toHaveAttribute("data-pointer-id", /.+/);
    expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().input)).intent.magnitude).toBe(0);
    const native = await page.getByTestId("world-playable-canvas").evaluate(el => ({ canvas: getComputedStyle(el).touchAction,
      body: getComputedStyle(document.body).touchAction, move: getComputedStyle(document.querySelector('[data-testid="world-touch-move"]')!).touchAction }));
    expect(native).toEqual({ canvas: "auto", body: "auto", move: "none" });
  } finally { await h.context.close(); }
});

test("W1 touch cancellation focus and viewport changes never retain stale contacts", async ({ browser, request, baseURL }) => {
  const h = await openTouchPlayable(browser, request, baseURL);
  try {
    const { page, move, look, first, second, send } = h;
    await page.getByTestId("world-camera-toggle").click();
    for (const reason of ["cancel", "lostcapture", "blur", "focus", "visibility", "resize"] as const) {
      await send("touchStart", [first, second]);
      await send("touchMove", [{ ...first, y: first.y - 24 }, { ...second, x: second.x + 12 }]);
      await expect(move).toHaveAttribute("data-pointer-id", /[0-9]+/);
      if (reason === "cancel") await send("touchCancel", []);
      else if (reason === "lostcapture") {
        await move.evaluate(el => el.releasePointerCapture(Number((el as HTMLElement).dataset.pointerId)));
        // Pending capture release is processed on the next pointer event.
        await send("touchMove", [{ ...first, y: first.y - 25 }, { ...second, x: second.x + 13 }]);
      }
      else if (reason === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      else if (reason === "focus") await page.getByRole("button", { name: "Camera left" }).focus();
      else if (reason === "visibility") await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      else await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      await expect(move).not.toHaveAttribute("data-pointer-id", /.+/);
      await expect(look).not.toHaveAttribute("data-pointer-id", /.+/);
      expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().input)).intent.magnitude).toBe(0);
      if (reason === "visibility") await page.evaluate(() => {
        delete (document as unknown as { hidden?: boolean }).hidden;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      if (reason !== "cancel") {
        await send("touchMove", [{ ...first, y: first.y - 35 }, { ...second, x: second.x + 30 }]);
        expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().input)).intent.magnitude).toBe(0);
        await send("touchEnd", []);
      }
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(move).toBeVisible();
    await expect(look).toBeVisible();
    const boxes = [(await move.boundingBox())!, (await look.boundingBox())!];
    expect(boxes.every(b => b.x >= 0 && b.y >= 0 && b.x + b.width <= 844 && b.y + b.height <= 390)).toBe(true);
    const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
    expect(stopped).toMatchObject({ listeners: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
    await expect(page.getByTestId("world-touch-controls")).toHaveCount(0);
  } finally { await h.context.close(); }
});

test("W1 touch pads ignore a third contact and drain active touches on stop", async ({ browser, request, baseURL }) => {
  const h = await openTouchPlayable(browser, request, baseURL);
  try {
    const { page, move, look, first, second, send } = h;
    await send("touchStart", [second]); // Look may start before movement.
    await send("touchStart", [first, second]);
    const owners = [await move.getAttribute("data-pointer-id"), await look.getAttribute("data-pointer-id")];
    const third = { ...first, x: first.x + 10, id: 33 };
    await send("touchStart", [first, second, third]);
    await send("touchMove", [{ ...first, y: first.y - 22 }, second, { ...third, y: third.y + 30 }]);
    expect([await move.getAttribute("data-pointer-id"), await look.getAttribute("data-pointer-id")]).toEqual(owners);
    await send("touchEnd", [{ ...first, y: first.y - 22 }]); // End only the movement contact.
    await expect(move).not.toHaveAttribute("data-pointer-id", /.+/);
    expect(await look.getAttribute("data-pointer-id")).toBe(owners[1]);
    const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
    expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
    await send("touchEnd", []);
    expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state())).resources)
      .toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
    await expect(page.getByTestId("world-touch-controls")).toHaveCount(0);
  } finally { await h.context.close(); }
});

test("W1 physics fixture matrix distinguishes walls steps slopes and stable ground", async ({ page }, testInfo) => {
  await openRunningLab(page);
  const results = await page.evaluate(async () => {
    const physics = window.__TRANSCEND_LAB__!.kinematic;
    const results = [];
    for (const fixture of ["flat", "wall", "step-allowed", "step-blocked", "slope-allowed", "slope-blocked"] as const) {
      await physics.start(fixture);
      physics.sample(0);
      for (let i = 1; i <= 30; i++) physics.sample(i * 1000 / 60);
      const settled = physics.state();
      let maxY = settled.position!.y;
      let minY = settled.position!.y;
      let maxX = settled.position!.x;
      physics.key("KeyD", true);
      for (let i = 1; i <= 180; i++) {
        physics.sample(500 + i * 1000 / 60);
        const point = physics.state().position!;
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
        minY = Math.min(minY, point.y);
      }
      physics.key("KeyD", false);
      const end = physics.state();
      results.push({ fixture, settled: settled.position, groundedAtStart: settled.grounded,
        end: end.position, maxX, minY, maxY, fixedSteps: end.clock.stepCount,
        runtimeVersion: end.runtimeVersion, resources: end.resources });
      physics.stop();
    }
    return results;
  });
  await testInfo.attach("kinematic-fixture-results.json", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  console.log("W1 kinematic fixture evidence", JSON.stringify(results));
  for (const result of results) {
    expect(result.runtimeVersion).toBe("0.20.0");
    expect(result.groundedAtStart).toBe(true);
    expect(result.fixedSteps).toBe(210);
    expect(result.resources).toMatchObject({ worlds: 1, controllers: 1, bodies: 1, pendingLoads: 0 });
    expect(result.minY).toBeGreaterThanOrEqual(0.74);
  }
  const find = (fixture: string) => results.find(result => result.fixture === fixture)!;
  expect(find("flat").end!.x).toBeCloseTo(6, 3);
  expect(find("wall").maxX).toBeLessThanOrEqual(1.5 - 0.25 + 0.002);
  expect(find("step-allowed").end!.x).toBeGreaterThan(3.5);
  expect(find("step-allowed").maxY).toBeGreaterThan(0.9);
  expect(find("step-blocked").maxX).toBeLessThan(1.5);
  expect(find("slope-allowed").end!.x).toBeGreaterThan(4.5);
  expect(find("slope-allowed").maxY).toBeGreaterThan(1.7);
  expect(find("slope-blocked").maxX).toBeLessThan(2);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state())).resources)
    .toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
});

test("W1 physics movement is fixed-step deterministic across 60 and 120 Hz and reset replay", async ({ page }) => {
  await openRunningLab(page);
  const evidence = await page.evaluate(async () => {
    const physics = window.__TRANSCEND_LAB__!.kinematic;
    const run = (hz: number) => {
      physics.sample(0);
      physics.key("KeyD", true);
      for (let i = 1; i <= hz * 2; i++) physics.sample(i * 1000 / hz);
      const s = physics.state();
      return { position: s.position, previousPosition: s.previousPosition, clock: s.clock, grounded: s.grounded };
    };
    await physics.start("flat");
    const at60 = run(60);
    await physics.reset();
    const at120 = run(120);
    await physics.reset();
    const replay = run(60);
    physics.stop();
    return { at60, at120, replay };
  });
  expect(evidence.at60).toEqual(evidence.at120);
  expect(evidence.replay).toEqual(evidence.at60);
  expect(evidence.at60.clock.stepCount).toBe(120);
  expect(evidence.at60.position!.x).toBeCloseTo(4, 3);
});

test("W1 physics hidden panel blur and pointer loss never replay stale movement", async ({ page }) => {
  await openRunningLab(page);
  const result = await page.evaluate(async () => {
    const p = window.__TRANSCEND_LAB__!.kinematic;
    await p.start(); p.sample(0); p.key("KeyD", true);
    for (let i = 1; i <= 60; i++) p.sample(i * 1000 / 60);
    const before = p.state();
    p.setHidden(true); p.setSemanticSuspended(true); p.sample(10000);
    p.setHidden(false);
    const refused = p.key("KeyD", true); p.sample(11000);
    const stillBlocked = p.state();
    p.setSemanticSuspended(false); p.sample(12000); p.sample(12017);
    const resumed = p.state();
    p.beginPointer(7); p.updatePointer(7, 1, 0); p.cancelPointer(7); p.sample(12034);
    p.beginPointer(8); p.updatePointer(8, 1, 0); p.lostPointerCapture(8); p.sample(12051);
    p.key("KeyD", true); p.blur(); p.sample(22000); p.sample(22017);
    const after = p.state(); p.stop();
    return { before, refused, stillBlocked, resumed, after };
  });
  expect(result.refused).toBe(false);
  expect(result.stillBlocked.input.suspended).toBe(true);
  expect(result.stillBlocked.clock.stepCount).toBe(result.before.clock.stepCount);
  for (const state of [result.resumed, result.after]) {
    expect(state.position!.x).toBe(result.before.position!.x);
    expect(state.input.intent.magnitude).toBe(0);
  }
  expect(result.resumed.clock.stepCount).toBe(result.before.clock.stepCount + 1);
});

test("W1 physics stale starts stop reset and spike replacement drain owned allocations", async ({ page }) => {
  await openRunningLab(page);
  const result = await page.evaluate(async () => {
    const api = window.__TRANSCEND_LAB__!;
    const p = api.kinematic;
    const pending = p.start("wall"); p.stop();
    const stale = await pending;
    const drained = p.state();
    const cycles = [];
    for (let i = 0; i < 5; i++) {
      await p.start("wall"); p.sample(0); p.key("KeyD", true); p.sample(20);
      await p.reset(); cycles.push(p.state()); p.stop();
    }
    await p.start(); await api.runRapierSpike();
    const afterSpike = p.state();
    await p.reset(); const spikeAfterReset = api.rapierSpikeState();
    await api.reset(); const afterLabReset = p.state();
    return { stale, drained, cycles, afterSpike, spikeAfterReset, afterLabReset };
  });
  expect(result.stale).toBe(false);
  for (const state of [result.drained, result.afterSpike, result.afterLabReset]) {
    expect(state.lifecycle).toBe("stopped");
    expect(state.resources).toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
  }
  for (const state of result.cycles) {
    expect(state.resources).toMatchObject({ worlds: 1, controllers: 1, bodies: 1, pendingLoads: 0 });
    expect(state.clock.stepCount).toBe(0);
    expect(state.input.intent.magnitude).toBe(0);
  }
  expect(result.spikeAfterReset).toMatchObject({ liveWorld: false, liveController: false });
});

test("W1 physics out-of-bounds recovery clears movement and oversized frames are bounded", async ({ page }) => {
  await openRunningLab(page);
  const result = await page.evaluate(async () => {
    const p = window.__TRANSCEND_LAB__!.kinematic;
    await p.start("recovery"); p.sample(0); p.key("KeyD", true); p.sample(17);
    const recovered = p.state();
    p.key("KeyD", true); p.sample(1e12);
    const stalled = p.state(); p.sample(1e12 + 17);
    const after = p.state(); p.stop();
    return { recovered, stalled, after };
  });
  expect(result.recovered.recoveries).toBe(1);
  expect(result.recovered.position).toMatchObject({ space: "world-metres", x: 0, y: 0.8, z: 0 });
  expect(result.recovered.input.intent.magnitude).toBe(0);
  expect(result.stalled.discardedIntervals).toBe(1);
  expect(result.stalled.clock.stepCount).toBe(result.recovered.clock.stepCount);
  expect(result.after.clock.stepCount).toBe(result.recovered.clock.stepCount + 1);
  expect(result.after.position!.x).toBe(0);
});

test("W1 physics partial construction and rejected initialization release resources", async () => {
  let worldsFreed = 0;
  let controllersRemoved = 0;
  class Descriptor {
    setTranslation() { return this; }
    static capsule() { return new Descriptor(); }
    static kinematicPositionBased() { return new Descriptor(); }
  }
  class AllocatedWorld {
    createCollider() { return {}; }
    createRigidBody() { return {}; }
    createCharacterController() { return { setUp() { throw new Error("synthetic setup failure"); } }; }
    removeCharacterController() { controllersRemoved += 1; }
    free() { worldsFreed += 1; }
  }
  const synthetic = {
    World: AllocatedWorld, ColliderDesc: Descriptor, RigidBodyDesc: Descriptor, HalfSpace: class {},
  } as unknown as RapierModule;
  const world = new KinematicWorld(async () => synthetic);
  await expect(world.start()).rejects.toThrow("synthetic setup failure");
  expect(world.snapshot.lifecycle).toBe("error");
  expect(world.snapshot.resources).toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
  expect(worldsFreed).toBe(1);
  expect(controllersRemoved).toBe(1);
  world.stop(); world.stop();
  expect(worldsFreed).toBe(1);
  const rejected = new KinematicWorld(async () => { throw new Error("synthetic loader failure"); });
  await expect(rejected.start()).rejects.toThrow("synthetic loader failure");
  expect(rejected.snapshot.resources).toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
});

test("W1 physics consumes normalized camera-relative input and rejects invalid time without mutation", async ({ page }) => {
  await openRunningLab(page);
  const result = await page.evaluate(async () => {
    const p = window.__TRANSCEND_LAB__!.kinematic;
    await p.start(); p.setYaw(Math.PI / 2); p.sample(0); p.key("KeyW", true); p.key("KeyD", true);
    for (let i = 1; i <= 120; i++) p.sample(i * 1000 / 60);
    const before = p.state();
    const failures = [];
    for (const badTime of [Number.NaN, Number.POSITIVE_INFINITY, 1999]) {
      try { p.sample(badTime); failures.push(false); } catch { failures.push(true); }
    }
    const after = p.state(); p.stop();
    return { before, after, failures };
  });
  expect(result.failures).toEqual([true, true, true]);
  expect(result.after).toEqual(result.before);
  const point = result.before.position!;
  expect(point.x).toBeLessThan(0);
  expect(point.z).toBeLessThan(0);
  expect(Math.hypot(point.x, point.z)).toBeCloseTo(4, 3);
});

test("isolated synthetic routing retains one actor, one writer, one backend, and no product state", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await openRunningLab(page);
  const initialUrl = page.url();
  const initialHistoryLength = await page.evaluate(() => history.length);

  const initial = await page.evaluate(() => ({
    state: window.__TRANSCEND_LAB__!.state(),
    world: window.__TRANSCEND_LAB__!.worldState(),
    diagnostics: window.__TRANSCEND_LAB__!.diagnostics(),
  }));
  expect(initial.state.pose?.anchorId).toBe("sunrise");
  expect(initial.state.snapshot?.anchors).toHaveLength(2);
  expect(initial.state.snapshot?.anchors.every((anchor) => anchor.arenaRevision === initial.state.snapshot?.revision)).toBe(true);
  expect(initial.world.lease).toBeNull();
  expect(initial.diagnostics).toMatchObject({ timers: 0, pendingLoads: 0, liveWebglContexts: 1 });
  expect(initial.diagnostics.listeners).toBeLessThanOrEqual(8);
  expect(initial.diagnostics.rafLoops).toBe(1);

  await page.evaluate(() => window.__TRANSCEND_LAB__!.toggleRoutes(100));
  const stressed = await page.evaluate(() => ({
    state: window.__TRANSCEND_LAB__!.state(),
    world: window.__TRANSCEND_LAB__!.worldState(),
    diagnostics: window.__TRANSCEND_LAB__!.diagnostics(),
  }));
  expect(stressed.state.routeToggleCount).toBe(100);
  expect(stressed.state.actorId).toBe("transcend-companion-actor-1");
  expect(stressed.state.pose?.arenaRevision).toBe(stressed.state.snapshot?.revision);
  expect(stressed.state.pose?.routeEpoch).toBe(stressed.state.routeEpoch);
  expect(stressed.state.transitionTrace).toEqual([
    "revoke-world-root",
    "advance-route-epoch",
    "retire-arena-snapshot",
    "measure-route-providers",
    "publish-arena-snapshot",
    "resolve-placement-intent",
    "apply-placement",
  ]);
  expect(stressed.world.lease).toBeNull();
  expect(stressed.diagnostics.liveWebglContexts).toBe(1);
  expect(stressed.diagnostics.rafLoops).toBe(1);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(1);
  await expect(page.getByTestId("logical-actor")).toHaveCount(1);

  const persistence = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    indexed: typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map((database) => database.name)
      : [],
    cookie: document.cookie,
    historyLength: history.length,
  }));
  expect(persistence).toEqual({
    local: [],
    session: [],
    indexed: [],
    cookie: "",
    historyLength: initialHistoryLength,
  });
  expect(page.url()).toBe(initialUrl);
  expect(await context.cookies()).toEqual([]);
  expect(requests.some((url) => /\/api\/|supabase|model-v2|auth|\.glb(?:\?|$)/i.test(url))).toBe(false);
});

test("body drag preserves grab offset, commits free intent, suppresses drag-click, and fences cancellation", async ({ page }) => {
  await openRunningLab(page);

  const body = page.getByTestId("actor-hit-envelope");
  const bodyBox = await body.boundingBox();
  expect(bodyBox).not.toBeNull();
  const startPose = (await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose!;
  const grabX = bodyBox!.x + bodyBox!.width * 0.72;
  const grabY = bodyBox!.y + bodyBox!.height * 0.28;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.point).toEqual(startPose.point);
  await page.mouse.move(grabX + 32, grabY + 24, { steps: 4 });
  const duringDrag = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(duringDrag.pointerDragging).toBe(true);
  expect(duringDrag.pose?.point.x).toBeCloseTo(startPose.point.x + 32, 4);
  expect(duringDrag.pose?.point.y).toBeCloseTo(startPose.point.y + 24, 4);
  await page.mouse.up();
  const dropped = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(dropped.intent.kind).toBe("free");
  expect(dropped.pose).toMatchObject({ anchorId: null, source: "free" });
  await expect(page.getByTestId("lab-status")).toContainText("Free placement committed");

  const afterDrag = await body.boundingBox();
  await page.mouse.move(afterDrag!.x + afterDrag!.width / 2, afterDrag!.y + afterDrag!.height / 2);
  await page.mouse.down();
  await page.mouse.move(afterDrag!.x - 80, afterDrag!.y - 40);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("escape");
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent).toEqual(dropped.intent);

  const cancelBox = await body.boundingBox();
  await page.mouse.move(cancelBox!.x + cancelBox!.width / 2, cancelBox!.y + cancelBox!.height / 2);
  await page.mouse.down();
  const cancelPointerId = await body.getAttribute("data-active-pointer-id");
  expect(cancelPointerId).not.toBeNull();
  await body.dispatchEvent("pointercancel", {
    pointerId: Number(cancelPointerId),
    pointerType: "mouse",
    clientX: cancelBox!.x,
    clientY: cancelBox!.y,
  });
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("pointer-cancel");

  const lostBox = await body.boundingBox();
  await page.mouse.move(lostBox!.x + lostBox!.width / 2, lostBox!.y + lostBox!.height / 2);
  await page.mouse.down();
  const lostPointerId = await body.getAttribute("data-active-pointer-id");
  expect(lostPointerId).not.toBeNull();
  await body.dispatchEvent("lostpointercapture", {
    pointerId: Number(lostPointerId),
    pointerType: "mouse",
  });
  await page.mouse.up();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("lost-pointer-capture");

  await body.click();
  await expect(page.getByTestId("lab-status")).toContainText("Tactile hit admitted");
});

test("synthetic touch and pen pointers use the same body-local free-placement path", async ({ page }) => {
  await openRunningLab(page);
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });

  let box = await page.getByTestId("actor-hit-envelope").boundingBox();
  expect(box).not.toBeNull();
  let x = box!.x + box!.width / 2;
  let y = box!.y + box!.height / 2;
  const beforeTouch = (await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose!.point;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 11, radiusX: 2, radiusY: 2, force: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 24, y: y + 18, id: 11, radiusX: 2, radiusY: 2, force: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const afterTouch = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterTouch.intent.kind).toBe("free");
  expect(afterTouch.pose).toMatchObject({ anchorId: null, source: "free" });
  expect(afterTouch.pose!.point.x).toBeGreaterThan(beforeTouch.x);

  box = await page.getByTestId("actor-hit-envelope").boundingBox();
  x = box!.x + box!.width / 2;
  y = box!.y + box!.height / 2;
  const beforePen = afterTouch.pose!.point;
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "pen",
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved", x: x - 20, y: y + 22, button: "none", buttons: 1, pointerType: "pen",
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: x - 20, y: y + 22, button: "left", buttons: 0, clickCount: 1, pointerType: "pen",
  });
  const afterPen = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterPen.intent.kind).toBe("free");
  expect(afterPen.pose).toMatchObject({ anchorId: null, source: "free" });
  expect(afterPen.pose!.point.x).toBeLessThan(beforePen.x);
});

test("free coordinate and keyboard alternatives reach non-anchor positions and carry normalized intent across routes", async ({ page }) => {
  await openRunningLab(page);
  const placements = [[15, 18], [82, 22], [24, 78]] as const;
  const observed = new Set<string>();
  for (const [x, y] of placements) {
    await page.getByTestId("free-position-x").fill(String(x));
    await page.getByTestId("free-position-y").fill(String(y));
    await page.getByTestId("apply-free-position").click();
    const state = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
    expect(state.intent).toEqual({ kind: "free", u: x / 100, v: y / 100 });
    expect(state.pose).toMatchObject({ anchorId: null, source: "free" });
    observed.add(`${state.pose!.point.x.toFixed(2)},${state.pose!.point.y.toFixed(2)}`);
  }
  expect(observed.size).toBe(3);

  const body = page.getByTestId("actor-hit-envelope");
  await body.focus();
  await expect(body).toBeFocused();
  const beforeNudge = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  await body.press("ArrowRight");
  const afterNudge = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterNudge.intent.kind).toBe("free");
  expect(afterNudge.pose!.point.x).toBeGreaterThan(beforeNudge.pose!.point.x);

  const carried = afterNudge.intent;
  await page.getByTestId("toggle-route").click();
  const afterRoute = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterRoute.intent).toEqual(carried);
  expect(afterRoute.pose).toMatchObject({ anchorId: null, source: "free" });

  await page.getByTestId("free-position-x").focus();
  const inputBefore = await page.getByTestId("free-position-x").inputValue();
  await page.getByTestId("free-position-x").press("ArrowUp");
  expect(Number(await page.getByTestId("free-position-x").inputValue())).toBe(Number(inputBefore) + 1);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent).toEqual(carried);
});

test("native scroll and wheel remain uncancelled outside the bounded companion body", async ({ page }) => {
  await openRunningLab(page);
  const touchActions = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("*")]
    .filter((element) => getComputedStyle(element).touchAction === "none")
    .map((element) => ({
      testId: element.dataset.testid ?? null,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })));
  expect(touchActions).toHaveLength(1);
  expect(touchActions[0].testId).toBe("actor-hit-envelope");
  expect(touchActions[0].width).toBe(136);
  expect(touchActions[0].height).toBe(152);
  expect(touchActions[0].width * touchActions[0].height).toBeLessThan(25_000);

  const uncancelled = await page.getByTestId("outside-interaction-surface").evaluate((element) => {
    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 120, ctrlKey: true });
    return element.dispatchEvent(wheel) && !wheel.defaultPrevented;
  });
  expect(uncancelled).toBe(true);
  const before = await page.evaluate(() => scrollY);
  const revisionBeforeScroll = await page.getByTestId("transcend-lab").getAttribute("data-arena-revision");
  await page.mouse.move(10, 10);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  await expect.poll(async () => Number(await page.getByTestId("transcend-lab").getAttribute("data-arena-revision")))
    .toBeGreaterThan(Number(revisionBeforeScroll));
  const afterScroll = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(afterScroll.pose?.arenaRevision).toBe(afterScroll.snapshot?.revision);
});

test("hard-zone geometry re-resolves through control fallback and restores a safe pose", async ({ page }) => {
  await openRunningLab(page);
  const initial = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(initial.snapshot?.hardZones.length).toBeGreaterThanOrEqual(3);
  const safe = await page.evaluate(() => {
    const state = window.__TRANSCEND_LAB__!.state();
    if (!state.pose || !state.snapshot) return false;
    const envelope = { x: state.pose.point.x - 68, y: state.pose.point.y - 120, width: 136, height: 152 };
    return state.snapshot.hardZones.every((zone) =>
      envelope.x + envelope.width <= zone.x
      || zone.x + zone.width <= envelope.x
      || envelope.y + envelope.height <= zone.y
      || zone.y + zone.height <= envelope.y);
  });
  expect(safe).toBe(true);
  await page.getByTestId("move-harbor").click();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent.kind).toBe("anchor");

  const checkbox = page.getByLabel("Expand hard zone (exercise no-fit fallback)");
  await checkbox.check();
  await expect(page.getByTestId("logical-actor")).toHaveCount(0);
  await expect(checkbox).toBeFocused();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).resolution).toEqual({
    kind: "control",
    controlId: "relocation-controls",
  });
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lastRevocation).toBe("arena-publication");
  await checkbox.uncheck();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByTestId("logical-actor")).toHaveCount(1);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).pose?.anchorId).not.toBeNull();
});

test("exact pinned bytes parse into the real GLB for both backends and A/B evidence stays identical", async ({ page, request }) => {
  const pinnedBytes = await fetchExactPinnedBytes(request);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route(PINNED_ACTIVE_ASSET.url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "model/gltf-binary",
      body: pinnedBytes,
    });
  });
  await openRunningLab(page);
  await page.getByTestId("load-asset").click();
  await expect(page.getByTestId("lab-status")).toContainText("Actual bytes verified and displayed");
  await expect(page.getByTestId("representation-mode")).toContainText("verified-glb · clip idle");
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveAttribute("data-representation", "verified-glb");
  const loaded = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(loaded.assetResult).toMatchObject({
    status: "loaded",
    responseBytes: PINNED_ACTIVE_ASSET.bytes,
    sha256: PINNED_ACTIVE_ASSET.sha256,
    verification: "actual-response-sha256",
    container: "self-contained-glb-v2",
  });
  expect(loaded.representation).toMatchObject({
    mode: "verified-glb",
    assetId: PINNED_ACTIVE_ASSET.assetId,
    sha256: PINNED_ACTIVE_ASSET.sha256,
    clipName: "idle",
  });
  expect(requests.filter((url) => url.endsWith(".glb"))).toEqual([PINNED_ACTIVE_ASSET.url]);
  expect(requests.some((url) => /\/api\/|supabase|model-v2|auth/i.test(url))).toBe(false);

  await page.getByTestId("run-comparison").click();
  await expect(page.getByTestId("evidence-count")).toHaveText("4 metric records", { timeout: 30_000 });
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "stopped");
  const evidence = await page.evaluate(() => window.__TRANSCEND_LAB__!.state().evidence);
  expect(evidence).toHaveLength(4);
  expect(new Set(evidence.map((record) => record.backend))).toEqual(new Set(["movable-patch", "shared-stage"]));
  for (const backend of ["movable-patch", "shared-stage"] as const) {
    expect(evidence.filter((record) => record.backend === backend).map((record) => record.condition)).toEqual(["cold", "warm"]);
  }
  expect(new Set(evidence.map((record) => record.scenarioId)).size).toBe(1);
  expect(new Set(evidence.map((record) => record.scenarioHash)).size).toBe(1);
  expect(new Set(evidence.map((record) => JSON.stringify(record.commonClock))).size).toBe(1);
  expect(new Set(evidence.map((record) => JSON.stringify(record.inputTrace))).size).toBe(1);
  expect(evidence.every((record) => record.schemaVersion === "transcend-lab-metrics.v2")).toBe(true);
  expect(evidence.every((record) => record.asset.assetId === PINNED_ACTIVE_ASSET.assetId)).toBe(true);
  expect(evidence.every((record) => record.frameSampleMeaning === "cpu-render-submission-ms")).toBe(true);
  expect(evidence.every((record) => record.representation.mode === "verified-glb")).toBe(true);
  expect(new Set(evidence.map((record) => record.representation.sha256))).toEqual(new Set([PINNED_ACTIVE_ASSET.sha256]));
  expect(new Set(evidence.map((record) => record.representation.clipName))).toEqual(new Set(["idle"]));
  expect(evidence.every((record) => record.contextCounts.afterTeardown === 0)).toBe(true);
  expect(evidence.every((record) => record.drawActivity.draws > 0)).toBe(true);
  expect(evidence.every((record) => !record.clippingHardZone.clipped)).toBe(true);
  expect(evidence.every((record) => !record.clippingHardZone.hardZoneOverlap)).toBe(true);
  expect(evidence.every((record) => record.routeContinuity.toggles === 2 && record.routeContinuity.retained)).toBe(true);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  expect(await noTaskResources(page)).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});

test("review catalog selects a catalog-only identity and required clip without changing product membership", async ({ page, request }) => {
  const reviewAsset = companionReviewCatalog.entries.find((entry) =>
    entry.speciesKey === "fox" && entry.variantKey === "standard",
  )!;
  expect(reviewAsset.reviewEligible).toBe(true);
  expect(getCompanionRuntimeMembership(reviewAsset.assetId).status).toBe("catalog-only");
  const exactBytes = await fetchExactReviewBytes(request, reviewAsset);
  const requests: string[] = [];
  page.on("request", (browserRequest) => requests.push(browserRequest.url()));
  await page.route(reviewAsset.url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "model/gltf-binary",
      body: exactBytes,
    });
  });

  await openRunningLab(page);
  await page.getByTestId("review-asset-select").selectOption(reviewAsset.assetId);
  await page.getByTestId("review-clip-select").selectOption("celebrate");
  await expect(page.getByTestId("review-asset-identity")).toContainText("fox");
  await expect(page.getByTestId("review-asset-identity")).toContainText("standard");
  await expect(page.getByTestId("review-asset-identity")).toContainText(reviewAsset.assetId);
  await expect(page.getByTestId("review-asset-identity")).toContainText("complete");
  await page.getByTestId("load-review-asset").click();

  await expect(page.getByTestId("lab-status")).toContainText("Review-only bytes verified and displayed");
  await expect(page.getByTestId("lab-status")).toContainText("Product membership is unchanged");
  await expect(page.getByTestId("representation-mode")).toContainText("verified-glb · clip celebrate");
  const state = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
  expect(state.assetResult).toMatchObject({
    status: "loaded",
    assetId: reviewAsset.assetId,
    authority: "review-catalog",
    clipName: "celebrate",
    sha256: reviewAsset.sha256,
  });
  expect(state.representation).toMatchObject({
    mode: "verified-glb",
    assetId: reviewAsset.assetId,
    sha256: reviewAsset.sha256,
    clipName: "celebrate",
  });
  expect(requests.filter((url) => url.endsWith(".glb"))).toEqual([reviewAsset.url]);
  expect(getCompanionRuntimeMembership(reviewAsset.assetId).status).toBe("catalog-only");
});

test("reduced motion and forced colors preserve presence, controls, focus, and semantic status", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    reducedMotion: "reduce",
    forcedColors: "active",
  });
  const page = await context.newPage();
  try {
    await openRunningLab(page);
    const diagnostics = await noTaskResources(page);
    expect(diagnostics.rafLoops).toBe(0);
    expect(diagnostics.liveWebglContexts).toBe(1);
    await expect(page.getByTestId("logical-actor")).toHaveCount(1);
    await expect(page.getByTestId("actor-hit-envelope")).toBeVisible();
    await expect(page.getByTestId("lab-status")).toBeVisible();
    const move = page.getByTestId("move-harbor");
    await move.focus();
    await expect(move).toBeFocused();
    await move.click();
    expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent).toMatchObject({
      kind: "anchor",
      preferredAnchorId: "harbor",
    });
  } finally {
    await context.close();
  }
});

test("a viewport smaller than 320x560 is measured as-is", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 280, height: 480 } });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "running");
    const state = await page.evaluate(() => window.__TRANSCEND_LAB__!.state());
    expect(state.snapshot?.viewport).toMatchObject({ x: 0, y: 0, width: 280, height: 480 });
    expect(state.snapshot?.viewport.width).toBeLessThan(320);
    expect(state.snapshot?.viewport.height).toBeLessThan(560);
  } finally {
    await context.close();
  }
});

test("rapid backend replacement followed by stop cannot revive an old owner", async ({ page }) => {
  await openRunningLab(page);
  await page.evaluate(async () => {
    const api = window.__TRANSCEND_LAB__!;
    await Promise.allSettled([
      api.selectBackend("shared-stage"),
      api.selectBackend("movable-patch"),
      api.stop(),
    ]);
  });
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "stopped");
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  expect(await noTaskResources(page)).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.worldState())).lease).toBeNull();
});

test("renderer and load failures leave semantic controls usable; stop/reset drain and block late work", async ({ page }) => {
  await page.goto("/?rendererFailure=1");
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "error");
  await expect(page.getByTestId("renderer-error")).toContainText("forced movable-patch renderer failure");
  await expect(page.getByTestId("move-harbor")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reset" })).toBeEnabled();
  await page.getByTestId("move-harbor").click();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).intent).toMatchObject({
    kind: "anchor",
    preferredAnchorId: "harbor",
  });
  expect(await page.locator('[data-lab-backend-mounted="true"]').count()).toBe(0);

  await page.route(PINNED_ACTIVE_ASSET.url, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: 200, contentType: "model/gltf-binary", body: Buffer.from([1, 2, 3]) });
  });
  await openRunningLab(page);
  await page.getByTestId("load-asset").click();
  await expect.poll(async () => (await noTaskResources(page)).pendingLoads).toBe(1);
  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).assetResult?.status).not.toBe("loaded");

  await page.evaluate(() => window.__TRANSCEND_LAB__!.start("shared-stage"));
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(1);
  const reset = await page.evaluate(() => window.__TRANSCEND_LAB__!.reset());
  expect(reset).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  await page.waitForTimeout(100);
  await expect(page.locator('[data-lab-backend-mounted="true"]')).toHaveCount(0);
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).lifecycle).toBe("stopped");
});


test("W1 visible layout shares bounded boxes and exact ramp vertices with physics", () => {
  const layout = playableWorldLayout(KINEMATIC_CONFIG);
  expect(layout.map(shape => shape.id)).toEqual([
    "camera-pillar", "wall", "step-allowed", "step-blocked", "slope-allowed", "slope-blocked",
  ]);
  expect(Object.isFrozen(layout)).toBe(true);
  for (const shape of layout) {
    expect(Object.isFrozen(shape)).toBe(true);
    expect(shape.width * shape.height * shape.depth).toBeGreaterThan(0);
    expect(Math.abs(shape.z) + shape.depth / 2).toBeLessThan(KINEMATIC_CONFIG.worldLimit);
    if (shape.kind === "ramp") {
      const vertices = rampVertices(shape);
      expect(vertices).toHaveLength(18);
      expect(Math.max(...RAMP_TRIANGLES)).toBe(5);
      expect(vertices[0]).toBeCloseTo(shape.x);
      expect(vertices[6]).toBeCloseTo(shape.x + shape.width);
      expect(vertices[7]).toBeCloseTo(shape.height);
    }
  }
  expect(layout.find(s => s.id === "step-allowed")!.height).toBeLessThan(KINEMATIC_CONFIG.autostepMaxHeight);
  expect(layout.find(s => s.id === "step-blocked")!.height).toBeGreaterThan(KINEMATIC_CONFIG.autostepMaxHeight);
  expect(() => rampVertices({ ...layout[4], height: Number.NaN })).toThrow();
  expect(() => rampVertices(layout[0])).toThrow();
});

test("W1 combined playable physics stops at the visible wall and reaches the station corridor", async ({ page }) => {
  await openRunningLab(page);
  const result = await page.evaluate(async () => {
    const api = window.__TRANSCEND_LAB__!.kinematic;
    await api.start("playable");
    const colliders = api.state().resources.colliders;
    api.key("KeyD", true);
    for (let i = 0; i <= 180; i += 1) api.sample(1000 + i * 1000 / 60);
    const atWall = api.state().position;
    api.stop();
    await api.start("playable");
    api.key("KeyW", true);
    for (let i = 0; i <= 90; i += 1) api.sample(1000 + i * 1000 / 60);
    api.key("KeyW", false);
    const station = api.state().position;
    api.stop();
    return { colliders, atWall, station, drained: api.state().resources };
  });
  expect(result.colliders).toBe(8); // ground + player + six visible solid fixtures
  expect(result.atWall!.x).toBeGreaterThan(2.4);
  expect(result.atWall!.x).toBeLessThan(2.65);
  expect(Math.hypot(result.station!.x - PLAYABLE_DESTINATION.x, result.station!.z - PLAYABLE_DESTINATION.z))
    .toBeLessThan(PLAYABLE_DESTINATION.radius);
  expect(result.drained).toEqual({ worlds: 0, controllers: 0, bodies: 0, colliders: 0, pendingLoads: 0 });
});

test("W1 station has the same keyboard-accessible destination without 3D movement", async ({ page, request }) => {
  const bytes = await fetchExactPinnedBytes(request);
  await page.route(PINNED_ACTIVE_ASSET.url, route => route.fulfill({ status: 200, body: bytes, contentType: "model/gltf-binary" }));
  await openRunningLab(page);
  const semantic = page.getByTestId("open-world-destination-semantic");
  const dialog = page.getByRole("dialog", { name: "Grove station" });
  await semantic.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-destination-id", PLAYABLE_DESTINATION.id);
  await expect(dialog.getByRole("button", { name: "Return from station" })).toBeFocused();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state())).resources.worlds).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(semantic).toBeFocused();

  await page.getByTestId("start-world-playable").click();
  const stage = page.getByTestId("world-playable-stage");
  await expect(stage).toHaveAttribute("data-playable-clip", "idle");
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()))!.fixtureIds)
    .toEqual(playableWorldLayout(KINEMATIC_CONFIG).map(shape => shape.id));
  await page.keyboard.down("w");
  await expect(stage).toHaveAttribute("data-destination-near", "true", { timeout: 10_000 });
  await page.keyboard.up("w");
  const station = page.getByTestId("open-world-destination");
  await station.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-destination-id", PLAYABLE_DESTINATION.id);
  const paused = await page.evaluate(() => {
    const k = window.__TRANSCEND_LAB__!.kinematic;
    const before = k.state().position;
    const accepted = k.key("KeyW", true);
    k.sample(performance.now() + 10_000);
    return { before, after: k.state().position, input: k.state().input, accepted };
  });
  expect(paused.input.suspended).toBe(true);
  expect(paused.accepted).toBe(false);
  expect(paused.after).toEqual(paused.before);
  await dialog.getByRole("button", { name: "Return from station" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(station).toBeFocused();
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().input)).intent.magnitude).toBe(0);
  await page.getByTestId("exit-world-playable").click();
});

test("W1 station remains usable with reduced motion and after actual context loss", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const bytes = await fetchExactPinnedBytes(request);
  await page.route(PINNED_ACTIVE_ASSET.url, route => route.fulfill({ status: 200, body: bytes, contentType: "model/gltf-binary" }));
  await openRunningLab(page);
  await page.getByTestId("start-world-playable").click();
  await expect(page.getByTestId("world-playable-stage")).toHaveAttribute("data-playable-clip", "idle");
  await page.getByTestId("open-world-destination").click();
  const dialog = page.getByRole("dialog", { name: "Grove station" });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="world-playable-canvas"]')!;
    const gl = canvas.getContext("webgl2")!;
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Context-loss extension required for this test");
    extension.loseContext();
  });
  await expect(page.getByTestId("transcend-lab")).toHaveAttribute("data-lifecycle", "error");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Return from station" }).click();
  await page.getByTestId("open-world-destination-semantic").click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  const resources = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(resources).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});


test("W1 playable first frame uses only the monotonic RAF clock", async ({ page, request }) => {
  const bytes = await fetchExactPinnedBytes(request);
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  // A queued RAF timestamp may precede performance.now() at asynchronous mount.
  // A fixed offset preserves monotonic frame deltas while making that gap explicit.
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => request(time => callback(Math.max(0, time - 100)));
  });
  await page.route(PINNED_ACTIVE_ASSET.url, route => route.fulfill({ status: 200, body: bytes, contentType: "model/gltf-binary" }));
  await openRunningLab(page);
  await page.getByTestId("start-world-playable").click();
  await expect.poll(() => page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()?.renderCount ?? 0), { timeout: 4000 })
    .toBeGreaterThanOrEqual(6);
  const before = await page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().position!.z);
  await page.getByTestId("world-playable-canvas").focus();
  await page.keyboard.down("w");
  await expect.poll(() => page.evaluate(() => window.__TRANSCEND_LAB__!.kinematic.state().position!.z)).toBeLessThan(before - 0.1);
  await page.keyboard.up("w");
  expect(pageErrors).toEqual([]);
  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});

test("W1 live reduced motion freezes idle without remount and drains its listener", async ({ page, request }) => {
  const bytes = await fetchExactPinnedBytes(request);
  await page.route(PINNED_ACTIVE_ASSET.url, route => route.fulfill({
    status: 200, contentType: "model/gltf-binary", body: bytes,
  }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openRunningLab(page);
  await page.getByTestId("start-world-playable").click();
  const diagnostics = () => page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()!);
  await expect.poll(async () => (await diagnostics())?.animationTimeSeconds ?? 0).toBeGreaterThan(0);
  const advanceFrames = () => page.evaluate(() => new Promise<void>(resolve => {
    let frames = 0;
    const frame = () => { if (++frames === 6) resolve(); else requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await diagnostics()).reducedMotion).toBe(true);
  const reduced = await diagnostics();
  await advanceFrames();
  const paused = await diagnostics();
  expect(paused.animationTimeSeconds).toBe(reduced.animationTimeSeconds);
  expect(paused.renderCount).toBeGreaterThan(reduced.renderCount);
  await page.getByTestId("open-world-destination").click();
  await expect(page.getByTestId("world-destination-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Return from station" }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await diagnostics()).animationTimeSeconds)
    .toBeGreaterThan(paused.animationTimeSeconds);
  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await page.evaluate(() => window.__TRANSCEND_LAB__!.state())).lifecycle).toBe("stopped");
  await page.getByTestId("start-world-playable").click();
  await expect.poll(async () => (await diagnostics())?.reducedMotion).toBe(true);
  const restarted = await diagnostics();
  await advanceFrames();
  expect((await diagnostics()).animationTimeSeconds).toBe(restarted.animationTimeSeconds);
  const drained = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(drained).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});


test("W1 high-DPR camera canvas stays in CSS pixels through viewport changes", async ({ browser, request, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 384, height: 718 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    const bytes = await fetchExactPinnedBytes(request);
    await page.route(PINNED_ACTIVE_ASSET.url, route => route.fulfill({ status: 200, contentType: "model/gltf-binary", body: bytes }));
    await openRunningLab(page);
    await page.getByTestId("start-world-playable").click();
    const canvas = page.getByTestId("world-playable-canvas");
    await expect(canvas).toBeVisible();
    for (const viewport of [{ width: 384, height: 718 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(async () => canvas.evaluate(element => {
        const c = element as HTMLCanvasElement;
        const r = c.getBoundingClientRect();
        const v = window.visualViewport!;
        return Math.max(Math.abs(r.width - v.width), Math.abs(r.height - v.height));
      })).toBeLessThanOrEqual(1);
      const geometry = await canvas.evaluate(element => {
        const c = element as HTMLCanvasElement, r = c.getBoundingClientRect();
        return { cssWidth: r.width, bufferWidth: c.width };
      });
      expect(geometry.bufferWidth / geometry.cssWidth).toBeCloseTo(1.5, 2);
      if (viewport.width > viewport.height) {
        // Closed camera settings must fit one row instead of covering the actor's head.
        const controls = await page.getByRole("complementary", { name: "W1 playable controls" }).boundingBox();
        expect(controls!.height).toBeLessThanOrEqual(70);
      }
    }
    const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
    expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  } finally { await context.close(); }
});


test("W1 camera distance controls clamp intent without bypassing obstruction or steering the actor", async ({ page, request }) => {
  const bytes = await fetchExactPinnedBytes(request);
  await page.route(PINNED_ACTIVE_ASSET.url, route => route.fulfill({ status: 200, contentType: "model/gltf-binary", body: bytes }));
  await openRunningLab(page);
  await page.getByTestId("start-world-playable").click();
  const diagnostics = () => page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()!);
  await expect.poll(async () => (await diagnostics())?.resolvedCameraDistance).toBe(5);
  const initial = await diagnostics();
  expect(initial.cameraOccluded).toBe(false);
  expect(initial.actorYawRadians! - initial.yawRadians).toBeCloseTo(Math.PI, 6);
  await page.getByTestId("world-camera-toggle").click();
  await page.getByRole("button", { name: "Camera farther" }).click();
  expect((await diagnostics()).desiredCameraDistance).toBe(5.5);
  await page.getByRole("button", { name: "Camera closer" }).click();
  expect((await diagnostics()).desiredCameraDistance).toBe(5);
  await page.evaluate(() => window.__TRANSCEND_LAB__!.playableCameraZoom(-1000));
  expect((await diagnostics()).desiredCameraDistance).toBe(2.5);
  await page.evaluate(() => window.__TRANSCEND_LAB__!.playableCameraZoom(1000));
  expect((await diagnostics()).desiredCameraDistance).toBe(8);
  await page.evaluate(() => window.__TRANSCEND_LAB__!.playableCameraZoom(Number.NaN));
  expect((await diagnostics()).desiredCameraDistance).toBe(8);
  await page.evaluate(() => {
    const api = window.__TRANSCEND_LAB__!;
    api.playableCameraNudge(-api.playableDiagnostics()!.yawRadians);
  });
  const obstructed = await diagnostics();
  expect(obstructed.cameraOccluded).toBe(true);
  expect(obstructed.resolvedCameraDistance!).toBeLessThan(obstructed.desiredCameraDistance);
  expect(obstructed.actorYawRadians).toBe(initial.actorYawRadians);
  await page.getByRole("button", { name: "Reset camera" }).click();
  const reset = await diagnostics();
  expect(reset.desiredCameraDistance).toBe(5);
  expect(reset.resolvedCameraDistance).toBe(5);
  expect(reset.yawRadians).toBe(initial.yawRadians);
  await page.getByTestId("open-world-destination").click();
  await page.evaluate(() => window.__TRANSCEND_LAB__!.playableCameraZoom(1));
  expect((await diagnostics()).desiredCameraDistance).toBe(5);
  await page.getByRole("button", { name: "Return from station" }).click();
  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
});

test("W1 focused-canvas wheel adjusts distance but preserves browser zoom and outside scroll", async ({ page, request }) => {
  const bytes = await fetchExactPinnedBytes(request);
  await page.route(PINNED_ACTIVE_ASSET.url, route => route.fulfill({ status: 200, contentType: "model/gltf-binary", body: bytes }));
  await openRunningLab(page);
  await page.getByTestId("start-world-playable").click();
  const canvas = page.getByTestId("world-playable-canvas");
  await expect(canvas).toBeFocused();
  const before = await page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()!);
  const result = await canvas.evaluate(element => {
    const api = window.__TRANSCEND_LAB__!;
    const wheel = (deltaY: number, deltaMode = 0, modifiers = {}) => {
      const event = new WheelEvent("wheel", { deltaY, deltaMode, ...modifiers, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return { cancelled: event.defaultPrevented, distance: api.playableDiagnostics()!.desiredCameraDistance };
    };
    const pixel = wheel(120);
    const line = wheel(3, WheelEvent.DOM_DELTA_LINE);
    const pageUnit = wheel(1, WheelEvent.DOM_DELTA_PAGE);
    const ctrl = wheel(-120, 0, { ctrlKey: true });
    const meta = wheel(-120, 0, { metaKey: true });
    const horizontal = wheel(0);
    return { pixel, line, pageUnit, ctrl, meta, horizontal };
  });
  expect(result.pixel.cancelled).toBe(true);
  expect(result.pixel.distance).toBeGreaterThan(before.desiredCameraDistance);
  expect(result.line.distance).toBeGreaterThan(result.pixel.distance);
  expect(result.pageUnit.distance).toBe(8);
  for (const key of ["ctrl", "meta", "horizontal"] as const) {
    expect(result[key]).toEqual({ cancelled: false, distance: 8 });
  }
  await page.getByTestId("world-camera-toggle").focus();
  const unfocused = await canvas.evaluate(element => {
    const event = new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true });
    element.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(unfocused).toBe(false);
  await canvas.focus();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -180);
  await expect.poll(() => page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()!.desiredCameraDistance)).toBeLessThan(8);
  const after = await page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()!);
  expect(after.yawRadians).toBe(before.yawRadians);
  expect(after.actorYawRadians).toBe(before.actorYawRadians);
  const outside = await page.getByTestId("world-camera-toggle").evaluate(element => {
    const event = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    element.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(outside).toBe(false);
  const stopped = await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
  expect(stopped).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  await page.getByTestId("start-world-playable").click();
  await expect.poll(() => page.evaluate(() => window.__TRANSCEND_LAB__!.playableDiagnostics()?.desiredCameraDistance)).toBe(5);
  await page.evaluate(() => window.__TRANSCEND_LAB__!.stop());
});
