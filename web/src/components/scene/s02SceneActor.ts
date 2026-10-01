import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { disposeScene } from "./disposeScene";
import type {
  PresenceSceneActorPort,
  PresenceSceneActorProjection,
  PresenceSceneActorWriteRequest,
} from "../../platform/presence/presenceSceneActorRuntime";
import type { PresenceArenaRect } from "../../platform/presence/s02PresenceArena";

export type SceneActorBounds = Readonly<{
  left: number;
  right: number;
  bottom: number;
  top: number;
  height: number;
}>;

export const S02_TAP_REACTION = Object.freeze({
  durationMs: 360,
  maxOffsetY: 0.07,
});

export function s02TapReactionOffset(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || elapsedMs >= S02_TAP_REACTION.durationMs) return 0;
  const progress = THREE.MathUtils.clamp(elapsedMs / S02_TAP_REACTION.durationMs, 0, 1);
  return Math.sin(Math.PI * progress) * S02_TAP_REACTION.maxOffsetY;
}

type S02SceneActorOwnerOptions = Readonly<{
  scene: THREE.Scene;
  assetUrl: string;
  characterScale: number;
  onLoaded: () => void;
  onFailure: () => void;
  requestDraw: () => void;
  shouldAnimateTapReaction: () => boolean;
}>;

/** Owns the S02 actor only; renderer, camera and environment stay with the scene. */
export class S02SceneActorOwner {
  readonly assetUrl: string;
  readonly #scene: THREE.Scene;
  readonly #characterScale: number;
  readonly #onLoaded: () => void;
  readonly #onFailure: () => void;
  readonly #requestDraw: () => void;
  readonly #shouldAnimateTapReaction: () => boolean;

  #started = false;
  #disposed = false;
  #worldRoot: THREE.Group | null = null;
  #reactionRoot: THREE.Group | null = null;
  #normalized: THREE.Group | null = null;
  #tapReactionFrame: number | undefined;
  #tapReactionGeneration = 0;
  #tapReactionStartedAt = 0;
  #tapReactionActive = false;
  #tapReactionCount = 0;
  #baseScale = 0;
  #presentationScale = 1;
  #centerX = 0;
  #centerZ = 0;
  #minY = 0;

  constructor(options: S02SceneActorOwnerOptions) {
    this.#scene = options.scene;
    this.assetUrl = options.assetUrl;
    this.#characterScale = options.characterScale;
    this.#onLoaded = options.onLoaded;
    this.#onFailure = options.onFailure;
    this.#requestDraw = options.requestDraw;
    this.#shouldAnimateTapReaction = options.shouldAnimateTapReaction;
  }

  get worldRoot(): THREE.Group | null {
    return this.#worldRoot;
  }

  get tapReactionActive(): boolean {
    return this.#tapReactionActive;
  }

  get tapReactionCount(): number {
    return this.#tapReactionCount;
  }

  get tapReactionOffsetY(): number {
    return this.#reactionRoot?.position.y ?? 0;
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

      // Presence owns worldRoot relocation. Tap acknowledgement owns only this
      // child transform, so neither writer can restore or overwrite the other.
      const reactionRoot = new THREE.Group();
      reactionRoot.name = "sk7-presence-actor-reaction";
      reactionRoot.add(normalized);

      const worldRoot = new THREE.Group();
      worldRoot.name = "sk7-presence-actor-root";
      worldRoot.add(reactionRoot);

      const bounds = new THREE.Box3().setFromObject(worldRoot);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      this.#reactionRoot = reactionRoot;
      this.#normalized = normalized;
      this.#baseScale = (1.65 / Math.max(size.y, 0.001)) * this.#characterScale;
      this.#centerX = center.x;
      this.#centerZ = center.z;
      this.#minY = bounds.min.y;
      this.#applyPresentationScale();

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

  setPresentationScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0 || scale === this.#presentationScale) return;
    this.#presentationScale = scale;
    this.#applyPresentationScale();
  }

  acknowledgeTap(): boolean {
    const root = this.#reactionRoot;
    if (this.#disposed || !root) return false;

    // Latest tap replaces the old cue instead of queueing another frame loop.
    this.#clearTapReaction(false);
    this.#tapReactionCount += 1;

    if (!this.#shouldAnimateTapReaction()) {
      this.#requestDraw();
      return true;
    }

    const generation = this.#tapReactionGeneration;
    this.#tapReactionActive = true;
    this.#tapReactionStartedAt = performance.now();

    const step = (now: number) => {
      this.#tapReactionFrame = undefined;
      const currentRoot = this.#reactionRoot;
      if (
        this.#disposed
        || generation !== this.#tapReactionGeneration
        || !currentRoot
      ) return;

      if (!this.#shouldAnimateTapReaction()) {
        this.#clearTapReaction(true);
        return;
      }

      const elapsed = Math.max(0, now - this.#tapReactionStartedAt);
      if (elapsed >= S02_TAP_REACTION.durationMs) {
        this.#clearTapReaction(true);
        return;
      }

      currentRoot.position.y = s02TapReactionOffset(elapsed);
      this.#requestDraw();
      this.#tapReactionFrame = window.requestAnimationFrame(step);
    };

    this.#tapReactionFrame = window.requestAnimationFrame(step);
    this.#requestDraw();
    return true;
  }

  cancelTapReaction(): boolean {
    return this.#clearTapReaction(true);
  }

  #clearTapReaction(requestDraw: boolean): boolean {
    const root = this.#reactionRoot;
    const changed = this.#tapReactionActive
      || this.#tapReactionFrame !== undefined
      || Math.abs(root?.position.y ?? 0) > 1e-6;

    this.#tapReactionGeneration += 1;
    if (this.#tapReactionFrame !== undefined) {
      window.cancelAnimationFrame(this.#tapReactionFrame);
      this.#tapReactionFrame = undefined;
    }
    this.#tapReactionActive = false;
    this.#tapReactionStartedAt = 0;
    if (root) root.position.y = 0;

    if (requestDraw && changed && !this.#disposed) this.#requestDraw();
    return changed;
  }

  #applyPresentationScale(): void {
    if (!this.#normalized) return;
    const scale = this.#baseScale * this.#presentationScale;
    this.#normalized.scale.setScalar(scale);
    this.#normalized.position.set(
      -this.#centerX * scale,
      -this.#minY * scale,
      -this.#centerZ * scale,
    );
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
    this.#clearTapReaction(false);
    this.#disposed = true;
    const root = this.#worldRoot;
    this.#worldRoot = null;
    this.#reactionRoot = null;
    this.#normalized = null;
    if (!root) return;
    this.#scene.remove(root);
    // Renderer-owned shared resources are released only by the final scene pass.
    disposeScene(root);
  }
}

type S02SceneActorPortOptions = Readonly<{
  owner: S02SceneActorOwner;
  camera: THREE.OrthographicCamera;
  stage: HTMLElement;
  getCharacterAnchor: () => readonly [number, number, number];
  requestDraw: () => void;
  onFirstWrite: () => void;
}>;

function viewportOffset(): Readonly<{ x: number; y: number }> {
  return Object.freeze({
    x: window.visualViewport?.offsetLeft ?? 0,
    y: window.visualViewport?.offsetTop ?? 0,
  });
}

function taggedRect(
  revision: number,
  x: number,
  y: number,
  width: number,
  height: number,
): PresenceArenaRect {
  return Object.freeze({
    space: "visual-viewport-css-px",
    revision,
    x,
    y,
    width,
    height,
  });
}

/** Renderer-local adapter; it can mutate only the registered S02 world root. */
export class S02SceneActorPort implements PresenceSceneActorPort {
  readonly assetUrl: string;
  readonly #owner: S02SceneActorOwner;
  readonly #camera: THREE.OrthographicCamera;
  readonly #stage: HTMLElement;
  readonly #getCharacterAnchor: () => readonly [number, number, number];
  readonly #requestDraw: () => void;
  readonly #onFirstWrite: () => void;
  readonly #raycaster = new THREE.Raycaster();
  readonly #plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  readonly #intersection = new THREE.Vector3();
  #wrote = false;

  constructor(options: S02SceneActorPortOptions) {
    this.#owner = options.owner;
    this.assetUrl = options.owner.assetUrl;
    this.#camera = options.camera;
    this.#stage = options.stage;
    this.#getCharacterAnchor = options.getCharacterAnchor;
    this.#requestDraw = options.requestDraw;
    this.#onFirstWrite = options.onFirstWrite;
  }

  acknowledgeTap(): boolean {
    return this.#owner.acknowledgeTap();
  }

  cancelTapReaction(): boolean {
    return this.#owner.cancelTapReaction();
  }

  project(arenaRevision: number): PresenceSceneActorProjection | null {
    const worldRoot = this.#owner.worldRoot;
    if (!worldRoot || !Number.isSafeInteger(arenaRevision) || arenaRevision < 0) return null;
    const stage = this.#stage.getBoundingClientRect();
    if (stage.width <= 0 || stage.height <= 0) return null;

    this.#camera.updateMatrixWorld(true);
    worldRoot.updateWorldMatrix(true, true);
    const offset = viewportOffset();
    const project = (point: THREE.Vector3) => {
      const ndc = point.clone().project(this.#camera);
      return Object.freeze({
        x: stage.left + (ndc.x + 1) * stage.width / 2 + offset.x,
        y: stage.top + (1 - ndc.y) * stage.height / 2 + offset.y,
      });
    };

    const rootPoint = project(worldRoot.getWorldPosition(new THREE.Vector3()));
    const bounds = new THREE.Box3().setFromObject(worldRoot);
    if (bounds.isEmpty()) return null;
    const projected = [bounds.min.x, bounds.max.x].flatMap((x) =>
      [bounds.min.y, bounds.max.y].flatMap((y) =>
        [bounds.min.z, bounds.max.z].map((z) => project(new THREE.Vector3(x, y, z))),
      ),
    );
    const left = Math.min(...projected.map(point => point.x));
    const right = Math.max(...projected.map(point => point.x));
    const top = Math.min(...projected.map(point => point.y));
    const bottom = Math.max(...projected.map(point => point.y));
    if (![left, right, top, bottom, rootPoint.x, rootPoint.y].every(Number.isFinite)) return null;

    const stageLeft = stage.left + offset.x;
    const stageTop = stage.top + offset.y;
    const hitLeft = Math.max(left, stageLeft);
    const hitRight = Math.min(right, stageLeft + stage.width);
    const hitTop = Math.max(top, stageTop);
    const hitBottom = Math.min(bottom, stageTop + stage.height);
    if (hitRight <= hitLeft || hitBottom <= hitTop) return null;

    return Object.freeze({
      space: "visual-viewport-css-px",
      revision: arenaRevision,
      stage: taggedRect(arenaRevision, stageLeft, stageTop, stage.width, stage.height),
      root: Object.freeze({
        space: "visual-viewport-css-px",
        revision: arenaRevision,
        x: rootPoint.x,
        y: rootPoint.y,
      }),
      visualEnvelope: taggedRect(arenaRevision, left, top, right - left, bottom - top),
      hitRect: taggedRect(
        arenaRevision,
        hitLeft,
        hitTop,
        hitRight - hitLeft,
        hitBottom - hitTop,
      ),
    });
  }

  write(request: PresenceSceneActorWriteRequest): boolean {
    const worldRoot = this.#owner.worldRoot;
    if (
      !worldRoot
      || request.assetUrl !== this.assetUrl
      || request.point.space !== "visual-viewport-css-px"
      || !Number.isFinite(request.point.x)
      || !Number.isFinite(request.point.y)
    ) return false;
    const stage = this.#stage.getBoundingClientRect();
    if (stage.width <= 0 || stage.height <= 0) return false;
    const offset = viewportOffset();
    const clientX = request.point.x - offset.x;
    const clientY = request.point.y - offset.y;
    const ndc = new THREE.Vector2(
      ((clientX - stage.left) / stage.width) * 2 - 1,
      1 - ((clientY - stage.top) / stage.height) * 2,
    );
    if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return false;

    const characterAnchor = this.#getCharacterAnchor();
    const anchorY = characterAnchor[1];
    if (!Number.isFinite(anchorY)) return false;
    this.#camera.updateMatrixWorld(true);
    this.#raycaster.setFromCamera(ndc, this.#camera);
    this.#plane.set(new THREE.Vector3(0, 1, 0), -anchorY);
    if (!this.#raycaster.ray.intersectPlane(this.#plane, this.#intersection)) return false;
    if (![this.#intersection.x, this.#intersection.z].every(Number.isFinite)) return false;

    // The fenced port owns this transform only. Camera, environment and local
    // embodiment roots remain untouched.
    worldRoot.position.set(this.#intersection.x, anchorY, this.#intersection.z);
    worldRoot.updateWorldMatrix(true, true);
    if (!this.#wrote) {
      this.#wrote = true;
      this.#onFirstWrite();
    }
    this.#requestDraw();
    return true;
  }
}
