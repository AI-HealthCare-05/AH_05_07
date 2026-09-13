import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  companionClips,
  getCompanionDecision,
  type CompanionClip,
  type CompanionSelection,
} from "../ui/companion";
import { getCompanionAsset } from "../ui/companionAssets.generated";
import type { CompanionFraming } from "./CompanionRuntimeBoundary";
import {
  createTactileCompanionInteraction,
  type CompanionGrabZone,
  type TactileCompanionInteraction,
} from "./companionInteraction";

type CompanionReviewRendererProps = Readonly<{
  selection: CompanionSelection;
  reducedMotion: boolean;
  framing?: CompanionFraming;
  interactive?: boolean;
}>;
type RenderStatus = "loading" | "ready" | "error";
type AnimationController = {
  play: (selection: CompanionSelection, reducedMotion: boolean) => void;
  react: (zone: CompanionGrabZone) => void;
  releaseReaction: () => void;
  dispose: () => void;
};

const tactileReactionClips: Readonly<Record<CompanionGrabZone, CompanionClip>> = {
  head: "curious",
  body: "greet",
  feet: "rest",
};

const TACTILE_FADE_IN_SECONDS = 0.14;
const TACTILE_FADE_OUT_SECONDS = 0.18;
const TACTILE_MIN_REACTION_VISIBLE_MS = 300;

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach(disposeMaterial);
    else if (mesh.material) disposeMaterial(mesh.material);
  });
}

function setStatus(host: HTMLDivElement, status: RenderStatus, clipNames = "") {
  host.dataset.companionStatus = status;
  host.dataset.companionClipNames = clipNames;
}

export default function CompanionReviewRenderer({ selection, reducedMotion, framing = "default", interactive = false }: CompanionReviewRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AnimationController | null>(null);
  const latestSelectionRef = useRef(selection);
  const [status, setStatusState] = useState<RenderStatus>("loading");
  latestSelectionRef.current = selection;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let frameId: number | undefined;
    let renderer: THREE.WebGLRenderer | undefined;
    let mixer: THREE.AnimationMixer | undefined;
    let model: THREE.Object3D | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let interaction: TactileCompanionInteraction | undefined;
    const scene = new THREE.Scene();
    // The larger journey S05 slot needs head/foot room throughout celebrate and idle.
    // Keep the original camera for every legacy/review caller.
    const camera = new THREE.PerspectiveCamera(framing === "journey-s05" ? 34 : 28, 1, 0.01, 100);
    setStatus(host, "loading");
    host.dataset.companionMotion = reducedMotion ? "stopped" : "pending";
    host.dataset.companionPhase = reducedMotion ? "idle" : "pending";
    host.dataset.companionCelebrateCount = "0";
    host.dataset.companionInteractionEnabled = "false";
    host.dataset.companionInteraction = interactive ? "loading" : "disabled";
    host.dataset.companionReactionState = interactive ? "idle" : "disabled";
    host.dataset.companionReactionClip = selection.clip;
    host.dataset.companionAnimationClip = selection.clip;
    host.dataset.companionMinReactionMs = interactive ? String(TACTILE_MIN_REACTION_VISIBLE_MS) : "0";
    host.dataset.companionOffsetX = "0.0000";
    host.dataset.companionOffsetY = "0.0000";
    setStatusState("loading");

    const fail = () => {
      if (disposed) return;
      if (renderer) renderer.domElement.style.visibility = "hidden";
      setStatus(host, "error");
      host.dataset.companionMotion = "stopped";
      setStatusState("error");
    };
    const render = () => {
      if (disposed || !renderer) return;
      mixer?.update(1 / 60);
      interaction?.step(1 / 60);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    const resize = () => {
      if (disposed || !renderer) return;
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.setAttribute("data-companion-canvas", "true");
      renderer.domElement.style.pointerEvents = "none";
      renderer.domElement.style.visibility = "hidden";
      host.replaceChildren(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xfff8ed, 0x66705f, 2.4));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(2, 4, 3);
      scene.add(keyLight);
      camera.position.set(0, 1.1, 3.4);
      camera.lookAt(0, 0.85, 0);
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const loader = new GLTFLoader();
      const asset = getCompanionAsset(selection.species, selection.variant);
      loader.load(asset.url, (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const clipNames = gltf.animations.map((clip) => clip.name);
        const actual = new Set(clipNames);
        const clipsMatch = clipNames.length === companionClips.length
          && actual.size === companionClips.length
          && companionClips.every((clip) => actual.has(clip));
        if (!clipsMatch) {
          setStatus(host, "error", clipNames.join(","));
          disposeObject(gltf.scene);
          setStatusState("error");
          return;
        }
        const animatedModel = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(animatedModel);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 1.7 / maxDimension;
        animatedModel.scale.setScalar(scale);
        animatedModel.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        model = new THREE.Group();
        model.add(animatedModel);
        scene.add(model);
        camera.lookAt(0, framing === "journey-s05" ? 0.85 : 0.8, 0);
        const selectedClip = gltf.animations.find((clip) => clip.name === selection.clip);
        if (!selectedClip) {
          fail();
          return;
        }
        if (reducedMotion) {
          host.dataset.companionMotion = "stopped";
          // Paint the normalized neutral pose while the loading canvas is hidden,
          // then reveal that already-stable frame.
          resize();
          if (renderer) renderer.domElement.style.visibility = "visible";
          setStatus(host, "ready", clipNames.join(","));
        } else {
           const animationMixer = new THREE.AnimationMixer(animatedModel);
           mixer = animationMixer;
           const actions = new Map(companionClips.map((clip) => [
             clip,
             animationMixer.clipAction(gltf.animations.find((candidate) => candidate.name === clip)!),
           ] as const));
           let currentAction: THREE.AnimationAction | null = null;
           let finishedListener: ((event: { action: THREE.AnimationAction }) => void) | null = null;
           let reactionReleaseTimer: number | undefined;
           let reactionStartedAt = 0;

           const clearReactionReleaseTimer = () => {
             if (reactionReleaseTimer !== undefined) {
               window.clearTimeout(reactionReleaseTimer);
               reactionReleaseTimer = undefined;
             }
           };

           const markAnimation = (clip: CompanionClip, reactionState: "idle" | "active") => {
             host.dataset.companionAnimationClip = clip;
             host.dataset.companionReactionClip = clip;
             host.dataset.companionReactionState = interactive ? reactionState : "disabled";
           };

           const stopCurrent = () => {
             clearReactionReleaseTimer();
             reactionStartedAt = 0;
             if (finishedListener) animationMixer.removeEventListener("finished", finishedListener);
             finishedListener = null;
             currentAction?.stop();
             currentAction = null;
             animationMixer.stopAllAction();
           };

           const settleReactionToIdle = () => {
             reactionReleaseTimer = undefined;
             reactionStartedAt = 0;

             const idleAction = actions.get("idle");
             if (!idleAction) {
               fail();
               return;
             }
             if (currentAction === idleAction) {
               markAnimation("idle", "idle");
               return;
             }

             const previous = currentAction;
             idleAction.reset().setLoop(THREE.LoopRepeat, Infinity);
             idleAction.clampWhenFinished = false;
             idleAction.play();
             if (previous) {
               idleAction.crossFadeFrom(previous, TACTILE_FADE_OUT_SECONDS, false);
             }

             currentAction = idleAction;
             host.dataset.companionPhase = "idle";
             host.dataset.companionMotion = "playing";
             markAnimation("idle", "idle");
           };

           const releaseReaction = () => {
             clearReactionReleaseTimer();

             const elapsed = reactionStartedAt > 0
               ? performance.now() - reactionStartedAt
               : TACTILE_MIN_REACTION_VISIBLE_MS;
             const remaining = Math.max(0, TACTILE_MIN_REACTION_VISIBLE_MS - elapsed);

             if (remaining === 0) {
               settleReactionToIdle();
               return;
             }

             reactionReleaseTimer = window.setTimeout(settleReactionToIdle, remaining);
           };

           const react = (zone: CompanionGrabZone) => {
             const reactionClip = tactileReactionClips[zone];
             if (getCompanionDecision(latestSelectionRef.current.screen, reactionClip).status === "blocked") {
               return;
             }

             clearReactionReleaseTimer();
             reactionStartedAt = performance.now();

             const reactionAction = actions.get(reactionClip);
             if (!reactionAction) {
               fail();
               return;
             }

             const previous = currentAction;
             reactionAction.reset().setLoop(THREE.LoopOnce, 1);
             reactionAction.clampWhenFinished = true;
             reactionAction.play();
             if (previous && previous !== reactionAction) {
               reactionAction.crossFadeFrom(previous, TACTILE_FADE_IN_SECONDS, false);
             }

             currentAction = reactionAction;
             host.dataset.companionPhase = `tactile-${reactionClip}`;
             host.dataset.companionMotion = "playing";
             markAnimation(reactionClip, "active");
           };

           const play = (nextSelection: CompanionSelection, nextReducedMotion: boolean) => {
             stopCurrent();

             if (nextReducedMotion) {
               host.dataset.companionMotion = "stopped";
               host.dataset.companionPhase = "idle";
               markAnimation(nextSelection.clip, "idle");
               renderer?.render(scene, camera);
               return;
             }

             const nextAction = actions.get(nextSelection.clip);
             if (!nextAction) {
               fail();
               return;
             }

             if (nextSelection.sequence === "celebrate_then_idle") {
               const celebrateAction = nextAction.reset();
               celebrateAction.setLoop(THREE.LoopOnce, 1);
               celebrateAction.clampWhenFinished = true;

               const onFinished = (event: { action: THREE.AnimationAction }) => {
                 if (event.action !== celebrateAction || disposed) return;
                 animationMixer.removeEventListener("finished", onFinished);
                 finishedListener = null;
                 celebrateAction.stop();

                 const idleAction = actions.get("idle");
                 if (!idleAction) {
                   fail();
                   return;
                 }

                 currentAction = idleAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
                 host.dataset.companionPhase = "idle";
                 host.dataset.companionMotion = "playing";
                 markAnimation("idle", "idle");
               };

               finishedListener = onFinished;
               animationMixer.addEventListener("finished", onFinished);
               currentAction = celebrateAction;

               const count = Number(host.dataset.companionCelebrateCount || "0") + 1;
               host.dataset.companionCelebrateCount = String(count);
               host.dataset.companionPhase = "celebrate";
               host.dataset.companionMotion = "playing";
               markAnimation("celebrate", "idle");
               celebrateAction.play();
             } else {
               currentAction = nextAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
               host.dataset.companionPhase = nextSelection.clip;
               host.dataset.companionMotion = "playing";
               markAnimation(nextSelection.clip, "idle");
             }
           };

           const controller: AnimationController = {
             play,
             react,
             releaseReaction,
             dispose: stopCurrent,
           };
           controllerRef.current = controller;
           play(latestSelectionRef.current, reducedMotion);
           if (interactive && renderer) {
             interaction = createTactileCompanionInteraction({
               canvas: renderer.domElement,
               host,
               camera,
               target: model,
               onGrabZone: controller.react,
               onReleaseZone: () => controller.releaseReaction(),
             });
           }
           // Prime the selected clip before the first visible model paint. This
           // avoids briefly exposing the bind/neutral pose immediately after a
           // confirmed save before celebrate takes over.
           animationMixer.update(1 / 60);
           resize();
           if (renderer) renderer.domElement.style.visibility = "visible";
           setStatus(host, "ready", clipNames.join(","));
           frameId = window.requestAnimationFrame(render);
        }
        setStatusState("ready");
      }, undefined, fail);
    } catch {
      fail();
    }

    return () => {
      disposed = true;
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      controllerRef.current?.dispose();
      controllerRef.current = null;
      interaction?.dispose();
      interaction = undefined;
      if (model) disposeObject(model);
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [framing, interactive, reducedMotion, selection.species, selection.variant]);

  useEffect(() => {
    controllerRef.current?.play(selection, reducedMotion);
  }, [reducedMotion, selection.clip, selection.sequence]);

  return <div ref={hostRef} className="companion-runtime-canvas" data-companion-status={status} data-companion-framing={framing} />;
}
