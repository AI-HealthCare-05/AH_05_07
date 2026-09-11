import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { SavedSceneBoundary } from "./SavedSceneBoundary";
import { allowsSavedScene, type SavedSceneEvent } from "../ui/savedScene";

import { CompanionRuntimeBoundary } from "./CompanionRuntimeBoundary";
import { SceneVisualAsset, SceneVisualBackground } from "./SceneVisualAsset";
import { primaryNavigation, primaryNavigationScreen, type ScreenId } from "../ui/journey";
import type { CompanionSelection } from "../ui/companion";
import { resolveSceneVisuals } from "../ui/r2VisualAssets";

const SceneCompanionContext = createContext<ReactNode>(null);

/** Decorative placement only; selection and lifecycle remain owned by the shell. */
export function SceneCompanion() { return useContext(SceneCompanionContext); }

type SceneShellProps = {
  staticJourneyUi?: boolean;
  activeScreen: ScreenId;
  children: ReactNode;
  evidenceLabel?: string;
  onNavigate: (screen: ScreenId) => void;
  onSignOut?: () => void;
  signOutPending?: boolean;
  companionSelection: CompanionSelection | null;
  savedSceneEvent?: SavedSceneEvent | null;
};

export function SceneShell({ staticJourneyUi = false, activeScreen, children, evidenceLabel, onNavigate, onSignOut, signOutPending = false, companionSelection, savedSceneEvent = null }: SceneShellProps) {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const activeNavigationScreen = primaryNavigationScreen(activeScreen);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const savedSceneAllowed = allowsSavedScene(import.meta.env.VITE_SK7_SCENE_MODE, activeScreen, Boolean(savedSceneEvent));
  const inlineCompanion = staticJourneyUi && activeScreen === "S05" && !savedSceneAllowed;
  const companion = savedSceneAllowed && savedSceneEvent
    ? <SavedSceneBoundary key={savedSceneEvent.key} event={savedSceneEvent} reducedMotion={reducedMotion} />
    : <CompanionRuntimeBoundary mode={import.meta.env.VITE_SK7_COMPANION_MODE} selection={companionSelection} reducedMotion={reducedMotion} />;

  return (
    <main className="app-shell" data-screen={activeScreen}>
      <a className="skip-link" href="#scene-content">본문으로 건너뛰기</a>
      <header className="app-header" data-main-section="header">
        <button className="brand-button" type="button" onClick={() => onNavigate("S02")} aria-label="오늘의 기록으로 이동">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>상균7데이즈</strong><small>하루의 사실을 차분하게</small></span>
        </button>
        <div className="header-actions">
          {evidenceLabel && <span className="fixture-label">검토 상태 · {evidenceLabel}</span>}
          {onSignOut && <button className="text-button" type="button" onClick={onSignOut} disabled={signOutPending} aria-busy={signOutPending}>{signOutPending ? "로그아웃 중" : "로그아웃"}</button>}
        </div>
      </header>

      <div className="clay-horizon" aria-hidden="true"><span /><span /><span /></div>

      <div id="scene-content" className="scene-viewport" tabIndex={-1}>
        {!inlineCompanion && companion}
        <SceneCompanionContext.Provider value={inlineCompanion ? companion : null}>
          {children}
        </SceneCompanionContext.Provider>
      </div>

      <nav className="primary-nav" aria-label="주요 화면">
        {primaryNavigation.map((item) => (
          <button
            className={item.screen === activeNavigationScreen ? "is-active" : ""}
            type="button"
            aria-current={item.screen === activeNavigationScreen ? "page" : undefined}
            aria-label={item.label}
            onClick={() => onNavigate(item.screen)}
            key={item.screen}
          >
            <span aria-hidden="true" data-nav-icon={item.screen} />
            <span className="nav-label-wide">{item.label}</span>
            <span className="nav-label-short">{item.shortLabel}</span>
          </button>
        ))}
      </nav>
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
  tone?: "cream" | "sage" | "lavender" | "water" | "coral";
  className?: string;
};

export function Scene({ id, eyebrow, title, body, children, actions, tone = "cream", className = "" }: SceneProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const visuals = resolveSceneVisuals(id);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [id]);
  return (
    <section className={`scene scene-${tone} ${className}`.trim()} data-scene={id} aria-labelledby={`${id}-title`}>
      <SceneVisualBackground desktop={visuals.background.desktop} mobile={visuals.background.mobile} />
      {visuals.illustration && <SceneVisualAsset asset={visuals.illustration} className={`scene-visual-character scene-visual-character--${id}`} />}
      <div className="scene-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} id={`${id}-title`}>{title}</h1>
        {body && <p className="scene-body">{body}</p>}
      </div>
      {children}
      {actions && <div className="scene-actions">{actions}</div>}
    </section>
  );
}
