import { sceneManifest } from "./sceneManifest.generated";

const character = sceneManifest.assets.find(asset => asset.kind === "character")!;
const environment = sceneManifest.assets.find(asset => asset.kind === "environment")!;
const poster = sceneManifest.assets.find(asset => asset.kind === "poster")!;

export type SceneRecipe = Readonly<{
  id: string;
  characterUrl: string;
  fallbackUrl: string;
  compositions: Extract<(typeof sceneManifest.recipes)[number], { mode: "realtime" }>["compositions"];
}>;

/** Only build-verified, registered S02 recipes are reachable. No URL/query overrides. */
export function findSceneRecipe(screen: string, landmarkId: string): SceneRecipe | null {
  const recipe = sceneManifest.recipes.find(entry => entry.mode === "realtime" && entry.status === "review"
    && entry.landmarkId === landmarkId && entry.screens.some(id => id === screen));
  if (!recipe || recipe.mode !== "realtime") return null;
  if (!recipe.assetIds.some(id => id === character.id) || !recipe.assetIds.some(id => id === environment.id)) return null;
  const fallback = sceneManifest.recipes.find(entry => entry.id === recipe.fallback.tier1RecipeId);
  if (!fallback || fallback.mode !== "static" || !fallback.assetIds.some(id => id === poster.id)) return null;
  return { id: recipe.id, characterUrl: character.delivery.url, fallbackUrl: poster.delivery.url, compositions: recipe.compositions };
}

export function sceneComposition(recipe: SceneRecipe, viewportWidth: number) {
  return recipe.compositions[viewportWidth <= 350 ? "mobile320" : viewportWidth <= 580 ? "mobile390" : "desktop"];
}
