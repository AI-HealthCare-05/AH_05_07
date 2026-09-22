import type { ArenaPoint, ArenaRect, UntaggedPoint, UntaggedRect } from "./companionWorld";

export function readVisualViewportRect(): UntaggedRect {
  const visual = window.visualViewport;
  return Object.freeze({
    x: visual?.offsetLeft ?? 0,
    y: visual?.offsetTop ?? 0,
    width: visual?.width ?? window.innerWidth,
    height: visual?.height ?? window.innerHeight,
  });
}

/** Pointer client coordinates are adapted once into the Arena's visual-viewport space. */
export function clientPointToArena(point: UntaggedPoint, viewport: UntaggedRect): UntaggedPoint {
  return Object.freeze({ x: point.x + viewport.x, y: point.y + viewport.y });
}

/** DOM client rects and pointer samples share the same visual-viewport offset adapter. */
export function clientRectToArena(rect: UntaggedRect, viewport: UntaggedRect): UntaggedRect {
  return Object.freeze({
    x: rect.x + viewport.x,
    y: rect.y + viewport.y,
    width: rect.width,
    height: rect.height,
  });
}

/** Render fixed-position overlays back in client coordinates without device-pixel scaling. */
export function arenaPointToClient(point: ArenaPoint, viewport: ArenaRect): UntaggedPoint {
  return Object.freeze({ x: point.x - viewport.x, y: point.y - viewport.y });
}
