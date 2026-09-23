import type { CompanionClip, CompanionSpecies } from "./companion";
import { getCompanionAsset, type CompanionAsset } from "./companionAssets.generated";
import { getActiveSceneCharacter } from "./companionSceneRegistry";

/** Returns the generated lite descriptor only when checked-in scene membership agrees. */
export function getActiveCompanionAsset(species: CompanionSpecies): CompanionAsset {
  const activeCharacter = getActiveSceneCharacter(species);
  const asset = getCompanionAsset(species, "lite");

  if (
    asset.species !== activeCharacter.species
    || asset.url !== activeCharacter.url
    || asset.sha256 !== activeCharacter.sha256
  ) {
    throw new Error(`active scene companion asset mismatch: ${species}`);
  }

  return asset;
}

export type ProductCompanionScreen = "S01" | "S02" | "S05" | "S10";

export const productCompanionRequiredClips = Object.freeze({
  S01: Object.freeze(["greet"] as const),
  S02: Object.freeze(["idle"] as const),
  S05: Object.freeze(["celebrate", "idle"] as const),
  S10: Object.freeze(["idle"] as const),
}) satisfies Readonly<Record<ProductCompanionScreen, readonly CompanionClip[]>>;

/** Resolve one product asset only through checked-in active membership and surface capability. */
export function getActiveCompanionAssetForScreen(
  species: CompanionSpecies,
  screen: ProductCompanionScreen,
): CompanionAsset {
  const activeCharacter = getActiveSceneCharacter(species);
  for (const clip of productCompanionRequiredClips[screen]) {
    if (!activeCharacter.clips.includes(clip)) {
      throw new Error(`active companion is missing ${screen} clip ${clip}: ${species}`);
    }
  }
  return getActiveCompanionAsset(species);
}

/**
 * Validate that an already-selected descriptor is exactly the active member for
 * a surface. Returns the SAME descriptor when valid; rejects/fails closed.
 */
export function validateActiveCompanionAssetForScreen(
  asset: CompanionAsset,
  screen: ProductCompanionScreen,
): CompanionAsset {
  const expected = getActiveCompanionAssetForScreen(asset.species, screen);
  if (
    asset.assetId !== expected.assetId
    || asset.url !== expected.url
    || asset.sha256 !== expected.sha256
    || asset.species !== expected.species
    || asset.variant !== expected.variant
  ) {
    throw new Error(`descriptor does not match active ${screen} membership for ${asset.species}`);
  }
  return asset;
}
