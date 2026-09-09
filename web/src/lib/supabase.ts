import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const authUrl = url ? `${url.replace(/\/$/, "")}/auth/v1` : null;
// @supabase/supabase-js 2.112.4 keeps SupabaseClient.storageKey protected; use its exact default key contract.
const storageKey = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : null;

export const supabase = url && publishableKey ? createClient(url, publishableKey) : null;
export const supabaseConfigured = supabase !== null;

export async function requestTokenBoundLocalLogout(accessToken: string): Promise<void> {
  if (!authUrl || !publishableKey) return;

  const response = await fetch(`${authUrl}/logout?scope=local`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
      "Content-Type": "application/json;charset=UTF-8",
      "X-Supabase-Api-Version": "2024-01-01",
    },
  });
  if (!response.ok) throw new Error(`Supabase token-bound logout failed with status ${response.status}`);
}

type PersistedSessionCleanup = "removed" | "missing" | "different" | "malformed";

export function removePersistedSessionIfAccessToken(accessToken: string): PersistedSessionCleanup {
  if (!storageKey || typeof window === "undefined") return "missing";

  try {
    const rawSession = window.localStorage.getItem(storageKey);
    if (rawSession === null) return "missing";

    const parsed: unknown = JSON.parse(rawSession);
    if (
      typeof parsed !== "object"
      || parsed === null
      || !("access_token" in parsed)
      || !("refresh_token" in parsed)
      || typeof parsed.access_token !== "string"
      || typeof parsed.refresh_token !== "string"
    ) return "malformed";
    if (parsed.access_token !== accessToken) return "different";

    window.localStorage.removeItem(storageKey);
    return "removed";
  } catch {
    return "malformed";
  }
}
