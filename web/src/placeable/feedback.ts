export type AudioStatus = "muted" | "ready" | "unavailable";

type ActiveCue = {
  master: GainNode;
  voices: Set<OscillatorNode>;
};

/** User-gesture-only cosmetic sound; no persisted preference or ambient playback. */
export class PlaceableAudio {
  #context: AudioContext | null = null;
  #generation = 0;
  #activeCue: ActiveCue | null = null;

  #stopActiveCue() {
    const active = this.#activeCue;
    if (!active) return;
    // Clear ownership first so a synchronous/late onended callback cannot
    // disconnect resources belonging to a newer cue.
    this.#activeCue = null;
    for (const voice of active.voices) {
      voice.onended = null;
      try { voice.stop(); } catch {}
      try { voice.disconnect(); } catch {}
    }
    active.voices.clear();
    try { active.master.disconnect(); } catch {}
  }

  async enable(): Promise<AudioStatus> {
    const generation = ++this.#generation;
    try {
      const Constructor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return "unavailable";
      const context = this.#context ?? new Constructor();
      this.#context = context;
      await context.resume();
      return generation === this.#generation && context.state === "running" ? "ready" : "unavailable";
    } catch {
      // An older failed resume must never close a context already admitted by
      // a newer enable attempt.
      if (generation === this.#generation) this.dispose();
      return "unavailable";
    }
  }

  play(cue: "pinwheel" | "twilight" = "pinwheel"): boolean {
    const context = this.#context;
    if (!context || context.state !== "running") return false;
    this.#stopActiveCue();
    try {
      const master = context.createGain();
      const active: ActiveCue = { master, voices: new Set() };
      this.#activeCue = active;

      const start = context.currentTime;
      master.gain.setValueAtTime(0.09, start);
      master.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      master.connect(context.destination);

      const notes = cue === "twilight" ? [392, 493.88, 587.33] : [659.25, 880, 987.77];
      notes.forEach((frequency, index) => {
        const voice = context.createOscillator();
        active.voices.add(voice);
        voice.frequency.value = frequency;
        voice.connect(master);
        voice.onended = () => {
          // Replaced voices can finish late; only the currently owned cue may
          // clean up the current master.
          if (this.#activeCue !== active) return;
          active.voices.delete(voice);
          try { voice.disconnect(); } catch {}
          if (!active.voices.size) {
            try { master.disconnect(); } catch {}
            if (this.#activeCue === active) this.#activeCue = null;
          }
        };
        voice.start(start + index * 0.1);
        voice.stop(start + index * 0.1 + 0.2);
      });
      return true;
    } catch {
      this.#stopActiveCue();
      this.dispose();
      return false;
    }
  }

  dispose() {
    ++this.#generation;
    this.#stopActiveCue();
    const context = this.#context;
    this.#context = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }
}
