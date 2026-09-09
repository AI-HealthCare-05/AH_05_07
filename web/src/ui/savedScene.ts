import type { JourneyScreenId } from "./journey";

/** One ephemeral presentation opportunity. No record, account or request identity. */
export type SavedSceneEvent = {
  readonly key: number;
  claim: () => boolean;
  skip: () => void;
  failed: boolean;
};

let presentationSerial = 0;
export function createSavedSceneEvent(): SavedSceneEvent {
  let pending = true;
  return {
    key: ++presentationSerial,
    claim: () => {
      const claimed = pending;
      pending = false;
      return claimed;
    },
    skip: () => { pending = false; },
    failed: false,
  };
}

/** Separate from the calendar manifest: S05 retains its approved bear and layout. */
export function allowsSavedScene(gate: unknown, screen: JourneyScreenId, confirmed: boolean): boolean {
  return gate === "review" && screen === "S05" && confirmed;
}
