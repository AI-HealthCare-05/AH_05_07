import { StaticJourneyLandscape } from './StaticSceneFallback';
import { VisualStage } from './VisualStage';
import type { ScreenId } from '../ui/journey';
import { shiftDate } from '../lib/seoulDate';

type Action = { key: string; title: string; support: string; action: string; screen: ScreenId };

type JourneyTodayProps = {
  staticLandscape: boolean;
  today: string;
  formattedDate: string;
  lead: Action;
  secondary: Action[];
  measurementLabel: string;
  challengeLabel: string;
  onNavigate: (screen: ScreenId) => void;
};

/** Presentation only: the App owns action selection; the scenery receives only a date. */
export function JourneyToday({ staticLandscape, today, formattedDate, lead, secondary, measurementLabel, challengeLabel, onNavigate }: JourneyTodayProps) {
  return <>
    <div className="journey-view">
      {staticLandscape ? <StaticJourneyLandscape screen="S02" calendarDate={today} /> : <VisualStage screen="S02" calendarDate={today} />}
      <p className="journey-view-caption">모아와 잠깐, 오늘의 풍경</p>
    </div>
    <section className="home-lead" data-home-concept={lead.key} aria-labelledby="home-lead-title">
      <div><p className="eyebrow">오늘 먼저 할 일</p><h2 id="home-lead-title">{lead.title}</h2><p>{lead.support}</p></div>
      <button type="button" onClick={() => onNavigate(lead.screen)}>{lead.action}<span aria-hidden="true">↗</span></button>
    </section>
    <dl className="today-ribbon journey-facts" aria-label="오늘의 별도 기록 상태">
      <div><dt>날짜</dt><dd><span>{formattedDate}</span></dd></div>
      <div><dt>혈압 관찰</dt><dd>{measurementLabel}</dd></div>
      <div><dt>챌린지 참여</dt><dd>{challengeLabel}</dd></div>
    </dl>
    <nav className="home-links" aria-label="오늘 기록 바로가기">
      {secondary.map(item => <button key={item.key} type="button" data-home-concept={item.key} data-home-destination={item.screen} aria-label={`${item.title} · ${item.support}`} onClick={() => onNavigate(item.screen)}>
        <span><strong>{item.title}</strong><small>{item.support}</small></span><span aria-hidden="true">→</span>
      </button>)}
    </nav>
    <section className="recent-window-summary" data-window-kind="recent-history" aria-labelledby="recent-window-title">
      <div><p className="eyebrow">기록의 발자국</p><h2 id="recent-window-title">최근 7일 기록</h2><p>챌린지 7일 진행과는 별도로 확인해요.</p></div>
      <ol className="week-path" aria-label="오늘을 포함한 최근 7일 기록">
        {Array.from({ length: 7 }, (_, index) => {
          const day = shiftDate(today, index - 6);
          return <li key={day} className={day === today ? 'is-today' : ''} aria-label={day}>{day === today ? '오늘' : `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`}</li>;
        })}
      </ol>
    </section>
  </>;
}

export function JourneyNote() {
  return <aside className="journey-note">
    <div className="journey-landscape" aria-hidden="true"><i /><i /><i /><span /></div>
    <p>측정한 그대로,<br />하나의 기록으로.</p>
    <small>혈압 관찰과 챌린지 참여는<br />각각의 사실로 남겨요.</small>
  </aside>;
}
