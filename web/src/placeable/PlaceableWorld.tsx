import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Raycaster, Vector2, WebGLRenderer } from "three";
import { PlaceableScene, type PlaceableProjection } from "./worldScene";
import { PlaceableWorldInput } from "./worldInput";

type Props = PlaceableProjection & { onInteract: () => void };

/** Opt-in scene lifetime. No Lab shell, auth client, persistence, or health stores. */
export default function PlaceableWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLButtonElement>(null);
  const latest = useRef(props); latest.current = props;
  const sceneRef = useRef<PlaceableScene | null>(null);
  const inputRef = useRef<PlaceableWorldInput | null>(null);
  const reduced = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [labels, setLabels] = useState<ReturnType<PlaceableScene["labels"]>>([]);
  const [focused, setFocused] = useState(false);

  useLayoutEffect(() => {
    sceneRef.current?.update(props, reduced.current);
    inputRef.current?.suspend(props.suspended);
  }, [props]);

  useEffect(() => {
    if (!host.current || !pad.current) return;
    const container = host.current;
    let renderer: WebGLRenderer | null = null, scene: PlaceableScene | null = null;
    const input = new PlaceableWorldInput(); inputRef.current = input;
    let disposed = false, raf = 0;
    const cleanup: (() => void)[] = [];
    const dispose = () => {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(raf);
      input.dispose(); cleanup.splice(0).reverse().forEach((release) => release());
      scene?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
      sceneRef.current = null; inputRef.current = null;
    };
    const fail = () => { dispose(); setError(true); };
    setError(false);
    try {
      scene = new PlaceableScene(); sceneRef.current = scene;
      renderer = new WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const canvas = renderer.domElement;
      canvas.tabIndex = 0;
      canvas.setAttribute("aria-label", "3D welcome plaza. Arrow keys or W A S D to walk; Enter to spin the confirmed pinwheel.");
      canvas.dataset.testid = "placeable-world-canvas";
      container.prepend(canvas);
      const interact = () => { if (latest.current.canInteract) latest.current.onInteract(); };
      input.mount(canvas, pad.current, interact); input.suspend(latest.current.suspended);
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const applyMotion = () => {
        reduced.current = media.matches; setReducedMotion(media.matches);
        scene!.update(latest.current, media.matches);
      };
      applyMotion(); media.addEventListener("change", applyMotion);
      cleanup.push(() => media.removeEventListener("change", applyMotion));
      const resize = () => {
        if (disposed) return;
        const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
        renderer!.setSize(width, height, false); scene!.resize(width / height); setLabels(scene!.labels());
      };
      resize();
      const observer = new ResizeObserver(resize); observer.observe(container);
      cleanup.push(() => observer.disconnect());
      const ray = new Raycaster();
      const click = (event: MouseEvent) => {
        canvas.focus({ preventScroll: true });
        if (!latest.current.canInteract || !scene!.pinwheel.visible) return;
        const rect = canvas.getBoundingClientRect();
        scene!.scene.updateMatrixWorld(true);
        ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
          1 - (event.clientY - rect.top) / rect.height * 2), scene!.camera);
        if (ray.intersectObject(scene!.pinwheel, true).length) interact();
      };
      canvas.addEventListener("click", click);
      cleanup.push(() => canvas.removeEventListener("click", click));
      const lost = (event: Event) => { event.preventDefault(); fail(); };
      canvas.addEventListener("webglcontextlost", lost);
      cleanup.push(() => canvas.removeEventListener("webglcontextlost", lost));
      let previous: number | null = null;
      const frame = (time: number) => {
        if (disposed) return;
        try {
          const dt = previous === null ? 0 : (time - previous) / 1000; previous = time;
          if (!document.hidden) {
            scene!.step(dt, input.movement.snapshot.intent);
            renderer!.render(scene!.scene, scene!.camera);
          } else previous = null;
          raf = requestAnimationFrame(frame);
        } catch { fail(); }
      };
      raf = requestAnimationFrame(frame);
    } catch { fail(); }
    return dispose;
  }, [attempt]);

  return <div data-testid="placeable-world" data-preview={props.preview} data-color={props.selection?.color ?? "unplaced"}
    data-keepsake={props.keepsake ?? "none"} data-choice={props.choice ?? "none"} data-socket={props.selection?.socketId ?? "unplaced"} data-pulse={props.pulse}
    data-suspended={props.suspended || !focused} data-reduced-motion={reducedMotion}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}>
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
    <p className="placeable-world-help">Focus the plaza, then use arrow keys or W A S D to walk. Drag the Walk pad on touch screens.
      Tap the pinwheel or press Enter to spin it. Movement pauses while previewing, saving, or using other controls.</p>
  </div>;
}
