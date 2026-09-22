import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { disposeScene } from "./disposeScene";

export type SceneActorBounds = Readonly<{
  left: number;
  right: number;
  bottom: number;
  top: number;
  height: number;
}>;

type S02SceneActorOwnerOptions = Readonly<{
  scene: THREE.Scene;
  assetUrl: string;
  characterScale: number;
  onLoaded: () => void;
  onFailure: () => void;
}>;

/** Owns the S02 actor only; renderer, camera and environment stay with the scene. */
export class S02SceneActorOwner {
  readonly assetUrl: string;
  readonly #scene: THREE.Scene;
  readonly #characterScale: number;
  readonly #onLoaded: () => void;
  readonly #onFailure: () => void;

  #started = false;
  #disposed = false;
  #worldRoot: THREE.Group | null = null;

  constructor(options: S02SceneActorOwnerOptions) {
    this.#scene = options.scene;
    this.assetUrl = options.assetUrl;
    this.#characterScale = options.characterScale;
    this.#onLoaded = options.onLoaded;
    this.#onFailure = options.onFailure;
  }

  get worldRoot(): THREE.Group | null {
    return this.#worldRoot;
  }

  start(): void {
    if (this.#started || this.#disposed) return;
    this.#started = true;

    new GLTFLoader().load(this.assetUrl, (gltf) => {
      if (this.#disposed) {
        disposeScene(gltf.scene);
        return;
      }
      if (!gltf.animations.some((clip) => clip.name === "idle")) {
        disposeScene(gltf.scene);
        this.#onFailure();
        return;
      }

      const normalized = new THREE.Group();
      normalized.add(gltf.scene);

      const worldRoot = new THREE.Group();
      worldRoot.name = "sk7-presence-actor-root";
      worldRoot.add(normalized);

      const bounds = new THREE.Box3().setFromObject(worldRoot);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = (1.65 / Math.max(size.y, 0.001)) * this.#characterScale;

      normalized.scale.setScalar(scale);
      normalized.position.set(
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale,
      );

      this.#worldRoot = worldRoot;
      this.#scene.add(worldRoot);
      this.#onLoaded();
    }, undefined, () => {
      if (!this.#disposed) this.#onFailure();
    });
  }

  setAnchor(anchor: readonly [number, number, number]): void {
    this.#worldRoot?.position.fromArray(anchor);
  }

  measure(camera: THREE.Camera, stageHeight: number): SceneActorBounds | null {
    if (!this.#worldRoot) return null;
    const bounds = new THREE.Box3().setFromObject(this.#worldRoot);
    const corners = [bounds.min.x, bounds.max.x].flatMap((x) =>
      [bounds.min.y, bounds.max.y].flatMap((y) =>
        [bounds.min.z, bounds.max.z].map((z) =>
          new THREE.Vector3(x, y, z).project(camera),
        ),
      ),
    );
    const left = Math.min(...corners.map((point) => point.x));
    const right = Math.max(...corners.map((point) => point.x));
    const bottom = Math.min(...corners.map((point) => point.y));
    const top = Math.max(...corners.map((point) => point.y));
    return Object.freeze({
      left,
      right,
      bottom,
      top,
      height: (top - bottom) * stageHeight / 2,
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const root = this.#worldRoot;
    this.#worldRoot = null;
    if (!root) return;
    this.#scene.remove(root);
    // Renderer-owned shared resources are released only by the final scene pass.
    disposeScene(root);
  }
}
