// Local synthetic browser recording. No production accounts, writes or external traffic.
const { chromium, expect } = require('../web/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve(process.argv[2]);
const dry = process.argv.includes('--dry-run');
const base = 'http://127.0.0.1:4185';
const delay = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', recordVideo: { dir: out, size: { width: 1366, height: 1000 } } });
  let mode = 'normal', calls = 0;
  const blocked = [], timeline = [];
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === base) return route.continue();
    if (url.origin !== 'http://e2e.invalid') { blocked.push(url.origin); return route.abort(); }
    assert(['GET', 'OPTIONS'].includes(req.method()), 'Recording must never write');
    const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    assert.equal(url.pathname, '/api/v1/observations/window'); calls++;
    const start = url.searchParams.get('start_on'), end = url.searchParams.get('end_on');
    const body = { start_on: start, end_on: end, blood_pressure_observations: [], challenge_events: [], active_challenge: null, challenge_checkins: [] };
    if (mode === 'normal') body.challenge_events = [{ id: 'synthetic-legacy', action_id: 'sleep-routine', observed_on: end, status: 'completed' }];
    return route.fulfill({ status: mode === 'error' ? 503 : 200, headers, contentType: 'application/json', body: JSON.stringify(mode === 'error' ? { detail: { code: 'request_failed' } } : body) });
  });
  const page = await context.newPage();
  await page.setContent('<style>body{margin:0;background:#f5f4ef;color:#183136;font-family:"Malgun Gothic",sans-serif}header{height:62px;padding:0 28px;display:flex;align-items:center;font-size:23px;background:#183136;color:white}iframe{display:block;width:100%;height:768px;border:0}footer{padding:20px 34px;font-size:27px;line-height:1.45;height:130px;box-sizing:border-box}small{float:right;margin-left:auto;font-size:17px}</style><header>SK7 제출 검토본 · 합성 데이터 · 로컬 시연<small>무음 자막 영상 · 운영 검증 아님</small></header><iframe title="실제 로컬 브라우저 화면"></iframe><footer></footer>');
  const frame = page.frames()[1];
  const go = async query => { await frame.goto(base + query); await frame.locator('[data-scene]').first().waitFor(); };
  const say = async (text, seconds, kind='고정 합성 fixture') => {
    await page.locator('footer').evaluate((el, value) => { el.textContent = value; }, `${kind} | ${text}`);
    timeline.push({ text, seconds, kind, url: frame.url().replace(base, '') });
    await page.screenshot({ path: path.join(out, `scene-${timeline.length}.png`) });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await delay(dry ? 100 : seconds * 1000);
  };
  try {
    await go('/?fixture=VP-10&screen=S02');
    await say('혈압 관찰과 7일 챌린지를 서로 다른 사실로 기록합니다. 이 영상은 현재 구현을 보여주는 검토본입니다.', 23);
    await frame.getByRole('button', { name: '기록 찾아보기' }).click();
    await say('기록 찾아보기를 눌렀습니다. 혈압 관찰·챌린지 참여·이전 방식의 기록을 구분합니다.', 20);
    await frame.locator('[data-record-lane="blood-pressure"]').getByRole('button', { name: '상세 보기' }).first().click();
    await expect(frame.locator('[data-record-detail-kind="blood-pressure"]')).toContainText('•••/•• mmHg');
    await say('상세 보기를 눌러 선택한 기록을 확인합니다. 합성 fixture의 측정값은 원래 화면처럼 마스킹됩니다.', 20);
    await go('/?e2e=signed-in&screen=S10');
    await expect(frame.locator('[data-dashboard-window="current"]')).toBeVisible();
    await say('현재 7일 화면입니다. 이후 구간 전환은 실제 버튼 조작과 브라우저 안의 모의 API 응답을 사용합니다.', 20, '모의 API · 읽기 전용 시연');
    await frame.getByRole('button', { name: '이전 7일 보기' }).click();
    await expect(frame.locator('[data-dashboard-window="prior"]')).toBeVisible();
    await say('이전 7일 보기 버튼을 눌렀습니다. 이전 구간은 읽기 전용이며, 관찰 기록을 모델 확률의 변화로 설명하지 않습니다.', 20, '모의 API · 읽기 전용 시연');
    await frame.getByRole('button', { name: '현재 7일 보기' }).click();
    await expect(frame.locator('[data-dashboard-window="current"]')).toBeVisible();
    await say('현재 7일로 돌아왔습니다. 저장·수정·삭제는 수행하지 않았으며 실제 계정이나 데이터베이스에 연결하지 않았습니다.', 18, '모의 API · 읽기 전용 시연');
    mode = 'empty'; await go('/?e2e=signed-in&screen=S02');
    await expect(frame.locator('[data-scene="S12"]')).toBeVisible();
    await say('정상 응답에 기록이 없으면 빈 상태를 표시합니다. 불러오기 실패와 구분합니다.', 20, '모의 API · 빈 응답 200');
    mode = 'error'; await go('/?e2e=signed-in&screen=S02');
    await expect(frame.locator('[data-scene="S13"]')).toBeVisible();
    await say('모의 API가 503을 반환했습니다. 이 화면은 기록이 없다는 뜻이 아니라 불러오기에 실패했다는 뜻입니다.', 20, '모의 API · 오류 응답 503');
    mode = 'empty'; const before = calls;
    await frame.getByRole('button', { name: '다시 불러오기' }).click();
    await expect(frame.locator('[data-scene="S12"]')).toBeVisible(); assert(calls > before);
    await say('다시 불러오기를 실제로 눌렀습니다. 새 모의 응답 200을 받아 빈 상태로 복구했습니다. 저장 성공을 연출한 장면은 없습니다.', 20, '모의 API · 재시도 후 200');
    await go('/?fixture=VP-10&screen=S11');
    await expect(frame.locator('[data-scene="S11"]')).toContainText('아직 준비 중이에요');
    await say('입력 기반 위험군 선별 신호는 아직 준비 중입니다. 모델 확률·등급·추천 행동을 제공하지 않습니다.', 20);
    await say('승인된 연구 보고는 내부 validation 비교입니다. 미래 발병 예측, 한국 사용자 성능, 모델 출시를 입증하지 않습니다.', 20);
    await say('1회차는 진행 중입니다. 운영 검증·발주 범위 수용·입력과 모델 승인·제출 시트 대조·사용자 최종 검토가 남습니다.', 20);
    assert.deepEqual(blocked, []);
    fs.writeFileSync(path.join(out, 'recording-checks.json'), JSON.stringify({ synthetic_only: true, writes: 0, external_requests: 0, mock_get_count: calls, timeline }, null, 2));
  } finally { await context.close(); await browser.close(); }
  console.log('Recorded local synthetic journey; no external requests or writes.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
