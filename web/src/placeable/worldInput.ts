import { WorldMovementIntentController } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";
import { PlazaPointerGesture } from "./plazaPointerGesture";

type SpatialInput = {
  orbit: (dx: number, dy: number) => void;
  zoom: (delta: number) => void;
  tap: (x: number, y: number) => void;
  stop: () => void;
};

type SuspendOptions = Readonly<{
  tapWhileSuspended?: boolean;
}>;

/** Input is local to the focused scene or its movement pad, never global shortcuts. */
export class PlaceableWorldInput {
  readonly movement = new WorldMovementIntentController();
  #cleanups: (() => void)[] = [];
  #suspended = true;
  #tapWhileSuspended = false;
  #focused = false;
  #disposed = false;
  #release: (() => void) | null = null;
  #spatial: SpatialInput | undefined;
  #releaseCamera: (() => void) | null = null;
  constructor() { this.movement.setSemanticSuspended(true); }
  suspend(value: boolean, options: SuspendOptions = {}) {
    this.#suspended = value;
    this.#tapWhileSuspended = value && options.tapWhileSuspended === true;
    this.movement.setSemanticSuspended(value || !this.#focused);
    if (value) this.clear();
  }
  focus(value: boolean) {
    this.#focused = value;
    if (!value) this.clear();
    this.movement.setSemanticSuspended(this.#suspended || !value);
  }
  clear() { this.movement.blur(); this.#release?.(); this.#releaseCamera?.(); this.#spatial?.stop(); }

  mount(canvas: HTMLCanvasElement, pad: HTMLButtonElement, onInteract: () => void, spatial?: SpatialInput) {
    this.#spatial = spatial;
    const listen = (target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions) => {
      target.addEventListener(type, listener, options);
      this.#cleanups.push(() => target.removeEventListener(type, listener));
    };
    let pointer: number | null = null;
    this.#release = () => {
      const id = pointer; pointer = null;
      if (id !== null) {
        this.movement.endPointer(id);
        if (pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
      }
    };
    const keydown: EventListener = (event) => {
      const key = event as KeyboardEvent;
      if (key.altKey || key.ctrlKey || key.metaKey) return;
      if (key.repeat && !this.movement.snapshot.pressedKeys.includes(key.code)) return;
      if (this.movement.keyDown(key.code)) key.preventDefault();
      if (!key.repeat && (key.code === "Enter" || key.code === "Space") && !this.#suspended) {
        key.preventDefault(); onInteract();
      }
    };
    for (const surface of [canvas, pad]) {
      listen(surface, "keydown", keydown);
      listen(surface, "focus", () => this.focus(true));
      listen(surface, "blur", (event) => {
        const next = (event as FocusEvent).relatedTarget;
        if (spatial && (next === canvas || next === pad)) return;
        this.focus(false);
      });
    }
    listen(window, "keyup", (event) => { this.movement.keyUp((event as KeyboardEvent).code); });
    listen(window, "blur", () => this.clear());
    const visibility = () => {
      this.movement.setHidden(document.hidden);
      if (document.hidden) { this.#release?.(); this.#releaseCamera?.(); spatial?.stop(); }
    };
    visibility(); listen(document, "visibilitychange", visibility);
    listen(pad, "pointerdown", (event) => {
      const p = event as PointerEvent;
      if (p.button !== 0 || this.#suspended) return;
      p.preventDefault(); pad.focus({ preventScroll: true });
      if (!this.movement.beginPointer(p.pointerId)) return;
      pointer = p.pointerId;
      try { pad.setPointerCapture(pointer); } catch { this.clear(); }
    });
    listen(pad, "pointermove", (event) => {
      const p = event as PointerEvent;
      if (pointer !== p.pointerId) return;
      const rect = pad.getBoundingClientRect();
      const dx = (p.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const dz = (rect.top + rect.height / 2 - p.clientY) / (rect.height / 2);
      this.movement.updatePointer(p.pointerId, dx, dz);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      listen(pad, type, (event) => {
        if ((event as PointerEvent).pointerId !== pointer) return;
        if (spatial) this.#release?.(); else this.clear();
      });
    }
    if (spatial) {
      const gesture = new PlazaPointerGesture();
      this.#releaseCamera = () => {
        const id = gesture.pointer; gesture.clear();
        canvas.style.cursor = "";
        if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      };
      listen(canvas, "pointerdown", (event) => {
        const p = event as PointerEvent;
        if (
          p.button !== 0
          || (this.#suspended && !this.#tapWhileSuspended)
          || document.hidden
        ) return;
        if (!gesture.begin(p.pointerId, p.clientX, p.clientY)) return;
        p.preventDefault(); canvas.focus({ preventScroll: true });
        try { canvas.setPointerCapture(p.pointerId); } catch { this.#releaseCamera?.(); }
      });
      listen(canvas, "pointermove", (event) => {
        const p = event as PointerEvent;
        const delta = gesture.move(
          p.pointerId,
          p.clientX,
          p.clientY,
        );
        if (delta && !this.#suspended) {
          canvas.style.cursor = "grabbing";
          spatial.orbit(delta.x, delta.y);
        }
      });
      listen(canvas, "pointerup", (event) => {
        const p = event as PointerEvent;
        if (gesture.pointer !== p.pointerId) return;
        const tap = gesture.end(p.pointerId, p.clientX, p.clientY);
        if (canvas.hasPointerCapture(p.pointerId)) canvas.releasePointerCapture(p.pointerId);
        canvas.style.cursor = "";
        if (
          tap
          && (!this.#suspended || this.#tapWhileSuspended)
          && !document.hidden
        ) spatial.tap(p.clientX, p.clientY);
      });
      for (const type of ["pointercancel", "lostpointercapture"]) listen(canvas, type, (event) => {
        if ((event as PointerEvent).pointerId === gesture.pointer) { this.#releaseCamera?.(); spatial.stop(); }
      });
      listen(canvas, "wheel", (event) => {
        const wheel = event as WheelEvent;
        if (this.#suspended || document.hidden || wheel.ctrlKey || !this.#focused) return;
        wheel.preventDefault();
        const units = wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? canvas.clientHeight : 1;
        spatial.zoom(Math.max(-1, Math.min(1, wheel.deltaY * units * 0.006)));
      }, { passive: false });
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true; this.suspend(true); this.clear();
    this.#cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
  }
}
