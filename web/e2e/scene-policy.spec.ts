import { expect, test } from "@playwright/test";
import { allScreenIds } from "../src/ui/journey";
import { landmarkForCalendarDate, resolveSceneGate, resolveScenePlan, sceneLandmarks, screenVisualModes, seoulCalendarDate, type ScenePresentation } from "../src/ui/scenePolicy";

const presentation: ScenePresentation = { screen: "S02", calendarDate: "2026-09-09", reducedMotion: false, visualDisabled: false, webglAvailable: true, gate: "review" };

test("fixed Seoul weekday journey crosses UTC midnight without challenge inputs", () => {
  expect(seoulCalendarDate(new Date("2026-09-06T14:59:59Z"))).toBe("2026-09-06");
  expect(seoulCalendarDate(new Date("2026-09-06T15:00:00Z"))).toBe("2026-09-07");
  expect(landmarkForCalendarDate("2026-09-06")?.id).toBe("sunset-overlook");
  for (let index = 0; index < 7; index++) expect(landmarkForCalendarDate(`2026-09-${String(index + 7).padStart(2, "0")}`)).toEqual(sceneLandmarks[index]);
  expect(landmarkForCalendarDate("2024-02-29")).not.toBeNull();
  for (const date of ["2026-02-29", "2026-09-31", "invalid", "2026-9-9", "2026-09-09T00:00:00Z"]) expect(landmarkForCalendarDate(date)).toBeNull();
});

test("new renderer remains review-only and S05 policy is never reinterpreted", () => {
  for (const gate of [undefined, null, "", "on", "Review", "production"]) expect(resolveScenePlan({ ...presentation, gate })).toBeNull();
  expect(resolveSceneGate("production")).toBe("production");
  for (const screen of allScreenIds) expect(resolveScenePlan({ ...presentation, screen }) !== null).toBe(screen === "S02");
  expect(screenVisualModes.S05).toBe("legacy-s05");
  expect(screenVisualModes.S11).toBe("layered");
});

test("presentation fallbacks retain calendar identity and neutral pose", () => {
  const baseline = resolveScenePlan(presentation)!;
  expect(baseline.tier).toBe(2);
  expect(baseline.pose).toBe("neutral-static");
  for (const override of [{ reducedMotion: true }, { webglAvailable: false }]) expect(resolveScenePlan({ ...presentation, ...override })).toEqual({ ...baseline, tier: 1 });
  expect(resolveScenePlan({ ...presentation, visualDisabled: true })).toBeNull();
});

test("untrusted extra domain properties cannot affect scene selection", () => {
  const baseline = resolveScenePlan(presentation);
  for (const systolic of [80, 120, 200]) for (const status of ["completed", "skipped"]) {
    const tainted = { ...presentation, systolic, diastolic: 60, score: systolic / 200, risk: "synthetic", status, challengeStart: "2026-09-01", modelReady: true };
    expect(resolveScenePlan(tainted)).toEqual(baseline);
  }
});
