/* Supplemental actual fixed-floor review. Preserves prior playback reports. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('../../web/node_modules/playwright');
const arg = (key, fallback) => { const i = process.argv.indexOf(key); return i < 0 ? fallback : process.argv[i + 1]; };
const root = path.resolve(__dirname, '../..');
const assets = path.resolve(arg('--assets', ''));
const vendor = path.resolve(arg('--vendor', ''));
const output = path.resolve(arg('--output', ''));
const animals = arg('--animals', '').split(',').filter(Boolean);
const channel = arg('--browser-channel', 'chromium');
const clips = ['move', 'special', 'celebrate'];
assert(animals.length && new Set(animals).size === animals.length, 'Explicit unique --animals required');
assert(!fs.existsSync(output), 'Output must be new');
for (const source of [assets, vendor, root]) assert(output !== source && !output.startsWith(source + path.sep) && !source.startsWith(output + path.sep), 'Output overlaps source');
assert(fs.existsSync(path.join(assets, 'catalog.json')) && fs.existsSync(path.join(vendor, 'vendor-manifest.json')), 'Prepared local assets/vendor required');
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), '', 'Use a clean committed viewer');
const catalogFile = path.join(assets, 'catalog.json'), catalogHash = hash(catalogFile);
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const selected = animals.map((id) => { const a = catalog.animals.find((entry) => entry.id === id); assert(a?.standard && a.light, 'Both variants required'); return a; });
fs.mkdirSync(output, { recursive: true });
const inputs = selected.flatMap((a) => ['standard', 'light'].map((variant) => ({ animal: a.id, variant, file: a[variant], sha256: hash(path.join(assets, a[variant])) })));
const observations = [], videos = [], errors = [], externalRequests = [];
const started = Date.now(); let stage = 'starting', browser, server;
const checkpoint = () => fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ status: 'in_progress', stage, elapsedMs: Date.now() - started, commit, catalogHash, inputs, observations, videos }, null, 2));
const bounded = async (promise, ms, name) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(name + ' timeout')), ms); })]); }
  finally { clearTimeout(timer); }
};
const deadline = setTimeout(async () => {
  fs.writeFileSync(path.join(output, 'deadline.json'), JSON.stringify({ status: 'failed', stage, reason: 'bounded wall time reached' }));
  server?.kill(); try { await bounded(browser?.close(), 10000, 'deadline cleanup'); } finally { process.exit(1); }
}, Number(arg('--timeout-ms', 240000)));
(async () => {
  try {
    server = spawn(arg('--python', 'python'), [path.join(__dirname, 'serve.py'), '--assets', assets, '--vendor', vendor, '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const base = await bounded(new Promise((resolve, reject) => {
      server.stdout.on('data', (chunk) => { const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]); });
      server.on('exit', (code) => reject(Error('Server stopped: ' + code)));
    }), 20000, 'server startup');
    browser = await chromium.launch({ channel });
    for (const animal of selected) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, recordVideo: { dir: path.join(output, 'video', animal.id), size: { width: 960, height: 540 } } });
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (!url.startsWith(base + '/') && !url.startsWith('blob:') && !url.startsWith('data:')) { externalRequests.push(url); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base + '/?animal=' + encodeURIComponent(animal.id));
      await page.waitForFunction(() => window.previewDiagnostics?.snapshot().status === 'playing');
      const snapshot = () => page.evaluate(() => window.previewDiagnostics.snapshot());
      let standardY;
      for (const variant of ['standard', 'light']) {
        stage = animal.id + '/' + variant; checkpoint();
        await page.locator(`[name=variant][value=${variant}]`).check();
        await page.waitForFunction((v) => { const d = window.previewDiagnostics.snapshot(); return d.variant === v && d.status === 'playing'; }, variant);
        await page.locator('#ground').check();
        const fixed = (await snapshot()).groundReference;
        assert(fixed.visible && fixed.actualY === fixed.y && fixed.followsAnimation === false);
        if (variant === 'standard') standardY = fixed.y;
        assert.equal(fixed.y, standardY, 'The common standard-variant reference changed');
        assert.equal(fixed.referenceVariant, 'standard');
        for (const clip of clips) {
          const loaded = await snapshot(), index = loaded.stats.clips.findIndex((c) => c.name === clip);
          assert(index >= 0, 'Required clip absent');
          const poses = [];
          for (const view of ['front', 'side']) {
            await page.selectOption('#clip', String(index)); await page.click('#' + view);
            await page.waitForFunction(() => window.previewDiagnostics.snapshot().completedLoops >= 1, null, { timeout: 15000 });
            assert.deepEqual((await snapshot()).groundReference, fixed, 'Floor moved during full loop');
            for (const fraction of [0.25, 0.5, 0.75]) {
              const time = loaded.stats.clips[index].duration * fraction;
              await page.locator('#time').evaluate((el, t) => { el.value = String(t); el.dispatchEvent(new Event('input', { bubbles: true })); }, time);
              await page.waitForTimeout(80);
              const current = await snapshot(); assert.deepEqual(current.groundReference, fixed);
              const filename = `${animal.id}-${variant}-${clip}-${view}-${fraction}.png`;
              await page.locator('#viewport').screenshot({ path: path.join(output, filename) });
              poses.push({ view, fraction, time_seconds: time, file: filename, sha256: hash(path.join(output, filename)), camera: current.camera });
            }
          }
          observations.push({ animal: animal.id, variant, clip, duration: loaded.stats.clips[index].duration, complete_loop_observed: true, continuous_loop_views: ['front', 'side'], ground: fixed, variant_default_pose_min_y: loaded.defaultPoseMinY, poses });
          stage = `${animal.id}/${variant}/${clip}: fixed floor loop and six poses captured`; checkpoint();
        }
      }
      for (const width of [1366, 390, 320]) {
        await page.setViewportSize({ width, height: width === 1366 ? 768 : 844 }); await page.waitForTimeout(100);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, `${animal.id}-ground-layout-${width}.png`), fullPage: true });
      }
      const video = page.video(); await page.locator('#static').check(); await page.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'static');
      assert.equal((await snapshot()).groundReference, null);
      stage = animal.id + ': finalize video'; checkpoint();
      await bounded(page.close(), 15000, 'recorded page close'); await bounded(context.close(), 15000, 'recording context close');
      const file = await bounded(video.path(), 5000, 'video path');
      videos.push({ animal: animal.id, file: path.relative(output, file).split(path.sep).join('/'), sha256: hash(file), bytes: fs.statSync(file).size, silent: true, size: [960, 540], decode_and_visual_review: 'pending' });
      checkpoint();
    }
    assert.equal(hash(catalogFile), catalogHash);
    for (const input of inputs) assert.equal(hash(path.join(assets, input.file)), input.sha256);
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
    const result = { status: 'fixed_ground_capture_and_playback_passed_visual_review_pending', scope: 'Supplemental move/special/celebrate fixed default-pose floor; not all-frame collision or physical contact approval', execution_commit: commit, verifier_sha256: hash(__filename), catalog_basis_commit: catalog.source_commit, catalog_sha256: catalogHash, inputs, observations, videos, previous_reports_modified: false, input_bytes_unchanged: true, human_review: 'pending', errors, external_requests: externalRequests.length };
    fs.writeFileSync(path.join(output, 'ground-verification.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: result.status, animals: selected.length, loops: observations.length, output }));
  } catch (error) {
    fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ status: 'failed', stage, reason: error.message, elapsedMs: Date.now() - started })); throw error;
  } finally { clearTimeout(deadline); server?.kill(); await bounded(browser?.close(), 10000, 'browser cleanup'); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
