import type { ReactNode, RefObject } from "react";
import type { ActiveChallenge, BloodPressureObservation, ChallengeCheckin } from "../lib/api-contract";
import type { CompanionSpecies } from "../ui/companion";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { journeyCopy } from "../ui/journey";
import type { TrailDay } from "../ui/livingWeek";
import type { RecordBrowseItem } from "../ui/recordExplorer";
import { JourneyRecap } from "./JourneyRecap";
import { Scene } from "./SceneShell";
import { VisualStage } from "./VisualStage";

type RecapFreshness = "loading" | "ready" | "refreshing" | "error" | "refresh-error";

type SignedInRecapPresentationProps = {
  journey: boolean;
  staticLandscape: boolean;
  companionSpecies: CompanionSpecies | null;
  companionAsset: CompanionAsset | null;
  productionSceneEnabled: boolean;
  today: string;
  days: readonly TrailDay[];
  startOn: string;
  endOn: string;
  isCycleReview: boolean;
  isPriorDashboard: boolean;
  windowState: RecapFreshness;
  selectedDate: string | null;
  onSelectedDateChange: (date: string | null) => void;
  activeChallenge: ActiveChallenge | null;
  activeChallengeEnded: boolean;
  activeChallengeCheckins: readonly ChallengeCheckin[];
  recordBrowseItems: readonly RecordBrowseItem[];
  observationCount: number;
  checkinCount: number;
  legacyCount: number;
  dashboardPeriodName: string;
  navigation: ReactNode;
  endedCyclePanel: ReactNode;
  feedbackSlot: ReactNode;
  evidenceMode: boolean;
  readNavigationDisabled: boolean;
  controlsDisabled: boolean;
  reportAvailable: boolean;
  reportTriggerRef: RefObject<HTMLButtonElement | null>;
  exportPending: boolean;
  dateLabel: (date: string) => string;
  periodLabel: (period: "morning" | "evening") => string;
  challengeLabel: (id: string) => string;
  checkinLabel: (status: "completed" | "skipped") => string;
  displayMeasurement: (record: BloodPressureObservation) => string;
  onOpenRecord: (item: RecordBrowseItem) => void;
  onOpenReport: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onBackToday: () => void;
};

/** Presentation only. App retains period, record, session and mutation authority. */
export function SignedInRecapPresentation({
  journey, staticLandscape, companionSpecies, companionAsset,
  productionSceneEnabled, today, days, startOn, endOn, isCycleReview,
  isPriorDashboard, windowState, selectedDate, onSelectedDateChange,
  activeChallenge, activeChallengeEnded, activeChallengeCheckins,
  recordBrowseItems, observationCount, checkinCount, legacyCount,
  dashboardPeriodName, navigation, endedCyclePanel, feedbackSlot,
  evidenceMode, readNavigationDisabled, controlsDisabled,
  reportAvailable, reportTriggerRef, exportPending, dateLabel, periodLabel,
  challengeLabel, checkinLabel, displayMeasurement, onOpenRecord,
  onOpenReport, onExport, onRefresh, onBackToday,
}: SignedInRecapPresentationProps) {
  function renderReportAction() {
    if (evidenceMode) return null;
    return <div className="living-week-report-action">
      <button ref={reportTriggerRef} type="button" className="secondary" disabled={!reportAvailable || readNavigationDisabled} aria-describedby="living-week-report-scope" onClick={onOpenReport}>7일 리포트 보기</button>
      <small id="living-week-report-scope">{isCycleReview ? "종료된 7일 전체를 정리해요." : isPriorDashboard
        ? "리포트는 현재 7일에서 볼 수 있어요. 현재 7일 보기로 돌아가 주세요."
        : !reportAvailable ? "현재 7일의 기록을 불러온 뒤 리포트를 볼 수 있어요."
        : "펼쳐 본 날짜와 관계없이 현재 7일 전체를 정리해요."}</small>
    </div>;
  }

  function renderRecordLane(kind: RecordBrowseItem["kind"], title: string, emptyText: string, journal = false, recordReading = false, focusedDate: string | null = null) {
    const items = recordBrowseItems.filter((item) => item.kind === kind && (!focusedDate || item.record.observed_on === focusedDate));
    return (
      <section className="record-lane" data-record-lane={kind === "challenge-checkin" ? "challenge" : kind}>
        {journal ? <>
          <div className="recap-lane-heading"><h3>{title}</h3><span data-dashboard-lane={kind === "challenge-checkin" ? "challenge" : kind}><strong>{items.length}</strong>개 기록</span></div>
          <p className="recap-lane-note">{kind === "blood-pressure" ? "직접 남긴 측정값 · 날짜와 시간대별" : kind === "challenge-checkin" ? "기록함과 건너뜀을 구분해요. 체크인 수는 달성일이 아니에요." : "이전 방식으로 남긴 기록 · 읽기 전용"}</p>
        </> : recordReading ? <>
          <div className="journey-record-lane-heading"><div><p className="eyebrow">{kind === "blood-pressure" ? "측정값" : kind === "challenge-checkin" ? "체크인" : "읽기 전용"}</p><h2>{title}</h2></div><span>{items.length}개</span></div>
          <p className="journey-record-lane-note">{kind === "blood-pressure" ? "날짜와 시간대별로 남긴 측정값이에요." : kind === "challenge-checkin" ? "행동과 기록함·건너뜀 상태를 따로 확인해요." : "이전 방식으로 남긴 기록은 수정하거나 삭제할 수 없어요."}</p>
        </> : <h2>{title}</h2>}
        <ul className={`record-list${recordReading ? " journey-record-list" : ""}`}>
          {items.length ? items.map((item) => (
            <li key={item.key} data-record-date={item.record.observed_on}>
              {journal ? <span className="recap-record-facts">
                <span className="recap-record-date"><strong><time dateTime={item.record.observed_on}>{dateLabel(item.record.observed_on)}</time></strong>{item.kind === "blood-pressure" && <small>{periodLabel(item.record.period)}</small>}</span>
                {item.kind === "blood-pressure" ? <span className="recap-record-value">{displayMeasurement(item.record)}</span> : <>
                  <span className="recap-record-value">{challengeLabel(item.record.action_id)}</span>
                  <span className="recap-record-status" data-checkin-status={item.record.status}>{checkinLabel(item.record.status)}{item.kind === "legacy" ? " · 이전 기록 · 읽기 전용" : ""}</span>
                </>}
              </span> : recordReading ? <span className="journey-record-facts">
                <span className="journey-record-date"><time dateTime={item.record.observed_on}>{dateLabel(item.record.observed_on)}</time>{item.kind === "blood-pressure" && <small>{periodLabel(item.record.period)}</small>}</span>
                {item.kind === "blood-pressure" ? <strong>{displayMeasurement(item.record)}</strong> : <><strong>{challengeLabel(item.record.action_id)}</strong><span className="journey-record-status">{checkinLabel(item.record.status)}{item.kind === "legacy" ? " · 읽기 전용" : ""}</span></>}
              </span> : <span>
                <strong>{dateLabel(item.record.observed_on)}</strong>
                {item.kind === "blood-pressure"
                  ? ` · ${periodLabel(item.record.period)} · ${displayMeasurement(item.record)}`
                  : ` · ${challengeLabel(item.record.action_id)} · ${checkinLabel(item.record.status)}${item.kind === "legacy" ? " · 이전 기록" : ""}`}
              </span>}
              <button className="secondary record-action" type="button" aria-label={`상세 보기 · ${title} · ${dateLabel(item.record.observed_on)}${item.kind === "blood-pressure" ? ` · ${periodLabel(item.record.period)}` : ""}`} onClick={() => onOpenRecord(item)}>상세 보기</button>
            </li>
          )) : <li className="empty-record">{focusedDate ? `${dateLabel(focusedDate)}에 남긴 ${title} 기록이 없어요.` : emptyText}</li>}
        </ul>
      </section>
    );
  }

      if (journey) return <Scene id="S10" eyebrow="최근 기록" title="7일 돌아보기" tone="emphasis" className="journey-recap">
        {endedCyclePanel}
        <JourneyRecap key={endOn} staticLandscape={staticLandscape && !productionSceneEnabled} companionSpecies={companionSpecies} companionAsset={companionAsset} productionSceneEnabled={productionSceneEnabled} today={today} days={days} year={startOn.slice(0, 4) === endOn.slice(0, 4) ? startOn.slice(0, 4) : `${startOn.slice(0, 4)}–${endOn.slice(0, 4)}`} period={isCycleReview ? "completed-cycle" : isPriorDashboard ? "prior" : "current"} freshness={windowState} selectedDate={selectedDate} onSelectedDateChange={onSelectedDateChange}
          navigation={navigation}
          records={focusedDate => <>
            {renderRecordLane("blood-pressure", "혈압 관찰", "이 구간에 혈압 관찰 기록이 없습니다.", true, false, focusedDate)}
            {renderRecordLane("challenge-checkin", "챌린지 체크인", "이 구간에 챌린지 체크인 기록이 없습니다.", true, false, focusedDate)}
            {renderRecordLane("legacy", "이전 방식의 기록", "이 구간에 이전 방식의 기록이 없습니다.", true, false, focusedDate)}
          </>}
          challenge={<section className="challenge-progress-card" data-challenge-progress aria-labelledby="challenge-progress-title">
            <p className="eyebrow">선택 기능 · 현재 챌린지</p>
            {activeChallenge && !activeChallengeEnded ? <>
              <h2 id="challenge-progress-title">7일 챌린지 · {challengeLabel(activeChallenge.action_id)}</h2>
              <p>챌린지 기간<br /><time dateTime={activeChallenge.starts_on}>{activeChallenge.starts_on}</time> ~ <time dateTime={activeChallenge.ends_on}>{activeChallenge.ends_on}</time></p>
              <strong>선택한 구간 안의 체크인 기록 {activeChallengeCheckins.length}개</strong>
              <small>'기록함'·'건너뜀' 모두 체크인이며 혈압 기록이나 누적 성과와 합치지 않아요.</small>
            </> : <h2 id="challenge-progress-title">진행 중인 7일 챌린지 없음</h2>}
          </section>}
          actions={<>
            {renderReportAction()}
            {!evidenceMode && <button type="button" onClick={() => void onExport()} disabled={controlsDisabled}>{exportPending ? "내보내는 중" : `${dashboardPeriodName} 내보내기`}</button>}
            <button className="secondary" type="button" onClick={() => void onRefresh()} disabled={windowState === "refreshing" || controlsDisabled}>{windowState === "refreshing" ? "새로고침 중" : "새로고침"}</button>
          </>}
        />
        {feedbackSlot}
        <div className="journey-recap-return" aria-label="7일 돌아보기 마무리">
          <button className="text-button" type="button" onClick={() => onBackToday()} disabled={readNavigationDisabled}>오늘 화면으로 돌아가기</button>
        </div>
      </Scene>;
      return <Scene id="S10" {...journeyCopy.S10} tone="emphasis">{endedCyclePanel}{feedbackSlot}<div className="recap-period">{navigation}</div><div className="recap-summary" data-main-section="seven-day-dashboard" aria-label="최근 7일 기록 요약"><div data-dashboard-lane="blood-pressure"><span>혈압 관찰</span><strong>{observationCount}</strong><small>기록</small></div><div data-dashboard-lane="challenge"><span>최근 7일 챌린지 체크인 기록</span><strong>{checkinCount}</strong><small>기록</small></div><div data-dashboard-lane="legacy"><span>이전 방식의 기록</span><strong>{legacyCount}</strong><small>읽기 전용</small></div></div><section className="challenge-progress-card" data-challenge-progress aria-labelledby="challenge-progress-title"><p className="eyebrow">챌린지 진행</p>{activeChallenge && !activeChallengeEnded ? <><h2 id="challenge-progress-title">7일 챌린지 · {challengeLabel(activeChallenge.action_id)}</h2><p>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</p><strong>체크인 기록 {activeChallengeCheckins.length}개</strong></> : <><h2 id="challenge-progress-title">진행 중인 7일 챌린지 없음</h2><p>최근 7일 기록과는 별도로 표시합니다.</p></>}</section><VisualStage screen="S10" calendarDate={today} companionSpecies={companionSpecies} companionAsset={companionAsset} productionS10Enabled={productionSceneEnabled} /><div className="record-groups recap-record-groups" aria-label="최근 7일 기록 목록">{renderRecordLane("blood-pressure", "혈압 관찰", "아직 혈압 관찰 기록이 없습니다.")}{renderRecordLane("challenge-checkin", "챌린지 참여", "아직 챌린지 참여 기록이 없습니다.")}{renderRecordLane("legacy", "이전 방식의 기록", "이전 방식의 기록이 없습니다.")}</div><div className="scene-actions utility-actions">{renderReportAction()}{!evidenceMode && <button type="button" onClick={() => void onExport()} disabled={controlsDisabled}>{exportPending ? "내보내는 중" : `${dashboardPeriodName} 내보내기`}</button>}<button className="secondary" type="button" onClick={() => void onRefresh()} disabled={windowState === "refreshing" || controlsDisabled}>{windowState === "refreshing" ? "새로고침 중" : "새로고침"}</button></div></Scene>;
}
