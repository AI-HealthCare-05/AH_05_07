import { sceneManifest } from "./sceneManifest.generated";

const character = sceneManifest.assets.find(asset => asset.kind === "character")!;
const environment = sceneManifest.assets.find(asset => asset.kind === "environment")!;
export type SceneProfile = "mobile320" | "mobile390" | "desktop";
type Poster = Readonly<{ id: string; url: string }>;

export type SceneRecipe = Readonly<{
  id: string;
  characterUrl: string;
  posters: Readonly<Record<SceneProfile, Poster>>;
  compositions: Extract<(typeof sceneManifest.recipes)[number], { mode: "realtime" }>["compositions"];
}>;

/** Only build-verified, registered S02 recipes are reachable. No URL/query overrides. */
export function findSceneRecipe(screen: string, landmarkId: string): SceneRecipe | null {
  const recipe = sceneManifest.recipes.find(entry => entry.mode === "realtime" && entry.status === "review"
    && entry.landmarkId === landmarkId && entry.screens.some(id => id === screen));
  if (!recipe || recipe.mode !== "realtime") return null;
  if (!recipe.assetIds.some(id => id === character.id) || !recipe.assetIds.some(id => id === environment.id)) return null;
  const fallback = sceneManifest.recipes.find(entry => entry.id === recipe.fallback.tier1RecipeId);
  if (!fallback || fallback.mode !== "static" || fallback.landmarkId !== recipe.landmarkId) return null;
  const posters = {} as Record<SceneProfile, Poster>;
  for (const profile of ["mobile320", "mobile390", "desktop"] as const) {
    const assetId = fallback.compositions[profile].posterAssetId;
    const poster = sceneManifest.assets.find(asset => asset.id === assetId && asset.kind === "poster");
    if (!poster || !("delivery" in poster)) return null;
    posters[profile] = { id: poster.id, url: poster.delivery.url };
  }
  return { id: recipe.id, characterUrl: character.delivery.url, posters, compositions: recipe.compositions };
}

export function sceneProfile(viewportWidth: number): SceneProfile {
  return viewportWidth <= 350 ? "mobile320" : viewportWidth <= 580 ? "mobile390" : "desktop";
}

export function sceneComposition(recipe: SceneRecipe, viewportWidth: number) {
  return recipe.compositions[sceneProfile(viewportWidth)];
}
