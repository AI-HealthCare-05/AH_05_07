import { useEffect, useState } from "react";

import { seoulDate, shiftDate } from "./seoulDate";

/** One presentation snapshot for semantic HTML, window bounds and the scene. */
export function useSeoulDate(fixedDate?: string): string {
  const [today, setToday] = useState(() => fixedDate ?? seoulDate());

  useEffect(() => {
    // Evidence fixtures remain deterministic and do not install a live clock.
    if (fixedDate) return;
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      const now = new Date();
      const nextDate = seoulDate(now);
      setToday(nextDate);
      const midnight = Date.parse(`${shiftDate(nextDate, 1)}T00:00:00+09:00`);
      timer = window.setTimeout(update, Math.max(1, midnight - now.getTime()));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    update();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", update);
    };
  }, [fixedDate]);

  return fixedDate ?? today;
}
