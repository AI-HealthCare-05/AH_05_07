export type StartingHomePreference = "classic-today" | "my-space";
export const startingHomeStorageKey = "sk7-starting-home";
export const mySpaceStartingDestination = "?experience=e2&view=3d&storage=account";
const defaultStartingHomePreference: StartingHomePreference = "my-space";

export function normalizeStartingHomePreference(value: unknown): StartingHomePreference {
  return value === "my-space" ? "my-space" : "classic-today";
}

function browserStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function readStartingHomePreference(storage: Pick<Storage, "getItem"> | null = browserStorage()): StartingHomePreference {
  if (!storage) return "classic-today";
  try {
    const stored = storage.getItem(startingHomeStorageKey);
    return stored === null ? defaultStartingHomePreference : normalizeStartingHomePreference(stored);
  }
  catch { return "classic-today"; }
}

// Return the stored choice, so blocked writes never promise persistence.
export function writeStartingHomePreference(value: unknown, storage: Pick<Storage, "getItem" | "setItem"> | null = browserStorage()): StartingHomePreference {
  try { storage?.setItem(startingHomeStorageKey, normalizeStartingHomePreference(value)); }
  catch { /* Keep the actual saved choice (or safe default). */ }
  return readStartingHomePreference(storage);
}

/** Only a bare root is a default entry. Any URL context is explicit. */
export function isDefaultHomeEntry(href: string): boolean {
  try {
    const url = new URL(href);
    return url.pathname === "/" && !url.search && !url.hash;
  } catch { return false; }
}

export function resolveStartingHomeDestination(input: {
  defaultEntry: boolean;
  signedIn: boolean;
  evidenceMode: boolean;
  preference: unknown;
}): typeof mySpaceStartingDestination | null {
  return input.defaultEntry && input.signedIn && !input.evidenceMode
    && normalizeStartingHomePreference(input.preference) === "my-space"
    ? mySpaceStartingDestination : null;
}
