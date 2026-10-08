import type { ReactNode } from "react";
import type { ActiveChallenge, ChallengeCheckin } from "../lib/api-contract";
import { journeyCopy, type ScreenId } from "../ui/journey";
import { ChallengeTimeline } from "./ChallengeTimeline";
import { DailyActionLoop } from "./DailyActionLoop";
import { Scene } from "./SceneShell";

type ChoiceAction = Readonly<{ id: string; label: string; note: string }>;
type ChallengeChoiceProps = Readonly<{
  journey: boolean;
  activeChallenge: ActiveChallenge | null;
  activeChallengeEnded: boolean;
  locked: boolean;
  actions: readonly ChoiceAction[];
  actionLabel: (actionId: string) => string;
  selectionPending: boolean;
  controlsDisabled: boolean;
  challengeNeedsReload: boolean;
  windowReady: boolean;
  isPriorDashboard: boolean;
  readNavigationDisabled: boolean;
  onSelectAction: (actionId: string) => void;
  onNavigate: (screen: ScreenId) => void;
}>;

type ChallengeSummaryProps = Readonly<{
  journey: boolean;
  activeChallenge: ActiveChallenge | null;
  activeChallengeEnded: boolean;
  todayCheckin: ChallengeCheckin | undefined;
  checkins: readonly ChallengeCheckin[];
  today: string;
  startOn: string;
  endOn: string;
  isPriorDashboard: boolean;
  controlsDisabled: boolean;
  endedCyclePanel: ReactNode;
  actionLabel: (actionId: string) => string;
  checkinLabel: (status: ChallengeCheckin["status"]) => string;
  onCheckin: (status: ChallengeCheckin["status"]) => void;
  onNavigate: (screen: ScreenId) => void;
}>;

export function SignedInChallengeChoicePresentation({
  journey, activeChallenge, activeChallengeEnded, locked, actions, actionLabel,
  selectionPending, controlsDisabled, challengeNeedsReload, windowReady,
  isPriorDashboard, readNavigationDisabled, onSelectAction, onNavigate,
}: ChallengeChoiceProps) {
  if (journey) return <Scene id="S03" eyebrow="선택 기능 · 7일 챌린지" title={activeChallengeEnded ? "다음 챌린지를 시작할 행동을 골라요" : "원하면 이어갈 행동을 골라요"} tone="subtle" className="journey-candidate journey-challenge-choice surface">
    <DailyActionLoop current="S03" />
    <div className="challenge-choice-context status-notice" data-challenge-choice-state={locked ? "locked" : activeChallenge && !activeChallengeEnded ? "changeable" : "optional"}>
      <p className="eyebrow">선택 기능</p>
      <strong>{locked ? "첫 상태 기록 후에는 행동을 바꿀 수 없어요." : "참여하지 않아도 혈압 기록은 그대로 사용할 수 있어요."}</strong>
      <p>{locked ? "현재 선택을 확인하고 오늘 상태를 별도로 기록해요." : activeChallenge && !activeChallengeEnded ? "첫 상태를 기록하기 전까지 다른 행동으로 바꿀 수 있어요." : "원할 때 하나를 골라 오늘부터 시작해요."}</p>
    </div>
    <dl className="challenge-choice-rules" aria-label="챌린지 선택 규칙">
      <div><dt>시작</dt><dd>선택한 오늘</dd></div>
      <div><dt>기간</dt><dd>오늘부터 7일</dd></div>
      <div><dt>선택 변경</dt><dd>첫 상태 기록 전까지</dd></div>
    </dl>
    {activeChallenge && !activeChallengeEnded && <div className="challenge-selection-summary" data-selection-lock={locked ? "locked" : "changeable"}>
      <span>현재 선택</span><strong>{actionLabel(activeChallenge.action_id)}</strong><small>{activeChallenge.starts_on} ~ {activeChallenge.ends_on} · {locked ? "행동 고정됨" : "첫 기록 전 변경 가능"}</small>
    </div>}
    <div className="choice-grid" aria-busy={selectionPending}>
      {actions.map((action, index) => {
        const selected = activeChallenge?.action_id === action.id && !activeChallengeEnded;
        const state = selectionPending
          ? "선택 저장 중"
          : locked
            ? selected ? "선택됨 · 변경 불가" : "변경 불가"
            : selected ? "선택됨" : "선택하기";
        return <button className={`choice-tile ${selected ? "is-selected" : ""}`} type="button" key={action.id} aria-pressed={selected} onClick={() => void onSelectAction(action.id)} disabled={controlsDisabled || locked || challengeNeedsReload || !windowReady}><span className="choice-icon" aria-hidden="true" data-choice={action.id} /><span className="choice-kicker">선택 {index + 1}</span><strong>{action.label}</strong><small>{action.note}</small><span className="choice-state">{state}</span></button>;
      })}
    </div>
    <div className="journey-challenge-state status-notice" role="status">
      {selectionPending
        ? "선택한 행동을 저장하고 있어요."
        : locked
          ? "첫 체크인 이후에는 선택한 행동을 바꿀 수 없어요."
          : challengeNeedsReload ? "저장 결과를 확인한 뒤 행동을 선택할 수 있어요." : "행동을 누르면 선택한 내용이 저장돼요."}
    </div>
    <div className="action-group journey-challenge-actions">
      {activeChallenge && !activeChallengeEnded && !isPriorDashboard && <button className="secondary" type="button" onClick={() => onNavigate("S07")} disabled={controlsDisabled}>오늘 상태 확인·기록하기</button>}
      <button className="secondary" type="button" onClick={() => onNavigate("S04")} disabled={controlsDisabled}>혈압 기록하기</button>
      <button className="text-button" type="button" onClick={() => onNavigate("S02")} disabled={readNavigationDisabled}>오늘의 기록으로 돌아가기</button>
    </div>
  </Scene>;
  return <Scene id="S03" {...journeyCopy.S03} tone="subtle"><div className="choice-grid">{actions.map((action) => { const selected = activeChallenge?.action_id === action.id && !activeChallengeEnded; return <button className={`choice-tile ${selected ? "is-selected" : ""}`} type="button" key={action.id} onClick={() => void onSelectAction(action.id)} disabled={controlsDisabled || locked || challengeNeedsReload || !windowReady}><span className="choice-icon" aria-hidden="true" data-choice={action.id} /><strong>{action.label}</strong><small>{action.note}</small><span className="choice-state">{selected ? "선택됨" : "선택하기"}</span></button>; })}</div>{locked && <p className="notice notice-warning" role="status">첫 체크인이 있어 선택한 행동은 바꿀 수 없어요.</p>}<button className="text-button" type="button" onClick={() => onNavigate("S02")}>오늘의 기록으로 돌아가기</button></Scene>;
}

export function SignedInChallengeSummaryPresentation({
  journey, activeChallenge, activeChallengeEnded, todayCheckin, checkins,
  today, startOn, endOn, isPriorDashboard, controlsDisabled, endedCyclePanel,
  actionLabel, checkinLabel, onCheckin, onNavigate,
}: ChallengeSummaryProps) {
  if (journey) return <Scene id="S06" eyebrow="선택 기능 · 오늘 상태" title={activeChallengeEnded ? "종료된 챌린지를 확인해요" : "선택한 행동과 오늘 상태를 확인해요"} tone="subtle" className="journey-candidate journey-challenge-summary surface">
    <DailyActionLoop current="S06" />
    <div className="journey-challenge-summary-grid">
      <section className="locked-challenge journey-challenge-summary-card section-header" data-challenge-period={activeChallengeEnded ? "ended" : "active"}>
        <p className="eyebrow">{activeChallengeEnded ? "종료된 챌린지" : activeChallenge?.first_checkin_on ? "선택한 행동 · 고정됨" : "선택한 행동 · 첫 기록 전 변경 가능"}</p>
        <h2>{activeChallenge ? actionLabel(activeChallenge.action_id) : "선택한 행동 없음"}</h2>
        {activeChallenge && <p className="journey-challenge-dates"><span>챌린지 기간</span><time dateTime={activeChallenge.starts_on}>{activeChallenge.starts_on}</time> ~ <time dateTime={activeChallenge.ends_on}>{activeChallenge.ends_on}</time></p>}
      </section>
      <section className="locked-challenge journey-challenge-summary-card journey-challenge-checkin-card section-header"
        data-challenge-checkin-state={isPriorDashboard ? "unavailable" : activeChallengeEnded ? "ended" : todayCheckin?.status ?? "pending"}>
        <p className="eyebrow">오늘 상태 · 별도 기록</p>
        <h2>{isPriorDashboard ? "오늘 상태 미확인" : activeChallengeEnded ? "챌린지 종료" : todayCheckin ? checkinLabel(todayCheckin.status) : "아직 기록하지 않음"}</h2>
        <p>{isPriorDashboard
          ? "이전 7일 조회에서는 오늘 상태를 확인할 수 없어요."
          : activeChallengeEnded
            ? "종료된 챌린지에는 오늘 상태를 새로 기록할 수 없어요."
            : todayCheckin
              ? `오늘은 '${checkinLabel(todayCheckin.status)}' 상태로 저장되어 있어요.`
              : "오늘은 '기록함' 또는 '건너뜀' 중 하나를 상태로 저장할 수 있어요."}</p>
        {!isPriorDashboard && !activeChallengeEnded && <p className="journey-challenge-checkin-note">
          '건너뜀'도 오늘 상태를 남긴 기록이에요. 혈압 기록과 합쳐서 판단하지 않아요.
        </p>}
      </section>
    </div>
    {activeChallenge && <ChallengeTimeline challenge={activeChallenge} checkins={checkins} today={today} factsStartOn={startOn} factsEndOn={endOn} />}
    {endedCyclePanel}
    <div className="inline-actions action-group journey-challenge-next-actions">
      {activeChallenge && !activeChallengeEnded && !isPriorDashboard && !todayCheckin && <><button type="button" onClick={() => onCheckin("completed")} disabled={controlsDisabled}>기록함</button><button className="secondary" type="button" onClick={() => onCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button></>}
      {activeChallenge && !activeChallengeEnded && !isPriorDashboard && <button type="button" onClick={() => onNavigate("S07")} disabled={controlsDisabled}>오늘 상태 확인·기록하기</button>}
      <button className="secondary" type="button" onClick={() => onNavigate("S04")} disabled={controlsDisabled}>혈압 기록하기</button>
    </div>
  </Scene>;
  return <Scene id="S06" {...journeyCopy.S06} tone="subtle">{endedCyclePanel}<div className="locked-challenge" data-challenge-period="active"><p className="eyebrow">7일 챌린지 기간</p><span>선택한 행동</span><strong>{activeChallenge ? actionLabel(activeChallenge.action_id) : "선택한 행동 없음"}</strong>{activeChallenge && <small>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</small>}<p>챌린지 체크인 진행은 최근 7일 기록과 별도로 표시합니다.</p></div><div className="marker-row"><span className="settle-marker" aria-hidden="true" /><div><span>오늘의 상태</span><strong>{todayCheckin ? checkinLabel(todayCheckin.status) : "아직 기록하지 않음"}</strong></div></div><button type="button" onClick={() => onNavigate("S04")}>혈압 기록하기</button></Scene>;
}
