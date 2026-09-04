import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  ApiRequestError,
  createActiveChallengeCheckin,
  createBloodPressureObservation,
  deleteChallengeCheckin,
  deleteBloodPressureObservation,
  exportObservations,
  getObservationWindow,
  selectActiveChallenge,
  updateBloodPressureObservation,
  updateChallengeCheckin,
  type BloodPressureObservation,
  type BloodPressureObservationInput,
  type ChallengeCheckin,
  type ObservationWindow,
} from "./lib/api";
import { getEvidenceFixture } from "./lib/evidenceFixtures";
import { allowsE2eFixture, getE2eSession } from "./lib/e2eHarness";
import { supabase, supabaseConfigured } from "./lib/supabase";

const challengeActions = [
  { id: "walk-10-minutes", label: "10분 걷기" },
  { id: "sleep-routine", label: "수면 시간 지키기" },
  { id: "low-sodium-meal", label: "덜 짜게 먹기" },
] as const;

type Notice = { kind: "success" | "error" | "warning"; message: string; reload?: boolean };
type PendingAction = "blood-pressure" | "challenge-selection" | "challenge-checkin" | "export" | null;
type WindowState = "loading" | "ready" | "refreshing" | "error" | "refresh-error";
type BloodPressureDraft = { observedOn: string; period: "morning" | "evening"; systolic: string; diastolic: string };

function koreaDate(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function emptyBloodPressureDraft(observedOn: string): BloodPressureDraft {
  return { observedOn, period: "morning", systolic: "", diastolic: "" };
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" })
    .format(new Date(`${value}T12:00:00+09:00`));
}

function journeyDayIndex(value: string): number {
  const firstJourneyDay = new Date("2026-09-01T00:00:00+09:00").getTime();
  const day = new Date(`${value}T00:00:00+09:00`).getTime();
  return ((Math.round((day - firstJourneyDay) / 86400000) % 7) + 7) % 7;
}

function periodLabel(period: "morning" | "evening"): string {
  return period === "morning" ? "아침" : "저녁";
}

function challengeLabel(actionId: string): string {
  return challengeActions.find((action) => action.id === actionId)?.label ?? "선택한 행동";
}

function checkinLabel(status: "completed" | "skipped"): string {
  return status === "completed" ? "기록함" : "건너뜀";
}

function isSessionError(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 401 || error.code === "supabase_session_required" || error.code === "supabase_session_invalid");
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
      const { data, error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) {
        setMessage("로그인 링크를 보내지 못했습니다. 이메일 주소와 연결 상태를 확인해 주세요.");
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
        <p className="muted">이메일 링크로 내 기록을 이어볼 수 있습니다.</p>
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

function Journey({ today }: { today: string }) {
  const days = ["정원 입구", "허브 정원", "그늘 아래", "나무 다리", "독서 쉼터", "한국 정자", "노을 전망"];
  const index = journeyDayIndex(today);
  return (
    <section className="journey" data-main-section="journey" aria-labelledby="journey-title">
      <div className="journey-copy">
        <p className="eyebrow">오늘의 맥락</p>
        <h2 id="journey-title">{dateLabel(today)}의 조용한 기록</h2>
        <p>측정과 오늘 선택한 행동을 각각 기록하고, 최근 7일의 사실을 차분히 살펴볼 수 있어요.</p>
      </div>
      <figure className="journey-map">
        <picture>
          <source media="(max-width: 640px)" srcSet="/assets/moa-journey-map-v1-mobile.webp" type="image/webp" />
          <img src="/assets/moa-journey-map-v1-desktop.webp" alt="" />
        </picture>
        <figcaption className="sr-only">7일 여정을 위한 일곱 개의 조용한 장소</figcaption>
      </figure>
      <ol className="day-route" aria-label="7일 여정 장소">
        {days.map((day, dayIndex) => (
          <li className={dayIndex === index ? "is-today" : ""} key={day}>
            <span aria-hidden="true">{dayIndex + 1}</span>
            <strong>{dayIndex === index ? `오늘 · ${day}` : day}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WindowFeedback({ state, onRetry }: { state: WindowState; onRetry: () => void }) {
  if (state === "loading") {
    return <section className="state-panel" aria-busy="true" aria-live="polite"><p className="eyebrow">기록을 준비하고 있어요</p><h2>최근 7일을 불러오는 중이에요</h2><p className="muted">입력 화면의 순서는 유지한 채 기록만 불러옵니다.</p></section>;
  }
  if (state === "error") {
    return <section className="state-panel state-error" role="alert"><p className="eyebrow">불러오기 실패</p><h2>기록을 불러오지 못했어요</h2><p>아직 기록이 없다는 뜻은 아니에요. 연결을 확인한 뒤 다시 시도해 주세요.</p><button onClick={onRetry}>다시 불러오기</button></section>;
  }
  return null;
}

function App() {
  const searchParameters = useMemo(() => new URLSearchParams(window.location.search), []);
  const e2eSession = useMemo(() => getE2eSession(searchParameters.get("e2e")), [searchParameters]);
  const fixture = useMemo(
    () => getEvidenceFixture(
      allowsE2eFixture()
        ? searchParameters.get("fixture") ?? import.meta.env.VITE_SK7_EVIDENCE_MODE ?? import.meta.env.VITE_SK7_EVIDENCE_FIXTURE
        : import.meta.env.VITE_SK7_EVIDENCE_MODE ?? import.meta.env.VITE_SK7_EVIDENCE_FIXTURE,
    ),
    [searchParameters],
  );
  const today = useMemo(() => fixture?.asOf ?? koreaDate(), [fixture]);
  const startOn = useMemo(() => fixture?.window?.start_on ?? koreaDate(-6), [fixture]);
  const evidenceMode = Boolean(fixture);
  const riskSignalState = fixture?.dashboard.riskSignal ?? "not-ready";
  const [session, setSession] = useState<Session | null>(e2eSession);
  const [windowData, setWindowData] = useState<ObservationWindow | null>(fixture?.window ?? null);
  const [windowState, setWindowState] = useState<WindowState>(fixture?.loadError ? "error" : fixture ? "ready" : "loading");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [bloodPressureDraft, setBloodPressureDraft] = useState<BloodPressureDraft>(() => emptyBloodPressureDraft(today));
  const [bloodPressureError, setBloodPressureError] = useState("");
  const [editingBloodPressureId, setEditingBloodPressureId] = useState<string | null>(null);
  const [pendingBloodPressureDeletion, setPendingBloodPressureDeletion] = useState<BloodPressureObservation | null>(null);
  const [editingChallengeCheckin, setEditingChallengeCheckin] = useState<ChallengeCheckin | null>(null);
  const [pendingChallengeCheckinDeletion, setPendingChallengeCheckinDeletion] = useState<ChallengeCheckin | null>(null);
  const systolicRef = useRef<HTMLInputElement>(null);
  const diastolicRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (evidenceMode || e2eSession || !supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.subscription.unsubscribe();
  }, [evidenceMode, e2eSession]);

  useEffect(() => {
    if (evidenceMode || !session) return;
    void refreshWindow(session);
  }, [evidenceMode, session, startOn, today]);

  function presentRequestError(error: unknown, context: "load" | "save" | "delete" | "export") {
    if (isSessionError(error)) {
      void supabase?.auth.signOut({ scope: "local" });
      setSession(null);
      setNotice({ kind: "warning", message: "로그인 시간이 만료되었습니다. 이메일 링크로 다시 로그인해 주세요." });
      return;
    }
    if (context === "load") {
      setWindowState(windowData ? "refresh-error" : "error");
      return;
    }
    if (error instanceof ApiRequestError && (error.status === 409 || error.code === "observation_conflict")) {
      setNotice({ kind: "error", message: "같은 날짜와 시간대에 이미 기록이 있습니다. 입력을 확인해 주세요." });
      return;
    }
    if (error instanceof ApiRequestError && error.code === "challenge_selection_locked") {
      setNotice({ kind: "error", message: "첫 체크인 후에는 이 7일 챌린지의 선택을 바꿀 수 없습니다." });
      return;
    }
    const message = context === "export"
      ? "파일을 내려받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요."
      : context === "delete"
        ? "삭제 여부를 확인하지 못했습니다. 목록을 다시 불러와 확인해 주세요."
        : "저장 여부를 확인하지 못했습니다. 목록을 다시 불러온 뒤 필요한 경우 다시 시도해 주세요.";
    setNotice({ kind: "warning", message, reload: context !== "export" });
  }

  async function refreshWindow(activeSession = session) {
    if (!activeSession || evidenceMode) return;
    setWindowState(windowData ? "refreshing" : "loading");
    try {
      setWindowData(await getObservationWindow(activeSession, startOn, today));
      setWindowState("ready");
    } catch (error) {
      presentRequestError(error, "load");
    }
  }

  function validateBloodPressure(): BloodPressureObservationInput | null {
    const systolic = Number(bloodPressureDraft.systolic);
    const diastolic = Number(bloodPressureDraft.diastolic);
    setBloodPressureError("");
    if (!Number.isInteger(systolic) || systolic < 60 || systolic > 260) {
      setBloodPressureError("수축기 값은 60에서 260 사이의 정수로 입력해 주세요.");
      systolicRef.current?.focus();
      return null;
    }
    if (!Number.isInteger(diastolic) || diastolic < 30 || diastolic > 160) {
      setBloodPressureError("이완기 값은 30에서 160 사이의 정수로 입력해 주세요.");
      diastolicRef.current?.focus();
      return null;
    }
    if (systolic <= diastolic) {
      setBloodPressureError("수축기 값은 이완기 값보다 크게 입력해 주세요.");
      systolicRef.current?.focus();
      return null;
    }
    return { observed_on: bloodPressureDraft.observedOn, period: bloodPressureDraft.period, systolic, diastolic };
  }

  async function submitBloodPressure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || evidenceMode) return;
    const payload = validateBloodPressure();
    if (!payload) return;
    setPendingAction("blood-pressure");
    try {
      if (editingBloodPressureId) {
        await updateBloodPressureObservation(session, editingBloodPressureId, payload);
        setNotice({ kind: "success", message: "혈압 기록을 수정했습니다." });
      } else {
        await createBloodPressureObservation(session, payload);
        setNotice({ kind: "success", message: "혈압 기록을 저장했습니다." });
      }
      setBloodPressureDraft(emptyBloodPressureDraft(today));
      setEditingBloodPressureId(null);
      await refreshWindow(session);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  function beginBloodPressureEdit(record: BloodPressureObservation) {
    setEditingBloodPressureId(record.id);
    setPendingBloodPressureDeletion(null);
    setBloodPressureDraft({ observedOn: record.observed_on, period: record.period, systolic: String(record.systolic), diastolic: String(record.diastolic) });
    setNotice({ kind: "warning", message: `${dateLabel(record.observed_on)} ${periodLabel(record.period)} 기록을 수정할 수 있습니다.` });
  }

  function cancelBloodPressureEdit() {
    setEditingBloodPressureId(null);
    setBloodPressureError("");
    setBloodPressureDraft(emptyBloodPressureDraft(today));
  }

  async function confirmBloodPressureDeletion() {
    if (!session || !pendingBloodPressureDeletion || evidenceMode) return;
    setPendingAction("blood-pressure");
    try {
      await deleteBloodPressureObservation(session, pendingBloodPressureDeletion.id);
      if (editingBloodPressureId === pendingBloodPressureDeletion.id) cancelBloodPressureEdit();
      setPendingBloodPressureDeletion(null);
      setNotice({ kind: "success", message: "혈압 기록을 삭제했습니다." });
      await refreshWindow(session);
    } catch (error) {
      presentRequestError(error, "delete");
    } finally {
      setPendingAction(null);
    }
  }

  async function selectChallenge(actionId: string) {
    if (!session || evidenceMode) return;
    setPendingAction("challenge-selection");
    try {
      await selectActiveChallenge(session, actionId);
      setNotice({ kind: "success", message: "7일 챌린지를 선택했습니다." });
      await refreshWindow(session);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitActiveChallengeCheckin(status: "completed" | "skipped") {
    if (!session || evidenceMode) return;
    setPendingAction("challenge-checkin");
    try {
      await createActiveChallengeCheckin(session, { observed_on: today, status });
      setNotice({ kind: "success", message: "오늘의 행동 상태를 기록했습니다." });
      await refreshWindow(session);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateOwnedChallengeCheckin(status: ChallengeCheckin["status"]) {
    if (!session || !editingChallengeCheckin || evidenceMode) return;
    setPendingAction("challenge-checkin");
    try {
      await updateChallengeCheckin(session, editingChallengeCheckin.id, status);
      setEditingChallengeCheckin(null);
      setNotice({ kind: "success", message: "챌린지 상태를 수정했습니다." });
      await refreshWindow(session);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmChallengeCheckinDeletion() {
    if (!session || !pendingChallengeCheckinDeletion || evidenceMode) return;
    setPendingAction("challenge-checkin");
    try {
      await deleteChallengeCheckin(session, pendingChallengeCheckinDeletion.id);
      setPendingChallengeCheckinDeletion(null);
      setEditingChallengeCheckin(null);
      setNotice({ kind: "success", message: "챌린지 기록을 삭제했습니다." });
      await refreshWindow(session);
    } catch (error) {
      presentRequestError(error, "delete");
    } finally {
      setPendingAction(null);
    }
  }

  async function exportRecentRecords() {
    if (!session || evidenceMode) return;
    setPendingAction("export");
    try {
      const exported = await exportObservations(session, startOn, today);
      const objectUrl = URL.createObjectURL(exported.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = exported.filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setNotice({ kind: "success", message: "최근 7일 기록을 JSON 파일로 내려받았습니다. 본인 기기에 안전하게 보관해 주세요." });
    } catch (error) {
      presentRequestError(error, "export");
    } finally {
      setPendingAction(null);
    }
  }

  if (!evidenceMode && !e2eSession && !supabaseConfigured) return <main className="auth-shell"><p className="notice notice-error">웹 환경변수를 설정한 뒤 시작할 수 있습니다.</p></main>;
  if (!evidenceMode && !session) return <Login onSession={setSession} recoveryMessage={notice?.kind === "warning" ? notice.message : undefined} />;

  const activeChallenge = windowData?.active_challenge ?? null;
  const activeChallengeEnded = Boolean(activeChallenge && today > activeChallenge.ends_on);
  const todayCheckin = windowData?.challenge_checkins.find((checkin) => checkin.challenge_id === activeChallenge?.id && checkin.observed_on === today);
  const todayMeasurement = windowData?.blood_pressure_observations.find((record) => record.observed_on === today);
  const challengeSummary = activeChallenge && !activeChallengeEnded
    ? `${challengeLabel(activeChallenge.action_id)}${evidenceMode ? ` · ${dateLabel(activeChallenge.starts_on)}–${dateLabel(activeChallenge.ends_on)}` : ""}${todayCheckin ? ` · ${checkinLabel(todayCheckin.status)}` : " · 아직 기록 없음"}`
    : "아직 선택 없음";
  const controlsDisabled = pendingAction !== null;
  const displayMeasurement = (record: BloodPressureObservation) => evidenceMode ? "•••/•• mmHg" : `${record.systolic}/${record.diastolic} mmHg`;

  return (
    <main className="page-shell" data-evidence-fixture={fixture?.name}>
      <header className="topbar" data-main-section="header">
        <div><p className="eyebrow">상균7데이즈</p><h1>7일 기록</h1>{fixture && <p className="fixture-label">검토 상태 · {fixture.name}</p>}</div>
        {!evidenceMode && <button className="text-button" onClick={() => void supabase?.auth.signOut()}>로그아웃</button>}
      </header>
      <Journey today={today} />
      {notice && <div className={`notice notice-${notice.kind}`} role="status"><span>{notice.message}</span>{notice.reload && <button className="notice-action" onClick={() => void refreshWindow()} disabled={windowState === "loading" || windowState === "refreshing"}>다시 불러오기</button>}</div>}
      {windowState === "refresh-error" && <div className="notice notice-warning" role="status"><span>새로고침에 실패했습니다. 이전에 불러온 기록을 표시하고 있어요.</span><button className="notice-action" onClick={() => void refreshWindow()}>다시 불러오기</button></div>}
      <WindowFeedback state={windowState} onRetry={() => void refreshWindow()} />
      {(windowState === "ready" || windowState === "refreshing" || windowState === "refresh-error") && (
        <>
          <section className="today-summary" data-main-section="today-summary" aria-labelledby="today-title">
            <div><p className="eyebrow">오늘의 사실</p><h2 id="today-title">{dateLabel(today)}</h2></div>
            <dl>
              <div><dt>혈압 측정</dt><dd>{todayMeasurement ? (evidenceMode ? "기록 있음 · •••/•• mmHg" : `기록 있음 · ${displayMeasurement(todayMeasurement)}`) : "아직 기록 없음"}</dd></div>
              <div><dt>선택한 행동</dt><dd>{challengeSummary}</dd></div>
            </dl>
          </section>

          <section className="work-lanes" data-main-section="record-actions" aria-label="오늘의 기록 작업">
            <form className="panel measurement-panel" onSubmit={submitBloodPressure} noValidate>
              <div className="section-heading"><div><p className="eyebrow">01 · 측정</p><h2>{editingBloodPressureId ? "혈압 기록 수정" : "혈압 측정 기록"}</h2></div>{editingBloodPressureId && <button className="text-button" type="button" onClick={cancelBloodPressureEdit} disabled={controlsDisabled}>수정 취소</button>}</div>
              <p className="muted">기록 조건을 맞추기 위한 참고 안내입니다. 수치를 해석하거나 건강 결과를 판단하지 않습니다.</p>
              <details className="measurement-guide"><summary>측정 전 확인하기</summary><ul><li>측정 전 30분 동안 카페인·흡연·운동을 피하고, 조용히 5분 쉬어요.</li><li>등을 지지하고 발을 바닥에 둔 채, 맨팔의 커프와 팔을 심장 높이에 맞춰요.</li><li>측정 중에는 말하거나 휴대폰을 보지 않아요.</li></ul></details>
              <div className="field-grid">
                <label htmlFor="observed-on">날짜<input id="observed-on" type="date" value={bloodPressureDraft.observedOn} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, observedOn: event.target.value }))} required disabled={controlsDisabled} /></label>
                <label htmlFor="period">시간대<select id="period" value={bloodPressureDraft.period} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, period: event.target.value as BloodPressureDraft["period"] }))} disabled={controlsDisabled}><option value="morning">아침 · 기상 후 1시간 이내</option><option value="evening">저녁 · 취침 전</option></select></label>
                <label htmlFor="systolic">수축기 <span className="unit">mmHg</span><input ref={systolicRef} id="systolic" type="number" min="60" max="260" inputMode="numeric" value={bloodPressureDraft.systolic} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, systolic: event.target.value }))} aria-invalid={Boolean(bloodPressureError)} aria-describedby={bloodPressureError ? "blood-pressure-error" : undefined} required disabled={controlsDisabled} /></label>
                <label htmlFor="diastolic">이완기 <span className="unit">mmHg</span><input ref={diastolicRef} id="diastolic" type="number" min="30" max="160" inputMode="numeric" value={bloodPressureDraft.diastolic} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, diastolic: event.target.value }))} aria-invalid={Boolean(bloodPressureError)} aria-describedby={bloodPressureError ? "blood-pressure-error" : undefined} required disabled={controlsDisabled} /></label>
              </div>
              {bloodPressureError && <p id="blood-pressure-error" className="field-error" role="alert">{bloodPressureError}</p>}
              <button type="submit" disabled={controlsDisabled}>{pendingAction === "blood-pressure" ? "저장 중" : editingBloodPressureId ? "수정 저장" : "혈압 기록 저장"}</button>
            </form>

            <section className="panel challenge-panel" aria-labelledby="challenge-title">
              <p className="eyebrow">02 · 오늘의 행동</p><h2 id="challenge-title">7일 챌린지</h2>
              {!activeChallenge || activeChallengeEnded ? <><p className="muted">한 가지 행동을 선택하고, 7일 동안의 참여 상태를 기록해요.</p><div className="actions">{challengeActions.map((action) => <button className="choice" key={action.id} onClick={() => void selectChallenge(action.id)} disabled={controlsDisabled}><span>{action.label}</span><small>이 행동 선택</small></button>)}</div></> : <>
                <div className="challenge-current"><span>선택한 행동</span><strong>{challengeLabel(activeChallenge.action_id)}</strong><small>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</small></div>
                {activeChallenge.first_checkin_on ? <p className="muted">첫 체크인이 기록되어 이 7일 동안 행동을 바꿀 수 없습니다.</p> : <div className="alternate-actions">{challengeActions.filter((action) => action.id !== activeChallenge.action_id).map((action) => <button className="secondary" key={action.id} onClick={() => void selectChallenge(action.id)} disabled={controlsDisabled}>{action.label}로 바꾸기</button>)}</div>}
                <div className="checkin-action"><div><span>오늘의 상태</span><strong>{todayCheckin ? checkinLabel(todayCheckin.status) : "아직 기록하지 않음"}</strong></div><div className="inline-actions"><button onClick={() => void submitActiveChallengeCheckin("completed")} disabled={controlsDisabled || Boolean(todayCheckin)}>기록함</button><button className="secondary" onClick={() => void submitActiveChallengeCheckin("skipped")} disabled={controlsDisabled || Boolean(todayCheckin)}>건너뜀</button></div></div>
              </>}
            </section>
          </section>

          <section className="panel recap" data-main-section="seven-day-dashboard" aria-labelledby="recap-title">
            <div className="section-heading"><div><p className="eyebrow">03 · 최근 7일</p><h2 id="recap-title">7일 대시보드</h2></div><div className="inline-actions">{!evidenceMode && <button className="secondary" onClick={() => void exportRecentRecords()} disabled={controlsDisabled}>{pendingAction === "export" ? "내보내는 중" : "최근 7일 내보내기"}</button>}<button className="text-button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing"}>{windowState === "refreshing" ? "새로고침 중" : "새로고침"}</button></div></div>
            <p className="muted">혈압 관찰, 챌린지 참여, 입력 기반 위험군 선별 신호 준비 상태, 이전 기록은 서로 다른 사실로 표시됩니다.</p>
            {pendingBloodPressureDeletion && <div className="confirmation" role="alert"><span>{dateLabel(pendingBloodPressureDeletion.observed_on)} 혈압 기록을 삭제할까요?</span><div className="inline-actions"><button className="danger" onClick={() => void confirmBloodPressureDeletion()} disabled={controlsDisabled}>삭제</button><button className="secondary" onClick={() => setPendingBloodPressureDeletion(null)} disabled={controlsDisabled}>취소</button></div></div>}
            {editingChallengeCheckin && <div className="confirmation" role="status"><span>{dateLabel(editingChallengeCheckin.observed_on)} · {challengeLabel(editingChallengeCheckin.action_id)} 상태</span><div className="inline-actions"><button onClick={() => void updateOwnedChallengeCheckin("completed")} disabled={controlsDisabled}>기록함</button><button className="secondary" onClick={() => void updateOwnedChallengeCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button><button className="text-button" onClick={() => setEditingChallengeCheckin(null)} disabled={controlsDisabled}>취소</button></div></div>}
            {pendingChallengeCheckinDeletion && <div className="confirmation" role="alert"><span>{dateLabel(pendingChallengeCheckinDeletion.observed_on)} 챌린지 기록을 삭제할까요?</span><div className="inline-actions"><button className="danger" onClick={() => void confirmChallengeCheckinDeletion()} disabled={controlsDisabled}>삭제</button><button className="secondary" onClick={() => setPendingChallengeCheckinDeletion(null)} disabled={controlsDisabled}>취소</button></div></div>}
            <div className="recap-columns">
              <section className="risk-signal-panel" data-dashboard-lane="risk-signal" aria-labelledby="risk-signal-title">
                <div className="risk-signal-heading"><div><p className="eyebrow">신호</p><h3 id="risk-signal-title">입력 기반 위험군 선별 신호</h3></div><span>{riskSignalState === "not-ready" ? "준비 중" : ""}</span></div>
                <p>{riskSignalState === "not-ready" ? "검증된 모델 근거가 준비되기 전에는 결과를 제공하지 않습니다." : ""}</p>
                <small>{riskSignalState === "not-ready" ? "현재는 점수, 확률, 등급을 표시하지 않습니다." : ""}</small>
              </section>
              <section data-dashboard-lane="blood-pressure" aria-labelledby="measurements-title"><h3 id="measurements-title">혈압 관찰</h3><ul className="record-list">{windowData?.blood_pressure_observations.length ? windowData.blood_pressure_observations.map((record) => <li key={record.id}><span><strong>{dateLabel(record.observed_on)}</strong> · {periodLabel(record.period)} · {displayMeasurement(record)}</span>{!evidenceMode && <span className="inline-actions"><button className="secondary record-action" onClick={() => beginBloodPressureEdit(record)} disabled={controlsDisabled}>수정</button><button className="danger record-action" onClick={() => setPendingBloodPressureDeletion(record)} disabled={controlsDisabled}>삭제</button></span>}</li>) : <li className="empty-record">아직 혈압 관찰 기록이 없습니다.</li>}</ul></section>
              <section data-dashboard-lane="challenge" aria-labelledby="checkins-title"><h3 id="checkins-title">챌린지 참여</h3><ul className="record-list">{windowData?.challenge_checkins.length ? windowData.challenge_checkins.map((record) => <li key={record.id}><span><strong>{dateLabel(record.observed_on)}</strong> · {challengeLabel(record.action_id)} · {checkinLabel(record.status)}</span>{!evidenceMode && record.challenge_id === activeChallenge?.id && !activeChallengeEnded && <span className="inline-actions"><button className="secondary record-action" onClick={() => setEditingChallengeCheckin(record)} disabled={controlsDisabled}>수정</button><button className="danger record-action" onClick={() => setPendingChallengeCheckinDeletion(record)} disabled={controlsDisabled}>삭제</button></span>}</li>) : <li className="empty-record">아직 챌린지 참여 기록이 없습니다.</li>}</ul></section>
              <section data-dashboard-lane="legacy" aria-labelledby="legacy-title"><h3 id="legacy-title">이전 기록</h3><ul className="record-list">{windowData?.challenge_events.length ? windowData.challenge_events.map((record) => <li key={record.id}><span><strong>{dateLabel(record.observed_on)}</strong> · {challengeLabel(record.action_id)} · {checkinLabel(record.status)} · 이전 기록</span></li>) : <li className="empty-record">이전 기록이 없습니다.</li>}</ul></section>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default App;
