import { useLayoutEffect, useRef } from 'react';
import type { TrailDay } from '../ui/livingWeek';
import { formatTrailDate, projectReportBloodPressure, summarizeTrailDays, type ReportObservation } from '../ui/livingWeekPresentation';
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
  guestLocal?: boolean;
  onClose: () => void;
};

/** A presentation of the loaded calendar facts, with only user-facing record fields. */
export function LivingWeekReport({ days, observations, checkins, hasLegacyRecords, unconfirmedChanges, freshness, createdAt, completedCycle = false, guestLocal = false, onClose }: LivingWeekReportProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summary = summarizeTrailDays(days);
  const bloodPressure = projectReportBloodPressure(days, observations);
  const datesWithoutLoadedObservations = days.length - bloodPressure.observationDateCount;
  const generatedTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(createdAt);
  const freshnessConfirmed = freshness === 'ready' && !unconfirmedChanges;
  const freshnessTitle = freshnessConfirmed
    ? '현재 불러온 기록'
    : freshness === 'refreshing'
      ? '새로고침 중 · 최신 여부 미확인'
      : unconfirmedChanges
        ? '변경 반영·최신 여부 미확인'
        : '최신 여부 미확인';

  useLayoutEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return <main className="living-week-report" aria-labelledby="living-week-report-title">
    <nav className="week-report-toolbar" aria-label="리포트 작업">
      <button className="secondary week-report-back" type="button" onClick={onClose}>
        <span aria-hidden="true">←</span> 7일 돌아보기로 돌아가기
      </button>
      <div className="week-report-print-action">
        <p><strong>사용자가 직접 관리하는 사본</strong><span>브라우저 인쇄 창에서 인쇄하거나 PDF로 저장해요.</span></p>
        <button type="button" onClick={() => window.print()}>인쇄 / PDF로 저장</button>
      </div>
    </nav>

    <article className="week-report-document" data-living-week-report>
      <header className="week-report-header">
        <div className="week-report-kicker">
          <p className="week-report-brand">SK7 <span>7일 관찰 기록</span></p>
          <p className="week-report-window-kind">{guestLocal ? '체험 메모리' : completedCycle ? '종료된 7일' : '현재 7일'}</p>
        </div>
        <div className="week-report-identity">
          <div>
            <p className="week-report-eyebrow">진료·상담 때 함께 보는 사실 정리</p>
            <h1 id="living-week-report-title" ref={headingRef} tabIndex={-1}>7일 기록 리포트</h1>
            <p className="week-report-range" aria-label="리포트 표시 기간">
              <time dateTime={days[0].date}>{formatTrailDate(days[0].date)}</time>
              <span aria-hidden="true">—</span>
              <time dateTime={days[6].date}>{formatTrailDate(days[6].date)}</time>
            </p>
          </div>
          <aside
            className={`week-report-freshness ${freshnessConfirmed ? 'is-confirmed' : 'is-unconfirmed'}`}
            role={freshnessConfirmed ? undefined : 'status'}
            data-report-freshness={freshness}
            data-report-confirmed={freshnessConfirmed}
            aria-label="기록 최신 여부"
          >
            <span className="week-report-status-mark" aria-hidden="true" />
            <div>
              <strong>{freshnessTitle}</strong>
              <p>{freshnessConfirmed
                ? '리포트를 열 때 앱에 불러와 있던 기록으로 정리했어요.'
                : '마지막으로 불러온 기록이에요. 최근 변경이 반영되지 않았을 수 있어요.'}</p>
              {unconfirmedChanges && <p>저장 또는 삭제의 반영 여부를 아직 확인하지 못했어요.</p>}
              <small>열람 시각 · <time dateTime={createdAt.toISOString()}>{generatedTime}</time> (서울)</small>
            </div>
          </aside>
        </div>
        <p className="week-report-purpose">{guestLocal
          ? '현재 체험 메모리에 반영된 7일 기록이에요. 혈압 관찰과 챌린지 참여를 각각 정리했어요.'
          : `표시된 ${completedCycle ? '종료된 7일' : '현재 7일'} 구간에 저장되어 현재 불러온 기록이에요. 혈압 관찰과 챌린지 참여는 서로 섞지 않았어요.`} 필요하면 PDF로 저장하거나 인쇄해 진료·상담 때 이 기록을 직접 보여줄 수 있어요.</p>
      </header>

      <section className="week-report-summary" aria-labelledby="week-report-summary-title">
        <div className="week-report-section-heading">
          <div>
            <p>먼저 확인할 내용</p>
            <h2 id="week-report-summary-title">혈압 관찰 요약</h2>
          </div>
          <span>현재 불러온 사실만 사용</span>
        </div>

        <section className="week-report-bp-summary" aria-labelledby="week-report-bp-title">
          <h3 id="week-report-bp-title" className="week-report-visually-hidden">혈압 관찰 핵심 사실</h3>
          <dl className="week-report-bp-metrics" data-report-summary="blood-pressure">
            <div className="is-primary"><dt>전체 관찰</dt><dd>{bloodPressure.observationCount}<small>건</small></dd></div>
            <div><dt>관찰이 있는 날짜</dt><dd>{bloodPressure.observationDateCount}<small>일</small></dd></div>
            <div><dt>현재 불러온 관찰 없음</dt><dd>{datesWithoutLoadedObservations}<small>일</small></dd></div>
            <div><dt>아침 기록</dt><dd>{bloodPressure.morningCount}<small>건</small></dd></div>
            <div><dt>저녁 기록</dt><dd>{bloodPressure.eveningCount}<small>건</small></dd></div>
          </dl>

          <div className={`week-report-mean ${bloodPressure.mean ? '' : 'is-empty'}`} data-report-mean={bloodPressure.mean ? true : undefined}>
            <p>단순 산술 평균 <span>수축기 / 이완기</span></p>
            {bloodPressure.mean
              ? <><strong>{bloodPressure.mean.systolic.toFixed(1)}<span>/</span>{bloodPressure.mean.diastolic.toFixed(1)} <small>mmHg</small></strong><p>이 기간에 저장되어 현재 불러온 {bloodPressure.observationCount}건의 단순 산술 평균이에요. 각 기록을 같은 비중으로 계산해요.</p></>
              : <p className="week-report-mean-empty">관찰이 2건 이상일 때만 표시해요.</p>}
          </div>
        </section>

        <div className="week-report-reading-note" role="note">
          <strong>읽을 때 확인해 주세요</strong>
          <p>아침·저녁은 기록할 때 선택한 구분이며, 실제 측정 시각을 뜻하지 않아요.</p>
          <p>‘현재 불러온 관찰 없음’은 이 리포트에 표시할 혈압 기록이 없는 날짜예요. 측정하지 않았다는 뜻은 아니며, 미입력·삭제·만료 중 어떤 이유인지는 알 수 없어요.</p>
        </div>
      </section>

      <section className="week-report-challenge-summary" aria-labelledby="week-report-challenge-title">
        <div>
          <p className="week-report-secondary-label">별도로 보는 참여 사실</p>
          <h2 id="week-report-challenge-title">챌린지 참여</h2>
          <p>혈압 관찰과 연결해 해석하거나 효과를 판단하지 않아요.</p>
        </div>
        <dl data-report-summary="challenge">
          <div><dt>체크인이 있는 날짜</dt><dd>{summary.participationDateCount}일</dd></div>
          <div><dt>기록함</dt><dd>{summary.recordedDateCount}일</dd></div>
          <div><dt>건너뜀</dt><dd>{summary.skippedDateCount}일</dd></div>
          <div><dt>혼합</dt><dd>{summary.mixedDateCount}일</dd></div>
          <div><dt>기록 없음</dt><dd>{days.length - summary.participationDateCount}일</dd></div>
        </dl>
        <p className="week-report-challenge-note">혼합은 같은 날짜에 기록함과 건너뜀이 함께 있는 경우예요. 각 날짜는 한 상태로만 집계해요.</p>
      </section>

      <section className="week-report-daily" aria-labelledby="week-report-daily-title">
        <div className="week-report-section-heading">
          <div>
            <p>7일 원자료</p>
            <h2 id="week-report-daily-title">날짜별 기록</h2>
          </div>
          <span>오래된 날짜부터</span>
        </div>
        <div className="week-report-day-list">
          {days.map((day, dayIndex) => {
            const dayObservations = bloodPressure.observations.filter(record => record.date === day.date);
            const dayCheckins = checkins.filter(record => record.date === day.date);
            return <section className="week-report-day" key={day.date} data-report-date={day.date} aria-labelledby={`week-report-${day.date}`}>
              <header>
                <p>{dayIndex + 1} / {days.length}일</p>
                <h3 id={`week-report-${day.date}`}><time dateTime={day.date}>{formatTrailDate(day.date)}</time></h3>
              </header>
              <div className="week-report-day-facts">
                <div className="week-report-day-bp">
                  <div className="week-report-fact-heading"><strong>혈압 관찰</strong><span>{day.observationCount}건</span></div>
                  {dayObservations.length > 0 ? <ul aria-label={`${formatTrailDate(day.date)} 혈압 측정 기록`}>
                    {dayObservations.map((record, index) => <li key={index}>
                      <span>{record.period === 'morning' ? '아침' : '저녁'}</span>
                      {' · '}
                      <strong>{record.systolic}<span>/</span>{record.diastolic} mmHg</strong>
                    </li>)}
                  </ul> : <p>현재 불러온 혈압 관찰 없음</p>}
                </div>
                <div className="week-report-day-challenge">
                  <div className="week-report-fact-heading"><strong>챌린지 참여</strong><span>{day.participation}</span></div>
                  {dayCheckins.length > 0
                    ? <ul aria-label={`${formatTrailDate(day.date)} 챌린지 참여 기록`}>
                      {dayCheckins.map((record, index) => <li key={index}>{record.actionLabel} · {record.statusLabel}</li>)}
                    </ul>
                    : <p>현재 불러온 참여 기록 없음</p>}
                </div>
              </div>
            </section>;
          })}
        </div>
      </section>

      <footer className="week-report-footer">
        {hasLegacyRecords && <p><strong>이전 방식의 기록</strong>은 이 리포트의 요약과 날짜별 기록에 포함하지 않았어요. 7일 돌아보기의 별도 목록에서 확인할 수 있어요.</p>}
        <p>이 리포트는 사용자가 입력한 7일 기록의 정리본이며, 진단·치료·치료 효과 판정이 아닙니다.</p>
        <p>{guestLocal
          ? 'PDF와 인쇄물은 사용자가 직접 관리하는 사본이며, 체험을 새로 열면 원본 기록은 초기화돼요.'
          : 'PDF와 인쇄물은 사용자가 직접 관리하는 사본이며, 계정의 30일 서버 보관과 별개예요.'}</p>
      </footer>
    </article>
  </main>;
}
