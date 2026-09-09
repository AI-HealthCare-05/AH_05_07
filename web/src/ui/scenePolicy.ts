import type { JourneyScreenId } from "./journey";

export const sceneLandmarks = [
  { id: "garden-gate", label: "정원 대문" },
  { id: "herb-garden", label: "허브 정원" },
  { id: "shade-tree", label: "나무 그늘과 벤치" },
  { id: "footbridge", label: "나무다리" },
  { id: "reading-shelter", label: "책 읽는 쉼터" },
  { id: "pavilion", label: "정자" },
  { id: "sunset-overlook", label: "노을 전망대" },
] as const;

export type SceneLandmark = (typeof sceneLandmarks)[number];
export type SceneTier = 0 | 1 | 2 | 3;
export type SceneMode = "none" | "static" | "layered" | "realtime" | "legacy-s05";
export const screenVisualModes: Readonly<Record<JourneyScreenId, SceneMode>> = {
  S01: "static", S02: "realtime", S03: "layered", S04: "none",
  S05: "legacy-s05", S06: "static", S07: "layered", S08: "none",
  S09: "none", S10: "realtime", S11: "layered", S12: "static",
  S13: "static", S14: "none",
};

/** A calendar date, not a challenge day or a record date selected in a recap. */
export function landmarkForCalendarDate(date: string): SceneLandmark | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) return null;
  return sceneLandmarks[(value.getUTCDay() + 6) % 7];
}

export function seoulCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function resolveSceneGate(value: unknown): "off" | "review" | "production" {
  return value === "review" || value === "production" ? value : "off";
}

export type ScenePresentation = Readonly<{
  screen: JourneyScreenId;
  calendarDate: string;
  reducedMotion: boolean;
  visualDisabled: boolean;
  webglAvailable: boolean;
  gate: unknown;
}>;

export type ScenePlan = Readonly<{
  screen: "S02" | "S10";
  landmark: SceneLandmark;
  tier: 1 | 2;
  pose: "neutral-static";
}>;

/** Presentation-only firewall; never accept a session, API response or domain object. */
export function resolveScenePlan(input: ScenePresentation): ScenePlan | null {
  if (resolveSceneGate(input.gate) === "off" || input.visualDisabled) return null;
  // Production recipes await visual/performance acceptance. Owner authorization
  // alone must not cause unmeasured prototype assets to reach production.
  if (resolveSceneGate(input.gate) === "production") return null;
  if (input.screen !== "S02" && input.screen !== "S10") return null;
  const landmark = landmarkForCalendarDate(input.calendarDate);
  if (!landmark) return null;
  return { screen: input.screen, landmark, tier: input.reducedMotion || !input.webglAvailable ? 1 : 2, pose: "neutral-static" };
}
