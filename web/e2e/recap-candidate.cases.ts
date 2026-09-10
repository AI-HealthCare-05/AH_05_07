// Included by the existing required review scene suite; no workflow changes.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixtureScript = readFileSync(new URL('../scripts/journey-review-fixture.mjs', import.meta.url), 'utf8').replace('export function', 'function') + '\njourneyReviewFixture();';
const screen = (page: Page) => page.locator('.journey-recap');
async function fixture(page: Page, state = 'mixed', start = 'S10') {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript({ content: fixtureScript });
  await page.goto(`/?e2e=signed-in&screen=${start}&recap_fixture=${state}`);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1366, 768]]) {
  test(`recap journal navigation, focus and separate facts at ${width}x${height}`, async ({ page, browserName }) => {
    await page.setViewportSize({ width, height });
    await fixture(page, 'mixed', 'S02');
    await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
    await expect(page.locator('#S10-title')).toBeFocused();
    await expect(screen(page)).toBeVisible();
    await expect(page.locator('[data-dashboard-lane="blood-pressure"]')).toHaveText('2개 기록');
    await expect(page.locator('[data-dashboard-lane="challenge"]')).toHaveText('3개 기록');
    await expect(page.locator('[data-dashboard-lane="legacy"]')).toHaveText('1개 기록');
    await expect(page.locator('[data-challenge-progress]')).toContainText('선택한 구간 안의 체크인 기록 2개');
    await expect(page.locator('[data-checkin-status="skipped"]')).toHaveText('건너뜀');
    const recipe = await page.locator('[data-scene-recipe]').getAttribute('data-scene-recipe');
    const bp = page.locator('[data-record-lane="blood-pressure"]');
    await expect(bp).toContainText('아침');
    await expect(bp).toContainText('120/80 mmHg');
    await expect(bp).toContainText('저녁');
    await bp.getByRole('button', { name: '상세 보기' }).first().press('Enter');
    await expect(page.locator('#S09-title')).toBeFocused();
    await expect(page.getByRole('button', { name: '수정', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
    await expect(page.locator('#S08-title')).toBeFocused();
    await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
    await expect(page.locator('[data-scene-recipe]')).toHaveAttribute('data-scene-recipe', recipe!);
    await expect(page.locator('[data-saved-scene-status]')).toHaveCount(0);
    await noOverflow(page);
    await page.locator('#S10-title').focus();
    // macOS WebKit uses Option-Tab to include buttons; focus expectations are identical.
    await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    await expect(page.getByRole('button', { name: '이전 7일 보기', exact: true })).toBeFocused();
    await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    await expect(bp.getByRole('button', { name: '상세 보기' }).first()).toBeFocused();
  });
}

test('recap prior window keeps current scenery and challenge context with read-only detail and actions', async ({ page }) => {
  await fixture(page);
  const exportHint = page.locator('.recap-tools > p');
  await expect(exportHint).toHaveText('선택한 7일의 기록을 파일로 보관할 수 있어요.');
  await expect(page.getByRole('button', { name: '선택한 7일 내보내기' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
  const recipe = await page.locator('[data-scene-recipe]').getAttribute('data-scene-recipe');
  await page.getByRole('button', { name: '이전 7일 보기', exact: true }).click();
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'prior');
  await expect(exportHint).toHaveText('이전 7일은 읽기 전용이에요. 파일 내보내기는 현재 7일에서 사용할 수 있어요.');
  await expect(page.locator('.window-nav')).toContainText('8월 29일');
  await expect(page.locator('.window-nav')).toContainText('9월 4일');
  await expect(page.locator('[data-scene-recipe]')).toHaveAttribute('data-scene-recipe', recipe!);
  await expect(page.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', '2026-09-11');
  await expect(page.locator('[data-challenge-progress]')).toContainText('2026-09-09 ~ 2026-09-15');
  await expect(page.locator('[data-challenge-progress]')).toContainText('선택한 구간 안의 체크인 기록 0개');
  await expect(page.getByRole('button', { name: '선택한 7일 내보내기' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeDisabled();
  await page.locator('[data-record-lane="blood-pressure"] .record-action').first().click();
  await expect(page.getByText('이전 7일의 기록은 읽기 전용입니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'prior');
  await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
  await page.getByRole('button', { name: '현재 7일 보기', exact: true }).click();
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'current');
  await expect(exportHint).toHaveText('선택한 7일의 기록을 파일로 보관할 수 있어요.');
  await expect(page.getByRole('button', { name: '선택한 7일 내보내기' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
});

for (const [kind, index, explanation] of [
  ['legacy', 0, '이전 방식으로 남긴 기록은 읽기 전용입니다.'],
  ['challenge', 2, '현재 활성 챌린지에 속하지 않은 기록은 읽기 전용입니다.'],
] as const) {
  test(`recap ${kind} retains the existing read-only detail boundary`, async ({ page }) => {
    await fixture(page);
    await page.locator(`[data-record-lane="${kind}"] .record-action`).nth(index).click();
    await expect(page.locator('.record-detail')).toContainText(explanation);
    await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '삭제', exact: true })).toHaveCount(0);
  });
}

for (const [state, empty] of [['empty', 3], ['no-bp', 1], ['no-checkins', 1], ['no-legacy', 1]] as const) {
  test(`recap ${state} only labels confirmed empty record types`, async ({ page }) => {
    await fixture(page, state);
    await expect(screen(page)).toBeVisible();
    await expect(page.locator('.empty-record')).toHaveCount(empty);
    await expect(page.locator('[data-dashboard-lane] strong').filter({ hasText: /^0$/ })).toHaveCount(empty);
  });
}

test('recap initial load and failure do not claim empty or zero records', async ({ page }) => {
  await fixture(page, 'loading');
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.locator('[data-dashboard-lane]')).toHaveCount(0);
  await page.goto('/?e2e=signed-in&screen=S10&recap_fixture=initial-error');
  await expect(page.locator('[data-scene="S13"]')).toBeVisible();
  await expect(page.getByText('아직 기록이 없다는 뜻은 아니에요.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-dashboard-lane]')).toHaveCount(0);
});

test('recap refresh error preserves records, stale warning and scene identity', async ({ page }) => {
  await fixture(page, 'refresh-error');
  const row = await page.locator('[data-record-lane="blood-pressure"] li').first().elementHandle();
  const stage = await page.locator('[data-scene-recipe]').elementHandle();
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('최신 여부를 확인하지 못했어요', { exact: true })).toBeVisible();
  await expect(page.locator('.recap-journal-intro')).toContainText('최신 여부 미확인');
  await expect(page.locator('[data-record-lane="blood-pressure"]')).toContainText('120/80 mmHg');
  expect(await row!.evaluate(node => node.isConnected)).toBe(true);
  expect(await stage!.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
});

test('recap synthetic export uses selected dates and clears success on navigation without a save reaction', async ({ page }) => {
  await fixture(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '선택한 7일 내보내기' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('synthetic-sk7-2026-09-05-2026-09-11.json');
  const payload = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(payload.synthetic).toBe(true);
  expect(payload.blood_pressure_observations).toHaveLength(2);
  await expect(page.getByText('내보내기 파일을 준비했어요.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-saved-scene-status]')).toHaveCount(0);
  await page.getByRole('button', { name: '기록 찾아보기', exact: true }).click();
  await expect(page.getByText('내보내기 파일을 준비했어요.', { exact: false })).toHaveCount(0);
});

test('recap export failure preserves records and allows retry', async ({ page }) => {
  await fixture(page, 'export-error');
  await page.getByRole('button', { name: '선택한 7일 내보내기' }).click();
  await expect(page.getByText('파일을 내려받지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '선택한 7일 내보내기' })).toBeEnabled();
  await expect(page.locator('[data-dashboard-lane="blood-pressure"]')).toHaveText('2개 기록');
});

for (const width of [320, 390, 768, 1366]) {
  test(`recap 200% text and media failure at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route(/\.(glb|webp)(\?|$)/, route => route.abort());
    await fixture(page);
    await page.locator('html').evaluate(html => { html.style.fontSize = '200%'; });
    await noOverflow(page);
    await page.getByRole('button', { name: '이전 7일 보기', exact: true }).press('Enter');
    await expect(screen(page)).toBeVisible();
    await noOverflow(page);
    await page.locator('[data-record-lane="blood-pressure"] .record-action').first().press('Enter');
    await expect(page.locator('#S09-title')).toBeFocused();
  });
}

// Controlled fetch completion exercises the actual App guards under the new review layout.
const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Headers': 'authorization,content-type' };
function responseWindow(start: string, end: string, value = 120) {
  return { start_on: start, end_on: end, blood_pressure_observations: [{ id: `synthetic-${value}`, observed_on: end, period: 'morning', systolic: value, diastolic: 80 }], challenge_checkins: [], challenge_events: [], active_challenge: null };
}
function deferred() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }

test('recap current→prior→current rejects a late prior response', async ({ page }) => {
  const held = deferred(); let priorRequests = 0;
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('http://e2e.invalid/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/window')) return route.abort();
    const start = url.searchParams.get('start_on')!, end = url.searchParams.get('end_on')!;
    if (end === '2026-09-04') { priorRequests++; await held.promise; }
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(responseWindow(start, end, end === '2026-09-04' ? 130 : 120)) });
  });
  await page.goto('/?e2e=signed-in&screen=S10');
  await page.getByRole('button', { name: '이전 7일 보기', exact: true }).click();
  await expect.poll(() => priorRequests).toBe(1);
  await page.goBack();
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'current');
  const settled = page.waitForResponse(response => response.url().includes('end_on=2026-09-04'));
  held.release(); await settled;
  await expect(page.locator('[data-record-lane="blood-pressure"]')).toContainText('120/80 mmHg');
  await expect(screen(page)).not.toContainText('130/80');
});

test('recap refresh and export keep pending disables and ignore a late download after session loss', async ({ page }) => {
  const heldRefresh = deferred(), heldExport = deferred(); let windows = 0, exports = 0, downloads = 0;
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('download', () => downloads++);
  await page.route('http://e2e.invalid/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/export')) { exports++; await heldExport.promise; return route.fulfill({ headers, contentType: 'application/json', body: '{"synthetic":true}' }); }
    if (!url.pathname.endsWith('/window')) return route.abort();
    windows++; if (windows === 2) await heldRefresh.promise;
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(responseWindow(url.searchParams.get('start_on')!, url.searchParams.get('end_on')!)) });
  });
  await page.goto('/?e2e=signed-in&screen=S10');
  const stage = await page.locator('[data-scene-recipe]').elementHandle();
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByRole('button', { name: '새로고침 중', exact: true })).toBeDisabled();
  await expect(page.locator('.recap-journal-intro')).toContainText('새로고침 중');
  heldRefresh.release();
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
  expect(await stage!.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: '선택한 7일 내보내기' }).click();
  await expect.poll(() => exports).toBe(1);
  await expect(page.getByRole('button', { name: '내보내는 중' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('sk7:e2e-session-change', { detail: null })));
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  const settled = page.waitForResponse(response => response.url().includes('/export'));
  heldExport.release(); await settled;
  await expect(page.getByText('내보내기 파일을 준비했어요.', { exact: false })).toHaveCount(0);
  expect(downloads).toBe(0);
});
