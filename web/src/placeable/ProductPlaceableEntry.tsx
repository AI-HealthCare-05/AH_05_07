import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { readLivingChoice } from "../ui/livingChoice";
import PlaceableExperience from "./PlaceableExperience";
import { VerifiedAccountBinding, type AccountBindingStatus } from "./accountBinding";
import { accountPersistence, browserPersistence, type PlaceablePersistence } from "./persistence";
import "./placeable.css";

/** Auth belongs to the product entry, never to either renderer. No guest merge. */
export default function ProductPlaceableEntry() {
  const params = new URLSearchParams(window.location.search);
  const account = params.get("storage") === "account";
  const world = params.get("view") === "3d";
  const [browser] = useState(() => browserPersistence());
  const [adapter, setAdapter] = useState<PlaceablePersistence | null>(account ? null : browser);
  const [status, setStatus] = useState<AccountBindingStatus>("checking");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!account) return;
    const auth = supabase?.auth;
    if (!auth) { setStatus("unavailable"); return; }
    let alive = true, observed = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const binding = new VerifiedAccountBinding(async (token) => {
      // Start outside the synchronous auth callback, which may own the SDK lock.
      // A bounded verification failure leaves account storage unavailable.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const { data, error } = await Promise.race([
          new Promise<Awaited<ReturnType<typeof auth.getUser>>>((resolve, reject) => {
            const start = setTimeout(() => {
              timers.delete(start);
              void auth.getUser(token).then(resolve, reject);
            }, 0);
            timers.add(start);
          }),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("Verification timed out")), 8000);
            timers.add(timer);
          }),
        ]);
        return error ? null : data.user?.id ?? null;
      } finally { if (timer) { clearTimeout(timer); timers.delete(timer); } }
    }, (identity, nextStatus) => {
      if (!alive) return;
      setStatus(nextStatus);
      setAdapter(identity ? accountPersistence({ identity, currentIdentity: binding.current,
        baseUrl: import.meta.env.VITE_API_BASE_URL || "" }) : null);
    });
    const update = (session: Session | null) => {
      if (alive) void binding.update(session ? { owner: session.user.id, token: session.access_token } : null);
    };
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      observed = true; update(session);
    });
    void auth.getSession().then(({ data, error }) => { if (!observed) update(error ? null : data.session); })
      .catch(() => { if (!observed) update(null); });
    return () => {
      alive = false; binding.dispose(); subscription.unsubscribe(); timers.forEach(clearTimeout); timers.clear();
    };
  }, [account, attempt]);
  // Each verified identity gets a fresh controller; old in-flight work cannot publish.
  const adapterId = useRef({ adapter, value: 0 });
  if (adapterId.current.adapter !== adapter) adapterId.current = { adapter, value: adapterId.current.value + 1 };
  if (!adapter) return <main className="placeable-experience"><h1>My first placeable</h1>
    <p role="status">{status === "checking" ? "Verifying account session…" : status === "unavailable"
      ? "Account storage is unavailable. Check your sign-in and connection, then retry."
      : "Sign in to use account storage."} No browser placement has been copied or changed.</p>
    {status !== "checking" && <button onClick={() => setAttempt((value) => value + 1)}>Retry account session</button>}
    <p><a href="/">Return to sign in</a></p>
    <p><a href={`?experience=e2&view=${world ? "3d" : "classic"}&storage=browser`}>Choose browser-only storage</a></p>
  </main>;
  return <PlaceableExperience key={adapterId.current.value} adapter={adapter} world={world} choice={readLivingChoice(window.location.search)} accountAvailable />;
}
