import { useRef, useState, type ReactNode } from 'react';
import { StaticJourneyLandscape } from './StaticSceneFallback';
import { VisualStage } from './VisualStage';
import { SevenDayTrail } from './SevenDayTrail';
import { TrailDayDetail } from './TrailDayDetail';
import type { TrailDay } from '../ui/livingWeek';
import { formatTrailDate, summarizeTrailDays } from '../ui/livingWeekPresentation';
import './journey-recap.css';

type JourneyRecapProps = {
  staticLandscape: boolean;
  today: string;
  days: readonly TrailDay[];
  year: string;
  prior: boolean;
  freshness: 'loading' | 'ready' | 'refreshing' | 'error' | 'refresh-error';
  navigation: ReactNode;
  records: (selectedDate: string | null) => ReactNode;
  challenge: ReactNode;
  actions: ReactNode;
};

/** Disposable day focus only; App retains requests, window dates and action guards. */
export function JourneyRecap({ staticLandscape, today, days, year, prior, freshness, navigation, records, challenge, actions }: JourneyRecapProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const recordsRef = useRef<HTMLDivElement>(null);
  const selectedDay = days.find(day => day.date === selectedDate);
  const focusedDate = selectedDay?.date ?? null;
  const factsKnown = freshness !== 'loading' && freshness !== 'error';
  const summary = summarizeTrailDays(days);
  const previewDate = staticLandscape && focusedDate ? focusedDate : today;
  const freshnessNote = freshness === 'loading' ? '7일의 기록을 불러오고 있어요.'
    : freshness === 'error' ? '기록을 불러오지 못해 아직 이 7일의 사실을 확인할 수 없어요.'
    : freshness === 'refreshing' ? '새로고침 중 · 마지막으로 불러온 기록이에요.'
    : freshness === 'refresh-error' ? '최신 여부 미확인 · 마지막으로 불러온 기록이에요.'
    : null;

  return <>
    <div className="recap-period">
      <p className="recap-period-label">{year}년 · {prior ? '이전 7일 · 읽기 전용' : '현재 7일 · 오늘 포함'}</p>
      {navigation}
    </div>

    <section className="living-week recap-week-sheet" aria-labelledby="living-week-title" data-window-kind={prior ? 'prior' : 'current'}>
      <div className="recap-week-intro">
        <div className="recap-week-overview">
          <header className="living-week-heading">
            <div>
              <p className="eyebrow">모아와 걷는 7일</p>
              <h2 id="living-week-title">7일의 길</h2>
              <p>{prior ? '지나온 풍경에 남겨둔 사실을 돌아봐요.' : '오늘까지, 풍경마다 남겨둔 사실을 돌아봐요.'}</p>
            </div>
          </header>
          <div className="recap-week-totals">
            <p className="recap-summary-label">선택한 7일 전체{freshness === 'refreshing' || freshness === 'refresh-error' ? ' · 마지막 확인 기록' : ''}</p>
            <dl className="recap-week-summary" data-week-summary aria-label="선택한 7일의 사실 요약">
              <div>
                <dt>혈압 관찰</dt>
                <dd>
                  <strong data-week-fact="observation-count">{factsKnown ? <>{summary.observationCount}<span>건</span></> : '—'}</strong>
                  <span>{factsKnown ? `기록이 있는 날 ${summary.observationDateCount}일` : '기록 확인 전'}</span>
                </dd>
              </div>
              <div>
                <dt>챌린지 체크인</dt>
                <dd>
                  <strong data-week-fact="participation-date-count">{factsKnown ? <>{summary.participationDateCount}<span>일</span></> : '—'}</strong>
                  <span>{factsKnown ? '체크인을 남긴 날짜' : '기록 확인 전'}</span>
                </dd>
              </div>
            </dl>
            {factsKnown && <details className="recap-summary-explainer">
              <summary>챌린지 날짜별 상태</summary>
              <p>기록함만 {summary.recordedDateCount}일 · 건너뜀만 {summary.skippedDateCount}일 · 혼합 {summary.mixedDateCount}일</p>
              <p>혼합은 같은 날 기록함과 건너뜀이 함께 있는 경우예요.</p>
            </details>}
          </div>
        </div>

        <aside className="recap-landscape" aria-label={staticLandscape && focusedDate ? '선택한 날짜의 풍경' : '오늘의 풍경'}>
          <figure className="recap-view">
            {staticLandscape ? <StaticJourneyLandscape screen="S10" calendarDate={previewDate} /> : <VisualStage screen="S10" calendarDate={today} />}
            <figcaption key={previewDate}>
              <span>{staticLandscape && focusedDate ? '선택한 날의 풍경' : '모아와 잠깐, 오늘의 풍경'}</span>
              <small><time dateTime={previewDate}>{formatTrailDate(previewDate)}</time>{staticLandscape && focusedDate ? ' · 날짜에 따라 펼쳐지는 풍경이에요.' : ' · 선택한 기록 기간과는 별개예요.'}</small>
            </figcaption>
          </figure>
        </aside>
      </div>

      {freshnessNote && <p className="recap-freshness" role="status" data-freshness={freshness}>{freshnessNote}</p>}
      <div className="recap-trail-heading">
        <p>날짜를 눌러, 그날에 머물러 보세요.</p>
        <button type="button" className="recap-show-week" aria-pressed={!focusedDate} aria-controls="recap-day-context recap-journal-records" onClick={() => setSelectedDate(null)}>7일 전체 보기</button>
      </div>
      <SevenDayTrail days={days} today={today} selectedDate={focusedDate} onSelectDate={setSelectedDate} detailId="recap-day-context" factsKnown={factsKnown} />
      <div className="recap-day-focus" id="recap-day-context" data-day-focused={Boolean(selectedDay)}>
        {selectedDay ? <TrailDayDetail key={selectedDay.date} day={selectedDay} today={today} factsKnown={factsKnown}>
          <button type="button" className="recap-day-record-link" onClick={() => {
            recordsRef.current?.focus({ preventScroll: true });
            recordsRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
          }}>이 날짜의 기록 목록 <span aria-hidden="true">↓</span></button>
        </TrailDayDetail> : <p className="recap-overview-note">{factsKnown && summary.observationCount === 0 && summary.participationDateCount === 0
          ? prior ? '이 7일에는 혈압 관찰과 챌린지 참여 기록이 없어요. 날짜별 풍경은 둘러볼 수 있어요.' : '이 7일에는 아직 혈압 관찰과 챌린지 참여 기록이 없어요. 오늘 남길 사실부터 시작해 보세요.'
          : '서울 날짜를 따라 혈압 관찰과 챌린지 참여를 각각 살펴봐요. 이전 방식의 기록은 아래 목록에서 확인해요.'}</p>}
      </div>
    </section>

    <div className="recap-journal" data-main-section="seven-day-dashboard" data-focused-date={focusedDate ?? undefined}>
      <header className="recap-journal-intro">
        <div>
          <p className="eyebrow">{focusedDate ? '하루에 머무르기' : '선택한 구간의 기록'}</p>
          <h2>{focusedDate ? <><time dateTime={focusedDate}>{Number(focusedDate.slice(5, 7))}월 {Number(focusedDate.slice(8))}일</time>의 기록</> : '7일의 기록'}</h2>
        </div>
        <p aria-live="polite" aria-atomic="true">{focusedDate ? `${formatTrailDate(focusedDate)}의 기록만 펼쳐 보고 있어요.` : '7일 전체 기록을 펼쳐 보고 있어요.'}</p>
        {freshness === 'refreshing' || freshness === 'refresh-error' ? <p className="recap-journal-freshness">{freshnessNote}</p> : null}
      </header>
      <div className="record-groups recap-record-groups" id="recap-journal-records" ref={recordsRef} tabIndex={-1} aria-label={focusedDate ? `${formatTrailDate(focusedDate)} 기록 목록` : '최근 7일 기록 목록'}>{records(focusedDate)}</div>
      <footer className="recap-tools">
        <p>{prior
          ? '이전 7일은 읽기 전용이에요. 파일 내보내기는 현재 7일에서 사용할 수 있어요.'
          : '선택한 7일의 기록을 파일로 보관할 수 있어요.'}</p>
        {focusedDate && !prior && <small className="recap-export-scope">하루만 펼쳐 보아도 내보내기에는 현재 7일 전체 기록이 담겨요.</small>}
        <div className="scene-actions utility-actions">{actions}</div>
      </footer>
    </div>
    <div className="recap-current-challenge">{challenge}</div>
  </>;
}
