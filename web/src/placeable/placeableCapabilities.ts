import type { PlaceableState } from "./controller";

export type PlaceableWorldExplorationInput = Readonly<{
  phase: PlaceableState["phase"];
  preview: boolean;
  pending: boolean;
  editing: boolean;
}>;

/**
 * World exploration is presentation capability, not persistence authority.
 *
 * An initial/failed safe read may leave persisted cosmetics unknown while the
 * already-authorized neutral Plaza remains walkable. Drafts, pending writes,
 * write reconciliation, conflicts, unsupported snapshots and session loss stay
 * fenced. Explicit ready-state editing also retains current spatial suspension.
 */
export function canExplorePlaceableWorld({
  phase,
  preview,
  pending,
  editing,
}: PlaceableWorldExplorationInput): boolean {
  if (preview || pending) return false;
  if (phase === "loading" || phase === "unavailable") return true;
  if (phase === "ready") return !editing;
  return false;
}

export const PLACEABLE_COLD_READ_RETRY_DELAY_MS = 2500;

export type PlaceableInitialReadRecoveryInput = Readonly<{
  mode: "browser" | "account";
  world: boolean;
  phase: PlaceableState["phase"];
  hasConfirmed: boolean;
  hasDraft: boolean;
  hasPending: boolean;
  alreadyAttempted: boolean;
  hidden: boolean;
}>;

/**
 * One visit-local reconciliation is allowed only for an initial, read-only
 * account failure in the 3D Plaza. It never owns mutation retry or authority.
 */
export function shouldAutoRetryInitialPlaceableRead({
  mode,
  world,
  phase,
  hasConfirmed,
  hasDraft,
  hasPending,
  alreadyAttempted,
  hidden,
}: PlaceableInitialReadRecoveryInput): boolean {
  return world
    && mode === "account"
    && phase === "unavailable"
    && !hasConfirmed
    && !hasDraft
    && !hasPending
    && !alreadyAttempted
    && !hidden;
}
