import {
  AmbientLight,
  AnimationAction,
  AnimationMixer,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { mountWorldTouchControls } from "./worldTouchControls";

import type { VerifiedPinnedAsset } from "./platform/embodiment/labAssetAdmission";
import { LabResourceLedger } from "./platform/embodiment/labEmbodimentPort";
import {
  KINEMATIC_CONFIG,
  type KinematicWorld,
} from "./platform/spatial/kinematicWorld";

import { PLAYABLE_DESTINATION, playableWorldLayout, rampVertices, RAMP_TRIANGLES } from "./platform/spatial/playableWorldLayout";

export type WorldPlayableClip = "idle" | "move";

export type WorldPlayableDiagnostics = Readonly<{
  mounted: boolean;
  clip: WorldPlayableClip | null;
  cameraOccluded: boolean;
  yawRadians: number;
  pitchRadians: number;
  renderCount: number;
  reducedMotion: boolean;
  animationTimeSeconds: number;
  fixtureIds: readonly string[];
  destinationNear: boolean;
}>;

type MountOptions = Readonly<{
  host: HTMLElement;
  resources: LabResourceLedger;
  world: KinematicWorld;
  asset: VerifiedPinnedAsset;
  reducedMotion: boolean;
  onFailure: (error: Error) => void;
}>;

const CAMERA_SEED = Object.freeze({
  yawRadians: 0,
  pitchRadians: 0.18,
  minPitchRadians: -0.22,
  maxPitchRadians: 0.58,
  desiredDistance: 4,
  minDistance: 0.8,
  obstructionClearance: 0.08,
});
const CAMERA_RADIUS = 0.25;
const LOOK_SENSITIVITY = 0.005;
const MODEL_HEIGHT = 1.45;
const CAPSULE_FOOT_OFFSET = KINEMATIC_CONFIG.capsuleHalfHeight + KINEMATIC_CONFIG.capsuleRadius;

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, button, [contenteditable=true]");
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
    const mesh = object as Mesh;
    if (mesh.geometry && !geometries.has(mesh.geometry)) {
      geometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const candidate = (mesh as unknown as { material?: Material | Material[] }).material;
    for (const material of candidate ? (Array.isArray(candidate) ? candidate : [candidate]) : []) {
      if (materials.has(material)) continue;
      materials.add(material);
      disposeMaterial(material, textures);
    }
    const skeleton = (object as unknown as { skeleton?: { dispose?: () => void } }).skeleton;
    skeleton?.dispose?.();
  });
}

function normalizeModel(model: Group): Group {
  model.updateMatrixWorld(true);
  let bounds = new Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error("playable bear has no renderable bounds");
  const height = bounds.getSize(new Vector3()).y;
  if (!Number.isFinite(height) || height <= 0) throw new Error("playable bear height is invalid");

  model.scale.multiplyScalar(MODEL_HEIGHT / height);
  model.updateMatrixWorld(true);
  bounds = new Box3().setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= bounds.min.y;

  const root = new Group();
  root.add(model);
  return root;
}

export class WorldPlayableStage {
  #host: HTMLElement | null = null;
  #root: HTMLDivElement | null = null;
  #renderer: WebGLRenderer | null = null;
  #scene: Scene | null = null;
  #camera: PerspectiveCamera | null = null;
  #actor: Group | null = null;
  #mixer: AnimationMixer | null = null;
  #idle: AnimationAction | null = null;
  #move: AnimationAction | null = null;
  #clip: WorldPlayableClip | null = null;
  #world: KinematicWorld | null = null;
  #resources: LabResourceLedger | null = null;
  #reducedMotion = false;
  #yaw: number = CAMERA_SEED.yawRadians;
  #pitch: number = CAMERA_SEED.pitchRadians;
  #pointerId: number | null = null;
  #pointerX = 0;
  #pointerY = 0;
  #previousFrameTime: number | null = null;
  #renderCount = 0;
  #cameraOccluded = false;
  #disposed = false;
  #hostPointerEvents = "";
  #hostZIndex = "";
  #destinationStatus: HTMLElement | null = null;
  #destinationNear = false;

  diagnostics(): WorldPlayableDiagnostics {
    return Object.freeze({
      mounted: this.#root !== null,
      clip: this.#clip,
      cameraOccluded: this.#cameraOccluded,
      yawRadians: this.#yaw,
      pitchRadians: this.#pitch,
      renderCount: this.#renderCount,
      reducedMotion: this.#reducedMotion,
      animationTimeSeconds: this.#mixer?.time ?? 0,
      fixtureIds: Object.freeze(this.#scene?.children.filter((child) => child.name.startsWith("fixture:")).map((child) => child.name.slice(8)) ?? []),
      destinationNear: this.#destinationNear,
    });
  }

  async mount(options: MountOptions): Promise<void> {
    if (this.#root) throw new Error("WorldPlayableStage is already mounted");
    if (options.world.snapshot.lifecycle !== "running") throw new Error("playable physics world must be running first");
    this.#world = options.world;
    this.#resources = options.resources;
    this.#reducedMotion = options.reducedMotion;
    this.#host = options.host;
    this.#disposed = false;

    const root = document.createElement("div");
    root.className = "world-playable-stage";
    root.dataset.testid = "world-playable-stage";
    root.dataset.playableClip = "loading";
    root.dataset.cameraOccluded = "false";
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "auto",
      background: "#dbe7d2",
    });
    this.#hostPointerEvents = options.host.style.pointerEvents;
    this.#hostZIndex = options.host.style.zIndex;
    options.host.style.pointerEvents = "auto";
    options.host.style.zIndex = "70";
    options.host.append(root);
    this.#root = root;

    const renderer = new WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0xdbe7d2, 1);
    renderer.domElement.dataset.testid = "world-playable-canvas";
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "W1 3D world. Use W A S D or arrow keys to move; drag to look.",
    );
    renderer.domElement.style.display = "block";
    renderer.domElement.style.pointerEvents = "auto";
    renderer.domElement.style.cursor = "grab";
    root.append(renderer.domElement);
    this.#renderer = renderer;
    options.resources.trackWebglContext(() => this.#disposeThree());
    options.resources.listen(renderer.domElement, "webglcontextlost", (event) => {
      event.preventDefault();
      if (!this.#disposed) options.onFailure(new Error("playable WebGL context lost"));
    });

    const scene = new Scene();
    this.#scene = scene;
    scene.add(new AmbientLight(0xffffff, 1.6));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 6, 4);
    scene.add(key);

    const ground = new Mesh(
      new PlaneGeometry(KINEMATIC_CONFIG.worldLimit * 2, KINEMATIC_CONFIG.worldLimit * 2),
      new MeshStandardMaterial({ color: new Color("#b8cba8"), roughness: 0.92 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    for (const shape of playableWorldLayout(KINEMATIC_CONFIG)) {
      let geometry: BufferGeometry;
      if (shape.kind === "box") {
        geometry = new BoxGeometry(shape.width, shape.height, shape.depth);
        geometry.translate(shape.x, shape.height / 2, shape.z);
      } else {
        geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute(rampVertices(shape), 3));
        geometry.setIndex([...RAMP_TRIANGLES]);
        geometry.computeVertexNormals();
      }
      const mesh = new Mesh(geometry, new MeshStandardMaterial({
        color: shape.id.includes("blocked") ? 0xac7f68 : 0x7c8e78, roughness: 0.86,
      }));
      mesh.name = `fixture:${shape.id}`;
      scene.add(mesh);
    }

    const destination = new Mesh(
      new CircleGeometry(PLAYABLE_DESTINATION.radius, 40),
      new MeshStandardMaterial({ color: 0xf3c86a, roughness: 0.8 }),
    );
    destination.name = PLAYABLE_DESTINATION.id;
    destination.rotation.x = -Math.PI / 2;
    destination.position.set(PLAYABLE_DESTINATION.x, 0.012, PLAYABLE_DESTINATION.z);
    scene.add(destination);
    const status = document.createElement("p");
    status.className = "world-destination-status";
    status.dataset.testid = "world-destination-status";
    status.dataset.destinationId = PLAYABLE_DESTINATION.id;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "Grove station is on the gold circle ahead. Or open it with the station button.";
    root.append(status);
    this.#destinationStatus = status;
    root.dataset.destinationNear = "false";

    const camera = new PerspectiveCamera(48, 1, 0.05, 60);
    this.#camera = camera;
    this.#resize();

    const generation = options.resources.generation;
    const parse = options.resources.beginLoad();
    try {
      const gltf = await new GLTFLoader().parseAsync(options.asset.bytes.slice(0), "");
      if (!options.resources.isCurrent(generation) || parse.signal.aborted || this.#disposed) {
        disposeObject(gltf.scene);
        throw new Error("stale playable GLB parse generation");
      }
      const idleClip = gltf.animations.find((clip) => clip.name === "idle") ?? null;
      const moveClip = gltf.animations.find((clip) => clip.name === "move") ?? null;
      if (!idleClip || !moveClip) {
        disposeObject(gltf.scene);
        throw new Error("playable bear requires verified idle and move clips");
      }

      const actor = normalizeModel(gltf.scene);
      this.#actor = actor;
      scene.add(actor);
      const mixer = new AnimationMixer(gltf.scene);
      this.#mixer = mixer;
      this.#idle = mixer.clipAction(idleClip);
      this.#move = mixer.clipAction(moveClip);
      this.#switchClip("idle");
    } finally {
      parse.done();
    }

    options.resources.listen(window, "keydown", (event) => {
      if (!(event instanceof KeyboardEvent) || editableTarget(event.target)) return;
      if (event.code === "Escape") {
        options.world.blur();
        return;
      }
      if (options.world.key(event.code, true)) event.preventDefault();
    });
    options.resources.listen(window, "keyup", (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (options.world.key(event.code, false)) event.preventDefault();
    });
    // Follow the current preference, including changes after async asset loading.
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.#reducedMotion = motionPreference.matches;
    options.resources.listen(motionPreference, "change", () => {
      this.#reducedMotion = motionPreference.matches;
    });

    options.resources.listen(window, "blur", () => options.world.blur());
    options.resources.listen(document, "visibilitychange", () => {
      options.world.setHidden(document.hidden);
      this.#previousFrameTime = null;
    });
    options.resources.listen(document, "focusin", (event) => {
      if (event.target !== renderer.domElement) options.world.blur();
    });
    options.resources.listen(window, "resize", () => this.#resize(), { passive: true });
    if (window.visualViewport) {
      options.resources.listen(window.visualViewport, "resize", () => this.#resize(), { passive: true });
    }

    options.resources.listen(renderer.domElement, "pointerdown", (event) => {
      if (!(event instanceof PointerEvent) || event.pointerType === "touch" || event.button !== 0 || this.#pointerId !== null) return;
      renderer.domElement.focus({ preventScroll: true });
      this.#pointerId = event.pointerId;
      this.#pointerX = event.clientX;
      this.#pointerY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
      event.preventDefault();
    });
    options.resources.listen(renderer.domElement, "pointermove", (event) => {
      if (!(event instanceof PointerEvent) || event.pointerId !== this.#pointerId) return;
      const dx = event.clientX - this.#pointerX;
      const dy = event.clientY - this.#pointerY;
      this.#pointerX = event.clientX;
      this.#pointerY = event.clientY;
      this.#yaw -= dx * LOOK_SENSITIVITY;
      this.#pitch -= dy * LOOK_SENSITIVITY;
      options.world.setYaw(this.#yaw);
      event.preventDefault();
    });
    const finishPointer = (event: Event) => {
      if (!(event instanceof PointerEvent) || event.pointerId !== this.#pointerId) return;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      this.#pointerId = null;
      renderer.domElement.style.cursor = "grab";
      if (event.type !== "pointerup") options.world.blur();
    };
    options.resources.listen(renderer.domElement, "pointerup", finishPointer);
    options.resources.listen(renderer.domElement, "pointercancel", finishPointer);
    options.resources.listen(renderer.domElement, "lostpointercapture", finishPointer);

    mountWorldTouchControls({
      root, canvas: renderer.domElement, resources: options.resources, world: options.world,
      look: (dx, dy) => {
        this.#yaw -= dx * LOOK_SENSITIVITY;
        this.#pitch = Math.max(CAMERA_SEED.minPitchRadians,
          Math.min(CAMERA_SEED.maxPitchRadians, this.#pitch - dy * LOOK_SENSITIVITY));
        options.world.setYaw(this.#yaw);
      },
    });

    options.world.setYaw(this.#yaw);
    options.world.setHidden(document.hidden);
    // Anchor physics and animation to the first RAF timestamp. An asynchronous
    // mount's performance.now() can be later than an already queued RAF sample.
    options.resources.startRafLoop((time) => this.#frame(time));
    renderer.domElement.focus({ preventScroll: true });
  }

  nudgeCamera(deltaYawRadians: number): void {
    if (!Number.isFinite(deltaYawRadians)) return;
    this.#yaw += deltaYawRadians;
    this.#world?.setYaw(this.#yaw);
    this.#updateCamera();
  }

  resetCamera(): void {
    this.#yaw = CAMERA_SEED.yawRadians;
    this.#pitch = CAMERA_SEED.pitchRadians;
    this.#world?.setYaw(this.#yaw);
    this.#updateCamera();
  }

  unmount(): void {
    this.#disposeThree();
    this.#disposed = true;
    this.#root?.remove();
    if (this.#host) {
      this.#host.style.pointerEvents = this.#hostPointerEvents;
      this.#host.style.zIndex = this.#hostZIndex;
      delete this.#host.dataset.worldPlayable;
    }
    this.#root = null;
    this.#destinationStatus = null;
    this.#destinationNear = false;
    this.#renderer = null;
    this.#scene = null;
    this.#camera = null;
    this.#actor = null;
    this.#mixer = null;
    this.#idle = null;
    this.#move = null;
    this.#clip = null;
    this.#world = null;
    this.#resources = null;
    this.#pointerId = null;
    this.#previousFrameTime = null;
  }

  #frame(time: number): void {
    const world = this.#world;
    const renderer = this.#renderer;
    const scene = this.#scene;
    const camera = this.#camera;
    if (!world || !renderer || !scene || !camera || this.#disposed) return;

    world.sample(time);
    const snapshot = world.snapshot;
    const position = snapshot.position;
    if (position && this.#actor) {
      this.#actor.position.set(position.x, position.y - CAPSULE_FOOT_OFFSET, position.z);
      const previous = snapshot.previousPosition;
      if (previous) {
        const dx = position.x - previous.x;
        const dz = position.z - previous.z;
        if (Math.hypot(dx, dz) > 1e-5) this.#actor.rotation.y = Math.atan2(dx, dz);
      }
    }

    const near = position !== null && Math.hypot(position.x - PLAYABLE_DESTINATION.x, position.z - PLAYABLE_DESTINATION.z) <= PLAYABLE_DESTINATION.radius;
    if (near !== this.#destinationNear) {
      this.#destinationNear = near;
      if (this.#root) this.#root.dataset.destinationNear = String(near);
      if (this.#destinationStatus) this.#destinationStatus.textContent = near
        ? "At Grove station. Open the station when ready."
        : "Grove station is on the gold circle. The station button is always available.";
    }
    const moving = snapshot.input.intent.magnitude > 1e-3;
    this.#switchClip(moving ? "move" : "idle");
    const delta = this.#previousFrameTime === null ? 0 : Math.min((time - this.#previousFrameTime) / 1000, 0.05);
    this.#previousFrameTime = time;
    if (!document.hidden && (!this.#reducedMotion || moving)) this.#mixer?.update(delta);

    this.#updateCamera();
    renderer.render(scene, camera);
    this.#renderCount += 1;
    if (this.#root) this.#root.dataset.renderCount = String(this.#renderCount);
  }

  #updateCamera(): void {
    const world = this.#world;
    const camera = this.#camera;
    if (!world || !camera) return;
    const result = world.camera({
      ...CAMERA_SEED,
      yawRadians: this.#yaw,
      pitchRadians: this.#pitch,
    }, CAMERA_RADIUS);
    if (!result) return;
    this.#pitch = result.pitchRadians;
    this.#cameraOccluded = result.occluded;
    camera.position.set(result.position.x, result.position.y, result.position.z);
    camera.lookAt(result.focus.x, result.focus.y, result.focus.z);
    camera.updateMatrixWorld();
    if (this.#root) {
      this.#root.dataset.cameraOccluded = String(result.occluded);
      this.#root.dataset.cameraYaw = String(result.yawRadians);
      this.#root.dataset.cameraPitch = String(result.pitchRadians);
    }
  }

  #resize(): void {
    const renderer = this.#renderer;
    const camera = this.#camera;
    if (!renderer || !camera) return;
    const visual = window.visualViewport;
    const width = Math.max(1, Math.round(visual?.width ?? window.innerWidth));
    const height = Math.max(1, Math.round(visual?.height ?? window.innerHeight));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  #switchClip(next: WorldPlayableClip): void {
    if (this.#clip === next) return;
    const action = next === "move" ? this.#move : this.#idle;
    if (!action) return;
    const previous = this.#clip === "move" ? this.#move : this.#idle;
    action.reset().play();
    if (previous && previous !== action) {
      if (this.#reducedMotion) previous.stop();
      else action.crossFadeFrom(previous, 0.12, false);
    }
    this.#clip = next;
    if (this.#root) this.#root.dataset.playableClip = next;
  }

  #disposeThree(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#mixer?.stopAllAction();
    if (this.#scene) disposeObject(this.#scene);
    if (this.#renderer) {
      this.#renderer.renderLists.dispose();
      this.#renderer.dispose();
      this.#renderer.forceContextLoss();
    }
  }
}
