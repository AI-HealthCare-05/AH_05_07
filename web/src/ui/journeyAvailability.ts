import type { ScreenId } from "./journey";

const observationWindowIndependentScreens = new Set<ScreenId>([
  "S11",
  "S14",
]);

export function requiresObservationWindow(screen: ScreenId): boolean {
  return !observationWindowIndependentScreens.has(screen);
}
