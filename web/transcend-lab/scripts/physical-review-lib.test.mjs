import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertDeviceClass,
  assertReviewMode,
  parsePinnedAssetContract,
  safeStaticPath,
  verifyPinnedAssetBytes,
} from "./physical-review-lib.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const lab = path.resolve(scripts, "..");

test("reads the exact pinned W1 bear contract from source", () => {
  const source = readFileSync(
    path.join(lab, "src/platform/embodiment/labEmbodimentPort.ts"),
    "utf8",
  );
  assert.deepEqual(parsePinnedAssetContract(source), {
    assetId: "COMPANION-R2-001",
    url: "https://sk7-companion.gkrry.com/companion/v1/bear/v007/lite.glb",
    bytes: 518636,
    sha256: "7960a83fc11ffb57943227172caebe0dbabbd78a84f302d69df50e8ddcbc4874",
  });
});

test("verifies exact bytes and rejects a mismatched hash", () => {
  const bytes = Buffer.from("abc");
  const contract = {
    bytes: 3,
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  };
  assert.doesNotThrow(() => verifyPinnedAssetBytes(bytes, contract));
  assert.throws(
    () => verifyPinnedAssetBytes(bytes, { ...contract, sha256: "0".repeat(64) }),
    /SHA-256 mismatch/,
  );
});

test("static path resolution stays inside the build root", () => {
  const root = "/tmp/transcend-physical-review-build";
  assert.equal(
    safeStaticPath(root, "/assets/app.js"),
    path.join(root, "assets/app.js"),
  );
  assert.throws(() => safeStaticPath(root, "/../secret"), /path traversal/);
});

test("device and review mode validators reject unknown values", () => {
  assert.equal(assertDeviceClass("android"), "android");
  assert.equal(assertDeviceClass("iphone"), "iphone");
  assert.equal(assertReviewMode("normal"), "normal");
  assert.equal(assertReviewMode("reduced-motion"), "reduced-motion");
  assert.throws(() => assertDeviceClass("desktop"), /invalid physical review device class/);
  assert.throws(() => assertReviewMode("simulator"), /invalid physical review mode/);
});
