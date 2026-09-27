import {
  AmbientLight, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight,
  DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PerspectiveCamera,
  RingGeometry, Scene, SphereGeometry, TorusGeometry, Vector3, type WebGLRenderer,
} from "three";
import { disposeScene } from "../components/scene/disposeScene";
import { type LivingChoice } from "../ui/livingChoice";
import { keepsakeCandidate } from "./keepsakeMedia";
import { createLivingChoiceMarker } from "./livingChoiceMarker";
import { E1_LIVING_CITY_ENTRY_SCENE_PROFILE as PLAZA } from "../../transcend-lab/src/platform/spatial/e1LivingCityEntrySceneProfile";
import { LIVING_WEEK_SCENE_PLAN as PATH } from "../../transcend-lab/src/platform/spatial/livingWeekScenePlan";
import type { MovementIntent } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";
import { ASSET, COLORS, isKeepsake, SOCKETS, type Keepsake, type Selection } from "./contract";

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
    this.scene.add(this.ambient);
    const sun = this.sun;
    sun.position.set(-3, 8, 5); this.scene.add(sun);
    // The circular foundation covers the unchanged square walking bounds, including corners.
    const groundRadius = PATH.boundMetres * Math.SQRT2;
    const ground = new Mesh(new CylinderGeometry(groundRadius, groundRadius + 0.15, 0.25, 96), this.groundMaterial);
    ground.position.y = -0.14; ground.name = "e1-plaza-ground"; this.scene.add(ground);
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
    const approach = new Mesh(new BoxGeometry(1.25, 0.03, 4.7), this.approachMaterial);
    approach.position.set(0, 0.02, -0.2); this.scene.add(approach);
    const gate = new Group(); gate.name = PLAZA.destination.id;
    gate.position.set(PLAZA.destination.x, 0, PLAZA.destination.z);
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
    this.scene.add(gate);
    // Low, broad planting frames the destination; it never competes with it.
    for (const x of [-3.2, 3.2]) {
      const bed = new Mesh(new CylinderGeometry(0.75, 0.85, 0.16, 40), material("#c2c2a5"));
      bed.position.set(x, 0.08, -1.1); this.scene.add(bed);
      const foliage = new Mesh(new SphereGeometry(0.8, 32, 20), material("#829579"));
      foliage.scale.set(0.85, 0.48, 1.2); foliage.position.set(x, 0.26, -1.1); this.scene.add(foliage);
    }
    for (const socket of SOCKETS) {
      const ring = new Mesh(new RingGeometry(0.31, PINWHEEL_RADIUS, 40), material("#819f86"));
      ring.name = socket.id; ring.rotation.x = -Math.PI / 2;
      ring.position.set(socket.x, 0.04, socket.z); this.socketRings.add(ring);
    }
    this.scene.add(this.socketRings);
    this.scene.add(this.choiceMarker);
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
    this.scene.add(this.actor); this.resize(1);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    // Keep the authored sockets and plaza in view on portrait screens too.
    const distance = Math.max(1, 0.85 / aspect);
    this.camera.position.set(0, 5.8 * distance, 8.3 * distance);
    this.camera.lookAt(0, 0.45, -0.5); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
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
    const dt = Math.max(0, Math.min(seconds, 0.05));
    const target = this.#twilight ? 2.1 : 0;
    if (this.#welcomeTime !== target) {
      this.#welcomeTime = this.#twilight ? Math.min(target, this.#welcomeTime + dt) : Math.max(0, this.#welcomeTime - dt * 2);
      this.#lighting();
    }
    if (!this.#suspended) {
      const bound = PATH.boundMetres - 0.35;
      this.actor.position.x = Math.max(-bound, Math.min(bound, this.actor.position.x + intent.lateral * dt * 1.8));
      this.actor.position.z = Math.max(-bound, Math.min(bound, this.actor.position.z - intent.forward * dt * 1.8));
    }
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
    return [{ id: "today-gate", label: "Today Gate", x: PLAZA.destination.x, y: 2.95, z: PLAZA.destination.z },
      ...SOCKETS.map((s) => ({ ...s, y: 0, z: s.z + 0.55 }))].map((label) => {
      const point = new Vector3(label.x, label.y, label.z).project(this.camera);
      return { id: label.id, label: label.label, left: (point.x + 1) * 50, top: (1 - point.y) * 50 };
    });
  }

  dispose(renderer?: WebGLRenderer) {
    if (this.#disposed) return;
    this.#disposed = true;
    disposeScene(this.scene, renderer);
    this.scene.clear();
  }
}
