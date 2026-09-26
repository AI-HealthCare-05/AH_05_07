import { LIVING_WEEK_BOUND_METRES } from "./livingWeekLandmarks";
import type { WorldSceneOverlayPlan } from "./worldSceneOverlayPlan";
import {
  livingWeekMarkers,
  livingWeekSegments,
  type LivingWeekMarkerDescriptor,
  type LivingWeekSegmentDescriptor,
} from "./livingWeekRenderProjection";

export type LivingWeekScenePlan = Readonly<WorldSceneOverlayPlan & {
  markers: readonly LivingWeekMarkerDescriptor[];
  segments: readonly LivingWeekSegmentDescriptor[];
}>;

export const LIVING_WEEK_SCENE_PLAN: LivingWeekScenePlan = Object.freeze({
  boundMetres: LIVING_WEEK_BOUND_METRES,
  groundSizeMetres: LIVING_WEEK_BOUND_METRES * 2,
  markers: livingWeekMarkers(),
  segments: livingWeekSegments(),
});
