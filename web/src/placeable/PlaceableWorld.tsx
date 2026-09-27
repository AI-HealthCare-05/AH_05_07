import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PCFSoftShadowMap, Raycaster, Vector2, WebGLRenderer } from "three";
import { livingCityPixelRatio } from "./livingCityRenderDensity";
import { PlaceableScene, type PlaceableProjection } from "./worldScene";
import { PlaceableWorldInput } from "./worldInput";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { MySpaceCompanionActor, type CompanionPose } from "./companionActor";

type Props = PlaceableProjection & { companion: CompanionAsset | null; onInteract: () => void; onTwilight: () => void };

/** Opt-in scene lifetime. No Lab shell, auth client, persistence, or health stores. */
export default function PlaceableWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLButtonElement>(null);
  const latest = useRef(props); latest.current = props;
  const sceneRef = useRef<PlaceableScene | null>(null);
  const inputRef = useRef<PlaceableWorldInput | null>(null);
  const companionRef = useRef<MySpaceCompanionActor | null>(null);
  const reduced = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [labels, setLabels] = useState<ReturnType<PlaceableScene["labels"]>>([]);
  const [focused, setFocused] = useState(false);
  const [pose, setPose] = useState<CompanionPose>("loading");
  const [greetings, setGreetings] = useState(0);
  const [twilight, setTwilight] = useState(false);
  const [welcomePhase, setWelcomePhase] = useState<PlaceableScene["welcomePhase"]>("daylight");
  const toggleTwilight = () => {
    if (!sceneRef.current || error) return;
    const enabled = !twilight;
    sceneRef.current.setTwilight(enabled); setTwilight(enabled);
    setWelcomePhase(sceneRef.current.welcomePhase);
    // Audio is optional and stays in the existing parent lifecycle, on this gesture only.
    if (enabled) latest.current.onTwilight();
  };
  const greet = () => {
    if (companionRef.current?.greet()) setGreetings((count) => count + 1);
  };

  useLayoutEffect(() => {
    sceneRef.current?.update(props, reduced.current);
    inputRef.current?.suspend(props.suspended);
  }, [props]);

  useEffect(() => {
    if (!host.current || !pad.current) return;
    const container = host.current;
    let renderer: WebGLRenderer | null = null, scene: PlaceableScene | null = null;
    let companion: MySpaceCompanionActor | null = null;
    const input = new PlaceableWorldInput(); inputRef.current = input;
    let disposed = false, raf = 0;
    const cleanup: (() => void)[] = [];
    const dispose = () => {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(raf);
      input.dispose(); cleanup.splice(0).reverse().forEach((release) => release());
      companion?.dispose(renderer ?? undefined); companionRef.current = null;
      scene?.dispose(renderer ?? undefined); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
      sceneRef.current = null; inputRef.current = null;
    };
    const fail = () => { dispose(); setError(true); };
    setError(false);
    setPose("loading"); setGreetings(0);
    setTwilight(false); setWelcomePhase("daylight");
    try {
      scene = new PlaceableScene(); sceneRef.current = scene;
      companion = new MySpaceCompanionActor((next) => { if (!disposed) setPose(next); });
      companionRef.current = companion; scene.actor.add(companion.root);
      renderer = new WebGLRenderer({ antialias: true, alpha: false });
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
      const canvas = renderer.domElement;
      canvas.tabIndex = 0;
      canvas.setAttribute("aria-label", "3D welcome plaza. Arrow keys or W A S D to walk; Enter to spin the confirmed pinwheel.");
      canvas.setAttribute("aria-describedby", "my-space-companion-help");
      canvas.dataset.testid = "placeable-world-canvas";
      container.prepend(canvas);
      const interact = () => { if (latest.current.canInteract) latest.current.onInteract(); };
      input.mount(canvas, pad.current, interact); input.suspend(latest.current.suspended);
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const applyMotion = () => {
        reduced.current = media.matches; setReducedMotion(media.matches);
        scene!.update(latest.current, media.matches);
        companion!.setReducedMotion(media.matches);
      };
      applyMotion(); media.addEventListener("change", applyMotion);
      companion.start(latest.current.companion);
      cleanup.push(() => media.removeEventListener("change", applyMotion));
      const resize = () => {
        if (disposed) return;
        const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
        renderer!.setPixelRatio(livingCityPixelRatio(width, height, window.devicePixelRatio));
        renderer!.setSize(width, height, false); scene!.resize(width / height); setLabels(scene!.labels());
      };
      resize();
      const observer = new ResizeObserver(resize); observer.observe(container);
      cleanup.push(() => observer.disconnect());
      const ray = new Raycaster();
      const click = (event: MouseEvent) => {
        canvas.focus({ preventScroll: true });
        const rect = canvas.getBoundingClientRect();
        scene!.scene.updateMatrixWorld(true);
        ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
          1 - (event.clientY - rect.top) / rect.height * 2), scene!.camera);
        if (ray.intersectObject(companion!.root, true).length) { greet(); return; }
        if (latest.current.canInteract && scene!.pinwheel.visible && ray.intersectObject(scene!.pinwheel, true).length) interact();
      };
      canvas.addEventListener("click", click);
      cleanup.push(() => canvas.removeEventListener("click", click));
      const lost = (event: Event) => { event.preventDefault(); fail(); };
      canvas.addEventListener("webglcontextlost", lost);
      cleanup.push(() => canvas.removeEventListener("webglcontextlost", lost));
      let previous: number | null = null;
      let lastPhase = scene.welcomePhase;
      const frame = (time: number) => {
        if (disposed) return;
        try {
          const dt = previous === null ? 0 : (time - previous) / 1000; previous = time;
          if (!document.hidden) {
            if (scene!.step(dt, input.movement.snapshot.intent)) greet();
            const phase = scene!.welcomePhase;
            if (phase !== lastPhase) { lastPhase = phase; setWelcomePhase(phase); }
            companion!.step(dt);
            renderer!.render(scene!.scene, scene!.camera);
          } else previous = null;
          raf = requestAnimationFrame(frame);
        } catch { fail(); }
      };
      raf = requestAnimationFrame(frame);
    } catch { fail(); }
    return dispose;
  }, [attempt, props.companion]);

  return <div data-testid="placeable-world" data-preview={props.preview} data-color={props.selection?.color ?? "unplaced"}
    data-keepsake={props.keepsake ?? "none"} data-choice={props.choice ?? "none"} data-socket={props.selection?.socketId ?? "unplaced"} data-pulse={props.pulse}
    data-suspended={props.suspended || !focused} data-reduced-motion={reducedMotion}
    data-companion={props.companion?.species ?? "unavailable"} data-companion-pose={pose}
    data-lighting={twilight ? "twilight" : "daylight"} data-welcome-phase={welcomePhase}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}>
    <div className="placeable-twilight">
      <button type="button" onClick={toggleTwilight} disabled={error} aria-pressed={twilight}
        aria-describedby="twilight-help">{twilight ? "낮의 광장으로 돌아가기" : "광장의 불빛 켜기"}</button>
      <p role="status" data-testid="twilight-status">{error ? "조명을 볼 수 없어도 Classic plaza와 Today는 이용할 수 있어요."
        : twilight ? "Today Gate의 불빛을 따라, 해질녘 광장에 오신 것을 환영해요." : "따뜻한 낮의 광장 · 원할 때 불빛을 켜 보세요."}</p>
      <p id="twilight-help">이번 방문의 분위기만 바뀌어요. 배치나 활동 기록은 변경되지 않아요.</p>
    </div>
    <div className="placeable-world-host" ref={host}>
      {!error && labels.map((label) => <span key={label.id} className="placeable-world-label" aria-hidden="true"
        style={{ left: `${label.left}%`, top: `${label.top}%` }}>{label.label}</span>)}
      {error && <div className="placeable-world-message" role="alert">
        <p>The 3D plaza could not start. Your saved placement and preview are kept. Classic plaza is available above.</p>
        <button onClick={() => setAttempt((value) => value + 1)}>Retry 3D</button>
      </div>}
      <button type="button" ref={pad} className="placeable-walk-pad" aria-label="Drag to walk, or focus here and use arrow keys"
        disabled={error || props.suspended}>↟<br />Walk<br />↞ · ↠</button>
      <span className="placeable-world-caption">{props.preview ? "Preview · not saved" : props.selection || props.keepsake ? "Confirmed placement" : "Unplaced"}</span>
    </div>
    <div className="placeable-companion" aria-label="My companion" data-unavailable={error || pose === "unavailable"}>
      <button type="button" disabled={error || pose === "loading" || pose === "unavailable" || pose === "greet"}
        onClick={greet}>동반자에게 인사하기</button>
      <button type="button" disabled={!props.canInteract} onClick={props.onInteract}>Spin pinwheel</button>
      <p role="status" data-testid="companion-response">{error || pose === "unavailable"
        ? "지금은 동반자를 볼 수 없어요. 광장과 Today Gate는 계속 이용할 수 있어요."
        : pose === "loading" ? "동반자가 광장으로 오고 있어요…"
        : greetings ? "반가워요! 동반자와 인사를 나눴어요." : "동반자가 이 공간에 함께 있어요."}</p>
    </div>
    <details className="plaza-help"><summary>이동 · 이용 안내</summary><p id="my-space-companion-help" className="placeable-world-help">동반자를 탭하거나 인사하기 버튼을 선택한 뒤 Enter 또는 Space를 누르세요.
      이 브라우저에서 고른 동반자이며, 인사는 이번 방문에서만 이어지는 작은 놀이예요.</p>
    <p className="placeable-world-help">Focus the plaza, then use arrow keys or W A S D to walk. Drag the Walk pad on touch screens.
      Tap the pinwheel or press Enter to spin it. Movement pauses while previewing, saving, or using other controls.</p></details>
  </div>;
}
