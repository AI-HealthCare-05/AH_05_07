import type { ModelV2ProductInput } from "../lib/api";

export type TimeDraftKey =
  | "weekdayBed"
  | "weekdayWake"
  | "weekendBed"
  | "weekendWake";

export const TIME_FIELD_KEYS: readonly TimeDraftKey[] = [
  "weekdayBed",
  "weekdayWake",
  "weekendBed",
  "weekendWake",
];

export type Draft = {
  age: string;
  sex: "" | "1" | "2";
  height: string;
  weight: string;
  smoking: string;
  alcoholFrequency: string;
  alcoholAmount: string;
  walkingDays: string;
  walkingHours: string;
  walkingMinutes: string;
  strengthDays: string;
  weekdayBed: string;
  weekdayWake: string;
  weekendBed: string;
  weekendWake: string;
};

export const EMPTY_DRAFT: Draft = {
  age: "",
  sex: "",
  height: "",
  weight: "",
  smoking: "",
  alcoholFrequency: "",
  alcoholAmount: "",
  walkingDays: "",
  walkingHours: "",
  walkingMinutes: "",
  strengthDays: "",
  weekdayBed: "",
  weekdayWake: "",
  weekendBed: "",
  weekendWake: "",
};

export function finiteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clockParts(value: string): [number, number] | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return [hour, minute];
}

export function buildPayload(draft: Draft): ModelV2ProductInput | null {
  const age = finiteNumber(draft.age);
  const height = finiteNumber(draft.height);
  const weight = finiteNumber(draft.weight);
  const walkingDays = finiteNumber(draft.walkingDays);
  const walkingHours = finiteNumber(draft.walkingHours);
  const walkingMinutes = finiteNumber(draft.walkingMinutes);
  const weekdayBed = clockParts(draft.weekdayBed);
  const weekdayWake = clockParts(draft.weekdayWake);
  const weekendBed = clockParts(draft.weekendBed);
  const weekendWake = clockParts(draft.weekendWake);

  if (
    age === null
    || !draft.sex
    || height === null
    || weight === null
    || !draft.smoking
    || !draft.alcoholFrequency
    || !draft.alcoholAmount
    || walkingDays === null
    || walkingHours === null
    || walkingMinutes === null
    || !draft.strengthDays
    || !weekdayBed
    || !weekdayWake
    || !weekendBed
    || !weekendWake
  ) return null;

  return {
    age_years: age,
    sex_knhanes: Number(draft.sex) as 1 | 2,
    height_cm: height,
    weight_kg: weight,
    cigarette_smoking_state: draft.smoking,
    alcohol_frequency: draft.alcoholFrequency,
    alcohol_amount_category: draft.alcoholAmount,
    walking_days_7d: walkingDays,
    walking_active_day_hours: walkingHours,
    walking_active_day_minutes: walkingMinutes,
    strength_days_7d: draft.strengthDays,
    weekday_bed_hour: weekdayBed[0],
    weekday_bed_minute: weekdayBed[1],
    weekday_wake_hour: weekdayWake[0],
    weekday_wake_minute: weekdayWake[1],
    weekend_bed_hour: weekendBed[0],
    weekend_bed_minute: weekendBed[1],
    weekend_wake_hour: weekendWake[0],
    weekend_wake_minute: weekendWake[1],
  };
}
