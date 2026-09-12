import { StaticJourneyLandscape } from './StaticSceneFallback';
import type { ReactNode } from 'react';
import { VisualStage } from './VisualStage';
import './journey-recap.css';
import { SevenDayTrail } from './SevenDayTrail';
import type { TrailDay } from '../ui/livingWeek';

type JourneyRecapProps = {
  staticLandscape: boolean;
  today: string;
  days: TrailDay[];
  year: string;
  prior: boolean;
  freshness: 'loading' | 'ready' | 'refreshing' | 'error' | 'refresh-error';
  navigation: ReactNode;
  records: ReactNode;
  challenge: ReactNode;
  actions: ReactNode;
};

/** Read-only composition; App retains requests, dates, focus and action guards. */
export function JourneyRecap({ staticLandscape, today, days, year, prior, freshness, navigation, records, challenge, actions }: JourneyRecapProps) {
  return <>
    <div className="recap-period">
      <p className="recap-period-label">{year}년 · {prior ? '이전 7일 · 읽기 전용' : '현재 7일 · 오늘 포함'}</p>
      {navigation}
    </div>
    <section className="living-week" aria-labelledby="living-week-title">
      <header className="living-week-heading"><div><p className="eyebrow">모아와 걷는 7일</p><h2 id="living-week-title">7일의 길</h2><p>{prior ? '이전 7일의 풍경에 남겨둔 사실이에요.' : '오늘까지, 풍경마다 남겨둔 사실이에요.'}</p></div></header>
      {freshness === 'refreshing' || freshness === 'refresh-error' ? <p className="living-week-note">{freshness === 'refreshing' ? '새로고침 중' : '최신 여부 미확인'} · 마지막으로 불러온 기록이에요.</p> : null}
      <SevenDayTrail days={days} today={today} />
      <p className="living-week-note">서울 날짜 · 혈압은 관찰 건수, 챌린지는 체크인 상태예요. 혼합은 같은 날 기록함과 건너뜀이 함께 있는 경우예요. 이전 방식의 기록은 아래 목록에서 확인해요.</p>
    </section>
    <aside className="recap-landscape" aria-label="오늘의 풍경">
      <figure className="recap-view">
        {staticLandscape ? <StaticJourneyLandscape screen="S10" calendarDate={today} /> : <VisualStage screen="S10" calendarDate={today} />}
        <figcaption><span>모아와 잠깐, 오늘의 풍경</span><small>서울 {today} · 선택한 기록 기간과는 별개예요.</small></figcaption>
      </figure>
    </aside>
    <div className="recap-journal" data-main-section="seven-day-dashboard">
      <header className="recap-journal-intro">
        <p className="eyebrow">선택한 구간의 기록</p>
        <p>{freshness === 'refreshing' ? '새로고침 중 · 마지막으로 불러온 기록이에요.'
          : freshness === 'refresh-error' ? '최신 여부 미확인 · 마지막으로 불러온 기록이에요.'
          : '남겨둔 사실을 하나씩 펼쳐보세요.'}</p>
      </header>
      <div className="record-groups recap-record-groups" aria-label="최근 7일 기록 목록">{records}</div>
      <footer className="recap-tools">
        <p>{prior
          ? '이전 7일은 읽기 전용이에요. 파일 내보내기는 현재 7일에서 사용할 수 있어요.'
          : '선택한 7일의 기록을 파일로 보관할 수 있어요.'}</p>
        <div className="scene-actions utility-actions">{actions}</div>
      </footer>
    </div>
    <div className="recap-current-challenge">{challenge}</div>
  </>;
}
