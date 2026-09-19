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
  expect(llmsText).toMatch(/^# 상균7데이즈 \(SK7\)/);
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
  await page.getByRole('button', { name: '입력 시작하기', exact: true }).click();
  await page.getByLabel('만 나이', { exact: true }).fill('35'); await page.getByLabel('성별', { exact: true }).selectOption('1');
  await page.locator('#model-height').fill('170'); await page.locator('#model-weight').fill('68');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('최근 7일 동안 걸은 날은 며칠인가요?', { exact: true }).fill('4');
  await page.locator('#model-walking-hours').fill('0'); await page.locator('#model-walking-minutes').fill('40');
  await page.getByLabel('최근 7일 동안 근력운동을 한 날은 며칠인가요?', { exact: true }).selectOption('2_days');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await chooseTimeWheel(page, 'model-weekday-bed', '23:30');
  await chooseTimeWheel(page, 'model-weekday-wake', '07:00');
  await chooseTimeWheel(page, 'model-weekend-bed', '23:30');
  await chooseTimeWheel(page, 'model-weekend-wake', '08:00');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('일반담배(궐련) 흡연 상태는 어떤가요?', { exact: true }).selectOption('never_smoked'); await page.getByLabel('최근 1년 동안 술을 얼마나 자주 마셨나요?', { exact: true }).selectOption('lt_monthly');
  await page.getByLabel('술을 마실 때, 보통 한 번에 몇 잔 마시나요?', { exact: true }).selectOption('1_2_drinks');
  await page.getByRole('button', { name: '입력 확인하기', exact: true }).click();
  expect(modelRequests).toBe(0);
  await page.getByLabel('입력과 결과가 저장되지 않는다는 안내를 확인했어요.').check();
  await page.getByRole('button', { name: '생활정보 분석하기', exact: true }).click();
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
