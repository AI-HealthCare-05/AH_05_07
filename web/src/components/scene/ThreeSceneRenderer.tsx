import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { sceneComposition, sceneProfile, type SceneRecipe } from "../../ui/sceneRecipes";
import type { SceneLandmark } from "../../ui/scenePolicy";
import {
  livingReplayAttentionEventName,
  type LivingReplayAttentionDetail,
} from "../../ui/livingReplayAttention";
import { createLandmark } from "./environment";
import { createDiorama } from "./diorama";
import { disposeScene } from "./disposeScene";

type Props = {
  screen: "S02" | "S10";
  recipe: SceneRecipe;
  landmark: SceneLandmark["id"];
  visible: boolean;
  onReady: () => void;
  onFailure: () => void;
};

const REPLAY_MAX_YAW = 0.16;
const REPLAY_MAX_PITCH = 0.075;
const REPLAY_HEAD_YAW_SHARE = 0.78;
const REPLAY_SPINE_YAW_SHARE = 0.22;
const REPLAY_HEAD_PITCH_SHARE = 0.82;
const REPLAY_SPINE_PITCH_SHARE = 0.18;
const REPLAY_CUE_MS = 900;
const REPLAY_RAMP_IN_MS = 150;
const REPLAY_RAMP_OUT_MS = 250;

function replayTarget(clientX: number, clientY: number) {
  const width = Math.max(window.innerWidth, 1);
  const height = Math.max(window.innerHeight, 1);
  const normalizedX = THREE.MathUtils.clamp((clientX / width) * 2 - 1, -1, 1);
  const normalizedY = THREE.MathUtils.clamp(1 - (clientY / height) * 2, -1, 1);
  return {
    yaw: normalizedX * REPLAY_MAX_YAW,
    pitch: normalizedY * REPLAY_MAX_PITCH,
  };
}

function replayStrength(elapsedMs: number) {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs < REPLAY_RAMP_IN_MS) return elapsedMs / REPLAY_RAMP_IN_MS;
  const rampOutStart = REPLAY_CUE_MS - REPLAY_RAMP_OUT_MS;
  if (elapsedMs < rampOutStart) return 1;
  if (elapsedMs < REPLAY_CUE_MS) {
    return 1 - ((elapsedMs - rampOutStart) / REPLAY_RAMP_OUT_MS);
  }
  return 0;
}

/** Neutral clay study. No AnimationMixer, dynamic shadow pass or persistent frame loop. */
export default function ThreeSceneRenderer({ screen, recipe, landmark, visible, onReady, onFailure }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onFailure });
  callbacks.current = { onReady, onFailure };
  const recipeRef = useRef(recipe);
  recipeRef.current = recipe;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const invalidate = useRef<(() => void) | null>(null);

  useEffect(() => { if (visible) invalidate.current?.(); }, [visible]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let loaded = false;
    let renderer: THREE.WebGLRenderer | undefined;
    let observer: ResizeObserver | undefined;
    let model: THREE.Object3D | undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 1.5, -1.5, 0.1, 40);
    let profile = sceneProfile(window.innerWidth);
    let environment = recipe.environment === "diorama" ? createDiorama(landmark, profile) : createLandmark(landmark);
    scene.add(environment);
    let ready = false;
    let failed = false;
    let compiled = false;
    let compiling = false;
    let gpuContext: WebGL2RenderingContext | undefined;
    let gpuSync: WebGLSync | null = null;
    let gpuPollFrame: number | undefined;
    let revealFrame: number | undefined;
    let removeReplayAttention: (() => void) | undefined;
    const deleteGpuSync = () => {
      if (gpuContext && gpuSync) {
        try { gpuContext.deleteSync(gpuSync); } catch { /* Context loss already invalidated it. */ }
      }
      gpuSync = null;
      gpuContext = undefined;
    };
    const cancelWarmup = () => {
      if (gpuPollFrame !== undefined) window.cancelAnimationFrame(gpuPollFrame);
      if (revealFrame !== undefined) window.cancelAnimationFrame(revealFrame);
      gpuPollFrame = undefined;
      revealFrame = undefined;
      deleteGpuSync();
    };
    const fail = () => {
      if (disposed || failed) return;
      failed = true;
      cancelWarmup();
      callbacks.current.onFailure();
    };
    const draw = () => {
      if (disposed || !renderer || !visibleRef.current || !loaded) return;
      try {
        renderer.render(scene, camera);
        element.dataset.drawCalls = String(renderer.info.render.calls);
        element.dataset.triangles = String(renderer.info.render.triangles);
        if (model) {
          const bounds = new THREE.Box3().setFromObject(model);
          const corners = [bounds.min.x, bounds.max.x].flatMap(x =>
            [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z =>
              new THREE.Vector3(x, y, z).project(camera))));
          const left = Math.min(...corners.map(point => point.x));
          const right = Math.max(...corners.map(point => point.x));
          const bottom = Math.min(...corners.map(point => point.y));
          const top = Math.max(...corners.map(point => point.y));
          element.dataset.subjectBounds = JSON.stringify({ left, right, bottom, top, height: (top - bottom) * element.clientHeight / 2 });
        }
        return true;
      } catch { fail(); return false; }
    };
    const setupReplayAttention = (animatedModel: THREE.Object3D) => {
      if (screen !== "S10") return;

      const head = animatedModel.getObjectByName("head");
      const spineCandidate = animatedModel.getObjectByName("spine");
      if (!(head instanceof THREE.Bone)) {
        element.dataset.companionLookEnabled = "false";
        element.dataset.companionLookState = "unavailable";
        return;
      }

      const spine = spineCandidate instanceof THREE.Bone ? spineCandidate : undefined;
      const baseHead = head.quaternion.clone();
      const baseSpine = spine?.quaternion.clone();
      const headOffset = new THREE.Quaternion();
      const spineOffset = new THREE.Quaternion();
      const headEuler = new THREE.Euler(0, 0, 0, "YXZ");
      const spineEuler = new THREE.Euler(0, 0, 0, "YXZ");
      const headYawShare = spine ? REPLAY_HEAD_YAW_SHARE : 1;
      const spineYawShare = spine ? REPLAY_SPINE_YAW_SHARE : 0;
      const headPitchShare = spine ? REPLAY_HEAD_PITCH_SHARE : 1;
      const spinePitchShare = spine ? REPLAY_SPINE_PITCH_SHARE : 0;

      let replayFrame: number | undefined;
      let cueStartedAt = 0;
      let cueYaw = 0;
      let cuePitch = 0;
      let cueCount = 0;

      const writeLook = (
        yaw: number,
        pitch: number,
        state: "centered" | "replay-cue",
        source: "none" | "replay",
      ) => {
        element.dataset.companionLookState = state;
        element.dataset.companionLookSource = source;
        element.dataset.companionLookYaw = yaw.toFixed(4);
        element.dataset.companionLookPitch = pitch.toFixed(4);
        element.dataset.companionLookHeadYaw = (yaw * headYawShare).toFixed(4);
        element.dataset.companionLookSpineYaw = (yaw * spineYawShare).toFixed(4);
        element.dataset.companionLookHeadPitch = (pitch * headPitchShare).toFixed(4);
        element.dataset.companionLookSpinePitch = (pitch * spinePitchShare).toFixed(4);
      };

      const applyLook = (strength: number) => {
        const yaw = cueYaw * strength;
        const pitch = cuePitch * strength;

        headEuler.set(pitch * headPitchShare, yaw * headYawShare, 0, "YXZ");
        headOffset.setFromEuler(headEuler);
        head.quaternion.copy(baseHead).multiply(headOffset);

        if (spine && baseSpine) {
          spineEuler.set(pitch * spinePitchShare, yaw * spineYawShare, 0, "YXZ");
          spineOffset.setFromEuler(spineEuler);
          spine.quaternion.copy(baseSpine).multiply(spineOffset);
        }

        writeLook(
          yaw,
          pitch,
          strength > 0 ? "replay-cue" : "centered",
          strength > 0 ? "replay" : "none",
        );
      };

      const stopFrame = () => {
        if (replayFrame !== undefined) {
          window.cancelAnimationFrame(replayFrame);
          replayFrame = undefined;
        }
      };

      const settle = () => {
        stopFrame();
        cueStartedAt = 0;
        applyLook(0);
        element.dataset.companionReplayCue = "none";
        if (!disposed) draw();
      };

      const stepCue = (now: number) => {
        replayFrame = undefined;
        if (disposed) return;
        const elapsed = now - cueStartedAt;
        const strength = replayStrength(elapsed);
        applyLook(strength);
        draw();

        if (elapsed < REPLAY_CUE_MS) {
          replayFrame = window.requestAnimationFrame(stepCue);
        } else {
          settle();
        }
      };

      const followReplayFocus = (event: Event) => {
        if (disposed || !visibleRef.current) return;
        const detail = (event as CustomEvent<LivingReplayAttentionDetail>).detail;
        if (!detail || detail.kind !== "day-focus") return;

        stopFrame();
        const target = replayTarget(detail.clientX, detail.clientY);
        cueYaw = target.yaw;
        cuePitch = target.pitch;
        cueStartedAt = performance.now();
        cueCount += 1;
        element.dataset.companionReplayCue = "day-focus";
        element.dataset.companionReplayCueCount = String(cueCount);
        element.dataset.companionLookState = "replay-cue";
        element.dataset.companionLookSource = "replay";
        replayFrame = window.requestAnimationFrame(stepCue);
      };

      element.dataset.companionLookEnabled = "true";
      element.dataset.companionLookPosture = spine ? "head-spine" : "head-only";
      element.dataset.companionLookHeadBone = head.name;
      element.dataset.companionLookSpineBone = spine?.name ?? "none";
      element.dataset.companionLookHeadYawShare = headYawShare.toFixed(2);
      element.dataset.companionLookSpineYawShare = spineYawShare.toFixed(2);
      element.dataset.companionLookHeadPitchShare = headPitchShare.toFixed(2);
      element.dataset.companionLookSpinePitchShare = spinePitchShare.toFixed(2);
      element.dataset.companionLookMaxYaw = REPLAY_MAX_YAW.toFixed(3);
      element.dataset.companionLookMaxPitch = REPLAY_MAX_PITCH.toFixed(3);
      element.dataset.companionReplayCue = "none";
      element.dataset.companionReplayCueCount = "0";
      writeLook(0, 0, "centered", "none");

      window.addEventListener(
        livingReplayAttentionEventName,
        followReplayFocus as EventListener,
      );

      removeReplayAttention = () => {
        window.removeEventListener(
          livingReplayAttentionEventName,
          followReplayFocus as EventListener,
        );
        stopFrame();
        head.quaternion.copy(baseHead);
        if (spine && baseSpine) spine.quaternion.copy(baseSpine);
        element.dataset.companionLookEnabled = "false";
        element.dataset.companionLookState = "disabled";
        element.dataset.companionLookSource = "none";
        element.dataset.companionReplayCue = "none";
      };
    };

    const waitForGpu = () => {
      if (!renderer || disposed || failed || ready) return;
      const context = renderer.getContext();
      if (!(context instanceof WebGL2RenderingContext)) { fail(); return; }
      gpuContext = context;
      try {
        gpuSync = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (!gpuSync) { fail(); return; }
        context.flush();
      } catch { fail(); return; }
      const poll = () => {
        gpuPollFrame = undefined;
        if (disposed || failed || ready || !gpuSync) return;
        let status: GLenum;
        try { status = context.clientWaitSync(gpuSync, 0, 0); }
        catch { fail(); return; }
        if (status === context.TIMEOUT_EXPIRED) {
          gpuPollFrame = window.requestAnimationFrame(poll);
          return;
        }
        if (status !== context.ALREADY_SIGNALED && status !== context.CONDITION_SATISFIED) {
          fail();
          return;
        }
        deleteGpuSync();
        // React exposes the canvas and removes the poster on a browser frame
        // after the hidden render's submitted GPU work has completed.
        revealFrame = window.requestAnimationFrame(() => {
          revealFrame = undefined;
          if (disposed || failed || ready) return;
          ready = true;
          callbacks.current.onReady();
        });
      };
      gpuPollFrame = window.requestAnimationFrame(poll);
    };
    const render = async () => {
      if (disposed || failed || !renderer || !visibleRef.current || !loaded) return;
      if (ready) { draw(); return; }
      if (compiling || gpuSync || gpuPollFrame !== undefined || revealFrame !== undefined) return;
      if (!compiled) {
        compiling = true;
        try {
          await renderer.compileAsync(scene, camera);
          compiled = true;
        } catch { fail(); return; }
        finally { compiling = false; }
      }
      if (!draw()) return;
      waitForGpu();
    };
    const resize = () => {
      if (!renderer || disposed) return;
      if (!ready && (gpuSync || gpuPollFrame !== undefined || revealFrame !== undefined)) cancelWarmup();
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      const nextProfile = sceneProfile(window.innerWidth);
      if (recipe.environment === "diorama" && nextProfile !== profile) {
        scene.remove(environment);
        disposeScene(environment);
        environment = createDiorama(landmark, nextProfile);
        scene.add(environment);
      }
      profile = nextProfile;
      element.dataset.environmentKind = recipe.environment;
      element.dataset.environmentLandmarks = JSON.stringify(environment.userData.landmarkIds ?? [landmark]);
      const { camera: cameraRecipe } = sceneComposition(recipeRef.current, window.innerWidth);
      const vertical = cameraRecipe.verticalSpan;
      const horizontal = vertical * width / height;
      camera.left = -horizontal / 2;
      camera.right = horizontal / 2;
      camera.top = vertical / 2;
      camera.bottom = -vertical / 2;
      camera.position.fromArray(cameraRecipe.position);
      camera.lookAt(new THREE.Vector3().fromArray(cameraRecipe.target));
      camera.updateProjectionMatrix();
      environment.position.fromArray(cameraRecipe.environmentAnchor);
      environment.scale.setScalar(cameraRecipe.environmentScale);
      if (model) model.position.fromArray(cameraRecipe.characterAnchor);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.setSize(width, height, false);
      void render();
    };
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = false;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.addEventListener("webglcontextlost", fail);
      element.append(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xfff7e7, 0x75806a, 2.7));
      const light = new THREE.DirectionalLight(0xfff5e3, 2.4);
      light.position.set(-3, 6, 4);
      scene.add(light);
      observer = new ResizeObserver(resize);
      observer.observe(element);
      invalidate.current = resize;
      resize();
      new GLTFLoader().load(recipe.characterUrl, (gltf) => {
        if (disposed) { disposeScene(gltf.scene); return; }
        if (!gltf.animations.some((clip) => clip.name === "idle")) { disposeScene(gltf.scene); fail(); return; }
        const normalized = new THREE.Group();
        normalized.add(gltf.scene);
        model = new THREE.Group();
        model.add(normalized);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = (1.65 / Math.max(size.y, 0.001)) * recipe.characterScale;
        normalized.scale.setScalar(scale);
        normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        // Keep normalization separate from the responsive world-space anchor.
        model.position.set(0, 0.05, 0.65);
        scene.add(model);
        setupReplayAttention(gltf.scene);
        loaded = true;
        resize();
      }, undefined, fail);
    } catch { fail(); }
    return () => {
      disposed = true;
      invalidate.current = null;
      cancelWarmup();
      observer?.disconnect();
      removeReplayAttention?.();
      removeReplayAttention = undefined;
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", fail);
        renderer.domElement.remove();
      }
      disposeScene(scene, renderer);
      renderer?.dispose();
      // Release the context itself on route/recipe exit, not just its assets.
      renderer?.forceContextLoss();
    };
  }, [screen, landmark, recipe.id, recipe.characterUrl]);

  return <div className="living-three-scene" ref={host} aria-hidden="true" />;
}
