import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StaticJourneyLandscape } from './StaticSceneFallback';
import { VisualStage } from './VisualStage';
import type { ScreenId } from '../ui/journey';
import { HomeJourneyTrail } from './HomeJourneyTrail';
import { TrailDayDetail } from './TrailDayDetail';
import type { TrailDay } from '../ui/livingWeek';
import { landmarkForCalendarDate } from '../ui/scenePolicy';
import { formatTrailDate, summarizeTrailDays } from '../ui/livingWeekPresentation';

type Action = { key: string; title: string; support: string; action: string; screen: ScreenId };

type JourneyTodayProps = {
  staticLandscape: boolean;
  today: string;
  days: TrailDay[];
  lead: Action;
  secondary: Action[];
  freshness: 'loading' | 'ready' | 'refreshing' | 'error' | 'refresh-error';
  children?: ReactNode;
  onNavigate: (screen: ScreenId) => void;
};

/** The selection is disposable UI state. Facts and action destinations still belong to App. */
export function JourneyToday({ staticLandscape, today, days, lead, secondary, freshness, children, onNavigate }: JourneyTodayProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [detailOpen, setDetailOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  function selectDay(date: string) {
    setSelectedDate(date);
    setCalendarOpen(true);
    setDetailOpen(true);
  }
  const todayDay = days.find(day => day.date === today);
  const selectedDay = days.find(day => day.date === selectedDate) ?? todayDay ?? days.at(-1);
  const factsKnown = freshness !== 'loading' && freshness !== 'error';
  const todayKnown = factsKnown && Boolean(todayDay);
  const retained = freshness === 'refreshing' || freshness === 'refresh-error';
  // Only the existing explicit static policy can preview another date. A review
  // VisualStage always stays on today, so selecting a day cannot start a scene.
  const landscapeDate = staticLandscape && selectedDay ? selectedDay.date : today;
  const previewing = landscapeDate !== today;
  const landmark = landmarkForCalendarDate(landscapeDate);
  const summary = summarizeTrailDays(days);
  const leadKicker = lead.key === 'today-detail' ? '오늘 기록' : '오늘 먼저';

  return <section className="scene journey-candidate journey-today home-scene" data-scene="S02" aria-labelledby="S02-title">
    {/* Remove the existing poster’s near-white paper in presentation, retaining its source and date mapping. */}
    <svg className="today-poster-filter" width="0" height="0" aria-hidden="true"><defs><filter id="home-poster-paper" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -6 -6 -6 0 17" /></filter></defs></svg>
    <div className="today-journey">
      <div className="today-hero">
        <div className="today-desk">
          <div className="scene-copy">
            <p className="eyebrow"><span className="today-sun" aria-hidden="true">☀</span><time dateTime={today}>{formatTrailDate(today)}</time> · 오늘의 기록</p>
            <h1 ref={headingRef} tabIndex={-1} id="S02-title">오늘의 혈압 기록을,<br />날짜별로 이어봐요.<span className="today-wave" aria-hidden="true">☀</span></h1>
            <p className="scene-body">측정한 혈압을 기록하고, 최근 7일을 날짜·시간대별로 확인해요.<br />7일을 채우지 않아도 남긴 기록부터 볼 수 있어요.</p>
          </div>
          <section className="home-lead" data-home-concept={lead.key} aria-labelledby="home-lead-title">
            <div className="home-lead-copy">
              <p className="home-lead-kicker">{leadKicker}</p>
              <h2 id="home-lead-title">{lead.title}</h2>
              <p id="home-lead-support">{lead.support}</p>
            </div>
            <button type="button" aria-describedby="home-lead-support" onClick={() => onNavigate(lead.screen)}>{lead.action}<span aria-hidden="true">→</span></button>
          </section>
        </div>
        <figure className="journey-view" data-preview-date={landscapeDate} data-previewing={previewing}>
          <div className="journey-view-label">
            <span>{previewing ? '그날의 풍경' : '오늘의 풍경'}</span>
            <time dateTime={landscapeDate}>{formatTrailDate(landscapeDate)}</time>
          </div>
          <p className="today-companion-greeting">잠깐 쉬어가요.<br />오늘도, 함께.<span aria-hidden="true">♡</span></p>
          <div className="journey-view-frame">
            {staticLandscape ? <StaticJourneyLandscape screen="S02" calendarDate={landscapeDate} /> : <VisualStage screen="S02" calendarDate={today} />}
          </div>
          <figcaption className="journey-view-caption"><span className="today-companion-dot" aria-hidden="true" /><span>모아와 잠깐</span><strong>{landmark?.label}</strong><span>{previewing ? '선택한 날짜에 머물러요' : '오늘의 길은 여기에서'}</span></figcaption>
        </figure>
      </div>
      <section className="living-week" data-window-kind="recent-history" aria-labelledby="living-week-title">
        <header className="living-week-heading">
          <div className="living-week-title"><span className="today-leaf" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 29V17C4 18 2 9 3 4c9 0 14 4 13 13C16 6 22 2 30 2c1 11-3 17-14 17" /></svg></span><div><h2 id="living-week-title">최근 7일 기록</h2><p>{todayDay ? '오늘을 포함한 최근 7일 · 날짜별 혈압 기록을 확인해요' : '선택한 7일 · 날짜별 혈압 기록을 확인해요'}</p></div></div>
          <a href="?screen=S10" onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate('S10'); } }}>7일 돌아보기<span aria-hidden="true"> →</span></a>
        </header>
        <button className="today-calendar-toggle" type="button" aria-expanded={calendarOpen} aria-controls="today-journey-details" onClick={() => setCalendarOpen(open => { const next = !open; if (next && selectedDay) setDetailOpen(true); return next; })}>{calendarOpen ? "날짜별 기록 자세히 접기" : "날짜별 기록 자세히 보기"}<span aria-hidden="true">{calendarOpen ? "−" : "+"}</span></button>
        <div id="home-calendar" className="today-calendar" data-open={calendarOpen}>
        <HomeJourneyTrail days={days} today={today} selectedDate={selectedDay?.date ?? null} onSelectDate={selectDay} detailId="today-trail-detail" factsKnown={factsKnown} />
        <dl className="living-trace-summary" aria-label="최근 7일 혈압 관찰 요약">
          <div><dt>혈압 관찰이 있는 날</dt><dd>{factsKnown ? `${summary.observationDateCount}일` : '미확인'}</dd></div>
          <div><dt>혈압 관찰</dt><dd>{factsKnown ? `${summary.observationCount}건` : '미확인'}</dd></div>
        </dl>
        {retained && <p className="living-week-note">{freshness === 'refreshing' ? '새로고침 중 · 이 길은 마지막으로 불러온 기록을 보여드려요.' : '최신 여부 미확인 · 이 길은 마지막으로 불러온 기록을 보여드려요. 최근 변경이 반영되지 않았을 수 있어요.'}</p>}
        <div id="today-journey-details" className="today-journey-details">
        {selectedDay && <details className="today-trail-disclosure" open={detailOpen} onToggle={event => setDetailOpen(event.currentTarget.open)}>
          <summary><span><time dateTime={selectedDay.date}>{formatTrailDate(selectedDay.date)}</time> 기록 자세히 보기</span><span aria-hidden="true">＋</span></summary>
          <TrailDayDetail id="today-trail-detail" day={selectedDay} today={today} factsKnown={factsKnown} />
        </details>}
        {todayDay && <button type="button" className="text-button today-return" aria-pressed={selectedDay?.date === today} onClick={() => selectDay(today)}>오늘로 돌아오기</button>}
        <details className="living-week-guide"><summary>최근 7일을 왜 보여주나요?</summary><p>최근 기록을 날짜·시간대별로 다시 보기 위한 범위예요. 7일을 채우지 않아도 남긴 기록부터 볼 수 있어요. 혈압 관찰과 챌린지 참여는 서로 다른 사실로 표시합니다.</p></details>
        </div>
        </div>
      </section>
      <section className="today-records" aria-labelledby="today-records-title">
        <header className="today-records-heading"><h2 id="today-records-title">오늘, 한눈에</h2><time dateTime={today}>{formatTrailDate(today)}</time></header>
        {retained && <p className="today-freshness">{freshness === 'refreshing' ? '새로고침 중 · 마지막으로 불러온 기록을 보여드려요.' : '최신 여부 미확인 · 마지막으로 불러온 기록을 보여드려요. 최근 변경이 반영되지 않았을 수 있어요.'}</p>}
        <div className="today-records-grid">
          <dl className="journey-facts" aria-label="오늘의 별도 기록 상태" aria-live="polite" aria-atomic="true">
            <div className="today-ledger-fact today-ledger-fact--observation"><dt><span className="today-record-icon today-record-icon--observation" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20 4 12C-2 5 7 0 12 7c5-7 14-2 8 5Z" /></svg></span>혈압 관찰</dt><dd key={`bp-${todayKnown}-${todayDay?.observationCount}`}>{todayKnown ? <><strong>{todayDay!.observationCount}</strong>건</> : '미확인'}</dd></div>
            <div className="today-ledger-fact today-ledger-fact--participation"><dt><span className="today-record-icon today-record-icon--participation" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M4 10h16M8 3v4m8-4v4" /></svg></span>챌린지 참여</dt><dd key={`challenge-${todayKnown}-${todayDay?.participation}`}>{todayKnown ? todayDay!.participation : '미확인'}</dd></div>
          </dl>
        </div>
        <p className="today-records-note">혈압 관찰과 챌린지 참여는 서로 다른 사실로 남아요.</p>
        <nav className="home-links" aria-label="오늘 기록 바로가기">
          {secondary.map(item => <button key={item.key} type="button" data-home-concept={item.key} data-home-destination={item.screen} onClick={() => onNavigate(item.screen)}>
            <span><strong>{item.title}</strong><small>{item.support}</small></span><span aria-hidden="true">↗</span>
          </button>)}
          <button
            type="button"
            className="today-starting-point-entry"
            aria-describedby="today-starting-point-help"
            onClick={() => onNavigate('S11')}
          >
            <span>
              <strong>생활정보로 오늘의 시작점 보기</strong>
              <small id="today-starting-point-help">활동·수면·생활습관 · 이번 이용에만 표시하고 저장하지 않아요.</small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        </nav>
        {children && <div className="today-cycle-actions">{children}</div>}
      </section>
    </div>
  </section>;
}

export function JourneyNote() {
  return <aside className="journey-note">
    <div className="journey-landscape" aria-hidden="true"><i /><i /><i /><span /></div>
    <p>측정한 그대로,<br />하나의 기록으로.</p>
    <small>혈압 관찰과 챌린지 참여는<br />각각의 사실로 남겨요.</small>
  </aside>;
}
