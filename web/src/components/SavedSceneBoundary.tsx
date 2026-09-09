import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { SavedSceneEvent } from "../ui/savedScene";

const SavedSceneRenderer = lazy(() => import("./scene/SavedSceneRenderer"));

class SavedSceneErrorBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** CSS checkmark, heading and CTAs remain outside this decorative boundary. */
export function SavedSceneBoundary({ event, reducedMotion }: { event: SavedSceneEvent; reducedMotion: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const rendered = useRef(false);
  const [failed, setFailed] = useState(event.failed);
  const fail = useCallback(() => {
    event.skip();
    event.failed = true;
    setFailed(true);
  }, [event]);
  const onReady = useCallback(() => { rendered.current = true; setReady(true); }, []);

  useEffect(() => {
    const element = host.current;
    if (!element || typeof IntersectionObserver === "undefined") { fail(); return; }
    let intersecting = false;
    const update = () => {
      const next = intersecting && document.visibilityState === "visible";
      if (!next) event.skip();
      setVisible(next);
      if (next) setActive(true);
    };
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      event.skip();
      if (!rendered.current) event.failed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [event, fail]);

  useEffect(() => {
    if (!active || ready || failed) return;
    const timeout = window.setTimeout(fail, 12_000);
    return () => window.clearTimeout(timeout);
  }, [active, ready, failed, fail]);

  return <div ref={host} className="companion-runtime-slot" aria-hidden="true" data-saved-scene-status={failed ? "fallback" : ready ? "ready" : "loading"}>
    {active && !failed && <SavedSceneErrorBoundary onFailure={fail}>
      <Suspense fallback={null}>
        <SavedSceneRenderer event={event} reducedMotion={reducedMotion} visible={visible} onReady={onReady} onFailure={fail} />
      </Suspense>
    </SavedSceneErrorBoundary>}
  </div>;
}
