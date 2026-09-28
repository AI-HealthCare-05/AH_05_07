import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, PCFSoftShadowMap, Raycaster, Vector2, WebGLRenderer } from "three";
import { livingCityPixelRatio } from "./livingCityRenderDensity";
import { PlaceableScene, type PlaceableProjection } from "./worldScene";
import { PlaceableWorldInput } from "./worldInput";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { MySpaceCompanionActor, type CompanionPose } from "./companionActor";
import { PLAZA_CAMERA } from "./plazaCamera";

type Props = PlaceableProjection & { companion: CompanionAsset | null; onInteract: () => void; onTwilight: () => void };

/** Opt-in scene lifetime. No Lab shell, auth client, persistence, or health stores. */
export default function PlaceableWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLButtonElement>(null);
  const labelNodes = useRef(new Map<string, HTMLSpanElement>());
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
      renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
      const canvas = renderer.domElement;
      canvas.tabIndex = 0;
      canvas.setAttribute("aria-label", "내 공간 3D 광장. 방향키 또는 W A S D로 걷고, 드래그로 둘러보세요. Enter로 저장된 바람개비를 돌리세요.");
      canvas.setAttribute("aria-describedby", "my-space-companion-help");
      canvas.dataset.testid = "placeable-world-canvas";
      container.prepend(canvas);
      const interact = () => { if (latest.current.canInteract) latest.current.onInteract(); };
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const applyMotion = () => {
        reduced.current = media.matches; setReducedMotion(media.matches);
        scene!.update(latest.current, media.matches);
        companion!.setReducedMotion(media.matches);
      };
      applyMotion(); media.addEventListener("change", applyMotion);
      companion.start(latest.current.companion);
      cleanup.push(() => media.removeEventListener("change", applyMotion));
      let labelTop = 0;
      const resize = () => {
        if (disposed) return;
        const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
        const header = container.closest(".placeable-experience")?.querySelector(".placeable-header");
        labelTop = header ? (header.getBoundingClientRect().bottom - container.getBoundingClientRect().top + 14) / height * 100 : 0;
        renderer!.setPixelRatio(livingCityPixelRatio(width, height, window.devicePixelRatio));
        renderer!.setSize(width, height, false); scene!.resize(width / height); setLabels(scene!.labels());
      };
      resize();
      const observer = new ResizeObserver(resize); observer.observe(container);
      cleanup.push(() => observer.disconnect());
      const ray = new Raycaster();
      const tap = (x: number, y: number) => {
        const rect = canvas.getBoundingClientRect();
        scene!.scene.updateMatrixWorld(true);
        scene!.camera.updateMatrixWorld();
        ray.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1,
          1 - (y - rect.top) / rect.height * 2), scene!.camera);
        if (ray.intersectObject(companion!.root, true).length) { greet(); return; }
        if (latest.current.canInteract && scene!.pinwheel.visible && ray.intersectObject(scene!.pinwheel, true).length) interact();
      };
      input.mount(canvas, pad.current, interact, {
        orbit: (dx, dy) => scene!.cameraRig.orbit(-dx * PLAZA_CAMERA.sensitivity, dy * PLAZA_CAMERA.sensitivity),
        zoom: (delta) => scene!.cameraRig.zoom(delta), tap,
        stop: () => { scene!.stopSpatial(); companion!.setMoving(false); },
      });
      input.suspend(latest.current.suspended);
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
            companion!.setMoving(scene!.locomotion.moving);
            for (const label of scene!.labels()) {
              const node = labelNodes.current.get(label.id);
              if (!node) continue;
              node.hidden = !label.visible || label.top < labelTop;
              node.style.left = `${label.left.toFixed(2)}%`; node.style.top = `${label.top.toFixed(2)}%`;
            }
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
      <p role="status" data-testid="twilight-status">{error ? "조명을 볼 수 없어도 간단한 광장과 오늘의 기록은 이용할 수 있어요."
        : twilight ? "오늘의 기록으로 이어지는 불빛과 함께 해질녘 광장을 둘러보세요." : "따뜻한 낮의 광장 · 원할 때 불빛을 켜 보세요."}</p>
      <p id="twilight-help">이번 방문의 분위기만 바뀌어요. 배치나 활동 기록은 변경되지 않아요.</p>
    </div>
    <div className="placeable-world-host" ref={host}>
      {!error && labels.map((label) => <span key={label.id} className="placeable-world-label" aria-hidden="true"
        ref={(node) => { if (node) labelNodes.current.set(label.id, node); else labelNodes.current.delete(label.id); }}
        hidden={!label.visible} style={{ left: `${label.left}%`, top: `${label.top}%` }}>{label.label}</span>)}
      {error && <div className="placeable-world-message" role="alert">
        <h2>3D 광장을 열지 못했어요</h2>
        <p>저장된 꾸미기와 미리보기는 그대로예요. 위에서 간단한 광장으로 바꾸거나 오늘의 기록으로 이동할 수 있어요.</p>
        <button onClick={() => setAttempt((value) => value + 1)}>3D 다시 열기</button>
      </div>}
      <span className="placeable-world-caption">{props.preview ? "저장 전 미리보기" : props.selection || props.keepsake ? "저장된 꾸미기" : "꾸미기 전"}</span>
    </div>
    <button type="button" ref={pad} className="placeable-walk-pad" aria-label="드래그하거나 방향키로 광장 걷기"
      disabled={error || props.suspended}>↟<br />걷기<br />↞ · ↠</button>
    <div className="placeable-companion" aria-label="내 동반자" data-unavailable={error || pose === "unavailable"}>
      <button type="button" disabled={error || pose === "loading" || pose === "unavailable" || pose === "greet" || pose === "move"}
        onClick={greet}>동반자에게 인사하기</button>
      <button type="button" disabled={!props.canInteract} onClick={props.onInteract}>바람개비 돌리기</button>
      <p role="status" data-testid="companion-response">{error || pose === "unavailable"
        ? "지금은 동반자를 볼 수 없어요. 광장과 오늘의 기록은 계속 이용할 수 있어요."
        : pose === "loading" ? "동반자가 광장으로 오고 있어요…"
        : greetings ? "반가워요! 동반자와 인사를 나눴어요." : "동반자가 이 공간에 함께 있어요."}</p>
    </div>
    <details className="plaza-help"><summary>이동 · 시점</summary>
    <fieldset className="plaza-camera-controls" disabled={error || props.suspended}>
      <legend>광장 둘러보기</legend>
      <button type="button" onClick={() => sceneRef.current?.cameraRig.orbit(-Math.PI / 6, 0)}>왼쪽 보기</button>
      <button type="button" onClick={() => sceneRef.current?.cameraRig.orbit(Math.PI / 6, 0)}>오른쪽 보기</button>
      <button type="button" onClick={() => sceneRef.current?.cameraRig.orbit(0, 0.12)}>높게 보기</button>
      <button type="button" onClick={() => sceneRef.current?.cameraRig.orbit(0, -0.12)}>낮게 보기</button>
      <button type="button" onClick={() => sceneRef.current?.cameraRig.zoom(-1)}>가까이 보기</button>
      <button type="button" onClick={() => sceneRef.current?.cameraRig.zoom(1)}>멀리 보기</button>
      <button type="button" className="plaza-camera-reset" onClick={() => sceneRef.current?.cameraRig.reset()}>시점 다시 맞추기</button>
    </fieldset>
    <p id="my-space-companion-help" className="placeable-world-help">동반자를 탭하거나 인사하기 버튼을 선택한 뒤 Enter 또는 Space를 누르세요.
      이 브라우저에서 고른 동반자이며, 인사는 이번 방문에서만 이어지는 작은 놀이예요.</p>
    <p className="placeable-world-help">광장을 선택한 뒤 방향키 또는 W A S D로 걸어요. 터치 화면에서는 걷기 패드를 드래그하세요.
      화면을 드래그해 둘러보고, 광장을 선택한 뒤 스크롤로 거리를 조절해요. 위 버튼으로도 시점을 바꿀 수 있어요.
      바람개비는 탭하거나 Enter로 돌릴 수 있어요. 미리보기·저장·다른 조작 중에는 이동이 잠시 멈춰요.</p></details>
  </div>;
}
