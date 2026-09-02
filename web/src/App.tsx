import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  ApiRequestError,
  createActiveChallengeCheckin,
  createBloodPressureObservation,
  getObservationWindow,
  selectActiveChallenge,
  type ObservationWindow,
} from "./lib/api";
import { supabase, supabaseConfigured } from "./lib/supabase";

const challengeActions = [
  { id: "walk-10-minutes", label: "10분 걷기" },
  { id: "sleep-routine", label: "수면 시간 지키기" },
  { id: "low-sodium-meal", label: "덜 짜게 먹기" },
] as const;

type Notice = {
  kind: "success" | "error" | "warning";
  message: string;
  reload?: boolean;
};

type PendingAction = "blood-pressure" | "challenge-selection" | "challenge-checkin" | null;

function isSessionError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError
    && (error.status === 401 || error.code === "supabase_session_required" || error.code === "supabase_session_invalid")
  );
}

function observationPeriodLabel(period: "morning" | "evening"): string {
  return period === "morning" ? "아침 · 기상 후 1시간 이내" : "저녁 · 취침 전";
}

function challengeActionLabel(actionId: string): string {
  return challengeActions.find((action) => action.id === actionId)?.label ?? actionId;
}

function koreaDate(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function Login({ onSession, recoveryMessage }: { onSession: (session: Session) => void; recoveryMessage?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setPending(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data.session) onSession(data.session);
      setMessage("메일함에서 로그인 링크를 열어주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">상균7데이즈</p>
        <h1 id="login-title">입력 기반 위험군 선별 신호</h1>
        <p className="muted">이메일 링크로 기록을 이어볼 수 있습니다.</p>
        <form onSubmit={submit}>
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button type="submit" disabled={pending}>{pending ? "보내는 중" : "이메일로 계속하기"}</button>
        </form>
        {(message || recoveryMessage) && <p className="notice" role="status">{message || recoveryMessage}</p>}
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [windowData, setWindowData] = useState<ObservationWindow | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [loadingWindow, setLoadingWindow] = useState(false);
  const today = useMemo(() => koreaDate(), []);
  const startOn = useMemo(() => koreaDate(-6), []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshWindow(session);
  }, [session, startOn, today]);

  function presentRequestError(error: unknown, context: "load" | "save") {
    if (error instanceof ApiRequestError) {
      if (isSessionError(error)) {
        void supabase?.auth.signOut({ scope: "local" });
        setSession(null);
        setNotice({ kind: "warning", message: "로그인 시간이 만료되었습니다. 이메일 링크로 다시 로그인해 주세요." });
        return;
      }
      if (error.status === 422 || error.code === "validation_error") {
        setNotice({ kind: "error", message: "입력값을 확인해 수정한 뒤 다시 저장해 주세요." });
        return;
      }
      if (error.code === "challenge_selection_locked") {
        setNotice({ kind: "error", message: "첫 체크인 후에는 이 7일 챌린지의 선택을 바꿀 수 없습니다." });
        return;
      }
      if (error.code === "active_challenge_required") {
        setNotice({ kind: "error", message: "오늘의 상태를 기록하기 전에 7일 챌린지를 먼저 선택해 주세요." });
        return;
      }
      if (error.status >= 500 || error.code === "observation_storage_not_ready") {
        setNotice(
          context === "save"
            ? {
                kind: "warning",
                message: "저장 여부를 확인하지 못했습니다. 목록을 다시 불러온 뒤 필요한 경우 다시 시도해 주세요.",
                reload: true,
              }
            : { kind: "warning", message: "기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", reload: true },
        );
        return;
      }
    }

    setNotice(
      context === "save"
        ? {
            kind: "warning",
            message: "저장 여부를 확인하지 못했습니다. 목록을 다시 불러온 뒤 필요한 경우 다시 시도해 주세요.",
            reload: true,
          }
        : { kind: "warning", message: "기록을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.", reload: true },
    );
  }

  async function refreshWindow(activeSession = session, afterSave = false) {
    if (!activeSession) return;
    setLoadingWindow(true);
    try {
      setWindowData(await getObservationWindow(activeSession, startOn, today));
    } catch (error) {
      if (afterSave && !isSessionError(error)) {
        setNotice({ kind: "warning", message: "기록은 저장했지만 목록을 새로 불러오지 못했습니다. 새로고침으로 확인해 주세요.", reload: true });
      } else {
        presentRequestError(error, "load");
      }
    } finally {
      setLoadingWindow(false);
    }
  }

  async function submitBloodPressure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    const systolic = Number(form.get("systolic"));
    const diastolic = Number(form.get("diastolic"));
    if (!Number.isInteger(systolic) || !Number.isInteger(diastolic) || systolic <= diastolic) {
      setNotice({ kind: "error", message: "수축기 값은 이완기 값보다 크게 입력해 주세요." });
      return;
    }
    setPendingAction("blood-pressure");
    try {
      await createBloodPressureObservation(session, {
        observed_on: String(form.get("observed_on")),
        period: String(form.get("period")) as "morning" | "evening",
        systolic,
        diastolic,
      });
      setNotice({ kind: "success", message: "기록을 저장했습니다." });
      await refreshWindow(session, true);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  const activeChallenge = windowData?.active_challenge ?? null;
  const activeChallengeEnded = Boolean(activeChallenge && today > activeChallenge.ends_on);
  const todayCheckin = windowData?.challenge_checkins.find(
    (checkin) => checkin.challenge_id === activeChallenge?.id && checkin.observed_on === today,
  );

  async function selectChallenge(actionId: string) {
    if (!session) return;
    setPendingAction("challenge-selection");
    try {
      await selectActiveChallenge(session, actionId);
      setNotice({ kind: "success", message: "7일 챌린지를 선택했습니다." });
      await refreshWindow(session, true);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitActiveChallengeCheckin(status: "completed" | "skipped") {
    if (!session) return;
    setPendingAction("challenge-checkin");
    try {
      await createActiveChallengeCheckin(session, { observed_on: today, status });
      setNotice({ kind: "success", message: "오늘의 상태를 기록했습니다." });
      await refreshWindow(session, true);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  if (!supabaseConfigured) {
    return <main className="auth-shell"><p className="notice">웹 환경변수를 설정한 뒤 시작할 수 있습니다.</p></main>;
  }
  if (!session) return <Login onSession={setSession} recoveryMessage={notice?.kind === "warning" ? notice.message : undefined} />;

  return (
    <main className="page-shell">
      <header className="topbar">
        <div><p className="eyebrow">상균7데이즈</p><h1>7일 기록</h1></div>
        <button className="text-button" onClick={() => void supabase?.auth.signOut()}>로그아웃</button>
      </header>
      {notice && (
        <div className={`notice notice-${notice.kind}`} role="status">
          <span>{notice.message}</span>
          {notice.reload && (
            <button className="notice-action" onClick={() => void refreshWindow()} disabled={loadingWindow}>
              {loadingWindow ? "불러오는 중" : "다시 불러오기"}
            </button>
          )}
        </div>
      )}
      <section className="grid">
        <form className="panel" onSubmit={submitBloodPressure}>
          <h2>혈압 기록</h2>
          <label>날짜<input name="observed_on" type="date" defaultValue={today} required /></label>
          <label>시간대<select name="period" defaultValue="morning"><option value="morning">아침 · 기상 후 1시간 이내</option><option value="evening">저녁 · 취침 전</option></select></label>
          <p className="period-help">가능하면 매일 비슷한 시각에 기록해 주세요.</p>
          <label>수축기<input name="systolic" type="number" min="60" max="260" required /></label>
          <label>이완기<input name="diastolic" type="number" min="30" max="160" required /></label>
          <button type="submit" disabled={pendingAction !== null}>
            {pendingAction === "blood-pressure" ? "저장 중" : "저장"}
          </button>
        </form>
        <section className="panel">
          <h2>7일 챌린지</h2>
          {!activeChallenge || activeChallengeEnded ? (
            <>
              <p className="muted">
                {!activeChallenge
                  ? "한 가지 행동을 선택하고 7일 동안 매일 상태를 기록해요."
                  : "이전 7일 챌린지가 끝났습니다. 새 행동을 선택해 시작할 수 있어요."}
              </p>
              <div className="actions">
                {challengeActions.map((action) => (
                  <div className="action" key={action.id}>
                    <span>{action.label}</span>
                    <button onClick={() => void selectChallenge(action.id)} disabled={pendingAction !== null}>선택</button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="challenge-summary">
                <strong>{challengeActionLabel(activeChallenge.action_id)}</strong>
                <span>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</span>
              </p>
              {activeChallenge.first_checkin_on ? (
                <p className="period-help">첫 체크인이 기록되어 이 7일 동안 선택을 바꿀 수 없습니다.</p>
              ) : (
                <>
                  <p className="period-help">첫 체크인 전에는 다른 행동으로 선택을 바꿀 수 있습니다.</p>
                  <div className="actions compact-actions">
                    {challengeActions.filter((action) => action.id !== activeChallenge.action_id).map((action) => (
                      <div className="action" key={action.id}>
                        <span>{action.label}</span>
                        <button className="secondary" onClick={() => void selectChallenge(action.id)} disabled={pendingAction !== null}>선택 바꾸기</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="action checkin-action">
                <span>오늘의 상태{todayCheckin ? ` · ${todayCheckin.status === "completed" ? "완료" : "건너뜀"}` : ""}</span>
                <button onClick={() => void submitActiveChallengeCheckin("completed")} disabled={pendingAction !== null}>
                  {pendingAction === "challenge-checkin" ? "저장 중" : "완료"}
                </button>
                <button className="secondary" onClick={() => void submitActiveChallengeCheckin("skipped")} disabled={pendingAction !== null}>건너뜀</button>
              </div>
            </>
          )}
        </section>
      </section>
      <section className="panel records">
        <div className="section-heading"><h2>최근 7일</h2><button className="text-button" onClick={() => void refreshWindow()} disabled={loadingWindow}>{loadingWindow ? "불러오는 중" : "새로고침"}</button></div>
        <div className="record-columns">
          <div><h3>혈압 관찰</h3><ul>{windowData?.blood_pressure_observations.map((record) => <li key={record.id}>{record.observed_on} · {observationPeriodLabel(record.period)} · {record.systolic}/{record.diastolic}</li>) || <li>기록 없음</li>}</ul></div>
          <div>
            <h3>챌린지</h3>
            <ul>
              {windowData?.challenge_checkins.map((record) => (
                <li key={`checkin-${record.id}`}>
                  {record.observed_on} · {challengeActionLabel(record.action_id)} · {record.status === "completed" ? "완료" : "건너뜀"}
                </li>
              ))}
              {windowData?.challenge_events.map((record) => (
                <li key={`legacy-${record.id}`}>
                  {record.observed_on} · {challengeActionLabel(record.action_id)} · {record.status === "completed" ? "완료" : "건너뜀"}
                </li>
              ))}
              {!windowData?.challenge_checkins.length && !windowData?.challenge_events.length && <li>기록 없음</li>}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
