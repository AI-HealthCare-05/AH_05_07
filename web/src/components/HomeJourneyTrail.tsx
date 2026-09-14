import type { TrailDay } from '../ui/livingWeek';
import { formatTrailDate } from '../ui/livingWeekPresentation';
import { landmarkForCalendarDate } from '../ui/scenePolicy';
import './home-journey-trail.css';

type HomeJourneyTrailProps = {
  days: readonly TrailDay[];
  today: string;
  selectedDate: string | null;
  onSelectDate: (date: string, trigger?: HTMLButtonElement) => void;
  detailId?: string;
  factsKnown?: boolean;
};

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

/** The connected nodes show calendar position; the two marks show separate record presence. */
export function HomeJourneyTrail({ days, today, selectedDate, onSelectDate, detailId, factsKnown = true }: HomeJourneyTrailProps) {
  return <div className="home-journey-trail">
    <ol className="home-trail-dates" aria-label="7일의 길 · 날짜별 혈압 관찰과 챌린지 참여">
      {days.map(day => {
        const landmark = landmarkForCalendarDate(day.date);
        const current = day.date === today;
        const selected = day.date === selectedDate;
        const temporal = current ? 'today' : day.date < today ? 'past' : 'future';
        const factsLabel = factsKnown ? `혈압 관찰 ${day.observationCount}건, 챌린지 참여 ${day.participation}` : '기록 확인 전';
        return <li key={day.date} data-trail-date={day.date} data-selected={selected} data-temporal={temporal} aria-current={current ? 'date' : undefined}>
          <button className="home-trail-date" type="button" onClick={event => onSelectDate(day.date, event.currentTarget)}
            aria-pressed={selected} aria-current={current ? 'date' : undefined} aria-controls={detailId}
            aria-label={`${formatTrailDate(day.date)}${current ? ', 오늘' : temporal === 'future' ? ', 오늘 이후' : ''} · ${landmark?.label ?? '날짜의 풍경'} · ${factsLabel}`}>
            <span className="home-trail-node" aria-hidden="true">{current ? '오늘' : weekdays[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}</span>
            <time dateTime={day.date}>{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8))}</time>
            <span className="home-trail-presence" aria-hidden="true">
              <i className="home-trail-mark home-trail-mark--observation" data-present={factsKnown && day.observationCount > 0} />
              <i className="home-trail-mark home-trail-mark--participation" data-present={factsKnown && day.participation !== '기록 없음'} />
            </span>
          </button>
          <dl className="trail-facts home-trail-accessible-facts">
            <div><dt>혈압 관찰</dt><dd>{factsKnown ? `${day.observationCount}건` : '확인 전'}</dd></div>
            <div><dt>챌린지 참여</dt><dd>{factsKnown ? day.participation : '확인 전'}</dd></div>
          </dl>
        </li>;
      })}
    </ol>
    <p className="home-trail-legend" aria-hidden="true">
      <span><i className="home-trail-mark home-trail-mark--observation" data-present="true" />혈압 관찰 있음</span>
      <span><i className="home-trail-mark home-trail-mark--participation" data-present="true" />챌린지 기록 있음</span>
    </p>
  </div>;
}
