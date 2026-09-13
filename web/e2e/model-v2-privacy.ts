import { expect, type Page } from "@playwright/test";

export async function observeModelPrivacy(page: Page) {
  await page.addInitScript(() => {
    const probe = { active: false, storage: 0, idb: 0, cache: 0, cookie: 0, beacon: 0, sockets: 0, eventSources: 0, workers: 0, events: [] as string[] };
    Object.assign(window, { modelPrivacy: probe });
    for (const method of ["setItem", "removeItem", "clear"] as const) {
      const original = Storage.prototype[method];
      (Storage.prototype[method] as unknown) = function (this: Storage, ...args: unknown[]) {
        if (probe.active) probe.storage++;
        return Reflect.apply(original, this, args);
      };
    }
    for (const method of ["add", "put", "delete", "clear"] as const) {
      const original = IDBObjectStore.prototype[method];
      (IDBObjectStore.prototype[method] as unknown) = function (this: IDBObjectStore, ...args: unknown[]) {
        if (probe.active) probe.idb++;
        return Reflect.apply(original, this, args);
      };
    }
    for (const method of ["update", "delete"] as const) {
      const original = IDBCursor.prototype[method];
      (IDBCursor.prototype[method] as unknown) = function (this: IDBCursor, ...args: unknown[]) {
        if (probe.active) probe.idb++;
        return Reflect.apply(original, this, args);
      };
    }
    if (globalThis.Cache) for (const method of ["put", "add", "addAll", "delete"] as const) {
      const original = Cache.prototype[method];
      (Cache.prototype[method] as unknown) = function (this: Cache, ...args: unknown[]) {
        if (probe.active) probe.cache++;
        return Reflect.apply(original, this, args);
      };
    }
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
    Object.defineProperty(Document.prototype, "cookie", { ...cookie, set(value: string) {
      if (probe.active) probe.cookie++;
      cookie.set!.call(this, value);
    } });
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (...args) => {
      if (probe.active) probe.beacon++;
      return beacon(...args);
    };
    window.WebSocket = new Proxy(window.WebSocket, { construct(target, args) {
      if (probe.active) probe.sockets++;
      return Reflect.construct(target, args);
    } });
    window.EventSource = new Proxy(window.EventSource, { construct(target, args) {
      if (probe.active) probe.eventSources++;
      return Reflect.construct(target, args);
    } });
    if (navigator.serviceWorker) {
      const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = (...args) => {
        if (probe.active) probe.workers++;
        return register(...args);
      };
    }
    if (crypto.subtle) {
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest = async (...args) => {
        const result = await digest(...args);
        if (probe.active) probe.events.push("hashed");
        return result;
      };
    }
    const parse = JSON.parse;
    JSON.parse = (...args) => {
      if (probe.active && typeof args[0] === "string" && args[0].includes('"canonical_sha256"')) probe.events.push("parsed");
      return parse(...args);
    };
  });
}

export async function persistenceSnapshot(page: Page) {
  return page.evaluate(async () => ({
    local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie,
    databases: indexedDB.databases ? (await indexedDB.databases()).map(db => ({ name: db.name, version: db.version })) : null,
    caches: globalThis.caches ? await caches.keys() : [],
  }));
}

export async function startModelPrivacy(page: Page) {
  await page.evaluate(() => {
    // Unrelated synthetic auth state is allowed and must survive inference.
    localStorage.setItem("unrelated-synthetic-session", "auth-fixture");
    sessionStorage.setItem("unrelated-synthetic-session", "auth-fixture");
    document.cookie = "unrelated_synthetic_session=auth-fixture; SameSite=Strict";
    (window as unknown as { modelPrivacy: { active: boolean } }).modelPrivacy.active = true;
  });
  return persistenceSnapshot(page);
}

export async function assertModelPrivacy(page: Page, before: Awaited<ReturnType<typeof persistenceSnapshot>>, success: boolean) {
  expect(await persistenceSnapshot(page)).toEqual(before);
  const probe = await page.evaluate(() => (window as unknown as {
    modelPrivacy: { storage: number; idb: number; cache: number; cookie: number; beacon: number; sockets: number; eventSources: number; workers: number; events: string[] }
  }).modelPrivacy);
  expect([probe.storage, probe.idb, probe.cache, probe.cookie]).toEqual([0, 0, 0, 0]);
  expect([probe.beacon, probe.sockets, probe.eventSources, probe.workers]).toEqual([0, 0, 0, 0]);
  if (success) expect(probe.events).toEqual(["hashed", "parsed"]);
  else expect(probe.events).not.toContain("parsed");
}
