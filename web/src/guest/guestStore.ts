import { shiftDate } from "../lib/seoulDate";
import type {
  ActiveChallenge,
  BloodPressureObservation,
  BloodPressureObservationInput,
  ChallengeCheckin,
  ChallengeEvent,
  ObservationWindow,
} from "../lib/api-contract";

export type GuestJourneyState = Readonly<{
  bloodPressureObservations: readonly BloodPressureObservation[];
  challengeCheckins: readonly ChallengeCheckin[];
  challengeEvents: readonly ChallengeEvent[];
  activeChallenge: ActiveChallenge | null;
  nextId: number;
}>;

export type GuestJourneyAction =
  | { type: "blood-pressure/create"; input: BloodPressureObservationInput }
  | { type: "blood-pressure/update"; id: string; input: BloodPressureObservationInput }
  | { type: "blood-pressure/delete"; id: string }
  | { type: "challenge/select"; actionId: string; today: string }
  | { type: "challenge-checkin/create"; observedOn: string; status: ChallengeCheckin["status"] }
  | { type: "challenge-checkin/update"; id: string; status: ChallengeCheckin["status"] }
  | { type: "challenge-checkin/delete"; id: string };

const seedBloodPressure = (
  today: string,
  offset: number,
  period: BloodPressureObservation["period"],
  systolic: number,
  diastolic: number,
): BloodPressureObservation => ({
  id: `guest-seed-bp-${Math.abs(offset)}-${period}`,
  observed_on: shiftDate(today, offset),
  period,
  systolic,
  diastolic,
});

const seedCheckin = (
  today: string,
  offset: number,
  status: ChallengeCheckin["status"],
): ChallengeCheckin => ({
  id: `guest-seed-checkin-${Math.abs(offset)}`,
  challenge_id: "guest-seed-cycle",
  action_id: "sleep-routine",
  observed_on: shiftDate(today, offset),
  status,
});

/**
 * Deterministic, synthetic and intentionally sparse. The returned object has no
 * browser or network side effects and is recreated after every document load.
 */
export function createGuestJourneyState(today: string): GuestJourneyState {
  return {
    bloodPressureObservations: [
      seedBloodPressure(today, -13, "morning", 128, 82),
      seedBloodPressure(today, -11, "evening", 124, 80),
      seedBloodPressure(today, -9, "morning", 126, 81),
      seedBloodPressure(today, -7, "evening", 122, 78),
      seedBloodPressure(today, -6, "morning", 125, 79),
      seedBloodPressure(today, -4, "evening", 121, 77),
      seedBloodPressure(today, -2, "morning", 123, 78),
      seedBloodPressure(today, -1, "evening", 119, 76),
    ],
    challengeCheckins: [
      seedCheckin(today, -12, "completed"),
      seedCheckin(today, -10, "skipped"),
      seedCheckin(today, -8, "completed"),
      seedCheckin(today, -5, "completed"),
      seedCheckin(today, -3, "skipped"),
      seedCheckin(today, -1, "completed"),
    ],
    challengeEvents: [],
    activeChallenge: null,
    nextId: 1,
  };
}

export function guestJourneyReducer(
  state: GuestJourneyState,
  action: GuestJourneyAction,
): GuestJourneyState {
  switch (action.type) {
    case "blood-pressure/create":
      return {
        ...state,
        bloodPressureObservations: [
          ...state.bloodPressureObservations,
          { id: `guest-bp-${state.nextId}`, ...action.input },
        ],
        nextId: state.nextId + 1,
      };
    case "blood-pressure/update":
      return {
        ...state,
        bloodPressureObservations: state.bloodPressureObservations.map((record) =>
          record.id === action.id ? { id: record.id, ...action.input } : record,
        ),
      };
    case "blood-pressure/delete":
      return {
        ...state,
        bloodPressureObservations: state.bloodPressureObservations.filter(
          (record) => record.id !== action.id,
        ),
      };
    case "challenge/select": {
      if (state.activeChallenge?.first_checkin_on) return state;
      const activeChallenge: ActiveChallenge = state.activeChallenge
        ? { ...state.activeChallenge, action_id: action.actionId }
        : {
            id: `guest-challenge-${state.nextId}`,
            action_id: action.actionId,
            starts_on: action.today,
            ends_on: shiftDate(action.today, 6),
            first_checkin_on: null,
            status: "active",
          };
      return {
        ...state,
        activeChallenge,
        nextId: state.activeChallenge ? state.nextId : state.nextId + 1,
      };
    }
    case "challenge-checkin/create": {
      const challenge = state.activeChallenge;
      if (
        !challenge
        || challenge.status !== "active"
        || action.observedOn < challenge.starts_on
        || action.observedOn > challenge.ends_on
      ) return state;
      const existing = state.challengeCheckins.find(
        (record) => record.challenge_id === challenge.id && record.observed_on === action.observedOn,
      );
      if (existing) {
        return {
          ...state,
          challengeCheckins: state.challengeCheckins.map((record) =>
            record.id === existing.id ? { ...record, status: action.status } : record,
          ),
        };
      }
      return {
        ...state,
        activeChallenge: challenge.first_checkin_on
          ? challenge
          : { ...challenge, first_checkin_on: action.observedOn },
        challengeCheckins: [
          ...state.challengeCheckins,
          {
            id: `guest-checkin-${state.nextId}`,
            challenge_id: challenge.id,
            action_id: challenge.action_id,
            observed_on: action.observedOn,
            status: action.status,
          },
        ],
        nextId: state.nextId + 1,
      };
    }
    case "challenge-checkin/update":
      return {
        ...state,
        challengeCheckins: state.challengeCheckins.map((record) =>
          record.id === action.id ? { ...record, status: action.status } : record,
        ),
      };
    case "challenge-checkin/delete":
      return {
        ...state,
        challengeCheckins: state.challengeCheckins.filter((record) => record.id !== action.id),
      };
  }
}

export function projectGuestObservationWindow(
  state: GuestJourneyState,
  startOn: string,
  endOn: string,
): ObservationWindow {
  const inWindow = (date: string) => date >= startOn && date <= endOn;
  return {
    start_on: startOn,
    end_on: endOn,
    blood_pressure_observations: state.bloodPressureObservations.filter((record) =>
      inWindow(record.observed_on),
    ),
    challenge_events: state.challengeEvents.filter((record) => inWindow(record.observed_on)),
    active_challenge: state.activeChallenge,
    challenge_checkins: state.challengeCheckins.filter((record) => inWindow(record.observed_on)),
  };
}
