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
  cycle?: boolean;
  days: TrailDay[];
  lead: Action;
  secondary: Action[];
  freshness: 'loading' | 'ready' | 'refreshing' | 'error' | 'refresh-error';
  children?: ReactNode;
  onNavigate: (screen: ScreenId) => void;
};

/** The selection is disposable UI state. Facts and action destinations still belong to App. */
export function JourneyToday({ staticLandscape, today, cycle = false, days, lead, secondary, freshness, children, onNavigate }: JourneyTodayProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [detailOpen, setDetailOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  function selectDay(date: string) {
    setSelectedDate(date);
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
  const maxObservations = Math.max(1, ...days.map(day => day.observationCount));
  const cycleDay = cycle ? days.findIndex(day => day.date === today) + 1 : 0;

  return <section className="scene journey-candidate journey-today home-scene" data-scene="S02" aria-labelledby="S02-title">
    {/* Remove the existing poster’s near-white paper in presentation, retaining its source and date mapping. */}
    <svg className="today-poster-filter" width="0" height="0" aria-hidden="true"><defs><filter id="home-poster-paper" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -6 -6 -6 0 17" /></filter></defs></svg>
    <div className="today-journey">
      <div className="today-hero">
        <div className="today-desk">
          <div className="scene-copy">
            <p className="eyebrow"><span className="today-sun" aria-hidden="true">☀</span><time dateTime={today}>{formatTrailDate(today)}</time> · 오늘의 기록</p>
            <h1 ref={headingRef} tabIndex={-1} id="S02-title">오늘도,<br />좋은 하루예요.<span className="today-wave" aria-hidden="true">☀</span></h1>
            <p className="scene-body">작은 기록이 모여, 나만의 일상이 되도록.<br />오늘도 모아와 함께해요.</p>
          </div>
          <section className="home-lead" data-home-concept={lead.key} aria-labelledby="home-lead-title">
            <div><h2 id="home-lead-title">{lead.title}</h2><p id="home-lead-support">{lead.support}</p></div>
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
      <section className="living-week" data-window-kind={cycle ? "challenge-cycle" : "recent-history"} aria-labelledby="living-week-title">
        <header className="living-week-heading">
          <div className="living-week-title"><span className="today-leaf" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 29V17C4 18 2 9 3 4c9 0 14 4 13 13C16 6 22 2 30 2c1 11-3 17-14 17" /></svg></span><div><h2 id="living-week-title">My Living Journey</h2><p>{cycle ? `이번 7일의 길 · ${days[0]?.date} ~ ${days.at(-1)?.date}` : todayDay ? '오늘을 포함한 최근 7일 · 하루씩 이어지는 기록' : '선택한 7일의 길 · 날짜별 기록을 확인해요'}</p></div></div>
          {cycleDay > 0 && <div className="today-cycle-progress"><span>챌린지 여정 <strong>{cycleDay}<small> / 7일째</small></strong><small>날짜 기준</small></span><meter min={0} max={days.length} value={cycleDay} aria-label="챌린지 기간의 오늘 위치">{cycleDay} / {days.length}</meter></div>}
          <a href="?screen=S10" onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate('S10'); } }}>7일 돌아보기<span aria-hidden="true"> →</span></a>
        </header>
        <button className="today-calendar-toggle" type="button" aria-expanded={calendarOpen} aria-controls="home-calendar" onClick={() => setCalendarOpen(open => !open)}>{calendarOpen ? "날짜별 기록 접기" : "날짜별 기록 보기"}<span aria-hidden="true">{calendarOpen ? "−" : "+"}</span></button>
        <div id="home-calendar" className="today-calendar" data-open={calendarOpen}>
        <HomeJourneyTrail days={days} today={today} selectedDate={selectedDay?.date ?? null} onSelectDate={selectDay} detailId="today-trail-detail" factsKnown={factsKnown} />
        {retained && <p className="living-week-note">{freshness === 'refreshing' ? '새로고침 중 · 이 길은 마지막으로 불러온 기록을 보여드려요.' : '최신 여부 미확인 · 이 길은 마지막으로 불러온 기록을 보여드려요. 최근 변경이 반영되지 않았을 수 있어요.'}</p>}
        <div className="today-journey-details">
        {selectedDay && <details className="today-trail-disclosure" open={detailOpen} onToggle={event => setDetailOpen(event.currentTarget.open)}>
          <summary><span><time dateTime={selectedDay.date}>{formatTrailDate(selectedDay.date)}</time> 기록 자세히 보기</span><span aria-hidden="true">＋</span></summary>
          <TrailDayDetail id="today-trail-detail" day={selectedDay} today={today} factsKnown={factsKnown} />
        </details>}
        {todayDay && <button type="button" className="text-button today-return" aria-pressed={selectedDay?.date === today} onClick={() => selectDay(today)}>오늘로 돌아오기</button>}
        <details className="living-week-guide"><summary>이 길에 담기는 기록</summary><p>서울 날짜 · {cycle ? '선택한 챌린지의 7일이에요. 챌린지 참여는 이번 여정의 기록만 표시해요.' : todayDay ? '오늘을 포함한 최근 7일이에요.' : '선택한 7일의 기록이에요.'} 혈압은 관찰 건수, 챌린지는 참여 상태로 각각 남아요. 혼합은 같은 날짜에 기록함과 건너뜀이 함께 있는 경우예요. 이전 방식의 기록은 7일 돌아보기의 목록에서 확인할 수 있어요.</p></details>
        </div>
        </div>
      </section>
      <section className="today-records" aria-labelledby="today-records-title">
        <header className="today-records-heading"><h2 id="today-records-title">오늘, 한눈에</h2><time dateTime={today}>{formatTrailDate(today)}</time></header>
        {retained && <p className="today-freshness">{freshness === 'refreshing' ? '새로고침 중 · 마지막으로 불러온 기록을 보여드려요.' : '최신 여부 미확인 · 마지막으로 불러온 기록을 보여드려요. 최근 변경이 반영되지 않았을 수 있어요.'}</p>}
        <div className="today-records-grid">
          <dl className="journey-facts" aria-label="오늘의 별도 기록 상태" aria-live="polite" aria-atomic="true">
            <div className="today-summary-card today-observation-card"><dt><span className="today-record-icon today-record-icon--observation" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20 4 12C-2 5 7 0 12 7c5-7 14-2 8 5Z" /></svg></span>혈압 관찰</dt><dd key={`bp-${todayKnown}-${todayDay?.observationCount}`}>{todayKnown ? <><strong>{todayDay!.observationCount}</strong>건</> : '미확인'}</dd></div>
            <div className="today-summary-card today-participation-card"><dt><span className="today-record-icon today-record-icon--participation" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M4 10h16M8 3v4m8-4v4" /></svg></span>챌린지 참여</dt><dd key={`challenge-${todayKnown}-${todayDay?.participation}`}>{todayKnown ? todayDay!.participation : '미확인'}</dd></div>
          </dl>
          <section className="today-summary-card today-week-card" aria-labelledby="today-week-title">
            <header><h3 id="today-week-title">7일의 혈압 관찰</h3><span>{factsKnown ? `${summary.observationCount}건` : '미확인'}</span></header>
            <div className="today-observation-chart" role="img" aria-label={factsKnown ? days.map(day => `${formatTrailDate(day.date)} ${day.observationCount}건`).join(', ') : '7일의 혈압 관찰 확인 전'}>
              {days.map(day => <div key={day.date} data-chart-today={day.date === today}><span className="today-chart-track"><i style={{ height: `${factsKnown ? day.observationCount / maxObservations * 100 : 0}%` }} /></span><small>{Number(day.date.slice(8))}</small></div>)}
            </div>
            <p>{factsKnown ? `관찰 기록을 남긴 날 ${summary.observationDateCount}일` : '기록을 불러오면 표시돼요.'}</p>
          </section>
          <aside className="today-summary-card today-word-card"><h3>모아의 한마디 <span aria-hidden="true">❧</span></h3><span className="today-quote-mark" aria-hidden="true">“</span><p>서두르지 않아도 괜찮아요.<br />오늘의 기록부터, 하나씩.</p></aside>
        </div>
        <p className="today-records-note">혈압 관찰과 챌린지 참여는 서로 다른 사실로 남아요.</p>
        <nav className="home-links" aria-label="오늘 기록 바로가기">
          {secondary.map(item => <button key={item.key} type="button" data-home-concept={item.key} data-home-destination={item.screen} aria-label={`${item.title} · ${item.support}`} onClick={() => onNavigate(item.screen)}>
            <span><strong>{item.title}</strong><small>{item.support}</small></span><span aria-hidden="true">↗</span>
          </button>)}
          <div className="today-small-note"><span aria-hidden="true">❧</span><p>작은 기록으로 이어가는<br /><strong>나만의 7일.</strong></p></div>
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
