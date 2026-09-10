// Local review tooling only; never imported by the application or copied to dist.
// Uses the existing e2e signed-in harness. Synthetic state lives in this tab only.
export function journeyReviewFixture() {
  const nativeFetch = window.fetch.bind(window);
  let saved = null;
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.origin === 'http://e2e.invalid') {
      if (method === 'GET' && url.pathname === '/api/v1/observations/window') {
        const start_on = url.searchParams.get('start_on'), end_on = url.searchParams.get('end_on');
        return json({ start_on, end_on, blood_pressure_observations: saved ? [saved] : [],
          challenge_events: [{ id: 'synthetic-legacy', observed_on: start_on, action_id: 'walk-10-minutes', status: 'completed' }],
          challenge_checkins: [], active_challenge: null });
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
