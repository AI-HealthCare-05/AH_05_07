import type { AccountIdentity } from "./persistence";

type Candidate = Readonly<{ owner: string; token: string }>;
export type AccountBindingStatus = "checking" | "ready" | "signed-out" | "unavailable";

/** Only the product entry may turn a candidate auth session into a verified binding. */
export class VerifiedAccountBinding {
  #current: AccountIdentity | null = null;
  #generation = 0;
  #disposed = false;
  constructor(
    readonly verifyOwner: (token: string) => Promise<string | null>,
    readonly publish: (identity: AccountIdentity | null, status: AccountBindingStatus) => void,
  ) {}
  current = () => this.#current;
  async update(candidate: Candidate | null) {
    if (this.#disposed) return;
    const generation = ++this.#generation;
    // Invalidate synchronously, before any verification or React remount completes.
    this.#current = null;
    this.publish(null, candidate ? "checking" : "signed-out");
    if (!candidate) return;
    const captured = Object.freeze({ ...candidate });
    try {
      const owner = await this.verifyOwner(captured.token);
      if (this.#disposed || this.#generation !== generation) return;
      if (owner !== captured.owner) { this.publish(null, "unavailable"); return; }
      this.#current = Object.freeze({ ...captured, generation });
      this.publish(this.#current, "ready");
    } catch {
      if (!this.#disposed && this.#generation === generation) this.publish(null, "unavailable");
    }
  }
  dispose() { this.#disposed = true; this.#generation++; this.#current = null; }
}
