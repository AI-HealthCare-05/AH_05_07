import { useState } from 'react';
import { StaticJourneyLandscape } from './StaticSceneFallback';
import { VisualStage } from './VisualStage';
import type { ScreenId } from '../ui/journey';
import { SevenDayTrail } from './SevenDayTrail';
import { TrailDayDetail } from './TrailDayDetail';
import type { TrailDay } from '../ui/livingWeek';
import { landmarkForCalendarDate } from '../ui/scenePolicy';
import { formatTrailDate } from '../ui/livingWeekPresentation';
import './journey-today.css';

type Action = { key: string; title: string; support: string; action: string; screen: ScreenId };

type JourneyTodayProps = {
  staticLandscape: boolean;
  today: string;
  days: TrailDay[];
  lead: Action;
  secondary: Action[];
  freshness: 'loading' | 'ready' | 'refreshing' | 'error' | 'refresh-error';
  onNavigate: (screen: ScreenId) => void;
};

/** The selection is disposable UI state. Facts and action destinations still belong to App. */
export function JourneyToday({ staticLandscape, today, days, lead, secondary, freshness, onNavigate }: JourneyTodayProps) {
  const [selectedDate, setSelectedDate] = useState(today);
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
  const hasTodayFacts = todayKnown && todayDay && (todayDay.observationCount > 0 || todayDay.participation !== '기록 없음');

  return <div className="today-journey">
    <div className="today-hero">
      <figure className="journey-view" data-preview-date={landscapeDate}>
        <div className="journey-view-label">
          <span>{previewing ? '그날의 풍경' : '오늘의 풍경'}</span>
          <time dateTime={landscapeDate}>{formatTrailDate(landscapeDate)}</time>
        </div>
        <div className="journey-view-frame">
          {staticLandscape ? <StaticJourneyLandscape screen="S02" calendarDate={landscapeDate} /> : <VisualStage screen="S02" calendarDate={today} />}
        </div>
        <figcaption className="journey-view-caption"><span>모아와 잠깐</span><strong>{landmark?.label}</strong><span>{previewing ? '선택한 날짜에 머물러요' : '오늘의 길은 여기에서'}</span></figcaption>
      </figure>
      <div className="today-desk">
        <section className="home-lead" data-home-concept={lead.key} aria-labelledby="home-lead-title">
          <div><p className="eyebrow">오늘, 여기에서</p><h2 id="home-lead-title">{lead.title}</h2><p>{lead.support}</p></div>
          <button type="button" onClick={() => onNavigate(lead.screen)}>{lead.action}<span aria-hidden="true">↗</span></button>
        </section>
        <div className="today-keepsake">
          <div className="today-keepsake-heading"><span>오늘 남긴 사실</span><time dateTime={today}>{Number(today.slice(5, 7))}월 {Number(today.slice(8))}일</time></div>
          {retained && <p className="today-freshness">{freshness === 'refreshing' ? '새로고침 중' : '최신 여부 미확인'} · 마지막으로 불러온 기록이에요.</p>}
          <dl className="journey-facts" aria-label="오늘의 별도 기록 상태" aria-live="polite" aria-atomic="true">
            <div><dt>혈압 관찰</dt><dd key={`bp-${todayKnown}-${todayDay?.observationCount}`}>{todayKnown ? <><strong>{todayDay!.observationCount}</strong>건</> : '미확인'}</dd></div>
            <div><dt>챌린지 참여</dt><dd key={`challenge-${todayKnown}-${todayDay?.participation}`}>{todayKnown ? todayDay!.participation : '미확인'}</dd></div>
          </dl>
          <p className="today-fact-response">{!todayKnown ? '오늘의 기록 상태를 아직 확인할 수 없어요.' : hasTodayFacts ? '오늘 남긴 사실이 아래 7일의 길에도 담겼어요.' : '아직 남긴 사실이 없어요. 측정값과 참여 상태는 각각 남길 수 있어요.'}</p>
        </div>
        <nav className="home-links" aria-label="오늘 기록 바로가기">
          {secondary.map(item => <button key={item.key} type="button" data-home-concept={item.key} data-home-destination={item.screen} aria-label={`${item.title} · ${item.support}`} onClick={() => onNavigate(item.screen)}>
            <span><strong>{item.title}</strong><small>{item.support}</small></span><span aria-hidden="true">→</span>
          </button>)}
        </nav>
      </div>
    </div>
    <section className="living-week" data-window-kind="recent-history" aria-labelledby="living-week-title">
      <header className="living-week-heading">
        <div><p className="eyebrow">모아와 걷는 7일</p><h2 id="living-week-title">오늘에서 이어지는 길</h2><p>오늘의 사실을 남기면, 7일의 풍경에 기록이 쌓입니다.</p></div>
        <a href="?screen=S10" onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate('S10'); } }}>7일 돌아보기<span aria-hidden="true"> →</span></a>
      </header>
      <div className="today-trail-instruction"><p>날짜를 눌러, 그날에 잠깐 머물러요.</p>{todayDay && <button type="button" className="text-button" aria-pressed={selectedDay?.date === today} onClick={() => setSelectedDate(today)}>오늘로 돌아오기</button>}</div>
      <SevenDayTrail days={days} today={today} selectedDate={selectedDay?.date ?? null} onSelectDate={setSelectedDate} detailId="today-trail-detail" factsKnown={factsKnown} />
      {retained && <p className="living-week-note">{freshness === 'refreshing' ? '새로고침 중' : '최신 여부 미확인'} · 이 길은 마지막으로 불러온 기록을 보여줘요.</p>}
      {selectedDay && <TrailDayDetail id="today-trail-detail" day={selectedDay} today={today} factsKnown={factsKnown} />}
      <details className="living-week-guide"><summary>이 길에 담기는 기록</summary><p>서울 날짜 · {todayDay ? '오늘을 포함한 최근 7일이에요.' : '선택한 7일의 기록이에요.'} 혈압은 관찰 건수, 챌린지는 참여 상태로 각각 남아요. 혼합은 같은 날짜에 기록함과 건너뜀이 함께 있는 경우예요. 이전 방식의 기록은 7일 돌아보기의 목록에서 확인할 수 있어요.</p></details>
    </section>
  </div>;
}

export function JourneyNote() {
  return <aside className="journey-note">
    <div className="journey-landscape" aria-hidden="true"><i /><i /><i /><span /></div>
    <p>측정한 그대로,<br />하나의 기록으로.</p>
    <small>혈압 관찰과 챌린지 참여는<br />각각의 사실로 남겨요.</small>
  </aside>;
}
