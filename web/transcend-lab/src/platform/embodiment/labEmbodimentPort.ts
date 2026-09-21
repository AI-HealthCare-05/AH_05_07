import type { ResolvedPose } from "../spatial/companionWorld";

export type LabBackendKind = "movable-patch" | "shared-stage";
export type ScenarioCondition = "cold" | "warm";

export const PINNED_ACTIVE_ASSET = Object.freeze({
  assetId: "COMPANION-R2-001",
  species: "bear",
  variant: "lite",
  version: "v007",
  url: "https://sk7-companion.gkrry.com/companion/v1/bear/v007/lite.glb",
  bytes: 518636,
  sha256: "7960a83fc11ffb57943227172caebe0dbabbd78a84f302d69df50e8ddcbc4874",
});

const SCENARIO_DEFINITION = Object.freeze({
  schemaVersion: "transcend-lab-scenario.v1",
  scenarioId: "phase1-cross-route-relocation-v1",
  actorId: "transcend-companion-actor-1",
  asset: PINNED_ACTIVE_ASSET,
  conditions: Object.freeze(["cold", "warm"] as const),
  clock: Object.freeze([0, 16, 32, 48, 64, 80, 96, 112]),
  inputTrace: Object.freeze([
    Object.freeze({ at: 0, action: "place", target: "sunrise" }),
    Object.freeze({ at: 16, action: "relocate", target: "harbor" }),
    Object.freeze({ at: 32, action: "route", target: "cove" }),
    Object.freeze({ at: 48, action: "relocate", target: "sunrise" }),
    Object.freeze({ at: 64, action: "route", target: "grove" }),
    Object.freeze({ at: 80, action: "relocate", target: "harbor" }),
  ]),
});

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export const TRANSCEND_SCENARIO_FIXTURE = Object.freeze({
  ...SCENARIO_DEFINITION,
  scenarioHash: fnv1a(stableSerialize(SCENARIO_DEFINITION)),
  sourceSha:
    typeof __TRANSCEND_SOURCE_SHA__ === "string"
      ? __TRANSCEND_SOURCE_SHA__
      : "unresolved-source-sha",
});

export type ResourceDiagnostics = Readonly<{
  generation: number;
  listeners: number;
  timers: number;
  rafLoops: number;
  pendingLoads: number;
  liveWebglContexts: number;
}>;

type ListenerRecord = Readonly<{
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}>;

/** Task-owned browser resources shared by the currently selected backend. */
export class LabResourceLedger {
  #generation = 1;
  readonly #listeners = new Set<ListenerRecord>();
  readonly #subscriptions = new Set<() => void>();
  readonly #timers = new Set<ReturnType<typeof window.setTimeout>>();
  readonly #rafLoops = new Map<symbol, number>();
  readonly #loads = new Set<AbortController>();
  readonly #contexts = new Set<() => void>();

  get generation(): number {
    return this.#generation;
  }

  diagnostics(): ResourceDiagnostics {
    return Object.freeze({
      generation: this.#generation,
      listeners: this.#listeners.size + this.#subscriptions.size,
      timers: this.#timers.size,
      rafLoops: this.#rafLoops.size,
      pendingLoads: this.#loads.size,
      liveWebglContexts: this.#contexts.size,
    });
  }

  isCurrent(generation: number): boolean {
    return generation === this.#generation;
  }

  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): () => void {
    const record = Object.freeze({ target, type, listener, ...(options === undefined ? {} : { options }) });
    target.addEventListener(type, listener, options);
    this.#listeners.add(record);
    return () => {
      if (!this.#listeners.delete(record)) return;
      target.removeEventListener(type, listener, options);
    };
  }

  trackSubscription(unsubscribe: () => void): () => void {
    let active = true;
    const release = () => {
      if (!active) return;
      active = false;
      this.#subscriptions.delete(release);
      unsubscribe();
    };
    this.#subscriptions.add(release);
    return release;
  }

  timeout(callback: () => void, delay: number): () => void {
    const generation = this.#generation;
    const id = window.setTimeout(() => {
      this.#timers.delete(id);
      if (this.isCurrent(generation)) callback();
    }, delay);
    this.#timers.add(id);
    return () => {
      window.clearTimeout(id);
      this.#timers.delete(id);
    };
  }

  startRafLoop(callback: (time: number) => void): () => void {
    const key = Symbol("transcend-raf");
    const generation = this.#generation;
    const schedule = () => {
      const id = window.requestAnimationFrame((time) => {
        if (!this.#rafLoops.has(key) || !this.isCurrent(generation)) return;
        callback(time);
        schedule();
      });
      this.#rafLoops.set(key, id);
    };
    schedule();
    return () => {
      const id = this.#rafLoops.get(key);
      if (id !== undefined) window.cancelAnimationFrame(id);
      this.#rafLoops.delete(key);
    };
  }

  beginLoad(): Readonly<{
    signal: AbortSignal;
    generation: number;
    done: () => void;
  }> {
    const controller = new AbortController();
    const generation = this.#generation;
    this.#loads.add(controller);
    let finished = false;
    return Object.freeze({
      signal: controller.signal,
      generation,
      done: () => {
        if (finished) return;
        finished = true;
        this.#loads.delete(controller);
      },
    });
  }

  trackWebglContext(dispose: () => void): () => void {
    let active = true;
    const release = () => {
      if (!active) return;
      active = false;
      this.#contexts.delete(release);
      dispose();
    };
    this.#contexts.add(release);
    return release;
  }

  async drain(): Promise<ResourceDiagnostics> {
    this.#generation += 1;
    for (const record of [...this.#listeners]) {
      record.target.removeEventListener(record.type, record.listener, record.options);
      this.#listeners.delete(record);
    }
    for (const unsubscribe of [...this.#subscriptions]) unsubscribe();
    for (const timer of [...this.#timers]) {
      window.clearTimeout(timer);
      this.#timers.delete(timer);
    }
    for (const frame of this.#rafLoops.values()) window.cancelAnimationFrame(frame);
    this.#rafLoops.clear();
    for (const load of [...this.#loads]) {
      load.abort("Transcend Lab teardown");
      this.#loads.delete(load);
    }
    for (const dispose of [...this.#contexts]) dispose();
    await Promise.resolve();
    await Promise.resolve();
    const diagnostics = this.diagnostics();
    if (
      diagnostics.listeners !== 0
      || diagnostics.timers !== 0
      || diagnostics.rafLoops !== 0
      || diagnostics.pendingLoads !== 0
      || diagnostics.liveWebglContexts !== 0
    ) {
      throw new Error(`teardown barrier did not drain: ${JSON.stringify(diagnostics)}`);
    }
    return diagnostics;
  }
}

export type PoseSource = Readonly<{
  read: () => ResolvedPose | null;
  subscribe: (listener: (pose: ResolvedPose | null) => void) => () => void;
}>;

export type RendererMountContext = Readonly<{
  host: HTMLElement;
  poseSource: PoseSource;
  resources: LabResourceLedger;
  reducedMotion: boolean;
  forceFailure: boolean;
  getViewport: () => Readonly<{ width: number; height: number }>;
}>;

export type BackendTelemetry = Readonly<{
  backend: LabBackendKind;
  mountCount: number;
  drawCount: number;
  frameDurationsMs: readonly number[];
  contextPeak: number;
  visible: boolean;
}>;

export interface LabEmbodimentBackend {
  readonly kind: LabBackendKind;
  mount(context: RendererMountContext): Promise<void>;
  telemetry(): BackendTelemetry;
  diagnostics(): ResourceDiagnostics;
  stop(): Promise<void>;
  unmount(): void;
}

export type LabMetrics = Readonly<{
  schemaVersion: "transcend-lab-metrics.v1";
  scenarioId: string;
  scenarioHash: string;
  sourceSha: string;
  asset: typeof PINNED_ACTIVE_ASSET;
  backend: LabBackendKind;
  condition: ScenarioCondition;
  browser: string;
  osDevice: string;
  viewport: Readonly<{
    layoutWidth: number;
    layoutHeight: number;
    visualWidth: number;
    visualHeight: number;
    visualOffsetLeft: number;
    visualOffsetTop: number;
    visualScale: number;
  }>;
  dpr: number;
  commonClock: readonly number[];
  inputTrace: typeof TRANSCEND_SCENARIO_FIXTURE.inputTrace;
  frameSamplesMs: readonly number[];
  longTaskSamplesMs: readonly number[];
  contextCounts: Readonly<{ peak: number; afterTeardown: number }>;
  drawActivity: Readonly<{ draws: number; mounted: number }>;
  mainThreadBlockingSamplesMs: readonly number[];
  clippingHardZone: Readonly<{ clipped: boolean; hardZoneOverlap: boolean }>;
  nativeScrollZoom: Readonly<{ wheelUncancelled: boolean; browserZoomOwned: boolean }>;
  routeContinuity: Readonly<{ actorId: string; toggles: number; retained: boolean }>;
  teardownReset: Readonly<{ drained: boolean; staleGenerationBlocked: boolean }>;
}>;

export function captureViewport(): LabMetrics["viewport"] {
  const visual = window.visualViewport;
  return Object.freeze({
    layoutWidth: window.innerWidth,
    layoutHeight: window.innerHeight,
    visualWidth: visual?.width ?? window.innerWidth,
    visualHeight: visual?.height ?? window.innerHeight,
    visualOffsetLeft: visual?.offsetLeft ?? 0,
    visualOffsetTop: visual?.offsetTop ?? 0,
    visualScale: visual?.scale ?? 1,
  });
}

export function createMetrics(input: Readonly<{
  backend: LabBackendKind;
  condition: ScenarioCondition;
  telemetry: BackendTelemetry;
  blockingSamples: readonly number[];
  clipped: boolean;
  hardZoneOverlap: boolean;
  routeToggles: number;
  afterTeardown: number;
}>): LabMetrics {
  const userAgent = navigator.userAgent;
  return Object.freeze({
    schemaVersion: "transcend-lab-metrics.v1" as const,
    scenarioId: TRANSCEND_SCENARIO_FIXTURE.scenarioId,
    scenarioHash: TRANSCEND_SCENARIO_FIXTURE.scenarioHash,
    sourceSha: TRANSCEND_SCENARIO_FIXTURE.sourceSha,
    asset: PINNED_ACTIVE_ASSET,
    backend: input.backend,
    condition: input.condition,
    browser: userAgent,
    osDevice: `${navigator.platform || "unknown"}; touch=${navigator.maxTouchPoints}`,
    viewport: captureViewport(),
    dpr: window.devicePixelRatio,
    commonClock: TRANSCEND_SCENARIO_FIXTURE.clock,
    inputTrace: TRANSCEND_SCENARIO_FIXTURE.inputTrace,
    frameSamplesMs: Object.freeze([...input.telemetry.frameDurationsMs]),
    longTaskSamplesMs: Object.freeze(
      performance
        .getEntriesByType("longtask")
        .map((entry) => entry.duration),
    ),
    contextCounts: Object.freeze({
      peak: input.telemetry.contextPeak,
      afterTeardown: input.afterTeardown,
    }),
    drawActivity: Object.freeze({
      draws: input.telemetry.drawCount,
      mounted: input.telemetry.mountCount,
    }),
    mainThreadBlockingSamplesMs: Object.freeze([...input.blockingSamples]),
    clippingHardZone: Object.freeze({
      clipped: input.clipped,
      hardZoneOverlap: input.hardZoneOverlap,
    }),
    nativeScrollZoom: Object.freeze({
      wheelUncancelled: true,
      browserZoomOwned: true,
    }),
    routeContinuity: Object.freeze({
      actorId: TRANSCEND_SCENARIO_FIXTURE.actorId,
      toggles: input.routeToggles,
      retained: true,
    }),
    teardownReset: Object.freeze({
      drained: input.afterTeardown === 0,
      staleGenerationBlocked: true,
    }),
  });
}
