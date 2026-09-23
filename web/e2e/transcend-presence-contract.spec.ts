import { expect, test } from "@playwright/test";

import {
  ARENA_SPACE,
  ArenaSnapshotBuilder,
  deterministicAnchors,
  envelopeRect,
  isPointCurrent,
  isPoseCurrent,
  rectsOverlap,
  resolvePlacement,
  transitionArenaRoute,
  type ActorEnvelopes,
  type AnchorPlacementIntent,
  type ArenaSnapshot,
  type ResolvedPose,
} from "../transcend-lab/src/platform/spatial/companionWorld";
import {
  freeIntentFromPoint,
  requestFromFreeIntent,
  resolveFreePlacement,
} from "../transcend-lab/src/platform/spatial/companionFreePlacement";
import {
  arenaPointToClient,
  clientPointToArena,
  clientRectToArena,
} from "../transcend-lab/src/platform/spatial/visualViewportCoordinates";
import {
  beginGrab,
  finishGrab,
  moveGrab,
} from "../transcend-lab/src/platform/behavior/companionGrabIntent";
import { WorldRootLeaseManager } from "../transcend-lab/src/platform/behavior/rootMotionLease";
import {
  loadPinnedActiveAsset,
  loadReviewCatalogAsset,
  verifyGlbPayload,
} from "../transcend-lab/src/platform/embodiment/labAssetAdmission";
import {
  LabResourceLedger,
  PINNED_ACTIVE_ASSET,
} from "../transcend-lab/src/platform/embodiment/labEmbodimentPort";
import { companionClips, type CompanionClip } from "../src/ui/companion";
import type { CompanionReviewCatalogEntry } from "../src/ui/companionReviewCatalog";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.config.metadata.transcendLab !== true, "dedicated Transcend Lab config only");
});

const envelopes: ActorEnvelopes = Object.freeze({
  visualAction: Object.freeze({ width: 100, height: 120 }),
  tactileHit: Object.freeze({ width: 72, height: 64 }),
  relocationHandle: Object.freeze({ width: 36, height: 24, offsetY: 31 }),
});

const intent: AnchorPlacementIntent = Object.freeze({
  kind: "anchor",
  preferredRole: "sidecar",
  fallbackOrder: Object.freeze(["anchor", "dock", "control", "hidden"] as const),
});

function builder() {
  return new ArenaSnapshotBuilder(() => ({ x: 0, y: 0, width: 1000, height: 800 }));
}

function pose(snapshot: ArenaSnapshot, x = 150, y = 150): ResolvedPose {
  return Object.freeze({
    routeEpoch: snapshot.routeEpoch,
    arenaRevision: snapshot.revision,
    point: Object.freeze({ space: ARENA_SPACE, revision: snapshot.revision, x, y }),
    anchorId: "a",
    source: "anchor" as const,
  });
}

function minimalSelfContainedGlb(animationNames: readonly string[] = []): ArrayBuffer {
  const source = animationNames.length === 0
    ? '{"asset":{"version":"2.0"},"scene":0,"scenes":[{}]}'
    : JSON.stringify({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{}],
        animations: animationNames.map((name) => ({ name, channels: [], samplers: [] })),
      });
  const json = new TextEncoder().encode(source);
  const paddedLength = Math.ceil(json.byteLength / 4) * 4;
  const bytes = new ArrayBuffer(12 + 8 + paddedLength);
  const view = new DataView(bytes);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  const payload = new Uint8Array(bytes, 20, paddedLength);
  payload.fill(0x20);
  payload.set(json);
  return bytes;
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

test.describe("ArenaSnapshot pure contract", () => {
  test("publishes one immutable revision for retained and newly registered providers", () => {
    const arena = builder();
    arena.registerAnchorProvider("A", () => [{
      id: "a",
      role: "sidecar",
      priority: 1,
      region: { x: 100, y: 100, width: 100, height: 100 },
    }]);
    const first = arena.publish(1);
    arena.registerAnchorProvider("B", () => [{
      id: "b",
      role: "sidecar",
      priority: 2,
      region: { x: 700, y: 500, width: 100, height: 100 },
    }]);
    arena.registerHardZoneProvider("cta", () => [{ x: 430, y: 330, width: 140, height: 90 }]);
    const second = arena.publish(1);

    expect(first.anchors).toHaveLength(1);
    expect(second.anchors.map((anchor) => anchor.id)).toEqual(["a", "b"]);
    expect(second.revision).toBe(first.revision + 1);
    expect(second.viewport.revision).toBe(second.revision);
    expect(second.anchors.every((anchor) => anchor.arenaRevision === second.revision && anchor.region.revision === second.revision)).toBe(true);
    expect(second.hardZones.every((zone) => zone.revision === second.revision)).toBe(true);
    expect(first.anchors[0].arenaRevision).toBe(first.revision);
    expect(Object.isFrozen(second)).toBe(true);
    expect(Object.isFrozen(second.anchors)).toBe(true);
  });

  test("rejects mixed revisions and selects deterministically by priority then id", () => {
    const arena = builder();
    arena.registerAnchorProvider("anchors", () => [
      { id: "zeta", role: "sidecar", priority: 8, region: { x: 100, y: 100, width: 100, height: 100 } },
      { id: "alpha", role: "sidecar", priority: 8, region: { x: 700, y: 500, width: 100, height: 100 } },
      { id: "lower", role: "sidecar", priority: 2, region: { x: 700, y: 100, width: 100, height: 100 } },
    ]);
    const first = arena.publish(2);
    const second = arena.publish(2);
    expect(deterministicAnchors(second, intent).map((anchor) => anchor.id)).toEqual(["alpha", "zeta", "lower"]);
    expect(isPointCurrent(second, first.anchors[0].region)).toBe(false);
    expect(() => rectsOverlap(first.viewport, second.viewport)).toThrow(/revisions/);
  });

  test("keeps visual, tactile, and relocation envelopes independently variable", () => {
    const arena = builder();
    arena.registerAnchorProvider("anchor", () => [{
      id: "a",
      role: "sidecar",
      priority: 1,
      region: { x: 100, y: 100, width: 100, height: 100 },
    }]);
    const snapshot = arena.publish(1);
    const point = pose(snapshot).point;
    const visual = envelopeRect(point, envelopes.visualAction);
    const hit = envelopeRect(point, envelopes.tactileHit);
    const handle = envelopeRect(point, envelopes.relocationHandle);
    expect([visual.width, hit.width, handle.width]).toEqual([100, 72, 36]);
    expect([visual.height, hit.height, handle.height]).toEqual([120, 64, 24]);
    expect(handle.y).not.toBe(hit.y);
  });

  test("uses the conservative envelope and follows anchor to dock to control to hidden", () => {
    const arena = builder();
    arena.registerAnchorProvider("blocked", () => [{
      id: "blocked",
      role: "sidecar",
      priority: 10,
      region: { x: 450, y: 350, width: 100, height: 100 },
    }]);
    arena.registerAnchorProvider("safe", () => [{
      id: "safe",
      role: "sidecar",
      priority: 1,
      region: { x: 100, y: 100, width: 100, height: 100 },
    }]);
    arena.registerHardZoneProvider("hard", () => [{ x: 430, y: 320, width: 160, height: 160 }]);
    const snapshot = arena.publish(1);
    const anchored = resolvePlacement(snapshot, intent, envelopes, {
      dockRegion: { x: 800, y: 650, width: 80, height: 80 },
      controlId: "controls",
    });
    expect(anchored.kind).toBe("pose");
    if (anchored.kind === "pose") expect(anchored.pose.anchorId).toBe("safe");

    const noFitArena = builder();
    noFitArena.registerHardZoneProvider("all", () => [{ x: 0, y: 0, width: 1000, height: 800 }]);
    const noFit = noFitArena.publish(1);
    expect(resolvePlacement(noFit, intent, envelopes, {
      dockRegion: { x: 800, y: 650, width: 80, height: 80 },
      controlId: "controls",
    })).toEqual({ kind: "control", controlId: "controls" });
    expect(resolvePlacement(noFit, { ...intent, fallbackOrder: ["hidden"] }, envelopes)).toEqual({ kind: "hidden" });
  });

  test("executes the route transition order and carries intent rather than an old pose", () => {
    const arena = builder();
    arena.registerAnchorProvider("anchors", () => [{
      id: "a",
      role: "sidecar",
      priority: 1,
      region: { x: 100, y: 100, width: 100, height: 100 },
    }]);
    const oldSnapshot = arena.publish(4);
    const oldPose = pose(oldSnapshot);
    const observed: string[] = [];
    let published: ArenaSnapshot | null = oldSnapshot;
    let applied: ResolvedPose | null = null;
    const result = transitionArenaRoute(4, intent, {
      revokeWorldRoot: () => observed.push("revoke"),
      retireSnapshot: () => {
        observed.push("retire");
        published = null;
      },
      measureSnapshot: (nextEpoch) => {
        observed.push("measure");
        return arena.publish(nextEpoch);
      },
      publishSnapshot: (snapshot) => {
        observed.push("publish");
        published = snapshot;
      },
      resolveIntent: (carried, snapshot) => {
        observed.push("resolve");
        expect(carried).toBe(intent);
        return resolvePlacement(snapshot, carried, envelopes);
      },
      applyPlacement: (resolution) => {
        observed.push("apply");
        if (resolution.kind === "pose") applied = resolution.pose;
      },
    });
    expect(result.trace).toEqual([
      "revoke-world-root",
      "advance-route-epoch",
      "retire-arena-snapshot",
      "measure-route-providers",
      "publish-arena-snapshot",
      "resolve-placement-intent",
      "apply-placement",
    ]);
    expect(observed).toEqual(["revoke", "retire", "measure", "publish", "resolve", "apply"]);
    expect(published).toBe(result.snapshot);
    expect(isPoseCurrent(result.snapshot, oldPose)).toBe(false);
    expect(applied).not.toBe(oldPose);
  });
});

test.describe("free placement and direct-grab proposals", () => {
  const freeEnvelope = Object.freeze({ width: 100, height: 80 });

  test("keeps three distinct non-anchor points and carries normalized intent into current route geometry", () => {
    const arena = new ArenaSnapshotBuilder(() => ({ x: 0, y: 0, width: 500, height: 400 }));
    arena.registerHardZoneProvider("center", () => [{ x: 210, y: 150, width: 80, height: 100 }]);
    const first = arena.publish(1);
    for (const point of [{ x: 80, y: 80 }, { x: 420, y: 80 }, { x: 80, y: 330 }]) {
      const result = resolveFreePlacement(first, {
        routeEpoch: first.routeEpoch,
        arenaRevision: first.revision,
        point: { space: ARENA_SPACE, revision: first.revision, ...point },
      }, freeEnvelope, 0);
      expect(result).toMatchObject({ kind: "placed", resolution: "unchanged", point });
    }

    const committedPoint = { space: ARENA_SPACE, revision: first.revision, x: 130, y: 120 } as const;
    const carried = freeIntentFromPoint(first, committedPoint, freeEnvelope, 0);
    expect(carried).toEqual({ kind: "free", u: 0.2, v: 0.25 });
    const nextArena = new ArenaSnapshotBuilder(() => ({ x: 0, y: 0, width: 300, height: 220 }));
    const next = nextArena.publish(2);
    const request = requestFromFreeIntent(next, carried!, freeEnvelope, 0);
    expect(request).toMatchObject({
      routeEpoch: 2,
      arenaRevision: next.revision,
      point: { revision: next.revision, x: 90, y: 75 },
    });
  });

  test("uses deterministic minimum correction across overlapping hard zones", () => {
    const zones = [
      { x: 200, y: 150, width: 100, height: 100 },
      { x: 260, y: 120, width: 80, height: 150 },
    ];
    const solve = (orderedZones: typeof zones) => {
      const arena = new ArenaSnapshotBuilder(() => ({ x: 0, y: 0, width: 500, height: 400 }));
      arena.registerHardZoneProvider("overlap", () => orderedZones);
      const snapshot = arena.publish(1);
      return resolveFreePlacement(snapshot, {
        routeEpoch: snapshot.routeEpoch,
        arenaRevision: snapshot.revision,
        point: { space: ARENA_SPACE, revision: snapshot.revision, x: 275, y: 200 },
      }, freeEnvelope, 0);
    };
    const forward = solve(zones);
    const reverse = solve([...zones].reverse());
    expect(forward).toMatchObject({
      kind: "placed",
      resolution: "adjusted",
      point: { x: 275, y: 310 },
      correctionDistance: 110,
    });
    expect(reverse).toMatchObject({
      kind: "placed",
      point: { x: 275, y: 310 },
      correctionDistance: 110,
    });
  });

  test("distinguishes true no-space from stale requests on the actual small viewport", () => {
    const tinyArena = new ArenaSnapshotBuilder(() => ({ x: 0, y: 0, width: 90, height: 70 }));
    const tiny = tinyArena.publish(1);
    const noSpace = resolveFreePlacement(tiny, {
      routeEpoch: tiny.routeEpoch,
      arenaRevision: tiny.revision,
      point: { space: ARENA_SPACE, revision: tiny.revision, x: 45, y: 35 },
    }, freeEnvelope, 0);
    expect(noSpace).toEqual({ kind: "no-space", reason: "envelope-too-large" });

    const stale = resolveFreePlacement(tiny, {
      routeEpoch: tiny.routeEpoch,
      arenaRevision: tiny.revision - 1,
      point: { space: ARENA_SPACE, revision: tiny.revision - 1, x: 45, y: 35 },
    }, freeEnvelope, 0);
    expect(stale).toEqual({ kind: "rejected", reason: "stale-request" });
  });

  test("preserves off-center grab offset, threshold, foreign-pointer ownership, and stale-fence cancellation", () => {
    const fence = { sessionEpoch: 3, routeEpoch: 4, arenaRevision: 5 };
    const grab = beginGrab({
      sample: { pointerId: 7, point: { x: 230, y: 160 } },
      actor: { space: ARENA_SPACE, revision: 5, x: 200, y: 190 },
      fence,
      button: 0,
      isPrimary: true,
      threshold: 6,
    });
    expect(grab).not.toBeNull();
    expect(moveGrab(grab!, { pointerId: 7, point: { x: 235, y: 160 } }, fence).kind).toBe("pending");
    const drag = moveGrab(grab!, { pointerId: 7, point: { x: 250, y: 190 } }, fence);
    expect(drag).toMatchObject({
      kind: "drag",
      request: { point: { x: 220, y: 220 } },
    });
    expect(moveGrab(grab!, { pointerId: 99, point: { x: 999, y: 999 } }, fence).kind).toBe("ignored");
    expect(finishGrab(grab!, { pointerId: 99, point: { x: 999, y: 999 } }, fence).kind).toBe("ignored");
    expect(moveGrab(grab!, { pointerId: 7, point: { x: 250, y: 190 } }, { ...fence, arenaRevision: 6 }))
      .toEqual({ kind: "cancelled", reason: "stale-fence" });
  });

  test("adapts pointer and DOM geometry through one visual-viewport offset without DPR scaling", () => {
    const viewport = { x: 34, y: 57, width: 320, height: 480 };
    expect(clientPointToArena({ x: 20, y: 30 }, viewport)).toEqual({ x: 54, y: 87 });
    expect(clientRectToArena({ x: 10, y: 12, width: 80, height: 40 }, viewport)).toEqual({
      x: 44,
      y: 69,
      width: 80,
      height: 40,
    });
    expect(arenaPointToClient(
      { space: ARENA_SPACE, revision: 1, x: 54, y: 87 },
      { space: ARENA_SPACE, revision: 1, ...viewport },
    )).toEqual({ x: 20, y: 30 });
  });
});

test.describe("world-root exact-token lease", () => {
  test("supports acquire, renew, write, preemption, and ABA-safe release", () => {
    const arena = builder();
    arena.registerAnchorProvider("anchor", () => [{ id: "a", role: "sidecar", priority: 1, region: { x: 100, y: 100, width: 100, height: 100 } }]);
    const snapshot = arena.publish(1);
    const fence = { sessionEpoch: 1, routeEpoch: 1, arenaRevision: snapshot.revision };
    const manager = new WorldRootLeaseManager(fence);
    const first = manager.acquire("first", fence)!;
    expect(manager.renew(first)).toBe(true);
    expect(manager.write(first, pose(snapshot))).toBe(true);
    const second = manager.acquire("second", fence)!;
    expect(second.acquisitionOrder).toBeGreaterThan(first.acquisitionOrder);
    expect(manager.release(first)).toBe(false);
    expect(manager.state.lease?.token).toBe(second.token);
    expect(manager.write(first, pose(snapshot, 300, 300))).toBe(false);
    expect(manager.state.pose?.point).toMatchObject({ x: 150, y: 150 });
    expect(manager.write(second, pose(snapshot, 320, 300))).toBe(true);
    expect(manager.release(second)).toBe(true);
    expect(manager.state.lease).toBeNull();
  });

  test("fails stale session, route, revision, and token operations without mutation", () => {
    const arena = builder();
    arena.registerAnchorProvider("anchor", () => [{ id: "a", role: "sidecar", priority: 1, region: { x: 100, y: 100, width: 100, height: 100 } }]);
    const firstSnapshot = arena.publish(1);
    const manager = new WorldRootLeaseManager({ sessionEpoch: 3, routeEpoch: 1, arenaRevision: firstSnapshot.revision });
    const lease = manager.acquire("owner", manager.state.fence)!;
    manager.write(lease, pose(firstSnapshot));
    const before = manager.state;
    expect(manager.acquire("stale-session", { ...before.fence, sessionEpoch: 2 })).toBeNull();
    expect(manager.acquire("stale-route", { ...before.fence, routeEpoch: 0 })).toBeNull();
    expect(manager.acquire("stale-revision", { ...before.fence, arenaRevision: 999 })).toBeNull();
    expect(manager.release({ ...lease, token: "forged" })).toBe(false);
    expect(manager.state).toEqual(before);

    const nextSnapshot = arena.publish(1);
    manager.publishArena({ sessionEpoch: 3, routeEpoch: 1, arenaRevision: nextSnapshot.revision });
    expect(manager.state.lease).toBeNull();
    expect(manager.state.pose).toBeNull();
    expect(manager.write(lease, pose(firstSnapshot, 400, 400))).toBe(false);
  });

  test("records route, stop, reset, hard-zone, session, and direct-input revocations", () => {
    const manager = new WorldRootLeaseManager({ sessionEpoch: 1, routeEpoch: 1, arenaRevision: 1 });
    const reasons = [
      "route-change",
      "stop",
      "reset",
      "hard-zone-invalidation",
      "pointer-cancel",
      "lost-pointer-capture",
      "escape",
    ] as const;
    for (const reason of reasons) {
      manager.acquire(reason, manager.state.fence);
      manager.revoke(reason);
      expect(manager.state.lastRevocation).toBe(reason);
      expect(manager.state.lease).toBeNull();
    }
    manager.replaceSession(2);
    expect(manager.state.lastRevocation).toBe("session-replacement");
    expect(manager.state.fence.sessionEpoch).toBe(2);
  });
});

test.describe("fixture-pinned asset admission", () => {
  test("verifies a known self-contained GLB by its actual bytes and literal digest", async () => {
    const bytes = minimalSelfContainedGlb();
    const inspection = await verifyGlbPayload(bytes, {
      bytes: 72,
      sha256: "3522cd64f98b150c43db6174f5fa1ae5ca148bfc802ad33d4d41d0233a478706",
    });
    expect(inspection).toEqual({ version: 2, animationNames: [] });
    await expect(verifyGlbPayload(bytes, {
      bytes: 72,
      sha256: "0522cd64f98b150c43db6174f5fa1ae5ca148bfc802ad33d4d41d0233a478706",
    })).rejects.toThrow(/SHA-256 mismatch/);
  });

  test("admits the exact identity but rejects unverified response bytes after one exact request", async () => {
    const resources = new LabResourceLedger();
    const requested: string[] = [];
    const result = await loadPinnedActiveAsset({
      resources,
      requester: async (input) => {
        requested.push(String(input));
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
    });
    expect(result).toMatchObject({
      status: "failed",
      assetId: PINNED_ACTIVE_ASSET.assetId,
      reason: `asset load failed: asset byte length mismatch: expected ${PINNED_ACTIVE_ASSET.bytes}, received 3`,
    });
    expect(requested).toEqual([PINNED_ACTIVE_ASSET.url]);
    expect(resources.diagnostics().pendingLoads).toBe(0);
  });

  test("catalog-only, unknown, candidate, mismatch, and thrown authority checks make zero requests", async () => {
    let requests = 0;
    const requester = async () => {
      requests += 1;
      return new Response(new Uint8Array([1]), { status: 200 });
    };
    const resources = new LabResourceLedger();
    for (const requestedAssetId of ["COMPANION-R2-002", "COMPANION-R2-999", "candidate-rabbit-review-1"]) {
      const result = await loadPinnedActiveAsset({ resources, requestedAssetId, requester });
      expect(result.status).toBe("rejected");
    }
    const mismatch = await loadPinnedActiveAsset({
      resources,
      requester,
      membershipReader: (assetId) => ({
        assetId,
        status: "active-runtime-member",
        asset: { ...PINNED_ACTIVE_ASSET, url: "https://invalid.example/mismatch.glb" },
      }),
    });
    expect(mismatch.status).toBe("rejected");
    const thrown = await loadPinnedActiveAsset({
      resources,
      requester,
      membershipReader: () => {
        throw new Error("registry mismatch");
      },
    });
    expect(thrown.status).toBe("rejected");
    expect(requests).toBe(0);
  });

  test("teardown aborts a pending load and a stale generation cannot complete", async () => {
    const resources = new LabResourceLedger();
    const loading = loadPinnedActiveAsset({
      resources,
      requester: async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      }),
    });
    await Promise.resolve();
    expect(resources.diagnostics().pendingLoads).toBe(1);
    const diagnostics = await resources.drain();
    const result = await loading;
    expect(result.status).toBe("cancelled");
    expect(diagnostics).toMatchObject({ listeners: 0, timers: 0, rafLoops: 0, pendingLoads: 0, liveWebglContexts: 0 });
  });

  test("review catalog admission verifies all required clips and the selected clip without activation", async () => {
    const bytes = minimalSelfContainedGlb(companionClips);
    const digest = await sha256(bytes);
    const asset: CompanionReviewCatalogEntry = Object.freeze({
      assetId: "COMPANION-R2-900",
      speciesKey: "otter",
      version: "v001",
      variantKey: "standard",
      objectKey: "companion/v1/otter/v001/standard.glb",
      url: "https://assets.example.test/companion/v1/otter/v001/standard.glb",
      bytes: bytes.byteLength,
      sha256: digest,
      mime: "model/gltf-binary",
      clips: companionClips,
      capabilities: {
        exactIdentity: "verified",
        requiredClips: "complete",
        selfContainedGlb: "complete",
        missingClips: [],
        extensionsRequired: [],
        externalDependencies: [],
      },
      reviewEligible: true,
    });
    const requested: string[] = [];
    let verifiedClip: CompanionClip | null = null;
    const resources = new LabResourceLedger();
    const result = await loadReviewCatalogAsset({
      resources,
      assetId: asset.assetId,
      clipName: "celebrate",
      catalogReader: () => asset,
      requester: async (input) => {
        requested.push(String(input));
        return new Response(bytes.slice(0), { status: 200 });
      },
      onVerified: (verified) => {
        verifiedClip = verified.clipName;
      },
    });

    expect(result).toMatchObject({
      status: "loaded",
      assetId: asset.assetId,
      authority: "review-catalog",
      clipName: "celebrate",
      verification: "actual-response-sha256",
    });
    expect(verifiedClip).toBe("celebrate");
    expect(requested).toEqual([asset.url]);
    expect(resources.diagnostics().pendingLoads).toBe(0);
  });

  test("unknown, incomplete, mismatched and unsupported review selections make zero requests", async () => {
    let requests = 0;
    const requester = async () => {
      requests += 1;
      return new Response(new Uint8Array([1]), { status: 200 });
    };
    const resources = new LabResourceLedger();
    const base = {
      assetId: "COMPANION-R2-900",
      speciesKey: "otter",
      version: "v001",
      variantKey: "standard",
      objectKey: "companion/v1/otter/v001/standard.glb",
      url: "https://assets.example.test/companion/v1/otter/v001/standard.glb",
      bytes: 1,
      sha256: "a".repeat(64),
      mime: "model/gltf-binary" as const,
      clips: companionClips,
      capabilities: {
        exactIdentity: "verified" as const,
        requiredClips: "complete" as const,
        selfContainedGlb: "complete" as const,
        missingClips: [] as readonly CompanionClip[],
        extensionsRequired: [] as readonly string[],
        externalDependencies: [] as readonly string[],
      },
      reviewEligible: true,
    };
    const cases = [
      { assetId: "unknown", reader: () => null, clipName: "idle" as CompanionClip },
      { assetId: base.assetId, reader: () => ({ ...base, reviewEligible: false }), clipName: "idle" as CompanionClip },
      { assetId: "mismatch", reader: () => base, clipName: "idle" as CompanionClip },
      { assetId: base.assetId, reader: () => base, clipName: "not-a-clip" as CompanionClip },
    ];
    for (const item of cases) {
      const result = await loadReviewCatalogAsset({
        resources,
        assetId: item.assetId,
        clipName: item.clipName,
        catalogReader: item.reader,
        requester,
      });
      expect(result.status).toBe("rejected");
    }
    expect(requests).toBe(0);
  });
});
