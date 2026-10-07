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
