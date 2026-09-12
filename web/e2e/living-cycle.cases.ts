import { expect, test, type BrowserContext, type Request } from '@playwright/test';
import type { ActiveChallenge, ObservationWindow } from '../src/lib/api';
import { e2eSessionEventName } from '../src/lib/e2eHarness';

const today = '2026-09-12';
const ended: ActiveChallenge = { id: 'synthetic-ended', action_id: 'walk-10-minutes', starts_on: '2026-09-05', ends_on: '2026-09-11', first_checkin_on: '2026-09-05', status: 'active' };
const next: ActiveChallenge = { id: 'synthetic-next', action_id: 'sleep-routine', starts_on: today, ends_on: '2026-09-18', first_checkin_on: null, status: 'active' };
const observations: ObservationWindow['blood_pressure_observations'] = [
  { id: 'synthetic-bp-old', observed_on: ended.starts_on, period: 'morning', systolic: 120, diastolic: 80 },
  { id: 'synthetic-bp-today', observed_on: today, period: 'morning', systolic: 121, diastolic: 81 },
];
const checkins: ObservationWindow['challenge_checkins'] = [
  { id: 'synthetic-checkin-old', challenge_id: ended.id, action_id: ended.action_id, observed_on: ended.starts_on, status: 'completed' },
];
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function api(context: BrowserContext, options: { active?: ActiveChallenge; write?: (index: number) => Promise<'uncertain' | void> } = {}) {
  const state = { active: { ...(options.active ?? ended) }, writes: [] as Request[], closed: [] as ActiveChallenge[] };
  await context.route('http://e2e.invalid/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/window')) {
      const start = url.searchParams.get('start_on')!;
      const end = url.searchParams.get('end_on')!;
      const owned = request.headers().authorization === 'Bearer e2e-synthetic-access-token';
      return json({ start_on: start, end_on: end, active_challenge: owned ? state.active : null,
        blood_pressure_observations: owned ? observations.filter(item => item.observed_on >= start && item.observed_on <= end) : [],
        challenge_checkins: owned ? checkins.filter(item => item.observed_on >= start && item.observed_on <= end) : [], challenge_events: [] });
    }
    if (url.pathname.endsWith('/challenges/active') && request.method() === 'POST') {
      state.writes.push(request);
      const outcome = await options.write?.(state.writes.length);
      // Browser fixture models the existing one-active constraint; service/DB tests own its enforcement.
      if (state.active.id === ended.id) {
        state.closed.push({ ...state.active, status: 'closed' });
        state.active = { ...next, action_id: request.postDataJSON().action_id };
      }
      if (outcome === 'uncertain') return json({ detail: { code: 'observation_storage_not_ready' } }, 503);
      return json(state.active);
    }
    throw new Error(`Unexpected Living Cycle request: ${request.method()} ${url.pathname}`);
  });
  return state;
}

test.use({ reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(`${today}T03:00:00Z`)); });

for (const width of [320, 390]) test(`Living Cycle retains exact recap/report and starts a fresh week by keyboard at ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 844 });
  const state = await api(context);
  await page.goto('/?e2e=signed-in&screen=S02');
  await expect(page.locator('[data-living-cycle="ended"]')).toContainText('이번 7일 여정이 끝났어요');
  await expect(page.getByRole('button', { name: '다음 7일 시작하기', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '종료된 7일 돌아보기', exact: true }).click();
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'cycle:2026-09-11');
  await expect(page.locator('[data-trail-date]')).toHaveCount(7);
  await expect(page.locator('[data-trail-date="2026-09-05"]')).toContainText('기록함');
  await page.getByRole('button', { name: '7일 리포트 보기', exact: true }).click();
  await expect(page.locator('[data-living-week-report]')).toContainText('120/80 mmHg');
  await expect(page.locator('[data-living-week-report]')).not.toContainText('121/81 mmHg');
  await expect(page.locator('[data-living-week-report]')).toContainText('종료된 7일');
  await page.getByRole('button', { name: '7일 돌아보기로 돌아가기' }).click();
  await expect(page.getByRole('button', { name: '7일 리포트 보기', exact: true })).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await page.locator('html').evaluate(html => { html.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '다음 7일 시작하기', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#S03-title')).toBeFocused();
  await expect(page).not.toHaveURL(/dashboard_window/);
  await expect(page.getByRole('heading', { name: '다음 7일의 행동을 골라요' })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.locator('html').evaluate(html => { html.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /수면 시간 지키기/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-window-kind="challenge-cycle"]')).toContainText('2026-09-12 ~ 2026-09-18');
  await expect(page.locator('[data-trail-date]')).toHaveCount(7);
  await expect(page.locator('[data-trail-date="2026-09-05"]')).toHaveCount(0);
  await expect(page.locator('[data-trail-date="2026-09-12"]')).toContainText('1건');
  await expect(page.locator('[data-trail-date="2026-09-12"]')).toContainText('기록 없음');
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].postDataJSON()).toEqual({ action_id: 'sleep-routine' });
  expect(state.closed).toEqual([{ ...ended, status: 'closed' }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '이전 여정 돌아보기' }).click();
  await page.getByRole('button', { name: '7일 리포트 보기', exact: true }).click();
  await expect(page.locator('[data-living-week-report]')).toContainText('120/80 mmHg');
  expect(state.writes).toHaveLength(1);
});

test('Living Cycle guards synchronous double submission and browser Back during delayed creation', async ({ page, context }) => {
  const delay = deferred();
  const state = await api(context, { write: async () => { await delay.promise; } });
  await page.goto('/?e2e=signed-in&screen=S10');
  await page.getByRole('button', { name: '다음 7일 시작하기', exact: true }).click();
  await page.getByRole('button', { name: /수면 시간 지키기/ }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect.poll(() => state.writes.length).toBe(1);
  await expect(page.getByRole('button', { name: /10분 걷기/ })).toBeDisabled();
  await page.goBack();
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();
  delay.release();
  await expect(page.locator('[data-challenge-progress]')).toContainText('수면 시간 지키기');
  await expect(page.locator('[data-scene="S10"]')).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test('Living Cycle uncertain creation requires a read and never automatically resends', async ({ page, context }) => {
  const state = await api(context, { write: async () => 'uncertain' });
  await page.goto('/?e2e=signed-in&screen=S03');
  await page.getByRole('button', { name: /수면 시간 지키기/ }).click();
  await expect(page.getByText('저장 여부를 확인하지 못했어요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /10분 걷기/ })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: '선택 상태 다시 확인하기', exact: true }).click();
  await expect(page.getByRole('button', { name: /수면 시간 지키기/ })).toContainText('선택됨');
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: '오늘의 기록으로 돌아가기', exact: true }).click();
  await expect(page.locator('[data-window-kind="challenge-cycle"]')).toContainText('2026-09-18');
});

test('Living Cycle two tabs reconcile a losing creation response through a read', async ({ page, context }) => {
  const delay = deferred();
  const state = await api(context, { write: async index => { await delay.promise; if (index === 2) return 'uncertain'; } });
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date(`${today}T03:00:00Z`));
  await page.goto('/?e2e=signed-in&screen=S03');
  await other.goto('/?e2e=signed-in&screen=S03');
  await page.getByRole('button', { name: /수면 시간 지키기/ }).click();
  await other.getByRole('button', { name: /수면 시간 지키기/ }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  delay.release();
  await expect(page.locator('[data-window-kind="challenge-cycle"]')).toContainText('2026-09-18');
  await expect(other.getByRole('button', { name: /수면 시간 지키기/ })).toBeDisabled();
  await other.getByRole('button', { name: '선택 상태 다시 확인하기', exact: true }).click();
  await expect(other.getByRole('button', { name: /수면 시간 지키기/ })).toContainText('선택됨');
  expect(state.writes).toHaveLength(2);
  expect(state.closed).toHaveLength(1);
  expect(state.active.id).toBe(next.id);
});

test('Living Cycle ignores an old session creation response', async ({ page, context }) => {
  const delay = deferred();
  const state = await api(context, { write: async () => { await delay.promise; } });
  await page.goto('/?e2e=signed-in&screen=S03');
  await page.getByRole('button', { name: /수면 시간 지키기/ }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(eventName => window.dispatchEvent(new CustomEvent(eventName, { detail: {
    access_token: 'synthetic-other-token', refresh_token: 'synthetic-other-refresh', expires_in: 3600, token_type: 'bearer',
    user: { id: 'synthetic-other-user', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-09-01T00:00:00Z' },
  } })), e2eSessionEventName);
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  const response = page.waitForResponse(r => r.url().endsWith('/challenges/active'));
  delay.release();
  await response;
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  await expect(page.getByText('7일 챌린지를 선택했습니다.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이전 여정 돌아보기' })).toHaveCount(0);
});

test('Living Cycle ends only after Seoul midnight, including without a first check-in', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-09-11T14:59:50Z') });
  await page.clock.pauseAt(new Date('2026-09-11T14:59:59Z'));
  const state = await api(context, { active: { ...ended, first_checkin_on: null } });
  await page.goto('/?e2e=signed-in&screen=S02');
  await expect(page.getByRole('button', { name: '다음 7일 시작하기', exact: true })).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(page.getByRole('button', { name: '다음 7일 시작하기', exact: true })).toBeEnabled();
  await page.goto('/?e2e=signed-in&screen=S06');
  await expect(page.getByRole('heading', { name: '종료된 챌린지를 확인해요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '오늘 상태 확인·기록하기' })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});


test('Living Cycle review survives reload and leaving selection does not create a challenge', async ({ page, context }) => {
  const state = await api(context);
  await page.goto('/?e2e=signed-in&screen=S06');
  await page.getByRole('button', { name: '종료된 7일 돌아보기', exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-trail-date="2026-09-05"]')).toContainText('기록함');
  await page.getByRole('button', { name: '다음 7일 시작하기', exact: true }).click();
  await expect(page.locator('[data-scene="S03"]')).toBeVisible();
  await page.getByRole('button', { name: '오늘의 기록으로 돌아가기', exact: true }).click();
  await expect(page.locator('[data-living-cycle="ended"]')).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.goto('/?e2e=signed-in&screen=S10&dashboard_window=cycle:2026-02-30');
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'current');
  await page.goto('/?e2e=signed-in&screen=S10&dashboard_window=cycle:2026-09-18');
  await expect(page.locator('[data-dashboard-window]')).toHaveAttribute('data-dashboard-window', 'current');
});
