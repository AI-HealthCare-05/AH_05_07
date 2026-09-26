export type WorldResourceLoad = Readonly<{
  signal: AbortSignal;
  generation: number;
  done: () => void;
}>;

/**
 * Minimal browser-resource ownership boundary needed by the reusable world
 * renderer/input layer. Concrete apps may provide their own scoped owner.
 */
export interface WorldResourceScope {
  readonly generation: number;
  isCurrent(generation: number): boolean;
  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): () => void;
  trackSubscription(unsubscribe: () => void): () => void;
  startRafLoop(callback: (time: number) => void): () => void;
  beginLoad(): WorldResourceLoad;
  trackWebglContext(dispose: () => void): () => void;
}

