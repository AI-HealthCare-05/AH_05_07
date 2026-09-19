export type ThemePreference = "cloud" | "warm" | "high-contrast";

export const themePreferenceStorageKey = "sk7-ui-theme";

export const themePreferenceOptions = [
  { value: "cloud", label: "Cloud", description: "SK7 기본 화면" },
  { value: "warm", label: "Warm", description: "조금 더 따뜻한 배경" },
  { value: "high-contrast", label: "High Contrast", description: "글자와 경계를 더 또렷하게" },
] as const satisfies readonly Readonly<{
  value: ThemePreference;
  label: string;
  description: string;
}>[];

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "warm" || value === "high-contrast" ? value : "cloud";
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readThemePreference(
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): ThemePreference {
  if (!storage) return "cloud";
  try {
    return normalizeThemePreference(storage.getItem(themePreferenceStorageKey));
  } catch {
    return "cloud";
  }
}

export function writeThemePreference(
  value: unknown,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): ThemePreference {
  const theme = normalizeThemePreference(value);
  if (!storage) return theme;
  try {
    storage.setItem(themePreferenceStorageKey, theme);
  } catch {
    // A blocked preference store must never block the current-page theme.
  }
  return theme;
}

export function applyThemePreference(
  value: unknown,
  root: Pick<HTMLElement, "dataset"> | null = typeof document === "undefined"
    ? null
    : document.documentElement,
): ThemePreference {
  const theme = normalizeThemePreference(value);
  if (root) root.dataset.sk7Theme = theme;
  return theme;
}
