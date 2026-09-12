import { useId, type ReactNode } from 'react';
import type { TrailDay } from '../ui/livingWeek';
import { formatTrailDate, trailDayContext } from '../ui/livingWeekPresentation';
import { landmarkForCalendarDate } from '../ui/scenePolicy';
import { TrailLandmark } from './SevenDayTrail';

type TrailDayDetailProps = {
  day: TrailDay;
  today: string;
  id?: string;
  factsKnown?: boolean;
  children?: ReactNode;
};

/** A date-bound paper stop. The main scene's presentation policy remains separate. */
export function TrailDayDetail({ day, today, id, factsKnown = true, children }: TrailDayDetailProps) {
  const generatedId = useId();
  const detailId = id ?? `trail-day-${generatedId}`;
  const landmark = landmarkForCalendarDate(day.date);
  return <section id={detailId} className="trail-day-detail" data-selected-date={day.date} aria-labelledby={`${detailId}-title`}>
    <div className="trail-detail-landscape" aria-hidden="true" data-landmark={landmark?.id}>
      <span className="trail-detail-orbit" />
      <TrailLandmark date={day.date} />
    </div>
    <div className="trail-detail-body" key={day.date}>
      <header className="trail-detail-heading">
        <p className="eyebrow">{day.date === today ? '오늘 머무는 풍경' : day.date < today ? '선택한 날의 풍경' : '다가올 날짜의 풍경'}</p>
        <h3 id={`${detailId}-title`}><time dateTime={day.date}>{formatTrailDate(day.date)}</time>{day.date === today && <span className="trail-detail-today">오늘</span>}</h3>
        <p className="trail-detail-place-name">{landmark?.label}</p>
      </header>
      <dl className="trail-detail-facts" aria-label="선택한 날짜의 별도 기록 상태">
        <div><dt><span className="trail-fact-symbol trail-fact-symbol--observation" aria-hidden="true" />혈압 관찰</dt><dd>{factsKnown ? <><strong>{day.observationCount}</strong>건</> : '확인 전'}</dd></div>
        <div><dt><span className="trail-fact-symbol trail-fact-symbol--participation" aria-hidden="true" />챌린지 참여</dt><dd>{factsKnown ? day.participation : '확인 전'}</dd></div>
      </dl>
      <p className="trail-detail-context">{factsKnown ? trailDayContext(day, today) : '아직 이 날짜의 기록을 확인하지 못했어요. 기록을 불러오면 각각의 사실이 표시돼요.'}</p>
      {children && <div className="trail-detail-actions">{children}</div>}
    </div>
  </section>;
}
