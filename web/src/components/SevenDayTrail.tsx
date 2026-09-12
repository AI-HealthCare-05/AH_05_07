import { landmarkForCalendarDate, type SceneLandmark } from '../ui/scenePolicy';
import type { TrailDay } from '../ui/livingWeek';
import { formatTrailDate } from '../ui/livingWeekPresentation';
import './seven-day-trail.css';

// Small, date-only silhouettes continue the existing landscape without a runtime scene.
const landmarkPaths: Record<SceneLandmark['id'], string> = {
  'garden-gate': 'M20 46V24Q32 8 44 24V46M16 46V20M48 46V20M20 30H44M27 24V46M37 24V46',
  'herb-garden': 'M32 48V24M32 35Q12 35 18 20Q32 19 32 35M32 29Q48 29 46 14Q32 14 32 29M21 48H43',
  'shade-tree': 'M24 39V18M24 12C7 12 8 32 24 32C40 32 41 12 24 12M36 37H52M36 42H52M38 37V49M50 37V49',
  'footbridge': 'M10 44Q32 27 54 44M10 33Q32 16 54 33M13 32V45M24 26V37M40 26V37M51 32V45',
  'reading-shelter': 'M12 27L32 12L52 27M18 27V48M46 27V48M23 36Q28 33 32 37Q36 33 41 36V45Q36 42 32 46Q28 42 23 45ZM32 37V46',
  pavilion: 'M9 28L32 12L55 28ZM18 28V47M32 28V47M46 28V47M13 48H51',
  'sunset-overlook': 'M22 29A10 10 0 0 1 42 29M12 33H52M16 41Q32 33 48 41M32 10V6M15 18L11 15M49 18L53 15M22 49H42',
};

/** One lightweight date-only silhouette, shared by the path and its selected stop. */
export function TrailLandmark({ date, className }: { date: string; className?: string }) {
  const landmark = landmarkForCalendarDate(date);
  return <svg className={className} viewBox="0 0 64 60" aria-hidden="true" data-trail-landmark={landmark?.id}>
    <ellipse className="trail-ground" cx="32" cy="49" rx="27" ry="7" />
    <path d={landmark ? landmarkPaths[landmark.id] : ''} />
  </svg>;
}

type SevenDayTrailProps = {
  days: readonly TrailDay[];
  today: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  detailId?: string;
  factsKnown?: boolean;
};

/** Selection is local presentation state; dates never activate a runtime scene. */
export function SevenDayTrail({ days, today, selectedDate, onSelectDate, detailId, factsKnown = true }: SevenDayTrailProps) {
  return <><ol className="seven-day-trail" aria-label="7일의 길 · 날짜별 혈압 관찰과 챌린지 참여">
    {days.map(day => {
      const landmark = landmarkForCalendarDate(day.date);
      const current = day.date === today;
      const selected = day.date === selectedDate;
      const temporal = current ? 'today' : day.date < today ? 'past' : 'future';
      const factsLabel = factsKnown ? `혈압 관찰 ${day.observationCount}건, 챌린지 참여 ${day.participation}` : '기록 확인 전';
      return <li key={day.date} data-trail-date={day.date} data-selected={selected} data-temporal={temporal} aria-current={current ? 'date' : undefined}>
        <button className="trail-day-button" type="button" onClick={() => onSelectDate(day.date)}
          aria-pressed={selected} aria-current={current ? 'date' : undefined} aria-controls={detailId}
          aria-label={`${formatTrailDate(day.date)}${current ? ', 오늘' : temporal === 'future' ? ', 오늘 이후' : ''} · ${landmark?.label ?? '날짜의 풍경'} · ${factsLabel}`}>
          <span className="trail-day-state">{current ? '오늘' : selected ? '선택' : temporal === 'future' ? '이후' : '\u00a0'}</span>
          <time dateTime={day.date}>{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8))}</time>
          <span className="trail-place"><TrailLandmark date={day.date} /></span>
          <span className="trail-landmark">{landmark?.label}</span>
        </button>
        <dl className="trail-facts">
          <div><dt className="sr-only">혈압 관찰</dt><dd><span className="trail-fact-symbol trail-fact-symbol--observation" aria-hidden="true" /><span className="trail-fact-value">{factsKnown ? `${day.observationCount}건` : '확인 전'}</span></dd></div>
          <div><dt className="sr-only">챌린지 참여</dt><dd><span className="trail-fact-symbol trail-fact-symbol--participation" aria-hidden="true" /><span className="trail-fact-value">{factsKnown ? day.participation : '확인 전'}</span></dd></div>
        </dl>
      </li>;
    })}
  </ol>
    <p className="trail-legend" aria-hidden="true">
      <span><i className="trail-fact-symbol trail-fact-symbol--observation" />혈압 관찰</span>
      <span><i className="trail-fact-symbol trail-fact-symbol--participation" />챌린지 참여</span>
    </p>
  </>;
}
