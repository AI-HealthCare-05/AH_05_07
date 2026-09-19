import type { CompanionSpecies } from "./companion";
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
