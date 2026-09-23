import type { FormEvent } from "react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { DeleteConfirmation } from "./components/DeleteConfirmation";
import { JourneyRecap } from "./components/JourneyRecap";
import { JourneyToday } from "./components/JourneyToday";
import { LivingWeekReport } from "./components/LivingWeekReport";
import { RecordExplorer } from "./components/RecordExplorer";
import { Scene, SceneShell } from "./components/SceneShell";
import {
  emptyBloodPressureDraft,
  useNewBloodPressureDraft,
  type BloodPressureDraft,
} from "./components/useNewBloodPressureDraft";
import { useRecordExplorerMemory } from "./components/useRecordExplorerMemory";
import {
  createGuestJourneyState,
  guestJourneyReducer,
  projectGuestObservationWindow,
} from "./guest/guestStore";
import type {
  BloodPressureObservation,
  BloodPressureObservationInput,
  ChallengeCheckin,
} from "./lib/api-contract";
import { shiftDate } from "./lib/seoulDate";
import { useSeoulDate } from "./lib/useSeoulDate";
import {
  companionIdentityOptions,
  readCompanionIdentity,
  writeCompanionIdentity,
} from "./ui/companionIdentity";
import {
  resolveConfirmedSaveCompanion,
  resolveCompanionMode,
  type CompanionSpecies,
} from "./ui/companion";
import { journeyCopy, type ScreenId } from "./ui/journey";
import { sevenDayFacts } from "./ui/livingWeek";
import type { ExplorerSelection, RecordBrowseItem } from "./ui/recordExplorer";
import { resolveSceneGate } from "./ui/scenePolicy";
import {
  applyThemePreference,
  readThemePreference,
  themePreferenceOptions,
  writeThemePreference,
} from "./ui/themePreference";
import "./components/guest-journey.css";

const challengeActions = [
  { id: "walk-10-minutes", label: "10분 걷기", note: "가볍게 바깥 공기를 만나는 시간" },
  { id: "sleep-routine", label: "수면 시간 지키기", note: "정한 시간에 하루를 천천히 닫기" },
  { id: "low-sodium-meal", label: "덜 짜게 먹기", note: "한 끼의 선택을 담백하게 기록하기" },
] as const;

const guestScreenIds = [
  "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "S12", "S14",
] as const satisfies readonly ScreenId[];

const measurementControlStyle = { fontSize: "max(1rem, 16px)" };

type DashboardWindow = "current" | "prior";
type GuestConfirmation = Readonly<{
  kind: "blood-pressure" | "challenge-checkin";
  observedOn: string;
}>;
type BloodPressureError = Readonly<{
  field: "observed-on" | "systolic" | "diastolic";
  message: string;
}> | null;

function parseGuestScreen(value: string | null): ScreenId {
  return guestScreenIds.includes(value as (typeof guestScreenIds)[number])
    ? value as ScreenId
    : "S02";
}

function parseDashboardWindow(value: string | null): DashboardWindow {
  return value === "prior" ? "prior" : "current";
}

function dashboardBounds(today: string, window: DashboardWindow) {
  return window === "prior"
    ? { startOn: shiftDate(today, -13), endOn: shiftDate(today, -7) }
    : { startOn: shiftDate(today, -6), endOn: today };
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00+09:00`));
}

function periodLabel(period: BloodPressureObservation["period"]): string {
  return period === "morning" ? "아침" : "저녁";
}

function challengeLabel(actionId: string): string {
  return challengeActions.find((action) => action.id === actionId)?.label ?? "선택한 행동";
}

function checkinLabel(status: ChallengeCheckin["status"]): string {
  return status === "completed" ? "기록함" : "건너뜀";
}

function GuestJourney({ today }: { today: string }) {
  const initialSearch = useMemo(() => new URLSearchParams(window.location.search), []);
  const [store, dispatch] = useReducer(guestJourneyReducer, today, createGuestJourneyState);
  const [requestedScreen, setRequestedScreen] = useState<ScreenId>(() =>
    parseGuestScreen(initialSearch.get("screen")),
  );
  const [dashboardWindow, setDashboardWindow] = useState<DashboardWindow>(() =>
    parseDashboardWindow(initialSearch.get("dashboard_window")),
  );
  const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(() =>
    initialSearch.get("record"),
  );
  const [confirmation, setConfirmation] = useState<GuestConfirmation | null>(null);
  const [editingBloodPressureId, setEditingBloodPressureId] = useState<string | null>(null);
  const [bloodPressureEditDraft, setBloodPressureEditDraft] = useState<BloodPressureDraft>(() =>
    emptyBloodPressureDraft(today),
  );
  const [bloodPressureError, setBloodPressureError] = useState<BloodPressureError>(null);
  const [pendingBloodPressureDeletion, setPendingBloodPressureDeletion] = useState<BloodPressureObservation | null>(null);
  const [editingChallengeCheckin, setEditingChallengeCheckin] = useState<ChallengeCheckin | null>(null);
  const [pendingChallengeCheckinDeletion, setPendingChallengeCheckinDeletion] = useState<ChallengeCheckin | null>(null);
  const [reportCreatedAt, setReportCreatedAt] = useState<Date | null>(null);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
  const observedOnRef = useRef<HTMLInputElement>(null);
  const systolicRef = useRef<HTMLInputElement>(null);
  const diastolicRef = useRef<HTMLInputElement>(null);
  const editOriginKey = useRef<string | null>(null);
  const newBloodPressure = useNewBloodPressureDraft(0, today, requestedScreen === "S04" && !editingBloodPressureId);
  const bloodPressureDraft = editingBloodPressureId ? bloodPressureEditDraft : newBloodPressure.draft;
  const setBloodPressureDraft = editingBloodPressureId
    ? setBloodPressureEditDraft
    : newBloodPressure.setDraft;
  const [companionSpecies, setCompanionSpecies] = useState<CompanionSpecies>(() =>
    readCompanionIdentity(),
  );
  const [themePreference, setThemePreference] = useState(() => readThemePreference());
  const companionMode = useMemo(
    () => resolveCompanionMode(import.meta.env.VITE_SK7_COMPANION_MODE),
    [],
  );

  const { startOn, endOn } = useMemo(
    () => dashboardBounds(today, dashboardWindow),
    [dashboardWindow, today],
  );
  const windowData = useMemo(
    () => projectGuestObservationWindow(store, startOn, endOn),
    [endOn, startOn, store],
  );
  const isPriorDashboard = dashboardWindow === "prior";
  const activeChallenge = store.activeChallenge;
  const activeChallengeEnded = Boolean(activeChallenge && today > activeChallenge.ends_on);
  const todayCheckin = store.challengeCheckins.find(
    (checkin) => checkin.challenge_id === activeChallenge?.id && checkin.observed_on === today,
  );
  const todayMeasurements = store.bloodPressureObservations.filter(
    (record) => record.observed_on === today,
  );
  const todayMorningMeasurement = todayMeasurements.find((record) => record.period === "morning");
  const todayEveningMeasurement = todayMeasurements.find((record) => record.period === "evening");
  const todayMeasurement = todayMeasurements[0];
  const confirmedWindowEmpty = windowData.blood_pressure_observations.length === 0
    && windowData.challenge_checkins.length === 0
    && windowData.challenge_events.length === 0
    && !windowData.active_challenge;
  const activeScreen: ScreenId = requestedScreen === "S05" && !confirmation
    ? "S02"
    : requestedScreen === "S06" && !activeChallenge
      ? "S03"
      : requestedScreen === "S12" && !confirmedWindowEmpty
        ? "S02"
        : requestedScreen;
  const trailDays = sevenDayFacts(
    endOn,
    windowData.blood_pressure_observations,
    windowData.challenge_checkins,
  );
  const sceneGate = resolveSceneGate(import.meta.env.VITE_SK7_SCENE_MODE);
  const s02SceneOwnsDecoration = activeScreen === "S02"
    && (sceneGate === "review" || sceneGate === "production");
  const s10SceneOwnsDecoration = activeScreen === "S10"
    && (sceneGate === "review" || sceneGate === "production");
  const sceneCompanionSpecies = companionMode === "off" ? null : companionSpecies;
  const guestCompanionSelection = companionMode !== "off" && activeScreen === "S05" && confirmation
    ? resolveConfirmedSaveCompanion(companionSpecies)
    : null;
  const dashboardPeriodName = isPriorDashboard ? "이전 7일" : "현재 7일";
  const displayMeasurement = (record: BloodPressureObservation) =>
    `${record.systolic}/${record.diastolic} mmHg`;

  const recordBrowseItems: RecordBrowseItem[] = useMemo(() => [
    ...windowData.blood_pressure_observations.map((record) => ({
      key: `blood-pressure:${record.id}`,
      kind: "blood-pressure" as const,
      record,
    })),
    ...windowData.challenge_checkins.map((record) => ({
      key: `challenge-checkin:${record.id}`,
      kind: "challenge-checkin" as const,
      record,
    })),
    ...windowData.challenge_events.map((record) => ({
      key: `legacy:${record.id}`,
      kind: "legacy" as const,
      record,
    })),
  ].sort((left, right) => right.record.observed_on.localeCompare(left.record.observed_on)), [windowData]);
  const selectedRecord = selectedRecordKey
    ? recordBrowseItems.find((record) => record.key === selectedRecordKey) ?? null
    : null;
  const recordExplorer = useRecordExplorerMemory(
    `guest:${startOn}:${endOn}`,
    activeScreen,
  );

  useEffect(() => {
    const onPopState = () => {
      const search = new URLSearchParams(window.location.search);
      setRequestedScreen(parseGuestScreen(search.get("screen")));
      setDashboardWindow(parseDashboardWindow(search.get("dashboard_window")));
      setSelectedRecordKey(search.get("record"));
      setPendingBloodPressureDeletion(null);
      setPendingChallengeCheckinDeletion(null);
      setEditingChallengeCheckin(null);
      setReportCreatedAt(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    setReportCreatedAt(null);
  }, [activeScreen, dashboardWindow, today]);

  function routeUrl(
    screen: ScreenId,
    recordKey: string | null,
    dashboard: DashboardWindow,
  ) {
    const url = new URL(windowLocationPath(), window.location.origin);
    url.searchParams.set("guest", "1");
    if (screen !== "S02") url.searchParams.set("screen", screen);
    if (recordKey) url.searchParams.set("record", recordKey);
    if (dashboard === "prior") url.searchParams.set("dashboard_window", "prior");
    return url;
  }

  function windowLocationPath() {
    return window.location.pathname;
  }

  function navigate(screen: ScreenId, recordKey: string | null = null, replace = false) {
    if (!guestScreenIds.includes(screen as (typeof guestScreenIds)[number])) screen = "S02";
    const returnsToCurrent = isPriorDashboard && ["S02", "S03", "S04", "S06", "S07"].includes(screen);
    const nextWindow = returnsToCurrent ? "current" : dashboardWindow;
    const url = routeUrl(screen, recordKey, nextWindow);
    window.history[replace ? "replaceState" : "pushState"](
      { ...(window.history.state ?? {}), guestJourney: true },
      "",
      url,
    );
    if (screen !== "S05") setConfirmation(null);
    if (returnsToCurrent) setDashboardWindow("current");
    setRequestedScreen(screen);
    setSelectedRecordKey(recordKey);
    setPendingBloodPressureDeletion(null);
    setPendingChallengeCheckinDeletion(null);
    setEditingChallengeCheckin(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function selectDashboardWindow(nextWindow: DashboardWindow) {
    if (nextWindow === dashboardWindow) return;
    const url = routeUrl(activeScreen, null, nextWindow);
    window.history.pushState(
      { ...(window.history.state ?? {}), guestJourney: true },
      "",
      url,
    );
    setDashboardWindow(nextWindow);
    setSelectedRecordKey(null);
    setReportCreatedAt(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function endGuestJourney() {
    window.location.assign(window.location.pathname);
  }

  function validateBloodPressure(): BloodPressureObservationInput | null {
    const systolic = Number(bloodPressureDraft.systolic);
    const diastolic = Number(bloodPressureDraft.diastolic);
    setBloodPressureError(null);
    if (!bloodPressureDraft.observedOn) {
      setBloodPressureError({ field: "observed-on", message: "날짜를 선택해 주세요." });
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
    const conflict = store.bloodPressureObservations.some((record) =>
      record.id !== editingBloodPressureId
      && record.observed_on === bloodPressureDraft.observedOn
      && record.period === bloodPressureDraft.period,
    );
    if (conflict) {
      setBloodPressureError({
        field: "observed-on",
        message: "같은 날짜와 시간대의 체험 기록이 이미 있어요.",
      });
      observedOnRef.current?.focus();
      return null;
    }
    return {
      observed_on: bloodPressureDraft.observedOn,
      period: bloodPressureDraft.period,
      systolic,
      diastolic,
    };
  }

  function submitBloodPressure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPriorDashboard) return;
    const input = validateBloodPressure();
    if (!input) return;
    if (editingBloodPressureId) {
      const recordKey = `blood-pressure:${editingBloodPressureId}`;
      dispatch({ type: "blood-pressure/update", id: editingBloodPressureId, input });
      setEditingBloodPressureId(null);
      setBloodPressureEditDraft(emptyBloodPressureDraft(today));
      setBloodPressureError(null);
      editOriginKey.current = null;
      navigate("S09", recordKey, true);
      return;
    }
    dispatch({ type: "blood-pressure/create", input });
    newBloodPressure.reset(today);
    setConfirmation({ kind: "blood-pressure", observedOn: input.observed_on });
    const url = routeUrl("S05", null, "current");
    window.history.pushState({ ...(window.history.state ?? {}), guestJourney: true }, "", url);
    setRequestedScreen("S05");
    setSelectedRecordKey(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function beginBloodPressureEdit(record: BloodPressureObservation) {
    editOriginKey.current = selectedRecordKey;
    setEditingBloodPressureId(record.id);
    setBloodPressureEditDraft({
      observedOn: record.observed_on,
      period: record.period,
      systolic: String(record.systolic),
      diastolic: String(record.diastolic),
    });
    setBloodPressureError(null);
    navigate("S04");
  }

  function cancelBloodPressureEdit() {
    const originKey = editOriginKey.current;
    setEditingBloodPressureId(null);
    setBloodPressureEditDraft(emptyBloodPressureDraft(today));
    setBloodPressureError(null);
    editOriginKey.current = null;
    navigate(originKey ? "S09" : "S08", originKey, true);
  }

  function confirmBloodPressureDeletion() {
    if (!pendingBloodPressureDeletion || isPriorDashboard) return;
    dispatch({ type: "blood-pressure/delete", id: pendingBloodPressureDeletion.id });
    setPendingBloodPressureDeletion(null);
    navigate("S08", null, true);
  }

  function selectChallenge(actionId: string) {
    if (isPriorDashboard || activeChallenge?.first_checkin_on) return;
    dispatch({ type: "challenge/select", actionId, today });
    navigate("S06");
  }

  function createChallengeCheckin(status: ChallengeCheckin["status"]) {
    if (isPriorDashboard || !activeChallenge || activeChallengeEnded) return;
    dispatch({ type: "challenge-checkin/create", observedOn: today, status });
  }

  function updateChallengeCheckin(status: ChallengeCheckin["status"]) {
    if (!editingChallengeCheckin || isPriorDashboard) return;
    dispatch({ type: "challenge-checkin/update", id: editingChallengeCheckin.id, status });
    setEditingChallengeCheckin(null);
  }

  function confirmChallengeCheckinDeletion() {
    if (!pendingChallengeCheckinDeletion || isPriorDashboard) return;
    dispatch({ type: "challenge-checkin/delete", id: pendingChallengeCheckinDeletion.id });
    setPendingChallengeCheckinDeletion(null);
    navigate("S08", null, true);
  }

  function openRecord(item: RecordBrowseItem, returnScreen: "S08" | "S10" = "S08") {
    recordExplorer.remember(item.key);
    navigate("S09", item.key);
    window.history.replaceState(
      { ...(window.history.state ?? {}), recordReturnScreen: returnScreen, guestJourney: true },
      "",
      window.location.href,
    );
  }

  function returnFromRecordDetail() {
    navigate(window.history.state?.recordReturnScreen === "S10" ? "S10" : "S08");
  }

  function renderWindowNavigation() {
    return <nav className="window-nav" data-dashboard-window={dashboardWindow} aria-label="7일 기록 구간">
      <button className="secondary" type="button" onClick={() => selectDashboardWindow("prior")} disabled={isPriorDashboard}>이전 7일 보기</button>
      <p>
        <span>{dashboardPeriodName} · {isPriorDashboard ? "읽기 전용" : "오늘 포함"}</span>
        <strong>{dateLabel(startOn)} ~ {dateLabel(endOn)}</strong>
        <small>챌린지 진행률이 아닙니다.</small>
      </p>
      <button className="secondary" type="button" onClick={() => selectDashboardWindow("current")} disabled={!isPriorDashboard}>현재 7일 보기</button>
    </nav>;
  }

  function renderRecordLane(
    kind: RecordBrowseItem["kind"],
    title: string,
    emptyText: string,
    focusedDate: string | null = null,
  ) {
    const items = recordBrowseItems.filter((item) =>
      item.kind === kind && (!focusedDate || item.record.observed_on === focusedDate),
    );
    return <section className="record-lane" data-record-lane={kind === "challenge-checkin" ? "challenge" : kind}>
      <div className="recap-lane-heading">
        <h3>{title}</h3>
        <span data-dashboard-lane={kind === "challenge-checkin" ? "challenge" : kind}><strong>{items.length}</strong>개 기록</span>
      </div>
      <p className="recap-lane-note">{kind === "blood-pressure"
        ? "체험에서 직접 남긴 측정값 · 날짜와 시간대별"
        : kind === "challenge-checkin"
          ? "기록함과 건너뜀을 구분해요."
          : "이전 방식 기록 · 읽기 전용"}</p>
      <ul className="record-list">
        {items.length ? items.map((item) => <li key={item.key} data-record-date={item.record.observed_on}>
          <span className="recap-record-facts">
            <span className="recap-record-date">
              <strong><time dateTime={item.record.observed_on}>{dateLabel(item.record.observed_on)}</time></strong>
              {item.kind === "blood-pressure" && <small>{periodLabel(item.record.period)}</small>}
            </span>
            {item.kind === "blood-pressure" ? (
              <span className="recap-record-value">{displayMeasurement(item.record)}</span>
            ) : <>
              <span className="recap-record-value">{challengeLabel(item.record.action_id)}</span>
              <span className="recap-record-status" data-checkin-status={item.record.status}>{checkinLabel(item.record.status)}</span>
            </>}
          </span>
          <button className="secondary record-action" type="button" onClick={() => openRecord(item, "S10")}>상세 보기</button>
        </li>) : <li className="empty-record">{focusedDate ? `${dateLabel(focusedDate)}에 남긴 ${title} 기록이 없어요.` : emptyText}</li>}
      </ul>
    </section>;
  }

  const homeLead = todayMeasurement
    ? {
        key: "today-detail",
        title: "오늘 혈압 기록 확인",
        support: todayMorningMeasurement && todayEveningMeasurement
          ? "아침·저녁 기록 있음"
          : todayMorningMeasurement ? "아침 기록 있음" : "저녁 기록 있음",
        action: "오늘 기록 보기",
        screen: "S07" as ScreenId,
      }
    : {
        key: "blood-pressure",
        title: "오늘 혈압 기록",
        support: `최근 7일 혈압 기록 ${windowData.blood_pressure_observations.length}건`,
        action: "혈압 기록하기",
        screen: "S04" as ScreenId,
      };
  const homeSecondary = [
    todayMeasurement
      ? {
          key: "blood-pressure",
          title: "혈압 추가 기록",
          support: todayMorningMeasurement && !todayEveningMeasurement
            ? "아침 기록 있음 · 저녁은 필요할 때 추가"
            : "오늘의 다른 시간대 기록 추가",
          action: "혈압 추가 기록하기",
          screen: "S04" as ScreenId,
        }
      : null,
    {
      key: "challenge",
      title: activeChallenge ? "오늘 챌린지 상태" : "7일 챌린지",
      support: activeChallenge
        ? `${challengeLabel(activeChallenge.action_id)} · ${todayCheckin ? `오늘 상태 ${checkinLabel(todayCheckin.status)}` : "오늘 상태 기록 전"}`
        : "선택 기능 · 이어갈 행동 고르기",
      action: "챌린지 열기",
      screen: (activeChallenge ? "S06" : "S03") as ScreenId,
    },
    {
      key: "today-detail",
      title: "오늘 상태",
      support: `${todayMeasurement ? "혈압 기록 있음" : "혈압 기록 없음"} · 챌린지 상태`,
      action: "오늘 상태 보기",
      screen: "S07" as ScreenId,
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item) && item!.key !== homeLead.key);

  function renderScene() {
    if (activeScreen === "S12") {
      return <Scene id="S12" eyebrow="체험 기록 없음" title="측정한 혈압부터 기록해요" tone="subtle" className="journey-empty surface">
        <p className="journey-empty-period"><time dateTime={startOn}>{dateLabel(startOn)}</time> ~ <time dateTime={endOn}>{dateLabel(endOn)}</time></p>
        <div className="journey-empty-actions action-group">
          <section className="journey-empty-action"><h2>혈압 기록</h2><button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button></section>
          <section className="journey-empty-action"><h2>7일 챌린지</h2><button className="secondary" type="button" onClick={() => navigate("S03")}>7일 챌린지 시작하기</button></section>
        </div>
      </Scene>;
    }

    if (activeScreen === "S02") {
      return <JourneyToday
        key={`${today}:${endOn}`}
        staticLandscape={!s02SceneOwnsDecoration}
        today={today}
        days={trailDays}
        lead={homeLead}
        secondary={homeSecondary}
        freshness="ready"
        onNavigate={navigate}
        companionSpecies={s02SceneOwnsDecoration ? sceneCompanionSpecies : undefined}
      />;
    }

    if (activeScreen === "S03") {
      const locked = Boolean(activeChallenge?.first_checkin_on);
      return <Scene id="S03" eyebrow="선택 기능 · 7일 챌린지" title="원하면 이어갈 행동을 골라요" tone="subtle" className="journey-candidate journey-challenge-choice surface">
        <div className="challenge-choice-context status-notice" data-challenge-choice-state={locked ? "locked" : activeChallenge ? "changeable" : "optional"}>
          <p className="eyebrow">선택 기능</p>
          <strong>{locked ? "첫 상태 기록 후에는 행동을 바꿀 수 없어요." : "참여하지 않아도 혈압 기록은 그대로 둘러볼 수 있어요."}</strong>
          <p>{locked ? "현재 선택을 확인하고 오늘 상태를 별도로 기록해요." : "원할 때 하나를 골라 오늘부터 시작해요."}</p>
        </div>
        <div className="choice-grid">
          {challengeActions.map((action) => {
            const selected = activeChallenge?.action_id === action.id;
            return <button
              className={`choice-tile ${selected ? "is-selected" : ""}`}
              type="button"
              key={action.id}
              onClick={() => selectChallenge(action.id)}
              disabled={locked}
            >
              <span className="choice-icon" aria-hidden="true" data-choice={action.id} />
              <strong>{action.label}</strong>
              <small>{action.note}</small>
              <span className="choice-state">{locked ? selected ? "선택됨 · 변경 불가" : "변경 불가" : selected ? "선택됨" : "선택하기"}</span>
            </button>;
          })}
        </div>
        <button className="text-button" type="button" onClick={() => navigate("S02")}>오늘의 기록으로 돌아가기</button>
      </Scene>;
    }

    if (activeScreen === "S04") {
      return <Scene
        id="S04"
        eyebrow={journeyCopy.S04.eyebrow}
        title={editingBloodPressureId ? "혈압 기록 수정" : journeyCopy.S04.title}
        body={journeyCopy.S04.body}
        tone="emphasis"
        className="journey-candidate journey-entry journey-sheet surface"
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
                  value={bloodPressureDraft.observedOn}
                  aria-invalid={bloodPressureError?.field === "observed-on"}
                  aria-describedby={bloodPressureError?.field === "observed-on" ? "guest-blood-pressure-error" : undefined}
                  onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, observedOn: event.target.value }))}
                  disabled={isPriorDashboard}
                  required
                />
              </label>
              <label htmlFor="period">
                <span className="bp-sheet-field-label">시간대</span>
                <select
                  id="period"
                  style={measurementControlStyle}
                  value={bloodPressureDraft.period}
                  onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, period: event.target.value as BloodPressureDraft["period"] }))}
                  disabled={isPriorDashboard}
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
                  aria-invalid={bloodPressureError?.field === "systolic"}
                  aria-describedby={bloodPressureError?.field === "systolic" ? "guest-blood-pressure-error" : undefined}
                  onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, systolic: event.target.value }))}
                  disabled={isPriorDashboard}
                  required
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
                  aria-invalid={bloodPressureError?.field === "diastolic"}
                  aria-describedby={bloodPressureError?.field === "diastolic" ? "guest-blood-pressure-error" : undefined}
                  onChange={(event) => setBloodPressureDraft((draft) => ({ ...draft, diastolic: event.target.value }))}
                  disabled={isPriorDashboard}
                  required
                />
                <span className="unit">mmHg</span>
              </label>
            </div>
          </div>
          {bloodPressureError && <p id="guest-blood-pressure-error" className="field-error status-notice" role="alert">{bloodPressureError.message}</p>}
          <div className="form-actions action-group">
            <button type="submit" disabled={isPriorDashboard}>{editingBloodPressureId ? "변경 반영" : "체험 기록에 반영"}</button>
            {editingBloodPressureId && <button className="secondary" type="button" onClick={cancelBloodPressureEdit}>수정 취소</button>}
          </div>
          <div className="bp-sheet-secondary">
            <details className="measurement-guide section-header">
              <summary>측정 전 확인하기</summary>
              <ul>
                <li>조용히 앉아 몸과 호흡을 편하게 해요.</li>
                <li>등과 팔을 지지하고 측정 중에는 말하지 않아요.</li>
                <li>이 안내는 기록 조건을 돕기 위한 참고예요.</li>
              </ul>
            </details>
          </div>
        </form>
        <button type="button" className="text-button journey-back" onClick={() => navigate("S02")}>← 오늘 화면으로 돌아가기</button>
      </Scene>;
    }

    if (activeScreen === "S05" && confirmation) {
      const bloodPressureIsToday = confirmation.kind === "blood-pressure" && confirmation.observedOn === today;
      return <Scene id="S05" eyebrow="체험에 반영됨" title="입력한 기록을 이 체험에 반영했어요" tone="subtle" className="saved-scene journey-candidate journey-saved guest-local-confirmation">
        <div className="save-ripple" aria-hidden="true"><div className="save-ripple-landscape"><i /><i /></div><span>✓</span></div>
        <section className="save-next-step section-header" aria-labelledby="guest-save-next-step-title">
          <p className="eyebrow">다음 확인</p>
          <h2 id="guest-save-next-step-title">{confirmation.kind === "challenge-checkin"
            ? "오늘의 기록에서 방금 반영한 챌린지 상태를 확인해요"
            : bloodPressureIsToday
              ? "오늘의 기록에서 방금 반영한 혈압을 확인해요"
              : "기록 찾아보기에서 방금 반영한 혈압을 확인해요"}</h2>
          <p>이 확인은 현재 체험 메모리에만 적용돼요.</p>
        </section>
        <div className="split-actions action-group journey-continuation-actions journey-continuation-actions--saved">
          <button type="button" onClick={() => navigate(confirmation.kind === "blood-pressure" && !bloodPressureIsToday ? "S08" : "S02")}>{confirmation.kind === "blood-pressure" && !bloodPressureIsToday ? "기록 찾아보기" : "오늘의 기록 보기"}</button>
          <button className="secondary" type="button" onClick={() => navigate(confirmation.kind === "challenge-checkin" ? "S06" : "S04")}>{confirmation.kind === "challenge-checkin" ? "챌린지 상태 보기" : "계속 기록하기"}</button>
        </div>
      </Scene>;
    }

    if (activeScreen === "S06") {
      return <Scene id="S06" eyebrow="선택 기능 · 오늘 상태" title="선택한 행동과 오늘 상태를 확인해요" tone="subtle" className="journey-candidate journey-challenge-summary surface">
        <section className="locked-challenge journey-challenge-summary-card section-header">
          <p className="eyebrow">선택한 행동</p>
          <h2>{activeChallenge ? challengeLabel(activeChallenge.action_id) : "선택한 행동 없음"}</h2>
          {activeChallenge && <p className="journey-challenge-dates"><span>챌린지 기간</span><time dateTime={activeChallenge.starts_on}>{activeChallenge.starts_on}</time> ~ <time dateTime={activeChallenge.ends_on}>{activeChallenge.ends_on}</time></p>}
        </section>
        <section className="locked-challenge journey-challenge-summary-card journey-challenge-checkin-card section-header" data-challenge-checkin-state={todayCheckin?.status ?? "pending"}>
          <p className="eyebrow">오늘 상태 · 별도 기록</p>
          <h2>{todayCheckin ? checkinLabel(todayCheckin.status) : "아직 기록하지 않음"}</h2>
          <p>{todayCheckin ? `오늘은 '${checkinLabel(todayCheckin.status)}' 상태로 반영되어 있어요.` : "오늘은 '기록함' 또는 '건너뜀' 중 하나를 상태로 남길 수 있어요."}</p>
          {!isPriorDashboard && !activeChallengeEnded && <div className="inline-actions action-group guest-checkin-actions">
            <button type="button" onClick={() => createChallengeCheckin("completed")}>기록함</button>
            <button className="secondary" type="button" onClick={() => createChallengeCheckin("skipped")}>건너뜀</button>
          </div>}
        </section>
        <div className="inline-actions action-group journey-challenge-next-actions">
          <button type="button" onClick={() => navigate("S07")}>오늘 기록 함께 보기</button>
          <button className="secondary" type="button" onClick={() => navigate("S04")}>혈압 기록하기</button>
        </div>
      </Scene>;
    }

    if (activeScreen === "S07") {
      return <Scene id="S07" eyebrow="오늘 기록 확인" title="오늘의 기록 확인" tone="base" className="journey-candidate journey-today-review surface">
        <div className="today-date"><strong>{dateLabel(today)}</strong><span>혈압·챌린지 기록을 따로 확인해요.</span></div>
        <div className="journey-today-detail" data-today-scope="current" data-record-priority="blood-pressure">
          <div className="fact-lanes">
            <section className="fact-lead section-header">
              <p className="eyebrow">혈압 관찰</p>
              <h2>{todayMeasurement ? "오늘 기록 있음" : "오늘 기록 없음"}</h2>
              {todayMeasurements.length ? <dl className="journey-today-bp-records" aria-label="오늘 혈압 기록">
                {todayMeasurements.map((record) => <div key={record.id} data-today-bp-period={record.period}><dt>{periodLabel(record.period)}</dt><dd>{displayMeasurement(record)}</dd></div>)}
              </dl> : <p>필요할 때 오늘의 측정값을 기록할 수 있어요.</p>}
              {!todayMeasurement && <button type="button" onClick={() => navigate("S04")}>혈압 기록하기</button>}
            </section>
            <section className="journey-today-secondary journey-today-challenge section-header" data-today-challenge-state={todayCheckin?.status ?? (activeChallenge ? "pending" : "optional")}>
              <p className="eyebrow">선택 기능 · 챌린지 참여</p>
              <h2>{activeChallenge ? challengeLabel(activeChallenge.action_id) : "아직 선택 없음"}</h2>
              <p>{todayCheckin ? `오늘 상태 · ${checkinLabel(todayCheckin.status)}` : activeChallenge ? "오늘 상태를 확인하고 기록할 수 있어요." : "행동을 선택하면 오늘 상태를 따로 기록할 수 있어요."}</p>
              {!activeChallenge ? <button type="button" onClick={() => navigate("S03")}>행동 고르기</button> : !todayCheckin && <div className="inline-actions action-group"><button type="button" onClick={() => createChallengeCheckin("completed")}>기록함</button><button className="secondary" type="button" onClick={() => createChallengeCheckin("skipped")}>건너뜀</button></div>}
            </section>
          </div>
        </div>
        <div className="journey-today-actions action-group">
          <button className="secondary" type="button" onClick={() => navigate("S02")}>오늘 화면으로 돌아가기</button>
          <button type="button" onClick={() => navigate("S10")}>최근 7일 돌아보기</button>
        </div>
      </Scene>;
    }

    if (activeScreen === "S08") {
      return <Scene id="S08" eyebrow="기록" title={journeyCopy.S08.title} tone="secondary" className="record-explorer-scene surface journey-candidate journey-records">
        <div className="scene-toolbar action-group">
          <span className="utility-label">조회 기간</span>
          <div className="journey-continuation-actions journey-continuation-actions--compact">
            <button className="text-button" type="button" onClick={() => navigate("S02")}>오늘 화면으로 돌아가기</button>
            <button className="secondary" type="button" onClick={() => navigate("S10")}>최근 7일 돌아보기</button>
          </div>
        </div>
        {renderWindowNavigation()}
        <RecordExplorer
          items={recordBrowseItems}
          selection={recordExplorer.selection}
          onSelect={(selection: ExplorerSelection) => recordExplorer.select(selection)}
          onOpen={(item) => openRecord(item)}
          returnPoint={recordExplorer.returnPoint}
          onRestored={recordExplorer.restored}
          dateLabel={dateLabel}
          periodLabel={periodLabel}
          challengeLabel={challengeLabel}
          checkinLabel={checkinLabel}
          displayMeasurement={displayMeasurement}
          isReadOnly={(item) => isPriorDashboard || item.kind === "legacy" || (item.kind === "challenge-checkin" && item.record.challenge_id !== activeChallenge?.id)}
        />
      </Scene>;
    }

    if (activeScreen === "S09") {
      const selectedRecordMissing = Boolean(selectedRecordKey && !selectedRecord);
      const challengeRecordReadOnly = selectedRecord?.kind === "challenge-checkin"
        && selectedRecord.record.challenge_id !== activeChallenge?.id;
      return <Scene id="S09" {...journeyCopy.S09} tone="secondary" className="journey-record-detail surface journey-candidate">
        <button className="text-button record-explorer-detail-return" type="button" onClick={returnFromRecordDetail}>{window.history.state?.recordReturnScreen === "S10" ? "7일 돌아보기로 돌아가기" : "목록으로 돌아가기"}</button>
        <div className="record-explorer-detail-context section-header">
          {selectedRecord && <p className="record-explorer-detail-selection">선택한 기록 · {dateLabel(selectedRecord.record.observed_on)}{selectedRecord.kind === "blood-pressure" ? ` · ${periodLabel(selectedRecord.record.period)}` : ""}</p>}
          <p className="record-explorer-detail-period">{dashboardPeriodName}{isPriorDashboard ? " · 읽기 전용" : ""} · {dateLabel(startOn)} ~ {dateLabel(endOn)}</p>
        </div>
        {selectedRecordMissing ? <div className="record-detail-empty state-error status-notice" role="alert"><h2>선택한 기록을 찾을 수 없습니다.</h2><p>목록으로 돌아가 현재 체험 기록을 다시 확인해 주세요.</p></div> : selectedRecord ? <article className="record-detail" data-record-detail-kind={selectedRecord.kind}>
          <div className="record-detail-heading section-header"><h2>{selectedRecord.kind === "blood-pressure" ? "혈압 관찰" : selectedRecord.kind === "challenge-checkin" ? "챌린지 참여" : "이전 기록"}</h2></div>
          <dl className="record-detail-facts">
            <div><dt>날짜</dt><dd>{dateLabel(selectedRecord.record.observed_on)}</dd></div>
            {selectedRecord.kind === "blood-pressure" ? <><div><dt>시간대</dt><dd>{periodLabel(selectedRecord.record.period)}</dd></div><div><dt>기록</dt><dd>{displayMeasurement(selectedRecord.record)}</dd></div></> : <><div><dt>행동</dt><dd>{challengeLabel(selectedRecord.record.action_id)}</dd></div><div><dt>상태</dt><dd>{checkinLabel(selectedRecord.record.status)}</dd></div></>}
          </dl>
          {isPriorDashboard || selectedRecord.kind === "legacy" || challengeRecordReadOnly ? <p className="notice notice-warning status-notice">이 기록은 체험에서 읽기 전용으로 보여요.</p> : <div className="inline-actions action-group record-detail-primary-actions">
            <button type="button" onClick={() => selectedRecord.kind === "blood-pressure" ? beginBloodPressureEdit(selectedRecord.record) : setEditingChallengeCheckin(selectedRecord.record)}>수정</button>
            <button className="danger" type="button" onClick={() => selectedRecord.kind === "blood-pressure" ? setPendingBloodPressureDeletion(selectedRecord.record) : setPendingChallengeCheckinDeletion(selectedRecord.record)}>삭제</button>
          </div>}
          {editingChallengeCheckin && <div className="confirmation status-notice" role="status">
            <span>{dateLabel(editingChallengeCheckin.observed_on)} · {challengeLabel(editingChallengeCheckin.action_id)} 상태</span>
            <div className="inline-actions action-group">
              <button type="button" onClick={() => updateChallengeCheckin("completed")}>기록함</button>
              <button className="secondary" type="button" onClick={() => updateChallengeCheckin("skipped")}>건너뜀</button>
              <button className="text-button" type="button" onClick={() => setEditingChallengeCheckin(null)}>취소</button>
            </div>
          </div>}
        </article> : <div className="record-detail-empty status-notice"><h2>선택한 기록이 없어요.</h2></div>}
      </Scene>;
    }

    if (activeScreen === "S10") {
      const activeChallengeCheckins = activeChallenge
        ? windowData.challenge_checkins.filter((record) => record.challenge_id === activeChallenge.id)
        : [];
      return <Scene id="S10" eyebrow="최근 기록" title="7일 돌아보기" tone="emphasis" className="journey-recap">
        <JourneyRecap
          key={endOn}
          staticLandscape={!s10SceneOwnsDecoration}
          companionSpecies={s10SceneOwnsDecoration ? sceneCompanionSpecies : undefined}
          productionSceneEnabled={s10SceneOwnsDecoration}
          today={today}
          days={trailDays}
          year={startOn.slice(0, 4)}
          period={isPriorDashboard ? "prior" : "current"}
          freshness="ready"
          navigation={renderWindowNavigation()}
          reportOnly
          records={(focusedDate) => <>
            {renderRecordLane("blood-pressure", "혈압 관찰", "이 구간에 혈압 관찰 기록이 없습니다.", focusedDate)}
            {renderRecordLane("challenge-checkin", "챌린지 체크인", "이 구간에 챌린지 체크인 기록이 없습니다.", focusedDate)}
          </>}
          challenge={<section className="challenge-progress-card" data-challenge-progress aria-labelledby="guest-challenge-progress-title">
            <p className="eyebrow">선택 기능 · 현재 챌린지</p>
            {activeChallenge && !activeChallengeEnded ? <>
              <h2 id="guest-challenge-progress-title">7일 챌린지 · {challengeLabel(activeChallenge.action_id)}</h2>
              <p><time dateTime={activeChallenge.starts_on}>{activeChallenge.starts_on}</time> ~ <time dateTime={activeChallenge.ends_on}>{activeChallenge.ends_on}</time></p>
              <strong>선택한 구간 안의 체크인 기록 {activeChallengeCheckins.length}개</strong>
            </> : <h2 id="guest-challenge-progress-title">진행 중인 7일 챌린지 없음</h2>}
          </section>}
          actions={<button ref={reportTriggerRef} type="button" className="secondary" onClick={() => setReportCreatedAt(new Date())}>7일 리포트 보기</button>}
        />
        <div className="journey-recap-return"><button className="text-button" type="button" onClick={() => navigate("S02")}>오늘 화면으로 돌아가기</button></div>
      </Scene>;
    }

    if (activeScreen === "S11") {
      return <Scene id="S11" eyebrow="체험용 예시" title="AI 분석 맛보기" tone="secondary" className="signal-scene">
        <div className="signal-orbit" aria-hidden="true"><span /><span /><i /></div>
        <div className="signal-card" data-guest-model-v2-demo="available" role="status" aria-live="polite">
          <span className="status-pill">AI 분석 맛보기</span>
          <h2>생활정보를 바탕으로 이런 방식으로 분석해요</h2>
          <p>체험에서는 분석 화면의 흐름만 보여드려요. 로그인 후에는 입력한 생활정보를 이 브라우저에서 계산하며, 분석 입력과 결과를 서버에 보내거나 저장하지 않아요.</p>
        </div>
        <p className="signal-disclaimer">이 분석은 진단·치료·예방 판단이 아닙니다.</p>
        <button className="secondary" type="button" onClick={() => navigate("S02")}>오늘 화면으로 돌아가기</button>
      </Scene>;
    }

    return <Scene id="S14" {...journeyCopy.S14} tone="base" className="journey-settings surface guest-settings">
      <div className="journey-settings-list">
        <section className="journey-settings-section journey-settings-display">
          <div className="section-header"><p className="eyebrow">화면</p><h2>화면 테마</h2><p>이 브라우저의 화면에만 적용돼요. 체험 기록에는 영향이 없어요.</p></div>
          <fieldset className="theme-preset-control">
            <legend>화면 테마</legend>
            {themePreferenceOptions.map((option) => <label key={option.value}>
              <input
                type="radio"
                name="sk7-theme-preset"
                value={option.value}
                checked={themePreference === option.value}
                onChange={(event) => {
                  const theme = writeThemePreference(event.target.value);
                  applyThemePreference(theme);
                  setThemePreference(theme);
                }}
              />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>)}
          </fieldset>
        </section>
        {companionMode !== "off" && <section className="journey-settings-section companion-identity-settings">
          <div className="section-header"><p className="eyebrow">동반자</p><h2>내 동반자</h2><p>화면의 캐릭터만 바뀌며 체험 기록에는 영향이 없어요.</p></div>
          <label className="companion-identity-control" htmlFor="guest-companion-species">
            <span>캐릭터 선택</span>
            <select id="guest-companion-species" value={companionSpecies} onChange={(event) => setCompanionSpecies(writeCompanionIdentity(event.target.value as CompanionSpecies))}>
              {companionIdentityOptions.map((option) => <option key={option.species} value={option.species}>{option.label}</option>)}
            </select>
          </label>
        </section>}
        <section className="journey-settings-section guest-settings-exit">
          <div className="section-header"><p className="eyebrow">체험</p><h2>로그인 화면으로 돌아가기</h2></div>
          <button className="text-button" type="button" onClick={endGuestJourney}>체험 끝내고 로그인으로</button>
        </section>
      </div>
    </Scene>;
  }

  const reportVisible = reportCreatedAt !== null && activeScreen === "S10";

  return <div
    data-guest-journey="memory-only"
    data-guest-companion-species={companionSpecies}
    data-guest-dashboard-window={dashboardWindow}
  >
    <div data-living-week-app hidden={reportVisible}>
      <SceneShell
        staticJourneyUi={sceneGate === "off"}
        journeyPresentation
        feedbackPhase="content"
        feedbackSuspended={reportVisible || Boolean(pendingBloodPressureDeletion) || Boolean(pendingChallengeCheckinDeletion)}
        sessionGeneration={0}
        activeScreen={activeScreen}
        onNavigate={navigate}
        companionSelection={guestCompanionSelection}
        companionSpecies={companionSpecies}
        savedSceneEvent={null}
      >
        <p className="guest-journey-disclosure" role="note">체험 중 입력은 서버로 보내거나 저장하지 않아요.</p>
        {pendingBloodPressureDeletion && <DeleteConfirmation
          title={`${dateLabel(pendingBloodPressureDeletion.observed_on)} ${periodLabel(pendingBloodPressureDeletion.period)} 혈압 기록을 체험에서 지울까요?`}
          pending={false}
          onCancel={() => setPendingBloodPressureDeletion(null)}
          onConfirm={confirmBloodPressureDeletion}
        />}
        {pendingChallengeCheckinDeletion && <DeleteConfirmation
          title={`${dateLabel(pendingChallengeCheckinDeletion.observed_on)} 챌린지 기록을 체험에서 지울까요?`}
          pending={false}
          onCancel={() => setPendingChallengeCheckinDeletion(null)}
          onConfirm={confirmChallengeCheckinDeletion}
        />}
        {renderScene()}
      </SceneShell>
    </div>
    {reportVisible && reportCreatedAt && <LivingWeekReport
      guestLocal
      days={trailDays}
      observations={windowData.blood_pressure_observations.map((record) => ({
        date: record.observed_on,
        period: record.period,
        systolic: record.systolic,
        diastolic: record.diastolic,
      }))}
      checkins={windowData.challenge_checkins.map((record) => ({
        date: record.observed_on,
        actionLabel: challengeLabel(record.action_id),
        statusLabel: checkinLabel(record.status),
      }))}
      hasLegacyRecords={false}
      unconfirmedChanges={false}
      freshness="ready"
      createdAt={reportCreatedAt}
      onClose={() => {
        setReportCreatedAt(null);
        window.requestAnimationFrame(() => reportTriggerRef.current?.focus());
      }}
    />}
  </div>;
}

export default function GuestJourneySandbox() {
  const today = useSeoulDate();
  return <GuestJourney key={today} today={today} />;
}
