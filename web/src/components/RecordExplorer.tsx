import { useEffect, useId, useRef } from "react";
import { exploreRecords, type RecordBrowseItem, type RecordExplorerFilter } from "../ui/recordExplorer";
import "./record-explorer.css";

type RecordExplorerProps = {
  items: RecordBrowseItem[];
  filter: RecordExplorerFilter;
  date: string | null;
  onFilterChange: (filter: RecordExplorerFilter) => void;
  onDateChange: (date: string | null) => void;
  onReset: () => void;
  onOpen: (item: RecordBrowseItem, button: HTMLButtonElement) => void;
  describe: (item: RecordBrowseItem) => { type: string; primary: string; secondary: string; availability: string };
  dateLabel: (date: string) => string;
  focusKey: string | null;
  scrollY: number | null;
};

const filters: { value: RecordExplorerFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "blood-pressure", label: "혈압" },
  { value: "challenge-checkin", label: "챌린지" },
  { value: "legacy", label: "이전 방식 기록" },
];

/** A utility view over the loaded window; the parent owns navigation and record access. */
export function RecordExplorer({ items, filter, date, onFilterChange, onDateChange, onReset, onOpen, describe, dateLabel, focusKey, scrollY }: RecordExplorerProps) {
  const result = exploreRecords(items, filter, date);
  const descriptionId = useId();
  const explorerRef = useRef<HTMLDivElement>(null);
  const recordButtons = useRef(new Map<string, HTMLButtonElement>());
  const allFilterRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const initialReturn = useRef({ focusKey, scrollY });
  const narrowed = filter !== "all" || date !== null;

  useEffect(() => {
    const context = initialReturn.current;
    if (context.focusKey === null && context.scrollY === null) return;
    // The shell focuses the new screen heading first. Restore the explorer's
    // own return context after that work, without repeating it on filter edits.
    const frame = window.requestAnimationFrame(() => {
      const target = (context.focusKey ? recordButtons.current.get(context.focusKey) : null)
        ?? resetRef.current ?? allFilterRef.current
        ?? explorerRef.current?.closest('[data-scene="S08"]')?.querySelector<HTMLHeadingElement>("h1");
      target?.focus({ preventScroll: true });
      if (context.scrollY !== null) window.scrollTo({ top: context.scrollY, behavior: "instant" });
      if (target) {
        const bounds = target.getBoundingClientRect();
        const bottomMargin = Number.parseFloat(window.getComputedStyle(target).scrollMarginBottom) || 0;
        if (bounds.top < 0 || bounds.bottom > window.innerHeight - bottomMargin) {
          target.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function resetFilters() {
    onReset();
    allFilterRef.current?.focus();
  }

  if (result.counts.all === 0) {
    return <div className="record-explorer" ref={explorerRef} data-record-explorer>
      <p className="record-explorer-empty" data-explorer-empty="window">이 기간에 남긴 기록이 없어요.</p>
    </div>;
  }

  return <div className="record-explorer" ref={explorerRef} data-record-explorer>
    <div className="record-explorer-tools">
      <fieldset className="record-explorer-filter-group">
        <legend>기록 종류</legend>
        <div className="record-explorer-options">
          {filters.map(option => <button
            className="record-explorer-filter"
            type="button"
            key={option.value}
            ref={option.value === "all" ? allFilterRef : undefined}
            aria-pressed={filter === option.value}
            onClick={() => onFilterChange(option.value)}
          >{option.label} <span>{result.counts[option.value]}개</span></button>)}
        </div>
      </fieldset>
      <fieldset className="record-explorer-filter-group">
        <legend>기록 날짜</legend>
        <div className="record-explorer-options record-explorer-dates">
          <button className="record-explorer-filter" type="button" aria-pressed={date === null} onClick={() => onDateChange(null)}>모든 날짜</button>
          {result.dates.map(recordDate => <button
            className="record-explorer-filter"
            type="button"
            key={recordDate}
            aria-label={dateLabel(recordDate)}
            aria-pressed={date === recordDate}
            onClick={() => onDateChange(recordDate)}
          ><time dateTime={recordDate}>{Number(recordDate.slice(5, 7))}/{Number(recordDate.slice(8, 10))}</time></button>)}
        </div>
      </fieldset>
    </div>

    <div className="record-explorer-summary">
      <p role="status" aria-live="polite" aria-atomic="true" data-explorer-count>
        {narrowed ? <>전체 {result.counts.all}개 중 <strong>{result.visibleCount}개 표시</strong></> : <strong>전체 {result.counts.all}개</strong>}
        <span>{date ? `${dateLabel(date)} · 최신 날짜순` : "최신 날짜순"}</span>
      </p>
      {narrowed && <button className="secondary record-explorer-reset" type="button" ref={resetRef} onClick={resetFilters}>전체 기록 보기</button>}
    </div>

    {result.visibleCount === 0 ? <p className="record-explorer-empty" data-explorer-empty="filter">이 기간에는 기록이 있지만 선택한 조건에 맞는 기록은 없어요. 전체 기록 보기로 조건을 해제해 주세요.</p>
      : <div className="record-explorer-groups">
        {result.groups.map((group, groupIndex) => <section className="record-explorer-date-group" key={group.date} aria-label={dateLabel(group.date)}>
          <div className="record-explorer-date-heading">
            <h2><time dateTime={group.date}>{dateLabel(group.date)}</time></h2>
            <span>{group.items.length}개</span>
          </div>
          <ul className="record-explorer-list" role="list">
            {group.items.map((item, itemIndex) => {
              const content = describe(item);
              const rowDescriptionId = `${descriptionId}-${groupIndex}-${itemIndex}`;
              return <li key={item.key} data-record-kind={item.kind} data-record-date={item.record.observed_on}>
                <button
                  className="record-explorer-row"
                  type="button"
                  ref={button => {
                    if (button) recordButtons.current.set(item.key, button);
                    else recordButtons.current.delete(item.key);
                  }}
                  aria-label={`상세 보기 · ${content.type} · ${dateLabel(item.record.observed_on)} · ${content.secondary}`}
                  aria-describedby={`${rowDescriptionId}-primary ${rowDescriptionId}-availability`}
                  onClick={event => onOpen(item, event.currentTarget)}
                >
                  <span className="record-explorer-facts">
                    <span className="record-explorer-type">{content.type}</span>
                    <strong className="record-explorer-primary" id={`${rowDescriptionId}-primary`}>{content.primary}</strong>
                    <span className="record-explorer-metadata"><span>{content.secondary}</span><span id={`${rowDescriptionId}-availability`}>{content.availability}</span></span>
                  </span>
                  <span className="record-explorer-open">상세 보기 <span aria-hidden="true">›</span></span>
                </button>
              </li>;
            })}
          </ul>
        </section>)}
      </div>}
  </div>;
}
