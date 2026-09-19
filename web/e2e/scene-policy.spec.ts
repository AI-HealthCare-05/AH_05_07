import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { allScreenIds } from "../src/ui/journey";
import { companionSpecies, companionVariants, type CompanionSpecies } from "../src/ui/companion";
import { getActiveCompanionAsset } from "../src/ui/companionActiveAsset";
import { companionAssetManifest, getCompanionAsset } from "../src/ui/companionAssets.generated";
import { activeSceneCompanionSpecies, getActiveSceneCharacter } from "../src/ui/companionSceneRegistry";
import { getSceneCharacterPresentationProfile } from "../src/ui/companionPresentationProfiles";
import { findSceneRecipe, resolveS02CharacterRecipe, resolveS10CharacterRecipe } from "../src/ui/sceneRecipes";
import { sceneManifest } from "../src/ui/sceneManifest.generated";
import { landmarkForCalendarDate, resolveSceneGate, resolveScenePlan, sceneLandmarks, screenVisualModes, seoulCalendarDate, type ScenePresentation } from "../src/ui/scenePolicy";

type CandidateRecord = Readonly<{
  candidateId: string;
  speciesKey: string;
  variantKey: string;
  sha256: string;
  bytes: number;
  status: "candidate" | "review";
}>;

const candidateInventory = JSON.parse(
  readFileSync(new URL("../asset-candidates/companion-candidates.v1.json", import.meta.url), "utf8"),
) as Readonly<{ candidates: readonly CandidateRecord[] }>;

const presentation: ScenePresentation = { screen: "S02", calendarDate: "2026-09-09", reducedMotion: false, visualDisabled: false, webglAvailable: true, gate: "review" };

test("fixed Seoul weekday journey crosses UTC midnight without challenge inputs", () => {
  expect(seoulCalendarDate(new Date("2026-09-06T14:59:59Z"))).toBe("2026-09-06");
  expect(seoulCalendarDate(new Date("2026-09-06T15:00:00Z"))).toBe("2026-09-07");
  expect(landmarkForCalendarDate("2026-09-06")?.id).toBe("sunset-overlook");
  for (let index = 0; index < 7; index++) expect(landmarkForCalendarDate(`2026-09-${String(index + 7).padStart(2, "0")}`)).toEqual(sceneLandmarks[index]);
  expect(landmarkForCalendarDate("2024-02-29")).not.toBeNull();
  for (const date of ["2026-02-29", "2026-09-31", "invalid", "2026-9-9", "2026-09-09T00:00:00Z"]) expect(landmarkForCalendarDate(date)).toBeNull();
});

test("production S10 requires explicit host ownership while review remains directly available", () => {
  for (const gate of [undefined, null, "", "on", "Review"]) expect(resolveScenePlan({ ...presentation, gate })).toBeNull();
  expect(resolveSceneGate("production")).toBe("production");
  for (const screen of allScreenIds) {
    expect(resolveScenePlan({ ...presentation, gate: "review", screen }) !== null).toBe(screen === "S02" || screen === "S10");
    expect(resolveScenePlan({ ...presentation, gate: "production", screen }) !== null).toBe(screen === "S02");
    expect(resolveScenePlan({ ...presentation, gate: "production", screen, productionS10Enabled: true }) !== null)
      .toBe(screen === "S02" || screen === "S10");
  }
  expect(screenVisualModes.S05).toBe("legacy-s05");
  expect(screenVisualModes.S11).toBe("layered");
});

test("review and production fallbacks retain calendar identity and neutral pose", () => {
  for (const gate of ["review", "production"] as const) {
    const baseline = resolveScenePlan({ ...presentation, gate })!;
    expect(baseline.tier).toBe(2);
    expect(baseline.pose).toBe("neutral-static");
    for (const override of [{ reducedMotion: true }, { webglAvailable: false }]) {
      expect(resolveScenePlan({ ...presentation, gate, ...override })).toEqual({ ...baseline, tier: 1 });
    }
    expect(resolveScenePlan({ ...presentation, gate, visualDisabled: true })).toBeNull();
  }
});

test("untrusted extra domain properties cannot affect scene selection", () => {
  for (const screen of ["S02", "S10"] as const) {
  const baseline = resolveScenePlan({ ...presentation, screen });
  for (const systolic of [80, 120, 200]) for (const status of ["completed", "skipped"]) {
    const tainted = { ...presentation, screen, systolic, diastolic: 60, score: systolic / 200, risk: "synthetic", status, challengeStart: "2026-09-01", modelReady: true };
    expect(resolveScenePlan(tainted)).toEqual(baseline);
  }
  }
});


test("active scene registry resolves every species to its generated lite delivery identity", () => {
  expect([...activeSceneCompanionSpecies]).toEqual([...companionSpecies]);
  expect(activeSceneCompanionSpecies).toHaveLength(11);

  for (const species of companionSpecies) {
    const active = getActiveSceneCharacter(species);
    const generatedLite = getCompanionAsset(species, "lite");
    expect(getActiveCompanionAsset(species)).toBe(generatedLite);
    const registeredAsset = sceneManifest.assets.find((asset) => asset.id === active.id);

    if (!registeredAsset || registeredAsset.kind !== "character" || !("delivery" in registeredAsset)) {
      throw new Error(`missing active scene character registration for ${species}`);
    }

    expect({
      species: active.species,
      assetId: registeredAsset.provenance.sourceAssetId,
      variant: generatedLite.variant,
      url: active.url,
      bytes: registeredAsset.delivery.byteLength,
      sha256: active.sha256,
    }).toEqual({
      species,
      assetId: generatedLite.assetId,
      variant: "lite",
      url: generatedLite.url,
      bytes: generatedLite.bytes,
      sha256: generatedLite.sha256,
    });

    const s02 = resolveS02CharacterRecipe(findSceneRecipe("S02", "sunset-overlook")!, species);
    const s10 = resolveS10CharacterRecipe(findSceneRecipe("S10", "sunset-overlook")!, species);
    expect(s02.characterUrl).toBe(generatedLite.url);
    expect(s10.characterUrl).toBe(generatedLite.url);
    expect(s02.characterScale).toBe(getSceneCharacterPresentationProfile("S02", species).scale);
    expect(s10.characterScale).toBe(getSceneCharacterPresentationProfile("S10", species).scale);
  }
});

test("candidate metadata cannot expand active resolution", () => {
  expect(candidateInventory.candidates.length).toBeGreaterThan(0);

  for (const candidate of candidateInventory.candidates) {
    expect(candidate.status).toMatch(/^(candidate|review)$/);
    expect(Object.keys(candidate)).not.toContain("active");
    expect(Object.keys(candidate)).not.toContain("url");

    if ((activeSceneCompanionSpecies as readonly string[]).includes(candidate.speciesKey)) {
      const active = getActiveSceneCharacter(candidate.speciesKey as CompanionSpecies);
      const generatedLite = getCompanionAsset(candidate.speciesKey as CompanionSpecies, "lite");
      expect({ sha256: active.sha256, bytes: generatedLite.bytes }).not.toEqual({
        sha256: candidate.sha256,
        bytes: candidate.bytes,
      });
    } else {
      expect(() => getActiveSceneCharacter(candidate.speciesKey as CompanionSpecies))
        .toThrow(`inactive scene companion species: ${candidate.speciesKey}`);
    }
  }
});

test("review inventory retains explicit lite and standard delivery descriptors", () => {
  expect(Object.keys(companionAssetManifest)).toEqual([...companionSpecies]);

  for (const species of companionSpecies) {
    for (const variant of companionVariants) {
      const descriptor = getCompanionAsset(species, variant);
      expect(descriptor).toBe(companionAssetManifest[species][variant]);
      expect(descriptor).toMatchObject({ species, variant });
      expect(descriptor.url).toMatch(/^https:\/\/sk7-companion\.gkrry\.com\/companion\/v1\/.+\.glb$/);
      expect(descriptor.bytes).toBeGreaterThan(0);
      expect(descriptor.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  }
});
