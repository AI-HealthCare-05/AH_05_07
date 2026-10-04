import { expect, test } from "@playwright/test";
import { AnimationClip, BoxGeometry, Group, Mesh, MeshStandardMaterial, NumberKeyframeTrack } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { advanceGardenWalk, GARDEN_WALK } from "../src/placeable/gardenWalk";
import { GardenScene } from "../src/placeable/gardenScene";
import { MySpaceCompanionActor } from "../src/placeable/companionActor";
import { companionClips } from "../src/ui/companion";
import { getMySpaceCompanion } from "../src/ui/mySpaceCompanion";
import type { MovementIntent } from "../transcend-lab/src/platform/behavior/worldMovementIntent";

const intent = (lateral: number, forward: number): MovementIntent => ({
  lateral, forward, magnitude: Math.hypot(lateral, forward), source: "keyboard",
});
const pose = { x: 0, z: 1.5, facing: 0.37 };

function companionFixture(): GLTF {
  const model = new Group(); model.name = "garden-walk-fixture";
  const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshStandardMaterial());
  mesh.position.y = 2; model.add(mesh);
  return {
    scene: model,
    animations: companionClips.map(name => new AnimationClip(name, 0.2, [
      new NumberKeyframeTrack(".rotation[z]", [0, 0.1, 0.2], [0, 0.04, 0]),
    ])),
  } as GLTF;
}

test("Garden walk/rest preserves the authored E7 envelope and timing", () => {
  expect(GARDEN_WALK).toEqual({
    minX: -1.65, maxX: 1.65, minZ: 0.35, maxZ: 2.75, speed: 1.6, maxStepSeconds: 0.05,
  });
  expect(advanceGardenWalk(pose, 1, intent(1, 0), false))
    .toEqual(advanceGardenWalk(pose, 0.05, intent(1, 0), false));
  expect(advanceGardenWalk(pose, 0.025, intent(1, 0), false).x).toBeCloseTo(0.04);
});

for (const [lateral, forward, facing] of [
  [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, 1, Math.PI], [0, -1, 0],
]) test(`Garden walk/rest faces actual travel (${lateral}, ${forward})`, () => {
  const next = advanceGardenWalk(pose, 0.05, intent(lateral, forward), false);
  expect(next.moving).toBe(true);
  expect(next.x).toBeCloseTo(pose.x + lateral * 0.08);
  expect(next.z).toBeCloseTo(pose.z - forward * 0.08);
  expect(Math.sin(next.facing)).toBeCloseTo(Math.sin(facing));
  expect(Math.cos(next.facing)).toBeCloseTo(Math.cos(facing));
  expect(pose).toEqual({ x: 0, z: 1.5, facing: 0.37 });
});

test("Garden walk/rest uses post-clamp displacement for stop and wall sliding", () => {
  const edge = { x: 1.65, z: 1.5, facing: 0.37 };
  expect(advanceGardenWalk(edge, 0.05, intent(1, 0), false))
    .toEqual({ ...edge, moving: false });
  const slide = advanceGardenWalk(edge, 0.05, intent(1, 1), false);
  expect(slide.x).toBe(1.65);
  expect(slide.z).toBeLessThan(edge.z);
  expect(slide.facing).toBeCloseTo(Math.PI);
  expect(slide.moving).toBe(true);
  const corner = { x: 1.65, z: 0.35, facing: -0.2 };
  expect(advanceGardenWalk(corner, 0.05, intent(1, 1), false))
    .toEqual({ ...corner, moving: false });
});

test("Garden walk/rest does not turn or travel on rest, zero time or invalid input", () => {
  const initial = Object.freeze({ ...pose });
  for (const seconds of [0, -1, NaN, Infinity]) {
    expect(advanceGardenWalk(initial, seconds, intent(1, 1), false))
      .toEqual({ ...initial, moving: false });
  }
  expect(advanceGardenWalk(initial, 1, intent(1, 1), true))
    .toEqual({ ...initial, moving: false });
  expect(advanceGardenWalk(initial, 0.05, intent(0, 0), false))
    .toEqual({ ...initial, moving: false });
  expect(advanceGardenWalk(initial, 0.05, intent(NaN, 0), false))
    .toEqual({ ...initial, moving: false });
});

test("Garden walk/rest real scene commits facing once without changing camera, bounds or approach", () => {
  const scene = new GardenScene();
  try {
    const camera = scene.camera.matrixWorld.clone();
    const pavilion = scene.pavilion.position.clone();
    const before = scene.actor.position.clone();
    expect(scene.step(0.05, intent(1, 0), false)).toBe(true);
    expect(scene.actor.position.x).toBeCloseTo(before.x + 0.08);
    expect(scene.actor.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(scene.actor.position.y).toBe(0.17);
    expect(scene.camera.matrixWorld.equals(camera)).toBe(true);
    expect(scene.pavilion.position.equals(pavilion)).toBe(true);
    for (let n = 0; n < 200; n++) scene.step(1, intent(1, 1), false);
    expect(scene.actor.position.toArray()).toEqual([1.65, 0.17, 0.35]);
    expect(scene.step(1, intent(1, 1), false)).toBe(false);
    scene.actor.rotation.y = 0.37;
    scene.approach();
    expect(scene.actor.position.toArray()).toEqual([0, 0.17, 0.4]);
    expect(scene.actor.rotation.y).toBeCloseTo(Math.PI);
    expect(scene.atPavilion).toBe(true);
    const resting = scene.actor.position.clone(), yaw = scene.actor.rotation.y;
    expect(scene.step(1, intent(1, -1), true)).toBe(false);
    expect(scene.actor.position.equals(resting)).toBe(true);
    expect(scene.actor.rotation.y).toBe(yaw);
    scene.dispose();
    expect(scene.step(1, intent(1, 1), false)).toBe(false);
    scene.approach();
    expect(scene.actor.position.equals(resting)).toBe(true);
  } finally { scene.dispose(); }
});

test("Garden walk/rest existing mixer handles walk to idle to one rest without moving the world root", () => {
  const scene = new GardenScene(), actor = new MySpaceCompanionActor(), gltf = companionFixture();
  try {
    scene.actor.add(actor.root);
    actor.start(getMySpaceCompanion("bear"), (_url, loaded) => loaded(gltf));
    actor.setMoving(scene.step(0.05, intent(1, 0), false));
    expect(actor.pose).toBe("move");
    const position = scene.actor.position.clone(), yaw = scene.actor.rotation.y;
    actor.step(0.05);
    expect(gltf.scene.rotation.z).toBeGreaterThan(0);
    expect(scene.actor.position.equals(position)).toBe(true);
    expect(scene.actor.rotation.y).toBe(yaw);
    actor.setMoving(false);
    expect(actor.pose).toBe("idle");
    expect(actor.rest()).toBe(true);
    expect(actor.rest()).toBe(false);
    for (let n = 0; n < 10 && actor.pose === "rest"; n++) {
      expect(scene.step(0.05, intent(1, 1), true)).toBe(false);
      actor.step(0.05);
    }
    expect(actor.pose).toBe("idle");
    expect(scene.actor.position.equals(position)).toBe(true);
    expect(scene.step(0.05, intent(0, 0), false)).toBe(false);
  } finally { actor.dispose(); scene.dispose(); }
});

test("Garden walk/rest reduced motion retains direct travel and orientation without authored gait", () => {
  const scene = new GardenScene(), actor = new MySpaceCompanionActor(), gltf = companionFixture();
  try {
    scene.actor.add(actor.root);
    actor.setReducedMotion(true);
    actor.start(getMySpaceCompanion("bear"), (_url, loaded) => loaded(gltf));
    const before = scene.actor.position.clone();
    actor.setMoving(scene.step(0.05, intent(-1, 0), false));
    actor.step(0.05);
    expect(actor.pose).toBe("neutral");
    expect(scene.actor.position.x).toBeLessThan(before.x);
    expect(scene.actor.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(gltf.scene.rotation.z).toBe(0);
    actor.setMoving(false);
    expect(actor.rest()).toBe(true);
    expect(actor.pose).toBe("neutral");
  } finally { actor.dispose(); scene.dispose(); }
});
