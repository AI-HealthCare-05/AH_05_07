import { useState } from "react";
import type { RecordExplorerFilter } from "../ui/recordExplorer";

type ExplorerMemory = {
  scope: string;
  filter: RecordExplorerFilter;
  date: string | null;
  focusKey: string | null;
  scrollY: number | null;
};

const emptyMemory = (scope: string): ExplorerMemory => ({ scope, filter: "all", date: null, focusKey: null, scrollY: null });

/** Disposable application memory, scoped to session generation and date bounds. */
export function useRecordExplorerMemory(scope: string) {
  const [stored, setStored] = useState(() => emptyMemory(scope));
  const memory = stored.scope === scope ? stored : emptyMemory(scope);
  // Reset before children render: A -> B -> A must not revive A's selection.
  if (stored.scope !== scope) setStored(memory);

  return {
    ...memory,
    setFilter: (filter: RecordExplorerFilter) => setStored({ ...memory, filter, focusKey: null, scrollY: null }),
    setDate: (date: string | null) => setStored({ ...memory, date, focusKey: null, scrollY: null }),
    reset: () => setStored(emptyMemory(scope)),
    remember: (focusKey: string, scrollY: number) => setStored({ ...memory, focusKey, scrollY }),
  };
}
