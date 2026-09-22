import { useRef, useState, type ReactNode } from 'react';
import { UiIcon } from './UiIcon';
import { UiObject } from './UiObject';
import { StaticJourneyLandscape } from './StaticSceneFallback';
import { VisualStage } from './VisualStage';
import { SevenDayTrail } from './SevenDayTrail';
import { TrailDayDetail } from './TrailDayDetail';
import type { TrailDay } from '../ui/livingWeek';
import type { CompanionSpecies } from '../ui/companion';
import { formatTrailDate, summarizeTrailDays } from '../ui/livingWeekPresentation';
import { dispatchLivingReplayDayFocus } from '../ui/livingReplayAttention';
import './journey-recap.css';

type JourneyRecapProps = {
  staticLandscape: boolean;
  today: string;
  days: readonly TrailDay[];
  year: string;
  period: 'current' | 'prior' | 'completed-cycle';
  freshness: 'loading' | 'ready' | 'refreshing' | 'error' | 'refresh-error';
  navigation: ReactNode;
  records: (selectedDate: string | null) => ReactNode;
  challenge: ReactNode;
  actions: ReactNode;
  companionSpecies?: CompanionSpecies | null;
  productionSceneEnabled?: boolean;
  reportOnly?: boolean;
};

/** Disposable day focus only; App retains requests, window dates and action guards. */
export function JourneyRecap({ staticLandscape, today, days, year, period, freshness, navigation, records, challenge, actions, companionSpecies, productionSceneEnabled = false, reportOnly = false }: JourneyRecapProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const recordsRef = useRef<HTMLDivElement>(null);
  const selectedDay = days.find(day => day.date === selectedDate);
  const focusedDate = selectedDay?.date ?? null;
  const factsKnown = freshness !== 'loading' && freshness !== 'error';
  const summary = summarizeTrailDays(days);
  const hasRecordedFacts = summary.observationCount > 0 || summary.participationDateCount > 0;
  const recordedFactDayCount = days.filter(
    day => day.observationCount > 0 || day.participation !== '기록 없음',
  ).length;
  const missingFactDayCount = days.length - recordedFactDayCount;
  const hasPartialRecordedFacts = hasRecordedFacts && missingFactDayCount > 0;
  const readOnly = period !== 'current';
  const periodName = period === 'completed-cycle' ? '종료된 7일' : period === 'prior' ? '이전 7일' : '현재 7일';
  const previewDate = staticLandscape && focusedDate ? focusedDate : today;
  const freshnessNote = freshness === 'loading' ? '7일의 기록을 불러오고 있어요.'
    : freshness === 'error' ? '기록을 불러오지 못해 아직 이 7일의 사실을 확인할 수 없어요.'
    : freshness === 'refreshing' ? '새로고침 중 · 마지막으로 불러온 기록을 보여드려요.'
    : freshness === 'refresh-error' ? '최신 여부 미확인 · 마지막으로 불러온 기록을 보여드려요. 최근 변경이 반영되지 않았을 수 있어요.'
    : null;

  const focusReplayDay = (date: string, trigger?: HTMLButtonElement) => {
    setSelectedDate(date);
    if (trigger) dispatchLivingReplayDayFocus(trigger);
  };
  const focusRecords = () => {
    recordsRef.current?.focus({ preventScroll: true });
    recordsRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  return <>
    <div className="recap-period">
      <p className="recap-period-label">{year}년 · {periodName} · {readOnly ? '읽기 전용' : '오늘 포함'}</p>
      {navigation}
    </div>

    <section className="living-week recap-week-sheet" aria-labelledby="living-week-title" data-window-kind={period}>
      <div className="recap-week-intro">
        <div className="recap-week-overview">
          <header className="living-week-heading">
            <div>
              <p className="eyebrow">최근 기록 다시 보기</p>
              <h2 id="living-week-title">날짜별 기록</h2>
              <p>혈압과 챌린지 기록은 따로 표시해요.</p>
            </div>
          </header>
          <div className="recap-week-totals">
            <p className="recap-summary-label">{periodName} 전체{freshness === 'refreshing' || freshness === 'refresh-error' ? ' · 마지막 확인 기록' : ''}</p>
            <dl className="recap-week-summary" data-week-summary aria-label={`${periodName}의 사실 요약`}>
              <div>
                <dt><UiIcon name="observation" size={20} />혈압 관찰</dt>
                <dd>
                  <strong data-week-fact="observation-count">{factsKnown ? <>{summary.observationCount}<span>건</span></> : '—'}</strong>
                  <span>{factsKnown ? `기록이 있는 날 ${summary.observationDateCount}일` : '기록 확인 전'}</span>
                </dd>
              </div>
              <div>
                <dt><UiIcon name="participation" size={20} />챌린지 체크인</dt>
                <dd>
                  <strong data-week-fact="participation-date-count">{factsKnown ? <>{summary.participationDateCount}<span>일</span></> : '—'}</strong>
                  <span>{factsKnown ? '체크인을 남긴 날짜' : '기록 확인 전'}</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {freshnessNote && <p className="recap-freshness" role="status" data-freshness={freshness}>{freshnessNote}</p>}
      <div className="recap-trail-heading">
        <p>날짜를 선택하면 그날의 기록만 아래에서 확인할 수 있어요.</p>
        <button type="button" className="recap-show-week" aria-pressed={!focusedDate} aria-controls="recap-day-context recap-journal-records" onClick={() => setSelectedDate(null)}>7일 전체 보기</button>
      </div>
      <SevenDayTrail days={days} today={today} selectedDate={focusedDate} onSelectDate={focusReplayDay} detailId="recap-day-context" factsKnown={factsKnown} />
      <div className="recap-day-focus" id="recap-day-context" data-day-focused={Boolean(selectedDay)}>
        {selectedDay ? <TrailDayDetail key={selectedDay.date} day={selectedDay} today={today} factsKnown={factsKnown}>
          <button type="button" className="recap-day-record-link" onClick={focusRecords}>이 날짜의 기록 목록 <UiIcon name="arrow-down" size={18} /></button>
        </TrailDayDetail> : factsKnown && summary.observationCount === 0 && summary.participationDateCount === 0 ? <p className="recap-overview-note">
          {readOnly ? '이 7일에는 혈압 관찰과 챌린지 참여 기록이 없어요. 날짜별 풍경은 둘러볼 수 있어요.' : '이 7일에는 아직 혈압 관찰과 챌린지 참여 기록이 없어요. 오늘 남길 사실부터 시작해 보세요.'}
        </p> : null}
      </div>
      <div className="recap-week-notes">
        {factsKnown && hasPartialRecordedFacts && <p className="recap-week-coverage" data-recap-coverage>
          혈압 관찰과 챌린지 참여 기록이 없는 날 {missingFactDayCount}일도 빈 날로 그대로 보여요.
        </p>}
        {factsKnown && <details className="recap-summary-explainer">
          <summary>챌린지 날짜별 상태</summary>
          <p>기록함만 {summary.recordedDateCount}일 · 건너뜀만 {summary.skippedDateCount}일 · 혼합 {summary.mixedDateCount}일</p>
          <p>혼합은 같은 날 기록함과 건너뜀이 함께 있는 경우예요.</p>
        </details>}
        <button type="button" className="recap-records-jump" aria-controls="recap-journal-records" onClick={focusRecords}>
          혈압 기록 바로 보기 <UiIcon name="arrow-down" size={18} />
        </button>
      </div>
      <aside className="recap-landscape" aria-label={staticLandscape && focusedDate ? '선택한 날짜의 풍경' : '오늘의 풍경'}>
        <figure className="recap-view">
          {staticLandscape ? <StaticJourneyLandscape screen="S10" calendarDate={previewDate} /> : <VisualStage screen="S10" calendarDate={today} companionSpecies={companionSpecies} productionS10Enabled={productionSceneEnabled} />}
          <figcaption key={previewDate}>
            <span>{staticLandscape && focusedDate ? '선택한 날의 풍경' : '모아와 잠깐, 오늘의 풍경'}</span>
            <small><time dateTime={previewDate}>{formatTrailDate(previewDate)}</time>{staticLandscape && focusedDate ? ' · 날짜에 따라 펼쳐지는 풍경이에요.' : ' · 선택한 기록 기간과는 별개예요.'}</small>
          </figcaption>
        </figure>
      </aside>
    </section>

    <div className="recap-journal" data-main-section="seven-day-dashboard" data-record-priority="blood-pressure" data-focused-date={focusedDate ?? undefined}>
      <header className="recap-journal-intro">
        <div>
          <p className="eyebrow">{focusedDate ? '선택한 날짜의 혈압 기록' : '혈압 기록 먼저 보기'}</p>
          <h2>{focusedDate ? <><time dateTime={focusedDate}>{Number(focusedDate.slice(5, 7))}월 {Number(focusedDate.slice(8))}일</time>의 기록</> : '7일의 기록'}</h2>
        </div>
        <div className="recap-journal-scope" data-record-scope={focusedDate ? 'day' : 'week'}>
          <p aria-live="polite" aria-atomic="true">{focusedDate ? `${formatTrailDate(focusedDate)} 기록 표시 중` : '7일 전체 기록 표시 중'}</p>
          {focusedDate && <button type="button" className="recap-clear-day" onClick={() => setSelectedDate(null)}>7일 전체 기록 보기</button>}
        </div>
        {freshness === 'refreshing' || freshness === 'refresh-error' ? <p className="recap-journal-freshness">{freshnessNote}</p> : null}
      </header>
      <div className="record-groups recap-record-groups" id="recap-journal-records" ref={recordsRef} tabIndex={-1} aria-label={focusedDate ? `${formatTrailDate(focusedDate)} 기록 목록` : '최근 7일 기록 목록'}>{records(focusedDate)}</div>
      <footer className="recap-tools">
        <div className="recap-tools-intro">
          <UiObject name="book" className="recap-tools-object" />
          <h3>{reportOnly ? '리포트' : '리포트와 내보내기'}</h3>
          <p>{reportOnly
            ? '체험 기록을 인쇄·PDF로 정리할 수 있어요.'
            : '혈압 기록을 인쇄·PDF로 정리하고, 현재 7일은 JSON으로 내보낼 수 있어요.'}</p>
        </div>
        <p className="recap-tools-state">{reportOnly
          ? '현재 보고 있는 7일을 정리해요.'
          : readOnly
            ? '파일 내보내기는 현재 7일에서 사용할 수 있어요.'
            : '내보낸 파일은 본인 기기에 보관해요.'}</p>
        {focusedDate && !readOnly && !reportOnly && <small className="recap-export-scope">하루만 펼쳐 보아도 내보내기에는 현재 7일 전체 기록이 담겨요.</small>}
        <div className="scene-actions utility-actions" data-recap-tools>{actions}</div>
      </footer>
    </div>
    <div className="recap-current-challenge">
      <div className="recap-optional-intro">
        <strong>생활 챌린지는 별도 기록이에요</strong>
      </div>
      {challenge}
    </div>
  </>;
}
