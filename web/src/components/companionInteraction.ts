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

type CompanionGrabZone = "head" | "body" | "feet";

type TactileProfile = Readonly<{
  maxDragX: number;
  maxDragY: number;
  springStiffness: number;
  springDamping: number;
  tiltFactor: number;
  maxTilt: number;
  pitchFactor: number;
  maxPitch: number;
  squashFactor: number;
  maxSquash: number;
}>;

const MAX_STEP_SECONDS = 1 / 30;
const SETTLE_DISTANCE = 0.003;
const SETTLE_SPEED = 0.02;

const tactileProfiles: Readonly<Record<CompanionGrabZone, TactileProfile>> = {
  head: {
    maxDragX: 0.34,
    maxDragY: 0.26,
    springStiffness: 84,
    springDamping: 15,
    tiltFactor: 0.2,
    maxTilt: 0.09,
    pitchFactor: 0.1,
    maxPitch: 0.055,
    squashFactor: 0.014,
    maxSquash: 0.04,
  },
  body: {
    maxDragX: 0.46,
    maxDragY: 0.32,
    springStiffness: 72,
    springDamping: 14,
    tiltFactor: 0.13,
    maxTilt: 0.065,
    pitchFactor: 0.055,
    maxPitch: 0.035,
    squashFactor: 0.012,
    maxSquash: 0.04,
  },
  feet: {
    maxDragX: 0.24,
    maxDragY: 0.12,
    springStiffness: 98,
    springDamping: 18,
    tiltFactor: 0.075,
    maxTilt: 0.04,
    pitchFactor: 0.025,
    maxPitch: 0.02,
    squashFactor: 0.018,
    maxSquash: 0.05,
  },
};

function pointerNdc(canvas: HTMLCanvasElement, event: PointerEvent) {
  const bounds = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
    -(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1),
  );
}

function grabZoneForPointer(canvas: HTMLCanvasElement, event: PointerEvent): CompanionGrabZone {
  const bounds = canvas.getBoundingClientRect();
  const ratio = THREE.MathUtils.clamp(
    (event.clientY - bounds.top) / Math.max(bounds.height, 1),
    0,
    1,
  );
  if (ratio < 0.34) return "head";
  if (ratio > 0.74) return "feet";
  return "body";
}

/**
 * Review-only tactile presentation.
 *
 * P1 keeps the P0 slot-level forgiving hit target but divides that target into
 * stable screen-space head/body/feet zones. The zones intentionally do not
 * depend on Blender node or bone names, so the interaction primitive can later
 * expand across companion species without changing the asset contract.
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
  const homeRotation = target.rotation.clone();
  const velocity = new THREE.Vector3();
  const displacement = new THREE.Vector3();
  const surface = host.parentElement instanceof HTMLElement ? host.parentElement : host;

  let pointerId: number | null = null;
  let activeZone: CompanionGrabZone | null = null;
  let disposed = false;
  let returning = false;

  const writePresentationState = () => {
    displacement.copy(target.position).sub(homePosition);
    host.dataset.companionOffsetX = displacement.x.toFixed(4);
    host.dataset.companionOffsetY = displacement.y.toFixed(4);
    host.dataset.companionTiltZ = (target.rotation.z - homeRotation.z).toFixed(4);
    host.dataset.companionPitchX = (target.rotation.x - homeRotation.x).toFixed(4);
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

    activeZone = grabZoneForPointer(canvas, event);
    const profile = tactileProfiles[activeZone];
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
    host.dataset.companionGrabZone = activeZone;
    host.dataset.companionReactionProfile = activeZone;
    host.dataset.companionMaxDragY = profile.maxDragY.toFixed(2);
    setState("dragging");
    event.preventDefault();
  };

  const move = (event: PointerEvent) => {
    if (disposed || event.pointerId !== pointerId || !activeZone) return;

    raycaster.setFromCamera(pointerNdc(canvas, event), camera);
    const hit = raycaster.ray.intersectPlane(dragPlane, dragHit);
    if (!hit) return;

    const profile = tactileProfiles[activeZone];
    desiredWorld.copy(hit).sub(grabOffsetWorld);
    desiredLocal.copy(desiredWorld);
    target.parent?.worldToLocal(desiredLocal);

    targetPosition.set(
      THREE.MathUtils.clamp(
        desiredLocal.x,
        homePosition.x - profile.maxDragX,
        homePosition.x + profile.maxDragX,
      ),
      THREE.MathUtils.clamp(
        desiredLocal.y,
        homePosition.y - profile.maxDragY,
        homePosition.y + profile.maxDragY,
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
  host.dataset.companionProxy = "head-body-feet";
  host.dataset.companionGrabZone = "none";
  host.dataset.companionReactionProfile = "none";
  setState("idle");
  writePresentationState();

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

      const profile = tactileProfiles[activeZone ?? "body"];
      displacement.copy(targetPosition).sub(target.position);
      const acceleration = displacement
        .multiplyScalar(profile.springStiffness)
        .addScaledVector(velocity, -profile.springDamping);

      velocity.addScaledVector(acceleration, dt);
      target.position.addScaledVector(velocity, dt);
      target.position.z = homePosition.z;

      const speed = Math.min(velocity.length(), 3);
      const squash = Math.min(speed * profile.squashFactor, profile.maxSquash);
      target.scale.set(
        homeScale.x * (1 + squash * 0.45),
        homeScale.y * (1 - squash),
        homeScale.z * (1 + squash * 0.45),
      );

      const xOffset = target.position.x - homePosition.x;
      const yOffset = target.position.y - homePosition.y;
      target.rotation.z = homeRotation.z + THREE.MathUtils.clamp(
        -xOffset * profile.tiltFactor,
        -profile.maxTilt,
        profile.maxTilt,
      );
      target.rotation.x = homeRotation.x + THREE.MathUtils.clamp(
        yOffset * profile.pitchFactor,
        -profile.maxPitch,
        profile.maxPitch,
      );
      writePresentationState();

      if (pointerId === null && returning) {
        const distance = target.position.distanceTo(homePosition);
        if (distance < SETTLE_DISTANCE && velocity.length() < SETTLE_SPEED) {
          target.position.copy(homePosition);
          target.scale.copy(homeScale);
          target.rotation.copy(homeRotation);
          velocity.set(0, 0, 0);
          returning = false;
          activeZone = null;
          host.dataset.companionGrabZone = "none";
          host.dataset.companionReactionProfile = "none";
          writePresentationState();
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
      activeZone = null;

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
      host.dataset.companionGrabZone = "none";
      host.dataset.companionReactionProfile = "none";
      target.position.copy(homePosition);
      target.scale.copy(homeScale);
      target.rotation.copy(homeRotation);
    },
  };
}
