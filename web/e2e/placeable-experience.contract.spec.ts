import { expect, test } from "@playwright/test";
import { livingChoice, livingChoiceQuery, readLivingChoice } from "../src/ui/livingChoice";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlaceableExperience, { ClassicPlaza } from "../src/placeable/PlaceableExperience";
import { VerifiedAccountBinding } from "../src/placeable/accountBinding";
import { accountPersistence, type AccountIdentity, type PlaceablePersistence } from "../src/placeable/persistence";
import { ASSET, emptySnapshot } from "../src/placeable/contract";
import { PlaceableAudio } from "../src/placeable/feedback";
import PlaceableWorld from "../src/placeable/PlaceableWorld";

test("Guest world presentation exposes qualified spatial controls without durable cosmetic wording", () => {
  const projection = { companion: null, selection: null, preview: false, pulse: 0,
    suspended: false, canInteract: false, onInteract: () => {}, onTwilight: () => {} };
  const guest = renderToStaticMarkup(createElement(PlaceableWorld, { ...projection, presentation: "guest" }));
  expect(guest).toContain("드래그하거나 방향키로 광장 걷기");
  expect(guest).toContain("동반자에게 인사하기");
  expect(guest).toContain("시점 다시 맞추기");
  expect(guest).toContain("광장의 불빛 켜기");
  expect(guest).not.toMatch(/바람개비 돌리기|저장된|저장 전|확정|미리보기·저장/);
  const ordinary = renderToStaticMarkup(createElement(PlaceableWorld, projection));
  expect(ordinary).toContain("바람개비 돌리기");
  expect(ordinary).toContain("미리보기·저장");
});

test("product's first render is unplaced/loading with disabled confirmation and truthful storage scope", () => {
  for (const mode of ["browser", "account"] as const) {
    const adapter: PlaceablePersistence = { mode, read: async () => { throw new Error("render must not read"); },
      save: async () => { throw new Error("render must not save"); } };
    const html = renderToStaticMarkup(createElement(PlaceableExperience, { adapter }));
    expect(html).toContain('data-phase="loading"'); expect(html).toContain("아직 확인 전");
    expect(html).toContain("저장 상태 확인 중"); expect(html).not.toContain(">꾸미기 전<");
    expect(html).toContain("저장된 꾸미기를 불러오고 있어요");
    expect(html).not.toContain("이 브라우저에 저장했어요.");
    expect(html).not.toContain('data-testid="classic-pinwheel"');
    expect(html).toContain(mode === "browser" ? "이 브라우저에만 저장" : "계정 공간에 저장");
    expect(html).toContain(`href="?screen=S02&amp;return_space=classic-${mode}"`);
    expect(html).not.toContain('href="/"');
  }
});

test("Classic surface renders the same selected asset/socket/color as the world projection and labels preview", () => {
  const selection = { assetId: ASSET, color: "teal", socketId: "plaza-edge" } as const;
  for (const preview of [true, false]) {
    const html = renderToStaticMarkup(createElement(ClassicPlaza, { selection, preview, pulse: 0, interact: () => {}, canInteract: !preview }));
    expect(html).toContain('data-color="teal"'); expect(html).toContain('data-socket="plaza-edge"');
    expect(html).toContain(preview ? "저장 전 미리보기" : "저장된 꾸미기");
    expect(html).toContain(preview ? "미리보기: 청록 바람개비 · 광장 가장자리" : "청록 바람개비 돌리기 · 광장 가장자리");
  }
  const removed = renderToStaticMarkup(createElement(ClassicPlaza, { selection: null, preview: false, pulse: 0, interact: () => {}, canInteract: false }));
  expect(removed).not.toContain('data-testid="classic-pinwheel"'); expect(removed).toContain("꾸미기 전");
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

test("#919 audio is latest-wins, bounds active voices and ignores stale cue callbacks", async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "window");
  let created = 0, closed = 0, tones = 0, scheduledStops = 0, immediateStops = 0, disconnects = 0;
  const voices: Array<{
    active: boolean;
    onended: (() => void) | null;
  }> = [];

  class AudioFixture {
    state = "running";
    currentTime = 0;
    destination = {};
    constructor() { created++; }
    resume = async () => {};
    close = async () => { closed++; this.state = "closed"; };
    createGain = () => ({
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      disconnect() { disconnects++; },
    });
    createOscillator = () => {
      const voice = {
        active: false,
        frequency: { value: 0 },
        connect() {},
        disconnect() { disconnects++; },
        start() { tones++; voice.active = true; },
        stop(...args: unknown[]) {
          if (args.length) scheduledStops++;
          else { immediateStops++; voice.active = false; }
        },
        onended: null as (() => void) | null,
      };
      voices.push(voice);
      return voice;
    };
  }

  const audio = new PlaceableAudio();
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    expect(created).toBe(0);
    expect(audio.play()).toBe(false);
    expect(await audio.enable()).toBe("unavailable");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { AudioContext: AudioFixture },
    });

    expect(await audio.enable()).toBe("ready");
    expect(audio.play()).toBe(true);
    expect(tones).toBe(3);
    expect(scheduledStops).toBe(3);
    expect(voices.filter((voice) => voice.active)).toHaveLength(3);

    const staleEnded = voices[0].onended;
    expect(staleEnded).not.toBeNull();

    // A newer motif replaces the three live old voices before creating three new ones.
    expect(audio.play("twilight")).toBe(true);
    expect(tones).toBe(6);
    expect(scheduledStops).toBe(6);
    expect(immediateStops).toBe(3);
    expect(voices.filter((voice) => voice.active)).toHaveLength(3);

    const afterReplacementDisconnects = disconnects;
    staleEnded?.();
    expect(disconnects).toBe(afterReplacementDisconnects);

    audio.dispose();
    expect(voices.filter((voice) => voice.active)).toHaveLength(0);
    expect(immediateStops).toBe(6);
    expect(closed).toBe(1);

    audio.dispose();
    expect(closed).toBe(1);
    expect(audio.play()).toBe(false);
  } finally {
    audio.dispose();
    if (prior) Object.defineProperty(globalThis, "window", prior);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("#919 stale enable failure cannot dispose a newer successful audio attempt", async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "window");
  const pending: Array<{ resolve: () => void; reject: () => void }> = [];
  let closed = 0, tones = 0;

  class DeferredAudioFixture {
    state = "suspended";
    currentTime = 0;
    destination = {};
    resume = () => new Promise<void>((resolve, reject) => {
      pending.push({
        resolve: () => { this.state = "running"; resolve(); },
        reject: () => reject(new Error("stale resume failure")),
      });
    });
    close = async () => { closed++; this.state = "closed"; };
    createGain = () => ({
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      disconnect() {},
    });
    createOscillator = () => ({
      frequency: { value: 0 },
      connect() {},
      disconnect() {},
      start() { tones++; },
      stop() {},
      onended: null,
    });
  }

  const audio = new PlaceableAudio();
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { AudioContext: DeferredAudioFixture },
    });

    const older = audio.enable();
    const newer = audio.enable();
    expect(pending).toHaveLength(2);

    pending[1].resolve();
    expect(await newer).toBe("ready");

    pending[0].reject();
    expect(await older).toBe("unavailable");

    // The stale failure must not have closed the newer admitted context.
    expect(closed).toBe(0);
    expect(audio.play()).toBe(true);
    expect(tones).toBe(3);

    audio.dispose();
    expect(closed).toBe(1);
  } finally {
    audio.dispose();
    if (prior) Object.defineProperty(globalThis, "window", prior);
    else Reflect.deleteProperty(globalThis, "window");
  }
});



test("return context accepts only explicit view/storage and bounded semantic place enums", async () => {
  const { readMySpaceReturn, readMySpaceReturnPlace, readMySpaceRouteRequest, mySpaceReturnPlaceQuery, classicTodayHref } = await import("../src/ui/mySpaceReturn");
  for (const view of ["classic", "3d"] as const) for (const storage of ["browser", "account"] as const) {
    expect(readMySpaceReturn(classicTodayHref(view, storage))).toEqual({ view, storage });
    expect(readMySpaceRouteRequest(`?view=${view}&storage=${storage}`)).toEqual({ view, storage });
  }
  for (const search of ["", "?return_space=browser", "?return_space=https://evil.invalid", "?return_space=3d-unknown",
    "?return_space=classic-browser&return_space=3d-account", "?return_space=3d-account-extra"]) {
    expect(readMySpaceReturn(search)).toBeNull();
  }

  for (const search of [
    "",
    "?view=3d",
    "?storage=browser",
    "?view=unknown&storage=browser",
    "?view=3d&storage=unknown",
    "?view=3d&view=classic&storage=browser",
    "?view=3d&view=3d&storage=browser",
    "?view=3d&storage=browser&storage=account",
    "?view=3d&storage=browser&storage=browser",
  ]) {
    expect(readMySpaceRouteRequest(search)).toBeNull();
  }

  expect(readMySpaceReturnPlace("?return_place=garden-nook")).toBe("garden-nook");
  expect(mySpaceReturnPlaceQuery("garden-nook")).toBe("&return_place=garden-nook");
  for (const search of ["", "?return_place=plaza", "?return_place=https://evil.invalid",
    "?return_place=garden-nook&return_place=garden-nook", "?return_place=garden-nook-extra"]) {
    expect(readMySpaceReturnPlace(search)).toBeNull();
  }
});


test("Living Choice accepts only three scalar hints; duplicate, arbitrary and domain-shaped inputs fail closed", () => {
  for (const choice of ["walk-10-minutes", "sleep-routine", "low-sodium-meal"]) {
    expect(readLivingChoice(`?experience=e2${livingChoiceQuery(choice)}`)).toBe(choice);
    expect(readLivingChoice(`?living_choice=${choice}&living_choice=${choice}`)).toBeNull();
  }
  for (const value of [null, undefined, "", "completed", "skipped", "walk-10-minutes ", "__proto__", "https://evil.invalid", ["sleep-routine"], { action_id: "sleep-routine" }]) {
    expect(livingChoice(value)).toBeNull(); expect(livingChoiceQuery(value)).toBe("");
  }
  expect(readLivingChoice("?action_id=sleep-routine&completed=true")).toBeNull();
});

test("Classic remount never replays an earlier interaction while preview or recovery disables interaction", () => {
  const selection = { assetId: ASSET, color: "teal", socketId: "gate-right" } as const;
  for (const preview of [true, false]) {
    const html = renderToStaticMarkup(createElement(ClassicPlaza, {
      selection, preview, pulse: 1, interact: () => {}, canInteract: false,
    }));
    expect(html).not.toContain("pinwheel-spin");
  }
});

test("#930 bounded transition identity has exact view/storage vocabulary without another authority", async () => {
  const {
    mySpaceContextLabel,
    mySpaceStorageLabel,
    mySpaceViewLabel,
    readMySpaceReturn,
  } = await import("../src/ui/mySpaceReturn");

  expect(mySpaceStorageLabel).toEqual({
    browser: "이 브라우저의 공간",
    account: "계정 공간",
  });
  expect(mySpaceViewLabel).toEqual({
    classic: "간단한 광장",
    "3d": "3D 광장",
  });

  const cases = [
    ["classic-browser", "이 브라우저의 공간 · 간단한 광장"],
    ["classic-account", "계정 공간 · 간단한 광장"],
    ["3d-browser", "이 브라우저의 공간 · 3D 광장"],
    ["3d-account", "계정 공간 · 3D 광장"],
  ] as const;

  for (const [value, label] of cases) {
    const context = readMySpaceReturn(`?return_space=${value}`);
    expect(context).not.toBeNull();
    expect(mySpaceContextLabel(context!)).toBe(label);
  }
});

test("#932 Classic state captions keep loading, unavailable and unsupported distinct from confirmed empty", () => {
  const base = {
    selection: null,
    preview: false,
    pulse: 0,
    interact: () => {},
    canInteract: false,
  };

  const empty = renderToStaticMarkup(createElement(ClassicPlaza, base));
  expect(empty).toContain("꾸미기 전");

  const loading = renderToStaticMarkup(createElement(ClassicPlaza, {
    ...base,
    statePresentation: "loading",
  }));
  expect(loading).toContain("저장 상태 확인 중");
  expect(loading).not.toContain(">꾸미기 전<");

  const unavailable = renderToStaticMarkup(createElement(ClassicPlaza, {
    ...base,
    statePresentation: "unavailable",
  }));
  expect(unavailable).toContain("저장 상태 확인 필요");
  expect(unavailable).not.toContain(">꾸미기 전<");

  const unsupported = renderToStaticMarkup(createElement(ClassicPlaza, {
    ...base,
    statePresentation: "unsupported",
  }));
  expect(unsupported).toContain("저장된 꾸미기 · 이 버전에서 표시 보류");
  expect(unsupported).not.toContain(">꾸미기 전<");
});
