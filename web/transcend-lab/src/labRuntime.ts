import {
  ArenaSnapshotBuilder,
  envelopeRect,
  nearestSafeAnchorIntent,
  rectsOverlap,
  resolvePlacement,
  transitionArenaRoute,
  type ActorEnvelopes,
  type ArenaSnapshot,
  type ArenaTransitionStep,
  type PlacementIntent,
  type PlacementResolution,
  type ResolvedPose,
  type RouteEpoch,
  type UntaggedPoint,
  type UntaggedRect,
} from "./platform/spatial/companionWorld";
import {
  WorldRootLeaseManager,
  type WorldRootLease,
  type WorldRootRevocationReason,
  type WorldRootState,
} from "./platform/behavior/rootMotionLease";
import { loadPinnedActiveAsset, type AssetAdmissionResult } from "./platform/embodiment/labAssetAdmission";
import {
  LabResourceLedger,
  TRANSCEND_SCENARIO_FIXTURE,
  createMetrics,
  type BackendTelemetry,
  type LabBackendKind,
  type LabMetrics,
  type ResourceDiagnostics,
} from "./platform/embodiment/labEmbodimentPort";
import { SequentialBackendSelector } from "./labRenderers";

export type LabRoute = "grove" | "cove";
export type LabLifecycle = "starting" | "running" | "stopped" | "comparing" | "error";

export const LAB_ENVELOPES: ActorEnvelopes = Object.freeze({
  visualAction: Object.freeze({ width: 112, height: 142, offsetY: -16 }),
  tactileHit: Object.freeze({ width: 84, height: 84, offsetY: 4 }),
  relocationHandle: Object.freeze({ width: 46, height: 30, offsetY: 38 }),
});

const DEFAULT_INTENT: PlacementIntent = Object.freeze({
  preferredRole: "sunrise",
  preferredAnchorId: "sunrise",
  normalizedOffset: Object.freeze({ x: 0.5, y: 0.5 }),
  fallbackOrder: Object.freeze(["anchor", "dock", "control", "hidden"] as const),
});

const ZERO_DIAGNOSTICS: ResourceDiagnostics = Object.freeze({
  generation: 0,
  listeners: 0,
  timers: 0,
  rafLoops: 0,
  pendingLoads: 0,
  liveWebglContexts: 0,
});

export type LabPublicState = Readonly<{
  actorId: string;
  lifecycle: LabLifecycle;
  status: string;
  route: LabRoute;
  routeEpoch: RouteEpoch;
  routeToggleCount: number;
  sessionEpoch: number;
  snapshot: ArenaSnapshot | null;
  pose: ResolvedPose | null;
  resolution: PlacementResolution;
  intent: PlacementIntent;
  selectedBackend: LabBackendKind;
  mountedBackend: LabBackendKind | null;
  transitionTrace: readonly ArenaTransitionStep[];
  hardZoneExpanded: boolean;
  forceRendererFailure: boolean;
  assetResult: AssetAdmissionResult | null;
  assetLoading: boolean;
  diagnostics: ResourceDiagnostics;
  evidence: readonly LabMetrics[];
  lastRevocation: WorldRootRevocationReason | null;
  error: string | null;
}>;

type PointerSession = Readonly<{
  pointerId: number;
  lease: WorldRootLease;
  intentBeforeDrag: PlacementIntent;
}>;

function viewportRect(): UntaggedRect {
  const visual = window.visualViewport;
  return Object.freeze({
    x: 0,
    y: 0,
    width: Math.max(320, visual?.width ?? window.innerWidth),
    height: Math.max(560, visual?.height ?? window.innerHeight),
  });
}

function syntheticAnchors(route: LabRoute, viewport: UntaggedRect) {
  const left = Math.min(Math.max(96, viewport.width * 0.2), viewport.width - 96);
  const right = Math.max(Math.min(viewport.width - 96, viewport.width * 0.8), 96);
  const upper = Math.min(Math.max(150, viewport.height * 0.28), viewport.height - 210);
  const lower = Math.max(Math.min(viewport.height - 150, viewport.height * 0.72), 210);
  const positions = route === "grove"
    ? { sunrise: { x: left, y: upper }, harbor: { x: right, y: lower } }
    : { sunrise: { x: right, y: upper + 24 }, harbor: { x: left, y: lower - 24 } };
  return Object.freeze([
    Object.freeze({
      id: "sunrise",
      role: "sunrise",
      priority: 20,
      region: Object.freeze({
        x: positions.sunrise.x - 18,
        y: positions.sunrise.y - 18,
        width: 36,
        height: 36,
      }),
    }),
    Object.freeze({
      id: "harbor",
      role: "harbor",
      priority: 10,
      region: Object.freeze({
        x: positions.harbor.x - 18,
        y: positions.harbor.y - 18,
        width: 36,
        height: 36,
      }),
    }),
  ]);
}

function syntheticHardZones(expanded: boolean, viewport: UntaggedRect): readonly UntaggedRect[] {
  if (expanded) {
    return Object.freeze([
      Object.freeze({ x: 28, y: 70, width: viewport.width - 56, height: viewport.height - 120 }),
    ]);
  }
  return Object.freeze([
    Object.freeze({
      x: viewport.width / 2 - 84,
      y: viewport.height / 2 - 52,
      width: 168,
      height: 104,
    }),
  ]);
}

function dockRegion(viewport: UntaggedRect): UntaggedRect {
  return Object.freeze({
    x: viewport.width - 104,
    y: viewport.height - 116,
    width: 32,
    height: 32,
  });
}

function cloneIntent(intent: PlacementIntent): PlacementIntent {
  return Object.freeze({
    preferredRole: intent.preferredRole,
    ...(intent.preferredAnchorId ? { preferredAnchorId: intent.preferredAnchorId } : {}),
    ...(intent.normalizedOffset
      ? { normalizedOffset: Object.freeze({ ...intent.normalizedOffset }) }
      : {}),
    fallbackOrder: Object.freeze([...intent.fallbackOrder]),
  });
}

export class TranscendLabRuntime {
  readonly #listeners = new Set<() => void>();
  readonly #builder: ArenaSnapshotBuilder;
  readonly #world: WorldRootLeaseManager;
  readonly #selector = new SequentialBackendSelector();
  #resources = new LabResourceLedger();
  #host: HTMLElement | null = null;
  #sessionEpoch = 1;
  #routeEpoch = 1;
  #route: LabRoute = "grove";
  #snapshot: ArenaSnapshot | null = null;
  #intent: PlacementIntent = DEFAULT_INTENT;
  #resolution: PlacementResolution = Object.freeze({ kind: "hidden" });
  #pointer: PointerSession | null = null;
  #routeToggleCount = 0;
  #hardZoneExpanded = false;
  #selectedBackend: LabBackendKind = "movable-patch";
  #forceRendererFailure: boolean;
  #lifecycle: LabLifecycle = "stopped";
  #status = "Lab initialized; renderer stopped.";
  #assetResult: AssetAdmissionResult | null = null;
  #assetLoading = false;
  #evidence: readonly LabMetrics[] = Object.freeze([]);
  #error: string | null = null;
  #state: LabPublicState;

  constructor(options: Readonly<{ forceRendererFailure?: boolean }> = {}) {
    this.#forceRendererFailure = options.forceRendererFailure ?? false;
    this.#builder = new ArenaSnapshotBuilder(viewportRect);
    this.#builder.registerAnchorProvider("synthetic-route-anchors", () =>
      syntheticAnchors(this.#route, viewportRect()),
    );
    this.#builder.registerHardZoneProvider("synthetic-route-hard-zone", () =>
      syntheticHardZones(this.#hardZoneExpanded, viewportRect()),
    );
    const first = this.#builder.publish(this.#routeEpoch);
    this.#snapshot = first;
    this.#world = new WorldRootLeaseManager({
      sessionEpoch: this.#sessionEpoch,
      routeEpoch: this.#routeEpoch,
      arenaRevision: 0,
    });
    this.#world.publishArena(this.#fenceFor(first));
    this.#resolution = this.#resolve(this.#intent, first);
    this.#applyResolution(this.#resolution, "initial-placement");
    this.#state = this.#snapshotState();
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  getState = (): LabPublicState => this.#state;

  attachHost(host: HTMLElement): void {
    this.#host = host;
  }

  detachHost(host: HTMLElement): void {
    if (this.#host === host) this.#host = null;
  }

  async start(backend: LabBackendKind = this.#selectedBackend): Promise<void> {
    if (!this.#host) throw new Error("renderer host is not attached");
    this.#selectedBackend = backend;
    this.#lifecycle = "starting";
    this.#status = `Starting ${backend}.`;
    this.#error = null;
    if (!this.#world.state.pose && this.#snapshot) {
      this.#resolution = this.#resolve(this.#intent, this.#snapshot);
      this.#applyResolution(this.#resolution, "start-placement");
    }
    this.#emit();
    const resources = new LabResourceLedger();
    try {
      await this.#selector.select(backend, {
        host: this.#host,
        poseSource: this.#world.poseSource(),
        resources,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        forceFailure: this.#forceRendererFailure,
        getViewport: () => ({
          width: viewportRect().width,
          height: viewportRect().height,
        }),
      });
      this.#resources = resources;
      this.#resources.listen(window, "keydown", (event) => {
        if (event instanceof KeyboardEvent && event.key === "Escape" && this.#pointer) {
          this.cancelPointer("escape");
        }
      });
      const rebuildForGeometry = () => this.#rebuildCurrentArena("viewport/layout geometry changed");
      this.#resources.listen(window, "resize", rebuildForGeometry, { passive: true });
      this.#resources.listen(window, "scroll", rebuildForGeometry, { passive: true });
      if (window.visualViewport) {
        this.#resources.listen(window.visualViewport, "resize", rebuildForGeometry, { passive: true });
        this.#resources.listen(window.visualViewport, "scroll", rebuildForGeometry, { passive: true });
      }
      this.#lifecycle = "running";
      this.#status = `${backend} mounted; one world-root writer available.`;
      this.#emit();
    } catch (error) {
      await resources.drain().catch(() => ZERO_DIAGNOSTICS);
      this.#lifecycle = "error";
      this.#error = error instanceof Error ? error.message : "renderer failed";
      this.#status = "Renderer unavailable. Semantic relocation controls remain usable.";
      this.#emit();
    }
  }

  async selectBackend(backend: LabBackendKind): Promise<void> {
    this.#world.revoke("renderer-transition", false);
    this.#pointer = null;
    await this.start(backend);
  }

  async stop(): Promise<ResourceDiagnostics> {
    this.#world.revoke("stop", true);
    this.#pointer = null;
    const diagnostics = await this.#selector.stop(this.#host ?? undefined);
    this.#lifecycle = "stopped";
    this.#status = "Stopped after asynchronous teardown barrier.";
    this.#emit();
    return diagnostics;
  }

  async reset(): Promise<ResourceDiagnostics> {
    this.#world.revoke("reset", true);
    this.#pointer = null;
    const diagnostics = await this.#selector.stop(this.#host ?? undefined);
    this.#sessionEpoch += 1;
    this.#routeEpoch += 1;
    this.#route = "grove";
    this.#routeToggleCount = 0;
    this.#hardZoneExpanded = false;
    this.#intent = DEFAULT_INTENT;
    this.#assetResult = null;
    this.#assetLoading = false;
    this.#evidence = Object.freeze([]);
    this.#world.replaceSession(this.#sessionEpoch);
    const snapshot = this.#builder.publish(this.#routeEpoch);
    this.#snapshot = snapshot;
    this.#world.publishArena(this.#fenceFor(snapshot));
    this.#resolution = this.#resolve(this.#intent, snapshot);
    this.#applyResolution(this.#resolution, "reset-placement");
    this.#lifecycle = "stopped";
    this.#status = "Reset completed with zero task-owned resources; press Start to remount.";
    this.#emit();
    return diagnostics;
  }

  transitionTo(route: LabRoute): void {
    if (!this.#snapshot || route === this.#route) return;
    this.#pointer = null;
    const carriedIntent = cloneIntent(this.#intent);
    const result = transitionArenaRoute(this.#routeEpoch, carriedIntent, {
      revokeWorldRoot: () => this.#world.revoke("route-change", true),
      retireSnapshot: () => {
        this.#snapshot = null;
      },
      measureSnapshot: (nextRouteEpoch) => {
        this.#route = route;
        return this.#builder.publish(nextRouteEpoch);
      },
      publishSnapshot: (snapshot) => {
        this.#routeEpoch = snapshot.routeEpoch;
        this.#snapshot = snapshot;
        this.#world.publishArena(this.#fenceFor(snapshot));
      },
      resolveIntent: (intent, snapshot) => this.#resolve(intent, snapshot),
      applyPlacement: (resolution) => {
        this.#resolution = resolution;
        this.#applyResolution(resolution, "route-placement");
      },
    });
    this.#routeToggleCount += 1;
    this.#intent = carriedIntent;
    this.#status = `Route ${route} published atomically at revision ${result.snapshot.revision}.`;
    this.#setTrace(result.trace);
    this.#emit();
  }

  toggleRoute(): void {
    this.transitionTo(this.#route === "grove" ? "cove" : "grove");
  }

  toggleRoutes(count: number): void {
    for (let index = 0; index < count; index += 1) this.toggleRoute();
  }

  setHardZoneExpanded(expanded: boolean): void {
    if (!this.#snapshot || expanded === this.#hardZoneExpanded) return;
    this.#world.revoke("hard-zone-invalidation", true);
    this.#hardZoneExpanded = expanded;
    const snapshot = this.#builder.publish(this.#routeEpoch);
    this.#snapshot = snapshot;
    this.#world.publishArena(this.#fenceFor(snapshot));
    this.#resolution = this.#resolve(this.#intent, snapshot);
    this.#applyResolution(this.#resolution, "hard-zone-placement");
    this.#status = expanded
      ? `No-fit mode resolved to ${this.#resolution.kind}.`
      : "Hard zone restored; placement re-resolved.";
    this.#emit();
  }

  relocateToAnchor(anchorId: string, owner = "semantic-control"): boolean {
    if (!this.#snapshot) return false;
    const anchor = this.#snapshot.anchors.find((entry) => entry.id === anchorId);
    if (!anchor) return false;
    const intent = Object.freeze({
      preferredRole: anchor.role,
      preferredAnchorId: anchor.id,
      normalizedOffset: Object.freeze({ x: 0.5, y: 0.5 }),
      fallbackOrder: Object.freeze(["anchor", "dock", "control", "hidden"] as const),
    });
    const resolution = this.#resolve(intent, this.#snapshot);
    this.#intent = intent;
    this.#resolution = resolution;
    const wrote = this.#applyResolution(resolution, owner);
    this.#status = wrote
      ? `Actor relocated to ${anchor.id}.`
      : `Relocation resolved to ${resolution.kind}.`;
    this.#emit();
    return wrote;
  }

  beginPointer(pointerId: number): boolean {
    if (!this.#snapshot || this.#pointer || this.#lifecycle !== "running") return false;
    const lease = this.#world.acquire(`pointer:${pointerId}`, this.#fenceFor(this.#snapshot));
    if (!lease) return false;
    this.#pointer = Object.freeze({
      pointerId,
      lease,
      intentBeforeDrag: cloneIntent(this.#intent),
    });
    this.#status = "Direct relocation lease acquired.";
    this.#emit();
    return true;
  }

  movePointer(pointerId: number, point: UntaggedPoint): boolean {
    if (!this.#snapshot || !this.#pointer || this.#pointer.pointerId !== pointerId) return false;
    const viewport = this.#snapshot.viewport;
    const halfWidth = LAB_ENVELOPES.visualAction.width / 2;
    const halfHeight = LAB_ENVELOPES.visualAction.height / 2;
    const arenaPoint = Object.freeze({
      space: this.#snapshot.space,
      revision: this.#snapshot.revision,
      x: Math.min(viewport.x + viewport.width - halfWidth, Math.max(viewport.x + halfWidth, point.x)),
      y: Math.min(viewport.y + viewport.height - halfHeight, Math.max(viewport.y + halfHeight, point.y)),
    });
    const pose = Object.freeze({
      routeEpoch: this.#snapshot.routeEpoch,
      arenaRevision: this.#snapshot.revision,
      point: arenaPoint,
      anchorId: null,
      source: "fallback" as const,
    });
    const wrote = this.#world.write(this.#pointer.lease, pose);
    if (wrote) this.#emit();
    return wrote;
  }

  endPointer(pointerId: number, point: UntaggedPoint): boolean {
    if (!this.#snapshot || !this.#pointer || this.#pointer.pointerId !== pointerId) return false;
    const pointer = this.#pointer;
    const intent = nearestSafeAnchorIntent(this.#snapshot, point);
    const resolution = this.#resolve(intent, this.#snapshot);
    let wrote = false;
    if (resolution.kind === "pose") wrote = this.#world.write(pointer.lease, resolution.pose);
    this.#world.release(pointer.lease);
    this.#pointer = null;
    this.#intent = intent;
    this.#resolution = resolution;
    this.#status = wrote
      ? `Drop re-resolved safely to ${resolution.kind === "pose" ? resolution.pose.anchorId : "fallback"}.`
      : `Drop used ${resolution.kind} fallback.`;
    this.#emit();
    return wrote;
  }

  cancelPointer(reason: Extract<WorldRootRevocationReason, "pointer-cancel" | "lost-pointer-capture" | "escape">): void {
    if (!this.#pointer || !this.#snapshot) return;
    this.#intent = this.#pointer.intentBeforeDrag;
    this.#pointer = null;
    this.#world.revoke(reason, false);
    this.#resolution = this.#resolve(this.#intent, this.#snapshot);
    this.#applyResolution(this.#resolution, "cancel-recovery");
    this.#status = `Direct relocation revoked: ${reason}.`;
    this.#emit();
  }

  keyboardRelocate(direction: "previous" | "next"): boolean {
    if (!this.#snapshot) return false;
    const ids = [...this.#snapshot.anchors].map((anchor) => anchor.id).sort();
    const current = this.#world.state.pose?.anchorId;
    const currentIndex = Math.max(0, ids.indexOf(current ?? ids[0]));
    const nextIndex = direction === "next"
      ? (currentIndex + 1) % ids.length
      : (currentIndex - 1 + ids.length) % ids.length;
    return this.relocateToAnchor(ids[nextIndex], "keyboard");
  }

  tactileActivate(): void {
    this.#status = "Tactile hit admitted inside the independent hit envelope.";
    this.#emit();
  }

  async loadAsset(): Promise<AssetAdmissionResult> {
    this.#assetLoading = true;
    this.#assetResult = null;
    this.#status = "Checking immutable runtime membership before asset request.";
    this.#emit();
    const result = await loadPinnedActiveAsset({ resources: this.#resources });
    this.#assetLoading = false;
    this.#assetResult = result;
    this.#status = result.status === "loaded"
      ? `Admitted ${result.assetId}; ${result.responseBytes} bytes received.`
      : `Asset ${result.status}: ${result.reason}`;
    this.#emit();
    return result;
  }

  setForceRendererFailure(force: boolean): void {
    this.#forceRendererFailure = force;
    this.#emit();
  }

  async runComparison(): Promise<readonly LabMetrics[]> {
    if (!this.#host) throw new Error("renderer host is not attached");
    this.#lifecycle = "comparing";
    this.#status = "Running identical cold/warm scenario on A then B.";
    this.#evidence = Object.freeze([]);
    this.#emit();
    const metrics: LabMetrics[] = [];
    try {
      for (const backend of ["movable-patch", "shared-stage"] as const) {
        await this.start(backend);
        const samples = new Map<
          "cold" | "warm",
          Readonly<{ blocking: readonly number[]; telemetry: BackendTelemetry }>
        >();
        let previousDrawCount = 0;
        let previousFrameCount = 0;
        for (const condition of TRANSCEND_SCENARIO_FIXTURE.conditions) {
          const blocking: number[] = [];
          for (const action of TRANSCEND_SCENARIO_FIXTURE.inputTrace) {
            const started = performance.now();
            if (action.action === "relocate") this.relocateToAnchor(action.target, "scenario");
            if (action.action === "route") this.transitionTo(action.target as LabRoute);
            if (action.action === "place") this.relocateToAnchor(action.target, "scenario");
            blocking.push(performance.now() - started);
            await Promise.resolve();
          }
          const cumulative = this.#selector.activeTelemetry;
          if (!cumulative || cumulative.backend !== backend) {
            throw new Error(`missing ${backend} telemetry`);
          }
          const conditionTelemetry: BackendTelemetry = Object.freeze({
            ...cumulative,
            drawCount: cumulative.drawCount - previousDrawCount,
            frameDurationsMs: Object.freeze(
              cumulative.frameDurationsMs.slice(previousFrameCount),
            ),
          });
          previousDrawCount = cumulative.drawCount;
          previousFrameCount = cumulative.frameDurationsMs.length;
          samples.set(condition, Object.freeze({
            blocking: Object.freeze(blocking),
            telemetry: conditionTelemetry,
          }));
        }
        const overlap = this.#currentHardZoneOverlap();
        const clipped = this.#currentClipped();
        const drained = await this.#selector.stop(this.#host);
        const routeActions = TRANSCEND_SCENARIO_FIXTURE.inputTrace.filter(
          (action) => action.action === "route",
        ).length;
        for (const condition of TRANSCEND_SCENARIO_FIXTURE.conditions) {
          const sample = samples.get(condition);
          if (!sample) throw new Error(`missing ${backend} ${condition} sample`);
          metrics.push(createMetrics({
            backend,
            condition,
            telemetry: sample.telemetry,
            blockingSamples: sample.blocking,
            clipped,
            hardZoneOverlap: overlap,
            routeToggles: routeActions,
            afterTeardown: drained.liveWebglContexts,
          }));
        }
      }
      this.#evidence = Object.freeze(metrics);
      this.#lifecycle = "stopped";
      this.#status = "A/B evidence complete; both backends passed the teardown barrier.";
      this.#emit();
      return this.#evidence;
    } catch (error) {
      await this.#selector.stop(this.#host).catch(() => ZERO_DIAGNOSTICS);
      this.#lifecycle = "error";
      this.#error = error instanceof Error ? error.message : "comparison failed";
      this.#status = "A/B comparison stopped with a semantic error.";
      this.#emit();
      throw error;
    }
  }

  testApi(): TranscendLabTestApi {
    return Object.freeze({
      state: () => this.getState(),
      diagnostics: () => this.#resources.diagnostics(),
      worldState: () => this.#world.state,
      toggleRoutes: (count) => this.toggleRoutes(count),
      relocateToAnchor: (anchorId) => this.relocateToAnchor(anchorId, "test-api"),
      start: (backend) => this.start(backend),
      stop: () => this.stop(),
      reset: () => this.reset(),
      runComparison: () => this.runComparison(),
      loadAsset: () => this.loadAsset(),
    });
  }

  #resolve(intent: PlacementIntent, snapshot: ArenaSnapshot): PlacementResolution {
    return resolvePlacement(snapshot, intent, LAB_ENVELOPES, {
      dockRegion: dockRegion(viewportRect()),
      controlId: "relocation-controls",
    });
  }

  #applyResolution(resolution: PlacementResolution, owner: string): boolean {
    if (!this.#snapshot || resolution.kind !== "pose") return false;
    const lease = this.#world.acquire(owner, this.#fenceFor(this.#snapshot));
    if (!lease) return false;
    const wrote = this.#world.write(lease, resolution.pose);
    this.#world.release(lease);
    return wrote;
  }

  #fenceFor(snapshot: ArenaSnapshot) {
    return Object.freeze({
      sessionEpoch: this.#sessionEpoch,
      routeEpoch: snapshot.routeEpoch,
      arenaRevision: snapshot.revision,
    });
  }

  #currentHardZoneOverlap(): boolean {
    const snapshot = this.#snapshot;
    const pose = this.#world.state.pose;
    if (!snapshot || !pose) return false;
    const occupied = envelopeRect(pose.point, LAB_ENVELOPES.visualAction);
    return snapshot.hardZones.some((zone) => rectsOverlap(occupied, zone));
  }

  #currentClipped(): boolean {
    const snapshot = this.#snapshot;
    const pose = this.#world.state.pose;
    if (!snapshot || !pose) return true;
    const occupied = envelopeRect(pose.point, LAB_ENVELOPES.visualAction);
    const viewport = snapshot.viewport;
    return (
      occupied.x < viewport.x
      || occupied.y < viewport.y
      || occupied.x + occupied.width > viewport.x + viewport.width
      || occupied.y + occupied.height > viewport.y + viewport.height
    );
  }

  #rebuildCurrentArena(reason: string): void {
    if (!this.#snapshot || this.#lifecycle === "stopped" || this.#lifecycle === "error") return;
    this.#pointer = null;
    this.#world.revoke("hard-zone-invalidation", true);
    const snapshot = this.#builder.publish(this.#routeEpoch);
    this.#snapshot = snapshot;
    this.#world.publishArena(this.#fenceFor(snapshot));
    this.#resolution = this.#resolve(this.#intent, snapshot);
    this.#applyResolution(this.#resolution, "geometry-placement");
    this.#status = `${reason}; Arena revision ${snapshot.revision} published atomically.`;
    this.#emit();
  }

  #transitionTrace: readonly ArenaTransitionStep[] = Object.freeze([]);

  #setTrace(trace: readonly ArenaTransitionStep[]): void {
    this.#transitionTrace = Object.freeze([...trace]);
  }

  #snapshotState(): LabPublicState {
    return Object.freeze({
      actorId: TRANSCEND_SCENARIO_FIXTURE.actorId,
      lifecycle: this.#lifecycle,
      status: this.#status,
      route: this.#route,
      routeEpoch: this.#routeEpoch,
      routeToggleCount: this.#routeToggleCount,
      sessionEpoch: this.#sessionEpoch,
      snapshot: this.#snapshot,
      pose: this.#world.state.pose,
      resolution: this.#resolution,
      intent: this.#intent,
      selectedBackend: this.#selectedBackend,
      mountedBackend: this.#selector.activeKind,
      transitionTrace: this.#transitionTrace,
      hardZoneExpanded: this.#hardZoneExpanded,
      forceRendererFailure: this.#forceRendererFailure,
      assetResult: this.#assetResult,
      assetLoading: this.#assetLoading,
      diagnostics: this.#resources.diagnostics(),
      evidence: this.#evidence,
      lastRevocation: this.#world.state.lastRevocation,
      error: this.#error,
    });
  }

  #emit(): void {
    this.#state = this.#snapshotState();
    for (const listener of this.#listeners) listener();
  }
}

export type TranscendLabTestApi = Readonly<{
  state: () => LabPublicState;
  diagnostics: () => ResourceDiagnostics;
  worldState: () => WorldRootState;
  toggleRoutes: (count: number) => void;
  relocateToAnchor: (anchorId: string) => boolean;
  start: (backend: LabBackendKind) => Promise<void>;
  stop: () => Promise<ResourceDiagnostics>;
  reset: () => Promise<ResourceDiagnostics>;
  runComparison: () => Promise<readonly LabMetrics[]>;
  loadAsset: () => Promise<AssetAdmissionResult>;
}>;
