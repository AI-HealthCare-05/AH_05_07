import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { Scene, SceneShell } from "./components/SceneShell";
import { DeleteConfirmation } from "./components/DeleteConfirmation";
import { AccountDeletionConfirmation, type AccountDeletionRecovery } from "./components/AccountDeletionConfirmation";
import { ModelV2InputFlow, type ModelV2RequestContext } from "./components/ModelV2InputFlow";
import {
  ApiRequestError,
  deleteAccount,
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
import { allowsE2eFixture, e2eSessionEventName, getE2eSession } from "./lib/e2eHarness";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { resolveCompanionMode, resolveCompanionSelection, resolveProductionCompanion, type CompanionSelectionContext } from "./ui/companion";
import { journeyCopy, parseScreen, type ScreenId } from "./ui/journey";
import {
  getModelV2ResultView,
  resolveModelV2ResultState,
} from "./ui/modelV2ResultState";

const challengeActions = [
  { id: "walk-10-minutes", label: "10분 걷기", note: "가볍게 바깥 공기를 만나는 시간" },
  { id: "sleep-routine", label: "수면 시간 지키기", note: "정한 시간에 하루를 천천히 닫기" },
  { id: "low-sodium-meal", label: "덜 짜게 먹기", note: "한 끼의 선택을 담백하게 기록하기" },
] as const;

type NoticeOrigin = "session" | "request-error" | "mutation-success" | "edit" | "export-success";
type Notice = {
  kind: "success" | "error" | "warning";
  message: string;
  reload?: boolean;
  origin: NoticeOrigin;
  persistence: "until-navigation" | "persistent";
};
type PendingAction = "blood-pressure" | "challenge-selection" | "challenge-checkin" | "export" | null;
type WindowState = "loading" | "ready" | "refreshing" | "error" | "refresh-error";
type DashboardWindow = "current" | "prior";
type BloodPressureDraft = { observedOn: string; period: "morning" | "evening"; systolic: string; diastolic: string };
type RecordBrowseItem =
  | { key: string; kind: "blood-pressure"; record: BloodPressureObservation }
  | { key: string; kind: "challenge-checkin"; record: ChallengeCheckin }
  | { key: string; kind: "legacy"; record: ChallengeEvent };
type HomeDestinationKey = "blood-pressure" | "challenge" | "today-detail";
type HomeAction = {
  key: HomeDestinationKey;
  title: string;
  support: string;
  action: string;
  screen: ScreenId;
};
type SessionIdentity = { userId: string | null; generation: number };
type RequestContext = ModelV2RequestContext;

function makeNotice(
  kind: Notice["kind"],
  message: string,
  options: { origin: NoticeOrigin; reload?: boolean },
): Notice {
  return {
    kind,
    message,
    reload: options.reload,
    origin: options.origin,
    persistence: options.origin === "export-success" ? "until-navigation" : "persistent",
  };
}

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

function hasStatus(error: unknown, expectedStatus: number): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === expectedStatus;
}

function isAccountDeletionRecoveryCandidate(error: unknown): boolean {
  return !(error instanceof ApiRequestError) || [0, 401, 502].includes(error.status);
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
        <p className="welcome-footnote">공용 기기에서는 사용을 마친 뒤 로그아웃해 주세요. 로그아웃하면 이 기기의 현재 계정 연결을 끝냅니다.</p>
        <p className="welcome-footnote">혈압 관찰과 챌린지 참여는 서로 다른 사실로 표시됩니다.</p>
      </section>
    </main>
  );
}

function App() {
  const initialSearch = useMemo(() => new URLSearchParams(window.location.search), []);
  const companionMode = useMemo(() => resolveCompanionMode(import.meta.env.VITE_SK7_COMPANION_MODE), []);
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
  const modelV2ResultState = useMemo(
    () => resolveModelV2ResultState(initialSearch.get("model_v2_state"), allowsE2eFixture()),
    [initialSearch],
  );
  const modelV2ResultView = getModelV2ResultView(modelV2ResultState);
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
  const [confirmedSave, setConfirmedSave] = useState(
    () => companionMode === "review" && Boolean(fixture) && allowsE2eFixture() && initialSearch.get("companion_context") === "save_success",
  );
  const [bloodPressureDraft, setBloodPressureDraft] = useState<BloodPressureDraft>(() => emptyBloodPressureDraft(today));
  const [bloodPressureError, setBloodPressureError] = useState("");
  const [editingBloodPressureId, setEditingBloodPressureId] = useState<string | null>(null);
  const [pendingBloodPressureDeletion, setPendingBloodPressureDeletion] = useState<BloodPressureObservation | null>(null);
  const [editingChallengeCheckin, setEditingChallengeCheckin] = useState<ChallengeCheckin | null>(null);
  const [pendingChallengeCheckinDeletion, setPendingChallengeCheckinDeletion] = useState<ChallengeCheckin | null>(null);
  const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(() => initialSearch.get("record"));
  const systolicRef = useRef<HTMLInputElement>(null);
  const diastolicRef = useRef<HTMLInputElement>(null);
  const windowRequestId = useRef(0);
  const editOriginKey = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(e2eSession);
  const sessionIdentityRef = useRef<SessionIdentity>({ userId: e2eSession?.user.id ?? null, generation: e2eSession ? 1 : 0 });
  const sessionUpdateVersionRef = useRef(0);
  const accountDeletionStartedRef = useRef(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [accountDeletionOpen, setAccountDeletionOpen] = useState(false);
  const [accountDeletionPending, setAccountDeletionPending] = useState(false);
  const [accountDeletionRecovery, setAccountDeletionRecovery] = useState<AccountDeletionRecovery>(null);

  function applySession(nextSession: Session | null) {
    sessionUpdateVersionRef.current += 1;
    const nextUserId = nextSession?.user.id ?? null;
    const currentIdentity = sessionIdentityRef.current;
    if (currentIdentity.userId === nextUserId) {
      sessionRef.current = nextSession;
      setSession(nextSession);
      return;
    }

    sessionIdentityRef.current = { userId: nextUserId, generation: currentIdentity.generation + 1 };
    sessionRef.current = nextSession;
    windowRequestId.current += 1;
    setSession(nextSession);
    setSignOutPending(false);
    accountDeletionStartedRef.current = false;
    setAccountDeletionOpen(false);
    setAccountDeletionPending(false);
    setAccountDeletionRecovery(null);
    setWindowData(null);
    setWindowState("loading");
    setNotice(null);
    setPendingAction(null);
    setConfirmedSave(false);
    setBloodPressureDraft(emptyBloodPressureDraft(today));
    setBloodPressureError("");
    setEditingBloodPressureId(null);
    setPendingBloodPressureDeletion(null);
    setEditingChallengeCheckin(null);
    setPendingChallengeCheckinDeletion(null);
    setSelectedRecordKey(null);
    setRequestedScreen("S02");
    setDashboardWindow("current");
    editOriginKey.current = null;

    const url = new URL(window.location.href);
    url.searchParams.delete("screen");
    url.searchParams.delete("record");
    url.searchParams.delete("dashboard_window");
    window.history.replaceState({ ...(window.history.state ?? {}), sk7UserId: nextUserId }, "", url);
  }

  function captureRequestContext(activeSession: Session | null = sessionRef.current): RequestContext | null {
    const userId = activeSession?.user.id;
    if (!activeSession || !userId) return null;
    return { userId, generation: sessionIdentityRef.current.generation, accessToken: activeSession.access_token };
  }

  function isCurrentRequestContext(context: RequestContext): boolean {
    const identity = sessionIdentityRef.current;
    return identity.userId === context.userId && identity.generation === context.generation;
  }

  function hasNewerToken(context?: RequestContext): boolean {
    return Boolean(context && isCurrentRequestContext(context) && sessionRef.current && sessionRef.current.access_token !== context.accessToken);
  }

  useEffect(() => {
    const currentUserId = sessionIdentityRef.current.userId;
    if (currentUserId) {
      window.history.replaceState({ ...(window.history.state ?? {}), sk7UserId: currentUserId }, "", window.location.href);
    }
  }, []);

  useEffect(() => {
    if (evidenceMode) return;
    if (allowsE2eFixture()) {
      const onSyntheticSession = (event: Event) => {
        applySession((event as CustomEvent<Session | null>).detail ?? null);
      };
      window.addEventListener(e2eSessionEventName, onSyntheticSession);
      return () => window.removeEventListener(e2eSessionEventName, onSyntheticSession);
    }
    if (!supabase) return;
    const bootstrapVersion = sessionUpdateVersionRef.current;
    void supabase.auth.getSession().then(({ data }) => {
      if (sessionUpdateVersionRef.current === bootstrapVersion) applySession(data.session);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => applySession(nextSession));
    return () => subscription.subscription.unsubscribe();
  }, [evidenceMode, e2eSession]);

  useEffect(() => {
    if (evidenceMode || !session) return;
    void refreshWindow(session);
  }, [endOn, evidenceMode, session, startOn]);

  useEffect(() => {
    const onPopState = () => {
      const search = new URLSearchParams(window.location.search);
      const currentUserId = sessionIdentityRef.current.userId;
      const entryUserId = window.history.state?.sk7UserId ?? null;
      if (currentUserId && entryUserId !== currentUserId) {
        const safeUrl = new URL(window.location.href);
        safeUrl.searchParams.delete("screen");
        safeUrl.searchParams.delete("record");
        safeUrl.searchParams.delete("dashboard_window");
        window.history.replaceState({ ...(window.history.state ?? {}), sk7UserId: currentUserId }, "", safeUrl);
        windowRequestId.current += 1;
        setWindowData(null);
        setWindowState("loading");
        setRequestedScreen("S02");
        setDashboardWindow("current");
        setSelectedRecordKey(null);
        setPendingAction(null);
        setConfirmedSave(false);
        setBloodPressureDraft(emptyBloodPressureDraft(today));
        setBloodPressureError("");
        setEditingBloodPressureId(null);
        setPendingBloodPressureDeletion(null);
        setEditingChallengeCheckin(null);
        setPendingChallengeCheckinDeletion(null);
        editOriginKey.current = null;
        if (dashboardWindow === "current") void refreshWindow(sessionRef.current);
        return;
      }
      setNotice((current) => current?.persistence === "until-navigation" ? null : current);
      setPendingBloodPressureDeletion(null);
      setPendingChallengeCheckinDeletion(null);
      setEditingChallengeCheckin(null);
      setRequestedScreen(parseScreen(search.get("screen")));
      setSelectedRecordKey(search.get("record"));
      const nextWindow = search.get("dashboard_window") === "prior" ? "prior" : "current";
      if (nextWindow !== dashboardWindow) {
        windowRequestId.current += 1;
        setWindowData(null);
        setWindowState("loading");
        setDashboardWindow(nextWindow);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dashboardWindow]);

  function navigate(screen: ScreenId, recordKey?: string | null, replace = false) {
    const url = new URL(window.location.href);
    setNotice((current) => current?.persistence === "until-navigation" ? null : current);
    setPendingBloodPressureDeletion(null);
    setPendingChallengeCheckinDeletion(null);
    setEditingChallengeCheckin(null);
    if (isPriorDashboard && ["S02", "S03", "S04", "S07"].includes(screen) && !evidenceMode) {
      windowRequestId.current += 1;
      url.searchParams.delete("dashboard_window");
      setWindowData(null);
      setWindowState("loading");
      setDashboardWindow("current");
    }
    if (screen === "S02") url.searchParams.delete("screen");
    else url.searchParams.set("screen", screen);
    if (recordKey) url.searchParams.set("record", recordKey);
    else url.searchParams.delete("record");
    window.history[replace ? "replaceState" : "pushState"]({ ...(window.history.state ?? {}), sk7UserId: sessionIdentityRef.current.userId }, "", url);
    setRequestedScreen(screen);
    setSelectedRecordKey(recordKey ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function presentRequestError(error: unknown, context: "load" | "save" | "delete" | "export", requestContext?: RequestContext) {
    if (isSessionError(error) && !hasNewerToken(requestContext)) {
      void supabase?.auth.signOut({ scope: "local" });
      applySession(null);
      setNotice(makeNotice("warning", "로그인 시간이 만료되었습니다. 이메일 링크로 다시 로그인해 주세요.", { origin: "session" }));
      return;
    }
    if (context === "load") {
      setWindowState(windowData ? "refresh-error" : "error");
      return;
    }
    if (error instanceof ApiRequestError && error.status === 422) {
      setNotice(makeNotice("error", "입력 내용을 저장할 수 없어요. 날짜와 값의 형식을 확인한 뒤 수정해 주세요.", { origin: "request-error" }));
      return;
    }
    if (error instanceof ApiRequestError && (error.status === 409 || error.code === "observation_conflict")) {
      setNotice(makeNotice("error", "같은 날짜와 시간대에 이미 기록이 있습니다. 입력을 확인해 주세요.", { origin: "request-error" }));
      return;
    }
    if (error instanceof ApiRequestError && error.code === "challenge_selection_locked") {
      setNotice(makeNotice("error", "첫 체크인이 있어 선택한 행동은 바꿀 수 없어요.", { origin: "request-error" }));
      return;
    }
    const message = context === "export"
      ? "파일을 내려받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요."
      : context === "delete"
        ? "삭제 여부를 확인하지 못했습니다. 목록을 다시 불러와 확인해 주세요."
        : "저장 여부를 확인하지 못했어요. 자동으로 다시 보내지 않았습니다. 기록을 새로고침해 확인해 주세요.";
    setNotice(makeNotice("warning", message, { origin: "request-error", reload: context !== "export" }));
  }

  async function refreshWindow(activeSession = sessionRef.current, allowTokenRefreshRetry = true) {
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || evidenceMode || accountDeletionPending) return;
    const requestId = ++windowRequestId.current;
    setWindowState(windowData ? "refreshing" : "loading");
    try {
      const nextData = await getObservationWindow(activeSession, startOn, endOn);
      if (requestId !== windowRequestId.current || !isCurrentRequestContext(requestContext)) return;
      setWindowData(nextData);
      setWindowState("ready");
    } catch (error) {
      if (requestId !== windowRequestId.current || !isCurrentRequestContext(requestContext)) return;
      if (allowTokenRefreshRetry && isSessionError(error) && hasNewerToken(requestContext)) {
        await refreshWindow(sessionRef.current, false);
        return;
      }
      presentRequestError(error, "load", requestContext);
    }
  }

  function selectDashboardWindow(nextWindow: DashboardWindow) {
    if (evidenceMode || nextWindow === dashboardWindow) return;
    const url = new URL(window.location.href);
    setNotice((current) => current?.persistence === "until-navigation" ? null : current);
    windowRequestId.current += 1;
    if (nextWindow === "prior") url.searchParams.set("dashboard_window", "prior");
    else url.searchParams.delete("dashboard_window");
    url.searchParams.delete("record");
    window.history.pushState({ ...(window.history.state ?? {}), sk7UserId: sessionIdentityRef.current.userId }, "", url);
    setSelectedRecordKey(null);
    setWindowData(null);
    setWindowState("loading");
    setDashboardWindow(nextWindow);
  }

  async function finishAccountDeletion() {
    windowRequestId.current += 1;
    accountDeletionStartedRef.current = false;
    setAccountDeletionPending(false);
    setAccountDeletionOpen(false);
    setAccountDeletionRecovery(null);
    try {
      await supabase?.auth.signOut({ scope: "local" });
    } catch {
      // The Auth account is already deleted. Local cleanup below remains authoritative.
    }
    applySession(null);
  }

  async function inspectAccountDeletionOutcome(requestContext: RequestContext): Promise<"terminal" | "still-valid" | "ambiguous"> {
    if (!supabase) return "ambiguous";
    try {
      const { data, error } = await supabase.auth.getUser(requestContext.accessToken);
      if (!isCurrentRequestContext(requestContext)) return "ambiguous";
      if (data.user) return "still-valid";
      if (!error || hasStatus(error, 401)) return "terminal";
      return "ambiguous";
    } catch {
      return "ambiguous";
    }
  }

  async function confirmAccountDeletion() {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (
      !activeSession
      || !requestContext
      || evidenceMode
      || accountDeletionPending
      || accountDeletionStartedRef.current
    ) return;

    accountDeletionStartedRef.current = true;
    setAccountDeletionPending(true);
    setAccountDeletionRecovery(null);
    try {
      await deleteAccount(activeSession);
      if (!isCurrentRequestContext(requestContext)) return;
      await finishAccountDeletion();
    } catch (error) {
      if (!isCurrentRequestContext(requestContext)) return;
      if (isAccountDeletionRecoveryCandidate(error)) {
        const outcome = await inspectAccountDeletionOutcome(requestContext);
        if (outcome === "terminal") {
          await finishAccountDeletion();
          return;
        }
        accountDeletionStartedRef.current = false;
        setAccountDeletionPending(false);
        setAccountDeletionRecovery(outcome === "still-valid" ? "still-valid" : "ambiguous");
        return;
      }
      accountDeletionStartedRef.current = false;
      setAccountDeletionPending(false);
      setAccountDeletionRecovery("failed");
    }
  }

  async function handleSignOut() {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || signOutPending || accountDeletionPending || !supabase) return;
    setSignOutPending(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (!isCurrentRequestContext(requestContext)) return;
      if (error) {
        setNotice(makeNotice("warning", "로그아웃을 완료하지 못했어요. 다시 시도해 주세요.", { origin: "session" }));
        return;
      }
      applySession(null);
    } catch {
      if (isCurrentRequestContext(requestContext)) {
        setNotice(makeNotice("warning", "로그아웃을 완료하지 못했어요. 다시 시도해 주세요.", { origin: "session" }));
      }
    } finally {
      if (isCurrentRequestContext(requestContext)) setSignOutPending(false);
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
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || evidenceMode || isPriorDashboard || pendingAction || accountDeletionPending) return;
    const payload = validateBloodPressure();
    if (!payload) return;
    setPendingAction("blood-pressure");
    try {
      if (editingBloodPressureId) {
        await updateBloodPressureObservation(activeSession, editingBloodPressureId, payload);
      } else {
        await createBloodPressureObservation(activeSession, payload);
      }
      if (!isCurrentRequestContext(requestContext)) return;
      await refreshWindow(activeSession);
      if (!isCurrentRequestContext(requestContext)) return;
      if (editingBloodPressureId) setNotice(makeNotice("success", "혈압 기록을 수정했습니다.", { origin: "mutation-success" }));
      else setNotice(null);
      setBloodPressureDraft(emptyBloodPressureDraft(today));
      setEditingBloodPressureId(null);
      setConfirmedSave(true);
      navigate("S05");
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "save", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  function beginBloodPressureEdit(record: BloodPressureObservation) {
    editOriginKey.current = selectedRecordKey;
    setEditingBloodPressureId(record.id);
    setPendingBloodPressureDeletion(null);
    setBloodPressureDraft({ observedOn: record.observed_on, period: record.period, systolic: String(record.systolic), diastolic: String(record.diastolic) });
    setNotice(makeNotice("warning", `${dateLabel(record.observed_on)} ${periodLabel(record.period)} 기록을 수정할 수 있습니다.`, { origin: "edit" }));
    navigate("S04");
  }

  function cancelBloodPressureEdit() {
    setEditingBloodPressureId(null);
    setBloodPressureError("");
    setBloodPressureDraft(emptyBloodPressureDraft(today));
    setNotice(null);
    navigate(editOriginKey.current ? "S09" : "S08", editOriginKey.current);
  }

  async function confirmBloodPressureDeletion() {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || !pendingBloodPressureDeletion || evidenceMode || isPriorDashboard || pendingAction || accountDeletionPending) return;
    setPendingAction("blood-pressure");
    try {
      await deleteBloodPressureObservation(activeSession, pendingBloodPressureDeletion.id);
      if (!isCurrentRequestContext(requestContext)) return;
      setPendingBloodPressureDeletion(null);
      setSelectedRecordKey(null);
      await refreshWindow(activeSession);
      if (!isCurrentRequestContext(requestContext)) return;
      setNotice(makeNotice("success", "혈압 기록을 삭제했습니다.", { origin: "mutation-success" }));
      navigate("S08");
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "delete", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  async function selectChallenge(actionId: string) {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || evidenceMode || isPriorDashboard || pendingAction || accountDeletionPending) return;
    setPendingAction("challenge-selection");
    try {
      await selectActiveChallenge(activeSession, actionId);
      if (!isCurrentRequestContext(requestContext)) return;
      await refreshWindow(activeSession);
      if (!isCurrentRequestContext(requestContext)) return;
      setNotice(makeNotice("success", "7일 챌린지를 선택했습니다.", { origin: "mutation-success" }));
      navigate("S02");
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "save", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  async function submitActiveChallengeCheckin(status: "completed" | "skipped") {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || evidenceMode || isPriorDashboard || pendingAction || accountDeletionPending) return;
    setPendingAction("challenge-checkin");
    try {
      await createActiveChallengeCheckin(activeSession, { observed_on: today, status });
      if (!isCurrentRequestContext(requestContext)) return;
      await refreshWindow(activeSession);
      if (!isCurrentRequestContext(requestContext)) return;
      setNotice(null);
      setConfirmedSave(true);
      navigate("S05");
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "save", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  async function updateOwnedChallengeCheckin(status: ChallengeCheckin["status"]) {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || !editingChallengeCheckin || evidenceMode || isPriorDashboard || pendingAction || accountDeletionPending) return;
    setPendingAction("challenge-checkin");
    try {
      await updateChallengeCheckin(activeSession, editingChallengeCheckin.id, status);
      if (!isCurrentRequestContext(requestContext)) return;
      await refreshWindow(activeSession);
      if (!isCurrentRequestContext(requestContext)) return;
      setEditingChallengeCheckin(null);
      setNotice(makeNotice("success", "챌린지 상태를 수정했습니다.", { origin: "mutation-success" }));
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "save", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  async function confirmChallengeCheckinDeletion() {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || !pendingChallengeCheckinDeletion || evidenceMode || isPriorDashboard || pendingAction || accountDeletionPending) return;
    setPendingAction("challenge-checkin");
    try {
      await deleteChallengeCheckin(activeSession, pendingChallengeCheckinDeletion.id);
      if (!isCurrentRequestContext(requestContext)) return;
      setPendingChallengeCheckinDeletion(null);
      setEditingChallengeCheckin(null);
      setSelectedRecordKey(null);
      await refreshWindow(activeSession);
      if (!isCurrentRequestContext(requestContext)) return;
      setNotice(makeNotice("success", "챌린지 기록을 삭제했습니다.", { origin: "mutation-success" }));
      navigate("S08");
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "delete", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  async function exportRecentRecords() {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || evidenceMode || pendingAction || accountDeletionPending) return;
    setPendingAction("export");
    try {
      const exported = await exportObservations(activeSession, startOn, endOn);
      if (!isCurrentRequestContext(requestContext)) return;
      const objectUrl = URL.createObjectURL(exported.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = exported.filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setNotice(makeNotice("success", "내보내기 파일을 준비했어요. 본인 기기에 안전하게 보관해 주세요.", { origin: "export-success" }));
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "export", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  if (!evidenceMode && !e2eSession && !supabaseConfigured) {
    return <main className="welcome-shell"><p className="notice notice-error">웹 환경변수를 설정한 뒤 시작할 수 있습니다.</p></main>;
  }
  if (!evidenceMode && !session) {
    return <Login onSession={applySession} recoveryMessage={notice?.kind === "warning" ? notice.message : undefined} />;
  }

  const activeChallenge = windowData?.active_challenge ?? null;
  const activeChallengeEnded = Boolean(activeChallenge && today > activeChallenge.ends_on);
  const todayCheckin = windowData?.challenge_checkins.find((checkin) => checkin.challenge_id === activeChallenge?.id && checkin.observed_on === today);
  const activeChallengeCheckins = activeChallenge
    ? (windowData?.challenge_checkins.filter((checkin) => checkin.challenge_id === activeChallenge.id) ?? [])
    : [];
  const todayMeasurement = windowData?.blood_pressure_observations.find((record) => record.observed_on === today);
  const controlsDisabled = pendingAction !== null || isPriorDashboard || accountDeletionPending;
  const displayMeasurement = (record: BloodPressureObservation) => evidenceMode ? "•••/•• mmHg" : `${record.systolic}/${record.diastolic} mmHg`;
  const recordBrowseItems: RecordBrowseItem[] = [
    ...(windowData?.blood_pressure_observations.map((record) => ({ key: `blood-pressure:${record.id}`, kind: "blood-pressure" as const, record })) ?? []),
    ...(windowData?.challenge_checkins.map((record) => ({ key: `challenge-checkin:${record.id}`, kind: "challenge-checkin" as const, record })) ?? []),
    ...(windowData?.challenge_events.map((record) => ({ key: `legacy:${record.id}`, kind: "legacy" as const, record })) ?? []),
  ].sort((left, right) => right.record.observed_on.localeCompare(left.record.observed_on));
  const selectedRecord = selectedRecordKey ? recordBrowseItems.find((record) => record.key === selectedRecordKey) : null;
  const selectedRecordMissing = Boolean(selectedRecordKey && !selectedRecord);
  const ready = windowState === "ready" || windowState === "refreshing" || windowState === "refresh-error";
  const automaticallyEmpty =
    ready &&
    requestedScreen === "S02" &&
    isWindowEmpty(windowData) &&
    !confirmedSave;
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
  const companionContext: CompanionSelectionContext | undefined = activeScreen === "S05" && confirmedSave
    ? "save_success"
    : initialSearch.get("companion_context") === "non_semantic"
      ? "non_semantic"
      : undefined;
  const companionSelection = companionMode === "production"
    ? resolveProductionCompanion(companionMode, activeScreen, confirmedSave)
    : resolveCompanionSelection(activeScreen, initialSearch, companionContext);
  const challengeDestination: ScreenId = activeChallenge && !activeChallengeEnded && !todayMeasurement ? "S06" : "S03";
  const homeLead: HomeAction = !todayMeasurement
    ? { key: "blood-pressure", title: "오늘 혈압 기록", support: "오늘 측정한 값을 남겨요.", action: "혈압 기록하기", screen: "S04" }
    : !activeChallenge || activeChallengeEnded
      ? { key: "challenge", title: "7일 챌린지 고르기", support: "이어갈 행동을 선택해요.", action: "챌린지 고르기", screen: "S03" }
      : { key: "today-detail", title: "오늘 기록 확인", support: "오늘 남긴 기록을 확인해요.", action: "오늘 상세 보기", screen: "S07" };
  const homeSecondaryActions = ([
    {
      key: "blood-pressure",
      title: "혈압 관찰",
      support: todayMeasurement ? "혈압 기록 화면 열기" : "오늘 측정값을 남겨요",
      action: "혈압 관찰 열기",
      screen: "S04",
    },
    {
      key: "challenge",
      title: "7일 챌린지",
      support: activeChallenge && !activeChallengeEnded ? `${challengeLabel(activeChallenge.action_id)} 이어가기` : "이어갈 행동 고르기",
      action: "7일 챌린지 열기",
      screen: challengeDestination,
    },
    {
      key: "today-detail",
      title: "오늘 상세",
      support: "오늘 남긴 기록 확인",
      action: "오늘 상세 열기",
      screen: "S07",
    },
  ] as HomeAction[]).filter((item) => item.key !== homeLead.key);

  function openRecord(item: RecordBrowseItem) {
    navigate("S09", item.key);
  }

  function renderWindowNavigation() {
    return <nav className="window-nav" data-dashboard-window={dashboardWindow} aria-label="최근 7일 기록 구간"><button className="secondary" type="button" onClick={() => selectDashboardWindow("prior")} disabled={evidenceMode || dashboardWindow === "prior"}>이전 7일 보기</button><p><span>최근 7일 · {isPriorDashboard ? "이전 구간 · 읽기 전용" : "오늘 포함"}</span><strong>{dateLabel(startOn)} ~ {dateLabel(endOn)}</strong><small>챌린지 진행률이 아닙니다.</small></p><button className="secondary" type="button" onClick={() => selectDashboardWindow("current")} disabled={evidenceMode || dashboardWindow === "current"}>현재 7일 보기</button></nav>;
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
        <section className="fact-lead"><p className="eyebrow">혈압 관찰</p><h2>{todayMeasurement ? "오늘 기록 있음" : "아직 기록 없음"}</h2><p>{todayMeasurement ? displayMeasurement(todayMeasurement) : "필요할 때 오늘의 측정값을 기록할 수 있어요."}</p>{!todayMeasurement && <button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button>}</section>
        <section><p className="eyebrow">챌린지 참여</p><h2>{activeChallenge && !activeChallengeEnded ? challengeLabel(activeChallenge.action_id) : "아직 선택 없음"}</h2><p>{todayCheckin ? `오늘 상태 · ${checkinLabel(todayCheckin.status)}` : "오늘 상태는 아직 기록하지 않았어요."}</p>{!activeChallenge || activeChallengeEnded ? <button type="button" onClick={() => navigate("S03")}>행동 고르기</button> : !todayCheckin && <div className="inline-actions"><button type="button" onClick={() => void submitActiveChallengeCheckin("completed")} disabled={controlsDisabled}>기록함</button><button className="secondary" type="button" onClick={() => void submitActiveChallengeCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button></div>}</section>
        <section><p className="eyebrow">이전 방식의 기록</p><h2>{windowData?.challenge_events.length ?? 0}개</h2><p>이전 방식으로 남긴 기록은 읽기 전용으로 구분해요.</p><button className="secondary" type="button" onClick={() => navigate("S08")}>기록 찾아보기</button></section>
      </div>
    );
  }

  function renderScene() {
    if (windowState === "loading") {
      return <section className="loading-scene" aria-busy="true" aria-live="polite"><span className="loading-stones" aria-hidden="true"><i /><i /><i /></span><p className="eyebrow">기록을 준비하고 있어요</p><h1>선택한 7일을 불러오는 중이에요</h1><p>불러오기가 끝나면 선택한 기간의 기록을 보여드려요.</p></section>;
    }

    if (activeScreen === "S13") {
      return <Scene id="S13" eyebrow={journeyCopy.S13.eyebrow} title={journeyCopy.S13.title} tone="coral" className="state-scene"><div className="mist-shape" aria-hidden="true" /><div className="state-message" role="alert"><p>{journeyCopy.S13.body}</p><button type="button" onClick={() => void refreshWindow()}>다시 불러오기</button></div></Scene>;
    }

    if (activeScreen === "S12") {
      return <Scene id="S12" {...journeyCopy.S12} tone="sage" className="state-scene"><div className="empty-garden" aria-hidden="true"><i /><i /><i /></div><div className="split-actions"><button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button><button className="secondary" type="button" onClick={() => navigate("S03")}>7일 챌린지 시작하기</button></div></Scene>;
    }

    if (activeScreen === "S02") {
      return <Scene id="S02" {...journeyCopy.S02} tone="cream" className="home-scene"><div className="today-ribbon"><span>{dateLabel(today)}</span><strong>{todayMeasurement ? "혈압 기록 있음" : "혈압 기록 전"}</strong><strong>{activeChallenge && !activeChallengeEnded ? challengeLabel(activeChallenge.action_id) : "행동 선택 전"}</strong></div><section className="home-lead" data-home-concept={homeLead.key} aria-labelledby="home-lead-title"><div><p className="eyebrow">오늘 먼저 할 일</p><h2 id="home-lead-title">{homeLead.title}</h2><p>{homeLead.support}</p></div><button type="button" onClick={() => navigate(homeLead.screen)}>{homeLead.action}</button></section><nav className="home-links" aria-label="오늘 기록 바로가기">{homeSecondaryActions.map((item) => <button key={item.key} type="button" data-home-concept={item.key} data-home-destination={item.screen} aria-label={`${item.title} · ${item.support}`} onClick={() => navigate(item.screen)}><span><strong>{item.title}</strong><small>{item.support}</small></span><span aria-hidden="true">→</span></button>)}</nav><section className="recent-window-summary" data-window-kind="recent-history" aria-labelledby="recent-window-title"><div><p className="eyebrow">기록 탐색</p><h2 id="recent-window-title">최근 7일 기록</h2><p>챌린지 7일 진행과는 별도로 확인해요.</p></div><ol className="week-path" aria-label="오늘을 포함한 최근 7일 기록">{Array.from({ length: 7 }, (_, index) => { const day = shiftDate(today, index - 6); return <li key={day} className={day === today ? "is-today" : ""} aria-label={dateLabel(day)}>{day === today ? "오늘" : `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`}</li>; })}</ol></section></Scene>;
    }

    if (activeScreen === "S03") {
      const locked = Boolean(activeChallenge?.first_checkin_on && !activeChallengeEnded);
      return <Scene id="S03" {...journeyCopy.S03} tone="sage"><div className="choice-grid">{challengeActions.map((action) => { const selected = activeChallenge?.action_id === action.id && !activeChallengeEnded; return <button className={`choice-tile ${selected ? "is-selected" : ""}`} type="button" key={action.id} onClick={() => void selectChallenge(action.id)} disabled={controlsDisabled || locked}><span className="choice-icon" aria-hidden="true" data-choice={action.id} /><strong>{action.label}</strong><small>{action.note}</small><span className="choice-state">{selected ? "선택됨" : "선택하기"}</span></button>; })}</div>{locked && <p className="notice notice-warning" role="status">첫 체크인이 있어 선택한 행동은 바꿀 수 없어요.</p>}<button className="text-button" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button></Scene>;
    }

    if (activeScreen === "S04") {
      return <Scene id="S04" eyebrow={journeyCopy.S04.eyebrow} title={editingBloodPressureId ? "혈압 기록 수정" : journeyCopy.S04.title} body={journeyCopy.S04.body} tone="water"><form className="measurement-panel" onSubmit={submitBloodPressure} noValidate><details className="measurement-guide"><summary>측정 전 확인하기</summary><ul><li>조용히 앉아 몸과 호흡을 편하게 해요.</li><li>등과 팔을 지지하고 측정 중에는 말하지 않아요.</li><li>이 안내는 기록 조건을 돕기 위한 참고이며 저장되지 않아요.</li></ul></details><div className="field-grid"><label htmlFor="observed-on">날짜<input id="observed-on" type="date" value={bloodPressureDraft.observedOn} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, observedOn: event.target.value }))} required disabled={controlsDisabled} /></label><label htmlFor="period">시간대<select id="period" value={bloodPressureDraft.period} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, period: event.target.value as BloodPressureDraft["period"] }))} disabled={controlsDisabled}><option value="morning">아침 · 기상 후 1시간 이내</option><option value="evening">저녁 · 취침 전</option></select></label><label htmlFor="systolic">수축기 <span className="unit">mmHg</span><input ref={systolicRef} id="systolic" type="number" min="60" max="260" inputMode="numeric" value={bloodPressureDraft.systolic} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, systolic: event.target.value }))} aria-invalid={Boolean(bloodPressureError)} aria-describedby={bloodPressureError ? "blood-pressure-error" : undefined} required disabled={controlsDisabled} /></label><label htmlFor="diastolic">이완기 <span className="unit">mmHg</span><input ref={diastolicRef} id="diastolic" type="number" min="30" max="160" inputMode="numeric" value={bloodPressureDraft.diastolic} onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, diastolic: event.target.value }))} aria-invalid={Boolean(bloodPressureError)} aria-describedby={bloodPressureError ? "blood-pressure-error" : undefined} required disabled={controlsDisabled} /></label></div>{bloodPressureError && <p id="blood-pressure-error" className="field-error" role="alert">{bloodPressureError}</p>}<div className="form-actions"><button type="submit" disabled={controlsDisabled}>{pendingAction === "blood-pressure" ? "저장 중" : editingBloodPressureId ? "변경 저장" : "혈압 기록 저장"}</button>{editingBloodPressureId && <button className="secondary" type="button" onClick={cancelBloodPressureEdit} disabled={controlsDisabled}>수정 취소</button>}</div></form></Scene>;
    }

    if (activeScreen === "S05") {
      return <Scene id="S05" {...journeyCopy.S05} tone="sage" className="saved-scene"><div className="save-ripple" aria-hidden="true"><i /><i /><span>✓</span></div><div className="split-actions"><button type="button" onClick={() => { setConfirmedSave(false); navigate("S02"); }}>오늘의 기록 보기</button><button className="secondary" type="button" onClick={() => { setConfirmedSave(false); navigate("S04"); }}>계속 기록하기</button></div></Scene>;
    }

    if (activeScreen === "S06") {
      return <Scene id="S06" {...journeyCopy.S06} tone="sage"><div className="locked-challenge" data-challenge-period="active"><p className="eyebrow">7일 챌린지 기간</p><span>선택한 행동</span><strong>{activeChallenge ? challengeLabel(activeChallenge.action_id) : "선택한 행동 없음"}</strong>{activeChallenge && <small>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</small>}<p>챌린지 체크인 진행은 최근 7일 기록과 별도로 표시합니다.</p></div><div className="marker-row"><span className="settle-marker" aria-hidden="true" /><div><span>오늘의 상태</span><strong>{todayCheckin ? checkinLabel(todayCheckin.status) : "아직 기록하지 않음"}</strong></div></div><button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button></Scene>;
    }

    if (activeScreen === "S07") {
      return <Scene id="S07" {...journeyCopy.S07} tone="cream"><div className="today-date"><strong>{dateLabel(today)}</strong><span>서로 다른 사실은 합치지 않고 나란히 보여드려요.</span></div>{todayLanes()}<button className="secondary" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button></Scene>;
    }

    if (activeScreen === "S08") {
      return <Scene id="S08" {...journeyCopy.S08} tone="lavender"><div className="scene-toolbar"><span className="utility-label">기록 구간</span><button className="text-button" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button></div>{renderWindowNavigation()}<div className="record-groups" aria-label="기록 종류별 목록">{renderRecordLane("blood-pressure", "혈압 관찰", "아직 혈압 관찰 기록이 없습니다.")}{renderRecordLane("challenge-checkin", "챌린지 참여", "아직 챌린지 참여 기록이 없습니다.")}{renderRecordLane("legacy", "이전 방식의 기록", "이전 방식으로 남긴 기록이 없습니다.")}</div></Scene>;
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
                <p className="notice notice-warning">{selectedRecord.kind === "legacy" ? "이전 방식으로 남긴 기록은 읽기 전용입니다. 날짜가 현재 7일에 포함되어도 수정하거나 삭제할 수 없어요." : "이전 7일의 기록은 읽기 전용입니다."}</p>
              ) : selectedRecord.kind === "challenge-checkin" && (selectedRecord.record.challenge_id !== activeChallenge?.id || activeChallengeEnded) ? (
                <p className="notice notice-warning">현재 활성 챌린지에 속하지 않은 기록은 읽기 전용입니다.</p>
              ) : !evidenceMode && (
                <div className="inline-actions">
                  <button type="button" disabled={controlsDisabled} onClick={() => selectedRecord.kind === "blood-pressure" ? beginBloodPressureEdit(selectedRecord.record) : setEditingChallengeCheckin(selectedRecord.record)}>수정</button>
                  <button className="danger" type="button" disabled={controlsDisabled} onClick={() => { setNotice(null); return selectedRecord.kind === "blood-pressure" ? setPendingBloodPressureDeletion(selectedRecord.record) : setPendingChallengeCheckinDeletion(selectedRecord.record); }}>삭제</button>
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
                {!evidenceMode && <button className="text-button" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing" || controlsDisabled}>새로고침</button>}
              </div>
            </article>
          ) : (
            <div className="state-card"><h2>선택한 기록이 없어요.</h2><button type="button" onClick={() => navigate("S08")}>목록으로 돌아가기</button></div>
          )}
        </Scene>
      );
    }

    if (activeScreen === "S10") {
      return <Scene id="S10" {...journeyCopy.S10} tone="water"><div className="recap-period">{renderWindowNavigation()}</div><div className="recap-summary" data-main-section="seven-day-dashboard" aria-label="최근 7일 기록 요약"><div data-dashboard-lane="blood-pressure"><span>혈압 관찰</span><strong>{windowData?.blood_pressure_observations.length ?? 0}</strong><small>기록</small></div><div data-dashboard-lane="challenge"><span>최근 7일 챌린지 체크인 기록</span><strong>{windowData?.challenge_checkins.length ?? 0}</strong><small>기록</small></div><div data-dashboard-lane="legacy"><span>이전 방식의 기록</span><strong>{windowData?.challenge_events.length ?? 0}</strong><small>읽기 전용</small></div></div><section className="challenge-progress-card" data-challenge-progress aria-labelledby="challenge-progress-title"><p className="eyebrow">챌린지 진행</p>{activeChallenge && !activeChallengeEnded ? <><h2 id="challenge-progress-title">7일 챌린지 · {challengeLabel(activeChallenge.action_id)}</h2><p>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</p><strong>체크인 기록 {activeChallengeCheckins.length}개</strong></> : <><h2 id="challenge-progress-title">진행 중인 7일 챌린지 없음</h2><p>최근 7일 기록과는 별도로 표시합니다.</p></>}</section><div className="record-groups recap-record-groups" aria-label="최근 7일 기록 목록">{renderRecordLane("blood-pressure", "혈압 관찰", "아직 혈압 관찰 기록이 없습니다.")}{renderRecordLane("challenge-checkin", "챌린지 참여", "아직 챌린지 참여 기록이 없습니다.")}{renderRecordLane("legacy", "이전 방식의 기록", "이전 방식의 기록이 없습니다.")}</div><div className="scene-actions utility-actions">{!evidenceMode && <button type="button" onClick={() => void exportRecentRecords()} disabled={controlsDisabled}>{pendingAction === "export" ? "내보내는 중" : "선택한 7일 내보내기"}</button>}<button className="secondary" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing" || controlsDisabled}>{windowState === "refreshing" ? "새로고침 중" : "새로고침"}</button></div></Scene>;
    }

    if (activeScreen === "S11") {
      if (evidenceMode || !session) {
        return <Scene id="S11" {...journeyCopy.S11} tone="lavender" className="signal-scene"><div className="signal-orbit" aria-hidden="true"><span /><span /><i /></div><div className="signal-card" data-model-v2-result-state={modelV2ResultState} role="status" aria-live="polite"><span className="status-pill">{modelV2ResultView.status}</span><h2>{modelV2ResultView.heading}</h2><p>{modelV2ResultView.body}</p></div><p className="signal-disclaimer">{modelV2ResultView.disclaimer}</p></Scene>;
      }
      return (
        <ModelV2InputFlow
          key={session.user.id}
          session={session}
          captureRequestContext={captureRequestContext}
          onSessionExpired={(requestContext) => {
            if (!isCurrentRequestContext(requestContext) || hasNewerToken(requestContext)) return;
            void supabase?.auth.signOut({ scope: "local" });
            applySession(null);
          }}
        />
      );
    }

      return <Scene id="S14" {...journeyCopy.S14} tone="cream"><div className="settings-list"><section><div><p className="eyebrow">계정</p><h2>현재 계정</h2><p>이메일 링크로 연결된 기록만 보여요.</p></div></section><section><div><p className="eyebrow">언어와 시간대</p><h2>한국어 · Asia/Seoul</h2><p>날짜를 한국 시간으로 표시해요.</p></div></section><section><div><p className="eyebrow">내 기록</p><h2>최근 7일 기록</h2><p>관찰과 챌린지 제품 기록은 30일 보관 계약이 적용됩니다. 화면의 최근 7일 탐색은 이 보관 기간과 다른 개념이에요.</p></div><button className="secondary" type="button" onClick={() => navigate("S10")} disabled={controlsDisabled}>7일 기록 보기</button></section><section><div><p className="eyebrow">계정 수명주기</p><h2>Auth와 이메일은 별도예요</h2><p>계정을 삭제하면 저장된 혈압 관찰과 챌린지 제품 기록도 함께 삭제됩니다. 삭제 후 되돌릴 수 없어요.</p></div><button className="danger" type="button" onClick={() => { setAccountDeletionRecovery(null); setAccountDeletionOpen(true); }} disabled={controlsDisabled}>계정 삭제</button></section><section><div><p className="eyebrow">내보낸 파일</p><h2>JSON은 내 기기에 남아요</h2><p>내보낸 JSON은 서버 보관 기간과 별개로 로컬 기기에 남으므로 직접 안전하게 보관하거나 삭제해 주세요.</p></div></section><section><div><p className="eyebrow">도움말</p><h2>저장 여부 확인</h2><p>불확실하면 목록을 새로고침해 먼저 확인해 주세요.</p></div></section></div></Scene>;
  }

  return (
    <SceneShell activeScreen={activeScreen} evidenceLabel={fixture?.name} onNavigate={navigate} onSignOut={!evidenceMode ? () => void handleSignOut() : undefined} signOutPending={signOutPending || accountDeletionPending} companionSelection={companionSelection}>
      {notice && !pendingBloodPressureDeletion && !pendingChallengeCheckinDeletion && <div className={`notice notice-${notice.kind}`} role="status"><div>{notice.reload && <strong className="notice-title">처리 결과 확인 필요</strong>}<span>{notice.message}</span>{notice.reload && <p>같은 요청을 다시 보내기 전에 기록 목록에서 반영 여부를 확인해 주세요.</p>}</div>{notice.reload && <button className="notice-action" type="button" onClick={() => void refreshWindow()} disabled={windowState === "loading" || windowState === "refreshing"}>다시 불러오기</button>}{notice.reload && <button className="notice-action" type="button" onClick={() => navigate("S08")}>기록 목록 보기</button>}</div>}
      {windowState === "refresh-error" && <div className="notice notice-warning" role="status"><div><strong className="notice-title">최신 여부를 확인하지 못했어요</strong><span>새로고침하지 못했어요. 지금 보이는 기록은 그대로 유지됩니다.</span><p>마지막으로 불러온 내용이며, 최근 변경이 반영되지 않았을 수 있어요.</p></div><button className="notice-action" type="button" onClick={() => void refreshWindow()}>다시 불러오기</button></div>}
      {isPriorDashboard && <div className="notice notice-warning" data-read-only-window><span>이전 7일 기록을 읽기 전용으로 보고 있어요.</span><button className="notice-action" type="button" onClick={() => navigate("S02")}>현재 기록으로 돌아가기</button></div>}
      {pendingBloodPressureDeletion && <DeleteConfirmation title={`${dateLabel(pendingBloodPressureDeletion.observed_on)} ${periodLabel(pendingBloodPressureDeletion.period)} 혈압 기록을 삭제할까요?`} pending={pendingAction !== null} error={notice?.reload ? notice.message : undefined} onCancel={() => setPendingBloodPressureDeletion(null)} onConfirm={() => void confirmBloodPressureDeletion()} />}
      {pendingChallengeCheckinDeletion && <DeleteConfirmation title={`${dateLabel(pendingChallengeCheckinDeletion.observed_on)} 챌린지 기록을 삭제할까요?`} pending={pendingAction !== null} error={notice?.reload ? notice.message : undefined} onCancel={() => setPendingChallengeCheckinDeletion(null)} onConfirm={() => void confirmChallengeCheckinDeletion()} />}
      {accountDeletionOpen && <AccountDeletionConfirmation pending={accountDeletionPending} recovery={accountDeletionRecovery} onCancel={() => { if (!accountDeletionPending) { setAccountDeletionOpen(false); setAccountDeletionRecovery(null); } }} onConfirm={() => void confirmAccountDeletion()} />}
      {renderScene()}
    </SceneShell>
  );
}

export default App;
