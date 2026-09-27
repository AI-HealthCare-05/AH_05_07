/** @jsxImportSource react */
import { Component, lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { livingChoiceLabel, livingChoiceQuery, type LivingChoice } from "../ui/livingChoice";
import { classicTodayHref } from "../ui/mySpaceReturn";
import { ASSET, COLORS, cosmeticLayout, SOCKETS, type Keepsake, type Selection } from "./contract";
import { keepsakeCandidate, keepsakeMedia } from "./keepsakeMedia";
import { PlaceableController } from "./controller";
import { PlaceableAudio, type AudioStatus } from "./feedback";
import type { PlaceablePersistence } from "./persistence";

const PlaceableWorld = lazy(() => import("./PlaceableWorld"));
class WorldBoundary extends Component<{ children: ReactNode; classicHref: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">The 3D plaza could not load. <a href={this.props.classicHref}>Open Classic plaza</a> to continue with your saved placement.</p>
      : this.props.children;
  }
}
const phaseCopy = {
  loading: "Reading your saved placement…",
  ready: "Choose a color and a spot, then preview before confirming.",
  saving: "Confirming your placement… Please keep this page open.",
  unknown: "Save status is unknown. Your preview is kept. Check the saved state before making another change.",
  conflict: "A newer placement was found. Your preview is kept. Review the confirmed placement before trying again.",
  unavailable: "Storage is unavailable. Your preview is kept. Check the connection or browser storage, then retry the read.",
  unsupported: "This saved placement uses a version this page cannot edit. It is preserved unchanged.",
  session: "This account session is no longer available. Sign in again to read the account placement. Your preview has not been copied to browser storage.",
} as const;

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
export function ClassicPlaza({ selection, preview, pulse, interact, canInteract, choice = null, keepsake = null }: {
  choice?: LivingChoice | null;
  keepsake?: Keepsake | null;
  selection: Selection | null; preview: boolean; pulse: number; interact: () => void; canInteract: boolean;
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
        aria-label={preview ? `Preview: ${selection.color} pinwheel at ${socket.label}` : `Spin ${selection.color} pinwheel at ${socket.label}`}
        disabled={!canInteract} onClick={interact}>
        <Pinwheel selection={selection} pulse={canInteract ? pulse : 0} />
      </button>}
      <span className="placeable-map-label">{socket.label}</span>
    </div>)}
    <span className="placeable-map-caption">{preview ? "Preview · not saved" : selection || keepsake ? "Confirmed placement" : "Unplaced"}</span>
  </div>;
}

export default function PlaceableExperience({ adapter, accountAvailable = false, world = false, choice = null, companion = null }: {
  companion?: CompanionAsset | null;
  choice?: LivingChoice | null;
  adapter: PlaceablePersistence; accountAvailable?: boolean; world?: boolean;
}) {
  const [controller] = useState(() => new PlaceableController(adapter));
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [audio] = useState(() => new PlaceableAudio());
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("muted");
  const [feedback, setFeedback] = useState(false);
  const alive = useRef(true);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    alive.current = true;
    void controller.load();
    return () => { alive.current = false; controller.dispose(); audio.dispose(); };
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
    const hide = () => { if (document.hidden) { audio.dispose(); setAudioStatus("muted"); } };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [audio]);

  const layout = cosmeticLayout(state.confirmed);
  const confirmed = layout.pinwheel;
  const candidate = keepsakeCandidate(choice);
  const preview = state.draft !== undefined || state.keepsakeDraft !== undefined;
  const selection = state.draft !== undefined ? state.draft : confirmed;
  const keepsake = state.keepsakeDraft !== undefined ? state.keepsakeDraft : layout.keepsake;
  const visibleChoice = state.keepsakeDraft === null ? null : choice;
  const canEdit = state.phase === "ready";
  const canInteract = canEdit && !preview && confirmed !== null;
  const selected = selection ?? { assetId: ASSET, color: "coral", socketId: "gate-left" };
  function change(change: Partial<Selection>) { controller.preview({ ...selected, ...change }); }
  function interact() {
    if (!canInteract) return;
    controller.interact();
    if (audioStatus === "ready" && !audio.play()) setAudioStatus("unavailable");
  }
  async function toggleAudio() {
    if (audioStatus === "ready") { audio.dispose(); setAudioStatus("muted"); return; }
    const next = await audio.enable(); if (alive.current) setAudioStatus(next);
  }
  function route(view: string, storage = adapter.mode) {
    return `?experience=e2&view=${view}&storage=${storage}${livingChoiceQuery(choice)}`;
  }
  async function confirm() {
    await controller.confirm();
    if (alive.current) statusRef.current?.focus({ preventScroll: true });
  }
  return <main className={`placeable-experience ${world ? "placeable-world-view" : ""}`} data-testid="placeable-experience"
    data-phase={state.phase} data-mode={adapter.mode} data-view={world ? "3d" : "classic"}>
    <header className="placeable-header">
      <div><p className="placeable-eyebrow">SK7 · Living City</p><h1>My Space</h1>
        <p>A place to pause. A little color that is yours.</p></div>
      <nav aria-label="Plaza navigation">
        <a href={route(world ? "classic" : "3d")}>{world ? "Classic plaza" : "Enter 3D plaza"}</a>
        <a href="/">Leave plaza</a>
      </nav>
    </header>
    <div className="placeable-layout">
      <section className="placeable-stage" aria-label="Placement preview" data-breeze={feedback && canInteract}>
        <div className="placeable-destination"><div><p className="placeable-eyebrow">Through the arch</p>
          <h2>Today Gate</h2><p>Your day is just beyond the plaza.</p></div>
          <a className="placeable-today" href={classicTodayHref(world ? "3d" : "classic", adapter.mode)}
            aria-disabled={preview || Boolean(state.pending)}
            onClick={(event) => { if (preview || state.pending) { event.preventDefault(); statusRef.current?.focus(); } }}>
            Classic Today <span aria-hidden="true">↗</span></a>
        </div>
        {(preview || state.pending) && <p className="placeable-handoff-note">Confirm or cancel your preview before visiting Today. If the save is uncertain, check its saved state first.</p>}
        {world ? <WorldBoundary classicHref={route("classic")}><Suspense fallback={<p role="status">Loading 3D plaza… Classic plaza is available above.</p>}>
          <PlaceableWorld companion={companion} choice={visibleChoice} keepsake={keepsake} selection={selection} preview={preview} pulse={state.pulse}
            suspended={preview || state.phase !== "ready"} canInteract={canInteract} onInteract={interact} />
        </Suspense></WorldBoundary> : <ClassicPlaza choice={visibleChoice} keepsake={keepsake} selection={selection} preview={preview} pulse={state.pulse} interact={interact} canInteract={canInteract} />}
        {keepsake && <p className="placeable-keepsake-caption">{state.keepsakeDraft !== undefined ? "저장 전 미리보기" : "내 공간에 남긴 문양"} · {keepsakeMedia[keepsake].label}</p>}
        {!keepsake && choice && <p className="placeable-choice-note">Living Choice · {livingChoiceLabel[choice]}<br /><span>이번 방문에 가져온 문양이에요. 활동 기록이나 달성 표시가 아니에요.</span></p>}
        <p className="placeable-feedback" role="status" data-testid="placeable-feedback">{feedback && canInteract ? "A plaza breeze. Your pinwheel answers." : "A little breeze, a place of your own."}</p>
      </section>
      <section className="placeable-controls" aria-label="My Space controls">
        <p className="placeable-storage" data-testid="storage-label">{adapter.mode === "browser"
          ? "Browser-only · saved on this browser and site, not your account."
          : "Account storage · follows your signed-in account. Browser placements are separate."}</p>
        {accountAvailable && <a className="placeable-storage-switch" href={route(world ? "3d" : "classic", adapter.mode === "browser" ? "account" : "browser")}>
          {adapter.mode === "browser" ? "Use account storage" : "Use browser-only storage"}</a>}
        <p ref={statusRef} tabIndex={-1} className="placeable-status" role="status" data-testid="save-status">
          {state.saved ? adapter.mode === "browser" ? "Saved in this browser only." : "Saved to your account." : phaseCopy[state.phase]}
        </p>
        {state.phase === "conflict" && <button onClick={() => controller.reviewLatest()}>Keep preview and use latest revision</button>}
        {["unknown", "unavailable", "unsupported"].includes(state.phase) && <button onClick={() => void controller.load()}>Check saved state</button>}
        {state.phase === "unknown" && state.pending && <button onClick={() => void controller.retryPending()}>Retry same save</button>}
        {state.phase === "session" && <a href="/">Return to sign in</a>}
        {preview && <div className="placeable-draft" data-testid="draft-placement">
          {state.keepsakeDraft !== undefined && <p data-testid="keepsake-preview">{keepsake ? `${keepsakeMedia[keepsake].label} · 저장 전 미리보기` : "문양 제거 · 저장 전 미리보기"}</p>}
          {state.draft !== undefined && <p>{selection ? `Preview: ${selection.color} · ${SOCKETS.find((s) => s.id === selection.socketId)?.label}` : "Preview: remove pinwheel (unplaced)"} · not saved</p>}
          <div className="placeable-options"><button disabled={!canEdit} onClick={() => void confirm()}>Confirm placement</button>
            <button disabled={!canEdit && state.phase !== "conflict"} onClick={() => { controller.cancel(); chooseRef.current?.focus(); }}>Cancel preview</button></div>
        </div>}
        <section className="placeable-keepsake" aria-labelledby="keepsake-title">
          <p className="placeable-eyebrow">My first keepsake</p><h2 id="keepsake-title">내 공간에 남긴 문양</h2>
          <p data-testid="confirmed-keepsake">{state.phase === "unsupported" ? "알 수 없는 저장 형식을 그대로 보존하고 있어요."
            : !state.confirmed ? "저장된 문양을 읽고 있어요…" : layout.keepsake ? keepsakeMedia[layout.keepsake].label : "아직 남긴 문양이 없어요."}</p>
          <p className="placeable-choice-note">바람개비 곁에 두는 작은 장식이에요. 활동 기록이나 달성 표시가 아니에요.</p>
          {candidate && <><p>이번 방문의 문양 · {keepsakeMedia[candidate].label}</p>
            <button disabled={!canEdit || keepsake === candidate} onClick={() => controller.previewKeepsake(candidate)}>
              {layout.keepsake ? "이 문양으로 바꾸기" : "이 문양을 내 공간에 남기기"}</button></>}
          {!candidate && <p className="placeable-choice-note">Today에서 Living Choice 문양을 가져올 수 있어요.</p>}
          <button disabled={!canEdit || !layout.keepsake} onClick={() => controller.previewKeepsake(null)}>남긴 문양 제거</button>
        </section>
        <h2>Welcome pinwheel</h2>
        <p data-testid="confirmed-placement">Confirmed: {state.confirmed
          ? state.phase === "unsupported" ? "Preserved newer placement" : confirmed ? `${confirmed.color} · ${SOCKETS.find((s) => s.id === confirmed.socketId)?.label}` : "Unplaced"
          : "Not read yet"}</p>
        <button ref={chooseRef} disabled={!canEdit} onClick={() => change({})}>Choose welcome pinwheel</button>
        <fieldset disabled={!canEdit}><legend>Color</legend><div className="placeable-options">
          {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((color) => <button type="button" key={color}
            aria-pressed={selection?.color === color} onClick={() => change({ color })}>
            <span className="placeable-swatch" style={{ background: COLORS[color] }} />{color}
          </button>)}
        </div></fieldset>
        <fieldset disabled={!canEdit}><legend>Place in the plaza</legend><div className="placeable-options">
          {SOCKETS.map((socket) => <button type="button" key={socket.id} aria-pressed={selection?.socketId === socket.id}
            onClick={() => change({ socketId: socket.id })}>{socket.label}</button>)}
        </div></fieldset>
        <div className="placeable-options"><button disabled={!canInteract} onClick={interact}>Spin pinwheel</button>
          <button disabled={!canEdit || !confirmed} onClick={() => controller.preview(null)}>Remove pinwheel</button></div>
        <button onClick={() => void toggleAudio()} aria-pressed={audioStatus === "ready"}>
          {audioStatus === "ready" ? "Mute sound" : "Enable sound"}</button>
        <p data-testid="audio-status">Sound: {audioStatus}{audioStatus === "unavailable" ? " · visual feedback is still available" : ""}</p>
      </section>
    </div>
    <footer>Cosmetic placement only. Preview changes are saved only when you confirm.</footer>
  </main>;
}
