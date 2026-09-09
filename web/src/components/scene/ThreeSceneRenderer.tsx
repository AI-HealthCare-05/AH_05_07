import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { sceneComposition, type SceneRecipe } from "../../ui/sceneRecipes";
import type { SceneLandmark } from "../../ui/scenePolicy";
import { createLandmark } from "./environment";

type Props = { recipe: SceneRecipe; landmark: SceneLandmark["id"]; visible: boolean; onReady: () => void; onFailure: () => void };

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  skeletons.forEach((value) => value.dispose());
  textures.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  geometries.forEach((value) => value.dispose());
}

/** Neutral-pose prototype. No AnimationMixer and no animation frame loop. */
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
    const environment = createLandmark(landmark);
    scene.add(environment);
    const fail = () => { if (!disposed) callbacks.current.onFailure(); };
    const render = () => {
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
        callbacks.current.onReady();
      } catch { fail(); }
    };
    const resize = () => {
      if (!renderer || disposed) return;
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
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
      render();
    };
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
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
        if (disposed) { disposeTree(gltf.scene); return; }
        if (!gltf.animations.some((clip) => clip.name === "idle")) { disposeTree(gltf.scene); fail(); return; }
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
      observer?.disconnect();
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", fail);
        renderer.domElement.remove();
      }
      disposeTree(scene);
      renderer?.dispose();
    };
  }, [landmark, recipe.id, recipe.characterUrl]);

  return <div className="living-three-scene" ref={host} aria-hidden="true" />;
}
