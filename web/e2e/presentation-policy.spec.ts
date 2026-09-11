import { expect, test } from '@playwright/test';
import { resolvePresentationPolicy, resolveJourneyPoster } from '../src/ui/presentationPolicy';
import { resolveScenePlan } from '../src/ui/scenePolicy';
import { allowsSavedScene } from '../src/ui/savedScene';
import { resolveProductionCompanion } from '../src/ui/companion';
import { allScreenIds } from '../src/ui/journey';

for (const scene of [undefined, '', 'off', 'unknown', 'production', 'review']) {
  for (const ui of [undefined, '', 'legacy', 'journey', 'Journey', 'review', 'true', null]) {
    test(`presentation UI=${String(ui)} scene=${String(scene)}`, () => {
      const journey = ui === 'journey' || (ui === undefined && scene === 'review');
      expect(resolvePresentationPolicy(ui, scene)).toEqual({ journey, staticLandscape: journey && scene !== 'review' });
      // UI selection does not expand either realtime gate or close the existing companion.
      expect(resolveScenePlan({ screen: 'S02', calendarDate: '2026-09-11', reducedMotion: false,
        visualDisabled: false, webglAvailable: true, gate: scene })?.tier ?? null).toBe(scene === 'review' ? 2 : null);
      expect(allowsSavedScene(scene, 'S05', true)).toBe(scene === 'review');
      expect(resolveProductionCompanion('production', 'S05', true)?.species).toBe('bear');
    });
  }
}
test('static candidate has only S02/S10 calendar posters and no renderer input', () => {
  for (const screen of allScreenIds) {
    const poster = resolveJourneyPoster(screen, '2026-09-11');
    expect(Boolean(poster)).toBe(screen === 'S02' || screen === 'S10');
    if (poster) {
      expect(Object.keys(poster).sort()).toEqual(['compositions', 'id', 'posters']);
      for (const image of Object.values(poster.posters)) expect(image.url).toMatch(/\.webp$/);
    }
  }
  expect(resolveJourneyPoster('S02', '2026-02-30')).toBeNull();
});
