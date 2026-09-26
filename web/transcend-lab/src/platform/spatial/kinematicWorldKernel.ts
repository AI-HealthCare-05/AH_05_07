import { WorldMovementIntentController } from "../behavior/worldMovementIntent";
import {
  cameraRelativeMovement,
  resolveThirdPersonCamera,
  type ThirdPersonCameraConfig,
  type ThirdPersonCameraResult,
} from "./thirdPersonCamera";
import type { RapierModule } from "./rapierRuntime";
import { FixedStepClock, worldPoint, type WorldPoint3 } from "./worldSpaceClock";

type PhysicsWorld = import("@dimforge/rapier3d-compat").World;
type CharacterController = import("@dimforge/rapier3d-compat").KinematicCharacterController;
type Body = import("@dimforge/rapier3d-compat").RigidBody;
type Collider = import("@dimforge/rapier3d-compat").Collider;

export type KinematicKernelConfig = Readonly<{
  stepSeconds: number;
  speedMetresPerSecond: number;
  gravityMetresPerSecondSquared: number;
  terminalFallSpeed: number;
  capsuleHalfHeight: number;
  capsuleRadius: number;
  contactOffset: number;
  autostepMaxHeight: number;
  autostepMinWidth: number;
  snapToGroundDistance: number;
  maxSlopeClimbRadians: number;
  minSlopeSlideRadians: number;
  worldLimit: number;
  minimumY: number;
  maxFrameGapMilliseconds: number;
}>;

export type KinematicWorldProfile<FixtureName extends string> = Readonly<{
  fixtures: readonly FixtureName[];
  defaultFixture: FixtureName;
  recoveryPoint: WorldPoint3;
  config: KinematicKernelConfig;
  populate: (context: Readonly<{
    rapier: RapierModule;
    world: PhysicsWorld;
    fixture: FixtureName;
  }>) => WorldPoint3;
}>;

type WorldLifecycle = "stopped" | "loading" | "running" | "error";

/**
 * Reusable fixed-step kinematic world kernel.
 *
 * The kernel owns simulation/input/physics lifecycle only. Environment geometry
 * and the initial spawn point come from an injected profile, so W1 fixture policy
 * stays outside this module.
 */
export class KinematicWorldKernel<FixtureName extends string> {
  readonly #profile: KinematicWorldProfile<FixtureName>;
  readonly #config: KinematicKernelConfig;
  readonly #clock: FixedStepClock;
  readonly #input = new WorldMovementIntentController();
  readonly #loadRapier: () => Promise<RapierModule>;
  #generation = 0;
  #pendingLoads = 0;
  #lifecycle: WorldLifecycle = "stopped";
  #fixture: FixtureName;
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

  constructor(
    profile: KinematicWorldProfile<FixtureName>,
    loadRapier: () => Promise<RapierModule>,
  ) {
    if (profile.fixtures.length === 0) throw new Error("kinematic profile requires at least one fixture");
    if (!(profile.fixtures as readonly string[]).includes(profile.defaultFixture)) {
      throw new Error("kinematic profile default fixture must be declared");
    }
    this.#profile = profile;
    this.#config = profile.config;
    this.#clock = new FixedStepClock(profile.config.stepSeconds);
    this.#loadRapier = loadRapier;
    this.#fixture = profile.defaultFixture;
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

  async start(fixture: FixtureName = this.#profile.defaultFixture): Promise<boolean> {
    if (!(this.#profile.fixtures as readonly string[]).includes(fixture)) {
      throw new RangeError("Unknown kinematic fixture");
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
      const world = new R.World({ x: 0, y: this.#config.gravityMetresPerSecondSquared, z: 0 });
      ownedWorld = world;
      world.timestep = this.#config.stepSeconds;
      const spawn = this.#profile.populate({ rapier: R, world, fixture });
      const body = world.createRigidBody(
        R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
      );
      const collider = world.createCollider(
        R.ColliderDesc.capsule(this.#config.capsuleHalfHeight, this.#config.capsuleRadius),
        body,
      );
      const controller = world.createCharacterController(this.#config.contactOffset);
      ownedController = controller;
      controller.setUp({ x: 0, y: 1, z: 0 });
      controller.enableAutostep(
        this.#config.autostepMaxHeight,
        this.#config.autostepMinWidth,
        false,
      );
      controller.enableSnapToGround(this.#config.snapToGroundDistance);
      controller.setMaxSlopeClimbAngle(this.#config.maxSlopeClimbRadians);
      controller.setMinSlopeSlideAngle(this.#config.minSlopeSlideRadians);
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
    if (
      this.#lastFrame !== null
      && frameTimeMilliseconds - this.#lastFrame > this.#config.maxFrameGapMilliseconds
    ) {
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

  beginPointer(id: number): boolean {
    return this.#lifecycle === "running" && this.#input.beginPointer(id);
  }

  updatePointer(id: number, lateral: number, forward: number): boolean {
    return this.#lifecycle === "running" && this.#input.updatePointer(id, lateral, forward);
  }

  endPointer(id: number): boolean {
    return this.#input.endPointer(id);
  }

  cancelPointer(id: number): boolean {
    return this.#input.cancelPointer(id);
  }

  lostPointerCapture(id: number): boolean {
    return this.#input.lostPointerCapture(id);
  }

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

    const resolvedDistance = Math.max(
      config.minDistance,
      hit.time_of_impact - config.obstructionClearance,
    );
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

  blur(): void {
    this.#input.blur();
    this.#unanchor();
  }

  reset(): Promise<boolean> {
    return this.start(this.#fixture);
  }

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

  #unanchor(): void {
    this.#clock.suspend();
    this.#lastFrame = null;
  }

  #step(dt: number): void {
    const world = this.#world;
    const body = this.#body;
    const collider = this.#collider;
    const controller = this.#controller;
    if (!world || !body || !collider || !controller) return;
    const before = body.translation();
    if (
      before.y < this.#config.minimumY
      || Math.abs(before.x) > this.#config.worldLimit
      || Math.abs(before.z) > this.#config.worldLimit
    ) {
      const recoveryPoint = this.#profile.recoveryPoint;
      body.setTranslation(recoveryPoint, true);
      body.setNextKinematicTranslation(recoveryPoint);
      world.propagateModifiedBodyPositionsToColliders();
      this.#position = recoveryPoint;
      this.#previousPosition = recoveryPoint;
      this.#verticalVelocity = 0;
      this.#grounded = false;
      this.#input.reset();
      this.#recoveries += 1;
      return;
    }
    const direction = cameraRelativeMovement(this.#input.snapshot.intent, this.#yaw);
    this.#verticalVelocity = Math.max(
      -this.#config.terminalFallSpeed,
      this.#verticalVelocity + this.#config.gravityMetresPerSecondSquared * dt,
    );
    controller.computeColliderMovement(collider, {
      x: direction.x * this.#config.speedMetresPerSecond * dt,
      y: this.#verticalVelocity * dt,
      z: direction.z * this.#config.speedMetresPerSecond * dt,
    });
    const corrected = controller.computedMovement();
    if (![corrected.x, corrected.y, corrected.z].every(Number.isFinite)) {
      this.stop();
      throw new Error("Non-finite Rapier movement; world stopped");
    }
    body.setNextKinematicTranslation({
      x: before.x + corrected.x,
      y: before.y + corrected.y,
      z: before.z + corrected.z,
    });
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
      try {
        if (controller) world.removeCharacterController(controller);
      } finally {
        world.free();
      }
    }
  }

  testApi() {
    return Object.freeze({
      state: () => this.snapshot,
      start: (fixture?: FixtureName) => this.start(fixture),
      reset: () => this.reset(),
      stop: () => this.stop(),
      sample: (milliseconds: number) => this.sample(milliseconds),
      key: (code: string, pressed: boolean) => this.key(code, pressed),
      beginPointer: (id: number) => this.beginPointer(id),
      updatePointer: (id: number, lateral: number, forward: number) =>
        this.updatePointer(id, lateral, forward),
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
