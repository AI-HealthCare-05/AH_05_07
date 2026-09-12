import { landmarkForCalendarDate, type SceneLandmark } from '../ui/scenePolicy';
import type { TrailDay } from '../ui/livingWeek';
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

/** Receives only display facts. No requests, scene activation, scores or record actions. */
export function SevenDayTrail({ days, today }: { days: readonly TrailDay[]; today: string }) {
  return <ol className="seven-day-trail" aria-label="7일의 길 · 날짜별 혈압 관찰과 챌린지 참여">
    {days.map(day => {
      const landmark = landmarkForCalendarDate(day.date);
      return <li key={day.date} data-trail-date={day.date} aria-current={day.date === today ? 'date' : undefined}>
        <div className="trail-place">
          <time dateTime={day.date}>{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8))}{day.date === today && <span>오늘</span>}</time>
          <svg viewBox="0 0 64 60" aria-hidden="true"><ellipse className="trail-ground" cx="32" cy="49" rx="27" ry="7" /><path d={landmark ? landmarkPaths[landmark.id] : ''} /></svg>
          <span className="trail-landmark">{landmark?.label}</span>
        </div>
        <dl className="trail-facts">
          <div><dt>혈압 관찰</dt><dd>{day.observationCount}건</dd></div>
          <div><dt>챌린지 참여</dt><dd>{day.participation}</dd></div>
        </dl>
      </li>;
    })}
  </ol>;
}
