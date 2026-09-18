import test from "node:test";
import assert from "node:assert/strict";

import { validateCandidateInventory } from "./verify-companion-candidates.mjs";

const validCandidate = {
  candidateId: "COMPANION-CAND-SEAL-001",
  speciesKey: "seal",
  version: "v001",
  variantKey: "mobile_lite",
  sourceFile: "incoming/seal-v001/mobile-lite.glb",
  sha256: "a".repeat(64),
  bytes: 456789,
  clips: ["idle", "greet", "swim_loop"],
  status: "candidate",
  provenance: {
    owner: "emotigom",
    rightsBasis: "user-owned generated asset",
    sourceRevision: "batch-2026-09-18-a",
  },
};

function inventory(candidates) {
  return {
    schemaVersion: 1,
    status: "staging",
    purpose: "Review-only metadata intake. Entries here never activate a runtime companion.",
    candidates,
  };
}

test("candidate inventory accepts future species, variants and clip names without activation data", () => {
  assert.deepEqual(validateCandidateInventory(inventory([validCandidate])), {
    candidateCount: 1,
    speciesCount: 1,
    status: "staging",
  });
});

test("candidate inventory can stage a newer asset for an existing species without making it active", () => {
  const nextBear = {
    ...validCandidate,
    candidateId: "COMPANION-CAND-BEAR-008",
    speciesKey: "bear",
    version: "v008",
    variantKey: "ultra_lite",
    sha256: "b".repeat(64),
  };
  assert.equal(validateCandidateInventory(inventory([nextBear])).candidateCount, 1);
});

test("candidate inventory can stage optimized review variants for an existing species without activation", () => {
  const optimizedLite = {
    ...validCandidate,
    candidateId: "COMPANION-CAND-BEAR-V007-OPTIMIZED-LITE",
    speciesKey: "bear",
    version: "v007",
    variantKey: "optimized-lite",
    sha256: "c".repeat(64),
    status: "review",
  };

  const optimizedStandard = {
    ...optimizedLite,
    candidateId: "COMPANION-CAND-BEAR-V007-OPTIMIZED-STANDARD",
    variantKey: "optimized-standard",
    sha256: "d".repeat(64),
  };

  assert.deepEqual(
    validateCandidateInventory(
      inventory([optimizedLite, optimizedStandard]),
    ),
    {
      candidateCount: 2,
      speciesCount: 1,
      status: "staging",
    },
  );
});

for (const [key, value] of [
  ["runtimeUrl", "https://example.invalid/model.glb"],
  ["objectKey", "companion/v2/seal.glb"],
  ["productionEnabled", true],
  ["active", true],
]) {
  test(`candidate inventory rejects runtime activation field ${key}`, () => {
    assert.throws(
      () => validateCandidateInventory(inventory([{ ...validCandidate, [key]: value }])),
      /runtime activation key/,
    );
  });
}

test("candidate inventory rejects active status", () => {
  assert.throws(
    () => validateCandidateInventory(inventory([{ ...validCandidate, status: "active" }])),
    /only candidate\/review are allowed/,
  );
});

test("candidate inventory rejects duplicate binary identities", () => {
  assert.throws(
    () => validateCandidateInventory(inventory([
      validCandidate,
      { ...validCandidate, candidateId: "COMPANION-CAND-SEAL-002" },
    ])),
    /duplicate sha256/,
  );
});

test("candidate inventory rejects traversal and URLs in sourceFile", () => {
  for (const sourceFile of ["../seal.glb", "/tmp/seal.glb", "https://example.invalid/seal.glb"]) {
    assert.throws(
      () => validateCandidateInventory(inventory([{ ...validCandidate, sourceFile }])),
      /sourceFile/,
    );
  }
});
