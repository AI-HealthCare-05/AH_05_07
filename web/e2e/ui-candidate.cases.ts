import { expect, test, type Page } from '@playwright/test';
import { companionAssetManifest } from '../src/ui/companionAssets.generated';
import { installCompanionFramingProbe } from '../scripts/companion-framing-probe.mjs';
import { chooseTime } from './model-v2-time-wheel';
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

async function completeS11LifestyleSurvey(page: Page) {
  await page.getByRole('button', { name: '입력 시작하기', exact: true }).click();
  await page.getByLabel('만 나이', { exact: true }).fill('35');
  await page.getByLabel('성별', { exact: true }).selectOption('1');
  await page.locator('#model-height').fill('170');
  await page.locator('#model-weight').fill('68');
  await page.getByRole('button', { name: '다음', exact: true }).click();

  await page.getByLabel('최근 7일 동안 걸은 날은 며칠인가요?', { exact: true }).fill('4');
  await page.locator('#model-walking-hours').fill('0');
  await page.locator('#model-walking-minutes').fill('40');
  await page.getByLabel('최근 7일 동안 근력운동을 한 날은 며칠인가요?', { exact: true }).selectOption('2_days');
  await page.getByRole('button', { name: '다음', exact: true }).click();

  for (const [id, value] of [
    ['model-weekday-bed', '23:30'],
    ['model-weekday-wake', '07:00'],
    ['model-weekend-bed', '23:30'],
    ['model-weekend-wake', '08:00'],
  ] as const) await chooseTime(page, id, value);

  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByLabel('일반담배(궐련) 흡연 상태는 어떤가요?', { exact: true }).selectOption('never_smoked');
  await page.getByLabel('최근 1년 동안 술을 얼마나 자주 마셨나요?', { exact: true }).selectOption('lt_monthly');
  await page.getByLabel('술을 마실 때, 보통 한 번에 몇 잔 마시나요?', { exact: true }).selectOption('1_2_drinks');
  await page.getByRole('button', { name: '입력 확인하기', exact: true }).click();
  await page.getByLabel('입력과 결과가 저장되지 않는다는 안내를 확인했어요.').check();
  await page.getByRole('button', { name: '생활정보 분석하기', exact: true }).click();
  await expect(page.locator('[data-model-v2-user-result="processed"]')).toBeVisible();
}

for (const [width, height] of [[1366, 768], [1440, 900], [390, 844], [320, 568]]) test(`North Star Home keeps its hierarchy and primary action reachable at ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const state = await setup(page);
  await page.goto('/?e2e=signed-in&screen=S02');
  const home = page.locator('.journey-today');
  await expect(home).toBeVisible();
  await expect(home.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('#S02-title')).toBeFocused();
  if (width === 320 && height === 568) {
    await expect(home.locator('.journey-view-frame')).toBeHidden();
  } else {
    await home.locator('[data-poster-asset] img').evaluate((img: HTMLImageElement) => img.decode());
  }
  const hierarchy = await home.evaluate(element => {
    const hero = element.querySelector('.today-hero')!;
    const journey = element.querySelector('.living-week')!;
    const records = element.querySelector('.today-records')!;
    return {
      ordered: Boolean(hero.compareDocumentPosition(journey) & Node.DOCUMENT_POSITION_FOLLOWING)
        && Boolean(journey.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING),
      heroBottom: hero.getBoundingClientRect().bottom,
      journeyTop: journey.getBoundingClientRect().top,
      journeyBottom: journey.getBoundingClientRect().bottom,
      recordsTop: records.getBoundingClientRect().top,
    };
  });
  expect(hierarchy.ordered).toBe(true);
  expect(hierarchy.heroBottom).toBeLessThanOrEqual(hierarchy.journeyTop);
  expect(hierarchy.journeyBottom).toBeLessThanOrEqual(hierarchy.recordsTop);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const leadCopy = home.locator('.home-lead-copy');
  await expect(leadCopy).toBeVisible();
  await expect(leadCopy.locator('.home-lead-kicker')).toHaveText('오늘 먼저');
  await expect(leadCopy.getByRole('heading', { level: 2 })).toContainText('오늘 혈압 기록');
  await expect(leadCopy.locator('#home-lead-support')).toBeVisible();
  await expect(home.getByRole('heading', { level: 2, name: '최근 7일 기록', exact: true })).toBeVisible();
  const primary = home.locator('.home-lead button');
  await expect(primary).toBeInViewport({ ratio: 1 });
  expect(await primary.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.width >= 44 && bounds.height >= 44
      && element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
  })).toBe(true);
  if (width <= 580) {
    const primaryBox = (await primary.boundingBox())!;
    const navBox = (await page.locator('.primary-nav').boundingBox())!;
    expect(primaryBox.y + primaryBox.height).toBeLessThanOrEqual(navBox.y);
    await home.locator('.today-calendar-toggle').click();
    await expect(home.locator('.today-calendar')).toHaveAttribute('data-open', 'true');
    const secondaryTouchTargets = home.locator(
      '.today-trail-disclosure summary, .today-return, .living-week-guide summary',
    );
    await expect(secondaryTouchTargets).toHaveCount(3);
    for (let index = 0; index < await secondaryTouchTargets.count(); index += 1) {
      const target = secondaryTouchTargets.nth(index);
      await target.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const box = await target.boundingBox();
      const currentNavBox = (await page.locator('.primary-nav').boundingBox())!;
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(currentNavBox.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width <= 350) {
      const touchTargets = home.locator(
        '.home-trail-date, .living-week-heading a, .today-calendar-toggle',
      );
      await expect(touchTargets).toHaveCount(9);
      for (let index = 0; index < await touchTargets.count(); index += 1) {
        const box = await touchTargets.nth(index).boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      const trailDatesBox = (await home.locator('.home-trail-dates').boundingBox())!;
      expect(trailDatesBox.y + trailDatesBox.height).toBeLessThanOrEqual(navBox.y);
    }
  }
  await expect(home.locator('[data-home-concept]')).toHaveCount(3);
  await expect(home.locator('canvas')).toHaveCount(0);
  await primary.press('Enter');
  await expect(page.locator('#S04-title')).toBeFocused();
  expect(state.posts()).toBe(0);
  expect(errors).toEqual([]);
});

const s11ContinuationCases = [
  { name: 'A: no BP, no challenge', bp: false, challenge: 'none', key: 'record-blood-pressure', action: '혈압 기록 남기기', destination: 'S04' },
  { name: 'B: no BP, pending challenge', bp: false, challenge: 'pending', key: 'record-blood-pressure', action: '혈압 기록 남기기', destination: 'S04' },
  { name: 'C: BP, pending challenge', bp: true, challenge: 'pending', key: 'record-challenge', action: '오늘 상태 확인·기록하기', destination: 'S07' },
  { name: 'D: BP, completed challenge check-in', bp: true, challenge: 'completed', key: 'review-today', action: '오늘 기록 확인하기', destination: 'S07' },
  { name: 'E: BP, skipped challenge check-in', bp: true, challenge: 'skipped', key: 'review-today', action: '오늘 기록 확인하기', destination: 'S07' },
  { name: 'F: BP, no challenge', bp: true, challenge: 'none', key: 'review-today', action: '오늘 기록 확인하기', destination: 'S07' },
  { name: 'G: BP, ended challenge', bp: true, challenge: 'ended', key: 'review-today', action: '오늘 기록 확인하기', destination: 'S07' },
] as const;

async function setupS11Continuation(page: Page, state: typeof s11ContinuationCases[number]) {
  const requests = await setup(page);
  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.route('http://e2e.invalid/api/v1/observations/window**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    return route.fulfill({
      status: 200, headers, contentType: 'application/json',
      body: JSON.stringify({
        start_on: '2026-09-11', end_on: '2026-09-17',
        blood_pressure_observations: state.bp ? [{
          id: 'synthetic-s11-morning', observed_on: '2026-09-17', period: 'morning', systolic: 120, diastolic: 80,
        }] : [],
        active_challenge: state.challenge === 'none' ? null : {
          id: 'synthetic-s11-challenge', action_id: 'walk-10-minutes',
          starts_on: state.challenge === 'ended' ? '2026-09-10' : '2026-09-11',
          ends_on: state.challenge === 'ended' ? '2026-09-16' : '2026-09-17',
          first_checkin_on: ['completed', 'skipped'].includes(state.challenge) ? '2026-09-17' : null,
          status: 'active',
        },
        challenge_checkins: state.challenge === 'completed' || state.challenge === 'skipped' ? [{
          id: 'synthetic-s11-checkin', challenge_id: 'synthetic-s11-challenge', observed_on: '2026-09-17',
          action_id: 'walk-10-minutes', status: state.challenge,
        }] : [],
        challenge_events: [],
      }),
    });
  });
  return requests;
}

for (const state of s11ContinuationCases) test(`S11 continuation ${state.name}`, async ({ page }) => {
  const requests = await setupS11Continuation(page, state);
  await page.goto('/?e2e=signed-in&screen=S11');
  await completeS11LifestyleSurvey(page);

  const result = page.locator('[data-model-v2-user-result="processed"]');
  await expect(page.locator('#model-v2-result-title')).toBeFocused();
  await expect(result.locator('[data-model-v2-preview-value]')).toHaveText('0.055');
  await expect(result.locator('.model-v2-outcome-kicker')).toHaveText('오늘의 시작점 · 이번 이용에만');
  await expect(result.getByRole('heading', { name: '다음 한 걸음', exact: true })).toBeVisible();
  const continuation = result.locator('[data-model-v2-continuation]');
  await expect(continuation).toHaveAttribute('data-model-v2-continuation', state.key);
  await expect(continuation.getByRole('button')).toHaveCount(1);
  await expect(result).toContainText('다음 행동은 분석값이 아니라, 현재 앱에 남아 있는 오늘 기록 상태만 보고 정해요.');
  await expect(result.locator('[data-model-v2-continuity="blood-pressure"]')).toContainText(state.bp ? '오늘 아침 기록 있음' : '오늘 혈압 기록 전');
  const challenge = result.locator('[data-model-v2-continuity="challenge"]');
  await expect(challenge).toContainText(state.challenge === 'none' ? '진행 중인 7일 챌린지가 없어요.'
    : state.challenge === 'ended' ? '기간이 끝났어요.'
      : state.challenge === 'completed' ? '오늘 상태 기록함'
        : state.challenge === 'skipped' ? '오늘 상태 건너뜀' : '오늘 상태는 아직 기록하지 않았어요.');
  await expect(result.getByRole('button', { name: '오늘의 기록으로 돌아가기', exact: true })).toHaveCount(1);
  await expect(result.getByRole('button', { name: /^(기록함|건너뜀)$/ })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(continuation.getByRole('button', { name: state.action, exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator(`#${state.destination}-title`)).toBeFocused();
  await expect(result).toHaveCount(0);
  if (state.destination === 'S07') {
    await expect(page.locator('.journey-today-bp-records')).toContainText('120/80 mmHg');
    for (const action of ['기록함', '건너뜀']) {
      const control = page.getByRole('button', { name: action, exact: true });
      if (state.challenge === 'pending') await expect(control).toBeEnabled();
      else await expect(control).toHaveCount(0);
    }
  }
  expect(requests.posts()).toBe(0);
});

test('S11 post-survey journey closes through BP save, saved confirmation, today, and a fresh S11', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page);

  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.goto('/?e2e=signed-in&screen=S11');
  await completeS11LifestyleSurvey(page);

  const result = page.locator('[data-model-v2-user-result="processed"]');
  await expect(result.locator('[data-model-v2-preview-value]')).toBeVisible();
  await expect(result.locator('[data-model-v2-preview-value]')).toHaveText('0.055');
  await expect(result).toBeVisible();
  await expect(result.locator('.model-v2-outcome-kicker')).toHaveText('오늘의 시작점 · 이번 이용에만');

  await page.getByRole('button', { name: '혈압 기록 남기기', exact: true }).click();
  await expect(page.locator('#S04-title')).toBeFocused();
  await expect(result).toHaveCount(0);

  await save(page);
  await expect(page.locator('#S05-title')).toBeFocused();
  await expect(page.getByRole('button', { name: '오늘의 기록 보기', exact: true })).toBeVisible();
  expect(state.posts()).toBe(1);

  await page.getByRole('button', { name: '오늘의 기록 보기', exact: true }).click();
  await expect(page.locator('[data-scene="S02"]')).toBeVisible();

  const startingPoint = page.locator('.today-starting-point-entry');
  await expect(startingPoint).toBeVisible();
  await startingPoint.click();

  await expect(page.locator('[data-scene="S11"]')).toBeVisible();
  await expect(page.locator('[data-model-v2-user-result="processed"]')).toHaveCount(0);
  await expect(page.locator('[data-model-v2-feature]')).toHaveCount(0);

  await page.getByRole('button', { name: '입력 시작하기', exact: true }).click();
  await expect(page.locator('#model-age')).toHaveValue('');
  await expect(page.locator('#model-height')).toHaveValue('');
  await expect(page.locator('#model-weight')).toHaveValue('');
});

for (const screen of ['S02', 'S12', 'S05', 'S06']) {
  test(`empty routing truthfulness for ${screen} across ready, refreshing and refresh-error`, async ({ page }) => {
    await setupS11Continuation(page, s11ContinuationCases[0]);
    await page.goto(`/?e2e=signed-in&screen=${screen}`);
    await expect(page.locator('[data-scene="S12"]')).toBeVisible();
    await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
    await expect(page.locator('#S10-title')).toBeVisible();
    const held = deferred();
    let refreshing = false;
    await page.route('http://e2e.invalid/api/v1/observations/window**', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      refreshing = true;
      await held.promise;
      return route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ detail: { code: 'temporarily_unavailable' } }) });
    });
    try {
      await page.getByRole('button', { name: '새로고침', exact: true }).click();
      await expect.poll(() => refreshing).toBe(true);
      // Restore the original requested route without reloading the retained window.
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`screen=${screen}`));
      for (const freshness of ['refreshing', 'refresh-error']) {
        if (freshness === 'refresh-error') {
          held.release();
          await expect(page.getByText('최신 여부 미확인', { exact: true })).toBeVisible();
        }
        await expect(page.locator('[data-scene="S02"]')).toBeVisible();
        await expect(page.locator('[data-scene="S12"], [data-scene="S05"], [data-scene="S06"]')).toHaveCount(0);
      }
    } finally {
      held.release();
    }
  });
}

test('empty routing truthfulness preserves confirmed prior-window empty copy', async ({ page }) => {
  await setupS11Continuation(page, s11ContinuationCases[0]);
  await page.goto('/?e2e=signed-in&screen=S12&dashboard_window=prior');
  const empty = page.locator('[data-scene="S12"]');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('이전 7일 · 읽기 전용');
  await expect(empty).toContainText('이 기간에는 기록이 없어요.');
});

for (const retainedEmpty of [false, true]) test(`S11 continuation H: retained ${retainedEmpty ? 'empty' : 'BP/challenge'} refreshing and refresh-error facts return to Today without duplicate actions`, async ({ page }) => {
  await setupS11Continuation(page, s11ContinuationCases[retainedEmpty ? 0 : 2]);
  await page.goto('/?e2e=signed-in&screen=S10');
  await expect(page.locator('#S10-title')).toBeVisible();
  const held = deferred();
  let refreshing = false;
  await page.route('http://e2e.invalid/api/v1/observations/window**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    refreshing = true;
    await held.promise;
    return route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ detail: { code: 'temporarily_unavailable' } }) });
  });
  try {
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect.poll(() => refreshing).toBe(true);
    await page.getByRole('button', { name: 'AI 분석', exact: true }).click();
    await completeS11LifestyleSurvey(page);
    const result = page.locator('[data-model-v2-user-result="processed"]');
    const next = result.locator('.model-v2-result-next');
    for (const freshness of ['refreshing', 'refresh-error']) {
      if (freshness === 'refresh-error') {
        held.release();
        await expect(page.getByText('최신 여부 미확인', { exact: true })).toHaveCount(0);
      }
      await expect(result.locator('[data-model-v2-preview-value]')).toHaveText('0.055');
      await expect(result.locator('[data-model-v2-continuation]')).toHaveAttribute('data-model-v2-continuation', 'confirm-today');
      await expect(next.getByRole('heading', { name: '오늘 기록 상태를 먼저 확인해요', exact: true })).toBeVisible();
      await expect(next.getByRole('button')).toHaveCount(1);
      await expect(next.getByRole('button')).toHaveText('오늘 화면에서 확인하기');
      const context = result.locator('.model-v2-next-context');
      await expect(context.locator('[data-model-v2-continuity="blood-pressure"] strong')).toHaveText('오늘 혈압 상태 · 최신 여부 미확인');
      await expect(context.locator('[data-model-v2-continuity="challenge"] strong')).toHaveText('오늘 챌린지 상태 · 최신 여부 미확인');
      await expect(context).not.toContainText(/오늘 아침 기록 있음|오늘 혈압 기록 전|오늘 상태는 아직 기록하지 않았어요|진행 중인 7일 챌린지가 없어요/);
    }
    await next.getByRole('button').click();
    await expect(page.locator('#S02-title')).toBeFocused();
    await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
    await expect(result).toHaveCount(0);
  } finally {
    held.release();
  }
});

test('S11 continuation treats a prior-window view as unconfirmed current facts', async ({ page }) => {
  await setup(page);
  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.goto('/?e2e=signed-in&screen=S11&dashboard_window=prior');
  await completeS11LifestyleSurvey(page);
  const result = page.locator('[data-model-v2-user-result="processed"]');
  await expect(result.locator('[data-model-v2-continuation]')).toHaveAttribute('data-model-v2-continuation', 'confirm-today');
  await expect(result.locator('[data-model-v2-continuity="blood-pressure"]')).toContainText('오늘 혈압 상태 · 최신 여부 미확인');
  await expect(result.locator('[data-model-v2-continuity="challenge"]')).toContainText('오늘 챌린지 상태 · 최신 여부 미확인');
  await expect(result.getByRole('button')).toHaveCount(1);
  await result.getByRole('button', { name: '오늘 화면에서 확인하기', exact: true }).click();
  await expect(page.locator('#S02-title')).toBeFocused();
  await expect(page).not.toHaveURL(/dashboard_window=/);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`S11 continuation hierarchy and reachability at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupS11Continuation(page, s11ContinuationCases[2]);
    await page.goto('/?e2e=signed-in&screen=S11');
    await completeS11LifestyleSurvey(page);
    const result = page.locator('[data-model-v2-user-result="processed"]');
    await expect(result.locator('[data-model-v2-preview-value]')).toBeInViewport();
    await expect(result.locator('.model-v2-local-privacy')).toBeVisible();
    expect(await result.evaluate(element => {
      const ordered = ['.model-v2-outcome-heading', '.model-v2-summary-heading', '.model-v2-result-summary', '.model-v2-continuation', '.model-v2-next-context', '.model-v2-result-model-note'];
      return ordered.slice(1).every((selector, index) => Boolean(element.querySelector(ordered[index])!.compareDocumentPosition(element.querySelector(selector)!) & Node.DOCUMENT_POSITION_FOLLOWING));
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`s11-result-${viewport.width}.png`), fullPage: true });
    await page.keyboard.press('Tab');
    const primary = result.locator('[data-model-v2-continuation] button');
    await expect(primary).toBeFocused();
    await expect(primary).toBeInViewport({ ratio: 1 });
    expect(await primary.evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.width >= 44 && box.height >= 44
        && element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    if (viewport.width === 390) {
      const buttonBox = (await primary.boundingBox())!;
      const navBox = (await page.locator('.primary-nav').boundingBox())!;
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(navBox.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`s11-continuation-${viewport.width}.png`) });
  });
}

test('heejoo feedback closeout keeps S02 mobile compact and the starting-point tool reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await page.goto('/?e2e=signed-in&screen=S02');

  const home = page.locator('.journey-today');
  await expect(home).toBeVisible();

  const frame = home.locator('.journey-view-frame');
  const view = home.locator('.journey-view');
  await expect(frame).toBeVisible();

  const frameBox = await frame.boundingBox();
  const viewBox = await view.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(viewBox).not.toBeNull();
  expect(Math.round(frameBox!.height)).toBe(168);
  expect(frameBox!.width).toBeLessThan(viewBox!.width);

  const startingPoint = home.locator('.today-starting-point-entry');
  await expect(startingPoint).toBeVisible();
  await expect(startingPoint).toHaveAttribute('aria-describedby', 'today-starting-point-help');

  await startingPoint.click();
  await expect(page).toHaveURL(/screen=S11/);
  await expect(page.locator('[data-scene="S11"]')).toBeVisible();
});

test('North Star Home recognizes recent history when a returning user has not recorded today', async ({ page }) => {
  await setup(page);
  await page.route('http://e2e.invalid/api/v1/observations/window**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());
    return route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        start_on: url.searchParams.get('start_on'),
        end_on: url.searchParams.get('end_on'),
        blood_pressure_observations: [{
          id: 'synthetic-returning-bp',
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

  await page.goto('/?e2e=signed-in&screen=S02');

  const home = page.locator('.journey-today');
  await expect(home).toBeVisible();
  await expect(home.locator('.journey-facts')).toHaveText('혈압 관찰0건챌린지 참여기록 없음');
  await expect(home.locator('.home-lead')).toContainText('오늘 혈압 기록');
  await expect(home.locator('#home-lead-support')).toHaveText(
    '최근 7일 혈압 기록 1건',
  );
  await expect(home.locator('.home-lead button')).toHaveAccessibleName('혈압 기록하기');
  const weeklySummary = home.locator('.living-trace-summary');
  await expect(weeklySummary).toBeVisible();
  await expect(weeklySummary).toContainText('혈압 관찰이 있는 날');
  await expect(weeklySummary).toContainText('1일');
  await expect(weeklySummary).toContainText('혈압 관찰');
  await expect(weeklySummary).toContainText('1건');
  await expect(home.locator('.today-week-card')).toHaveCount(0);
  await expect(home.locator('.today-observation-chart')).toHaveCount(0);
  await expect(home.locator('.today-word-card')).toHaveCount(0);
  await expect(home.locator('.today-companion-greeting')).toBeVisible();

  const todayState = home.locator('[data-home-concept="today-detail"]');
  await expect(todayState).toContainText('오늘 상태');
  await expect(todayState).toContainText('혈압 기록 없음 · 챌린지 상태');
  await expect(todayState).toHaveAttribute('data-home-destination', 'S07');

  await todayState.press('Enter');

  const todayReview = page.locator('[data-scene="S07"]');
  await expect(todayReview).toBeVisible();
  await expect(todayReview.locator('.scene-body')).toHaveCount(0);
  await expect(todayReview.locator('.today-date')).toContainText(
    '혈압·챌린지·이전 기록을 따로 확인해요.',
  );
  await expect(todayReview.locator('.fact-lead')).toContainText('오늘 기록 없음');
});

for (const [todayCheckinStatus, expectedTitle, expectedSupport] of [
  [null, '오늘 챌린지 상태', '10분 걷기 · 오늘 상태는 아직 기록하지 않았어요.'],
  ['completed', '오늘 챌린지 확인', '10분 걷기 · 오늘 상태 기록함'],
] as const) {
  test(`North Star Home shows returning challenge state as ${todayCheckinStatus ?? 'pending'}`, async ({ page }) => {
    await setup(page);
    await page.route('http://e2e.invalid/api/v1/observations/window**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const url = new URL(request.url());

      return route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          start_on: url.searchParams.get('start_on'),
          end_on: url.searchParams.get('end_on'),
          blood_pressure_observations: [{
            id: 'synthetic-returning-yesterday-bp',
            observed_on: '2026-09-10',
            period: 'morning',
            systolic: 120,
            diastolic: 80,
          }],
          active_challenge: {
            id: 'synthetic-returning-challenge',
            action_id: 'walk-10-minutes',
            starts_on: '2026-09-05',
            ends_on: '2026-09-11',
            first_checkin_on: '2026-09-05',
            status: 'active',
          },
          challenge_checkins: todayCheckinStatus ? [{
            id: 'synthetic-returning-checkin',
            challenge_id: 'synthetic-returning-challenge',
            observed_on: '2026-09-11',
            action_id: 'walk-10-minutes',
            status: todayCheckinStatus,
          }] : [],
          challenge_events: [],
        }),
      });
    });

    await page.goto('/?e2e=signed-in&screen=S02');

    const home = page.locator('.journey-today');
    await expect(home.locator('.home-lead')).toContainText('오늘 혈압 기록');

    const challenge = home.locator('[data-home-concept="challenge"]');
    await expect(challenge.locator('strong')).toHaveText(expectedTitle);
    await expect(challenge).toContainText(expectedSupport);
    await expect(challenge).toHaveAttribute('data-home-destination', 'S06');
  });
}

test('North Star Home stops offering another BP slot when both daily periods are already recorded', async ({ page }) => {
  await setup(page);
  await page.route('http://e2e.invalid/api/v1/observations/window**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());

    return route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        start_on: url.searchParams.get('start_on'),
        end_on: url.searchParams.get('end_on'),
        blood_pressure_observations: [
          {
            id: 'synthetic-today-morning',
            observed_on: '2026-09-11',
            period: 'morning',
            systolic: 120,
            diastolic: 80,
          },
          {
            id: 'synthetic-today-evening',
            observed_on: '2026-09-11',
            period: 'evening',
            systolic: 122,
            diastolic: 81,
          },
        ],
        challenge_checkins: [],
        active_challenge: null,
        challenge_events: [],
      }),
    });
  });

  await page.goto('/?e2e=signed-in&screen=S02');

  const home = page.locator('.journey-today');
  await expect(home).toBeVisible();
  await expect(home.locator('.home-lead')).toContainText('오늘 혈압 기록 확인');
  await expect(home.locator('#home-lead-support')).toHaveText(
    '아침·저녁 기록 있음',
  );

  await expect(home.locator('[data-home-concept="blood-pressure"]')).toHaveCount(0);

  await home.locator('.home-lead button').press('Enter');
  await expect(page.locator('#S07-title')).toBeFocused();

  const todayBloodPressure = page.locator('.journey-today-bp-records');
  await expect(todayBloodPressure).toBeVisible();
  await expect(todayBloodPressure.locator('[data-today-bp-period="morning"]')).toContainText(
    '아침',
  );
  await expect(todayBloodPressure.locator('[data-today-bp-period="morning"]')).toContainText(
    '120/80 mmHg',
  );
  await expect(todayBloodPressure.locator('[data-today-bp-period="evening"]')).toContainText(
    '저녁',
  );
  await expect(todayBloodPressure.locator('[data-today-bp-period="evening"]')).toContainText(
    '122/81 mmHg',
  );

  await page.goBack();
  await expect(home).toBeVisible();

  const recordsAction = home.locator('[data-home-concept="records"]');
  await expect(recordsAction).toContainText('기록 찾아보기');
  await expect(recordsAction).toContainText(
    '아침·저녁 기록 있음 · 지난 기록은 날짜별',
  );
  await expect(recordsAction).toHaveAttribute('data-home-destination', 'S08');

  await recordsAction.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: '기록 찾아보기' })).toBeVisible();
});

test('North Star Home previews a past date visibly on mobile while today facts and recent-window scope stay separate', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await setup(page);
  await page.goto('/?fixture=VP-07a&screen=S02');
  const home = page.locator('.journey-today');
  const facts = home.locator('.journey-facts');
  await expect(facts).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
  await expect(home.locator('.home-lead')).toContainText('오늘 혈압 기록 확인');
  await expect(home.locator('.home-lead-kicker')).toHaveText('오늘 기록');
  await expect(home.locator('#home-lead-support')).toHaveText(
    '아침 기록 있음',
  );
  await expect(home.locator('[data-home-concept="blood-pressure"]')).toContainText('혈압 추가 기록');
  await expect(home.locator('[data-home-concept="blood-pressure"]')).toContainText(
    '아침 기록 있음 · 저녁은 필요할 때 추가',
  );
  const recentWindow = home.locator('[data-window-kind="recent-history"]');
  await expect(recentWindow).toContainText('오늘 포함 · 날짜별 혈압 기록');
  await expect(home.getByRole('meter', { name: '챌린지 기간의 오늘 위치' })).toHaveCount(0);
  await expect(home.locator('.today-cycle-progress')).toHaveCount(0);
  const boundaryRequests = () => state.urls.filter(url => /e2e\.invalid|ThreeSceneRenderer|SavedSceneRenderer|CompanionReviewRenderer|\.glb(?:\?|$)/.test(url));
  const beforeSelection = [...boundaryRequests()];
  await home.locator('[data-trail-date="2026-09-01"] > button').press('Space');
  await expect(home.locator('#today-trail-detail')).toHaveAttribute('data-selected-date', '2026-09-01');
  await expect(home.locator('#today-trail-detail dl')).toHaveText('혈압 관찰0건챌린지 참여기록함');
  const figure = home.locator('.journey-view');
  await expect(figure).toHaveAttribute('data-previewing', 'true');
  await expect(figure.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', '2026-09-01');
  const previewLabel = figure.locator('.journey-view-label');
  await previewLabel.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await expect(previewLabel).toContainText('그날의 풍경');
  await expect(previewLabel.locator('time')).toHaveAttribute('datetime', '2026-09-01');
  const labelBox = (await previewLabel.boundingBox())!;
  expect(labelBox.width).toBeGreaterThan(100);
  expect(labelBox.height).toBeGreaterThan(12);
  await expect(previewLabel).toBeInViewport({ ratio: 1 });
  await expect(facts).toHaveText('혈압 관찰1건챌린지 참여기록 없음');
  await expect(recentWindow).toContainText('오늘 포함 · 날짜별 혈압 기록');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(boundaryRequests()).toEqual(beforeSelection);
  await home.getByRole('button', { name: '오늘로 돌아오기', exact: true }).press('Enter');
  await expect(figure).toHaveAttribute('data-previewing', 'false');
  await expect(figure.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', '2026-09-03');
});

test('North Star Home identifies a directly opened prior window without claiming it includes today', async ({ page }) => {
  await setup(page);
  await page.route('http://e2e.invalid/api/v1/observations/window**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({
      start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'),
      blood_pressure_observations: [{ id: 'synthetic-prior-home-bp', observed_on: '2026-09-04', period: 'morning', systolic: 120, diastolic: 80 }],
      challenge_events: [], active_challenge: null, challenge_checkins: [],
    }) });
  });
  await page.goto('/?e2e=signed-in&screen=S02&dashboard_window=prior');
  const home = page.locator('.journey-today');
  await expect(home).toBeVisible();
  await expect(page.locator('[data-read-only-window]')).toContainText('이전 7일');
  await expect(home.locator('[data-trail-date]')).toHaveCount(7);
  await expect(home.locator('[data-trail-date]').first()).toHaveAttribute('data-trail-date', '2026-08-29');
  await expect(home.locator('[data-trail-date]').last()).toHaveAttribute('data-trail-date', '2026-09-04');
  await expect(home.locator('.living-week-heading')).toContainText('선택한 기간 · 날짜별 혈압 기록');
  await expect(home.locator('.living-week-heading')).not.toContainText('오늘을 포함한');
  await expect(home.locator('.journey-facts')).toHaveText('혈압 관찰미확인챌린지 참여미확인');
});

for (const width of [320, 390, 1366]) test(`static posters, keyboard and confirmed S05 at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  const state = await setup(page);
  await page.goto('/?e2e=signed-in&screen=S02&scene=review&VITE_SK7_UI_MODE=legacy&companion_species=cat');
  await expect(page.locator('.journey-today')).toBeVisible();
  const poster = page.locator('[data-poster-asset]');
  await expect(poster).toHaveAttribute('data-poster-asset', new RegExp(width === 320 ? 'mobile320$' : width === 390 ? 'mobile390$' : 'desktop$'));
  if (width === 320) {
    await expect(page.locator('.journey-view-frame')).toBeHidden();
  } else {
    await poster.locator('img').evaluate((img: HTMLImageElement) => img.decode());
  }
  const recipe = await page.locator('[data-scene-recipe]').getAttribute('data-scene-recipe');
  await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
  await expect(page.locator('[data-static-landscape="S10"]')).toBeVisible();
  await page.getByRole('button', { name: '이전 7일 보기', exact: true }).press('Enter');
  await expect(page.locator('[data-scene-date]')).toHaveAttribute('data-scene-date', '2026-09-11');
  if (companionOff) {
    expect(await probe(page)).toEqual({ attempts: 0, frames: 0, canvases: 0 });
    expect(state.urls.filter(url => /\.glb(?:\?|$)|ThreeSceneRenderer|SavedSceneRenderer|CompanionReviewRenderer/.test(url))).toEqual([]);
  } else {
    const replay = page.locator('[data-companion-status]');
    await expect(replay).toHaveAttribute('data-companion-status', 'ready', { timeout: 30000 });
    await expect(replay).toHaveAttribute('data-companion-animation-clip', 'idle');
    await expect(page.locator('[data-living-scene], [data-saved-scene-status]')).toHaveCount(0);
    expect(state.urls.filter(url => /ThreeSceneRenderer|SavedSceneRenderer/.test(url))).toEqual([]);
    const currentProbe = await probe(page);
    expect(currentProbe.attempts).toBe(1);
    expect(currentProbe.canvases).toBe(1);
  }
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
    expect(state.urls.filter(url => /\.glb(?:\?|$)/.test(url))).toEqual([
      companionAssetManifest.bear.lite.url, // S10 production Living Replay visit
      companionAssetManifest.bear.lite.url, // S05 confirmed-save companion visit
    ]);
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
    // The relaxed S05 framing intentionally trades a little fill for reliable
    // celebrate head/hand clearance in real desktop rendering.
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) expect(bounds[edge], `${bounds.phase} ${edge}`).toBeGreaterThanOrEqual(8);
    expect(bounds.paintedHeight).toBeGreaterThanOrEqual(Math.floor(bounds.height * .74));
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
    await expect(runtime.locator('[data-companion-canvas]')).toHaveCSS('visibility', 'visible');
    await expect(page.locator('.journey-saved .save-ripple')).toHaveCSS('overflow', 'visible');
    await expect(page.locator('.journey-saved .save-ripple-landscape')).toHaveCSS('overflow', 'hidden');
    if (motion === 'reduce') {
      const bounds = await page.evaluate(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.sample());
      expect(bounds.phase).toBe('idle');
      margins(bounds); reports.push({ motion, bounds });
    } else {
      await page.waitForFunction(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.report().paused, undefined, { timeout: 20000 });
      const report = await page.evaluate(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.report());
      expect(report.samples[0]?.phase).toBe('celebrate');
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

test('journey S05 Android profile keeps the canvas outside the rounded landscape clip', async ({ browser }) => {
  test.skip(companionOff, 'No canvas when the independent companion gate is off');
  const context = await browser.newContext({
    viewport: { width: 384, height: 718 },
    deviceScaleFactor: 2.8125,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await setup(page);
    await page.addInitScript(installCompanionFramingProbe);
    type Bounds = { phase: string; width: number; height: number; left: number; right: number; top: number; bottom: number; paintedHeight: number; cssClippedPixels: number };
    type Probe = { report: () => { samples: Bounds[]; counts: Record<string, number>; paused: boolean }; pauseAfter: (phase: string, frames: number) => void };
    await page.goto('/?e2e=signed-in&screen=S04');
    await page.evaluate(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.pauseAfter('idle', 61));
    await save(page);
    const runtime = page.locator('[data-companion-status]');
    await expect(runtime).toHaveAttribute('data-companion-status', 'ready', { timeout: 30000 });
    await page.waitForFunction(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.report().paused, undefined, { timeout: 20000 });
    const report = await page.evaluate(() => (window as unknown as { __companionFramingProbe: Probe }).__companionFramingProbe.report());
    expect(report.counts.celebrate).toBeGreaterThanOrEqual(235);
    expect(report.counts.idle).toBe(61);
    for (const bounds of report.samples) {
      for (const edge of ['left', 'right', 'top', 'bottom'] as const) expect(bounds[edge], `${bounds.phase} ${edge}`).toBeGreaterThanOrEqual(5);
      // Match #593's relaxed fill contract without changing clipping or geometry guards.
      expect(bounds.paintedHeight).toBeGreaterThanOrEqual(Math.floor(bounds.height * .74));
      expect(bounds.cssClippedPixels).toBe(0);
    }
    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('[data-companion-canvas]') as HTMLCanvasElement;
      const ripple = document.querySelector('.journey-saved .save-ripple') as HTMLElement;
      const landscape = document.querySelector('.journey-saved .save-ripple-landscape') as HTMLElement;
      const canvasBox = canvas.getBoundingClientRect(), rippleBox = ripple.getBoundingClientRect();
      return {
        devicePixelRatio,
        drawingBuffer: { width: canvas.width, height: canvas.height },
        canvas: { left: canvasBox.left, right: canvasBox.right, top: canvasBox.top, bottom: canvasBox.bottom },
        ripple: { left: rippleBox.left, right: rippleBox.right, top: rippleBox.top, bottom: rippleBox.bottom },
        rippleOverflow: getComputedStyle(ripple).overflow,
        landscapeOverflow: getComputedStyle(landscape).overflow,
      };
    });
    expect(geometry.devicePixelRatio).toBe(2.8125);
    expect(geometry.drawingBuffer).toEqual({ width: 480, height: 336 });
    expect(geometry.rippleOverflow).toBe('visible');
    expect(geometry.landscapeOverflow).toBe('hidden');
    expect(geometry.canvas.left).toBeGreaterThan(geometry.ripple.left);
    expect(geometry.canvas.right).toBeLessThan(geometry.ripple.right);
    expect(geometry.canvas.top).toBeGreaterThan(geometry.ripple.top);
    expect(geometry.canvas.bottom).toBeLessThan(geometry.ripple.bottom);
  } finally {
    await context.close();
  }
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
  if (!companionOff) {
    const failedRuntime = page.locator('[data-companion-status]');
    await expect(failedRuntime).toHaveAttribute('data-companion-status', 'error', { timeout: 30000 });
    await expect(failedRuntime.locator('[data-companion-canvas]')).toHaveCSS('visibility', 'hidden');
  }
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
  await expect(page.getByRole('heading', { name: '측정한 혈압을 기록하고, 최근 7일을 확인해요.' })).toBeVisible();
  await expect(page.locator('.journey-login-intro')).toContainText('혈압을 날짜·시간대별로 남기고, 최근 7일의 기록을 한곳에서 다시 확인해요.');
  await expect(page.locator('.journey-login-intro')).toContainText('한 건부터 바로 시작할 수 있어요.');
  await expect(page.locator('.journey-login-demo')).toContainText('30일 동안 보관돼요.');
  await expect(page.locator('.journey-login-demo')).toContainText('보관·삭제 안내는 설정과 도움말에서 확인할 수 있어요.');
  await expect(page.getByText('합성 데이터 체험용입니다.', { exact: false })).toHaveCount(0);
  const email = page.getByRole('textbox', { name: '이메일', exact: true });
  await expect(email).toHaveAccessibleDescription(/이메일로 받은 링크를 열면 로그인할 수 있어요\. 같은 브라우저에서는 로그인 상태가 유지되면 다시 로그인하지 않고 기록을 이어갈 수 있어요\./);
  await expect(page.getByText('같은 브라우저에서는 로그인 상태가 유지되면 다시 로그인하지 않고 기록을 이어갈 수 있어요.')).toBeVisible();
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
  await expect(page.locator('[data-journey-skeleton-family="today"]')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '선택한 7일의 기록을 불러오는 중이에요.' })).toBeVisible();
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0); held.release();
  await expect(page.getByRole('heading', { name: prior ? '이 기간에는 기록이 없어요.' : '측정한 혈압부터 기록해요', exact: true })).toBeFocused();
  await expect(page.locator('.journey-empty-period time').first()).toHaveAttribute('datetime', prior ? '2026-08-29' : '2026-09-05');
  await expect(page.locator('.journey-empty-period time').last()).toHaveAttribute('datetime', prior ? '2026-09-04' : '2026-09-11');
  if (prior) {
    await expect(page.getByText('이전 7일 · 읽기 전용', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '혈압 기록하기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '7일 챌린지 시작하기', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-read-only-window]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '현재 7일 보기', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: '생활정보 정리하기', exact: true })).toHaveCount(0);
    expect(windows).toEqual(['2026-08-29']);
    await page.getByRole('button', { name: '현재 7일 보기', exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: '측정한 혈압부터 기록해요', exact: true })).toBeVisible();
    expect(windows).toEqual(['2026-08-29', '2026-09-05']); await expect(page).not.toHaveURL(/dashboard_window/);
  }
  if (!prior) {
    const signal = page.locator('.journey-empty-signal');
    await expect(signal).toContainText('생활정보를 먼저 정리할 수도 있어요');
    await expect(signal).toContainText('활동·수면·생활습관을 이번 이용에만 정리해요.');

    await page.getByRole('button', { name: '생활정보 정리하기', exact: true }).click();
    await expect(page.locator('[data-scene="S11"]')).toBeVisible();

    await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
    await expect(page.locator('[data-scene="S12"]')).toBeVisible();
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

test('Journey record browsing keeps distinct facts, exact detail targets, and read-only meaning', async ({ page }, testInfo) => {
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
  await expect(records.locator('.record-explorer')).toBeVisible();
  await expect(records).toContainText('전체 4개 중 4개 표시');

  const overview = records.getByRole('group', { name: '이 7일 기록 구성' });
  await expect(overview).toContainText('기록이 있는 날 3일');
  await expect(overview).toContainText('총 4개');
  await expect(overview).toContainText('혈압 2개');
  await expect(overview).toContainText('챌린지 1개');
  await expect(overview).toContainText('이전 방식 1개');

  await expect(records.getByRole('button', { name: /상세 보기 · 혈압 관찰.*아침/ })).toContainText('118/76 mmHg');
  await expect(records.locator('[data-record-kind="challenge-checkin"]')).toContainText('기록함');
  await expect(records.locator('[data-record-kind="legacy"]')).toContainText('읽기 전용');
  await page.screenshot({ path: testInfo.outputPath('s08-mobile-360.png'), fullPage: true });
  const eveningDetail = records.getByRole('button', { name: /상세 보기 · 혈압 관찰 · 9월 10일.*저녁/ });
  await expect(eveningDetail).toBeVisible();
  await eveningDetail.click();
  await expect(page).toHaveURL(/record=blood-pressure%3Ajourney-bp-evening/);

  const detailSelection = page.locator('.record-explorer-detail-selection');
  await expect(detailSelection).toContainText('선택한 기록');
  await expect(detailSelection).toContainText('9월 10일');
  await expect(detailSelection).toContainText('저녁');

  await expect(page.locator('.journey-record-detail [data-record-detail-kind="blood-pressure"]')).toContainText('121/79 mmHg');
  await expect(page.getByRole('button', { name: '수정', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toBeVisible();

  await page.goto('/?e2e=signed-in&screen=S09&record=legacy:journey-legacy');
  await expect(page.locator('.record-explorer-detail-selection')).toContainText('선택한 기록 · 9월 8일');
  await expect(page.locator('.record-explorer-detail-selection')).not.toContainText('아침');
  await expect(page.locator('.record-explorer-detail-selection')).not.toContainText('저녁');
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

test('Journey S13 follows the bounded bootstrap retry and keeps manual read recovery', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  let loads = 0; const methods: string[] = [];
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    methods.push(request.method());
    if (!url.pathname.endsWith('/window')) return route.abort();
    loads++;
    return route.fulfill({ status: loads <= 2 ? 503 : 200, headers, contentType: 'application/json', body: JSON.stringify(loads <= 2 ? {} : {
      start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'), blood_pressure_observations: [], challenge_checkins: [], challenge_events: [], active_challenge: null,
    }) });
  });

  await page.goto('/?e2e=signed-in&screen=S02');
  const error = page.locator('.journey-load-error');
  await expect(error).toContainText('기록을 불러오지 못했어요');
  await expect(error).toContainText('아직 기록이 없다는 뜻은 아니에요.');
  await expect(error).toContainText('연결을 확인한 뒤 다시 불러와 주세요.');
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
  expect(loads).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('s13-mobile-360.png'), fullPage: true });
  await page.locator('html').evaluate(el => { el.style.fontSize = '200%'; });
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).focus();
  await expect(page.getByRole('button', { name: '다시 불러오기', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.locator('[data-scene="S12"]')).toBeVisible();
  expect(methods).toEqual(['GET', 'GET', 'GET']);
});

test('S11 and S14 remain available while the observation window is loading, and S02 still shows loading', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  const held = deferred();
  let loads = 0;
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (!new URL(request.url()).pathname.endsWith('/window')) return route.abort();
    loads++;
    await held.promise;
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({
      start_on: '2026-09-05', end_on: '2026-09-11', blood_pressure_observations: [], challenge_checkins: [], challenge_events: [], active_challenge: null,
    }) });
  });

  try {
    await page.goto('/?e2e=signed-in&screen=S14');
    await expect.poll(() => loads).toBe(1);
    await expect(page.locator('.journey-settings')).toBeVisible();
    await expect(page.getByRole('group', { name: '화면 테마' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Cloud/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: '이 기기에서 로그아웃', exact: true })).toBeEnabled();
    await expect(page.locator('[data-scene="S12"], [data-scene="S13"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'AI 분석', exact: true }).click();
    await expect(page.locator('[data-scene="S11"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '입력 시작하기', exact: true })).toBeEnabled();
    await expect(page.locator('[data-scene="S12"], [data-scene="S13"]')).toHaveCount(0);

    await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
    await expect(page.locator('.loading-scene')).toBeVisible();
    await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
  } finally {
    held.release();
  }
});

test('initial observation failure keeps S11 and S14 usable but S02 fails closed', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (!new URL(request.url()).pathname.endsWith('/window')) return route.abort();
    return route.fulfill({ status: 403, headers, contentType: 'application/json', body: JSON.stringify({ detail: { code: 'observation_unavailable' } }) });
  });

  await page.goto('/?e2e=signed-in&screen=S14');
  await expect(page.locator('.journey-settings')).toBeVisible();
  await expect(page.locator('[data-scene="S13"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이 기기에서 로그아웃', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'AI 분석', exact: true }).click();
  await expect(page.locator('[data-scene="S11"]')).toBeVisible();
  await completeS11LifestyleSurvey(page);
  const result = page.locator('[data-model-v2-user-result="processed"]');
  await expect(result.locator('[data-model-v2-continuation]')).toHaveAttribute('data-model-v2-continuation', 'confirm-today');
  await expect(result.locator('[data-model-v2-continuity="blood-pressure"] strong')).toHaveText('오늘 혈압 상태 · 최신 여부 미확인');
  await expect(result.locator('[data-model-v2-continuity="challenge"] strong')).toHaveText('오늘 챌린지 상태 · 최신 여부 미확인');

  await result.getByRole('button', { name: '오늘 화면에서 확인하기', exact: true }).click();
  await expect(page.locator('[data-scene="S13"]')).toBeVisible();
  await expect(page.locator('[data-scene="S12"]')).toHaveCount(0);
});

test('S14 hides observation refresh failure while dependent screens retain the freshness warning', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  const held = deferred();
  let loads = 0;
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (!new URL(request.url()).pathname.endsWith('/window')) return route.abort();
    loads++;
    if (loads > 1) {
      await held.promise;
      return route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ detail: { code: 'temporarily_unavailable' } }) });
    }
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({
      start_on: '2026-09-05', end_on: '2026-09-11', blood_pressure_observations: [], challenge_checkins: [],
      challenge_events: [{ id: 'retained-record', observed_on: '2026-09-10', action_id: 'walk-10-minutes', status: 'completed' }], active_challenge: null,
    }) });
  });

  await page.goto('/?e2e=signed-in&screen=S10');
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect.poll(() => loads).toBe(2);
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.locator('.journey-settings')).toBeVisible();
  await expect(page.getByRole('button', { name: '이 기기에서 로그아웃', exact: true })).toBeEnabled();
  held.release();
  await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
  await expect(page.getByText('최신 여부 미확인', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByText('최신 여부 미확인', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이 기기에서 로그아웃', exact: true })).toBeEnabled();
});

test('S14 keeps independent controls enabled without clearing a selected prior window', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (!new URL(request.url()).pathname.endsWith('/window')) return route.abort();
    const url = new URL(request.url());
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({
      start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'), blood_pressure_observations: [], challenge_checkins: [],
      challenge_events: [{ id: 'prior-record', observed_on: url.searchParams.get('end_on'), action_id: 'walk-10-minutes', status: 'completed' }], active_challenge: null,
    }) });
  });

  await page.goto('/?e2e=signed-in&screen=S14&dashboard_window=prior');
  await expect(page.locator('.journey-settings')).toBeVisible();
  await expect(page.locator('[data-read-only-window]')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /^Warm/ })).toBeEnabled();
  await page.getByRole('radio', { name: /^Warm/ }).check();
  await expect(page).toHaveURL(/dashboard_window=prior/);
  const companion = page.getByLabel('캐릭터 선택');
  if (await companion.count()) await expect(companion).toBeEnabled();
  await expect(page.getByRole('button', { name: '이 기기에서 로그아웃', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '계정 삭제', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '7일 기록 보기', exact: true })).toBeEnabled();
});

test('Journey S14 groups guidance without writes and keeps account deletion behind its confirmation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const methods: string[] = [];
  await page.route('http://e2e.invalid/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    methods.push(request.method());
    if (!url.pathname.endsWith('/window')) return route.abort();
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({
      start_on: url.searchParams.get('start_on'), end_on: url.searchParams.get('end_on'), blood_pressure_observations: [], challenge_checkins: [], challenge_events: [{ id: 'settings-record', observed_on: '2026-09-10', action_id: 'walk-10-minutes', status: 'completed' }], active_challenge: null,
    }) });
  });

  await page.goto('/?e2e=signed-in&screen=S14');
  const settings = page.locator('.journey-settings');
  await expect(settings).toContainText('저장한 시점부터 30일 동안 보관돼요.');
  await expect(settings).toContainText('내보낸 JSON과 브라우저에서 저장한 PDF는 기기에 남고');
  await expect(settings).toContainText('인쇄물도 계정과 별개이므로 직접 관리해요.');
  await expect(settings).toContainText('이메일 로그인 계정');
  await settings.locator('summary').click();
  await expect(settings).toContainText('같은 요청을 반복하기 전에 기록 목록과 새로고침으로 반영 여부를 확인해 주세요.');
  await page.screenshot({ path: testInfo.outputPath('s14-desktop-1440-help-open.png'), fullPage: true });
  await page.getByRole('button', { name: '계정 삭제', exact: true }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('계정이 삭제됩니다.');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('button', { name: '계정 삭제', exact: true })).toBeFocused();
  expect(methods).toEqual(['GET']);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('html').evaluate(el => { el.style.fontSize = '200%'; });
  const deleteControl = page.getByRole('button', { name: '계정 삭제', exact: true });
  await deleteControl.scrollIntoViewIfNeeded();
  await deleteControl.focus();
  await expect(deleteControl).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('s14-mobile-360-help-open-200-viewport.png') });
});

test('past-dated BP confirmation points to record history instead of today', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);

  await page.goto('/?e2e=signed-in&screen=S04');
  await page.locator('#observed-on').fill('2026-09-10');
  await page.getByLabel(/수축기/).fill('120');
  await page.getByLabel(/이완기/).fill('80');
  await page.getByRole('button', { name: '혈압 기록 저장', exact: true }).click();

  await expect(page.locator('[data-scene="S05"]')).toBeVisible();
  await expect(page.locator('.save-next-step')).toContainText('최근 기록에서 방금 저장한 혈압을 확인해요');
  await expect(page.locator('.save-next-step')).toContainText('기록 찾아보기에서 날짜·시간대별로');
  const savedScene = page.locator('[data-scene="S05"]');
  await expect(savedScene.getByRole('button', { name: '기록 찾아보기', exact: true })).toBeVisible();
  await expect(savedScene.getByRole('button', { name: '오늘의 기록 보기', exact: true })).toHaveCount(0);

  await savedScene.getByRole('button', { name: '기록 찾아보기', exact: true }).click();
  await expect(page.locator('[data-scene="S08"]')).toBeVisible();
});


test('S01 offers a read-only 30-second preview and playful login microcopy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  const apiRequests: string[] = [];
  page.on('request', request => { if (/\/api\/v1\//.test(request.url())) apiRequests.push(request.url()); });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '측정한 혈압을 기록하고, 최근 7일을 확인해요.' })).toBeVisible();

  const auth = page.getByRole('button', { name: '로그인 링크 받기', exact: true });
  await expect(auth).toBeVisible();
  await expect(page.locator('.entry-discount-note')).toHaveCount(0);

  const preview = page.getByRole('button', { name: '로그인 없이 30초 맛보기', exact: true });
  await expect(preview).toBeVisible();
  await preview.click();

  const demo = page.locator('[data-demo-mode="read-only"]');
  await expect(demo).toBeVisible();
  await expect(demo).toContainText('예시 데이터 · 저장되지 않아요');
  await expect(demo.locator('.journey-today')).toBeVisible();
  await expect(demo.locator('.home-trail-date')).toHaveCount(7);
  expect(apiRequests).toEqual([]);

  await page.getByRole('button', { name: '맛보기 끝내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '로그인 없이 30초 맛보기', exact: true })).toBeVisible();
});

test('S01 narrator follows companion identity without changing login semantics', async ({ page }) => {
  test.skip(companionOff, 'Companion gate is intentionally off in this suite.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('sk7-companion-species', 'rabbit');
  });
  await page.goto('/?companion_species=cat');
  const narrator = page.locator('[data-login-companion]');
  await expect(narrator).toBeVisible();
  await expect(narrator).toHaveAttribute('data-login-companion-species', 'rabbit');
  const picker = page.locator('#login-companion-species');
  await expect(picker).toBeVisible();
  await expect(picker).toHaveValue('rabbit');
  await picker.selectOption('fox');
  await expect(narrator).toHaveAttribute('data-login-companion-species', 'fox');
  expect(await page.evaluate(() => localStorage.getItem('sk7-companion-species'))).toBe('fox');
  await expect(narrator).toContainText('처음이신가요?');
  await expect(narrator).toContainText('마음에 드는 친구를 고르고, 로그인 없이 30초만 먼저 둘러봐요.');
  await expect(page.getByRole('button', { name: '로그인 링크 받기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '로그인 없이 30초 맛보기', exact: true })).toBeVisible();
  const runtime = narrator.locator('[data-companion-status]');
  await expect(runtime).toHaveAttribute('data-companion-status', 'ready', { timeout: 30_000 });
  await expect(runtime).toHaveAttribute('data-companion-framing', 'login-narrator');
  await expect(runtime).toHaveAttribute('data-companion-animation-clip', 'greet');
  await expect(narrator.locator('canvas[data-companion-canvas]')).toHaveCount(1);
  await expect(narrator.locator('.companion-runtime-slot')).toHaveAttribute('data-companion-interaction-activation', 'disabled');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.locator('html').evaluate(el => { el.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('S01 narrator gate off preserves bubble and core login without renderer network', async ({ page }) => {
  test.skip(!companionOff, 'Only the explicit companion-off suite proves this rollback path.');
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  const narrator = page.locator('[data-login-companion]');
  await expect(narrator).toBeVisible();
  await expect(narrator).toContainText('마음에 드는 친구를 고르고, 로그인 없이 30초만 먼저 둘러봐요.');
  await expect(narrator.locator('[data-companion-status], canvas')).toHaveCount(0);
  await expect(page.locator('#login-companion-species')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '로그인 링크 받기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '로그인 없이 30초 맛보기', exact: true })).toBeVisible();
  expect(requests.filter(url => /companion\/v1\/|CompanionReviewRenderer|GLTFLoader/.test(url))).toEqual([]);
});


test('S01 demo-day preview keeps selected companion identity and gates product actions at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('sk7-companion-species', 'fox');
  });

  const apiRequests: string[] = [];
  page.on('request', request => {
    if (/\/api\/v1\//.test(request.url())) apiRequests.push(request.url());
  });

  await page.goto('/');

  const preview = page.getByRole('button', { name: '로그인 없이 30초 맛보기', exact: true });
  await expect(preview).toBeVisible();
  await expect(preview).toBeInViewport({ ratio: 1 });

  await preview.click();

  const demo = page.locator('[data-demo-mode="read-only"]');
  await expect(demo).toBeVisible();
  await expect(demo).toHaveAttribute('data-demo-companion-species', 'fox');
  await expect(demo).toContainText('예시 데이터 · 저장되지 않아요');
  await expect(demo.locator('.journey-today')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await demo.locator('.home-lead button').click();

  const gate = page.getByRole('dialog', { name: '여기부터는 실제 기록이에요.' });
  await expect(gate).toBeVisible();
  await expect(gate).toContainText('맛보기의 예시 데이터는 저장되지 않아요.');
  expect(apiRequests).toEqual([]);

  await gate.getByRole('button', { name: '계속 둘러보기', exact: true }).click();
  await expect(gate).toBeHidden();

  await demo.getByRole('link', { name: /7일 돌아보기/ }).click();
  await expect(gate).toBeVisible();

  await gate.getByRole('button', { name: '로그인하고 기록 시작', exact: true }).click();

  const email = page.getByLabel('이메일', { exact: true });
  await expect(email).toBeVisible();
  await expect(email).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('sk7-companion-species'))).toBe('fox');
  expect(apiRequests).toEqual([]);
});


test('S01 demo-day preview contains decorative S02 width at desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
  await page.goto('/');

  await page.getByRole('button', { name: '로그인 없이 30초 맛보기', exact: true }).click();
  const demo = page.locator('[data-demo-mode="read-only"]');
  await expect(demo).toBeVisible();
  await expect(demo.locator('.journey-today')).toBeVisible();

  expect(await page.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth,
  }))).toEqual({ fits: true, scrollWidth: 1440, innerWidth: 1440 });
});

test.describe('B9 journey feedback', () => {
  const windowBody = (withRecord = true) => ({
    start_on: '2026-09-05',
    end_on: '2026-09-11',
    blood_pressure_observations: withRecord ? [{
      id: 'b9-bp', observed_on: '2026-09-10', period: 'morning', systolic: 120, diastolic: 80,
    }] : [],
    challenge_checkins: [],
    challenge_events: [],
    active_challenge: null,
  });

  async function routeWindow(page: Page, reply: () => Promise<void> | void, withRecord = true) {
    let loads = 0;
    await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
    await page.route('http://e2e.invalid/**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (!new URL(request.url()).pathname.endsWith('/window')) return route.abort();
      loads += 1;
      await reply();
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(windowBody(withRecord)) });
    });
    return () => loads;
  }

  async function installTransitionProbe(page: Page, holdAnimations = false) {
    await page.addInitScript((hold) => {
      const nativeAnimate = Element.prototype.animate;
      const state = { calls: [] as { screen: string | null; target: string; duration: number | null }[], cancels: 0 };
      let baseline = 0;
      Element.prototype.animate = function (keyframes, options) {
        const animationBaseline = baseline;
        const duration = typeof options === 'number' ? options : Number(options?.duration ?? 0);
        state.calls.push({
          screen: document.querySelector('.app-shell')?.getAttribute('data-screen') ?? null,
          target: (this as HTMLElement).className,
          duration: Number.isFinite(duration) ? duration : null,
        });
        if (!hold) return nativeAnimate.call(this, keyframes, options);
        let rejectFinished!: (reason?: unknown) => void;
        const finished = new Promise<void>((_resolve, reject) => { rejectFinished = reject; });
        return {
          finished,
          cancel() {
            if (animationBaseline === baseline) state.cancels += 1;
            rejectFinished(new DOMException('cancelled', 'AbortError'));
          },
        } as Animation;
      };
      Object.defineProperty(state, 'reset', { value: () => {
        state.calls.length = 0;
        state.cancels = 0;
        baseline += 1;
      } });
      Object.defineProperty(window, '__b9TransitionProbe', { value: state });
    }, holdAnimations);
  }

  const transitionProbe = (page: Page) => page.evaluate(() => (
    window as unknown as { __b9TransitionProbe: { calls: { screen: string | null; target: string; duration: number | null }[]; cancels: number } }
  ).__b9TransitionProbe);

  const resetTransitionProbe = (page: Page) => page.evaluate(() => (
    window as unknown as { __b9TransitionProbe: { reset: () => void } }
  ).__b9TransitionProbe.reset());

  test('held S02 and S10 reads show truthful non-interactive families and fast reads have no minimum display time', async ({ page }) => {
    let gate = deferred();
    const loads = await routeWindow(page, () => gate.promise);

    await page.goto('/?e2e=signed-in&screen=S02');
    const today = page.locator('[data-journey-skeleton-family="today"]');
    await expect(today).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '선택한 7일의 기록을 불러오는 중이에요.' })).toHaveCount(1);
    await expect(today.locator('.journey-skeleton-day')).toHaveCount(7);
    await expect(today.locator('button, input, select, a[href], [tabindex="0"]')).toHaveCount(0);
    await expect(page.locator('[data-scene="S05"], [data-scene="S12"]')).toHaveCount(0);

    await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
    const records = page.locator('[data-journey-skeleton-family="records"]');
    await expect(records).toBeVisible();
    await expect(records.locator('.journey-skeleton-record')).toHaveCount(3);
    await expect(records).not.toContainText(/mmHg|기록함|완료|%/);
    expect(loads()).toBe(1);

    gate.release();
    await expect(page.locator('[data-scene="S10"]')).toBeVisible();
    await expect(page.locator('[data-journey-skeleton]')).toHaveCount(0);

    gate = deferred();
    gate.release();
    await page.goto('/?e2e=signed-in&screen=S02');
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    await expect(page.locator('[data-journey-skeleton], [aria-busy="true"]')).toHaveCount(0);
    expect(loads()).toBe(2);
  });

  test('initial error, confirmed empty, retained refresh, and refresh-error remain distinct', async ({ page }) => {
    let mode: 'error' | 'empty' | 'records' | 'refresh-error' = 'error';
    let refreshGate = deferred();
    await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
    await page.route('http://e2e.invalid/**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (!new URL(request.url()).pathname.endsWith('/window')) return route.abort();
      if (mode === 'error') return route.fulfill({ status: 403, headers, contentType: 'application/json', body: '{}' });
      if (mode === 'refresh-error') {
        await refreshGate.promise;
        return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(windowBody(mode === 'records')) });
    });

    await page.goto('/?e2e=signed-in&screen=S02');
    await expect(page.locator('[data-scene="S13"]')).toBeVisible();
    await expect(page.locator('[data-scene="S12"], [aria-busy="true"]')).toHaveCount(0);

    mode = 'empty';
    await page.reload();
    await expect(page.locator('[data-scene="S12"]')).toBeVisible();
    await expect(page.locator('[data-scene="S13"], [aria-busy="true"]')).toHaveCount(0);

    mode = 'records';
    await page.goto('/?e2e=signed-in&screen=S10');
    await expect(page.locator('[data-scene="S10"]')).toContainText('120/80 mmHg');
    mode = 'refresh-error';
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(page.locator('[data-journey-skeleton]')).toHaveCount(0);
    await expect(page.locator('[data-scene="S10"]')).toContainText('120/80 mmHg');
    refreshGate.release();
    await expect(page.getByText('최신 여부 미확인', { exact: true }).first()).toBeVisible();
    await expect(page.locator('[data-scene="S10"]')).toContainText('120/80 mmHg');
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test('S11 draft and S14 preferences survive their independent background read', async ({ page }) => {
    let gate = deferred();
    await routeWindow(page, () => gate.promise);

    await page.goto('/?e2e=signed-in&screen=S11');
    await page.getByRole('button', { name: '입력 시작하기', exact: true }).click();
    await page.getByLabel('만 나이', { exact: true }).fill('35');
    gate.release();
    await expect(page.getByLabel('만 나이', { exact: true })).toHaveValue('35');
    await expect(page.locator('[data-model-v2-step="basics"]')).toBeVisible();
    await expect(page.locator('[data-journey-skeleton]')).toHaveCount(0);

    gate = deferred();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('radio', { name: /^Warm/ }).check();
    const companion = page.getByLabel('캐릭터 선택');
    if (await companion.count()) await companion.selectOption('fox');
    gate.release();
    await expect(page.getByRole('radio', { name: /^Warm/ })).toBeChecked();
    if (await companion.count()) await expect(companion).toHaveValue('fox');
    await expect(page.locator('[data-journey-skeleton]')).toHaveCount(0);
  });

  test('route enter reuses the viewport and does not repeat for typing, theme, or refresh', async ({ page }) => {
    await installTransitionProbe(page);
    await routeWindow(page, () => undefined);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2e=signed-in&screen=S02');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    expect((await transitionProbe(page)).calls).toEqual([
      { duration: 120, screen: 'S02', target: 'scene-copy' },
    ]);
    await resetTransitionProbe(page);
    await page.locator('#scene-content').evaluate(element => element.setAttribute('data-b9-node', 'preserved'));
    expect((await transitionProbe(page)).calls).toHaveLength(0);

    await page.locator('.home-lead button').click();
    await expect(page.locator('#S04-title')).toBeFocused();
    await page.getByLabel(/수축기/).fill('120');
    expect((await transitionProbe(page)).calls).toEqual([
      { duration: 160, screen: 'S04', target: 'scene-copy' },
    ]);

    await page.getByRole('button', { name: '기록 찾아보기', exact: true }).click();
    await expect(page.locator('#S08-title')).toBeFocused();
    await expect(page.locator('#scene-content')).toHaveAttribute('data-b9-node', 'preserved');
    await expect(page.locator('#scene-content > section[data-scene]')).toHaveCount(1);
    expect((await transitionProbe(page)).calls).toHaveLength(2);

    await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(page.locator('[data-scene="S10"]')).toBeVisible();
    expect((await transitionProbe(page)).calls).toHaveLength(3);

    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('radio', { name: /^Cloud/ }).check();
    expect((await transitionProbe(page)).calls).toHaveLength(4);
    await page.goBack();
    await expect(page.locator('#S10-title')).toBeFocused();
    await expect(page.locator('#scene-content > section[data-scene]')).toHaveCount(1);
    expect((await transitionProbe(page)).calls).toHaveLength(5);

    await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await expect(page.locator('#scene-content > section[data-scene]')).toHaveCount(1);
    await expect(page.locator('[data-scene="S14"]')).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Cloud/ })).toBeEnabled();
  });

  test('reduced motion, hidden documents, reports, and dialogs cancel only B9-owned motion', async ({ page }) => {
    await installTransitionProbe(page, true);
    await routeWindow(page, () => undefined);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2e=signed-in&screen=S02');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    expect((await transitionProbe(page)).calls).toEqual([
      { duration: 120, screen: 'S02', target: 'scene-copy' },
    ]);
    await resetTransitionProbe(page);

    await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
    expect((await transitionProbe(page)).calls).toEqual([
      { duration: 160, screen: 'S10', target: 'scene-copy' },
    ]);
    await page.getByRole('button', { name: '7일 리포트 보기', exact: true }).click();
    await expect(page.locator('[data-living-week-report]')).toBeVisible();
    expect((await transitionProbe(page)).cancels).toBe(1);
    await page.getByRole('button', { name: '7일 돌아보기로 돌아가기', exact: true }).click();
    expect((await transitionProbe(page)).calls).toHaveLength(1);

    await page.getByRole('button', { name: '설정', exact: true }).click();
    expect((await transitionProbe(page)).calls).toHaveLength(2);
    await page.getByRole('button', { name: '계정 삭제', exact: true }).click();
    expect((await transitionProbe(page)).cancels).toBe(2);
    await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
    expect((await transitionProbe(page)).calls).toHaveLength(2);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '오늘의 기록', exact: true }).click();
    expect((await transitionProbe(page)).calls).toHaveLength(2);
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
    await page.locator('.home-lead button').click();
    expect((await transitionProbe(page)).calls).toHaveLength(2);
    await page.emulateMedia({ forcedColors: 'none' });
    await page.getByRole('button', { name: '기록 찾아보기', exact: true }).click();
    expect((await transitionProbe(page)).calls).toHaveLength(3);

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect((await transitionProbe(page)).cancels).toBe(3);
    await page.getByRole('button', { name: '7일 돌아보기', exact: true }).click();
    expect((await transitionProbe(page)).calls).toHaveLength(3);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect((await transitionProbe(page)).calls).toHaveLength(3);
    await page.getByRole('button', { name: '설정', exact: true }).click();
    expect((await transitionProbe(page)).calls).toHaveLength(4);
  });

  test('WAAPI absence leaves the current screen visible and interactive', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: undefined });
    });
    await routeWindow(page, () => undefined);
    await page.goto('/?e2e=signed-in&screen=S02');
    await page.locator('.home-lead button').click();
    const entry = page.locator('[data-scene="S04"]');
    await expect(entry).toBeVisible();
    await expect(entry.locator('.scene-copy')).toHaveCSS('opacity', '1');
    await expect(page.getByLabel(/수축기/)).toBeEnabled();
    await page.getByLabel(/수축기/).fill('120');
    await expect(page.getByLabel(/수축기/)).toHaveValue('120');
  });

  test('pending save never predicts S05 and confirmed S05 keeps its one-shot owner', async ({ page }) => {
    await installTransitionProbe(page);
    const state = await setup(page, 'pending');
    await page.goto('/?e2e=signed-in&screen=S04');
    await save(page);
    await expect.poll(state.posts).toBe(1);
    await expect(page.locator('[data-scene="S04"]')).toBeVisible();
    await expect(page.locator('[data-scene="S05"], [data-journey-skeleton]')).toHaveCount(0);
    state.held.release();
    await expect(page.locator('[data-scene="S05"]')).toBeVisible();
    expect((await transitionProbe(page)).calls.filter(call => call.screen === 'S05')).toHaveLength(0);
    if (!companionOff) await expect(page.locator('[data-companion-celebrate-count="1"]')).toBeVisible({ timeout: 30_000 });
  });

  test('account generation and logout remove old content without retaining transition targets', async ({ page }) => {
    await installTransitionProbe(page, true);
    let gate = deferred();
    let account = 'old';
    await page.clock.setFixedTime(new Date('2026-09-11T03:00:00Z'));
    await page.route('http://e2e.invalid/**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (!new URL(request.url()).pathname.endsWith('/window')) return route.abort();
      if (account === 'new') await gate.promise;
      const body = windowBody(true);
      body.blood_pressure_observations[0].id = `${account}-account-record`;
      body.blood_pressure_observations[0].systolic = account === 'old' ? 121 : 118;
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/?e2e=signed-in&screen=S08');
    const oldRecord = page.getByText('121/80 mmHg', { exact: true }).first();
    await expect(oldRecord).toBeVisible();
    const oldHandle = await oldRecord.elementHandle();
    account = 'new';
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sk7:e2e-session-change', { detail: {
      access_token: 'synthetic-account-b-token', refresh_token: 'synthetic-account-b-refresh', expires_in: 3600, expires_at: 1800000000, token_type: 'bearer',
      user: { id: 'synthetic-account-b', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-09-11T00:00:00Z' },
    } })));
    await expect(page.locator('[data-journey-skeleton-family="today"]')).toBeVisible();
    await expect(page.getByText('121/80 mmHg', { exact: true })).toHaveCount(0);
    expect(await oldHandle!.evaluate(node => node.isConnected)).toBe(false);
    gate.release();
    await expect(page.locator('[data-scene="S02"]')).toBeVisible();
    await page.getByRole('button', { name: '기록 찾아보기', exact: true }).click();
    await expect(page.locator('[data-scene="S08"]')).toContainText('118/80 mmHg');
    await expect(page.getByText('121/80 mmHg', { exact: true })).toHaveCount(0);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sk7:e2e-session-change', { detail: null })));
    await expect(page.locator('[data-scene="S01"]')).toBeVisible();
    await expect(page.locator('[data-scene="S02"], [data-journey-skeleton]')).toHaveCount(0);
  });

  for (const [width, height] of [[320, 568], [390, 844], [1366, 768]] as const) {
    test(`skeleton and loaded CSS stay visible without overflow or fixed-nav overlap at ${width}x${height} and 200% text`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const gate = deferred();
      await routeWindow(page, () => gate.promise);
      await page.goto('/?e2e=signed-in&screen=S02');
      await page.locator('html').evaluate(element => { element.style.fontSize = '200%'; });
      await expect(page.locator('[data-journey-skeleton-family="today"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width <= 580) {
        const nav = (await page.locator('.primary-nav').boundingBox())!;
        const skeleton = (await page.locator('[data-journey-skeleton]').boundingBox())!;
        expect(skeleton.x + skeleton.width).toBeLessThanOrEqual(width);
        expect(nav.y + nav.height).toBeLessThanOrEqual(height);
      }
      gate.release();
      await expect(page.locator('[data-scene="S02"]')).toBeVisible();
      await expect(page.locator('.scene-copy')).toHaveCSS('opacity', '1');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      if (width <= 580) {
        await page.getByRole('button', { name: 'AI 분석', exact: true }).click();
        await page.getByRole('button', { name: '입력 시작하기', exact: true }).click();
        const actions = page.locator('[data-model-v2-step="basics"] .model-v2-actions');
        await actions.scrollIntoViewIfNeeded();
        const actionsBox = (await actions.boundingBox())!;
        const navBox = (await page.locator('.primary-nav').boundingBox())!;
        expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(navBox.y);
      }
    });
  }
});
