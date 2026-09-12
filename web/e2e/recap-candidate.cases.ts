// Included by the existing required review scene suite; no workflow changes.
import { expect, test, type Page } from '@playwright/test';
import { sevenDayFacts } from '../src/ui/livingWeek';
import { summarizeTrailDays } from '../src/ui/livingWeekPresentation';
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
    await expect(page.locator('[data-trail-date]')).toHaveCount(7);
    await expect(page.locator('[data-trail-date="2026-09-11"]')).toHaveAttribute('aria-current', 'date');
    await expect(page.locator('[data-trail-date="2026-09-11"] .trail-facts')).toHaveText('혈압 관찰1건챌린지 참여기록함');
    await expect(page.locator('[data-trail-date="2026-09-10"] .trail-facts')).toHaveText('혈압 관찰0건챌린지 참여건너뜀');
    await expect(page.locator('[data-trail-date="2026-09-09"] .trail-facts')).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
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
    await expect(page.locator('summary').filter({ hasText: '챌린지 날짜별 상태' })).toBeFocused();
    await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    await expect(page.getByRole('button', { name: '7일 전체 보기', exact: true })).toBeFocused();
    await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    await expect(page.locator('[data-trail-date]').first().getByRole('button')).toBeFocused();
  });
}

test('recap date focus filters existing records and returns to the complete week', async ({ page }) => {
  await fixture(page);
  const trail = page.locator('.seven-day-trail');
  const wholeWeek = page.getByRole('button', { name: '7일 전체 보기', exact: true });
  const detail = page.locator('.trail-day-detail');
  const records = (lane: string) => page.locator(`[data-record-lane="${lane}"] .record-action`);
  await expect(wholeWeek).toHaveAttribute('aria-pressed', 'true');
  await expect(trail.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await trail.locator('[data-trail-date="2026-09-10"] > button').click();
  await expect(trail.locator('[data-trail-date="2026-09-10"] > button')).toHaveAttribute('aria-pressed', 'true');
  await expect(detail).toHaveAttribute('data-selected-date', '2026-09-10');
  await expect(detail.locator('dl')).toHaveText('혈압 관찰0건챌린지 참여건너뜀');
  await expect(page.locator('[data-main-section="seven-day-dashboard"]')).toHaveAttribute('data-focused-date', '2026-09-10');
  await expect(records('blood-pressure')).toHaveCount(0);
  await expect(records('challenge')).toHaveCount(1);
  await expect(records('legacy')).toHaveCount(0);
  await expect(page.locator('[data-checkin-status="skipped"]')).toHaveText('건너뜀');
  await expect(page.locator('[data-week-fact="observation-count"]')).toHaveText('2건');
  await expect(page.locator('[data-week-summary]')).toContainText('기록이 있는 날 2일');
  await expect(page.locator('[data-week-fact="participation-date-count"]')).toHaveText('3일');
  await expect(trail.locator('li[data-trail-date]')).toHaveCount(7);
  const staticPreview = await page.locator('[data-static-landscape]').count() === 1;
  await expect(page.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', staticPreview ? '2026-09-10' : '2026-09-11');
  await trail.locator('[data-trail-date="2026-09-09"] > button').press('Enter');
  await expect(records('blood-pressure')).toHaveCount(1);
  await expect(page.locator('[data-record-lane="blood-pressure"]')).toContainText('118/78 mmHg');
  await expect(records('challenge')).toHaveCount(0);
  await wholeWeek.press('Enter');
  await expect(wholeWeek).toHaveAttribute('aria-pressed', 'true');
  await expect(trail.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-main-section="seven-day-dashboard"]')).not.toHaveAttribute('data-focused-date');
  await expect(records('blood-pressure')).toHaveCount(2);
  await expect(records('challenge')).toHaveCount(3);
  await expect(records('legacy')).toHaveCount(1);
});

test('recap prior window keeps current scenery and challenge context with read-only detail and actions', async ({ page }) => {
  await fixture(page);
  const exportHint = page.locator('.recap-tools > p');
  await expect(exportHint).toHaveText('선택한 7일의 기록을 파일로 보관할 수 있어요.');
  await expect(page.getByRole('button', { name: '선택한 7일 내보내기' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
  const recipe = await page.locator('[data-scene-recipe]').getAttribute('data-scene-recipe');
  await page.locator('[data-trail-date="2026-09-10"] > button').click();
  await page.getByRole('button', { name: '이전 7일 보기', exact: true }).click();
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'prior');
  await expect(page.locator('[data-trail-date]').first()).toHaveAttribute('data-trail-date', '2026-08-29');
  await expect(page.locator('[data-trail-date]').last()).toHaveAttribute('data-trail-date', '2026-09-04');
  await expect(page.locator('.seven-day-trail [aria-current]')).toHaveCount(0);
  await expect(page.locator('.seven-day-trail button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '7일 전체 보기', exact: true })).toHaveAttribute('aria-pressed', 'true');
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
  await page.locator('[data-trail-date="2026-09-04"] > button').click();
  await page.getByRole('button', { name: '현재 7일 보기', exact: true }).click();
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'current');
  await expect(page.locator('.seven-day-trail button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '7일 전체 보기', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-record-lane="blood-pressure"] .record-action')).toHaveCount(2);
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
  await expect(page.locator('[data-trail-date]')).toHaveCount(0);
  await page.goto('/?e2e=signed-in&screen=S10&recap_fixture=initial-error');
  await expect(page.locator('[data-scene="S13"]')).toBeVisible();
  await expect(page.getByText('아직 기록이 없다는 뜻은 아니에요.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-dashboard-lane]')).toHaveCount(0);
  await expect(page.locator('[data-trail-date]')).toHaveCount(0);
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

test('recap day focus keeps the full export window and clears success on navigation without a save reaction', async ({ page }) => {
  await fixture(page);
  await page.locator('[data-trail-date="2026-09-09"] > button').click();
  await expect(page.locator('[data-record-lane="blood-pressure"] .record-action')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '선택한 7일 내보내기' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('synthetic-sk7-2026-09-05-2026-09-11.json');
  const payload = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(payload.synthetic).toBe(true);
  expect(payload.start_on).toBe('2026-09-05');
  expect(payload.end_on).toBe('2026-09-11');
  expect(payload.blood_pressure_observations).toHaveLength(2);
  expect(payload.challenge_checkins).toHaveLength(3);
  expect(payload.challenge_events).toHaveLength(1);
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

test('living week projects seven dates across year and leap-day boundaries with separate facts', () => {
  const days = sevenDayFacts('2026-01-03', [
    { observed_on: '2025-12-27' }, { observed_on: '2025-12-28' },
    { observed_on: '2026-01-03' }, { observed_on: '2026-01-03' }, { observed_on: '2026-01-04' },
  ], [
    { observed_on: '2025-12-28', status: 'completed' },
    { observed_on: '2025-12-29', status: 'skipped' },
    { observed_on: '2026-01-03', status: 'completed' },
    { observed_on: '2026-01-03', status: 'skipped' },
  ]);
  expect(days).toEqual([
    { date: '2025-12-28', observationCount: 1, participation: '기록함' },
    { date: '2025-12-29', observationCount: 0, participation: '건너뜀' },
    { date: '2025-12-30', observationCount: 0, participation: '기록 없음' },
    { date: '2025-12-31', observationCount: 0, participation: '기록 없음' },
    { date: '2026-01-01', observationCount: 0, participation: '기록 없음' },
    { date: '2026-01-02', observationCount: 0, participation: '기록 없음' },
    { date: '2026-01-03', observationCount: 2, participation: '혼합' },
  ]);
  expect(summarizeTrailDays(days)).toEqual({
    observationCount: 3, observationDateCount: 2, participationDateCount: 3,
    recordedDateCount: 1, skippedDateCount: 1, mixedDateCount: 1,
  });
  expect(sevenDayFacts('2028-03-01', [], []).map(day => day.date)).toEqual([
    '2028-02-24', '2028-02-25', '2028-02-26', '2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01',
  ]);
});

test('living week uses Seoul dates and date-only landmarks with mixed facts and legacy kept apart', async ({ page }) => {
  let dataRequests = 0;
  const runtimeRequests: string[] = [];
  page.on('request', request => {
    if (/ThreeSceneRenderer|CompanionReviewRenderer|\.glb(?:\?|$)/.test(request.url())) runtimeRequests.push(request.url());
  });
  await page.clock.setFixedTime(new Date('2026-09-10T15:05:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('http://e2e.invalid/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    dataRequests++;
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/window')) return route.abort();
    const body = {
      ...responseWindow(url.searchParams.get('start_on')!, url.searchParams.get('end_on')!),
      challenge_checkins: [
        { id: 'synthetic-a', challenge_id: 'old', observed_on: '2026-09-11', action_id: 'walk-10-minutes', status: 'completed' },
        { id: 'synthetic-b', challenge_id: 'new', observed_on: '2026-09-11', action_id: 'sleep-routine', status: 'skipped' },
      ],
      challenge_events: [{ id: 'synthetic-legacy', observed_on: '2026-09-10', action_id: 'walk-10-minutes', status: 'completed' }],
    };
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/?e2e=signed-in&screen=S02');
  const trail = page.locator('.seven-day-trail');
  await expect(trail.locator('time')).toHaveCount(7);
  await expect(trail.locator('.trail-landmark')).toHaveText(['정자', '노을 전망대', '정원 대문', '허브 정원', '나무 그늘과 벤치', '나무다리', '책 읽는 쉼터']);
  await expect(page.locator('[data-trail-date="2026-09-11"] .trail-facts')).toHaveText('혈압 관찰1건챌린지 참여혼합');
  await expect(page.locator('[data-trail-date="2026-09-10"] .trail-facts')).toHaveText('혈압 관찰0건챌린지 참여기록 없음');
  const facts = await trail.locator('.trail-facts').allTextContents();
  await page.getByRole('link', { name: '7일 돌아보기' }).press('Enter');
  await expect(page.locator('#S10-title')).toBeFocused();
  expect(await trail.locator('.trail-facts').allTextContents()).toEqual(facts);
  await expect(page.locator('[data-week-fact="participation-date-count"]')).toHaveText('1일');
  await expect(trail).not.toContainText('mmHg');
  const overviewBox = (await trail.boundingBox())!;
  const listBox = (await page.locator('.recap-journal').boundingBox())!;
  expect(overviewBox.y + overviewBox.height).toBeLessThanOrEqual(listBox.y);
  const stage = await page.locator('[data-scene-recipe]').elementHandle();
  const staticPreview = await page.locator('[data-static-landscape]').count() === 1;
  const requestsBeforeSelection = dataRequests;
  await trail.locator('[data-trail-date="2026-09-10"] > button').press('Enter');
  await expect(page.locator('.trail-day-detail dl')).toHaveText('혈압 관찰0건챌린지 참여기록 없음');
  await expect(page.locator('[data-record-lane="legacy"] .record-action')).toHaveCount(1);
  await expect(page.locator('[data-record-lane="challenge"] .record-action')).toHaveCount(0);
  await expect(page.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', staticPreview ? '2026-09-10' : '2026-09-11');
  expect(await stage!.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('[data-companion-status], [data-saved-scene-status], canvas')).toHaveCount(0);
  expect(dataRequests).toBe(requestsBeforeSelection);
  expect(runtimeRequests).toEqual([]);
});

const report = (page: Page) => page.locator('[data-living-week-report]');
const reportAction = (page: Page) => page.getByRole('button', { name: '7일 리포트 보기', exact: true });
const reportDates = ['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];

test('living week report preserves the complete selected week with separate facts and no private metadata', async ({ page }) => {
  let dataRequests = 0;
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const privateMetadata = {
    user_id: 'report-owner-private-canary', email: 'report-private@example.invalid',
    access_token: 'report-token-private-canary', expires_at: 1999999999,
    storage_metadata: 'report-storage-private-canary', model_v2: 'report-model-private-canary',
  };
  await page.route('http://e2e.invalid/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    dataRequests++;
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/window')) return route.abort();
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({
      ...responseWindow(url.searchParams.get('start_on')!, url.searchParams.get('end_on')!),
      ...privateMetadata,
      blood_pressure_observations: [
        { ...privateMetadata, id: 'report-bp-morning-private-canary', observed_on: '2026-09-11', period: 'morning', systolic: 120, diastolic: 80 },
        { ...privateMetadata, id: 'report-bp-evening-private-canary', observed_on: '2026-09-11', period: 'evening', systolic: 126, diastolic: 82 },
        { ...privateMetadata, id: 'report-bp-earlier-private-canary', observed_on: '2026-09-09', period: 'evening', systolic: 118, diastolic: 78 },
      ],
      challenge_checkins: [
        { id: 'report-checkin-private-canary-a', challenge_id: 'report-challenge-private-canary', observed_on: '2026-09-05', action_id: 'sleep-routine', status: 'completed' },
        { id: 'report-checkin-private-canary-b', challenge_id: 'report-challenge-private-canary', observed_on: '2026-09-10', action_id: 'walk-10-minutes', status: 'skipped' },
        { id: 'report-checkin-private-canary-c', challenge_id: 'report-challenge-private-canary', observed_on: '2026-09-11', action_id: 'walk-10-minutes', status: 'completed' },
        { id: 'report-checkin-private-canary-d', challenge_id: 'report-challenge-private-canary', observed_on: '2026-09-11', action_id: 'sleep-routine', status: 'skipped' },
      ],
      challenge_events: [{ id: 'report-legacy-private-canary', observed_on: '2026-09-08', action_id: 'walk-10-minutes', status: 'completed' }],
    }) });
  });
  await page.goto('/?e2e=signed-in&screen=S10');
  const selectedDate = page.locator('[data-trail-date="2026-09-10"] > button');
  await selectedDate.click();
  await expect(page.locator('[data-record-lane="blood-pressure"] .record-action')).toHaveCount(0);
  const requestsBeforeReport = dataRequests;
  const storageBeforeReport = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
  await reportAction(page).press('Enter');
  await expect(report(page)).toBeVisible();
  await expect(report(page).getByRole('heading', { name: '7일 기록 리포트', exact: true })).toBeFocused();
  expect(await report(page).locator('[data-report-date]').evaluateAll(days => days.map(day => day.getAttribute('data-report-date')))).toEqual(reportDates);
  await expect(report(page).locator('[data-report-summary="blood-pressure"]')).toContainText(/3\s*건/);
  await expect(report(page).locator('[data-report-summary="blood-pressure"]')).toContainText(/2\s*일/);
  await expect(report(page).locator('[data-report-summary="challenge"] > div')).toHaveText([
    '체크인이 있는 날짜3일', '기록함1일', '건너뜀1일', '혼합1일', '기록 없음4일',
  ]);
  await expect(report(page).locator('[data-report-date] > header > p')).toHaveText([
    '정자', '노을 전망대', '정원 대문', '허브 정원', '나무 그늘과 벤치', '나무다리', '책 읽는 쉼터',
  ]);
  const lastDay = report(page).locator('[data-report-date="2026-09-11"]');
  await expect(lastDay).toContainText('아침 · 120/80 mmHg');
  await expect(lastDay).toContainText('저녁 · 126/82 mmHg');
  await expect(lastDay).toContainText('혼합');
  await expect(report(page).locator('[data-report-date="2026-09-09"]')).toContainText('저녁 · 118/78 mmHg');
  await expect(report(page).locator('[data-report-date="2026-09-05"]')).toContainText('기록함');
  await expect(report(page).locator('[data-report-date="2026-09-10"]')).toContainText('건너뜀');
  await expect(report(page).locator('[data-report-date="2026-09-08"]')).toContainText('기록 없음');
  for (const day of await report(page).locator('[data-report-date]').all()) {
    await expect(day.locator('time')).toHaveCount(1);
    await expect(day).toContainText('혈압 관찰');
    await expect(day).toContainText('챌린지 참여');
  }
  const markup = await report(page).evaluate(node => node.outerHTML);
  expect(markup).not.toMatch(/private-canary|report-private@example|e2e-synthetic-user|e2e-synthetic-access-token|user_id|access_token|expires_at|storage_metadata|model_v2|Model V2|schema_version|signal_result|http:\/\/e2e\.invalid/);
  expect(await report(page).innerText()).not.toMatch(/정상|좋은 수치|나쁜 수치|목표 달성|건강 점수|성공률|참여율|개선율|%/);
  expect(dataRequests).toBe(requestsBeforeReport);
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }))).toEqual(storageBeforeReport);
  await page.getByRole('button', { name: '7일 돌아보기로 돌아가기', exact: true }).press('Enter');
  await expect(report(page)).toHaveCount(0);
  await expect(reportAction(page)).toBeFocused();
  await expect(selectedDate).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-main-section="seven-day-dashboard"]')).toHaveAttribute('data-focused-date', '2026-09-10');
});

test('living week report distinguishes initial loading and failure from confirmed empty records', async ({ page }) => {
  await fixture(page, 'loading');
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(reportAction(page)).toHaveCount(0);
  await expect(report(page)).toHaveCount(0);
  await page.goto('/?e2e=signed-in&screen=S10&recap_fixture=initial-error');
  await expect(page.locator('[data-scene="S13"]')).toBeVisible();
  await expect(reportAction(page)).toHaveCount(0);
  await expect(report(page)).toHaveCount(0);
  await page.goto('/?e2e=signed-in&screen=S10&recap_fixture=empty');
  await reportAction(page).click();
  await expect(report(page).locator('[data-report-date]')).toHaveCount(7);
  await expect(report(page).locator('[data-report-summary="blood-pressure"]')).toContainText(/0\s*건/);
  await expect(report(page).locator('[data-report-summary="challenge"]')).toContainText(/0\s*일/);
  for (const day of await report(page).locator('[data-report-date]').all()) await expect(day).toContainText('기록 없음');
});

test('living week report preserves the prior boundary and the existing full-window JSON export after closing', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: '이전 7일 보기', exact: true }).click();
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'prior');
  await expect(reportAction(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: '선택한 7일 내보내기', exact: true })).toBeDisabled();
  await expect(report(page)).toHaveCount(0);
  await page.getByRole('button', { name: '현재 7일 보기', exact: true }).click();
  await page.locator('[data-trail-date="2026-09-09"] > button').click();
  await reportAction(page).click();
  await expect(report(page).locator('[data-report-date]')).toHaveCount(7);
  await page.getByRole('button', { name: '7일 돌아보기로 돌아가기', exact: true }).click();
  await expect(page.locator('[data-record-lane="blood-pressure"] .record-action')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '선택한 7일 내보내기', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('synthetic-sk7-2026-09-05-2026-09-11.json');
  const payload = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(payload.start_on).toBe('2026-09-05');
  expect(payload.end_on).toBe('2026-09-11');
  expect(payload.blood_pressure_observations).toHaveLength(2);
  expect(payload.challenge_checkins).toHaveLength(3);
  expect(payload.challenge_events).toHaveLength(1);
});

test('living week report identifies retained data during refresh and after refresh failure', async ({ page }) => {
  const heldRefresh = deferred();
  let windowRequests = 0;
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('http://e2e.invalid/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/window')) return route.abort();
    if (++windowRequests > 1) {
      await heldRefresh.promise;
      return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{"code":"synthetic_refresh_failure"}' });
    }
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(responseWindow(url.searchParams.get('start_on')!, url.searchParams.get('end_on')!)) });
  });
  await page.goto('/?e2e=signed-in&screen=S10');
  await expect(reportAction(page)).toBeEnabled();
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect.poll(() => windowRequests).toBe(2);
  await reportAction(page).click();
  await expect(report(page)).toContainText('마지막으로 불러온');
  await expect(report(page)).toContainText('새로고침 중');
  await expect(report(page)).toContainText('120/80 mmHg');
  heldRefresh.release();
  await expect(report(page)).toContainText(/최신 여부.*(미확인|확인하지 못)/);
  await page.emulateMedia({ media: 'print' });
  await expect(report(page)).toBeVisible();
  await expect(report(page).getByText(/최신 여부.*(미확인|확인하지 못)/)).toBeVisible();
  await expect(report(page)).toContainText('120/80 mmHg');
});

for (const width of [320, 430]) test(`living week report reflows at ${width}px with 200% text`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await fixture(page);
  await reportAction(page).click();
  await page.locator('html').evaluate(html => { html.style.fontSize = '200%'; });
  await expect(report(page)).toBeVisible();
  await expect(report(page).locator('[data-report-date]')).toHaveCount(7);
  await noOverflow(page);
  for (const day of await report(page).locator('[data-report-date]').all()) {
    expect(await day.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await page.getByRole('button', { name: '7일 돌아보기로 돌아가기', exact: true }).press('Enter');
  await expect(reportAction(page)).toBeFocused();
});

test('living week report prints only semantic report content through an explicit browser action', async ({ page }) => {
  let printCalls = 0;
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await page.exposeFunction('recordSyntheticPrint', () => { printCalls++; });
  await page.addInitScript(() => {
    window.print = () => { void (window as Window & { recordSyntheticPrint: () => Promise<void> }).recordSyntheticPrint(); };
  });
  await fixture(page);
  await reportAction(page).press('Enter');
  expect(printCalls).toBe(0);
  expect(downloads).toBe(0);
  const printAction = page.getByRole('button', { name: '인쇄 / PDF로 저장', exact: true });
  await printAction.press('Enter');
  await expect.poll(() => printCalls).toBe(1);
  expect(downloads).toBe(0);
  await page.emulateMedia({ media: 'print' });
  await expect(report(page)).toBeVisible();
  await expect(page.locator('[data-living-week-app]')).toBeHidden();
  await expect(printAction).toBeHidden();
  await expect(page.getByRole('button', { name: '7일 돌아보기로 돌아가기', exact: true, includeHidden: true })).toBeHidden();
  await expect(page.locator('button:visible, nav:visible, canvas:visible, [data-static-landscape]:visible, [data-companion-status]:visible')).toHaveCount(0);
  await expect(report(page).getByRole('heading', { name: '7일 기록 리포트', exact: true })).toBeVisible();
  await expect(report(page).locator('[data-report-date]')).toHaveCount(7);
  await expect(report(page)).toContainText('혈압 관찰');
  await expect(report(page)).toContainText('챌린지 참여');
  const selectableText = await report(page).evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const text = selection.toString();
    selection.removeAllRanges();
    return text;
  });
  expect(selectableText).toContain('7일 기록 리포트');
  expect(selectableText).toContain('120/80 mmHg');
  await page.addStyleTag({ content: '[data-living-week-report], [data-living-week-report] * { background: transparent !important; background-image: none !important; }' });
  await expect(report(page)).toContainText('건너뜀');
  await noOverflow(page);
});

test('living week report leaves no private report content after logout', async ({ page }) => {
  await fixture(page);
  await reportAction(page).click();
  await expect(report(page)).toContainText('120/80 mmHg');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('sk7:e2e-session-change', { detail: null })));
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
  await expect(report(page)).toHaveCount(0);
  await expect(page.getByText('120/80 mmHg', { exact: false })).toHaveCount(0);
});

test('living week report retains an uncertain deletion warning on screen and in print', async ({ page }) => {
  let windowRequests = 0;
  let deleteRequests = 0;
  const deleteHeaders = { ...headers, 'Access-Control-Allow-Methods': 'GET,DELETE,OPTIONS' };
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: deleteHeaders });
    if (url.pathname.endsWith('/window')) {
      windowRequests++;
      return route.fulfill({ headers: deleteHeaders, contentType: 'application/json', body: JSON.stringify(responseWindow(url.searchParams.get('start_on')!, url.searchParams.get('end_on')!)) });
    }
    if (request.method() === 'DELETE' && url.pathname.endsWith('/blood-pressure/synthetic-120')) {
      deleteRequests++;
      return route.fulfill({ status: 503, headers: deleteHeaders, contentType: 'application/json', body: '{"detail":{"code":"observation_storage_not_ready"}}' });
    }
    return route.abort();
  });
  await page.goto('/?e2e=signed-in&screen=S10');
  await page.locator('[data-record-lane="blood-pressure"] .record-action').click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const confirmation = page.getByRole('dialog').filter({ hasText: '혈압 기록을 삭제할까요?' });
  await confirmation.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(confirmation.getByRole('status')).toContainText('삭제 여부를 확인하지 못했습니다.');
  await confirmation.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
  await expect(page.locator('[data-record-lane="blood-pressure"]')).toContainText('120/80 mmHg');
  await reportAction(page).click();
  await expect(report(page)).toContainText('120/80 mmHg');
  await expect(report(page).locator('[data-report-summary="blood-pressure"]')).toContainText(/1\s*건/);
  const freshness = report(page).locator('[data-report-freshness]');
  await expect(freshness).toHaveAttribute('data-report-freshness', 'ready');
  await expect(freshness).toContainText('최신 여부 미확인');
  await expect(freshness).toContainText('저장 또는 삭제의 반영 여부를 아직 확인하지 못했어요.');
  await page.emulateMedia({ media: 'print' });
  await expect(freshness).toBeVisible();
  await expect(report(page).getByText('아침 · 120/80 mmHg', { exact: true })).toBeVisible();
  expect(windowRequests).toBe(1);
  expect(deleteRequests).toBe(1);
});

test('living week report closes at Seoul rollover until the newly current window is loaded', async ({ page }) => {
  const nextWindow = deferred();
  const requestedRanges: string[] = [];
  await page.clock.setFixedTime(new Date('2026-09-11T14:59:59Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('http://e2e.invalid/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/window')) return route.abort();
    const start = url.searchParams.get('start_on')!, end = url.searchParams.get('end_on')!;
    requestedRanges.push(`${start}/${end}`);
    if (end === '2026-09-12') await nextWindow.promise;
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(responseWindow(start, end, end === '2026-09-12' ? 133 : 120)) });
  });
  await page.goto('/?e2e=signed-in&screen=S10');
  await reportAction(page).click();
  await expect(report(page)).toContainText('120/80 mmHg');
  await page.clock.setFixedTime(new Date('2026-09-11T15:00:00Z'));
  // A restored visible page uses the same Seoul-date refresh hook as midnight.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(() => requestedRanges).toEqual(['2026-09-05/2026-09-11', '2026-09-06/2026-09-12']);
  await expect(report(page)).toHaveCount(0);
  await expect(reportAction(page)).toBeDisabled();
  await expect(page.locator('[data-living-week-app]')).toBeVisible();
  nextWindow.release();
  await expect(reportAction(page)).toBeEnabled();
  await expect(report(page)).toHaveCount(0);
  await reportAction(page).click();
  expect(await report(page).locator('[data-report-date]').evaluateAll(days => days.map(day => day.getAttribute('data-report-date')))).toEqual([
    '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12',
  ]);
  await expect(report(page)).toContainText('133/80 mmHg');
  await expect(report(page)).not.toContainText('120/80 mmHg');
});
