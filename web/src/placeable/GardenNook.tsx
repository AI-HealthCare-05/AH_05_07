import { useEffect, useRef, useState } from "react";
import { PCFShadowMap, Raycaster, Vector2, WebGLRenderer } from "three";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { MySpaceCompanionActor, type CompanionPose } from "./companionActor";
import { GardenScene } from "./gardenScene";
import { livingCityPixelRatio } from "./livingCityRenderDensity";
import { PlaceableWorldInput } from "./worldInput";

/** Owns only this garden visit. Semantic exits live outside its failure boundary. */
export default function GardenNook({ companion: asset }: { companion: CompanionAsset | null }) {
  const host = useRef<HTMLDivElement>(null), pad = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<GardenScene | null>(null), actorRef = useRef<MySpaceCompanionActor | null>(null);
  const inputRef = useRef<PlaceableWorldInput | null>(null);
  const [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  const [pose, setPose] = useState<CompanionPose>("loading");
  const [near, setNear] = useState(false), [moments, setMoments] = useState(0);
  const [reduced, setReduced] = useState(false);
  const rest = () => {
    const actor = actorRef.current;
    if (document.hidden || !sceneRef.current?.atPavilion || !actor
      || !["idle", "move", "neutral"].includes(actor.pose)) return;
    // An explicit rest consumes held travel before admitting the one-shot clip.
    // The pose callback suspends input for its lifetime; completion cannot replay it.
    inputRef.current?.clear();
    actor.setMoving(false);
    if (actor.rest()) setMoments((count) => count + 1);
  };
  const approach = () => {
    const scene = sceneRef.current;
    if (document.hidden || !scene || actorRef.current?.pose === "rest") return;
    inputRef.current?.clear();
    actorRef.current?.setMoving(false);
    scene.approach();
    setNear(scene.atPavilion);
  };

  useEffect(() => {
    if (!host.current || !pad.current) return;
    const container = host.current, input = new PlaceableWorldInput();
    inputRef.current = input;
    let scene: GardenScene | null = null, actor: MySpaceCompanionActor | null = null, renderer: WebGLRenderer | null = null;
    let disposed = false, raf = 0;
    const cleanup: (() => void)[] = [];
    const dispose = () => {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(raf); input.dispose();
      cleanup.splice(0).reverse().forEach((release) => release());
      actor?.dispose(renderer ?? undefined); scene?.dispose(renderer ?? undefined);
      renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
      if (inputRef.current === input) inputRef.current = null;
      sceneRef.current = null; actorRef.current = null;
    };
    const fail = () => { dispose(); setError(true); };
    setError(false); setPose("loading"); setNear(false); setMoments(0);
    try {
      scene = new GardenScene(); sceneRef.current = scene;
      actor = new MySpaceCompanionActor((next) => {
        if (disposed) return;
        input.suspend(next === "rest");
        setPose(next);
      });
      actorRef.current = actor; scene.actor.add(actor.root);
      renderer = new WebGLRenderer({ antialias: true, alpha: false });
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
      // Static scenery casts the daylight shadows; the moving companion has a contact shade.
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
      const canvas = renderer.domElement;
      canvas.tabIndex = 0; canvas.dataset.testid = "garden-canvas";
      canvas.setAttribute("aria-label", "정원 쉼터. 방향키 또는 W A S D로 걷고 정자에서 Enter를 눌러 쉬세요.");
      canvas.setAttribute("aria-describedby", "garden-help"); container.prepend(canvas);
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const motion = () => {
        if (disposed) return;
        setReduced(media.matches);
        // Hiding a visit skips its optional rest rather than replaying it later.
        // This is local playback suspension, not a stored preference change.
        if (document.hidden) input.clear();
        actorRef.current?.setReducedMotion(media.matches || document.hidden);
      };
      motion();
      media.addEventListener("change", motion);
      document.addEventListener("visibilitychange", motion);
      cleanup.push(() => media.removeEventListener("change", motion));
      cleanup.push(() => document.removeEventListener("visibilitychange", motion));
      actor.start(asset);
      const resize = () => {
        if (disposed) return;
        const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
        renderer!.setPixelRatio(livingCityPixelRatio(width, height, window.devicePixelRatio));
        renderer!.setSize(width, height, false); scene!.resize(width / height);
      };
      resize(); const observer = new ResizeObserver(resize); observer.observe(container); cleanup.push(() => observer.disconnect());
      const ray = new Raycaster();
      const tap = (x: number, y: number) => {
        if (disposed || document.hidden) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        scene!.scene.updateMatrixWorld(true);
        ray.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1,
          1 - (y - rect.top) / rect.height * 2), scene!.camera);
        if (ray.intersectObject(scene!.pavilion, true).length
          || ray.intersectObject(actor!.root, true).length) rest();
      };
      input.mount(canvas, pad.current, rest, {
        // Garden keeps its authored fixed camera. A drag cancels a tap; it does
        // not acquire a second root/camera writer or become a synthetic click.
        orbit: () => { canvas.style.cursor = ""; },
        zoom: () => {},
        tap,
        stop: () => actorRef.current?.setMoving(false),
      });
      input.suspend(false);
      const lost = (event: Event) => { event.preventDefault(); fail(); };
      canvas.addEventListener("webglcontextlost", lost); cleanup.push(() => canvas.removeEventListener("webglcontextlost", lost));
      let previous: number | null = null, wasNear = false;
      const frame = (time: number) => {
        if (disposed) return;
        try {
          const dt = previous === null ? 0 : (time - previous) / 1000; previous = time;
          if (!document.hidden) {
            const moving = scene!.step(dt, input.movement.snapshot.intent, actorRef.current?.pose === "rest");
            const currentActor = actorRef.current;
            if (currentActor) {
              try {
                currentActor.setMoving(moving);
                currentActor.step(dt);
              } catch {
                currentActor.dispose(renderer!);
                actorRef.current = null;
                input.suspend(false);
                setPose("unavailable");
              }
            }
            if (wasNear !== scene!.atPavilion) { wasNear = scene!.atPavilion; setNear(wasNear); }
            renderer!.render(scene!.scene, scene!.camera);
          } else previous = null;
          raf = requestAnimationFrame(frame);
        } catch { fail(); }
      };
      raf = requestAnimationFrame(frame);
    } catch { fail(); }
    return dispose;
  }, [asset, attempt]);

  return <section aria-label="정원 쉼터 정자" data-testid="garden-nook" data-companion={asset?.species ?? "unavailable"}
    data-companion-pose={pose} data-at-pavilion={near} data-reduced-motion={reduced}>
    <div ref={host} className="placeable-world-host garden-world-host">
      {error && <div className="placeable-world-message" role="alert">
        <h2>정원 쉼터를 열지 못했어요</h2>
        <p>꾸미기 상태는 그대로예요. 광장으로 돌아가거나 오늘의 기록으로 이동할 수 있어요.</p>
        <button onClick={() => setAttempt((value) => value + 1)}>정원 다시 열기</button>
      </div>}
      <button ref={pad} type="button" className="placeable-walk-pad" disabled={error || pose === "rest"}
        aria-label="정원에서 드래그하거나 방향키로 걷기"><span aria-hidden="true">↟</span><span>걷기</span><span aria-hidden="true">↞ · ↠</span></button>
    </div>
    <div className="garden-controls">
    <div className="garden-actions">
      <button type="button" disabled={error || near || pose === "rest"}
        onClick={approach}>정자 앞으로 이동하기</button>
      <button type="button" onClick={rest} disabled={error || !near || !["idle", "move", "neutral"].includes(pose)}>여기서 잠깐 쉬기</button>
    </div>
    <p role="status" data-testid="garden-response">{error ? "정원 화면을 사용할 수 없어요. 위의 복귀 경로는 계속 이용할 수 있어요."
      : pose === "unavailable" ? "지금은 동반자를 볼 수 없어요. 정원과 복귀 경로는 계속 이용할 수 있어요."
      : pose === "loading" ? "동반자가 정원으로 오고 있어요…"
      : pose === "rest" ? "정자 앞에서 동반자와 잠깐 쉬고 있어요."
      : pose === "move" ? "정원 길을 걷고 있어요."
      : moments ? "동반자와 잠깐 쉬었어요. 원할 때 다시 정원을 둘러보세요."
      : near ? "정자에 도착했어요. 동반자와 잠깐 쉬어 볼까요?" : "짧은 정원 길을 따라 정자로 와 보세요."}</p>
    <details className="garden-help"><summary>이동과 쉬기 안내</summary>
    <p id="garden-help" className="placeable-world-help">방향키 또는 W A S D로 이동하거나 걷기 패드를 드래그하세요.
      정자 앞으로 이동하기 버튼도 이용할 수 있어요. 정자 앞에서 동반자나 정자를 탭하거나, 쉬기 버튼을 선택하세요.
      쉬는 동안에는 제자리에 머물러요. 쉰 뒤 다시 방향키나 걷기 패드를 조작하면 움직여요.
      화면 드래그는 쉬기를 시작하지 않아요. 이번 방문에서만 이어지는 작은 놀이예요.</p></details>
    </div>
  </section>;
}
