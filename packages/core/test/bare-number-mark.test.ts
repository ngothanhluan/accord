// Phase 08.9.1 D-03: the audit's fix text for an undecided deferred item names the `#<n>` mark for an id that is only digits.
import { expect, it } from 'vitest';
import { deferredGaps } from '../src/index.js';

it('risk:regression the audit fix names the #<n> mark for a bare-number id (08.9.1 D-03)', () => {
  const [gap] = deferredGaps([{ id: 'D-1', items: [{ rating: 'Must', text: 'x (Must)' }] }]);
  expect(gap.fix).toContain(' → #<new id>');
  expect(gap.fix).toContain(' → <new id>');
  expect(gap.fix).toContain(' → declined');
});
