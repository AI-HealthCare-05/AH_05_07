import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  companionReviewCatalog,
  type CompanionReviewClip,
  type CompanionReviewCatalogEntry,
} from "../../src/ui/companionReviewCatalog";
import { PINNED_ACTIVE_ASSET, TRANSCEND_SCENARIO_FIXTURE } from "./platform/embodiment/labEmbodimentPort";
import { LAB_ENVELOPES, TranscendLabRuntime } from "./labRuntime";

const reviewEligibleEntries = Object.freeze(
  companionReviewCatalog.entries.filter((entry) => entry.reviewEligible),
);
const defaultReviewEntry = reviewEligibleEntries.find((entry) => entry.variantKey === "standard")
  ?? reviewEligibleEntries[0];

function reviewEntry(assetId: string): CompanionReviewCatalogEntry | null {
  return reviewEligibleEntries.find((entry) => entry.assetId === assetId) ?? null;
}

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
  const labControlsRef = useRef<HTMLElement | null>(null);
  const relocationControlsRef = useRef<HTMLFieldSetElement | null>(null);
  const assetPanelRef = useRef<HTMLElement | null>(null);
  const actorTargetRef = useRef<HTMLButtonElement | null>(null);
  const freeXRef = useRef<HTMLInputElement | null>(null);
  const freeYRef = useRef<HTMLInputElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const [reviewAssetId, setReviewAssetId] = useState(defaultReviewEntry?.assetId ?? "");
  const [reviewClip, setReviewClip] = useState<CompanionReviewClip>("idle");
  const selectedReviewEntry = reviewEntry(reviewAssetId);

  useLayoutEffect(() => runtime.registerControlGeometryProvider(() =>
    [labControlsRef.current, relocationControlsRef.current, assetPanelRef.current]
      .filter((element): element is HTMLElement => element !== null)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })), [runtime]);

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
    if (state.activePointerId !== null) return;
    const target = actorTargetRef.current;
    const captured = Number(target?.dataset.activePointerId);
    if (!target || !Number.isSafeInteger(captured)) return;
    if (target.hasPointerCapture(captured)) target.releasePointerCapture(captured);
    delete target.dataset.activePointerId;
  }, [state.activePointerId]);

  const pose = state.pose;
  const actorStyle = pose && state.snapshot
    ? ({
        left: px(pose.point.x - state.snapshot.viewport.x + (LAB_ENVELOPES.tactileHit.offsetX ?? 0)),
        top: px(pose.point.y - state.snapshot.viewport.y + (LAB_ENVELOPES.tactileHit.offsetY ?? 0)),
        "--hit-width": px(LAB_ENVELOPES.tactileHit.width),
        "--hit-height": px(LAB_ENVELOPES.tactileHit.height),
        "--handle-width": px(LAB_ENVELOPES.relocationHandle.width),
        "--handle-height": px(LAB_ENVELOPES.relocationHandle.height),
      } as CSSProperties)
    : undefined;

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!runtime.beginPointer({
      pointerId: event.pointerId,
      point: { x: event.clientX, y: event.clientY },
      button: event.button,
      isPrimary: event.isPrimary,
    })) return;
    event.preventDefault();
    event.currentTarget.dataset.activePointerId = String(event.pointerId);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      delete event.currentTarget.dataset.activePointerId;
      runtime.cancelPointer("pointer-cancel", event.pointerId);
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    runtime.movePointer(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const result = runtime.endPointer(event.pointerId, { x: event.clientX, y: event.clientY });
    suppressNextClickRef.current = result === "drop";
    event.currentTarget.releasePointerCapture(event.pointerId);
    delete event.currentTarget.dataset.activePointerId;
  }

  function pointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.dataset.activePointerId !== String(event.pointerId)) return;
    runtime.cancelPointer("pointer-cancel", event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    delete event.currentTarget.dataset.activePointerId;
  }

  function lostPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.dataset.activePointerId !== String(event.pointerId)) return;
    delete event.currentTarget.dataset.activePointerId;
    runtime.cancelPointer("lost-pointer-capture", event.pointerId);
  }

  function actorKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const nudges: Partial<Record<string, readonly [number, number]>> = {
      ArrowLeft: [-0.05, 0],
      ArrowRight: [0.05, 0],
      ArrowUp: [0, -0.05],
      ArrowDown: [0, 0.05],
    };
    const nudge = nudges[event.key];
    if (!nudge) return;
    event.preventDefault();
    runtime.keyboardNudge(...nudge);
  }

  function actorClick() {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    runtime.tactileActivate();
  }

  function applyFreeCoordinates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const x = freeXRef.current?.valueAsNumber;
    const y = freeYRef.current?.valueAsNumber;
    runtime.relocateToNormalized((x ?? Number.NaN) / 100, (y ?? Number.NaN) / 100);
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
        <p className="eyebrow">SK7 Transcend · isolated Phase 2 preparation A</p>
        <h1>Companion Interaction Lab</h1>
        <p>
          One logical actor, one fenced pose writer, and one visible renderer at a time.
          Product routes, storage, history, and activation remain untouched.
        </p>
      </header>

      <section ref={labControlsRef} className="lab-panel lab-controls" aria-labelledby="lab-controls-title">
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
        <div className="world-playable-launch">
          <div>
            <p className="section-kicker">W1 playable slice</p>
            <p>Verified bear · Rapier movement · third-person camera · Lab only.</p>
          </div>
          <button
            type="button"
            data-testid="start-world-playable"
            disabled={state.assetLoading || state.playable}
            onClick={() => void runtime.startPlayable()}
          >
            {state.assetLoading ? "Preparing playable…" : "Start W1 playable"}
          </button>
        </div>
      </section>

      {state.playable ? (
        <aside className="world-playable-controls" aria-label="W1 playable controls">
          <strong>W1 Playable</strong>
          <span>WASD / arrows move · drag to look · touch: left Move / right Look</span>
          <div className="control-row">
            <button type="button" onClick={() => runtime.playableCameraNudge(Math.PI / 12)}>Camera left</button>
            <button type="button" onClick={() => runtime.playableCameraReset()}>Reset camera</button>
            <button type="button" onClick={() => runtime.playableCameraNudge(-Math.PI / 12)}>Camera right</button>
            <button type="button" data-testid="exit-world-playable" onClick={() => void runtime.exitPlayable()}>
              Exit playable
            </button>
          </div>
        </aside>
      ) : null}

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
        <p>
          Anchor buttons stay explicit. Percentage coordinates and body-arrow nudges use the same
          free-placement solver as drag, without capturing keys from text inputs.
        </p>
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
        <form className="free-coordinate-form" onSubmit={applyFreeCoordinates}>
          <label>
            Horizontal position (%)
            <input ref={freeXRef} data-testid="free-position-x" type="number" min="0" max="100" step="1" defaultValue="50" inputMode="numeric" />
          </label>
          <label>
            Vertical position (%)
            <input ref={freeYRef} data-testid="free-position-y" type="number" min="0" max="100" step="1" defaultValue="50" inputMode="numeric" />
          </label>
          <button type="submit" data-testid="apply-free-position">Apply free position</button>
        </form>
      </fieldset>

      <section ref={assetPanelRef} className="lab-panel asset-panel" aria-labelledby="asset-title">
        <div>
          <p className="section-kicker">Read-only asset authority</p>
          <h2 id="asset-title">Fixture-pinned active-lite admission</h2>
          <p><code>{PINNED_ACTIVE_ASSET.assetId}</code> · bear lite · <code>{PINNED_ACTIVE_ASSET.sha256}</code></p>
          <p data-testid="representation-mode">
            Representation: {state.representation?.mode ?? "none"}
            {state.representation?.clipName ? ` · clip ${state.representation.clipName}` : ""}
          </p>
        </div>
        <button
          type="button"
          data-testid="load-asset"
          disabled={state.assetLoading}
          onClick={() => void runtime.loadAsset()}
        >
          {state.assetLoading ? "Loading admitted asset…" : "Verify and request pinned asset"}
        </button>
        <div className="review-catalog-panel" data-testid="review-catalog-panel">
          <div>
            <p className="section-kicker">Always-open development catalog</p>
            <h3>Review an immutable delivery without activation</h3>
            <p>
              This read-only catalog validates identity and required clips. Selection and playback
              never change checked-in product membership.
            </p>
          </div>
          <label>
            Review asset
            <select
              data-testid="review-asset-select"
              value={reviewAssetId}
              onChange={(event) => setReviewAssetId(event.currentTarget.value)}
            >
              {reviewEligibleEntries.map((entry) => (
                <option key={entry.assetId} value={entry.assetId}>
                  {entry.speciesKey} · {entry.version} · {entry.variantKey} · {entry.assetId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Required clip
            <select
              data-testid="review-clip-select"
              value={reviewClip}
              onChange={(event) => setReviewClip(event.currentTarget.value as CompanionReviewClip)}
            >
              {companionReviewCatalog.requiredClips.map((clip) => (
                <option key={clip} value={clip}>{clip}</option>
              ))}
            </select>
          </label>
          {selectedReviewEntry ? (
            <dl className="diagnostic-grid" data-testid="review-asset-identity">
              <div><dt>Species</dt><dd>{selectedReviewEntry.speciesKey}</dd></div>
              <div><dt>Version</dt><dd>{selectedReviewEntry.version}</dd></div>
              <div><dt>Variant</dt><dd>{selectedReviewEntry.variantKey}</dd></div>
              <div><dt>Asset</dt><dd>{selectedReviewEntry.assetId}</dd></div>
              <div><dt>Required clips</dt><dd>{selectedReviewEntry.capabilities.requiredClips}</dd></div>
              <div><dt>Self-contained</dt><dd>{selectedReviewEntry.capabilities.selfContainedGlb}</dd></div>
              <div><dt>Exact identity</dt><dd>{selectedReviewEntry.capabilities.exactIdentity}</dd></div>
              <div><dt>Review eligible</dt><dd>{selectedReviewEntry.reviewEligible ? "yes" : "no"}</dd></div>
            </dl>
          ) : <p role="alert">Review identity unavailable.</p>}
          <button
            type="button"
            data-testid="load-review-asset"
            disabled={state.assetLoading || !selectedReviewEntry}
            onClick={() => selectedReviewEntry
              && void runtime.loadReviewAsset(selectedReviewEntry.assetId, reviewClip)}
          >
            {state.assetLoading ? "Loading review asset…" : `Verify and play ${reviewClip}`}
          </button>
        </div>
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
          <div><dt>Representation</dt><dd>{state.representation?.mode ?? "none"}</dd></div>
          <div><dt>Intent</dt><dd>{state.intent.kind}</dd></div>
          <div><dt>Actor</dt><dd>{state.actorId}</dd></div>
          <div><dt>Revision</dt><dd>{state.snapshot?.revision ?? "retired"}</dd></div>
          <div><dt>Pose source</dt><dd>{state.pose?.anchorId ?? state.pose?.source ?? state.resolution.kind}</dd></div>
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
          <p>Frame samples are CPU render-submission durations, not presented FPS or GPU completion.</p>
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
            left: px(anchor.region.x + anchor.region.width / 2 - (state.snapshot?.viewport.x ?? 0)),
            top: px(anchor.region.y + anchor.region.height / 2 - (state.snapshot?.viewport.y ?? 0)),
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
          style={{
            left: px(zone.x - (state.snapshot?.viewport.x ?? 0)),
            top: px(zone.y - (state.snapshot?.viewport.y ?? 0)),
            width: px(zone.width),
            height: px(zone.height),
          }}
          aria-hidden="true"
        >
          protected UI
        </div>
      ))}

      {pose && state.resolution.kind === "pose" ? (
        <div
          className="actor-interaction"
          style={actorStyle}
          data-testid="logical-actor"
          data-actor-id={state.actorId}
          data-pointer-dragging={state.pointerDragging}
        >
          <button
            ref={actorTargetRef}
            type="button"
            className="actor-hit-envelope"
            data-testid="actor-hit-envelope"
            aria-label="Companion body. Tap to interact, drag to place freely, or use arrow keys to nudge."
            onClick={actorClick}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerCancel}
            onLostPointerCapture={lostPointerCapture}
            onKeyDown={actorKeyDown}
          />
        </div>
      ) : null}
    </main>
  );
}
