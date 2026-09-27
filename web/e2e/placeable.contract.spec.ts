import { expect, test } from "@playwright/test";
import { ASSET, confirms, emptySnapshot, fingerprint, isPlaceableRoute, readSnapshot, SOCKETS,
  type Operation, type Selection, type Snapshot } from "../src/placeable/contract";
import { PlaceableController } from "../src/placeable/controller";
import { accountPersistence, browserPersistence, STORAGE_KEY, PersistenceError, type PlaceablePersistence } from "../src/placeable/persistence";
import { E1_LIVING_CITY_ENTRY_SCENE_PROFILE } from "../transcend-lab/src/platform/spatial/e1LivingCityEntrySceneProfile";
import { LIVING_WEEK_SCENE_PLAN } from "../transcend-lab/src/platform/spatial/livingWeekScenePlan";

const coral: Selection = { assetId: ASSET, color: "coral", socketId: "gate-left" };
const teal: Selection = { assetId: ASSET, color: "teal", socketId: "gate-right" };
async function receipt(operation: Operation): Promise<Snapshot> {
  return { ...emptySnapshot(), revision: operation.expectedRevision + 1, selection: operation.selection,
    latestOperationId: operation.operationId, latestFingerprint: await fingerprint(operation) };
}
function store() {
  let snapshot = emptySnapshot();
  const calls: Operation[] = [];
  const adapter: PlaceablePersistence = { mode: "account", read: async () => snapshot, save: async (operation) => {
    calls.push(operation);
    if (operation.expectedRevision !== snapshot.revision) throw new PersistenceError("conflict");
    snapshot = await receipt(operation);
    return snapshot;
  } };
  return { adapter, calls, set: (value: Snapshot) => { snapshot = value; } };
}
test("no write before load, preview/cancel/interact never write, explicit removal increments", async () => {
  const db = store(); const controller = new PlaceableController(db.adapter);
  controller.preview(coral); await controller.confirm(); expect(db.calls).toHaveLength(0);
  await controller.load(); controller.preview(coral); controller.cancel(); expect(db.calls).toHaveLength(0);
  controller.preview(coral); await controller.confirm();
  expect(controller.getState()).toMatchObject({ saved: true, confirmed: { revision: 1, selection: coral } });
  controller.interact(); controller.interact(); expect(db.calls).toHaveLength(1);
  controller.preview(null); expect(controller.getState().confirmed?.selection).toEqual(coral);
  await controller.confirm(); expect(controller.getState().confirmed).toMatchObject({ revision: 2, selection: null });
});
test("lost response recovers only via matching atomic marker and fingerprint", async () => {
  const db = store(); const save = db.adapter.save;
  db.adapter.save = async (operation) => { await save(operation); throw new PersistenceError("unknown"); };
  const c = new PlaceableController(db.adapter); await c.load(); c.preview(coral); await c.confirm();
  expect(c.getState()).toMatchObject({ phase: "ready", saved: true, pending: null });
  expect(db.calls).toHaveLength(1);
});
test("old reread retains UNKNOWN and retry uses identical immutable operation", async () => {
  const db = store(); const save = db.adapter.save; let first: Operation | undefined;
  db.adapter.save = async (operation) => {
    if (!first) { first = operation; throw new PersistenceError("unknown"); }
    expect(operation).toBe(first); expect(Object.isFrozen(operation)).toBe(true);
    expect(Object.isFrozen(operation.selection)).toBe(true); return save(operation);
  };
  const c = new PlaceableController(db.adapter); await c.load(); c.preview(coral); await c.confirm();
  expect(c.getState()).toMatchObject({ phase: "unknown", saved: false, draft: coral });
  c.preview(teal); await c.confirm(); expect(c.getState().pending?.operation.selection).toEqual(coral);
  await c.retryPending(); expect(c.getState().saved).toBe(true);
});
test("stale/concurrent contexts preserve draft and require explicit review before rebase", async () => {
  const db = store(); const a = new PlaceableController(db.adapter); const b = new PlaceableController(db.adapter);
  await Promise.all([a.load(), b.load()]); a.preview(coral); b.preview(teal);
  await a.confirm(); await b.confirm();
  expect(b.getState()).toMatchObject({ phase: "conflict", saved: false, draft: teal, confirmed: { selection: coral, revision: 1 } });
  await b.confirm(); expect(db.calls).toHaveLength(2);
  b.reviewLatest(); await b.confirm(); expect(b.getState().confirmed).toMatchObject({ revision: 2, selection: teal });
});
test("future schema, layout, asset, socket and scalar state survive without writes", async () => {
  for (const change of [{ schemaVersion: "future" }, { layoutId: "future" }, { selection: { ...coral, assetId: "future" } },
    { selection: { ...coral, socketId: "future" } }, { selection: ["future"] }]) {
    const db = store(); const future = { ...emptySnapshot(), ...change }; db.set(future);
    const c = new PlaceableController(db.adapter); await c.load(); c.preview(null); await c.confirm();
    expect(c.getState()).toMatchObject({ phase: "unsupported", confirmed: future }); expect(db.calls).toHaveLength(0);
  }
});
test("delayed wrong receipts are rejected and disposed session cannot publish", async () => {
  const db = store();
  db.adapter.save = async (operation) => ({ ...await receipt(operation), latestOperationId: crypto.randomUUID() });
  const c = new PlaceableController(db.adapter); await c.load(); c.preview(coral); await c.confirm();
  expect(c.getState()).toMatchObject({ phase: "unknown", saved: false, draft: coral });
  let finish!: (value: Snapshot) => void;
  db.adapter.read = () => new Promise((resolve) => { finish = resolve; });
  const loading = c.load(); c.dispose(); finish(emptySnapshot()); await loading;
  expect(c.getState().saved).toBe(false);
});
test("account adapter binds owner/token, preserves response failures and never retries or uses storage", async () => {
  const identity = { owner: "synthetic-A", token: "synthetic-token-A", generation: 1 }; let current: typeof identity | null = identity;
  let calls = 0;
  const adapter = accountPersistence({ identity, currentIdentity: () => current, baseUrl: "https://synthetic.invalid",
    fetcher: async (_url, init) => {
      calls++; expect(init?.headers).toMatchObject({ Authorization: "Bearer synthetic-token-A" });
      current = { owner: "synthetic-B", token: "synthetic-token-B", generation: 2 };
      return new Response(JSON.stringify(emptySnapshot()));
    } });
  await expect(adapter.read()).rejects.toMatchObject({ kind: "session" }); expect(calls).toBe(1);
  await expect(adapter.read()).rejects.toMatchObject({ kind: "session" }); expect(calls).toBe(1);
  current = identity;
  const unavailable = accountPersistence({ identity, currentIdentity: () => current, baseUrl: "https://synthetic.invalid",
    fetcher: async () => { calls++; throw new TypeError("lost response"); } });
  await expect(unavailable.save({ operationId: crypto.randomUUID(), expectedRevision: 0,
    schemaVersion: "placeable.v1", layoutId: "e1-plaza.v1", selection: coral })).rejects.toMatchObject({ kind: "unknown" });
  expect(calls).toBe(2);
});
test("strict snapshot and receipt matching includes revision, full selection and fingerprint", async () => {
  const op: Operation = { operationId: crypto.randomUUID(), expectedRevision: 0,
    schemaVersion: "placeable.v1", layoutId: "e1-plaza.v1", selection: coral };
  const saved = await receipt(op); const hash = await fingerprint(op);
  expect(confirms(saved, op, hash)).toBe(true);
  for (const change of [{ revision: 2 }, { latestFingerprint: "f".repeat(64) }, { selection: teal }, { layoutId: "future" }]) {
    expect(confirms({ ...saved, ...change }, op, hash)).toBe(false);
  }
  for (const revision of [true, 1.5, "1", -1, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => readSnapshot({ ...saved, revision })).toThrow();
  }
});
test("three authored E1 sockets have physical clearance from gate, spawn, paths and boundary", () => {
  expect(SOCKETS).toHaveLength(3); expect(new Set(SOCKETS.map((s) => s.id)).size).toBe(3);
  const gate = E1_LIVING_CITY_ENTRY_SCENE_PROFILE.destination;
  for (const socket of SOCKETS) {
    expect(Math.hypot(socket.x, socket.z)).toBeGreaterThan(0.8);
    // The stem/blade footprint has radius < 0.5m; preserve the central gate approach too.
    expect(Math.abs(socket.x)).toBeGreaterThan(0.5 + 0.6);
    for (const fixture of E1_LIVING_CITY_ENTRY_SCENE_PROFILE.fixtures) {
      const minX = fixture.kind === "ramp" ? fixture.x : fixture.x - fixture.width / 2;
      const dx = Math.max(minX - socket.x, 0, socket.x - (minX + fixture.width));
      const dz = Math.max(Math.abs(socket.z - fixture.z) - fixture.depth / 2, 0);
      expect(Math.hypot(dx, dz)).toBeGreaterThan(0.5);
    }
    for (const marker of LIVING_WEEK_SCENE_PLAN.markers) {
      expect(Math.hypot(socket.x - marker.position.x, socket.z - marker.position.z))
        .toBeGreaterThan(marker.interactionRadiusMetres + 0.5);
    }
    for (const other of SOCKETS.filter((other) => other !== socket)) {
      expect(Math.hypot(socket.x - other.x, socket.z - other.z)).toBeGreaterThan(1);
    }
    expect(Math.hypot(socket.x - gate.x, socket.z - gate.z)).toBeGreaterThan(gate.radius + 0.5);
    expect(Math.max(Math.abs(socket.x), Math.abs(socket.z)) + 0.5).toBeLessThan(LIVING_WEEK_SCENE_PLAN.boundMetres);
    for (const { start, end } of LIVING_WEEK_SCENE_PLAN.segments) {
      const dx = end.x - start.x; const dz = end.z - start.z;
      const t = Math.max(0, Math.min(1, ((socket.x - start.x) * dx + (socket.z - start.z) * dz) / (dx * dx + dz * dz)));
      expect(Math.hypot(socket.x - start.x - t * dx, socket.z - start.z - t * dz)).toBeGreaterThan(0.5);
    }
  }
});
test("explicit opt-in never overrides Classic direct links, guest or auth entry", () => {
  expect(isPlaceableRoute("?experience=e2")).toBe(true);
  expect(isPlaceableRoute("?experience=e2", "#access_token=synthetic")).toBe(false);
  for (const query of ["", "?screen=S02", "?experience=e2&screen=S02", "?experience=e2&screen=S07",
    "?experience=e2&guest=1", "?experience=e2&auth=email-confirm", "?experience=e2&code=synthetic"]) {
    expect(isPlaceableRoute(query)).toBe(false);
  }
});

function browserStore() {
  const values = new Map<string, string>(); let writes = 0;
  let tail = Promise.resolve();
  const locks = { request: (_name: string, callback: () => Promise<unknown>) => {
    const result = tail.then(callback); tail = result.then(() => {}, () => {}); return result;
  } } as Pick<LockManager, "request">;
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writes++; values.set(key, value); } };
  return { values, storage, locks, get writes() { return writes; } };
}

test("browser cycle: explicit unplaced, preview/cancel, confirm, leave/reload, move/recolor/remove", async () => {
  const local = browserStore();
  const open = () => new PlaceableController(browserPersistence(local));
  let c = open(); await c.load();
  expect(c.getState().confirmed?.selection).toBeNull(); expect(local.writes).toBe(0);
  c.preview(coral); c.cancel(); expect(local.values.size).toBe(0);
  c.preview(coral); await c.confirm(); c.interact(); expect(local.writes).toBe(1);
  c.dispose(); c = open(); await c.load();
  expect(c.getState().confirmed?.selection).toEqual(coral);
  c.preview(teal); expect(c.getState().confirmed?.selection).toEqual(coral);
  await c.confirm(); expect(local.writes).toBe(2);
  c.dispose(); c = open(); await c.load(); expect(c.getState().confirmed?.selection).toEqual(teal);
  c.preview(null); await c.confirm(); expect(c.getState().confirmed?.revision).toBe(3);
  c.dispose(); c = open(); await c.load(); expect(c.getState().confirmed?.selection).toBeNull();
  expect(local.writes).toBe(3);
});

test("browser lock serializes concurrent contexts, idempotency matches fingerprint and future bytes survive", async () => {
  const local = browserStore(); const a = browserPersistence(local), b = browserPersistence(local);
  const op: Operation = { operationId: crypto.randomUUID(), expectedRevision: 0,
    schemaVersion: "placeable.v1", layoutId: "e1-plaza.v1", selection: coral };
  const results = await Promise.allSettled([a.save(op), b.save({ ...op, operationId: crypto.randomUUID(), selection: teal })]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(local.writes).toBe(1); expect((await b.save(op)).revision).toBe(1); expect(local.writes).toBe(1);
  await expect(b.save({ ...op, selection: teal })).rejects.toMatchObject({ kind: "conflict" });
  const future = JSON.stringify({ ...await a.read(), schemaVersion: "placeable.v9", selection: { future: true } });
  local.values.set(STORAGE_KEY, future);
  const c = new PlaceableController(a); await c.load(); c.preview(null); await c.confirm();
  expect(c.getState().phase).toBe("unsupported"); expect(local.values.get(STORAGE_KEY)).toBe(future);
  await expect(a.save({ ...op, expectedRevision: 1, operationId: crypto.randomUUID() })).rejects.toMatchObject({ kind: "unsupported" });
});

test("unavailable browser storage or locks never report saved or write defaults", async () => {
  const local = browserStore(); const a = browserPersistence({ ...local, locks: null });
  const c = new PlaceableController(a); await c.load(); c.preview(coral); await c.confirm();
  expect(c.getState()).toMatchObject({ phase: "unavailable", saved: false, draft: coral }); expect(local.writes).toBe(0);
  const broken = browserPersistence({ ...local, storage: { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } } });
  const d = new PlaceableController(broken); await d.load(); d.preview(coral); await d.confirm();
  expect(d.getState()).toMatchObject({ phase: "unavailable", confirmed: null, saved: false });
});

test("mismatched fingerprint/operation reread cannot turn equal selection into save acknowledgement", async () => {
  for (const change of [{ latestFingerprint: "f".repeat(64) }, { latestOperationId: crypto.randomUUID() }]) {
    const db = store();
    db.adapter.save = async (op) => { const other = { ...await receipt(op), ...change }; db.set(other); return other; };
    const c = new PlaceableController(db.adapter); await c.load(); c.preview(coral); await c.confirm();
    expect(c.getState()).toMatchObject({ phase: "conflict", saved: false, draft: coral, pending: null });
  }
});

test("latest load wins, and a save finishing after dispose cannot publish", async () => {
  const db = store(); let release!: (value: Snapshot) => void;
  const c = new PlaceableController(db.adapter);
  db.adapter.read = () => new Promise((resolve) => { release = resolve; });
  const oldRead = c.load(); db.adapter.read = async () => emptySnapshot(); await c.load();
  c.preview(teal); release({ ...emptySnapshot(), schemaVersion: "future" }); await oldRead;
  expect(c.getState()).toMatchObject({ phase: "ready", draft: teal });
  let started!: () => void; const sending = new Promise<void>((resolve) => { started = resolve; });
  db.adapter.save = () => { started(); return new Promise((resolve) => { release = resolve; }); };
  const saving = c.confirm(); await sending;
  const op = c.getState().pending!.operation; c.dispose(); release(await receipt(op)); await saving;
  expect(c.getState().saved).toBe(false); expect(c.getState().confirmed?.revision).toBe(0);
});

test("account identity is checked after decoding too, including logout/sign-in ABA", async () => {
  const identity = { owner: "synthetic-A", token: "synthetic-A", generation: 1 }; let current = identity;
  const a = accountPersistence({ identity, currentIdentity: () => current, baseUrl: "https://synthetic.invalid",
    fetcher: async () => ({ ok: true, json: async () => {
      current = { ...identity, generation: 2 }; return emptySnapshot();
    } }) as Response });
  await expect(a.read()).rejects.toMatchObject({ kind: "session" });
  await expect(a.read()).rejects.toMatchObject({ kind: "session" });
});

test("synthetic account contexts share revisions by verified principal, keep other owners and browser separate", async () => {
  // Protocol simulation only; this does not claim to verify deployed SQL/RLS.
  const rows = new Map<string, Snapshot>(); const commands: Operation[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const token = (init?.headers as Record<string, string>).Authorization;
    const row = rows.get(token) ?? emptySnapshot();
    if (init?.method === "GET") return new Response(JSON.stringify(row));
    const op = JSON.parse(String(init?.body)) as Operation; commands.push(op);
    expect(Object.keys(op).sort()).toEqual(["expectedRevision", "layoutId", "operationId", "schemaVersion", "selection"]);
    if (row.revision !== op.expectedRevision) return new Response(JSON.stringify({ detail: { code: "revision_conflict" } }), { status: 409 });
    const next = await receipt(op); rows.set(token, next); return new Response(JSON.stringify(next));
  };
  const open = (owner: string) => {
    const identity = { owner, token: `synthetic-${owner}`, generation: 1 };
    return new PlaceableController(accountPersistence({ identity, currentIdentity: () => identity, baseUrl: "https://synthetic.invalid", fetcher }));
  };
  const local = browserStore(); const guest = new PlaceableController(browserPersistence(local));
  await guest.load(); guest.preview({ ...teal, color: "sunflower" }); await guest.confirm(); const browserBytes = local.values.get(STORAGE_KEY);
  const a = open("A"), b = open("A"), other = open("B"); await Promise.all([a.load(), b.load(), other.load()]);
  expect(a.getState().confirmed?.selection).toBeNull(); a.preview(coral); b.preview(teal);
  await a.confirm(); await b.confirm();
  expect(b.getState()).toMatchObject({ phase: "conflict", draft: teal, confirmed: { revision: 1, selection: coral } });
  await b.confirm(); expect(commands).toHaveLength(2); b.reviewLatest(); await b.confirm();
  const returned = open("A"); await returned.load(); expect(returned.getState().confirmed).toMatchObject({ revision: 2, selection: teal });
  await other.load(); expect(other.getState().confirmed?.selection).toBeNull();
  expect(local.values.get(STORAGE_KEY)).toBe(browserBytes);
});

test("account response classification preserves UNKNOWN, session deletion and unsupported state without fallback", async () => {
  const identity = { owner: "synthetic-A", token: "synthetic-A", generation: 1 };
  const op: Operation = { operationId: crypto.randomUUID(), expectedRevision: 0,
    schemaVersion: "placeable.v1", layoutId: "e1-plaza.v1", selection: coral };
  for (const [status, code, kind] of [[401, "session_invalid", "session"], [410, "owner_deleted", "session"],
    [409, "revision_conflict", "conflict"], [409, "operation_changed", "conflict"],
    [422, "unsupported_snapshot", "unsupported"], [503, "save_unknown", "unknown"]] as const) {
    const a = accountPersistence({ identity, currentIdentity: () => identity, baseUrl: "https://synthetic.invalid",
      fetcher: async () => new Response(JSON.stringify({ detail: { code } }), { status }) });
    await expect(a.save(op)).rejects.toMatchObject({ kind });
  }
});

test("an unavailable operation-id source stays recoverable without issuing a write", async () => {
  const db = store(); const c = new PlaceableController(db.adapter); await c.load(); c.preview(coral);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} }); await c.confirm();
    expect(c.getState()).toMatchObject({ phase: "unavailable", draft: coral, pending: null, saved: false });
    expect(db.calls).toHaveLength(0);
  } finally { if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor); }
});
