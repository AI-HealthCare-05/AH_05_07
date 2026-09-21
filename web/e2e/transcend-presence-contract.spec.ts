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
  type ArenaSnapshot,
  type PlacementIntent,
  type ResolvedPose,
} from "../transcend-lab/src/platform/spatial/companionWorld";
import { WorldRootLeaseManager } from "../transcend-lab/src/platform/behavior/rootMotionLease";
import { loadPinnedActiveAsset } from "../transcend-lab/src/platform/embodiment/labAssetAdmission";
import {
  LabResourceLedger,
  PINNED_ACTIVE_ASSET,
} from "../transcend-lab/src/platform/embodiment/labEmbodimentPort";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.config.metadata.transcendLab !== true, "dedicated Transcend Lab config only");
});

const envelopes: ActorEnvelopes = Object.freeze({
  visualAction: Object.freeze({ width: 100, height: 120 }),
  tactileHit: Object.freeze({ width: 72, height: 64 }),
  relocationHandle: Object.freeze({ width: 36, height: 24, offsetY: 31 }),
});

const intent: PlacementIntent = Object.freeze({
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
  test("admits the exact active-lite identity and makes one exact request", async () => {
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
      status: "loaded",
      assetId: PINNED_ACTIVE_ASSET.assetId,
      url: PINNED_ACTIVE_ASSET.url,
      sha256: PINNED_ACTIVE_ASSET.sha256,
      responseBytes: 3,
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
});
