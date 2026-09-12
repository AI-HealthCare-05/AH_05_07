import { useLayoutEffect, useRef } from 'react';
import type { TrailDay } from '../ui/livingWeek';
import { formatTrailDate, summarizeTrailDays } from '../ui/livingWeekPresentation';
import { landmarkForCalendarDate } from '../ui/scenePolicy';
import './living-week-report.css';

type LivingWeekReportProps = {
  days: readonly TrailDay[];
  observations: readonly { date: string; period: string; measurement: string }[];
  hasLegacyRecords: boolean;
  unconfirmedChanges: boolean;
  freshness: 'ready' | 'refreshing' | 'refresh-error';
  createdAt: Date;
  onClose: () => void;
};

/** A presentation of the loaded calendar facts, with only user-facing record fields. */
export function LivingWeekReport({ days, observations, hasLegacyRecords, unconfirmedChanges, freshness, createdAt, onClose }: LivingWeekReportProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summary = summarizeTrailDays(days);
  const generatedTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(createdAt);

  useLayoutEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return <main className="living-week-report" aria-labelledby="living-week-report-title">
    <div className="week-report-toolbar">
      <button className="secondary" type="button" onClick={onClose}>7일 돌아보기로 돌아가기</button>
      <button type="button" onClick={() => window.print()}>인쇄 / PDF로 저장</button>
      <p>브라우저 인쇄 창에서 인쇄하거나 PDF로 저장할 수 있어요.</p>
    </div>
    <article className="week-report-document" data-living-week-report>
      <header className="week-report-header">
        <p className="week-report-brand">SK7 <span>상균7데이즈</span></p>
        <h1 id="living-week-report-title" ref={headingRef} tabIndex={-1}>7일 기록 리포트</h1>
        <p className="week-report-range"><time dateTime={days[0].date}>{formatTrailDate(days[0].date)}</time> ~ <time dateTime={days[6].date}>{formatTrailDate(days[6].date)}</time></p>
        <p className="week-report-generated">리포트 열람 시각 · <time dateTime={createdAt.toISOString()}>{generatedTime}</time> (서울)</p>
        <p>7일 돌아보기에서 불러온 현재 7일 전체 기록이에요. 혈압 관찰과 챌린지 참여를 각각 정리했어요.</p>
      </header>

      {(freshness !== 'ready' || unconfirmedChanges) && <p className="week-report-freshness" role="status" data-report-freshness={freshness}>
        <strong>{freshness === 'refreshing' ? '새로고침 중' : '최신 여부 미확인'}</strong>
        {' · 마지막으로 불러온 기록이에요. 최근 변경이 반영되지 않았을 수 있어요.'}
        {unconfirmedChanges && ' 저장 또는 삭제의 반영 여부를 아직 확인하지 못했어요.'}
      </p>}

      <section className="week-report-summary" aria-labelledby="week-report-summary-title">
        <h2 id="week-report-summary-title">7일 전체 요약</h2>
        <div className="week-report-summary-columns">
          <section aria-labelledby="week-report-bp-title">
            <h3 id="week-report-bp-title">혈압 관찰</h3>
            <dl data-report-summary="blood-pressure">
              <div><dt>전체 관찰</dt><dd>{summary.observationCount}건</dd></div>
              <div><dt>관찰이 있는 날짜</dt><dd>{summary.observationDateCount}일</dd></div>
            </dl>
            <p>사용자가 직접 남긴 측정 기록이에요.</p>
          </section>
          <section aria-labelledby="week-report-challenge-title">
            <h3 id="week-report-challenge-title">챌린지 참여</h3>
            <dl data-report-summary="challenge">
              <div><dt>체크인이 있는 날짜</dt><dd>{summary.participationDateCount}일</dd></div>
              <div><dt>기록함</dt><dd>{summary.recordedDateCount}일</dd></div>
              <div><dt>건너뜀</dt><dd>{summary.skippedDateCount}일</dd></div>
              <div><dt>혼합</dt><dd>{summary.mixedDateCount}일</dd></div>
              <div><dt>기록 없음</dt><dd>{days.length - summary.participationDateCount}일</dd></div>
            </dl>
            <p>혼합은 같은 날짜에 기록함과 건너뜀이 함께 있는 경우예요. 각 날짜는 한 상태로만 집계해요.</p>
          </section>
        </div>
      </section>

      <section className="week-report-daily" aria-labelledby="week-report-daily-title">
        <h2 id="week-report-daily-title">날짜별 기록</h2>
        {days.map(day => <section className="week-report-day" key={day.date} data-report-date={day.date} aria-labelledby={`week-report-${day.date}`}>
          <header>
            <h3 id={`week-report-${day.date}`}><time dateTime={day.date}>{formatTrailDate(day.date)}</time></h3>
            <p>{landmarkForCalendarDate(day.date)?.label}</p>
          </header>
          <div className="week-report-day-facts">
            <div>
              <dl><div><dt>혈압 관찰</dt><dd>{day.observationCount}건</dd></div></dl>
              {day.observationCount > 0 ? <ul aria-label={`${formatTrailDate(day.date)} 혈압 측정 기록`}>
                {observations.filter(record => record.date === day.date).map((record, index) => <li key={index}>{record.period} · {record.measurement}</li>)}
              </ul> : <p>혈압 관찰 기록 없음</p>}
            </div>
            <dl><div><dt>챌린지 참여</dt><dd>{day.participation}</dd></div></dl>
          </div>
        </section>)}
      </section>

      <footer className="week-report-footer">
        {hasLegacyRecords && <p>이전 방식의 기록은 이 리포트의 요약과 날짜별 기록에 포함하지 않았어요. 7일 돌아보기의 별도 목록에서 확인할 수 있어요.</p>}
        <p>이 리포트는 사용자가 남긴 7일 기록을 정리한 자료이며, 진단·치료·치료 효과 판정이 아닙니다.</p>
      </footer>
    </article>
  </main>;
}
