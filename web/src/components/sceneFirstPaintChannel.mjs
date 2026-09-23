/**
 * SceneShell-local active-visit channel for F1 first-paint identity.
 *
 * Pure, side-effect-free logic. No timers, storage, random identity, or DOM.
 * The React provider in SceneFirstPaintWitness.tsx wires this into the tree.
 */

/**
 * @typedef {"loading" | "ready" | "failed"} SceneFirstPaintPhase
 */

/**
 * @typedef {Readonly<{
 *   token: string;
 *   screen: string;
 *   assetId: string;
 *   assetUrl: string;
 *   phase: SceneFirstPaintPhase;
 * }>} SceneFirstPaintVisit
 */

/**
 * @typedef {Readonly<{ activeVisit: SceneFirstPaintVisit | null }>} SceneFirstPaintChannelState
 */

/**
 * @typedef {Readonly<
 *   | { type: "activate"; token: string; screen: string; assetId: string; assetUrl: string }
 *   | { type: "ready"; token: string }
 *   | { type: "failed"; token: string }
 *   | { type: "clear"; token: string }
 * >} SceneFirstPaintChannelAction
 */

/** @type {SceneFirstPaintChannelState} */
export const initialSceneFirstPaintChannelState = Object.freeze({
  activeVisit: null,
});

/**
 * Reducer for the SceneShell-local active-visit channel.
 *
 * Rules:
 * - A new activation always replaces the previous active visit.
 * - Transitions and clears are ignored for a stale token.
 * - A clear from an old token must never wipe a newer token.
 * - `ready` is ignored once the visit has already failed.
 */
export function sceneFirstPaintChannelReducer(state, action) {
  const active = state.activeVisit;

  switch (action.type) {
    case "activate": {
      if (
        active
        && active.token === action.token
        && active.screen === action.screen
        && active.assetId === action.assetId
        && active.assetUrl === action.assetUrl
      ) {
        return state;
      }
      return Object.freeze({
        activeVisit: Object.freeze({
          token: action.token,
          screen: action.screen,
          assetId: action.assetId,
          assetUrl: action.assetUrl,
          phase: "loading",
        }),
      });
    }
    case "ready": {
      if (!active || active.token !== action.token || active.phase === "failed") {
        return state;
      }
      if (active.phase === "ready") {
        return state;
      }
      return Object.freeze({
        activeVisit: Object.freeze({ ...active, phase: "ready" }),
      });
    }
    case "failed": {
      if (!active || active.token !== action.token || active.phase === "failed") {
        return state;
      }
      return Object.freeze({
        activeVisit: Object.freeze({ ...active, phase: "failed" }),
      });
    }
    case "clear": {
      if (!active || active.token !== action.token) {
        return state;
      }
      return initialSceneFirstPaintChannelState;
    }
    default:
      return state;
  }
}

/**
 * Strict witness acceptance for the Presence bridge.
 *
 * Requires every field to match the owner-tree descriptor and the phase to be
 * "ready". A missing or mismatched witness is rejected.
 *
 * @param {SceneFirstPaintVisit | null} witness
 * @param {Readonly<{ screen: string; token: string; assetId: string; assetUrl: string }>} expected
 */
export function matchesReadySceneWitness(witness, expected) {
  return (
    witness != null
    && witness.phase === "ready"
    && witness.screen === expected.screen
    && witness.token === expected.token
    && witness.assetId === expected.assetId
    && witness.assetUrl === expected.assetUrl
  );
}
