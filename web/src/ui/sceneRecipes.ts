import { sceneManifest } from "./sceneManifest.generated";
import { getCompanionAsset } from "./companionAssets.generated";
import type { CompanionSpecies } from "./companion";

export type SceneProfile = "mobile320" | "mobile390" | "desktop";
type Poster = Readonly<{ id: string; url: string }>;

export type SceneRecipe = Readonly<{
  id: string;
  environment: "landmark" | "diorama";
  characterUrl: string;
  characterScale: number;
  posters: Readonly<Record<SceneProfile, Poster>>;
  compositions: Extract<(typeof sceneManifest.recipes)[number], { mode: "realtime" }>["compositions"];
}>;

/** Only build-verified S02/S10 recipes are reachable. No URL/query overrides. */
export function findSceneRecipe(screen: string, landmarkId: string): SceneRecipe | null {
  const recipe = sceneManifest.recipes.find(entry => entry.mode === "realtime" && entry.status === "review"
    && entry.landmarkId === landmarkId && entry.screens.some(id => id === screen));
  if (!recipe || recipe.mode !== "realtime") return null;
  const character = sceneManifest.assets.find(asset => asset.kind === "character" && recipe.assetIds.some(id => id === asset.id));
  const environment = sceneManifest.assets.find(asset => asset.kind === "environment" && asset.id === recipe.environmentAssetId);
  if (!character || !("delivery" in character) || !environment || !("sourceModule" in environment)
    || !recipe.assetIds.some(id => id === environment.id)) return null;
  const fallback = sceneManifest.recipes.find(entry => entry.id === recipe.fallback.tier1RecipeId);
  if (!fallback || fallback.mode !== "static" || fallback.landmarkId !== recipe.landmarkId || !fallback.screens.some(id => id === screen)) return null;
  const posters = {} as Record<SceneProfile, Poster>;
  for (const profile of ["mobile320", "mobile390", "desktop"] as const) {
    const assetId = fallback.compositions[profile].posterAssetId;
    const poster = sceneManifest.assets.find(asset => asset.id === assetId && asset.kind === "poster");
    if (!poster || !("delivery" in poster) || !fallback.assetIds.some(id => id === poster.id)) return null;
    posters[profile] = { id: poster.id, url: poster.delivery.url };
  }
  return { id: recipe.id, environment: environment.sourceModule.path === "web/src/components/scene/diorama.ts" ? "diorama" : "landmark",
    characterUrl: character.delivery.url, characterScale: 1, posters, compositions: recipe.compositions };
}

export function sceneProfile(viewportWidth: number): SceneProfile {
  return viewportWidth <= 350 ? "mobile320" : viewportWidth <= 580 ? "mobile390" : "desktop";
}

export function sceneComposition(recipe: SceneRecipe, viewportWidth: number) {
  return recipe.compositions[sceneProfile(viewportWidth)];
}

const selectableCharacterMap: Readonly<Record<CompanionSpecies, string>> = (() => {
  const map = {} as Record<CompanionSpecies, string>;
  // The manifest field retains its historical S02 name, but the exact same
  // registered 11 lite identities can be reused by the S10 review owner.
  const allowlist = (sceneManifest as any).s02SelectableCharacters as string[];
  for (const id of allowlist) {
    const asset = sceneManifest.assets.find(a => a.id === id && a.kind === "character");
    const species = (asset as any)?.companionSpecies as CompanionSpecies | undefined;
    if (species) map[species] = id;
  }
  return map;
})();

// Conservative identity-size corrections established for S02. The S10 review
// candidate reuses them, then browser bounds checks all species before publication.
const s02CharacterScale: Readonly<Partial<Record<CompanionSpecies, number>>> = {
  rabbit: 1.03,
  capybara: 0.96,
  hedgehog: 0.95,
  fox: 0.92,
  squirrel: 0.99,
};

// S10 has a different orthographic composition. Keep its small fit correction
// separate so S02's already-qualified framing does not move.
const s10CharacterScale: Readonly<Partial<Record<CompanionSpecies, number>>> = {
  hedgehog: 0.86,
};

function resolveSelectableCharacterRecipe(
  baseRecipe: SceneRecipe,
  screen: "S02" | "S10",
  species: CompanionSpecies,
): SceneRecipe {
  const prefix = `${screen.toLowerCase()}-`;
  if (!baseRecipe.id.startsWith(prefix)) {
    throw new Error(`${screen} identity binding rejected for non-${screen} recipe`);
  }
  const registeredId = selectableCharacterMap[species];
  if (!registeredId) throw new Error(`unregistered selectable species: ${species}`);
  const registered = sceneManifest.assets.find(a => a.id === registeredId && a.kind === "character");
  if (!registered || !("delivery" in registered)) {
    throw new Error(`missing registered character: ${registeredId}`);
  }
  const companion = getCompanionAsset(species, "lite");
  if (registered.delivery.url !== companion.url || registered.delivery.sha256 !== companion.sha256) {
    throw new Error(`scene registration mismatch for ${species}`);
  }
  return {
    ...baseRecipe,
    characterUrl: registered.delivery.url,
    characterScale: screen === "S10"
      ? (s10CharacterScale[species] ?? s02CharacterScale[species] ?? 1)
      : (s02CharacterScale[species] ?? 1),
  };
}

/**
 * Bind a registered S02 recipe to the saved non-medical lite identity.
 * Recipe/environment/poster/composition ownership remains unchanged.
 */
export function resolveS02CharacterRecipe(
  baseRecipe: SceneRecipe,
  species: CompanionSpecies,
): SceneRecipe {
  return resolveSelectableCharacterRecipe(baseRecipe, "S02", species);
}

/**
 * Review-only S10 ownership candidate. Uses exactly the same registered lite
 * identity set as S02; production authorization remains in scenePolicy.
 */
export function resolveS10CharacterRecipe(
  baseRecipe: SceneRecipe,
  species: CompanionSpecies,
): SceneRecipe {
  return resolveSelectableCharacterRecipe(baseRecipe, "S10", species);
}
