import type { Session } from "@supabase/supabase-js";
import { decodeApiError, requestTimeoutError } from "./api-contract";
import type {
  ActiveChallenge,
  BloodPressureObservation,
  BloodPressureObservationInput,
  ChallengeCheckin,
  ChallengeEvent,
  ModelV2ProductInput,
  ModelV2ScoreResponse,
  ObservationExport,
  ObservationWindow,
} from "./api-contract";

export { ApiRequestError } from "./api-contract";
export type {
  ActiveChallenge,
  BloodPressureObservation,
  BloodPressureObservationInput,
  ChallengeCheckin,
  ChallengeEvent,
  ModelV2ProductInput,
  ModelV2ScoreResponse,
  ObservationExport,
  ObservationWindow,
} from "./api-contract";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const apiRequestTimeoutMs = 8_000;

export function scoreModelV2ProductInput(
  session: Session,
  payload: ModelV2ProductInput,
): Promise<ModelV2ScoreResponse> {
  return apiFetch<ModelV2ScoreResponse>("/api/v1/model-v2/product-score", session, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function deleteAccount(session: Session): Promise<void> {
  return apiFetch<void>("/api/v1/account", session, { method: "DELETE" });
}

async function boundedFetch<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  consume: (response: Response, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, apiRequestTimeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return await consume(response, controller.signal);
  } catch (error) {
    if (timedOut) {
      throw requestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readApiError(response: Response, signal: AbortSignal): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    return {};
  }
}

async function apiFetch<T>(path: string, session: Session, init: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }
  return boundedFetch<T>(
    `${apiBaseUrl}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
    async (response, signal) => {
      if (!response.ok) {
        const error = await readApiError(response, signal);
        throw decodeApiError(error, response.status);
      }
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    },
  );
}

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

export function updateChallengeCheckin(
  session: Session,
  recordId: string,
  status: ChallengeCheckin["status"],
): Promise<ChallengeCheckin> {
  return apiFetch<ChallengeCheckin>(`/api/v1/observations/challenges/checkins/${recordId}`, session, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function deleteChallengeCheckin(session: Session, recordId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/observations/challenges/checkins/${recordId}`, session, { method: "DELETE" });
}

export function getObservationWindow(session: Session, startOn: string, endOn: string): Promise<ObservationWindow> {
  const query = new URLSearchParams({ start_on: startOn, end_on: endOn });
  return apiFetch<ObservationWindow>(`/api/v1/observations/window?${query}`, session);
}

function exportFilename(contentDisposition: string | null, fallback: string): string {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1]?.trim() || fallback;
  return filename.replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_");
}

export async function exportObservations(
  session: Session,
  startOn: string,
  endOn: string,
): Promise<ObservationExport> {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }

  const query = new URLSearchParams({ start_on: startOn, end_on: endOn });
  return boundedFetch<ObservationExport>(
    `${apiBaseUrl}/api/v1/observations/export?${query}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    },
    async (response, signal) => {
      if (!response.ok) {
        const error = await readApiError(response, signal);
        throw decodeApiError(error, response.status);
      }

      const filename = exportFilename(
        response.headers.get("Content-Disposition"),
        `bp7-observations-${startOn}-${endOn}.json`,
      );

      return {
        blob: await response.blob(),
        filename,
      };
    },
  );
}
