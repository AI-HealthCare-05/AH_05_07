import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { PINNED_ACTIVE_ASSET, TRANSCEND_SCENARIO_FIXTURE, type LabBackendKind } from "./platform/embodiment/labEmbodimentPort";
import { LAB_ENVELOPES, TranscendLabRuntime } from "./labRuntime";

function px(value: number): string {
  return `${Math.round(value)}px`;
}

export function CompanionInteractionLab() {
  const runtimeRef = useRef<TranscendLabRuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = new TranscendLabRuntime({
      forceRendererFailure: new URLSearchParams(window.location.search).get("rendererFailure") === "1",
    });
  }
  const runtime = runtimeRef.current;
  const state = useSyncExternalStore(runtime.subscribe.bind(runtime), runtime.getState, runtime.getState);
  const rendererHostRef = useRef<HTMLDivElement | null>(null);
  const relocationControlsRef = useRef<HTMLFieldSetElement | null>(null);

  useEffect(() => {
    const host = rendererHostRef.current;
    if (!host) return;
    runtime.attachHost(host);
    window.__TRANSCEND_LAB__ = runtime.testApi();
    void runtime.start();
    return () => {
      delete window.__TRANSCEND_LAB__;
      void runtime.stop().finally(() => runtime.detachHost(host));
    };
  }, [runtime]);

  useEffect(() => {
    if (state.resolution.kind === "control") relocationControlsRef.current?.focus();
  }, [state.resolution]);

  const pose = state.pose;
  const actorStyle = pose
    ? ({
        left: px(pose.point.x),
        top: px(pose.point.y),
        "--hit-width": px(LAB_ENVELOPES.tactileHit.width),
        "--hit-height": px(LAB_ENVELOPES.tactileHit.height),
        "--handle-width": px(LAB_ENVELOPES.relocationHandle.width),
        "--handle-height": px(LAB_ENVELOPES.relocationHandle.height),
      } as CSSProperties)
    : undefined;

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!runtime.beginPointer(event.pointerId)) return;
    event.preventDefault();
    event.currentTarget.dataset.activePointerId = String(event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    runtime.movePointer(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    runtime.endPointer(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.releasePointerCapture(event.pointerId);
    delete event.currentTarget.dataset.activePointerId;
  }

  function pointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    runtime.cancelPointer("pointer-cancel");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    delete event.currentTarget.dataset.activePointerId;
  }

  function lostPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    delete event.currentTarget.dataset.activePointerId;
    runtime.cancelPointer("lost-pointer-capture");
  }

  function actorKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      runtime.keyboardRelocate("previous");
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      runtime.keyboardRelocate("next");
    }
  }

  return (
    <main
      className="transcend-lab"
      data-testid="transcend-lab"
      data-lifecycle={state.lifecycle}
      data-route={state.route}
      data-arena-revision={state.snapshot?.revision ?? "retired"}
      data-route-epoch={state.routeEpoch}
    >
      <header className="lab-hero">
        <p className="eyebrow">SK7 Transcend · isolated Phase 1 experiment</p>
        <h1>Companion Interaction Lab</h1>
        <p>
          One logical actor, one fenced pose writer, and one visible renderer at a time.
          Product routes, storage, history, and activation remain untouched.
        </p>
      </header>

      <section className="lab-panel lab-controls" aria-labelledby="lab-controls-title">
        <div>
          <p className="section-kicker">Synthetic route</p>
          <h2 id="lab-controls-title">Route and renderer controls</h2>
        </div>
        <div className="control-row" role="group" aria-label="Synthetic routes">
          <button
            type="button"
            aria-pressed={state.route === "grove"}
            onClick={() => runtime.transitionTo("grove")}
          >
            Grove route
          </button>
          <button
            type="button"
            aria-pressed={state.route === "cove"}
            onClick={() => runtime.transitionTo("cove")}
          >
            Cove route
          </button>
          <button type="button" data-testid="toggle-route" onClick={() => runtime.toggleRoute()}>
            Toggle route
          </button>
        </div>
        <div className="control-row" role="group" aria-label="Renderer backend">
          {(["movable-patch", "shared-stage"] as const).map((backend) => (
            <button
              key={backend}
              type="button"
              aria-pressed={state.selectedBackend === backend}
              onClick={() => void runtime.selectBackend(backend)}
            >
              {backend === "movable-patch" ? "Renderer A · movable patch" : "Renderer B · shared stage"}
            </button>
          ))}
        </div>
        <div className="control-row">
          <button type="button" onClick={() => void runtime.start()}>Start</button>
          <button type="button" onClick={() => void runtime.stop()}>Stop</button>
          <button type="button" onClick={() => void runtime.reset()}>Reset</button>
          <button type="button" data-testid="run-comparison" onClick={() => void runtime.runComparison()}>
            Run A/B evidence
          </button>
        </div>
      </section>

      <section className={`synthetic-route synthetic-route--${state.route}`} aria-labelledby="route-title">
        <div className="route-copy">
          <p className="section-kicker">Route epoch {state.routeEpoch}</p>
          <h2 id="route-title">{state.route === "grove" ? "Grove clearing" : "Cove overlook"}</h2>
          <p>
            The route is Lab-local. Switching it carries only PlacementIntent and rebuilds all
            retained anchor and hard-zone geometry in one ArenaSnapshot.
          </p>
        </div>
        <div className="route-scroll-proof" data-testid="outside-interaction-surface">
          Native page scroll, wheel, and browser zoom remain browser-owned here.
        </div>
      </section>

      <fieldset
        id="relocation-controls"
        ref={relocationControlsRef}
        className="lab-panel relocation-controls"
        tabIndex={-1}
      >
        <legend>Accessible relocation alternatives</legend>
        <p>These single-press and keyboard controls reach the same semantic anchors as drag.</p>
        <div className="control-row">
          <button type="button" data-testid="move-sunrise" onClick={() => runtime.relocateToAnchor("sunrise")}>Move to sunrise</button>
          <button type="button" data-testid="move-harbor" onClick={() => runtime.relocateToAnchor("harbor")}>Move to harbor</button>
          <label className="check-control">
            <input
              type="checkbox"
              checked={state.hardZoneExpanded}
              onChange={(event) => runtime.setHardZoneExpanded(event.currentTarget.checked)}
            />
            Expand hard zone (exercise no-fit fallback)
          </label>
        </div>
      </fieldset>

      <section className="lab-panel asset-panel" aria-labelledby="asset-title">
        <div>
          <p className="section-kicker">Read-only asset authority</p>
          <h2 id="asset-title">Fixture-pinned active-lite admission</h2>
          <p><code>{PINNED_ACTIVE_ASSET.assetId}</code> · bear lite · <code>{PINNED_ACTIVE_ASSET.sha256}</code></p>
        </div>
        <button
          type="button"
          data-testid="load-asset"
          disabled={state.assetLoading}
          onClick={() => void runtime.loadAsset()}
        >
          {state.assetLoading ? "Loading admitted asset…" : "Verify and request pinned asset"}
        </button>
      </section>

      <section className="lab-panel status-panel" aria-labelledby="status-title">
        <div>
          <p className="section-kicker">Semantic status</p>
          <h2 id="status-title">Runtime evidence</h2>
        </div>
        <p role="status" aria-live="polite" data-testid="lab-status">{state.status}</p>
        {state.error ? <p role="alert" data-testid="renderer-error">{state.error}</p> : null}
        <dl className="diagnostic-grid" data-testid="resource-diagnostics">
          <div><dt>Backend</dt><dd>{state.mountedBackend ?? "none"}</dd></div>
          <div><dt>Actor</dt><dd>{state.actorId}</dd></div>
          <div><dt>Revision</dt><dd>{state.snapshot?.revision ?? "retired"}</dd></div>
          <div><dt>Pose anchor</dt><dd>{state.pose?.anchorId ?? state.resolution.kind}</dd></div>
          <div><dt>Listeners</dt><dd>{state.diagnostics.listeners}</dd></div>
          <div><dt>Timers</dt><dd>{state.diagnostics.timers}</dd></div>
          <div><dt>RAF loops</dt><dd>{state.diagnostics.rafLoops}</dd></div>
          <div><dt>Pending loads</dt><dd>{state.diagnostics.pendingLoads}</dd></div>
          <div><dt>WebGL contexts</dt><dd>{state.diagnostics.liveWebglContexts}</dd></div>
        </dl>
        <output data-testid="transition-trace" className="trace-output">
          {state.transitionTrace.join(" → ") || "No route transition yet"}
        </output>
      </section>

      <section className="lab-panel evidence-panel" aria-labelledby="evidence-title">
        <div>
          <p className="section-kicker">Shared protocol</p>
          <h2 id="evidence-title">A/B metrics</h2>
          <p>{TRANSCEND_SCENARIO_FIXTURE.scenarioId} · {TRANSCEND_SCENARIO_FIXTURE.scenarioHash}</p>
        </div>
        <output data-testid="evidence-count">{state.evidence.length} metric records</output>
        <pre data-testid="evidence-json">{JSON.stringify(state.evidence, null, 2)}</pre>
      </section>

      <div ref={rendererHostRef} className="renderer-host" data-testid="renderer-host" aria-hidden="true" />

      {state.snapshot?.anchors.map((anchor) => (
        <div
          key={`${anchor.arenaRevision}-${anchor.id}`}
          className="anchor-marker"
          data-anchor-id={anchor.id}
          style={{
            left: px(anchor.region.x + anchor.region.width / 2),
            top: px(anchor.region.y + anchor.region.height / 2),
          }}
          aria-hidden="true"
        >
          {anchor.id}
        </div>
      ))}

      {state.snapshot?.hardZones.map((zone, index) => (
        <div
          key={`${zone.revision}-${index}`}
          className="hard-zone-marker"
          data-testid="hard-zone"
          style={{ left: px(zone.x), top: px(zone.y), width: px(zone.width), height: px(zone.height) }}
          aria-hidden="true"
        >
          protected UI
        </div>
      ))}

      {pose && state.resolution.kind === "pose" ? (
        <div className="actor-interaction" style={actorStyle} data-testid="logical-actor" data-actor-id={state.actorId}>
          <button
            type="button"
            className="actor-hit-envelope"
            data-testid="actor-hit-envelope"
            aria-label="Interact with companion"
            onClick={() => runtime.tactileActivate()}
          />
          <button
            type="button"
            className="actor-move-handle"
            data-testid="actor-move-handle"
            aria-label="Move companion. Drag, press Enter, or use arrow keys."
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerCancel}
            onLostPointerCapture={lostPointerCapture}
            onKeyDown={actorKeyDown}
          >
            Move
          </button>
        </div>
      ) : null}
    </main>
  );
}
