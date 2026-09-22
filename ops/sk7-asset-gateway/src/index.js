const DEFAULT_ALLOWED_ORIGINS = ["https://hyeol.app", "https://www.hyeol.app"];

export function parseCsv(value, fallback = []) {
  if (typeof value !== "string" || !value.trim()) return [...fallback];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function parseMounts(raw) {
  if (typeof raw !== "string" || !raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad mounts");
  const result = {};
  for (const [mount, value] of Object.entries(parsed)) {
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(mount)) throw new Error(`invalid mount: ${mount}`);
    const binding = String(value?.binding ?? "").trim();
    const prefix = String(value?.prefix ?? "").replace(/^\/+/, "");
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(binding)) throw new Error(`invalid binding: ${mount}`);
    if (prefix.includes("..")) throw new Error(`invalid prefix: ${mount}`);
    result[mount] = { binding, prefix };
  }
  return result;
}

export function corsHeaders(request, env) {
  const allowed = new Set(parseCsv(env.ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS));
  const origin = request.headers.get("origin");
  const headers = new Headers();
  headers.set("vary", "Origin");
  headers.set("access-control-allow-methods", "GET, HEAD, OPTIONS");
  headers.set("access-control-allow-headers", "Range, If-None-Match, If-Match, If-Modified-Since, If-Unmodified-Since");
  headers.set("access-control-expose-headers", "Content-Length, Content-Range, ETag, Last-Modified, Accept-Ranges");
  headers.set("access-control-max-age", "86400");
  if (origin && allowed.has(origin)) headers.set("access-control-allow-origin", origin);
  return { headers, allowed: !origin || allowed.has(origin) };
}

function normalizeKey(value) {
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (!decoded || decoded.startsWith("/") || decoded.includes("\0")) return null;
  const parts = decoded.split("/");
  if (parts.some((x) => !x || x === "." || x === "..")) return null;
  return parts.join("/");
}

function applyObjectHeaders(object, headers) {
  object.writeHttpMetadata?.(headers);
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  if (object.range && Number.isFinite(object.range.offset) && Number.isFinite(object.range.length)) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    headers.set("content-length", String(object.range.length));
  } else if (Number.isFinite(object.size)) {
    headers.set("content-length", String(object.size));
  }
}

function contentAddressed(key) {
  return /(?:^|[-_.])[a-f0-9]{12,64}(?:\.|$)/i.test(key);
}

export async function handleAssetRequest(request, env) {
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);

  if (url.pathname === "/healthz") {
    return new Response(JSON.stringify({ ok: true, service: "sk7-asset-gateway" }), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: cors.allowed ? 204 : 403, headers: cors.headers });
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD, OPTIONS" } });
  if (!url.pathname.startsWith("/v1/")) return new Response("Not Found", { status: 404 });

  const rest = url.pathname.slice(4);
  const slash = rest.indexOf("/");
  if (slash <= 0) return new Response("Not Found", { status: 404 });
  const mountName = rest.slice(0, slash);
  const publicKey = normalizeKey(rest.slice(slash + 1));
  if (!publicKey) return new Response("Bad asset key", { status: 400 });

  let mounts;
  try { mounts = parseMounts(env.ASSET_MOUNTS_JSON); }
  catch { return new Response("Gateway configuration error", { status: 503 }); }
  const mount = mounts[mountName];
  if (!mount) return new Response("Not Found", { status: 404 });
  const bucket = env[mount.binding];
  if (!bucket?.get || !bucket?.head) return new Response("Gateway binding unavailable", { status: 503 });

  const objectKey = `${mount.prefix}${publicKey}`;
  const headers = new Headers(cors.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", contentAddressed(objectKey) ? "public, max-age=31536000, immutable" : "public, max-age=3600");

  if (request.method === "HEAD") {
    const object = await bucket.head(objectKey);
    if (!object) return new Response("Not Found", { status: 404, headers });
    applyObjectHeaders(object, headers);
    return new Response(null, { status: 200, headers });
  }

  const object = await bucket.get(objectKey, { onlyIf: request.headers, range: request.headers });
  if (!object) return new Response("Not Found", { status: 404, headers });
  applyObjectHeaders(object, headers);
  if (!("body" in object)) return new Response(null, { status: 412, headers });
  return new Response(object.body, { status: object.range ? 206 : 200, headers });
}

export default { fetch: (request, env) => handleAssetRequest(request, env) };
