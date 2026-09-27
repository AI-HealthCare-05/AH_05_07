import { WorldMovementIntentController } from "../../transcend-lab/src/platform/behavior/worldMovementIntent";

/** Input is local to the focused scene or its movement pad, never global shortcuts. */
export class PlaceableWorldInput {
  readonly movement = new WorldMovementIntentController();
  #cleanups: (() => void)[] = [];
  #suspended = true;
  #focused = false;
  #disposed = false;
  #release: (() => void) | null = null;
  constructor() { this.movement.setSemanticSuspended(true); }
  suspend(value: boolean) {
    this.#suspended = value;
    this.movement.setSemanticSuspended(value || !this.#focused);
    if (value) this.#release?.();
  }
  focus(value: boolean) {
    this.#focused = value;
    if (!value) this.clear();
    this.movement.setSemanticSuspended(this.#suspended || !value);
  }
  clear() { this.movement.blur(); this.#release?.(); }

  mount(canvas: HTMLCanvasElement, pad: HTMLButtonElement, onInteract: () => void) {
    const listen = (target: EventTarget, type: string, listener: EventListener) => {
      target.addEventListener(type, listener);
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
      listen(surface, "blur", () => this.focus(false));
    }
    listen(window, "keyup", (event) => { this.movement.keyUp((event as KeyboardEvent).code); });
    listen(window, "blur", () => this.clear());
    const visibility = () => {
      this.movement.setHidden(document.hidden);
      if (document.hidden) this.#release?.();
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
      listen(pad, type, (event) => { if ((event as PointerEvent).pointerId === pointer) this.clear(); });
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true; this.suspend(true); this.clear();
    this.#cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
  }
}
