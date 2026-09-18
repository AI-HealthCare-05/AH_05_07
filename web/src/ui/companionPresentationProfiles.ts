import type { CompanionSpecies } from "./companion";

export type SceneCharacterSurface = "S02" | "S10";

export type SceneCharacterPresentationProfile = Readonly<{
  scale: number;
}>;

const s02ScaleOverrides: Readonly<Partial<Record<CompanionSpecies, number>>> = {
  rabbit: 1.03,
  capybara: 0.96,
  hedgehog: 0.95,
  fox: 0.92,
  squirrel: 0.99,
};

const s10ScaleOverrides: Readonly<Partial<Record<CompanionSpecies, number>>> = {
  hedgehog: 0.86,
};

/**
 * Presentation data is deliberately separate from binary identity.
 * Candidate inventory entries cannot reach this resolver or become active assets.
 */
export function getSceneCharacterPresentationProfile(
  surface: SceneCharacterSurface,
  species: CompanionSpecies,
): SceneCharacterPresentationProfile {
  const scale = surface === "S10"
    ? (s10ScaleOverrides[species] ?? s02ScaleOverrides[species] ?? 1)
    : (s02ScaleOverrides[species] ?? 1);
  return { scale };
}
