import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";

import { UiIcon } from "./UiIcon";
import { iconForScreen } from "../ui/uiIconPaths";

import { SavedSceneBoundary } from "./SavedSceneBoundary";
import { allowsSavedScene, type SavedSceneEvent } from "../ui/savedScene";

import { CompanionRuntimeBoundary, warmCompanionRendererModule } from "./CompanionRuntimeBoundary";
import { SceneVisualAsset, SceneVisualBackground } from "./SceneVisualAsset";
import { primaryNavigation, primaryNavigationScreen, type ScreenId } from "../ui/journey";
import {
  resolveCompanionMode,
  resolveCompanionSelection,
  resolveProductionCompanion,
  type CompanionSelection,
  type CompanionSpecies,
} from "../ui/companion";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { resolveSceneVisuals } from "../ui/r2VisualAssets";
import { useJourneyTransition, type JourneyFeedbackPhase } from "./useJourneyTransition";
import { CompanionPresenceHostBridge } from "./CompanionPresenceHostBridge";
import { PresenceSceneActorRuntimeProvider } from "../platform/presence/PresenceSceneActorRuntimeContext";
import {
  initialSceneFirstPaintChannelState,
  sceneFirstPaintChannelReducer,
  SceneFirstPaintDispatchContext,
  SceneFirstPaintVisitContext,
} from "./SceneFirstPaintWitness";

const SceneCompanionContext = createContext<ReactNode>(null);

/** Decorative placement only; selection and lifecycle remain owned by the shell. */
export function SceneCompanion() { return useContext(SceneCompanionContext); }

type SceneShellProps = {
  staticJourneyUi?: boolean;
  journeyPresentation: boolean;
  feedbackPhase: JourneyFeedbackPhase;
  feedbackSuspended: boolean;
  sessionGeneration: number;
  activeScreen: ScreenId;
  children: ReactNode;
  evidenceLabel?: string;
  onNavigate: (screen: ScreenId) => void;
  onSignOut?: () => void;
  signOutPending?: boolean;
  companionSelection: CompanionSelection | null;
  companionSpecies: CompanionSpecies;
  companionAsset: CompanionAsset | null;
  savedSceneEvent?: SavedSceneEvent | null;
};

export function SceneShell({ staticJourneyUi = false, journeyPresentation, feedbackPhase, feedbackSuspended, sessionGeneration, activeScreen, children, evidenceLabel, onNavigate, onSignOut, signOutPending = false, companionSelection, companionSpecies, companionAsset, savedSceneEvent = null }: SceneShellProps) {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [forcedColors, setForcedColors] = useState(() => window.matchMedia("(forced-colors: active)").matches);
  const shellRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeNavigationScreen = primaryNavigationScreen(activeScreen);

  useJourneyTransition({
    viewportRef,
    activeScreen,
    phase: feedbackPhase,
    sessionGeneration,
    journeyPresentation,
    suspended: feedbackSuspended,
    reducedMotion: reducedMotion || forcedColors,
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(forced-colors: active)");
    const update = () => setForcedColors(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (activeScreen !== "S04") return;

    const mode = resolveCompanionMode(import.meta.env.VITE_SK7_COMPANION_MODE);
    const futureS05Selection = mode === "production"
      ? resolveProductionCompanion(mode, "S05", true, companionSpecies)
      : resolveCompanionSelection(
          "S05",
          new URLSearchParams(window.location.search),
          "save_success",
        );

    if (futureS05Selection) warmCompanionRendererModule();
  }, [activeScreen, companionSpecies]);

  const savedSceneAllowed = allowsSavedScene(import.meta.env.VITE_SK7_SCENE_MODE, activeScreen, Boolean(savedSceneEvent));
  const inlineCompanion = staticJourneyUi && activeScreen === "S05" && !savedSceneAllowed;
  const companion = savedSceneAllowed && savedSceneEvent
    ? <SavedSceneBoundary key={savedSceneEvent.key} event={savedSceneEvent} reducedMotion={reducedMotion} species={companionSpecies} />
    : <CompanionRuntimeBoundary mode={import.meta.env.VITE_SK7_COMPANION_MODE} selection={companionSelection} reducedMotion={reducedMotion} framing={inlineCompanion ? "journey-s05" : "default"} />;
  const [firstPaintChannel, dispatchFirstPaintChannel] = useReducer(
    sceneFirstPaintChannelReducer,
    initialSceneFirstPaintChannelState,
  );

  return (
    <main ref={shellRef} className="app-shell" data-screen={activeScreen} data-journey-presentation={journeyPresentation || undefined}>
      <PresenceSceneActorRuntimeProvider>
      <SceneFirstPaintDispatchContext.Provider value={dispatchFirstPaintChannel}>
      <SceneFirstPaintVisitContext.Provider value={firstPaintChannel.activeVisit}>
      <CompanionPresenceHostBridge
        rootRef={shellRef}
        activeScreen={activeScreen}
        sessionGeneration={sessionGeneration}
        rawMode={import.meta.env.VITE_SK7_COMPANION_MODE}
        companionSelection={companionSelection}
        companionSpecies={companionSpecies}
        companionAsset={companionAsset}
        savedSceneOwner={Boolean(savedSceneAllowed && savedSceneEvent)}
        suspended={feedbackSuspended}
      />
      <a className="skip-link" href="#scene-content">본문으로 건너뛰기</a>
      <header className="app-header" data-main-section="header">
        <button className="brand-button" type="button" onClick={() => onNavigate("S02")}
          aria-label="SK7 · 하루의 사실을 차분하게 · 오늘의 기록으로 이동">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>SK7</strong><small>하루의 사실을 차분하게</small></span>
        </button>
        <div className="header-actions">
          {evidenceLabel && <span className="fixture-label">검토 상태 · {evidenceLabel}</span>}
          {onSignOut && <button className="text-button" type="button" onClick={onSignOut} disabled={signOutPending} aria-busy={signOutPending}>{signOutPending ? "로그아웃 중" : "로그아웃"}</button>}
        </div>
      </header>

      <div className="clay-horizon" aria-hidden="true"><span /><span /><span /></div>

      <div ref={viewportRef} id="scene-content" className="scene-viewport" tabIndex={-1}>
        {!inlineCompanion && companion}
        <SceneCompanionContext.Provider value={inlineCompanion ? companion : null}>
          {children}
        </SceneCompanionContext.Provider>
      </div>

      <nav className="primary-nav" aria-label="주요 화면" style={{ gridTemplateColumns: `repeat(${primaryNavigation.length}, minmax(0, 1fr))` }}>
        {primaryNavigation.map((item) => (
          <button
            className={item.screen === activeNavigationScreen ? "is-active" : ""}
            type="button"
            aria-current={item.screen === activeNavigationScreen ? "page" : undefined}
            aria-label={item.label}
            onClick={() => onNavigate(item.screen)}
            key={item.screen}
          >
            <UiIcon name={iconForScreen(item.screen)} size={20} data-nav-icon={item.screen} />
            <span className="nav-label-wide">{item.label}</span>
            <span className="nav-label-short">{item.shortLabel}</span>
          </button>
        ))}
      </nav>
      </SceneFirstPaintVisitContext.Provider>
      </SceneFirstPaintDispatchContext.Provider>
      </PresenceSceneActorRuntimeProvider>
    </main>
  );
}

type SceneProps = {
  id: ScreenId;
  eyebrow: string;
  title: string;
  body?: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: SceneTone;
  className?: string;
};

export type SceneTone = "base" | "subtle" | "secondary" | "emphasis" | "critical";

export function Scene({ id, eyebrow, title, body, children, actions, tone = "base", className = "" }: SceneProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const visuals = resolveSceneVisuals(id);
  const usesSharedFoundation = id === "S03" || id === "S04" || id === "S05" || id === "S06" || id === "S07" || id === "S08" || id === "S09" || id === "S11" || id === "S12" || id === "S13" || id === "S14";
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [id]);
  return (
    <section className={`scene scene-${tone} ${className}`.trim()} data-scene={id} aria-labelledby={`${id}-title`}>
      <SceneVisualBackground desktop={visuals.background.desktop} mobile={visuals.background.mobile} />
      {visuals.illustration && <SceneVisualAsset asset={visuals.illustration} className={`scene-visual-character scene-visual-character--${id}`} />}
      <div className={`scene-copy${usesSharedFoundation ? " screen-header" : ""}`}>
        <p className="eyebrow">{eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} id={`${id}-title`}>{title}</h1>
        {body && <p className="scene-body">{body}</p>}
      </div>
      {children}
      {actions && <div className="scene-actions">{actions}</div>}
    </section>
  );
}
