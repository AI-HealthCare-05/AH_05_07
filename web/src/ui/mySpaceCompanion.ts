import type { CompanionSpecies } from "./companion";
import { getActiveCompanionAsset } from "./companionActiveAsset";
import type { CompanionAsset } from "./companionAssets.generated";

/** Entry-only selection; a registry failure must not take down My Space. */
export function getMySpaceCompanion(species: CompanionSpecies): CompanionAsset | null {
  try { return validateMySpaceCompanion(getActiveCompanionAsset(species)); }
  catch { return null; }
}

/** No URL/query authority: only the exact checked-in active lite descriptor. */
export function validateMySpaceCompanion(asset: CompanionAsset): CompanionAsset {
  const expected = getActiveCompanionAsset(asset.species);
  for (const key of Object.keys(expected) as (keyof CompanionAsset)[]) {
    if (asset[key] !== expected[key]) throw new Error("Inactive My Space companion descriptor");
  }
  return expected;
}
