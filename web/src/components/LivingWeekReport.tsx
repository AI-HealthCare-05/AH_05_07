import { useLayoutEffect, useRef } from 'react';
import type { TrailDay } from '../ui/livingWeek';
import { formatTrailDate, projectReportBloodPressure, summarizeTrailDays, type ReportObservation } from '../ui/livingWeekPresentation';
import { landmarkForCalendarDate } from '../ui/scenePolicy';
import './living-week-report.css';

type LivingWeekReportProps = {
  days: readonly TrailDay[];
  observations: readonly ReportObservation[];
  checkins: readonly { date: string; actionLabel: string; statusLabel: string }[];
  hasLegacyRecords: boolean;
  unconfirmedChanges: boolean;
  freshness: 'ready' | 'refreshing' | 'refresh-error';
  createdAt: Date;
  completedCycle?: boolean;
  onClose: () => void;
};

/** A presentation of the loaded calendar facts, with only user-facing record fields. */
export function LivingWeekReport({ days, observations, checkins, hasLegacyRecords, unconfirmedChanges, freshness, createdAt, completedCycle = false, onClose }: LivingWeekReportProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summary = summarizeTrailDays(days);
  const bloodPressure = projectReportBloodPressure(days, observations);
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
        <p className="week-report-brand">SK7</p>
        <h1 id="living-week-report-title" ref={headingRef} tabIndex={-1}>7일 기록 리포트</h1>
        <p className="week-report-range"><time dateTime={days[0].date}>{formatTrailDate(days[0].date)}</time> ~ <time dateTime={days[6].date}>{formatTrailDate(days[6].date)}</time></p>
        <p className="week-report-generated">리포트 열람 시각 · <time dateTime={createdAt.toISOString()}>{generatedTime}</time> (서울)</p>
        <p>표시된 {completedCycle ? '종료된 7일' : '현재 7일'} 구간에 저장되어 현재 불러온 기록이에요. 혈압 관찰과 챌린지 참여를 각각 정리했어요.</p>
        <p>필요하면 PDF로 저장하거나 인쇄해 진료·상담 때 이 기록을 직접 보여줄 수 있어요.</p>
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
              <div><dt>전체 관찰</dt><dd>{bloodPressure.observationCount}건</dd></div>
              <div><dt>아침 기록</dt><dd>{bloodPressure.morningCount}건</dd></div>
              <div><dt>저녁 기록</dt><dd>{bloodPressure.eveningCount}건</dd></div>
              <div><dt>관찰이 있는 날짜</dt><dd>{bloodPressure.observationDateCount}일</dd></div>
              <div><dt>관찰 기록 없음</dt><dd>{days.length - bloodPressure.observationDateCount}일</dd></div>
            </dl>
            <p>아침·저녁은 기록할 때 선택한 구분이며, 실제 측정 시각을 뜻하지 않아요.</p>
            {bloodPressure.mean && <p data-report-mean>
              단순 평균 (수축기/이완기) · {bloodPressure.mean.systolic.toFixed(1)}/{bloodPressure.mean.diastolic.toFixed(1)} mmHg<br />
              이 기간에 저장되어 현재 불러온 {bloodPressure.observationCount}건의 단순 산술 평균이에요. 각 기록을 같은 비중으로 계산해요.
            </p>}
            <p>‘관찰 기록 없음’은 현재 불러올 수 있는 혈압 기록이 없는 날짜예요. 측정하지 않았다는 뜻은 아니며, 미입력·삭제·만료 중 어떤 이유인지는 알 수 없어요.</p>
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
                {bloodPressure.observations.filter(record => record.date === day.date).map((record, index) => <li key={index}>{record.period === 'morning' ? '아침' : '저녁'} · {record.systolic}/{record.diastolic} mmHg</li>)}
              </ul> : <p>혈압 관찰 기록 없음</p>}
            </div>
            <div>
              <dl><div><dt>챌린지 참여</dt><dd>{day.participation}</dd></div></dl>
              {day.participation !== '기록 없음' && <ul aria-label={`${formatTrailDate(day.date)} 챌린지 참여 기록`}>
                {checkins.filter(record => record.date === day.date).map((record, index) => <li key={index}>{record.actionLabel} · {record.statusLabel}</li>)}
              </ul>}
            </div>
          </div>
        </section>)}
      </section>

      <footer className="week-report-footer">
        {hasLegacyRecords && <p>이전 방식의 기록은 이 리포트의 요약과 날짜별 기록에 포함하지 않았어요. 7일 돌아보기의 별도 목록에서 확인할 수 있어요.</p>}
        <p>이 리포트는 사용자가 입력한 7일 기록의 정리본이며, 진단·치료·치료 효과 판정이 아닙니다.</p>
        <p>PDF와 인쇄물은 사용자가 직접 관리하는 사본이며, 계정의 30일 서버 보관과 별개예요.</p>
      </footer>
    </article>
  </main>;
}
