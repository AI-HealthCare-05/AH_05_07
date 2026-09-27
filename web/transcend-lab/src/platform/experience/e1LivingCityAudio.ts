type AudioContextConstructor = new () => AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  const candidate = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return candidate ?? null;
}

export type E1AudioStatus = "muted" | "ready" | "unavailable";

export class E1LivingCityAudio {
  #context: AudioContext | null = null;

  get status(): E1AudioStatus {
    if (!this.#context) return "muted";
    return this.#context.state === "running" ? "ready" : "unavailable";
  }

  async enable(): Promise<E1AudioStatus> {
    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) return "unavailable";

    const context = this.#context ?? new AudioContextClass();
    this.#context = context;
    if (context.state === "suspended") await context.resume();
    return this.status;
  }

  playTodayGateChime(): boolean {
    const context = this.#context;
    if (!context || context.state !== "running") return false;

    const start = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(0.14, start + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
    master.connect(context.destination);

    for (const [offset, frequency] of [[0, 659.25], [0.12, 880]] as const) {
      const oscillator = context.createOscillator();
      const voice = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      voice.gain.setValueAtTime(0.0001, start + offset);
      voice.gain.exponentialRampToValueAtTime(0.9, start + offset + 0.012);
      voice.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.24);
      oscillator.connect(voice);
      voice.connect(master);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.26);
    }
    return true;
  }

  dispose(): void {
    const context = this.#context;
    this.#context = null;
    if (context && context.state !== "closed") void context.close();
  }
}
