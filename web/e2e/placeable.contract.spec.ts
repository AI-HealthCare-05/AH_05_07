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
test("#977 account adapter reports only current remote session rejection", async () => {
  const identity = { owner: "synthetic-A", token: "synthetic-A", generation: 1 };
  const rejected: typeof identity[] = [];
  const op: Operation = { operationId: crypto.randomUUID(), expectedRevision: 0,
    schemaVersion: "placeable.v1", layoutId: "e1-plaza.v1", selection: coral };

  for (const status of [401, 403, 410]) {
    let current: typeof identity | null = identity;
    const adapter = accountPersistence({
      identity,
      currentIdentity: () => current,
      baseUrl: "https://synthetic.invalid",
      onSessionRejected: (value) => rejected.push(value),
      fetcher: async () => new Response(JSON.stringify({ detail: { code: "session_invalid" } }), { status }),
    });
    await expect(adapter.save(op)).rejects.toMatchObject({ kind: "session" });
    expect(rejected.at(-1)).toEqual(identity);

    current = { owner: "synthetic-A", token: "newer-token", generation: 2 };
    await expect(adapter.read()).rejects.toMatchObject({ kind: "session" });
    expect(rejected.filter((value) => value.generation === identity.generation)).toHaveLength(status === 401 ? 1 : status === 403 ? 2 : 3);
  }

  const beforeUnknown = rejected.length;
  const unknown = accountPersistence({
    identity,
    currentIdentity: () => identity,
    baseUrl: "https://synthetic.invalid",
    onSessionRejected: (value) => rejected.push(value),
    fetcher: async () => new Response(JSON.stringify({ detail: { code: "save_unknown" } }), { status: 503 }),
  });
  await expect(unknown.save(op)).rejects.toMatchObject({ kind: "unknown" });
  expect(rejected).toHaveLength(beforeUnknown);
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
    "?experience=e2&guest=1", "?experience=e2&guest=1&space=plaza&view=3d&storage=account",
    "?experience=e2&guest=1&space=plaza&view=3d&storage=browser", "?experience=e2&auth=email-confirm", "?experience=e2&code=synthetic"]) {
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
  const other = { ...op, operationId: crypto.randomUUID(), selection: teal };
  const results = await Promise.allSettled([a.save(op), b.save(other)]);
  expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
  const winner = results[0].status === "fulfilled" ? op : other;
  expect(local.writes).toBe(1); expect((await b.save(winner)).revision).toBe(1); expect(local.writes).toBe(1);
  await expect(b.save({ ...winner, selection: null })).rejects.toMatchObject({ kind: "conflict" });
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

// E4 uses the actual browser adapter and controller with isolated in-memory storage.
function cosmeticStore() {
  let raw: string | null = null;
  const adapter = browserPersistence({ storage: { getItem: () => raw, setItem: (_key, value) => { raw = value; } },
    locks: { request: async (_name: string, run: () => unknown) => run() } as never });
  return { adapter, raw: () => raw, seed: (snapshot: Snapshot) => { raw = JSON.stringify(snapshot); } };
}
test("E4 v1 unplaced/pinwheel reads are byte-preserving; explicit keep migrates without losing revision or pinwheel", async () => {
  for (const pinwheel of [null, coral]) {
    const db = cosmeticStore();
    db.seed(await receipt({ operationId: crypto.randomUUID(), expectedRevision: 6, schemaVersion: "placeable.v1", layoutId: "e1-plaza.v1", selection: pinwheel }));
    const before = db.raw(); const c = new PlaceableController(db.adapter); await c.load();
    expect(c.getState().phase).toBe("ready"); expect(db.raw()).toBe(before);
    c.previewKeepsake("plaza-ribbon-v1"); expect(db.raw()).toBe(before); c.cancel(); expect(db.raw()).toBe(before);
    c.previewKeepsake("plaza-ribbon-v1"); await c.confirm();
    expect(c.getState().confirmed).toMatchObject({ revision: 8, schemaVersion: "placeable.v2", layoutId: "e1-plaza.v2",
      selection: { pinwheel, keepsake: "plaza-ribbon-v1" } });
    const returned = new PlaceableController(db.adapter); await returned.load();
    expect(returned.getState().confirmed).toEqual(c.getState().confirmed);
    returned.previewKeepsake("quiet-moon-v1"); await returned.confirm();
    returned.previewKeepsake(null); await returned.confirm();
    expect(returned.getState().confirmed).toMatchObject({ revision: 10, schemaVersion: "placeable.v2", selection: { pinwheel, keepsake: null } });
    returned.preview(teal); await returned.confirm();
    expect(returned.getState().confirmed?.selection).toEqual({ pinwheel: teal, keepsake: null });
  }
});
test("E4 conflict review rebases only edited slot, never stale entire layout", async () => {
  const db = cosmeticStore(); const a = new PlaceableController(db.adapter), b = new PlaceableController(db.adapter);
  await Promise.all([a.load(), b.load()]); a.preview(coral); b.previewKeepsake("garden-leaf-v1");
  await a.confirm(); await b.confirm(); expect(b.getState().phase).toBe("conflict");
  b.reviewLatest(); await b.confirm();
  expect(b.getState().confirmed?.selection).toEqual({ pinwheel: coral, keepsake: "garden-leaf-v1" });
  a.preview(teal); await a.confirm(); expect(a.getState().phase).toBe("conflict");
  a.reviewLatest(); await a.confirm();
  expect(a.getState().confirmed?.selection).toEqual({ pinwheel: teal, keepsake: "garden-leaf-v1" });
});
test("E4 lost response reconciles v2 receipt; old reread retries frozen full operation", async () => {
  for (const commitFirst of [true, false]) {
    const db = cosmeticStore(); const save = db.adapter.save; let first: Operation | null = null;
    db.adapter.save = async (operation) => {
      if (!first) { first = operation; if (commitFirst) await save(operation); throw new PersistenceError("unknown"); }
      expect(operation).toBe(first); expect(Object.isFrozen(operation.selection)).toBe(true); return save(operation);
    };
    const c = new PlaceableController(db.adapter); await c.load(); c.preview(coral); c.previewKeepsake("quiet-moon-v1"); await c.confirm();
    if (!commitFirst) {
      expect(c.getState().phase).toBe("unknown"); c.previewKeepsake("garden-leaf-v1");
      expect(c.getState().keepsakeDraft).toBe("quiet-moon-v1"); await c.retryPending();
    }
    expect(c.getState()).toMatchObject({ phase: "ready", saved: true, confirmed: { revision: 1,
      selection: { pinwheel: coral, keepsake: "quiet-moon-v1" } } });
  }
});
test("E4 v2 downgrade, forged ids, version mismatch and future data fail closed", async () => {
  const db = cosmeticStore(); const c = new PlaceableController(db.adapter); await c.load();
  c.previewKeepsake("completed" as never); expect(c.getState().keepsakeDraft).toBeUndefined();
  c.previewKeepsake("garden-leaf-v1"); await c.confirm(); const before = db.raw();
  const v1: Operation = { operationId: crypto.randomUUID(), expectedRevision: 1, schemaVersion: "placeable.v1", layoutId: "e1-plaza.v1", selection: null };
  await expect(db.adapter.save(v1)).rejects.toMatchObject({ kind: "unsupported" }); expect(db.raw()).toBe(before);
  for (const selection of [{ pinwheel: coral, keepsake: "forged" }, { pinwheel: coral, keepsake: null, completed: true }, { keepsake: null }, null]) {
    await expect(db.adapter.save({ ...v1, schemaVersion: "placeable.v2", layoutId: "e1-plaza.v2", selection } as Operation)).rejects.toMatchObject({ kind: "unsupported" });
  }
  db.seed({ ...c.getState().confirmed!, selection: { pinwheel: coral, keepsake: "future-asset" } }); const future = db.raw();
  const older = new PlaceableController(db.adapter); await older.load(); older.previewKeepsake(null); await older.confirm();
  expect(older.getState().phase).toBe("unsupported"); expect(db.raw()).toBe(future);
});
test("E4 delayed v2 save cannot publish after disposal or account generation change", async () => {
  const db = cosmeticStore(); let finish!: () => void;
  const save = db.adapter.save;
  db.adapter.save = async (op) => { await new Promise<void>((resolve) => { finish = resolve; }); return save(op); };
  const c = new PlaceableController(db.adapter); await c.load(); c.previewKeepsake("quiet-moon-v1");
  const pending = c.confirm(); await expect.poll(() => typeof finish).toBe("function"); c.dispose(); finish(); await pending;
  expect(c.getState().saved).toBe(false); expect(c.getState().confirmed?.revision).toBe(0);
  let current = { owner: "synthetic-A", token: "synthetic-token", generation: 1 };
  const account = accountPersistence({ identity: current, currentIdentity: () => current, baseUrl: "https://synthetic.invalid",
    fetcher: async () => { current = { ...current, generation: 2 }; return new Response(db.raw()); } });
  await expect(account.read()).rejects.toMatchObject({ kind: "session" });
});

test("E4 account loss during a v2 save ignores the receipt and never falls back to browser storage", async () => {
  let identity: { owner: string; token: string; generation: number } | null = { owner: "synthetic-A", token: "synthetic-A", generation: 1 };
  const adapter = accountPersistence({ identity, currentIdentity: () => identity, baseUrl: "https://synthetic.invalid",
    fetcher: async (_url, init) => {
      if (init?.method === "GET") return new Response(JSON.stringify(emptySnapshot()));
      const op = JSON.parse(String(init?.body)) as Operation;
      identity = null;
      return new Response(JSON.stringify({ ...await receipt(op), schemaVersion: op.schemaVersion, layoutId: op.layoutId }));
    } });
  const c = new PlaceableController(adapter); await c.load(); c.previewKeepsake("quiet-moon-v1"); await c.confirm();
  expect(c.getState()).toMatchObject({ phase: "session", saved: false, confirmed: { revision: 0 }, keepsakeDraft: "quiet-moon-v1" });
});
test("E4 fingerprint matches PostgreSQL fixed-order fields and full receipt rejects another keepsake", async () => {
  const op: Operation = { operationId: crypto.randomUUID(), expectedRevision: 1, schemaVersion: "placeable.v2", layoutId: "e1-plaza.v2",
    selection: { pinwheel: coral, keepsake: "plaza-ribbon-v1" } };
  const hash = await fingerprint(op);
  const { createHash } = await import("node:crypto");
  expect(hash).toBe(createHash("sha256").update("1|placeable.v2|e1-plaza.v2|welcome-pinwheel-v1|coral|gate-left|plaza-ribbon-v1").digest("hex"));
  const saved = { ...await receipt(op), schemaVersion: op.schemaVersion, layoutId: op.layoutId };
  expect(confirms(saved, op, hash)).toBe(true);
  expect(confirms({ ...saved, selection: { pinwheel: coral, keepsake: "quiet-moon-v1" } }, op, hash)).toBe(false);
});

// #907 observes newly published receipt identities, independently of saved state.
function observeReceipts(controller: PlaceableController) {
  const receipts: string[] = [];
  let previous = controller.getState().receipt;
  controller.subscribe(() => {
    const next = controller.getState().receipt;
    if (next && next !== previous && next.pinwheelOnly) receipts.push(next.operationId);
    previous = next;
  });
  return receipts;
}
test("#907 exact direct pinwheel receipts publish once each; load, cancel and remount publish none", async () => {
  const local = browserStore(), adapter = browserPersistence(local);
  const c = new PlaceableController(adapter), receipts = observeReceipts(c);
  await c.load(); expect(c.getState().receipt).toBeNull();
  for (const selection of [coral, teal]) {
    c.preview(selection); expect(c.getState().receipt).toBeNull();
    await c.confirm();
    expect(c.getState().receipt).toEqual({ operationId: c.getState().confirmed!.latestOperationId, pinwheelOnly: true });
    c.interact(); await c.confirm(); // Neither interaction nor repeated Confirm publishes another receipt.
  }
  expect(receipts).toHaveLength(2); expect(new Set(receipts).size).toBe(2); expect(local.writes).toBe(2);
  await c.load(); expect(c.getState()).toMatchObject({ saved: true, receipt: null });
  c.preview(coral); c.cancel(); expect(c.getState()).toMatchObject({ saved: true, receipt: null });
  expect(receipts).toHaveLength(2);
  const remounted = new PlaceableController(adapter), replay = observeReceipts(remounted);
  await remounted.load(); expect(remounted.getState()).toMatchObject({ saved: true, receipt: null });
  expect(replay).toEqual([]); expect(local.writes).toBe(2);
  expect([...local.values.keys()]).toEqual([STORAGE_KEY]);
  expect(Object.keys(JSON.parse(local.values.get(STORAGE_KEY)!)).sort()).toEqual(Object.keys(emptySnapshot()).sort());
});
test("#907 UNKNOWN and old reread stay silent until an explicit exact read, without another mutation", async () => {
  const db = store(); let attempted!: Operation; let writes = 0;
  db.adapter.save = async (op) => { attempted = op; writes++; throw new PersistenceError("unknown"); };
  const c = new PlaceableController(db.adapter), receipts = observeReceipts(c);
  await c.load(); c.preview(coral); await c.confirm();
  const pending = c.getState().pending;
  expect(c.getState()).toMatchObject({ phase: "unknown", saved: false, receipt: null });
  await c.load(); expect(c.getState().phase).toBe("unknown"); expect(c.getState().pending).toBe(pending);
  expect(receipts).toEqual([]); expect(writes).toBe(1);
  db.set(await receipt(attempted)); await c.load();
  expect(c.getState()).toMatchObject({ phase: "ready", saved: true, pending: null });
  expect(receipts).toEqual([attempted.operationId]); expect(writes).toBe(1);
  await c.load(); await c.retryPending(); expect(receipts).toHaveLength(1); expect(writes).toBe(1);
});
for (const wrong of ["operation", "fingerprint", "revision", "payload", "conflict"] as const) {
  test(`#907 ${wrong} cannot publish an exact pinwheel receipt`, async () => {
    const db = store(); let writes = 0;
    db.adapter.save = async (op) => {
      writes++;
      const snapshot = { ...await receipt(op), ...(wrong === "fingerprint" ? { latestFingerprint: "f".repeat(64) }
        : wrong === "revision" ? { revision: op.expectedRevision + 2 }
        : wrong === "payload" ? { selection: teal } : { latestOperationId: crypto.randomUUID() }) };
      db.set(snapshot);
      if (wrong === "conflict") throw new PersistenceError("conflict");
      return snapshot;
    };
    const c = new PlaceableController(db.adapter), receipts = observeReceipts(c);
    await c.load(); c.preview(coral); await c.confirm();
    expect(c.getState()).toMatchObject({ phase: "conflict", saved: false, receipt: null });
    expect(receipts).toEqual([]); expect(writes).toBe(1);
  });
}
test("#907 keepsake add, replace, remove and mixed edits never qualify; pinwheel-only v2 still does", async () => {
  const local = browserStore(), c = new PlaceableController(browserPersistence(local)), receipts = observeReceipts(c);
  await c.load();
  for (const keepsake of ["plaza-ribbon-v1", "quiet-moon-v1", null] as const) {
    c.previewKeepsake(keepsake); await c.confirm();
    expect(c.getState().receipt?.pinwheelOnly).toBe(false);
  }
  c.preview(coral); c.previewKeepsake("garden-leaf-v1"); await c.confirm();
  expect(c.getState().receipt?.pinwheelOnly).toBe(false); expect(receipts).toEqual([]);
  c.preview(teal); await c.confirm(); expect(receipts).toHaveLength(1);
  expect(c.getState().confirmed?.selection).toEqual({ pinwheel: teal, keepsake: "garden-leaf-v1" });
  expect(local.writes).toBe(5); expect(c.getState().pulse).toBe(0);
});
test("#907 late exact receipt after disposal publishes nothing", async () => {
  const db = store(); let finish!: (snapshot: Snapshot) => void;
  db.adapter.save = () => new Promise(resolve => { finish = resolve; });
  const c = new PlaceableController(db.adapter), receipts = observeReceipts(c);
  await c.load(); c.preview(coral); const saving = c.confirm();
  await expect.poll(() => Boolean(finish)).toBe(true);
  const snapshot = await receipt(c.getState().pending!.operation);
  c.dispose(); finish(snapshot); await saving;
  expect(c.getState().receipt).toBeNull(); expect(receipts).toEqual([]);
});
