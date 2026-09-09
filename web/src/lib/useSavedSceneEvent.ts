import { useEffect, useRef, useState } from "react";

import { createSavedSceneEvent, type SavedSceneEvent } from "../ui/savedScene";

/** The host creates this only after persistence and its request-generation check. */
export function useSavedSceneEvent() {
  const current = useRef<SavedSceneEvent | null>(null);
  const [event, setEvent] = useState<SavedSceneEvent | null>(null);

  useEffect(() => {
    if (import.meta.env.VITE_SK7_SCENE_MODE !== "review") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const interrupt = () => {
      if (document.visibilityState !== "visible" || media.matches) current.current?.skip();
    };
    const interruptMotion = (change: MediaQueryListEvent) => {
      if (change.matches) current.current?.skip();
    };
    document.addEventListener("visibilitychange", interrupt);
    media.addEventListener("change", interruptMotion);
    return () => {
      current.current?.skip();
      document.removeEventListener("visibilitychange", interrupt);
      media.removeEventListener("change", interruptMotion);
    };
  }, []);

  function clear() {
    current.current?.skip();
    current.current = null;
    setEvent(null);
  }

  function confirmPersistence() {
    if (import.meta.env.VITE_SK7_SCENE_MODE !== "review") return null;
    current.current?.skip();
    const next = createSavedSceneEvent();
    if (document.visibilityState !== "visible" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) next.skip();
    current.current = next;
    return next;
  }

  function present(next: SavedSceneEvent | null) {
    if (next && current.current === next) setEvent(next);
  }

  return { event, confirmPersistence, present, clear };
}
