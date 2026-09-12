import type { TrailDay } from './livingWeek';

/** Display-only counts of the supplied calendar window, independent of exports. */
export function summarizeTrailDays(days: readonly TrailDay[]) {
  return days.reduce((summary, day) => ({
    observationCount: summary.observationCount + day.observationCount,
    observationDateCount: summary.observationDateCount + Number(day.observationCount > 0),
    participationDateCount: summary.participationDateCount + Number(day.participation !== '기록 없음'),
    recordedDateCount: summary.recordedDateCount + Number(day.participation === '기록함'),
    skippedDateCount: summary.skippedDateCount + Number(day.participation === '건너뜀'),
    mixedDateCount: summary.mixedDateCount + Number(day.participation === '혼합'),
  }), {
    observationCount: 0,
    observationDateCount: 0,
    participationDateCount: 0,
    recordedDateCount: 0,
    skippedDateCount: 0,
    mixedDateCount: 0,
  });
}

/** The projection already supplies Seoul calendar dates; never parse in local time. */
export function formatTrailDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export function trailDayContext(day: TrailDay, today: string) {
  if (day.date > today) return '오늘 이후의 날짜예요. 날짜를 따라 풍경을 미리 살펴보세요.';
  if (day.participation === '혼합') return '같은 날짜에 기록함과 건너뜀이 함께 남아 있어요. 혈압 관찰은 별도로 표시해요.';
  if (day.observationCount > 0 && day.participation !== '기록 없음') return '이 날짜에 남긴 혈압 관찰과 챌린지 참여를 각각 펼쳐두었어요.';
  if (day.observationCount > 0) return '혈압 관찰이 남아 있어요. 이 날짜의 챌린지 참여 기록은 없어요.';
  if (day.participation !== '기록 없음') return '챌린지 참여가 남아 있어요. 이 날짜의 혈압 관찰 기록은 없어요.';
  return day.date === today
    ? '오늘은 아직 두 종류의 기록이 없어요. 남긴 사실은 이 풍경에 함께 표시돼요.'
    : '이 날짜에 남긴 혈압 관찰과 챌린지 참여 기록은 없어요. 풍경은 날짜를 따라 이어져요.';
}
