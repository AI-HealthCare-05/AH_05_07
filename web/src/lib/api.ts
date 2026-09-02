import type { Session } from "@supabase/supabase-js";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

type ApiError = {
  detail?: { code?: string; message?: string };
};

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

export type ObservationWindow = {
  start_on: string;
  end_on: string;
  blood_pressure_observations: BloodPressureObservation[];
  challenge_events: ChallengeEvent[];
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
    throw new Error(error.detail?.message || error.detail?.code || "요청을 처리하지 못했습니다.");
  }
  return (await response.json()) as T;
}

export function createBloodPressureObservation(
  session: Session,
  payload: Omit<BloodPressureObservation, "id">,
): Promise<BloodPressureObservation> {
  return apiFetch<BloodPressureObservation>("/api/v1/observations/blood-pressure", session, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

export function getObservationWindow(session: Session, startOn: string, endOn: string): Promise<ObservationWindow> {
  const query = new URLSearchParams({ start_on: startOn, end_on: endOn });
  return apiFetch<ObservationWindow>(`/api/v1/observations/window?${query}`, session);
}
