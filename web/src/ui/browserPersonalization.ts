import { STORAGE_KEY as browserMySpaceStorageKey } from "../placeable/persistence";
import { companionIdentityStorageKey } from "./companionIdentity";
import { startingHomeStorageKey } from "./startingHomePreference";
import { themePreferenceStorageKey } from "./themePreference";

export const browserPersonalizationStorageKeys = [
  themePreferenceStorageKey,
  startingHomeStorageKey,
  companionIdentityStorageKey,
  browserMySpaceStorageKey,
] as const;

type BrowserPersonalizationStorage = Pick<Storage, "getItem" | "removeItem">;

function browserStorage(): BrowserPersonalizationStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function resetBrowserPersonalization(
  storage: BrowserPersonalizationStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    // Confirm every allowlisted key is readable before the first write.
    browserPersonalizationStorageKeys.forEach((key) => storage.getItem(key));
    browserPersonalizationStorageKeys.forEach((key) => storage.removeItem(key));
    return browserPersonalizationStorageKeys.every((key) => storage.getItem(key) === null);
  } catch {
    return false;
  }
}
