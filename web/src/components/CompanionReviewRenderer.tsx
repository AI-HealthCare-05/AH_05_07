import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { companionClips, type CompanionSelection } from "../ui/companion";
import { getCompanionAsset } from "../ui/companionAssets.generated";

type CompanionReviewRendererProps = Readonly<{
  selection: CompanionSelection;
  reducedMotion: boolean;
}>;
type RenderStatus = "loading" | "ready" | "error";

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

export default function CompanionReviewRenderer({ selection, reducedMotion }: CompanionReviewRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatusState] = useState<RenderStatus>("loading");

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
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    setStatus(host, "loading");
    host.dataset.companionMotion = reducedMotion ? "stopped" : "pending";
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
        camera.lookAt(0, 0.8, 0);
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
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(selectedClip).reset().play();
          host.dataset.companionMotion = "playing";
          render();
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
      mixer?.stopAllAction();
      if (model) disposeObject(model);
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [reducedMotion, selection]);

  return <div ref={hostRef} className="companion-runtime-canvas" data-companion-status={status} />;
}
