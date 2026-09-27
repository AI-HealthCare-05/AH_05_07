import { AmbientLight, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group, Mesh,
  MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, type WebGLRenderer } from "three";
import { createLandmark } from "../components/scene/environment";
import { disposeScene } from "../components/scene/disposeScene";
import type { MovementIntent } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";

/** A visit-local place: no placement projection, health, account or storage inputs. */
export class GardenScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(43, 1, 0.1, 40);
  readonly actor = new Group();
  readonly pavilion = createLandmark("pavilion");
  #disposed = false;

  constructor() {
    // Same clay daylight grammar as My Space. The pavilion is the only hero.
    this.scene.background = new Color("#eee8db");
    this.scene.add(new AmbientLight(0xe8ecff, 1.5));
    const sun = new DirectionalLight(0xffe4b8, 2.4);
    sun.position.set(-3, 8, 5); this.scene.add(sun);
    const material = (color: string) => new MeshStandardMaterial({ color, roughness: 0.94 });
    const ground = new Mesh(new CylinderGeometry(3.8, 3.9, 0.25, 64), material("#e0d7b9"));
    ground.scale.x = 0.86; ground.position.set(0, -0.14, 0.2); this.scene.add(ground);
    const path = new Mesh(new BoxGeometry(0.95, 0.035, 2.9), material("#f5ead4"));
    path.position.set(0, 0.025, 1.45); this.scene.add(path);
    // Bounded adaptation: scale/placement only; original materials and authored roof remain.
    this.pavilion.name = "garden-pavilion";
    this.pavilion.scale.setScalar(1.35); this.pavilion.position.set(0, 0, -1.1);
    this.scene.add(this.pavilion);
    for (const [x, z] of [[-2.4, 0.3], [2.35, 0.1], [-2.15, 1.9], [2.1, 2.2]]) {
      const planting = new Mesh(new SphereGeometry(0.6, 20, 12), material("#829579"));
      planting.scale.set(1, 0.45, 0.8); planting.position.set(x, 0.17, z); this.scene.add(planting);
    }
    this.actor.name = "garden-companion";
    this.actor.position.set(-0.85, 0.17, 2.2); this.scene.add(this.actor);
    this.resize(1);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    const distance = Math.max(1, 1.1 / aspect);
    this.camera.position.set(0, 5.6 * distance, 8.5 * distance);
    this.camera.lookAt(0, 0.65, 0.1); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
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
    this.#disposed = true; disposeScene(this.scene, renderer); this.scene.clear();
  }
}
