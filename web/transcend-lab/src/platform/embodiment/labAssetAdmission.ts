import { getCompanionRuntimeMembership } from "../../../../src/ui/companionRuntimeMembership";
import {
  companionReviewCatalog,
  getReviewEligibleCompanionAsset,
  type CompanionReviewClip,
  type CompanionReviewCatalogEntry,
} from "../../../../src/ui/companionReviewCatalog";

export type ReviewClip = CompanionReviewClip;

import {
  LabResourceLedger,
  PINNED_ACTIVE_ASSET,
} from "./labEmbodimentPort";

type Membership = ReturnType<typeof getCompanionRuntimeMembership>;
export type MembershipReader = (assetId: string) => Membership;
export type ReviewCatalogReader = (assetId: string) => CompanionReviewCatalogEntry | null;
export type AssetRequester = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type VerifiedPinnedAsset = Readonly<{
  assetId: string;
  url: string;
  sha256: string;
  responseBytes: number;
  bytes: ArrayBuffer;
  animationNames: readonly string[];
  clipName: CompanionReviewClip;
}>;

export type AssetAdmissionResult =
  | Readonly<{
      status: "loaded";
      assetId: string;
      url: string;
      sha256: string;
      responseBytes: number;
      verification: "actual-response-sha256";
      container: "self-contained-glb-v2";
      animationNames: readonly string[];
      clipName: CompanionReviewClip;
      authority: "active-membership" | "review-catalog";
    }>
  | Readonly<{
      status: "rejected" | "failed" | "cancelled";
      assetId: string;
      reason: string;
    }>;

export type GlbInspection = Readonly<{
  version: 2;
  animationNames: readonly string[];
}>;

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const UNSUPPORTED_CODEC_EXTENSIONS = new Set([
  "EXT_meshopt_compression",
  "KHR_draco_mesh_compression",
  "KHR_texture_basisu",
]);

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

function asRecords(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    : [];
}

function asStrings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function inspectSelfContainedGlb(bytes: ArrayBuffer): GlbInspection {
  if (bytes.byteLength < 20) throw new Error("GLB header is truncated");
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error("payload is not a GLB container");
  if (view.getUint32(4, true) !== 2) throw new Error("only GLB version 2 is supported");
  if (view.getUint32(8, true) !== bytes.byteLength) throw new Error("GLB declared length does not match response bytes");

  let offset = 12;
  let json: Record<string, unknown> | null = null;
  let chunkIndex = 0;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error("GLB chunk header is truncated");
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength % 4 !== 0 || offset + chunkLength > bytes.byteLength) {
      throw new Error("GLB chunk length is invalid");
    }
    if (chunkIndex === 0 && chunkType !== JSON_CHUNK) throw new Error("GLB first chunk is not JSON");
    if (chunkType === JSON_CHUNK) {
      if (json) throw new Error("GLB contains multiple JSON chunks");
      const text = new TextDecoder().decode(new Uint8Array(bytes, offset, chunkLength)).replace(/[\u0000\s]+$/u, "");
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("GLB JSON root is invalid");
      json = parsed as Record<string, unknown>;
    }
    offset += chunkLength;
    chunkIndex += 1;
  }
  if (!json || offset !== bytes.byteLength) throw new Error("GLB JSON chunk is missing");

  const asset = json.asset;
  if (!asset || typeof asset !== "object" || (asset as Record<string, unknown>).version !== "2.0") {
    throw new Error("GLB asset version is not 2.0");
  }
  const uriOwner = [
    ...asRecords(json.buffers),
    ...asRecords(json.images),
  ].find((entry) => typeof entry.uri === "string");
  if (uriOwner) throw new Error("GLB external/data URI is not allowed");

  const extensions = new Set([
    ...asStrings(json.extensionsUsed),
    ...asStrings(json.extensionsRequired),
  ]);
  const unsupportedCodec = [...extensions].find((extension) => UNSUPPORTED_CODEC_EXTENSIONS.has(extension));
  if (unsupportedCodec) throw new Error(`GLB codec extension is unsupported: ${unsupportedCodec}`);

  const animationNames = asRecords(json.animations).map((animation, index) =>
    typeof animation.name === "string" && animation.name ? animation.name : `animation-${index}`,
  );
  return Object.freeze({ version: 2 as const, animationNames: Object.freeze(animationNames) });
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Verify the actual received bytes before any GLTFLoader parse is allowed. */
export async function verifyGlbPayload(
  bytes: ArrayBuffer,
  expected: Readonly<{ bytes: number; sha256: string }>,
): Promise<GlbInspection> {
  if (bytes.byteLength !== expected.bytes) {
    throw new Error(`asset byte length mismatch: expected ${expected.bytes}, received ${bytes.byteLength}`);
  }
  const actualSha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
  if (actualSha256 !== expected.sha256) {
    throw new Error(`asset SHA-256 mismatch: expected ${expected.sha256}, received ${actualSha256}`);
  }
  return inspectSelfContainedGlb(bytes);
}

type ExactReviewAsset = Readonly<{
  assetId: string;
  url: string;
  bytes: number;
  sha256: string;
}>;

async function requestVerifiedAsset(options: Readonly<{
  resources: LabResourceLedger;
  asset: ExactReviewAsset;
  requiredClips: readonly CompanionReviewClip[];
  clipName: CompanionReviewClip;
  authority: "active-membership" | "review-catalog";
  requester: AssetRequester;
  onVerified?: (asset: VerifiedPinnedAsset) => void | Promise<void>;
}>): Promise<AssetAdmissionResult> {
  const { asset } = options;
  const load = options.resources.beginLoad();
  try {
    const response = await options.requester(asset.url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
      signal: load.signal,
      headers: { Accept: "model/gltf-binary,application/octet-stream;q=0.9" },
    });
    if (!options.resources.isCurrent(load.generation) || load.signal.aborted) {
      return Object.freeze({ status: "cancelled" as const, assetId: asset.assetId, reason: "stale load generation" });
    }
    if (!response.ok) {
      return Object.freeze({ status: "failed" as const, assetId: asset.assetId, reason: `asset response ${response.status}` });
    }
    const body = await response.arrayBuffer();
    if (!options.resources.isCurrent(load.generation) || load.signal.aborted) {
      return Object.freeze({ status: "cancelled" as const, assetId: asset.assetId, reason: "stale load generation" });
    }
    const inspection = await verifyGlbPayload(body, asset);
    const missingClips = options.requiredClips.filter((clip) => !inspection.animationNames.includes(clip));
    const selectedClipMissing = !inspection.animationNames.includes(options.clipName);
    if (missingClips.length > 0 || selectedClipMissing) {
      const missing = selectedClipMissing ? [...missingClips, options.clipName] : missingClips;
      throw new Error(`asset clip contract mismatch: missing ${[...new Set(missing)].join(", ")}`);
    }
    if (!options.resources.isCurrent(load.generation) || load.signal.aborted) {
      return Object.freeze({ status: "cancelled" as const, assetId: asset.assetId, reason: "stale load generation" });
    }
    await options.onVerified?.(Object.freeze({
      assetId: asset.assetId,
      url: asset.url,
      sha256: asset.sha256,
      responseBytes: body.byteLength,
      bytes: body.slice(0),
      animationNames: inspection.animationNames,
      clipName: options.clipName,
    }));
    if (!options.resources.isCurrent(load.generation) || load.signal.aborted) {
      return Object.freeze({ status: "cancelled" as const, assetId: asset.assetId, reason: "stale load generation" });
    }
    return Object.freeze({
      status: "loaded" as const,
      assetId: asset.assetId,
      url: asset.url,
      sha256: asset.sha256,
      responseBytes: body.byteLength,
      verification: "actual-response-sha256" as const,
      container: "self-contained-glb-v2" as const,
      animationNames: inspection.animationNames,
      clipName: options.clipName,
      authority: options.authority,
    });
  } catch (error) {
    const cancelled = load.signal.aborted || !options.resources.isCurrent(load.generation);
    return Object.freeze({
      status: cancelled ? ("cancelled" as const) : ("failed" as const),
      assetId: asset.assetId,
      reason: cancelled
        ? "asset load cancelled"
        : `asset load failed: ${error instanceof Error ? error.message : "unknown"}`,
    });
  } finally {
    load.done();
  }
}

/** Admission completes before the requester is called; every negative authority path is zero-request. */
export async function loadPinnedActiveAsset(options: Readonly<{
  resources: LabResourceLedger;
  requestedAssetId?: string;
  membershipReader?: MembershipReader;
  requester?: AssetRequester;
  onVerified?: (asset: VerifiedPinnedAsset) => void | Promise<void>;
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
  return requestVerifiedAsset({
    resources: options.resources,
    asset: PINNED_ACTIVE_ASSET,
    requiredClips: ["idle"],
    clipName: "idle",
    authority: "active-membership",
    requester,
    onVerified: options.onVerified,
  });
}

/** Review admission is catalog-only and cannot modify or satisfy active product membership. */
export async function loadReviewCatalogAsset(options: Readonly<{
  resources: LabResourceLedger;
  assetId: string;
  clipName: CompanionReviewClip;
  catalogReader?: ReviewCatalogReader;
  requester?: AssetRequester;
  onVerified?: (asset: VerifiedPinnedAsset) => void | Promise<void>;
}>): Promise<AssetAdmissionResult> {
  const catalogReader = options.catalogReader ?? getReviewEligibleCompanionAsset;
  const requester = options.requester ?? window.fetch.bind(window);
  let asset: CompanionReviewCatalogEntry | null;
  try {
    asset = catalogReader(options.assetId);
  } catch (error) {
    return Object.freeze({
      status: "rejected" as const,
      assetId: options.assetId,
      reason: `review catalog authority threw: ${error instanceof Error ? error.message : "unknown"}`,
    });
  }
  if (
    !asset
    || asset.assetId !== options.assetId
    || !asset.reviewEligible
    || asset.capabilities.exactIdentity !== "verified"
    || asset.capabilities.requiredClips !== "complete"
    || asset.capabilities.selfContainedGlb !== "complete"
  ) {
    return Object.freeze({
      status: "rejected" as const,
      assetId: options.assetId,
      reason: "asset is not an exact capability-complete review catalog entry",
    });
  }
  if (
    !companionReviewCatalog.requiredClips.includes(options.clipName)
    || !asset.clips.includes(options.clipName)
  ) {
    return Object.freeze({
      status: "rejected" as const,
      assetId: options.assetId,
      reason: `review clip is unavailable: ${options.clipName}`,
    });
  }
  return requestVerifiedAsset({
    resources: options.resources,
    asset,
    requiredClips: companionReviewCatalog.requiredClips,
    clipName: options.clipName,
    authority: "review-catalog",
    requester,
    onVerified: options.onVerified,
  });
}
