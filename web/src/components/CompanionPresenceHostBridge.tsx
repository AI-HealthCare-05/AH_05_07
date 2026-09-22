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
} from "../ui/companion";
import { getActiveCompanionAsset } from "../ui/companionActiveAsset";
import { getCompanionAsset } from "../ui/companionAssets.generated";
import { readCompanionIdentity } from "../ui/companionIdentity";
import type { ScreenId } from "../ui/journey";
import {
  CompanionPresenceKernel,
  type PresenceRenderOwner,
} from "../platform/presence/companionPresenceKernel";
import {
  measureS02PresenceArena,
  type S02PresenceArenaSnapshot,
} from "../platform/presence/s02PresenceArena";

type CompanionPresenceHostBridgeProps = Readonly<{
  rootRef: RefObject<HTMLElement | null>;
  activeScreen: ScreenId;
  sessionGeneration: number;
  rawMode: unknown;
  companionSelection: CompanionSelection | null;
  savedSceneOwner: boolean;
  suspended: boolean;
}>;

function safeActiveAssetId(species: Parameters<typeof getActiveCompanionAsset>[0]): string | null {
  try {
    return getActiveCompanionAsset(species).assetId;
  } catch {
    return null;
  }
}

function observedLegacyAssetId(selection: CompanionSelection | null): string | null {
  if (!selection) return null;
  try {
    return getCompanionAsset(selection.species, selection.variant).assetId;
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
  logicalAssetId: string | null,
  selection: CompanionSelection | null,
): string | null {
  if (owner === "full-scene") return logicalAssetId;
  if (owner === "saved-scene") return safeActiveAssetId("bear");
  if (owner === "legacy-slot") return observedLegacyAssetId(selection);
  return null;
}

/**
 * Phase 2 shadow host.
 *
 * It observes existing product ownership and measures S02 geometry. It does not
 * mount, hide, move, load, dispose or authorize any renderer.
 */
export function CompanionPresenceHostBridge({
  rootRef,
  activeScreen,
  sessionGeneration,
  rawMode,
  companionSelection,
  savedSceneOwner,
  suspended,
}: CompanionPresenceHostBridgeProps) {
  const mode = resolveCompanionMode(rawMode);
  const preferredSpecies = readCompanionIdentity();
  const logicalAssetId = mode === "off" ? null : safeActiveAssetId(preferredSpecies);
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
      const observedAssetId = observedOwnerAssetId(owner, logicalAssetId, companionSelection);
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
          setArena(measured);
        } else {
          setArena(null);
        }
      } else {
        arenaFenceRef.current = null;
        arenaRevisionRef.current = 0;
        setArena(null);
      }
      setSnapshot(kernel.snapshot);
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
    const mutationObserver = activeScreen === "S02" && typeof MutationObserver !== "undefined"
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
    };
  }, [
    activeScreen,
    companionSelection,
    identityKey,
    kernel,
    logicalAssetId,
    mode,
    rootRef,
    savedSceneOwner,
    sessionGeneration,
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
    />
  );
}
