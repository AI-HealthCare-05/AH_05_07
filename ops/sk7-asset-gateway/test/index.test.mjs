import test from "node:test";
import assert from "node:assert/strict";
import { handleAssetRequest, parseMounts } from "../src/index.js";

function obj(body = "ok") {
  return { body, size: Buffer.byteLength(body), httpEtag: '"abc"', writeHttpMetadata(h) { h.set("content-type", "text/plain"); } };
}
function bucket(entries) {
  return {
    async get(key) { return entries[key] ?? null; },
    async head(key) { const hit = entries[key]; if (!hit) return null; const { body: _, ...meta } = hit; return meta; }
  };
}
const env = {
  ALLOWED_ORIGINS: "https://hyeol.app",
  ASSET_MOUNTS_JSON: JSON.stringify({ safe: { binding: "SAFE_BUCKET", prefix: "public/sk7/" } }),
  SAFE_BUCKET: bucket({ "public/sk7/file.txt": obj("ok") }),
};

test("mount config rejects traversal", () => assert.throws(() => parseMounts('{"x":{"binding":"SAFE_BUCKET","prefix":"../"}}')));
test("serves configured mount/prefix", async () => {
  const r = await handleAssetRequest(new Request("https://assets.hyeol.app/v1/safe/file.txt", { headers: { Origin: "https://hyeol.app" } }), env);
  assert.equal(r.status, 200); assert.equal(await r.text(), "ok"); assert.equal(r.headers.get("access-control-allow-origin"), "https://hyeol.app");
});
test("unknown mount is hidden", async () => assert.equal((await handleAssetRequest(new Request("https://assets.hyeol.app/v1/private/a"), env)).status, 404));
test("writes are rejected", async () => assert.equal((await handleAssetRequest(new Request("https://assets.hyeol.app/v1/safe/file.txt", { method: "PUT", body: "x" }), env)).status, 405));
test("HEAD has metadata and no body", async () => {
  const r = await handleAssetRequest(new Request("https://assets.hyeol.app/v1/safe/file.txt", { method: "HEAD" }), env);
  assert.equal(r.status, 200); assert.equal(await r.text(), ""); assert.equal(r.headers.get("etag"), '"abc"');
});
