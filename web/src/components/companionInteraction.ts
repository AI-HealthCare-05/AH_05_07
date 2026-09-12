import * as THREE from "three";

type TactileCompanionInteractionOptions = Readonly<{
  canvas: HTMLCanvasElement;
  host: HTMLDivElement;
  camera: THREE.Camera;
  target: THREE.Object3D;
}>;

export type TactileCompanionInteraction = Readonly<{
  step: (deltaSeconds: number) => void;
  dispose: () => void;
}>;

const MAX_DRAG_X = 0.46;
const MAX_DRAG_Y = 0.32;
const SPRING_STIFFNESS = 72;
const SPRING_DAMPING = 14;
const MAX_STEP_SECONDS = 1 / 30;
const SETTLE_DISTANCE = 0.003;
const SETTLE_SPEED = 0.02;

function pointerNdc(canvas: HTMLCanvasElement, event: PointerEvent) {
  const bounds = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
    -(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1),
  );
}

/**
 * Review-only P0 tactile presentation.
 *
 * The companion slot is already a small, dedicated visual target, so P0 uses
 * the whole slot as a forgiving grab proxy. P1 can split this into authored
 * head/body/feet proxies without changing product state or adding a physics
 * engine.
 */
export function createTactileCompanionInteraction({
  canvas,
  host,
  camera,
  target,
}: TactileCompanionInteractionOptions): TactileCompanionInteraction {
  const raycaster = new THREE.Raycaster();
  const dragPlane = new THREE.Plane();
  const dragHit = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const targetWorld = new THREE.Vector3();
  const grabOffsetWorld = new THREE.Vector3();
  const desiredWorld = new THREE.Vector3();
  const desiredLocal = new THREE.Vector3();
  const targetPosition = target.position.clone();
  const homePosition = target.position.clone();
  const homeScale = target.scale.clone();
  const velocity = new THREE.Vector3();
  const displacement = new THREE.Vector3();
  const surface = host.parentElement instanceof HTMLElement ? host.parentElement : host;

  let pointerId: number | null = null;
  let disposed = false;
  let returning = false;

  const writeOffset = () => {
    displacement.copy(target.position).sub(homePosition);
    host.dataset.companionOffsetX = displacement.x.toFixed(4);
    host.dataset.companionOffsetY = displacement.y.toFixed(4);
  };

  const setState = (state: "idle" | "dragging" | "returning") => {
    host.dataset.companionInteraction = state;
    surface.style.cursor = state === "dragging" ? "grabbing" : "grab";
  };

  const begin = (event: PointerEvent) => {
    if (disposed || pointerId !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    raycaster.setFromCamera(pointerNdc(canvas, event), camera);
    camera.getWorldDirection(cameraDirection);
    target.getWorldPosition(targetWorld);
    dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, targetWorld);
    const hit = raycaster.ray.intersectPlane(dragPlane, dragHit);
    if (!hit) return;

    pointerId = event.pointerId;
    returning = false;
    grabOffsetWorld.copy(hit).sub(targetWorld);
    targetPosition.copy(target.position);
    velocity.multiplyScalar(0.35);

    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; the same DOM route still works.
    }

    host.dataset.companionInputRoute = "pointer";
    host.dataset.companionPointerType = event.pointerType || "unknown";
    setState("dragging");
    event.preventDefault();
  };

  const move = (event: PointerEvent) => {
    if (disposed || event.pointerId !== pointerId) return;

    raycaster.setFromCamera(pointerNdc(canvas, event), camera);
    const hit = raycaster.ray.intersectPlane(dragPlane, dragHit);
    if (!hit) return;

    desiredWorld.copy(hit).sub(grabOffsetWorld);
    desiredLocal.copy(desiredWorld);
    target.parent?.worldToLocal(desiredLocal);

    targetPosition.set(
      THREE.MathUtils.clamp(
        desiredLocal.x,
        homePosition.x - MAX_DRAG_X,
        homePosition.x + MAX_DRAG_X,
      ),
      THREE.MathUtils.clamp(
        desiredLocal.y,
        homePosition.y - MAX_DRAG_Y,
        homePosition.y + MAX_DRAG_Y,
      ),
      homePosition.z,
    );

    event.preventDefault();
  };

  const release = (event: PointerEvent) => {
    if (disposed || event.pointerId !== pointerId) return;

    try {
      if (surface.hasPointerCapture(event.pointerId)) {
        surface.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore capture cleanup failures during DOM teardown.
    }

    pointerId = null;
    targetPosition.copy(homePosition);
    returning = true;
    setState("returning");
    event.preventDefault();
  };

  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    targetPosition.copy(homePosition);
    returning = true;
    setState("returning");
  };

  surface.style.pointerEvents = "auto";
  surface.style.touchAction = "none";
  host.style.pointerEvents = "auto";
  canvas.style.pointerEvents = "auto";
  host.dataset.companionInteractionEnabled = "true";
  host.dataset.companionProxy = "slot";
  setState("idle");
  writeOffset();

  surface.addEventListener("pointerdown", begin, { capture: true, passive: false });
  surface.addEventListener("pointermove", move, { capture: true, passive: false });
  surface.addEventListener("pointerup", release, { capture: true, passive: false });
  surface.addEventListener("pointercancel", cancel, { capture: true });
  surface.addEventListener("lostpointercapture", cancel, { capture: true });

  return {
    step(deltaSeconds) {
      if (disposed) return;

      const dt = Math.min(Math.max(deltaSeconds, 0), MAX_STEP_SECONDS);
      if (dt === 0) return;

      displacement.copy(targetPosition).sub(target.position);
      const acceleration = displacement
        .multiplyScalar(SPRING_STIFFNESS)
        .addScaledVector(velocity, -SPRING_DAMPING);

      velocity.addScaledVector(acceleration, dt);
      target.position.addScaledVector(velocity, dt);
      target.position.z = homePosition.z;

      const speed = Math.min(velocity.length(), 3);
      const squash = Math.min(speed * 0.012, 0.04);
      target.scale.set(
        homeScale.x * (1 + squash * 0.45),
        homeScale.y * (1 - squash),
        homeScale.z * (1 + squash * 0.45),
      );

      const xOffset = target.position.x - homePosition.x;
      target.rotation.z = THREE.MathUtils.clamp(-xOffset * 0.13, -0.065, 0.065);
      writeOffset();

      if (pointerId === null && returning) {
        const distance = target.position.distanceTo(homePosition);
        if (distance < SETTLE_DISTANCE && velocity.length() < SETTLE_SPEED) {
          target.position.copy(homePosition);
          target.scale.copy(homeScale);
          target.rotation.z = 0;
          velocity.set(0, 0, 0);
          returning = false;
          writeOffset();
          setState("idle");
        }
      }
    },

    dispose() {
      disposed = true;

      if (pointerId !== null) {
        try {
          if (surface.hasPointerCapture(pointerId)) {
            surface.releasePointerCapture(pointerId);
          }
        } catch {
          // DOM may already be detaching.
        }
      }
      pointerId = null;

      surface.removeEventListener("pointerdown", begin, true);
      surface.removeEventListener("pointermove", move, true);
      surface.removeEventListener("pointerup", release, true);
      surface.removeEventListener("pointercancel", cancel, true);
      surface.removeEventListener("lostpointercapture", cancel, true);

      surface.style.pointerEvents = "";
      surface.style.touchAction = "";
      surface.style.cursor = "";
      host.style.pointerEvents = "";
      canvas.style.pointerEvents = "none";

      host.dataset.companionInteractionEnabled = "false";
      host.dataset.companionInteraction = "disabled";
      target.position.copy(homePosition);
      target.scale.copy(homeScale);
      target.rotation.z = 0;
    },
  };
}
