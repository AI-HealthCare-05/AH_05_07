import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  usePresenceSceneActorRuntime,
  usePresenceSceneActorRuntimeSnapshot,
} from "../platform/presence/PresenceSceneActorRuntimeContext";
import type {
  PresencePointerToken,
  PresenceTactilePointerToken,
} from "../platform/presence/presenceSceneActorRuntime";

type CapturedPointerToken = PresencePointerToken | PresenceTactilePointerToken;

const statusText = {
  unavailable: "동반자 위치 조정을 사용할 수 없어요.",
  ready: "동반자 위치를 바꿀 수 있어요.",
  dragging: "동반자 위치를 조정하고 있어요.",
  committed: "동반자 위치를 바꿨어요.",
  corrected: "동반자를 가장 가까운 안전한 위치에 놓았어요.",
  restored: "동반자를 이전 안전한 위치로 되돌렸어요.",
  "no-space": "놓을 수 있는 공간이 없어 이전 위치를 유지해요.",
} as const;

type PresenceSceneActorInteractionProps = Readonly<{
  phase: "loading" | "ready" | "failed";
}>;

/** Semantic sibling of the aria-hidden scene runtime; it never owns WebGL. */
export function PresenceSceneActorInteraction({ phase }: PresenceSceneActorInteractionProps) {
  const runtime = usePresenceSceneActorRuntime();
  const snapshot = usePresenceSceneActorRuntimeSnapshot();
  const targetRef = useRef<HTMLButtonElement>(null);
  const pointerRef = useRef<PresencePointerToken | null>(null);
  const tactilePointerRef = useRef<PresenceTactilePointerToken | null>(null);
  const [tactileMode, setTactileMode] = useState(false);
  const settleRef = useRef<HTMLSpanElement>(null);
  const settledCommitCountRef = useRef(snapshot.commitCount);

  const releaseCapture = useCallback((token: CapturedPointerToken) => {
    const target = targetRef.current;
    pointerRef.current = null;
    if (target?.hasPointerCapture(token.pointerId)) {
      target.releasePointerCapture(token.pointerId);
    }
  }, []);

  useEffect(() => {
    const token = pointerRef.current;
    if (token && snapshot.activePointerToken !== token.token) releaseCapture(token);

    const tactile = tactilePointerRef.current;
    if (tactile && snapshot.activeTactilePointerToken !== tactile.token) {
      tactilePointerRef.current = null;
      releaseCapture(tactile);
    }
  }, [
    releaseCapture,
    snapshot.activePointerToken,
    snapshot.activeTactilePointerToken,
  ]);

  useEffect(() => {
    if (!snapshot.activePointerToken && !snapshot.activeTactilePointerToken) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const tactile = tactilePointerRef.current;
      if (tactile) {
        event.preventDefault();
        runtime.cancelTactilePointer(tactile);
        tactilePointerRef.current = null;
        releaseCapture(tactile);
        return;
      }

      const token = pointerRef.current;
      if (!token) return;
      event.preventDefault();
      runtime.cancelPointer(token, "escape");
      releaseCapture(token);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [
    releaseCapture,
    runtime,
    snapshot.activePointerToken,
    snapshot.activeTactilePointerToken,
  ]);

  useEffect(() => {
    const cancelHiddenTactile = () => {
      if (!document.hidden) return;

      const tactile = tactilePointerRef.current;
      if (!tactile && !tactileMode) return;

      if (tactile) {
        runtime.cancelTactilePointer(tactile);
        tactilePointerRef.current = null;
        releaseCapture(tactile);
      } else {
        runtime.cancelTactile();
      }

      setTactileMode(false);
    };

    document.addEventListener("visibilitychange", cancelHiddenTactile);
    return () => document.removeEventListener("visibilitychange", cancelHiddenTactile);
  }, [releaseCapture, runtime, tactileMode]);

  useEffect(() => {
    const previousCommitCount = settledCommitCountRef.current;
    settledCommitCountRef.current = snapshot.commitCount;
    if (snapshot.commitCount <= previousCommitCount) return;
    const settle = settleRef.current;
    if (!settle) return;
    settle.removeAttribute("data-presence-settle-active");
    void settle.offsetWidth;
    settle.setAttribute("data-presence-settle-active", String(snapshot.commitCount));
  }, [snapshot.commitCount]);

  const projection = snapshot.projection;
  // F1: admit the semantic target only after the exact selected runtime visit
  // has passed GPU-ready reveal. Existing runtime fences remain authoritative.
  if (phase !== "ready" || !snapshot.enabled || !projection) return null;

  const hitStyle = {
    left: `${projection.hitRect.x - projection.stage.x}px`,
    top: `${projection.hitRect.y - projection.stage.y}px`,
    width: `${projection.hitRect.width}px`,
    height: `${projection.hitRect.height}px`,
  } satisfies CSSProperties;

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    let captured: CapturedPointerToken | null = null;

    if (tactileMode) {
      const tactile = runtime.beginTactilePointer({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        isPrimary: event.isPrimary,
      });
      if (!tactile) return;
      tactilePointerRef.current = tactile;
      captured = tactile;
    } else {
      const movement = runtime.beginPointer({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        isPrimary: event.isPrimary,
      });
      if (!movement) return;
      pointerRef.current = movement;
      captured = movement;
    }

    event.preventDefault();

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      if (tactileMode) {
        const tactile = tactilePointerRef.current;
        if (tactile) runtime.cancelTactilePointer(tactile);
        tactilePointerRef.current = null;
      } else {
        const movement = pointerRef.current;
        if (movement) runtime.cancelPointer(movement, "pointer-cancel");
        pointerRef.current = null;
      }
      captured = null;
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const tactile = tactilePointerRef.current;
    if (tactile?.pointerId === event.pointerId) {
      event.preventDefault();
      runtime.moveTactilePointer(tactile, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }

    const token = pointerRef.current;
    if (!token || token.pointerId !== event.pointerId) return;
    event.preventDefault();
    runtime.movePointer(token, { clientX: event.clientX, clientY: event.clientY });
  }

  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const tactile = tactilePointerRef.current;
    if (tactile?.pointerId === event.pointerId) {
      event.preventDefault();
      runtime.endTactilePointer(tactile);
      tactilePointerRef.current = null;
      releaseCapture(tactile);
      return;
    }

    const token = pointerRef.current;
    if (!token || token.pointerId !== event.pointerId) return;
    event.preventDefault();
    runtime.endPointer(token, { clientX: event.clientX, clientY: event.clientY });
    releaseCapture(token);
  }

  function pointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    const tactile = tactilePointerRef.current;
    if (tactile?.pointerId === event.pointerId) {
      runtime.cancelTactilePointer(tactile);
      tactilePointerRef.current = null;
      releaseCapture(tactile);
      return;
    }

    const token = pointerRef.current;
    if (!token || token.pointerId !== event.pointerId) return;
    runtime.cancelPointer(token, "pointer-cancel");
    releaseCapture(token);
  }

  function lostPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    const tactile = tactilePointerRef.current;
    if (tactile?.pointerId === event.pointerId) {
      tactilePointerRef.current = null;
      runtime.cancelTactilePointer(tactile);
      return;
    }

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
      data-presence-tap-count={snapshot.tapCount}
      data-presence-tactile-mode={tactileMode ? "on" : "off"}
      data-presence-tactile-pointer={snapshot.activeTactilePointerToken ?? "none"}
      data-presence-tactile-move-count={snapshot.tactileMoveCount}
      data-presence-tactile-pulse-count={snapshot.tactilePulseCount}
      data-presence-correction-distance={snapshot.lastCorrectionDistance.toFixed(3)}
      data-presence-root-x={projection.root.x.toFixed(3)}
      data-presence-root-y={projection.root.y.toFixed(3)}
    >
      <button
        ref={targetRef}
        type="button"
        className="presence-scene-actor-hit-target"
        style={hitStyle}
        aria-label="동반자 반응 보기"
        aria-describedby="presence-scene-actor-help presence-scene-actor-status"
        data-presence-actor-hit-target="true"
        data-tactile-mode={tactileMode || undefined}
        data-pointer-dragging={snapshot.dragging || undefined}
        data-active-pointer-id={snapshot.activePointerId ?? undefined}
        onClick={event => {
          event.preventDefault();
          // Pointer/touch is admitted only by endPointer(). Keyboard and
          // assistive semantic activation produce click detail === 0.
          if (event.detail === 0) {
            if (tactileMode) runtime.pulseTactile();
            else runtime.acknowledgeTap();
          }
        }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onLostPointerCapture={lostPointerCapture}
      >
        <span
          ref={settleRef}
          className="presence-scene-actor-settle"
          data-presence-settle="true"
          aria-hidden="true"
        />
      </button>
      <span id="presence-scene-actor-help" className="sr-only">
        {tactileMode
          ? "만져보기 모드예요. 드래그하면 동반자가 움직임에 반응해요."
          : "누르면 동반자가 반응하고, 드래그하면 위치를 바꿔요."}
      </span>
      <span
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-presence-tap-status="true"
      >
        {snapshot.tapCount > 0
          ? `동반자가 반응했어요. ${snapshot.tapCount}`
          : "\u00a0"}
      </span>
      <div className="presence-scene-actor-controls" data-presence-hard-zone="position-control">
        <button
          type="button"
          className="presence-scene-actor-tactile"
          aria-label="동반자 만져보기"
          aria-pressed={tactileMode}
          onClick={() => {
            if (tactileMode) {
              const token = tactilePointerRef.current;
              if (token) {
                runtime.cancelTactilePointer(token);
                tactilePointerRef.current = null;
                releaseCapture(token);
              } else {
                runtime.cancelTactile();
              }
              setTactileMode(false);
            } else {
              setTactileMode(true);
            }
          }}
        >
          <span className="presence-scene-actor-tactile-mark" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
        <button
          type="button"
          className="presence-scene-actor-cycle"
          aria-label="동반자 위치 바꾸기"
          onClick={() => runtime.cycleSafePreset()}
        >
          <span className="presence-scene-actor-cycle-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        <span
          id="presence-scene-actor-status"
          className="presence-scene-actor-status sr-only"
          role="status"
          aria-live="polite"
        >
          {statusText[snapshot.status]}
        </span>
      </div>
    </div>
  );
}
