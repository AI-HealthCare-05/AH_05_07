import * as THREE from "three";

type CompanionLookOptions = Readonly<{
  host: HTMLDivElement;
  head: THREE.Bone;
  isSuspended?: () => boolean;
}>;

export type CompanionLookController = Readonly<{
  beforeAnimationStep: () => void;
  step: (deltaSeconds: number) => void;
  dispose: () => void;
}>;

const MAX_YAW = 0.16;
const MAX_PITCH = 0.075;
const RESPONSE_PER_SECOND = 9;
const MAX_STEP_SECONDS = 1 / 30;
const TOUCH_GLANCE_MS = 700;
const SETTLE_EPSILON = 0.0015;

function pointerTarget(event: PointerEvent) {
  const width = Math.max(window.innerWidth, 1);
  const height = Math.max(window.innerHeight, 1);
  const normalizedX = THREE.MathUtils.clamp((event.clientX / width) * 2 - 1, -1, 1);
  const normalizedY = THREE.MathUtils.clamp(1 - (event.clientY / height) * 2, -1, 1);
  return {
    yaw: normalizedX * MAX_YAW,
    pitch: normalizedY * MAX_PITCH,
  };
}

/**
 * Review-only Living Replay attention primitive.
 *
 * The authored `head` bone is stable across companion GLBs. AnimationMixer keeps
 * ownership of the authored pose; this controller removes its previous additive
 * offset before each mixer update, then applies one small bounded look offset
 * after the animation pose has been evaluated.
 */
export function createCompanionLookController({
  host,
  head,
  isSuspended,
}: CompanionLookOptions): CompanionLookController {
  const appliedOffset = new THREE.Quaternion();
  const inverseOffset = new THREE.Quaternion();
  const nextOffset = new THREE.Quaternion();
  const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");

  let disposed = false;
  let targetYaw = 0;
  let targetPitch = 0;
  let currentYaw = 0;
  let currentPitch = 0;
  let pointerActive = false;
  let lastPointerType = "none";
  let touchGlanceUntil = 0;

  const writeState = (state: "centered" | "tracking" | "suspended") => {
    host.dataset.companionLookState = state;
    host.dataset.companionLookYaw = currentYaw.toFixed(4);
    host.dataset.companionLookPitch = currentPitch.toFixed(4);
    host.dataset.companionLookPointerType = lastPointerType;
  };

  const centerTarget = () => {
    targetYaw = 0;
    targetPitch = 0;
    pointerActive = false;
  };

  const followPointer = (event: PointerEvent) => {
    if (disposed || event.pointerType === "touch") return;
    const target = pointerTarget(event);
    targetYaw = target.yaw;
    targetPitch = target.pitch;
    pointerActive = true;
    lastPointerType = event.pointerType || "mouse";
  };

  const glanceAtTouch = (event: PointerEvent) => {
    if (disposed || event.pointerType !== "touch") return;
    const target = pointerTarget(event);
    targetYaw = target.yaw;
    targetPitch = target.pitch;
    pointerActive = true;
    lastPointerType = "touch";
    touchGlanceUntil = performance.now() + TOUCH_GLANCE_MS;
  };

  const pointerLeavesWindow = (event: PointerEvent) => {
    if (event.relatedTarget === null && event.pointerType !== "touch") centerTarget();
  };

  const blur = () => centerTarget();
  const visibility = () => {
    if (document.hidden) centerTarget();
  };

  window.addEventListener("pointermove", followPointer, { passive: true });
  window.addEventListener("pointerdown", glanceAtTouch, { passive: true });
  document.addEventListener("pointerout", pointerLeavesWindow, { passive: true });
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);

  host.dataset.companionLookEnabled = "true";
  host.dataset.companionLookBone = head.name;
  host.dataset.companionLookMaxYaw = MAX_YAW.toFixed(3);
  host.dataset.companionLookMaxPitch = MAX_PITCH.toFixed(3);
  writeState("centered");

  return {
    beforeAnimationStep() {
      if (disposed) return;
      inverseOffset.copy(appliedOffset).invert();
      head.quaternion.multiply(inverseOffset);
      appliedOffset.identity();
    },

    step(deltaSeconds) {
      if (disposed) return;

      if (lastPointerType === "touch" && touchGlanceUntil > 0 && performance.now() >= touchGlanceUntil) {
        touchGlanceUntil = 0;
        centerTarget();
      }

      const suspended = isSuspended?.() === true;
      const desiredYaw = suspended ? 0 : targetYaw;
      const desiredPitch = suspended ? 0 : targetPitch;
      const dt = Math.min(Math.max(deltaSeconds, 0), MAX_STEP_SECONDS);
      const alpha = 1 - Math.exp(-RESPONSE_PER_SECOND * dt);

      currentYaw = THREE.MathUtils.lerp(currentYaw, desiredYaw, alpha);
      currentPitch = THREE.MathUtils.lerp(currentPitch, desiredPitch, alpha);

      if (!pointerActive && Math.abs(currentYaw) < SETTLE_EPSILON) currentYaw = 0;
      if (!pointerActive && Math.abs(currentPitch) < SETTLE_EPSILON) currentPitch = 0;

      lookEuler.set(currentPitch, currentYaw, 0, "YXZ");
      nextOffset.setFromEuler(lookEuler);
      head.quaternion.multiply(nextOffset);
      appliedOffset.copy(nextOffset);

      const centered = currentYaw === 0 && currentPitch === 0;
      writeState(suspended ? "suspended" : centered ? "centered" : "tracking");
    },

    dispose() {
      if (disposed) return;
      disposed = true;

      inverseOffset.copy(appliedOffset).invert();
      head.quaternion.multiply(inverseOffset);
      appliedOffset.identity();

      window.removeEventListener("pointermove", followPointer);
      window.removeEventListener("pointerdown", glanceAtTouch);
      document.removeEventListener("pointerout", pointerLeavesWindow);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);

      host.dataset.companionLookEnabled = "false";
      host.dataset.companionLookState = "disabled";
      host.dataset.companionLookYaw = "0.0000";
      host.dataset.companionLookPitch = "0.0000";
    },
  };
}
