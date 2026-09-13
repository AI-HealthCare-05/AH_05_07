// Mirrors the canonical Python adapter and semantic validator.
// Verified with synthetic cross-runtime parity; source hashes gate drift.
import { ModelV2LocalError } from "./errors";
export const FEATURES = [
  "age_years",
  "sex_knhanes",
  "bmi_from_height_weight",
  "cigarette_smoking_state",
  "alcohol_frequency",
  "alcohol_amount_category",
  "walking_days_7d",
  "walking_minutes_per_active_day",
  "strength_days_7d",
  "weekday_sleep_minutes",
  "weekend_sleep_minutes",
] as const;

export type SemanticInput = Record<string, number | string | null>;

const INPUT_FIELDS = [
  "age_years", "sex_knhanes", "height_cm", "weight_kg",
  "cigarette_smoking_state", "alcohol_frequency", "alcohol_amount_category",
  "walking_days_7d", "walking_active_day_hours", "walking_active_day_minutes",
  "strength_days_7d", "weekday_bed_hour", "weekday_bed_minute",
  "weekday_wake_hour", "weekday_wake_minute", "weekend_bed_hour",
  "weekend_bed_minute", "weekend_wake_hour", "weekend_wake_minute",
] as const;

const SMOKING = [
  "daily_current", "occasional_current", "former_currently_not_smoking", "never_smoked",
] as const;
const ALCOHOL_FREQUENCY = [
  "none_past_year", "lt_monthly", "monthly_once", "monthly_2_4",
  "weekly_2_3", "weekly_4_plus", "lifetime_nonapplicable",
] as const;
const ALCOHOL_AMOUNT = [
  "1_2_drinks", "3_4_drinks", "5_6_drinks", "7_9_drinks", "10_plus_drinks", "none",
] as const;
const STRENGTH = ["0_days", "1_day", "2_days", "3_days", "4_days", "5_plus_days"] as const;

function invalid(): never {
  throw new ModelV2LocalError("input_invalid");
}

function exactRecord(payload: unknown, fields: readonly string[]): Record<string, unknown> {
  try {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) invalid();
    const keys = Reflect.ownKeys(payload);
    if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key))) invalid();
    // The browser boundary accepts data objects, never accessor-backed input.
    const record: Record<string, unknown> = {};
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(payload, field);
      if (!descriptor || !("value" in descriptor)) invalid();
      record[field] = descriptor.value;
    }
    return record;
  } catch {
    // Even a caller-supplied Proxy exception cannot leak a value in an error.
    return invalid();
  }
}

type NumberDomain = Readonly<{
  minimum?: number;
  maximum?: number;
  openMinimum?: boolean;
  whole?: boolean;
}>;

function number(value: unknown, domain: NumberDomain = {}): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  if (domain.whole && !Number.isInteger(value)) invalid();
  if (domain.minimum !== undefined && (domain.openMinimum ? value <= domain.minimum : value < domain.minimum)) invalid();
  if (domain.maximum !== undefined && value > domain.maximum) invalid();
  return value;
}

function optionalNumber(value: unknown, domain: NumberDomain): number | null {
  return value === null ? null : number(value, domain);
}

function category(value: unknown, allowed: readonly string[]): string {
  if (typeof value !== "string" || !allowed.includes(value)) invalid();
  return value;
}

function optionalCategory(value: unknown, allowed: readonly string[]): string | null {
  return value === null ? null : category(value, allowed);
}

function sex(value: unknown): number {
  const result = number(value);
  if (result !== 1 && result !== 2) invalid();
  return result;
}

function nonDrinking(value: unknown): boolean {
  return value === "none_past_year" || value === "lifetime_nonapplicable";
}

function validateAlcohol(frequency: string | null, amount: string | null): void {
  if (nonDrinking(frequency) && amount !== "none") invalid();
  if (frequency !== null && !nonDrinking(frequency) && amount === "none") invalid();
}

export function validateSemanticInput(payload: unknown): SemanticInput {
  const input = exactRecord(payload, FEATURES);
  const age = optionalNumber(input.age_years, { minimum: 19 });
  const bmi = optionalNumber(input.bmi_from_height_weight, { minimum: 0, openMinimum: true });
  const walkingDays = optionalNumber(input.walking_days_7d, { minimum: 0, maximum: 7, whole: true });
  const walkingMinutes = optionalNumber(input.walking_minutes_per_active_day, { minimum: 0, maximum: 1440 });
  const weekdaySleep = optionalNumber(input.weekday_sleep_minutes, { minimum: 0, maximum: 1440 });
  const weekendSleep = optionalNumber(input.weekend_sleep_minutes, { minimum: 0, maximum: 1440 });
  const sexCategory = input.sex_knhanes === null ? null : sex(input.sex_knhanes);
  const smoking = optionalCategory(input.cigarette_smoking_state, SMOKING);
  const frequency = optionalCategory(input.alcohol_frequency, ALCOHOL_FREQUENCY);
  const amount = optionalCategory(input.alcohol_amount_category, ALCOHOL_AMOUNT);
  const strength = optionalCategory(input.strength_days_7d, STRENGTH);

  if (walkingDays === 0 && walkingMinutes !== 0) invalid();
  validateAlcohol(frequency, amount);

  return {
    age_years: age,
    sex_knhanes: sexCategory,
    bmi_from_height_weight: bmi,
    cigarette_smoking_state: smoking,
    alcohol_frequency: frequency,
    alcohol_amount_category: amount,
    walking_days_7d: walkingDays,
    walking_minutes_per_active_day: walkingMinutes,
    strength_days_7d: strength,
    weekday_sleep_minutes: weekdaySleep,
    weekend_sleep_minutes: weekendSleep,
  };
}

function sleepMinutes(input: Record<string, unknown>, prefix: "weekday" | "weekend"): number {
  let bedHour = number(input[`${prefix}_bed_hour`], { minimum: 0, maximum: 24, whole: true });
  const bedMinute = number(input[`${prefix}_bed_minute`], { minimum: 0, maximum: 59, whole: true });
  let wakeHour = number(input[`${prefix}_wake_hour`], { minimum: 0, maximum: 24, whole: true });
  const wakeMinute = number(input[`${prefix}_wake_minute`], { minimum: 0, maximum: 59, whole: true });

  // Product adapter v2 normalizes only bedtime midnight, not wake midnight.
  if (bedHour === 0) bedHour = 24;
  // Preserve the frozen G3 Cycle 9 adjustment, including its unusual ordering.
  if (bedHour >= 1 && bedHour <= 12) bedHour += 24;
  if (wakeHour >= 1 && wakeHour <= 12) wakeHour += 24;
  let duration = (wakeHour * 60 + wakeMinute) - (bedHour * 60 + bedMinute);
  if (duration < 0) duration += 1440;
  return duration;
}

// Adjacent binary64 values define a numerical ambiguity interval, not a
// product eligibility range. The divisor is positive and finite here.
function adjacent(value: number, direction: -1n | 1n): number {
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, value);
  bits.setBigUint64(0, bits.getBigUint64(0) + direction);
  return bits.getFloat64(0);
}

export function adaptProductInput(payload: unknown): SemanticInput {
  const input = exactRecord(payload, INPUT_FIELDS);
  const age = number(input.age_years, { minimum: 19 });
  const sexCategory = sex(input.sex_knhanes);
  const height = number(input.height_cm, { minimum: 0, openMinimum: true });
  const weight = number(input.weight_kg, { minimum: 0, openMinimum: true });
  const smoking = category(input.cigarette_smoking_state, SMOKING);
  const frequency = category(input.alcohol_frequency, ALCOHOL_FREQUENCY);
  const amount = category(input.alcohol_amount_category, ALCOHOL_AMOUNT);
  validateAlcohol(frequency, amount);

  const days = number(input.walking_days_7d, { minimum: 0, maximum: 7, whole: true });
  const hours = number(input.walking_active_day_hours, { minimum: 0, maximum: 24, whole: true });
  const minutes = number(input.walking_active_day_minutes, { minimum: 0, maximum: 59, whole: true });
  if (days === 0 && (hours !== 0 || minutes !== 0)) invalid();
  const strength = category(input.strength_days_7d, STRENGTH);
  const heightMetres = height / 100;
  // Multiplication has IEEE-754 rounding; exponentiation is implementation-
  // approximated and differs between browser engines / Python's platform pow.
  const bmiDenominator = heightMetres * heightMetres;
  // Python raises arithmetic errors when finite inputs underflow the divisor
  // to zero or overflow its square. Preserve failure rather than adding bounds.
  if (bmiDenominator === 0 || !Number.isFinite(bmiDenominator)) {
    throw new ModelV2LocalError("inference_unavailable");
  }

  const bmi = weight / bmiDenominator;
  // Python's platform pow can differ from the rounded product by one ULP.
  // Fail closed only where adjacent divisors cross an arithmetic/semantic
  // failure boundary. Ordinary inputs keep their computed BMI unchanged.
  // This intentionally does not claim exact parity at every libm extreme.
  const lower = adjacent(bmiDenominator, -1n);
  const upper = adjacent(bmiDenominator, 1n);
  if (lower === 0 || !Number.isFinite(upper)) {
    throw new ModelV2LocalError("inference_unavailable");
  }
  if (!Number.isFinite(weight / lower) || weight / upper === 0) invalid();

  return validateSemanticInput({
    age_years: age,
    sex_knhanes: sexCategory,
    bmi_from_height_weight: bmi,
    cigarette_smoking_state: smoking,
    alcohol_frequency: frequency,
    alcohol_amount_category: amount,
    walking_days_7d: days,
    walking_minutes_per_active_day: days === 0 ? 0 : hours * 60 + minutes,
    strength_days_7d: strength,
    weekday_sleep_minutes: sleepMinutes(input, "weekday"),
    weekend_sleep_minutes: sleepMinutes(input, "weekend"),
  });
}
