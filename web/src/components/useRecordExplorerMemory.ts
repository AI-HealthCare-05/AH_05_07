import { useCallback, useEffect, useState } from "react";
import type { ExplorerSelection } from "../ui/recordExplorer";
import type { ScreenId } from "../ui/journey";

export type ExplorerReturnPoint = { key: string; scrollY: number };
type ExplorerMemory = {
  scope: string;
  selection: ExplorerSelection;
  returnPoint: ExplorerReturnPoint | null;
  restorePending: boolean;
};

const emptyMemory = (scope: string): ExplorerMemory => ({
  scope, selection: { filter: "all", date: null }, returnPoint: null, restorePending: false,
});

/** Owned by App so S09 unmounting the list does not lose its local context. */
export function useRecordExplorerMemory(scope: string, screen: ScreenId) {
  const [saved, setSaved] = useState(() => emptyMemory(scope));
  let memory = saved;
  if (saved.scope !== scope) {
    // Reset before children render on any session generation or calendar-window
    // change, including A -> B -> A. Nothing is written to history or storage.
    memory = emptyMemory(scope);
    setSaved(memory);
  }

  useEffect(() => {
    if (screen !== "S08" && screen !== "S09" && screen !== "S04") {
      setSaved(current => current.returnPoint ? { ...current, returnPoint: null, restorePending: false } : current);
    } else if (screen === "S09") {
      // Browser Forward reopens the detail without invoking the row's onOpen.
      setSaved(current => current.returnPoint && !current.restorePending ? { ...current, restorePending: true } : current);
    }
  }, [screen]);

  const select = useCallback((selection: ExplorerSelection) => {
    setSaved(current => ({ ...current, selection, returnPoint: null, restorePending: false }));
  }, []);
  const remember = useCallback((key: string) => {
    setSaved(current => ({ ...current, returnPoint: { key, scrollY: window.scrollY }, restorePending: true }));
  }, []);
  const restored = useCallback(() => {
    setSaved(current => ({ ...current, restorePending: false }));
  }, []);

  return { selection: memory.selection, returnPoint: memory.restorePending ? memory.returnPoint : null, select, remember, restored };
}
