import { confirms, cosmeticLayout, fingerprint, isKeepsake, isSelection, LAYOUT, LAYOUT_V2, readSnapshot, SCHEMA, SCHEMA_V2, supported,
  type Keepsake, type Operation, type Selection, type Snapshot } from "./contract";
import { PersistenceError, type PlaceablePersistence } from "./persistence";

export type PlaceableState = Readonly<{
  phase: "loading" | "ready" | "saving" | "unknown" | "conflict" | "unavailable" | "unsupported" | "session";
  confirmed: Snapshot | null;
  // undefined = no draft; null = explicit removal preview.
  draft: Selection | null | undefined;
  keepsakeDraft: Keepsake | null | undefined;
  pending: Readonly<{ operation: Operation; fingerprint: string }> | null;
  saved: boolean;
  pulse: number;
}>;

/** One E2 state machine for both presentations. Frames/proximity never call this adapter. */
export class PlaceableController {
  #state: PlaceableState = { phase: "loading", confirmed: null, draft: undefined, keepsakeDraft: undefined, pending: null, saved: false, pulse: 0 };
  #listeners = new Set<() => void>();
  #epoch = 0;
  #disposed = false;
  constructor(readonly adapter: PlaceablePersistence) {}
  getState = () => this.#state;
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; };
  #set(change: Partial<PlaceableState>) {
    this.#state = Object.freeze({ ...this.#state, ...change });
    for (const listener of this.#listeners) listener();
  }
  #current(epoch: number) { return !this.#disposed && epoch === this.#epoch; }
  dispose() { this.#disposed = true; this.#epoch++; this.#listeners.clear(); }
  async load() {
    if (this.#disposed || this.#state.phase === "saving") return;
    const epoch = ++this.#epoch;
    const { pending, draft, keepsakeDraft, confirmed, phase } = this.#state;
    this.#set({ phase: "loading", saved: false });
    try {
      const snapshot = readSnapshot(await this.adapter.read());
      if (!this.#current(epoch)) return;
      if (confirmed && snapshot.revision < confirmed.revision) throw new PersistenceError("unavailable");
      if (pending && confirms(snapshot, pending.operation, pending.fingerprint)) {
        this.#set({ confirmed: snapshot, draft: undefined, keepsakeDraft: undefined, pending: null, phase: "ready", saved: true });
      } else if (!supported(snapshot)) {
        this.#set({ confirmed: snapshot, pending: null, phase: "unsupported" });
      } else if (pending && snapshot.revision <= pending.operation.expectedRevision) {
        // A reread of the old revision cannot prove that the in-flight write won't
        // commit later. Keep the immutable operation; only that operation may retry.
        this.#set({ phase: "unknown" });
      } else {
        this.#set({ confirmed: snapshot, pending: null,
          phase: pending || phase === "conflict" || ((draft !== undefined || keepsakeDraft !== undefined) && confirmed?.revision !== snapshot.revision)
            ? "conflict" : "ready", saved: draft === undefined && keepsakeDraft === undefined && snapshot.revision > 0 });
      }
    } catch (error) {
      if (this.#current(epoch)) this.#set({ phase: error instanceof PersistenceError && error.kind === "session"
        ? "session" : pending ? "unknown" : "unavailable" });
    }
  }
  preview(selection: Selection | null) {
    if (this.#disposed || this.#state.phase !== "ready" || !this.#state.confirmed || !isSelection(selection)) return;
    this.#set({ draft: selection === null ? null : Object.freeze({ ...selection }), saved: false });
  }
  previewKeepsake(keepsake: Keepsake | null) {
    if (this.#disposed || this.#state.phase !== "ready" || !this.#state.confirmed || !isKeepsake(keepsake)) return;
    this.#set({ keepsakeDraft: keepsake, saved: false });
  }
  cancel() {
    if (this.#disposed || (this.#state.phase !== "ready" && this.#state.phase !== "conflict")) return;
    this.#set({ draft: undefined, keepsakeDraft: undefined, saved: Boolean(this.#state.confirmed?.revision), phase: "ready" });
  }
  reviewLatest() {
    if (!this.#disposed && this.#state.phase === "conflict") this.#set({ phase: "ready", saved: false });
  }
  interact() {
    if (this.#disposed) return;
    const state = this.#state;
    if (state.phase === "ready" && state.draft === undefined && state.keepsakeDraft === undefined && cosmeticLayout(state.confirmed).pinwheel) {
      this.#set({ pulse: state.pulse + 1 });
    }
  }
  async confirm() {
    const { phase, confirmed, draft, keepsakeDraft } = this.#state;
    if (this.#disposed || phase !== "ready" || !confirmed || (draft === undefined && keepsakeDraft === undefined) || !supported(confirmed)
      || confirmed.revision >= Number.MAX_SAFE_INTEGER) return;
    const epoch = ++this.#epoch;
    this.#set({ phase: "saving", saved: false });
    try {
      const latest = cosmeticLayout(confirmed);
      const pinwheel = draft === undefined ? latest.pinwheel : draft;
      const v2 = confirmed.schemaVersion === SCHEMA_V2 || keepsakeDraft !== undefined;
      // Rebase only the explicitly edited slots after conflict review. Preserve the other slot.
      const operation: Operation = Object.freeze({ operationId: crypto.randomUUID(), expectedRevision: confirmed.revision,
        schemaVersion: v2 ? SCHEMA_V2 : SCHEMA, layoutId: v2 ? LAYOUT_V2 : LAYOUT,
        selection: v2 ? Object.freeze({ pinwheel, keepsake: keepsakeDraft === undefined ? latest.keepsake : keepsakeDraft }) : pinwheel });
      const hash = await fingerprint(operation);
      if (!this.#current(epoch)) return;
      this.#set({ pending: Object.freeze({ operation, fingerprint: hash }) });
      await this.#send(epoch);
    } catch {
      if (this.#current(epoch)) this.#set({ phase: "unavailable" });
    }
  }
  async retryPending() {
    if (this.#disposed || this.#state.phase !== "unknown" || !this.#state.pending) return;
    const epoch = ++this.#epoch;
    this.#set({ phase: "saving", saved: false });
    await this.#send(epoch);
  }
  async #send(epoch: number) {
    const pending = this.#state.pending!;
    try {
      const snapshot = readSnapshot(await this.adapter.save(pending.operation));
      if (!this.#current(epoch)) return;
      if (!confirms(snapshot, pending.operation, pending.fingerprint)) throw new PersistenceError("unknown");
      this.#set({ confirmed: snapshot, draft: undefined, keepsakeDraft: undefined, pending: null, phase: "ready", saved: true });
    } catch (error) {
      if (!this.#current(epoch)) return;
      const kind = error instanceof PersistenceError ? error.kind : "unknown";
      this.#set({ phase: kind, saved: false, ...(kind === "conflict" || kind === "unsupported" ? { pending: null } : {}) });
      if (kind === "conflict" || kind === "unknown" || kind === "unsupported") await this.load();
    }
  }
}
