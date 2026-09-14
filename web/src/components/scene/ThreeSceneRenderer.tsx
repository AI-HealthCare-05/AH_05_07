import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { sceneComposition, sceneProfile, type SceneRecipe } from "../../ui/sceneRecipes";
import type { SceneLandmark } from "../../ui/scenePolicy";
import { createLandmark } from "./environment";
import { createDiorama } from "./diorama";
import { disposeScene } from "./disposeScene";

type Props = { recipe: SceneRecipe; landmark: SceneLandmark["id"]; visible: boolean; onReady: () => void; onFailure: () => void };

/** Neutral clay study. No AnimationMixer, dynamic shadow pass or frame loop. */
export default function ThreeSceneRenderer({ recipe, landmark, visible, onReady, onFailure }: Props) {
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
    // A tiny authored alpha mask grounds the neutral pose without a shadow map.
    const shadowPixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const offset = (y * 64 + x) * 4;
      shadowPixels.set([85, 68, 52, Math.round(Math.max(0, Math.exp(-(((x - 31.5) / 21) ** 2 + ((y - 31.5) / 21) ** 2) * 2) - 0.01) * 70)], offset);
    }
    const shadowTexture = new THREE.DataTexture(shadowPixels, 64, 64);
    shadowTexture.needsUpdate = true;
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.9),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
    contactShadow.rotation.x = -Math.PI / 2;
    scene.add(contactShadow);
    let ready = false;
    let failed = false;
    let compiled = false;
    let compiling = false;
    let gpuContext: WebGL2RenderingContext | undefined;
    let gpuSync: WebGLSync | null = null;
    let gpuPollFrame: number | undefined;
    let revealFrame: number | undefined;
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
      contactShadow.position.fromArray(cameraRecipe.characterAnchor);
      contactShadow.position.y -= 0.005;
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
      renderer.initTexture(shadowTexture);
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
        const scale = 1.65 / Math.max(size.y, 0.001);
        normalized.scale.setScalar(scale);
        normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        // Keep normalization separate from the responsive world-space anchor.
        model.position.set(0, 0.05, 0.65);
        scene.add(model);
        loaded = true;
        resize();
      }, undefined, fail);
    } catch { fail(); }
    return () => {
      disposed = true;
      invalidate.current = null;
      cancelWarmup();
      observer?.disconnect();
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", fail);
        renderer.domElement.remove();
      }
      disposeScene(scene, renderer);
      renderer?.dispose();
      // Release the context itself on route/recipe exit, not just its assets.
      renderer?.forceContextLoss();
    };
  }, [landmark, recipe.id, recipe.characterUrl]);

  return <div className="living-three-scene" ref={host} aria-hidden="true" />;
}
