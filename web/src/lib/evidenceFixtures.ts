import type { ObservationWindow } from "./api";

export const evidenceFixtureNames = ["VP-04", "VP-07a", "VP-10", "VP-11a"] as const;

export type EvidenceFixtureName = (typeof evidenceFixtureNames)[number];

export type EvidenceFixture = {
  name: EvidenceFixtureName;
  asOf: string;
  window: ObservationWindow | null;
  loadError?: boolean;
};

const asOf = "2026-09-03";
const windowBounds = { start_on: "2026-08-28", end_on: asOf };

const activeChallenge = {
  id: "fixture-challenge-walk",
  action_id: "walk-10-minutes",
  starts_on: "2026-08-28",
  ends_on: asOf,
  first_checkin_on: "2026-08-28",
  status: "active" as const,
};

const fixtures: Record<EvidenceFixtureName, EvidenceFixture> = {
  "VP-04": {
    name: "VP-04",
    asOf,
    window: {
      ...windowBounds,
      blood_pressure_observations: [],
      challenge_events: [],
      active_challenge: null,
      challenge_checkins: [],
    },
  },
  "VP-07a": {
    name: "VP-07a",
    asOf,
    window: {
      ...windowBounds,
      blood_pressure_observations: [
        { id: "fixture-bp-today", observed_on: asOf, period: "morning", systolic: 118, diastolic: 76 },
      ],
      challenge_events: [],
      active_challenge: { ...activeChallenge, starts_on: "2026-09-01", ends_on: "2026-09-07", first_checkin_on: "2026-09-01" },
      challenge_checkins: [
        { id: "fixture-checkin-1", challenge_id: "fixture-challenge-walk", action_id: "walk-10-minutes", observed_on: "2026-09-01", status: "completed" },
        { id: "fixture-checkin-2", challenge_id: "fixture-challenge-walk", action_id: "walk-10-minutes", observed_on: "2026-09-02", status: "skipped" },
      ],
    },
  },
  "VP-10": {
    name: "VP-10",
    asOf,
    window: {
      ...windowBounds,
      blood_pressure_observations: [
        { id: "fixture-bp-1", observed_on: "2026-08-28", period: "morning", systolic: 118, diastolic: 76 },
        { id: "fixture-bp-2", observed_on: "2026-09-02", period: "evening", systolic: 121, diastolic: 79 },
        { id: "fixture-bp-3", observed_on: asOf, period: "morning", systolic: 116, diastolic: 74 },
      ],
      challenge_events: [
        { id: "fixture-legacy-sleep", observed_on: "2026-08-28", action_id: "sleep-routine", status: "completed" },
      ],
      active_challenge: activeChallenge,
      challenge_checkins: [
        { id: "fixture-checkin-1", challenge_id: "fixture-challenge-walk", action_id: "walk-10-minutes", observed_on: "2026-08-28", status: "completed" },
        { id: "fixture-checkin-2", challenge_id: "fixture-challenge-walk", action_id: "walk-10-minutes", observed_on: "2026-08-29", status: "skipped" },
        { id: "fixture-checkin-3", challenge_id: "fixture-challenge-walk", action_id: "walk-10-minutes", observed_on: "2026-09-01", status: "completed" },
      ],
    },
  },
  "VP-11a": { name: "VP-11a", asOf, window: null, loadError: true },
};

export function getEvidenceFixture(value: string | undefined): EvidenceFixture | null {
  return value && evidenceFixtureNames.includes(value as EvidenceFixtureName)
    ? fixtures[value as EvidenceFixtureName]
    : null;
}
