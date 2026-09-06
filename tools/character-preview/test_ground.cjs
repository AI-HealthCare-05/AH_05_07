const assert = require('node:assert/strict');
(async () => {
  const { groundReference } = await import('./ground-reference.js');
  const min = [-2, -0.125, -1], max = [2, 3, 1];
  const fixed = groundReference(min, max);
  assert.equal(fixed.y, -0.125); assert.equal(fixed.centerX, 0); assert.equal(fixed.spacing, 0.6);
  min[1] = -20; max[1] = 100;
  assert.equal(fixed.y, -0.125, 'Changing bounds later must not move the reference');
  assert(Object.isFrozen(fixed)); assert.equal(fixed.followsAnimation, false);
  for (const pair of [[[0, NaN, 0], [1, 1, 1]], [[0, 0, 0], [1, Infinity, 1]], [[2, 0, 0], [1, 1, 1]], [[0, 0, 0], [0, 0, 0]], [[0, 0], [1, 1, 1]]]) assert.throws(() => groundReference(...pair));
  console.log('fixed ground reference and invalid bounds checks passed');
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
