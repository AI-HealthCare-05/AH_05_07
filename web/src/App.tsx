import { resolvePresentationPolicy } from "./ui/presentationPolicy";
import type { FormEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { sevenDayFacts } from "./ui/livingWeek";
import { JourneyRecap } from "./components/JourneyRecap";
import { StructuredRecapFeedback } from "./components/StructuredRecapFeedback";
import { LivingWeekReport } from "./components/LivingWeekReport";

import { JourneyToday } from "./components/JourneyToday";
import { LoginCompanionNarrator } from "./components/LoginCompanionNarrator";

import { VisualStage } from "./components/VisualStage";

import { Scene, SceneShell, SceneCompanion } from "./components/SceneShell";
import { DeleteConfirmation } from "./components/DeleteConfirmation";
import { RecordExplorer } from "./components/RecordExplorer";
import { BloodPressureDraftNote } from "./components/BloodPressureDraftNote";
import { emptyBloodPressureDraft, useNewBloodPressureDraft, type BloodPressureDraft } from "./components/useNewBloodPressureDraft";
import { useRecordExplorerMemory } from "./components/useRecordExplorerMemory";
import type { RecordBrowseItem } from "./ui/recordExplorer";
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
  type ObservationWindow,
} from "./lib/api";
import { getEvidenceFixture } from "./lib/evidenceFixtures";
import { resolveAuthEmailConfirmIntent, resolveAuthEmailRedirectTo, scrubAuthEmailConfirmUrl } from "./lib/authEmailConfirm";
import { shiftDate } from "./lib/seoulDate";
import { useSeoulDate } from "./lib/useSeoulDate";
import { useSavedSceneEvent } from "./lib/useSavedSceneEvent";
import { allowsE2eFixture, e2eSessionEventName, getE2eSession } from "./lib/e2eHarness";
import { removePersistedSessionIfAccessToken, requestTokenBoundLocalLogout, supabase, supabaseConfigured } from "./lib/supabase";
import { resolveCompanionMode, resolveCompanionSelection, resolveProductionCompanion, type CompanionMode, type CompanionSelectionContext, type CompanionSpecies } from "./ui/companion";
import { companionIdentityOptions, readCompanionIdentity, writeCompanionIdentity } from "./ui/companionIdentity";
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

// Keep Safari's input focus from zooming the viewport and carrying that zoom
// into the saved screen. User zoom and larger root text remain available.
const measurementControlStyle = { fontSize: "max(1rem, 16px)" };

type NoticeOrigin = "session" | "request-error" | "mutation-success" | "edit" | "export-success";
type Notice = {
  kind: "success" | "error" | "warning";
  message: string;
  reload?: boolean;
  origin: NoticeOrigin;
  persistence: "until-navigation" | "persistent";
};
type PendingAction = "blood-pressure" | "challenge-selection" | "challenge-checkin" | "export" | null;
type SavedFactKind = "blood-pressure" | "challenge-checkin";
type WindowState = "loading" | "ready" | "refreshing" | "error" | "refresh-error";
type DashboardWindow = "current" | "prior" | `cycle:${string}`;
type HomeDestinationKey = "blood-pressure" | "challenge" | "today-detail" | "records";
type HomeAction = {
  key: HomeDestinationKey;
  title: string;
  support: string;
  action: string;
  screen: ScreenId;
};
type SessionIdentity = { userId: string | null; generation: number };
type RequestContext = ModelV2RequestContext;
type BloodPressureErrorField = "observed-on" | "systolic" | "diastolic";
type BloodPressureValidationError = {
  field: BloodPressureErrorField;
  message: string;
} | null;

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

function parseDashboardWindow(value: string | null, today: string): DashboardWindow {
  if (value === "prior") return "prior";
  if (value && /^cycle:[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) {
    const end = value.slice(6);
    if (Number.isFinite(Date.parse(`${end}T12:00:00Z`)) && shiftDate(end, 0) === end && end < today) return `cycle:${end}`;
  }
  return "current";
}

function dashboardWindowBounds(today: string, window: DashboardWindow): Pick<ObservationWindow, "start_on" | "end_on"> {
  if (window.startsWith("cycle:")) return { start_on: shiftDate(window.slice(6), -6), end_on: window.slice(6) };
  return window === "prior"
    ? { start_on: shiftDate(today, -13), end_on: shiftDate(today, -7) }
    : { start_on: shiftDate(today, -6), end_on: today };
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" })
    .format(new Date(`${value}T12:00:00+09:00`));
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

function Login({
  onSession,
  recoveryMessage,
  journey,
  today,
  companionMode,
  companionSpecies,
}: {
  onSession: (session: Session) => void;
  recoveryMessage?: string;
  journey: boolean;
  today: string;
  companionMode: CompanionMode;
  companionSpecies: CompanionSpecies;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewNotice, setPreviewNotice] = useState("");
  const previewDays = useMemo(() => {
    const observationPattern = [1, 0, 2, 1, 0, 1, 1] as const;
    const participationPattern = ["기록함", "기록 없음", "기록함", "건너뜀", "기록 없음", "기록함", "기록 없음"] as const;
    return observationPattern.map((observationCount, index) => ({
      date: shiftDate(today, index - 6),
      observationCount,
      participation: participationPattern[index],
    }));
  }, [today]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || pending) return;
    setPending(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: resolveAuthEmailRedirectTo(window.location.href) } });
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

  if (journey && previewOpen) return (
    <main className="journey-demo-preview-shell" data-scene="S01" data-demo-mode="read-only">
      <header className="journey-demo-preview-bar">
        <div>
          <p className="eyebrow">둘러보기</p>
          <strong>예시 화면 · 저장하지 않아요</strong>
        </div>
        <button type="button" className="secondary" onClick={() => { setPreviewOpen(false); setPreviewNotice(""); }}>로그인 화면으로</button>
      </header>
      {previewNotice && <p className="journey-demo-preview-notice" role="status">{previewNotice}</p>}
      <JourneyToday
        staticLandscape
        today={today}
        days={previewDays}
        freshness="ready"
        lead={{
          key: "demo-login",
          title: "이 화면이 로그인 후 첫 화면이에요.",
          support: "둘러보기에서는 예시 기록만 보여드리고 실제 저장은 하지 않아요.",
          action: "로그인하고 기록하기",
          screen: "S04",
        }}
        secondary={[]}
        onNavigate={(screen) => {
          if (screen === "S04") {
            setPreviewOpen(false);
            setPreviewNotice("");
            return;
          }
          setPreviewNotice("둘러보기는 오늘 화면까지만 보여드려요. 실제 기록과 7일 돌아보기는 로그인 후 사용할 수 있어요.");
        }}
      />
    </main>
  );

  if (journey) return (
    <main className="welcome-shell journey-login" data-scene="S01">
      <div className="journey-login-layout">
        <section className="journey-login-intro" aria-labelledby="login-title">
          <p className="eyebrow">상균7데이즈</p>
          <h1 id="login-title">측정한 혈압을 기록하고,<br />최근 7일을 확인해요.</h1>
          <p className="scene-body">측정한 혈압을 날짜·시간대별로 남기고 다시 확인하는 서비스예요. 7일을 채우지 않아도 남긴 기록부터 볼 수 있어요.</p>
          <LoginCompanionNarrator mode={companionMode} species={companionSpecies} />
        </section>
        <section className="welcome-card" aria-label="이메일 로그인">
          <form onSubmit={submit} aria-busy={pending}>
            <label htmlFor="email">이메일</label>
            <input id="email" type="email" autoComplete="email" aria-describedby="login-help" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <div className="entry-auth-wrap">
              <button type="submit" className="entry-auth-button" disabled={pending}>{pending ? "보내는 중" : "로그인 링크 받기"}</button>
              <span className="entry-discount-note" aria-hidden="true">가입비 100% 할인 · 원래 무료예요</span>
            </div>
            <p id="login-help" className="journey-login-help">이메일로 받은 링크를 열면 로그인할 수 있어요. 같은 브라우저에서는 로그인 상태가 유지되면 다시 로그인하지 않고 기록을 이어갈 수 있어요.</p>
          </form>
          {(message || recoveryMessage) && <p className="notice notice-warning" role="status">{message || recoveryMessage}</p>}
          <div className="journey-login-preview-entry">
            <button type="button" className="secondary entry-preview-button" onClick={() => { setPreviewOpen(true); setPreviewNotice(""); }}>둘러보기</button>
            <p>로그인 없이 예시 기록 화면을 먼저 볼 수 있어요. 둘러보기에서는 저장하지 않아요.</p>
          </div>
          <p className="journey-login-steps">이메일 입력 → 메일에서 로그인 → 기록 시작</p>
          <p className="journey-login-demo">로그인 후 남긴 혈압 관찰과 챌린지 기록은 저장한 시점부터 30일 동안 보관돼요. 보관·삭제 안내는 설정과 도움말에서 확인할 수 있어요.</p>
          <p className="welcome-footnote">공용 기기에서는 사용을 마친 뒤 로그아웃해 주세요. 로그아웃하면 이 기기의 현재 계정 연결을 끝냅니다.</p>
        </section>
      </div>
    </main>
  );

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
  const [companionSpeciesPreference, setCompanionSpeciesPreference] = useState<CompanionSpecies>(() => readCompanionIdentity());
  const e2eSession = useMemo(() => getE2eSession(initialSearch.get("e2e")), [initialSearch]);
  const fixture = useMemo(
    () => getEvidenceFixture(
      allowsE2eFixture()
        ? initialSearch.get("fixture") ?? import.meta.env.VITE_SK7_EVIDENCE_MODE ?? import.meta.env.VITE_SK7_EVIDENCE_FIXTURE
        : import.meta.env.VITE_SK7_EVIDENCE_MODE ?? import.meta.env.VITE_SK7_EVIDENCE_FIXTURE,
    ),
    [initialSearch],
  );
  const today = useSeoulDate(fixture?.asOf);
  const evidenceMode = Boolean(fixture);
  const authEmailConfirmIntent = useMemo(() => resolveAuthEmailConfirmIntent(window.location.href), []);
  const modelV2ResultState = useMemo(
    () => resolveModelV2ResultState(initialSearch.get("model_v2_state"), allowsE2eFixture()),
    [initialSearch],
  );
  const modelV2ResultView = getModelV2ResultView(modelV2ResultState);
  const [requestedScreen, setRequestedScreen] = useState<ScreenId>(() => parseScreen(initialSearch.get("screen")));
  const [dashboardWindow, setDashboardWindow] = useState<DashboardWindow>(() => parseDashboardWindow(initialSearch.get("dashboard_window"), today));
  const selectedBounds = useMemo(
    () => fixture?.window && dashboardWindow === "current" ? fixture.window : dashboardWindowBounds(today, dashboardWindow),
    [dashboardWindow, fixture, today],
  );
  const startOn = selectedBounds.start_on;
  const endOn = selectedBounds.end_on;
  const isPriorDashboard = dashboardWindow !== "current";
  const isCycleReview = dashboardWindow.startsWith("cycle:");
  const dashboardPeriodName = isCycleReview ? "종료된 7일" : isPriorDashboard ? "이전 7일" : "현재 7일";
  const [session, setSession] = useState<Session | null>(e2eSession);
  const [authBootstrapPending, setAuthBootstrapPending] = useState(
    () => !evidenceMode
      && !e2eSession
      && !allowsE2eFixture()
      && supabaseConfigured
      && authEmailConfirmIntent.kind === "none",
  );
  const [authEmailConfirmPending, setAuthEmailConfirmPending] = useState(
    () => !evidenceMode && authEmailConfirmIntent.kind !== "none",
  );
  const [windowData, setWindowData] = useState<ObservationWindow | null>(fixture?.window ?? null);
  const [windowState, setWindowState] = useState<WindowState>(fixture?.loadError ? "error" : fixture ? "ready" : "loading");
  const [reportCreatedAt, setReportCreatedAt] = useState<Date | null>(null);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [newBloodPressureRecovery, setNewBloodPressureRecovery] = useState<Notice | null>(null);
  const [previousCycleEnd, setPreviousCycleEnd] = useState<string | null>(null);
  const [challengeNeedsReload, setChallengeNeedsReload] = useState(false);
  const challengeRequestRef = useRef<RequestContext | null>(null);
  const navigationVersionRef = useRef(0);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmedSave, setConfirmedSave] = useState(
    () => companionMode === "review" && Boolean(fixture) && allowsE2eFixture() && initialSearch.get("companion_context") === "save_success",
  );
  const [savedFactKind, setSavedFactKind] = useState<SavedFactKind>("blood-pressure");
  const [savedFactDate, setSavedFactDate] = useState(today);
  const savedScene = useSavedSceneEvent();
  const [bloodPressureEditDraft, setBloodPressureEditDraft] = useState<BloodPressureDraft>(() => emptyBloodPressureDraft(today));
  const [bloodPressureError, setBloodPressureError] = useState<BloodPressureValidationError>(null);
  const [editingBloodPressureId, setEditingBloodPressureId] = useState<string | null>(null);
  const [pendingBloodPressureDeletion, setPendingBloodPressureDeletion] = useState<BloodPressureObservation | null>(null);
  const [editingChallengeCheckin, setEditingChallengeCheckin] = useState<ChallengeCheckin | null>(null);
  const [pendingChallengeCheckinDeletion, setPendingChallengeCheckinDeletion] = useState<ChallengeCheckin | null>(null);
  const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(() => initialSearch.get("record"));
  const observedOnRef = useRef<HTMLInputElement>(null);
  const systolicRef = useRef<HTMLInputElement>(null);
  const diastolicRef = useRef<HTMLInputElement>(null);
  const windowRequestId = useRef(0);
  const windowLoadSessionRef = useRef<{
    userId: string | null;
    accessToken: string | null;
  }>({ userId: null, accessToken: null });
  const editOriginKey = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(e2eSession);
  const sessionIdentityRef = useRef<SessionIdentity>({ userId: e2eSession?.user.id ?? null, generation: e2eSession ? 1 : 0 });
  const newBloodPressure = useNewBloodPressureDraft(sessionIdentityRef.current.generation, today, requestedScreen === "S04" && !editingBloodPressureId);
  const bloodPressureDraft = editingBloodPressureId ? bloodPressureEditDraft : newBloodPressure.draft;
  const setBloodPressureDraft = editingBloodPressureId ? setBloodPressureEditDraft : newBloodPressure.setDraft;
  const recordExplorer = useRecordExplorerMemory(`${sessionIdentityRef.current.generation}:${startOn}:${endOn}`, requestedScreen);
  const sessionUpdateVersionRef = useRef(0);
  const accountDeletionStartedRef = useRef(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [accountDeletionOpen, setAccountDeletionOpen] = useState(false);
  const [accountDeletionPending, setAccountDeletionPending] = useState(false);
  const [accountDeletionRecovery, setAccountDeletionRecovery] = useState<AccountDeletionRecovery>(null);
  const presentationRef = useRef({ today, startOn, endOn, windowData, accountDeletionPending });

  useLayoutEffect(() => {
    const previous = presentationRef.current;
    // Invalidate before passive refresh effects: old success AND error callbacks
    // must not commit across a calendar/window change, even after A -> B -> A.
    if (previous.startOn !== startOn || previous.endOn !== endOn) windowRequestId.current += 1;
    presentationRef.current = { today, startOn, endOn, windowData, accountDeletionPending };
  }, [today, startOn, endOn, windowData, accountDeletionPending]);

  function applySession(nextSession: Session | null) {
    sessionUpdateVersionRef.current += 1;
    const nextUserId = nextSession?.user.id ?? null;
    const currentIdentity = sessionIdentityRef.current;
    if (currentIdentity.userId === nextUserId) {
      if (sessionRef.current?.access_token !== nextSession?.access_token) {
        accountDeletionStartedRef.current = false;
        setAccountDeletionOpen(false);
        setAccountDeletionPending(false);
        setAccountDeletionRecovery(null);
      }
      sessionRef.current = nextSession;
      setSession(nextSession);
      return;
    }

    sessionIdentityRef.current = { userId: nextUserId, generation: currentIdentity.generation + 1 };
    sessionRef.current = nextSession;
    windowRequestId.current += 1;
    setSession(nextSession);
    setPreviousCycleEnd(null);
    setChallengeNeedsReload(false);
    challengeRequestRef.current = null;
    setSignOutPending(false);
    accountDeletionStartedRef.current = false;
    setAccountDeletionOpen(false);
    setAccountDeletionPending(false);
    setAccountDeletionRecovery(null);
    setWindowData(null);
    setWindowState("loading");
    setNotice(null);
    setNewBloodPressureRecovery(null);
    setPendingAction(null);
    setConfirmedSave(false);
    savedScene.clear();
    setBloodPressureEditDraft(emptyBloodPressureDraft(presentationRef.current.today));
    setBloodPressureError(null);
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

  function isApplicableAccountDeletionCompletion(requestContext: RequestContext): boolean {
    return isCurrentRequestContext(requestContext) && !hasNewerToken(requestContext);
  }

  useEffect(() => {
    const currentUserId = sessionIdentityRef.current.userId;
    if (currentUserId) {
      window.history.replaceState({ ...(window.history.state ?? {}), sk7UserId: currentUserId }, "", window.location.href);
    }
  }, []);

  useEffect(() => {
    if (evidenceMode) return;
    const emailConfirmRequested = authEmailConfirmIntent.kind !== "none";
    if (allowsE2eFixture() && !emailConfirmRequested) {
      const onSyntheticSession = (event: Event) => {
        applySession((event as CustomEvent<Session | null>).detail ?? null);
      };
      window.addEventListener(e2eSessionEventName, onSyntheticSession);
      return () => window.removeEventListener(e2eSessionEventName, onSyntheticSession);
    }
    if (!supabase) {
      setAuthEmailConfirmPending(false);
      return;
    }

    let cancelled = false;
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!cancelled) applySession(nextSession);
    });
    const unsubscribe = () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };

    if (emailConfirmRequested) {
      window.history.replaceState(
        window.history.state ?? {},
        "",
        scrubAuthEmailConfirmUrl(window.location.href),
      );

      if (authEmailConfirmIntent.kind === "invalid") {
        setNotice(makeNotice(
          "warning",
          "로그인 링크를 확인할 수 없어요. 새 로그인 링크를 요청해 주세요.",
          { origin: "session" },
        ));
        setAuthEmailConfirmPending(false);
        return unsubscribe;
      }

      void supabase.auth.verifyOtp({
        token_hash: authEmailConfirmIntent.tokenHash,
        type: "email",
      }).then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data.session) {
          setNotice(makeNotice(
            "warning",
            "로그인 링크를 확인할 수 없어요. 새 로그인 링크를 요청해 주세요.",
            { origin: "session" },
          ));
          setAuthEmailConfirmPending(false);
          return;
        }
        applySession(data.session);
        setAuthEmailConfirmPending(false);
      }).catch(() => {
        if (cancelled) return;
        setNotice(makeNotice(
          "warning",
          "로그인 링크를 확인하지 못했어요. 연결을 확인한 뒤 새 로그인 링크를 요청해 주세요.",
          { origin: "session" },
        ));
        setAuthEmailConfirmPending(false);
      });
      return unsubscribe;
    }

    const bootstrapVersion = sessionUpdateVersionRef.current;
    void supabase.auth.getSession()
      .then(({ data }) => {
        if (!cancelled && sessionUpdateVersionRef.current === bootstrapVersion) applySession(data.session);
      })
      .finally(() => {
        if (!cancelled) setAuthBootstrapPending(false);
      });
    return unsubscribe;
  }, [authEmailConfirmIntent, evidenceMode, e2eSession]);

  const sessionUserId = session?.user.id ?? null;
  const sessionAccessToken = session?.access_token ?? null;

  // Report visibility is disposable and never follows a new account, date or screen.
  useLayoutEffect(() => {
    setReportCreatedAt(null);
  }, [requestedScreen, dashboardWindow, today, sessionUserId]);

  useEffect(() => {
    const previous = windowLoadSessionRef.current;
    const sameUserTokenRefresh =
      previous.userId !== null
      && previous.userId === sessionUserId
      && previous.accessToken !== sessionAccessToken;

    windowLoadSessionRef.current = {
      userId: sessionUserId,
      accessToken: sessionAccessToken,
    };

    if (evidenceMode || !sessionUserId || !sessionAccessToken) return;

    // While the very first window is still unresolved, a same-user token
    // refresh must not start a competing GET and invalidate that pending
    // request. If the pending request returns 401, refreshWindow() already
    // retries once with the newer token.
    if (
      sameUserTokenRefresh
      && presentationRef.current.windowData === null
    ) return;

    // Opt in only on session entry, not date/window changes that also clear data.
    void refreshWindow({ initialLoad: previous.userId !== sessionUserId });
  }, [
    endOn,
    evidenceMode,
    sessionAccessToken,
    sessionUserId,
    startOn,
  ]);

  useEffect(() => {
    const onPopState = () => {
      navigationVersionRef.current += 1;
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
        savedScene.clear();
        newBloodPressure.reset(presentationRef.current.today);
        setNewBloodPressureRecovery(null);
        setBloodPressureEditDraft(emptyBloodPressureDraft(presentationRef.current.today));
        setBloodPressureError(null);
        setEditingBloodPressureId(null);
        setPendingBloodPressureDeletion(null);
        setEditingChallengeCheckin(null);
        setPendingChallengeCheckinDeletion(null);
        editOriginKey.current = null;
        if (dashboardWindow === "current") void refreshWindow();
        return;
      }
      setNotice((current) => current?.persistence === "until-navigation" ? null : current);
      setPendingBloodPressureDeletion(null);
      setPendingChallengeCheckinDeletion(null);
      setEditingChallengeCheckin(null);
      setRequestedScreen(parseScreen(search.get("screen")));
      setSelectedRecordKey(search.get("record"));
      const nextWindow = parseDashboardWindow(search.get("dashboard_window"), presentationRef.current.today);
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
    navigationVersionRef.current += 1;
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }

  function presentRequestError(error: unknown, context: "load" | "save" | "delete" | "export", requestContext?: RequestContext) {
    if (isSessionError(error) && !hasNewerToken(requestContext)) {
      void supabase?.auth.signOut({ scope: "local" });
      applySession(null);
      setNotice(makeNotice("warning", "로그인 시간이 만료되었습니다. 이메일 링크로 다시 로그인해 주세요.", { origin: "session" }));
      return;
    }
    if (context === "load") {
      setWindowState(presentationRef.current.windowData ? "refresh-error" : "error");
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
    const recovery = makeNotice("warning", message, { origin: "request-error", reload: context !== "export" });
    setNotice(recovery);
    return recovery;
  }

  function handleStructuredFeedbackSessionError(error: ApiRequestError, requestSession: Session) {
    const requestContext = captureRequestContext(requestSession);
    if (!requestContext || !isCurrentRequestContext(requestContext)) return;
    presentRequestError(error, "save", requestContext);
  }

  async function refreshWindow({ allowRetry = true, initialLoad = false } = {}) {
    // A pre-midnight mutation may call this old function after the date changes.
    // Read committed presentation bounds and the latest session at invocation.
    const activeSession = sessionRef.current;
    const snapshot = presentationRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || evidenceMode || snapshot.accountDeletionPending) return;
    const requestId = ++windowRequestId.current;
    setWindowState(snapshot.windowData ? "refreshing" : "loading");
    try {
      const nextData = await getObservationWindow(activeSession, snapshot.startOn, snapshot.endOn);
      if (requestId !== windowRequestId.current || !isCurrentRequestContext(requestContext)) return;
      setWindowData(nextData);
      setWindowState("ready");
      setChallengeNeedsReload(false);
    } catch (error) {
      if (requestId !== windowRequestId.current || !isCurrentRequestContext(requestContext)) return;
      // One shared retry budget: a transient bootstrap failure and a stale
      // token must never combine into a third GET. Manual/subsequent loads
      // retain only the existing newer-token 401 behavior from #399.
      const transientInitialRead = initialLoad && snapshot.windowData === null
        && error instanceof ApiRequestError
        // A stalled error body must not turn a known ordinary HTTP failure
        // (such as 403/429/500) into a retryable status-0 timeout.
        && (error.responseStatus === undefined || error.responseStatus < 400
          || [502, 503, 504].includes(error.responseStatus))
        && ((error.status === 0 && (error.code === "network_error" || error.code === "request_timeout"))
          || error.status === 502 || error.status === 503 || error.status === 504);
      if (allowRetry && (transientInitialRead || (isSessionError(error) && hasNewerToken(requestContext)))) {
        await refreshWindow({ allowRetry: false });
        return;
      }
      presentRequestError(error, "load", requestContext);
    }
  }

  function selectDashboardWindow(nextWindow: DashboardWindow) {
    if (evidenceMode || nextWindow === dashboardWindow) return;
    navigationVersionRef.current += 1;
    const url = new URL(window.location.href);
    setNotice((current) => current?.persistence === "until-navigation" ? null : current);
    windowRequestId.current += 1;
    if (nextWindow !== "current") url.searchParams.set("dashboard_window", nextWindow);
    else url.searchParams.delete("dashboard_window");
    url.searchParams.delete("record");
    window.history.pushState({ ...(window.history.state ?? {}), sk7UserId: sessionIdentityRef.current.userId }, "", url);
    setSelectedRecordKey(null);
    setWindowData(null);
    setWindowState("loading");
    setDashboardWindow(nextWindow);
  }

  async function finishAccountDeletion(requestContext: RequestContext) {
    if (!isApplicableAccountDeletionCompletion(requestContext)) return;
    windowRequestId.current += 1;
    try {
      await requestTokenBoundLocalLogout(requestContext.accessToken);
    } catch {
      // The Auth account is already deleted. Local cleanup below remains authoritative.
    }

    if (!isApplicableAccountDeletionCompletion(requestContext)) return;
    const cleanup = removePersistedSessionIfAccessToken(requestContext.accessToken);
    if (cleanup === "different" || cleanup === "malformed") {
      if (!isApplicableAccountDeletionCompletion(requestContext)) return;
      accountDeletionStartedRef.current = false;
      setAccountDeletionPending(false);
      setAccountDeletionOpen(false);
      setAccountDeletionRecovery(null);
      return;
    }
    if (!isApplicableAccountDeletionCompletion(requestContext)) return;

    accountDeletionStartedRef.current = false;
    setAccountDeletionPending(false);
    setAccountDeletionOpen(false);
    setAccountDeletionRecovery(null);
    applySession(null);
  }

  async function inspectAccountDeletionOutcome(requestContext: RequestContext): Promise<"terminal" | "still-valid" | "ambiguous"> {
    if (!supabase) return "ambiguous";
    try {
      const { data, error } = await supabase.auth.getUser(requestContext.accessToken);
      if (!isApplicableAccountDeletionCompletion(requestContext)) return "ambiguous";
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
      if (!isApplicableAccountDeletionCompletion(requestContext)) return;
      await finishAccountDeletion(requestContext);
    } catch (error) {
      if (!isApplicableAccountDeletionCompletion(requestContext)) return;
      if (isAccountDeletionRecoveryCandidate(error)) {
        const outcome = await inspectAccountDeletionOutcome(requestContext);
        if (!isApplicableAccountDeletionCompletion(requestContext)) return;
        if (outcome === "terminal") {
          await finishAccountDeletion(requestContext);
          return;
        }
        if (!isApplicableAccountDeletionCompletion(requestContext)) return;
        accountDeletionStartedRef.current = false;
        setAccountDeletionPending(false);
        setAccountDeletionRecovery(outcome === "still-valid" ? "still-valid" : "ambiguous");
        return;
      }
      if (!isApplicableAccountDeletionCompletion(requestContext)) return;
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
    setBloodPressureError(null);
    if (!bloodPressureDraft.observedOn) {
      setBloodPressureError({
        field: "observed-on",
        message: "날짜를 선택해 주세요.",
      });
      observedOnRef.current?.focus();
      return null;
    }
    if (!Number.isInteger(systolic) || systolic < 60 || systolic > 260) {
      setBloodPressureError({
        field: "systolic",
        message: "수축기 값은 60에서 260 사이의 정수로 입력해 주세요.",
      });
      systolicRef.current?.focus();
      return null;
    }
    if (!Number.isInteger(diastolic) || diastolic < 30 || diastolic > 160) {
      setBloodPressureError({
        field: "diastolic",
        message: "이완기 값은 30에서 160 사이의 정수로 입력해 주세요.",
      });
      diastolicRef.current?.focus();
      return null;
    }
    if (systolic <= diastolic) {
      setBloodPressureError({
        field: "systolic",
        message: "수축기 값은 이완기 값보다 크게 입력해 주세요.",
      });
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
    const editingRecordId = editingBloodPressureId;
    const editReturnKey = editOriginKey.current;
    setPendingAction("blood-pressure");
    try {
      if (editingRecordId) {
        await updateBloodPressureObservation(activeSession, editingRecordId, payload);
      } else {
        await createBloodPressureObservation(activeSession, payload);
      }
      if (!isCurrentRequestContext(requestContext)) return;
      const saveVisual = editingRecordId ? null : savedScene.confirmPersistence();
      await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      if (editingRecordId) {
        setBloodPressureEditDraft(emptyBloodPressureDraft(presentationRef.current.today));
        setEditingBloodPressureId(null);
        editOriginKey.current = null;
        setNotice(makeNotice("success", "혈압 기록을 수정했습니다.", { origin: "mutation-success" }));
        if (editReturnKey) window.history.back();
        else navigate("S08");
        return;
      }

      setNotice(null);
      newBloodPressure.reset(presentationRef.current.today);
      setNewBloodPressureRecovery(null);
      setEditingBloodPressureId(null);
      savedScene.present(saveVisual);
      setSavedFactKind("blood-pressure");
      setSavedFactDate(payload.observed_on);
      setConfirmedSave(true);
      navigate("S05");
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) {
        const recovery = presentRequestError(error, "save", requestContext);
        // Keep the original uncertainty and fresh-read action with the parked
        // new entry, even if an unrelated edit later replaces the global notice.
        if (!editingRecordId && isCurrentRequestContext(requestContext)) setNewBloodPressureRecovery(recovery?.reload ? recovery : null);
      }
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  function beginBloodPressureEdit(record: BloodPressureObservation) {
    editOriginKey.current = selectedRecordKey;
    setEditingBloodPressureId(record.id);
    setPendingBloodPressureDeletion(null);
    setBloodPressureEditDraft({ observedOn: record.observed_on, period: record.period, systolic: String(record.systolic), diastolic: String(record.diastolic) });
    setBloodPressureError(null);
    setNotice(makeNotice("warning", `${dateLabel(record.observed_on)} ${periodLabel(record.period)} 기록을 수정할 수 있습니다.`, { origin: "edit" }));
    navigate("S04");
  }

  function cancelBloodPressureEdit() {
    const originKey = editOriginKey.current;
    setEditingBloodPressureId(null);
    setBloodPressureError(null);
    setBloodPressureEditDraft(emptyBloodPressureDraft(today));
    setNotice(null);
    editOriginKey.current = null;

    if (originKey) {
      window.history.back();
      return;
    }

    navigate("S08");
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
      await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      setNotice(makeNotice("success", "혈압 기록을 삭제했습니다.", { origin: "mutation-success" }));
      returnAfterRecordDeletion();
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
    if (challengeRequestRef.current || challengeNeedsReload || windowState !== "ready") return;
    challengeRequestRef.current = requestContext;
    windowRequestId.current += 1;
    const previous = presentationRef.current.windowData?.active_challenge;
    if (previous && presentationRef.current.today > previous.ends_on) setPreviousCycleEnd(previous.ends_on);
    const navigationVersion = navigationVersionRef.current;
    setPendingAction("challenge-selection");
    try {
      await selectActiveChallenge(activeSession, actionId);
      if (!isCurrentRequestContext(requestContext)) return;
      await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      setNotice(makeNotice("success", "7일 챌린지를 선택했습니다.", { origin: "mutation-success" }));
      if (navigationVersion === navigationVersionRef.current) navigate("S02");
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) {
        setChallengeNeedsReload(true);
        presentRequestError(error, "save", requestContext);
      }
    } finally {
      if (challengeRequestRef.current === requestContext) challengeRequestRef.current = null;
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
      const saveVisual = savedScene.confirmPersistence();
      await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      setNotice(null);
      savedScene.present(saveVisual);
      setSavedFactKind("challenge-checkin");
      setSavedFactDate(today);
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
      await refreshWindow();
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
      await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      setNotice(makeNotice("success", "챌린지 기록을 삭제했습니다.", { origin: "mutation-success" }));
      returnAfterRecordDeletion();
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

  const presentation = resolvePresentationPolicy(import.meta.env.VITE_SK7_UI_MODE, import.meta.env.VITE_SK7_SCENE_MODE);

  if (!evidenceMode && !e2eSession && !supabaseConfigured) {
    return <main className="welcome-shell"><p className="notice notice-error">웹 환경변수를 설정한 뒤 시작할 수 있습니다.</p></main>;
  }
  if (!evidenceMode && (authEmailConfirmPending || authBootstrapPending)) {
    return (
      <main className="welcome-shell">
        <section className="welcome-card" aria-live="polite">
          <p className="eyebrow">상균7데이즈</p>
          <h1>{authEmailConfirmPending ? "로그인 링크를 확인하고 있어요." : "로그인 상태를 확인하고 있어요."}</h1>
          <p className="scene-body">잠시만 기다려 주세요.</p>
        </section>
      </main>
    );
  }
  if (!evidenceMode && !session) {
    return <Login journey={presentation.journey} today={today} companionMode={companionMode} companionSpecies={companionSpeciesPreference} onSession={applySession} recoveryMessage={notice?.kind === "warning" ? notice.message : undefined} />;
  }

  const activeChallenge = windowData?.active_challenge ?? null;
  const activeChallengeEnded = Boolean(activeChallenge && today > activeChallenge.ends_on);
  const todayCheckin = windowData?.challenge_checkins.find((checkin) => checkin.challenge_id === activeChallenge?.id && checkin.observed_on === today);
  const activeChallengeCheckins = activeChallenge
    ? (windowData?.challenge_checkins.filter((checkin) => checkin.challenge_id === activeChallenge.id) ?? [])
    : [];
  const trailDays = sevenDayFacts(endOn, windowData?.blood_pressure_observations ?? [], windowData?.challenge_checkins ?? []);
  const todayMeasurements = windowData?.blood_pressure_observations.filter((record) => record.observed_on === today) ?? [];
  const todayMeasurement = todayMeasurements[0];
  const todayMorningMeasurement = todayMeasurements.find((record) => record.period === "morning");
  const todayEveningMeasurement = todayMeasurements.find((record) => record.period === "evening");
  const todayBloodPressureStatus = !todayMeasurement
    ? "오늘 혈압 기록 전"
    : todayMorningMeasurement && todayEveningMeasurement
      ? "오늘 아침·저녁 기록 있음"
      : todayMorningMeasurement
        ? "오늘 아침 기록 있음"
        : "오늘 저녁 기록 있음";
  const recentBloodPressureCount = isPriorDashboard
    ? 0
    : windowData?.blood_pressure_observations.length ?? 0;
  const todayBloodPressureSupport = !todayMeasurement
    ? recentBloodPressureCount > 0
      ? `최근 7일에 혈압 기록 ${recentBloodPressureCount}건이 있어요. 오늘 측정한 값을 이어서 남겨요.`
      : "오늘 측정한 값을 남겨요."
    : todayMorningMeasurement && todayEveningMeasurement
      ? "아침·저녁 기록이 있어요. 저장한 내용을 확인해요."
      : todayMorningMeasurement
        ? "아침 기록이 있어요. 저장한 내용을 확인해요."
        : "저녁 기록이 있어요. 저장한 내용을 확인해요.";
  const additionalBloodPressureSupport =
    todayMorningMeasurement && !todayEveningMeasurement
      ? "아침 기록이 있어요. 다른 시간대 측정값은 필요할 때 추가할 수 있어요."
      : todayEveningMeasurement && !todayMorningMeasurement
        ? "저녁 기록이 있어요. 다른 시간대 측정값은 필요할 때 추가할 수 있어요."
        : "오늘 측정한 값을 바로 기록해요.";
  const controlsDisabled = pendingAction !== null || isPriorDashboard || accountDeletionPending;
  const readNavigationDisabled = pendingAction !== null || accountDeletionPending;
  const displayMeasurement = (record: BloodPressureObservation) => evidenceMode ? "•••/•• mmHg" : `${record.systolic}/${record.diastolic} mmHg`;
  const recordBrowseItems: RecordBrowseItem[] = [
    ...(windowData?.blood_pressure_observations.map((record) => ({ key: `blood-pressure:${record.id}`, kind: "blood-pressure" as const, record })) ?? []),
    ...(windowData?.challenge_checkins.map((record) => ({ key: `challenge-checkin:${record.id}`, kind: "challenge-checkin" as const, record })) ?? []),
    ...(windowData?.challenge_events.map((record) => ({ key: `legacy:${record.id}`, kind: "legacy" as const, record })) ?? []),
  ].sort((left, right) => right.record.observed_on.localeCompare(left.record.observed_on));
  const selectedRecord = selectedRecordKey ? recordBrowseItems.find((record) => record.key === selectedRecordKey) : null;
  const selectedRecordMissing = Boolean(selectedRecordKey && !selectedRecord);
  const ready = windowState === "ready" || windowState === "refreshing" || windowState === "refresh-error";
  const reportAvailable = !evidenceMode && Boolean(session) && (!isPriorDashboard || isCycleReview) && ready
    && windowData?.start_on === startOn && windowData?.end_on === endOn;
  const reportVisible = reportCreatedAt !== null && reportAvailable && requestedScreen === "S10";
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
        : requestedScreen === "S06" && !activeChallenge
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
  const challengeDestination: ScreenId = activeChallenge ? "S06" : "S03";
  const homeChallengeTitle = activeChallengeEnded
    ? "종료된 챌린지"
    : activeChallenge
      ? todayCheckin
        ? "오늘 챌린지 확인"
        : "오늘 챌린지 상태"
      : "7일 챌린지";
  const homeChallengeSupport = activeChallengeEnded
    ? "종료된 챌린지 확인하기"
    : activeChallenge
      ? todayCheckin
        ? `${challengeLabel(activeChallenge.action_id)} · 오늘 상태 ${checkinLabel(todayCheckin.status)}`
        : `${challengeLabel(activeChallenge.action_id)} · 오늘 상태는 아직 기록하지 않았어요.`
      : "선택 기능 · 이어갈 행동 고르기";
  const homeLead: HomeAction = !todayMeasurement
    ? { key: "blood-pressure", title: "오늘 혈압 기록", support: todayBloodPressureSupport, action: "혈압 기록하기", screen: "S04" }
    : { key: "today-detail", title: "오늘 혈압 기록 확인", support: todayBloodPressureSupport, action: "오늘 기록 보기", screen: "S07" };
  const bloodPressureSecondaryAction: HomeAction =
    todayMorningMeasurement && todayEveningMeasurement
      ? {
          key: "records",
          title: "기록 찾아보기",
          support: "오늘 아침·저녁 기록이 모두 있어요. 지난 기록은 날짜별로 확인해요.",
          action: "기록 찾아보기",
          screen: "S08",
        }
      : {
          key: "blood-pressure",
          title: "혈압 추가 기록",
          support: additionalBloodPressureSupport,
          action: "혈압 추가 기록하기",
          screen: "S04",
        };
  const homeSecondaryActions = ([
    bloodPressureSecondaryAction,
    {
      key: "challenge",
      title: homeChallengeTitle,
      support: homeChallengeSupport,
      action: "챌린지 열기",
      screen: challengeDestination,
    },
    {
      key: "today-detail",
      title: todayMeasurement ? "오늘 상세" : "오늘 상태",
      support: todayMeasurement
        ? "오늘 남긴 혈압 기록과 챌린지 상태를 확인해요."
        : "오늘 혈압 기록 여부와 챌린지 상태를 확인해요.",
      action: todayMeasurement ? "오늘 상세 열기" : "오늘 상태 보기",
      screen: "S07",
    },
  ] as HomeAction[]).filter((item) => item.key !== homeLead.key);

  function openCycleReview(end: string) {
    navigate("S10");
    selectDashboardWindow(`cycle:${end}`);
  }

  function renderCycleActions() {
    if (!activeChallengeEnded || !activeChallenge) return null;
    return <section className="locked-challenge" data-living-cycle="ended" aria-label="종료된 챌린지">
      <h2>이번 챌린지가 끝났어요</h2>
      <p>{activeChallenge.starts_on} ~ {activeChallenge.ends_on} · {challengeLabel(activeChallenge.action_id)}</p>
      <p>남긴 기록은 보관 기간 안에서 다시 볼 수 있어요.</p>
      <div className="inline-actions">
        <button type="button" disabled={readNavigationDisabled || windowState !== "ready" || challengeNeedsReload} onClick={() => { setPreviousCycleEnd(activeChallenge.ends_on); navigate("S03"); }}>다음 챌린지 고르기</button>
        {!isCycleReview && <button type="button" className="secondary" disabled={readNavigationDisabled || evidenceMode} onClick={() => openCycleReview(activeChallenge.ends_on)}>종료된 7일 돌아보기</button>}
      </div>
    </section>;
  }

  function openRecord(item: RecordBrowseItem, returnScreen: "S08" | "S10" = "S08") {
    navigate("S09", item.key);
    window.history.replaceState(
      { ...(window.history.state ?? {}), recordReturnScreen: returnScreen },
      "",
      window.location.href,
    );
  }

  function returnFromRecordDetail() {
    const returnScreen = window.history.state?.recordReturnScreen;
    if (returnScreen === "S08" || returnScreen === "S10") {
      window.history.back();
      return;
    }
    navigate("S08");
  }

  function returnAfterRecordDeletion() {
    const returnScreen = window.history.state?.recordReturnScreen;
    if (returnScreen === "S08" || returnScreen === "S10") {
      window.history.back();
      return;
    }
    navigate("S08", null, true);
  }

  function renderWindowNavigation() {
    return <nav className="window-nav" data-dashboard-window={dashboardWindow} aria-label="7일 기록 구간"><button className="secondary" type="button" onClick={() => selectDashboardWindow("prior")} disabled={evidenceMode || dashboardWindow === "prior"}>이전 7일 보기</button><p><span>{dashboardPeriodName} · {isPriorDashboard ? "읽기 전용" : "오늘 포함"}</span><strong>{dateLabel(startOn)} ~ {dateLabel(endOn)}</strong><small>챌린지 진행률이 아닙니다.</small></p><button className="secondary" type="button" onClick={() => selectDashboardWindow("current")} disabled={evidenceMode || dashboardWindow === "current"}>현재 7일 보기</button></nav>;
  }

  function renderReportAction() {
    if (evidenceMode) return null;
    return <div className="living-week-report-action">
      <button ref={reportTriggerRef} type="button" className="secondary" disabled={!reportAvailable || readNavigationDisabled} aria-describedby="living-week-report-scope" onClick={() => setReportCreatedAt(new Date())}>7일 리포트 보기</button>
      <small id="living-week-report-scope">{isCycleReview ? "종료된 7일 전체를 정리해요." : isPriorDashboard
        ? "리포트는 현재 7일에서 볼 수 있어요. 현재 7일 보기로 돌아가 주세요."
        : !reportAvailable ? "현재 7일의 기록을 불러온 뒤 리포트를 볼 수 있어요."
        : "펼쳐 본 날짜와 관계없이 현재 7일 전체를 정리해요."}</small>
    </div>;
  }

  function renderRecordLane(kind: RecordBrowseItem["kind"], title: string, emptyText: string, journal = false, recordReading = false, focusedDate: string | null = null) {
    const items = recordBrowseItems.filter((item) => item.kind === kind && (!focusedDate || item.record.observed_on === focusedDate));
    return (
      <section className="record-lane" data-record-lane={kind === "challenge-checkin" ? "challenge" : kind}>
        {journal ? <>
          <div className="recap-lane-heading"><h3>{title}</h3><span data-dashboard-lane={kind === "challenge-checkin" ? "challenge" : kind}><strong>{items.length}</strong>개 기록</span></div>
          <p className="recap-lane-note">{kind === "blood-pressure" ? "직접 남긴 측정값 · 날짜와 시간대별" : kind === "challenge-checkin" ? "기록함과 건너뜀을 구분해요. 체크인 수는 달성일이 아니에요." : "이전 방식으로 남긴 기록 · 읽기 전용"}</p>
        </> : recordReading ? <>
          <div className="journey-record-lane-heading"><div><p className="eyebrow">{kind === "blood-pressure" ? "측정값" : kind === "challenge-checkin" ? "체크인" : "읽기 전용"}</p><h2>{title}</h2></div><span>{items.length}개</span></div>
          <p className="journey-record-lane-note">{kind === "blood-pressure" ? "날짜와 시간대별로 남긴 측정값이에요." : kind === "challenge-checkin" ? "행동과 기록함·건너뜀 상태를 따로 확인해요." : "이전 방식으로 남긴 기록은 수정하거나 삭제할 수 없어요."}</p>
        </> : <h2>{title}</h2>}
        <ul className={`record-list${recordReading ? " journey-record-list" : ""}`}>
          {items.length ? items.map((item) => (
            <li key={item.key} data-record-date={item.record.observed_on}>
              {journal ? <span className="recap-record-facts">
                <span className="recap-record-date"><strong><time dateTime={item.record.observed_on}>{dateLabel(item.record.observed_on)}</time></strong>{item.kind === "blood-pressure" && <small>{periodLabel(item.record.period)}</small>}</span>
                {item.kind === "blood-pressure" ? <span className="recap-record-value">{displayMeasurement(item.record)}</span> : <>
                  <span className="recap-record-value">{challengeLabel(item.record.action_id)}</span>
                  <span className="recap-record-status" data-checkin-status={item.record.status}>{checkinLabel(item.record.status)}{item.kind === "legacy" ? " · 이전 기록 · 읽기 전용" : ""}</span>
                </>}
              </span> : recordReading ? <span className="journey-record-facts">
                <span className="journey-record-date"><time dateTime={item.record.observed_on}>{dateLabel(item.record.observed_on)}</time>{item.kind === "blood-pressure" && <small>{periodLabel(item.record.period)}</small>}</span>
                {item.kind === "blood-pressure" ? <strong>{displayMeasurement(item.record)}</strong> : <><strong>{challengeLabel(item.record.action_id)}</strong><span className="journey-record-status">{checkinLabel(item.record.status)}{item.kind === "legacy" ? " · 읽기 전용" : ""}</span></>}
              </span> : <span>
                <strong>{dateLabel(item.record.observed_on)}</strong>
                {item.kind === "blood-pressure"
                  ? ` · ${periodLabel(item.record.period)} · ${displayMeasurement(item.record)}`
                  : ` · ${challengeLabel(item.record.action_id)} · ${checkinLabel(item.record.status)}${item.kind === "legacy" ? " · 이전 기록" : ""}`}
              </span>}
              <button className="secondary record-action" type="button" aria-label={`상세 보기 · ${title} · ${dateLabel(item.record.observed_on)}${item.kind === "blood-pressure" ? ` · ${periodLabel(item.record.period)}` : ""}`} onClick={() => openRecord(item, activeScreen === "S10" ? "S10" : "S08")}>상세 보기</button>
            </li>
          )) : <li className="empty-record">{focusedDate ? `${dateLabel(focusedDate)}에 남긴 ${title} 기록이 없어요.` : emptyText}</li>}
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

  function journeyTodayLanes() {
    const currentChallenge = Boolean(activeChallenge && !activeChallengeEnded);
    const canRecordTodayStatus = !isPriorDashboard && currentChallenge && !todayCheckin;

    return (
      <div className="journey-today-detail" data-today-scope={isPriorDashboard ? "prior" : "current"} data-record-priority="blood-pressure">
        <p className="journey-today-scope">
          {isPriorDashboard
            ? "이전 7일 조회 중이에요. 이 화면에서는 오늘의 실제 기록 상태를 확인하거나 새로 남길 수 없어요."
            : "현재 7일 · 오늘 포함. 혈압, 챌린지 상태, 이전 방식 기록을 각각 확인해요."}
        </p>
        <div className="fact-lanes">
          <section className="fact-lead">
            <p className="eyebrow">혈압 관찰</p>
            <h2>{isPriorDashboard ? "오늘 기록 상태 미확인" : todayMeasurement ? "오늘 기록 있음" : "오늘 기록 없음"}</h2>
            {isPriorDashboard ? (
              <p>선택한 이전 구간에서는 오늘 혈압 기록 여부를 확인할 수 없어요.</p>
            ) : todayMeasurement ? (
              <dl className="journey-today-bp-records" aria-label="오늘 혈압 기록">
                {todayMorningMeasurement && (
                  <div data-today-bp-period="morning">
                    <dt>아침</dt>
                    <dd>{displayMeasurement(todayMorningMeasurement)}</dd>
                  </div>
                )}
                {todayEveningMeasurement && (
                  <div data-today-bp-period="evening">
                    <dt>저녁</dt>
                    <dd>{displayMeasurement(todayEveningMeasurement)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p>필요할 때 오늘의 측정값을 기록할 수 있어요.</p>
            )}
            {!isPriorDashboard && !todayMeasurement && <button type="button" onClick={() => navigate("S04")} disabled={controlsDisabled}>혈압 기록하기</button>}
          </section>
          <section className="journey-today-secondary journey-today-challenge"
            data-today-challenge-state={isPriorDashboard ? "unavailable" : activeChallengeEnded ? "ended" : todayCheckin?.status ?? (currentChallenge ? "pending" : "optional")}>
            <p className="eyebrow">선택 기능 · 챌린지 참여</p>
            <h2>{isPriorDashboard ? "오늘 상태 미확인" : currentChallenge ? challengeLabel(activeChallenge!.action_id) : activeChallengeEnded ? "종료된 챌린지" : "아직 선택 없음"}</h2>
            <p>{isPriorDashboard ? "선택한 이전 구간에서는 오늘 챌린지 상태를 확인하거나 기록할 수 없어요." : currentChallenge ? todayCheckin ? `오늘 상태 · ${checkinLabel(todayCheckin.status)}` : "오늘 상태를 확인하고 기록할 수 있어요." : activeChallengeEnded ? "종료된 챌린지에는 오늘 상태를 새로 기록할 수 없어요." : "행동을 선택하면 오늘 상태를 따로 기록할 수 있어요."}</p>
            {!isPriorDashboard && <p className="journey-today-challenge-note">{todayCheckin?.status === "skipped"
              ? "'건너뜀'도 오늘 상태로 저장된 기록이에요. 혈압 기록과는 별도예요."
              : "챌린지 상태는 혈압 기록과 별도로 저장해요."}</p>}
            {(!activeChallenge || activeChallengeEnded) && !isPriorDashboard ? <button type="button" onClick={() => navigate("S03")} disabled={controlsDisabled}>행동 고르기</button> : canRecordTodayStatus && <div className="journey-checkin-actions"><p>오늘 상태를 저장해요.</p><div className="inline-actions"><button type="button" onClick={() => void submitActiveChallengeCheckin("completed")} disabled={controlsDisabled}>기록함</button><button className="secondary" type="button" onClick={() => void submitActiveChallengeCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button></div></div>}
          </section>
          <section>
            <p className="eyebrow">이전 방식 기록</p>
            <h2>{windowData?.challenge_events.length ?? 0}개</h2>
            <p>선택한 7일의 이전 방식 기록 · 읽기 전용. 오늘 기록 수나 챌린지 달성일과는 다른 기록이에요.</p>
            <button className="secondary" type="button" onClick={() => navigate("S08")} disabled={readNavigationDisabled}>기록 찾아보기</button>
          </section>
        </div>
      </div>
    );
  }

  function renderScene() {
    if (windowState === "loading") {
      return <section className="loading-scene" aria-busy="true" aria-live="polite"><span className="loading-stones" aria-hidden="true"><i /><i /><i /></span><p className="eyebrow">불러오는 중</p><h1>선택한 7일을 불러오는 중이에요</h1><p>불러오기가 끝나면 선택한 기간의 기록을 보여드려요.</p></section>;
    }

    if (activeScreen === "S13") {
      if (presentation.journey) return (
        <Scene id="S13" eyebrow="불러오기 오류" title="기록을 불러오지 못했어요" tone="coral" className="journey-load-error">
          <div className="journey-load-error-card" role="alert">
            <p>아직 기록이 없다는 뜻은 아니에요.</p>
            <p>연결을 확인한 뒤 다시 불러와 주세요.</p>
            <button type="button" onClick={() => void refreshWindow()}>다시 불러오기</button>
          </div>
        </Scene>
      );
      return <Scene id="S13" eyebrow={journeyCopy.S13.eyebrow} title={journeyCopy.S13.title} tone="coral" className="state-scene"><div className="mist-shape" aria-hidden="true" /><div className="state-message" role="alert"><p>{journeyCopy.S13.body}</p><button type="button" onClick={() => void refreshWindow()}>다시 불러오기</button></div></Scene>;
    }

    if (activeScreen === "S12") {
      if (presentation.journey) return (
        <Scene id="S12" eyebrow={isPriorDashboard ? "이전 7일 · 읽기 전용" : "현재 7일 · 오늘 포함"}
          title={isPriorDashboard ? "이 기간에는 기록이 없어요." : "측정한 혈압부터 기록해요"}
          body={isPriorDashboard ? "선택한 이전 구간을 확인했어요. 남긴 기록은 없으며, 새 기록은 현재 7일에서 시작할 수 있어요." : "혈압 기록은 바로 시작할 수 있고, 7일을 채우지 않아도 남긴 기록부터 확인할 수 있어요. 챌린지는 별도로 선택할 수 있어요."}
          tone="sage" className="journey-empty">
          <p className="journey-empty-period" aria-label="조회 기간"><time dateTime={startOn}>{dateLabel(startOn)}</time> ~ <time dateTime={endOn}>{dateLabel(endOn)}</time></p>
          {isPriorDashboard ? (
            <div className="journey-empty-return">
              <button type="button" onClick={() => selectDashboardWindow("current")} disabled={evidenceMode}>현재 7일 보기</button>
            </div>
          ) : (
            <>
              <div className="journey-empty-actions">
                <section className="journey-empty-action">
                  <h2>혈압 기록</h2>
                  <p id="empty-bp-help">측정한 혈압값을 날짜·시간대와 함께 바로 기록해요.</p>
                  <button type="button" aria-describedby="empty-bp-help" onClick={() => navigate("S04")}>혈압 기록하기</button>
                </section>
                <section className="journey-empty-action">
                  <h2>7일 챌린지</h2>
                  <p id="empty-challenge-help">선택 기능이에요. 원하면 이어갈 행동을 골라요. 혈압 기록과 별도로 시작할 수 있어요.</p>
                  <button className="secondary" type="button" aria-describedby="empty-challenge-help" onClick={() => navigate("S03")}>7일 챌린지 시작하기</button>
                </section>
              </div>

              <aside className="journey-empty-signal" aria-labelledby="empty-signal-title">
                <div>
                  <p className="eyebrow">선택 도구 · 저장 안 함</p>
                  <h2 id="empty-signal-title">생활정보를 먼저 정리할 수도 있어요</h2>
                  <p id="empty-signal-help">활동·수면·생활습관을 입력하면 이번 이용에만 보이는 ‘오늘의 시작점’으로 정리해요. 혈압 기록과는 별도예요.</p>
                </div>
                <button className="text-button" type="button" aria-describedby="empty-signal-help" onClick={() => navigate("S11")}>생활정보 정리하기</button>
              </aside>
            </>
          )}
          <div className="empty-garden" aria-hidden="true"><i /><i /><i /></div>
        </Scene>
      );
      return <Scene id="S12" {...journeyCopy.S12} tone="sage" className="state-scene"><div className="empty-garden" aria-hidden="true"><i /><i /><i /></div><div className="split-actions"><button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button><button className="secondary" type="button" onClick={() => navigate("S03")}>7일 챌린지 시작하기</button></div></Scene>;
    }

    if (activeScreen === "S02") {
      if (presentation.journey) return <JourneyToday key={`${today}:${endOn}`} staticLandscape={presentation.staticLandscape} today={today} days={trailDays} lead={homeLead} secondary={homeSecondaryActions} freshness={windowState} onNavigate={navigate}>
        {renderCycleActions()}
        {previousCycleEnd && !activeChallengeEnded && <button type="button" className="secondary" onClick={() => openCycleReview(previousCycleEnd)}>종료된 7일 돌아보기</button>}
      </JourneyToday>;
      return <Scene id="S02" {...journeyCopy.S02} tone="cream" className="home-scene">{renderCycleActions()}<div className="today-ribbon"><span>{dateLabel(today)}</span><strong>{todayBloodPressureStatus}</strong><strong>{activeChallengeEnded ? "챌린지 종료" : activeChallenge ? challengeLabel(activeChallenge.action_id) : "챌린지 미선택"}</strong></div><section className="home-lead" data-home-concept={homeLead.key} aria-labelledby="home-lead-title"><div><p className="eyebrow">오늘 먼저 할 일</p><h2 id="home-lead-title">{homeLead.title}</h2><p>{homeLead.support}</p></div><button type="button" onClick={() => navigate(homeLead.screen)}>{homeLead.action}</button></section><nav className="home-links" aria-label="오늘 기록 바로가기">{homeSecondaryActions.map((item) => <button key={item.key} type="button" data-home-concept={item.key} data-home-destination={item.screen} aria-label={`${item.title} · ${item.support}`} onClick={() => navigate(item.screen)}><span><strong>{item.title}</strong><small>{item.support}</small></span><span aria-hidden="true">→</span></button>)}</nav><VisualStage screen="S02" calendarDate={today} /><section className="recent-window-summary" data-window-kind="recent-history" aria-labelledby="recent-window-title"><div><p className="eyebrow">기록 탐색</p><h2 id="recent-window-title">최근 7일 기록</h2><p>챌린지 7일 진행과는 별도로 확인해요.</p></div><ol className="week-path" aria-label="오늘을 포함한 최근 7일 기록">{Array.from({ length: 7 }, (_, index) => { const day = shiftDate(today, index - 6); return <li key={day} className={day === today ? "is-today" : ""} aria-label={dateLabel(day)}>{day === today ? "오늘" : `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`}</li>; })}</ol></section></Scene>;
    }

    if (activeScreen === "S03") {
      const locked = Boolean(activeChallenge?.first_checkin_on && !activeChallengeEnded);
      if (presentation.journey) return <Scene id="S03" eyebrow="선택 기능 · 7일 챌린지" title={activeChallengeEnded ? "다음 챌린지를 시작할 행동을 골라요" : "원하면 이어갈 행동을 골라요"} body={activeChallengeEnded ? "원할 때만 다시 시작해요. 행동을 누르면 오늘부터 새 챌린지가 시작되고 이전 기록은 그대로 남아요." : "혈압 기록과는 별도예요. 처음 상태를 저장하기 전까지 행동을 바꿀 수 있어요."} tone="sage" className="journey-candidate journey-challenge-choice">
        <div className="challenge-choice-context" data-challenge-choice-state={locked ? "locked" : activeChallenge && !activeChallengeEnded ? "changeable" : "optional"}>
          <p className="eyebrow">선택 기능</p>
          <strong>{locked ? "첫 상태 기록 후에는 행동을 바꿀 수 없어요." : "참여하지 않아도 혈압 기록은 그대로 사용할 수 있어요."}</strong>
          <p>{locked ? "현재 선택을 확인하고 오늘 상태를 별도로 기록해요." : activeChallenge && !activeChallengeEnded ? "첫 상태를 기록하기 전까지 다른 행동으로 바꿀 수 있어요." : "원할 때 하나를 골라 오늘부터 시작해요."}</p>
        </div>
        <div className="choice-grid" aria-busy={pendingAction === "challenge-selection"}>
          {challengeActions.map((action) => {
            const selected = activeChallenge?.action_id === action.id && !activeChallengeEnded;
            const state = pendingAction === "challenge-selection"
              ? "선택 저장 중"
              : locked
                ? selected ? "선택됨 · 변경 불가" : "변경 불가"
                : selected ? "선택됨" : "선택하기";
            return <button className={`choice-tile ${selected ? "is-selected" : ""}`} type="button" key={action.id} onClick={() => void selectChallenge(action.id)} disabled={controlsDisabled || locked || challengeNeedsReload || windowState !== "ready"}><span className="choice-icon" aria-hidden="true" data-choice={action.id} /><strong>{action.label}</strong><small>{action.note}</small><span className="choice-state">{state}</span></button>;
          })}
        </div>
        {challengeNeedsReload && <button type="button" className="secondary" disabled={windowState === "refreshing"} onClick={() => void refreshWindow()}>선택 상태 다시 확인하기</button>}
        <div className="notice journey-challenge-state" role="status">
          {pendingAction === "challenge-selection"
            ? "선택한 행동을 저장하고 있어요."
            : locked
              ? "첫 체크인 이후에는 선택한 행동을 바꿀 수 없어요."
              : challengeNeedsReload ? "저장 결과를 확인한 뒤 행동을 선택할 수 있어요." : "행동을 누르면 선택한 내용이 저장돼요."}
        </div>
        {activeChallenge && !activeChallengeEnded && !isPriorDashboard && <button className="secondary" type="button" onClick={() => navigate("S07")} disabled={controlsDisabled}>오늘 상태 확인·기록하기</button>}
        <button className="text-button" type="button" onClick={() => navigate("S02")} disabled={readNavigationDisabled}>오늘의 기록으로 돌아가기</button>
      </Scene>;
      return <Scene id="S03" {...journeyCopy.S03} tone="sage"><div className="choice-grid">{challengeActions.map((action) => { const selected = activeChallenge?.action_id === action.id && !activeChallengeEnded; return <button className={`choice-tile ${selected ? "is-selected" : ""}`} type="button" key={action.id} onClick={() => void selectChallenge(action.id)} disabled={controlsDisabled || locked || challengeNeedsReload || windowState !== "ready"}><span className="choice-icon" aria-hidden="true" data-choice={action.id} /><strong>{action.label}</strong><small>{action.note}</small><span className="choice-state">{selected ? "선택됨" : "선택하기"}</span></button>; })}</div>{locked && <p className="notice notice-warning" role="status">첫 체크인이 있어 선택한 행동은 바꿀 수 없어요.</p>}<button className="text-button" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button></Scene>;
    }

    if (activeScreen === "S04") {
      return (
        <Scene
          id="S04"
          eyebrow={journeyCopy.S04.eyebrow}
          title={editingBloodPressureId ? "혈압 기록 수정" : journeyCopy.S04.title}
          body={journeyCopy.S04.body}
          tone="water"
          className={presentation.journey ? "journey-candidate journey-entry journey-sheet" : ""}
        >
          <form className="measurement-panel" onSubmit={submitBloodPressure} noValidate>
            <div className="bp-sheet-fields">
              <div className="bp-sheet-context">
                <label htmlFor="observed-on">
                  <span className="bp-sheet-field-label">날짜</span>
                  <input
                    ref={observedOnRef}
                    id="observed-on"
                    style={measurementControlStyle}
                    type="date"
                    aria-invalid={bloodPressureError?.field === "observed-on"}
                    aria-describedby={
                      bloodPressureError?.field === "observed-on"
                        ? "blood-pressure-error"
                        : !editingBloodPressureId && bloodPressureDraft.observedOn && bloodPressureDraft.observedOn !== today
                          ? "bp-draft-date-help"
                          : undefined
                    }
                    value={bloodPressureDraft.observedOn}
                    onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, observedOn: event.target.value }))}
                    required
                    disabled={controlsDisabled}
                  />
                </label>
                <label htmlFor="period">
                  <span className="bp-sheet-field-label">시간대</span>
                  <select
                    id="period"
                    style={measurementControlStyle}
                    value={bloodPressureDraft.period}
                    onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, period: event.target.value as BloodPressureDraft["period"] }))}
                    disabled={controlsDisabled}
                  >
                    <option value="morning">아침 · 기상 후 1시간 이내</option>
                    <option value="evening">저녁 · 취침 전</option>
                  </select>
                </label>
              </div>
              <div className="bp-measurement-pair">
                <label htmlFor="systolic" className="bp-measurement bp-measurement-systolic">
                  <span className="bp-measurement-label">수축기</span>
                  <input
                    ref={systolicRef}
                    id="systolic"
                    style={measurementControlStyle}
                    type="number"
                    min="60"
                    max="260"
                    inputMode="numeric"
                    value={bloodPressureDraft.systolic}
                    onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, systolic: event.target.value }))}
                    aria-invalid={bloodPressureError?.field === "systolic"}
                    aria-describedby={bloodPressureError?.field === "systolic" ? "blood-pressure-error" : undefined}
                    required
                    disabled={controlsDisabled}
                  />
                  <span className="unit">mmHg</span>
                </label>
                <span className="bp-measurement-separator" aria-hidden="true">/</span>
                <label htmlFor="diastolic" className="bp-measurement bp-measurement-diastolic">
                  <span className="bp-measurement-label">이완기</span>
                  <input
                    ref={diastolicRef}
                    id="diastolic"
                    style={measurementControlStyle}
                    type="number"
                    min="30"
                    max="160"
                    inputMode="numeric"
                    value={bloodPressureDraft.diastolic}
                    onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, diastolic: event.target.value }))}
                    aria-invalid={bloodPressureError?.field === "diastolic"}
                    aria-describedby={bloodPressureError?.field === "diastolic" ? "blood-pressure-error" : undefined}
                    required
                    disabled={controlsDisabled}
                  />
                  <span className="unit">mmHg</span>
                </label>
              </div>
            </div>
            {bloodPressureError && <p id="blood-pressure-error" className="field-error" role="alert">{bloodPressureError.message}</p>}
            <div className="form-actions">
              <button type="submit" disabled={controlsDisabled}>{pendingAction === "blood-pressure" ? "저장 중" : editingBloodPressureId ? "변경 저장" : "혈압 기록 저장"}</button>
              {editingBloodPressureId && <button className="secondary" type="button" onClick={cancelBloodPressureEdit} disabled={controlsDisabled}>수정 취소</button>}
            </div>
            <div className="bp-sheet-secondary">
              {!editingBloodPressureId && <BloodPressureDraftNote restored={newBloodPressure.restored} observedOn={bloodPressureDraft.observedOn} today={today} />}
              <details className="measurement-guide">
                <summary>측정 전 확인하기</summary>
                <ul>
                  <li>조용히 앉아 몸과 호흡을 편하게 해요.</li>
                  <li>등과 팔을 지지하고 측정 중에는 말하지 않아요.</li>
                  <li>이 안내는 기록 조건을 돕기 위한 참고이며 저장되지 않아요.</li>
                </ul>
              </details>
              {!editingBloodPressureId && newBloodPressure.meaningful && (
                <details className="bp-draft-reset">
                  <summary>새로 입력하기</summary>
                  <p>입력한 날짜·시간대·혈압 값을 지우고 오늘 날짜로 시작해요. 저장된 기록에는 영향을 주지 않아요.</p>
                  <button
                    className="secondary"
                    type="button"
                    disabled={controlsDisabled}
                    onClick={(event) => {
                      const dateField = event.currentTarget.form?.elements.namedItem("observed-on");
                      newBloodPressure.reset(today);
                      setBloodPressureError(null);
                      if (dateField instanceof HTMLInputElement) dateField.focus();
                    }}
                  >
                    초안 지우기
                  </button>
                </details>
              )}
            </div>
          </form>
          {presentation.journey && <button type="button" className="text-button journey-back" onClick={() => navigate("S02")} disabled={controlsDisabled}>← 오늘의 기록으로 돌아가기</button>}
        </Scene>
      );
    }

    if (activeScreen === "S05") {
      const savedBloodPressureIsToday = savedFactKind === "blood-pressure" && savedFactDate === today;
      return <Scene id="S05" {...journeyCopy.S05} tone="sage" className={presentation.journey ? "saved-scene journey-candidate journey-saved" : "saved-scene"}>
        <div className="save-ripple" aria-hidden="true">{presentation.journey ? <><div className="save-ripple-landscape"><i /><i /></div><SceneCompanion /></> : <><SceneCompanion /><i /><i /></>}<span>✓</span></div>
        {presentation.journey && <div className="save-next-step">
          <p className="eyebrow">다음 확인</p>
          <strong>{savedFactKind === "challenge-checkin"
            ? "오늘의 기록에서 방금 저장한 챌린지 상태를 확인해요"
            : savedBloodPressureIsToday
              ? "오늘의 기록에서 방금 저장한 혈압을 확인해요"
              : "최근 기록에서 방금 저장한 혈압을 확인해요"}</strong>
          <p>{savedFactKind === "challenge-checkin"
            ? "저장이 끝났어요. 챌린지 상태는 혈압 기록과 별도로 남고, 오늘의 기록과 최근 7일에서 다시 확인할 수 있어요."
            : savedBloodPressureIsToday
              ? "저장이 끝났어요. 오늘 화면으로 돌아가 기록이 반영됐는지 확인할 수 있어요. 한 건부터 최근 7일에 모아볼 수 있어요."
              : "저장이 끝났어요. 기록 찾아보기에서 날짜와 시간대별로 다시 확인할 수 있어요."}</p>
        </div>}
        <div className="split-actions">
          <button type="button" onClick={() => {
            setConfirmedSave(false);
            savedScene.clear();
            navigate(savedFactKind === "blood-pressure" && !savedBloodPressureIsToday ? "S08" : "S02");
          }}>{savedFactKind === "blood-pressure" && !savedBloodPressureIsToday ? "기록 찾아보기" : "오늘의 기록 보기"}</button>
          <button className="secondary" type="button" onClick={() => {
            setConfirmedSave(false);
            savedScene.clear();
            navigate(savedFactKind === "challenge-checkin" ? "S06" : "S04");
          }}>{savedFactKind === "challenge-checkin" ? "챌린지 상태 보기" : "계속 기록하기"}</button>
        </div>
      </Scene>;
    }

    if (activeScreen === "S06") {
      if (presentation.journey) return <Scene id="S06" eyebrow="선택 기능 · 오늘 상태" title={activeChallengeEnded ? "종료된 챌린지를 확인해요" : "선택한 행동과 오늘 상태를 확인해요"} body={activeChallengeEnded ? "챌린지 기간은 끝났어요. 오늘 상태를 새로 기록하지 않아요." : "혈압과는 별도로, 선택한 행동과 오늘 남길 상태를 확인해요."} tone="sage" className="journey-candidate journey-challenge-summary">
        <section className="locked-challenge journey-challenge-summary-card" data-challenge-period={activeChallengeEnded ? "ended" : "active"}>
          <p className="eyebrow">{activeChallengeEnded ? "종료된 챌린지" : "선택한 행동"}</p>
          <h2>{activeChallenge ? challengeLabel(activeChallenge.action_id) : "선택한 행동 없음"}</h2>
          {activeChallenge && <p className="journey-challenge-dates"><span>챌린지 기간</span><time dateTime={activeChallenge.starts_on}>{activeChallenge.starts_on}</time> ~ <time dateTime={activeChallenge.ends_on}>{activeChallenge.ends_on}</time></p>}
        </section>
        <section className="locked-challenge journey-challenge-summary-card journey-challenge-checkin-card"
          data-challenge-checkin-state={isPriorDashboard ? "unavailable" : activeChallengeEnded ? "ended" : todayCheckin?.status ?? "pending"}>
          <p className="eyebrow">오늘 상태 · 별도 기록</p>
          <h2>{isPriorDashboard ? "오늘 상태 미확인" : activeChallengeEnded ? "챌린지 종료" : todayCheckin ? checkinLabel(todayCheckin.status) : "아직 기록하지 않음"}</h2>
          <p>{isPriorDashboard
            ? "이전 7일 조회에서는 오늘 상태를 확인할 수 없어요."
            : activeChallengeEnded
              ? "종료된 챌린지에는 오늘 상태를 새로 기록할 수 없어요."
              : todayCheckin
                ? `오늘은 '${checkinLabel(todayCheckin.status)}' 상태로 저장되어 있어요.`
                : "오늘은 '기록함' 또는 '건너뜀' 중 하나를 상태로 저장할 수 있어요."}</p>
          {!isPriorDashboard && !activeChallengeEnded && <p className="journey-challenge-checkin-note">
            '건너뜀'도 오늘 상태를 남긴 기록이에요. 혈압 기록과 합쳐서 판단하지 않아요.
          </p>}
        </section>
        {renderCycleActions()}
        <div className="inline-actions journey-challenge-next-actions">
          {activeChallenge && !activeChallengeEnded && !isPriorDashboard && <button type="button" onClick={() => navigate("S07")} disabled={controlsDisabled}>오늘 상태 확인·기록하기</button>}
          <button className="secondary" type="button" onClick={() => navigate("S04")} disabled={controlsDisabled}>혈압 기록하기</button>
        </div>
      </Scene>;
      return <Scene id="S06" {...journeyCopy.S06} tone="sage">{renderCycleActions()}<div className="locked-challenge" data-challenge-period="active"><p className="eyebrow">7일 챌린지 기간</p><span>선택한 행동</span><strong>{activeChallenge ? challengeLabel(activeChallenge.action_id) : "선택한 행동 없음"}</strong>{activeChallenge && <small>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</small>}<p>챌린지 체크인 진행은 최근 7일 기록과 별도로 표시합니다.</p></div><div className="marker-row"><span className="settle-marker" aria-hidden="true" /><div><span>오늘의 상태</span><strong>{todayCheckin ? checkinLabel(todayCheckin.status) : "아직 기록하지 않음"}</strong></div></div><button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button></Scene>;
    }

    if (activeScreen === "S07") {
      if (presentation.journey) return <Scene id="S07" eyebrow="오늘 기록 확인" title="오늘의 기록 확인" body={isPriorDashboard
        ? "선택한 이전 7일의 범위를 보고 있어요."
        : todayMeasurement
          ? "오늘 남긴 혈압 기록을 먼저 확인하고, 챌린지 참여와 이전 방식 기록은 따로 살펴봐요."
          : "오늘은 아직 혈압 기록이 없어요. 챌린지 참여와 이전 방식 기록은 각각 따로 확인할 수 있어요."} tone="cream" className="journey-candidate journey-today-review">
        <div className="today-date"><strong>{isPriorDashboard ? "이전 7일 조회" : dateLabel(today)}</strong><span>{isPriorDashboard
          ? `${dateLabel(startOn)} ~ ${dateLabel(endOn)} · 읽기 전용`
          : todayMeasurement
            ? "혈압 기록을 먼저 확인하고, 챌린지 참여는 따로 봐요."
            : "오늘 혈압 기록 여부와 챌린지 참여를 각각 확인해요."}</span></div>
        {journeyTodayLanes()}
        <button className="secondary" type="button" onClick={() => navigate("S02")} disabled={readNavigationDisabled}>오늘의 기록으로 돌아가기</button>
      </Scene>;
      return <Scene id="S07" {...journeyCopy.S07} tone="cream"><div className="today-date"><strong>{dateLabel(today)}</strong><span>서로 다른 사실은 합치지 않고 나란히 보여드려요.</span></div>{todayLanes()}<button className="secondary" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button></Scene>;
    }

    if (activeScreen === "S08") {
      return <Scene id="S08" eyebrow="기록" title={journeyCopy.S08.title} body={`${dashboardPeriodName}에서 종류와 날짜로 기록을 찾아요.`} tone="lavender" className={`record-explorer-scene${presentation.journey ? " journey-candidate journey-records" : ""}`}>
        <div className="scene-toolbar"><span className="utility-label">조회 기간</span><button className="text-button" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button></div>
        {renderWindowNavigation()}
        <RecordExplorer
          items={recordBrowseItems}
          selection={recordExplorer.selection}
          onSelect={recordExplorer.select}
          onOpen={item => { recordExplorer.remember(item.key); openRecord(item); }}
          returnPoint={recordExplorer.returnPoint}
          onRestored={recordExplorer.restored}
          dateLabel={dateLabel}
          periodLabel={periodLabel}
          challengeLabel={challengeLabel}
          checkinLabel={checkinLabel}
          displayMeasurement={displayMeasurement}
          isReadOnly={item => evidenceMode || isPriorDashboard || item.kind === "legacy" || (item.kind === "challenge-checkin" && (item.record.challenge_id !== activeChallenge?.id || activeChallengeEnded))}
        />
      </Scene>;
    }

    if (activeScreen === "S09") {
      return (
        <Scene id="S09" {...journeyCopy.S09} tone="lavender" className={presentation.journey ? "journey-candidate journey-record-detail" : undefined}>
          <button
            className="text-button record-explorer-detail-return"
            type="button"
            onClick={returnFromRecordDetail}
          >
            {window.history.state?.recordReturnScreen === "S10" ? "7일 돌아보기로 돌아가기" : "목록으로 돌아가기"}
          </button>
          {selectedRecord && <p className="record-explorer-detail-selection">
            선택한 기록 · {dateLabel(selectedRecord.record.observed_on)}
            {selectedRecord.kind === "blood-pressure" ? ` · ${periodLabel(selectedRecord.record.period)}` : ""}
          </p>}
          <p className="record-explorer-detail-period">{dashboardPeriodName}{isPriorDashboard ? " · 읽기 전용" : ""} · {dateLabel(startOn)} ~ {dateLabel(endOn)}</p>
          {selectedRecordMissing ? (
            <div className="state-card state-error" role="alert">
              <h2>선택한 기록을 찾을 수 없습니다.</h2>
              <p>목록이 바뀌었을 수 있어요. 현재 표시 구간의 기록을 다시 확인해 주세요.</p>
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
                <p className="notice notice-warning">{selectedRecord.kind === "legacy" ? "이전 방식으로 남긴 기록은 읽기 전용입니다. 날짜가 현재 7일에 포함되어도 수정하거나 삭제할 수 없어요." : `${dashboardPeriodName}의 기록은 읽기 전용입니다.`}</p>
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
                {!evidenceMode && <button className="text-button" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing" || controlsDisabled}>새로고침</button>}
              </div>
            </article>
          ) : (
            <div className="state-card"><h2>선택한 기록이 없어요.</h2></div>
          )}
        </Scene>
      );
    }

    if (activeScreen === "S10") {
      if (presentation.journey) return <Scene id="S10" eyebrow="최근 기록" title="7일 돌아보기" body="이 기간에 남긴 혈압 기록을 날짜와 시간대별로 확인해요. 챌린지 참여는 별도로 표시해요." tone="water" className="journey-recap">
        {renderCycleActions()}
        <JourneyRecap key={endOn} staticLandscape={presentation.staticLandscape} today={today} days={trailDays} year={startOn.slice(0, 4) === endOn.slice(0, 4) ? startOn.slice(0, 4) : `${startOn.slice(0, 4)}–${endOn.slice(0, 4)}`} period={isCycleReview ? "completed-cycle" : isPriorDashboard ? "prior" : "current"} freshness={windowState}
          navigation={renderWindowNavigation()}
          records={focusedDate => <>
            {renderRecordLane("blood-pressure", "혈압 관찰", "이 구간에 혈압 관찰 기록이 없습니다.", true, false, focusedDate)}
            {renderRecordLane("challenge-checkin", "챌린지 체크인", "이 구간에 챌린지 체크인 기록이 없습니다.", true, false, focusedDate)}
            {renderRecordLane("legacy", "이전 방식의 기록", "이 구간에 이전 방식의 기록이 없습니다.", true, false, focusedDate)}
          </>}
          challenge={<section className="challenge-progress-card" data-challenge-progress aria-labelledby="challenge-progress-title">
            <p className="eyebrow">선택 기능 · 현재 챌린지</p>
            {activeChallenge && !activeChallengeEnded ? <>
              <h2 id="challenge-progress-title">7일 챌린지 · {challengeLabel(activeChallenge.action_id)}</h2>
              <p>챌린지 기간<br /><time dateTime={activeChallenge.starts_on}>{activeChallenge.starts_on}</time> ~ <time dateTime={activeChallenge.ends_on}>{activeChallenge.ends_on}</time></p>
              <strong>선택한 구간 안의 체크인 기록 {activeChallengeCheckins.length}개</strong>
              <small>'기록함'과 '건너뜀'은 모두 저장된 체크인 기록이에요. 혈압 기록과 합치지 않고, 전체 챌린지 누적 성과로도 해석하지 않아요.</small>
            </> : <><h2 id="challenge-progress-title">진행 중인 7일 챌린지 없음</h2><p>선택 기능이에요. 참여하지 않아도 {dashboardPeriodName}의 혈압 기록을 그대로 확인할 수 있어요.</p></>}
          </section>}
          actions={<>
            {renderReportAction()}
            {!evidenceMode && <button type="button" onClick={() => void exportRecentRecords()} disabled={controlsDisabled}>{pendingAction === "export" ? "내보내는 중" : `${dashboardPeriodName} 내보내기`}</button>}
            <button className="secondary" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing" || controlsDisabled}>{windowState === "refreshing" ? "새로고침 중" : "새로고침"}</button>
          </>}
        />
        {!evidenceMode && session && (
          <StructuredRecapFeedback session={session} disabled={controlsDisabled} onSessionError={handleStructuredFeedbackSessionError} />
        )}
      </Scene>;
      return <Scene id="S10" {...journeyCopy.S10} tone="water">{renderCycleActions()}{!evidenceMode && session && <StructuredRecapFeedback session={session} disabled={controlsDisabled} onSessionError={handleStructuredFeedbackSessionError} />}<div className="recap-period">{renderWindowNavigation()}</div><div className="recap-summary" data-main-section="seven-day-dashboard" aria-label="최근 7일 기록 요약"><div data-dashboard-lane="blood-pressure"><span>혈압 관찰</span><strong>{windowData?.blood_pressure_observations.length ?? 0}</strong><small>기록</small></div><div data-dashboard-lane="challenge"><span>최근 7일 챌린지 체크인 기록</span><strong>{windowData?.challenge_checkins.length ?? 0}</strong><small>기록</small></div><div data-dashboard-lane="legacy"><span>이전 방식의 기록</span><strong>{windowData?.challenge_events.length ?? 0}</strong><small>읽기 전용</small></div></div><section className="challenge-progress-card" data-challenge-progress aria-labelledby="challenge-progress-title"><p className="eyebrow">챌린지 진행</p>{activeChallenge && !activeChallengeEnded ? <><h2 id="challenge-progress-title">7일 챌린지 · {challengeLabel(activeChallenge.action_id)}</h2><p>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</p><strong>체크인 기록 {activeChallengeCheckins.length}개</strong></> : <><h2 id="challenge-progress-title">진행 중인 7일 챌린지 없음</h2><p>최근 7일 기록과는 별도로 표시합니다.</p></>}</section><VisualStage screen="S10" calendarDate={today} /><div className="record-groups recap-record-groups" aria-label="최근 7일 기록 목록">{renderRecordLane("blood-pressure", "혈압 관찰", "아직 혈압 관찰 기록이 없습니다.")}{renderRecordLane("challenge-checkin", "챌린지 참여", "아직 챌린지 참여 기록이 없습니다.")}{renderRecordLane("legacy", "이전 방식의 기록", "이전 방식의 기록이 없습니다.")}</div><div className="scene-actions utility-actions">{renderReportAction()}{!evidenceMode && <button type="button" onClick={() => void exportRecentRecords()} disabled={controlsDisabled}>{pendingAction === "export" ? "내보내는 중" : `${dashboardPeriodName} 내보내기`}</button>}<button className="secondary" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing" || controlsDisabled}>{windowState === "refreshing" ? "새로고침 중" : "새로고침"}</button></div></Scene>;
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
          onStartBloodPressure={() => navigate("S04")}
          onReturnToToday={() => navigate("S02")}
          isCurrentRequestContext={isCurrentRequestContext}
        />
      );
    }

      if (presentation.journey) return (
        <Scene id="S14" {...journeyCopy.S14} tone="cream" className="journey-settings">
          <div className="journey-settings-list">
            {import.meta.env.VITE_SK7_SCENE_MODE === "review" && <section className="journey-settings-section companion-identity-settings">
              <div>
                <p className="eyebrow">함께할 캐릭터</p>
                <h2>내 동반자</h2>
                <p>화면의 3D 캐릭터만 바뀌어요. 혈압 기록, 챌린지, 입력 기반 위험군 선별 신호에는 영향을 주지 않아요.</p>
              </div>
              <label className="companion-identity-control" htmlFor="companion-species">
                <span>캐릭터 선택</span>
                <select
                  id="companion-species"
                  value={companionSpeciesPreference}
                  onChange={(event) => {
                    const species = event.target.value as CompanionSpecies;
                    setCompanionSpeciesPreference(writeCompanionIdentity(species));
                  }}
                >
                  {companionIdentityOptions.map((option) => <option key={option.species} value={option.species}>{option.label}</option>)}
                </select>
              </label>
            </section>}
            <section className="journey-settings-section">
              <div>
                <p className="eyebrow">기록과 파일</p>
                <h2>기록을 찾아보고 파일을 관리해요</h2>
                <p>최근 7일 탐색은 화면에서 기록을 찾아보는 범위예요. 혈압 관찰과 챌린지 기록은 저장한 시점부터 30일 동안 보관돼요.</p>
              </div>
              <button className="secondary" type="button" onClick={() => navigate("S10")} disabled={controlsDisabled}>7일 기록 보기</button>
              <p className="journey-settings-note">내보낸 JSON과 브라우저에서 저장한 PDF는 기기에 남고, 인쇄물도 계정과 별개이므로 직접 관리해요.</p>
            </section>
            <section className="journey-settings-section">
              <div>
                <p className="eyebrow">이용 안내</p>
                <h2>기록을 확인하는 방법</h2>
                <p>이메일 링크로 로그인한 계정의 기록을 확인해요.</p>
              </div>
              <dl className="journey-settings-facts">
                <div><dt>언어</dt><dd>한국어</dd></div>
                <div><dt>시간</dt><dd>한국 시간</dd></div>
              </dl>
              <details className="journey-settings-help">
                <summary>저장 여부가 확실하지 않을 때</summary>
                <p>같은 요청을 반복하기 전에 기록 목록과 새로고침으로 반영 여부를 확인해 주세요.</p>
              </details>
            </section>
            <section className="journey-settings-section">
              <div>
                <p className="eyebrow">추가 도구</p>
                <h2>입력 기반 위험군 선별 신호</h2>
                <p>활동·수면·생활습관을 입력하면 이번 이용에만 보이는 ‘오늘의 시작점’으로 정리해요. 입력과 결과는 저장되지 않아 기록 목록에서 다시 볼 수 없어요.</p>
              </div>
              <button className="secondary" type="button" onClick={() => navigate("S11")} disabled={controlsDisabled}>선별 신호 도구 열기</button>
            </section>
            {!evidenceMode && <section className="journey-settings-section journey-settings-account">
              <div>
                <p className="eyebrow">기기 연결</p>
                <h2>이 기기에서 로그아웃</h2>
                <p>개인 기기에서는 로그인 상태를 유지해도 괜찮아요. 공용 기기에서는 사용을 마친 뒤 로그아웃해 주세요.</p>
              </div>
              <button className="secondary" type="button" onClick={() => void handleSignOut()} disabled={signOutPending || accountDeletionPending} aria-busy={signOutPending}>{signOutPending ? "로그아웃 중" : "이 기기에서 로그아웃"}</button>
            </section>}
            <section className="journey-settings-section journey-settings-account">
              <div>
                <p className="eyebrow">계정 관리</p>
                <h2>계정 삭제</h2>
                <p>계정과 저장된 혈압 관찰·챌린지 기록이 삭제되며, 되돌릴 수 없어요. 이미 내보낸 JSON, 저장한 PDF, 인쇄물은 별개로 남을 수 있어요.</p>
              </div>
              <button className="danger" type="button" onClick={() => { setAccountDeletionRecovery(null); setAccountDeletionOpen(true); }} disabled={controlsDisabled}>계정 삭제</button>
            </section>
          </div>
        </Scene>
      );
      return <Scene id="S14" {...journeyCopy.S14} tone="cream"><div className="settings-list"><section><div><p className="eyebrow">계정</p><h2>현재 계정</h2><p>이메일 링크로 연결된 기록만 보여요.</p></div></section>{!evidenceMode && <section><div><p className="eyebrow">기기 연결</p><h2>이 기기에서 로그아웃</h2><p>개인 기기에서는 로그인 상태를 유지해도 괜찮아요. 공용 기기에서는 사용을 마친 뒤 로그아웃해 주세요.</p></div><button className="secondary" type="button" onClick={() => void handleSignOut()} disabled={signOutPending || accountDeletionPending} aria-busy={signOutPending}>{signOutPending ? "로그아웃 중" : "이 기기에서 로그아웃"}</button></section>}<section><div><p className="eyebrow">언어와 시간대</p><h2>한국어 · Asia/Seoul</h2><p>날짜를 한국 시간으로 표시해요.</p></div></section><section><div><p className="eyebrow">내 기록</p><h2>최근 7일 기록</h2><p>혈압 관찰과 챌린지 기록은 저장한 시점부터 30일 동안 보관됩니다. 화면의 최근 7일 탐색은 이 보관 기간과 다른 개념이에요.</p></div><button className="secondary" type="button" onClick={() => navigate("S10")} disabled={controlsDisabled}>7일 기록 보기</button></section><section><div><p className="eyebrow">추가 도구</p><h2>입력 기반 위험군 선별 신호</h2><p>활동·수면·생활습관을 입력하면 이번 이용에만 보이는 ‘오늘의 시작점’으로 정리해요. 입력과 결과는 저장되지 않아 기록 목록에서 다시 볼 수 없어요.</p></div><button className="secondary" type="button" onClick={() => navigate("S11")} disabled={controlsDisabled}>선별 신호 도구 열기</button></section><section><div><p className="eyebrow">계정 관리</p><h2>계정 삭제</h2><p>계정을 삭제하면 저장된 혈압 관찰과 챌린지 기록도 함께 삭제됩니다. 삭제 후 되돌릴 수 없어요.</p></div><button className="danger" type="button" onClick={() => { setAccountDeletionRecovery(null); setAccountDeletionOpen(true); }} disabled={controlsDisabled}>계정 삭제</button></section><section><div><p className="eyebrow">내보낸 파일</p><h2>JSON·PDF는 계정과 별개예요</h2><p>내보낸 JSON과 브라우저에서 저장한 PDF, 인쇄물은 서버 보관 기간과 별개이므로 직접 안전하게 관리해 주세요.</p></div></section><section><div><p className="eyebrow">도움말</p><h2>저장 여부 확인</h2><p>불확실하면 목록을 새로고침해 먼저 확인해 주세요.</p></div></section></div></Scene>;
  }

  const visibleNotice = activeScreen === "S04" && !editingBloodPressureId ? newBloodPressureRecovery ?? notice : notice;

  return (
    <>
    <div data-living-week-app hidden={reportVisible}>
    <SceneShell staticJourneyUi={presentation.staticLandscape} activeScreen={activeScreen} evidenceLabel={fixture?.name} onNavigate={navigate} companionSelection={companionSelection} savedSceneEvent={confirmedSave ? savedScene.event : null}>
      {visibleNotice && !pendingBloodPressureDeletion && !pendingChallengeCheckinDeletion && <div className={`notice notice-${visibleNotice.kind}`} role="status"><div>{visibleNotice.reload && <strong className="notice-title">처리 결과 확인 필요</strong>}<span>{visibleNotice.message}</span>{visibleNotice.reload && <p>같은 요청을 다시 보내기 전에 기록 목록에서 반영 여부를 확인해 주세요.</p>}</div>{visibleNotice.reload && <button className="notice-action" type="button" onClick={() => void refreshWindow()} disabled={windowState === "loading" || windowState === "refreshing"}>다시 불러오기</button>}{visibleNotice.reload && <button className="notice-action" type="button" onClick={() => navigate("S08")}>기록 목록 보기</button>}</div>}
      {windowState === "refresh-error" && <div className="notice notice-warning" role="status"><div><strong className="notice-title">최신 여부 미확인</strong><span>마지막으로 불러온 기록을 보여드리고 있어요.</span><p>최근 변경이 반영되지 않았을 수 있어요.</p></div><button className="notice-action" type="button" onClick={() => void refreshWindow()}>다시 불러오기</button></div>}
      {isPriorDashboard && activeScreen !== "S12" && <div className="notice notice-warning" data-read-only-window><span>{dashboardPeriodName} 기록을 읽기 전용으로 보고 있어요.</span><button className="notice-action" type="button" onClick={() => navigate("S02")}>현재 7일 보기</button></div>}
      {pendingBloodPressureDeletion && <DeleteConfirmation title={`${dateLabel(pendingBloodPressureDeletion.observed_on)} ${periodLabel(pendingBloodPressureDeletion.period)} 혈압 기록을 삭제할까요?`} pending={pendingAction !== null} error={notice?.reload ? notice.message : undefined} onCancel={() => setPendingBloodPressureDeletion(null)} onConfirm={() => void confirmBloodPressureDeletion()} />}
      {pendingChallengeCheckinDeletion && <DeleteConfirmation title={`${dateLabel(pendingChallengeCheckinDeletion.observed_on)} 챌린지 기록을 삭제할까요?`} pending={pendingAction !== null} error={notice?.reload ? notice.message : undefined} onCancel={() => setPendingChallengeCheckinDeletion(null)} onConfirm={() => void confirmChallengeCheckinDeletion()} />}
      {accountDeletionOpen && <AccountDeletionConfirmation pending={accountDeletionPending} recovery={accountDeletionRecovery} onCancel={() => { if (!accountDeletionPending) { setAccountDeletionOpen(false); setAccountDeletionRecovery(null); } }} onConfirm={() => void confirmAccountDeletion()} />}
      {renderScene()}
    </SceneShell>
    </div>
    {reportVisible && reportCreatedAt && windowData && ready && <LivingWeekReport
      days={trailDays}
      observations={windowData.blood_pressure_observations.map(record => ({
        date: record.observed_on, period: periodLabel(record.period), measurement: displayMeasurement(record),
      }))}
      hasLegacyRecords={windowData.challenge_events.length > 0}
      unconfirmedChanges={Boolean(notice?.reload)}
      freshness={windowState}
      completedCycle={isCycleReview}
      createdAt={reportCreatedAt}
      onClose={() => {
        setReportCreatedAt(null);
        window.requestAnimationFrame(() => reportTriggerRef.current?.focus());
      }}
    />}
    </>
  );
}

export default App;
