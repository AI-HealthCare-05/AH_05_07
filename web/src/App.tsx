import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { Scene, SceneShell } from "./components/SceneShell";
import {
  ApiRequestError,
  createActiveChallengeCheckin,
  createBloodPressureObservation,
  deleteBloodPressureObservation,
  deleteChallengeCheckin,
  exportObservations,
  getObservationWindow,
  selectActiveChallenge,
  updateBloodPressureObservation,
  updateChallengeCheckin,
  type BloodPressureObservation,
  type BloodPressureObservationInput,
  type ChallengeCheckin,
  type ChallengeEvent,
  type ObservationWindow,
} from "./lib/api";
import { getEvidenceFixture } from "./lib/evidenceFixtures";
import { allowsE2eFixture, getE2eSession } from "./lib/e2eHarness";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { journeyCopy, parseScreen, type ScreenId } from "./ui/journey";

const challengeActions = [
  { id: "walk-10-minutes", label: "10분 걷기", note: "가볍게 바깥 공기를 만나는 시간" },
  { id: "sleep-routine", label: "수면 시간 지키기", note: "정한 시간에 하루를 천천히 닫기" },
  { id: "low-sodium-meal", label: "덜 짜게 먹기", note: "한 끼의 선택을 담백하게 기록하기" },
] as const;

type Notice = { kind: "success" | "error" | "warning"; message: string; reload?: boolean };
type PendingAction = "blood-pressure" | "challenge-selection" | "challenge-checkin" | "export" | null;
type WindowState = "loading" | "ready" | "refreshing" | "error" | "refresh-error";
type DashboardWindow = "current" | "prior";
type BloodPressureDraft = { observedOn: string; period: "morning" | "evening"; systolic: string; diastolic: string };
type RecordBrowseItem =
  | { key: string; kind: "blood-pressure"; record: BloodPressureObservation }
  | { key: string; kind: "challenge-checkin"; record: ChallengeCheckin }
  | { key: string; kind: "legacy"; record: ChallengeEvent };

function koreaDate(): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDate(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00+09:00`);
  date.setDate(date.getDate() + offset);
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dashboardWindowBounds(today: string, window: DashboardWindow): Pick<ObservationWindow, "start_on" | "end_on"> {
  return window === "prior"
    ? { start_on: shiftDate(today, -13), end_on: shiftDate(today, -7) }
    : { start_on: shiftDate(today, -6), end_on: today };
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" })
    .format(new Date(`${value}T12:00:00+09:00`));
}

function emptyBloodPressureDraft(observedOn: string): BloodPressureDraft {
  return { observedOn, period: "morning", systolic: "", diastolic: "" };
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
  return error instanceof ApiRequestError
    && (error.status === 401 || error.code === "supabase_session_required" || error.code === "supabase_session_invalid");
}

function isWindowEmpty(windowData: ObservationWindow | null): boolean {
  return Boolean(windowData)
    && !windowData?.active_challenge
    && windowData?.blood_pressure_observations.length === 0
    && windowData?.challenge_checkins.length === 0
    && windowData?.challenge_events.length === 0;
}

function Login({ onSession, recoveryMessage }: { onSession: (session: Session) => void; recoveryMessage?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || pending) return;
    setPending(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) {
        setMessage("로그인 링크를 보내지 못했습니다. 이메일 주소와 연결 상태를 확인해 주세요.");
        return;
      }
      if (data.session) onSession(data.session);
      setMessage("로그인 링크를 보냈어요. 메일함에서 링크를 열면 이 기기에서 기록을 이어갈 수 있어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="welcome-shell" data-scene="S01">
      <div className="welcome-landscape" aria-hidden="true"><span /><span /><span /></div>
      <section className="welcome-card" aria-labelledby="login-title">
        <span className="welcome-orb" aria-hidden="true"><i /><i /></span>
        <p className="eyebrow">{journeyCopy.S01.eyebrow}</p>
        <h1 id="login-title">{journeyCopy.S01.title}</h1>
        <p className="scene-body">{journeyCopy.S01.body}</p>
        <form onSubmit={submit}>
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button type="submit" disabled={pending}>{pending ? "보내는 중" : "이메일로 계속하기"}</button>
        </form>
        {(message || recoveryMessage) && <p className="notice notice-warning" role="status">{message || recoveryMessage}</p>}
        <p className="welcome-footnote">혈압 관찰과 챌린지 참여는 서로 다른 사실로 표시됩니다.</p>
      </section>
    </main>
  );
}

function App() {
  const initialSearch = useMemo(() => new URLSearchParams(window.location.search), []);
  const e2eSession = useMemo(() => getE2eSession(initialSearch.get("e2e")), [initialSearch]);
  const fixture = useMemo(
    () => getEvidenceFixture(
      allowsE2eFixture()
        ? initialSearch.get("fixture") ?? import.meta.env.VITE_SK7_EVIDENCE_MODE ?? import.meta.env.VITE_SK7_EVIDENCE_FIXTURE
        : import.meta.env.VITE_SK7_EVIDENCE_MODE ?? import.meta.env.VITE_SK7_EVIDENCE_FIXTURE,
    ),
    [initialSearch],
  );
  const today = useMemo(() => fixture?.asOf ?? koreaDate(), [fixture]);
  const evidenceMode = Boolean(fixture);
  const [requestedScreen, setRequestedScreen] = useState<ScreenId>(() => parseScreen(initialSearch.get("screen")));
  const [dashboardWindow, setDashboardWindow] = useState<DashboardWindow>(() => initialSearch.get("dashboard_window") === "prior" ? "prior" : "current");
  const selectedBounds = useMemo(
    () => fixture?.window && dashboardWindow === "current" ? fixture.window : dashboardWindowBounds(today, dashboardWindow),
    [dashboardWindow, fixture, today],
  );
  const startOn = selectedBounds.start_on;
  const endOn = selectedBounds.end_on;
  const isPriorDashboard = dashboardWindow === "prior";
  const [session, setSession] = useState<Session | null>(e2eSession);
  const [windowData, setWindowData] = useState<ObservationWindow | null>(fixture?.window ?? null);
  const [windowState, setWindowState] = useState<WindowState>(fixture?.loadError ? "error" : fixture ? "ready" : "loading");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmedSave, setConfirmedSave] = useState(false);
  const [bloodPressureDraft, setBloodPressureDraft] = useState<BloodPressureDraft>(() => emptyBloodPressureDraft(today));
  const [bloodPressureError, setBloodPressureError] = useState("");
  const [editingBloodPressureId, setEditingBloodPressureId] = useState<string | null>(null);
  const [pendingBloodPressureDeletion, setPendingBloodPressureDeletion] = useState<BloodPressureObservation | null>(null);
  const [editingChallengeCheckin, setEditingChallengeCheckin] = useState<ChallengeCheckin | null>(null);
  const [pendingChallengeCheckinDeletion, setPendingChallengeCheckinDeletion] = useState<ChallengeCheckin | null>(null);
  const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(() => initialSearch.get("record"));
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
  }, [endOn, evidenceMode, session, startOn]);

  useEffect(() => {
    const onPopState = () => {
      const search = new URLSearchParams(window.location.search);
      setRequestedScreen(parseScreen(search.get("screen")));
      setSelectedRecordKey(search.get("record"));
      setDashboardWindow(search.get("dashboard_window") === "prior" ? "prior" : "current");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(screen: ScreenId, recordKey?: string | null, replace = false) {
    const url = new URL(window.location.href);
    if (screen === "S02") url.searchParams.delete("screen");
    else url.searchParams.set("screen", screen);
    if (recordKey) url.searchParams.set("record", recordKey);
    else url.searchParams.delete("record");
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setRequestedScreen(screen);
    setSelectedRecordKey(recordKey ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
      setNotice({ kind: "error", message: "첫 체크인이 있어 선택한 행동은 바꿀 수 없어요." });
      return;
    }
    const message = context === "export"
      ? "파일을 내려받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요."
      : context === "delete"
        ? "삭제 여부를 확인하지 못했습니다. 목록을 다시 불러와 확인해 주세요."
        : "저장 여부를 확인하지 못했어요. 자동으로 다시 보내지 않았습니다. 기록을 새로고침해 확인해 주세요.";
    setNotice({ kind: "warning", message, reload: context !== "export" });
  }

  async function refreshWindow(activeSession = session) {
    if (!activeSession || evidenceMode) return;
    setWindowState(windowData ? "refreshing" : "loading");
    try {
      setWindowData(await getObservationWindow(activeSession, startOn, endOn));
      setWindowState("ready");
    } catch (error) {
      presentRequestError(error, "load");
    }
  }

  function selectDashboardWindow(nextWindow: DashboardWindow) {
    if (evidenceMode || nextWindow === dashboardWindow) return;
    const url = new URL(window.location.href);
    if (nextWindow === "prior") url.searchParams.set("dashboard_window", "prior");
    else url.searchParams.delete("dashboard_window");
    window.history.pushState({}, "", url);
    setSelectedRecordKey(null);
    setWindowData(null);
    setWindowState("loading");
    setDashboardWindow(nextWindow);
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
    if (!session || evidenceMode || isPriorDashboard || pendingAction) return;
    const payload = validateBloodPressure();
    if (!payload) return;
    setPendingAction("blood-pressure");
    try {
      if (editingBloodPressureId) {
        await updateBloodPressureObservation(session, editingBloodPressureId, payload);
        setNotice({ kind: "success", message: "혈압 기록을 수정했습니다." });
      } else {
        await createBloodPressureObservation(session, payload);
        setNotice(null);
      }
      setBloodPressureDraft(emptyBloodPressureDraft(today));
      setEditingBloodPressureId(null);
      setConfirmedSave(true);
      await refreshWindow(session);
      navigate("S05");
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
    navigate("S04");
  }

  function cancelBloodPressureEdit() {
    setEditingBloodPressureId(null);
    setBloodPressureError("");
    setBloodPressureDraft(emptyBloodPressureDraft(today));
    navigate(selectedRecordKey ? "S09" : "S08", selectedRecordKey);
  }

  async function confirmBloodPressureDeletion() {
    if (!session || !pendingBloodPressureDeletion || evidenceMode || isPriorDashboard || pendingAction) return;
    setPendingAction("blood-pressure");
    try {
      await deleteBloodPressureObservation(session, pendingBloodPressureDeletion.id);
      setPendingBloodPressureDeletion(null);
      setSelectedRecordKey(null);
      setNotice({ kind: "success", message: "혈압 기록을 삭제했습니다." });
      await refreshWindow(session);
      navigate("S08");
    } catch (error) {
      presentRequestError(error, "delete");
    } finally {
      setPendingAction(null);
    }
  }

  async function selectChallenge(actionId: string) {
    if (!session || evidenceMode || isPriorDashboard || pendingAction) return;
    setPendingAction("challenge-selection");
    try {
      await selectActiveChallenge(session, actionId);
      setNotice({ kind: "success", message: "7일 챌린지를 선택했습니다." });
      await refreshWindow(session);
      navigate("S02");
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitActiveChallengeCheckin(status: "completed" | "skipped") {
    if (!session || evidenceMode || isPriorDashboard || pendingAction) return;
    setPendingAction("challenge-checkin");
    try {
      await createActiveChallengeCheckin(session, { observed_on: today, status });
      setNotice(null);
      setConfirmedSave(true);
      await refreshWindow(session);
      navigate("S05");
    } catch (error) {
      presentRequestError(error, "save");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateOwnedChallengeCheckin(status: ChallengeCheckin["status"]) {
    if (!session || !editingChallengeCheckin || evidenceMode || isPriorDashboard || pendingAction) return;
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
    if (!session || !pendingChallengeCheckinDeletion || evidenceMode || isPriorDashboard || pendingAction) return;
    setPendingAction("challenge-checkin");
    try {
      await deleteChallengeCheckin(session, pendingChallengeCheckinDeletion.id);
      setPendingChallengeCheckinDeletion(null);
      setEditingChallengeCheckin(null);
      setSelectedRecordKey(null);
      setNotice({ kind: "success", message: "챌린지 기록을 삭제했습니다." });
      await refreshWindow(session);
      navigate("S08");
    } catch (error) {
      presentRequestError(error, "delete");
    } finally {
      setPendingAction(null);
    }
  }

  async function exportRecentRecords() {
    if (!session || evidenceMode || pendingAction) return;
    setPendingAction("export");
    try {
      const exported = await exportObservations(session, startOn, endOn);
      const objectUrl = URL.createObjectURL(exported.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = exported.filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setNotice({ kind: "success", message: "내보내기 파일을 준비했어요. 본인 기기에 안전하게 보관해 주세요." });
    } catch (error) {
      presentRequestError(error, "export");
    } finally {
      setPendingAction(null);
    }
  }

  if (!evidenceMode && !e2eSession && !supabaseConfigured) {
    return <main className="welcome-shell"><p className="notice notice-error">웹 환경변수를 설정한 뒤 시작할 수 있습니다.</p></main>;
  }
  if (!evidenceMode && !session) {
    return <Login onSession={setSession} recoveryMessage={notice?.kind === "warning" ? notice.message : undefined} />;
  }

  const activeChallenge = windowData?.active_challenge ?? null;
  const activeChallengeEnded = Boolean(activeChallenge && today > activeChallenge.ends_on);
  const todayCheckin = windowData?.challenge_checkins.find((checkin) => checkin.challenge_id === activeChallenge?.id && checkin.observed_on === today);
  const todayMeasurement = windowData?.blood_pressure_observations.find((record) => record.observed_on === today);
  const controlsDisabled = pendingAction !== null || isPriorDashboard;
  const displayMeasurement = (record: BloodPressureObservation) => evidenceMode ? "•••/•• mmHg" : `${record.systolic}/${record.diastolic} mmHg`;
  const recordBrowseItems: RecordBrowseItem[] = [
    ...(windowData?.blood_pressure_observations.map((record) => ({ key: `blood-pressure:${record.id}`, kind: "blood-pressure" as const, record })) ?? []),
    ...(windowData?.challenge_checkins.map((record) => ({ key: `challenge-checkin:${record.id}`, kind: "challenge-checkin" as const, record })) ?? []),
    ...(windowData?.challenge_events.map((record) => ({ key: `legacy:${record.id}`, kind: "legacy" as const, record })) ?? []),
  ].sort((left, right) => right.record.observed_on.localeCompare(left.record.observed_on));
  const selectedRecord = selectedRecordKey ? recordBrowseItems.find((record) => record.key === selectedRecordKey) : null;
  const selectedRecordMissing = Boolean(selectedRecordKey && !selectedRecord);
  const ready = windowState === "ready" || windowState === "refreshing" || windowState === "refresh-error";
  const automaticallyEmpty = ready && requestedScreen === "S02" && isWindowEmpty(windowData) && !confirmedSave;
  const truthfulFallback: ScreenId = isWindowEmpty(windowData) ? "S12" : "S02";
  const activeScreen: ScreenId = windowState === "error"
    ? "S13"
    : requestedScreen === "S05" && !confirmedSave
      ? truthfulFallback
      : requestedScreen === "S13" || (requestedScreen === "S12" && !isWindowEmpty(windowData))
        ? truthfulFallback
        : requestedScreen === "S06" && (!activeChallenge?.first_checkin_on || Boolean(todayMeasurement))
          ? truthfulFallback
          : automaticallyEmpty ? "S12" : requestedScreen;

  function openRecord(item: RecordBrowseItem) {
    navigate("S09", item.key);
  }

  function renderRecordLane(kind: RecordBrowseItem["kind"], title: string, emptyText: string) {
    const items = recordBrowseItems.filter((item) => item.kind === kind);
    return (
      <section className="record-lane" data-record-lane={kind === "challenge-checkin" ? "challenge" : kind}>
        <h2>{title}</h2>
        <ul className="record-list">
          {items.length ? items.map((item) => (
            <li key={item.key}>
              <span>
                <strong>{dateLabel(item.record.observed_on)}</strong>
                {item.kind === "blood-pressure"
                  ? ` · ${periodLabel(item.record.period)} · ${displayMeasurement(item.record)}`
                  : ` · ${challengeLabel(item.record.action_id)} · ${checkinLabel(item.record.status)}${item.kind === "legacy" ? " · 이전 기록" : ""}`}
              </span>
              <button className="secondary record-action" type="button" onClick={() => openRecord(item)}>상세 보기</button>
            </li>
          )) : <li className="empty-record">{emptyText}</li>}
        </ul>
      </section>
    );
  }

  function todayLanes() {
    return (
      <div className="fact-lanes">
        <section><p className="eyebrow">혈압 관찰</p><h2>{todayMeasurement ? "오늘 기록 있음" : "아직 기록 없음"}</h2><p>{todayMeasurement ? displayMeasurement(todayMeasurement) : "필요할 때 오늘의 측정값을 기록할 수 있어요."}</p>{!todayMeasurement && <button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button>}</section>
        <section><p className="eyebrow">챌린지 참여</p><h2>{activeChallenge && !activeChallengeEnded ? challengeLabel(activeChallenge.action_id) : "아직 선택 없음"}</h2><p>{todayCheckin ? `오늘 상태 · ${checkinLabel(todayCheckin.status)}` : "오늘 상태는 아직 기록하지 않았어요."}</p>{!activeChallenge || activeChallengeEnded ? <button type="button" onClick={() => navigate("S03")}>행동 고르기</button> : !todayCheckin && <div className="inline-actions"><button type="button" onClick={() => void submitActiveChallengeCheckin("completed")} disabled={controlsDisabled}>기록함</button><button className="secondary" type="button" onClick={() => void submitActiveChallengeCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button></div>}</section>
        <section><p className="eyebrow">이전 기록</p><h2>{windowData?.challenge_events.length ?? 0}개</h2><p>이전 방식으로 남긴 기록은 읽기 전용으로 구분해요.</p><button className="secondary" type="button" onClick={() => navigate("S08")}>기록 찾아보기</button></section>
      </div>
    );
  }

  function renderScene() {
    if (windowState === "loading") {
      return <section className="loading-scene" aria-busy="true" aria-live="polite"><span className="loading-stones" aria-hidden="true"><i /><i /><i /></span><p className="eyebrow">기록을 준비하고 있어요</p><h1>최근 7일을 불러오는 중이에요</h1><p>입력 화면의 순서는 유지한 채 기록만 불러옵니다.</p></section>;
    }

    if (activeScreen === "S13") {
      return <Scene id="S13" eyebrow={journeyCopy.S13.eyebrow} title={journeyCopy.S13.title} tone="coral" className="state-scene"><div className="mist-shape" aria-hidden="true" /><div className="state-message" role="alert"><p>{journeyCopy.S13.body}</p><button type="button" onClick={() => void refreshWindow()}>다시 불러오기</button></div></Scene>;
    }

    if (activeScreen === "S12") {
      return <Scene id="S12" {...journeyCopy.S12} tone="sage" className="state-scene"><div className="empty-garden" aria-hidden="true"><i /><i /><i /></div><div className="split-actions"><button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button><button className="secondary" type="button" onClick={() => navigate("S03")}>7일 챌린지 시작하기</button></div></Scene>;
    }

    if (activeScreen === "S02") {
      return <Scene id="S02" {...journeyCopy.S02} tone="cream" className="home-scene"><div className="today-ribbon"><span>{dateLabel(today)}</span><strong>{todayMeasurement ? "혈압 기록 있음" : "혈압 기록 전"}</strong><strong>{activeChallenge && !activeChallengeEnded ? challengeLabel(activeChallenge.action_id) : "행동 선택 전"}</strong></div><div className="home-grid"><button className="feature-card clay-card" type="button" onClick={() => navigate("S04")}><span className="card-number">01</span><strong>혈압 관찰</strong><small>수치를 해석하지 않고 측정 사실을 남겨요.</small></button><button className="feature-card sage-card" type="button" onClick={() => navigate(activeChallenge?.first_checkin_on && !todayMeasurement ? "S06" : "S03")}><span className="card-number">02</span><strong>7일 챌린지</strong><small>{activeChallenge && !activeChallengeEnded ? `${challengeLabel(activeChallenge.action_id)} 이어가기` : "오늘의 행동 하나 고르기"}</small></button><button className="feature-card lavender-card" type="button" onClick={() => navigate("S07")}><span className="card-number">03</span><strong>오늘 상세</strong><small>서로 다른 기록을 한눈에 확인해요.</small></button></div><ol className="week-path" aria-label="최근 7일"><li className="is-past">1</li><li className="is-past">2</li><li className="is-past">3</li><li className="is-today">오늘</li><li>5</li><li>6</li><li>7</li></ol></Scene>;
    }

    if (activeScreen === "S03") {
      const locked = Boolean(activeChallenge?.first_checkin_on && !activeChallengeEnded);
      return <Scene id="S03" {...journeyCopy.S03} tone="sage"><div className="choice-grid">{challengeActions.map((action) => { const selected = activeChallenge?.action_id === action.id && !activeChallengeEnded; return <button className={`choice-tile ${selected ? "is-selected" : ""}`} type="button" key={action.id} onClick={() => void selectChallenge(action.id)} disabled={controlsDisabled || locked}><span className="choice-icon" aria-hidden="true" data-choice={action.id} /><strong>{action.label}</strong><small>{action.note}</small><span className="choice-state">{selected ? "선택한 행동" : "이 행동으로 시작하기"}</span></button>; })}</div>{locked && <p className="notice notice-warning" role="status">첫 체크인이 있어 선택한 행동은 바꿀 수 없어요.</p>}<button className="text-button" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button></Scene>;
    }

    if (activeScreen === "S04") {
      return <Scene id="S04" eyebrow={journeyCopy.S04.eyebrow} title={editingBloodPressureId ? "혈압 기록 수정" : journeyCopy.S04.title} body={journeyCopy.S04.body} tone="water"><form className="measurement-panel" onSubmit={submitBloodPressure} noValidate><details className="measurement-guide"><summary>측정 전 확인하기</summary><ul><li>조용히 앉아 몸과 호흡을 편하게 해요.</li><li>등과 팔을 지지하고 측정 중에는 말하지 않아요.</li><li>이 안내는 기록 조건을 돕기 위한 참고이며 저장되지 않아요.</li></ul></details><div className="field-grid"><label htmlFor="observed-on">날짜<input id="observed-on" type="date" value={bloodPressureDraft.observedOn} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, observedOn: event.target.value }))} required disabled={controlsDisabled} /></label><label htmlFor="period">시간대<select id="period" value={bloodPressureDraft.period} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, period: event.target.value as BloodPressureDraft["period"] }))} disabled={controlsDisabled}><option value="morning">아침 · 기상 후 1시간 이내</option><option value="evening">저녁 · 취침 전</option></select></label><label htmlFor="systolic">수축기 <span className="unit">mmHg</span><input ref={systolicRef} id="systolic" type="number" min="60" max="260" inputMode="numeric" value={bloodPressureDraft.systolic} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, systolic: event.target.value }))} aria-invalid={Boolean(bloodPressureError)} aria-describedby={bloodPressureError ? "blood-pressure-error" : undefined} required disabled={controlsDisabled} /></label><label htmlFor="diastolic">이완기 <span className="unit">mmHg</span><input ref={diastolicRef} id="diastolic" type="number" min="30" max="160" inputMode="numeric" value={bloodPressureDraft.diastolic} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, diastolic: event.target.value }))} aria-invalid={Boolean(bloodPressureError)} aria-describedby={bloodPressureError ? "blood-pressure-error" : undefined} required disabled={controlsDisabled} /></label></div>{bloodPressureError && <p id="blood-pressure-error" className="field-error" role="alert">{bloodPressureError}</p>}<div className="form-actions"><button type="submit" disabled={controlsDisabled}>{pendingAction === "blood-pressure" ? "저장 중" : editingBloodPressureId ? "변경 저장" : "혈압 기록 저장"}</button>{editingBloodPressureId && <button className="secondary" type="button" onClick={cancelBloodPressureEdit} disabled={controlsDisabled}>수정 취소</button>}</div></form></Scene>;
    }

    if (activeScreen === "S05") {
      return <Scene id="S05" {...journeyCopy.S05} tone="sage" className="saved-scene"><div className="save-ripple" aria-hidden="true"><i /><i /><span>✓</span></div><div className="split-actions"><button type="button" onClick={() => { setConfirmedSave(false); navigate("S02"); }}>오늘의 기록 보기</button><button className="secondary" type="button" onClick={() => { setConfirmedSave(false); navigate("S04"); }}>계속 기록하기</button></div></Scene>;
    }

    if (activeScreen === "S06") {
      return <Scene id="S06" {...journeyCopy.S06} tone="sage"><div className="locked-challenge"><span>선택한 행동</span><strong>{activeChallenge ? challengeLabel(activeChallenge.action_id) : "선택한 행동 없음"}</strong>{activeChallenge && <small>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</small>}</div><div className="marker-row"><span className="settle-marker" aria-hidden="true" /><div><span>오늘의 상태</span><strong>{todayCheckin ? checkinLabel(todayCheckin.status) : "아직 기록하지 않음"}</strong></div></div><button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button></Scene>;
    }

    if (activeScreen === "S07") {
      return <Scene id="S07" {...journeyCopy.S07} tone="cream"><div className="today-date"><strong>{dateLabel(today)}</strong><span>서로 다른 사실은 합치지 않고 나란히 보여드려요.</span></div>{todayLanes()}<button className="secondary" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button></Scene>;
    }

    if (activeScreen === "S08") {
      return <Scene id="S08" {...journeyCopy.S08} tone="lavender"><div className="scene-toolbar"><span>{dateLabel(startOn)} ~ {dateLabel(endOn)}</span><button className="text-button" type="button" onClick={() => navigate("S02")}>대시보드로 돌아가기</button></div><div className="record-lanes">{renderRecordLane("blood-pressure", "혈압 관찰", "아직 혈압 관찰 기록이 없습니다.")}{renderRecordLane("challenge-checkin", "챌린지 참여", "아직 챌린지 참여 기록이 없습니다.")}{renderRecordLane("legacy", "이전 기록", "이전 기록이 없습니다.")}</div></Scene>;
    }

    if (activeScreen === "S09") {
      return (
        <Scene id="S09" {...journeyCopy.S09} tone="lavender">
          {selectedRecordMissing ? (
            <div className="state-card state-error" role="alert">
              <h2>선택한 기록을 찾을 수 없습니다.</h2>
              <p>목록이 바뀌었을 수 있어요. 현재 표시 구간의 기록을 다시 확인해 주세요.</p>
              <button type="button" onClick={() => navigate("S08")}>목록으로 돌아가기</button>
            </div>
          ) : selectedRecord ? (
            <article className="record-detail" data-record-detail-kind={selectedRecord.kind}>
              <h2>{selectedRecord.kind === "blood-pressure" ? "혈압 관찰" : selectedRecord.kind === "challenge-checkin" ? "챌린지 참여" : "이전 기록"}</h2>
              <dl className="record-detail-facts">
                <div><dt>날짜</dt><dd>{dateLabel(selectedRecord.record.observed_on)}</dd></div>
                {selectedRecord.kind === "blood-pressure" ? (
                  <><div><dt>시간대</dt><dd>{periodLabel(selectedRecord.record.period)}</dd></div><div><dt>기록</dt><dd>{displayMeasurement(selectedRecord.record)}</dd></div></>
                ) : (
                  <><div><dt>행동</dt><dd>{challengeLabel(selectedRecord.record.action_id)}</dd></div><div><dt>상태</dt><dd>{checkinLabel(selectedRecord.record.status)}</dd></div></>
                )}
              </dl>
              {isPriorDashboard || selectedRecord.kind === "legacy" ? (
                <p className="notice notice-warning">이전 7일의 기록은 읽기 전용입니다.</p>
              ) : selectedRecord.kind === "challenge-checkin" && (selectedRecord.record.challenge_id !== activeChallenge?.id || activeChallengeEnded) ? (
                <p className="notice notice-warning">현재 활성 챌린지에 속하지 않은 기록은 읽기 전용입니다.</p>
              ) : !evidenceMode && (
                <div className="inline-actions">
                  <button type="button" onClick={() => selectedRecord.kind === "blood-pressure" ? beginBloodPressureEdit(selectedRecord.record) : setEditingChallengeCheckin(selectedRecord.record)}>수정</button>
                  <button className="danger" type="button" onClick={() => selectedRecord.kind === "blood-pressure" ? setPendingBloodPressureDeletion(selectedRecord.record) : setPendingChallengeCheckinDeletion(selectedRecord.record)}>삭제</button>
                </div>
              )}
              {editingChallengeCheckin && (
                <div className="confirmation" role="status">
                  <span>{dateLabel(editingChallengeCheckin.observed_on)} · {challengeLabel(editingChallengeCheckin.action_id)} 상태</span>
                  <div className="inline-actions">
                    <button type="button" onClick={() => void updateOwnedChallengeCheckin("completed")} disabled={controlsDisabled}>기록함</button>
                    <button className="secondary" type="button" onClick={() => void updateOwnedChallengeCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button>
                    <button className="text-button" type="button" onClick={() => setEditingChallengeCheckin(null)}>취소</button>
                  </div>
                </div>
              )}
              <div className="inline-actions">
                <button className="secondary" type="button" onClick={() => navigate("S08")}>목록으로 돌아가기</button>
                {!evidenceMode && <button className="text-button" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing"}>새로고침</button>}
              </div>
            </article>
          ) : (
            <div className="state-card"><h2>선택한 기록이 없어요.</h2><button type="button" onClick={() => navigate("S08")}>목록으로 돌아가기</button></div>
          )}
        </Scene>
      );
    }

    if (activeScreen === "S10") {
      return <Scene id="S10" {...journeyCopy.S10} tone="water"><nav className="window-nav" data-dashboard-window={dashboardWindow} aria-label="대시보드 7일 구간"><button className="secondary" type="button" onClick={() => selectDashboardWindow("prior")} disabled={evidenceMode || dashboardWindow === "prior"}>이전 7일 보기</button><p><span>표시 구간</span><strong>{dateLabel(startOn)} ~ {dateLabel(endOn)}</strong></p><button className="secondary" type="button" onClick={() => selectDashboardWindow("current")} disabled={evidenceMode || dashboardWindow === "current"}>현재 7일 보기</button></nav>{isPriorDashboard && <p className="notice notice-warning" role="status">이전 7일 기록을 읽기 전용으로 보고 있어요.</p>}<div className="recap-pan" data-main-section="seven-day-dashboard"><section data-dashboard-lane="blood-pressure"><span>혈압 관찰</span><strong>{windowData?.blood_pressure_observations.length ?? 0}</strong><small>측정 기록</small></section><section data-dashboard-lane="challenge"><span>챌린지 참여</span><strong>{windowData?.challenge_checkins.length ?? 0}</strong><small>참여 기록</small></section><section data-dashboard-lane="legacy"><span>이전 기록</span><strong>{windowData?.challenge_events.length ?? 0}</strong><small>읽기 전용</small></section></div><div className="recap-records">{renderRecordLane("blood-pressure", "혈압 관찰", "아직 혈압 관찰 기록이 없습니다.")}{renderRecordLane("challenge-checkin", "챌린지 참여", "아직 챌린지 참여 기록이 없습니다.")}{renderRecordLane("legacy", "이전 기록", "이전 기록이 없습니다.")}</div><div className="scene-actions">{!evidenceMode && <button type="button" onClick={() => void exportRecentRecords()} disabled={controlsDisabled}>{pendingAction === "export" ? "내보내는 중" : "선택한 7일 내보내기"}</button>}<button className="secondary" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing"}>{windowState === "refreshing" ? "새로고침 중" : "새로고침"}</button></div></Scene>;
    }

    if (activeScreen === "S11") {
      return <Scene id="S11" {...journeyCopy.S11} tone="lavender" className="signal-scene"><div className="signal-orbit" aria-hidden="true"><span /><span /><i /></div><div className="signal-card"><span className="status-pill">아직 준비 중이에요</span><h2>검증된 모델이 준비되기 전에는 결과를 표시하지 않습니다.</h2><p>현재는 점수, 확률, 등급을 표시하지 않습니다.</p></div><p className="signal-disclaimer">이 신호는 진단·치료·예방 판단을 제공하지 않습니다.</p></Scene>;
    }

    return <Scene id="S14" {...journeyCopy.S14} tone="cream"><div className="settings-grid"><section><span className="setting-icon" aria-hidden="true">●</span><div><h2>계정</h2><p>이메일 링크로 연결된 현재 계정의 기록만 보여요.</p></div></section><section><span className="setting-icon" aria-hidden="true">가</span><div><h2>언어와 시간대</h2><p>한국어 · Asia/Seoul 기준으로 날짜를 표시해요.</p></div></section><section><span className="setting-icon" aria-hidden="true">↓</span><div><h2>내 기록</h2><p>7일 돌아보기 화면에서 JSON으로 내보낼 수 있어요.</p><button className="secondary" type="button" onClick={() => navigate("S10")}>7일 기록 보기</button></div></section><section><span className="setting-icon" aria-hidden="true">?</span><div><h2>도움말</h2><p>저장 여부가 불확실하면 자동 재시도하지 않아요. 새로고침으로 먼저 확인해 주세요.</p></div></section></div></Scene>;
  }

  return (
    <SceneShell activeScreen={activeScreen} evidenceLabel={fixture?.name} onNavigate={navigate} onSignOut={!evidenceMode ? () => void supabase?.auth.signOut() : undefined}>
      {notice && <div className={`notice notice-${notice.kind}`} role="status"><span>{notice.message}</span>{notice.reload && <button className="notice-action" type="button" onClick={() => void refreshWindow()} disabled={windowState === "loading" || windowState === "refreshing"}>다시 불러오기</button>}</div>}
      {windowState === "refresh-error" && <div className="notice notice-warning" role="status"><span>새로고침하지 못했어요. 지금 보이는 기록은 그대로 유지됩니다.</span><button className="notice-action" type="button" onClick={() => void refreshWindow()}>다시 불러오기</button></div>}
      {pendingBloodPressureDeletion && <div className="confirmation floating-confirmation" role="alert"><span>{dateLabel(pendingBloodPressureDeletion.observed_on)} 혈압 기록을 삭제할까요?</span><div className="inline-actions"><button className="danger" type="button" onClick={() => void confirmBloodPressureDeletion()} disabled={controlsDisabled}>삭제</button><button className="secondary" type="button" onClick={() => setPendingBloodPressureDeletion(null)} disabled={controlsDisabled}>취소</button></div></div>}
      {pendingChallengeCheckinDeletion && <div className="confirmation floating-confirmation" role="alert"><span>{dateLabel(pendingChallengeCheckinDeletion.observed_on)} 챌린지 기록을 삭제할까요?</span><div className="inline-actions"><button className="danger" type="button" onClick={() => void confirmChallengeCheckinDeletion()} disabled={controlsDisabled}>삭제</button><button className="secondary" type="button" onClick={() => setPendingChallengeCheckinDeletion(null)} disabled={controlsDisabled}>취소</button></div></div>}
      {renderScene()}
    </SceneShell>
  );
}

export default App;
