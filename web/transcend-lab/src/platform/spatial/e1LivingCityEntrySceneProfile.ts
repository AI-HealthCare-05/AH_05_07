import { W4_LIVING_WEEK_WORLD_SCENE_PROFILE } from "./w4LivingWeekWorldSceneProfile";
import type { WorldSceneProfile } from "./worldSceneProfile";

export const E1_TODAY_GATE_ID = "e1-today-gate";

export const E1_LIVING_CITY_ENTRY_SCENE_PROFILE: WorldSceneProfile = Object.freeze({
  ...W4_LIVING_WEEK_WORLD_SCENE_PROFILE,
  destination: Object.freeze({
    id: E1_TODAY_GATE_ID,
    label: "Today Gate",
    x: 0,
    z: -2.2,
    radius: 0.85,
    presentation: "gate",
  }),
  copy: Object.freeze({
    canvasLabel: "Living City Entry Plaza. Move to the Today Gate or open classic Today.",
    destinationAhead: "Today Gate is ahead. Walk toward it to activate the entry.",
    destinationNear: "Today Gate active. Open classic Today when ready.",
    destinationAway: "Today Gate is ahead. Walk toward it to activate the entry.",
  }),
});
