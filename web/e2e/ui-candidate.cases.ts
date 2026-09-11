import { expect, test, type Page } from '@playwright/test';
import { companionAssetManifest } from '../src/ui/companionAssets.generated';
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
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: '오늘의 기록 보기', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(state.urls.filter(url => /\.(glb|webp)(\?|$)/.test(url))).toHaveLength(count);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('.journey-today')).toBeVisible();
});
