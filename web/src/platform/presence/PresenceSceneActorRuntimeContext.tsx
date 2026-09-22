import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  PresenceSceneActorRuntime,
  type PresenceSceneActorRuntimeSnapshot,
} from "./presenceSceneActorRuntime";

const PresenceSceneActorRuntimeContext = createContext<PresenceSceneActorRuntime | null>(null);

/** One stable logical runtime above route-local S02 presentation. */
export function PresenceSceneActorRuntimeProvider({ children }: { children: ReactNode }) {
  const runtimeRef = useRef<PresenceSceneActorRuntime | null>(null);
  if (!runtimeRef.current) runtimeRef.current = new PresenceSceneActorRuntime();
  const runtime = runtimeRef.current;

  return (
    <PresenceSceneActorRuntimeContext.Provider value={runtime}>
      {children}
    </PresenceSceneActorRuntimeContext.Provider>
  );
}

export function usePresenceSceneActorRuntime(): PresenceSceneActorRuntime {
  const runtime = useContext(PresenceSceneActorRuntimeContext);
  if (!runtime) throw new Error("PresenceSceneActorRuntimeProvider is missing");
  return runtime;
}

export function usePresenceSceneActorRuntimeSnapshot(): PresenceSceneActorRuntimeSnapshot {
  const runtime = usePresenceSceneActorRuntime();
  return useSyncExternalStore(
    listener => runtime.subscribe(listener),
    () => runtime.snapshot,
    () => runtime.snapshot,
  );
}
