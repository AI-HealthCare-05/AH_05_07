import type { WorldRuntimePort } from "../spatial/worldRuntimePort";

export interface WorldPlayableSession {
  readonly runtime: WorldRuntimePort;
  start(): Promise<boolean>;
  stop(): void;
  setSemanticSuspended(suspended: boolean): void;
}
