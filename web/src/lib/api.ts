import type { Session } from "@supabase/supabase-js";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

type ApiError = {
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

function parseApiError(payload: ApiError, status: number): ApiRequestError {
  if (Array.isArray(payload.detail)) {
    return new ApiRequestError(status, "validation_error", "입력값을 확인해 주세요.");
  }

  if (payload.detail && typeof payload.detail === "object") {
    const detail = payload.detail as ApiErrorDetail;
    return new ApiRequestError(
      status,
      detail.code || "request_failed",
      detail.message || "요청을 처리하지 못했습니다.",
    );
  }

  return new ApiRequestError(status, "request_failed", "요청을 처리하지 못했습니다.");
}

export type BloodPressureObservation = {
  id: string;
  observed_on: string;
  period: "morning" | "evening";
  systolic: number;
  diastolic: number;
};

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

async function apiFetch<T>(path: string, session: Session, init: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError;
    throw parseApiError(error, response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export type BloodPressureObservationInput = Omit<BloodPressureObservation, "id">;

export function createBloodPressureObservation(
  session: Session,
  payload: BloodPressureObservationInput,
): Promise<BloodPressureObservation> {
  return apiFetch<BloodPressureObservation>("/api/v1/observations/blood-pressure", session, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBloodPressureObservation(
  session: Session,
  recordId: string,
  payload: BloodPressureObservationInput,
): Promise<BloodPressureObservation> {
  return apiFetch<BloodPressureObservation>(`/api/v1/observations/blood-pressure/${recordId}`, session, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteBloodPressureObservation(session: Session, recordId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/observations/blood-pressure/${recordId}`, session, { method: "DELETE" });
}

export function createChallengeEvent(
  session: Session,
  payload: Omit<ChallengeEvent, "id">,
): Promise<ChallengeEvent> {
  return apiFetch<ChallengeEvent>("/api/v1/observations/challenges", session, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function selectActiveChallenge(
  session: Session,
  actionId: string,
): Promise<ActiveChallenge> {
  return apiFetch<ActiveChallenge>("/api/v1/observations/challenges/active", session, {
    method: "POST",
    body: JSON.stringify({ action_id: actionId }),
  });
}

export function createActiveChallengeCheckin(
  session: Session,
  payload: Pick<ChallengeCheckin, "observed_on" | "status">,
): Promise<ChallengeCheckin> {
  return apiFetch<ChallengeCheckin>("/api/v1/observations/challenges/active/checkins", session, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getObservationWindow(session: Session, startOn: string, endOn: string): Promise<ObservationWindow> {
  const query = new URLSearchParams({ start_on: startOn, end_on: endOn });
  return apiFetch<ObservationWindow>(`/api/v1/observations/window?${query}`, session);
}
