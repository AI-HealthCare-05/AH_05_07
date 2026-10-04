/** @jsxImportSource react */
import { Component, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { dataScopeLabel } from "../ui/dataScope";
import { livingChoiceLabel, livingChoiceQuery, type LivingChoice } from "../ui/livingChoice";
import { classicTodayHref, mySpaceReturnPlaceQuery, type MySpaceReturnPlace } from "../ui/mySpaceReturn";
import { ASSET, COLORS, cosmeticLayout, SOCKETS, type Keepsake, type Selection } from "./contract";
import { keepsakeCandidate, keepsakeMedia } from "./keepsakeMedia";
import { PlaceableController } from "./controller";
import { PlaceableAudio, type AudioStatus } from "./feedback";
import type { PlaceablePersistence } from "./persistence";

const PlaceableWorld = lazy(() => import("./PlaceableWorld"));
const GardenNook = lazy(() => import("./GardenNook"));
class GardenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="placeable-world-message" role="alert"><h2>정원 쉼터를 열지 못했어요</h2><p>꾸미기 상태는 그대로예요. 위의 광장 복귀 또는 오늘의 기록 이동을 이용해 주세요.</p></div> : this.props.children;
  }
}
class WorldBoundary extends Component<{ children: ReactNode; classicHref: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="placeable-world-message" role="alert"><h2>3D 광장을 열지 못했어요</h2><p>저장된 꾸미기는 그대로예요. 정원 쉼터로 이동하거나 <a href={this.props.classicHref}>간단한 광장으로 보기</a>에서 계속 이용할 수 있어요.</p></div>
      : this.props.children;
  }
}
const phaseCopy = {
  loading: "저장된 꾸미기를 불러오고 있어요…",
  ready: "색과 자리를 고른 뒤 미리보기를 확인해 주세요.",
  saving: "꾸미기를 저장하고 있어요. 잠시 이 화면을 유지해 주세요.",
  unknown: "저장 결과를 확인할 수 없어요. 미리보기는 유지했어요. 다른 변경 전에 저장된 상태를 확인해 주세요.",
  conflict: "더 최근에 저장된 꾸미기가 있어요. 미리보기는 유지했어요. 저장된 상태를 확인한 뒤 다시 시도해 주세요.",
  unavailable: "꾸미기 저장소에 연결할 수 없어요. 미리보기는 유지했어요. 연결이나 브라우저 저장 설정을 확인해 주세요.",
  unsupported: "이 페이지에서 편집할 수 없는 버전의 꾸미기예요. 저장된 상태를 변경하지 않고 보존해요.",
  session: "계정 연결이 끝났어요. 계정 공간을 다시 확인하려면 로그인해 주세요. 미리보기는 브라우저 공간으로 복사하지 않았어요.",
} as const;
const colorLabel: Record<keyof typeof COLORS, string> = { coral: "코랄", teal: "청록", sunflower: "해바라기" };

function Pinwheel({ selection, pulse }: { selection: Selection; pulse: number }) {
  return <span className="pinwheel" style={{ "--pinwheel-color": COLORS[selection.color] } as CSSProperties} aria-hidden="true">
    <span className="pinwheel-stem" />
    <svg key={pulse} className={pulse ? "pinwheel-blades pinwheel-spin" : "pinwheel-blades"} viewBox="-50 -50 100 100">
      {[0, 90, 180, 270].map((angle) => <g key={angle} transform={`rotate(${angle})`}>
        <path d="M0 0 L-8 -43 L35 -43 Z" fill="var(--pinwheel-color)" />
        <path d="M0 0 L35 -43 L27 -7 Z" fill="var(--pinwheel-color)" opacity=".68" />
      </g>)}
      <circle r="5" fill="#fff9e9" />
    </svg>
  </span>;
}
// A still diagram of the current projection, never a second scene or interaction owner.
function PinwheelPreview({ selection }: { selection: Selection }) {
  const socket = SOCKETS.find(s => s.id === selection.socketId)!;
  return <div className="pinwheel-preview" data-testid="pinwheel-preview" data-color={selection.color} data-socket={selection.socketId}>
    <div className="pinwheel-preview-map" aria-hidden="true">
      <svg viewBox="0 0 112 100"><path d="M56 94 V25" stroke="#e3d9c6" strokeWidth="22" />
        <path d="M40 25 V18 a16 16 0 0 1 32 0 V25" fill="none" stroke="#877994" strokeWidth="7" />
        {SOCKETS.map((socket) => <ellipse key={socket.id} cx={56 + socket.x * 22} cy={59 + socket.z * 16}
          rx="10" ry="4" fill="none" stroke="currentColor" strokeDasharray="2 2" />)}
      </svg>
      <span className="pinwheel-preview-object" style={{ left: `${50 + socket.x * 22 / 1.12}%`,
        top: `${59 + socket.z * 16}%` }}><Pinwheel selection={selection} pulse={0} /></span>
    </div>
    <div><span className="pinwheel-preview-label">저장 전 미리보기</span>
      <strong>{colorLabel[selection.color]} 바람개비</strong>
      <span>{socket.label}</span></div>
  </div>;
}
export type ClassicPlaceStatePresentation = "loading" | "unavailable" | "unsupported";

export function ClassicPlaza({ selection, preview, pulse, interact, canInteract, choice = null, keepsake = null,
  statePresentation = null }: {
  choice?: LivingChoice | null;
  keepsake?: Keepsake | null;
  selection: Selection | null; preview: boolean; pulse: number; interact: () => void; canInteract: boolean;
  statePresentation?: ClassicPlaceStatePresentation | null;
}) {
  const motif = keepsake ?? keepsakeCandidate(choice);
  return <div className="placeable-map" data-testid="classic-plaza" data-preview={preview}>
    <svg className="placeable-map-ground" viewBox="0 0 400 360" aria-hidden="true">
      <defs>
        <linearGradient id="plaza-daylight" x2="0" y2="1"><stop stopColor="#f6eedc" /><stop offset="1" stopColor="#e0d7b9" /></linearGradient>
      </defs>
      <ellipse cx="200" cy="200" rx="188" ry="148" fill="url(#plaza-daylight)" />
      <path d="M55 125 Q200 52 345 125 L350 230 L270 320 L130 320 L50 230 Z" fill="none" stroke="#bcb998" strokeWidth="3" />
      <path d="M200 330 V120" stroke="#fff5df" strokeWidth="56" />
      <ellipse cx="200" cy="124" rx="67" ry="12" fill="#c2b897" />
      <path d="M153 120 V77 a47 47 0 0 1 94 0 V120" fill="none" stroke="#6954b5" strokeWidth="25" />
      <path d="M160 120 V77 a40 40 0 0 1 80 0 V120" fill="none" stroke="#eccc84" strokeWidth="3" />
      <ellipse cx="65" cy="156" rx="24" ry="14" fill="#829579" />
      <ellipse cx="335" cy="156" rx="24" ry="14" fill="#829579" />
      {motif && <g transform="translate(76 199)" data-testid={keepsake ? "classic-keepsake" : "classic-living-choice"} data-asset={motif} data-choice={choice}>
        <ellipse cy="16" rx="17" ry="6" fill="#c2b897" />
        <circle r="15" fill="#d0c5a8" /><circle r="12" fill="#f5ead4" />
        <g fill="none" stroke={keepsakeMedia[motif].accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {motif === "plaza-ribbon-v1" ? <path d="M-7 6 Q8 4 0 0 Q-8 -4 7 -6" />
            : motif === "quiet-moon-v1" ? <path d="M3 -7 C-8 -9 -10 7 2 8 Q8 8 9 3 C0 8 -5 -3 3 -7Z" />
            : <><path d="M-7 6 Q-10 -6 7 -7 Q10 6 -7 6Z" /><path d="M-7 6 L4 -3" /></>}
        </g>
      </g>}
      <circle cx="200" cy="210" r="12" fill="#697ba0" />
      <circle cx="200" cy="203" r="7" fill="#fff0cc" />
    </svg>
    {SOCKETS.map((socket) => <div className="placeable-map-socket" key={socket.id}
      style={{ left: `${50 + socket.x * 14}%`, top: `${50 + socket.z * 11.1}%` }} data-socket={socket.id}>
      <span className="placeable-socket-ring" />
      {selection?.socketId === socket.id && <button className="placeable-object" type="button"
        data-testid="classic-pinwheel" data-color={selection.color} data-socket={socket.id}
        aria-label={preview ? `미리보기: ${colorLabel[selection.color]} 바람개비 · ${socket.label}` : `${colorLabel[selection.color]} 바람개비 돌리기 · ${socket.label}`}
        disabled={!canInteract} onClick={interact}>
        <Pinwheel selection={selection} pulse={canInteract ? pulse : 0} />
      </button>}
      <span className="placeable-map-label">{socket.label}</span>
    </div>)}
    <span className="placeable-map-caption">{statePresentation === "loading" ? "저장 상태 확인 중"
      : statePresentation === "unavailable" ? "저장 상태 확인 필요"
      : statePresentation === "unsupported" ? "저장된 꾸미기 · 이 버전에서 표시 보류"
      : preview ? "저장 전 미리보기" : selection || keepsake ? "저장된 꾸미기" : "꾸미기 전"}</span>
  </div>;
}

export default function PlaceableExperience({ adapter, accountAvailable = false, world = false, reentry = false, returnPlace = null, choice = null, companion = null }: {
  companion?: CompanionAsset | null;
  choice?: LivingChoice | null;
  adapter: PlaceablePersistence; accountAvailable?: boolean; world?: boolean; reentry?: boolean; returnPlace?: MySpaceReturnPlace | null;
}) {
  const [controller] = useState(() => new PlaceableController(adapter));
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [audio] = useState(() => new PlaceableAudio());
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("muted");
  const [feedback, setFeedback] = useState(false);
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const editHeading = useRef<HTMLHeadingElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const wasDraft = useRef(false);
  const alive = useRef(true);
  const audioAttempt = useRef(0);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const handoffRef = useRef<HTMLDivElement>(null);
  const plazaHeading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    plazaHeading.current?.focus({ preventScroll: true });
  }, []);
  // Internal transitions remain visit-local. A verified return_place may choose
  // only the initial semantic subspace; no Garden runtime residue is restored.
  const returnedToGarden = reentry && returnPlace === "garden-nook";
  const [space, setSpace] = useState<"plaza" | "garden-nook">(returnedToGarden ? "garden-nook" : "plaza");
  const [gardenReturnCueVisible, setGardenReturnCueVisible] = useState(returnedToGarden);
  const seenReceipt = useRef(state.receipt);
  const pageActive = useRef(true);
  const [receiptNoticeId, setReceiptNoticeId] = useState<string | null>(null);
  const [receiptAccentId, setReceiptAccentId] = useState<string | null>(null);
  useLayoutEffect(() => {
    const fresh = state.receipt !== seenReceipt.current;
    seenReceipt.current = state.receipt;
    setReceiptNoticeId(null);
    setReceiptAccentId(null);
    // Consume even hidden/ineligible receipts. A visit/view change never replays one.
    if (!fresh || !state.receipt || space !== "plaza" || document.hidden || !pageActive.current) return;
    setReceiptNoticeId(state.receipt.operationId);
    if (!state.receipt.pinwheelOnly) return;
    setReceiptAccentId(state.receipt.operationId);
    // Decorative expiry must not change the live-region confirmation.
    const timer = setTimeout(() => setReceiptAccentId(null), 2400);
    return () => clearTimeout(timer);
  }, [state.receipt, space, world]);
  useEffect(() => {
    const clear = () => { setReceiptNoticeId(null); setReceiptAccentId(null); };
    const hide = () => { if (document.hidden) clear(); };
    const leave = () => { pageActive.current = false; clear(); };
    const restore = () => { pageActive.current = true; };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
    };
  }, []);
  const gardenHeading = useRef<HTMLHeadingElement>(null), gardenEntry = useRef<HTMLButtonElement>(null);
  const changedSpace = useRef(returnedToGarden);
  useEffect(() => {
    if (!changedSpace.current) return;
    if (space === "garden-nook") gardenHeading.current?.focus(); else gardenEntry.current?.focus();
  }, [space]);
  // #954 arrival confirmation is visit-local presentation only. Leaving the
  // returned Garden consumes it; it never becomes Garden runtime state.
  useEffect(() => {
    if (!returnedToGarden || !gardenReturnCueVisible) return;
    if (space !== "garden-nook") {
      setGardenReturnCueVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setGardenReturnCueVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, [returnedToGarden, space, gardenReturnCueVisible]);
  useEffect(() => {
    alive.current = true;
    void controller.load();
    return () => {
      alive.current = false;
      audioAttempt.current++;
      controller.dispose();
      audio.dispose();
    };
  }, [controller, audio]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (state.draft !== undefined || state.keepsakeDraft !== undefined || state.pending) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [state.draft, state.keepsakeDraft, state.pending]);
  useEffect(() => {
    if (!state.pulse) return;
    setFeedback(true);
    const timer = setTimeout(() => setFeedback(false), 900);
    return () => clearTimeout(timer);
  }, [state.pulse]);
  useEffect(() => {
    const hide = () => {
      if (!document.hidden) return;
      audioAttempt.current++;
      audio.dispose();
      setAudioStatus("muted");
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [audio]);

  // Only a controller-confirmed transition dismisses the editor after a save.
  // Recovery phases remain visible and cannot be dismissed as success.
  useEffect(() => {
    const draft = state.draft !== undefined || state.keepsakeDraft !== undefined || Boolean(state.pending);
    if (world && wasDraft.current && !draft && state.phase === "ready" && state.saved) {
      setEditing(false); editRef.current?.focus();
    }
    wasDraft.current = draft;
    if (world && !["ready", "loading"].includes(state.phase)) setEditing(true);
  }, [world, state.draft, state.keepsakeDraft, state.pending, state.phase, state.saved]);
  useEffect(() => { if (editing) editHeading.current?.focus(); }, [editing]);
  useLayoutEffect(() => {
    // Inserting the local preview must not push the activating keyboard control
    // out of view. Keep the existing focus owner; no delayed scroll or motion.
    const active = document.activeElement;
    const hasDraft = state.draft !== undefined || state.keepsakeDraft !== undefined;
    if (hasDraft && active instanceof HTMLElement && editorRef.current?.contains(active)) {
      active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
  }, [state.draft, state.keepsakeDraft]);

  const layout = cosmeticLayout(state.confirmed);
  const confirmed = layout.pinwheel;
  const candidate = keepsakeCandidate(choice);
  const preview = state.draft !== undefined || state.keepsakeDraft !== undefined;
  const selection = state.draft !== undefined ? state.draft : confirmed;
  const keepsake = state.keepsakeDraft !== undefined ? state.keepsakeDraft : layout.keepsake;
  const visibleChoice = state.keepsakeDraft === null ? null : choice;
  const canEdit = state.phase === "ready";
  const canInteract = canEdit && !preview && confirmed !== null;
  const storageScope = adapter.mode === "browser" ? "이 브라우저의 공간" : "계정 공간";
  const confirmedEmpty = state.phase === "ready"
    && state.confirmed !== null
    && confirmed === null
    && layout.keepsake === null;
  const stateIdentity = confirmedEmpty
    ? {
        kind: "empty",
        title: "아직 저장된 꾸미기가 없어요",
        detail: `${storageScope}은 정상적으로 확인됐어요. 꾸미기를 고르고 확정할 때만 저장돼요.`,
      } as const
    : state.phase === "unavailable"
      ? {
          kind: "unavailable",
          title: "저장 상태를 지금 확인할 수 없어요",
          detail: `${storageScope}을 지금 안전하게 확인하거나 변경할 수 없어요. 비어 있다는 뜻은 아니에요.`,
        } as const
      : state.phase === "unsupported"
        ? {
            kind: "unsupported",
            title: "저장된 꾸미기는 그대로 보존하고 있어요",
            detail: `${storageScope}에 저장된 형식을 이 버전에서 안전하게 표시하거나 편집할 수 없어요. 비어 있는 공간으로 간주하지 않아요.`,
          } as const
        : null;
  const classicStatePresentation = state.phase === "loading"
    || state.phase === "unavailable"
    || state.phase === "unsupported"
    ? state.phase
    : null;
  const selected = selection ?? { assetId: ASSET, color: "coral", socketId: "gate-left" };
  function change(change: Partial<Selection>) { controller.preview({ ...selected, ...change }); }
  function interact() {
    if (!canInteract) return;
    controller.interact();
    if (audioStatus === "ready" && !audio.play()) setAudioStatus("unavailable");
  }
  async function toggleAudio() {
    const attempt = ++audioAttempt.current;
    if (audioStatus === "ready") {
      audio.dispose();
      setAudioStatus("muted");
      return;
    }
    const next = await audio.enable();
    if (alive.current && attempt === audioAttempt.current) setAudioStatus(next);
  }
  function route(view: string, storage = adapter.mode) {
    return `?experience=e2&view=${view}&storage=${storage}${livingChoiceQuery(choice)}`;
  }
  function cancelEditing() {
    if (state.phase !== "ready" && state.phase !== "conflict") return;
    controller.cancel(); setEditing(false);
    if (world) editRef.current?.focus(); else chooseRef.current?.focus();
  }
  const exactNotice = state.phase === "ready" && receiptNoticeId !== null && receiptNoticeId === state.receipt?.operationId;
  const acknowledging = exactNotice && receiptAccentId === receiptNoticeId;
  const saveStatus = <p ref={statusRef} tabIndex={-1} className="placeable-status" role="status" data-testid="save-status" data-quiet={state.phase === "ready" && !state.saved}
    data-pinwheel-receipt={acknowledging}>
    {state.phase !== "ready" ? phaseCopy[state.phase] : state.saved ? <>
      {exactNotice && state.receipt?.pinwheelOnly && <span className="pinwheel-receipt-check" aria-hidden="true">✓ </span>}
      {adapter.mode === "browser" ? "이 브라우저에 " : "계정 공간에 "}
      {exactNotice ? "저장했어요." : "저장된 꾸미기예요."}
    </> : phaseCopy.ready}
  </p>;
  const stateIdentityCard = stateIdentity ? <div className="placeable-state-identity"
    data-testid="placeable-state-identity" data-state={stateIdentity.kind} data-storage={adapter.mode}>
    <p className="placeable-eyebrow">내 공간 저장 상태</p>
    <strong>{stateIdentity.title}</strong>
    <p>{stateIdentity.detail}</p>
  </div> : null;
  async function confirm() {
    await controller.confirm();
    if (alive.current && (!world || controller.getState().phase !== "ready")) statusRef.current?.focus({ preventScroll: !world });
  }
  const gardenBlocked = preview || Boolean(state.pending);
  function enterGardenNook() {
    if (gardenBlocked) {
      handoffRef.current?.focus();
      return;
    }
    changedSpace.current = true;
    setSpace("garden-nook");
  }
  const gardenPath = <div className="placeable-garden-path">
    <div><p className="placeable-eyebrow">내 공간 안의 쉼터</p><h2>정원 쉼터 · Garden Nook</h2><p>정자 곁에서 동반자와 잠깐 머물러 보세요.</p></div>
    <button ref={gardenEntry} type="button" disabled={gardenBlocked} onClick={enterGardenNook}>정원 쉼터로 가기 →</button>
    {gardenBlocked && <p>미리보기를 확정하거나 취소해 주세요. 저장 상태가 불확실하면 먼저 확인해 주세요.</p>}
  </div>;
  if (space === "garden-nook") return <main className="placeable-experience garden-experience" data-testid="garden-experience" data-living-city-space="garden-nook">
    <header className="placeable-header">
      <div className="placeable-home-title"><p className="placeable-eyebrow">SK7 · 내 공간 · My Space</p>
        <h1 ref={gardenHeading} tabIndex={-1}>정원 쉼터 <span>Garden Nook</span></h1></div>
      <nav className="placeable-home-nav" aria-label="SK7 홈 전환">
        <button onClick={() => setSpace("plaza")}>광장으로 돌아가기</button>
        <a className="placeable-health-home" href={`${classicTodayHref(world ? "3d" : "classic", adapter.mode)}${mySpaceReturnPlaceQuery("garden-nook")}`}>오늘의 기록으로 가기 <span aria-hidden="true">→</span></a>
      </nav>
    </header>
    {returnedToGarden && gardenReturnCueVisible && <p
      className="garden-return-cue"
      data-testid="garden-return-cue"
      role="status"
      aria-live="polite"
    >
      <strong>Today → Garden Nook</strong><span>정원 쉼터로 돌아왔어요.</span>
    </p>}
    <div className="garden-stage"><GardenBoundary><Suspense fallback={<p role="status">정원을 열고 있어요… 위의 복귀 경로는 바로 이용할 수 있어요.</p>}>
      <GardenNook companion={companion} />
    </Suspense></GardenBoundary></div>
  </main>;

  return <main className={`placeable-experience ${world ? "placeable-world-view" : ""}`} data-testid="placeable-experience"
    data-phase={state.phase} data-mode={adapter.mode} data-view={world ? "3d" : "classic"} data-editing={editing}
    onKeyDown={(event) => { if (world && editing && event.key === "Escape") { event.preventDefault(); cancelEditing(); } }}>
    <header className="placeable-header">
      <div className="placeable-home-title"><p className="placeable-eyebrow">{world ? "SK7 · PLAZA" : "SK7 · 두 개의 홈"}</p><h1 ref={plazaHeading} tabIndex={-1}>내 공간 <span>My Space</span></h1>
        {world ? <p className="plaza-scope">{adapter.mode === "browser" ? "이 브라우저의 공간" : "계정 공간"}<span aria-hidden="true"> · </span>3D 광장</p>
          : <p>동반자와 쉬고 나만의 광장과 정원을 꾸미는 곳</p>}</div>
      <nav className="placeable-home-nav" aria-label="SK7 홈 전환">
        <span className="placeable-current-home" aria-current="page"><small>현재 홈</small> 내 공간</span>
        <a className="placeable-view-switch" aria-label={world ? "간단한 광장으로 보기" : undefined}
          href={route(world ? "classic" : "3d")}>{world ? "간단한 광장" : "3D 광장으로 보기"}</a>
        {!world && <a className="placeable-health-home" href={classicTodayHref("classic", adapter.mode)}
          aria-describedby="placeable-today-context"
          aria-disabled={preview || Boolean(state.pending)}
          onClick={(event) => { if (preview || state.pending) { event.preventDefault(); handoffRef.current?.focus(); } }}>
          오늘의 기록 <span aria-hidden="true">→</span></a>}
      </nav>
    </header>
    <div className="placeable-layout">
      <section className="placeable-stage" aria-label="내 공간 미리보기" data-breeze={feedback && canInteract}>
        <div className="placeable-destination"><div><p className="placeable-eyebrow">건강 기록 홈 · Today</p>
          <h2>오늘의 기록</h2>
          <p id="placeable-today-context">혈압 기록과 지난 기록 확인은 오늘의 기록에서 이어가요. 내 공간의 꾸미기 상태는 그대로 유지돼요.</p></div>
          <a className="placeable-today" href={classicTodayHref(world ? "3d" : "classic", adapter.mode)}
            aria-label="오늘의 기록으로 가기"
            aria-describedby="placeable-today-context"
            aria-disabled={preview || Boolean(state.pending)}
            onClick={(event) => { if (preview || state.pending) { event.preventDefault(); handoffRef.current?.focus(); } }}>
            {world ? "오늘의 기록" : "오늘의 기록으로 가기"} <span aria-hidden="true">→</span></a>
          {world && <button className="plaza-garden-action" ref={gardenEntry} type="button"
            aria-label="정원 쉼터로 가기"
            aria-disabled={gardenBlocked}
            aria-describedby={gardenBlocked ? "placeable-destination-handoff" : undefined}
            onClick={enterGardenNook}>
            정원 쉼터 <span aria-hidden="true">→</span>
          </button>}
          {world && <button className="plaza-edit-action" ref={editRef} type="button" aria-expanded={editing} aria-controls="plaza-editor"
            onClick={() => setEditing(true)}><span aria-hidden="true">＋</span> 꾸미기</button>}
        </div>
        {(preview || state.pending) && <div id="placeable-destination-handoff" ref={handoffRef} tabIndex={-1} className="placeable-handoff-note" role="status"><strong>{state.phase === "unknown" ? "저장 결과를 먼저 확인해 주세요" : "미리보기를 먼저 마무리해 주세요"}</strong><p>{state.phase === "unknown" ? "중복 저장 없이 저장된 상태를 확인한 뒤 오늘의 기록이나 정원 쉼터로 이동할 수 있어요." : "꾸미기 변경이 사라지지 않도록 확정하거나 취소한 뒤 오늘의 기록이나 정원 쉼터로 이동할 수 있어요."}</p></div>}
        {world ? <WorldBoundary classicHref={route("classic")}><Suspense fallback={<p role="status">3D 광장을 열고 있어요… 위에서 간단한 광장으로 바꿀 수 있어요.</p>}>
          <PlaceableWorld reentry={reentry} companion={companion} choice={visibleChoice} keepsake={keepsake} selection={selection} preview={preview} pinwheelPreview={state.draft != null} pulse={state.pulse}
            onTwilight={() => { if (audioStatus === "ready" && !audio.play("twilight")) setAudioStatus("unavailable"); }}
            suspended={preview || editing || state.phase !== "ready"} canInteract={canInteract} onInteract={interact} />
        </Suspense></WorldBoundary> : <ClassicPlaza choice={visibleChoice} keepsake={keepsake} selection={selection} preview={preview} pulse={state.pulse}
          interact={interact} canInteract={canInteract} statePresentation={classicStatePresentation} />}
        {keepsake && <p className="placeable-keepsake-caption">{state.keepsakeDraft !== undefined ? "저장 전 미리보기" : "내 공간에 남긴 문양"} · {keepsakeMedia[keepsake].label}</p>}
        {!keepsake && choice && <p className="placeable-choice-note">Living Choice · {livingChoiceLabel[choice]}<br /><span>이번 방문에 가져온 문양이에요. 활동 기록이나 달성 표시가 아니에요.</span></p>}
        <p className="placeable-feedback" role="status" data-testid="placeable-feedback">{feedback && canInteract ? "광장에 바람이 불어 바람개비가 돌아가요." : "잠시 쉬어가는 나만의 광장이에요."}</p>
        {!world && gardenPath}
      </section>
      {world && !editing && <div className="plaza-save-summary" data-quiet={state.phase === "ready" && (preview || !state.saved)}>
        {saveStatus}
        {preview && <p>저장 전 미리보기</p>}
      </div>}
      <section ref={editorRef} id="plaza-editor" className="placeable-controls" aria-label="내 공간 꾸미기" hidden={world && !editing}>
        {world && <div className="plaza-editor-heading"><div><p className="placeable-eyebrow">나만의 공간</p>
          <h2 ref={editHeading} tabIndex={-1}>내 공간 꾸미기</h2></div>
          <button type="button" disabled={!canEdit && state.phase !== "conflict"} onClick={cancelEditing}>
            {preview ? "취소하고 닫기" : "닫기"}</button></div>}
        {world && editing && saveStatus}
        <p className="placeable-storage" data-testid="storage-label">{adapter.mode === "browser"
          ? <><span data-scope-label="browser">{dataScopeLabel("browser")}</span>에만 저장 · 계정 공간과 분리돼요.</>
          : <><span data-scope-label="account">{dataScopeLabel("account")}</span> 공간에 저장 · 이 브라우저의 공간과 분리돼요.</>}</p>
        {stateIdentityCard}
        {accountAvailable && <a className="placeable-storage-switch" href={route(world ? "3d" : "classic", adapter.mode === "browser" ? "account" : "browser")}>
          {adapter.mode === "browser" ? "계정 공간 사용하기" : "이 브라우저의 공간 사용하기"}</a>}
        {!world && saveStatus}
        {state.phase === "conflict" && <button onClick={() => controller.reviewLatest()}>미리보기를 유지하고 최근 저장 상태 사용</button>}
        {["unknown", "unavailable", "unsupported"].includes(state.phase) && <button onClick={() => void controller.load()}>저장된 상태 확인</button>}
        {state.phase === "unknown" && state.pending && <button onClick={() => void controller.retryPending()}>같은 저장 다시 시도</button>}
        {state.phase === "session" && <a href="/?screen=S02">오늘의 기록으로 돌아가기</a>}
        <h2>환영 바람개비</h2>
        <p data-testid="confirmed-placement">저장 상태: {state.confirmed
          ? state.phase === "unsupported" ? "새 형식 그대로 보존" : confirmed ? `${colorLabel[confirmed.color]} · ${SOCKETS.find((s) => s.id === confirmed.socketId)?.label}` : "바람개비 없음"
          : "아직 확인 전"}</p>
        <button ref={chooseRef} disabled={!canEdit} onClick={() => change({})}>환영 바람개비 고르기</button>
        {state.draft && <PinwheelPreview selection={state.draft} />}
        <fieldset className="pinwheel-choices" disabled={!canEdit}><legend>색</legend><div className="placeable-options">
          {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((color) => <button type="button" key={color}
            aria-pressed={selection?.color === color} onClick={() => change({ color })}>
            <span className="placeable-swatch" aria-hidden="true" style={{ background: COLORS[color] }} />{colorLabel[color]}
            <span className="pinwheel-selected-mark" aria-hidden="true">✓</span>
          </button>)}
        </div></fieldset>
        <fieldset className="pinwheel-choices" disabled={!canEdit}><legend>광장에 놓을 자리</legend><div className="placeable-options">
          {SOCKETS.map((socket) => <button type="button" key={socket.id} aria-pressed={selection?.socketId === socket.id}
            onClick={() => change({ socketId: socket.id })}>{socket.label}
              <span className="pinwheel-selected-mark" aria-hidden="true">✓</span></button>)}
        </div></fieldset>
        {preview && <div className="placeable-draft" data-testid="draft-placement">
          {state.keepsakeDraft !== undefined && <p data-testid="keepsake-preview">{keepsake ? `${keepsakeMedia[keepsake].label} · 저장 전 미리보기` : "문양 제거 · 저장 전 미리보기"}</p>}
          {state.draft !== undefined && <p>{selection ? `미리보기: ${colorLabel[selection.color]} · ${SOCKETS.find((s) => s.id === selection.socketId)?.label}` : "미리보기: 바람개비 치우기"} · 저장 전</p>}
          <div className="placeable-options"><button className="pinwheel-confirm" disabled={!canEdit} onClick={() => void confirm()}>배치 확정하기</button>
            <button disabled={!canEdit && state.phase !== "conflict"} onClick={cancelEditing}>미리보기 취소</button></div>
        </div>}
        <div className="placeable-options">{!world && <button disabled={!canInteract} onClick={interact}>바람개비 돌리기</button>}
          <button disabled={!canEdit || !confirmed} onClick={() => controller.preview(null)}>바람개비 치우기</button></div>
        <section className="placeable-keepsake" aria-labelledby="keepsake-title">
          <p className="placeable-eyebrow">첫 번째 기념 문양</p><h2 id="keepsake-title">내 공간에 남긴 문양</h2>
          <p data-testid="confirmed-keepsake">{state.phase === "unsupported" ? "알 수 없는 저장 형식을 그대로 보존하고 있어요."
            : !state.confirmed ? "저장된 문양을 읽고 있어요…" : layout.keepsake ? keepsakeMedia[layout.keepsake].label : "아직 남긴 문양이 없어요."}</p>
          <p className="placeable-choice-note">바람개비 곁에 두는 작은 장식이에요. 활동 기록이나 달성 표시가 아니에요.</p>
          {candidate && <><p>이번 방문의 문양 · {keepsakeMedia[candidate].label}</p>
            <button disabled={!canEdit || keepsake === candidate} onClick={() => controller.previewKeepsake(candidate)}>
              {layout.keepsake ? "이 문양으로 바꾸기" : "이 문양을 내 공간에 남기기"}</button></>}
          {!candidate && <p className="placeable-choice-note">오늘의 기록에서 Living Choice 문양을 가져올 수 있어요.</p>}
          <button disabled={!canEdit || !layout.keepsake} onClick={() => controller.previewKeepsake(null)}>남긴 문양 제거</button>
        </section>
        <button onClick={() => void toggleAudio()} aria-pressed={audioStatus === "ready"}>
          {audioStatus === "ready" ? "소리 끄기" : "소리 켜기"}</button>
        <p data-testid="audio-status">소리: {audioStatus === "ready" ? "켜짐" : audioStatus === "unavailable" ? "사용할 수 없음 · 화면 반응은 계속 보여요" : "꺼짐"}</p>
      </section>
    </div>
    <footer>내 공간은 휴식과 꾸미기를 위한 공간이에요. 미리보기 변경은 확정할 때만 저장돼요.</footer>
  </main>;
}
