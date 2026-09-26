import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";

export const DEVICE_CLASSES = Object.freeze(["android", "iphone", "ipad"]);
export const REVIEW_MODES = Object.freeze(["normal", "reduced-motion"]);

export function parsePinnedAssetContract(source) {
  const block = source.match(
    /export const PINNED_ACTIVE_ASSET = Object\.freeze\(\{([\s\S]*?)\}\);/,
  )?.[1];
  assert(block, "PINNED_ACTIVE_ASSET block is missing");

  const stringField = (name) => {
    const value = block.match(new RegExp("\\b" + name + ':\\s*"([^"]+)"'))?.[1];
    assert(value, "PINNED_ACTIVE_ASSET." + name + " is missing");
    return value;
  };
  const numberField = (name) => {
    const value = block.match(new RegExp("\\b" + name + ":\\s*(\\d+)"))?.[1];
    assert(value, "PINNED_ACTIVE_ASSET." + name + " is missing");
    return Number(value);
  };

  return Object.freeze({
    assetId: stringField("assetId"),
    url: stringField("url"),
    bytes: numberField("bytes"),
    sha256: stringField("sha256"),
  });
}

export function verifyPinnedAssetBytes(bytes, contract) {
  assert.equal(bytes.byteLength, contract.bytes, "pinned asset byte length mismatch");
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    contract.sha256,
    "pinned asset SHA-256 mismatch",
  );
}

export function safeStaticPath(buildRoot, pathname) {
  const relative = pathname === "/"
    ? "index.html"
    : decodeURIComponent(pathname).replace(/^\/+/, "");
  const normalized = relative.replaceAll("\\", "/");
  assert(!normalized.split("/").includes(".."), "path traversal is not allowed");
  const root = path.resolve(buildRoot);
  const candidate = path.resolve(root, normalized);
  assert(
    candidate === root || candidate.startsWith(root + path.sep),
    "path escaped build root",
  );
  return candidate;
}

export function assertReviewMode(mode) {
  assert(REVIEW_MODES.includes(mode), "invalid physical review mode");
  return mode;
}

export function assertDeviceClass(deviceClass) {
  assert(DEVICE_CLASSES.includes(deviceClass), "invalid physical review device class");
  return deviceClass;
}
