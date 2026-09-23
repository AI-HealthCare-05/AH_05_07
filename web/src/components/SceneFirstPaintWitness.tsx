import { createContext, useContext } from "react";
import {
  initialSceneFirstPaintChannelState,
  sceneFirstPaintChannelReducer,
  type SceneFirstPaintChannelAction,
  type SceneFirstPaintChannelState,
  type SceneFirstPaintVisit,
} from "./sceneFirstPaintChannel";

export type { SceneFirstPaintVisit };
export { sceneFirstPaintChannelReducer, initialSceneFirstPaintChannelState };

/**
 * SceneShell-local runtime witness from the exact VisualStage visit.
 *
 * Non-persistent. No query, storage, timers, random identity, or global store.
 * The provider lives in SceneShell because VisualStage is nested below SceneShell
 * while the Presence bridge is its sibling.
 */
const SceneFirstPaintVisitContext = createContext<SceneFirstPaintChannelState["activeVisit"]>(null);
const SceneFirstPaintDispatchContext = createContext<React.Dispatch<SceneFirstPaintChannelAction>>(() => {});

export function useSceneFirstPaintVisit(): SceneFirstPaintVisit | null {
  return useContext(SceneFirstPaintVisitContext);
}

export function useSceneFirstPaintActions(): React.Dispatch<SceneFirstPaintChannelAction> {
  return useContext(SceneFirstPaintDispatchContext);
}

export {
  SceneFirstPaintVisitContext,
  SceneFirstPaintDispatchContext,
  type SceneFirstPaintChannelState,
  type SceneFirstPaintChannelAction,
};
