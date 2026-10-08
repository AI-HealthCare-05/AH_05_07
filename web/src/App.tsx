import { StartingHomeControl } from "./ui/StartingHomeControl";
import { dataScopeLabel } from "./ui/dataScope";
import { isDefaultHomeEntry, readStartingHomePreference, resolveStartingHomeDestination } from "./ui/startingHomePreference";
import { MySpaceReturn } from "./ui/SpaceReturnNavigation";
import { readMySpaceReturn } from "./ui/mySpaceReturn";
import { resolvePresentationPolicy } from "./ui/presentationPolicy";
import type { FormEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { sevenDayFacts } from "./ui/livingWeek";
import { JourneyRecap } from "./components/JourneyRecap";
import { StructuredRecapFeedback } from "./components/StructuredRecapFeedback";
import { LivingWeekReport } from "./components/LivingWeekReport";

import { JourneyToday } from "./components/JourneyToday";
import { JourneySkeleton } from "./components/JourneySkeleton";
import { resolveModelV2Continuation } from "./components/modelV2Continuation";
import { LoginPresentation } from "./components/LoginPresentation";
import { SignedInStatePresentation } from "./components/SignedInStatePresentation";
import { SignedInTodayPresentation } from "./components/SignedInTodayPresentation";
import { SignedInChallengeChoicePresentation, SignedInChallengeSummaryPresentation } from "./components/SignedInChallengePresentation";
import { SignedInBloodPressurePresentation } from "./components/SignedInBloodPressurePresentation";
import { SignedInSavedPresentation } from "./components/SignedInSavedPresentation";
import { SignedInTodayReviewPresentation } from "./components/SignedInTodayReviewPresentation";

import { VisualStage } from "./components/VisualStage";


import { Scene, SceneShell } from "./components/SceneShell";
import { DeleteConfirmation } from "./components/DeleteConfirmation";
import { RecoveryPanel, type RecoveryContent } from "./components/RecoveryPanel";
import { RecordExplorer } from "./components/RecordExplorer";
import { DailyActionLoop } from "./components/DailyActionLoop";
import { ChallengeTimeline } from "./components/ChallengeTimeline";
import { emptyBloodPressureDraft, useNewBloodPressureDraft, type BloodPressureDraft } from "./components/useNewBloodPressureDraft";
import { useRecordExplorerMemory } from "./components/useRecordExplorerMemory";
import type { RecordBrowseItem } from "./ui/recordExplorer";
import { AccountDeletionConfirmation, type AccountDeletionRecovery } from "./components/AccountDeletionConfirmation";
import { BrowserPersonalizationResetConfirmation } from "./components/BrowserPersonalizationResetConfirmation";
import { ModelV2InputFlow } from "./components/ModelV2InputFlow";
import { createModelV2SessionGuard } from "./components/modelV2ExecutionGuard";
import {
  ApiRequestError,
  deleteAccount,
  createActiveChallengeCheckin,
  createBloodPressureObservation,
  deleteBloodPressureObservation,
  deleteChallengeCheckin,
  exportObservations,
  getObservationWindow,
  observationWindowReadBudgetMs,
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
import { resolveSceneGate } from "./ui/scenePolicy";
import { useSavedSceneEvent } from "./lib/useSavedSceneEvent";
import { allowsE2eFixture, e2eSessionEventName, getE2eSession } from "./lib/e2eHarness";
import {
  publishAuthoritativeSessionRejection,
  subscribeAuthoritativeSessionRejection,
  type AuthoritativeSessionRejection,
} from "./lib/sessionRejectionBoundary";
import { removePersistedSessionIfAccessToken, requestTokenBoundLocalLogout, supabase, supabaseConfigured } from "./lib/supabase";
import { resolveCompanionMode, resolveCompanionSelection, resolveProductionCompanion, type CompanionMode, type CompanionSelectionContext, type CompanionSpecies } from "./ui/companion";
import { getActiveCompanionAsset } from "./ui/companionActiveAsset";
import { companionIdentityOptions, readCompanionIdentity, writeCompanionIdentity } from "./ui/companionIdentity";
import { applyThemePreference, readThemePreference, themePreferenceOptions, writeThemePreference } from "./ui/themePreference";
import { journeyCopy, parseScreen, type ScreenId } from "./ui/journey";
import { resetBrowserPersonalization } from "./ui/browserPersonalization";
import { requiresObservationWindow } from "./ui/journeyAvailability";
import {
  getSyntheticModelV2ResultView,
  resolveSyntheticModelV2ResultState,
} from "./ui/modelV2SyntheticResultState";

const challengeActions = [
  { id: "walk-10-minutes", label: "10분 걷기", note: "가볍게 바깥 공기를 만나는 시간" },
  { id: "sleep-routine", label: "수면 시간 지키기", note: "정한 시간에 하루를 천천히 닫기" },
  { id: "low-sodium-meal", label: "덜 짜게 먹기", note: "한 끼의 선택을 담백하게 기록하기" },
] as const;

// Keep Safari's input focus from zooming the viewport and carrying that zoom
// into the saved screen. User zoom and larger root text remain available.

type NoticeOrigin = "session" | "request-error" | "mutation-success" | "edit" | "export-success";
type Notice = {
  kind: "success" | "error" | "warning";
  message: string;
  reload?: boolean;
  origin: NoticeOrigin;
  persistence: "until-navigation" | "persistent";
  recovery?: RecoveryContent;
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
type RequestContext = { userId: string; generation: number; accessToken: string };
type BloodPressureErrorField = "observed-on" | "systolic" | "diastolic";
type BloodPressureValidationError = {
  field: BloodPressureErrorField;
  message: string;
} | null;
type PostMutationRead =
  | { kind: "blood-pressure-edit"; recordKey: string | null }
  | { kind: "challenge-edit" }
  | { kind: "blood-pressure-delete" }
  | { kind: "challenge-delete" }
  | null;
type LoginFeedback = {
  kind: "sent" | "error";
  message: string;
} | null;
type AnonymousCompletion = "signed-out" | "account-deleted" | null;
type ExportRequest = {
  scope: "selected-seven-day" | "recent-thirty-day";
  startOn: string;
  endOn: string;
};

function makeNotice(
  kind: Notice["kind"],
  message: string,
  options: { origin: NoticeOrigin; reload?: boolean; recovery?: RecoveryContent },
): Notice {
  return {
    kind,
    message,
    reload: options.reload,
    origin: options.origin,
    persistence: options.origin === "export-success" ? "until-navigation" : "persistent",
    recovery: options.recovery,
  };
}

function makeSessionExpiredNotice(): Notice {
  return makeNotice(
    "warning",
    "로그인 시간이 만료되었습니다. 이메일 링크로 다시 로그인해 주세요.",
    {
      origin: "session",
      recovery: {
        kind: "session-expired",
        title: "로그인 시간이 끝났어요",
        known: "로그인 시간이 만료되었습니다. 계정이나 기록이 삭제됐다는 뜻은 아니에요.",
        unknown: "진행 중이던 저장의 최종 결과는 여기서 단정하지 않아요.",
        next: "이메일로 로그인을 다시 시작한 뒤 서버 기록을 다시 확인해 주세요.",
      },
    },
  );
}

function makePostMutationReadNotice(kind: Exclude<PostMutationRead, null>["kind"]): Notice {
  const deletion = kind.endsWith("delete");
  return makeNotice("warning", deletion
    ? "삭제 요청은 완료됐지만 최신 목록을 다시 확인하지 못했어요."
    : "수정 요청은 완료됐지만 최신 기록을 다시 확인하지 못했어요.", {
    origin: "request-error",
    reload: true,
    recovery: {
      kind: "stale-read",
      title: deletion ? "삭제 후 목록 확인 필요" : "수정 후 기록 확인 필요",
      known: deletion
        ? "삭제 요청에 대한 서버 응답은 완료됐어요. 같은 삭제를 다시 요청하지 않습니다."
        : "수정 요청에 대한 서버 응답은 완료됐어요. 같은 수정을 다시 요청하지 않습니다.",
      unknown: deletion
        ? "최신 목록에서 해당 기록이 제거됐는지는 아직 다시 읽어 확인하지 못했어요."
        : "최신 서버 기록에 수정값이 반영된 모습은 아직 다시 읽어 확인하지 못했어요.",
      next: deletion
        ? "목록을 다시 불러와 기록이 제거됐는지 확인해 주세요."
        : "기록을 다시 불러와 수정된 값을 확인해 주세요.",
    },
  });
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
  recovery,
  journey,
  companionMode,
  companionSpecies,
  onCompanionSpeciesChange,
  completion,
  browserResetCompleted,
  onResetBrowserPersonalization,
}: {
  onSession: (session: Session) => void;
  recoveryMessage?: string;
  recovery?: RecoveryContent;
  journey: boolean;
  companionMode: CompanionMode;
  companionSpecies: CompanionSpecies;
  onCompanionSpeciesChange: (species: CompanionSpecies) => void;
  completion: AnonymousCompletion;
  browserResetCompleted: boolean;
  onResetBrowserPersonalization: () => void;
}) {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<LoginFeedback>(null);
  const [pending, setPending] = useState(false);

  function enterGuestJourney() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("guest", "1");
    const space = readMySpaceReturn(window.location.search);
    if (space) url.searchParams.set("return_space", `${space.view}-${space.storage}`);
    window.location.assign(url);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || pending) return;

    setPending(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: resolveAuthEmailRedirectTo(window.location.href),
        },
      });

      if (error) {
        setFeedback({
          kind: "error",
          message: "로그인 링크를 보내지 못했습니다. 이메일 주소와 연결 상태를 확인해 주세요.",
        });
        return;
      }

      if (data.session) onSession(data.session);

      setFeedback({
        kind: "sent",
        message: "로그인 링크를 보냈어요. 메일함에서 링크를 열면 첫 혈압 기록을 시작할 수 있어요.",
      });
    } finally {
      setPending(false);
    }
  }

  const visibleFeedback = feedback ?? (
    recoveryMessage
      ? { kind: "error" as const, message: recoveryMessage }
      : null
  );

  const completionContent = completion === "signed-out"
    ? {
        title: "이 기기에서 로그아웃했어요",
        body: "현재 계정 연결만 종료했어요. 계정과 서버 기록은 삭제되지 않았고, 이 브라우저의 개인화와 내 기기에 저장한 파일도 그대로예요.",
      }
    : completion === "account-deleted"
      ? {
          title: "계정을 삭제했어요",
          body: "계정과 계정에 연결된 SK7 서버 데이터가 삭제됐어요. 내 기기에 저장한 파일과 이 브라우저의 개인화는 별도로 남을 수 있어요.",
        }
      : null;

  return (
    <LoginPresentation
      journey={journey}
      email={email}
      pending={pending}
      visibleFeedback={visibleFeedback}
      recovery={recovery}
      completionContent={completionContent}
      browserResetCompleted={browserResetCompleted}
      companionMode={companionMode}
      companionSpecies={companionSpecies}
      onEmailChange={setEmail}
      onSubmit={submit}
      onEnterGuestJourney={enterGuestJourney}
      onCompanionSpeciesChange={onCompanionSpeciesChange}
      onResetBrowserPersonalization={onResetBrowserPersonalization}
    />
  );
}

function App() {
  // Capture entry intent before auth confirmation scrubs its URL. Never re-run
  // this decision for a settings change or an in-app navigation.
  const defaultHomeEntry = useRef(isDefaultHomeEntry(window.location.href));
  const [startingHomeDestination, setStartingHomeDestination] = useState<string | null>(null);
  const initialSearch = useMemo(() => new URLSearchParams(window.location.search), []);
  const companionMode = useMemo(() => resolveCompanionMode(import.meta.env.VITE_SK7_COMPANION_MODE), []);
  const [companionSpeciesPreference, setCompanionSpeciesPreference] = useState<CompanionSpecies>(() => readCompanionIdentity());
  const activeCompanionAsset = useMemo(
    () => companionMode === "off" ? null : getActiveCompanionAsset(companionSpeciesPreference),
    [companionMode, companionSpeciesPreference],
  );
  const [themePreference, setThemePreference] = useState(() => readThemePreference());
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
  const syntheticModelV2ResultState = useMemo(
    () => resolveSyntheticModelV2ResultState(initialSearch.get("model_v2_state"), evidenceMode && allowsE2eFixture()),
    [initialSearch, evidenceMode],
  );
  const syntheticModelV2ResultView = getSyntheticModelV2ResultView(syntheticModelV2ResultState);
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
  const [recapSelectedDate, setRecapSelectedDate] = useState<string | null>(null);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [anonymousCompletion, setAnonymousCompletion] = useState<AnonymousCompletion>(null);
  const [browserResetCompleted, setBrowserResetCompleted] = useState(false);
  const [newBloodPressureRecovery, setNewBloodPressureRecovery] = useState<Notice | null>(null);
  const [previousCycleEnd, setPreviousCycleEnd] = useState<string | null>(null);
  const [challengeNeedsReload, setChallengeNeedsReload] = useState(false);
  const [challengeKnownLocked, setChallengeKnownLocked] = useState(false);
  const challengeRequestRef = useRef<RequestContext | null>(null);
  const navigationVersionRef = useRef(0);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const exportRequestRef = useRef<ExportRequest | null>(null);
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
  const [postMutationRead, setPostMutationRead] = useState<PostMutationRead>(null);
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
  const authoritativeRejectionHandlerRef = useRef<(reason: AuthoritativeSessionRejection) => void>(() => undefined);
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
  const [browserResetOpen, setBrowserResetOpen] = useState(false);
  const [browserResetError, setBrowserResetError] = useState<string | null>(null);
  const [browserPersonalizationVersion, setBrowserPersonalizationVersion] = useState(0);
  const presentationRef = useRef({ today, startOn, endOn, windowData, accountDeletionPending });

  useLayoutEffect(() => {
    const previous = presentationRef.current;
    // Invalidate before passive refresh effects: old success AND error callbacks
    // must not commit across a calendar/window change, even after A -> B -> A.
    if (previous.startOn !== startOn || previous.endOn !== endOn) windowRequestId.current += 1;
    presentationRef.current = { today, startOn, endOn, windowData, accountDeletionPending };
  }, [today, startOn, endOn, windowData, accountDeletionPending]);

  useEffect(() => {
    setRecapSelectedDate(null);
  }, [startOn, endOn]);

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

    const entryUrl = new URL(window.location.href);
    const incomingScreen = currentIdentity.userId === null && nextUserId !== null
      && (!window.history.state?.sk7UserId || window.history.state.sk7UserId === nextUserId);
    if (currentIdentity.userId === null && nextUserId !== null) {
      setAnonymousCompletion(null);
      setBrowserResetCompleted(false);
      setStartingHomeDestination(resolveStartingHomeDestination({
        defaultEntry: defaultHomeEntry.current && isDefaultHomeEntry(entryUrl.href),
        signedIn: true,
        evidenceMode: evidenceMode || allowsE2eFixture(),
        preference: readStartingHomePreference(),
      }));
      defaultHomeEntry.current = false;
    } else if (!nextUserId) {
      setStartingHomeDestination(null);
    }
    sessionIdentityRef.current = { userId: nextUserId, generation: currentIdentity.generation + 1 };
    sessionRef.current = nextSession;
    windowRequestId.current += 1;
    setSession(nextSession);
    setPreviousCycleEnd(null);
    setChallengeNeedsReload(false);
    setChallengeKnownLocked(false);
    challengeRequestRef.current = null;
    setSignOutPending(false);
    accountDeletionStartedRef.current = false;
    setAccountDeletionOpen(false);
    setAccountDeletionPending(false);
    setAccountDeletionRecovery(null);
    setWindowData(null);
    setWindowState("loading");
    setRecapSelectedDate(null);
    setNotice(null);
    setNewBloodPressureRecovery(null);
    setPendingAction(null);
    exportRequestRef.current = null;
    setConfirmedSave(false);
    savedScene.clear();
    setBloodPressureEditDraft(emptyBloodPressureDraft(presentationRef.current.today));
    setBloodPressureError(null);
    setEditingBloodPressureId(null);
    setPendingBloodPressureDeletion(null);
    setEditingChallengeCheckin(null);
    setPendingChallengeCheckinDeletion(null);
    setPostMutationRead(null);
    setSelectedRecordKey(incomingScreen ? entryUrl.searchParams.get("record") : null);
    setRequestedScreen(incomingScreen ? parseScreen(entryUrl.searchParams.get("screen")) : "S02");
    setDashboardWindow(incomingScreen ? parseDashboardWindow(entryUrl.searchParams.get("dashboard_window"), presentationRef.current.today) : "current");
    editOriginKey.current = null;

    const url = new URL(window.location.href);
    if (!incomingScreen) {
      url.searchParams.delete("screen");
      url.searchParams.delete("record");
      url.searchParams.delete("dashboard_window");
    }
    window.history.replaceState({ ...(window.history.state ?? {}), sk7UserId: nextUserId }, "", url);
    if (!nextUserId) defaultHomeEntry.current = isDefaultHomeEntry(url.href);
  }

  function withdrawSessionForAuthoritativeRejection(reason: AuthoritativeSessionRejection) {
    if (!sessionRef.current) return;

    if (reason === "owner-deleted") {
      setAnonymousCompletion("account-deleted");
      setBrowserResetCompleted(false);
    } else {
      setAnonymousCompletion(null);
    }

    // App remains the sole owner of its signed-in product state. The boundary
    // only tells that owner its exact current token lost authority.
    applySession(null);

    if (reason === "session-invalid") {
      setNotice(makeSessionExpiredNotice());
    }
  }

  // Keep one BroadcastChannel subscription while allowing it to invoke the
  // current render's App-owned withdrawal logic.
  authoritativeRejectionHandlerRef.current = withdrawSessionForAuthoritativeRejection;

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

  useEffect(() => subscribeAuthoritativeSessionRejection(
    () => sessionRef.current?.access_token ?? null,
    (reason) => authoritativeRejectionHandlerRef.current(reason),
  ), []);

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

  useEffect(() => {
    if (startingHomeDestination) window.location.replace(startingHomeDestination);
  }, [startingHomeDestination]);

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

    if (evidenceMode || startingHomeDestination || !sessionUserId || !sessionAccessToken) return;

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
    startingHomeDestination,
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
    // Today selected through navigation is explicit, including after a reload.
    url.searchParams.set("screen", screen);
    if (recordKey) url.searchParams.set("record", recordKey);
    else url.searchParams.delete("record");
    window.history[replace ? "replaceState" : "pushState"]({ ...(window.history.state ?? {}), sk7UserId: sessionIdentityRef.current.userId }, "", url);
    setRequestedScreen(screen);
    setSelectedRecordKey(recordKey ?? null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function presentRequestError(error: unknown, context: "load" | "save" | "delete" | "export", requestContext?: RequestContext) {
    if (isSessionError(error) && requestContext && isCurrentRequestContext(requestContext) && !hasNewerToken(requestContext)) {
      // A server rejection of request token A must never sign out a newer token B.
      // Remove only A if it is still persisted, then best-effort logout A by value.
      // A different persisted token means auth renewal has already won the race.
      const cleanup = removePersistedSessionIfAccessToken(requestContext.accessToken);
      if (cleanup === "different") return;
      void requestTokenBoundLocalLogout(requestContext.accessToken).catch(() => undefined);
      if (!isCurrentRequestContext(requestContext) || hasNewerToken(requestContext)) return;

      // Propagate only the admitted rejected token. The boundary publishes a
      // SHA-256 fingerprint, never the bearer token itself.
      void publishAuthoritativeSessionRejection(
        requestContext.accessToken,
        "session-invalid",
      ).catch(() => undefined);

      withdrawSessionForAuthoritativeRejection("session-invalid");
      return;
    }
    if (context === "load") {
      setWindowState(presentationRef.current.windowData ? "refresh-error" : "error");
      return;
    }
    if (error instanceof ApiRequestError && error.status === 422) {
      setNotice(makeNotice("error", "입력 내용을 저장할 수 없어요. 날짜와 값의 형식을 확인한 뒤 수정해 주세요.", {
        origin: "request-error",
        recovery: {
          kind: "known-rejection",
          title: "저장되지 않음",
          known: "요청이 거절되어 변경이 완료되지 않았어요.",
          next: "입력 내용을 저장할 수 없어요. 날짜와 값의 형식을 확인한 뒤 수정해 주세요.",
        },
      }));
      return;
    }
    if (error instanceof ApiRequestError && error.code === "challenge_selection_locked") {
      setNotice(makeNotice("error", "첫 체크인이 있어 선택한 행동은 바꿀 수 없어요.", {
        origin: "request-error",
        recovery: {
          kind: "known-rejection",
          title: "선택이 변경되지 않음",
          known: "첫 체크인이 있어 선택한 행동은 바꿀 수 없어요.",
          next: "현재 선택을 유지하고 오늘 상태를 확인해 주세요.",
        },
      }));
      return;
    }
    if (error instanceof ApiRequestError && (error.status === 409 || error.code === "observation_conflict")) {
      setNotice(makeNotice("error", "같은 날짜와 시간대에 이미 기록이 있습니다. 입력을 확인해 주세요.", {
        origin: "request-error",
        recovery: {
          kind: "known-rejection",
          title: "새 기록이 저장되지 않음",
          known: "요청이 거절되어 새 기록은 저장되지 않았어요.",
          next: "같은 날짜와 시간대에 이미 기록이 있습니다. 입력을 확인해 주세요.",
        },
      }));
      return;
    }
    const message = context === "export"
      ? "파일을 내려받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요."
      : context === "delete"
        ? "삭제 여부를 확인하지 못했습니다. 목록을 다시 불러와 확인해 주세요."
        : "저장 여부를 확인하지 못했어요. 자동으로 다시 보내지 않았습니다. 기록을 새로고침해 확인해 주세요.";
    const recoveryContent: RecoveryContent = context === "export"
      ? {
          kind: "export-failure",
          title: "파일 내보내기만 완료되지 않음",
          known: "계정 기록은 변경되지 않았어요.",
          unknown: "파일 생성 또는 다운로드만 완료되지 않았어요.",
          next: "연결을 확인한 뒤 내보내기를 다시 시도해 주세요.",
        }
      : context === "delete"
        ? {
            kind: "uncertain-delete",
            title: "삭제 결과 확인 필요",
            known: "삭제 요청은 보냈고 같은 요청을 자동으로 반복하지 않았어요.",
            unknown: "삭제 여부를 확인하지 못했습니다.",
            next: "같은 삭제를 다시 요청하기 전에 목록을 다시 불러와 먼저 확인해 주세요.",
          }
        : {
            kind: "uncertain-save",
            title: "처리 결과 확인 필요",
            known: "저장 요청은 전송됐고 자동으로 다시 보내지 않았습니다.",
            unknown: "저장 여부를 확인하지 못했어요.",
            next: "같은 요청을 다시 보내기 전에 기록을 다시 불러와 반영 여부를 확인해 주세요.",
          };
    const recovery = makeNotice("warning", message, { origin: "request-error", reload: context !== "export", recovery: recoveryContent });
    setNotice(recovery);
    return recovery;
  }

  function handleStructuredFeedbackSessionError(error: ApiRequestError, requestSession: Session) {
    const requestContext = captureRequestContext(requestSession);
    if (!requestContext || !isCurrentRequestContext(requestContext)) return;
    presentRequestError(error, "save", requestContext);
  }

  async function refreshWindow({
    allowRetry = true,
    initialLoad = false,
    logicalDeadline,
  }: {
    allowRetry?: boolean;
    initialLoad?: boolean;
    logicalDeadline?: number;
  } = {}): Promise<boolean> {
    // A pre-midnight mutation may call this old function after the date changes.
    // Read committed presentation bounds and the latest session at invocation.
    const activeSession = sessionRef.current;
    const snapshot = presentationRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || evidenceMode || snapshot.accountDeletionPending) return false;
    const readDeadline = logicalDeadline ?? performance.now() + observationWindowReadBudgetMs;
    const requestId = ++windowRequestId.current;
    setWindowState(snapshot.windowData ? "refreshing" : "loading");
    try {
      const nextData = await getObservationWindow(
        activeSession,
        snapshot.startOn,
        snapshot.endOn,
        readDeadline - performance.now(),
      );
      if (requestId !== windowRequestId.current || !isCurrentRequestContext(requestContext)) return false;
      setWindowData(nextData);
      setWindowState("ready");
      setChallengeNeedsReload(false);
      setChallengeKnownLocked(false);
      return true;
    } catch (error) {
      if (requestId !== windowRequestId.current || !isCurrentRequestContext(requestContext)) return false;
      // One retry allowance and one logical deadline are shared by a transient
      // bootstrap failure and the existing newer-token 401 recovery.
      const transientInitialRead = initialLoad && snapshot.windowData === null
        && error instanceof ApiRequestError
        // A stalled error body must not turn a known ordinary HTTP failure
        // (such as 403/429/500) into a retryable status-0 timeout.
        && (error.responseStatus === undefined || error.responseStatus < 400
          || [502, 503, 504].includes(error.responseStatus))
        && ((error.status === 0 && (error.code === "network_error" || error.code === "request_timeout"))
          || error.status === 502 || error.status === 503 || error.status === 504);
      const retryable = transientInitialRead || (isSessionError(error) && hasNewerToken(requestContext));
      if (allowRetry && retryable && readDeadline > performance.now()) {
        return refreshWindow({ allowRetry: false, logicalDeadline: readDeadline });
      }
      presentRequestError(error, "load", requestContext);
      return false;
    }
  }

  async function refreshThenOpenRecords() {
    const requestContext = captureRequestContext();
    if (!requestContext) return;
    await refreshWindow();
    if (isCurrentRequestContext(requestContext)) navigate("S08");
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
    setAnonymousCompletion("account-deleted");
    setBrowserResetCompleted(false);
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
    setAnonymousCompletion("signed-out");
    setBrowserResetCompleted(false);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (!isCurrentRequestContext(requestContext)) return;
      if (error) {
        setAnonymousCompletion(null);
        setNotice(makeNotice("warning", "로그아웃을 완료하지 못했어요. 다시 시도해 주세요.", { origin: "session" }));
        return;
      }
      applySession(null);
    } catch {
      if (isCurrentRequestContext(requestContext)) {
        setAnonymousCompletion(null);
        setNotice(makeNotice("warning", "로그아웃을 완료하지 못했어요. 다시 시도해 주세요.", { origin: "session" }));
      }
    } finally {
      if (isCurrentRequestContext(requestContext)) setSignOutPending(false);
    }
  }

  function openBrowserPersonalizationReset() {
    setBrowserResetError(null);
    setBrowserResetOpen(true);
  }

  function confirmBrowserPersonalizationReset() {
    if (!resetBrowserPersonalization()) {
      setBrowserResetError("브라우저 저장 공간에 접근하지 못해 초기화를 완료하지 못했어요. 브라우저 설정을 확인한 뒤 다시 시도해 주세요.");
      return;
    }

    setThemePreference(applyThemePreference("cloud"));
    setCompanionSpeciesPreference("bear");
    setBrowserPersonalizationVersion((version) => version + 1);
    setBrowserResetError(null);
    setBrowserResetOpen(false);
    if (sessionRef.current) {
      setNotice(makeNotice("success", "이 브라우저의 개인화를 초기화했어요. 계정과 서버 기록은 변경되지 않았어요.", { origin: "mutation-success" }));
    } else {
      setBrowserResetCompleted(true);
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
      const rereadConfirmed = await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      if (editingRecordId) {
        if (!rereadConfirmed) {
          setPostMutationRead({ kind: "blood-pressure-edit", recordKey: editReturnKey });
          setNotice(makePostMutationReadNotice("blood-pressure-edit"));
          return;
        }
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
    setPostMutationRead(null);
    setPendingAction("blood-pressure");
    try {
      await deleteBloodPressureObservation(activeSession, pendingBloodPressureDeletion.id);
      if (!isCurrentRequestContext(requestContext)) return;
      const rereadConfirmed = await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      if (!rereadConfirmed) {
        setPostMutationRead({ kind: "blood-pressure-delete" });
        setNotice(makePostMutationReadNotice("blood-pressure-delete"));
        return;
      }
      setPendingBloodPressureDeletion(null);
      setSelectedRecordKey(null);
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
    if (challengeRequestRef.current || challengeNeedsReload || challengeKnownLocked || windowState !== "ready") return;
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
        const knownLocked = error instanceof ApiRequestError && error.code === "challenge_selection_locked";
        setChallengeKnownLocked(knownLocked);
        setChallengeNeedsReload(!knownLocked);
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
      const rereadConfirmed = await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      if (!rereadConfirmed) {
        setPostMutationRead({ kind: "challenge-edit" });
        setNotice(makePostMutationReadNotice("challenge-edit"));
        return;
      }
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
    setPostMutationRead(null);
    setPendingAction("challenge-checkin");
    try {
      await deleteChallengeCheckin(activeSession, pendingChallengeCheckinDeletion.id);
      if (!isCurrentRequestContext(requestContext)) return;
      const rereadConfirmed = await refreshWindow();
      if (!isCurrentRequestContext(requestContext)) return;
      if (!rereadConfirmed) {
        setPostMutationRead({ kind: "challenge-delete" });
        setNotice(makePostMutationReadNotice("challenge-delete"));
        return;
      }
      setPendingChallengeCheckinDeletion(null);
      setEditingChallengeCheckin(null);
      setSelectedRecordKey(null);
      setNotice(makeNotice("success", "챌린지 기록을 삭제했습니다.", { origin: "mutation-success" }));
      returnAfterRecordDeletion();
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "delete", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  async function finishPostMutationRead() {
    const recovery = postMutationRead;
    const requestContext = captureRequestContext();
    if (!recovery || !requestContext || pendingAction || accountDeletionPending) return;
    const action = recovery.kind.startsWith("blood-pressure") ? "blood-pressure" : "challenge-checkin";
    setPendingAction(action);
    try {
      const rereadConfirmed = await refreshWindow();
      if (!rereadConfirmed || !isCurrentRequestContext(requestContext)) return;
      setPostMutationRead(null);
      if (recovery.kind === "blood-pressure-edit") {
        setBloodPressureEditDraft(emptyBloodPressureDraft(presentationRef.current.today));
        setEditingBloodPressureId(null);
        setBloodPressureError(null);
        editOriginKey.current = null;
        setNotice(makeNotice("success", "혈압 기록을 수정했습니다.", { origin: "mutation-success" }));
        if (requestedScreen === "S04" && recovery.recordKey) window.history.back();
        else if (recovery.recordKey) navigate("S09", recovery.recordKey, true);
        else navigate("S08");
        return;
      }
      if (recovery.kind === "challenge-edit") {
        setEditingChallengeCheckin(null);
        setNotice(makeNotice("success", "챌린지 상태를 수정했습니다.", { origin: "mutation-success" }));
        return;
      }

      setPendingBloodPressureDeletion(null);
      setPendingChallengeCheckinDeletion(null);
      setEditingChallengeCheckin(null);
      setSelectedRecordKey(null);
      setNotice(makeNotice("success", recovery.kind === "blood-pressure-delete"
        ? "혈압 기록을 삭제했습니다."
        : "챌린지 기록을 삭제했습니다.", { origin: "mutation-success" }));
      returnAfterRecordDeletion();
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  async function exportRecords(request: ExportRequest) {
    const activeSession = sessionRef.current;
    const requestContext = captureRequestContext(activeSession);
    if (!activeSession || !requestContext || evidenceMode || pendingAction || accountDeletionPending) return;
    exportRequestRef.current = request;
    setPendingAction("export");
    try {
      const exported = await exportObservations(activeSession, request.startOn, request.endOn);
      if (!isCurrentRequestContext(requestContext)) return;
      const objectUrl = URL.createObjectURL(exported.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = exported.filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setNotice(makeNotice(
        "success",
        request.scope === "recent-thirty-day"
          ? "최근 30일 날짜 범위 JSON을 준비했어요. 내 기기에 저장한 사본은 직접 안전하게 관리해 주세요."
          : "내보내기 파일을 준비했어요. 본인 기기에 안전하게 보관해 주세요.",
        { origin: "export-success" },
      ));
    } catch (error) {
      if (isCurrentRequestContext(requestContext)) presentRequestError(error, "export", requestContext);
    } finally {
      if (isCurrentRequestContext(requestContext)) setPendingAction(null);
    }
  }

  function exportRecentRecords() {
    return exportRecords({ scope: "selected-seven-day", startOn, endOn });
  }

  function exportRecentThirtyDayRecords() {
    return exportRecords({ scope: "recent-thirty-day", startOn: shiftDate(today, -29), endOn: today });
  }

  function retryExport() {
    const request = exportRequestRef.current;
    return request ? exportRecords(request) : exportRecentRecords();
  }

  const presentation = resolvePresentationPolicy(import.meta.env.VITE_SK7_UI_MODE, import.meta.env.VITE_SK7_SCENE_MODE);

  if (!evidenceMode && !e2eSession && !supabaseConfigured) {
    return <main className="welcome-shell"><p className="notice notice-error">웹 환경변수를 설정한 뒤 시작할 수 있습니다.</p></main>;
  }
  if (!evidenceMode && (authEmailConfirmPending || authBootstrapPending || startingHomeDestination)) {
    return (
      <main className="welcome-shell auth-transition" data-auth-transition={startingHomeDestination ? "destination" : authEmailConfirmPending ? "confirm" : "bootstrap"}>
        <section className="welcome-card" aria-live="polite" aria-busy="true">
          <p className="eyebrow">SK7</p>
          <h1>{startingHomeDestination ? "내 공간을 열고 있어요." : authEmailConfirmPending ? "로그인 링크를 확인하고 있어요." : "로그인 상태를 확인하고 있어요."}</h1>
          <p className="scene-body">계정과 기록 상태를 확인한 뒤 올바른 시작 화면을 열게요.</p>
        </section>
      </main>
    );
  }
  if (!evidenceMode && !session) {
    return <>
      <MySpaceReturn />
      <Login
        journey={presentation.journey}
        companionMode={companionMode}
        companionSpecies={companionSpeciesPreference}
        onCompanionSpeciesChange={(species) => setCompanionSpeciesPreference(writeCompanionIdentity(species))}
        onSession={applySession}
        recoveryMessage={notice?.kind === "warning" && !notice.recovery ? notice.message : undefined}
        recovery={notice?.recovery}
        completion={anonymousCompletion}
        browserResetCompleted={browserResetCompleted}
        onResetBrowserPersonalization={openBrowserPersonalizationReset}
      />
      {browserResetOpen && <BrowserPersonalizationResetConfirmation
        error={browserResetError}
        onCancel={() => { setBrowserResetOpen(false); setBrowserResetError(null); }}
        onConfirm={confirmBrowserPersonalizationReset}
      />}
    </>;
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
      ? `최근 7일 혈압 기록 ${recentBloodPressureCount}건`
      : "오늘 기록 없음"
    : todayMorningMeasurement && todayEveningMeasurement
      ? "아침·저녁 기록 있음"
      : todayMorningMeasurement
        ? "아침 기록 있음"
        : "저녁 기록 있음";
  const additionalBloodPressureSupport =
    todayMorningMeasurement && !todayEveningMeasurement
      ? "아침 기록 있음 · 저녁은 필요할 때 추가"
      : todayEveningMeasurement && !todayMorningMeasurement
        ? "저녁 기록 있음 · 아침은 필요할 때 추가"
        : "오늘 기록 없음";
  const controlsDisabled = pendingAction !== null || postMutationRead !== null || isPriorDashboard || accountDeletionPending;
  const readNavigationDisabled = pendingAction !== null || postMutationRead !== null || accountDeletionPending;
  const settingsControlsDisabled = pendingAction !== null || signOutPending || accountDeletionPending;
  const displayMeasurement = (record: BloodPressureObservation) => evidenceMode ? "•••/•• mmHg" : `${record.systolic}/${record.diastolic} mmHg`;
  const recordBrowseItems: RecordBrowseItem[] = [
    ...(windowData?.blood_pressure_observations.map((record) => ({ key: `blood-pressure:${record.id}`, kind: "blood-pressure" as const, record })) ?? []),
    ...(windowData?.challenge_checkins.map((record) => ({ key: `challenge-checkin:${record.id}`, kind: "challenge-checkin" as const, record })) ?? []),
    ...(windowData?.challenge_events.map((record) => ({ key: `legacy:${record.id}`, kind: "legacy" as const, record })) ?? []),
  ].sort((left, right) => right.record.observed_on.localeCompare(left.record.observed_on));
  const selectedRecord = selectedRecordKey ? recordBrowseItems.find((record) => record.key === selectedRecordKey) : null;
  const selectedRecordMissing = Boolean(selectedRecordKey && !selectedRecord);
  const editingBloodPressureRecord = editingBloodPressureId
    ? windowData?.blood_pressure_observations.find((record) => record.id === editingBloodPressureId) ?? null
    : null;
  const ready = windowState === "ready" || windowState === "refreshing" || windowState === "refresh-error";
  const reportAvailable = !evidenceMode && Boolean(session) && (!isPriorDashboard || isCycleReview) && ready
    && windowData?.start_on === startOn && windowData?.end_on === endOn;
  const reportVisible = reportCreatedAt !== null && reportAvailable && requestedScreen === "S10";
  const confirmedWindowEmpty = windowState === "ready" && isWindowEmpty(windowData);
  const firstBloodPressureWindow = ready
    && windowData?.blood_pressure_observations.length === 1
    && windowData.challenge_checkins.length === 0
    && windowData.challenge_events.length === 0
    && !windowData.active_challenge;
  const automaticallyEmpty = confirmedWindowEmpty && requestedScreen === "S02" && !confirmedSave;
  const truthfulFallback: ScreenId = confirmedWindowEmpty ? "S12" : "S02";
  const activeScreen: ScreenId = windowState === "error" && requiresObservationWindow(requestedScreen)
    ? "S13"
    : requestedScreen === "S05" && !confirmedSave
      ? truthfulFallback
      : requestedScreen === "S13" || (requestedScreen === "S12" && !confirmedWindowEmpty)
        ? truthfulFallback
        : requestedScreen === "S06" && !activeChallenge
          ? truthfulFallback
        : automaticallyEmpty ? "S12" : requestedScreen;
  // Destination intent only. ProductPlaceableEntry owns verification and reads.
  // A bounded return context preserves an explicit browser-only visit.
  const returnSpace = readMySpaceReturn(window.location.search);
  const mySpaceView = returnSpace?.view ?? "3d";
  const mySpaceStorage = returnSpace?.storage ?? "account";
  const mySpaceEntry = session && !evidenceMode && requestedScreen === "S02"
    && (activeScreen === "S02" || activeScreen === "S12")
    && !readNavigationDisabled && !signOutPending && !accountDeletionOpen
    && !pendingBloodPressureDeletion && !pendingChallengeCheckinDeletion && !notice?.reload
    ? {
      href: `?experience=e2&view=${mySpaceView}&storage=${mySpaceStorage}`,
      returning: Boolean(returnSpace),
      view: mySpaceView,
      storage: mySpaceStorage,
    } : undefined;
  const blockingLoading = windowState === "loading" && requiresObservationWindow(activeScreen);
  const companionContext: CompanionSelectionContext | undefined = activeScreen === "S05" && confirmedSave
    ? "save_success"
    : initialSearch.get("companion_context") === "non_semantic"
      ? "non_semantic"
      : undefined;
  const sceneGate = resolveSceneGate(import.meta.env.VITE_SK7_SCENE_MODE);
  const scenePresentationPolicy = resolvePresentationPolicy(
    import.meta.env.VITE_SK7_UI_MODE,
    import.meta.env.VITE_SK7_SCENE_MODE,
  );
  const s02SceneOwnsDecoration =
    activeScreen === "S02" &&
    (
      sceneGate === "review"
      || (sceneGate === "production" && scenePresentationPolicy.journey)
    );
  // Review and exact-production Journey S10 use one scene character owner.
  // Non-Journey/off paths retain the independently qualified companion fallback.
  const s10SceneOwnsDecoration =
    activeScreen === "S10" &&
    (
      sceneGate === "review"
      || (sceneGate === "production" && scenePresentationPolicy.journey)
    );
  const sceneOwnsCompanionDecoration =
    s02SceneOwnsDecoration || s10SceneOwnsDecoration;
  const s02CompanionSpecies =
    s02SceneOwnsDecoration && companionMode !== "off"
      ? companionSpeciesPreference
      : null;
  const s10CompanionSpecies =
    s10SceneOwnsDecoration && companionMode !== "off"
      ? companionSpeciesPreference
      : null;
  const companionSelection = sceneOwnsCompanionDecoration
    ? null
    : companionMode === "production"
      ? resolveProductionCompanion(
          companionMode,
          activeScreen,
          confirmedSave,
          companionSpeciesPreference,
        )
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
    ? `${activeChallenge!.starts_on} ~ ${activeChallenge!.ends_on} · 기록과 리포트 확인`
    : activeChallenge
      ? todayCheckin
        ? `${challengeLabel(activeChallenge.action_id)} · 오늘 상태 ${checkinLabel(todayCheckin.status)}`
        : `${challengeLabel(activeChallenge.action_id)} · 오늘 상태는 아직 기록하지 않았어요.`
      : "선택 기능 · 혈압 기록과 별도로 한 행동을 7일간 기록";
  const homeLead: HomeAction = !todayMeasurement
    ? { key: "blood-pressure", title: "오늘 혈압 기록", support: todayBloodPressureSupport, action: "혈압 기록하기", screen: "S04" }
    : { key: "today-detail", title: "오늘 혈압 기록 확인", support: todayBloodPressureSupport, action: "오늘 기록 보기", screen: "S07" };
  const bloodPressureSecondaryAction: HomeAction =
    todayMorningMeasurement && todayEveningMeasurement
      ? {
          key: "records",
          title: "기록 찾아보기",
          support: "아침·저녁 기록 있음 · 지난 기록은 날짜별",
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
        ? "혈압 기록 · 챌린지 상태"
        : "혈압 기록 없음 · 챌린지 상태",
      action: todayMeasurement ? "오늘 상세 열기" : "오늘 상태 보기",
      screen: "S07",
    },
  ] as HomeAction[]).filter((item) => item.key !== homeLead.key);

  const modelV2Continuation = resolveModelV2Continuation(
    windowState !== "ready" || isPriorDashboard
      ? { freshness: "retained_or_unconfirmed" }
      : {
        freshness: "confirmed",
        bloodPressure: todayMeasurement ? "exists" : "missing",
        challenge: !activeChallenge ? "none"
          : activeChallengeEnded ? "ended"
            : todayCheckin ? "active_recorded" : "active_pending",
      },
  );
  const modelV2ChallengeStatus = activeChallengeEnded && activeChallenge
    ? `${challengeLabel(activeChallenge.action_id)} · 기간이 끝났어요.`
    : activeChallenge
      ? todayCheckin
        ? `${challengeLabel(activeChallenge.action_id)} · 오늘 상태 ${checkinLabel(todayCheckin.status)}`
        : `${challengeLabel(activeChallenge.action_id)} · 오늘 상태는 아직 기록하지 않았어요.`
      : "진행 중인 7일 챌린지가 없어요.";
  const modelV2ChallengeSupport = activeChallengeEnded
    ? "오늘의 기록으로 돌아가 원하면 다음 챌린지를 고를 수 있어요."
    : activeChallenge
      ? "오늘의 기록에서 현재 챌린지 상태를 이어서 확인할 수 있어요."
      : "원하면 오늘의 기록에서 7일 챌린지를 선택할 수 있어요.";

  function openCycleReview(end: string) {
    navigate("S10");
    selectDashboardWindow(`cycle:${end}`);
  }

  function renderCycleActions(showTimeline = true) {
    if (!activeChallengeEnded || !activeChallenge) return null;
    return <section className="locked-challenge challenge-ended-panel" data-living-cycle="ended" aria-label="종료된 챌린지">
      <div className="challenge-ended-heading">
        <div><p className="eyebrow">7일 기간 종료</p><h2>이번 챌린지가 끝났어요</h2></div>
        <strong>{challengeLabel(activeChallenge.action_id)}</strong>
      </div>
      <p><time dateTime={activeChallenge.starts_on}>{activeChallenge.starts_on}</time> ~ <time dateTime={activeChallenge.ends_on}>{activeChallenge.ends_on}</time></p>
      <p>기록함·건너뜀 내역은 완료된 7일 화면에서 정확한 기간 그대로 볼 수 있어요.</p>
      {showTimeline && <ChallengeTimeline challenge={activeChallenge} checkins={windowData?.challenge_checkins ?? []} today={today} factsStartOn={startOn} factsEndOn={endOn} />}
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

  function renderScene() {
    if (blockingLoading) {
      return <JourneySkeleton screen={activeScreen} />;
    }

    if (activeScreen === "S12" || activeScreen === "S13") {
      return <SignedInStatePresentation
        screen={activeScreen}
        journey={presentation.journey}
        isPriorDashboard={isPriorDashboard}
        evidenceMode={evidenceMode}
        startOn={startOn}
        endOn={endOn}
        mySpaceEntry={mySpaceEntry}
        dateLabel={dateLabel}
        onNavigate={navigate}
        onSelectCurrentWindow={() => selectDashboardWindow("current")}
        onRefresh={() => void refreshWindow()}
      />;
    }

    if (activeScreen === "S02") {
      const livingChoiceAvailable = windowState === "ready"
        && !controlsDisabled
        && !accountDeletionOpen
        && !pendingBloodPressureDeletion
        && !pendingChallengeCheckinDeletion
        && !notice?.reload;

      return <SignedInTodayPresentation
        journey={presentation.journey}
        staticLandscape={s02SceneOwnsDecoration ? false : presentation.staticLandscape}
        today={today}
        startOn={startOn}
        endOn={endOn}
        days={trailDays}
        lead={homeLead}
        secondary={homeSecondaryActions}
        freshness={windowState}
        mySpaceEntry={mySpaceEntry}
        companionSpecies={s02CompanionSpecies}
        companionAsset={activeCompanionAsset}
        livingChoiceAvailable={livingChoiceAvailable}
        livingChoiceActionId={activeChallenge?.action_id}
        livingChoiceSearch={window.location.search}
        endedChallenge={activeChallengeEnded ? activeChallenge : null}
        challengeCheckins={windowData?.challenge_checkins ?? []}
        endedChallengeLabel={activeChallengeEnded && activeChallenge
          ? challengeLabel(activeChallenge.action_id)
          : null}
        endedCycleNextDisabled={readNavigationDisabled || windowState !== "ready" || challengeNeedsReload}
        endedCycleReviewDisabled={readNavigationDisabled || evidenceMode}
        showEndedCycleReviewAction={!isCycleReview}
        previousCycleReviewVisible={Boolean(previousCycleEnd && !activeChallengeEnded)}
        todayBloodPressureStatus={todayBloodPressureStatus}
        challengeStatusLabel={activeChallengeEnded
          ? "챌린지 종료"
          : activeChallenge
            ? challengeLabel(activeChallenge.action_id)
            : "챌린지 미선택"}
        dateLabel={dateLabel}
        onNavigate={navigate}
        onChooseNextChallenge={() => {
          if (!activeChallenge) return;
          setPreviousCycleEnd(activeChallenge.ends_on);
          navigate("S03");
        }}
        onOpenEndedCycleReview={() => {
          if (activeChallenge) openCycleReview(activeChallenge.ends_on);
        }}
        onOpenPreviousCycleReview={() => {
          if (previousCycleEnd) openCycleReview(previousCycleEnd);
        }}
      />;
    }

    if (activeScreen === "S03") {
      const locked = Boolean(activeChallenge?.first_checkin_on && !activeChallengeEnded) || challengeKnownLocked;
      return <SignedInChallengeChoicePresentation
        journey={presentation.journey}
        activeChallenge={activeChallenge}
        activeChallengeEnded={activeChallengeEnded}
        locked={locked}
        actions={challengeActions}
        actionLabel={challengeLabel}
        selectionPending={pendingAction === "challenge-selection"}
        controlsDisabled={controlsDisabled}
        challengeNeedsReload={challengeNeedsReload}
        windowReady={windowState === "ready"}
        isPriorDashboard={isPriorDashboard}
        readNavigationDisabled={readNavigationDisabled}
        onSelectAction={(actionId) => void selectChallenge(actionId)}
        onNavigate={navigate}
      />;
    }

    if (activeScreen === "S04") {
      return <SignedInBloodPressurePresentation
        journey={presentation.journey}
        today={today}
        firstSession={confirmedWindowEmpty}
        editingBloodPressureId={editingBloodPressureId}
        editingBloodPressureRecord={editingBloodPressureRecord}
        draft={bloodPressureDraft}
        error={bloodPressureError}
        controlsDisabled={controlsDisabled}
        saving={pendingAction === "blood-pressure"}
        restoredDraft={newBloodPressure.restored}
        meaningfulDraft={newBloodPressure.meaningful}
        observedOnRef={observedOnRef}
        systolicRef={systolicRef}
        diastolicRef={diastolicRef}
        dateLabel={dateLabel}
        periodLabel={periodLabel}
        displayMeasurement={displayMeasurement}
        onDraftChange={(patch) => setBloodPressureDraft((draft) => ({ ...draft, ...patch }))}
        onClearDraft={() => {
          newBloodPressure.reset(today);
          setBloodPressureError(null);
        }}
        onCancelEdit={cancelBloodPressureEdit}
        onReturnToday={() => navigate("S02")}
        onSubmit={submitBloodPressure}
      />;
    }

    if (activeScreen === "S05") {
      const savedBloodPressureIsToday = savedFactKind === "blood-pressure" && savedFactDate === today;
      return <SignedInSavedPresentation
        journey={presentation.journey}
        savedFactKind={savedFactKind}
        savedBloodPressureIsToday={savedBloodPressureIsToday}
        firstBloodPressureWindow={firstBloodPressureWindow}
        onPrimary={() => {
          setConfirmedSave(false);
          savedScene.clear();
          navigate(savedFactKind === "blood-pressure" && !savedBloodPressureIsToday
            ? "S08" : savedBloodPressureIsToday && presentation.journey ? "S07" : "S02");
        }}
        onSecondary={() => {
          setConfirmedSave(false);
          savedScene.clear();
          navigate(savedFactKind === "challenge-checkin" ? "S06" : "S04");
        }}
        onReturnHome={() => {
          setConfirmedSave(false);
          savedScene.clear();
          navigate("S02");
        }}
      />;
    }

    if (activeScreen === "S06") {
      return <SignedInChallengeSummaryPresentation
        journey={presentation.journey}
        activeChallenge={activeChallenge}
        activeChallengeEnded={activeChallengeEnded}
        todayCheckin={todayCheckin}
        checkins={windowData?.challenge_checkins ?? []}
        today={today}
        startOn={startOn}
        endOn={endOn}
        isPriorDashboard={isPriorDashboard}
        controlsDisabled={controlsDisabled}
        endedCyclePanel={renderCycleActions(!presentation.journey)}
        actionLabel={challengeLabel}
        checkinLabel={checkinLabel}
        onCheckin={(status) => void submitActiveChallengeCheckin(status)}
        onNavigate={navigate}
      />;
    }

    if (activeScreen === "S07") {
      return <SignedInTodayReviewPresentation
        journey={presentation.journey}
        firstBloodPressureWindow={firstBloodPressureWindow}
        isPriorDashboard={isPriorDashboard}
        today={today}
        startOn={startOn}
        endOn={endOn}
        todayMeasurement={todayMeasurement}
        todayMorningMeasurement={todayMorningMeasurement}
        todayEveningMeasurement={todayEveningMeasurement}
        activeChallenge={activeChallenge}
        activeChallengeEnded={activeChallengeEnded}
        todayCheckin={todayCheckin}
        challengeEventsCount={windowData?.challenge_events.length ?? 0}
        challengeCheckins={windowData?.challenge_checkins ?? []}
        controlsDisabled={controlsDisabled}
        readNavigationDisabled={readNavigationDisabled}
        dateLabel={dateLabel}
        displayMeasurement={displayMeasurement}
        challengeLabel={challengeLabel}
        checkinLabel={checkinLabel}
        onNavigate={navigate}
        onSubmitActiveChallengeCheckin={(status) => {
          void submitActiveChallengeCheckin(status);
        }}
      />;
    }

    if (activeScreen === "S08") {
      return <Scene id="S08" eyebrow="기록" title={journeyCopy.S08.title} tone="secondary" className={`record-explorer-scene surface${presentation.journey ? " journey-candidate journey-records" : ""}`}>
        {renderWindowNavigation()}
        <RecordExplorer
          items={recordBrowseItems}
          selection={recordExplorer.selection}
          onSelect={recordExplorer.select}
          onOpen={(item, fallbackKey) => { recordExplorer.remember(item.key, fallbackKey); openRecord(item); }}
          returnPoint={recordExplorer.returnPoint}
          onRestored={recordExplorer.restored}
          dateLabel={dateLabel}
          periodLabel={periodLabel}
          challengeLabel={challengeLabel}
          checkinLabel={checkinLabel}
          displayMeasurement={displayMeasurement}
          isReadOnly={item => evidenceMode || isPriorDashboard || item.kind === "legacy" || (item.kind === "challenge-checkin" && (item.record.challenge_id !== activeChallenge?.id || activeChallengeEnded))}
        />
        <div className="scene-toolbar action-group">
          {presentation.journey ? (
            <div className="journey-continuation-actions journey-continuation-actions--compact" aria-label="기록 탐색 다음 행동">
              <button className="text-button" type="button" onClick={() => navigate("S02")} disabled={readNavigationDisabled}>오늘 화면으로 돌아가기</button>
              <button className="secondary" type="button" onClick={() => navigate("S10")} disabled={readNavigationDisabled}>최근 7일 돌아보기</button>
            </div>
          ) : (
            <button className="text-button" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button>
          )}
        </div>
      </Scene>;
    }

    if (activeScreen === "S09") {
      const recordTypeLabel = selectedRecord?.kind === "blood-pressure"
        ? "혈압 관찰"
        : selectedRecord?.kind === "challenge-checkin" ? "챌린지 참여" : "이전 방식의 기록";
      const challengeReadOnly = selectedRecord?.kind === "challenge-checkin"
        && (selectedRecord.record.challenge_id !== activeChallenge?.id || activeChallengeEnded);
      const readOnlyReason = isPriorDashboard
        ? `${dashboardPeriodName}의 기록은 읽기 전용입니다. 현재 7일로 돌아오면 현재 계약에서 수정 가능한 기록만 관리할 수 있어요.`
        : selectedRecord?.kind === "legacy"
          ? "이전 방식으로 남긴 기록은 읽기 전용입니다. 날짜가 현재 7일에 포함되어도 수정하거나 삭제할 수 없어요."
          : challengeReadOnly
            ? activeChallengeEnded
              ? "현재 활성 챌린지에 속하지 않은 기록은 읽기 전용입니다. 기간이 끝난 챌린지의 참여 사실 그대로 확인할 수 있어요."
              : "현재 활성 챌린지에 속하지 않은 기록은 읽기 전용입니다. 참여 사실은 그대로 확인할 수 있어요."
            : null;
      return (
        <Scene id="S09" {...journeyCopy.S09} tone="secondary" className={`journey-record-detail surface${presentation.journey ? " journey-candidate" : ""}`}>
          <button
            className="text-button record-explorer-detail-return"
            type="button"
            onClick={returnFromRecordDetail}
            disabled={readNavigationDisabled}
          >
            {window.history.state?.recordReturnScreen === "S10" ? "7일 돌아보기로 돌아가기" : "목록으로 돌아가기"}
          </button>
          <div className="record-explorer-detail-context section-header">
            {selectedRecord && <p className="record-explorer-detail-selection">
              선택한 기록 · {dateLabel(selectedRecord.record.observed_on)}
              {selectedRecord.kind === "blood-pressure" ? ` · ${periodLabel(selectedRecord.record.period)}` : ""}
            </p>}
            <p className="record-explorer-detail-period">{dashboardPeriodName}{isPriorDashboard ? " · 읽기 전용" : ""} · {dateLabel(startOn)} ~ {dateLabel(endOn)}</p>
          </div>
          {selectedRecordMissing ? (
            <div className="record-detail-empty state-error status-notice" role="alert">
              <h2>현재 불러온 기간에서 선택한 기록을 찾을 수 없어요.</h2>
              <p>기간 변경이나 보관 기간, 새로 불러온 결과에 따라 이 화면에 포함되지 않을 수 있어요. 기록이 삭제됐다고 단정하지 않습니다.</p>
              <button className="secondary" type="button" onClick={returnFromRecordDetail}>현재 맥락으로 돌아가기</button>
            </div>
          ) : selectedRecord ? (
            <article className="record-detail" data-record-detail-kind={selectedRecord.kind}>
              <div className="record-detail-heading section-header">
                <div>
                  <p className="eyebrow">저장된 사실</p>
                  <h2>{recordTypeLabel}</h2>
                </div>
                <span className="record-detail-access" data-record-access={readOnlyReason ? "read-only" : "editable"}>{readOnlyReason ? "읽기 전용" : "수정 가능"}</span>
              </div>
              <dl className="record-detail-facts">
                <div className="record-detail-primary-value">
                  <dt>{selectedRecord.kind === "blood-pressure" ? "저장된 측정값" : "저장된 상태"}</dt>
                  <dd>{selectedRecord.kind === "blood-pressure" ? displayMeasurement(selectedRecord.record) : checkinLabel(selectedRecord.record.status)}</dd>
                </div>
                <div><dt>날짜</dt><dd>{dateLabel(selectedRecord.record.observed_on)}</dd></div>
                {selectedRecord.kind === "blood-pressure"
                  ? <div><dt>저장된 시간대</dt><dd>{periodLabel(selectedRecord.record.period)}</dd></div>
                  : <div><dt>챌린지 행동</dt><dd>{challengeLabel(selectedRecord.record.action_id)}</dd></div>}
              </dl>
              {readOnlyReason ? <div className="record-read-only status-notice" role="note"><strong>이 기록은 읽기 전용이에요.</strong><p>{readOnlyReason}</p></div> : !evidenceMode && editingChallengeCheckin ? (
                <section className="record-correction-panel confirmation status-notice" role="status" aria-labelledby="challenge-correction-title">
                  <div className="section-header">
                    <p className="eyebrow">저장된 상태 수정</p>
                    <h3 id="challenge-correction-title">참여 상태만 바로잡아요</h3>
                    <p>{dateLabel(editingChallengeCheckin.observed_on)} · {challengeLabel(editingChallengeCheckin.action_id)} 상태의 날짜와 행동은 그대로 두고 상태만 바꿉니다.</p>
                  </div>
                  <div className="record-correction-choices action-group" aria-label="챌린지 참여 상태">
                    <button type="button" aria-pressed={editingChallengeCheckin.status === "completed"} onClick={() => void updateOwnedChallengeCheckin("completed")} disabled={controlsDisabled}>기록함</button>
                    <button className="secondary" type="button" aria-pressed={editingChallengeCheckin.status === "skipped"} onClick={() => void updateOwnedChallengeCheckin("skipped")} disabled={controlsDisabled}>건너뜀</button>
                    <button className="text-button" type="button" onClick={() => setEditingChallengeCheckin(null)} disabled={controlsDisabled}>수정 취소</button>
                  </div>
                  <small>이 변경은 챌린지 참여 사실만 수정하며 혈압 기록이나 건강 결과를 바꾸지 않아요.</small>
                </section>
              ) : !evidenceMode && (
                <section className="record-maintenance record-detail-primary-actions action-group" aria-label="기록 관리">
                  <div className="record-maintenance-heading">
                    <div><p className="eyebrow">기록 관리</p><strong>저장된 사실을 바로잡거나 삭제할 수 있어요.</strong></div>
                    <button className="secondary" type="button" aria-label="수정" disabled={controlsDisabled} onClick={() => {
                      if (selectedRecord.kind === "blood-pressure") beginBloodPressureEdit(selectedRecord.record);
                      else if (selectedRecord.kind === "challenge-checkin") setEditingChallengeCheckin(selectedRecord.record);
                    }}>이 기록 수정</button>
                  </div>
                  <div className="record-maintenance-delete">
                    <p>이 한 건을 계정 기록에서 영구히 삭제합니다.</p>
                    <button className="secondary danger record-delete-action" type="button" aria-label="삭제" disabled={controlsDisabled} onClick={() => {
                      setNotice(null);
                      if (selectedRecord.kind === "blood-pressure") setPendingBloodPressureDeletion(selectedRecord.record);
                      else if (selectedRecord.kind === "challenge-checkin") setPendingChallengeCheckinDeletion(selectedRecord.record);
                    }}>이 기록 삭제</button>
                  </div>
                </section>
              )}
              <div className="inline-actions action-group record-detail-utility-actions">
                {!evidenceMode && <button className="text-button" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing" || controlsDisabled}>새로고침</button>}
              </div>
            </article>
          ) : (
            <div className="record-detail-empty status-notice"><h2>선택한 기록이 없어요.</h2></div>
          )}
        </Scene>
      );
    }

    if (activeScreen === "S10") {
      if (presentation.journey) return <Scene id="S10" eyebrow="최근 기록" title="7일 돌아보기" tone="emphasis" className="journey-recap">
        {renderCycleActions()}
        <JourneyRecap key={endOn} staticLandscape={presentation.staticLandscape && !s10SceneOwnsDecoration} companionSpecies={s10CompanionSpecies} companionAsset={activeCompanionAsset} productionSceneEnabled={s10SceneOwnsDecoration} today={today} days={trailDays} year={startOn.slice(0, 4) === endOn.slice(0, 4) ? startOn.slice(0, 4) : `${startOn.slice(0, 4)}–${endOn.slice(0, 4)}`} period={isCycleReview ? "completed-cycle" : isPriorDashboard ? "prior" : "current"} freshness={windowState} selectedDate={recapSelectedDate} onSelectedDateChange={setRecapSelectedDate}
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
              <small>'기록함'·'건너뜀' 모두 체크인이며 혈압 기록이나 누적 성과와 합치지 않아요.</small>
            </> : <h2 id="challenge-progress-title">진행 중인 7일 챌린지 없음</h2>}
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
        <div className="journey-recap-return" aria-label="7일 돌아보기 마무리">
          <button className="text-button" type="button" onClick={() => navigate("S02")} disabled={readNavigationDisabled}>오늘 화면으로 돌아가기</button>
        </div>
      </Scene>;
      return <Scene id="S10" {...journeyCopy.S10} tone="emphasis">{renderCycleActions()}{!evidenceMode && session && <StructuredRecapFeedback session={session} disabled={controlsDisabled} onSessionError={handleStructuredFeedbackSessionError} />}<div className="recap-period">{renderWindowNavigation()}</div><div className="recap-summary" data-main-section="seven-day-dashboard" aria-label="최근 7일 기록 요약"><div data-dashboard-lane="blood-pressure"><span>혈압 관찰</span><strong>{windowData?.blood_pressure_observations.length ?? 0}</strong><small>기록</small></div><div data-dashboard-lane="challenge"><span>최근 7일 챌린지 체크인 기록</span><strong>{windowData?.challenge_checkins.length ?? 0}</strong><small>기록</small></div><div data-dashboard-lane="legacy"><span>이전 방식의 기록</span><strong>{windowData?.challenge_events.length ?? 0}</strong><small>읽기 전용</small></div></div><section className="challenge-progress-card" data-challenge-progress aria-labelledby="challenge-progress-title"><p className="eyebrow">챌린지 진행</p>{activeChallenge && !activeChallengeEnded ? <><h2 id="challenge-progress-title">7일 챌린지 · {challengeLabel(activeChallenge.action_id)}</h2><p>{activeChallenge.starts_on} ~ {activeChallenge.ends_on}</p><strong>체크인 기록 {activeChallengeCheckins.length}개</strong></> : <><h2 id="challenge-progress-title">진행 중인 7일 챌린지 없음</h2><p>최근 7일 기록과는 별도로 표시합니다.</p></>}</section><VisualStage screen="S10" calendarDate={today} companionSpecies={s10CompanionSpecies} companionAsset={activeCompanionAsset} productionS10Enabled={s10SceneOwnsDecoration} /><div className="record-groups recap-record-groups" aria-label="최근 7일 기록 목록">{renderRecordLane("blood-pressure", "혈압 관찰", "아직 혈압 관찰 기록이 없습니다.")}{renderRecordLane("challenge-checkin", "챌린지 참여", "아직 챌린지 참여 기록이 없습니다.")}{renderRecordLane("legacy", "이전 방식의 기록", "이전 방식의 기록이 없습니다.")}</div><div className="scene-actions utility-actions">{renderReportAction()}{!evidenceMode && <button type="button" onClick={() => void exportRecentRecords()} disabled={controlsDisabled}>{pendingAction === "export" ? "내보내는 중" : `${dashboardPeriodName} 내보내기`}</button>}<button className="secondary" type="button" onClick={() => void refreshWindow()} disabled={windowState === "refreshing" || controlsDisabled}>{windowState === "refreshing" ? "새로고침 중" : "새로고침"}</button></div></Scene>;
    }

    if (activeScreen === "S11") {
      if (evidenceMode || !session) {
        return <Scene id="S11" {...journeyCopy.S11} tone="secondary" className="signal-scene"><div className="signal-orbit" aria-hidden="true"><span /><span /><i /></div><div className="signal-card" data-model-v2-synthetic-result data-model-v2-result-state={syntheticModelV2ResultState} role="status" aria-live="polite"><span className="status-pill">{syntheticModelV2ResultView.status}</span><h2>{syntheticModelV2ResultView.heading}</h2><p>{syntheticModelV2ResultView.body}</p></div><p className="signal-disclaimer">{syntheticModelV2ResultView.disclaimer}</p></Scene>;
      }
      const modelV2Guard = createModelV2SessionGuard(() => ({
        userId: sessionIdentityRef.current.userId,
        generation: sessionIdentityRef.current.generation,
      }));
      return (
        <ModelV2InputFlow
          key={sessionIdentityRef.current.generation}
          guard={modelV2Guard}
          bloodPressureStatus={modelV2Continuation.key === "confirm-today" ? "오늘 혈압 상태 · 최신 여부 미확인" : todayBloodPressureStatus}
          bloodPressureSupport={modelV2Continuation.key === "confirm-today" ? "오늘 화면에서 최신 기록을 확인해요." : todayBloodPressureSupport}
          continuation={modelV2Continuation}
          challengeStatus={modelV2Continuation.key === "confirm-today" ? "오늘 챌린지 상태 · 최신 여부 미확인" : modelV2ChallengeStatus}
          challengeSupport={modelV2Continuation.key === "confirm-today" ? "오늘 화면에서 최신 챌린지 상태를 확인해요." : modelV2ChallengeSupport}
          onContinue={() => navigate(modelV2Continuation.destination)}
          onReturnToToday={() => navigate("S02")}
        />
      );
    }

      if (presentation.journey) return (
        <Scene id="S14" {...journeyCopy.S14} body="내 기록이 어디에 있고, 떠날 때 무엇이 달라지는지 한눈에 확인해요." tone="base" className="journey-settings surface">
          <section className="lifecycle-boundary-map" aria-labelledby="lifecycle-boundary-title">
            <div className="lifecycle-boundary-heading">
              <p className="eyebrow">데이터 경계</p>
              <h2 id="lifecycle-boundary-title">내 데이터가 머무는 곳</h2>
              <p>계정 기록, 이 브라우저 설정, 이번 방문의 입력·결과, 내 기기 파일은 각각 따로 관리돼요.</p>
            </div>
            <div className="lifecycle-boundary-grid">
              <article data-boundary="account"><strong data-scope-label="account">{dataScopeLabel("account")}</strong><span>기록 · 계정 My Space</span></article>
              <article data-boundary="browser"><strong data-scope-label="browser">{dataScopeLabel("browser")}</strong><span>테마 · 시작 화면 · 동반자 · 브라우저 My Space</span></article>
              <article data-boundary="transient"><strong data-scope-label="visit">{dataScopeLabel("visit")}</strong><span>Model V2 입력 · 결과 · 이탈·새로고침 시 사라짐</span></article>
              <article data-boundary="device"><strong data-scope-label="device-file">{dataScopeLabel("deviceFile")}</strong><span>JSON · PDF · 인쇄물</span></article>
            </div>
          </section>
          <div className="journey-settings-list">
            <section className="journey-settings-group" aria-labelledby="settings-records-title">
              <div className="journey-settings-group-heading"><p className="journey-settings-scope" data-scope-label="account">{dataScopeLabel("account")}</p><h2 id="settings-records-title">계정에 저장되는 것</h2></div>
              <div className="journey-settings-group-content">
                <section className="journey-settings-section journey-settings-data-row">
                  <div className="section-header"><h3>혈압 관찰 · 챌린지 기록</h3><p>각 기록은 저장한 시점부터 30일 후 접근할 수 없게 돼요. 7일 돌아보기의 화면 구간과는 다른 기준이에요.</p></div>
                  <button className="secondary" type="button" onClick={() => navigate("S10")} disabled={settingsControlsDisabled}>7일 기록 보기</button>
                </section>
                <section className="journey-settings-section journey-settings-data-row">
                  <div className="section-header"><h3>계정 My Space</h3><p>꾸미기 상태는 기록의 30일 보관 대상이 아니며, 이메일 로그인 계정이 유지되는 동안 남아요.</p></div>
                </section>
              </div>
            </section>
            <section className="journey-settings-group" aria-labelledby="settings-copies-title">
              <div className="journey-settings-group-heading"><p className="journey-settings-scope" data-scope-label="device-file">{dataScopeLabel("deviceFile")}</p><h2 id="settings-copies-title">내 기기의 사본</h2></div>
              <div className="journey-settings-group-content">
                <section className="journey-settings-section journey-settings-data-row lifecycle-export-row">
                  <div className="section-header"><h3>최근 30일 JSON</h3><p><time dateTime={shiftDate(today, -29)}>{shiftDate(today, -29)}</time>–<time dateTime={today}>{today}</time>의 30개 달력 날짜에서 현재 접근 가능한 혈압 관찰 기록만 포함해요.</p><p className="journey-settings-note">전체 계정 백업이 아니며, 삭제·만료된 기록은 복구하지 않아요. 날짜 범위와 기록별 30일 보관 기간은 별개예요.</p></div>
                  <button type="button" onClick={() => void exportRecentThirtyDayRecords()} disabled={settingsControlsDisabled} aria-busy={pendingAction === "export"}>{pendingAction === "export" ? "내보내는 중" : "최근 30일 JSON 내려받기"}</button>
                </section>
                <section className="journey-settings-section journey-settings-data-row">
                  <div className="section-header"><h3>7일 리포트 / PDF</h3><p>현재·이전·종료된 7일 리포트를 7일 돌아보기에서 확인하고 PDF로 저장할 수 있어요.</p></div>
                  <button className="secondary" type="button" onClick={() => navigate("S10")} disabled={settingsControlsDisabled}>7일 리포트 / PDF 보기</button>
                </section>
                <p className="lifecycle-copy-note">내려받은 JSON, 저장한 PDF, 인쇄물은 내 기기에서 직접 관리해요. 로그아웃이나 계정 삭제로 자동 삭제되지 않아요.</p>
              </div>
            </section>
            <section className="journey-settings-group" aria-labelledby="settings-personal-title">
              <div className="journey-settings-group-heading"><h2 id="settings-personal-title">이 브라우저의 개인화</h2><p className="journey-settings-scope" data-scope-label="browser">{dataScopeLabel("browser")}</p></div>
              <div className="journey-settings-group-content">
                <section className="journey-settings-section journey-settings-display">
                  <div className="section-header"><h3>화면 테마</h3></div>
                  <fieldset className="theme-preset-control">
                    <legend>화면 테마</legend>
                    {themePreferenceOptions.map((option) => <label key={option.value}>
                      <input type="radio" name="sk7-theme-preset" value={option.value} checked={themePreference === option.value}
                        onChange={(event) => {
                          const theme = writeThemePreference(event.target.value);
                          applyThemePreference(theme);
                          setThemePreference(theme);
                        }} />
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    </label>)}
                  </fieldset>
                </section>
                {!evidenceMode && <StartingHomeControl key={browserPersonalizationVersion} headingLevel={3} compact />}
                {companionMode !== "off" && <section className="journey-settings-section companion-identity-settings">
                  <div className="section-header"><h3>내 동반자</h3></div>
                  <label className="companion-identity-control" htmlFor="companion-species"><span>캐릭터 선택</span><select id="companion-species" value={companionSpeciesPreference} onChange={(event) => {
                    const species = event.target.value as CompanionSpecies;
                    setCompanionSpeciesPreference(writeCompanionIdentity(species));
                  }}>{companionIdentityOptions.map((option) => <option key={option.species} value={option.species}>{option.label}</option>)}</select></label>
                </section>}
                {!evidenceMode && <section className="journey-settings-section journey-settings-browser-reset">
                  <div className="section-header"><h3>개인화 초기화</h3><p>테마·시작 화면·동반자·브라우저 My Space를 기본값으로 되돌려요. 계정과 서버 기록은 변경하지 않아요.</p></div>
                  <button className="secondary" type="button" onClick={openBrowserPersonalizationReset} disabled={settingsControlsDisabled}>초기화 범위 확인</button>
                </section>}
              </div>
            </section>
            {!evidenceMode && <section className="journey-settings-group journey-settings-signout" aria-labelledby="settings-signout-title">
              <div className="journey-settings-group-heading"><h2 id="settings-signout-title">이 기기에서 로그아웃</h2></div>
              <div className="journey-settings-group-content"><div className="journey-settings-account-row"><div className="section-header"><p className="journey-settings-primary-fact">로그아웃해도 계정과 서버 기록은 삭제되지 않아요.</p><p>공용 기기라면 사용을 마친 뒤 로그아웃해 주세요.</p></div><button className="secondary" type="button" onClick={() => void handleSignOut()} disabled={signOutPending || accountDeletionPending} aria-busy={signOutPending}>{signOutPending ? "로그아웃 중" : "이 기기에서 로그아웃"}</button></div></div>
            </section>}
            <section className="journey-settings-group journey-settings-account" aria-labelledby="settings-account-title">
              <div className="journey-settings-group-heading"><p className="eyebrow">되돌릴 수 없는 작업</p><p className="journey-settings-scope" data-scope-label="account">{dataScopeLabel("account")}</p><h2 id="settings-account-title">계정 삭제</h2></div>
              <div className="journey-settings-group-content journey-settings-account-actions"><div className="journey-settings-account-row journey-settings-account-danger"><div className="journey-settings-deletion-facts"><p><strong>삭제됨</strong><span><span data-scope-label="account">{dataScopeLabel("account")}</span> · Auth 사용자 · 계정 소유 제품 기록 · 계정 My Space 꾸미기 상태</span></p><p><strong>자동 삭제되지 않음</strong><span><span data-scope-label="browser">{dataScopeLabel("browser")}</span> · 개인화 · <span data-scope-label="device-file">{dataScopeLabel("deviceFile")}</span></span></p></div><button className="danger" type="button" onClick={() => { setAccountDeletionRecovery(null); setAccountDeletionOpen(true); }} disabled={settingsControlsDisabled}>계정 삭제</button></div></div>
            </section>
          </div>
        </Scene>
      );
      return <Scene id="S14" {...journeyCopy.S14} tone="base" className="surface"><div className="settings-list"><section><div className="section-header"><p className="eyebrow">데이터 경계</p><h2>{dataScopeLabel("account")} · {dataScopeLabel("browser")} · {dataScopeLabel("visit")} · {dataScopeLabel("deviceFile")}</h2><p>계정 기록과 계정 My Space는 계정에, 화면 개인화는 이 브라우저에만 저장돼요. Model V2 입력과 결과는 이번 방문에만 쓰고, JSON·PDF·인쇄물은 내 기기 파일로 직접 관리해요.</p></div></section><section><div className="section-header"><p className="eyebrow">내 기록</p><h2>계정에 저장되는 것</h2><p>혈압 관찰과 챌린지 기록은 저장 시점부터 30일, 계정 My Space는 별도 계정 수명 주기를 따라요.</p></div><button className="secondary" type="button" onClick={() => navigate("S10")}>7일 기록 보기</button></section><section><div className="section-header"><p className="eyebrow" data-scope-label="device-file">{dataScopeLabel("deviceFile")}</p><h2>최근 30일 날짜 범위 JSON</h2><p>{shiftDate(today, -29)}부터 {today}까지 현재 접근 가능한 기록 사본이며 전체 계정 백업이 아니에요.</p></div><button type="button" onClick={() => void exportRecentThirtyDayRecords()} disabled={settingsControlsDisabled}>{pendingAction === "export" ? "내보내는 중" : "최근 30일 날짜 범위 JSON 내려받기"}</button></section>{!evidenceMode && <StartingHomeControl key={browserPersonalizationVersion} />}<section><div className="section-header"><p className="eyebrow" data-scope-label="browser">{dataScopeLabel("browser")}</p><h2>브라우저에만 저장</h2><p>테마, 시작 화면, 동반자, browser-only My Space는 계정과 자동 병합되지 않아요.</p></div><button className="secondary" type="button" onClick={openBrowserPersonalizationReset}>개인화 초기화</button></section>{!evidenceMode && <section><div className="section-header"><p className="eyebrow">이 기기에서 로그아웃</p><h2>현재 계정 연결 끝내기</h2><p>계정, 서버 기록, 브라우저 개인화, 내려받은 파일은 삭제하지 않아요.</p></div><button className="secondary" type="button" onClick={() => void handleSignOut()} disabled={signOutPending || accountDeletionPending}>{signOutPending ? "로그아웃 중" : "이 기기에서 로그아웃"}</button></section>}<section><div className="section-header"><p className="eyebrow" data-scope-label="account">{dataScopeLabel("account")}</p><h2>삭제 범위 확인</h2><p>계정과 계정 소유 서버 데이터는 삭제되지만 이 브라우저 개인화와 내 기기 파일은 남을 수 있어요.</p></div><button className="danger" type="button" onClick={() => { setAccountDeletionRecovery(null); setAccountDeletionOpen(true); }} disabled={settingsControlsDisabled}>계정 삭제</button></section></div></Scene>;
  }

  const visibleNotice = activeScreen === "S04" && !editingBloodPressureId ? newBloodPressureRecovery ?? notice : notice;

  return (
    <>
    <div data-living-week-app hidden={reportVisible}>
    {!mySpaceEntry && requestedScreen === "S02" && !readNavigationDisabled && !accountDeletionOpen
      && !pendingBloodPressureDeletion && !pendingChallengeCheckinDeletion && !notice?.reload && <MySpaceReturn />}
    <SceneShell
      staticJourneyUi={presentation.staticLandscape}
      journeyPresentation={presentation.journey}
      feedbackPhase={blockingLoading ? "loading" : activeScreen === "S13" ? "error" : "content"}
      feedbackSuspended={reportVisible || accountDeletionOpen || browserResetOpen || Boolean(pendingBloodPressureDeletion) || Boolean(pendingChallengeCheckinDeletion)}
      sessionGeneration={sessionIdentityRef.current.generation}
      activeScreen={activeScreen}
      evidenceLabel={fixture?.name}
      onNavigate={navigate}
      navigationDisabled={readNavigationDisabled}
      companionSelection={companionSelection}
      companionSpecies={companionSpeciesPreference}
      companionAsset={activeCompanionAsset}
      savedSceneEvent={confirmedSave ? savedScene.event : null}
    >
      {visibleNotice && !pendingBloodPressureDeletion && !pendingChallengeCheckinDeletion && (visibleNotice.recovery ? <RecoveryPanel
        {...visibleNotice.recovery}
        tone={visibleNotice.kind === "error" ? "critical" : "warning"}
        focusOnMount
        actions={postMutationRead?.kind === "blood-pressure-edit" || postMutationRead?.kind === "challenge-edit"
          ? <button type="button" onClick={() => void finishPostMutationRead()} disabled={pendingAction !== null}>{pendingAction ? "확인 중" : "다시 불러와 확인"}</button>
          : visibleNotice.recovery.kind === "export-failure" ? <button type="button" onClick={() => void retryExport()} disabled={pendingAction === "export"}>{pendingAction === "export" ? "내보내는 중" : "내보내기 다시 시도"}</button> : visibleNotice.reload ? <>
          <button type="button" onClick={() => void refreshWindow()} disabled={windowState === "loading" || windowState === "refreshing"}>다시 불러오기</button>
          <button className="secondary" type="button" onClick={() => void refreshThenOpenRecords()} disabled={windowState === "loading" || windowState === "refreshing"}>기록에서 확인하기</button>
        </> : undefined}
      /> : <div className={`notice notice-${visibleNotice.kind}`} role="status"><span>{visibleNotice.message}</span></div>)}
      {windowState === "refresh-error" && !visibleNotice?.recovery && requiresObservationWindow(activeScreen) && <RecoveryPanel
        kind="stale-read"
        title="최신 여부 미확인"
        known="마지막으로 불러온 기록을 보여드리고 있어요. 이 내용은 마지막으로 확인된 기록 그대로예요."
        unknown="현재 최신 여부는 확인되지 않았어요. 최근 변경이 반영되지 않았을 수 있어요."
        next="기록을 다시 불러오면 최신 상태를 확인할 수 있어요."
        focusOnMount
        actions={<button type="button" onClick={() => void refreshWindow()}>다시 불러오기</button>}
      />}
      {isPriorDashboard && activeScreen !== "S12" && requiresObservationWindow(activeScreen) && <div className="notice notice-warning" data-read-only-window><span>{dashboardPeriodName} 기록을 읽기 전용으로 보고 있어요.</span><button className="notice-action" type="button" onClick={() => navigate("S02")}>현재 7일 보기</button></div>}
      {pendingBloodPressureDeletion && <DeleteConfirmation
        title="이 혈압 기록을 삭제할까요?"
        facts={[
          { label: "기록 종류", value: "혈압 관찰" },
          { label: "날짜", value: dateLabel(pendingBloodPressureDeletion.observed_on) },
          { label: "시간대", value: periodLabel(pendingBloodPressureDeletion.period) },
          { label: "저장된 측정값", value: displayMeasurement(pendingBloodPressureDeletion) },
        ]}
        pending={pendingAction !== null}
        recovery={postMutationRead?.kind === "blood-pressure-delete" ? notice?.recovery : notice?.recovery?.kind === "uncertain-delete" ? notice.recovery : undefined}
        onCancel={() => setPendingBloodPressureDeletion(null)}
        onConfirm={() => void confirmBloodPressureDeletion()}
        onRecover={postMutationRead?.kind === "blood-pressure-delete" ? () => void finishPostMutationRead() : () => { setPendingBloodPressureDeletion(null); void refreshWindow(); }}
        onOpenRecords={postMutationRead?.kind === "blood-pressure-delete" ? undefined : () => { setPendingBloodPressureDeletion(null); void refreshThenOpenRecords(); }}
      />}
      {pendingChallengeCheckinDeletion && <DeleteConfirmation
        title="이 챌린지 기록을 삭제할까요?"
        facts={[
          { label: "기록 종류", value: "챌린지 참여" },
          { label: "날짜", value: dateLabel(pendingChallengeCheckinDeletion.observed_on) },
          { label: "행동", value: challengeLabel(pendingChallengeCheckinDeletion.action_id) },
          { label: "저장된 상태", value: checkinLabel(pendingChallengeCheckinDeletion.status) },
        ]}
        pending={pendingAction !== null}
        recovery={postMutationRead?.kind === "challenge-delete" ? notice?.recovery : notice?.recovery?.kind === "uncertain-delete" ? notice.recovery : undefined}
        onCancel={() => setPendingChallengeCheckinDeletion(null)}
        onConfirm={() => void confirmChallengeCheckinDeletion()}
        onRecover={postMutationRead?.kind === "challenge-delete" ? () => void finishPostMutationRead() : () => { setPendingChallengeCheckinDeletion(null); void refreshWindow(); }}
        onOpenRecords={postMutationRead?.kind === "challenge-delete" ? undefined : () => { setPendingChallengeCheckinDeletion(null); void refreshThenOpenRecords(); }}
      />}
      {accountDeletionOpen && <AccountDeletionConfirmation pending={accountDeletionPending} recovery={accountDeletionRecovery} onCancel={() => { if (!accountDeletionPending) { setAccountDeletionOpen(false); setAccountDeletionRecovery(null); } }} onConfirm={() => void confirmAccountDeletion()} />}
      {browserResetOpen && <BrowserPersonalizationResetConfirmation error={browserResetError} onCancel={() => { setBrowserResetOpen(false); setBrowserResetError(null); }} onConfirm={confirmBrowserPersonalizationReset} />}
      {renderScene()}
    </SceneShell>
    </div>
    {reportVisible && reportCreatedAt && windowData && ready && <LivingWeekReport
      days={trailDays}
      observations={windowData.blood_pressure_observations.map(record => ({
        date: record.observed_on, period: record.period, systolic: record.systolic, diastolic: record.diastolic,
      }))}
      checkins={windowData.challenge_checkins.map(record => ({
        date: record.observed_on, actionLabel: challengeLabel(record.action_id), statusLabel: checkinLabel(record.status),
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
