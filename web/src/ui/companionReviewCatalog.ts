import rawCatalog from "../../asset-candidates/companion-review-catalog.v1.json" with { type: "json" };
import { companionClips, type CompanionClip } from "./companion";

export type CompanionReviewClip = CompanionClip;

export type CompanionReviewCapabilityStatus = Readonly<{
  exactIdentity: "verified";
  requiredClips: "complete" | "missing";
  selfContainedGlb: "complete" | "blocked";
  missingClips: readonly CompanionClip[];
  extensionsRequired: readonly string[];
  externalDependencies: readonly string[];
}>;

export type CompanionReviewCatalogEntry = Readonly<{
  assetId: string;
  speciesKey: string;
  version: string;
  variantKey: string;
  objectKey: string;
  url: string;
  bytes: number;
  sha256: string;
  mime: "model/gltf-binary";
  clips: readonly CompanionClip[];
  capabilities: CompanionReviewCapabilityStatus;
  reviewEligible: boolean;
}>;

type CompanionReviewCatalog = Readonly<{
  schemaVersion: 1;
  status: "review-only";
  purpose: string;
  source: Readonly<{
    bucket: string;
    prefix: string;
    publicOrigin: string;
    inventorySha256: string;
  }>;
  requiredClips: readonly CompanionClip[];
  entries: readonly CompanionReviewCatalogEntry[];
}>;

const digestPattern = /^[a-f0-9]{64}$/;
const assetIdPattern = /^[A-Z0-9][A-Z0-9_-]{2,95}$/;
const speciesPattern = /^[a-z][a-z0-9_]{1,47}$/;
const versionPattern = /^v[0-9]{3,6}$/;
const variantPattern = /^[a-z][a-z0-9_-]{1,31}$/;
const entryKeys = new Set([
  "assetId", "speciesKey", "version", "variantKey", "objectKey", "url",
  "bytes", "sha256", "mime", "clips", "capabilities", "reviewEligible",
]);
const capabilityKeys = new Set([
  "exactIdentity", "requiredClips", "selfContainedGlb", "missingClips",
  "extensionsRequired", "externalDependencies",
]);
const sourceKeys = new Set(["bucket", "prefix", "publicOrigin", "inventorySha256"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).length === keys.size && Object.keys(value).every((key) => keys.has(key));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isSafeObjectKey(value: string, prefix: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*\.glb$/.test(value)
    && value.startsWith(prefix)
    && !value.includes("//")
    && !value.includes("\\")
    && !value.split("/").some((segment) => segment === "." || segment === "..");
}

function requireCatalog(value: unknown): CompanionReviewCatalog {
  if (!isObject(value) || value.schemaVersion !== 1 || value.status !== "review-only") {
    throw new Error("companion review catalog identity is invalid");
  }
  const requiredClips = value.requiredClips;
  const rawEntries = value.entries;
  const source = value.source;
  if (!Array.isArray(requiredClips) || !Array.isArray(rawEntries) || !isObject(source)) {
    throw new Error("companion review catalog shape is invalid");
  }
  if (
    requiredClips.length !== companionClips.length
    || companionClips.some((clip, index) => requiredClips[index] !== clip)
  ) {
    throw new Error("companion review catalog required clips diverge from runtime policy");
  }
  let publicOrigin: URL;
  try {
    publicOrigin = new URL(String(source.publicOrigin));
  } catch {
    throw new Error("companion review catalog source identity is invalid");
  }
  if (
    !hasExactKeys(source, sourceKeys)
    || typeof source.bucket !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(source.bucket)
    || typeof source.prefix !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._/-]*\/$/.test(source.prefix)
    || source.prefix.includes("//")
    || source.prefix.split("/").some((segment) => segment === "." || segment === "..")
    || publicOrigin.protocol !== "https:"
    || publicOrigin.username
    || publicOrigin.password
    || publicOrigin.pathname !== "/"
    || publicOrigin.search
    || publicOrigin.hash
    || typeof source.inventorySha256 !== "string"
    || !digestPattern.test(source.inventorySha256)
    || typeof value.purpose !== "string"
    || value.purpose.length < 12
  ) {
    throw new Error("companion review catalog source identity is invalid");
  }
  const entries: CompanionReviewCatalogEntry[] = [];
  const ids = new Set<string>();
  const digests = new Set<string>();
  for (const [index, candidate] of rawEntries.entries()) {
    if (!isObject(candidate) || !isObject(candidate.capabilities)) {
      throw new Error(`companion review catalog entry ${index} is invalid`);
    }
    const clips = candidate.clips;
    const missingClips = candidate.capabilities.missingClips;
    const extensionsRequired = candidate.capabilities.extensionsRequired;
    const externalDependencies = candidate.capabilities.externalDependencies;
    if (
      !hasExactKeys(candidate, entryKeys)
      || !hasExactKeys(candidate.capabilities, capabilityKeys)
      || typeof candidate.assetId !== "string"
      || !assetIdPattern.test(candidate.assetId)
      || typeof candidate.speciesKey !== "string"
      || !speciesPattern.test(candidate.speciesKey)
      || typeof candidate.version !== "string"
      || !versionPattern.test(candidate.version)
      || typeof candidate.variantKey !== "string"
      || !variantPattern.test(candidate.variantKey)
      || typeof candidate.objectKey !== "string"
      || !isSafeObjectKey(candidate.objectKey, source.prefix as string)
      || candidate.objectKey !== `${source.prefix}${candidate.speciesKey}/${candidate.version}/${candidate.variantKey}.glb`
      || typeof candidate.url !== "string"
      || candidate.url !== `${publicOrigin.origin}/${candidate.objectKey}`
      || !Number.isSafeInteger(candidate.bytes)
      || Number(candidate.bytes) <= 0
      || Number(candidate.bytes) > 100_000_000
      || typeof candidate.sha256 !== "string"
      || !digestPattern.test(candidate.sha256)
      || candidate.mime !== "model/gltf-binary"
      || !isStringArray(clips)
      || !isStringArray(missingClips)
      || !isStringArray(extensionsRequired)
      || !isStringArray(externalDependencies)
      || candidate.capabilities.exactIdentity !== "verified"
      || !["complete", "missing"].includes(String(candidate.capabilities.requiredClips))
      || !["complete", "blocked"].includes(String(candidate.capabilities.selfContainedGlb))
      || typeof candidate.reviewEligible !== "boolean"
    ) {
      throw new Error(`companion review catalog entry ${index} is incomplete`);
    }
    if (
      new Set(clips).size !== clips.length
      || clips.some((clip) => !companionClips.includes(clip as CompanionClip))
      || new Set(missingClips).size !== missingClips.length
      || missingClips.some((clip) => !companionClips.includes(clip as CompanionClip))
      || extensionsRequired.some((entry) => entry.length === 0)
      || externalDependencies.some((entry) => entry.length === 0)
    ) {
      throw new Error(`companion review catalog entry ${index} capability metadata is invalid`);
    }
    const expectedMissing = companionClips.filter((clip) => !clips.includes(clip));
    if (
      expectedMissing.length !== missingClips.length
      || expectedMissing.some((clip, missingIndex) => missingClips[missingIndex] !== clip)
      || (candidate.capabilities.requiredClips === "complete") !== (expectedMissing.length === 0)
      || (candidate.capabilities.selfContainedGlb === "complete")
        !== (extensionsRequired.length === 0 && externalDependencies.length === 0)
    ) {
      throw new Error(`companion review catalog entry ${index} capability status is invalid`);
    }
    const expectedEligible = candidate.capabilities.requiredClips === "complete"
      && candidate.capabilities.selfContainedGlb === "complete"
      && missingClips.length === 0
      && companionClips.every((clip) => clips.includes(clip));
    if (candidate.reviewEligible !== expectedEligible) {
      throw new Error(`companion review catalog entry ${index} eligibility mismatch`);
    }
    if (ids.has(candidate.assetId) || digests.has(candidate.sha256)) {
      throw new Error(`companion review catalog entry ${index} duplicates immutable identity`);
    }
    ids.add(candidate.assetId);
    digests.add(candidate.sha256);
    entries.push(Object.freeze({
      assetId: candidate.assetId,
      speciesKey: candidate.speciesKey,
      version: candidate.version,
      variantKey: candidate.variantKey,
      objectKey: candidate.objectKey,
      url: candidate.url,
      bytes: Number(candidate.bytes),
      sha256: candidate.sha256,
      mime: "model/gltf-binary" as const,
      clips: Object.freeze([...(clips as CompanionClip[])]),
      capabilities: Object.freeze({
        exactIdentity: "verified" as const,
        requiredClips: candidate.capabilities.requiredClips as "complete" | "missing",
        selfContainedGlb: candidate.capabilities.selfContainedGlb as "complete" | "blocked",
        missingClips: Object.freeze([...(missingClips as CompanionClip[])]),
        extensionsRequired: Object.freeze([...extensionsRequired]),
        externalDependencies: Object.freeze([...externalDependencies]),
      }),
      reviewEligible: candidate.reviewEligible,
    }));
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "review-only",
    purpose: String(value.purpose),
    source: Object.freeze({
      bucket: source.bucket as string,
      prefix: source.prefix as string,
      publicOrigin: publicOrigin.origin,
      inventorySha256: source.inventorySha256 as string,
    }),
    requiredClips: Object.freeze([...(requiredClips as CompanionClip[])]),
    entries: Object.freeze(entries),
  });
}

export const companionReviewCatalog = requireCatalog(rawCatalog);

const reviewCatalogByAssetId = new Map(
  companionReviewCatalog.entries.map((entry) => [entry.assetId, entry] as const),
);

/** Read-only review lookup. It has no activation operation or production fallback. */
export function getCompanionReviewCatalogEntry(assetId: string): CompanionReviewCatalogEntry | null {
  return reviewCatalogByAssetId.get(assetId) ?? null;
}

export function getReviewEligibleCompanionAsset(assetId: string): CompanionReviewCatalogEntry | null {
  const entry = getCompanionReviewCatalogEntry(assetId);
  return entry?.reviewEligible ? entry : null;
}
