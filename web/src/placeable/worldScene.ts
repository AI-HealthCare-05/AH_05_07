import {
  AmbientLight, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight,
  DataTexture, DoubleSide, Float32BufferAttribute, Fog, Group, HemisphereLight, LinearFilter, Mesh, MeshStandardMaterial, PerspectiveCamera,
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
  // Exact pinwheel draft signal. Generic preview may instead be keepsake-only.
  pinwheelPreview?: boolean;
}>;
export const PINWHEEL_RADIUS = 0.4;
export const PINWHEEL_PREVIEW_CUE = Object.freeze({
  durationSeconds: 0.24,
  maxAngleRadians: Math.PI / 14,
});
// A small clay palette: light separates surfaces without metallic highlights.
const finishes = { stone: 0.96, paving: 0.88, wood: 0.74, foliage: 1, gate: 0.68, trim: 0.58, accent: 0.5 } as const;
const material = (color: string | number, family: keyof typeof finishes = "stone") =>
  new MeshStandardMaterial({ color, roughness: finishes[family] });
const mood = {
  sky: [new Color("#e5e9df"), new Color("#303c59")],
  ground: [new Color("#cfc7b2"), new Color("#73758a")],
  approach: [new Color("#eee4cf"), new Color("#b2a9ad")],
  surroundings: [new Color("#8b9b88"), new Color("#505e6b")],
  ambient: [new Color(0xe8ecff), new Color("#c4d0ff")],
  fill: [new Color("#e5efff"), new Color("#b4c6ee")],
  sun: [new Color(0xffe4b8), new Color("#ccd9ff")],
} as const;
const ramp = (time: number, start: number, duration: number) => {
  const value = Math.max(0, Math.min(1, (time - start) / duration));
  return value * value * (3 - 2 * value);
};

export type PlazaSceneryProfile = "full" | "compact";

export const PLAZA_COMPACT_SCENERY_LIMITS = Object.freeze({
  width: 560,
  height: 420,
});

/** Host geometry selects presentation density only; it is not a device/performance guess. */
export function resolvePlazaSceneryProfile(width: number, height: number): PlazaSceneryProfile {
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) return "compact";
  return width < PLAZA_COMPACT_SCENERY_LIMITS.width
    || height < PLAZA_COMPACT_SCENERY_LIMITS.height
    ? "compact"
    : "full";
}

export type TodayGateProximity = "far" | "approach" | "arrived";

/** Presentation-only approach envelope derived from the existing E1 arrival authority.
 *  The E1 destination radius remains the sole arrival threshold. */
export const TODAY_GATE_APPROACH_RADIUS = PLAZA.destination.radius * 3;

export const GARDEN_ENTRANCE = Object.freeze({
  id: "garden-entrance",
  label: "정원 쉼터",
  x: 3.05,
  z: -0.8,
});

export const RECORDS_DESTINATION = Object.freeze({
  id: "records-archive",
  label: "기록 찾아보기",
  x: -2.4,
  z: 1.1,
});

export function resolveTodayGateProximity(
  position: Readonly<{ x: number; z: number }>,
): TodayGateProximity {
  const distance = Math.hypot(
    position.x - PLAZA.destination.x,
    position.z - PLAZA.destination.z,
  );
  if (!Number.isFinite(distance)) return "far";
  if (distance <= PLAZA.destination.radius) return "arrived";
  return distance <= TODAY_GATE_APPROACH_RADIUS ? "approach" : "far";
}

export class PlaceableScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(48, 1, 0.1, 60);
  readonly choiceMarker = createLivingChoiceMarker();
  readonly pinwheel = new Group();
  // Existing rotor owns real pinwheel play. The inner group owns preview-only motion.
  readonly rotor = new Group();
  readonly previewRotor = new Group();
  readonly actor = new Group();
  readonly locomotion = new PlazaLocomotion();
  readonly cameraRig = new PlazaCameraRig();
  readonly gate = new Group();
  readonly gardenDestination = new Group();
  readonly gardenEntrance = new Group();
  readonly recordsDestination = new Group();
  readonly recordsArchive = new Group();
  readonly anchorScenery = new Group();
  readonly optionalScenery = new Group();
  #cameraObstacles: CameraObstacle[] = [];
  #sceneryProfile: PlazaSceneryProfile = "full";
  readonly socketRings = new Group();
  readonly socketTargets = new Group();
  readonly bladeMaterial = material(COLORS.coral, "accent");
  readonly ambient = new AmbientLight(0xe8ecff, 0.45);
  readonly skyFill = new HemisphereLight("#e5efff", "#8e826d", 1.65);
  readonly sun = new DirectionalLight(0xffe4b8, 3);
  readonly groundMaterial = material("#cfc7b2");
  readonly surroundingsMaterial = material("#8b9b88", "foliage");
  readonly gateMaterial = material("#77638f", "gate");
  readonly archLightMaterial = material("#dfbc7d", "accent");
  readonly approachMaterial = material("#eee4cf", "paving");
  #detailMaterials: MeshStandardMaterial[] = [];
  #twilight = false;
  #welcomeTime = 0;
  #greetingPending = false;
  #pinwheelMaterials: MeshStandardMaterial[] = [];
  #pulse = 0;
  #feedbackLeft = 0;
  #previewCueLeft = 0;
  #previewSelectionKey: string | null = null;
  #disposed = false;
  #reducedMotion = false;
  #preview = false;
  #suspended = true;
  #placementEditing = false;

  constructor() {
    // Daylight is the truthful default for every visit; no wall clock or stored mood.
    this.scene.background = mood.sky[0].clone();
    this.scene.fog = new Fog(mood.sky[0], 12, 36);
    this.scene.add(this.ambient, this.skyFill);
    const sun = this.sun;
    sun.position.set(-5, 9, 3); this.scene.add(sun);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 25 });
    sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.012;
    // The circular foundation covers the unchanged square walking bounds, including corners.
    const groundRadius = PATH.boundMetres * Math.SQRT2;
    const ground = new Mesh(new CylinderGeometry(groundRadius, groundRadius + 0.15, 0.25, 96), this.groundMaterial);
    ground.position.y = -0.14; ground.name = "e1-plaza-ground"; this.scene.add(ground);
    // A civic square extends into its neighborhood, rather than floating in a void.
    const surroundings = new Mesh(new CylinderGeometry(28, 28, 0.2, 96), this.surroundingsMaterial);
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
    const stone = material("#bcb6a6", "paving"), edging = material("#a99e8e");
    for (let z = -3.3; z < 5; z += 0.65) {
      const joint = new Mesh(new BoxGeometry(1.64, 0.008, 0.018), stone);
      joint.position.set(0, 0.041, z); this.scene.add(joint);
    }
    // The Garden route now terminates at a reachable Plaza destination.
    // It remains presentation-only; activation is emitted separately by the renderer.
    this.gardenDestination.name = "plaza-garden-destination";
    const gardenPathMaterial = material("#c4c5a3", "paving");
    const gardenRoutePoints = [
      [0.7, 2.2],
      [0.8, 1.25],
      [1.55, 0.65],
      [2.35, -0.05],
      [GARDEN_ENTRANCE.x, GARDEN_ENTRANCE.z],
    ] as const;
    for (let index = 0; index < gardenRoutePoints.length - 1; index++) {
      const [startX, startZ] = gardenRoutePoints[index];
      const [endX, endZ] = gardenRoutePoints[index + 1];
      const length = Math.hypot(endX - startX, endZ - startZ);
      const segment = new Mesh(
        new BoxGeometry(0.62, 0.025, length),
        gardenPathMaterial,
      );
      segment.name = `garden-route-${index}`;
      segment.position.set(
        (startX + endX) / 2,
        0.035,
        (startZ + endZ) / 2,
      );
      segment.rotation.y = Math.atan2(endX - startX, endZ - startZ);
      this.gardenDestination.add(segment);
    }
    const gate = this.gate; gate.name = PLAZA.destination.id;
    gate.position.set(PLAZA.destination.x, 0, PLAZA.destination.z);
    gate.scale.set(1.35, 1.45, 1.35);
    const gateMaterial = this.gateMaterial, trimMaterial = material("#c4b4ce", "trim");
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
    const leaves = [material("#486a60", "foliage"), material("#678576", "foliage"), material("#92a184", "foliage")];
    const trunk = material("#80664e", "wood");

    // A low pergola silhouette makes Garden legible as a destination without
    // borrowing the Today Gate's arch language or requiring explanatory copy.
    this.gardenEntrance.name = GARDEN_ENTRANCE.id;
    this.gardenEntrance.position.set(
      GARDEN_ENTRANCE.x,
      0,
      GARDEN_ENTRANCE.z,
    );
    const gardenStone = material("#a9a58f", "stone");
    const gardenSign = material("#d8d3a7", "trim");
    for (const [index, x] of [-0.62, 0.62].entries()) {
      const post = new Mesh(
        new BoxGeometry(0.16, 1.5, 0.16),
        trunk,
      );
      post.name = `garden-entrance-post-${index}`;
      post.position.set(x, 0.75, 0);
      this.gardenEntrance.add(post);

      const base = new Mesh(
        new BoxGeometry(0.4, 0.22, 0.42),
        gardenStone,
      );
      base.name = `garden-entrance-base-${index}`;
      base.position.set(x, 0.11, 0);
      this.gardenEntrance.add(base);

      const foliage = new Mesh(
        new SphereGeometry(0.38, 12, 8),
        leaves[index],
      );
      foliage.name = `garden-entrance-foliage-${index}`;
      foliage.scale.set(1.05, 0.72, 0.9);
      foliage.position.set(x, 1.62, 0);
      this.gardenEntrance.add(foliage);
    }

    const lintel = new Mesh(
      new BoxGeometry(1.52, 0.16, 0.22),
      trunk,
    );
    lintel.name = "garden-entrance-lintel";
    lintel.position.set(0, 1.5, 0);
    this.gardenEntrance.add(lintel);

    const sign = new Mesh(
      new BoxGeometry(0.78, 0.32, 0.12),
      gardenSign,
    );
    sign.name = "garden-entrance-sign";
    sign.position.set(0, 1.15, 0.05);
    this.gardenEntrance.add(sign);

    this.gardenDestination.add(this.gardenEntrance);
    this.scene.add(this.gardenDestination);

    // Records is a navigation-only semantic destination. This low archive kiosk
    // receives no record count/date/BP/session input and has no autonomous state.
    this.recordsDestination.name = "plaza-records-destination";
    this.recordsArchive.name = RECORDS_DESTINATION.id;
    this.recordsArchive.position.set(
      RECORDS_DESTINATION.x,
      0,
      RECORDS_DESTINATION.z,
    );
    const archiveStone = material("#b7b09c", "stone");
    const archiveWood = material("#756955", "wood");
    const archivePaper = material("#ddd6bd", "trim");
    const archiveAccent = material("#596d63", "accent");

    const archiveBase = new Mesh(
      new BoxGeometry(1.04, 0.18, 0.62),
      archiveStone,
    );
    archiveBase.name = "records-archive-base";
    archiveBase.position.y = 0.09;
    this.recordsArchive.add(archiveBase);

    const archiveBody = new Mesh(
      new BoxGeometry(0.9, 0.72, 0.5),
      archiveWood,
    );
    archiveBody.name = "records-archive-body";
    archiveBody.position.y = 0.5;
    this.recordsArchive.add(archiveBody);

    const archiveCap = new Mesh(
      new BoxGeometry(1.02, 0.1, 0.6),
      archiveStone,
    );
    archiveCap.name = "records-archive-cap";
    archiveCap.position.y = 0.91;
    this.recordsArchive.add(archiveCap);

    const archiveSign = new Mesh(
      new BoxGeometry(0.64, 0.24, 0.055),
      archivePaper,
    );
    archiveSign.name = "records-archive-sign";
    archiveSign.position.set(0, 0.72, 0.28);
    this.recordsArchive.add(archiveSign);

    for (const [index, x] of [-0.22, 0, 0.22].entries()) {
      const ledger = new Mesh(
        new BoxGeometry(0.12, 0.27, 0.045),
        archiveAccent,
      );
      ledger.name = `records-archive-ledger-${index}`;
      ledger.position.set(x, 0.45, 0.275);
      this.recordsArchive.add(ledger);
    }

    this.recordsDestination.add(this.recordsArchive);
    this.scene.add(this.recordsDestination);

    this.anchorScenery.name = "plaza-scenery-anchor";
    this.optionalScenery.name = "plaza-scenery-optional";

    // Two framing trees remain in every profile; the farther pair is optional.
    const treeSites = [
      [-3.6, -3.2, 3.4, 1.1],
      [3.8, -4.6, 3.9, 1.25],
      [-5.8, 0.5, 2.9, 1],
      [6.6, -2.4, 3, 1],
    ] as const;
    treeSites.forEach(([x, z, height, spread], index) => {
      const owner = index < 2 ? this.anchorScenery : this.optionalScenery;
      const role = index < 2 ? "anchor" : "optional";
      const stem = new Mesh(new CylinderGeometry(0.1, 0.17, height - 0.7, 10), trunk);
      stem.name = `plaza-${role}-tree-${index}-stem`;
      stem.position.set(x, (height - 0.7) / 2, z); owner.add(stem);
      for (let n = 0; n < 3; n++) {
        const canopy = new Mesh(new SphereGeometry(spread, 12, 8), leaves[n]);
        canopy.name = `plaza-${role}-tree-${index}-canopy-${n}`;
        canopy.scale.set(1 - n * 0.12, 0.65, 0.85);
        canopy.position.set(x + (n - 1) * 0.28, height - 0.65 + n * 0.4, z + n * 0.12);
        owner.add(canopy);
      }
    });

    // The near pair keeps plaza silhouette/grounding; peripheral beds are optional.
    const bedSites = [
      [-3.5, -1.1, 1.7],
      [3.5, -2, 1.5],
      [-3.4, 3.6, 2.4],
      [4.1, 3.1, 1.8],
      [-2.7, -4.8, 2.5],
      [2.9, -5.4, 2.1],
    ] as const;
    bedSites.forEach(([x, z, width], index) => {
      const owner = index < 2 ? this.anchorScenery : this.optionalScenery;
      const role = index < 2 ? "anchor" : "optional";
      const bed = new Mesh(new BoxGeometry(width, 0.3, 0.95), edging);
      bed.name = `plaza-${role}-bed-${index}`;
      bed.position.set(x, 0.12, z); owner.add(bed);
      for (let n = 0; n < 4; n++) {
        const shrub = new Mesh(new SphereGeometry(0.46, 12, 8), leaves[n % 3]);
        shrub.name = `plaza-${role}-bed-${index}-shrub-${n}`;
        shrub.scale.set(0.9, 0.6 + (n % 2) * 0.25, 0.85);
        shrub.position.set(x - width / 2 + 0.25 + n * (width - 0.5) / 3, 0.38, z);
        owner.add(shrub);
      }
    });

    // Quiet seats remain as compact-profile grounding landmarks.
    for (const [index, x] of [-3.15, 3.2].entries()) {
      const seat = new Mesh(new BoxGeometry(1.25, 0.14, 0.48), trunk);
      seat.name = `plaza-anchor-seat-${index}`;
      seat.position.set(x, 0.46, 0.2); this.anchorScenery.add(seat);
      for (const [legIndex, offset] of [-0.43, 0.43].entries()) {
        const leg = new Mesh(new BoxGeometry(0.16, 0.4, 0.38), stone);
        leg.name = `plaza-anchor-seat-${index}-leg-${legIndex}`;
        leg.position.set(x + offset, 0.2, 0.2); this.anchorScenery.add(leg);
      }
    }

    this.scene.add(this.anchorScenery, this.optionalScenery);

    // Camera proxies are rebuilt from exactly the scenery that is currently visible.
    this.#rebuildCameraObstacles();
    const socketHitMaterial = new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (const socket of SOCKETS) {
      const ring = new Mesh(
        new RingGeometry(0.31, PINWHEEL_RADIUS, 40),
        material("#819f86"),
      );
      ring.name = socket.id;
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(socket.x, 0.04, socket.z);
      this.socketRings.add(ring);

      // #997: a forgiving edit-only hit surface shares the authored SOCKETS
      // coordinates. It owns no selection or persistence state.
      const target = new Mesh(
        new CircleGeometry(PINWHEEL_RADIUS * 1.45, 32),
        socketHitMaterial,
      );
      target.name = socket.id;
      target.rotation.x = -Math.PI / 2;
      target.position.set(socket.x, 0.055, socket.z);
      this.socketTargets.add(target);
    }
    this.socketRings.visible = false;
    this.socketTargets.visible = false;
    this.scene.add(this.socketRings, this.socketTargets);
    this.scene.add(this.choiceMarker);
    this.choiceMarker.position.x = -2.15;
    this.pinwheel.name = ASSET; this.pinwheel.visible = false;
    const stemMaterial = material("#99744d", "wood"), hubMaterial = material("#fff8df", "accent");
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
      mesh.rotation.z = index * Math.PI / 2; this.previewRotor.add(mesh);
    }
    const hub = new Mesh(new SphereGeometry(0.045, 16, 12), hubMaterial);
    hub.position.z = 0.06; this.previewRotor.add(hub);
    this.rotor.add(this.previewRotor);
    this.pinwheel.add(this.rotor); this.scene.add(this.pinwheel);
    this.actor.name = "plaza-companion";
    this.actor.position.set(-1.3, 0, 1.25);
    // A tiny generated falloff removes the hard disc edge under the real GLB.
    // Owned by this scene and disposed through the existing material-map teardown.
    const pixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4;
      const falloff = Math.max(0, 1 - Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5));
      pixels.set([255, 255, 255, Math.round(falloff * falloff * 255)], i);
    }
    const contactMap = new DataTexture(pixels, 32, 32);
    contactMap.magFilter = LinearFilter; contactMap.needsUpdate = true;
    const contact = new Mesh(new CircleGeometry(0.46, 32), new MeshBasicMaterial({ color: "#3e3935", map: contactMap, transparent: true, opacity: 0.38, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = 0.055; contact.scale.y = 0.75;
    this.actor.add(contact);
    this.scene.add(this.actor);
    this.scene.traverse((object) => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    contact.castShadow = false; contact.receiveShadow = false;
    this.socketRings.traverse((object) => { object.castShadow = false; });
    this.resize(1);
  }

  #rebuildCameraObstacles() {
    this.scene.updateMatrixWorld(true);
    const next: CameraObstacle[] = [];
    const roots = [
      this.gate,
      ...(this.gardenDestination.visible ? [this.gardenDestination] : []),
      ...(this.recordsDestination.visible ? [this.recordsDestination] : []),
      this.anchorScenery,
      ...(this.#sceneryProfile === "full" ? [this.optionalScenery] : []),
    ];
    for (const root of roots) root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const box = new Box3().setFromObject(object);
      if (box.max.y < 0.6) return;
      const id = object.name || `${root.name}-${next.length}`;
      next.push(cameraObstacle(id,
        worldPoint(box.min.x, box.min.y, box.min.z),
        worldPoint(box.max.x, box.max.y, box.max.z)));
    });
    this.#cameraObstacles = next;
  }

  get todayGateProximity(): TodayGateProximity {
    return resolveTodayGateProximity(this.actor.position);
  }

  get sceneryProfile() { return this.#sceneryProfile; }
  get cameraObstacles(): readonly CameraObstacle[] { return this.#cameraObstacles; }

  setGardenAvailable(available: boolean) {
    if (this.#disposed || this.gardenDestination.visible === available) return;
    this.gardenDestination.visible = available;
    this.#rebuildCameraObstacles();
  }

  setRecordsAvailable(available: boolean) {
    if (this.#disposed || this.recordsDestination.visible === available) return;
    this.recordsDestination.visible = available;
    this.#rebuildCameraObstacles();
  }

  setPlacementEditing(editing: boolean) {
    if (this.#disposed || editing === this.#placementEditing) return;
    this.#placementEditing = editing;
    this.socketRings.visible = editing;
    this.socketTargets.visible = editing;
  }

  setSceneryProfile(profile: PlazaSceneryProfile) {
    if (this.#disposed || profile === this.#sceneryProfile) return;
    this.#sceneryProfile = profile;
    this.optionalScenery.visible = profile === "full";
    this.#rebuildCameraObstacles();
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

    const selection = projection.selection;
    const previewSelectionKey = projection.preview && projection.pinwheelPreview && selection
      ? `${selection.assetId}:${selection.color}:${selection.socketId}`
      : null;
    const previewSelectionChanged = previewSelectionKey !== null
      && previewSelectionKey !== this.#previewSelectionKey;
    this.#previewSelectionKey = previewSelectionKey;

    if (reducedMotion) {
      this.rotor.rotation.z = 0;
      this.#previewCueLeft = 0;
      this.previewRotor.rotation.z = 0;
    } else if (previewSelectionChanged) {
      // Latest admitted draft replaces the previous local cue; nothing queues.
      this.#previewCueLeft = PINWHEEL_PREVIEW_CUE.durationSeconds;
      this.previewRotor.rotation.z = 0;
    } else if (previewSelectionKey === null) {
      // Cancel, pinwheel removal, keepsake-only preview and confirmed state are static here.
      this.#previewCueLeft = 0;
      this.previewRotor.rotation.z = 0;
    }

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
      const selected = selection?.socketId === ring.name;
      ring.material.color.set(
        selected
          ? projection.preview
            ? "#c5a339"
            : "#238b88"
          : "#819f86",
      );
      // Shape as well as color distinguishes the selected authored socket.
      ring.scale.setScalar(this.#placementEditing && selected ? 1.18 : 1);
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

    if (this.#previewCueLeft > 0) {
      this.#previewCueLeft = Math.max(0, this.#previewCueLeft - dt);
      if (this.#reducedMotion || !this.#preview || !this.#previewSelectionKey || this.#previewCueLeft === 0) {
        this.previewRotor.rotation.z = 0;
      } else {
        const progress = 1 - this.#previewCueLeft / PINWHEEL_PREVIEW_CUE.durationSeconds;
        this.previewRotor.rotation.z = Math.sin(Math.PI * progress) * PINWHEEL_PREVIEW_CUE.maxAngleRadians;
      }
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
    (this.scene.fog as Fog).color.copy(this.scene.background as Color);
    this.groundMaterial.color.copy(mood.ground[0]).lerp(mood.ground[1], environment);
    this.ambient.color.copy(mood.ambient[0]).lerp(mood.ambient[1], environment);
    this.surroundingsMaterial.color.copy(mood.surroundings[0]).lerp(mood.surroundings[1], environment);
    this.ambient.intensity = 0.45 + 0.1 * environment;
    this.skyFill.color.copy(mood.fill[0]).lerp(mood.fill[1], environment);
    this.skyFill.intensity = 1.65 - 0.35 * environment;
    this.sun.color.copy(mood.sun[0]).lerp(mood.sun[1], environment);
    this.sun.intensity = 3 - 1.4 * environment;
    this.gateMaterial.emissive.set("#806f9f"); this.gateMaterial.emissiveIntensity = gate * 0.16;
    this.archLightMaterial.emissive.set("#ffd18a"); this.archLightMaterial.emissiveIntensity = gate * 0.85;
    this.approachMaterial.emissive.set("#e4caaa"); this.approachMaterial.emissiveIntensity = route * 0.035;
    this.approachMaterial.color.copy(mood.approach[0]).lerp(mood.approach[1], environment);
    for (const material of this.#detailMaterials) {
      material.emissive.set("#f8dcb2"); material.emissiveIntensity = detail * 0.07;
    }
  }

  #feedback() {
    const detail = ramp(this.#welcomeTime, 1.05, 0.55);
    this.bladeMaterial.emissive.set(this.#feedbackLeft > 0 || detail > 0 ? "#ffdc79" : "#000000");
    this.bladeMaterial.emissiveIntensity = this.#feedbackLeft > 0 ? 0.45 : detail * 0.025;
  }

  labels() {
    const destinations = [
      { id: "today-gate", label: "오늘의 기록", x: PLAZA.destination.x, y: 4.15, z: PLAZA.destination.z },
      ...(this.gardenDestination.visible
        ? [{
            id: GARDEN_ENTRANCE.id,
            label: GARDEN_ENTRANCE.label,
            x: GARDEN_ENTRANCE.x,
            y: 1.15,
            z: GARDEN_ENTRANCE.z,
          }]
        : []),
      ...(this.recordsDestination.visible
        ? [{
            id: RECORDS_DESTINATION.id,
            label: RECORDS_DESTINATION.label,
            x: RECORDS_DESTINATION.x,
            y: 1.08,
            z: RECORDS_DESTINATION.z,
          }]
        : []),
    ];
    const sockets = SOCKETS.map((socket) => ({
      ...socket,
      // During placement editing the projected label is centered on the same
      // world point used by the raycast target, so the visible place teaches
      // the actual selectable location.
      y: this.#placementEditing ? 0.055 : 0,
      z: this.#placementEditing ? socket.z : socket.z + 0.55,
    }));
    const ordered = this.#placementEditing
      ? [...sockets, ...destinations]
      : [...destinations, ...sockets];
    return ordered.map((label) => {
      const point = new Vector3(label.x, label.y, label.z).project(this.camera);
      const visible = point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 0.9 && Math.abs(point.y) < 0.94;
      return { id: label.id, label: label.label, left: (point.x + 1) * 50, top: (1 - point.y) * 50, visible };
    });
  }

  dispose(renderer?: WebGLRenderer) {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#previewCueLeft = 0;
    this.#previewSelectionKey = null;
    this.previewRotor.rotation.z = 0;
    disposeScene(this.scene, renderer);
    this.scene.clear();
  }
}
