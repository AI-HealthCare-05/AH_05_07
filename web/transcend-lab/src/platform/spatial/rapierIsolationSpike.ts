type RapierModule = typeof import("@dimforge/rapier3d-compat");
type RapierWorld = import("@dimforge/rapier3d-compat").World;
type RapierController = import("@dimforge/rapier3d-compat").KinematicCharacterController;

export type RapierProbeMovement = Readonly<{ x: number; y: number; z: number }>;

export type RapierSpikeResult =
  | Readonly<{
      status: "ready";
      generation: number;
      runtimeVersion: string;
      colliderCount: number;
      wall: RapierProbeMovement;
      step: RapierProbeMovement;
      slope: RapierProbeMovement;
      groundedProbe: RapierProbeMovement;
      liveWorld: true;
      liveController: true;
    }>
  | Readonly<{
      status: "stale";
      generation: number;
      liveWorld: false;
      liveController: false;
    }>;

export type RapierSpikeState = Readonly<{
  generation: number;
  liveWorld: boolean;
  liveController: boolean;
}>;

type RapierLoader = () => Promise<RapierModule>;
function finiteMovement(vector: Readonly<{ x: number; y: number; z: number }>): RapierProbeMovement {
  if (![vector.x, vector.y, vector.z].every(Number.isFinite)) {
    throw new Error("Rapier produced a non-finite character movement");
  }
  return Object.freeze({ x: vector.x, y: vector.y, z: vector.z });
}

let rapierInitPromise: Promise<void> | null = null;

async function defaultLoader(): Promise<RapierModule> {
  const module = await import("@dimforge/rapier3d-compat");
  rapierInitPromise ??= module.init();
  await rapierInitPromise;
  return module;
}

/**
 * Lab-only W1 dependency spike.
 *
 * The dynamic import is generation-fenced. stop() invalidates pending import
 * before it can publish a World. A live run owns exactly one Rapier World and
 * one character controller.
 */
export class RapierIsolationSpike {
  #generation = 0;
  #world: RapierWorld | null = null;
  #controller: RapierController | null = null;
  readonly #loadRapier: RapierLoader;

  constructor(loadRapier: RapierLoader = defaultLoader) {
    this.#loadRapier = loadRapier;
  }

  get state(): RapierSpikeState {
    return Object.freeze({
      generation: this.#generation,
      liveWorld: this.#world !== null,
      liveController: this.#controller !== null,
    });
  }

  async run(): Promise<RapierSpikeResult> {
    const generation = ++this.#generation;
    this.#disposeLive();
    const RAPIER = await this.#loadRapier();
    if (generation !== this.#generation) {
      return Object.freeze({
        status: "stale" as const,
        generation,
        liveWorld: false as const,
        liveController: false as const,
      });
    }
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    let published = false;
    let ownedController: RapierController | null = null;
    try {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(6, 0.1, 6).setTranslation(0, -0.1, 0),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.1, 1, 1.2).setTranslation(1.25, 1, 0),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.55, 0.15, 0.35).setTranslation(0, 0.15, -1.2),
      );
      const slopeAngle = Math.PI / 9;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(1.2, 0.1, 0.8)
          .setTranslation(-1.45, 0.35, 0)
          .setRotation({
            x: 0,
            y: 0,
            z: Math.sin(-slopeAngle / 2),
            w: Math.cos(slopeAngle / 2),
          }),
      );

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.75, 0),
      );
      const character = world.createCollider(
        RAPIER.ColliderDesc.capsule(0.5, 0.25),
        body,
      );
      const controller = world.createCharacterController(0.01);
      ownedController = controller;
      controller.setUp({ x: 0, y: 1, z: 0 });
      controller.enableAutostep(0.35, 0.2, false);
      controller.setMaxSlopeClimbAngle(Math.PI / 4);
      controller.setMinSlopeSlideAngle(Math.PI / 3);

      // Populate Rapier's broad-phase/query structures before character casts.
      world.step();

      const probe = (desired: Readonly<{ x: number; y: number; z: number }>) => {
        controller.computeColliderMovement(character, desired);
        return finiteMovement(controller.computedMovement());
      };
      const wall = probe({ x: 2, y: 0, z: 0 });
      const step = probe({ x: 0, y: 0, z: -2 });
      const slope = probe({ x: -2, y: 0, z: 0 });
      const groundedProbe = probe({ x: 0, y: -0.25, z: 0 });

      if (generation !== this.#generation) {
        world.removeCharacterController(controller);
        // The finally block owns World.free() on every unpublished path.
        return Object.freeze({
          status: "stale" as const,
          generation,
          liveWorld: false as const,
          liveController: false as const,
        });
      }

      this.#world = world;
      this.#controller = controller;
      published = true;
      return Object.freeze({
        status: "ready" as const,
        generation,
        runtimeVersion: RAPIER.version(),
        colliderCount: world.colliders.len(),
        wall,
        step,
        slope,
        groundedProbe,
        liveWorld: true as const,
        liveController: true as const,
      });
    } finally {
      if (!published) {
        if (ownedController) {
          try {
            world.removeCharacterController(ownedController);
          } catch {
            // World.free() below is the final ownership barrier.
          }
        }
        try {
          world.free();
        } catch {
          // Preserve the original failure.
        }
      }
    }
  }

  stop(): RapierSpikeState {
    this.#generation += 1;
    this.#disposeLive();
    return this.state;
  }
  #disposeLive(): void {
    const world = this.#world;
    const controller = this.#controller;
    this.#controller = null;
    this.#world = null;
    if (!world) return;
    if (controller) {
      try {
        world.removeCharacterController(controller);
      } catch {
        // World.free() below is the final ownership barrier.
      }
    }
    world.free();
  }
}
