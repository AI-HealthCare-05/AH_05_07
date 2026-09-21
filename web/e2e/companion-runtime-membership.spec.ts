import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { companionSpecies, companionVariants } from "../src/ui/companion";
import { getActiveCompanionAsset } from "../src/ui/companionActiveAsset";
import {
  companionAssetManifest,
  getCompanionAsset,
} from "../src/ui/companionAssets.generated";
import {
  activeCompanionAssetIds,
  getCompanionRuntimeMembership,
} from "../src/ui/companionRuntimeMembership";

type CandidateInventory = Readonly<{
  candidates: readonly Readonly<{ candidateId: string }>[];
}>;

const candidateInventory = JSON.parse(
  readFileSync(new URL("../asset-candidates/companion-candidates.v1.json", import.meta.url), "utf8"),
) as CandidateInventory;

test("runtime membership contains exactly the checked-in lite companion identities", () => {
  expect(activeCompanionAssetIds).toHaveLength(companionSpecies.length);
  expect(new Set(activeCompanionAssetIds).size).toBe(companionSpecies.length);

  for (const species of companionSpecies) {
    const lite = getCompanionAsset(species, "lite");
    const active = getActiveCompanionAsset(species);
    const membership = getCompanionRuntimeMembership(lite.assetId);

    expect(active).toBe(lite);
    expect(membership).toEqual({
      assetId: lite.assetId,
      status: "active-runtime-member",
      asset: lite,
    });
  }
});

test("every standard companion remains catalog-only", () => {
  for (const species of companionSpecies) {
    const standard = getCompanionAsset(species, "standard");
    const membership = getCompanionRuntimeMembership(standard.assetId);

    expect(membership).toEqual({
      assetId: standard.assetId,
      status: "catalog-only",
      asset: standard,
    });
    expect(activeCompanionAssetIds).not.toContain(standard.assetId);
  }
});

test("all 22 generated catalog assets have one deterministic membership state", () => {
  const seen = new Set<string>();

  for (const species of companionSpecies) {
    for (const variant of companionVariants) {
      const asset = companionAssetManifest[species][variant];
      const active = getActiveCompanionAsset(species);
      const membership = getCompanionRuntimeMembership(asset.assetId);

      expect(seen.has(asset.assetId)).toBe(false);
      seen.add(asset.assetId);

      expect(membership.asset).toBe(asset);
      expect(membership.status).toBe(
        asset.assetId === active.assetId ? "active-runtime-member" : "catalog-only",
      );
    }
  }

  expect(seen.size).toBe(22);
});

test("the Learning Record bridge seam can project rabbit-lite immutable identity", () => {
  const rabbitLite = getCompanionAsset("rabbit", "lite");
  expect(rabbitLite.assetId).toBe("COMPANION-R2-003");

  const membership = getCompanionRuntimeMembership("COMPANION-R2-003");

  expect(membership.status).toBe("active-runtime-member");
  expect(membership.asset).toBe(rabbitLite);
});

test("review-only candidates and arbitrary ids cannot expand runtime membership", () => {
  expect(candidateInventory.candidates.length).toBeGreaterThan(0);

  for (const candidate of candidateInventory.candidates) {
    expect(getCompanionRuntimeMembership(candidate.candidateId)).toEqual({
      assetId: candidate.candidateId,
      status: "unknown",
      asset: null,
    });
    expect(activeCompanionAssetIds).not.toContain(candidate.candidateId);
  }

  for (const assetId of ["COMPANION-R2-999", ""]) {
    expect(getCompanionRuntimeMembership(assetId)).toEqual({
      assetId,
      status: "unknown",
      asset: null,
    });
  }
});
