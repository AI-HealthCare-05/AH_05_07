import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { companionAssetManifest } from "../../ui/companionAssets.generated";
import type { SavedSceneEvent } from "../../ui/savedScene";
import { disposeScene } from "./disposeScene";

const asset = companionAssetManifest.bear.lite;
// One immutable public asset, bounded to 518,636 bytes. Never retain parsed GPU
// resources or user data across visits. Incomplete requests remain visit-owned.
let cachedBytes: ArrayBuffer | undefined;
async function loadBytes(signal: AbortSignal) {
  if (cachedBytes) return cachedBytes;
  const response = await fetch(asset.url, { signal });
  if (!response.ok) throw new Error("Saved scene asset unavailable");
  const bytes = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
  if (signal.aborted) throw new Error("Saved scene visit ended");
  if (bytes.byteLength !== asset.bytes || hash !== asset.sha256) throw new Error("Saved scene asset identity mismatch");
  cachedBytes = bytes;
  return bytes;
}

type Props = { event: SavedSceneEvent; reducedMotion: boolean; visible: boolean; onReady: () => void; onFailure: () => void };

export default function SavedSceneRenderer({ event, reducedMotion, visible, onReady, onFailure }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const presentation = useRef({ reducedMotion, visible });
  const interrupt = useRef<(() => void) | null>(null);
  presentation.current = { reducedMotion, visible };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const controller = new AbortController();
    let disposed = false;
    let loaded = false;
    let renderer: THREE.WebGLRenderer | undefined;
    let model: THREE.Object3D | undefined;
    let mixer: THREE.AnimationMixer | undefined;
    let frame: number | undefined;
    let motionTimeout: number | undefined;
    let observer: ResizeObserver | undefined;
    let elapsed = 0;
    let previousTime: number | undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    // Leave headroom for the full ear silhouette in the larger review slot.
    camera.position.set(0, 1.1, 3.8);
    camera.lookAt(0, 0.8, 0);
    const allowed = () => presentation.current.visible && !presentation.current.reducedMotion
      && document.visibilityState === "visible" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stopFrames = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (motionTimeout !== undefined) window.clearTimeout(motionTimeout);
      frame = undefined;
      motionTimeout = undefined;
    };
    const draw = () => {
      if (!disposed && presentation.current.visible && document.visibilityState === "visible") renderer?.render(scene, camera);
    };
    let idle: THREE.AnimationAction | undefined;
    const settle = () => {
      stopFrames();
      event.skip();
      mixer?.stopAllAction();
      // A neutral idle sample has no perpetual RAF or delayed celebration queue.
      idle?.reset().play();
      mixer?.update(0);
      element.dataset.savedScenePhase = "idle";
      draw();
    };
    interrupt.current = () => {
      if (!allowed()) settle();
      else draw();
    };
    const fail = () => {
      if (disposed) return;
      stopFrames();
      event.skip();
      onFailure();
    };
    const resize = () => {
      if (!renderer || disposed) return;
      const width = Math.max(element.clientWidth, 1);
      const height = Math.max(element.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.setSize(width, height, false);
      draw();
    };
    element.dataset.savedScenePhase = "pending";
    element.dataset.savedSceneCelebrateCount = "0";

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.addEventListener("webglcontextlost", fail);
      element.append(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xfff8ed, 0x66705f, 2.4));
      const light = new THREE.DirectionalLight(0xffffff, 2.2);
      light.position.set(2, 4, 3);
      scene.add(light);
      observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      void loadBytes(controller.signal).then(bytes => new GLTFLoader().parseAsync(bytes, "")).then(gltf => {
        if (disposed) { disposeScene(gltf.scene); return; }
        model = gltf.scene;
        scene.add(model);
        const celebrateClip = gltf.animations.find(clip => clip.name === "celebrate");
        const idleClip = gltf.animations.find(clip => clip.name === "idle");
        if (!celebrateClip || !idleClip || !Number.isFinite(celebrateClip.duration) || celebrateClip.duration <= 0 || celebrateClip.duration > 10) { fail(); return; }
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 1.7 / Math.max(size.x, size.y, size.z, 0.001);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        mixer = new THREE.AnimationMixer(model);
        idle = mixer.clipAction(idleClip);
        resize();
        if (allowed() && event.claim()) {
          const action = mixer.clipAction(celebrateClip).reset().setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
          mixer.update(0);
          element.dataset.savedScenePhase = "celebrate";
          element.dataset.savedSceneCelebrateCount = "1";
          const tick = (time: number) => {
            frame = undefined;
            if (disposed) return;
            if (!allowed()) { settle(); return; }
            const delta = previousTime === undefined ? 0 : Math.max(0, (time - previousTime) / 1000);
            previousTime = time;
            elapsed += delta;
            if (elapsed >= celebrateClip.duration) { settle(); return; }
            mixer?.update(delta);
            draw();
            frame = window.requestAnimationFrame(tick);
          };
          frame = window.requestAnimationFrame(tick);
          motionTimeout = window.setTimeout(settle, Math.ceil(celebrateClip.duration * 1000) + 500);
        } else settle();
        draw();
        loaded = true;
        onReady();
      }).catch(fail);
    } catch { fail(); }

    return () => {
      disposed = true;
      event.skip();
      // A visit interrupted before readiness stays at CSS on return. A fresh
      // confirmed event may try again; preference changes never retry it.
      if (!loaded) event.failed = true;
      controller.abort();
      stopFrames();
      interrupt.current = null;
      observer?.disconnect();
      mixer?.stopAllAction();
      if (model) mixer?.uncacheRoot(model);
      disposeScene(scene, renderer);
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", fail);
        renderer.domElement.remove();
        renderer.dispose();
        renderer.forceContextLoss();
      }
    };
  }, [event, onReady, onFailure]);

  useEffect(() => { interrupt.current?.(); }, [reducedMotion, visible]);
  return <div ref={host} className="companion-runtime-canvas" data-saved-scene-renderer aria-hidden="true" />;
}
