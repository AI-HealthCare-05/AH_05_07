import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { readCompanionIdentity } from "../ui/companionIdentity";
import { getMySpaceCompanion } from "../ui/mySpaceCompanion";
import { readLivingChoice } from "../ui/livingChoice";
import { readMySpaceReturn, readMySpaceReturnPlace, readMySpaceRouteRequest } from "../ui/mySpaceReturn";
import PlaceableExperience from "./PlaceableExperience";
import { VerifiedAccountBinding, type AccountBindingStatus } from "./accountBinding";
import { accountPersistence, browserPersistence, type PlaceablePersistence } from "./persistence";
import "./placeable.css";

/** Auth belongs to the product entry, never to either renderer. No guest merge. */
export default function ProductPlaceableEntry() {
  const params = new URLSearchParams(window.location.search);
  const account = params.get("storage") === "account";
  const world = params.get("view") === "3d";
  const requestedReturnRoute = readMySpaceRouteRequest(window.location.search);
  const returnSpace = readMySpaceReturn(window.location.search);
  const reentry = requestedReturnRoute !== null
    && returnSpace !== null
    && returnSpace.view === requestedReturnRoute.view
    && returnSpace.storage === requestedReturnRoute.storage;
  const returnPlace = reentry ? readMySpaceReturnPlace(window.location.search) : null;
  const [companion] = useState(() => getMySpaceCompanion(readCompanionIdentity()));
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
      setAdapter(identity ? accountPersistence({
        identity,
        currentIdentity: binding.current,
        baseUrl: import.meta.env.VITE_API_BASE_URL || "",
        onSessionRejected: (rejected) => {
          const current = binding.current();
          if (!alive || !current
            || current.owner !== rejected.owner
            || current.token !== rejected.token
            || current.generation !== rejected.generation) return;
          // Match App's local session-invalid contract without allowing a stale
          // adapter to sign out a newer verified token.
          void binding.update(null);
          void auth.signOut({ scope: "local" });
        },
      }) : null);
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
  if (!adapter) return <main className="placeable-experience placeable-entry-recovery"><p className="placeable-eyebrow">SK7 · 내 공간</p><h1>계정 공간을 확인하고 있어요</h1>
    <p role="status">{status === "checking" ? "로그인 상태를 확인하고 있어요…" : status === "unavailable"
      ? "계정 공간을 불러올 수 없어요. 로그인 상태와 연결을 확인한 뒤 다시 시도해 주세요."
      : "계정 공간을 이용하려면 다시 로그인해 주세요."} 이 브라우저의 꾸미기 상태는 복사하거나 변경하지 않았어요.</p>
    {status !== "checking" && <button onClick={() => setAttempt((value) => value + 1)}>계정 공간 다시 확인</button>}
    <p><a href="/?screen=S02">오늘의 기록으로 돌아가기</a></p>
    <p><a href={`?experience=e2&view=${world ? "3d" : "classic"}&storage=browser`}>이 브라우저의 공간으로 계속하기</a></p>
  </main>;
  return <PlaceableExperience key={adapterId.current.value} adapter={adapter} world={world} reentry={reentry} returnPlace={returnPlace} companion={companion} choice={readLivingChoice(window.location.search)} accountAvailable />;
}
