import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultInventoryPath = path.resolve(scriptRoot, "../asset-candidates/companion-candidates.v1.json");

const topLevelKeys = new Set(["schemaVersion", "status", "purpose", "candidates"]);
const candidateKeys = new Set([
  "candidateId",
  "speciesKey",
  "version",
  "variantKey",
  "sourceFile",
  "sha256",
  "bytes",
  "clips",
  "status",
  "provenance",
]);
const provenanceKeys = new Set(["owner", "rightsBasis", "sourceRevision"]);
const forbiddenRuntimeKeys = new Set([
  "active",
  "activation",
  "runtimeUrl",
  "url",
  "objectKey",
  "screen",
  "production",
  "productionEnabled",
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label}: unsupported key ${key}`);
  }
}

function requireString(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${label}: invalid value`);
  }
}

function assertRelativeSourceFile(value, label) {
  requireString(value, /^[A-Za-z0-9][A-Za-z0-9._/-]*$/, label);
  if (value.startsWith("/") || value.includes("..") || /^[a-z]+:\/\//i.test(value)) {
    throw new Error(`${label}: sourceFile must be a safe relative review path`);
  }
}

export function validateCandidateInventory(value) {
  if (!isPlainObject(value)) throw new Error("candidate inventory must be an object");
  exactKeys(value, topLevelKeys, "candidate inventory");
  if (value.schemaVersion !== 1) throw new Error("candidate inventory schemaVersion must be 1");
  if (value.status !== "staging") throw new Error("candidate inventory status must stay staging");
  if (typeof value.purpose !== "string" || value.purpose.length < 12) {
    throw new Error("candidate inventory purpose is required");
  }
  if (!Array.isArray(value.candidates) || value.candidates.length > 2000) {
    throw new Error("candidate inventory candidates must be a bounded array");
  }

  const ids = new Set();
  const digests = new Set();

  for (const [index, candidate] of value.candidates.entries()) {
    const label = `candidate[${index}]`;
    if (!isPlainObject(candidate)) throw new Error(`${label}: must be an object`);
    for (const key of Object.keys(candidate)) {
      if (forbiddenRuntimeKeys.has(key)) {
        throw new Error(`${label}: runtime activation key ${key} is forbidden`);
      }
    }
    exactKeys(candidate, candidateKeys, label);

    requireString(candidate.candidateId, /^COMPANION-CAND-[A-Z0-9][A-Z0-9_-]{2,79}$/, `${label}.candidateId`);
    requireString(candidate.speciesKey, /^[a-z][a-z0-9_]{1,47}$/, `${label}.speciesKey`);
    requireString(candidate.version, /^v[0-9]{3,6}$/, `${label}.version`);
    requireString(candidate.variantKey, /^[a-z][a-z0-9_-]{1,31}$/, `${label}.variantKey`);
    assertRelativeSourceFile(candidate.sourceFile, `${label}.sourceFile`);
    requireString(candidate.sha256, /^[a-f0-9]{64}$/, `${label}.sha256`);

    if (!Number.isSafeInteger(candidate.bytes) || candidate.bytes <= 0 || candidate.bytes > 100_000_000) {
      throw new Error(`${label}.bytes: invalid size`);
    }
    if (!["candidate", "review"].includes(candidate.status)) {
      throw new Error(`${label}.status: only candidate/review are allowed`);
    }
    if (!Array.isArray(candidate.clips) || candidate.clips.length > 64) {
      throw new Error(`${label}.clips: invalid list`);
    }
    const clips = new Set();
    for (const clip of candidate.clips) {
      requireString(clip, /^[a-z][a-z0-9_-]{0,47}$/, `${label}.clips`);
      if (clips.has(clip)) throw new Error(`${label}.clips: duplicate ${clip}`);
      clips.add(clip);
    }

    if (!isPlainObject(candidate.provenance)) throw new Error(`${label}.provenance: required`);
    exactKeys(candidate.provenance, provenanceKeys, `${label}.provenance`);
    requireString(candidate.provenance.owner, /^[A-Za-z0-9_.-]{2,80}$/, `${label}.provenance.owner`);
    if (typeof candidate.provenance.rightsBasis !== "string" || candidate.provenance.rightsBasis.length < 4) {
      throw new Error(`${label}.provenance.rightsBasis: required`);
    }
    if (candidate.provenance.sourceRevision !== undefined) {
      requireString(candidate.provenance.sourceRevision, /^[A-Za-z0-9_.:/-]{3,160}$/, `${label}.provenance.sourceRevision`);
    }

    if (ids.has(candidate.candidateId)) throw new Error(`${label}: duplicate candidateId`);
    if (digests.has(candidate.sha256)) throw new Error(`${label}: duplicate sha256`);
    ids.add(candidate.candidateId);
    digests.add(candidate.sha256);
  }

  return Object.freeze({
    candidateCount: value.candidates.length,
    speciesCount: new Set(value.candidates.map(candidate => candidate.speciesKey)).size,
    status: value.status,
  });
}

export function readCandidateInventory(inventoryPath = defaultInventoryPath) {
  return JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventoryPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInventoryPath;
  const summary = validateCandidateInventory(readCandidateInventory(inventoryPath));
  console.log(`companion candidate inventory: ${summary.candidateCount} candidate(s), ${summary.speciesCount} species key(s), ${summary.status}`);
}
