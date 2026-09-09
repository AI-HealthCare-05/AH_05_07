import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { resolveScenePlan, type ScenePlan } from "../ui/scenePolicy";
import type { JourneyScreenId } from "../ui/journey";
import { visualAssetCatalog } from "../ui/r2VisualAssets";

const ThreeSceneRenderer = lazy(() => import("./scene/ThreeSceneRenderer"));

class SceneFailureBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function StaticSceneFallback({ screen }: { screen: "S02" | "S10" }) {
  const [failed, setFailed] = useState(false);
  return <div className="living-scene-fallback" aria-hidden="true">
    {screen === "S02" && !failed && <img src={visualAssetCatalog["scene.S02.homeBase"].currentUrl} alt="" draggable={false} decoding="async" loading="lazy" onError={() => setFailed(true)} />}
  </div>;
}

function SceneRuntimeBoundary({ plan }: { plan: ScenePlan }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let intersecting = false;
    const update = () => {
      const next = intersecting && document.visibilityState === "visible";
      setVisible(next);
      if (next) setActive(true);
    };
    // Unsupported visibility observation stays on the static baseline.
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  useEffect(() => {
    if (!active || ready || failed || plan.tier !== 2) return;
    const timeout = window.setTimeout(() => setFailed(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [active, ready, failed, plan.tier]);

  const fallback = <StaticSceneFallback screen={plan.screen} />;
  return <div ref={host} className="living-scene-runtime" aria-hidden="true" data-living-scene-status={failed ? "fallback" : ready ? "ready" : "poster"}>
    {(!ready || failed || plan.tier === 1) && fallback}
    {active && !failed && plan.tier === 2 && <SceneFailureBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <ThreeSceneRenderer landmark={plan.landmark.id} visible={visible} onReady={() => setReady(true)} onFailure={() => setFailed(true)} />
      </Suspense>
    </SceneFailureBoundary>}
  </div>;
}

/** Separate review boundary. Existing S05 and all semantic children stay outside. */
export function VisualStage({ screen, calendarDate }: { screen: JourneyScreenId; calendarDate: string }) {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const plan = resolveScenePlan({ screen, calendarDate, reducedMotion, visualDisabled: false,
    webglAvailable: typeof WebGL2RenderingContext !== "undefined", gate: import.meta.env.VITE_SK7_SCENE_MODE });
  if (!plan) return null;
  return <div className="living-visual-stage" data-living-scene={screen} aria-hidden="true">
    <SceneRuntimeBoundary key={`${plan.screen}:${plan.landmark.id}:${plan.tier}`} plan={plan} />
  </div>;
}
