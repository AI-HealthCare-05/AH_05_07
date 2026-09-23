import assert from "node:assert";
import test from "node:test";
import {
  initialSceneFirstPaintChannelState,
  matchesReadySceneWitness,
  sceneFirstPaintChannelReducer,
} from "../src/components/sceneFirstPaintChannel.mjs";

const baseVisit = Object.freeze({
  token: "v:1",
  screen: "S02",
  assetId: "COMPANION-R2-003",
  assetUrl: "https://sk7-companion.gkrry.com/companion/v1/cat/v007/lite.glb",
  phase: "loading",
});

function activate(overrides = {}) {
  return {
    type: "activate",
    token: baseVisit.token,
    screen: baseVisit.screen,
    assetId: baseVisit.assetId,
    assetUrl: baseVisit.assetUrl,
    ...overrides,
  };
}

test("matchesReadySceneWitness accepts correct S02/token/asset", () => {
  const ready = { ...baseVisit, phase: "ready" };
  assert.strictEqual(
    matchesReadySceneWitness(ready, {
      screen: baseVisit.screen,
      token: baseVisit.token,
      assetId: baseVisit.assetId,
      assetUrl: baseVisit.assetUrl,
    }),
    true,
  );
});

test("matchesReadySceneWitness rejects wrong screen", () => {
  const ready = { ...baseVisit, phase: "ready" };
  assert.strictEqual(
    matchesReadySceneWitness(ready, {
      screen: "S10",
      token: baseVisit.token,
      assetId: baseVisit.assetId,
      assetUrl: baseVisit.assetUrl,
    }),
    false,
  );
});

test("matchesReadySceneWitness rejects wrong token", () => {
  const ready = { ...baseVisit, phase: "ready" };
  assert.strictEqual(
    matchesReadySceneWitness(ready, {
      screen: baseVisit.screen,
      token: "v:2",
      assetId: baseVisit.assetId,
      assetUrl: baseVisit.assetUrl,
    }),
    false,
  );
});

test("matchesReadySceneWitness rejects wrong assetId", () => {
  const ready = { ...baseVisit, phase: "ready" };
  assert.strictEqual(
    matchesReadySceneWitness(ready, {
      screen: baseVisit.screen,
      token: baseVisit.token,
      assetId: "COMPANION-R2-002",
      assetUrl: baseVisit.assetUrl,
    }),
    false,
  );
});

test("matchesReadySceneWitness rejects wrong assetUrl", () => {
  const ready = { ...baseVisit, phase: "ready" };
  assert.strictEqual(
    matchesReadySceneWitness(ready, {
      screen: baseVisit.screen,
      token: baseVisit.token,
      assetId: baseVisit.assetId,
      assetUrl: "https://example.com/other.glb",
    }),
    false,
  );
});

test("matchesReadySceneWitness rejects loading", () => {
  assert.strictEqual(
    matchesReadySceneWitness(baseVisit, {
      screen: baseVisit.screen,
      token: baseVisit.token,
      assetId: baseVisit.assetId,
      assetUrl: baseVisit.assetUrl,
    }),
    false,
  );
});

test("matchesReadySceneWitness rejects failed", () => {
  const failed = { ...baseVisit, phase: "failed" };
  assert.strictEqual(
    matchesReadySceneWitness(failed, {
      screen: baseVisit.screen,
      token: baseVisit.token,
      assetId: baseVisit.assetId,
      assetUrl: baseVisit.assetUrl,
    }),
    false,
  );
});

test("activate creates a loading active visit", () => {
  const next = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  assert.deepStrictEqual(next.activeVisit, baseVisit);
});

test("ready transitions the same token to ready", () => {
  let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  state = sceneFirstPaintChannelReducer(state, { type: "ready", token: baseVisit.token });
  assert.strictEqual(state.activeVisit?.phase, "ready");
});

test("failed transitions the same token to failed", () => {
  let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  state = sceneFirstPaintChannelReducer(state, { type: "failed", token: baseVisit.token });
  assert.strictEqual(state.activeVisit?.phase, "failed");
});

test("ready never overwrites failed", () => {
  let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  state = sceneFirstPaintChannelReducer(state, { type: "failed", token: baseVisit.token });
  state = sceneFirstPaintChannelReducer(state, { type: "ready", token: baseVisit.token });
  assert.strictEqual(state.activeVisit?.phase, "failed");
});

test("stale ready transition after new active token is ignored", () => {
  let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  state = sceneFirstPaintChannelReducer(state, activate({ token: "v:2", assetId: "COMPANION-R2-004" }));
  state = sceneFirstPaintChannelReducer(state, { type: "ready", token: baseVisit.token });
  assert.strictEqual(state.activeVisit?.token, "v:2");
  assert.strictEqual(state.activeVisit?.phase, "loading");
});

test("stale failed transition after new active token is ignored", () => {
  let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  state = sceneFirstPaintChannelReducer(state, activate({ token: "v:2", assetId: "COMPANION-R2-004" }));
  state = sceneFirstPaintChannelReducer(state, { type: "failed", token: baseVisit.token });
  assert.strictEqual(state.activeVisit?.token, "v:2");
  assert.strictEqual(state.activeVisit?.phase, "loading");
});

test("stale cleanup after new active token is ignored", () => {
  let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  state = sceneFirstPaintChannelReducer(state, activate({ token: "v:2", assetId: "COMPANION-R2-004" }));
  state = sceneFirstPaintChannelReducer(state, { type: "clear", token: baseVisit.token });
  assert.strictEqual(state.activeVisit?.token, "v:2");
});

test("clear removes the active visit only for the same token", () => {
  let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  state = sceneFirstPaintChannelReducer(state, { type: "clear", token: baseVisit.token });
  assert.strictEqual(state.activeVisit, null);
});

test("re-activating the same visit identity is a no-op", () => {
  let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  const first = state;
  state = sceneFirstPaintChannelReducer(state, activate());
  assert.strictEqual(state, first);
});


test("same-token activation cannot reset ready or terminal failed", () => {
  for (const type of ["ready", "failed"]) {
    let state = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
    state = sceneFirstPaintChannelReducer(state, { type, token: baseVisit.token });
    assert.strictEqual(sceneFirstPaintChannelReducer(state, activate()), state);
  }
});


test("only B can become ready after A is replaced; stale A cannot revoke or clear B", () => {
  const a = sceneFirstPaintChannelReducer(initialSceneFirstPaintChannelState, activate());
  const b = sceneFirstPaintChannelReducer(a, activate({ token: "v:2" }));
  let state = b;
  for (const type of ["ready", "failed", "clear"]) {
    state = sceneFirstPaintChannelReducer(state, { type, token: "v:1" });
    assert.strictEqual(state, b);
  }
  state = sceneFirstPaintChannelReducer(state, { type: "ready", token: "v:2" });
  const readyB = state;
  for (const type of ["ready", "failed", "clear"]) {
    state = sceneFirstPaintChannelReducer(state, { type, token: "v:1" });
    assert.strictEqual(state, readyB);
  }
  assert.strictEqual(matchesReadySceneWitness(state.activeVisit, { ...baseVisit, token: "v:2" }), true);
  assert.strictEqual(matchesReadySceneWitness(state.activeVisit, baseVisit), false);
});
