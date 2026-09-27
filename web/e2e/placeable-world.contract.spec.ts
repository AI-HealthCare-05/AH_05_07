import { keepsakeCandidate } from "../src/placeable/keepsakeMedia";
import { expect, test } from "@playwright/test";
import { Box3, Mesh, Vector3, type CylinderGeometry, type BufferGeometry, type Material } from "three";
import { ASSET, COLORS, SOCKETS, type Selection } from "../src/placeable/contract";
import { PlaceableScene, PINWHEEL_RADIUS, type PlaceableProjection } from "../src/placeable/worldScene";
import { PlaceableWorldInput } from "../src/placeable/worldInput";
import { AnimationClip, Bone, BoxGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, NumberKeyframeTrack, Skeleton, SkinnedMesh, Texture, Uint16BufferAttribute } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MySpaceCompanionActor, validateCompanionClips } from "../src/placeable/companionActor";
import { companionClips, companionSpecies } from "../src/ui/companion";
import { getCompanionAsset } from "../src/ui/companionAssets.generated";
import { readCompanionIdentity } from "../src/ui/companionIdentity";
import { getMySpaceCompanion, validateMySpaceCompanion } from "../src/ui/mySpaceCompanion";
import { GardenScene } from "../src/placeable/gardenScene";

function companionFixture() {
  const model = new Group(); model.name = "companion";
  const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshStandardMaterial({ map: new Texture() }));
  mesh.position.y = 2; model.add(mesh);
  const clips = companionClips.map((name) => new AnimationClip(name, 0.2,
    [new NumberKeyframeTrack(".rotation[z]", [0, 0.1, 0.2], [0, 0.04, 0])]));
  return { scene: model, animations: clips } as GLTF;
}

test("E7 garden walking stays on its small front path, pavilion frames mobile and teardown is idempotent", () => {
  const scene = new GardenScene();
  expect(scene.atPavilion).toBe(false);
  const before = scene.actor.position.clone();
  scene.step(0.05, { lateral: 1, forward: 1, magnitude: 1, source: "keyboard" }, false);
  expect(scene.actor.position.x).toBeGreaterThan(before.x); expect(scene.actor.position.z).toBeLessThan(before.z);
  for (let n = 0; n < 200; n++) scene.step(1, { lateral: 1, forward: 1, magnitude: 1, source: "keyboard" }, false);
  expect(scene.actor.position.x).toBe(1.65); expect(scene.actor.position.z).toBe(0.35);
  scene.approach(); expect(scene.atPavilion).toBe(true);
  const atRest = scene.actor.position.clone(); scene.step(1, { lateral: 1, forward: 1, magnitude: 1, source: "keyboard" }, true);
  expect(scene.actor.position.equals(atRest)).toBe(true);
  // Decorative terrain may continue beyond the frame. The actual roof/joinery
  // and every reachable companion position must stay visible at stage ratios.
  for (const aspect of [2.52, 1.8, 0.95, 0.82, 0.66]) {
    scene.resize(aspect); scene.scene.updateMatrixWorld(true);
    let roofMin = Infinity, roofMax = -Infinity, extentX = 0, extentY = 0;
    scene.pavilion.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const vertices = object.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const point = new Vector3().fromBufferAttribute(vertices, i);
        if (point.y < 0.4) continue; // shared landmark's decorative island/pebbles
        const roof = point.y > 1.5;
        point.applyMatrix4(object.matrixWorld).project(scene.camera);
        extentX = Math.max(extentX, Math.abs(point.x)); extentY = Math.max(extentY, Math.abs(point.y));
        if (roof) { roofMin = Math.min(roofMin, point.x); roofMax = Math.max(roofMax, point.x); }
      }
    });
    expect(extentX).toBeLessThan(0.96); expect(extentY).toBeLessThan(0.96);
    expect((roofMax - roofMin) / 2).toBeGreaterThan(aspect > 2 ? 0.2 : 0.28);
    for (const x of [-1.65, 1.65]) for (const z of [0.35, 2.75]) for (const y of [0.17, 1.22]) {
      const point = new Vector3(x, y, z).project(scene.camera);
      expect(Math.abs(point.x)).toBeLessThan(0.96); expect(Math.abs(point.y)).toBeLessThan(0.96);
    }
  }
  const geometries = new Set<BufferGeometry>(), counts = new Map<BufferGeometry, number>();
  scene.scene.traverse((object) => { if (object instanceof Mesh) geometries.add(object.geometry); });
  geometries.forEach((geometry) => geometry.addEventListener("dispose", () => counts.set(geometry, (counts.get(geometry) ?? 0) + 1)));
  scene.dispose(); scene.dispose(); scene.approach(); scene.step(1, { lateral: 1, forward: 1, magnitude: 1, source: "keyboard" }, false);
  expect([...geometries].map((geometry) => counts.get(geometry))).toEqual([...geometries].map(() => 1));
  expect(scene.actor.position.equals(atRest)).toBe(true);
});

test("E7 explicit rest advances a real clip once, bounds long clips, returns idle and keeps reduced motion neutral", () => {
  for (const duration of [0.2, 20]) {
    const gltf = companionFixture(); gltf.animations.find((clip) => clip.name === "rest")!.duration = duration;
    const actor = new MySpaceCompanionActor(); actor.start(getMySpaceCompanion("bear"), (_url, done) => done(gltf));
    expect(actor.pose).toBe("idle"); expect(actor.rest()).toBe(true); expect(actor.rest()).toBe(false);
    actor.step(0.01); expect(gltf.scene.rotation.z).toBeGreaterThan(0);
    for (let n = 0; n < 81; n++) actor.step(0.05);
    expect(actor.pose).toBe("idle"); actor.rest(); actor.setReducedMotion(true);
    expect(actor.pose).toBe("neutral"); expect(actor.rest()).toBe(true); actor.step(1);
    expect(gltf.scene.rotation.z).toBe(0); expect(actor.pose).toBe("neutral");
    actor.setReducedMotion(false); expect(actor.pose).toBe("idle");
    actor.rest(); actor.dispose(); expect(actor.rest()).toBe(false);
  }
});

test("E5 browser preference normalization and every active member resolve exact lite only", () => {
  expect(readCompanionIdentity(null)).toBe("bear");
  expect(readCompanionIdentity({ getItem: () => { throw new Error("blocked"); } })).toBe("bear");
  for (const raw of [null, "", "seal", "https://forged.invalid/asset.glb"]) {
    expect(getMySpaceCompanion(readCompanionIdentity({ getItem: () => raw }))?.species).toBe("bear");
  }
  for (const species of companionSpecies) {
    const asset = getMySpaceCompanion(readCompanionIdentity({ getItem: () => species }))!;
    expect(asset).toBe(getCompanionAsset(species, "lite"));
    expect(validateMySpaceCompanion(asset)).toBe(asset);
    expect(() => validateMySpaceCompanion(getCompanionAsset(species, "standard"))).toThrow();
    for (const field of ["url", "sha256", "assetId", "version", "bytes"] as const) {
      expect(() => validateMySpaceCompanion({ ...asset, [field]: "forged" } as never)).toThrow();
    }
  }
});

test("E5 normalizes grounded bounds, actually advances idle/greet and returns to idle; reduced motion restores neutral", () => {
  const asset = getMySpaceCompanion("bear")!, gltf = companionFixture();
  const actor = new MySpaceCompanionActor();
  actor.start(asset, (_url, done) => done(gltf));
  const bounds = new Box3().setFromObject(actor.root);
  expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(1.05);
  actor.step(0.05); expect(gltf.scene.rotation.z).toBeGreaterThan(0);
  expect(actor.greet()).toBe(true); expect(actor.greet()).toBe(false); expect(actor.pose).toBe("greet");
  for (let n = 0; n < 5; n++) actor.step(0.05);
  expect(actor.pose).toBe("idle");
  actor.greet(); actor.step(0.05); actor.setReducedMotion(true);
  expect(actor.pose).toBe("neutral"); expect(gltf.scene.rotation.z).toBe(0);
  expect(actor.greet()).toBe(true); actor.step(0.05); expect(gltf.scene.rotation.z).toBe(0);
  actor.setReducedMotion(false); expect(actor.pose).toBe("idle"); actor.dispose();
});

test("E5 clips fail closed for missing, duplicate, empty, invalid duration and nonfinite tracks", () => {
  for (const change of [
    (g: GLTF) => { g.animations.pop(); },
    (g: GLTF) => { g.animations[1].name = "idle"; },
    (g: GLTF) => { g.animations[0].duration = NaN; },
    (g: GLTF) => { g.animations[0].tracks = []; },
    (g: GLTF) => { g.animations[0].tracks[0].values[0] = Infinity; },
  ]) {
    const gltf = companionFixture(); change(gltf);
    expect(() => validateCompanionClips(gltf.animations)).toThrow();
    let released = 0;
    (gltf.scene.children[0] as Mesh).geometry.addEventListener("dispose", () => released++);
    const actor = new MySpaceCompanionActor(); actor.start(getMySpaceCompanion("bear"), (_url, done) => done(gltf));
    expect(actor.pose).toBe("unavailable"); expect(actor.root.children).toHaveLength(0);
    expect(actor.greet()).toBe(false); actor.dispose(); expect(released).toBe(1);
  }
});

test("E5 late load/failure after exit cannot publish and disposes model resources exactly once", () => {
  for (const late of [false, true]) {
    const gltf = companionFixture(), mesh = gltf.scene.children[0] as Mesh<BoxGeometry, MeshStandardMaterial>;
    const resources = [mesh.geometry, mesh.material, mesh.material.map!];
    const counts = new Map<object, number>();
    resources.forEach((value) => value.addEventListener("dispose", () => counts.set(value, (counts.get(value) ?? 0) + 1)));
    const published: string[] = [], actor = new MySpaceCompanionActor((pose) => published.push(pose));
    let loaded!: (value: GLTF) => void, failure!: () => void;
    actor.start(getMySpaceCompanion("rabbit"), (_url, done, fail) => { loaded = done; failure = fail; });
    if (!late) { loaded(gltf); actor.greet(); }
    const before = [...published]; actor.dispose(); actor.dispose();
    if (late) loaded(gltf);
    failure(); actor.step(1); expect(actor.greet()).toBe(false);
    expect(published).toEqual(before); expect(actor.root.children).toHaveLength(0);
    expect(resources.map((r) => counts.get(r))).toEqual([1, 1, 1]);
  }
});

test("E5 failed media leaves pinwheel, keepsake and scene usable; descriptors reject before network", () => {
  const scene = new PlaceableScene(), actor = new MySpaceCompanionActor(); scene.actor.add(actor.root);
  actor.start(getMySpaceCompanion("bear"), (_url, _done, fail) => fail());
  scene.update(projection({ keepsake: "quiet-moon-v1", pulse: 1 }), false); scene.step(0.05, still);
  expect(actor.pose).toBe("unavailable"); expect(scene.pinwheel.visible).toBe(true);
  expect(scene.choiceMarker.visible).toBe(true); expect(scene.rotor.rotation.z).not.toBe(0);
  let requests = 0; const forged = new MySpaceCompanionActor();
  forged.start({ ...getMySpaceCompanion("bear")!, url: "https://forged.invalid" }, () => requests++);
  expect(requests).toBe(0); expect(forged.pose).toBe("unavailable");
  actor.dispose(); forged.dispose(); scene.dispose();
});

test("E5 bounded timeout latches failure and releases a late valid GLB", () => {
  const original = globalThis.setTimeout;
  let expire!: () => void, loaded!: (gltf: GLTF) => void;
  const actor = new MySpaceCompanionActor(), gltf = companionFixture();
  let disposed = 0;
  (gltf.scene.children[0] as Mesh).geometry.addEventListener("dispose", () => disposed++);
  try {
    globalThis.setTimeout = ((callback: () => void, delay: number) => {
      expect(delay).toBe(12000); expire = callback; return undefined;
    }) as unknown as typeof setTimeout;
    actor.start(getMySpaceCompanion("bear"), (_url, done) => { loaded = done; });
    expire(); loaded(gltf);
    expect(actor.pose).toBe("unavailable"); expect(actor.root.children).toHaveLength(0); expect(disposed).toBe(1);
  } finally { globalThis.setTimeout = original; actor.dispose(); }
});

test("E5 broken track targets and empty geometry fail closed before animation ownership", () => {
  for (const empty of [false, true]) {
    const gltf = companionFixture();
    if (empty) gltf.scene.clear(); else gltf.animations[0].tracks[0].name = "missing.position[x]";
    const actor = new MySpaceCompanionActor();
    actor.start(getMySpaceCompanion("bear"), (_url, done) => done(gltf));
    expect(actor.pose).toBe("unavailable"); expect(actor.greet()).toBe(false); actor.dispose();
  }
});

test("E5 skinned companion teardown releases bone texture and detaches from the plaza", () => {
  const gltf = companionFixture(), mesh = gltf.scene.children[0] as Mesh;
  const count = mesh.geometry.getAttribute("position").count;
  mesh.geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4); for (let n = 0; n < count; n++) weights[n * 4] = 1;
  mesh.geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  const skinned = new SkinnedMesh(mesh.geometry, mesh.material), bone = new Bone();
  skinned.position.copy(mesh.position); skinned.add(bone); skinned.bind(new Skeleton([bone]));
  skinned.skeleton.computeBoneTexture(); let released = 0;
  skinned.skeleton.boneTexture!.addEventListener("dispose", () => released++);
  gltf.scene.remove(mesh); gltf.scene.add(skinned);
  const actor = new MySpaceCompanionActor(), scene = new PlaceableScene(); scene.actor.add(actor.root);
  actor.start(getMySpaceCompanion("bear"), (_url, done) => done(gltf));
  expect(actor.pose).toBe("idle"); actor.dispose(); scene.dispose(); actor.dispose();
  expect(released).toBe(1); expect(actor.root.parent).toBeNull();
});

const coral: Selection = { assetId: ASSET, color: "coral", socketId: "gate-left" };
const projection = (change: Partial<PlaceableProjection> = {}): PlaceableProjection => ({
  selection: coral, preview: false, pulse: 0, suspended: false, canInteract: true, ...change,
});
const still = { lateral: 0, forward: 0, magnitude: 0, source: "none" } as const;

test("E6 Gate leads route/details, greets once, preserves placement and reverses to exact daylight", () => {
  const scene = new PlaceableScene();
  scene.update(projection({ keepsake: "quiet-moon-v1" }), false);
  const day = { sky: scene.scene.background!.toJSON(), ground: scene.groundMaterial.color.toArray(),
    ambient: scene.ambient.intensity, sun: scene.sun.intensity, path: scene.approachMaterial.color.toArray() };
  const position = scene.pinwheel.position.toArray(), actor = scene.actor.position.toArray();
  const phases: string[] = []; let greetings = 0;
  scene.setTwilight(true);
  for (let index = 0; index < 50; index++) {
    if (scene.step(0.05, still)) greetings++;
    if (phases.at(-1) !== scene.welcomePhase) phases.push(scene.welcomePhase);
    if (index === 8) {
      expect(scene.archLightMaterial.emissiveIntensity).toBeGreaterThan(1);
      expect(scene.approachMaterial.emissiveIntensity).toBe(0);
      expect(scene.bladeMaterial.emissiveIntensity).toBe(0);
    }
  }
  expect(phases).toEqual(["gate", "route", "details", "companion", "twilight"]);
  expect(greetings).toBe(1);
  expect(scene.archLightMaterial.emissiveIntensity).toBeGreaterThan(scene.gateMaterial.emissiveIntensity);
  expect(scene.gateMaterial.emissiveIntensity).toBeGreaterThan(scene.approachMaterial.emissiveIntensity * 4);
  expect(scene.bladeMaterial.emissiveIntensity).toBeLessThan(scene.approachMaterial.emissiveIntensity);
  expect(scene.pinwheel.position.toArray()).toEqual(position); expect(scene.actor.position.toArray()).toEqual(actor);
  expect(scene.choiceMarker.visible).toBe(true); expect(scene.rotor.rotation.z).toBe(0);
  scene.setTwilight(false);
  for (let index = 0; index < 50; index++) expect(scene.step(0.05, still)).toBe(false);
  expect({ sky: scene.scene.background!.toJSON(), ground: scene.groundMaterial.color.toArray(),
    ambient: scene.ambient.intensity, sun: scene.sun.intensity, path: scene.approachMaterial.color.toArray() }).toEqual(day);
  expect(scene.archLightMaterial.emissiveIntensity).toBe(0); expect(scene.bladeMaterial.emissiveIntensity).toBe(0);
  scene.dispose();
});

test("E6 reduced motion settles immediately, cancels pending reversal and never replays after disposal", () => {
  const scene = new PlaceableScene(); scene.update(projection(), true); scene.setTwilight(true);
  expect(scene.welcomePhase).toBe("twilight"); expect(scene.archLightMaterial.emissiveIntensity).toBe(1.6);
  expect(scene.step(0, still)).toBe(true); expect(scene.step(0, still)).toBe(false);
  scene.setTwilight(false); expect(scene.welcomePhase).toBe("daylight");
  scene.update(projection(), false); scene.setTwilight(true); scene.step(0.05, still);
  scene.setTwilight(false);
  for (let i = 0; i < 50; i++) expect(scene.step(0.05, still)).toBe(false);
  scene.setTwilight(true); scene.update(projection(), true); expect(scene.welcomePhase).toBe("twilight");
  const before = scene.archLightMaterial.emissiveIntensity;
  scene.dispose(); expect(scene.step(0.05, still)).toBeUndefined(); scene.setTwilight(false);
  expect(scene.archLightMaterial.emissiveIntensity).toBe(before);
});

test("Living Choice is one bounded still family and never changes the plaza, actor or pinwheel", () => {
  const scene = new PlaceableScene();
  scene.update(projection(), false);
  const baseline = scene.scene.children.filter((object) => object !== scene.choiceMarker).map((object) => object.toJSON());
  const children = scene.choiceMarker.children.length;
  expect(scene.choiceMarker.visible).toBe(false);
  for (const choice of ["walk-10-minutes", "sleep-routine", "low-sodium-meal"] as const) {
    scene.update(projection({ choice }), false);
    expect(scene.choiceMarker.visible).toBe(true);
    expect(scene.choiceMarker.children.filter((part) => part.name.startsWith("choice-detail:") && part.visible).map((part) => part.name)).toEqual([`choice-detail:${keepsakeCandidate(choice)}`]);
    expect(scene.choiceMarker.children).toHaveLength(children);
    const bounds = new Box3().setFromObject(scene.choiceMarker);
    expect(bounds.max.y).toBeLessThan(0.75);
    expect(bounds.getSize(new Vector3()).x).toBeLessThan(0.8);
    const before = scene.choiceMarker.toJSON();
    scene.step(0.05, still); scene.update(projection({ choice }), true); scene.step(0.05, still);
    expect(scene.choiceMarker.toJSON()).toEqual(before);
    expect(scene.scene.children.filter((object) => object !== scene.choiceMarker).map((object) => object.toJSON())).toEqual(baseline);
  }
  // Runtime firewall also protects an untyped caller, independently of URL parsing.
  scene.update(projection({ choice: "completed" as never }), false);
  expect(scene.choiceMarker.visible).toBe(false);
  scene.update(projection(), false); expect(scene.choiceMarker.visible).toBe(false);
  scene.dispose();
});

test("real scene projects all authored sockets, colors, preview, confirmed and explicit removal", () => {
  const scene = new PlaceableScene();
  expect(scene.socketRings.children.map((socket) => socket.name)).toEqual(SOCKETS.map((s) => s.id));
  for (const socket of SOCKETS) for (const color of Object.keys(COLORS) as (keyof typeof COLORS)[]) {
    scene.update(projection({ selection: { ...coral, socketId: socket.id, color }, preview: true }), false);
    expect(scene.pinwheel.visible).toBe(true);
    expect(scene.pinwheel.position.toArray()).toEqual([socket.x, 0, socket.z]);
    expect(`#${scene.bladeMaterial.color.getHexString()}`).toBe(COLORS[color]);
    expect(scene.bladeMaterial.opacity).toBeLessThan(1); expect(scene.bladeMaterial.depthWrite).toBe(false);
    scene.update(projection({ selection: { ...coral, socketId: socket.id, color } }), false);
    expect(scene.bladeMaterial.opacity).toBe(1); expect(scene.bladeMaterial.depthWrite).toBe(true);
  }
  scene.update(projection({ selection: null, preview: true }), false); expect(scene.pinwheel.visible).toBe(false);
  scene.update(projection({ selection: null }), false); expect(scene.pinwheel.visible).toBe(false);
  scene.dispose();
});

test("pinwheel is within its clearance footprint and visible in the camera at every socket", () => {
  const scene = new PlaceableScene();
  for (const aspect of [0.6, 1, 1.6]) {
    scene.resize(aspect);
    for (const socket of SOCKETS) {
      scene.update(projection({ selection: { ...coral, socketId: socket.id } }), false);
      const box = new Box3().setFromObject(scene.pinwheel);
      expect(box.getSize(new Vector3()).x / 2).toBeLessThan(PINWHEEL_RADIUS);
      expect(box.getSize(new Vector3()).z / 2).toBeLessThan(PINWHEEL_RADIUS);
      const center = box.getCenter(new Vector3()).project(scene.camera);
      expect(Math.abs(center.x)).toBeLessThan(1); expect(Math.abs(center.y)).toBeLessThan(1);
      expect(center.z).toBeGreaterThan(-1); expect(center.z).toBeLessThan(1);
    }
  }
  scene.dispose();
});

test("interaction spins only the projected object, reduced motion keeps static visual feedback", () => {
  const scene = new PlaceableScene(); scene.update(projection(), false);
  const angle = scene.rotor.rotation.z; scene.step(0.05, still); expect(scene.rotor.rotation.z).toBe(angle);
  scene.update(projection({ pulse: 1 }), false); scene.step(0.05, still);
  expect(scene.rotor.rotation.z).not.toBe(angle); expect(scene.bladeMaterial.emissiveIntensity).toBeGreaterThan(0);
  scene.update(projection({ pulse: 2 }), true);
  const reducedAngle = scene.rotor.rotation.z;
  for (let frame = 0; frame < 4; frame++) scene.step(0.05, still);
  expect(scene.rotor.rotation.z).toBe(reducedAngle); expect(scene.bladeMaterial.emissiveIntensity).toBeGreaterThan(0);
  for (let frame = 0; frame < 30; frame++) scene.step(0.05, still);
  expect(scene.bladeMaterial.emissiveIntensity).toBe(0);
  scene.update(projection({ preview: true, pulse: 3 }), false); scene.step(0.05, still);
  expect(scene.bladeMaterial.emissiveIntensity).toBe(0); scene.dispose();
});

test("frames never move while preview/saving suspended; focused input clears held keyboard and pointer intent", () => {
  const scene = new PlaceableScene(), input = new PlaceableWorldInput();
  input.suspend(false); input.focus(true); input.movement.keyDown("KeyW");
  const origin = scene.actor.position.clone();
  scene.update(projection(), false); scene.step(0.05, input.movement.snapshot.intent);
  const moved = scene.actor.position.clone(); expect(moved.z).toBeLessThan(origin.z);
  // Focus leaves the world for controls. Resume never replays held keys.
  input.focus(false); expect(input.movement.snapshot.suspended).toBe(true);
  scene.step(0.05, input.movement.snapshot.intent); expect(scene.actor.position.equals(moved)).toBe(true);
  input.focus(true); expect(input.movement.snapshot.intent.magnitude).toBe(0);
  input.movement.beginPointer(7); input.movement.updatePointer(7, 1, 1);
  input.suspend(true); input.suspend(false); expect(input.movement.snapshot.pointerId).toBeNull();
  input.movement.keyDown("KeyD"); scene.update(projection({ suspended: true }), false);
  scene.step(0.05, input.movement.snapshot.intent); expect(scene.actor.position.equals(moved)).toBe(true);
  input.dispose(); scene.dispose();
});

test("unmount disposes every geometry and shared material exactly once", () => {
  const scene = new PlaceableScene();
  const owned = new Set<BufferGeometry | Material>();
  scene.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    owned.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => owned.add(m));
  });
  const counts = new Map<object, number>();
  owned.forEach((resource) => resource.addEventListener("dispose", () => counts.set(resource, (counts.get(resource) ?? 0) + 1)));
  scene.dispose(); scene.dispose();
  expect(counts.size).toBe(owned.size); expect([...counts.values()].every((n) => n === 1)).toBe(true);
  expect(scene.scene.children).toHaveLength(0);
});

class Surface extends EventTarget {
  captured: number | null = null;
  focused = false;
  focus() { this.focused = true; this.dispatchEvent(new Event("focus")); }
  hasPointerCapture(id: number) { return this.captured === id; }
  setPointerCapture(id: number) { this.captured = id; }
  releasePointerCapture() { this.captured = null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}
function dispatch(surface: EventTarget, type: string, values = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), values); surface.dispatchEvent(event); return event;
}

test("DOM input ownership releases capture/listeners on blur, hidden, cancellation and disposal", () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  const input = new PlaceableWorldInput();
  try {
    const canvas = new Surface(), pad = new Surface(); let interactions = 0;
    input.mount(canvas as unknown as HTMLCanvasElement, pad as unknown as HTMLButtonElement, () => interactions++);
    input.suspend(false); canvas.focus();
    dispatch(canvas, "keydown", { code: "KeyW" }); expect(input.movement.snapshot.intent.forward).toBe(1);
    dispatch(canvas, "keydown", { code: "Enter", repeat: false }); expect(interactions).toBe(1);
    dispatch(canvas, "blur"); expect(input.movement.snapshot.intent.magnitude).toBe(0);
    dispatch(win, "keydown", { code: "KeyW" }); expect(input.movement.snapshot.intent.magnitude).toBe(0);
    canvas.focus(); dispatch(canvas, "keydown", { code: "KeyW", repeat: true });
    expect(input.movement.snapshot.intent.magnitude).toBe(0);
    for (const clear of ["pointerup", "pointercancel", "lostpointercapture"]) {
      dispatch(pad, "pointerdown", { button: 0, pointerId: 7 });
      dispatch(pad, "pointermove", { pointerId: 7, clientX: 100, clientY: 0 });
      expect(input.movement.snapshot.intent.magnitude).toBeCloseTo(1);
      dispatch(pad, clear, { pointerId: 7 }); expect(input.movement.snapshot.intent.magnitude).toBe(0);
      expect(pad.captured).toBeNull();
    }
    dispatch(pad, "pointerdown", { button: 0, pointerId: 7 }); doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange")); expect(input.movement.snapshot.pointerId).toBeNull();
    expect(pad.captured).toBeNull(); doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
    input.dispose(); canvas.focus(); dispatch(canvas, "keydown", { code: "Enter" });
    expect(interactions).toBe(1); expect(input.movement.snapshot.intent.magnitude).toBe(0);
  } finally {
    input.dispose();
    for (const [name, descriptor] of [["window", oldWindow], ["document", oldDocument]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
    }
  }
});


test("the authored round foundation supports every corner of the existing walking bounds", () => {
  const scene = new PlaceableScene();
  const ground = scene.scene.getObjectByName("e1-plaza-ground") as Mesh<CylinderGeometry>;
  scene.update(projection(), false);
  for (const lateral of [-1, 1]) for (const forward of [-1, 1]) {
    for (let frame = 0; frame < 200; frame++) scene.step(0.05, { lateral, forward, magnitude: 1, source: "keyboard" });
    expect(Math.hypot(scene.actor.position.x, scene.actor.position.z) + 0.2).toBeLessThan(ground.geometry.parameters.radiusTop);
  }
  scene.dispose();
});

test("keepsake is one bounded still marker beside the existing pinwheel; unknown identity has no rendering authority", () => {
  const scene = new PlaceableScene();
  for (const keepsake of ["plaza-ribbon-v1", "quiet-moon-v1", "garden-leaf-v1"] as const) {
    scene.update(projection({ keepsake, choice: "sleep-routine", selection: { assetId: ASSET, color: "teal", socketId: "gate-left" } }), true);
    expect(scene.pinwheel.visible).toBe(true);
    expect(scene.choiceMarker.children.filter((part) => part.name.startsWith("choice-detail:") && part.visible).map((part) => part.name)).toEqual([`choice-detail:${keepsake}`]);
  }
  scene.update(projection({ keepsake: "forged" as never }), false); expect(scene.choiceMarker.visible).toBe(false);
  scene.dispose();
});
