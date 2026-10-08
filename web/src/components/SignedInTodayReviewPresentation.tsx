import type { ActiveChallenge, BloodPressureObservation, ChallengeCheckin } from "../lib/api-contract";
import type { ScreenId } from "../ui/journey";
import { journeyCopy } from "../ui/journey";
import { ChallengeTimeline } from "./ChallengeTimeline";
import { DailyActionLoop } from "./DailyActionLoop";
import { Scene } from "./SceneShell";

type SignedInTodayReviewPresentationProps = {
  journey: boolean;
  firstBloodPressureWindow: boolean;
  isPriorDashboard: boolean;
  today: string;
  startOn: string;
  endOn: string;
  todayMeasurement?: BloodPressureObservation;
  todayMorningMeasurement?: BloodPressureObservation;
  todayEveningMeasurement?: BloodPressureObservation;
  activeChallenge: ActiveChallenge | null;
  activeChallengeEnded: boolean;
  todayCheckin?: ChallengeCheckin;
  challengeEventsCount: number;
  challengeCheckins: ChallengeCheckin[];
  controlsDisabled: boolean;
  readNavigationDisabled: boolean;
  dateLabel: (date: string) => string;
  displayMeasurement: (record: BloodPressureObservation) => string;
  challengeLabel: (actionId: string) => string;
  checkinLabel: (status: "completed" | "skipped") => string;
  onNavigate: (screen: ScreenId) => void;
  onSubmitActiveChallengeCheckin: (status: "completed" | "skipped") => void;
};

/** S07 display composition only. App retains authority, data and mutations. */
export function SignedInTodayReviewPresentation({
  journey,
  firstBloodPressureWindow,
  isPriorDashboard,
  today,
  startOn,
  endOn,
  todayMeasurement,
  todayMorningMeasurement,
  todayEveningMeasurement,
  activeChallenge,
  activeChallengeEnded,
  todayCheckin,
  challengeEventsCount,
  challengeCheckins,
  controlsDisabled,
  readNavigationDisabled,
  dateLabel,
  displayMeasurement,
  challengeLabel,
  checkinLabel,
  onNavigate,
  onSubmitActiveChallengeCheckin,
}: SignedInTodayReviewPresentationProps) {
  function todayLanes() {
    return (
      <div className="fact-lanes">
        <section className="fact-lead"><p className="eyebrow">혈압 관찰</p><h2>{todayMeasurement ? "오늘 기록 있음" : "아직 기록 없음"}</h2><p>{todayMeasurement ? displayMeasurement(todayMeasurement) : "필요할 때 오늘의 측정값을 기록할 수 있어요."}</p>{!todayMeasurement && <button type="button" onClick={() => onNavigate("S04")}>혈압 기록하기</button>}</section>
        <section><p className="eyebrow">챌린지 참여</p><h2>{activeChallenge && !activeChallengeEnded ? challengeLabel(activeChallenge.action_id) : "아직 선택 없음"}</h2><p>{todayCheckin ? `오늘 상태 · ${checkinLabel(todayCheckin.status)}` : "오늘 상태는 아직 기록하지 않았어요."}</p>{!activeChallenge || activeChallengeEnded ? <button type="button" onClick={() => onNavigate("S03")}>행동 고르기</button> : !todayCheckin && <div className="inline-actions"><button type="button" onClick={() => void onSubmitActiveChallengeCheckin("completed")} disabled={controlsDisabled}>기록함</button><button className="secondary" type="button" onClick={() => void onSubmitActiveChallengeCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button></div>}</section>
        <section><p className="eyebrow">이전 방식의 기록</p><h2>{challengeEventsCount}개</h2><p>이전 방식으로 남긴 기록은 읽기 전용으로 구분해요.</p><button className="secondary" type="button" onClick={() => onNavigate("S08")}>기록 찾아보기</button></section>
      </div>
    );
  }

  function journeyTodayLanes() {
    const currentChallenge = Boolean(activeChallenge && !activeChallengeEnded);
    const canRecordTodayStatus = !isPriorDashboard && currentChallenge && !todayCheckin;

    return (
      <div className="journey-today-detail" data-today-scope={isPriorDashboard ? "prior" : "current"} data-record-priority="blood-pressure">
        {isPriorDashboard && <p className="journey-today-scope">이전 7일 조회 중 · 오늘 상태를 확인하거나 새로 기록할 수 없어요.</p>}
        <div className="fact-lanes">
          <section className="fact-lead section-header">
            <p className="eyebrow">혈압 관찰</p>
            <h2>{isPriorDashboard ? "오늘 기록 상태 미확인" : todayMeasurement ? "오늘 기록 있음" : "오늘 기록 없음"}</h2>
            {isPriorDashboard ? (
              <p>선택한 이전 구간에서는 오늘 혈압 기록 여부를 확인할 수 없어요.</p>
            ) : todayMeasurement ? (
              <dl className="journey-today-bp-records" aria-label="오늘 혈압 기록">
                {todayMorningMeasurement && (
                  <div data-today-bp-period="morning">
                    <dt>아침</dt>
                    <dd>{displayMeasurement(todayMorningMeasurement)}</dd>
                  </div>
                )}
                {todayEveningMeasurement && (
                  <div data-today-bp-period="evening">
                    <dt>저녁</dt>
                    <dd>{displayMeasurement(todayEveningMeasurement)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p>필요할 때 오늘의 측정값을 기록할 수 있어요.</p>
            )}
            {!isPriorDashboard && !todayMeasurement && <button type="button" onClick={() => onNavigate("S04")} disabled={controlsDisabled}>혈압 기록하기</button>}
          </section>
          <section className="journey-today-secondary journey-today-challenge section-header"
            data-today-challenge-state={isPriorDashboard ? "unavailable" : activeChallengeEnded ? "ended" : todayCheckin?.status ?? (currentChallenge ? "pending" : "optional")}>
            <p className="eyebrow">선택 기능 · 챌린지 참여</p>
            <h2>{isPriorDashboard ? "오늘 상태 미확인" : currentChallenge ? challengeLabel(activeChallenge!.action_id) : activeChallengeEnded ? "종료된 챌린지" : "아직 선택 없음"}</h2>
            <p>{isPriorDashboard ? "선택한 이전 구간에서는 오늘 챌린지 상태를 확인하거나 기록할 수 없어요." : currentChallenge ? todayCheckin ? `오늘 상태 · ${checkinLabel(todayCheckin.status)}` : "오늘 상태를 확인하고 기록할 수 있어요." : activeChallengeEnded ? "종료된 챌린지에는 오늘 상태를 새로 기록할 수 없어요." : "행동을 선택하면 오늘 상태를 따로 기록할 수 있어요."}</p>
            {!isPriorDashboard && todayCheckin?.status === "skipped" && <p className="journey-today-challenge-note">'건너뜀'도 오늘 상태로 저장되며 혈압 기록과는 별도예요.</p>}
            {(!activeChallenge || activeChallengeEnded) && !isPriorDashboard ? <button type="button" onClick={() => onNavigate("S03")} disabled={controlsDisabled}>행동 고르기</button> : canRecordTodayStatus && <div className="journey-checkin-actions"><div className="inline-actions action-group"><button type="button" onClick={() => void onSubmitActiveChallengeCheckin("completed")} disabled={controlsDisabled}>기록함</button><button className="secondary" type="button" onClick={() => void onSubmitActiveChallengeCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button></div></div>}
          </section>
          <section className="section-header">
            <p className="eyebrow">이전 방식 기록</p>
            <h2>{challengeEventsCount}개</h2>
            <p>선택한 7일의 이전 방식 기록 · 읽기 전용. 오늘 기록 수나 챌린지 달성일과는 다른 기록이에요.</p>
            <button className="secondary" type="button" onClick={() => onNavigate("S08")} disabled={readNavigationDisabled}>기록 찾아보기</button>
          </section>
        </div>
        {!isPriorDashboard && activeChallenge && <ChallengeTimeline challenge={activeChallenge} checkins={challengeCheckins} today={today} factsStartOn={startOn} factsEndOn={endOn} compact />}
      </div>
    );
  }

      if (journey) return <Scene id="S07" eyebrow="오늘 기록 확인" title="오늘의 기록 확인" tone="base" className="journey-candidate journey-today-review surface">
        <DailyActionLoop current="S07" firstSession={firstBloodPressureWindow} />
        <div className="today-date"><strong>{isPriorDashboard ? "이전 7일 조회" : dateLabel(today)}</strong><span>{isPriorDashboard
          ? `${dateLabel(startOn)} ~ ${dateLabel(endOn)} · 읽기 전용`
          : "혈압·챌린지·이전 기록을 따로 확인해요."}</span></div>
        {journeyTodayLanes()}
        <div className="journey-today-actions action-group" aria-label="오늘 기록 다음 행동">
          <button className="secondary" type="button" onClick={() => onNavigate("S02")} disabled={readNavigationDisabled}>오늘 화면으로 돌아가기</button>
          <button type="button" onClick={() => onNavigate("S10")} disabled={readNavigationDisabled}>최근 7일 돌아보기</button>
        </div>
      </Scene>;
      return <Scene id="S07" {...journeyCopy.S07} tone="base"><div className="today-date"><strong>{dateLabel(today)}</strong></div>{todayLanes()}<button className="secondary" type="button" onClick={() => onNavigate("S02")}>오늘의 기록으로 돌아가기</button></Scene>;
}
