import { WorldMovementIntentController } from "../behavior/worldMovementIntent";
import {
  cameraRelativeMovement,
  resolveThirdPersonCamera,
  type ThirdPersonCameraConfig,
  type ThirdPersonCameraResult,
} from "./thirdPersonCamera";
import { loadLabRapier, type RapierModule } from "./rapierRuntime";
import { FixedStepClock, worldPoint, type WorldPoint3 } from "./worldSpaceClock";

type PhysicsWorld = import("@dimforge/rapier3d-compat").World;
type CharacterController = import("@dimforge/rapier3d-compat").KinematicCharacterController;
type Body = import("@dimforge/rapier3d-compat").RigidBody;
type Collider = import("@dimforge/rapier3d-compat").Collider;

export const WORLD_FIXTURES = Object.freeze([
  "flat", "wall", "camera-obstruction", "slope-allowed", "slope-blocked", "step-allowed", "step-blocked", "recovery",
] as const);
export type WorldFixtureName = (typeof WORLD_FIXTURES)[number];

/** Recorded synthetic tuning, not production/physical-device performance gates. */
export const KINEMATIC_CONFIG = Object.freeze({
  groundShape: "halfspace-y-up" as const,
  stepSeconds: 1 / 60,
  speedMetresPerSecond: 2,
  gravityMetresPerSecondSquared: -9.81,
  terminalFallSpeed: 30,
  capsuleHalfHeight: 0.5,
  capsuleRadius: 0.25,
  contactOffset: 0.01,
  autostepMaxHeight: 0.35,
  autostepMinWidth: 0.2,
  snapToGroundDistance: 0.2,
  maxSlopeClimbRadians: Math.PI / 4,
  minSlopeSlideRadians: Math.PI / 3,
  obstacleFrontX: 1.5,
  allowedStepHeight: 0.2,
  blockedStepHeight: 0.6,
  allowedSlopeRadians: Math.PI / 9,
  blockedSlopeRadians: Math.PI / 3,
  slopeRun: 3,
  worldLimit: 10,
  minimumY: -8,
  // Bound work after a foreground debugger/stall as well as explicit suspension.
  maxFrameGapMilliseconds: 250,
});
const SPAWN = worldPoint(0, 0.8, 0);

type WorldLifecycle = "stopped" | "loading" | "running" | "error";

/** One Lab-only physics writer. No RAF, listener, renderer, React or asset owner. */
export class KinematicWorld {
  readonly #clock = new FixedStepClock(KINEMATIC_CONFIG.stepSeconds);
  readonly #input = new WorldMovementIntentController();
  readonly #loadRapier: () => Promise<RapierModule>;
  #generation = 0;
  #pendingLoads = 0;
  #lifecycle: WorldLifecycle = "stopped";
  #fixture: WorldFixtureName = "flat";
  #world: PhysicsWorld | null = null;
  #controller: CharacterController | null = null;
  #body: Body | null = null;
  #collider: Collider | null = null;
  #position: WorldPoint3 | null = null;
  #previousPosition: WorldPoint3 | null = null;
  #runtimeVersion: string | null = null;
  #rapier: RapierModule | null = null;
  #verticalVelocity = 0;
  #grounded = false;
  #yaw = 0;
  #lastFrame: number | null = null;
  #hidden = false;
  #semanticSuspended = false;
  #recoveries = 0;
  #discardedIntervals = 0;

  constructor(loadRapier: () => Promise<RapierModule> = loadLabRapier) {
    this.#loadRapier = loadRapier;
  }

  get snapshot() {
    return Object.freeze({
      lifecycle: this.#lifecycle,
      generation: this.#generation,
      fixture: this.#fixture,
      runtimeVersion: this.#runtimeVersion,
      position: this.#position,
      previousPosition: this.#previousPosition,
      grounded: this.#grounded,
      verticalVelocity: this.#verticalVelocity,
      clock: this.#clock.snapshot,
      input: this.#input.snapshot,
      recoveries: this.#recoveries,
      discardedIntervals: this.#discardedIntervals,
      resources: Object.freeze({
        pendingLoads: this.#pendingLoads,
        worlds: Number(this.#world !== null),
        controllers: this.#world?.characterControllers.size ?? 0,
        bodies: this.#world?.bodies.len() ?? 0,
        colliders: this.#world?.colliders.len() ?? 0,
      }),
    });
  }

  async start(fixture: WorldFixtureName = "flat"): Promise<boolean> {
    if (!(WORLD_FIXTURES as readonly string[]).includes(fixture)) {
      throw new RangeError("Unknown W1 kinematic fixture");
    }
    const generation = ++this.#generation;
    this.#disposeWorld();
    this.#clock.reset();
    this.#input.reset();
    this.#lastFrame = null;
    this.#verticalVelocity = 0;
    this.#grounded = false;
    this.#yaw = 0;
    this.#recoveries = 0;
    this.#discardedIntervals = 0;
    this.#fixture = fixture;
    this.#lifecycle = "loading";
    this.#pendingLoads += 1;
    let ownedWorld: PhysicsWorld | null = null;
    let ownedController: CharacterController | null = null;
    try {
      const R = await this.#loadRapier();
      if (generation !== this.#generation) return false;
      const world = new R.World({ x: 0, y: KINEMATIC_CONFIG.gravityMetresPerSecondSquared, z: 0 });
      ownedWorld = world;
      world.timestep = KINEMATIC_CONFIG.stepSeconds;
      // Analytic ground avoids noisy capsule/large-box contact normals on the
      // flat-rate fixture. The explicit worldLimit still bounds the playable area.
      world.createCollider(new R.ColliderDesc(new R.HalfSpace({ x: 0, y: 1, z: 0 })));
      const front = KINEMATIC_CONFIG.obstacleFrontX;
      if (fixture === "wall") {
        world.createCollider(R.ColliderDesc.cuboid(0.15, 1.5, 4).setTranslation(front + 0.15, 1.5, 0));
      } else if (fixture === "camera-obstruction") {
        // A thin, slightly off-axis pillar: a center ray would miss it, while
        // the W1 camera sphere must catch the near edge.
        world.createCollider(R.ColliderDesc.cuboid(0.12, 2, 0.04).setTranslation(0.32, 2, 2));
      } else if (fixture === "step-allowed" || fixture === "step-blocked") {
        const height = fixture === "step-allowed" ? KINEMATIC_CONFIG.allowedStepHeight : KINEMATIC_CONFIG.blockedStepHeight;
        world.createCollider(R.ColliderDesc.cuboid(0.75, height / 2, 2).setTranslation(front + 0.75, height / 2, 0));
      } else if (fixture === "slope-allowed" || fixture === "slope-blocked") {
        const angle = fixture === "slope-allowed" ? KINEMATIC_CONFIG.allowedSlopeRadians : KINEMATIC_CONFIG.blockedSlopeRadians;
        const end = front + KINEMATIC_CONFIG.slopeRun;
        const height = Math.tan(angle) * KINEMATIC_CONFIG.slopeRun;
        // Convex triangular prism: a true ramp without a leading box lip.
        const ramp = R.ColliderDesc.convexHull(new Float32Array([
          front, 0, -2, end, 0, -2, end, height, -2,
          front, 0, 2, end, 0, 2, end, height, 2,
        ]));
        if (!ramp) throw new Error("Invalid synthetic slope hull");
        world.createCollider(ramp);
      }
      const spawn = fixture === "recovery" ? worldPoint(0, -10, 0) : SPAWN;
      const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z));
      const collider = world.createCollider(R.ColliderDesc.capsule(KINEMATIC_CONFIG.capsuleHalfHeight, KINEMATIC_CONFIG.capsuleRadius), body);
      const controller = world.createCharacterController(KINEMATIC_CONFIG.contactOffset);
      ownedController = controller;
      controller.setUp({ x: 0, y: 1, z: 0 });
      controller.enableAutostep(KINEMATIC_CONFIG.autostepMaxHeight, KINEMATIC_CONFIG.autostepMinWidth, false);
      controller.enableSnapToGround(KINEMATIC_CONFIG.snapToGroundDistance);
      controller.setMaxSlopeClimbAngle(KINEMATIC_CONFIG.maxSlopeClimbRadians);
      controller.setMinSlopeSlideAngle(KINEMATIC_CONFIG.minSlopeSlideRadians);
      // Register freshly-created colliders in the query structures before casts.
      world.step();
      this.#world = world;
      this.#controller = controller;
      this.#body = body;
      this.#collider = collider;
      this.#position = spawn;
      this.#previousPosition = spawn;
      this.#runtimeVersion = R.version();
      this.#rapier = R;
      this.#lifecycle = "running";
      ownedWorld = null;
      ownedController = null;
      return true;
    } catch (error) {
      if (generation === this.#generation) this.#lifecycle = "error";
      throw error;
    } finally {
      this.#pendingLoads -= 1;
      if (ownedWorld) {
        try {
          if (ownedController) ownedWorld.removeCharacterController(ownedController);
        } finally {
          ownedWorld.free();
        }
      }
    }
  }

  sample(frameTimeMilliseconds: number): number {
    if (!Number.isFinite(frameTimeMilliseconds)) throw new TypeError("Frame time must be finite");
    if (this.#lifecycle !== "running" || this.#input.snapshot.suspended) return 0;
    if (this.#lastFrame !== null && frameTimeMilliseconds < this.#lastFrame) {
      throw new RangeError("Frame time must be monotonic");
    }
    if (this.#lastFrame !== null && frameTimeMilliseconds - this.#lastFrame > KINEMATIC_CONFIG.maxFrameGapMilliseconds) {
      this.#discardedIntervals += 1;
      this.#input.reset();
      this.#unanchor();
    }
    if (this.#lastFrame === null) {
      this.#clock.resume(frameTimeMilliseconds);
      this.#lastFrame = frameTimeMilliseconds;
      return 0;
    }
    this.#lastFrame = frameTimeMilliseconds;
    return this.#clock.sample(frameTimeMilliseconds, dt => this.#step(dt));
  }

  key(code: string, pressed: boolean): boolean {
    if (this.#lifecycle !== "running") return false;
    return pressed ? this.#input.keyDown(code) : this.#input.keyUp(code);
  }
  beginPointer(id: number): boolean { return this.#lifecycle === "running" && this.#input.beginPointer(id); }
  updatePointer(id: number, lateral: number, forward: number): boolean {
    return this.#lifecycle === "running" && this.#input.updatePointer(id, lateral, forward);
  }
  endPointer(id: number): boolean { return this.#input.endPointer(id); }
  cancelPointer(id: number): boolean { return this.#input.cancelPointer(id); }
  lostPointerCapture(id: number): boolean { return this.#input.lostPointerCapture(id); }
  setYaw(radians: number): void {
    if (!Number.isFinite(radians)) throw new TypeError("Yaw must be finite");
    this.#yaw = radians;
  }

  camera(config: ThirdPersonCameraConfig, radius: number): ThirdPersonCameraResult | null {
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new RangeError("Camera shape radius must be finite and greater than zero");
    }
    const world = this.#world;
    const collider = this.#collider;
    const focus = this.#position;
    const R = this.#rapier;
    if (this.#lifecycle !== "running" || !world || !collider || !focus || !R) return null;

    const clear = resolveThirdPersonCamera(focus, config);
    const delta = {
      x: clear.position.x - clear.focus.x,
      y: clear.position.y - clear.focus.y,
      z: clear.position.z - clear.focus.z,
    };
    const inverseDistance = 1 / clear.desiredDistance;
    const hit = world.castShape(
      clear.focus,
      { x: 0, y: 0, z: 0, w: 1 },
      {
        x: delta.x * inverseDistance,
        y: delta.y * inverseDistance,
        z: delta.z * inverseDistance,
      },
      new R.Ball(radius),
      0,
      clear.desiredDistance,
      true,
      undefined,
      undefined,
      collider,
    );
    if (!hit) return clear;

    const resolvedDistance = Math.max(config.minDistance, hit.time_of_impact - config.obstructionClearance);
    const ratio = resolvedDistance / clear.desiredDistance;
    return Object.freeze({
      ...clear,
      position: worldPoint(
        clear.focus.x + delta.x * ratio,
        clear.focus.y + delta.y * ratio,
        clear.focus.z + delta.z * ratio,
      ),
      resolvedDistance,
      occluded: true,
      obstructionId: `rapier:${hit.collider.handle}`,
    });
  }

  setHidden(hidden: boolean): void {
    if (this.#hidden === hidden) return;
    this.#hidden = hidden;
    this.#input.setHidden(hidden);
    this.#unanchor();
  }
  setSemanticSuspended(suspended: boolean): void {
    if (this.#semanticSuspended === suspended) return;
    this.#semanticSuspended = suspended;
    this.#input.setSemanticSuspended(suspended);
    this.#unanchor();
  }
  blur(): void { this.#input.blur(); this.#unanchor(); }
  reset(): Promise<boolean> { return this.start(this.#fixture); }
  stop(): void {
    this.#generation += 1;
    this.#lifecycle = "stopped";
    this.#clock.reset();
    this.#input.reset();
    this.#lastFrame = null;
    this.#verticalVelocity = 0;
    this.#grounded = false;
    this.#disposeWorld();
  }

  #unanchor(): void { this.#clock.suspend(); this.#lastFrame = null; }
  #step(dt: number): void {
    const world = this.#world;
    const body = this.#body;
    const collider = this.#collider;
    const controller = this.#controller;
    if (!world || !body || !collider || !controller) return;
    const before = body.translation();
    if (before.y < KINEMATIC_CONFIG.minimumY || Math.abs(before.x) > KINEMATIC_CONFIG.worldLimit
      || Math.abs(before.z) > KINEMATIC_CONFIG.worldLimit) {
      // Recovery is an explicit physics-owned teleport, never an animation write.
      body.setTranslation(SPAWN, true);
      body.setNextKinematicTranslation(SPAWN);
      world.propagateModifiedBodyPositionsToColliders();
      this.#position = SPAWN;
      this.#previousPosition = SPAWN;
      this.#verticalVelocity = 0;
      this.#grounded = false;
      this.#input.reset();
      this.#recoveries += 1;
      return;
    }
    const direction = cameraRelativeMovement(this.#input.snapshot.intent, this.#yaw);
    this.#verticalVelocity = Math.max(-KINEMATIC_CONFIG.terminalFallSpeed,
      this.#verticalVelocity + KINEMATIC_CONFIG.gravityMetresPerSecondSquared * dt);
    controller.computeColliderMovement(collider, {
      x: direction.x * KINEMATIC_CONFIG.speedMetresPerSecond * dt,
      y: this.#verticalVelocity * dt,
      z: direction.z * KINEMATIC_CONFIG.speedMetresPerSecond * dt,
    });
    const corrected = controller.computedMovement();
    if (![corrected.x, corrected.y, corrected.z].every(Number.isFinite)) {
      this.stop();
      throw new Error("Non-finite Rapier movement; world stopped");
    }
    body.setNextKinematicTranslation({ x: before.x + corrected.x, y: before.y + corrected.y, z: before.z + corrected.z });
    this.#previousPosition = worldPoint(before.x, before.y, before.z);
    world.step();
    const after = body.translation();
    this.#position = worldPoint(after.x, after.y, after.z);
    this.#grounded = controller.computedGrounded();
    if (this.#grounded) this.#verticalVelocity = 0;
  }

  #disposeWorld(): void {
    const world = this.#world;
    const controller = this.#controller;
    this.#world = null;
    this.#controller = null;
    this.#body = null;
    this.#collider = null;
    this.#position = null;
    this.#previousPosition = null;
    this.#runtimeVersion = null;
    this.#rapier = null;
    if (world) {
      try { if (controller) world.removeCharacterController(controller); }
      finally { world.free(); }
    }
  }

  testApi() {
    return Object.freeze({
      state: () => this.snapshot,
      start: (fixture?: WorldFixtureName) => this.start(fixture),
      reset: () => this.reset(),
      stop: () => this.stop(),
      sample: (milliseconds: number) => this.sample(milliseconds),
      key: (code: string, pressed: boolean) => this.key(code, pressed),
      beginPointer: (id: number) => this.beginPointer(id),
      updatePointer: (id: number, lateral: number, forward: number) => this.updatePointer(id, lateral, forward),
      endPointer: (id: number) => this.endPointer(id),
      cancelPointer: (id: number) => this.cancelPointer(id),
      lostPointerCapture: (id: number) => this.lostPointerCapture(id),
      setYaw: (yaw: number) => this.setYaw(yaw),
      camera: (config: ThirdPersonCameraConfig, radius: number) => this.camera(config, radius),
      setHidden: (hidden: boolean) => this.setHidden(hidden),
      setSemanticSuspended: (suspended: boolean) => this.setSemanticSuspended(suspended),
      blur: () => this.blur(),
    });
  }
}
export type KinematicWorldTestApi = ReturnType<KinematicWorld["testApi"]>;
