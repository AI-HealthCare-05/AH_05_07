import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { companionSpecies, companionVariants } from "../src/ui/companion";
import {
  getActiveCompanionAsset,
  getActiveCompanionAssetForScreen,
} from "../src/ui/companionActiveAsset";
import { resolveCompanionRuntimeAsset } from "../src/ui/companionAssetResolver";
import {
  companionAssetManifest,
  getCompanionAsset,
} from "../src/ui/companionAssets.generated";
import {
  activeCompanionAssetIds,
  getCompanionRuntimeMembership,
} from "../src/ui/companionRuntimeMembership";
import {
  companionReviewCatalog,
  getCompanionReviewCatalogEntry,
  getReviewEligibleCompanionAsset,
} from "../src/ui/companionReviewCatalog";
import { getActiveSceneCharacter } from "../src/ui/companionSceneRegistry";

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

test("review catalog enumerates capability-complete delivery metadata without granting activation", () => {
  expect(companionReviewCatalog.status).toBe("review-only");
  expect(companionReviewCatalog.entries).toHaveLength(22);
  expect(companionReviewCatalog.requiredClips).toEqual([
    "idle", "greet", "move", "curious", "celebrate", "rest", "special",
  ]);

  for (const entry of companionReviewCatalog.entries) {
    expect(entry.reviewEligible).toBe(true);
    expect(entry.capabilities).toMatchObject({
      exactIdentity: "verified",
      requiredClips: "complete",
      selfContainedGlb: "complete",
      missingClips: [],
      extensionsRequired: [],
      externalDependencies: [],
    });
    expect(getCompanionReviewCatalogEntry(entry.assetId)).toBe(entry);
    expect(getReviewEligibleCompanionAsset(entry.assetId)).toBe(entry);
  }

  const standard = companionReviewCatalog.entries.find((entry) => entry.variantKey === "standard")!;
  expect(getCompanionRuntimeMembership(standard.assetId).status).toBe("catalog-only");
  expect(resolveCompanionRuntimeAsset("production", {
    screen: "S02",
    species: standard.speciesKey as typeof companionSpecies[number],
    variant: "standard",
    clip: "idle",
    assetScope: "review-catalog",
  })).toBeNull();
});

test("every active species satisfies the S05 celebrate-then-idle resolver contract", () => {
  for (const species of companionSpecies) {
    const asset = getActiveCompanionAssetForScreen(species, "S05");
    const character = getActiveSceneCharacter(species);

    expect(asset.variant).toBe("lite");
    expect(character.clips).toEqual(expect.arrayContaining(["celebrate", "idle"]));
    expect(getCompanionRuntimeMembership(asset.assetId).status).toBe("active-runtime-member");
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
