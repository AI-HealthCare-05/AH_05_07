import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const requiredReviewClips = Object.freeze([
  "idle",
  "greet",
  "move",
  "curious",
  "celebrate",
  "rest",
  "special",
]);

const scriptPath = fileURLToPath(import.meta.url);
const digestPattern = /^[a-f0-9]{64}$/;
const assetIdPattern = /^[A-Z0-9][A-Z0-9_-]{2,95}$/;
const speciesPattern = /^[a-z][a-z0-9_]{1,47}$/;
const versionPattern = /^v[0-9]{3,6}$/;
const variantPattern = /^[a-z][a-z0-9_-]{1,31}$/;
const clipPattern = /^[a-z][a-z0-9_-]{0,47}$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new Error(`${label}: object required`);
  return value;
}

function requireString(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label}: invalid value`);
  return value;
}

function requireBytes(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 100_000_000) {
    throw new Error(`${label}: invalid byte length`);
  }
  return value;
}

function requireOrigin(value, label) {
  if (typeof value !== "string") throw new Error(`${label}: HTTPS origin required`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label}: HTTPS origin required`);
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || parsed.pathname !== "/"
  ) {
    throw new Error(`${label}: HTTPS origin required`);
  }
  return parsed.origin;
}

function requirePrefix(value, label) {
  requireString(value, /^[A-Za-z0-9][A-Za-z0-9._/-]*\/$/, label);
  if (value.includes("//") || value.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error(`${label}: unsafe prefix`);
  }
  return value;
}

function requireObjectKey(value, prefix, label) {
  requireString(value, /^[A-Za-z0-9][A-Za-z0-9._/-]*\.glb$/, label);
  if (
    value.startsWith("/")
    || value.includes("//")
    || value.includes("\\")
    || value.split("/").some((segment) => segment === "." || segment === "..")
    || !value.startsWith(prefix)
  ) {
    throw new Error(`${label}: unsafe object key`);
  }
  return value;
}

function stringList(value, label, pattern = clipPattern) {
  if (!Array.isArray(value) || value.length > 64) throw new Error(`${label}: bounded array required`);
  const entries = value.map((entry, index) => requireString(entry, pattern, `${label}[${index}]`));
  if (new Set(entries).size !== entries.length) throw new Error(`${label}: duplicate entry`);
  return entries;
}

function metadataList(value, label) {
  return stringList(value, label, /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,255}$/);
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeAudit(audit) {
  if (audit === undefined || audit === null) return new Map();
  requireObject(audit, "GLB audit");
  if (!Array.isArray(audit.assets)) throw new Error("GLB audit: assets array required");
  const records = new Map();
  for (const [index, raw] of audit.assets.entries()) {
    const record = requireObject(raw, `GLB audit asset[${index}]`);
    const assetId = requireString(record.asset_id, assetIdPattern, `GLB audit asset[${index}].asset_id`);
    const sha = requireString(record.sha256, digestPattern, `GLB audit asset[${index}].sha256`);
    const bytes = requireBytes(record.bytes, `GLB audit asset[${index}].bytes`);
    const clips = Array.isArray(record.animation_clips)
      ? record.animation_clips.map((clip, clipIndex) => requireString(
          requireObject(clip, `GLB audit asset[${index}].animation_clips[${clipIndex}]`).name,
          clipPattern,
          `GLB audit asset[${index}].animation_clips[${clipIndex}].name`,
        ))
      : [];
    const extensionsRequired = metadataList(record.extensions_required ?? [], `GLB audit asset[${index}].extensions_required`);
    const externalDependencies = metadataList(record.external_dependencies ?? [], `GLB audit asset[${index}].external_dependencies`);
    if (records.has(assetId)) throw new Error(`GLB audit: duplicate asset identity ${assetId}`);
    records.set(assetId, {
      speciesKey: requireString(record.species, speciesPattern, `GLB audit asset[${index}].species`),
      variantKey: requireString(record.variant, variantPattern, `GLB audit asset[${index}].variant`),
      sha256: sha,
      bytes,
      clips,
      extensionsRequired,
      externalDependencies,
    });
  }
  return records;
}

function normalizePublishedEvidence(inventory) {
  const delivery = requireObject(inventory.runtime_delivery, "inventory.runtime_delivery");
  const bucket = requireString(delivery.bucket, /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/, "inventory.runtime_delivery.bucket");
  const prefix = requirePrefix(delivery.prefix, "inventory.runtime_delivery.prefix");
  const publicOrigin = requireOrigin(delivery.custom_domain, "inventory.runtime_delivery.custom_domain");
  if (!Array.isArray(inventory.objects)) throw new Error("inventory.objects: array required");
  return {
    bucket,
    prefix,
    publicOrigin,
    objects: inventory.objects.map((raw, index) => {
      const object = requireObject(raw, `inventory.objects[${index}]`);
      return {
        assetId: object.asset_id,
        speciesKey: object.species,
        version: object.version,
        variantKey: object.variant,
        objectKey: object.r2_object_key,
        bytes: object.bytes,
        sha256: object.sha256,
        mime: object.mime,
        clips: undefined,
        extensionsRequired: undefined,
        externalDependencies: undefined,
      };
    }),
  };
}

function normalizeSuppliedExport(inventory) {
  if (inventory.schemaVersion !== "sk7-r2-inventory-export.v1") {
    throw new Error("inventory: unsupported schema");
  }
  const bucket = requireString(inventory.bucket, /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/, "inventory.bucket");
  const prefix = requirePrefix(inventory.prefix, "inventory.prefix");
  const publicOrigin = requireOrigin(inventory.publicOrigin, "inventory.publicOrigin");
  if (!Array.isArray(inventory.objects)) throw new Error("inventory.objects: array required");
  return {
    bucket,
    prefix,
    publicOrigin,
    objects: inventory.objects.map((raw, index) => {
      const object = requireObject(raw, `inventory.objects[${index}]`);
      return {
        assetId: object.assetId,
        speciesKey: object.speciesKey,
        version: object.version,
        variantKey: object.variantKey,
        objectKey: object.key,
        bytes: object.bytes,
        sha256: object.sha256,
        mime: object.mime,
        clips: object.clips,
        extensionsRequired: object.extensionsRequired,
        externalDependencies: object.externalDependencies,
      };
    }),
  };
}

export function buildCompanionReviewCatalog(inventoryValue, auditValue) {
  const inventory = requireObject(inventoryValue, "inventory");
  const normalized = inventory.schema_version === 2
    ? normalizePublishedEvidence(inventory)
    : normalizeSuppliedExport(inventory);
  const audit = normalizeAudit(auditValue);
  const ids = new Set();
  const digests = new Set();
  const keys = new Set();

  const entries = normalized.objects.map((raw, index) => {
    const label = `inventory.objects[${index}]`;
    const assetId = requireString(raw.assetId, assetIdPattern, `${label}.assetId`);
    const speciesKey = requireString(raw.speciesKey, speciesPattern, `${label}.speciesKey`);
    const version = requireString(raw.version, versionPattern, `${label}.version`);
    const variantKey = requireString(raw.variantKey, variantPattern, `${label}.variantKey`);
    const objectKey = requireObjectKey(raw.objectKey, normalized.prefix, `${label}.objectKey`);
    const expectedObjectKey = `${normalized.prefix}${speciesKey}/${version}/${variantKey}.glb`;
    if (objectKey !== expectedObjectKey) throw new Error(`${label}.objectKey: identity path mismatch`);
    const bytes = requireBytes(raw.bytes, `${label}.bytes`);
    const digest = requireString(raw.sha256, digestPattern, `${label}.sha256`);
    if (raw.mime !== "model/gltf-binary") throw new Error(`${label}.mime: model/gltf-binary required`);
    if (ids.has(assetId)) throw new Error(`${label}: duplicate asset identity`);
    if (digests.has(digest)) throw new Error(`${label}: duplicate digest`);
    if (keys.has(objectKey)) throw new Error(`${label}: duplicate object key`);
    ids.add(assetId);
    digests.add(digest);
    keys.add(objectKey);

    const inspected = audit.get(assetId);
    if (inspected && (
      inspected.speciesKey !== speciesKey
      || inspected.variantKey !== variantKey
      || inspected.sha256 !== digest
      || inspected.bytes !== bytes
    )) {
      throw new Error(`${label}: GLB audit identity mismatch`);
    }
    const clips = stringList(raw.clips ?? inspected?.clips ?? [], `${label}.clips`).sort();
    const extensionsRequired = metadataList(
      raw.extensionsRequired ?? inspected?.extensionsRequired ?? [],
      `${label}.extensionsRequired`,
    ).sort();
    const externalDependencies = metadataList(
      raw.externalDependencies ?? inspected?.externalDependencies ?? [],
      `${label}.externalDependencies`,
    ).sort();
    const missingClips = requiredReviewClips.filter((clip) => !clips.includes(clip));
    const requiredClipsComplete = missingClips.length === 0;
    const selfContainedGlb = extensionsRequired.length === 0 && externalDependencies.length === 0;
    return {
      assetId,
      speciesKey,
      version,
      variantKey,
      objectKey,
      url: `${normalized.publicOrigin}/${objectKey}`,
      bytes,
      sha256: digest,
      mime: "model/gltf-binary",
      clips,
      capabilities: {
        exactIdentity: "verified",
        requiredClips: requiredClipsComplete ? "complete" : "missing",
        selfContainedGlb: selfContainedGlb ? "complete" : "blocked",
        missingClips,
        extensionsRequired,
        externalDependencies,
      },
      reviewEligible: requiredClipsComplete && selfContainedGlb,
    };
  }).sort((left, right) => left.assetId.localeCompare(right.assetId));

  const sourceIdentity = {
    bucket: normalized.bucket,
    prefix: normalized.prefix,
    publicOrigin: normalized.publicOrigin,
    objects: entries.map(({ assetId, objectKey, bytes, sha256: digest }) => ({ assetId, objectKey, bytes, sha256: digest })),
  };
  return {
    schemaVersion: 1,
    status: "review-only",
    purpose: "Read-only companion development catalog. Catalog inclusion never grants product activation.",
    source: {
      bucket: normalized.bucket,
      prefix: normalized.prefix,
      publicOrigin: normalized.publicOrigin,
      inventorySha256: sha256(stableSerialize(sourceIdentity)),
    },
    requiredClips: [...requiredReviewClips],
    entries,
  };
}

export function renderCompanionReviewCatalog(inventoryValue, auditValue) {
  return `${JSON.stringify(buildCompanionReviewCatalog(inventoryValue, auditValue), null, 2)}\n`;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const inventoryPath = argument("--inventory");
  const outputPath = argument("--output");
  const auditPath = argument("--audit");
  if (!inventoryPath || !outputPath) {
    throw new Error("usage: import-companion-r2-inventory.mjs --inventory <read-only-json> [--audit <glb-audit-json>] --output <catalog-json> [--check]");
  }
  const inventory = JSON.parse(fs.readFileSync(path.resolve(inventoryPath), "utf8"));
  const audit = auditPath ? JSON.parse(fs.readFileSync(path.resolve(auditPath), "utf8")) : undefined;
  const rendered = renderCompanionReviewCatalog(inventory, audit);
  const resolvedOutput = path.resolve(outputPath);
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(resolvedOutput) || fs.readFileSync(resolvedOutput, "utf8") !== rendered) {
      throw new Error("companion review catalog is stale or differs from supplied inventory");
    }
    process.stdout.write("companion review catalog: deterministic read-only import verified\n");
  } else {
    fs.writeFileSync(resolvedOutput, rendered);
    process.stdout.write(`companion review catalog: wrote ${buildCompanionReviewCatalog(inventory, audit).entries.length} entries\n`);
  }
}
