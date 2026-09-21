import { getCompanionRuntimeMembership } from "../../../../src/ui/companionRuntimeMembership";

import {
  LabResourceLedger,
  PINNED_ACTIVE_ASSET,
} from "./labEmbodimentPort";

type Membership = ReturnType<typeof getCompanionRuntimeMembership>;
export type MembershipReader = (assetId: string) => Membership;
export type AssetRequester = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AssetAdmissionResult =
  | Readonly<{
      status: "loaded";
      assetId: string;
      url: string;
      sha256: string;
      responseBytes: number;
    }>
  | Readonly<{
      status: "rejected" | "failed" | "cancelled";
      assetId: string;
      reason: string;
    }>;

function exactPinnedIdentity(membership: Membership): boolean {
  const asset = membership.asset;
  return Boolean(
    membership.status === "active-runtime-member"
      && membership.assetId === PINNED_ACTIVE_ASSET.assetId
      && asset
      && asset.assetId === PINNED_ACTIVE_ASSET.assetId
      && asset.species === PINNED_ACTIVE_ASSET.species
      && asset.variant === PINNED_ACTIVE_ASSET.variant
      && asset.version === PINNED_ACTIVE_ASSET.version
      && asset.url === PINNED_ACTIVE_ASSET.url
      && asset.bytes === PINNED_ACTIVE_ASSET.bytes
      && asset.sha256 === PINNED_ACTIVE_ASSET.sha256,
  );
}

/** Admission completes before the requester is called; every negative path is zero-request. */
export async function loadPinnedActiveAsset(options: Readonly<{
  resources: LabResourceLedger;
  requestedAssetId?: string;
  membershipReader?: MembershipReader;
  requester?: AssetRequester;
}>): Promise<AssetAdmissionResult> {
  const assetId = options.requestedAssetId ?? PINNED_ACTIVE_ASSET.assetId;
  const membershipReader = options.membershipReader ?? getCompanionRuntimeMembership;
  const requester = options.requester ?? window.fetch.bind(window);
  let membership: Membership;
  try {
    membership = membershipReader(assetId);
  } catch (error) {
    return Object.freeze({
      status: "rejected" as const,
      assetId,
      reason: `membership authority threw: ${error instanceof Error ? error.message : "unknown"}`,
    });
  }
  if (assetId !== PINNED_ACTIVE_ASSET.assetId || !exactPinnedIdentity(membership)) {
    return Object.freeze({
      status: "rejected" as const,
      assetId,
      reason: "asset is not the exact fixture-pinned active runtime member",
    });
  }

  const load = options.resources.beginLoad();
  try {
    const response = await requester(PINNED_ACTIVE_ASSET.url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
      signal: load.signal,
      headers: { Accept: "model/gltf-binary,application/octet-stream;q=0.9" },
    });
    if (!options.resources.isCurrent(load.generation) || load.signal.aborted) {
      return Object.freeze({
        status: "cancelled" as const,
        assetId,
        reason: "stale load generation",
      });
    }
    if (!response.ok) {
      return Object.freeze({
        status: "failed" as const,
        assetId,
        reason: `asset response ${response.status}`,
      });
    }
    const body = await response.arrayBuffer();
    if (!options.resources.isCurrent(load.generation) || load.signal.aborted) {
      return Object.freeze({
        status: "cancelled" as const,
        assetId,
        reason: "stale load generation",
      });
    }
    return Object.freeze({
      status: "loaded" as const,
      assetId,
      url: PINNED_ACTIVE_ASSET.url,
      sha256: PINNED_ACTIVE_ASSET.sha256,
      responseBytes: body.byteLength,
    });
  } catch (error) {
    const cancelled = load.signal.aborted || !options.resources.isCurrent(load.generation);
    return Object.freeze({
      status: cancelled ? ("cancelled" as const) : ("failed" as const),
      assetId,
      reason: cancelled
        ? "asset load cancelled"
        : `asset load failed: ${error instanceof Error ? error.message : "unknown"}`,
    });
  } finally {
    load.done();
  }
}
