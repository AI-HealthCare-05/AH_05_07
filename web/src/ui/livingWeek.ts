import { shiftDate } from '../lib/seoulDate';

export type TrailDay = {
  date: string;
  observationCount: number;
  participation: '기록함' | '건너뜀' | '기록 없음' | '혼합';
};

/** Calendar projection only. Legacy events and measurement values are not inputs. */
export function sevenDayFacts(
  endOn: string,
  observations: readonly { observed_on: string }[],
  checkins: readonly { observed_on: string; status: 'completed' | 'skipped' }[],
): TrailDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(endOn, index - 6);
    const statuses = new Set(checkins.filter(item => item.observed_on === date).map(item => item.status));
    return {
      date,
      observationCount: observations.filter(item => item.observed_on === date).length,
      participation: statuses.size === 2 ? '혼합' : statuses.has('completed') ? '기록함' : statuses.has('skipped') ? '건너뜀' : '기록 없음',
    };
  });
}
