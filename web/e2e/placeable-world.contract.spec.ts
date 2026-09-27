import { expect, test } from "@playwright/test";
import { Box3, Mesh, Vector3, type BufferGeometry, type Material } from "three";
import { ASSET, COLORS, SOCKETS, type Selection } from "../src/placeable/contract";
import { PlaceableScene, PINWHEEL_RADIUS, type PlaceableProjection } from "../src/placeable/worldScene";
import { PlaceableWorldInput } from "../src/placeable/worldInput";

const coral: Selection = { assetId: ASSET, color: "coral", socketId: "gate-left" };
const projection = (change: Partial<PlaceableProjection> = {}): PlaceableProjection => ({
  selection: coral, preview: false, pulse: 0, suspended: false, canInteract: true, ...change,
});
const still = { lateral: 0, forward: 0, magnitude: 0, source: "none" } as const;

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
  scene.update(projection(), false); scene.step(0.05, input.movement.snapshot.intent);
  const moved = scene.actor.position.clone(); expect(moved.z).toBeLessThan(0);
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
