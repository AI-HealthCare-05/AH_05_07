/** Node-only asset / source contract checks. Run from web: node --test scripts/frontend-assets.test.mjs */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const manifest = JSON.parse(read('scripts/frontend-assets.manifest.json'));

test('registry counts describe unique assets, not duplicated resolutions', () => {
  assert.equal(manifest.assets.length, 48);
  const ids = kind => new Set(manifest.assets.filter(x => x.kind === kind).map(x => x.id));
  assert.equal(ids('icons').size, 32); assert.equal(ids('objects').size, 6); assert.equal(ids('decor').size, 4);
  assert.equal(new Set(manifest.assets.map(x => x.path)).size, 48);
  assert.equal(manifest.production_activated, false);
});

for (const item of manifest.assets) test(`immutable local asset: ${item.path}`, () => {
  assert.match(item.path, /^assets\/ui\/v1\/(icons|objects|decor)\/[a-z0-9-]+\.(svg|webp)$/);
  const file = resolve(root, 'public', item.path);
  assert.ok(file.startsWith(resolve(root, 'public') + '/'));
  const bytes = readFileSync(file);
  assert.equal(bytes.length, item.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
  assert.ok(bytes.length < 32000, 'individual small-UI asset budget');
  if (extname(file) === '.svg') {
    const svg = bytes.toString('utf8');
    assert.match(svg, /^<svg\s/); assert.match(svg, /viewBox=/);
    assert.doesNotMatch(svg, /<script|foreignObject|<text|<image|\son\w+=|\shref=|\sid=|url\(|@import/i);
    if (item.kind === 'icons') {
      assert.match(svg, /viewBox="0 0 24 24"/);
      assert.match(svg, /stroke="currentColor"/);
      assert.match(svg, /aria-hidden="true"/);
      assert.match(svg, /focusable="false"/);
    }
  } else {
    assert.equal(bytes.subarray(0,4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8,12).toString(), 'WEBP');
  }
});

test('inline icons carry no external image dependency or shared SVG ids', () => {
  const source = read('src/components/UiIcon.tsx');
  assert.match(source, /aria-hidden="true"/); assert.match(source, /focusable="false"/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML\s*=|<img|<use|<canvas|fetch\(/);
  for (const item of manifest.assets.filter(x => x.kind === 'icons')) {
    assert.ok(read('src/ui/uiIconPaths.ts').includes(JSON.stringify(item.id) + ':'), item.id);
  }
});

test('object component is a nonblocking decorative image with quiet failure', () => {
  const source = read('src/components/UiObject.tsx');
  for (const contract of ['alt=""', 'aria-hidden="true"', 'loading="lazy"', 'decoding="async"', 'fetchPriority="low"', 'event.currentTarget.hidden = true', 'key={src}', 'width={320}', 'height={320}']) assert.ok(source.includes(contract), contract);
  assert.doesNotMatch(source, /<canvas|fetch\(|localStorage|requestAnimationFrame|retry\s*\(|setTimeout\(/);
});

test('scoped UI keeps native controls and motion-independent state', () => {
  const css = read('src/components/frontend-assets.css');
  for (const contract of [':focus-visible', ':disabled', ':active', 'prefers-reduced-motion', 'forced-colors', 'aria-pressed="true"', 'speech-tip.svg']) assert.ok(css.includes(contract), contract);
  assert.doesNotMatch(css, /!important|filter:\s*blur|backdrop-filter|@keyframes|\.companion-runtime|\.journey-view-frame/);
});

test('icons do not replace navigation labels or species semantics', () => {
  const shell = read('src/components/SceneShell.tsx');
  assert.match(shell, /iconForScreen\(item.screen\)/);
  assert.match(shell, /aria-label=\{item.label\}/);
  assert.match(shell, /onClick=\{\(\) => onNavigate\(item.screen\)\}/);
  const paths = read('src/ui/uiIconPaths.ts');
  assert.doesNotMatch(paths, /systolic|diastolic|risk|localStorage|companion_species|sk7-companion-species/);
});

test('source-wired image objects exist at both resolutions', () => {
  for (const file of ['JourneyToday.tsx', 'JourneyRecap.tsx', 'RecordExplorer.tsx']) {
    const source = read('src/components/' + file);
    for (const [,name] of source.matchAll(/<UiObject name="([a-z-]+)"/g)) {
      for (const size of [160, 320]) assert.ok(existsSync(resolve(root, `public/assets/ui/v1/objects/${name}-${size}.webp`)));
    }
  }
});

test('styles are imported after the existing journey styles', () => {
  const source = read('src/main.tsx');
  assert.ok(source.indexOf('frontend-assets.css') > source.indexOf('journey-today.css'));
});
