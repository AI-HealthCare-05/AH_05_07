import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  resolveCompanionMode,
  type CompanionSelection,
  type CompanionSpecies,
} from "../ui/companion";
import { resolveCompanionRuntimeAsset } from "../ui/companionAssetResolver";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import type { ScreenId } from "../ui/journey";
import {
  CompanionPresenceKernel,
  type PresenceRenderOwner,
} from "../platform/presence/companionPresenceKernel";
import {
  measureS02PresenceArena,
  type S02PresenceArenaSnapshot,
} from "../platform/presence/s02PresenceArena";
import {
  usePresenceSceneActorRuntime,
  usePresenceSceneActorRuntimeSnapshot,
} from "../platform/presence/PresenceSceneActorRuntimeContext";
import { useSceneFirstPaintVisit } from "./SceneFirstPaintWitness";
import { matchesReadySceneWitness } from "./sceneFirstPaintChannel";

type CompanionPresenceHostBridgeProps = Readonly<{
  rootRef: RefObject<HTMLElement | null>;
  activeScreen: ScreenId;
  sessionGeneration: number;
  rawMode: unknown;
  companionSelection: CompanionSelection | null;
  /** Product identity authority shared with VisualStage. */
  companionSpecies: CompanionSpecies;
  /** Resolved active descriptor from the owner tree. */
  companionAsset: CompanionAsset | null;
  savedSceneOwner: boolean;
  suspended: boolean;
}>;

function observedLegacyAssetId(
  selection: CompanionSelection | null,
  mode: ReturnType<typeof resolveCompanionMode>,
): string | null {
  if (!selection) return null;
  try {
    return resolveCompanionRuntimeAsset(mode, selection)?.assetId ?? null;
  } catch {
    return null;
  }
}

function visibleFullSceneOwner(root: HTMLElement, screen: ScreenId): boolean {
  if (screen !== "S02" && screen !== "S10") return false;
  const stage = root.querySelector(`[data-living-scene="${screen}"]`);
  const frame = screen === "S02"
    ? root.querySelector('[data-scene="S02"] [data-scene-reserved-box="true"]')
    : stage;
  if (!(stage instanceof HTMLElement) || !(frame instanceof HTMLElement)) return false;
  const rect = frame.getBoundingClientRect();
  const style = getComputedStyle(frame);
  return rect.width > 0
    && rect.height > 0
    && style.display !== "none"
    && style.visibility !== "hidden";
}

function observedOwner(
  root: HTMLElement,
  screen: ScreenId,
  rawMode: unknown,
  savedSceneOwner: boolean,
  companionSelection: CompanionSelection | null,
): PresenceRenderOwner {
  const mode = resolveCompanionMode(rawMode);
  if (mode === "off") return "none";
  if (savedSceneOwner) return "saved-scene";
  if (visibleFullSceneOwner(root, screen)) return "full-scene";
  if (companionSelection) return "legacy-slot";
  return "none";
}

function observedOwnerAssetId(
  owner: PresenceRenderOwner,
  screen: ScreenId,
  logicalAssetId: string | null,
  logicalAssetUrl: string | null,
  selection: CompanionSelection | null,
  mode: ReturnType<typeof resolveCompanionMode>,
  activeVisit: ReturnType<typeof useSceneFirstPaintVisit>,
): string | null {
  if (owner === "full-scene") {
    // Consume only the exact ready witness from the current VisualStage visit.
    if (
      logicalAssetId != null
      && logicalAssetUrl != null
      && activeVisit != null
      && matchesReadySceneWitness(activeVisit, {
        screen,
        token: activeVisit.token,
        assetId: logicalAssetId,
        assetUrl: logicalAssetUrl,
      })
    ) {
      return logicalAssetId;
    }
    return null;
  }
  if (owner === "saved-scene") return logicalAssetId;
  if (owner === "legacy-slot") return observedLegacyAssetId(selection, mode);
  return null;
}

/**
 * Presence host bridge.
 *
 * It observes existing product ownership and measures S02 geometry. Phase 3B
 * publishes only the fenced S02 world-root capability; renderer mount, asset
 * load, drawing and disposal remain owned by the existing visual runtime.
 */
export function CompanionPresenceHostBridge({
  rootRef,
  activeScreen,
  sessionGeneration,
  rawMode,
  companionSelection,
  companionSpecies,
  companionAsset,
  savedSceneOwner,
  suspended,
}: CompanionPresenceHostBridgeProps) {
  const mode = resolveCompanionMode(rawMode);
  const preferredSpecies = companionSpecies;
  const activeAsset = mode === "off" ? null : companionAsset;
  const logicalAssetId = activeAsset?.assetId ?? null;
  const activeAssetUrl = activeAsset?.url ?? null;
  const activeVisit = useSceneFirstPaintVisit();
  const sceneActorRuntime = usePresenceSceneActorRuntime();
  const sceneActorSnapshot = usePresenceSceneActorRuntimeSnapshot();
  const kernelRef = useRef<CompanionPresenceKernel | null>(null);
  if (!kernelRef.current) {
    kernelRef.current = new CompanionPresenceKernel({
      sessionEpoch: Math.max(0, sessionGeneration),
      route: activeScreen,
      actor: logicalAssetId
        ? { actorId: "sk7-companion", assetId: logicalAssetId }
        : null,
      owner: "none",
      suspended: true,
    });
  }
  const kernel = kernelRef.current;
  const [snapshot, setSnapshot] = useState(kernel.snapshot);
  const [arena, setArena] = useState<S02PresenceArenaSnapshot | null>(null);
  const arenaRevisionRef = useRef(0);
  const arenaFenceRef = useRef<string | null>(null);
  const schedulingRef = useRef<number | null>(null);
  const diagnosticRef = useRef<HTMLSpanElement>(null);

  const identityKey = useMemo(
    () => `${mode}:${preferredSpecies}:${logicalAssetId ?? "none"}`,
    [mode, preferredSpecies, logicalAssetId],
  );

  useLayoutEffect(() => {
    const closestRoot = diagnosticRef.current?.closest(".app-shell");
    const root = rootRef.current
      ?? (closestRoot instanceof HTMLElement ? closestRoot : null);
    if (!root) return;

    let disposed = false;
    const hostConnection = sceneActorRuntime.connectHost();
    const refresh = () => {
      schedulingRef.current = null;
      if (disposed) return;
      const observed = observedOwner(
        root,
        activeScreen,
        mode,
        savedSceneOwner,
        companionSelection,
      );
      const owner: PresenceRenderOwner = logicalAssetId ? observed : "none";
      const observedAssetId = observedOwnerAssetId(owner, activeScreen, logicalAssetId, activeAssetUrl, companionSelection, mode, activeVisit);
      const reconciled = kernel.reconcile({
        sessionEpoch: Math.max(0, sessionGeneration),
        route: activeScreen,
        actor: logicalAssetId
          ? { actorId: "sk7-companion", assetId: logicalAssetId }
          : null,
        owner,
        observedAssetId,
        suspended,
      });

      let publishedArena: S02PresenceArenaSnapshot | null = null;
      if (activeScreen === "S02") {
        const arenaFence = `${reconciled.snapshot.runtime.sessionEpoch}:${reconciled.snapshot.runtime.routeEpoch}`;
        if (arenaFenceRef.current !== arenaFence) {
          arenaFenceRef.current = arenaFence;
          arenaRevisionRef.current = 0;
        }
        const nextRevision = arenaRevisionRef.current + 1;
        const measured = measureS02PresenceArena(
          root,
          reconciled.snapshot.runtime.routeEpoch,
          nextRevision,
          owner,
        );
        if (measured) {
          arenaRevisionRef.current = nextRevision;
          kernel.publishArena(measured.routeEpoch, measured.revision);
          publishedArena = measured;
          setArena(measured);
        } else {
          setArena(null);
        }
      } else {
        arenaFenceRef.current = null;
        arenaRevisionRef.current = 0;
        setArena(null);
      }
      const current = kernel.snapshot;
      hostConnection.publish({
        screen: activeScreen,
        owner: current.owner,
        suspended,
        sessionEpoch: current.runtime.sessionEpoch,
        routeEpoch: current.runtime.routeEpoch,
        arenaRevision: current.runtime.arenaRevision,
        ownerGeneration: current.runtime.ownerGeneration,
        ownerToken: current.ownerToken?.token ?? null,
        activeAssetId: logicalAssetId,
        activeAssetUrl,
        observedAssetId: current.observedAssetId,
        arena: publishedArena,
        placementIntent: current.presence?.placementIntent ?? null,
        rememberPlacementIntent: (intent) => {
          if (!kernel.rememberPlacementIntent(intent)) return;
          setSnapshot(kernel.snapshot);
        },
      });
      setSnapshot(current);
    };
    const schedule = () => {
      if (disposed || schedulingRef.current !== null) return;
      // Shadow geometry must not join the renderer animation-frame lifecycle.
      // A single cancellable timer coalesces resize/scroll/DOM invalidations.
      schedulingRef.current = window.setTimeout(refresh, 16);
    };

    // The existing off contract includes zero companion animation-frame work.
    // Route/session prop changes still reconcile synchronously, but an absent
    // logical actor has no live geometry to maintain between those changes.
    if (mode === "off") {
      const offMutationObserver = typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => refresh());
      offMutationObserver?.observe(root, { childList: true, subtree: true });
      refresh();
      queueMicrotask(refresh);
      return () => {
        disposed = true;
        offMutationObserver?.disconnect();
        hostConnection.disconnect();
      };
    }

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(schedule);
    const observeExplicitGeometry = () => {
      if (!observer || activeScreen !== "S02") return;
      for (const selector of [
        '[data-scene="S02"] [data-scene-reserved-box="true"]',
        '[data-scene="S02"] .home-lead button',
        ".primary-nav",
        '[role="dialog"][aria-modal="true"]',
        '[data-scene="S02"] .notice',
        ".scene-viewport > .notice",
      ]) {
        root.querySelectorAll(selector).forEach(element => observer.observe(element));
      }
    };
    const mutationObserver = (activeScreen === "S02" || activeScreen === "S10") && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
          observeExplicitGeometry();
          schedule();
        })
      : null;

    observeExplicitGeometry();
    mutationObserver?.observe(root, { childList: true, subtree: true });
    refresh();
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("scroll", schedule, { passive: true });

    return () => {
      disposed = true;
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      observer?.disconnect();
      mutationObserver?.disconnect();
      if (schedulingRef.current !== null) {
        window.clearTimeout(schedulingRef.current);
        schedulingRef.current = null;
      }
      hostConnection.disconnect();
    };
  }, [
    activeScreen,
    activeAssetUrl,
    companionSelection,
    activeVisit,
    identityKey,
    kernel,
    logicalAssetId,
    mode,
    rootRef,
    savedSceneOwner,
    sessionGeneration,
    sceneActorRuntime,
    suspended,
  ]);

  return (
    <span
      ref={diagnosticRef}
      hidden
      aria-hidden="true"
      data-companion-presence-host="shadow-v1"
      data-presence-actor-id={snapshot.presence?.actorId ?? "none"}
      data-presence-asset-id={snapshot.presence?.assetId ?? "none"}
      data-presence-lifecycle={snapshot.presence?.lifecycle ?? "suspended"}
      data-presence-session-epoch={snapshot.runtime.sessionEpoch}
      data-presence-route-epoch={snapshot.runtime.routeEpoch}
      data-presence-arena-revision={snapshot.runtime.arenaRevision}
      data-presence-owner={snapshot.owner}
      data-presence-owner-generation={snapshot.runtime.ownerGeneration}
      data-presence-owner-token={snapshot.ownerToken?.token ?? "none"}
      data-presence-observed-asset-id={snapshot.observedAssetId ?? "none"}
      data-presence-handoff-count={snapshot.handoffCount}
      data-presence-arena-status={arena ? "published" : "unavailable"}
      data-presence-anchor-count={arena?.anchors.length ?? 0}
      data-presence-hard-zone-count={arena?.hardZones.length ?? 0}
      data-presence-world-root-status={sceneActorSnapshot.status}
      data-presence-world-root-enabled={sceneActorSnapshot.enabled || undefined}
      data-presence-world-root-port-count={sceneActorSnapshot.portCount}
      data-presence-world-root-port-incarnation={sceneActorSnapshot.portIncarnation}
      data-presence-world-root-write-count={sceneActorSnapshot.writeCount}
      data-presence-world-root-commit-count={sceneActorSnapshot.commitCount}
      data-presence-world-root-revocation-count={sceneActorSnapshot.revocationCount}
      data-presence-world-root-lease={sceneActorSnapshot.leaseToken ?? "none"}
      data-presence-world-root-pointer={sceneActorSnapshot.activePointerToken ?? "none"}
      data-presence-placement-x={sceneActorSnapshot.committedNormalized?.x}
      data-presence-placement-y={sceneActorSnapshot.committedNormalized?.y}
    />
  );
}
