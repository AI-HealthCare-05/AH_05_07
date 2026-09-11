import { useEffect, useState, type CSSProperties } from "react";
import { sceneProfile } from "../ui/sceneRecipes";
import { resolveJourneyPoster, type PosterRecipe } from "../ui/presentationPolicy";

function PosterImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <img src={url} alt="" draggable={false} decoding="async" loading="lazy" onError={() => setFailed(true)} />;
}

/** Same approved poster mapping as VisualStage; keep its pinned review source intact. */
function StaticSceneFallback({ recipe }: { recipe: PosterRecipe }) {
  const [profile, setProfile] = useState(() => sceneProfile(window.innerWidth));
  useEffect(() => {
    const queries = [window.matchMedia("(max-width: 350px)"), window.matchMedia("(max-width: 580px)")];
    const update = () => setProfile(sceneProfile(window.innerWidth));
    queries.forEach(query => query.addEventListener("change", update));
    update();
    return () => queries.forEach(query => query.removeEventListener("change", update));
  }, []);
  const poster = recipe.posters[profile];
  return <div className="living-scene-fallback" aria-hidden="true" data-poster-asset={poster.id}>
    <PosterImage key={poster.url} url={poster.url} />
  </div>;
}

/** Only the explicit journey/static presentation policy selects this candidate. */
export function StaticJourneyLandscape({ screen, calendarDate }: { screen: "S02" | "S10"; calendarDate: string }) {
  const recipe = resolveJourneyPoster(screen, calendarDate);
  if (!recipe) return null;
  return <div className="living-visual-stage" data-static-landscape={screen} data-scene-recipe={recipe.id} data-scene-date={calendarDate} aria-hidden="true" style={{
    "--scene-height-320": `${recipe.compositions.mobile320.stageHeight}px`,
    "--scene-height-390": `${recipe.compositions.mobile390.stageHeight}px`,
    "--scene-height-desktop": `${recipe.compositions.desktop.stageHeight}px`,
  } as CSSProperties}>
    <StaticSceneFallback recipe={recipe} />
  </div>;
}
