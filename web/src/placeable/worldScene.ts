import {
  AmbientLight, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight,
  DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PerspectiveCamera,
  RingGeometry, Scene, SphereGeometry, Vector3, type Material,
} from "three";
import { E1_LIVING_CITY_ENTRY_SCENE_PROFILE as PLAZA } from "../../transcend-lab/src/platform/spatial/e1LivingCityEntrySceneProfile";
import { LIVING_WEEK_SCENE_PLAN as PATH } from "../../transcend-lab/src/platform/spatial/livingWeekScenePlan";
import type { MovementIntent } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";
import { ASSET, COLORS, SOCKETS, type Selection } from "./contract";

// Rendering receives a projection only. It has no storage, identity, API or health access.
export type PlaceableProjection = Readonly<{
  selection: Selection | null;
  preview: boolean;
  pulse: number;
  suspended: boolean;
  canInteract: boolean;
}>;
export const PINWHEEL_RADIUS = 0.4;
const material = (color: string | number) => new MeshStandardMaterial({ color, roughness: 0.82 });

export class PlaceableScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(48, 1, 0.1, 60);
  readonly pinwheel = new Group();
  readonly rotor = new Group();
  readonly actor = new Group();
  readonly socketRings = new Group();
  readonly bladeMaterial = material(COLORS.coral);
  #pinwheelMaterials: MeshStandardMaterial[] = [];
  #pulse = 0;
  #feedbackLeft = 0;
  #disposed = false;
  #reducedMotion = false;
  #preview = false;
  #suspended = true;

  constructor() {
    this.scene.background = new Color("#dce8d5");
    this.scene.add(new AmbientLight(0xffffff, 2.2));
    const sun = new DirectionalLight(0xfff2d1, 3);
    sun.position.set(-3, 8, 5); this.scene.add(sun);
    const ground = new Mesh(new BoxGeometry(PLAZA.groundSize, 0.16, PLAZA.groundSize), material("#d0dec0"));
    ground.position.y = -0.08; ground.name = "e1-plaza-ground"; this.scene.add(ground);
    // Use the actual E1 landmark/path coordinates, never persistence destinations.
    for (const segment of PATH.segments) {
      const path = new Mesh(new BoxGeometry(0.18, 0.025, segment.lengthMetres), material("#bacba9"));
      path.position.set((segment.start.x + segment.end.x) / 2, 0.015, (segment.start.z + segment.end.z) / 2);
      path.rotation.y = Math.atan2(segment.end.x - segment.start.x, segment.end.z - segment.start.z);
      path.name = segment.id; this.scene.add(path);
    }
    for (const marker of PATH.markers) {
      const disc = new Mesh(new CylinderGeometry(0.24, 0.3, 0.07, 24), material("#eff1d6"));
      disc.position.set(marker.position.x, 0.05, marker.position.z);
      disc.name = marker.id; this.scene.add(disc);
    }
    const approach = new Mesh(new BoxGeometry(0.75, 0.03, 2.5), material("#f1e5c4"));
    approach.position.set(0, 0.02, -0.9); this.scene.add(approach);
    const gate = new Group(); gate.name = PLAZA.destination.id;
    gate.position.set(PLAZA.destination.x, 0, PLAZA.destination.z);
    const gateMaterial = material("#527961");
    for (const x of [-0.56, 0.56]) {
      const post = new Mesh(new BoxGeometry(0.16, 1.55, 0.16), gateMaterial);
      post.position.set(x, 0.775, 0); gate.add(post);
    }
    const beam = new Mesh(new BoxGeometry(1.4, 0.2, 0.2), gateMaterial);
    beam.position.y = 1.55; gate.add(beam); this.scene.add(gate);
    for (const socket of SOCKETS) {
      const ring = new Mesh(new RingGeometry(0.31, PINWHEEL_RADIUS, 40), material("#819f86"));
      ring.name = socket.id; ring.rotation.x = -Math.PI / 2;
      ring.position.set(socket.x, 0.04, socket.z); this.socketRings.add(ring);
    }
    this.scene.add(this.socketRings);
    this.pinwheel.name = ASSET; this.pinwheel.visible = false;
    const stemMaterial = material("#99744d"), hubMaterial = material("#fff8df");
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
    const body = new Mesh(new CylinderGeometry(0.16, 0.2, 0.35, 20), material("#5e7896"));
    body.position.y = 0.23; this.actor.add(body);
    const head = new Mesh(new SphereGeometry(0.16, 20, 16), material("#fff0cc"));
    head.position.y = 0.52; this.actor.add(head); this.actor.name = "plaza-visitor";
    this.scene.add(this.actor); this.resize(1);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    // Keep the authored sockets and plaza in view on portrait screens too.
    const distance = Math.max(1, 0.95 / aspect);
    this.camera.position.set(0, 7.5 * distance, 8.5 * distance);
    this.camera.lookAt(0, 0, 0); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }

  update(projection: PlaceableProjection, reducedMotion: boolean) {
    if (this.#disposed) return;
    this.#reducedMotion = reducedMotion; this.#preview = projection.preview; this.#suspended = projection.suspended;
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
  }

  #feedback() {
    this.bladeMaterial.emissive.set(this.#feedbackLeft > 0 ? "#ffdc79" : "#000000");
    this.bladeMaterial.emissiveIntensity = this.#feedbackLeft > 0 ? 0.45 : 0;
  }

  labels() {
    return [{ id: "today-gate", label: "Today Gate", x: PLAZA.destination.x, y: 1.85, z: PLAZA.destination.z },
      ...SOCKETS.map((s) => ({ ...s, y: 0, z: s.z + 0.55 }))].map((label) => {
      const point = new Vector3(label.x, label.y, label.z).project(this.camera);
      return { id: label.id, label: label.label, left: (point.x + 1) * 50, top: (1 - point.y) * 50 };
    });
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
    });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((m) => m.dispose());
    this.scene.clear();
  }
}
