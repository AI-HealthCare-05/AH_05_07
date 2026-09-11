import { expect, test, type Page } from '@playwright/test';
import { companionAssetManifest } from '../src/ui/companionAssets.generated';
import { installCompanionFramingProbe } from '../scripts/companion-framing-probe.mjs';
const companionOff = process.env.SK7_UI_TEST_COMPANION === 'off';
const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
function deferred() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
async function setup(page: Page, outcome = 'success') {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  const held = deferred(); let posts = 0;
  const urls: string[] = [];
  page.on('request', request => urls.push(request.url()));
  await page.addInitScript(() => {
    let attempts = 0, frames = 0;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof getContext>) {
      const context = getContext.apply(this, args);
      if (/^webgl/.test(args[0])) attempts++;
      return context;
    } as typeof getContext;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => { frames++; return raf(callback); };
    Object.defineProperty(window, '__uiProbe', { value: () => ({ attempts, frames, canvases: document.querySelectorAll("canvas").length }) });
  });
  await page.route('http://e2e.invalid/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/window')) return json({ start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'), blood_pressure_observations: [], challenge_checkins: [], active_challenge: null,
      challenge_events: [{ id: 'synthetic-existing-legacy', observed_on: '2026-09-05', action_id: 'walk-10-minutes', status: 'completed' }] });
    if (url.pathname.endsWith('/blood-pressure')) {
      posts++;
      if (outcome === 'pending' || outcome === 'unknown') await held.promise;
      if (outcome === 'failure') return json({ detail: { code: 'validation_error' } }, 422);
      if (outcome === 'duplicate') return json({ detail: { code: 'duplicate_observation' } }, 409);
      return json({ id: 'synthetic-save', ...req.postDataJSON() }, 201);
    }
    return route.abort();
  });
  return { held, urls, posts: () => posts };
}
async function save(page: Page) {
  await page.getByLabel(/수축기/).fill('120'); await page.getByLabel(/이완기/).fill('80');
  await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).press('Enter');
}
async function probe(page: Page) { return page.evaluate(() => (window as unknown as { __uiProbe: () => { attempts: number; frames: number; canvases: number } }).__uiProbe()); }
for (const width of [320, 390, 1366]) test(`static posters, keyboard and confirmed S05 at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  const state = await setup(page);
  await page.goto('/?e2e=signed-in&screen=S02&scene=review&VITE_SK7_UI_MODE=legacy&companion_species=cat');
  await expect(page.locator('.journey-today')).toBeVisible();
  const poster = page.locator('[data-poster-asset]');
  await expect(poster).toHaveAttribute('data-poster-asset', new RegExp(width === 320 ? 'mobile320$' : width === 390 ? 'mobile390$' : 'desktop$'));
  await poster.locator('img').evaluate((img: HTMLImageElement) => img.decode());
  const recipe = await page.locator('[data-scene-recipe]').getAttribute('data-scene-recipe');
  await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
  await expect(page.locator('[data-static-landscape="S10"]')).toBeVisible();
  await page.getByRole('button', { name: '이전 7일 보기', exact: true }).press('Enter');
  await expect(page.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', '2026-09-11');
  expect(await probe(page)).toEqual({ attempts: 0, frames: 0, canvases: 0 });
  expect(state.urls.filter(url => /\.glb(?:\?|$)|ThreeSceneRenderer|SavedSceneRenderer|CompanionReviewRenderer/.test(url))).toEqual([]);
  await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
  await page.locator('.home-lead button').press('Enter');
  await expect(page.locator('#S04-title')).toBeFocused(); await save(page);
  await expect(page.locator('#S05-title')).toBeFocused();
  await expect(page.locator('[data-living-scene], [data-saved-scene-status]')).toHaveCount(0);
  expect(state.urls.filter(url => /ThreeSceneRenderer|SavedSceneRenderer/.test(url))).toEqual([]);
  if (companionOff) {
    await expect(page.locator('.companion-runtime-slot, canvas')).toHaveCount(0);
    expect((await probe(page)).attempts).toBe(0);
  } else {
    const runtime = page.locator('[data-companion-status]');
    await expect(runtime).toHaveAttribute('data-companion-status', 'ready', { timeout: 30000 });
    await expect(runtime).toHaveAttribute('data-companion-framing', 'journey-s05');
    await expect(runtime).toHaveAttribute('data-companion-celebrate-count', '1');
    await expect(runtime).toHaveAttribute('data-companion-phase', 'idle', { timeout: 10000 });
    expect(state.urls.filter(url => /\.glb(?:\?|$)/.test(url))).toEqual([companionAssetManifest.bear.lite.url]);
    const element = await runtime.elementHandle();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sk7:e2e-session-change', { detail: {
      access_token: 'synthetic-refreshed-token', refresh_token: 'synthetic-refreshed-refresh', expires_in: 3600, expires_at: 1800000000, token_type: 'bearer',
      user: { id: 'e2e-synthetic-user', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-09-01T00:00:00Z' },
    } })));
    await expect(runtime).toHaveAttribute('data-companion-celebrate-count', '1');
    expect(await element!.evaluate(node => node.isConnected)).toBe(true);
    const boxes = await page.evaluate(() => {
      const box = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom }; };
      return { slot:box('.companion-runtime-slot'), ripple:box('.save-ripple'), title:box('.journey-saved .scene-copy'), cta:box('.journey-saved .split-actions') };
    });
    expect(Math.abs((boxes.slot.left + boxes.slot.right) / 2 - (boxes.ripple.left + boxes.ripple.right) / 2)).toBeLessThan(2);
    expect(boxes.slot.top).toBeGreaterThanOrEqual(boxes.title.bottom);
    expect(boxes.slot.bottom).toBeLessThanOrEqual(boxes.cta.top);
  }
  await page.locator('#S05-title').focus(); await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '오늘의 기록 보기', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-scene-recipe]')).toHaveAttribute('data-scene-recipe', recipe!);
  expect((await probe(page)).canvases).toBe(0);
  const frames = (await probe(page)).frames;
  await page.waitForTimeout(100);
  expect((await probe(page)).frames).toBe(frames);
  await page.goBack();
  await expect(page.locator('[data-scene="S05"], .companion-runtime-slot')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-scene="S05"], .companion-runtime-slot')).toHaveCount(0);
});

// Inspect every rendered frame of the existing four-second celebrate and idle
// clips. DOM bounds alone cannot detect an ear/hand cut inside the WebGL canvas.
for (const [width, height] of [[320, 568], [390, 844], [1366, 768]]) test(`journey S05 neutral and full motion framing at ${width}`, async ({ page }, info) => {
  test.skip(companionOff, 'No canvas when the independent companion gate is off');
  await page.setViewportSize({ width, height });
  await setup(page);
  await page.addInitScript(installCompanionFramingProbe);
  type Bounds = { phase: string; width: number; height: number; left: number; right: number; top: number; bottom: number; paintedHeight: number; cssClippedPixels: number };
  type Probe = { sample: () => Bounds; report: () => { samples: Bounds[]; counts: Record<string, number>; paused: boolean }; pauseAfter: (phase: string, frames: number) => void };
  const margins = (bounds: Bounds) => {
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) expect(bounds[edge], `${bounds.phase} ${edge}`).toBeGreaterThanOrEqual(5);
    expect(bounds.paintedHeight).toBeGreaterThan(bounds.height * .8);
    expect(bounds.cssClippedPixels, 'painted pixels inside the rounded parent clip').toBe(0);
  };
  const reports = [];
  for (const motion of ['reduce', 'no-preference'] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('/?e2e=signed-in&screen=S04');
    if (motion === 'no-preference') await page.evaluate(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.pauseAfter('idle', 241));
    await save(page);
    const runtime = page.locator('[data-companion-status]');
    await expect(runtime).toHaveAttribute('data-companion-status', 'ready', { timeout: 30000 });
    await expect(runtime).toHaveAttribute('data-companion-framing', 'journey-s05');
    await expect(runtime).toHaveAttribute('data-companion-celebrate-count', motion === 'reduce' ? '0' : '1');
    if (motion === 'reduce') {
      const bounds = await page.evaluate(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.sample());
      margins(bounds); reports.push({ motion, bounds });
    } else {
      await page.waitForFunction(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.report().paused, undefined, { timeout: 20000 });
      const report = await page.evaluate(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.report());
      expect(report.counts.celebrate).toBeGreaterThanOrEqual(235);
      expect(report.counts.idle).toBe(241);
      report.samples.forEach(margins); reports.push({ motion, ...report });
    }
    if (width === 320) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('#S05-title').focus();
      for (const name of ['오늘의 기록 보기', '계속 기록하기']) {
        await page.keyboard.press('Tab');
        const button = page.getByRole('button', { name, exact: true });
        await expect(button).toBeFocused();
        await expect(button).toBeInViewport({ ratio: 1 });
        expect(await button.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
      }
      await page.keyboard.press('Enter');
      await expect(page.locator('#S04-title')).toBeFocused();
      await expect(page.locator('[data-companion-canvas]')).toHaveCount(0);
    }
  }
  await info.attach(`S05-framing-${width}.json`, { body: JSON.stringify(reports), contentType: 'application/json' });
});
for (const outcome of ['pending', 'failure', 'duplicate', 'unknown']) test(`${outcome} save has no premature success or retry loop`, async ({ page }) => {
  const state = await setup(page, outcome);
  await page.goto('/?e2e=signed-in&screen=S05&companion_context=save_success');
  await expect(page.locator('.journey-today')).toBeVisible();
  await page.locator('.home-lead button').click(); await save(page);
  await expect.poll(state.posts).toBe(1);
  if (outcome === 'pending') {
    await expect(page.getByRole('button', { name: '저장 중', exact: true })).toBeDisabled();
    await expect(page.locator('.journey-saved, canvas')).toHaveCount(0);
    state.held.release(); await expect(page.locator('.journey-saved')).toBeVisible();
  } else {
    if (outcome === 'unknown') await expect(page.getByText('처리 결과 확인 필요', { exact: true })).toBeVisible({ timeout: 12000 });
    else await expect(page.getByRole('button', { name: '혈압 기록 저장', exact: true })).toBeEnabled();
    state.held.release();
    await expect(page.locator('.journey-entry')).toBeVisible();
    await expect(page.locator('.journey-saved, canvas')).toHaveCount(0);
    expect(state.urls.some(url => /\.glb(?:\?|$)/.test(url))).toBe(false);
  }
  expect(state.posts()).toBe(1);
});
test('200% text, reduced motion and failed media keep completion DOM and no retry', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await setup(page);
  await page.route(/\.(glb|webp)(\?|$)/, route => route.abort());
  await page.goto('/?e2e=signed-in&screen=S02');
  await page.locator('html').evaluate(el => { el.style.fontSize = '200%'; });
  await page.locator('.home-lead button').click(); await save(page);
  await expect(page.locator('#S05-title')).toBeFocused();
  if (!companionOff) await expect(page.locator('[data-companion-status]')).toHaveAttribute('data-companion-status', 'error', { timeout: 30000 });
  const count = state.urls.filter(url => /\.(glb|webp)(\?|$)/.test(url)).length;
  // Observe a stable failed visit; do not reinterpret the legacy renderer's
  // independent motion-setting lifecycle as a new candidate retry contract.
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: '오늘의 기록 보기', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(state.urls.filter(url => /\.(glb|webp)(\?|$)/.test(url))).toHaveLength(count);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('.journey-today')).toBeVisible();
});

for (const width of [360, 1440]) test(`S01 purpose and accessible OTP feedback at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const held = deferred(); let posts = 0; let fail = false;
  await page.route('https://e2e.invalid/auth/v1/otp**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    posts++;
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4173');
    expect(route.request().postDataJSON().create_user).toBe(true);
    await held.promise;
    await route.fulfill({ status: fail ? 400 : 200, headers, contentType: 'application/json', body: fail ? JSON.stringify({ msg: 'synthetic-private-error' }) : '{}' });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '오늘을 남기고, 7일을 돌아봐요.' })).toBeVisible();
  const email = page.getByRole('textbox', { name: '이메일', exact: true });
  await expect(email).toHaveAccessibleDescription('이메일로 받은 링크를 열면 로그인할 수 있어요.');
  expect(await email.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await email.fill(`synthetic-${Date.now()}@example.invalid`);
  await page.getByRole('button', { name: '로그인 링크 받기', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: '보내는 중', exact: true })).toBeDisabled();
  await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(posts).toBe(1); held.release();
  await expect(page.getByRole('status')).toContainText('로그인 링크를 보냈어요.');
  fail = true;
  await page.getByRole('button', { name: '로그인 링크 받기', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('로그인 링크를 보내지 못했습니다.');
  await expect(page.getByText('synthetic-private-error')).toHaveCount(0);
  expect(posts).toBe(2);
  await page.locator('html').evaluate(el => { el.style.fontSize = '200%'; });
  await email.focus(); await page.keyboard.press('Tab');
  const button = page.getByRole('button', { name: '로그인 링크 받기', exact: true });
  await expect(button).toBeFocused(); await expect(button).toBeInViewport({ ratio: 1 });
  expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

for (const prior of [false, true]) test(`S12 ${prior ? 'prior return' : 'current actions'} keeps empty-window semantics`, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  const held = deferred(); const windows: string[] = []; let fail = false; let writes = 0;
  await page.route('http://e2e.invalid/**', async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (req.method() !== 'GET') writes++;
    if (!url.pathname.endsWith('/window')) return route.abort();
    windows.push(url.searchParams.get('start_on')!); await held.promise;
    await route.fulfill({ status: fail ? 503 : 200, headers, contentType: 'application/json', body: JSON.stringify(fail ? {} : {
      start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'), blood_pressure_observations: [], challenge_checkins: [], challenge_events: [], active_challenge: null,
    }) });
  });
  await page.goto(`/?e2e=signed-in${prior ? '&dashboard_window=prior' : ''}`);
  await expect(page.getByRole('heading', { name: '선택한 7일을 불러오는 중이에요' })).toBeVisible();
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0); held.release();
  await expect(page.getByRole('heading', { name: prior ? '이 기간에는 기록이 없어요.' : '이 기간에는 아직 기록이 없어요.', exact: true })).toBeFocused();
  await expect(page.locator('.journey-empty-period time').first()).toHaveAttribute('datetime', prior ? '2026-08-29' : '2026-09-05');
  await expect(page.locator('.journey-empty-period time').last()).toHaveAttribute('datetime', prior ? '2026-09-04' : '2026-09-11');
  if (prior) {
    await expect(page.getByText('이전 7일 · 읽기 전용', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '혈압 기록하기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '7일 챌린지 시작하기', exact: true })).toHaveCount(0);
    expect(windows).toEqual(['2026-08-29']);
    await page.getByRole('button', { name: '현재 7일 보기', exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: '이 기간에는 아직 기록이 없어요.', exact: true })).toBeVisible();
    expect(windows).toEqual(['2026-08-29', '2026-09-05']); await expect(page).not.toHaveURL(/dashboard_window/);
  }
  await page.locator('html').evaluate(el => { el.style.fontSize = '200%'; });
  await page.locator('#S12-title').focus(); await page.keyboard.press('Tab');
  const bp = page.getByRole('button', { name: '혈압 기록하기', exact: true });
  await expect(bp).toBeFocused(); await expect(bp).toBeInViewport({ ratio: 1 });
  expect(await bp.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await bp.press('Enter'); await expect(page.locator('#S04-title')).toBeFocused();
  await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
  await page.getByRole('button', { name: '7일 챌린지 시작하기', exact: true }).click();
  await expect(page.locator('#S03-title')).toBeFocused(); expect(writes).toBe(0);
  fail = true; await page.reload();
  await expect(page.locator('[data-scene="S13"]')).toBeVisible(); await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
});

test('Journey record browsing keeps separated lanes, exact detail targets, and read-only meaning', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  const methods: string[] = [];
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    methods.push(request.method());
    if (!url.pathname.endsWith('/window')) return route.abort();
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({
      start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'),
      blood_pressure_observations: [
        { id: 'journey-bp-morning', observed_on: '2026-09-10', period: 'morning', systolic: 118, diastolic: 76 },
        { id: 'journey-bp-evening', observed_on: '2026-09-10', period: 'evening', systolic: 121, diastolic: 79 },
      ],
      active_challenge: { id: 'journey-active', action_id: 'walk-10-minutes', starts_on: '2026-09-05', ends_on: '2026-09-11', first_checkin_on: '2026-09-05', status: 'active' },
      challenge_checkins: [{ id: 'journey-checkin', challenge_id: 'journey-active', observed_on: '2026-09-09', action_id: 'walk-10-minutes', status: 'completed' }],
      challenge_events: [{ id: 'journey-legacy', observed_on: '2026-09-08', action_id: 'sleep-routine', status: 'skipped' }],
    }) });
  });

  await page.goto('/?e2e=signed-in&screen=S08');
  const records = page.locator('.journey-records');
  await expect(records).toBeVisible();
  await expect(records).toContainText('선택한 7일의 기록을 종류별로 확인해요.');
  await expect(records.locator('[data-record-lane="blood-pressure"]')).toContainText('118/76 mmHg');
  await expect(records.locator('[data-record-lane="challenge"]')).toContainText('기록함');
  await expect(records.locator('[data-record-lane="legacy"]')).toContainText('읽기 전용');
  await page.screenshot({ path: testInfo.outputPath('s08-mobile-360.png'), fullPage: true });
  const eveningDetail = records.getByRole('button', { name: /상세 보기 · 혈압 관찰 · 9월 10일.*저녁/ });
  await expect(eveningDetail).toBeVisible();
  await eveningDetail.click();
  await expect(page).toHaveURL(/record=blood-pressure%3Ajourney-bp-evening/);
  await expect(page.locator('.journey-record-detail [data-record-detail-kind="blood-pressure"]')).toContainText('121/79 mmHg');
  await expect(page.getByRole('button', { name: '수정', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toBeVisible();

  await page.goto('/?e2e=signed-in&screen=S09&record=legacy:journey-legacy');
  await expect(page.locator('.journey-record-detail [data-record-detail-kind="legacy"]')).toContainText('이전 방식으로 남긴 기록은 읽기 전용입니다.');
  await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toHaveCount(0);
  expect(methods.every(method => method === 'GET')).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('s09-mobile-360.png'), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?e2e=signed-in&screen=S08');
  await expect(page.locator('.journey-records')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('s08-desktop-1440.png'), fullPage: true });
});
