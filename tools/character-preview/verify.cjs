// Local synthetic/GLB verification. No product API or real health/model data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { chromium } = require('../../web/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const synthetic = args.includes('--synthetic');
const record = args.includes('--record');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sk7-character-check-'));
const assets = path.resolve(arg('--assets', path.join(temp, 'assets')));
const vendor = path.resolve(arg('--vendor', path.join(temp, 'vendor')));
const output = path.resolve(arg('--output', path.join(temp, 'results')));
assert(!fs.existsSync(output), 'Use a new result path; previous verification must remain');
assert(output !== root && !output.startsWith(root + path.sep), 'Result files stay outside the repository');
assert(output !== assets && !output.startsWith(assets + path.sep) && !assets.startsWith(output + path.sep), 'Results and input assets must not overlap');
const python = process.env.PYTHON || 'python';
function run(script, options) {
  const result = spawnSync(python, [path.join(__dirname, script), ...options], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${script} failed: ${result.stderr.slice(-500)}`);
}
if (synthetic) { run('test_boundary.py', []); run('make_fixture.py', ['--output', assets]); }
if (!fs.existsSync(path.join(vendor, 'vendor-manifest.json'))) run('prepare_vendor.py', ['--output', vendor]);
const dist = path.join(root, 'web/dist');
assert(fs.existsSync(path.join(dist, 'index.html')), 'Build the production web first');
function inspectDist(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) inspectDist(file);
    else assert(!/character-preview|캐릭터 검토실|GLTFLoader|three\.module/.test(fs.readFileSync(file, 'utf8')), 'Viewer leaked into product build');
  }
}
inspectDist(dist); fs.mkdirSync(output, { recursive: true });
const server = spawn(python, [path.join(__dirname, 'serve.py'), '--assets', assets, '--vendor', vendor, '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
const errors = [], network = [], checks = [], playback = [], samples = [], assetManifest = [], motionVideos = [];
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const quantile = (values, q) => { const a = [...values].sort((x, y) => x - y), x = (a.length - 1) * q, i = Math.floor(x); return a.length ? a[i] + (a[Math.ceil(x)] - a[i]) * (x - i) : null; };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function bounded(promise, milliseconds, stage) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${stage} exceeded ${milliseconds}ms`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
let stage = 'startup';
const started = Date.now();
function checkpoint(nextStage) {
  stage = nextStage;
  fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ status: 'in_progress_not_passed', stage, elapsedMs: Date.now() - started, checks, playback, assetManifest, motionVideos, samples }, null, 2));
}
(async () => {
  let browser;
  const deadline = setTimeout(async () => {
    fs.writeFileSync(path.join(output, 'deadline.json'), JSON.stringify({ status: 'stopped', stage, elapsedMs: Date.now() - started, reason: 'bounded_wall_time_reached' }));
    server.kill();
    try { await bounded(browser?.close(), 10000, 'deadline browser cleanup'); }
    finally { process.exit(1); }
  }, Number(arg('--timeout-ms', 1200000)));
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Local server startup timeout')), 20000);
      server.stdout.on('data', (data) => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
      server.on('exit', (code) => reject(Error(`Local server exit ${code}`)));
    });
    const catalog = await (await fetch(base + '/catalog.json')).json();
    const catalogHash = digest(path.join(assets, 'catalog.json'));
    assert.equal(catalog.animals.length, 12);
    if (synthetic) {
      const invalid = path.join(temp, 'invalid-catalog'); fs.mkdirSync(invalid);
      const altered = structuredClone(catalog); altered.animals[0].id = '../../escape';
      fs.writeFileSync(path.join(invalid, 'catalog.json'), JSON.stringify(altered));
      const rejected = spawnSync(python, [path.join(__dirname, 'serve.py'), '--assets', invalid, '--vendor', vendor], { encoding: 'utf8' });
      assert.notEqual(rejected.status, 0); assert(rejected.stderr.includes('Invalid asset identifier'));
      checks.push('catalog_identifier_boundary');
    }
    for (const route of ['/assets/%2e%2e%2fcatalog.json', '/assets/%2e%2e%2fAGENTS.md', '/vendor/%2e%2e%2fpackage.json', '/serve.py']) assert.equal((await fetch(base + route)).status, 404);
    assert.equal((await fetch(base, { method: 'POST' })).status, 501); checks.push('read_only_path_boundary');
    browser = await chromium.launch({ args: synthetic ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.route('**/*', (route) => { const url = route.request().url(); if (!url.startsWith(base) && !url.startsWith('blob:') && !url.startsWith('data:')) { network.push(url); return route.abort(); } return route.continue(); });
    let page = await context.newPage(); const mainPage = page; page.on('pageerror', (e) => errors.push(e.message));
    const glbRequests = []; page.on('request', (request) => { if (request.url().endsWith('.glb')) glbRequests.push(request.url()); });
    await page.goto(base); await page.waitForFunction(() => window.previewDiagnostics && !['starting', 'loading'].includes(window.previewDiagnostics.snapshot().status));
    const snap = () => page.evaluate(() => window.previewDiagnostics.snapshot());
    assert.equal(await page.locator('#animal option').count(), 12);
    const requested = arg('--animals', '').split(',').filter(Boolean);
    const available = catalog.animals.filter((a) => a.standard && a.light && (!requested.length || requested.includes(a.id)));
    assert(requested.every((id) => available.some((animal) => animal.id === id)), 'Requested animal is not available in both variants');
    assert(available.length, 'A real asset or explicit temporary fixture is required');
    assert(glbRequests.every((url) => url.endsWith('/assets/' + catalog.animals[0].standard)), 'A non-selected model was prefetched');
    checks.push('initial_selected_asset_only');
    for (const animal of available) {
      let motionContext;
      let standardClips;
      if (record) {
        await mainPage.locator('#static').check(); await mainPage.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'static');
        motionContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, recordVideo: { dir: path.join(output, 'video', animal.id.replace(/[^a-z0-9_-]/gi, '_')), size: { width: 960, height: 540 } } });
        await motionContext.route('**/*', (route) => { const url = route.request().url(); if (!url.startsWith(base) && !url.startsWith('blob:') && !url.startsWith('data:')) { network.push(url); return route.abort(); } return route.continue(); });
        page = await motionContext.newPage(); page.on('pageerror', (e) => errors.push(e.message)); await page.goto(base + '/?animal=' + encodeURIComponent(animal.id));
        await page.waitForFunction(() => window.previewDiagnostics?.snapshot().status === 'playing');
      }
      await page.selectOption('#animal', animal.id);
      for (const variant of ['standard', 'light']) {
        await page.locator(`[name=variant][value=${variant}]`).check();
        await page.waitForFunction(({ id, variant }) => { const d = window.previewDiagnostics.snapshot(); return d.animal === id && d.variant === variant && d.stats && d.status === 'playing'; }, { id: animal.id, variant });
        const loaded = await snap(); assert.equal(loaded.stats.clips.length, 7); assert(loaded.stats.bones > 0 && loaded.stats.skinnedMeshes > 0);
        assert.deepEqual(loaded.stats.clips.map((clip) => clip.name).sort(), ['celebrate', 'curious', 'greet', 'idle', 'move', 'rest', 'special']);
        const clipIdentity = loaded.stats.clips.map(({ name, duration }) => ({ name, duration })).sort((a, b) => a.name.localeCompare(b.name));
        if (variant === 'standard') standardClips = clipIdentity; else assert.deepEqual(clipIdentity, standardClips, 'Standard/light clip names and durations differ');
        const file = path.join(assets, animal[variant]);
        assetManifest.push({ animal: animal.id, variant, file: animal[variant], bytes: fs.statSync(file).size, sha256: digest(file), triangles: loaded.stats.triangles, materials: loaded.stats.materials, textures: loaded.stats.textureDimensions, bones: loaded.stats.bones, skinnedMeshes: loaded.stats.skinnedMeshes, clips: loaded.stats.clips });
        for (let index = 0; index < loaded.stats.clips.length; index++) {
          await page.selectOption('#clip', String(index)); await page.waitForTimeout(90); const before = await snap();
          await page.waitForTimeout(550); const after = await snap();
          assert.notEqual(before.actionTime, after.actionTime, `${animal.id}/${variant}/${index}: time did not advance`);
          assert(after.bones.some((v, i) => Math.abs(v - before.bones[i]) > 1e-7), `${animal.id}/${variant}/${index}: no bone change`);
          await page.waitForFunction(() => window.previewDiagnostics.snapshot().completedLoops >= 1, null, { timeout: 30000 });
          const poseTime = loaded.stats.clips[index].duration * 0.25;
          await page.locator('#time').evaluate((el, time) => { el.value = String(time); el.dispatchEvent(new Event('input', { bubbles: true })); }, poseTime);
          assert(Math.abs((await snap()).actionTime - poseTime) <= 0.001);
          if (!synthetic) await page.locator('#viewport').screenshot({ path: path.join(output, `${animal.id}-${variant}-${loaded.stats.clips[index].name.replace(/[^a-z0-9_-]/gi, '_')}.png`) });
          playback.push({ animal: animal.id, variant, clip: loaded.stats.clips[index].name, duration: loaded.stats.clips[index].duration, animationTimeAdvanced: true, bonePoseChanged: true, completeLoopObserved: true, capturedPoseTimeSeconds: poseTime });
          checkpoint(`${animal.id}/${variant}/${loaded.stats.clips[index].name}: loop and pose passed`);
        }
        await page.click('#pause'); const paused = await snap(); await page.waitForTimeout(100); assert.equal((await snap()).actionTime, paused.actionTime);
        await page.click('#stop'); assert.equal((await snap()).actionTime, 0); await page.click('#play');
      }
      if (motionContext) {
        const video = page.video(), closingStarted = Date.now();
        checkpoint(`${animal.id}: stopping rendering before video finalization`);
        await page.locator('#static').check(); await page.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'static');
        checkpoint(`${animal.id}: closing recorded page`); await bounded(page.close(), 15000, 'recorded page close');
        checkpoint(`${animal.id}: closing recording context`); await bounded(motionContext.close(), 15000, 'recording context close');
        const videoPath = await bounded(video.path(), 5000, 'video path');
        motionVideos.push({ animal: animal.id, path: path.relative(output, videoPath).replaceAll(path.sep, '/'), scope: 'actual_browser_7_clips_both_variants_with_controls', viewport: { width: 1366, height: 768 }, videoSize: { width: 960, height: 540 }, finalizationMs: Date.now() - closingStarted, silent: true });
        checkpoint(`${animal.id}: video finalized`); page = mainPage;
      }
    }
    checks.push('all_available_variant_clips_bone_playback', 'pause_stop_play');
    if (record) { await mainPage.locator('#static').uncheck(); await mainPage.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'playing'); }
    const first = available[0]; await page.selectOption('#animal', first.id);
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(1200); await page.click('#play'); await page.waitForTimeout(3000);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      const sample = await snap(), values = sample.frameIntervalsMs;
      samples.push({ viewport, renderer: sample.renderer, userAgent: sample.userAgent, platform: sample.platform, variant: sample.variant, animal: sample.animal,
        loadMs: sample.stats.loadMs, sampleCount: values.length, sampleIntervalMs: values.reduce((a, b) => a + b, 0), frameMsP50: quantile(values, 0.5), frameMsP95: quantile(values, 0.95),
        fpsFromMeanInterval: values.length ? 1000 * values.length / values.reduce((a, b) => a + b, 0) : null, rule: sample.sampleRule,
        rendererPath: synthetic ? 'forced_software_fixture' : 'browser_default', softwareRenderer: /SwiftShader|llvmpipe|Software/i.test(sample.renderer || '') ? true : /Intel|NVIDIA|AMD|Apple/i.test(sample.renderer || '') ? false : null,
        renderPixelRatio: sample.viewport.renderPixelRatio, antialias: sample.viewport.antialias, browserVideoRecording: false, actualMobileDevice: false });
      await page.screenshot({ path: path.join(output, `preview-${viewport.width}.png`), fullPage: true });
    }
    checks.push('desktop_390_320_viewports');
    await page.setViewportSize({ width: 1366, height: 768 }); await page.locator('#animal').focus(); await page.keyboard.press('Tab'); assert(await page.locator(':focus').count());
    await page.click('#pause'); await page.waitForTimeout(200); await page.locator('#stop').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'left');
    assert.notEqual(await page.locator('#left').evaluate((el) => getComputedStyle(el).outlineStyle), 'none');
    const cameraBefore = await page.screenshot(); await page.keyboard.press('Enter'); await page.waitForTimeout(200); assert(!(await page.screenshot()).equals(cameraBefore)); checks.push('keyboard_focus_rotation');
    const memories = [];
    for (let index = 0; index < 10; index++) {
      await page.locator(`[name=variant][value=${index % 2 ? 'light' : 'standard'}]`).check(); await page.click('#retry');
      await page.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'playing'); await page.waitForTimeout(80); memories.push((await snap()).memory);
    }
    assert(memories.at(-1).geometries <= Math.max(memories[0].geometries, memories[1].geometries));
    assert(memories.at(-1).textures <= Math.max(memories[0].textures, memories[1].textures)); checks.push('10_swap_resource_counts_bounded');
    assert(memories.at(-1).programs <= Math.max(memories[0].programs, memories[1].programs));
    const pending = catalog.animals.find((animal) => !animal.standard);
    if (pending) { await page.selectOption('#animal', pending.id); await page.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'pending'); assert(await page.locator('#fallback').isVisible()); checks.push('pending_asset_not_counted'); await page.selectOption('#animal', first.id); await page.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'playing'); }
    const glbRoute = /\/assets\/.*\.glb$/;
    await page.route(glbRoute, (route) => route.fulfill({ status: 404, body: '' })); await page.click('#retry');
    await page.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'failed'); assert(await page.locator('#fallback').isVisible()); await page.unroute(glbRoute); checks.push('failed_glb_static_fallback');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'static');
    assert.equal((await snap()).stats, null); assert(await page.locator('#fallback').isVisible()); checks.push('reduced_motion_unloads_glb');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForFunction(() => window.previewDiagnostics.snapshot().status === 'playing');
    await page.evaluate(() => document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    assert.equal((await snap()).status, 'context_lost'); assert(await page.locator('#fallback').isVisible()); checks.push('context_loss_fallback');
    const staticContext = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const staticPage = await staticContext.newPage(), staticGlbs = [];
    staticPage.on('request', (request) => { if (request.url().endsWith('.glb')) staticGlbs.push(request.url()); });
    await staticPage.goto(base); await staticPage.waitForFunction(() => window.previewDiagnostics?.snapshot().status === 'static');
    assert.deepEqual(staticGlbs, []); await staticContext.close(); checks.push('initial_reduced_motion_no_glb_fetch');
    const no3d = await context.newPage(); await no3d.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    await no3d.goto(base); await no3d.waitForFunction(() => window.previewDiagnostics?.snapshot().status === 'static');
    assert(await no3d.locator('#fallback').isVisible()); await no3d.close(); checks.push('no_webgl_static_fallback');
    assert.deepEqual(errors, []); assert.deepEqual(network, []); checks.push('no_page_errors_or_external_network', 'production_bundle_isolated');
    assert.equal(digest(path.join(assets, 'catalog.json')), catalogHash, 'Catalog changed during verification');
    for (const asset of assetManifest) assert.equal(digest(path.join(assets, asset.file)), asset.sha256, 'Input GLB changed during verification');
    checks.push('catalog_and_glb_bytes_unchanged');
    const report = { status: 'passed', scope: synthetic ? 'temporary_synthetic_fixture_only' : 'available_local_glb_playback_not_visual_quality_approval', completedAnimalsClaimed: 0,
      availableAnimalsTested: available.length, clipVariantChecks: playback.length, sourceCommit: catalog.source_commit, catalogSha256: catalogHash, assetManifest, motionVideos, checks, playback, samples, swapMemory: memories,
      limitations: ['Browser viewport and recorded renderer only; not a physical mobile device or production FPS.', 'Bone playback/resource checks are not joint penetration or visual quality approval.', 'No real health or model data accessed.'], errors, externalRequests: network.length };
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: 'passed', availableAnimals: available.length, clipVariantChecks: playback.length, checks: checks.length, output }));
  } catch (error) { fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ status: 'failed', stage, elapsedMs: Date.now() - started, reason: error.message, errors }, null, 2)); throw error; }
  finally { clearTimeout(deadline); server.kill(); await bounded(browser?.close(), 10000, 'browser cleanup'); await wait(100); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
