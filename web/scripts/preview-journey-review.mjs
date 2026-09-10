import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { journeyReviewFixture } from './journey-review-fixture.mjs';

// Reuses the existing signed-in harness and phone-review transport pattern.
// A separate ignored output directory prevents serving a normal production build
// with test authentication. This tool is never part of the Vite entry graph.
const web = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(web, 'test-results/living-scene-review/journey-preview');
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--', '--outDir', dist], {
  cwd: web, stdio: 'inherit', env: { ...process.env, VITE_API_BASE_URL: 'http://e2e.invalid',
    VITE_SUPABASE_URL: 'https://e2e.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-test-publishable-key',
    VITE_SK7_E2E_MODE: '1', VITE_SK7_SCENE_MODE: 'review', VITE_SK7_COMPANION_MODE: 'production' },
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = new Map();
async function addFiles(directory = '') {
  for (const entry of await readdir(path.join(dist, directory), { withFileTypes: true })) {
    const name = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await addFiles(name);
    else if (entry.isFile()) files.set(`/${name}`, await readFile(path.join(dist, name)));
  }
}
await addFiles();
const generated = await readFile(path.join(web, 'src/ui/companionAssets.generated.ts'), 'utf8');
const manifest = JSON.parse(generated.match(/export const companionAssetManifest = ([\s\S]*?) as const\b/)[1]);
for (const asset of Object.values(manifest.bear)) {
  const url = new URL(asset.url);
  assert.equal(url.origin, 'https://sk7-companion.gkrry.com');
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, asset.bytes);
    assert.equal(hash(bytes), asset.sha256);
    files.set(`/review-media${url.pathname}`, bytes);
  } catch { console.log('Registered bear media unavailable; existing static fallback remains usable.'); }
}
const script = `(${journeyReviewFixture.toString()})();`;
const scriptHash = createHash('sha256').update(script).digest('base64');
files.set('/index.html', Buffer.from(files.get('/index.html').toString().replace('<head>', `<head><script>${script}</script>`).replace('<title>', '<title>로컬 합성 검토 · ')));
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': `default-src 'none'; script-src 'self' 'sha256-${scriptHash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://sk7-companion.gkrry.com https://sk7-assets.gomdory.com; connect-src 'self'; font-src 'self' data:; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary' };
createServer((req, res) => {
  if (!['127.0.0.1:4177', 'localhost:4177'].includes(req.headers.host)) { res.writeHead(400); res.end(); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, headers); res.end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:4177');
  if (url.pathname === '/' && url.searchParams.get('e2e') !== 'signed-in') {
    res.writeHead(302, { ...headers, Location: '/?e2e=signed-in&screen=S02' }); res.end(); return;
  }
  const name = url.pathname === '/' ? '/index.html' : url.pathname;
  const bytes = files.get(name);
  if (!bytes) { res.writeHead(404, headers); res.end(); return; }
  res.writeHead(200, { ...headers, 'Content-Type': mime[path.extname(name)] ?? 'application/octet-stream', 'Content-Length': bytes.length });
  res.end(req.method === 'HEAD' ? undefined : bytes);
}).listen(4177, '127.0.0.1', () => console.log('Local synthetic review: http://127.0.0.1:4177 — use only 120 / 80; no API writes or persisted inputs.'));
