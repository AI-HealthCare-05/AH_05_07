import { companionSpecies, companionVariants } from "./companion";
import { getActiveCompanionAsset } from "./companionActiveAsset";
import {
  companionAssetManifest,
  type CompanionAsset,
} from "./companionAssets.generated";

export type CompanionRuntimeMembershipStatus =
  | "active-runtime-member"
  | "catalog-only"
  | "unknown";

export type CompanionRuntimeMembership = Readonly<{
  assetId: string;
  status: CompanionRuntimeMembershipStatus;
  asset: CompanionAsset | null;
}>;

const catalogByAssetId: ReadonlyMap<string, CompanionAsset> = (() => {
  const map = new Map<string, CompanionAsset>();

  for (const species of companionSpecies) {
    for (const variant of companionVariants) {
      const asset = companionAssetManifest[species][variant];
      if (map.has(asset.assetId)) {
        throw new Error(`duplicate companion asset id: ${asset.assetId}`);
      }
      map.set(asset.assetId, asset);
    }
  }

  return map;
})();

export const activeCompanionAssetIds: readonly string[] = Object.freeze(
  companionSpecies.map((species) => getActiveCompanionAsset(species).assetId),
);

/**
 * Read-only projection of one immutable companion catalog asset into the
 * checked-in active runtime membership boundary.
 *
 * This function does not activate anything. It consumes only the generated
 * immutable companion catalog and the verified active-scene registry.
 */
export function getCompanionRuntimeMembership(
  assetId: string,
): CompanionRuntimeMembership {
  const asset = catalogByAssetId.get(assetId);
  if (!asset) {
    return { assetId, status: "unknown", asset: null };
  }

  const active = getActiveCompanionAsset(asset.species);
  if (
    active.assetId === asset.assetId
    && active.url === asset.url
    && active.sha256 === asset.sha256
  ) {
    return { assetId, status: "active-runtime-member", asset };
  }

  return { assetId, status: "catalog-only", asset };
}
