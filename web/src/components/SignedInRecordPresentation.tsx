import type { ReactNode } from "react";
import type { BloodPressureObservation, ChallengeCheckin } from "../lib/api-contract";
import type { ScreenId } from "../ui/journey";
import { journeyCopy } from "../ui/journey";
import type { ExplorerSelection, RecordBrowseItem } from "../ui/recordExplorer";
import { RecordExplorer } from "./RecordExplorer";
import { Scene } from "./SceneShell";
import type { ExplorerReturnPoint } from "./useRecordExplorerMemory";

type RecordExplorerProps = {
  journey: boolean;
  readNavigationDisabled: boolean;
  windowNavigation: ReactNode;
  items: readonly RecordBrowseItem[];
  selection: ExplorerSelection;
  onSelect: (selection: ExplorerSelection) => void;
  onOpenRecord: (item: RecordBrowseItem, fallbackKey: string | null) => void;
  returnPoint: ExplorerReturnPoint | null;
  onRestored: () => void;
  dateLabel: (date: string) => string;
  periodLabel: (period: "morning" | "evening") => string;
  challengeLabel: (actionId: string) => string;
  checkinLabel: (status: "completed" | "skipped") => string;
  displayMeasurement: (record: BloodPressureObservation) => string;
  isReadOnly: (item: RecordBrowseItem) => boolean;
  onNavigate: (screen: ScreenId) => void;
};

/** S08 markup only. App owns window scope, filters, focus return and read-only policy. */
export function SignedInRecordExplorerPresentation({
  journey, readNavigationDisabled, windowNavigation,
  items, selection, onSelect, onOpenRecord, returnPoint, onRestored,
  dateLabel, periodLabel, challengeLabel, checkinLabel, displayMeasurement,
  isReadOnly, onNavigate,
}: RecordExplorerProps) {
      return <Scene id="S08" eyebrow="기록" title={journeyCopy.S08.title} tone="secondary" className={`record-explorer-scene surface${journey ? " journey-candidate journey-records" : ""}`}>
        {windowNavigation}
        <RecordExplorer
          items={items}
          selection={selection}
          onSelect={onSelect}
          onOpen={onOpenRecord}
          returnPoint={returnPoint}
          onRestored={onRestored}
          dateLabel={dateLabel}
          periodLabel={periodLabel}
          challengeLabel={challengeLabel}
          checkinLabel={checkinLabel}
          displayMeasurement={displayMeasurement}
          isReadOnly={isReadOnly}
        />
        <div className="scene-toolbar action-group">
          {journey ? (
            <div className="journey-continuation-actions journey-continuation-actions--compact" aria-label="기록 탐색 다음 행동">
              <button className="text-button" type="button" onClick={() => onNavigate("S02")} disabled={readNavigationDisabled}>오늘 화면으로 돌아가기</button>
              <button className="secondary" type="button" onClick={() => onNavigate("S10")} disabled={readNavigationDisabled}>최근 7일 돌아보기</button>
            </div>
          ) : (
            <button className="text-button" type="button" onClick={() => onNavigate("S02")}>오늘의 기록으로 돌아가기</button>
          )}
        </div>
      </Scene>;
}

type RecordDetailProps = {
  journey: boolean;
  selectedRecord: RecordBrowseItem | null | undefined;
  selectedRecordMissing: boolean;
  recordTypeLabel: string;
  readOnlyReason: string | null;
  returnToRecap: boolean;
  dashboardPeriodName: string;
  isPriorDashboard: boolean;
  startOn: string;
  endOn: string;
  dateLabel: (date: string) => string;
  periodLabel: (period: "morning" | "evening") => string;
  challengeLabel: (actionId: string) => string;
  checkinLabel: (status: "completed" | "skipped") => string;
  displayMeasurement: (record: BloodPressureObservation) => string;
  evidenceMode: boolean;
  editingChallengeCheckin: ChallengeCheckin | null;
  controlsDisabled: boolean;
  readNavigationDisabled: boolean;
  refreshing: boolean;
  onReturn: () => void;
  onUpdateCheckin: (status: "completed" | "skipped") => void;
  onCancelChallengeEdit: () => void;
  onEditRecord: (item: RecordBrowseItem) => void;
  onDeleteRecord: (item: RecordBrowseItem) => void;
  onRefresh: () => void;
};

/** S09 renders loaded fact(s). No session, mutation, history or data access. */
export function SignedInRecordDetailPresentation({
  journey, selectedRecord, selectedRecordMissing,
  recordTypeLabel, readOnlyReason, returnToRecap,
  dashboardPeriodName, isPriorDashboard, startOn, endOn,
  dateLabel, periodLabel, challengeLabel, checkinLabel, displayMeasurement,
  evidenceMode, editingChallengeCheckin, controlsDisabled,
  readNavigationDisabled, refreshing,
  onReturn, onUpdateCheckin, onCancelChallengeEdit,
  onEditRecord, onDeleteRecord, onRefresh,
}: RecordDetailProps) {
  return (
        <Scene id="S09" {...journeyCopy.S09} tone="secondary" className={`journey-record-detail surface${journey ? " journey-candidate" : ""}`}>
          <button
            className="text-button record-explorer-detail-return"
            type="button"
            onClick={onReturn}
            disabled={readNavigationDisabled}
          >
            {returnToRecap ? "7일 돌아보기로 돌아가기" : "목록으로 돌아가기"}
          </button>
          <div className="record-explorer-detail-context section-header">
            {selectedRecord && <p className="record-explorer-detail-selection">
              선택한 기록 · {dateLabel(selectedRecord.record.observed_on)}
              {selectedRecord.kind === "blood-pressure" ? ` · ${periodLabel(selectedRecord.record.period)}` : ""}
            </p>}
            <p className="record-explorer-detail-period">{dashboardPeriodName}{isPriorDashboard ? " · 읽기 전용" : ""} · {dateLabel(startOn)} ~ {dateLabel(endOn)}</p>
          </div>
          {selectedRecordMissing ? (
            <div className="record-detail-empty state-error status-notice" role="alert">
              <h2>현재 불러온 기간에서 선택한 기록을 찾을 수 없어요.</h2>
              <p>기간 변경이나 보관 기간, 새로 불러온 결과에 따라 이 화면에 포함되지 않을 수 있어요. 기록이 삭제됐다고 단정하지 않습니다.</p>
              <button className="secondary" type="button" onClick={onReturn}>현재 맥락으로 돌아가기</button>
            </div>
          ) : selectedRecord ? (
            <article className="record-detail" data-record-detail-kind={selectedRecord.kind}>
              <div className="record-detail-heading section-header">
                <div>
                  <p className="eyebrow">저장된 사실</p>
                  <h2>{recordTypeLabel}</h2>
                </div>
                <span className="record-detail-access" data-record-access={readOnlyReason ? "read-only" : "editable"}>{readOnlyReason ? "읽기 전용" : "수정 가능"}</span>
              </div>
              <dl className="record-detail-facts">
                <div className="record-detail-primary-value">
                  <dt>{selectedRecord.kind === "blood-pressure" ? "저장된 측정값" : "저장된 상태"}</dt>
                  <dd>{selectedRecord.kind === "blood-pressure" ? displayMeasurement(selectedRecord.record) : checkinLabel(selectedRecord.record.status)}</dd>
                </div>
                <div><dt>날짜</dt><dd>{dateLabel(selectedRecord.record.observed_on)}</dd></div>
                {selectedRecord.kind === "blood-pressure"
                  ? <div><dt>저장된 시간대</dt><dd>{periodLabel(selectedRecord.record.period)}</dd></div>
                  : <div><dt>챌린지 행동</dt><dd>{challengeLabel(selectedRecord.record.action_id)}</dd></div>}
              </dl>
              {readOnlyReason ? <div className="record-read-only status-notice" role="note"><strong>이 기록은 읽기 전용이에요.</strong><p>{readOnlyReason}</p></div> : !evidenceMode && editingChallengeCheckin ? (
                <section className="record-correction-panel confirmation status-notice" role="status" aria-labelledby="challenge-correction-title">
                  <div className="section-header">
                    <p className="eyebrow">저장된 상태 수정</p>
                    <h3 id="challenge-correction-title">참여 상태만 바로잡아요</h3>
                    <p>{dateLabel(editingChallengeCheckin.observed_on)} · {challengeLabel(editingChallengeCheckin.action_id)} 상태의 날짜와 행동은 그대로 두고 상태만 바꿉니다.</p>
                  </div>
                  <div className="record-correction-choices action-group" aria-label="챌린지 참여 상태">
                    <button type="button" aria-pressed={editingChallengeCheckin.status === "completed"} onClick={() => onUpdateCheckin("completed")} disabled={controlsDisabled}>기록함</button>
                    <button className="secondary" type="button" aria-pressed={editingChallengeCheckin.status === "skipped"} onClick={() => onUpdateCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button>
                    <button className="text-button" type="button" onClick={onCancelChallengeEdit} disabled={controlsDisabled}>수정 취소</button>
                  </div>
                  <small>이 변경은 챌린지 참여 사실만 수정하며 혈압 기록이나 건강 결과를 바꾸지 않아요.</small>
                </section>
              ) : !evidenceMode && (
                <section className="record-maintenance record-detail-primary-actions action-group" aria-label="기록 관리">
                  <div className="record-maintenance-heading">
                    <div><p className="eyebrow">기록 관리</p><strong>저장된 사실을 바로잡거나 삭제할 수 있어요.</strong></div>
                    <button className="secondary" type="button" aria-label="수정" disabled={controlsDisabled} onClick={() => onEditRecord(selectedRecord)}>이 기록 수정</button>
                  </div>
                  <div className="record-maintenance-delete">
                    <p>이 한 건을 계정 기록에서 영구히 삭제합니다.</p>
                    <button className="secondary danger record-delete-action" type="button" aria-label="삭제" disabled={controlsDisabled} onClick={() => onDeleteRecord(selectedRecord)}>이 기록 삭제</button>
                  </div>
                </section>
              )}
              <div className="inline-actions action-group record-detail-utility-actions">
                {!evidenceMode && <button className="text-button" type="button" onClick={onRefresh} disabled={refreshing || controlsDisabled}>새로고침</button>}
              </div>
            </article>
          ) : (
            <div className="record-detail-empty status-notice"><h2>선택한 기록이 없어요.</h2></div>
          )}
        </Scene>
  );
}
