import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { companionClips, type CompanionSelection } from "../ui/companion";
import { getCompanionAsset } from "../ui/companionAssets.generated";
import type { CompanionFraming } from "./CompanionRuntimeBoundary";

type CompanionReviewRendererProps = Readonly<{
  selection: CompanionSelection;
  reducedMotion: boolean;
  framing?: CompanionFraming;
}>;
type RenderStatus = "loading" | "ready" | "error";
type AnimationController = {
  play: (selection: CompanionSelection, reducedMotion: boolean) => void;
  dispose: () => void;
};

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

export default function CompanionReviewRenderer({ selection, reducedMotion, framing = "default" }: CompanionReviewRendererProps) {
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
    const scene = new THREE.Scene();
    // The larger journey S05 slot needs head/foot room throughout celebrate and idle.
    // Keep the original camera for every legacy/review caller.
    const camera = new THREE.PerspectiveCamera(framing === "journey-s05" ? 34 : 28, 1, 0.01, 100);
    setStatus(host, "loading");
    host.dataset.companionMotion = reducedMotion ? "stopped" : "pending";
    host.dataset.companionPhase = reducedMotion ? "idle" : "pending";
    host.dataset.companionCelebrateCount = "0";
    setStatusState("loading");

    const fail = () => {
      if (disposed) return;
      setStatus(host, "error");
      host.dataset.companionMotion = "stopped";
      setStatusState("error");
    };
    const render = () => {
      if (disposed || !renderer) return;
      mixer?.update(1 / 60);
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
        setStatus(host, clipsMatch ? "ready" : "error", clipNames.join(","));
        if (!clipsMatch) {
          disposeObject(gltf.scene);
          setStatusState("error");
          return;
        }
        model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 1.7 / maxDimension;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        scene.add(model);
        camera.lookAt(0, framing === "journey-s05" ? 0.85 : 0.8, 0);
        resize();
        const selectedClip = gltf.animations.find((clip) => clip.name === selection.clip);
        if (!selectedClip) {
          fail();
          return;
        }
        if (reducedMotion) {
          host.dataset.companionMotion = "stopped";
          renderer?.render(scene, camera);
        } else {
           const animationMixer = new THREE.AnimationMixer(model);
           mixer = animationMixer;
           const actions = new Map(companionClips.map((clip) => [clip, animationMixer.clipAction(gltf.animations.find((candidate) => candidate.name === clip)!)] as const));
           let currentAction: THREE.AnimationAction | null = null;
           let finishedListener: ((event: { action: THREE.AnimationAction }) => void) | null = null;
           const stopCurrent = () => {
             if (finishedListener) animationMixer.removeEventListener("finished", finishedListener);
             finishedListener = null;
             currentAction?.stop();
             currentAction = null;
             animationMixer.stopAllAction();
           };
           const play = (nextSelection: CompanionSelection, nextReducedMotion: boolean) => {
             stopCurrent();
             if (nextReducedMotion) {
               host.dataset.companionMotion = "stopped";
               host.dataset.companionPhase = "idle";
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
               };
               finishedListener = onFinished;
               animationMixer.addEventListener("finished", onFinished);
               currentAction = celebrateAction;
               const count = Number(host.dataset.companionCelebrateCount || "0") + 1;
               host.dataset.companionCelebrateCount = String(count);
               host.dataset.companionPhase = "celebrate";
               host.dataset.companionMotion = "playing";
               celebrateAction.play();
             } else {
               currentAction = nextAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
               host.dataset.companionPhase = nextSelection.clip;
               host.dataset.companionMotion = "playing";
             }
           };
           const controller: AnimationController = {
             play,
             dispose: stopCurrent,
           };
           controllerRef.current = controller;
           play(latestSelectionRef.current, reducedMotion);
           if (!reducedMotion) render();
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
      if (model) disposeObject(model);
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [framing, reducedMotion, selection.species, selection.variant]);

  useEffect(() => {
    controllerRef.current?.play(selection, reducedMotion);
  }, [reducedMotion, selection.clip, selection.sequence]);

  return <div ref={hostRef} className="companion-runtime-canvas" data-companion-status={status} data-companion-framing={framing} />;
}
