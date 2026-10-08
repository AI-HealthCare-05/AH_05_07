import type { FormEventHandler, RefObject } from "react";
import type { BloodPressureObservation } from "../lib/api";
import { journeyCopy } from "../ui/journey";
import { BloodPressureDraftNote } from "./BloodPressureDraftNote";
import { DailyActionLoop } from "./DailyActionLoop";
import { Scene } from "./SceneShell";
import type { BloodPressureDraft } from "./useNewBloodPressureDraft";

const measurementControlStyle = { fontSize: "max(1rem, 16px)" };

type BloodPressureField = "observed-on" | "systolic" | "diastolic";
type BloodPressureValidation = { field: BloodPressureField; message: string } | null;

type SignedInBloodPressurePresentationProps = {
  journey: boolean;
  today: string;
  firstSession: boolean;
  editingBloodPressureId: string | null;
  editingBloodPressureRecord: BloodPressureObservation | null;
  draft: BloodPressureDraft;
  error: BloodPressureValidation;
  controlsDisabled: boolean;
  saving: boolean;
  restoredDraft: boolean;
  meaningfulDraft: boolean;
  observedOnRef: RefObject<HTMLInputElement | null>;
  systolicRef: RefObject<HTMLInputElement | null>;
  diastolicRef: RefObject<HTMLInputElement | null>;
  dateLabel: (date: string) => string;
  periodLabel: (period: "morning" | "evening") => string;
  displayMeasurement: (record: BloodPressureObservation) => string;
  onDraftChange: (patch: Partial<BloodPressureDraft>) => void;
  onClearDraft: () => void;
  onCancelEdit: () => void;
  onReturnToday: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function SignedInBloodPressurePresentation({
  journey, today, firstSession, editingBloodPressureId,
  editingBloodPressureRecord, draft, error, controlsDisabled, saving,
  restoredDraft, meaningfulDraft, observedOnRef, systolicRef, diastolicRef,
  dateLabel, periodLabel, displayMeasurement, onDraftChange, onClearDraft,
  onCancelEdit, onReturnToday, onSubmit,
}: SignedInBloodPressurePresentationProps) {
  return (
    <Scene
      id="S04"
      eyebrow={editingBloodPressureId ? "저장된 기록 정정" : journeyCopy.S04.eyebrow}
      title={editingBloodPressureId ? "혈압 기록을 바로잡아요" : journeyCopy.S04.title}
      body={editingBloodPressureId
        ? "기존 관찰 한 건의 저장값을 고칩니다. 새 측정 기록을 하나 더 만드는 과정이 아니에요."
        : journeyCopy.S04.body}
      tone="emphasis"
      className={journey ? `journey-candidate journey-entry journey-sheet surface${editingBloodPressureId ? " journey-correction" : ""}` : ""}
    >
      {journey && !editingBloodPressureId && <DailyActionLoop current="S04" firstSession={firstSession} />}
      {editingBloodPressureId && editingBloodPressureRecord && <section className="correction-identity" aria-labelledby="correction-identity-title">
        <div>
          <p className="eyebrow">현재 수정 중인 기록</p>
          <h2 id="correction-identity-title">{dateLabel(editingBloodPressureRecord.observed_on)} · {periodLabel(editingBloodPressureRecord.period)}</h2>
        </div>
        <strong>{displayMeasurement(editingBloodPressureRecord)}</strong>
        <p>저장하면 새 측정 기록을 만들지 않고 이 기록 한 건의 값만 바꿔요.</p>
      </section>}
      <form className="measurement-panel" onSubmit={onSubmit} noValidate>
        <div className="bp-sheet-fields">
          <div className="bp-sheet-context">
            <label htmlFor="observed-on">
              <span className="bp-sheet-field-label">날짜</span>
              <input
                ref={observedOnRef}
                id="observed-on"
                style={measurementControlStyle}
                type="date"
                aria-invalid={error?.field === "observed-on"}
                aria-describedby={error?.field === "observed-on"
                  ? "blood-pressure-error"
                  : !editingBloodPressureId && draft.observedOn && draft.observedOn !== today
                    ? "bp-draft-date-help"
                    : undefined}
                value={draft.observedOn}
                onChange={(event) => onDraftChange({ observedOn: event.target.value })}
                required
                disabled={controlsDisabled}
              />
            </label>
            <label htmlFor="period">
              <span className="bp-sheet-field-label">시간대</span>
              <select
                id="period"
                style={measurementControlStyle}
                value={draft.period}
                onChange={(event) => onDraftChange({ period: event.target.value as BloodPressureDraft["period"] })}
                disabled={controlsDisabled}
              >
                <option value="morning">아침 · 기상 후 1시간 이내</option>
                <option value="evening">저녁 · 취침 전</option>
              </select>
            </label>
          </div>
          <div className="bp-measurement-pair">
            <label htmlFor="systolic" className="bp-measurement bp-measurement-systolic">
              <span className="bp-measurement-label">수축기</span>
              <input
                ref={systolicRef}
                id="systolic"
                style={measurementControlStyle}
                type="number"
                min="60"
                max="260"
                inputMode="numeric"
                value={draft.systolic}
                onChange={(event) => onDraftChange({ systolic: event.target.value })}
                aria-invalid={error?.field === "systolic"}
                aria-describedby={error?.field === "systolic" ? "blood-pressure-error" : undefined}
                required
                disabled={controlsDisabled}
              />
              <span className="unit">mmHg</span>
            </label>
            <span className="bp-measurement-separator" aria-hidden="true">/</span>
            <label htmlFor="diastolic" className="bp-measurement bp-measurement-diastolic">
              <span className="bp-measurement-label">이완기</span>
              <input
                ref={diastolicRef}
                id="diastolic"
                style={measurementControlStyle}
                type="number"
                min="30"
                max="160"
                inputMode="numeric"
                value={draft.diastolic}
                onChange={(event) => onDraftChange({ diastolic: event.target.value })}
                aria-invalid={error?.field === "diastolic"}
                aria-describedby={error?.field === "diastolic" ? "blood-pressure-error" : undefined}
                required
                disabled={controlsDisabled}
              />
              <span className="unit">mmHg</span>
            </label>
          </div>
        </div>
        {error && <p id="blood-pressure-error" className="field-error status-notice" role="alert">{error.message}</p>}
        <div className="form-actions action-group">
          <button type="submit" disabled={controlsDisabled}>{saving ? "저장 중" : editingBloodPressureId ? "변경 저장" : "혈압 기록 저장"}</button>
          {editingBloodPressureId && <button className="secondary" type="button" onClick={onCancelEdit} disabled={controlsDisabled}>수정 취소</button>}
        </div>
        <div className="bp-sheet-secondary">
          {!editingBloodPressureId && <BloodPressureDraftNote restored={restoredDraft} observedOn={draft.observedOn} today={today} />}
          <details className="measurement-guide section-header">
            <summary>측정 전 확인하기</summary>
            <ul>
              <li>조용히 앉아 몸과 호흡을 편하게 해요.</li>
              <li>등과 팔을 지지하고 측정 중에는 말하지 않아요.</li>
              <li>이 안내는 기록 조건을 돕기 위한 참고이며 저장되지 않아요.</li>
            </ul>
          </details>
          {!editingBloodPressureId && meaningfulDraft && (
            <details className="bp-draft-reset">
              <summary>새로 입력하기</summary>
              <p>입력한 날짜·시간대·혈압 값을 지우고 오늘 날짜로 시작해요. 저장된 기록에는 영향을 주지 않아요.</p>
              <button
                className="secondary"
                type="button"
                disabled={controlsDisabled}
                onClick={(event) => {
                  const dateField = event.currentTarget.form?.elements.namedItem("observed-on");
                  onClearDraft();
                  if (dateField instanceof HTMLInputElement) dateField.focus();
                }}
              >
                초안 지우기
              </button>
            </details>
          )}
        </div>
      </form>
      {journey && <button type="button" className="text-button journey-back" onClick={editingBloodPressureId ? onCancelEdit : onReturnToday} disabled={controlsDisabled}>← {editingBloodPressureId ? "기록 상세로 돌아가기" : "오늘 화면으로 돌아가기"}</button>}
    </Scene>
  );
}
