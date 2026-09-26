import type { WorldPoint3 } from "./worldSpaceClock";

export type WorldSceneOverlayMarker = Readonly<{
  id: string;
  label: string;
  position: WorldPoint3;
}>;

export type WorldSceneOverlaySegment = Readonly<{
  id: string;
  from: string;
  to: string;
  start: WorldPoint3;
  end: WorldPoint3;
  lengthMetres: number;
}>;

export type WorldSceneOverlayPlan = Readonly<{
  boundMetres: number;
  groundSizeMetres: number;
  markers: readonly WorldSceneOverlayMarker[];
  segments: readonly WorldSceneOverlaySegment[];
}>;
