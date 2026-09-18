import { useEffect, useId, useRef } from "react";
import { UiIcon } from "./UiIcon";
import { UiObject } from "./UiObject";
import type { BloodPressureObservation } from "../lib/api";
import { exploreRecords, recordTypes, type ExplorerSelection, type RecordBrowseItem } from "../ui/recordExplorer";
import type { ExplorerReturnPoint } from "./useRecordExplorerMemory";
import "./record-explorer.css";

type Props = {
  items: readonly RecordBrowseItem[];
  selection: ExplorerSelection;
  onSelect: (selection: ExplorerSelection) => void;
  onOpen: (item: RecordBrowseItem) => void;
  returnPoint: ExplorerReturnPoint | null;
  onRestored: () => void;
  dateLabel: (date: string) => string;
  periodLabel: (period: "morning" | "evening") => string;
  challengeLabel: (action: string) => string;
  checkinLabel: (status: "completed" | "skipped") => string;
  displayMeasurement: (record: BloodPressureObservation) => string;
  isReadOnly: (item: RecordBrowseItem) => boolean;
};

const detailTypes = {
  "blood-pressure": "혈압 관찰",
  "challenge-checkin": "챌린지 참여",
  legacy: "이전 방식의 기록",
};

export function RecordExplorer({ items, selection, onSelect, onOpen, returnPoint, onRestored, dateLabel, periodLabel, challengeLabel, checkinLabel, displayMeasurement, isReadOnly }: Props) {
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const allFilter = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  const { counts, dates, groups, visibleCount } = exploreRecords(items, selection);
  const selectionType = selection.filter === "all" ? "모든 기록" : detailTypes[selection.filter];
  const selectionDate = selection.date ? dateLabel(selection.date) : "모든 날짜";
  const hasActiveFilter = selection.filter !== "all" || selection.date !== null;
  const recordedDayCount = dates.length;
  const recordOverview = [
    `혈압 ${counts["blood-pressure"]}개`,
    `챌린지 ${counts["challenge-checkin"]}개`,
    `이전 방식 ${counts.legacy}개`,
  ].join(" · ");
  const resetSelection = () => {
    onSelect({ filter: "all", date: null });
    requestAnimationFrame(() => allFilter.current?.focus());
  };

  useEffect(() => {
    if (!returnPoint) return;
    // Scene focuses its heading first. Restore the actual opener afterwards,
    // cancelling navigate's smooth scroll without animating the return journey.
    const frame = requestAnimationFrame(() => {
      const row = rows.current.get(returnPoint.key);
      if (row) {
        window.scrollTo({ top: returnPoint.scrollY, behavior: "instant" });
        row.focus({ preventScroll: true });
        const bounds = row.getBoundingClientRect();
        if (bounds.top < 0 || bounds.bottom > window.innerHeight) row.scrollIntoView({ block: "center", behavior: "instant" });
      } else {
        document.getElementById("S08-title")?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      onRestored();
    });
    return () => cancelAnimationFrame(frame);
  }, [returnPoint, onRestored]);

  return <section className="record-explorer" aria-label="기록 탐색">
    {counts.all > 0 && <div className="record-explorer-overview" role="group" aria-label="이 7일 기록 구성">
      <div>
        <strong>기록이 있는 날 {recordedDayCount}일</strong>
        <span>총 {counts.all}개</span>
      </div>
      <p>{recordOverview}</p>
    </div>}
    <div className="record-explorer-tools">
      <fieldset className="record-explorer-filter">
        <legend>기록 종류</legend>
        <div className="record-explorer-buttons">
          {recordTypes.map(({ kind, label }) => <button key={kind} ref={kind === "all" ? allFilter : undefined} type="button" className="secondary" aria-pressed={selection.filter === kind} onClick={() => onSelect({ ...selection, filter: kind })}><UiIcon name="check" size={16} className="record-filter-check" />{label} {counts[kind]}개</button>)}
        </div>
      </fieldset>
      {dates.length > 0 && <fieldset className="record-explorer-filter">
        <legend>기록 날짜</legend>
        <div className="record-explorer-buttons">
          <button type="button" className="secondary" aria-pressed={selection.date === null} onClick={() => onSelect({ ...selection, date: null })}><UiIcon name="check" size={16} className="record-filter-check" />모든 날짜</button>
          {dates.map(date => <button key={date} type="button" className="secondary" aria-label={dateLabel(date)} aria-pressed={selection.date === date} onClick={() => onSelect({ ...selection, date })}><UiIcon name="check" size={16} className="record-filter-check" /><time dateTime={date}>{Number(date.slice(5, 7))}.{Number(date.slice(8))}</time></button>)}
        </div>
      </fieldset>}
    </div>
    <div className="record-explorer-summary">
      <div>
        <span role="status">전체 {counts.all}개 중 {visibleCount}개 표시</span>
        <span className="record-explorer-scope" data-record-filter-active={hasActiveFilter || undefined}>{selectionType} · {selectionDate}</span>
      </div>
      <div className="record-explorer-summary-actions">
        <span>최신 날짜순</span>
        {hasActiveFilter && <button type="button" className="text-button record-explorer-reset" onClick={resetSelection}>필터 초기화</button>}
      </div>
    </div>
    {groups.length > 0 ? <div className="record-explorer-groups">
      {groups.map(([date, records]) => <section className="record-explorer-day" key={date} aria-labelledby={`records-${date}`}>
        <h2 id={`records-${date}`}><time dateTime={date}>{dateLabel(date)}</time><span>{records.length}개</span></h2>
        <ul className="record-explorer-list">
          {records.map((item, index) => <li key={item.key} data-record-kind={item.kind} data-record-date={date}>
            <button type="button" className="secondary record-action record-explorer-row"
              ref={node => { if (node) rows.current.set(item.key, node); else rows.current.delete(item.key); }}
              aria-label={`상세 보기 · ${detailTypes[item.kind]} · ${dateLabel(date)}${item.kind === "blood-pressure" ? ` · ${periodLabel(item.record.period)}` : ""}`}
              aria-describedby={`${descriptionId}-${date}-${index}-facts ${descriptionId}-${date}-${index}-access`}
              onClick={() => onOpen(item)}>
              <span className="record-explorer-type">{recordTypes.find(type => type.kind === item.kind)?.label}</span>
              <span className="record-explorer-facts" id={`${descriptionId}-${date}-${index}-facts`}>
                <strong>{item.kind === "blood-pressure" ? displayMeasurement(item.record) : challengeLabel(item.record.action_id)}</strong>
                <span>{item.kind === "blood-pressure" ? periodLabel(item.record.period) : checkinLabel(item.record.status)}</span>
              </span>
              <span className="record-explorer-access" id={`${descriptionId}-${date}-${index}-access`}>{isReadOnly(item) ? "읽기 전용" : "수정 가능"}</span>
              <span className="record-explorer-open" aria-hidden="true">상세 보기 <UiIcon name="arrow-right" size={18} /></span>
            </button>
          </li>)}
        </ul>
      </section>)}
    </div> : <div className="record-explorer-empty">
      <UiObject name="notebook" className="record-explorer-empty-object" />
      <h2>{counts.all === 0 ? "이 7일에는 기록이 없어요." : "선택한 조건에 맞는 기록이 없어요."}</h2>
      {selection.date && !dates.includes(selection.date) && <p>선택한 날짜: {dateLabel(selection.date)}</p>}
      <p>{counts.all === 0 ? "다른 7일 구간을 선택하거나 오늘의 기록으로 돌아가 기록을 남겨 보세요." : "이 기간에는 기록이 있지만 선택한 종류나 날짜의 기록은 없어요."}</p>
      {counts.all > 0 && <button type="button" className="secondary" onClick={resetSelection}>전체 기록 보기</button>}
    </div>}
  </section>;
}
