import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlaceableExperience, { ClassicPlaza } from "../src/placeable/PlaceableExperience";
import { VerifiedAccountBinding } from "../src/placeable/accountBinding";
import { accountPersistence, type AccountIdentity, type PlaceablePersistence } from "../src/placeable/persistence";
import { ASSET, emptySnapshot } from "../src/placeable/contract";
import { PlaceableAudio } from "../src/placeable/feedback";

test("product's first render is unplaced/loading with disabled confirmation and truthful storage scope", () => {
  for (const mode of ["browser", "account"] as const) {
    const adapter: PlaceablePersistence = { mode, read: async () => { throw new Error("render must not read"); },
      save: async () => { throw new Error("render must not save"); } };
    const html = renderToStaticMarkup(createElement(PlaceableExperience, { adapter }));
    expect(html).toContain('data-phase="loading"'); expect(html).toContain("Not read yet");
    expect(html).toContain("Unplaced"); expect(html).toContain("Reading your saved placement");
    expect(html).not.toContain("Saved in this browser only.");
    expect(html).not.toContain('data-testid="classic-pinwheel"');
    expect(html).toContain(mode === "browser" ? "this browser and site, not your account" : "follows your signed-in account");
  }
});

test("Classic surface renders the same selected asset/socket/color as the world projection and labels preview", () => {
  const selection = { assetId: ASSET, color: "teal", socketId: "plaza-edge" } as const;
  for (const preview of [true, false]) {
    const html = renderToStaticMarkup(createElement(ClassicPlaza, { selection, preview, pulse: 0, interact: () => {}, canInteract: !preview }));
    expect(html).toContain('data-color="teal"'); expect(html).toContain('data-socket="plaza-edge"');
    expect(html).toContain(preview ? "Preview · not saved" : "Confirmed placement");
    expect(html).toContain(preview ? "Preview: teal pinwheel at Plaza edge" : "Spin teal pinwheel at Plaza edge");
  }
  const removed = renderToStaticMarkup(createElement(ClassicPlaza, { selection: null, preview: false, pulse: 0, interact: () => {}, canInteract: false }));
  expect(removed).not.toContain('data-testid="classic-pinwheel"'); expect(removed).toContain("Unplaced");
});

test("only verified matching owner publishes an account binding; delayed verification and logout cannot rebind", async () => {
  let resolve!: (owner: string | null) => void;
  const published: Array<{ identity: AccountIdentity | null; status: string }> = [];
  const binding = new VerifiedAccountBinding(() => new Promise((done) => { resolve = done; }), (identity, status) => published.push({ identity, status }));
  const pending = binding.update({ owner: "synthetic-A", token: "synthetic-A" });
  expect(binding.current()).toBeNull(); expect(published.at(-1)?.status).toBe("checking");
  resolve("synthetic-B"); await pending; expect(binding.current()).toBeNull(); expect(published.at(-1)?.status).toBe("unavailable");
  const verifying = binding.update({ owner: "synthetic-A", token: "synthetic-A" }); const oldResolve = resolve;
  await binding.update(null); oldResolve("synthetic-A"); await verifying;
  expect(binding.current()).toBeNull(); expect(published.at(-1)?.status).toBe("signed-out");
  const success = binding.update({ owner: "synthetic-A", token: "synthetic-A" }); resolve("synthetic-A"); await success;
  expect(binding.current()?.owner).toBe("synthetic-A");
  let calls = 0;
  const adapter = accountPersistence({ identity: binding.current()!, currentIdentity: binding.current, baseUrl: "https://synthetic.invalid",
    fetcher: async () => { calls++; return new Response(JSON.stringify(emptySnapshot())); } });
  const changed = binding.update({ owner: "synthetic-B", token: "synthetic-B" });
  await expect(adapter.read()).rejects.toMatchObject({ kind: "session" }); expect(calls).toBe(0);
  resolve("synthetic-B"); await changed; expect(binding.current()?.owner).toBe("synthetic-B");
  binding.dispose(); expect(binding.current()).toBeNull();
});

test("audio stays muted without a gesture, reports unavailable, and closes its context on cleanup", async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "window");
  let created = 0, closed = 0, tones = 0;
  class AudioFixture {
    state = "running"; currentTime = 0; destination = {};
    constructor() { created++; }
    resume = async () => {};
    close = async () => { closed++; this.state = "closed"; };
    createGain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} });
    createOscillator = () => ({ frequency: { value: 0 }, connect() {}, disconnect() {}, start() { tones++; }, stop() {}, onended: null });
  }
  const audio = new PlaceableAudio();
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    expect(created).toBe(0); expect(audio.play()).toBe(false); expect(await audio.enable()).toBe("unavailable");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { AudioContext: AudioFixture } });
    expect(await audio.enable()).toBe("ready"); expect(audio.play()).toBe(true); expect(tones).toBe(3);
    audio.dispose(); audio.dispose(); expect(closed).toBe(1); expect(audio.play()).toBe(false);
  } finally {
    audio.dispose(); if (prior) Object.defineProperty(globalThis, "window", prior); else Reflect.deleteProperty(globalThis, "window");
  }
});


test("return context accepts only explicit view/storage enums, never an arbitrary redirect or placement", async () => {
  const { readMySpaceReturn, classicTodayHref } = await import("../src/ui/mySpaceReturn");
  for (const view of ["classic", "3d"] as const) for (const storage of ["browser", "account"] as const) {
    expect(readMySpaceReturn(classicTodayHref(view, storage))).toEqual({ view, storage });
  }
  for (const search of ["", "?return_space=browser", "?return_space=https://evil.invalid", "?return_space=3d-unknown",
    "?return_space=classic-browser&return_space=3d-account", "?return_space=3d-account-extra"]) {
    expect(readMySpaceReturn(search)).toBeNull();
  }
});
