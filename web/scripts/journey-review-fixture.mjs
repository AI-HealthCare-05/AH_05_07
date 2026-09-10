// Local review tooling only; never imported by the application or copied to dist.
// Uses the existing e2e signed-in harness. Synthetic state lives in this tab only.
export function journeyReviewFixture() {
  const nativeFetch = window.fetch.bind(window);
  const scenario = new URLSearchParams(location.search).get('recap_fixture');
  const allowed = ['mixed', 'empty', 'no-bp', 'no-checkins', 'no-legacy', 'initial-error', 'refresh-error', 'loading', 'export-error'];
  if (scenario && !allowed.includes(scenario)) throw new Error('Unsupported synthetic recap fixture');
  let saved = null;
  let windowRequests = 0;
  const seoulToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const shift = (day, delta) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10); };
  function records(start_on, end_on) {
    const today = seoulToday();
    const within = item => item.observed_on >= start_on && item.observed_on <= end_on;
    const mixed = Boolean(scenario) && scenario !== 'empty';
    return { start_on, end_on,
      blood_pressure_observations: [
        ...(mixed && scenario !== 'no-bp' ? [
          { id: `synthetic-bp-${end_on}-am`, observed_on: end_on, period: 'morning', systolic: 120, diastolic: 80 },
          { id: `synthetic-bp-${shift(end_on, -2)}-pm`, observed_on: shift(end_on, -2), period: 'evening', systolic: 118, diastolic: 78 },
        ] : []), ...(saved ? [saved] : []),
      ].filter(within),
      challenge_events: scenario === 'empty' || scenario === 'no-legacy' ? [] : [
        { id: `synthetic-legacy-${start_on}`, observed_on: start_on, action_id: 'walk-10-minutes', status: 'completed' },
      ],
      challenge_checkins: mixed && scenario !== 'no-checkins' ? [
        { id: `synthetic-completed-${end_on}`, challenge_id: end_on === today ? 'synthetic-active' : 'synthetic-ended', observed_on: end_on, action_id: 'walk-10-minutes', status: 'completed' },
        { id: `synthetic-skipped-${shift(end_on, -1)}`, challenge_id: end_on === today ? 'synthetic-active' : 'synthetic-ended', observed_on: shift(end_on, -1), action_id: 'walk-10-minutes', status: 'skipped' },
        { id: `synthetic-inactive-${start_on}`, challenge_id: 'synthetic-ended', observed_on: start_on, action_id: 'sleep-routine', status: 'completed' },
      ] : [],
      active_challenge: mixed ? { id: 'synthetic-active', action_id: 'walk-10-minutes', starts_on: shift(today, -2), ends_on: shift(today, 4), first_checkin_on: shift(today, -1), status: 'active' } : null,
    };
  }
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
    if (url.origin === 'http://e2e.invalid') {
      if (method === 'GET' && ['/api/v1/observations/window', '/api/v1/observations/export'].includes(url.pathname)) {
        const start = url.searchParams.get('start_on'), end = url.searchParams.get('end_on');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(end ?? '') || shift(start, 6) !== end) return json({ code: 'validation_error' }, 422);
        if (url.pathname.endsWith('/export')) {
          if (scenario === 'export-error') return json({ code: 'synthetic_export_error' }, 503);
          return json({ synthetic: true, notice: 'LOCAL SYNTHETIC REVIEW ONLY', ...records(start, end) }, 200,
            { 'Content-Disposition': `attachment; filename="synthetic-sk7-${start}-${end}.json"` });
        }
        windowRequests++;
        if (scenario === 'loading') await new Promise(resolve => setTimeout(resolve, 4000));
        if (scenario === 'initial-error' || (scenario === 'refresh-error' && windowRequests > 1)) return json({ code: 'synthetic_load_error' }, 503);
        return json(records(start, end));
      }
      if (method === 'POST' && url.pathname === '/api/v1/observations/blood-pressure') {
        const value = JSON.parse(init?.body ?? '{}');
        if (value.systolic !== 120 || value.diastolic !== 80 || !/^\d{4}-\d{2}-\d{2}$/.test(value.observed_on) || !['morning', 'evening'].includes(value.period)) return json({ code: 'validation_error' }, 422);
        saved = { id: 'synthetic-save', observed_on: value.observed_on, period: value.period, systolic: 120, diastolic: 80 };
        return json(saved, 201);
      }
      throw new Error('Unsupported synthetic review request');
    }
    if (method !== 'GET') throw new Error('No network writes in the local review');
    if (url.origin === 'https://sk7-companion.gkrry.com' && url.pathname.endsWith('.glb')) return nativeFetch(`/review-media${url.pathname}`, { signal: init?.signal });
    if (url.origin !== location.origin) throw new Error('Unsupported review request');
    return nativeFetch(input, init);
  };
}
