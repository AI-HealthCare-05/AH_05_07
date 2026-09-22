import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  usePresenceSceneActorRuntime,
  usePresenceSceneActorRuntimeSnapshot,
} from "../platform/presence/PresenceSceneActorRuntimeContext";
import type { PresencePointerToken } from "../platform/presence/presenceSceneActorRuntime";

const statusText = {
  unavailable: "동반자 위치 조정을 사용할 수 없어요.",
  ready: "동반자 위치를 바꿀 수 있어요.",
  dragging: "동반자 위치를 조정하고 있어요.",
  committed: "동반자 위치를 바꿨어요.",
  corrected: "동반자를 가장 가까운 안전한 위치에 놓았어요.",
  restored: "동반자를 이전 안전한 위치로 되돌렸어요.",
  "no-space": "놓을 수 있는 공간이 없어 이전 위치를 유지해요.",
} as const;

/** Semantic sibling of the aria-hidden scene runtime; it never owns WebGL. */
export function PresenceSceneActorInteraction() {
  const runtime = usePresenceSceneActorRuntime();
  const snapshot = usePresenceSceneActorRuntimeSnapshot();
  const targetRef = useRef<HTMLButtonElement>(null);
  const pointerRef = useRef<PresencePointerToken | null>(null);

  const releaseCapture = useCallback((token: PresencePointerToken) => {
    const target = targetRef.current;
    pointerRef.current = null;
    if (target?.hasPointerCapture(token.pointerId)) {
      target.releasePointerCapture(token.pointerId);
    }
  }, []);

  useEffect(() => {
    const token = pointerRef.current;
    if (!token || snapshot.activePointerToken === token.token) return;
    releaseCapture(token);
  }, [releaseCapture, snapshot.activePointerToken]);

  useEffect(() => {
    if (!snapshot.activePointerToken) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const token = pointerRef.current;
      if (!token) return;
      event.preventDefault();
      runtime.cancelPointer(token, "escape");
      releaseCapture(token);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [releaseCapture, runtime, snapshot.activePointerToken]);

  const projection = snapshot.projection;
  if (!snapshot.enabled || !projection) return null;

  const hitStyle = {
    left: `${projection.hitRect.x - projection.stage.x}px`,
    top: `${projection.hitRect.y - projection.stage.y}px`,
    width: `${projection.hitRect.width}px`,
    height: `${projection.hitRect.height}px`,
  } satisfies CSSProperties;

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    const token = runtime.beginPointer({
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      button: event.button,
      isPrimary: event.isPrimary,
    });
    if (!token) return;
    event.preventDefault();
    pointerRef.current = token;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      runtime.cancelPointer(token, "pointer-cancel");
      pointerRef.current = null;
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const token = pointerRef.current;
    if (!token || token.pointerId !== event.pointerId) return;
    event.preventDefault();
    runtime.movePointer(token, { clientX: event.clientX, clientY: event.clientY });
  }

  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const token = pointerRef.current;
    if (!token || token.pointerId !== event.pointerId) return;
    event.preventDefault();
    runtime.endPointer(token, { clientX: event.clientX, clientY: event.clientY });
    releaseCapture(token);
  }

  function pointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    const token = pointerRef.current;
    if (!token || token.pointerId !== event.pointerId) return;
    runtime.cancelPointer(token, "pointer-cancel");
    releaseCapture(token);
  }

  function lostPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    const token = pointerRef.current;
    if (!token || token.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    runtime.cancelPointer(token, "lost-pointer-capture");
  }

  return (
    <div
      className="presence-scene-actor-layer"
      data-presence-scene-actor-interaction="S02"
      data-presence-spatial-status={snapshot.status}
      data-presence-port-incarnation={snapshot.portIncarnation}
      data-presence-write-count={snapshot.writeCount}
      data-presence-commit-count={snapshot.commitCount}
      data-presence-correction-distance={snapshot.lastCorrectionDistance.toFixed(3)}
      data-presence-root-x={projection.root.x.toFixed(3)}
      data-presence-root-y={projection.root.y.toFixed(3)}
    >
      <button
        ref={targetRef}
        type="button"
        className="presence-scene-actor-hit-target"
        style={hitStyle}
        aria-label="동반자 움직이기"
        aria-describedby="presence-scene-actor-status"
        data-presence-actor-hit-target="true"
        data-pointer-dragging={snapshot.dragging || undefined}
        data-active-pointer-id={snapshot.activePointerId ?? undefined}
        onClick={event => event.preventDefault()}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onLostPointerCapture={lostPointerCapture}
      />
      <div className="presence-scene-actor-controls" data-presence-hard-zone="position-control">
        <button
          type="button"
          className="presence-scene-actor-cycle"
          aria-label="동반자 위치 바꾸기"
          onClick={() => runtime.cycleSafePreset()}
        >
          동반자 위치 바꾸기
        </button>
        <span
          id="presence-scene-actor-status"
          className="presence-scene-actor-status"
          role="status"
          aria-live="polite"
        >
          {statusText[snapshot.status]}
        </span>
      </div>
    </div>
  );
}
