import { landmarkForCalendarDate } from "./scenePolicy";
import { findSceneRecipe, type SceneRecipe } from "./sceneRecipes";
import type { JourneyScreenId } from "./journey";

/** Build-only UI opt-in. Never reinterpret the independent scene/companion gates. */
export function resolvePresentationPolicy(uiMode: unknown, sceneMode: unknown) {
  const journey = uiMode === "journey" || (uiMode === undefined && sceneMode === "review");
  return { journey, staticLandscape: journey && sceneMode !== "review" } as const;
}

export type PosterRecipe = Pick<SceneRecipe, "id" | "posters" | "compositions">;

/** Explicit static candidate scope; no domain facts, GLB URL or realtime plan. */
export function resolveJourneyPoster(screen: JourneyScreenId, calendarDate: string): PosterRecipe | null {
  if (screen !== "S02" && screen !== "S10") return null;
  const landmark = landmarkForCalendarDate(calendarDate);
  const recipe = landmark && findSceneRecipe(screen, landmark.id);
  if (!recipe) return null;
  const { id, posters, compositions } = recipe;
  return { id, posters, compositions };
}
