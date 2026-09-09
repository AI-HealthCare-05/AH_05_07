type ApiErrorPayload = {
  detail?: unknown;
};

type ApiErrorDetail = {
  code?: string;
  message?: string;
};

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function decodeApiError(payload: unknown, status: number): ApiRequestError {
  const detail =
    payload && typeof payload === "object"
      ? (payload as ApiErrorPayload).detail
      : undefined;

  if (Array.isArray(detail)) {
    return new ApiRequestError(
      status,
      "validation_error",
      "입력값을 확인해 주세요.",
    );
  }

  if (detail && typeof detail === "object") {
    const errorDetail = detail as ApiErrorDetail;
    return new ApiRequestError(
      status,
      errorDetail.code || "request_failed",
      errorDetail.message || "요청을 처리하지 못했습니다.",
    );
  }

  return new ApiRequestError(
    status,
    "request_failed",
    "요청을 처리하지 못했습니다.",
  );
}

export function requestTimeoutError(): ApiRequestError {
  return new ApiRequestError(
    0,
    "request_timeout",
    "요청 응답 시간을 초과했습니다.",
  );
}

export type BloodPressureObservation = {
  id: string;
  observed_on: string;
  period: "morning" | "evening";
  systolic: number;
  diastolic: number;
};

export type BloodPressureObservationInput = Omit<
  BloodPressureObservation,
  "id"
>;

export type ChallengeEvent = {
  id: string;
  observed_on: string;
  action_id: string;
  status: "completed" | "skipped";
};

export type ActiveChallenge = {
  id: string;
  action_id: string;
  starts_on: string;
  ends_on: string;
  first_checkin_on: string | null;
  status: "active" | "closed";
};

export type ChallengeCheckin = {
  id: string;
  challenge_id: string;
  action_id: string;
  observed_on: string;
  status: "completed" | "skipped";
};

export type ObservationWindow = {
  start_on: string;
  end_on: string;
  blood_pressure_observations: BloodPressureObservation[];
  challenge_events: ChallengeEvent[];
  active_challenge: ActiveChallenge | null;
  challenge_checkins: ChallengeCheckin[];
};

export type ObservationExport = {
  blob: Blob;
  filename: string;
};

export type ModelV2ProductInput = {
  age_years: number;
  sex_knhanes: 1 | 2;
  height_cm: number;
  weight_kg: number;
  cigarette_smoking_state: string;
  alcohol_frequency: string;
  alcohol_amount_category: string;
  walking_days_7d: number;
  walking_active_day_hours: number;
  walking_active_day_minutes: number;
  strength_days_7d: string;
  weekday_bed_hour: number;
  weekday_bed_minute: number;
  weekday_wake_hour: number;
  weekday_wake_minute: number;
  weekend_bed_hour: number;
  weekend_bed_minute: number;
  weekend_wake_hour: number;
  weekend_wake_minute: number;
};

export type ModelV2ScoreResponse = {
  schema_version: string;
  product_wording: string;
};
