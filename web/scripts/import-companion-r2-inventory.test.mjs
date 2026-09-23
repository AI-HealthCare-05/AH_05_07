import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompanionReviewCatalog,
  renderCompanionReviewCatalog,
  requiredReviewClips,
} from "./import-companion-r2-inventory.mjs";

const asset = Object.freeze({
  assetId: "COMPANION-R2-900",
  speciesKey: "otter",
  version: "v001",
  variantKey: "lite",
  key: "companion/v1/otter/v001/lite.glb",
  bytes: 123456,
  sha256: "a".repeat(64),
  mime: "model/gltf-binary",
  clips: [...requiredReviewClips],
  extensionsRequired: [],
  externalDependencies: [],
});

function inventory(objects = [asset]) {
  return {
    schemaVersion: "sk7-r2-inventory-export.v1",
    bucket: "read-only-review-export",
    prefix: "companion/v1/",
    publicOrigin: "https://assets.example.test",
    objects,
  };
}

test("supplied read-only inventory produces deterministic review-only output", () => {
  const second = {
    ...asset,
    assetId: "COMPANION-R2-901",
    speciesKey: "seal",
    key: "companion/v1/seal/v001/lite.glb",
    sha256: "b".repeat(64),
  };
  const forward = renderCompanionReviewCatalog(inventory([asset, second]));
  const reverse = renderCompanionReviewCatalog(inventory([second, asset]));

  assert.equal(forward, reverse);
  const catalog = JSON.parse(forward);
  assert.equal(catalog.status, "review-only");
  assert.deepEqual(catalog.entries.map((entry) => entry.assetId), [asset.assetId, second.assetId]);
  assert.equal(catalog.entries[0].reviewEligible, true);
  assert.equal("active" in catalog.entries[0], false);
  assert.equal("activation" in catalog.entries[0], false);
  assert.equal("productionEnabled" in catalog.entries[0], false);
});

test("inventory import rejects malformed input and missing digests", () => {
  assert.throws(() => buildCompanionReviewCatalog(null), /inventory: object required/);
  assert.throws(
    () => buildCompanionReviewCatalog(inventory([{ ...asset, sha256: undefined }])),
    /sha256: invalid value/,
  );
  assert.throws(
    () => buildCompanionReviewCatalog({ ...inventory(), publicOrigin: "http://assets.example.test" }),
    /HTTPS origin required/,
  );
});

test("inventory import rejects traversal, absolute, cross-prefix and non-GLB keys", () => {
  for (const key of [
    "../otter.glb",
    "/companion/v1/otter.glb",
    "companion/v1/../otter.glb",
    "other/otter.glb",
    "companion/v1/otter/v001/lite.bin",
  ]) {
    assert.throws(
      () => buildCompanionReviewCatalog(inventory([{ ...asset, key }])),
      /objectKey: (invalid value|unsafe object key)/,
    );
  }
});

test("inventory import rejects object keys that contradict declared identity", () => {
  assert.throws(
    () => buildCompanionReviewCatalog(inventory([{
      ...asset,
      key: "companion/v1/cat/v001/lite.glb",
    }])),
    /objectKey: identity path mismatch/,
  );
});

test("missing required clips and non-self-contained metadata stay review-ineligible", () => {
  const catalog = buildCompanionReviewCatalog(inventory([{
    ...asset,
    clips: requiredReviewClips.filter((clip) => clip !== "celebrate"),
    extensionsRequired: ["KHR_draco_mesh_compression"],
    externalDependencies: ["textures/otter.png"],
  }]));
  const [entry] = catalog.entries;

  assert.equal(entry.reviewEligible, false);
  assert.deepEqual(entry.capabilities.missingClips, ["celebrate"]);
  assert.equal(entry.capabilities.requiredClips, "missing");
  assert.equal(entry.capabilities.selfContainedGlb, "blocked");
});

test("GLB audit must match the supplied immutable identity", () => {
  const audit = {
    assets: [{
      asset_id: asset.assetId,
      species: "cat",
      variant: asset.variantKey,
      sha256: asset.sha256,
      bytes: asset.bytes,
      animation_clips: asset.clips.map((name) => ({ name })),
      extensions_required: [],
      external_dependencies: [],
    }],
  };

  assert.throws(
    () => buildCompanionReviewCatalog(inventory(), audit),
    /GLB audit identity mismatch/,
  );
});
