import { expect, it } from 'vitest';

it('risk:parsing plan rounds are counted from plan-review.md, first-reported findings only, after the last Closed line', async () => {
  const { parsePlanReview } = (await import(new URL('../../../scripts/plan-review.mjs', import.meta.url).href)) as {
    parsePlanReview: (t: string) => Record<string, number>;
  };
  const text = [
    '## Round 1 (whole)', '1. Must — old — fixed', '## Closed',
    '## Round 1 (whole)', '1. Must — a — unverified: no citation', '2. Should — b — open', '3. Nice — c — deferred',
    '## Round 2 (whole)', '1. Must — repeats 1.1: a — open', '2. Should — d — open',
    '## Round 3 (diff)', 'No findings',
  ].join('\n');
  expect(parsePlanReview(text)).toEqual({ rounds: 3, whole: 2, diff: 1, wholeAfterFirst: 1, must: 1, should: 2 });
});
