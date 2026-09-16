import { companionSpecies, type CompanionSpecies } from "./companion";

export const companionIdentityStorageKey = "sk7-companion-species";

const companionIdentityLabels: Readonly<Record<CompanionSpecies, string>> = {
  bear: "곰",
  rabbit: "토끼",
  cat: "고양이",
  dog: "강아지",
  red_panda: "레서판다",
  otter: "수달",
  capybara: "카피바라",
  hedgehog: "고슴도치",
  penguin: "펭귄",
  fox: "여우",
  squirrel: "다람쥐",
};

export const companionIdentityOptions = companionSpecies.map((species) => ({
  species,
  label: companionIdentityLabels[species],
})) as readonly Readonly<{ species: CompanionSpecies; label: string }>[];

export function normalizeCompanionIdentitySpecies(value: unknown): CompanionSpecies {
  return typeof value === "string" && (companionSpecies as readonly string[]).includes(value)
    ? value as CompanionSpecies
    : "bear";
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCompanionIdentity(storage: Pick<Storage, "getItem"> | null = browserStorage()): CompanionSpecies {
  if (!storage) return "bear";
  try {
    return normalizeCompanionIdentitySpecies(storage.getItem(companionIdentityStorageKey));
  } catch {
    return "bear";
  }
}

export function writeCompanionIdentity(
  species: CompanionSpecies,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): CompanionSpecies {
  if (!storage) return species;
  try {
    storage.setItem(companionIdentityStorageKey, species);
  } catch {
    // A blocked preference store must never block the product.
  }
  return species;
}
