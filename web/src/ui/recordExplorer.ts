import type { BloodPressureObservation, ChallengeCheckin, ChallengeEvent } from "../lib/api";

export type RecordBrowseItem =
  | { key: string; kind: "blood-pressure"; record: BloodPressureObservation }
  | { key: string; kind: "challenge-checkin"; record: ChallengeCheckin }
  | { key: string; kind: "legacy"; record: ChallengeEvent };

export type RecordFilter = "all" | RecordBrowseItem["kind"];
export type ExplorerSelection = { filter: RecordFilter; date: string | null };

export const recordTypes = [
  { kind: "all", label: "전체" },
  { kind: "blood-pressure", label: "혈압" },
  { kind: "challenge-checkin", label: "챌린지" },
  { kind: "legacy", label: "이전 방식 기록" },
] as const;

/** Derive presentation from the loaded window, without changing its records. */
export function exploreRecords(items: readonly RecordBrowseItem[], selection: ExplorerSelection) {
  const counts = { all: items.length, "blood-pressure": 0, "challenge-checkin": 0, legacy: 0 };
  const dates = new Set<string>();
  const grouped = new Map<string, RecordBrowseItem[]>();
  for (const item of items) {
    counts[item.kind] += 1;
    const date = item.record.observed_on;
    dates.add(date);
    if (selection.filter !== "all" && selection.filter !== item.kind) continue;
    if (selection.date && selection.date !== date) continue;
    const group = grouped.get(date) ?? [];
    group.push(item);
    grouped.set(date, group);
  }
  // ISO Seoul calendar dates sort without browser timezone conversion. Within
  // a day, keep source order: a check-in has no measured time to compare to BP.
  const newestFirst = (left: string, right: string) => right.localeCompare(left);
  return {
    counts,
    dates: [...dates].sort(newestFirst),
    groups: [...grouped].sort(([left], [right]) => newestFirst(left, right)),
    visibleCount: [...grouped.values()].reduce((total, records) => total + records.length, 0),
  };
}
