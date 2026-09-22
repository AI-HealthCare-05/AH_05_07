import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Texture,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Material,
  type Object3D,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import type { VerifiedPinnedAsset } from "./platform/embodiment/labAssetAdmission";
import type {
  AssetDisplayResult,
  BackendRepresentation,
  BackendTelemetry,
  LabBackendKind,
  LabEmbodimentBackend,
  RendererMountContext,
  ResourceDiagnostics,
} from "./platform/embodiment/labEmbodimentPort";
import type { ResolvedPose } from "./platform/spatial/companionWorld";

const SURROGATE_REPRESENTATION: BackendRepresentation = Object.freeze({
  mode: "surrogate",
  assetId: null,
  sha256: null,
  clipName: null,
});

function createSurrogate(): Group {
  const group = new Group();
  const fur = new MeshStandardMaterial({ color: new Color("#8a5a3b"), roughness: 0.76 });
  const muzzle = new MeshStandardMaterial({ color: new Color("#e9c9a6"), roughness: 0.8 });
  const dark = new MeshStandardMaterial({ color: new Color("#211b19"), roughness: 0.7 });
  const body = new Mesh(new SphereGeometry(0.62, 24, 18), fur);
  body.scale.set(0.83, 1, 0.72);
  body.position.y = -0.2;
  const head = new Mesh(new SphereGeometry(0.48, 24, 18), fur);
  head.position.y = 0.56;
  const leftEar = new Mesh(new SphereGeometry(0.19, 18, 12), fur);
  leftEar.position.set(-0.34, 0.91, 0);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.34;
  const snout = new Mesh(new SphereGeometry(0.23, 18, 12), muzzle);
  snout.scale.set(1.05, 0.7, 0.7);
  snout.position.set(0, 0.42, 0.4);
  const nose = new Mesh(new SphereGeometry(0.075, 14, 10), dark);
  nose.position.set(0, 0.47, 0.59);
  group.add(body, head, leftEar, rightEar, snout, nose);
  return group;
}

function disposeMaterial(material: Material, textures: Set<Texture>): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture && !textures.has(value)) {
      textures.add(value);
      value.dispose();
    }
  }
  material.dispose();
}

function disposeObject(root: Object3D): void {
  const geometries = new Set<object>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (!geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      object.geometry.dispose();
    }
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      if (materials.has(material)) continue;
      materials.add(material);
      disposeMaterial(material, textures);
    }
  });
}

function normalizedModel(gltf: GLTF): Group {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  let bounds = new Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error("verified GLB scene has no renderable bounds");
  const size = bounds.getSize(new Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error("verified GLB has an invalid vertical extent");
  model.scale.multiplyScalar(1.9 / size.y);
  model.updateMatrixWorld(true);
  bounds = new Box3().setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y += -0.9 - bounds.min.y;
  const group = new Group();
  group.add(model);
  return group;
}

abstract class ThreeLabBackend implements LabEmbodimentBackend {
  abstract readonly kind: LabBackendKind;
  protected context: RendererMountContext | null = null;
  protected root: HTMLDivElement | null = null;
  protected renderer: WebGLRenderer | null = null;
  protected scene: Scene | null = null;
  protected camera: Camera | null = null;
  protected modelRoot: Group | null = null;
  protected lastPose: ResolvedPose | null = null;
  #mixer: AnimationMixer | null = null;
  #mixerRoot: Object3D | null = null;
  #mountCount = 0;
  #drawCount = 0;
  #frameDurations: number[] = [];
  #contextPeak = 0;
  #visible = false;
  #representation: BackendRepresentation = SURROGATE_REPRESENTATION;

  async mount(context: RendererMountContext): Promise<void> {
    if (this.root) throw new Error(`${this.kind} is already mounted`);
    if (context.forceFailure) throw new Error(`forced ${this.kind} renderer failure`);
    this.context = context;
    const root = document.createElement("div");
    root.className = `transcend-renderer transcend-renderer--${this.kind}`;
    root.dataset.labBackend = this.kind;
    root.dataset.labBackendMounted = "true";
    root.dataset.representation = "surrogate";
    root.setAttribute("aria-hidden", "true");
    root.style.pointerEvents = "none";
    root.style.touchAction = "auto";
    context.host.append(root);
    this.root = root;

    try {
      const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.dataset.labRendererCanvas = this.kind;
      renderer.domElement.setAttribute("aria-hidden", "true");
      root.append(renderer.domElement);
      this.renderer = renderer;
      this.scene = new Scene();
      this.modelRoot = createSurrogate();
      this.scene.add(this.modelRoot);
      this.scene.add(new AmbientLight(0xffffff, 1.65));
      const key = new DirectionalLight(0xffffff, 2.3);
      key.position.set(2, 4, 5);
      this.scene.add(key);
      this.configureViewport();

      const generation = context.resources.generation;
      context.resources.trackWebglContext(() => {
        this.#disposeMixer();
        if (this.scene) disposeObject(this.scene);
        if (this.renderer) {
          this.renderer.dispose();
          this.renderer.forceContextLoss();
        }
      });
      this.#contextPeak = Math.max(
        this.#contextPeak,
        context.resources.diagnostics().liveWebglContexts,
      );
      context.resources.trackSubscription(
        context.poseSource.subscribe((pose) => {
          if (!context.resources.isCurrent(generation)) return;
          this.lastPose = pose;
          this.applyPose(pose);
          this.draw(performance.now());
        }),
      );
      context.resources.listen(window, "resize", () => {
        if (!context.resources.isCurrent(generation)) return;
        this.configureViewport();
        this.applyPose(this.lastPose);
        this.draw(performance.now());
      });
      this.lastPose = context.poseSource.read();
      this.applyPose(this.lastPose);
      this.draw(performance.now());

      if (context.verifiedAsset) {
        const display = await this.installVerifiedAsset(context.verifiedAsset);
        if (display.status !== "displayed") throw new Error(display.reason);
      }

      if (!context.reducedMotion) {
        let previousTime: number | null = null;
        context.resources.startRafLoop((time) => {
          const deltaSeconds = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.1);
          previousTime = time;
          if (this.#mixer) this.#mixer.update(deltaSeconds);
          else if (this.modelRoot) this.modelRoot.rotation.y = Math.sin(time / 900) * 0.08;
          this.draw(time);
        });
      }
      this.#mountCount += 1;
      this.#visible = true;
    } catch (error) {
      root.remove();
      this.root = null;
      this.context = null;
      throw error;
    }
  }

  async installVerifiedAsset(asset: VerifiedPinnedAsset): Promise<AssetDisplayResult> {
    const context = this.context;
    if (!context || !this.scene || !this.root) {
      return Object.freeze({ status: "failed" as const, reason: "renderer is not mounted" });
    }
    const parseOwner = context.resources.beginLoad();
    const generation = parseOwner.generation;
    return new Promise<AssetDisplayResult>((resolve) => {
      const finish = (result: AssetDisplayResult) => {
        parseOwner.done();
        resolve(result);
      };
      new GLTFLoader().parse(
        asset.bytes.slice(0),
        "",
        (gltf) => {
          if (!context.resources.isCurrent(generation) || parseOwner.signal.aborted || this.context !== context) {
            disposeObject(gltf.scene);
            finish(Object.freeze({ status: "cancelled" as const, reason: "stale GLB parse generation" }));
            return;
          }
          try {
            const nextRoot = normalizedModel(gltf);
            const selectedClip = gltf.animations.find((clip) => clip.name === "idle") ?? gltf.animations[0] ?? null;
            this.#replaceModel(nextRoot);
            if (selectedClip) {
              this.#mixer = new AnimationMixer(gltf.scene);
              this.#mixerRoot = gltf.scene;
              this.#mixer.clipAction(selectedClip).play();
            }
            this.#representation = Object.freeze({
              mode: "verified-glb" as const,
              assetId: asset.assetId,
              sha256: asset.sha256,
              clipName: selectedClip?.name ?? null,
            });
            if (this.root) this.root.dataset.representation = "verified-glb";
            this.applyPose(this.lastPose);
            this.draw(performance.now());
            finish(Object.freeze({ status: "displayed" as const, representation: this.#representation }));
          } catch (error) {
            disposeObject(gltf.scene);
            finish(Object.freeze({
              status: "failed" as const,
              reason: `verified GLB parse failed: ${error instanceof Error ? error.message : "unknown"}`,
            }));
          }
        },
        (error) => finish(Object.freeze({
          status: "failed" as const,
          reason: `verified GLB parse failed: ${error instanceof Error ? error.message : "unknown"}`,
        })),
      );
    });
  }

  telemetry(): BackendTelemetry {
    return Object.freeze({
      backend: this.kind,
      mountCount: this.#mountCount,
      drawCount: this.#drawCount,
      frameDurationsMs: Object.freeze([...this.#frameDurations]),
      contextPeak: this.#contextPeak,
      visible: this.#visible,
      representation: this.#representation,
    });
  }

  diagnostics(): ResourceDiagnostics {
    return this.context?.resources.diagnostics() ?? Object.freeze({
      generation: 0,
      listeners: 0,
      timers: 0,
      rafLoops: 0,
      pendingLoads: 0,
      liveWebglContexts: 0,
    });
  }

  async stop(): Promise<void> {
    this.#visible = false;
    if (this.root) this.root.dataset.labBackendMounted = "false";
    if (this.context) await this.context.resources.drain();
  }

  unmount(): void {
    this.root?.remove();
    this.root = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.modelRoot = null;
    this.#mixer = null;
    this.#mixerRoot = null;
    this.#representation = SURROGATE_REPRESENTATION;
    this.context = null;
    this.lastPose = null;
  }

  protected draw(_time: number): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    const started = performance.now();
    this.renderer.render(this.scene, this.camera);
    const duration = performance.now() - started;
    this.#drawCount += 1;
    if (this.#frameDurations.length < 240) this.#frameDurations.push(duration);
  }

  #disposeMixer(): void {
    if (!this.#mixer) return;
    this.#mixer.stopAllAction();
    if (this.#mixerRoot) this.#mixer.uncacheRoot(this.#mixerRoot);
    this.#mixer = null;
    this.#mixerRoot = null;
  }

  #replaceModel(nextRoot: Group): void {
    this.#disposeMixer();
    if (this.modelRoot) {
      this.scene?.remove(this.modelRoot);
      disposeObject(this.modelRoot);
    }
    this.modelRoot = nextRoot;
    this.scene?.add(nextRoot);
  }

  protected abstract configureViewport(): void;
  protected abstract applyPose(pose: ResolvedPose | null): void;
}

class MovablePatchBackend extends ThreeLabBackend {
  readonly kind = "movable-patch" as const;

  protected configureViewport(): void {
    if (!this.renderer || !this.root) return;
    this.root.style.width = "136px";
    this.root.style.height = "152px";
    this.renderer.setSize(136, 152, false);
    const camera = new PerspectiveCamera(32, 136 / 152, 0.1, 20);
    camera.position.set(0, 0.55, 5.1);
    camera.lookAt(0, 0.2, 0);
    this.camera = camera;
  }

  protected applyPose(pose: ResolvedPose | null): void {
    if (!this.root || !this.context) return;
    if (!pose) {
      this.root.style.visibility = "hidden";
      return;
    }
    const viewport = this.context.getViewport();
    this.root.style.visibility = "visible";
    this.root.style.transform = `translate3d(${pose.point.x - viewport.x - 68}px, ${pose.point.y - viewport.y - 120}px, 0)`;
    this.modelRoot?.position.set(0, 0, 0);
    this.modelRoot?.scale.setScalar(1);
  }
}

class SharedStageBackend extends ThreeLabBackend {
  readonly kind = "shared-stage" as const;

  protected configureViewport(): void {
    if (!this.renderer || !this.context || !this.root) return;
    const viewport = this.context.getViewport();
    this.root.style.width = `${viewport.width}px`;
    this.root.style.height = `${viewport.height}px`;
    this.renderer.setSize(viewport.width, viewport.height, false);
    const camera = new OrthographicCamera(
      -viewport.width / 2,
      viewport.width / 2,
      viewport.height / 2,
      -viewport.height / 2,
      -100,
      100,
    );
    camera.position.z = 10;
    this.camera = camera;
  }

  protected applyPose(pose: ResolvedPose | null): void {
    if (!this.modelRoot || !this.context || !this.root) return;
    if (!pose) {
      this.root.style.visibility = "hidden";
      return;
    }
    const viewport = this.context.getViewport();
    const clientX = pose.point.x - viewport.x;
    const clientY = pose.point.y - viewport.y;
    this.root.style.visibility = "visible";
    this.modelRoot.position.set(
      clientX - viewport.width / 2,
      viewport.height / 2 - clientY + 18,
      0,
    );
    this.modelRoot.scale.setScalar(58);
  }
}

export function createLabBackend(kind: LabBackendKind): LabEmbodimentBackend {
  return kind === "movable-patch" ? new MovablePatchBackend() : new SharedStageBackend();
}

/** Owns mount/reveal only. It receives a read-only pose source and cannot write pose. */
export class SequentialBackendSelector {
  #active: LabEmbodimentBackend | null = null;
  #queue: Promise<void> = Promise.resolve();

  get activeKind(): LabBackendKind | null {
    return this.#active?.kind ?? null;
  }

  get activeTelemetry(): BackendTelemetry | null {
    return this.#active?.telemetry() ?? null;
  }

  get activeRepresentation(): BackendRepresentation | null {
    return this.#active?.telemetry().representation ?? null;
  }

  select(kind: LabBackendKind, context: RendererMountContext): Promise<void> {
    const transition = this.#queue.then(async () => {
      await this.#stopActive();
      const backend = createLabBackend(kind);
      await backend.mount(context);
      this.#active = backend;
      this.#assertExclusive(context.host);
    });
    this.#queue = transition.catch(() => undefined);
    return transition;
  }

  installVerifiedAsset(asset: VerifiedPinnedAsset): Promise<AssetDisplayResult> {
    const transition = this.#queue.then(async () => {
      if (!this.#active) return Object.freeze({ status: "failed" as const, reason: "no mounted backend" });
      return this.#active.installVerifiedAsset(asset);
    });
    this.#queue = transition.then(() => undefined, () => undefined);
    return transition;
  }

  stop(host?: HTMLElement): Promise<ResourceDiagnostics> {
    let diagnostics: ResourceDiagnostics | null = null;
    const transition = this.#queue.then(async () => {
      diagnostics = await this.#stopActive();
      if (host) this.#assertExclusive(host);
    });
    this.#queue = transition.catch(() => undefined);
    return transition.then(() => {
      if (!diagnostics) throw new Error("selector stop did not produce diagnostics");
      return diagnostics;
    });
  }

  async #stopActive(): Promise<ResourceDiagnostics> {
    if (!this.#active) {
      return Object.freeze({
        generation: 0,
        listeners: 0,
        timers: 0,
        rafLoops: 0,
        pendingLoads: 0,
        liveWebglContexts: 0,
      });
    }
    const backend = this.#active;
    await backend.stop();
    const telemetry = backend.telemetry();
    if (telemetry.visible) throw new Error("backend remained visible after stop");
    const resources = backend.diagnostics();
    if (
      resources.listeners
      || resources.timers
      || resources.rafLoops
      || resources.pendingLoads
      || resources.liveWebglContexts
    ) {
      throw new Error(`backend resources remained after stop: ${JSON.stringify(resources)}`);
    }
    backend.unmount();
    this.#active = null;
    return resources;
  }

  #assertExclusive(host: HTMLElement): void {
    const mounted = host.querySelectorAll('[data-lab-backend-mounted="true"]');
    const expected = this.#active ? 1 : 0;
    if (mounted.length !== expected) {
      throw new Error(`expected ${expected} mounted backend, found ${mounted.length}`);
    }
  }
}
