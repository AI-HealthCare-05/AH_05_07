import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CircleGeometry, Color, CylinderGeometry, ExtrudeGeometry,
  Fog, Group, HemisphereLight, LatheGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera,
  Scene, Shape, SphereGeometry, Vector2, Vector3, DirectionalLight, type WebGLRenderer } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  createLandmark,
  landmarkMaterialRole,
  type LandmarkMaterialRole,
} from "../components/scene/environment";
import { disposeScene } from "../components/scene/disposeScene";
import type { MovementIntent } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";

type GardenPavilionTreatment = Readonly<{ color: string; roughness?: number }>;
const GARDEN_PAVILION_TREATMENT: Partial<Record<LandmarkMaterialRole, GardenPavilionTreatment>> = {
  lavender: { color: "#465a65", roughness: 0.72 },
  wood: { color: "#a97548" },
  cream: { color: "#bec39b" },
};

/** Local Garden treatment selected by authored meaning, never by the source pixel color. */
export function styleGardenPavilion(pavilion: Group) {
  pavilion.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      const role = landmarkMaterialRole(material);
      if (!role) continue;
      const treatment = GARDEN_PAVILION_TREATMENT[role];
      if (!treatment) continue;
      material.color.set(treatment.color);
      if (treatment.roughness !== undefined) material.roughness = treatment.roughness;
    }
  });
}

/** A visit-local place: no placement projection, health, account or storage inputs. */
export class GardenScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 60);
  readonly actor = new Group();
  readonly pavilion = createLandmark("pavilion");
  #disposed = false;

  constructor() {
    this.scene.background = new Color("#dce8e3");
    this.scene.fog = new Fog("#dce8e3", 18, 36);
    this.scene.add(new HemisphereLight(0xe5f1ff, 0x817451, 2.1));
    const sun = new DirectionalLight(0xffe5ba, 3.1);
    sun.position.set(-5, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 25 });
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);

    // Static garden forms are batched by material, as in the shared landmark authoring.
    // All coordinates are composed deliberately; no random scatter or per-prop animation.
    const palette = { lawn: "#9ba879", edge: "#ae9d7e", stone: "#d2c8aa", path: "#eee0bf",
      bark: "#82684c", deep: "#466b58", sage: "#75936a", leaf: "#afbd82", flower: "#d3bc97" };
    type Tone = keyof typeof palette;
    const batches = new Map<Tone, BufferGeometry[]>();
    const add = (geometry: BufferGeometry, tone: Tone, position: number[], scale = [1, 1, 1]) => {
      geometry.scale(...scale as [number, number, number]);
      geometry.translate(...position as [number, number, number]);
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      const parts = batches.get(tone) ?? []; parts.push(flat); batches.set(tone, parts);
    };
    const mound = (position: number[], scale: number[], tone: Tone) =>
      add(new SphereGeometry(1, 16, 10), tone, position, scale);
    const island = (y: number, scale: number[], tone: Tone) => {
      const geometry = new LatheGeometry([[0, -0.5], [3.4, -0.5], [4.2, -0.32], [4.45, -0.08],
        [4.4, 0.06], [4.1, 0.13], [0, 0.13]].map(([x, y]) => new Vector2(x, y)), 64);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i), angle = Math.atan2(z, x);
        const contour = 1 + 0.055 * Math.sin(angle * 3 + 0.6) + 0.035 * Math.cos(angle * 5);
        positions.setXYZ(i, x * contour, positions.getY(i), z * contour);
      }
      geometry.computeVertexNormals(); add(geometry, tone, [0, y, 0.1], scale);
    };
    island(-0.26, [1.18, 1.1, 1.17], "edge");
    island(-0.02, [1.14, 0.75, 1.13], "lawn");

    // Recolor this instance only; shared S02/S10 geometry and posters stay intact.
    this.pavilion.name = "garden-pavilion";
    this.pavilion.scale.setScalar(1.8); this.pavilion.position.set(0, 0, -1.3);
    styleGardenPavilion(this.pavilion);
    // Local ring beams bridge column capitals (top 1.48) to the curved roof
    // rafters (~1.7 at the support lines). Overlap both ends to avoid daylight gaps.
    const supports = new Group(); supports.name = "garden-pavilion-supports";
    const timber = new MeshStandardMaterial({ color: "#a97548", roughness: 0.9 });
    for (const z of [-0.56, 0.22]) {
      const beam = new Mesh(new BoxGeometry(1.5, 0.3, 0.18), timber);
      beam.position.set(0, 1.6, z); supports.add(beam);
    }
    for (const x of [-0.61, 0.61]) {
      const beam = new Mesh(new BoxGeometry(0.18, 0.3, 0.96), timber);
      beam.position.set(x, 1.6, -0.17); supports.add(beam);
    }
    supports.traverse((object) => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    this.pavilion.add(supports);
    this.scene.add(this.pavilion);

    const route = new CatmullRomCurve3([new Vector3(0.9, 0, 4.8), new Vector3(-0.45, 0, 3.2),
      new Vector3(-0.5, 0, 1.9), new Vector3(0, 0, 0.55), new Vector3(0, 0, -0.12)]);
    const left: Vector2[] = [], right: Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, point = route.getPoint(t), tangent = route.getTangent(t);
      const halfWidth = 0.65 + 0.18 * Math.sin(Math.PI * t) + 0.2 * (1 - t);
      const side = new Vector3(-tangent.z, 0, tangent.x).multiplyScalar(halfWidth);
      left.push(new Vector2(point.x + side.x, -point.z - side.z));
      right.push(new Vector2(point.x - side.x, -point.z + side.z));
      if (i > 0 && i < 38 && i % 3 === 0) for (const direction of [-1, 1]) {
        mound([point.x + side.x * direction, 0.14, point.z + side.z * direction], [0.14, 0.075, 0.19], "stone");
      }
    }
    const path = new ExtrudeGeometry(new Shape([...left, ...right.reverse()]), { depth: 0.055, bevelEnabled: false });
    path.rotateX(-Math.PI / 2); add(path, "path", [0, 0.105, 0]);

    // A tall rear grove frames the roof; low near planting leaves the entire
    // existing movement rectangle open. Foreground leaves establish depth.
    const tree = (x: number, z: number, height: number, width: number, tone: Tone) => {
      add(new CylinderGeometry(0.07, 0.13, height, 9), "bark", [x, height / 2, z]);
      mound([x - width * 0.3, height, z], [width * 0.8, height * 0.3, width * 0.7], tone);
      mound([x + width * 0.35, height * 1.09, z - 0.13], [width * 0.62, height * 0.25, width * 0.62], tone);
      mound([x, height * 1.2, z - 0.08], [width * 0.62, height * 0.22, width * 0.6], "sage");
      const branch = new CylinderGeometry(0.035, 0.065, height * 0.45, 8);
      branch.rotateZ(-0.55); add(branch, "bark", [x + height * 0.11, height * 0.77, z]);
      mound([x - width * 0.65, height * 0.9, z + 0.17], [width * 0.5, height * 0.18, width * 0.45], tone);
    };
    tree(-3.15, -2.05, 2.8, 1.25, "deep");
    tree(-4.05, -0.85, 1.9, 0.95, "sage");
    tree(-3.65, 3.3, 1.5, 0.95, "deep");
    tree(3.35, -2.5, 2.35, 1.2, "sage");
    tree(4.15, -1.0, 1.6, 0.85, "leaf");
    for (const [x, z, width, height] of [[-2.6, 0.6, 0.8, 0.5], [-3.15, 1.4, 0.95, 0.7],
      [-2.65, 2.9, 0.85, 0.45], [2.7, 0.8, 0.65, 0.4], [3.35, 1.65, 1, 0.65], [3, 3, 0.6, 0.35]]) {
      mound([x, height * 0.48, z], [width, height, width * 0.65], "sage");
      mound([x + 0.35, height * 0.35, z + 0.28], [width * 0.65, height * 0.7, width * 0.5], "leaf");
    }
    for (const [x, z, size] of [[-2.35, 3.6, 0.7], [2.5, 3.9, 0.9], [-3.7, 2.3, 0.5], [2.25, -0.1, 0.5]]) {
      mound([x, 0.19, z], [size * 0.7, size * 0.34, size * 0.5], "stone");
      for (let i = 0; i < 5; i++) {
        const leaf = new SphereGeometry(1, 10, 8);
        leaf.scale(size * 0.11, size * 0.65, size * 0.15);
        leaf.rotateZ((i - 2) * 0.3); leaf.rotateY(i * 2.4);
        add(leaf, i % 2 ? "deep" : "sage", [x + 0.24, size * 0.45, z + 0.17]);
      }
      for (let i = 0; i < 3; i++) mound([x - 0.25 + i * 0.14, 0.35 + i * 0.035, z - 0.22], [0.075, 0.13, 0.075], "flower");
    }
    for (const [tone, parts] of batches) {
      const geometry = mergeGeometries(parts); parts.forEach((part) => part.dispose());
      if (!geometry) throw new Error("Garden geometry attributes must match");
      const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: palette[tone], roughness: 0.9 }));
      mesh.castShadow = tone !== "path"; mesh.receiveShadow = true; this.scene.add(mesh);
    }
    this.actor.name = "garden-companion";
    this.actor.position.set(-0.85, 0.17, 2.2); this.scene.add(this.actor);
    const contact = new Mesh(new CircleGeometry(0.32, 32), new MeshStandardMaterial({ color: "#4e5845", transparent: true, opacity: 0.19, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = 0.002; contact.scale.y = 0.7;
    this.actor.add(contact);
    this.resize(1);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    // Preserve the accepted wide view. Tall immersive screens stop retreating
    // into the fog; side planting may crop, while roof and walkable path stay visible.
    const distance = Math.max(1, Math.min(1.3 / aspect, 2.15));
    this.camera.position.set(2.1 * distance, 3.6 * distance, 8.6 * distance);
    this.camera.lookAt(0, 1.4, 0.1); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }

  get atPavilion() { return Math.abs(this.actor.position.x) < 0.7 && this.actor.position.z < 0.75; }
  approach() { if (!this.#disposed) this.actor.position.set(0, 0.17, 0.4); }
  step(seconds: number, intent: MovementIntent, resting: boolean) {
    if (this.#disposed || resting) return;
    const dt = Math.max(0, Math.min(seconds, 0.05));
    // The walkable front garden ends at the pavilion steps; never walk through its columns.
    this.actor.position.x = Math.max(-1.65, Math.min(1.65, this.actor.position.x + intent.lateral * dt * 1.6));
    this.actor.position.z = Math.max(0.35, Math.min(2.75, this.actor.position.z - intent.forward * dt * 1.6));
  }
  dispose(renderer?: WebGLRenderer) {
    if (this.#disposed) return;
    this.#disposed = true; disposeScene(this.scene, renderer);
    this.scene.traverse((object) => { if (object instanceof DirectionalLight) object.dispose(); });
    this.scene.clear();
  }
}
