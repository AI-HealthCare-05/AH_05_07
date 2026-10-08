import type { CompanionSpecies } from "../ui/companion";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import type { ActiveChallenge, ChallengeCheckin } from "../lib/api-contract";
import { shiftDate } from "../lib/seoulDate";
import { LivingChoiceLink } from "../ui/LivingChoiceLink";
import { MySpaceEntry, type MySpaceEntryDisplay } from "../ui/SpaceReturnNavigation";
import { journeyCopy, type ScreenId } from "../ui/journey";
import type { TrailDay } from "../ui/livingWeek";
import { ChallengeTimeline } from "./ChallengeTimeline";
import { JourneyToday } from "./JourneyToday";
import { Scene } from "./SceneShell";
import { VisualStage } from "./VisualStage";

type TodayAction = {
  key: string;
  title: string;
  support: string;
  action: string;
  screen: ScreenId;
};

type TodayFreshness =
  | "loading"
  | "ready"
  | "refreshing"
  | "error"
  | "refresh-error";

type SignedInTodayPresentationProps = {
  journey: boolean;
  staticLandscape: boolean;
  today: string;
  startOn: string;
  endOn: string;
  days: TrailDay[];
  lead: TodayAction;
  secondary: TodayAction[];
  freshness: TodayFreshness;
  mySpaceEntry?: MySpaceEntryDisplay;
  companionSpecies?: CompanionSpecies | null;
  companionAsset?: CompanionAsset | null;

  livingChoiceAvailable: boolean;
  livingChoiceActionId?: string;
  livingChoiceSearch: string;

  endedChallenge: ActiveChallenge | null;
  challengeCheckins: ChallengeCheckin[];
  endedChallengeLabel: string | null;
  endedCycleNextDisabled: boolean;
  endedCycleReviewDisabled: boolean;
  showEndedCycleReviewAction: boolean;
  previousCycleReviewVisible: boolean;

  todayBloodPressureStatus: string;
  challengeStatusLabel: string;

  dateLabel: (value: string) => string;
  onNavigate: (screen: ScreenId) => void;
  onChooseNextChallenge: () => void;
  onOpenEndedCycleReview: () => void;
  onOpenPreviousCycleReview: () => void;
};

export function SignedInTodayPresentation({
  journey,
  staticLandscape,
  today,
  startOn,
  endOn,
  days,
  lead,
  secondary,
  freshness,
  mySpaceEntry,
  companionSpecies,
  companionAsset,
  livingChoiceAvailable,
  livingChoiceActionId,
  livingChoiceSearch,
  endedChallenge,
  challengeCheckins,
  endedChallengeLabel,
  endedCycleNextDisabled,
  endedCycleReviewDisabled,
  showEndedCycleReviewAction,
  previousCycleReviewVisible,
  todayBloodPressureStatus,
  challengeStatusLabel,
  dateLabel,
  onNavigate,
  onChooseNextChallenge,
  onOpenEndedCycleReview,
  onOpenPreviousCycleReview,
}: SignedInTodayPresentationProps) {
  const choiceLink = livingChoiceAvailable
    ? <LivingChoiceLink actionId={livingChoiceActionId} search={livingChoiceSearch} />
    : null;

  const endedCycle = endedChallenge ? (
    <section
      className="locked-challenge challenge-ended-panel"
      data-living-cycle="ended"
      aria-label="종료된 챌린지"
    >
      <div className="challenge-ended-heading">
        <div>
          <p className="eyebrow">7일 기간 종료</p>
          <h2>이번 챌린지가 끝났어요</h2>
        </div>
        <strong>{endedChallengeLabel}</strong>
      </div>
      <p>
        <time dateTime={endedChallenge.starts_on}>{endedChallenge.starts_on}</time>
        {" ~ "}
        <time dateTime={endedChallenge.ends_on}>{endedChallenge.ends_on}</time>
      </p>
      <p>기록함·건너뜀 내역은 완료된 7일 화면에서 정확한 기간 그대로 볼 수 있어요.</p>
      <ChallengeTimeline
        challenge={endedChallenge}
        checkins={challengeCheckins}
        today={today}
        factsStartOn={startOn}
        factsEndOn={endOn}
      />
      <div className="inline-actions">
        <button
          type="button"
          disabled={endedCycleNextDisabled}
          onClick={onChooseNextChallenge}
        >
          다음 챌린지 고르기
        </button>
        {showEndedCycleReviewAction && (
          <button
            type="button"
            className="secondary"
            disabled={endedCycleReviewDisabled}
            onClick={onOpenEndedCycleReview}
          >
            종료된 7일 돌아보기
          </button>
        )}
      </div>
    </section>
  ) : null;

  if (journey) {
    return (
      <JourneyToday
        key={`${today}:${endOn}`}
        mySpaceEntry={mySpaceEntry}
        staticLandscape={staticLandscape}
        today={today}
        days={days}
        lead={lead}
        secondary={secondary}
        freshness={freshness}
        onNavigate={onNavigate}
        companionSpecies={companionSpecies}
        companionAsset={companionAsset}
      >
        {endedCycle}
        {choiceLink}
        {previousCycleReviewVisible && (
          <button
            type="button"
            className="secondary"
            onClick={onOpenPreviousCycleReview}
          >
            종료된 7일 돌아보기
          </button>
        )}
      </JourneyToday>
    );
  }

  return (
    <Scene id="S02" {...journeyCopy.S02} tone="base" className="home-scene">
      {endedCycle}
      {choiceLink}

      <div className="today-ribbon">
        <span>{dateLabel(today)}</span>
        <strong>{todayBloodPressureStatus}</strong>
        <strong>{challengeStatusLabel}</strong>
      </div>

      <section
        className="home-lead"
        data-home-concept={lead.key}
        aria-labelledby="home-lead-title"
      >
        <div>
          <p className="eyebrow">오늘 먼저 할 일</p>
          <h2 id="home-lead-title">{lead.title}</h2>
          <p>{lead.support}</p>
        </div>
        <button type="button" onClick={() => onNavigate(lead.screen)}>
          {lead.action}
        </button>
      </section>

      <nav className="home-links" aria-label="오늘 기록 바로가기">
        {secondary.map((item) => (
          <button
            key={item.key}
            type="button"
            data-home-concept={item.key}
            data-home-destination={item.screen}
            aria-label={`${item.title} · ${item.support}`}
            onClick={() => onNavigate(item.screen)}
          >
            <span>
              <strong>{item.title}</strong>
              <small>{item.support}</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </nav>

      {mySpaceEntry && <MySpaceEntry destination={mySpaceEntry} />}

      <VisualStage
        screen="S02"
        calendarDate={today}
        companionSpecies={companionSpecies}
        companionAsset={companionAsset}
      />

      <section
        className="recent-window-summary"
        data-window-kind="recent-history"
        aria-labelledby="recent-window-title"
      >
        <div>
          <p className="eyebrow">기록 탐색</p>
          <h2 id="recent-window-title">최근 7일 기록</h2>
          <p>챌린지 7일 진행과는 별도로 확인해요.</p>
        </div>
        <ol className="week-path" aria-label="오늘을 포함한 최근 7일 기록">
          {Array.from({ length: 7 }, (_, index) => {
            const day = shiftDate(today, index - 6);
            return (
              <li
                key={day}
                className={day === today ? "is-today" : ""}
                aria-label={dateLabel(day)}
              >
                {day === today
                  ? "오늘"
                  : `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`}
              </li>
            );
          })}
        </ol>
      </section>
    </Scene>
  );
}
