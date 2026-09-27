import {
  AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, PropertyBinding, Vector3,
  type AnimationAction, type AnimationClip, type WebGLRenderer,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { disposeScene } from "../components/scene/disposeScene";
import { companionClips } from "../ui/companion";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import { validateMySpaceCompanion } from "../ui/mySpaceCompanion";

export type CompanionPose = "loading" | "idle" | "greet" | "neutral" | "unavailable";
type Load = (url: string, loaded: (gltf: GLTF) => void, failed: () => void) => void;
const load: Load = (url, loaded, failed) => { new GLTFLoader().load(url, loaded, undefined, failed); };

export function validateCompanionClips(clips: readonly AnimationClip[]) {
  const names = new Set(clips.map((clip) => clip.name));
  if (clips.length !== companionClips.length || names.size !== companionClips.length
    || companionClips.some((name) => !names.has(name))
    || clips.some((clip) => !Number.isFinite(clip.duration) || clip.duration <= 0 || clip.duration > 30
      || !clip.tracks.length || !clip.validate()
      || clip.tracks.some((track) => [...track.times, ...track.values].some((value) => !Number.isFinite(value))))) {
    throw new Error("Invalid companion clip contract");
  }
}

/** Visit-owned GLB/animation only. No presence port, storage, health or task inputs. */
export class MySpaceCompanionActor {
  readonly root = new Group();
  pose: CompanionPose = "loading";
  #model: Group | null = null;
  #mixer: AnimationMixer | null = null;
  #idle: AnimationAction | null = null;
  #greet: AnimationAction | null = null;
  #reduced = false;
  #disposed = false;
  #started = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly changed: (pose: CompanionPose) => void = () => {}) {}

  #set(pose: CompanionPose) { this.pose = pose; this.changed(pose); }

  start(asset: CompanionAsset | null, loader: Load = load) {
    if (this.#started || this.#disposed) return;
    this.#started = true;
    const fail = () => {
      clearTimeout(this.#timer);
      if (!this.#disposed) this.#set("unavailable");
    };
    try {
      if (!asset) { fail(); return; }
      const selected = validateMySpaceCompanion(asset);
      this.#timer = setTimeout(fail, 12000);
      loader(selected.url, (gltf) => {
        if (this.#disposed || this.pose === "unavailable") { disposeScene(gltf.scene); return; }
        clearTimeout(this.#timer);
        try {
          validateCompanionClips(gltf.animations);
          for (const clip of gltf.animations) for (const track of clip.tracks) {
            const target = PropertyBinding.parseTrackName(track.name);
            if (!PropertyBinding.findNode(gltf.scene, target.nodeName)) throw new Error("Missing companion clip target");
          }
          // Normalize a wrapper, as S02 does: clip tracks retain their authored transforms.
          gltf.scene.updateMatrixWorld(true);
          const box = new Box3().setFromObject(gltf.scene);
          const size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
          if (box.isEmpty() || ![...size.toArray(), ...center.toArray()].every(Number.isFinite) || size.y <= 0) {
            throw new Error("Invalid companion bounds");
          }
          const normalized = new Group(), scale = 1.05 / Math.max(size.x, size.y, size.z);
          normalized.add(gltf.scene);
          normalized.scale.setScalar(scale);
          normalized.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
          this.root.add(normalized);
          this.#model = gltf.scene;
          this.#mixer = new AnimationMixer(gltf.scene);
          this.#idle = this.#mixer.clipAction(gltf.animations.find((clip) => clip.name === "idle")!);
          this.#greet = this.#mixer.clipAction(gltf.animations.find((clip) => clip.name === "greet")!);
          this.#mixer.addEventListener("finished", this.#finished);
          this.setReducedMotion(this.#reduced);
        } catch {
          this.#release();
          // Before ownership was transferred, failed GLBs still need deterministic release.
          disposeScene(gltf.scene);
          this.root.clear(); fail();
        }
      }, fail);
    } catch { fail(); }
  }

  #finished = (event: { action: AnimationAction }) => {
    if (!this.#disposed && event.action === this.#greet) this.#playIdle();
  };
  #playIdle() {
    this.#mixer?.stopAllAction();
    this.#idle?.reset().setLoop(LoopRepeat, Infinity).play();
    this.#mixer?.update(0);
    this.#set("idle");
  }
  setReducedMotion(reduced: boolean) {
    this.#reduced = reduced;
    if (!this.#mixer || this.#disposed) return;
    // stopAllAction restores the original neutral pose, including interrupted greetings.
    this.#mixer.stopAllAction();
    if (reduced) this.#set("neutral"); else this.#playIdle();
  }
  greet(): boolean {
    if (this.#disposed || !this.#mixer || this.pose === "greet") return false;
    if (this.#reduced) return true; // The semantic response remains available without motion.
    this.#mixer.stopAllAction();
    this.#greet!.reset().setLoop(LoopOnce, 1).play();
    this.#greet!.clampWhenFinished = true;
    this.#set("greet");
    return true;
  }
  step(seconds: number) {
    if (!this.#disposed && !this.#reduced) this.#mixer?.update(Math.max(0, Math.min(seconds, 0.05)));
  }
  #release() {
    this.#mixer?.removeEventListener("finished", this.#finished);
    this.#mixer?.stopAllAction();
    if (this.#model) this.#mixer?.uncacheRoot(this.#model);
    this.#mixer = null; this.#idle = null; this.#greet = null; this.#model = null;
  }
  dispose(renderer?: WebGLRenderer) {
    if (this.#disposed) return;
    this.#disposed = true; clearTimeout(this.#timer); this.#release();
    disposeScene(this.root, renderer); this.root.removeFromParent(); this.root.clear();
  }
}
