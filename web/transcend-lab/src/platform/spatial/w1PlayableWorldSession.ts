import type { WorldPlayableSession } from "../runtime/worldPlayableSession";
import type { KinematicWorld } from "./kinematicWorld";

export function createW1PlayableWorldSession(world: KinematicWorld): WorldPlayableSession {
  return Object.freeze({
    runtime: world,
    start: () => world.start("playable"),
    stop: () => world.stop(),
    setSemanticSuspended: (suspended: boolean) => world.setSemanticSuspended(suspended),
  });
}
