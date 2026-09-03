import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
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
  type BloodPressureObservation,
  type BloodPressureObservationInput,
  type ChallengeCheckin,
  type ObservationWindow,
  updateChallengeCheckin,
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

type PendingAction = "blood-pressure" | "challenge-selection" | "challenge-checkin" | "export" | null;

type BloodPressureDraft = {
  observedOn: string;
  period: "morning" | "evening";
  systolic: string;
  diastolic: string;
};

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

function emptyBloodPressureDraft(observedOn: string): BloodPressureDraft {
  return { observedOn, period: "morning", systolic: "", diastolic: "" };
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
  const today = useMemo(() => koreaDate(), []);
  const startOn = useMemo(() => koreaDate(-6), []);
  const [session, setSession] = useState<Session | null>(null);
  const [windowData, setWindowData] = useState<ObservationWindow | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [bloodPressureDraft, setBloodPressureDraft] = useState<BloodPressureDraft>(() => emptyBloodPressureDraft(today));
  const [editingBloodPressureId, setEditingBloodPressureId] = useState<string | null>(null);
  const [pendingBloodPressureDeletion, setPendingBloodPressureDeletion] = useState<BloodPressureObservation | null>(null);
  const [editingChallengeCheckin, setEditingChallengeCheckin] = useState<ChallengeCheckin | null>(null);
  const [pendingChallengeCheckinDeletion, setPendingChallengeCheckinDeletion] = useState<ChallengeCheckin | null>(null);

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

  function presentRequestError(error: unknown, context: "load" | "save" | "delete" | "export") {
    if (error instanceof ApiRequestError) {
      if (isSessionError(error)) {
        void supabase?.auth.signOut({ scope: "local" });
        setSession(null);
        setNotice({ kind: "warning", message: "로그인 시간이 만료되었습니다. 이메일 링크로 다시 로그인해 주세요." });
        return;
      }
      if (error.status === 422 || error.code === "validation_error") {
        setNotice({
          kind: "error",
          message: context === "export" ? "내보낼 날짜 범위를 확인한 뒤 다시 시도해 주세요." : "입력값을 확인해 수정한 뒤 다시 저장해 주세요.",
        });
        return;
      }
      if (error.status === 404 || error.code === "observation_not_found") {
        setNotice({ kind: "warning", message: "기록을 찾을 수 없습니다. 목록을 다시 불러와 확인해 주세요.", reload: true });
        return;
      }
      if (error.status === 409 || error.code === "observation_conflict") {
        setNotice({ kind: "error", message: "같은 날짜와 시간대에 이미 기록이 있습니다. 입력을 확인해 주세요." });
        return;
      }
      if (error.code === "challenge_selection_locked") {
        setNotice({ kind: "error", message: "첫 체크인 후에는 이 7일 챌린지의 선택을 바꿀 수 없습니다." });
        return;
      }
      if (error.code === "challenge_checkin_not_editable") {
        setNotice({ kind: "warning", message: "진행 중인 7일 챌린지의 기록만 수정하거나 삭제할 수 있습니다.", reload: true });
        return;
      }
      if (error.code === "active_challenge_required") {
        setNotice({ kind: "error", message: "오늘의 상태를 기록하기 전에 7일 챌린지를 먼저 선택해 주세요." });
        return;
      }
      if (error.status >= 500 || error.code === "observation_storage_not_ready") {
        setNotice(
          context === "export"
            ? { kind: "warning", message: "파일을 내려받지 못했습니다. 잠시 후 다시 시도해 주세요." }
            : context === "save"
            ? {
                kind: "warning",
                message: "저장 여부를 확인하지 못했습니다. 목록을 다시 불러온 뒤 필요한 경우 다시 시도해 주세요.",
                reload: true,
              }
            : context === "delete"
              ? {
                  kind: "warning",
                  message: "삭제 여부를 확인하지 못했습니다. 목록을 다시 불러와 확인해 주세요.",
                  reload: true,
                }
            : { kind: "warning", message: "기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", reload: true },
        );
        return;
      }
    }

    setNotice(
      context === "export"
        ? { kind: "warning", message: "파일을 내려받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요." }
        : context === "save"
        ? {
            kind: "warning",
            message: "저장 여부를 확인하지 못했습니다. 목록을 다시 불러온 뒤 필요한 경우 다시 시도해 주세요.",
            reload: true,
          }
        : context === "delete"
          ? {
              kind: "warning",
              message: "삭제 여부를 확인하지 못했습니다. 목록을 다시 불러와 확인해 주세요.",
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
    const systolic = Number(bloodPressureDraft.systolic);
    const diastolic = Number(bloodPressureDraft.diastolic);
    if (!Number.isInteger(systolic) || !Number.isInteger(diastolic) || systolic <= diastolic) {
      setNotice({ kind: "error", message: "수축기 값은 이완기 값보다 크게 입력해 주세요." });
      return;
    }
    const payload: BloodPressureObservationInput = {
      observed_on: bloodPressureDraft.observedOn,
      period: bloodPressureDraft.period,
      systolic,
      diastolic,
    };
    setPendingAction("blood-pressure");
    try {
      if (editingBloodPressureId) {
        await updateBloodPressureObservation(session, editingBloodPressureId, payload);
        setNotice({ kind: "success", message: "기록을 수정했습니다." });
      } else {
        await createBloodPressureObservation(session, payload);
        setNotice({ kind: "success", message: "기록을 저장했습니다." });
      }
      setBloodPressureDraft(emptyBloodPressureDraft(today));
      setEditingBloodPressureId(null);
      await refreshWindow(session, true);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  function beginBloodPressureEdit(record: BloodPressureObservation) {
    setEditingBloodPressureId(record.id);
    setPendingBloodPressureDeletion(null);
    setBloodPressureDraft({
      observedOn: record.observed_on,
      period: record.period,
      systolic: String(record.systolic),
      diastolic: String(record.diastolic),
    });
    setNotice({ kind: "warning", message: "기록을 수정할 수 있습니다. 값을 확인한 뒤 저장해 주세요." });
  }

  function cancelBloodPressureEdit() {
    setEditingBloodPressureId(null);
    setBloodPressureDraft(emptyBloodPressureDraft(today));
    setNotice(null);
  }

  async function confirmBloodPressureDeletion() {
    if (!session || !pendingBloodPressureDeletion) return;
    setPendingAction("blood-pressure");
    try {
      await deleteBloodPressureObservation(session, pendingBloodPressureDeletion.id);
      if (editingBloodPressureId === pendingBloodPressureDeletion.id) cancelBloodPressureEdit();
      setPendingBloodPressureDeletion(null);
      setNotice({ kind: "success", message: "기록을 삭제했습니다." });
      await refreshWindow(session, true);
    } catch (error) {
      presentRequestError(error, "delete");
    } finally {
      setPendingAction(null);
    }
  }

  function beginChallengeCheckinEdit(record: ChallengeCheckin) {
    setEditingChallengeCheckin(record);
    setPendingChallengeCheckinDeletion(null);
    setNotice({ kind: "warning", message: "날짜와 행동은 유지한 채 상태만 수정할 수 있습니다." });
  }

  async function updateOwnedChallengeCheckin(status: ChallengeCheckin["status"]) {
    if (!session || !editingChallengeCheckin) return;
    setPendingAction("challenge-checkin");
    try {
      await updateChallengeCheckin(session, editingChallengeCheckin.id, status);
      setEditingChallengeCheckin(null);
      setNotice({ kind: "success", message: "챌린지 상태를 수정했습니다." });
      await refreshWindow(session, true);
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmChallengeCheckinDeletion() {
    if (!session || !pendingChallengeCheckinDeletion) return;
    setPendingAction("challenge-checkin");
    try {
      await deleteChallengeCheckin(session, pendingChallengeCheckinDeletion.id);
      if (editingChallengeCheckin?.id === pendingChallengeCheckinDeletion.id) setEditingChallengeCheckin(null);
      setPendingChallengeCheckinDeletion(null);
      setNotice({ kind: "success", message: "챌린지 기록을 삭제했습니다." });
      await refreshWindow(session, true);
    } catch (error) {
      presentRequestError(error, "delete");
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

  async function exportRecentRecords() {
    if (!session) return;
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
      setNotice({
        kind: "success",
        message: "최근 7일 기록을 JSON 파일로 내려받았습니다. 파일에는 날짜, 혈압, 챌린지 상태가 포함되므로 안전한 곳에 보관해 주세요.",
      });
    } catch (error) {
      presentRequestError(error, "export");
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
          <div className="section-heading">
            <h2>{editingBloodPressureId ? "혈압 기록 수정" : "혈압 기록"}</h2>
            {editingBloodPressureId && (
              <button className="text-button" type="button" onClick={cancelBloodPressureEdit} disabled={pendingAction !== null}>
                수정 취소
              </button>
            )}
          </div>
          <aside className="measurement-checklist" aria-labelledby="measurement-checklist-title">
            <h3 id="measurement-checklist-title">측정 전 확인</h3>
            <ul>
              <li>측정 전 30분 동안 카페인·흡연·운동을 피하고, 화장실을 다녀온 뒤 시작해요.</li>
              <li>조용히 5분 쉬고, 등을 지지한 채 발을 바닥에 두고 다리를 꼬지 않아요.</li>
              <li>맨팔에 커프를 두르고 팔을 심장 높이에서 지지해요. 측정 중에는 말하거나 휴대폰을 보지 않아요.</li>
            </ul>
            <p>
              기록 조건을 맞추기 위한 참고 안내이며, 진단·치료·예방·응급 판단을 제공하지 않습니다. {" "}
              <a href="https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home" target="_blank" rel="noreferrer">
                가정 혈압 측정 안내 보기
              </a>
            </p>
          </aside>
          <label>
            날짜
            <input
              name="observed_on"
              type="date"
              value={bloodPressureDraft.observedOn}
              onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, observedOn: event.target.value }))}
              required
            />
          </label>
          <label>
            시간대
            <select
              name="period"
              value={bloodPressureDraft.period}
              onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, period: event.target.value as "morning" | "evening" }))}
            >
              <option value="morning">아침 · 기상 후 1시간 이내</option>
              <option value="evening">저녁 · 취침 전</option>
            </select>
          </label>
          <p className="period-help">가능하면 매일 비슷한 시각에 기록해 주세요.</p>
          <label>
            수축기
            <input
              name="systolic"
              type="number"
              min="60"
              max="260"
              value={bloodPressureDraft.systolic}
              onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, systolic: event.target.value }))}
              required
            />
          </label>
          <label>
            이완기
            <input
              name="diastolic"
              type="number"
              min="30"
              max="160"
              value={bloodPressureDraft.diastolic}
              onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, diastolic: event.target.value }))}
              required
            />
          </label>
          <button type="submit" disabled={pendingAction !== null}>
            {pendingAction === "blood-pressure" ? "저장 중" : editingBloodPressureId ? "수정 저장" : "저장"}
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
        <div className="section-heading">
          <h2>최근 7일</h2>
          <div className="inline-actions">
            <button className="secondary" onClick={() => void exportRecentRecords()} disabled={pendingAction !== null}>
              {pendingAction === "export" ? "내보내는 중" : "최근 7일 내보내기"}
            </button>
            <button className="text-button" onClick={() => void refreshWindow()} disabled={loadingWindow}>
              {loadingWindow ? "불러오는 중" : "새로고침"}
            </button>
          </div>
        </div>
        <p className="export-help">내보낸 파일에는 날짜, 혈압, 챌린지 상태가 포함됩니다. 본인 기기에 안전하게 보관해 주세요.</p>
        {pendingBloodPressureDeletion && (
          <div className="delete-confirmation" role="alert">
            <span>선택한 혈압 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.</span>
            <div className="inline-actions">
              <button className="danger" onClick={() => void confirmBloodPressureDeletion()} disabled={pendingAction !== null}>삭제</button>
              <button className="secondary" onClick={() => setPendingBloodPressureDeletion(null)} disabled={pendingAction !== null}>취소</button>
            </div>
          </div>
        )}
        {editingChallengeCheckin && (
          <div className="checkin-edit" role="status">
            <span>
              {editingChallengeCheckin.observed_on} · {challengeActionLabel(editingChallengeCheckin.action_id)} 상태 수정
            </span>
            <div className="inline-actions">
              <button onClick={() => void updateOwnedChallengeCheckin("completed")} disabled={pendingAction !== null}>완료</button>
              <button className="secondary" onClick={() => void updateOwnedChallengeCheckin("skipped")} disabled={pendingAction !== null}>건너뜀</button>
              <button className="text-button" onClick={() => setEditingChallengeCheckin(null)} disabled={pendingAction !== null}>수정 취소</button>
            </div>
          </div>
        )}
        {pendingChallengeCheckinDeletion && (
          <div className="delete-confirmation" role="alert">
            <span>선택한 챌린지 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.</span>
            <div className="inline-actions">
              <button className="danger" onClick={() => void confirmChallengeCheckinDeletion()} disabled={pendingAction !== null}>삭제</button>
              <button className="secondary" onClick={() => setPendingChallengeCheckinDeletion(null)} disabled={pendingAction !== null}>취소</button>
            </div>
          </div>
        )}
        <div className="record-columns">
          <div>
            <h3>혈압 관찰</h3>
            <ul>
              {windowData?.blood_pressure_observations.length ? windowData.blood_pressure_observations.map((record) => (
                <li className="record-item" key={record.id}>
                  <span>{record.observed_on} · {observationPeriodLabel(record.period)} · {record.systolic}/{record.diastolic}</span>
                  <span className="inline-actions">
                    <button className="secondary record-action" onClick={() => beginBloodPressureEdit(record)} disabled={pendingAction !== null}>수정</button>
                    <button className="danger record-action" onClick={() => setPendingBloodPressureDeletion(record)} disabled={pendingAction !== null}>삭제</button>
                  </span>
                </li>
              )) : <li>기록 없음</li>}
            </ul>
          </div>
          <div>
            <h3>챌린지</h3>
            <ul>
              {windowData?.challenge_checkins.map((record) => (
                <li className="record-item" key={`checkin-${record.id}`}>
                  <span>{record.observed_on} · {challengeActionLabel(record.action_id)} · {record.status === "completed" ? "완료" : "건너뜀"}</span>
                  {record.challenge_id === activeChallenge?.id && !activeChallengeEnded && (
                    <span className="inline-actions">
                      <button className="secondary record-action" onClick={() => beginChallengeCheckinEdit(record)} disabled={pendingAction !== null}>수정</button>
                      <button className="danger record-action" onClick={() => setPendingChallengeCheckinDeletion(record)} disabled={pendingAction !== null}>삭제</button>
                    </span>
                  )}
                </li>
              ))}
              {windowData?.challenge_events.map((record) => (
                <li key={`legacy-${record.id}`}>
                  {record.observed_on} · {challengeActionLabel(record.action_id)} · {record.status === "completed" ? "완료" : "건너뜀"} · 이전 기록
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
