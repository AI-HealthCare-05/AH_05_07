import type { AuthoritativeSessionRejection } from "../lib/sessionRejectionBoundary";
import { emptySnapshot, fingerprint, readSnapshot, supported, supportedValue, SCHEMA_V2, type Operation, type Snapshot } from "./contract";

export type Failure = "conflict" | "unsupported" | "session" | "unavailable" | "unknown";
export class PersistenceError extends Error {
  constructor(readonly kind: Failure) { super(kind); }
}
export interface PlaceablePersistence {
  readonly mode: "browser" | "account";
  read(): Promise<Snapshot>;
  save(operation: Operation): Promise<Snapshot>;
}
export const STORAGE_KEY = "sk7:placeable:v1";
export function browserPersistence(options: {
  storage?: Pick<Storage, "getItem" | "setItem">;
  locks?: Pick<LockManager, "request"> | null;
} = {}): PlaceablePersistence {
  const storage = () => options.storage ?? localStorage;
  const read = async () => {
    try {
      const raw = storage().getItem(STORAGE_KEY);
      return raw === null ? emptySnapshot() : readSnapshot(JSON.parse(raw));
    } catch { throw new PersistenceError("unavailable"); }
  };
  return {
    mode: "browser", read,
    async save(operation) {
      if (!supportedValue(operation.schemaVersion, operation.layoutId, operation.selection)
        || !Number.isSafeInteger(operation.expectedRevision) || operation.expectedRevision < 0
        || operation.expectedRevision >= Number.MAX_SAFE_INTEGER) throw new PersistenceError("unsupported");
      // Web Locks serializes the compare/write across tabs. Without it we refuse
      // to claim a race-prone localStorage write was saved.
      const locks = Object.hasOwn(options, "locks") ? options.locks : navigator.locks;
      if (!locks) throw new PersistenceError("unavailable");
      const hash = await fingerprint(operation);
      return locks.request(STORAGE_KEY, async () => {
        const previous = await read();
        if (previous.latestOperationId === operation.operationId) {
          if (previous.latestFingerprint === hash) return previous;
          throw new PersistenceError("conflict");
        }
        if (!supported(previous)) throw new PersistenceError("unsupported");
        if (previous.schemaVersion === SCHEMA_V2 && operation.schemaVersion !== SCHEMA_V2) throw new PersistenceError("unsupported");
        if (previous.revision !== operation.expectedRevision) throw new PersistenceError("conflict");
        const next = readSnapshot({ revision: previous.revision + 1, schemaVersion: operation.schemaVersion,
          layoutId: operation.layoutId, selection: operation.selection,
          latestOperationId: operation.operationId, latestFingerprint: hash });
        try { storage().setItem(STORAGE_KEY, JSON.stringify(next)); }
        catch { throw new PersistenceError("unknown"); }
        return read();
      });
    },
  };
}

// The entry verifies owner/token with auth.getUser before publishing this identity.
// Generation also fences logout/sign-in with an otherwise identical token (ABA).
export type AccountIdentity = Readonly<{ owner: string; token: string; generation: number }>;
export type AccountSessionRejection = AuthoritativeSessionRejection;
export function accountPersistence(options: {
  identity: AccountIdentity;
  currentIdentity: () => AccountIdentity | null;
  baseUrl: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  onSessionRejected?: (identity: AccountIdentity, reason: AccountSessionRejection) => void;
}): PlaceablePersistence {
  const { currentIdentity, baseUrl, fetcher = fetch, timeoutMs = 8000, onSessionRejected } = options;
  const identity = Object.freeze({ ...options.identity });
  function checkSession() {
    const current = currentIdentity();
    if (!current || current.owner !== identity.owner || current.token !== identity.token
      || current.generation !== identity.generation) {
      throw new PersistenceError("session");
    }
  }
  async function request(operation?: Operation): Promise<Snapshot> {
    checkSession();
    if (!baseUrl) throw new PersistenceError("unavailable");
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/v1/cosmetics/placeable`, {
        method: operation ? "PUT" : "GET", signal: abort.signal, cache: "no-store",
        headers: { Authorization: `Bearer ${identity.token}`, "Content-Type": "application/json" },
        ...(operation ? { body: JSON.stringify(operation) } : {}),
      });
      checkSession();
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        checkSession();
        const code = body?.detail?.code;
        const rejection: AccountSessionRejection | null =
          response.status === 410 && code === "owner_deleted" ? "owner-deleted"
            : response.status === 401 || response.status === 403 ? "session-invalid"
              : null;
        if (rejection) {
          // This callback is intentionally narrower than Failure="session".
          // Reaching here means the captured identity is still current and the
          // server itself rejected that exact session/owner. A stale adapter
          // fenced by checkSession() never reaches this callback.
          onSessionRejected?.(identity, rejection);
          throw new PersistenceError("session");
        }
        if (response.status === 409 && ["revision_conflict", "operation_changed"].includes(code)) throw new PersistenceError("conflict");
        if (response.status === 422 && code === "unsupported_snapshot") throw new PersistenceError("unsupported");
        throw new PersistenceError(operation ? "unknown" : "unavailable");
      }
      const snapshot = readSnapshot(await response.json());
      checkSession();
      return snapshot;
    } catch (error) {
      checkSession();
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError(operation ? "unknown" : "unavailable");
    } finally { clearTimeout(timer); }
  }
  return { mode: "account", read: () => request(), save: (operation) => request(operation) };
}
