import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chooseTime as chooseTimeWheel } from './model-v2-time-wheel';


for (const screen of ['S02', 'S05', 'S10', 'S11']) test(`normal configured build rejects fixture, fake-session URL and harness event at ${screen}`, async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.route('**/*.invalid/**', route => route.abort());
  await page.goto(`/?e2e=signed-in&fixture=VP-10&recap_fixture=mixed&screen=${screen}&ui=journey&scene=review&VITE_SK7_E2E_MODE=1&model_v2_state=ready`);
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  await expect(page.getByText('웹 환경변수를 설정한 뒤 시작할 수 있습니다.')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('sk7:e2e-session-change', { detail: { access_token: 'e2e-synthetic-access-token', user: { id: 'synthetic-user' } } })));
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  await expect(page.locator('.journey-candidate, .journey-recap, [data-dashboard-lane]')).toHaveCount(0);
  expect(requests.filter(url => /observations|product-score/.test(url))).toEqual([]);
});

test('normal artifact serves static robots and llms discovery files', async ({ request }) => {
  const llms = await request.get('/llms.txt');
  expect(llms.ok()).toBe(true);
  const llmsText = await llms.text();
  expect(llmsText).toMatch(/^# SK7$/m);
  expect(llmsText).toContain('https://hyeol.app/');
  expect(llmsText).toContain('https://github.com/AI-HealthCare-05/AH_05_07');
  expect(llmsText).not.toContain('<!doctype');

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  const robotsText = await robots.text();
  expect(robotsText).toContain('User-agent: *');
  expect(robotsText).toContain('Allow: /');
  expect(robotsText).not.toContain('<!doctype');
});

test('normal signed-in bootstrap never mounts the login companion before S02', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('sb-auth-auth-token', JSON.stringify({
      access_token: 'local-mock-auth-token',
      refresh_token: 'local-mock-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 2000000000,
      user: {
        id: 'local-mock-user',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-09-01T00:00:00Z',
      },
    }));

    Object.assign(window, { __sawLoginCompanionDuringBootstrap: false });
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-login-companion]')) {
        Object.assign(window, { __sawLoginCompanionDuringBootstrap: true });
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });

  await page.route('https://auth.ui-candidate.invalid/**', route => route.abort());
  await page.route('http://api.ui-candidate.invalid/**', async route => {
    const url = new URL(route.request().url());
    const headers = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:4182',
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (!url.pathname.endsWith('/window')) return route.abort();
    return route.fulfill({
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        start_on: url.searchParams.get('start_on'),
        end_on: url.searchParams.get('end_on'),
        blood_pressure_observations: [{
          id: 'synthetic-existing-bp',
          observed_on: '2026-09-10',
          period: 'morning',
          systolic: 120,
          diastolic: 80,
        }],
        challenge_checkins: [],
        active_challenge: null,
        challenge_events: [],
      }),
    });
  });

  await page.goto('/?screen=S02');
  await expect(page.locator('.journey-today')).toBeVisible();

  const sawLoginCompanion = await page.evaluate(
    () => Boolean((window as typeof window & { __sawLoginCompanionDuringBootstrap?: boolean })
      .__sawLoginCompanionDuringBootstrap),
  );
  expect(sawLoginCompanion).toBe(false);
});

test('normal artifact excludes test authentication and fixture injection', () => {
  const dist = path.resolve('test-results/ui-release/normal');
  const scripts = readdirSync(path.join(dist, 'assets')).filter(file => file.endsWith('.js'));
  const content = scripts.map(file => readFileSync(path.join(dist, 'assets', file), 'utf8')).join('\n');
  for (const marker of ['e2e-synthetic-access-token', 'e2e-test-publishable-key', 'journeyReviewFixture', 'synthetic-save', 'sk7:e2e-session-change']) expect(content).not.toContain(marker);
  expect(readFileSync(path.join(dist, 'index.html'), 'utf8')).not.toContain('<script>');
  expect(readdirSync(dist)).not.toContain('journey-review-fixture.mjs');
});

for (const preview of [false, true]) test(`normal mocked auth keeps S11 transient with ${preview ? 'visible preview' : 'non-numeric completion'}`, async ({ page }) => {
  // Browser-owned synthetic storage + intercepted API only; no real auth/DB integration.
  let empty = true;
  let modelRequests = 0;
  let modelAssets = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/models/model-v2.json') {
      modelAssets++;
      expect(request.method()).toBe('GET');
      expect(request.postData()).toBeNull();
    }
  });
  await page.clock.setFixedTime(new Date(preview ? '2026-09-17T03:00:00Z' : '2026-09-11T03:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('sb-auth-auth-token', JSON.stringify({
    access_token: 'local-mock-auth-token', refresh_token: 'local-mock-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: 2000000000,
    user: { id: 'local-mock-user', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-09-01T00:00:00Z' },
  })));
  await page.route('https://auth.ui-candidate.invalid/**', route => route.abort());
  await page.route('http://api.ui-candidate.invalid/**', async route => {
    const url = new URL(route.request().url());
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4182', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/product-score')) {
      modelRequests += 1;
      return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ schema_version: 'model-v2-r1-schema-v1', product_wording: '입력 기반 위험군 선별 신호' }) });
    }
    if (!url.pathname.endsWith('/window')) return route.abort();
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'), blood_pressure_observations: [], challenge_checkins: [], active_challenge: null,
      challenge_events: empty ? [] : [{ id: 'synthetic-existing', observed_on: '2026-09-05', action_id: 'walk-10-minutes', status: 'completed' }] }) });
  });
  await page.goto('/?e2e=signed-in&recap_fixture=mixed&screen=S02');
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await expect(page.locator('.journey-today')).toHaveCount(0);
  empty = false;
  await page.reload();
  await expect(page.locator('.journey-today')).toBeVisible();
  await expect(page.locator('[data-static-landscape="S02"]')).toBeVisible();
  await expect(page.locator('[data-login-companion]')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: '주요 화면' });
  await expect(nav.getByRole('button')).toHaveCount(5);
  for (const [label, screen] of [['오늘의 기록', 'S02'], ['기록 찾아보기', 'S08'], ['7일 돌아보기', 'S10'], ['설정', 'S14']]) {
    await nav.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
    if (screen === 'S14') {
      await expect(nav.getByRole('button', { name: '설정', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[data-scene="S14"]')).not.toContainText('추가 도구');
      await expect(page.getByRole('button', { name: '선별 신호 도구 열기' })).toHaveCount(0);
    }
    await nav.getByRole('button', { name: 'AI 분석', exact: true }).click();
    await expect(page).toHaveURL(/screen=S11/);
    await expect(page.locator('[data-scene="S11"]')).toBeVisible();
    await expect(nav.getByRole('button', { name: 'AI 분석' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('button', { name: '설정', exact: true })).not.toHaveAttribute('aria-current', 'page');
  }
  await page.locator('#model-age').fill('35'); await page.locator('#model-sex').check();
  await page.locator('#model-height').fill('170'); await page.locator('#model-weight').fill('68');
  await page.locator('#model-walking-days-4').check();
  await page.locator('#model-walking-total-minutes').fill('40');
  await page.locator('#model-strength-2_days').check();
  await chooseTimeWheel(page, 'model-weekday-bed', '23:30');
  await chooseTimeWheel(page, 'model-weekday-wake', '07:00');
  await chooseTimeWheel(page, 'model-weekend-bed', '23:30');
  await chooseTimeWheel(page, 'model-weekend-wake', '08:00');
  await page.locator('#model-smoking-never_smoked').check();
  await page.locator('#model-alcohol-frequency').selectOption('lt_monthly');
  await page.locator('#model-alcohol-amount').selectOption('1_2_drinks');
  expect(modelRequests).toBe(0);
  await page.getByRole('button', { name: 'Model V2로 분석하기', exact: true }).click();
  const result = page.locator('[data-model-v2-user-result="processed"]');
  await expect(result).toBeVisible();
  expect(modelRequests).toBe(0);
  expect(modelAssets).toBe(1);
  const value = result.locator('[data-model-v2-preview-value]');
  if (preview) {
    await expect(value).toHaveText('0.055');
    await expect(value).toBeVisible();
    expect(await value.evaluate(node => node.closest('details'))).toBeNull();
  } else {
    await expect(value).toHaveCount(0);
    expect(await result.innerText()).not.toMatch(/0\.\d+/);
  }
  expect(await result.innerText()).not.toMatch(/\d+%|저위험|중위험|고위험/);
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(storage).not.toContain('never_smoked'); expect(storage).not.toContain('23:30');
  await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
  await expect(result).toHaveCount(0);
});

// E9 uses the normal build and real Auth SDK with synthetic transport responses.
// This existing suite runs in nightly-core; no production account is exercised.
async function startingHomeSession(page: Page, preference: string | null = 'my-space', signedIn = true) {
  const user = { id: '00000000-0000-4000-8000-000000000826', aud: 'authenticated', role: 'authenticated',
    app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const token = [Buffer.from('{"alg":"none"}').toString('base64url'),
    Buffer.from(JSON.stringify({ sub: user.id, exp: 4102444800 })).toString('base64url'), 'synthetic'].join('.');
  const session = { access_token: token, refresh_token: 'synthetic-refresh', expires_at: 4102444800,
    expires_in: 3600, token_type: 'bearer', user };
  await page.addInitScript(({ preference, signedIn, session }) => {
    if (!localStorage.getItem('e9-seeded')) {
      localStorage.setItem('e9-seeded', '1');
      if (preference !== null) localStorage.setItem('sk7-starting-home', preference);
      if (signedIn) localStorage.setItem('sb-auth-auth-token', JSON.stringify(session));
    }
    // Persist only a synthetic boolean across the redirect, never screen data.
    if (location.pathname === '/' && !location.search && !location.hash) {
      new MutationObserver(() => {
        if (document.querySelector('[data-scene="S02"], [data-scene="S12"]')) sessionStorage.setItem('e9-saw-today', '1');
      }).observe(document, { childList: true, subtree: true });
    }
  }, { preference, signedIn, session });
  const headers = { 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' };
  let reads = 0, writes = 0, verified = 0, windows = 0, verifies = 0;
  await page.route('https://auth.ui-candidate.invalid/**', route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/user')) verified++;
    if (url.pathname.endsWith('/verify')) verifies++;
    return route.fulfill({ headers, contentType: 'application/json',
      body: JSON.stringify(url.pathname.endsWith('/verify') || url.pathname.endsWith('/otp') ? session : user) });
  });
  await page.route('http://api.ui-candidate.invalid/**', route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (req.method() !== 'GET') writes++;
    if (url.pathname.endsWith('/placeable')) {
      reads++;
      return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({
        schemaVersion: 'placeable.v2', layoutId: 'e1-plaza.v2', revision: 3,
        selection: { pinwheel: { assetId: 'welcome-pinwheel-v1', color: 'teal', socketId: 'gate-right' }, keepsake: 'quiet-moon-v1' },
        latestOperationId: '00000000-0000-4000-8000-000000000826', latestFingerprint: 'a'.repeat(64),
      }) });
    }
    windows++;
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({
      start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'),
      blood_pressure_observations: [{ id: 'synthetic-e9-bp', observed_on: url.searchParams.get('end_on'), period: 'morning', systolic: 118, diastolic: 76 }],
      challenge_checkins: [], active_challenge: null, challenge_events: [],
    }) });
  });
  return { session, get reads() { return reads; }, get writes() { return writes; }, get verified() { return verified; },
    get windows() { return windows; }, get verifies() { return verifies; } };
}

test('E9 absent preference defaults signed-in bare root to Living City without semantic window load', async ({ page }) => {
  const account = await startingHomeSession(page, null);
  await page.goto('/');
  await expect(page).toHaveURL(/experience=e2&view=3d&storage=account/);
  await expect(page.getByTestId('placeable-world')).toBeVisible();
  expect(account.reads).toBe(1);
  expect(account.windows).toBe(0);
  expect(account.writes).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('sk7-starting-home'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('e9-saw-today'))).toBeNull();
});

for (const preference of ['classic-today', 'malformed', 'blocked']) test(`E9 ${preference} keeps Classic root`, async ({ page }) => {
  const account = await startingHomeSession(page, preference);
  if (preference === 'blocked') await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) { if (key === 'sk7-starting-home') throw new Error('blocked'); return original.call(this, key); };
  });
  await page.goto('/');
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  expect(account.reads).toBe(0); expect(account.writes).toBe(0);
});

for (const screen of ['S02', 'S10', 'S14']) test(`E9 explicit ${screen} survives persisted session bootstrap`, async ({ page }) => {
  const account = await startingHomeSession(page);
  await page.goto(`/?screen=${screen}`);
  await expect(page.locator(`[data-scene="${screen}"]`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`screen=${screen}`));
  expect(account.reads).toBe(0); expect(account.writes).toBe(0);
});

for (const mobile of [false, true]) test(`E9 ${mobile ? 'mobile touch' : 'desktop keyboard'} Settings applies next root; verified restore and history`, async ({ browser }) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL,
    viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    const account = await startingHomeSession(page, null);
    await page.goto('/?screen=S14');
    const classic = page.getByRole('radio', { name: /오늘의 기록/ }), space = page.getByRole('radio', { name: /My Space/ });
    await expect(space).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('sk7-starting-home'))).toBeNull();
    if (mobile) await classic.tap(); else { await space.focus(); await page.keyboard.press('ArrowLeft'); }
    await expect(classic).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('sk7-starting-home'))).toBe('classic-today');
    if (mobile) await space.tap(); else { await classic.focus(); await page.keyboard.press('ArrowRight'); }
    await expect(space).toBeChecked();
    await expect(page.locator('[data-scene="S14"]')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('sk7-starting-home'))).toBe('my-space');
    expect(account.reads).toBe(0); expect(account.writes).toBe(0);
    expect((await space.locator('..').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`e9-settings-${mobile ? 'mobile' : 'desktop'}.png`) });
    await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
    await expect(page).toHaveURL(/screen=S02/); await page.reload();
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    const windows = account.windows;
    await page.goto('/');
    await expect(page).toHaveURL(/experience=e2&view=3d&storage=account/);
    const world = page.getByTestId('placeable-world');
    await expect(world).toHaveAttribute('data-color', 'teal');
    await expect(world).toHaveAttribute('data-keepsake', 'quiet-moon-v1');
    await expect(world).toHaveAttribute('data-companion', 'bear');
    expect(account.verified).toBeGreaterThan(0); expect(account.reads).toBe(1);
    expect(account.windows).toBe(windows);
    expect(await page.evaluate(() => sessionStorage.getItem('e9-saw-today'))).toBeNull();
    await page.screenshot({ path: test.info().outputPath(`e9-home-${mobile ? 'mobile' : 'desktop'}.png`) });
    await page.getByRole('link', { name: '오늘의 기록으로 가기', exact: true }).click();
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    await page.goBack(); await expect(world).toBeVisible();
    await page.goForward(); await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    await page.reload(); await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    expect(account.writes).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('sk7:placeable:v1'))).toBeNull();
    await page.goto('/?screen=S14'); await classic.check(); await page.goto('/');
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    if (mobile) { await page.goto('/?screen=S14'); await page.setViewportSize({ width: 320, height: 640 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  } finally { await context.close(); }
});

test('E9 signed-out and guest unchanged; sign-in and sign-out preserve chosen home', async ({ page }) => {
  const account = await startingHomeSession(page, 'my-space', false);
  await page.goto('/'); await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  expect(account.reads).toBe(0);
  await page.goto('/?guest=1&screen=S14');
  await expect(page.locator('[data-scene="S14"]')).toBeVisible();
  await expect(page.getByRole('radio', { name: /My Space/ })).toHaveCount(0);
  expect(account.reads).toBe(0);
  await page.goto('/');
  await page.getByLabel('이메일', { exact: true }).fill('synthetic@example.invalid');
  await page.getByRole('button', { name: /로그인 링크/ }).click();
  { // Email confirmation in another tab updates the waiting root via the SDK.
    const confirmation = await page.context().newPage();
    await startingHomeSession(confirmation, 'my-space', false);
    await confirmation.goto('/auth/confirm?token_hash=synthetic-e9&type=email');
    await expect(confirmation.locator('[data-scene="S02"]')).toBeVisible();
    await expect(page.getByTestId('placeable-world')).toBeVisible();
    await confirmation.close();
  }
  await page.goto('/?screen=S14');
  await page.getByRole('button', { name: '이 기기에서 로그아웃', exact: true }).click();
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '이 기기에서 로그아웃했어요', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sk7-starting-home'))).toBe('my-space');
  await page.reload(); await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '이 기기에서 로그아웃했어요', exact: true })).toHaveCount(0);
  await page.getByLabel('이메일', { exact: true }).fill('synthetic@example.invalid');
  await page.getByRole('button', { name: /로그인 링크/ }).click();
  { // Email confirmation in another tab updates the waiting root via the SDK.
    const confirmation = await page.context().newPage();
    await startingHomeSession(confirmation, 'my-space', false);
    await confirmation.goto('/auth/confirm?token_hash=synthetic-e9&type=email');
    await expect(confirmation.locator('[data-scene="S02"]')).toBeVisible();
    await expect(page.getByTestId('placeable-world')).toBeVisible();
    await confirmation.close();
  }
  expect(account.writes).toBe(0);
});

test('E9 confirmation scrubbing does not become a default-entry redirect', async ({ page }) => {
  const account = await startingHomeSession(page, 'my-space', false);
  await page.goto('/auth/confirm?token_hash=synthetic-e9&type=email');
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  expect(account.verifies).toBe(1); expect(account.reads).toBe(0);
  await page.goto('/'); await expect(page.getByTestId('placeable-world')).toBeVisible();
  expect(account.verifies).toBe(1);
});

test('E9 failed account verification stays truthful; explicit recovery cannot loop', async ({ page }) => {
  const account = await startingHomeSession(page);
  await page.route('https://auth.ui-candidate.invalid/auth/v1/user', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('계정 공간을 불러올 수 없어요');
  await expect(page.getByRole('button', { name: '계정 공간 다시 확인' })).toBeVisible();
  expect(account.reads).toBe(0); expect(account.writes).toBe(0);
  await page.getByRole('link', { name: '오늘의 기록으로 돌아가기' }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();
  await expect(page).toHaveURL(/screen=S02/);
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('계정 공간을 불러올 수 없어요');
  await page.getByRole('link', { name: '이 브라우저의 공간으로 계속하기' }).click();
  await expect(page.getByTestId('placeable-experience')).toHaveAttribute('data-mode', 'browser');
  expect(account.reads).toBe(0); expect(account.writes).toBe(0);
});

test('E9 blocked preference writes retain the effective default and report failure', async ({ page }) => {
  await startingHomeSession(page, null);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'sk7-starting-home') throw new Error('blocked'); original.call(this, key, value); };
  });
  await page.goto('/?screen=S14');
  const classic = page.getByRole('radio', { name: /오늘의 기록/ });
  const space = page.getByRole('radio', { name: /My Space/ });
  await expect(space).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('sk7-starting-home'))).toBeNull();
  await classic.click();
  await expect(space).toBeChecked();
  await expect(page.getByRole('status')).toContainText('저장하지 못했어요');
  expect(await page.evaluate(() => localStorage.getItem('sk7-starting-home'))).toBeNull();
  await page.goto('/');
  await expect(page).toHaveURL(/experience=e2&view=3d&storage=account/);
  await expect(page.getByTestId('placeable-world')).toBeVisible();
});

test('E9 unavailable account read requires retry without copying browser state', async ({ page }) => {
  const account = await startingHomeSession(page);
  await page.addInitScript(() => localStorage.setItem('sk7:placeable:v1', 'separate-browser-sentinel'));
  await page.route('http://api.ui-candidate.invalid/api/v1/cosmetics/placeable', route => route.fulfill({
    status: 503, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type' },
    contentType: 'application/json', body: JSON.stringify({ detail: { code: 'read_unavailable' } }),
  }));
  await page.goto('/');
  await expect(page.getByTestId('save-status')).toContainText('꾸미기 저장소에 연결할 수 없어요');
  await expect(page.getByTestId('placeable-experience')).toHaveAttribute('data-mode', 'account');
  await expect(page.getByRole('button', { name: '저장된 상태 확인' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sk7:placeable:v1'))).toBe('separate-browser-sentinel');
  expect(account.writes).toBe(0);
});

test('E9 live session loss removes automatic account space and returns to sign-in without looping', async ({ page }) => {
  const account = await startingHomeSession(page);
  await page.goto('/'); await expect(page.getByTestId('placeable-world')).toBeVisible();
  // SDK session loss notification, as for expiry or sign-out in another tab.
  await page.evaluate(() => {
    localStorage.removeItem('sb-auth-auth-token');
    const channel = new BroadcastChannel('sb-auth-auth-token');
    channel.postMessage({ event: 'SIGNED_OUT', session: null }); channel.close();
  });
  await expect(page.getByTestId('placeable-world')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('계정 공간을 이용하려면 다시 로그인해 주세요');
  await page.getByRole('link', { name: '오늘의 기록으로 돌아가기' }).click();
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  expect(account.writes).toBe(0);
});
