import { useCallback, useState, type SetStateAction } from "react";

export type BloodPressureDraft = {
  observedOn: string;
  period: "morning" | "evening";
  systolic: string;
  diastolic: string;
};

export function emptyBloodPressureDraft(observedOn: string): BloodPressureDraft {
  return { observedOn, period: "morning", systolic: "", diastolic: "" };
}

export function isMeaningfulBloodPressureDraft(draft: BloodPressureDraft, initialDate: string): boolean {
  return draft.observedOn !== initialDate || draft.period !== "morning"
    || draft.systolic !== "" || draft.diastolic !== "";
}

function freshDraft(generation: number, today: string) {
  return { generation, initialDate: today, draft: emptyBloodPressureDraft(today), wasAway: false };
}

/** One new entry, owned by App for this loaded page. Never persisted or shared with edit mode. */
export function useNewBloodPressureDraft(generation: number, today: string, active: boolean) {
  const [saved, setSaved] = useState(() => freshDraft(generation, today));
  let memory = saved;
  if (saved.generation !== generation) {
    // Use the existing user generation, not the access token. Reset before
    // children render, including logout/login and A -> B -> A in one batch.
    memory = freshDraft(generation, today);
  } else if (!isMeaningfulBloodPressureDraft(saved.draft, saved.initialDate) && saved.initialDate !== today) {
    // Only untouched defaults follow Seoul midnight. Meaningful dates stay exact.
    memory = freshDraft(generation, today);
  } else if (!active && !saved.wasAway && isMeaningfulBloodPressureDraft(saved.draft, saved.initialDate)) {
    memory = { ...saved, wasAway: true };
  }
  if (memory !== saved) setSaved(memory);

  const setDraft = useCallback((update: SetStateAction<BloodPressureDraft>) => {
    setSaved(current => {
      const draft = typeof update === "function" ? update(current.draft) : update;
      return { ...current, draft, wasAway: current.wasAway && isMeaningfulBloodPressureDraft(draft, current.initialDate) };
    });
  }, []);
  const reset = useCallback((date: string) => {
    setSaved(current => freshDraft(current.generation, date));
  }, []);

  const meaningful = isMeaningfulBloodPressureDraft(memory.draft, memory.initialDate);
  return { draft: memory.draft, meaningful, restored: active && meaningful && memory.wasAway, setDraft, reset };
}
