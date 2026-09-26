import type { LabResourceLedger } from "./platform/embodiment/labEmbodimentPort";
import type { KinematicWorld } from "./platform/spatial/kinematicWorld";
import { isUsablePointerId } from "./platform/behavior/worldMovementIntent";

type Contact = {
  id: number;
  target: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  radius: number;
};

type TouchOptions = Readonly<{
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  resources: LabResourceLedger;
  world: KinematicWorld;
  look: (dx: number, dy: number) => void;
}>;

/** Two bounded touch surfaces, not a page-wide scroll/zoom interceptor. */
export function mountWorldTouchControls(options: TouchOptions): void {
  const { root, canvas, resources, world } = options;
  const overlay = document.createElement("div");
  overlay.className = "world-touch-controls";
  overlay.dataset.testid = "world-touch-controls";
  const pads = (["move", "look"] as const).map((kind) => {
    const pad = document.createElement("div");
    pad.className = "world-touch-pad";
    pad.dataset.testid = `world-touch-${kind}`;
    pad.setAttribute("role", "group");
    pad.setAttribute("aria-label", kind === "move" ? "Movement touch pad" : "Camera touch pad");
    const label = document.createElement("span");
    label.textContent = kind === "move" ? "Move" : "Look";
    const thumb = document.createElement("span");
    thumb.className = "world-touch-thumb";
    thumb.setAttribute("aria-hidden", "true");
    pad.append(label, thumb);
    overlay.append(pad);
    return pad;
  });
  root.append(overlay);
  let move: Contact | null = null;
  let look: Contact | null = null;

  const release = (contact: Contact | null) => {
    if (!contact) return;
    contact.target.style.removeProperty("--touch-x");
    contact.target.style.removeProperty("--touch-y");
    delete contact.target.dataset.pointerId;
    // Local ownership is cleared before release; resulting lostcapture is stale.
    try {
      if (contact.target.hasPointerCapture(contact.id)) contact.target.releasePointerCapture(contact.id);
    } catch { /* A detached or already-cancelled contact has nothing to release. */ }
  };
  const clear = () => {
    const oldMove = move;
    const oldLook = look;
    move = look = null;
    world.blur();
    release(oldMove);
    release(oldLook);
  };
  const valid = (event: PointerEvent) => isUsablePointerId(event.pointerId)
    && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);

  pads.forEach((pad, index) => {
    const isMove = index === 0;
    resources.listen(pad, "pointerdown", (raw) => {
      if (!(raw instanceof PointerEvent) || raw.pointerType !== "touch" || raw.button !== 0) return;
      if (!valid(raw) || document.hidden || world.snapshot.lifecycle !== "running" || world.snapshot.input.suspended) return;
      if ((isMove ? move : look) || move?.id === raw.pointerId || look?.id === raw.pointerId) return;
      canvas.focus({ preventScroll: true });
      if (isMove && !world.beginPointer(raw.pointerId)) return;
      const contact = { id: raw.pointerId, target: pad, startX: raw.clientX, startY: raw.clientY,
        x: raw.clientX, y: raw.clientY, radius: Math.max(1, Math.min(52, pad.clientWidth / 2 - 12)) };
      if (isMove) move = contact;
      else look = contact;
      try { pad.setPointerCapture(raw.pointerId); }
      catch { clear(); return; }
      pad.dataset.pointerId = String(raw.pointerId);
      raw.preventDefault();
    });
    resources.listen(pad, "pointermove", (raw) => {
      if (!(raw instanceof PointerEvent)) return;
      const contact = isMove ? move : look;
      if (!contact || contact.id !== raw.pointerId) return;
      if (!valid(raw) || document.hidden || world.snapshot.input.suspended) { clear(); return; }
      if (isMove) {
        const dx = raw.clientX - contact.startX;
        const dy = raw.clientY - contact.startY;
        if (!world.updatePointer(contact.id, dx / contact.radius, -dy / contact.radius)) { clear(); return; }
        const scale = Math.max(1, Math.hypot(dx, dy) / contact.radius);
        pad.style.setProperty("--touch-x", `${dx / scale}px`);
        pad.style.setProperty("--touch-y", `${dy / scale}px`);
      } else {
        const dx = Math.max(-200, Math.min(200, raw.clientX - contact.x));
        const dy = Math.max(-200, Math.min(200, raw.clientY - contact.y));
        options.look(dx, dy);
      }
      contact.x = raw.clientX;
      contact.y = raw.clientY;
      raw.preventDefault();
    });
    const finish = (raw: Event) => {
      if (!(raw instanceof PointerEvent)) return;
      const contact = isMove ? move : look;
      if (!contact || contact.id !== raw.pointerId) return;
      if (raw.type !== "pointerup") { clear(); return; }
      if (isMove) { move = null; world.endPointer(contact.id); }
      else look = null;
      release(contact);
    };
    resources.listen(pad, "pointerup", finish);
    resources.listen(pad, "pointercancel", finish);
    resources.listen(pad, "lostpointercapture", finish);
  });
  resources.listen(window, "blur", clear);
  resources.listen(window, "pagehide", clear);
  resources.listen(window, "resize", clear);
  if (window.visualViewport) resources.listen(window.visualViewport, "resize", clear);
  resources.listen(document, "visibilitychange", () => { if (document.hidden) clear(); });
  resources.listen(document, "focusin", (event) => {
    if (event.target !== canvas && !(event.target instanceof Node && overlay.contains(event.target))) clear();
  });
  resources.trackSubscription(() => { clear(); overlay.remove(); });
}
