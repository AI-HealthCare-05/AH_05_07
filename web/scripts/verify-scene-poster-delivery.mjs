// Read-only public GET verification. --write records observations, never uploads.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadInputs, posterDeliveryOrigin, posterRequestOrigin, verifiedPosterDelivery } from "./verify-scene-manifest.mjs";

const { posters } = loadInputs();
const objects = [];
for (let offset = 0; offset < posters.posters.length; offset += 4) {
  objects.push(...await Promise.all(posters.posters.slice(offset, offset + 4).map(async poster => {
    const url = `${posterDeliveryOrigin}/${poster.delivery.objectKey}`;
    const response = await fetch(url, { headers: { Origin: posterRequestOrigin }, redirect: "error", signal: AbortSignal.timeout(15000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const headers = Object.fromEntries(["content-type", "content-length", "cache-control", "access-control-allow-origin", "etag", "cf-cache-status"].map(key => [key, response.headers.get(key)]));
    return { id: poster.id, url, objectKey: poster.delivery.objectKey, status: response.status,
      sha256: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length, headers };
  })));
}
const proof = { status: "verified-public-delivery-review-only", verifiedAt: new Date().toISOString(),
  bucket: "sk7-assets-prod", publicOrigin: posterDeliveryOrigin, requestOrigin: posterRequestOrigin,
  cachePolicy: "Existing CDN max-age=14400 (4 hours). No immutable response directive claimed; content-addressed keys are not overwritten.",
  applicationDeployment: false, objects };
for (const poster of posters.posters) verifiedPosterDelivery(poster, proof);
if (process.argv.includes("--write")) await fs.writeFile(new URL("../../docs/evidence/scene-clay-r2.json", import.meta.url), `${JSON.stringify(proof, null, 2)}\n`);
console.log(`Verified ${objects.length} public posters: exact SHA-256, bytes, WebP, CORS and existing 4-hour cache policy.`);
