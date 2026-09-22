import {
  ArenaSnapshotBuilder,
  envelopeRect,
  nearestSafeAnchorIntent,
  rectsOverlap,
  resolvePlacement,
  transitionArenaRoute,
  type ActorEnvelopes,
  type AnchorPlacementIntent,
  type ArenaSnapshot,
  type ArenaTransitionStep,
  type FreePlacementIntent,
  type PlacementIntent,
  type PlacementResolution,
  type ResolvedPose,
  type RouteEpoch,
  type UntaggedPoint,
  type UntaggedRect,
} from "./platform/spatial/companionWorld";
import {
  freeIntentFromPoint,
  requestFromFreeIntent,
  resolveFreePlacement,
} from "./platform/spatial/companionFreePlacement";
import {
  arenaPointToClient,
  clientPointToArena,
  clientRectToArena,
  readVisualViewportRect,
} from "./platform/spatial/visualViewportCoordinates";
import {
  WorldRootLeaseManager,
  type WorldRootLease,
  type WorldRootRevocationReason,
  type WorldRootState,
} from "./platform/behavior/rootMotionLease";
import {
  beginGrab,
  finishGrab,
  moveGrab,
  type GrabState,
} from "./platform/behavior/companionGrabIntent";
import {
  loadPinnedActiveAsset,
  type AssetAdmissionResult,
  type VerifiedPinnedAsset,
} from "./platform/embodiment/labAssetAdmission";
import {
  LabResourceLedger,
  TRANSCEND_SCENARIO_FIXTURE,
  createMetrics,
  type BackendRepresentation,
  type BackendTelemetry,
  type LabBackendKind,
  type LabMetrics,
  type ResourceDiagnostics,
} from "./platform/embodiment/labEmbodimentPort";
import { SequentialBackendSelector } from "./labRenderers";

export type LabRoute = "grove" | "cove";
export type LabLifecycle = "starting" | "running" | "stopped" | "comparing" | "error";
export type PointerFinishKind = "ignored" | "tap" | "drop" | "cancelled";

export const LAB_ENVELOPES: ActorEnvelopes = Object.freeze({
  // Matches the visible 136x152 renderer patch, whose center is 44px above the root.
  visualAction: Object.freeze({ width: 136, height: 152, offsetY: -44 }),
  tactileHit: Object.freeze({ width: 136, height: 152, offsetY: -44 }),
  relocationHandle: Object.freeze({ width: 46, height: 30, offsetY: 38 }),
});

const FREE_CLEARANCE = 8;
const DEFAULT_INTENT: AnchorPlacementIntent = Object.freeze({
  kind: "anchor",
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
  representation: BackendRepresentation | null;
  transitionTrace: readonly ArenaTransitionStep[];
  hardZoneExpanded: boolean;
  forceRendererFailure: boolean;
  assetResult: AssetAdmissionResult | null;
  assetLoading: boolean;
  activePointerId: number | null;
  pointerDragging: boolean;
  diagnostics: ResourceDiagnostics;
  evidence: readonly LabMetrics[];
  lastRevocation: WorldRootRevocationReason | null;
  error: string | null;
}>;

type PointerSession = Readonly<{
  pointerId: number;
  lease: WorldRootLease;
  grab: GrabState;
  intentBeforeDrag: PlacementIntent;
}>;

type ControlGeometryProvider = () => readonly UntaggedRect[];

function viewportRect(): UntaggedRect {
  return readVisualViewportRect();
}

function syntheticAnchors(route: LabRoute, viewport: UntaggedRect) {
  const left = viewport.x + Math.min(Math.max(96, viewport.width * 0.2), viewport.width - 96);
  const right = viewport.x + Math.max(Math.min(viewport.width - 96, viewport.width * 0.8), 96);
  const upper = viewport.y + Math.min(Math.max(150, viewport.height * 0.28), viewport.height - 210);
  const lower = viewport.y + Math.max(Math.min(viewport.height - 150, viewport.height * 0.72), 210);
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

function noSpaceTestZone(expanded: boolean, viewport: UntaggedRect): readonly UntaggedRect[] {
  return expanded
    ? Object.freeze([Object.freeze({ ...viewport })])
    : Object.freeze([]);
}

function dockRegion(viewport: UntaggedRect): UntaggedRect {
  return Object.freeze({
    x: viewport.x + viewport.width - 104,
    y: viewport.y + viewport.height - 116,
    width: 32,
    height: 32,
  });
}

function cloneIntent(intent: PlacementIntent): PlacementIntent {
  if (intent.kind === "free") return Object.freeze({ kind: "free", u: intent.u, v: intent.v });
  return Object.freeze({
    kind: "anchor",
    preferredRole: intent.preferredRole,
    ...(intent.preferredAnchorId ? { preferredAnchorId: intent.preferredAnchorId } : {}),
    ...(intent.normalizedOffset
      ? { normalizedOffset: Object.freeze({ ...intent.normalizedOffset }) }
      : {}),
    fallbackOrder: Object.freeze([...intent.fallbackOrder]),
  });
}

function freePose(snapshot: ArenaSnapshot, point: ResolvedPose["point"]): ResolvedPose {
  return Object.freeze({
    routeEpoch: snapshot.routeEpoch,
    arenaRevision: snapshot.revision,
    point,
    anchorId: null,
    source: "free" as const,
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
  #controlGeometryProvider: ControlGeometryProvider = () => Object.freeze([]);
  #measurementViewport: UntaggedRect | null = null;
  #selectedBackend: LabBackendKind = "movable-patch";
  #forceRendererFailure: boolean;
  #lifecycle: LabLifecycle = "stopped";
  #status = "Lab initialized; renderer stopped.";
  #assetResult: AssetAdmissionResult | null = null;
  #assetLoading = false;
  #verifiedAsset: VerifiedPinnedAsset | null = null;
  #assetRequestId = 0;
  #rendererRequestId = 0;
  #evidence: readonly LabMetrics[] = Object.freeze([]);
  #error: string | null = null;
  #state: LabPublicState;

  constructor(options: Readonly<{ forceRendererFailure?: boolean }> = {}) {
    this.#forceRendererFailure = options.forceRendererFailure ?? false;
    this.#builder = new ArenaSnapshotBuilder(() => this.#currentMeasurementViewport());
    this.#builder.registerAnchorProvider("synthetic-route-anchors", () =>
      syntheticAnchors(this.#route, this.#currentMeasurementViewport()),
    );
    this.#builder.registerHardZoneProvider("registered-control-hard-zones", () => {
      const viewport = this.#currentMeasurementViewport();
      return this.#controlGeometryProvider().map((rect) => clientRectToArena(rect, viewport));
    });
    this.#builder.registerHardZoneProvider("no-space-test-zone", () =>
      noSpaceTestZone(this.#hardZoneExpanded, this.#currentMeasurementViewport()),
    );
    const first = this.#publishSnapshot(this.#routeEpoch);
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

  registerControlGeometryProvider(provider: ControlGeometryProvider): () => void {
    this.#controlGeometryProvider = provider;
    this.#rebuildCurrentArena("Ref-backed control geometry registered", true);
    return () => {
      if (this.#controlGeometryProvider === provider) this.#controlGeometryProvider = () => Object.freeze([]);
    };
  }

  clientPoint(point: UntaggedPoint): UntaggedPoint {
    const viewport = this.#snapshot?.viewport ?? viewportRect();
    return clientPointToArena(point, viewport);
  }

  actorClientPoint(): UntaggedPoint | null {
    const pose = this.#world.state.pose;
    const snapshot = this.#snapshot;
    return pose && snapshot ? arenaPointToClient(pose.point, snapshot.viewport) : null;
  }

  async start(backend: LabBackendKind = this.#selectedBackend): Promise<void> {
    if (!this.#host) throw new Error("renderer host is not attached");
    const requestId = ++this.#rendererRequestId;
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
        getViewport: viewportRect,
        verifiedAsset: this.#verifiedAsset,
      });
      if (requestId !== this.#rendererRequestId) return;
      this.#resources = resources;
      this.#resources.listen(window, "keydown", (event) => {
        if (event instanceof KeyboardEvent && event.key === "Escape" && this.#pointer) {
          this.cancelPointer("escape");
        }
      });
      const rebuildForGeometry = () => this.#rebuildCurrentArena("Viewport/layout geometry changed");
      this.#resources.listen(window, "resize", rebuildForGeometry, { passive: true });
      this.#resources.listen(window, "scroll", rebuildForGeometry, { passive: true });
      if (window.visualViewport) {
        this.#resources.listen(window.visualViewport, "resize", rebuildForGeometry, { passive: true });
        this.#resources.listen(window.visualViewport, "scroll", rebuildForGeometry, { passive: true });
      }
      this.#lifecycle = "running";
      const mode = this.#selector.activeRepresentation?.mode ?? "surrogate";
      this.#status = `${backend} mounted in ${mode} mode; one world-root writer available.`;
      this.#emit();
    } catch (error) {
      await resources.drain().catch(() => ZERO_DIAGNOSTICS);
      if (requestId !== this.#rendererRequestId) return;
      this.#lifecycle = "error";
      this.#error = error instanceof Error ? error.message : "renderer failed";
      this.#status = "Renderer unavailable. Semantic relocation controls remain usable.";
      this.#emit();
    }
  }

  async selectBackend(backend: LabBackendKind): Promise<void> {
    this.#assetRequestId += 1;
    this.#assetLoading = false;
    this.#world.revoke("renderer-transition", false);
    this.#pointer = null;
    await this.start(backend);
  }

  async stop(): Promise<ResourceDiagnostics> {
    this.#rendererRequestId += 1;
    this.#assetRequestId += 1;
    this.#assetLoading = false;
    this.#world.revoke("stop", true);
    this.#pointer = null;
    const diagnostics = await this.#selector.stop(this.#host ?? undefined);
    this.#lifecycle = "stopped";
    this.#status = "Stopped after asynchronous teardown barrier.";
    this.#emit();
    return diagnostics;
  }

  async reset(): Promise<ResourceDiagnostics> {
    this.#rendererRequestId += 1;
    this.#assetRequestId += 1;
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
    this.#verifiedAsset = null;
    this.#evidence = Object.freeze([]);
    this.#world.replaceSession(this.#sessionEpoch);
    const snapshot = this.#publishSnapshot(this.#routeEpoch);
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
        return this.#publishSnapshot(nextRouteEpoch);
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
    this.#status = `Route ${route} published atomically at revision ${result.snapshot.revision}; ${carriedIntent.kind} intent reinterpreted.`;
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
    this.#pointer = null;
    this.#hardZoneExpanded = expanded;
    const snapshot = this.#publishSnapshot(this.#routeEpoch);
    this.#snapshot = snapshot;
    this.#world.publishArena(this.#fenceFor(snapshot));
    this.#resolution = this.#resolve(this.#intent, snapshot);
    this.#applyResolution(this.#resolution, "hard-zone-placement");
    this.#status = expanded
      ? `No-fit mode resolved to ${this.#resolution.kind}.`
      : "Hard zone restored; committed intent re-resolved.";
    this.#emit();
  }

  relocateToAnchor(anchorId: string, owner = "semantic-control"): boolean {
    if (!this.#snapshot) return false;
    const anchor = this.#snapshot.anchors.find((entry) => entry.id === anchorId);
    if (!anchor) return false;
    const intent: AnchorPlacementIntent = Object.freeze({
      kind: "anchor",
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
      ? `Actor relocated to anchor ${anchor.id}.`
      : `Anchor relocation resolved to ${resolution.kind}.`;
    this.#emit();
    return wrote;
  }

  relocateToNormalized(u: number, v: number, owner = "free-position-control"): boolean {
    if (!this.#snapshot || !Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
      this.#status = "Free placement rejected: coordinates must be between 0 and 100 percent.";
      this.#emit();
      return false;
    }
    const intent: FreePlacementIntent = Object.freeze({ kind: "free", u, v });
    const resolution = this.#resolve(intent, this.#snapshot);
    this.#intent = intent;
    this.#resolution = resolution;
    const wrote = this.#applyResolution(resolution, owner);
    this.#status = wrote && resolution.kind === "pose"
      ? `Free placement committed at ${Math.round(u * 100)}%, ${Math.round(v * 100)}%.`
      : `Free placement resolved to ${resolution.kind}; no unsafe write was made.`;
    this.#emit();
    return wrote;
  }

  keyboardNudge(deltaU: number, deltaV: number): boolean {
    if (!this.#snapshot || !this.#world.state.pose) return false;
    const current = freeIntentFromPoint(
      this.#snapshot,
      this.#world.state.pose.point,
      LAB_ENVELOPES.visualAction,
      FREE_CLEARANCE,
    );
    if (!current) return false;
    return this.relocateToNormalized(
      Math.max(0, Math.min(1, current.u + deltaU)),
      Math.max(0, Math.min(1, current.v + deltaV)),
      "keyboard-free-placement",
    );
  }

  beginPointer(input: Readonly<{
    pointerId: number;
    point: UntaggedPoint;
    button: number;
    isPrimary: boolean;
  }>): boolean {
    const snapshot = this.#snapshot;
    const pose = this.#world.state.pose;
    if (!snapshot || !pose || this.#pointer || this.#lifecycle !== "running") return false;
    const fence = this.#fenceFor(snapshot);
    const grab = beginGrab({
      sample: { pointerId: input.pointerId, point: clientPointToArena(input.point, snapshot.viewport) },
      actor: pose.point,
      fence,
      button: input.button,
      isPrimary: input.isPrimary,
    });
    if (!grab) return false;
    const lease = this.#world.acquire(`pointer:${input.pointerId}`, fence);
    if (!lease) return false;
    this.#pointer = Object.freeze({
      pointerId: input.pointerId,
      lease,
      grab,
      intentBeforeDrag: cloneIntent(this.#intent),
    });
    this.#status = "Companion body engaged; move 6 CSS px to begin direct placement.";
    this.#emit();
    return true;
  }

  movePointer(pointerId: number, clientPoint: UntaggedPoint): boolean {
    const snapshot = this.#snapshot;
    const pointer = this.#pointer;
    if (!snapshot || !pointer || pointer.pointerId !== pointerId) return false;
    const update = moveGrab(
      pointer.grab,
      { pointerId, point: clientPointToArena(clientPoint, snapshot.viewport) },
      this.#fenceFor(snapshot),
    );
    if (update.kind === "ignored" || update.kind === "pending") return false;
    if (update.kind === "cancelled") {
      this.cancelPointer("pointer-cancel", pointerId);
      return false;
    }
    this.#pointer = Object.freeze({ ...pointer, grab: update.state });
    const placement = resolveFreePlacement(snapshot, update.request, LAB_ENVELOPES.visualAction, FREE_CLEARANCE);
    if (placement.kind !== "placed") return false;
    const pose = freePose(snapshot, placement.point);
    const wrote = this.#world.write(pointer.lease, pose);
    if (wrote) {
      this.#resolution = Object.freeze({ kind: "pose" as const, pose });
      this.#emit();
    }
    return wrote;
  }

  endPointer(pointerId: number, clientPoint: UntaggedPoint): PointerFinishKind {
    const snapshot = this.#snapshot;
    const pointer = this.#pointer;
    if (!snapshot || !pointer || pointer.pointerId !== pointerId) return "ignored";
    const finish = finishGrab(
      pointer.grab,
      { pointerId, point: clientPointToArena(clientPoint, snapshot.viewport) },
      this.#fenceFor(snapshot),
    );
    if (finish.kind === "ignored") return "ignored";
    if (finish.kind === "cancelled") {
      this.cancelPointer("pointer-cancel", pointerId);
      return "cancelled";
    }
    if (finish.kind === "tap") {
      this.#world.release(pointer.lease);
      this.#pointer = null;
      this.#status = "Companion tap recognized.";
      this.#emit();
      return "tap";
    }

    const placement = resolveFreePlacement(snapshot, finish.request, LAB_ENVELOPES.visualAction, FREE_CLEARANCE);
    if (placement.kind === "rejected") {
      this.cancelPointer("pointer-cancel", pointerId);
      this.#status = `Drop rejected without fallback write: ${placement.reason}.`;
      this.#emit();
      return "cancelled";
    }
    if (placement.kind === "placed") {
      const pose = freePose(snapshot, placement.point);
      const intent = freeIntentFromPoint(snapshot, placement.point, LAB_ENVELOPES.visualAction, FREE_CLEARANCE);
      const wrote = intent ? this.#world.write(pointer.lease, pose) : false;
      if (!wrote || !intent) {
        this.cancelPointer("pointer-cancel", pointerId);
        return "cancelled";
      }
      this.#world.release(pointer.lease);
      this.#pointer = null;
      this.#intent = intent;
      this.#resolution = Object.freeze({ kind: "pose" as const, pose });
      this.#status = placement.resolution === "unchanged"
        ? "Free placement committed exactly at the drop position."
        : `Free placement committed after ${placement.correctionDistance.toFixed(1)} CSS px safety correction.`;
      this.#emit();
      return "drop";
    }

    // Only genuine lack of safe space may enter the existing anchor/dock/control/hidden chain.
    const fallbackIntent = nearestSafeAnchorIntent(snapshot, finish.request.point);
    const resolution = resolvePlacement(snapshot, fallbackIntent, LAB_ENVELOPES, {
      dockRegion: dockRegion(snapshot.viewport),
      controlId: "relocation-controls",
    });
    let wrote = false;
    if (resolution.kind === "pose") wrote = this.#world.write(pointer.lease, resolution.pose);
    this.#world.release(pointer.lease);
    this.#pointer = null;
    this.#intent = fallbackIntent;
    this.#resolution = resolution;
    if (resolution.kind !== "pose") this.#world.revoke("hard-zone-invalidation", true);
    this.#status = wrote
      ? `No free space (${placement.reason}); anchor/dock fallback committed.`
      : `No free space (${placement.reason}); resolved to ${resolution.kind}.`;
    this.#emit();
    return "drop";
  }

  cancelPointer(
    reason: Extract<WorldRootRevocationReason, "pointer-cancel" | "lost-pointer-capture" | "escape">,
    pointerId?: number,
  ): boolean {
    const pointer = this.#pointer;
    const snapshot = this.#snapshot;
    if (!pointer || !snapshot || (pointerId !== undefined && pointer.pointerId !== pointerId)) return false;
    this.#intent = pointer.intentBeforeDrag;
    this.#pointer = null;
    this.#world.revoke(reason, false);
    this.#resolution = this.#resolve(this.#intent, snapshot);
    this.#applyResolution(this.#resolution, "cancel-recovery");
    this.#status = `Direct relocation cancelled (${reason}); committed ${this.#intent.kind} intent restored in current geometry.`;
    this.#emit();
    return true;
  }

  tactileActivate(): void {
    this.#status = "Tactile hit admitted inside the visible body envelope.";
    this.#emit();
  }

  async loadAsset(): Promise<AssetAdmissionResult> {
    if (this.#lifecycle !== "running" || !this.#selector.activeKind) {
      const result = Object.freeze({
        status: "failed" as const,
        assetId: TRANSCEND_SCENARIO_FIXTURE.asset.assetId,
        reason: "start a renderer before loading the pinned asset",
      });
      this.#assetResult = result;
      this.#status = `Asset failed: ${result.reason}`;
      this.#emit();
      return result;
    }
    const requestId = ++this.#assetRequestId;
    const resources = this.#resources;
    this.#assetLoading = true;
    this.#assetResult = null;
    this.#status = "Checking immutable membership, response bytes, SHA-256, and GLB structure before parse.";
    this.#emit();
    let verifiedForCurrentRenderer: VerifiedPinnedAsset | null = null;
    const result = await loadPinnedActiveAsset({
      resources,
      onVerified: async (asset) => {
        const displayed = await this.#selector.installVerifiedAsset(asset);
        if (displayed.status !== "displayed") throw new Error(displayed.reason);
        verifiedForCurrentRenderer = asset;
      },
    });
    if (requestId !== this.#assetRequestId || resources !== this.#resources) return result;
    this.#assetLoading = false;
    this.#assetResult = result;
    if (result.status === "loaded" && verifiedForCurrentRenderer) {
      this.#verifiedAsset = verifiedForCurrentRenderer;
      const representation = this.#selector.activeRepresentation;
      this.#status = `Actual bytes verified and displayed as ${representation?.mode ?? "unknown"}; clip ${representation?.clipName ?? "none"}.`;
    } else if (result.status === "loaded") {
      this.#status = "Actual bytes verified, but no current renderer accepted the display generation.";
    } else {
      this.#status = `Asset ${result.status}: ${result.reason}`;
    }
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
          if (!cumulative || cumulative.backend !== backend) throw new Error(`missing ${backend} telemetry`);
          const conditionTelemetry: BackendTelemetry = Object.freeze({
            ...cumulative,
            drawCount: cumulative.drawCount - previousDrawCount,
            frameDurationsMs: Object.freeze(cumulative.frameDurationsMs.slice(previousFrameCount)),
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
      relocateToNormalized: (u, v) => this.relocateToNormalized(u, v, "test-api-free"),
      start: (backend) => this.start(backend),
      selectBackend: (backend) => this.selectBackend(backend),
      stop: () => this.stop(),
      reset: () => this.reset(),
      runComparison: () => this.runComparison(),
      loadAsset: () => this.loadAsset(),
    });
  }

  #resolve(intent: PlacementIntent, snapshot: ArenaSnapshot): PlacementResolution {
    if (intent.kind === "anchor") {
      return resolvePlacement(snapshot, intent, LAB_ENVELOPES, {
        dockRegion: dockRegion(snapshot.viewport),
        controlId: "relocation-controls",
      });
    }
    const request = requestFromFreeIntent(snapshot, intent, LAB_ENVELOPES.visualAction, FREE_CLEARANCE);
    if (!request) return Object.freeze({ kind: "hidden" as const });
    const result = resolveFreePlacement(snapshot, request, LAB_ENVELOPES.visualAction, FREE_CLEARANCE);
    if (result.kind === "placed") {
      return Object.freeze({ kind: "pose" as const, pose: freePose(snapshot, result.point) });
    }
    if (result.kind === "no-space") {
      return resolvePlacement(snapshot, nearestSafeAnchorIntent(snapshot, request.point), LAB_ENVELOPES, {
        dockRegion: dockRegion(snapshot.viewport),
        controlId: "relocation-controls",
      });
    }
    // Invalid or stale requests fail closed; only no-space may enter the fallback chain.
    return Object.freeze({ kind: "hidden" as const });
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

  #currentMeasurementViewport(): UntaggedRect {
    return this.#measurementViewport ?? viewportRect();
  }

  #publishSnapshot(routeEpoch: RouteEpoch): ArenaSnapshot {
    this.#measurementViewport = viewportRect();
    try {
      return this.#builder.publish(routeEpoch);
    } finally {
      this.#measurementViewport = null;
    }
  }

  #rebuildCurrentArena(reason: string, whileStopped = false): void {
    if (!this.#snapshot || (!whileStopped && (this.#lifecycle === "stopped" || this.#lifecycle === "error"))) return;
    this.#pointer = null;
    this.#world.revoke("hard-zone-invalidation", true);
    const snapshot = this.#publishSnapshot(this.#routeEpoch);
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
      representation: this.#selector.activeRepresentation,
      transitionTrace: this.#transitionTrace,
      hardZoneExpanded: this.#hardZoneExpanded,
      forceRendererFailure: this.#forceRendererFailure,
      assetResult: this.#assetResult,
      assetLoading: this.#assetLoading,
      activePointerId: this.#pointer?.pointerId ?? null,
      pointerDragging: this.#pointer?.grab.dragging ?? false,
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
  relocateToNormalized: (u: number, v: number) => boolean;
  start: (backend: LabBackendKind) => Promise<void>;
  selectBackend: (backend: LabBackendKind) => Promise<void>;
  stop: () => Promise<ResourceDiagnostics>;
  reset: () => Promise<ResourceDiagnostics>;
  runComparison: () => Promise<readonly LabMetrics[]>;
  loadAsset: () => Promise<AssetAdmissionResult>;
}>;
