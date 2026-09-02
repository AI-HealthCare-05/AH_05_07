import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  createBloodPressureObservation,
  createChallengeEvent,
  getObservationWindow,
  type ObservationWindow,
} from "./lib/api";
import { supabase, supabaseConfigured } from "./lib/supabase";

const challengeActions = [
  { id: "walk-10-minutes", label: "10분 걷기" },
  { id: "sleep-routine", label: "수면 시간 지키기" },
  { id: "low-sodium-meal", label: "덜 짜게 먹기" },
] as const;

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

function Login({ onSession }: { onSession: (session: Session) => void }) {
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
        {message && <p className="notice" role="status">{message}</p>}
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [windowData, setWindowData] = useState<ObservationWindow | null>(null);
  const [notice, setNotice] = useState("");
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

  async function refreshWindow(activeSession = session) {
    if (!activeSession) return;
    try {
      setWindowData(await getObservationWindow(activeSession, startOn, today));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "기록을 불러오지 못했습니다.");
    }
  }

  async function submitBloodPressure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    const systolic = Number(form.get("systolic"));
    const diastolic = Number(form.get("diastolic"));
    if (systolic <= diastolic) {
      setNotice("수축기 값은 이완기 값보다 크게 입력해 주세요.");
      return;
    }
    try {
      await createBloodPressureObservation(session, {
        observed_on: String(form.get("observed_on")),
        period: String(form.get("period")) as "morning" | "evening",
        systolic,
        diastolic,
      });
      setNotice("기록을 저장했습니다.");
      await refreshWindow();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "기록을 저장하지 못했습니다.");
    }
  }

  async function submitChallenge(actionId: string, status: "completed" | "skipped") {
    if (!session) return;
    try {
      await createChallengeEvent(session, { observed_on: today, action_id: actionId, status });
      setNotice("오늘의 상태를 기록했습니다.");
      await refreshWindow();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "상태를 저장하지 못했습니다.");
    }
  }

  if (!supabaseConfigured) {
    return <main className="auth-shell"><p className="notice">웹 환경변수를 설정한 뒤 시작할 수 있습니다.</p></main>;
  }
  if (!session) return <Login onSession={setSession} />;

  return (
    <main className="page-shell">
      <header className="topbar">
        <div><p className="eyebrow">상균7데이즈</p><h1>7일 기록</h1></div>
        <button className="text-button" onClick={() => void supabase?.auth.signOut()}>로그아웃</button>
      </header>
      {notice && <p className="notice" role="status">{notice}</p>}
      <section className="grid">
        <form className="panel" onSubmit={submitBloodPressure}>
          <h2>혈압 기록</h2>
          <label>날짜<input name="observed_on" type="date" defaultValue={today} required /></label>
          <label>시간대<select name="period" defaultValue="morning"><option value="morning">아침 · 기상 후 1시간 이내</option><option value="evening">저녁 · 취침 전</option></select></label>
          <p className="period-help">가능하면 매일 비슷한 시각에 기록해 주세요.</p>
          <label>수축기<input name="systolic" type="number" min="60" max="260" required /></label>
          <label>이완기<input name="diastolic" type="number" min="30" max="160" required /></label>
          <button type="submit">저장</button>
        </form>
        <section className="panel">
          <h2>오늘의 선택</h2>
          <div className="actions">
            {challengeActions.map((action) => (
              <div className="action" key={action.id}>
                <span>{action.label}</span>
                <button onClick={() => void submitChallenge(action.id, "completed")}>완료</button>
                <button className="secondary" onClick={() => void submitChallenge(action.id, "skipped")}>건너뜀</button>
              </div>
            ))}
          </div>
        </section>
      </section>
      <section className="panel records">
        <div className="section-heading"><h2>최근 7일</h2><button className="text-button" onClick={() => void refreshWindow()}>새로고침</button></div>
        <div className="record-columns">
          <div><h3>혈압 관찰</h3><ul>{windowData?.blood_pressure_observations.map((record) => <li key={record.id}>{record.observed_on} · {observationPeriodLabel(record.period)} · {record.systolic}/{record.diastolic}</li>) || <li>기록 없음</li>}</ul></div>
          <div><h3>챌린지</h3><ul>{windowData?.challenge_events.map((record) => <li key={record.id}>{record.observed_on} · {challengeActionLabel(record.action_id)} · {record.status === "completed" ? "완료" : "건너뜀"}</li>) || <li>기록 없음</li>}</ul></div>
        </div>
      </section>
    </main>
  );
}

export default App;
