import {
  AmbientLight, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight,
  DoubleSide, Float32BufferAttribute, Fog, Group, Mesh, MeshStandardMaterial, PerspectiveCamera,
  Box3, CircleGeometry, MeshBasicMaterial, RingGeometry, Scene, SphereGeometry, TorusGeometry, Vector3, type WebGLRenderer,
} from "three";
import { disposeScene } from "../components/scene/disposeScene";
import { type LivingChoice } from "../ui/livingChoice";
import { keepsakeCandidate } from "./keepsakeMedia";
import { createLivingChoiceMarker } from "./livingChoiceMarker";
import { E1_LIVING_CITY_ENTRY_SCENE_PROFILE as PLAZA } from "../../transcend-lab/src/platform/spatial/e1LivingCityEntrySceneProfile";
import { LIVING_WEEK_SCENE_PLAN as PATH } from "../../transcend-lab/src/platform/spatial/livingWeekScenePlan";
import type { MovementIntent } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";
import { ASSET, COLORS, isKeepsake, SOCKETS, type Keepsake, type Selection } from "./contract";
import { PlazaLocomotion } from "./plazaLocomotion";
import { PlazaCameraRig } from "./plazaCamera";
import { cameraObstacle, type CameraObstacle } from "../../transcend-lab/src/platform/spatial/thirdPersonCamera";
import { worldPoint } from "../../transcend-lab/src/platform/spatial/worldSpaceClock";

// Rendering receives a projection only. It has no storage, identity, API or health access.
export type PlaceableProjection = Readonly<{
  choice?: LivingChoice | null;
  keepsake?: Keepsake | null;
  selection: Selection | null;
  preview: boolean;
  pulse: number;
  suspended: boolean;
  canInteract: boolean;
}>;
export const PINWHEEL_RADIUS = 0.4;
const material = (color: string | number) => new MeshStandardMaterial({ color, roughness: 0.82 });
const mood = {
  sky: [new Color("#eee8db"), new Color("#202e58")],
  ground: [new Color("#e0d7b9"), new Color("#465780")],
  approach: [new Color("#f5ead4"), new Color("#8589aa")],
  ambient: [new Color(0xe8ecff), new Color("#c4d0ff")],
  sun: [new Color(0xffe4b8), new Color("#ccd9ff")],
} as const;
const ramp = (time: number, start: number, duration: number) => {
  const value = Math.max(0, Math.min(1, (time - start) / duration));
  return value * value * (3 - 2 * value);
};

export class PlaceableScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(48, 1, 0.1, 60);
  readonly choiceMarker = createLivingChoiceMarker();
  readonly pinwheel = new Group();
  readonly rotor = new Group();
  readonly actor = new Group();
  readonly locomotion = new PlazaLocomotion();
  readonly cameraRig = new PlazaCameraRig();
  #cameraObstacles: CameraObstacle[] = [];
  readonly socketRings = new Group();
  readonly bladeMaterial = material(COLORS.coral);
  readonly ambient = new AmbientLight(0xe8ecff, 1.5);
  readonly sun = new DirectionalLight(0xffe4b8, 2.4);
  readonly groundMaterial = material("#e0d7b9");
  readonly gateMaterial = material("#6954b5");
  readonly archLightMaterial = material("#f8d789");
  readonly approachMaterial = material("#f5ead4");
  #detailMaterials: MeshStandardMaterial[] = [];
  #twilight = false;
  #welcomeTime = 0;
  #greetingPending = false;
  #pinwheelMaterials: MeshStandardMaterial[] = [];
  #pulse = 0;
  #feedbackLeft = 0;
  #disposed = false;
  #reducedMotion = false;
  #preview = false;
  #suspended = true;

  constructor() {
    // Daylight is the truthful default for every visit; no wall clock or stored mood.
    this.scene.background = new Color("#eee8db");
    this.scene.fog = new Fog("#eee8db", 22, 48);
    this.scene.add(this.ambient);
    const sun = this.sun;
    sun.position.set(-3, 8, 5); this.scene.add(sun);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 25 });
    sun.shadow.bias = -0.001; sun.shadow.normalBias = 0.025;
    // The circular foundation covers the unchanged square walking bounds, including corners.
    const groundRadius = PATH.boundMetres * Math.SQRT2;
    const ground = new Mesh(new CylinderGeometry(groundRadius, groundRadius + 0.15, 0.25, 96), this.groundMaterial);
    ground.position.y = -0.14; ground.name = "e1-plaza-ground"; this.scene.add(ground);
    // A civic square extends into its neighborhood, rather than floating in a void.
    const surroundings = new Mesh(new CylinderGeometry(28, 28, 0.2, 96), material("#98a28b"));
    surroundings.position.y = -0.3; this.scene.add(surroundings);
    // Preserve E1's authored route coordinates and all E2 sockets.
    for (const segment of PATH.segments) {
      const path = new Mesh(new BoxGeometry(0.12, 0.025, segment.lengthMetres), material("#bcb998"));
      path.position.set((segment.start.x + segment.end.x) / 2, 0.015, (segment.start.z + segment.end.z) / 2);
      path.rotation.y = Math.atan2(segment.end.x - segment.start.x, segment.end.z - segment.start.z);
      path.name = segment.id; this.scene.add(path);
    }
    for (const marker of PATH.markers) {
      const disc = new Mesh(new CylinderGeometry(0.18, 0.24, 0.07, 24), material("#efdfb4"));
      disc.position.set(marker.position.x, 0.05, marker.position.z);
      disc.name = marker.id; this.scene.add(disc);
    }
    const approach = new Mesh(new BoxGeometry(1.65, 0.03, 9), this.approachMaterial);
    approach.position.set(0, 0.02, 0.8); this.scene.add(approach);
    const stone = material("#c7bea8"), edging = material("#b4a28e");
    for (let z = -3.3; z < 5; z += 0.65) {
      const joint = new Mesh(new BoxGeometry(1.64, 0.008, 0.018), stone);
      joint.position.set(0, 0.041, z); this.scene.add(joint);
    }
    // The side route bends toward the existing Garden visit; it is visual only.
    const gardenRoute = new BufferGeometry();
    gardenRoute.setAttribute("position", new Float32BufferAttribute([
      0.7, 0.045, 2.2, 0.7, 0.045, 1.3, 3.1, 0.045, -0.1,
      0.7, 0.045, 2.2, 3.1, 0.045, -0.1, 3.8, 0.045, 0.6,
      3.8, 0.045, 0.6, 3.1, 0.045, -0.1, 5.7, 0.045, -3.3,
      3.8, 0.045, 0.6, 5.7, 0.045, -3.3, 6.6, 0.045, -2.6,
    ], 3));
    gardenRoute.setIndex([0, 2, 1, 3, 5, 4, 6, 8, 7, 9, 11, 10]);
    gardenRoute.computeVertexNormals();
    this.scene.add(new Mesh(gardenRoute, this.approachMaterial));
    const gate = new Group(); gate.name = PLAZA.destination.id;
    gate.position.set(PLAZA.destination.x, 0, PLAZA.destination.z);
    gate.scale.set(1.35, 1.45, 1.35);
    const gateMaterial = this.gateMaterial, trimMaterial = material("#b4a3db");
    for (const x of [-0.85, 0.85]) {
      const post = new Mesh(new CylinderGeometry(0.25, 0.29, 1.65, 32), gateMaterial);
      post.position.set(x, 0.825, 0); gate.add(post);
      const foot = new Mesh(new CylinderGeometry(0.36, 0.39, 0.18, 32), trimMaterial);
      foot.position.set(x, 0.09, 0); gate.add(foot);
    }
    const arch = new Mesh(new TorusGeometry(0.85, 0.25, 24, 64, Math.PI), gateMaterial);
    arch.position.y = 1.65; gate.add(arch);
    const innerArch = new Mesh(new TorusGeometry(0.85, 0.035, 12, 64, Math.PI), this.archLightMaterial);
    innerArch.position.set(0, 1.65, 0.25); gate.add(innerArch);
    // Stepped bases, imposts and a crown distinguish the arrival arch from a toy hoop.
    for (const x of [-0.85, 0.85]) {
      for (const [y, width, height] of [[0.12, 0.76, 0.24], [1.62, 0.65, 0.16]]) {
        const block = new Mesh(new BoxGeometry(width, height, 0.64), trimMaterial);
        block.position.set(x, y, 0); gate.add(block);
      }
      const inlay = new Mesh(new BoxGeometry(0.042, 1.28, 0.025), this.archLightMaterial);
      inlay.position.set(x, 0.92, 0.3); gate.add(inlay);
    }
    const crown = new Mesh(new BoxGeometry(0.22, 0.38, 0.58), trimMaterial);
    crown.position.set(0, 2.5, 0); gate.add(crown);
    this.scene.add(gate);
    const leaves = [material("#647d68"), material("#849276"), material("#a0a27b")];
    const trunk = material("#84745e");
    // Asymmetric clipped street trees and low terraces frame the one hero.
    for (const [x, z, height, spread] of [[-3.6, -3.2, 3.4, 1.1], [3.8, -4.6, 3.9, 1.25], [-5.8, 0.5, 2.9, 1], [6.6, -2.4, 3, 1]]) {
      const stem = new Mesh(new CylinderGeometry(0.1, 0.17, height - 0.7, 10), trunk);
      stem.position.set(x, (height - 0.7) / 2, z); this.scene.add(stem);
      for (let n = 0; n < 3; n++) {
        const canopy = new Mesh(new SphereGeometry(spread, 12, 8), leaves[n]);
        canopy.scale.set(1 - n * 0.12, 0.65, 0.85);
        canopy.position.set(x + (n - 1) * 0.28, height - 0.65 + n * 0.4, z + n * 0.12); this.scene.add(canopy);
      }
    }
    for (const [x, z, width] of [[-3.5, -1.1, 1.7], [3.5, -2, 1.5], [-3.4, 3.6, 2.4], [4.1, 3.1, 1.8], [-2.7, -4.8, 2.5], [2.9, -5.4, 2.1]]) {
      const bed = new Mesh(new BoxGeometry(width, 0.3, 0.95), edging);
      bed.position.set(x, 0.12, z); this.scene.add(bed);
      for (let n = 0; n < 4; n++) {
        const shrub = new Mesh(new SphereGeometry(0.46, 12, 8), leaves[n % 3]);
        shrub.scale.set(0.9, 0.6 + (n % 2) * 0.25, 0.85);
        shrub.position.set(x - width / 2 + 0.25 + n * (width - 0.5) / 3, 0.38, z); this.scene.add(shrub);
      }
    }
    // A pair of quiet seats, with no extra actors or competing landmark.
    for (const x of [-3.15, 3.2]) {
      const seat = new Mesh(new BoxGeometry(1.25, 0.14, 0.48), trunk);
      seat.position.set(x, 0.46, 0.2); this.scene.add(seat);
      for (const offset of [-0.43, 0.43]) {
        const leg = new Mesh(new BoxGeometry(0.16, 0.4, 0.38), stone);
        leg.position.set(x + offset, 0.2, 0.2); this.scene.add(leg);
      }
    }
    // Browser review reproduced gate/tree occlusion at 180/270 degrees. Static
    // mesh bounds are a conservative camera-only proxy, never actor collision.
    // Capture before adding interactive objects or the companion; ground/path
    // surfaces cannot obstruct the eye-height boom.
    this.scene.updateMatrixWorld(true);
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const box = new Box3().setFromObject(object);
      if (box.max.y < 0.6) return;
      this.#cameraObstacles.push(cameraObstacle(`plaza-${this.#cameraObstacles.length}`,
        worldPoint(box.min.x, box.min.y, box.min.z), worldPoint(box.max.x, box.max.y, box.max.z)));
    });
    for (const socket of SOCKETS) {
      const ring = new Mesh(new RingGeometry(0.31, PINWHEEL_RADIUS, 40), material("#819f86"));
      ring.name = socket.id; ring.rotation.x = -Math.PI / 2;
      ring.position.set(socket.x, 0.04, socket.z); this.socketRings.add(ring);
    }
    this.scene.add(this.socketRings);
    this.scene.add(this.choiceMarker);
    this.choiceMarker.position.x = -2.15;
    this.pinwheel.name = ASSET; this.pinwheel.visible = false;
    const stemMaterial = material("#99744d"), hubMaterial = material("#fff8df");
    this.#detailMaterials = [hubMaterial];
    const face = this.choiceMarker.getObjectByName("keepsake-face") as Mesh<CylinderGeometry, MeshStandardMaterial>;
    this.#detailMaterials.push(face.material);
    this.#pinwheelMaterials = [this.bladeMaterial, stemMaterial, hubMaterial];
    this.bladeMaterial.side = DoubleSide;
    const stem = new Mesh(new CylinderGeometry(0.023, 0.03, 1.02, 12), stemMaterial);
    stem.position.y = 0.51; this.pinwheel.add(stem);
    this.rotor.position.set(0, 1.02, 0.035);
    const blade = new BufferGeometry();
    blade.setAttribute("position", new Float32BufferAttribute([0, 0, 0, -0.06, 0.34, 0, 0.24, 0.29, 0.04], 3));
    blade.computeVertexNormals();
    for (let index = 0; index < 4; index++) {
      const mesh = new Mesh(blade, this.bladeMaterial);
      mesh.rotation.z = index * Math.PI / 2; this.rotor.add(mesh);
    }
    const hub = new Mesh(new SphereGeometry(0.045, 16, 12), hubMaterial);
    hub.position.z = 0.06; this.rotor.add(hub); this.pinwheel.add(this.rotor); this.scene.add(this.pinwheel);
    this.actor.name = "plaza-companion";
    this.actor.position.set(-1.3, 0, 1.25);
    const contact = new Mesh(new CircleGeometry(0.33, 32), new MeshBasicMaterial({ color: "#433931", transparent: true, opacity: 0.17, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = 0.055; contact.scale.y = 0.75;
    this.actor.add(contact);
    this.scene.add(this.actor);
    this.scene.traverse((object) => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    contact.castShadow = false; contact.receiveShadow = false;
    this.socketRings.traverse((object) => { object.castShadow = false; });
    this.resize(1);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.cameraRig.resize(aspect);
    this.camera.updateProjectionMatrix(); this.#camera(0);
  }

  stopSpatial() { this.locomotion.stop(); this.cameraRig.stop(); }
  #camera(dt: number) {
    const { position, focus } = this.cameraRig.step(this.actor.position, dt, this.#reducedMotion, this.#cameraObstacles);
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(focus.x, focus.y, focus.z); this.camera.updateMatrixWorld();
  }

  update(projection: PlaceableProjection, reducedMotion: boolean) {
    if (this.#disposed) return;
    const choice = isKeepsake(projection.keepsake) && projection.keepsake
      ? projection.keepsake : keepsakeCandidate(projection.choice);
    this.choiceMarker.visible = choice !== null;
    for (const detail of this.choiceMarker.children) {
      if (detail.name.startsWith("choice-detail:")) detail.visible = detail.name === `choice-detail:${choice}`;
    }
    this.#reducedMotion = reducedMotion; this.#preview = projection.preview; this.#suspended = projection.suspended;
    if (this.#suspended) this.stopSpatial();
    if (reducedMotion && this.#welcomeTime !== (this.#twilight ? 2.1 : 0)) {
      this.#welcomeTime = this.#twilight ? 2.1 : 0;
      this.#lighting();
    }
    if (reducedMotion) this.rotor.rotation.z = 0;
    const selection = projection.selection;
    this.pinwheel.visible = selection !== null;
    if (selection) {
      const socket = SOCKETS.find((entry) => entry.id === selection.socketId)!;
      this.pinwheel.position.set(socket.x, 0, socket.z);
      this.pinwheel.userData = { selection: { ...selection }, preview: projection.preview };
      this.bladeMaterial.color.set(COLORS[selection.color]);
    }
    for (const m of this.#pinwheelMaterials) {
      m.opacity = projection.preview ? 0.48 : 1;
      m.transparent = projection.preview; m.depthWrite = !projection.preview;
    }
    for (const object of this.socketRings.children) {
      const ring = object as Mesh<RingGeometry, MeshStandardMaterial>;
      ring.material.color.set(selection?.socketId === ring.name ? projection.preview ? "#c5a339" : "#238b88" : "#819f86");
    }
    if (projection.pulse > this.#pulse && !projection.preview && selection) this.#feedbackLeft = 0.9;
    this.#pulse = projection.pulse;
    if (!selection || projection.preview) this.#feedbackLeft = 0;
    this.#feedback();
  }

  step(seconds: number, intent: MovementIntent) {
    if (this.#disposed) return;
    const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, 0.05)) : 0;
    const target = this.#twilight ? 2.1 : 0;
    if (this.#welcomeTime !== target) {
      this.#welcomeTime = this.#twilight ? Math.min(target, this.#welcomeTime + dt) : Math.max(0, this.#welcomeTime - dt * 2);
      this.#lighting();
    }
    if (!this.#suspended) {
      if (intent.magnitude) this.cameraRig.engage();
      const position = this.locomotion.step(this.actor.position, intent, this.cameraRig.yaw, dt, this.#reducedMotion);
      this.actor.position.x = position.x; this.actor.position.z = position.z;
      this.actor.rotation.y = this.locomotion.yaw;
    }
    this.#camera(dt);
    if (this.#feedbackLeft > 0) {
      if (!this.#reducedMotion && !this.#preview) this.rotor.rotation.z -= dt * 14 * (this.#feedbackLeft / 0.9);
      this.#feedbackLeft = Math.max(0, this.#feedbackLeft - dt);
    }
    this.#feedback();
    if (this.#greetingPending && this.#welcomeTime >= 1.65) {
      this.#greetingPending = false;
      return true; // One optional greet; no replay if the companion is not ready.
    }
    return false;
  }

  get welcomePhase() {
    return !this.#twilight ? "daylight" : this.#welcomeTime >= 2.1 ? "twilight"
      : this.#welcomeTime >= 1.65 ? "companion" : this.#welcomeTime >= 1.05 ? "details"
      : this.#welcomeTime >= 0.55 ? "route" : "gate";
  }

  setTwilight(enabled: boolean) {
    if (this.#disposed || enabled === this.#twilight) return;
    this.#twilight = enabled;
    this.#greetingPending = enabled;
    // A fresh activation starts its short authored sequence; reversal cancels it.
    if (enabled) this.#welcomeTime = 0;
    if (this.#reducedMotion) this.#welcomeTime = enabled ? 2.1 : 0;
    this.#lighting();
  }

  #lighting() {
    const environment = ramp(this.#welcomeTime, 0, 1.3);
    const gate = ramp(this.#welcomeTime, 0, 0.55);
    const route = ramp(this.#welcomeTime, 0.55, 0.6);
    const detail = ramp(this.#welcomeTime, 1.05, 0.55);
    (this.scene.background as Color).copy(mood.sky[0]).lerp(mood.sky[1], environment);
    (this.scene.fog as Fog).color.copy(this.scene.background as Color);
    this.groundMaterial.color.copy(mood.ground[0]).lerp(mood.ground[1], environment);
    this.ambient.color.copy(mood.ambient[0]).lerp(mood.ambient[1], environment);
    this.ambient.intensity = 1.5 - 0.35 * environment;
    this.sun.color.copy(mood.sun[0]).lerp(mood.sun[1], environment);
    this.sun.intensity = 2.4 - 0.75 * environment;
    this.gateMaterial.emissive.set("#785ad8"); this.gateMaterial.emissiveIntensity = gate * 0.65;
    this.archLightMaterial.emissive.set("#ffd18a"); this.archLightMaterial.emissiveIntensity = gate * 1.6;
    this.approachMaterial.emissive.set("#c5c9ff"); this.approachMaterial.emissiveIntensity = route * 0.12;
    this.approachMaterial.color.copy(mood.approach[0]).lerp(mood.approach[1], environment);
    for (const material of this.#detailMaterials) {
      material.emissive.set("#f8dcb2"); material.emissiveIntensity = detail * 0.07;
    }
  }

  #feedback() {
    const detail = ramp(this.#welcomeTime, 1.05, 0.55);
    this.bladeMaterial.emissive.set(this.#feedbackLeft > 0 || detail > 0 ? "#ffdc79" : "#000000");
    this.bladeMaterial.emissiveIntensity = this.#feedbackLeft > 0 ? 0.45 : detail * 0.06;
  }

  labels() {
    return [{ id: "today-gate", label: "오늘의 기록", x: PLAZA.destination.x, y: 4.15, z: PLAZA.destination.z },
      ...SOCKETS.map((s) => ({ ...s, y: 0, z: s.z + 0.55 }))].map((label) => {
      const point = new Vector3(label.x, label.y, label.z).project(this.camera);
      const visible = point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 0.9 && Math.abs(point.y) < 0.94;
      return { id: label.id, label: label.label, left: (point.x + 1) * 50, top: (1 - point.y) * 50, visible };
    });
  }

  dispose(renderer?: WebGLRenderer) {
    if (this.#disposed) return;
    this.#disposed = true;
    disposeScene(this.scene, renderer);
    this.scene.clear();
  }
}
