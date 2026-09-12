import type { BloodPressureObservation, ChallengeCheckin, ChallengeEvent } from "../lib/api";

export type RecordBrowseItem =
  | { key: string; kind: "blood-pressure"; record: BloodPressureObservation }
  | { key: string; kind: "challenge-checkin"; record: ChallengeCheckin }
  | { key: string; kind: "legacy"; record: ChallengeEvent };

export type RecordExplorerFilter = "all" | RecordBrowseItem["kind"];

/** Presentation only: never mutates the loaded window or combines record facts. */
export function exploreRecords(items: RecordBrowseItem[], filter: RecordExplorerFilter, date: string | null) {
  const counts: Record<RecordExplorerFilter, number> = { all: items.length, "blood-pressure": 0, "challenge-checkin": 0, legacy: 0 };
  const dates = new Set<string>();
  const groups: { date: string; items: RecordBrowseItem[] }[] = [];
  let visibleCount = 0;

  // observed_on is an existing Seoul calendar date. Within a date keep source
  // order; a check-in status is not a timestamp or a ranking criterion.
  for (const item of [...items].sort((left, right) => right.record.observed_on.localeCompare(left.record.observed_on))) {
    counts[item.kind] += 1;
    dates.add(item.record.observed_on);
    if ((filter !== "all" && item.kind !== filter) || (date && item.record.observed_on !== date)) continue;
    let group = groups.at(-1);
    if (group?.date !== item.record.observed_on) {
      group = { date: item.record.observed_on, items: [] };
      groups.push(group);
    }
    group.items.push(item);
    visibleCount += 1;
  }
  return { counts, dates: [...dates], groups, visibleCount };
}
