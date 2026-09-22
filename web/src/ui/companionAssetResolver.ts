import type { CompanionMode, CompanionSelection } from "./companion";
import { getActiveCompanionAssetForScreen } from "./companionActiveAsset";
import { getCompanionAsset, type CompanionAsset } from "./companionAssets.generated";

/**
 * Single asset-identity resolver for the legacy product renderer boundary.
 * Product selections use active membership. Only an explicit review selection
 * may read the broader immutable delivery catalog, and production ignores it.
 */
export function resolveCompanionRuntimeAsset(
  mode: CompanionMode,
  selection: CompanionSelection,
): CompanionAsset | null {
  if (selection.assetScope === "review-catalog") {
    return mode === "review"
      ? getCompanionAsset(selection.species, selection.variant)
      : null;
  }
  if (selection.variant !== "lite") return null;
  if (selection.screen === "S03") return null;
  return getActiveCompanionAssetForScreen(selection.species, selection.screen);
}
