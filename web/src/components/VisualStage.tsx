import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import "./scene/scene-stage.css";

import { resolveScenePlan, type ScenePlan } from "../ui/scenePolicy";
import type { JourneyScreenId } from "../ui/journey";
import { sceneProfile, type SceneRecipe } from "../ui/sceneRecipes";
import type { CompanionSpecies } from "../ui/companion";
import { getSceneCharacterPresentationProfile } from "../ui/companionPresentationProfiles";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { validateActiveCompanionAssetForScreen } from "../ui/companionActiveAsset";
import { PresenceSceneActorInteraction } from "./PresenceSceneActorInteraction";
import {
  useSceneFirstPaintActions,
  useSceneFirstPaintVisit,
} from "./SceneFirstPaintWitness";
import { matchesReadySceneWitness } from "./sceneFirstPaintChannel";

const ThreeSceneRenderer = lazy(() => import("./scene/ThreeSceneRenderer"));

class SceneFailureBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function PosterImage({ url, eager = false }: { url: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : (
    <img
      src={url}
      alt=""
      draggable={false}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}

export function StaticSceneFallback({ recipe, eager = false }: { recipe: SceneRecipe; eager?: boolean }) {
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
    <PosterImage key={poster.url} url={poster.url} eager={eager} />
  </div>;
}

/** Identity-neutral CSS/foundation fallback. No character-bearing pixels. */
function NeutralSceneFallback() {
  return <div className="living-scene-fallback living-scene-fallback--neutral" aria-hidden="true" data-poster-asset="none" />;
}

type FallbackMode = "poster" | "neutral";

type SceneTierBoundaryProps = {
  plan: ScenePlan;
  failed: boolean;
  ready: boolean;
  onFailure: () => void;
  onReady: () => void;
  fallbackMode: FallbackMode;
};

function SceneTierBoundary({ plan, failed, ready, onFailure, onReady, fallbackMode }: SceneTierBoundaryProps) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let intersecting = false;
    const update = () => {
      const next = intersecting && document.visibilityState === "visible";
      setVisible(next);
      if (next) setActive(true);
    };
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  useEffect(() => {
    if (!active || ready || failed || plan.tier !== 2) return;
    const timeout = window.setTimeout(onFailure, 12_000);
    return () => window.clearTimeout(timeout);
  }, [active, ready, failed, plan.tier, onFailure]);

  const fallback = fallbackMode === "neutral"
    ? <NeutralSceneFallback />
    : <StaticSceneFallback recipe={plan.recipe} eager={plan.screen === "S02"} />;
  return <div ref={host} className="living-scene-runtime" aria-hidden="true" data-living-scene-status={failed ? "fallback" : ready ? "ready" : "poster"}>
    {(!ready || failed || plan.tier === 1) && fallback}
    {active && !failed && plan.tier === 2 && <SceneFailureBoundary onFailure={onFailure}>
      <Suspense fallback={null}>
        <ThreeSceneRenderer screen={plan.screen} recipe={plan.recipe} landmark={plan.landmark.id} visible={visible} onReady={onReady} onFailure={onFailure} />
      </Suspense>
    </SceneFailureBoundary>}
  </div>;
}

/** Stable route + exact-character failure owner, outside tier/recipe subvisits. */
function SceneRuntimeBoundary(props: VisualStageRuntimeProps) {
  const failedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const onFailure = useCallback(() => {
    failedRef.current = true;
    setFailed(true);
  }, []);
  const canReady = useCallback(() => !failedRef.current, []);
  // Tier and recipe transitions dispose the renderer and create a fresh local
  // readiness/token owner, without resetting this visit's terminal failure.
  return <VisualStageRuntime
    key={`${props.plan.recipe.id}:${props.plan.recipe.characterUrl}:${props.plan.tier}`}
    {...props}
    failed={failed}
    onFailure={onFailure}
    canReady={canReady}
  />;
}

type VisitPhase = "loading" | "ready" | "failed";
type FirstPaintState = "fallback-neutral" | "realtime-loading" | "realtime-ready";

function firstPaintStateFromPhase(phase: VisitPhase, tier: 1 | 2): FirstPaintState {
  if (phase === "failed" || tier !== 2) return "fallback-neutral";
  if (phase === "ready") return "realtime-ready";
  return "realtime-loading";
}

let visitTokenCounter = 0;
function nextVisitToken(): string {
  return `v:${++visitTokenCounter}`;
}

type VisualStageRuntimeProps = {
  screen: JourneyScreenId;
  calendarDate: string;
  plan: ScenePlan;
  fallbackMode: FallbackMode;
  companionAsset: CompanionAsset | null;
};

/** One mounted tier subvisit. Only realtime subvisits publish to the channel. */
function VisualStageRuntime({ screen, calendarDate, plan, fallbackMode, companionAsset, failed, onFailure: latchFailure, canReady }: VisualStageRuntimeProps & {
  failed: boolean;
  onFailure: () => void;
  canReady: () => boolean;
}) {
  const [ready, setReady] = useState(false);
  const [token] = useState(() => plan.tier === 2 ? nextVisitToken() : null);
  const mounted = useRef(false);
  const dispatch = useSceneFirstPaintActions();
  const activeVisit = useSceneFirstPaintVisit();
  const assetId = companionAsset?.assetId;
  const assetUrl = companionAsset?.url;
  const phase: VisitPhase = failed ? "failed" : ready ? "ready" : "loading";

  const onFailure = useCallback(() => {
    if (!mounted.current) return;
    latchFailure();
    if (token) dispatch({ type: "failed", token });
  }, [dispatch, token, latchFailure]);

  const onReady = useCallback(() => {
    if (!mounted.current || !canReady()) return;
    setReady(true);
    if (token) dispatch({ type: "ready", token });
  }, [dispatch, token, canReady]);

  useLayoutEffect(() => {
    mounted.current = true;
    if (token && assetId && assetUrl) {
      dispatch({ type: "activate", token, screen, assetId, assetUrl });
      if (!canReady()) dispatch({ type: "failed", token });
    }
    return () => {
      mounted.current = false;
      if (token) dispatch({ type: "clear", token });
    };
  }, [assetId, assetUrl, dispatch, screen, token, canReady]);

  const firstPaintState = firstPaintStateFromPhase(phase, plan.tier);
  const isAdmitted = screen === "S02"
    && plan.tier === 2
    && phase === "ready"
    && token != null
    && companionAsset != null
    && matchesReadySceneWitness(activeVisit, { screen, token, assetId: companionAsset.assetId, assetUrl: companionAsset.url });

  return <div className="living-visual-stage" data-living-scene={screen} data-scene-recipe={plan.recipe.id} data-scene-date={calendarDate} data-scene-first-paint-state={firstPaintState} data-scene-visit-token={token} data-scene-selected-character-url={plan.recipe.characterUrl} style={{
    "--scene-height-320": `${plan.recipe.compositions.mobile320.stageHeight}px`,
    "--scene-height-390": `${plan.recipe.compositions.mobile390.stageHeight}px`,
    "--scene-height-desktop": `${plan.recipe.compositions.desktop.stageHeight}px`,
  } as CSSProperties}>
    <div className="living-visual-runtime" aria-hidden="true">
      <SceneTierBoundary plan={plan} failed={failed} ready={ready} fallbackMode={fallbackMode} onReady={onReady} onFailure={onFailure} />
    </div>
    {screen === "S02" && <PresenceSceneActorInteraction phase={isAdmitted ? "ready" : "loading"} />}
  </div>;
}

type VisualStageProps = {
  screen: JourneyScreenId;
  calendarDate: string;
  /** S02/S10 selectable identity. `undefined` keeps the base recipe; `null` forces tier-1 identity-neutral fallback. */
  companionSpecies?: CompanionSpecies | null;
  /** Resolved active descriptor for the selected product species. */
  companionAsset?: CompanionAsset | null;
  /** Explicit host authorization for the S10 exact-production full-scene owner. */
  productionS10Enabled?: boolean;
};

/** Separate review boundary. Existing S05 and all semantic children stay outside. */
export function VisualStage({ screen, calendarDate, companionSpecies, companionAsset, productionS10Enabled = false }: VisualStageProps) {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const basePlan = resolveScenePlan({ screen, calendarDate, reducedMotion, visualDisabled: false,
    webglAvailable: typeof WebGL2RenderingContext !== "undefined", gate: import.meta.env.VITE_SK7_SCENE_MODE,
    productionS10Enabled });
  if (!basePlan) return null;

  const identityScreen = screen === "S02" || screen === "S10";
  // F1: identity-bound product first paint must not show the historical bear-bearing poster.
  const identityBound = identityScreen && companionSpecies !== undefined;
  const fallbackMode: FallbackMode = identityBound ? "neutral" : "poster";

  let recipe = basePlan.recipe;
  if (identityBound && companionSpecies !== null) {
    if (!companionAsset) {
      throw new Error(`${screen} identity-bound visit requires an active companion descriptor`);
    }
    validateActiveCompanionAssetForScreen(companionAsset, screen);
    if (companionAsset.species !== companionSpecies) throw new Error("scene species and descriptor disagree");
    const presentation = getSceneCharacterPresentationProfile(screen, companionSpecies);
    recipe = {
      ...basePlan.recipe,
      characterUrl: companionAsset.url,
      characterScale: presentation.scale,
    };
  }

  const plan: ScenePlan = identityBound && companionSpecies === null
    ? { ...basePlan, recipe, tier: 1 }
    : { ...basePlan, recipe };

  // Render the exact-visit owner with a key that includes the screen and exact
  // character identity. A new identity creates a new visit with no inherited
  // readiness; tier/motion changes keep the same visit and its failure latch.
  const visitKey = `${screen}:${companionAsset ? `${companionAsset.assetId}:${companionAsset.url}:${companionAsset.sha256}:${companionAsset.species}:${companionAsset.variant}` : "neutral"}`;
  return <SceneRuntimeBoundary
    key={visitKey}
    screen={screen}
    calendarDate={calendarDate}
    plan={plan}
    fallbackMode={fallbackMode}
    companionAsset={companionAsset ?? null}
  />;
}
