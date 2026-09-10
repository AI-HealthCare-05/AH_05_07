const seoulDateFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});

export function seoulDate(now = new Date()): string {
  const parts = seoulDateFormatter.formatToParts(now)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Calendar arithmetic must not depend on the browser's timezone or DST. */
export function shiftDate(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
