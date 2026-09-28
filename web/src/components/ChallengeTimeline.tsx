import { useId } from "react";

import type { ActiveChallenge, ChallengeCheckin } from "../lib/api-contract";
import { shiftDate } from "../lib/seoulDate";

import "./challenge-timeline.css";

type ChallengeTimelineProps = Readonly<{
  challenge: ActiveChallenge;
  checkins: readonly ChallengeCheckin[];
  today: string;
  factsStartOn?: string;
  factsEndOn?: string;
  compact?: boolean;
}>;

type DayState = "completed" | "skipped" | "empty" | "upcoming" | "unloaded";

function displayDate(value: string) {
  return `${Number(value.slice(5, 7))}/${Number(value.slice(8))}`;
}

function dayStateLabel(state: DayState, current: boolean) {
  if (state === "completed") return "기록함";
  if (state === "skipped") return "건너뜀";
  if (state === "upcoming") return "예정";
  if (state === "unloaded") return "불러오기 전";
  return current ? "기록 전" : "기록 없음";
}

/** A factual challenge-only calendar. It never derives success from check-in counts. */
export function ChallengeTimeline({
  challenge,
  checkins,
  today,
  factsStartOn,
  factsEndOn,
  compact = false,
}: ChallengeTimelineProps) {
  const headingId = useId();
  const ended = today > challenge.ends_on || challenge.status === "closed";
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(challenge.starts_on, index))
    .filter((date) => date <= challenge.ends_on);
  const todayIndex = days.indexOf(today);
  const checkinsByDate = new Map(
    checkins
      .filter((checkin) => checkin.challenge_id === challenge.id)
      .map((checkin) => [checkin.observed_on, checkin] as const),
  );

  return (
    <section
      className={`challenge-timeline${compact ? " challenge-timeline--compact" : ""}`}
      data-challenge-timeline={ended ? "ended" : "active"}
      aria-labelledby={headingId}
    >
      <div className="challenge-timeline-heading">
        <div>
          <p className="eyebrow">7일 기록</p>
          <h2 id={headingId}>{ended ? "완료된 기간의 상태" : "오늘의 위치와 남은 기간"}</h2>
        </div>
        <p className="challenge-timeline-period">
          <time dateTime={challenge.starts_on}>{challenge.starts_on}</time>
          <span aria-hidden="true">—</span>
          <time dateTime={challenge.ends_on}>{challenge.ends_on}</time>
        </p>
        <strong className="challenge-timeline-position">
          {ended ? "기간 종료" : todayIndex >= 0 ? `오늘 · ${todayIndex + 1}일째` : "7일 진행 중"}
        </strong>
      </div>

      <ol aria-label="챌린지 날짜별 참여 기록">
        {days.map((date, index) => {
          const checkin = checkinsByDate.get(date);
          const current = date === today;
          const factsLoaded = (!factsStartOn || date >= factsStartOn) && (!factsEndOn || date <= factsEndOn);
          const state: DayState = checkin?.status
            ?? (date > today ? "upcoming" : !factsLoaded ? "unloaded" : "empty");
          const label = dayStateLabel(state, current);

          return (
            <li
              key={date}
              data-challenge-day={date}
              data-challenge-day-state={state}
              aria-current={current ? "date" : undefined}
              aria-label={`${index + 1}일차, ${date}${current ? ", 오늘" : ""}, ${label}`}
            >
              <span className="challenge-day-index">{index + 1}일</span>
              <time dateTime={date}>{displayDate(date)}</time>
              <span className="challenge-day-marker" aria-hidden="true" />
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>

      <p className="challenge-timeline-note">
        ‘기록함’과 ‘건너뜀’은 참여 상태이며, 혈압 결과나 건강 변화의 판단이 아니에요.
      </p>
    </section>
  );
}
