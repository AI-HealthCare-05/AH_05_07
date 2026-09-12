import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

for (const screen of ['S02', 'S05', 'S10', 'S11']) test(`normal configured build rejects fixture, fake-session URL and harness event at ${screen}`, async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.route('**/*.invalid/**', route => route.abort());
  await page.goto(`/?e2e=signed-in&fixture=VP-10&recap_fixture=mixed&screen=${screen}&ui=journey&scene=review&VITE_SK7_E2E_MODE=1&model_v2_state=ready`);
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  await expect(page.getByText('웹 환경변수를 설정한 뒤 시작할 수 있습니다.')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('sk7:e2e-session-change', { detail: { access_token: 'e2e-synthetic-access-token', user: { id: 'synthetic-user' } } })));
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  await expect(page.locator('.journey-candidate, .journey-recap, [data-dashboard-lane], canvas')).toHaveCount(0);
  expect(requests.filter(url => /observations|product-score|\.glb(?:\?|$)/.test(url))).toEqual([]);
});

test('normal artifact excludes test authentication and fixture injection', () => {
  const dist = path.resolve('test-results/ui-release/normal');
  const scripts = readdirSync(path.join(dist, 'assets')).filter(file => file.endsWith('.js'));
  const content = scripts.map(file => readFileSync(path.join(dist, 'assets', file), 'utf8')).join('\n');
  for (const marker of ['e2e-synthetic-access-token', 'e2e-test-publishable-key', 'journeyReviewFixture', 'synthetic-save', 'sk7:e2e-session-change']) expect(content).not.toContain(marker);
  expect(readFileSync(path.join(dist, 'index.html'), 'utf8')).not.toContain('<script>');
  expect(readdirSync(dist)).not.toContain('journey-review-fixture.mjs');
});

test('normal mocked auth preserves empty S12, selects journey and keeps S11 transient/non-numeric', async ({ page }) => {
  // Browser-owned synthetic storage + intercepted API only; no real auth/DB integration.
  let empty = true;
  let modelRequests = 0;
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
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
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '생활정보 기반 고혈압 선별 참고', exact: true }).click();
  await page.getByRole('button', { name: '입력 시작하기', exact: true }).click();
  await page.getByLabel('나이', { exact: true }).fill('35'); await page.getByLabel('성별', { exact: true }).selectOption('1');
  await page.locator('#model-height').fill('170'); await page.locator('#model-weight').fill('68');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('흡연 상태').selectOption('never_smoked'); await page.getByLabel('음주 빈도').selectOption('lt_monthly');
  await page.getByLabel('한 번 마실 때 음주량').selectOption('1_2_drinks');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('최근 7일 걷기 일수').fill('4');
  await page.locator('#model-walking-hours').fill('0'); await page.locator('#model-walking-minutes').fill('40');
  await page.getByLabel('최근 7일 근력운동').selectOption('2_days');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.locator('#model-weekday-bed').fill('23:30'); await page.locator('#model-weekday-wake').fill('07:00');
  await page.locator('#model-weekend-bed').fill('23:30'); await page.locator('#model-weekend-wake').fill('08:00');
  await page.getByRole('button', { name: '입력 확인하기', exact: true }).click();
  expect(modelRequests).toBe(0);
  await page.getByLabel('위 안내를 확인했습니다.').check();
  await page.getByRole('button', { name: '생활정보 분석하기', exact: true }).click();
  const result = page.locator('[data-model-v2-user-result="processed"]');
  await expect(result).toBeVisible();
  expect(modelRequests).toBe(1);
  expect(await result.innerText()).not.toMatch(/0\.\d+|\d+%|저위험|중위험|고위험/);
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(storage).not.toContain('never_smoked'); expect(storage).not.toContain('23:30');
  await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
  await expect(result).toHaveCount(0);
});
