export type AudioStatus = "muted" | "ready" | "unavailable";
/** User-gesture-only cosmetic sound; no persisted preference or ambient playback. */
export class PlaceableAudio {
  #context: AudioContext | null = null;
  #generation = 0;
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
    } catch { this.dispose(); return "unavailable"; }
  }
  play(cue: "pinwheel" | "twilight" = "pinwheel"): boolean {
    const context = this.#context;
    if (!context || context.state !== "running") return false;
    try {
      const master = context.createGain();
      const start = context.currentTime;
      master.gain.setValueAtTime(0.09, start);
      master.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      master.connect(context.destination);
      const notes = cue === "twilight" ? [392, 493.88, 587.33] : [659.25, 880, 987.77];
      notes.forEach((frequency, index) => {
        const voice = context.createOscillator();
        voice.frequency.value = frequency; voice.connect(master);
        voice.onended = () => { voice.disconnect(); if (index === 2) master.disconnect(); };
        voice.start(start + index * 0.1); voice.stop(start + index * 0.1 + 0.2);
      });
      return true;
    } catch { this.dispose(); return false; }
  }
  dispose() {
    ++this.#generation;
    const context = this.#context; this.#context = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }
}
