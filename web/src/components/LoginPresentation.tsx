import type { FormEventHandler } from "react";

import type { CompanionMode, CompanionSpecies } from "../ui/companion";
import { companionIdentityOptions } from "../ui/companionIdentity";
import { journeyCopy } from "../ui/journey";
import { LoginCompanionNarrator } from "./LoginCompanionNarrator";
import { RecoveryPanel, type RecoveryContent } from "./RecoveryPanel";

type LoginFeedbackView = {
  kind: "sent" | "error";
  message: string;
} | null;

type CompletionContent = {
  title: string;
  body: string;
} | null;

type LoginPresentationProps = {
  journey: boolean;
  email: string;
  pending: boolean;
  visibleFeedback: LoginFeedbackView;
  recovery?: RecoveryContent;
  completionContent: CompletionContent;
  browserResetCompleted: boolean;
  companionMode: CompanionMode;
  companionSpecies: CompanionSpecies;
  onEmailChange: (email: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onEnterGuestJourney: () => void;
  onCompanionSpeciesChange: (species: CompanionSpecies) => void;
  onResetBrowserPersonalization: () => void;
};

export function LoginPresentation({
  journey,
  email,
  pending,
  visibleFeedback,
  recovery,
  completionContent,
  browserResetCompleted,
  companionMode,
  companionSpecies,
  onEmailChange,
  onSubmit,
  onEnterGuestJourney,
  onCompanionSpeciesChange,
  onResetBrowserPersonalization,
}: LoginPresentationProps) {
  if (journey) return (
    <main className="welcome-shell journey-login" data-scene="S01">
      <div className="journey-login-layout">
        <section className="journey-login-intro" aria-labelledby="login-title">
          <div className="screen-header">
            <p className="eyebrow">SK7</p>
            <h1 id="login-title">측정한 혈압을 기록하고,<br />최근 7일을 확인해요.</h1>
            <p className="scene-body">혈압을 날짜·시간대별로 남기고, 최근 7일의 기록을 한곳에서 다시 확인해요. 한 건부터 바로 시작할 수 있어요.</p>
          </div>
        </section>

        <section className="welcome-card journey-login-auth surface" aria-label="이메일 로그인">
          <div className="journey-login-auth-header section-header">
            <p className="eyebrow">실제 기록 시작</p>
            <h2>이메일로 로그인해 첫 혈압을 남겨요</h2>
            <p className="journey-login-steps">이메일 입력 → 메일에서 로그인 → 혈압 기록</p>
          </div>

          {completionContent && (
            <section className="anonymous-completion" aria-labelledby="anonymous-completion-title">
              <div role="status">
                <p className="eyebrow">완료</p>
                <h3 id="anonymous-completion-title">{completionContent.title}</h3>
                <p>{completionContent.body}</p>
                {browserResetCompleted && (
                  <p className="anonymous-completion-reset">
                    이 브라우저의 개인화도 기본값으로 초기화했어요.
                  </p>
                )}
              </div>
              {!browserResetCompleted && (
                <button
                  className="secondary"
                  type="button"
                  onClick={onResetBrowserPersonalization}
                >
                  이 브라우저의 개인화 초기화
                </button>
              )}
            </section>
          )}

          <form
            className="journey-login-form section-header"
            onSubmit={onSubmit}
            aria-busy={pending}
          >
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-describedby="login-help"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
            />
            <div className="entry-auth-wrap action-group">
              <button
                type="submit"
                className="entry-auth-button"
                disabled={pending}
              >
                {pending ? "보내는 중" : "로그인 링크 받기"}
              </button>
            </div>
            <p id="login-help" className="journey-login-help">
              이메일로 받은 링크를 열면 로그인할 수 있어요. 같은 브라우저에서는 로그인 상태가 유지되면 다시 로그인하지 않고 기록을 이어갈 수 있어요.
            </p>
          </form>

          {recovery ? (
            <RecoveryPanel {...recovery} focusOnMount role="alert" />
          ) : visibleFeedback && (
            <p
              className={`notice ${visibleFeedback.kind === "sent" ? "notice-success" : "notice-error"} status-notice`}
              role="status"
              data-login-feedback={visibleFeedback.kind}
            >
              {visibleFeedback.message}
            </p>
          )}

          <div className="journey-login-preview-entry section-header">
            <div>
              <p className="eyebrow">저장 없는 미리보기</p>
              <h3>먼저 30초만 둘러볼 수도 있어요</h3>
            </div>
            <p>체험 입력은 이 탭의 메모리에만 남고, 로그인해도 계정으로 옮겨지지 않아요.</p>
            <div className="action-group">
              <button
                type="button"
                className="secondary entry-preview-button journey-demo-entry-button"
                onClick={onEnterGuestJourney}
              >
                로그인 없이 30초 맛보기
              </button>
            </div>
          </div>

          <div className="journey-login-policy section-header">
            <p className="journey-login-demo">
              로그인 후 남긴 혈압 관찰과 챌린지 기록은 저장한 시점부터 30일 동안 보관돼요. 보관·삭제 안내는 설정과 도움말에서 확인할 수 있어요.
            </p>
            <p className="welcome-footnote">
              공용 기기에서는 사용을 마친 뒤 로그아웃해 주세요. 로그아웃하면 이 기기의 현재 계정 연결을 끝냅니다.
            </p>
          </div>
        </section>

        <div className="journey-login-companion section-header">
          <LoginCompanionNarrator
            mode={companionMode}
            species={companionSpecies}
          />
          {companionMode !== "off" && (
            <label
              className="companion-identity-control"
              htmlFor="login-companion-species"
            >
              <span>함께할 캐릭터</span>
              <select
                id="login-companion-species"
                value={companionSpecies}
                onChange={(event) =>
                  onCompanionSpeciesChange(event.target.value as CompanionSpecies)
                }
              >
                {companionIdentityOptions.map((option) => (
                  <option key={option.species} value={option.species}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </main>
  );

  return (
    <main className="welcome-shell" data-scene="S01">
      <div className="welcome-landscape" aria-hidden="true">
        <span /><span /><span />
      </div>

      <section className="welcome-card" aria-labelledby="login-title">
        <span className="welcome-orb" aria-hidden="true"><i /><i /></span>
        <p className="eyebrow">{journeyCopy.S01.eyebrow}</p>
        <h1 id="login-title">{journeyCopy.S01.title}</h1>
        <p className="scene-body">{journeyCopy.S01.body}</p>

        {completionContent && (
          <section className="anonymous-completion" aria-labelledby="anonymous-completion-title">
            <div role="status">
              <h2 id="anonymous-completion-title">{completionContent.title}</h2>
              <p>{completionContent.body}</p>
            </div>
            {browserResetCompleted ? (
              <p>이 브라우저의 개인화도 기본값으로 초기화했어요.</p>
            ) : (
              <button
                className="secondary"
                type="button"
                onClick={onResetBrowserPersonalization}
              >
                이 브라우저의 개인화 초기화
              </button>
            )}
          </section>
        )}

        <form onSubmit={onSubmit}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
          />
          <button type="submit" disabled={pending}>
            {pending ? "보내는 중" : "이메일로 계속하기"}
          </button>
        </form>

        {recovery ? (
          <RecoveryPanel {...recovery} focusOnMount role="alert" />
        ) : visibleFeedback && (
          <p
            className={`notice ${visibleFeedback.kind === "sent" ? "notice-success" : "notice-error"}`}
            role="status"
          >
            {visibleFeedback.message}
          </p>
        )}

        <p className="welcome-footnote">
          공용 기기에서는 사용을 마친 뒤 로그아웃해 주세요. 로그아웃하면 이 기기의 현재 계정 연결을 끝냅니다.
        </p>
        <p className="welcome-footnote">
          혈압 관찰과 챌린지 참여는 서로 다른 사실로 표시됩니다.
        </p>
      </section>
    </main>
  );
}
