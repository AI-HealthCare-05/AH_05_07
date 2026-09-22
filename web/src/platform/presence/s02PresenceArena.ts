import type { PresenceRenderOwner } from "./companionPresenceKernel";

export const PRESENCE_ARENA_SPACE = "visual-viewport-css-px" as const;

export type PresenceArenaRect = Readonly<{
  space: typeof PRESENCE_ARENA_SPACE;
  revision: number;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type S02PresenceArenaSnapshot = Readonly<{
  space: typeof PRESENCE_ARENA_SPACE;
  routeEpoch: number;
  revision: number;
  viewport: PresenceArenaRect;
  anchors: readonly Readonly<{
    id: "today-sidecar";
    role: "today-sidecar";
    routeEpoch: number;
    arenaRevision: number;
    region: PresenceArenaRect;
  }>[];
  hardZones: readonly Readonly<{
    id: string;
    region: PresenceArenaRect;
  }>[];
  observedOwner: PresenceRenderOwner;
}>;

type UntaggedRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type S02PresenceArenaInput = Readonly<{
  routeEpoch: number;
  revision: number;
  viewport: UntaggedRect;
  scene: UntaggedRect;
  hardZones: readonly Readonly<{ id: string; rect: UntaggedRect }>[];
  observedOwner: PresenceRenderOwner;
}>;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function validRect(rect: UntaggedRect, label: string): UntaggedRect {
  const next = {
    x: finite(rect.x, `${label}.x`),
    y: finite(rect.y, `${label}.y`),
    width: finite(rect.width, `${label}.width`),
    height: finite(rect.height, `${label}.height`),
  };
  if (next.width < 0 || next.height < 0) {
    throw new RangeError(`${label} dimensions must be non-negative`);
  }
  return Object.freeze(next);
}

function tagged(rect: UntaggedRect, revision: number): PresenceArenaRect {
  return Object.freeze({
    space: PRESENCE_ARENA_SPACE,
    revision,
    ...validRect(rect, "arena rect"),
  });
}

function integer(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return value;
}

export function clientRectToPresenceArena(
  rect: UntaggedRect,
  viewport: UntaggedRect,
): UntaggedRect {
  return Object.freeze({
    x: rect.x + viewport.x,
    y: rect.y + viewport.y,
    width: rect.width,
    height: rect.height,
  });
}

export function buildS02PresenceArenaSnapshot(
  input: S02PresenceArenaInput,
): S02PresenceArenaSnapshot {
  const routeEpoch = integer(input.routeEpoch, "routeEpoch");
  const revision = integer(input.revision, "revision");
  const viewport = tagged(input.viewport, revision);
  const scene = tagged(input.scene, revision);
  const anchors = Object.freeze([
    Object.freeze({
      id: "today-sidecar" as const,
      role: "today-sidecar" as const,
      routeEpoch,
      arenaRevision: revision,
      region: scene,
    }),
  ]);
  const ids = new Set<string>();
  const hardZones = Object.freeze(input.hardZones.map(({ id, rect }, index) => {
    if (!id || ids.has(id)) throw new Error(`duplicate or empty hard-zone id: ${id}`);
    ids.add(id);
    return Object.freeze({
      id,
      region: tagged(validRect(rect, `hardZones[${index}]`), revision),
    });
  }));
  return Object.freeze({
    space: PRESENCE_ARENA_SPACE,
    routeEpoch,
    revision,
    viewport,
    anchors,
    hardZones,
    observedOwner: input.observedOwner,
  });
}

function visible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0
    && rect.height > 0
    && style.display !== "none"
    && style.visibility !== "hidden";
}

function rectOf(element: HTMLElement, viewport: UntaggedRect): UntaggedRect {
  const rect = element.getBoundingClientRect();
  return clientRectToPresenceArena({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  }, viewport);
}

export function readPresenceVisualViewport(): UntaggedRect {
  const visual = window.visualViewport;
  return Object.freeze({
    x: visual?.offsetLeft ?? 0,
    y: visual?.offsetTop ?? 0,
    width: visual?.width ?? window.innerWidth,
    height: visual?.height ?? window.innerHeight,
  });
}

/**
 * S02 adapter for Phase 2 shadow measurement only.
 *
 * It reads explicitly registered product surfaces; it never scans arbitrary DOM
 * for collision geometry and never writes style, layout or renderer state.
 */
export function measureS02PresenceArena(
  root: HTMLElement,
  routeEpoch: number,
  revision: number,
  observedOwner: PresenceRenderOwner,
): S02PresenceArenaSnapshot | null {
  const scene = root.querySelector('[data-scene="S02"]');
  const frame = scene?.querySelector('[data-scene-reserved-box="true"]') ?? null;
  if (!visible(frame)) return null;

  const viewport = readPresenceVisualViewport();
  const hardZones: Array<Readonly<{ id: string; rect: UntaggedRect }>> = [];
  const push = (id: string, selector: string) => {
    const element = root.querySelector(selector);
    if (visible(element)) hardZones.push(Object.freeze({ id, rect: rectOf(element, viewport) }));
  };

  push("today-primary-action", '[data-scene="S02"] .home-lead button');
  push("primary-navigation", ".primary-nav");

  const modal = Array.from(root.querySelectorAll('[role="dialog"][aria-modal="true"]'))
    .find(visible);
  if (modal) hardZones.push(Object.freeze({ id: "active-dialog", rect: rectOf(modal, viewport) }));

  const notice = Array.from(root.querySelectorAll('[data-scene="S02"] .notice, .scene-viewport > .notice, .app-shell > .notice'))
    .find(visible);
  if (notice) hardZones.push(Object.freeze({ id: "active-notice", rect: rectOf(notice, viewport) }));

  return buildS02PresenceArenaSnapshot({
    routeEpoch,
    revision,
    viewport,
    scene: rectOf(frame, viewport),
    hardZones,
    observedOwner,
  });
}
