import type { CSSProperties, ReactNode } from "react";

import { primaryNavigation, type ScreenId } from "../ui/journey";
import { characterAssetFor, sceneBackgrounds } from "../ui/r2VisualAssets";

type SceneShellProps = {
  activeScreen: ScreenId;
  children: ReactNode;
  evidenceLabel?: string;
  onNavigate: (screen: ScreenId) => void;
  onSignOut?: () => void;
};

export function SceneShell({ activeScreen, children, evidenceLabel, onNavigate, onSignOut }: SceneShellProps) {
  return (
    <main className="app-shell" data-screen={activeScreen}>
      <header className="app-header" data-main-section="header">
        <button className="brand-button" type="button" onClick={() => onNavigate("S02")} aria-label="오늘의 기록으로 이동">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>상균7데이즈</strong><small>하루의 사실을 차분하게</small></span>
        </button>
        <div className="header-actions">
          {evidenceLabel && <span className="fixture-label">검토 상태 · {evidenceLabel}</span>}
          {onSignOut && <button className="text-button" type="button" onClick={onSignOut}>로그아웃</button>}
        </div>
      </header>

      <div
        className="clay-horizon"
        aria-hidden="true"
        style={{
          "--sk7-background-desktop": `url(${sceneBackgrounds.desktop})`,
          "--sk7-background-mobile": `url(${sceneBackgrounds.mobile})`,
        } as CSSProperties}
      ><span /><span /><span /></div>

      <nav className="primary-nav" aria-label="주요 화면">
        {primaryNavigation.map((item) => (
          <button
            className={item.screen === activeScreen ? "is-active" : ""}
            type="button"
            aria-current={item.screen === activeScreen ? "page" : undefined}
            onClick={() => onNavigate(item.screen)}
            key={item.screen}
          >
            <span aria-hidden="true" data-nav-icon={item.screen} />
            <span className="nav-label-wide">{item.label}</span>
            <span className="nav-label-short">{item.shortLabel}</span>
          </button>
        ))}
      </nav>

      <div className="scene-viewport">{children}</div>
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
  const characterAsset = characterAssetFor(id);

  return (
    <section className={`scene scene-${tone} ${className}`.trim()} data-scene={id} aria-labelledby={`${id}-title`}>
      {characterAsset && <img className="scene-character" src={characterAsset} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.hidden = true; }} />}
      <div className="scene-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={`${id}-title`}>{title}</h1>
        {body && <p className="scene-body">{body}</p>}
      </div>
      {children}
      {actions && <div className="scene-actions">{actions}</div>}
    </section>
  );
}
