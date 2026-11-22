// Phase 08.7 D-04 (as amended by A-01): the flightdeck pane's review block is counted by core, per round and per severity, because review.md records no lens.
import { expect, it } from 'vitest';
import { capRulesOf, reviewSummary } from '../src/index.js';
import { CONFIG } from '../../../test/helpers/lane.js';
import { scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';

const FIXED = 'Must 1 [patch]: the writer drops the header — src/a.ts:3 — fixed in abc1234 — checked: src/a.ts:3 — addressed: src/a.ts:5';
const tally = (open: number, fixed: number, deferred: number) => ({ open, fixed, deferred });
const empty = { Must: tally(0, 0, 0), Should: tally(0, 0, 0), Nice: tally(0, 0, 0) };

// Phase 08.7 D-02 D-04: one round of each state and severity, the final mark, and the cap read through the one seam.
it('risk:parsing review summary counts each round\'s findings by severity and state and reads the cap through capRulesOf (D-02 D-04)', () => {
  const review = v2Review([
    [
      {
        lines: [
          FIXED,
          'Must 2 [patch]: the export leaks a token — src/b.ts:4 — open',
          'Should 3 [patch]: the cell is not quoted — src/c.ts:5 — deferred',
          'Nice 4 [patch]: a name could be shorter — src/d.ts:6 — open',
        ],
      },
      { mark: 'final', lines: [] },
    ],
  ]);
  const snap = scopeSnapshot({ review });
  expect(reviewSummary(snap, 'T-1')).toEqual({
    cycle: 1,
    round: 2,
    cap: capRulesOf(snap, 'T-1', 'review').cap,
    rounds: [
      { n: 1, findings: { Must: tally(1, 1, 0), Should: tally(0, 0, 1), Nice: tally(1, 0, 0) } },
      { n: 2, final: true, findings: empty },
    ],
  });
  const capped = scopeSnapshot({ review, config: CONFIG + 'strictness:\n  rounds:\n    review: "3"\n' });
  expect(reviewSummary(capped, 'T-1')?.cap).toBe(3);
});

// Phase 08.7 D-04: no record gives no block; only the last cycle counts after a return from verify; a verdict shows only when it follows the last round.
it('risk:complex-branching review summary is absent without a review record and reads only the last cycle after a return from verify (D-04)', () => {
  const noRecord = scopeSnapshot({ review: '' });
  expect(reviewSummary(noRecord, 'T-1')).toBeUndefined();
  expect(reviewSummary(noRecord, 'NOPE-1')).toBeUndefined();

  const returned = scopeSnapshot({ review: v2Review([[{ lines: [] }, { lines: [] }], [{ lines: [] }]]) });
  const s = reviewSummary(returned, 'T-1');
  expect([s?.cycle, s?.round, s?.rounds.length]).toEqual([2, 1, 1]);
  expect(s).not.toHaveProperty('verdict');

  const converged = scopeSnapshot({ review: v2Review([[{ lines: [] }]], '\nverdict: converged\n') });
  expect(reviewSummary(converged, 'T-1')?.verdict).toBe('converged');
  // a verdict that is not one of the two Done accepts never reaches the block
  const odd = scopeSnapshot({ review: v2Review([[{ lines: [] }]], '\nverdict: perhaps\n') });
  expect(reviewSummary(odd, 'T-1')).not.toHaveProperty('verdict');
});

// Phase 08.7 D-04: a version 1 record writes no state, so its findings count open; the security mark of a round is copied only when the round holds one.
it('risk:regression review summary counts a finding with no state as open and keeps the security mark of each round (D-04)', () => {
  const v1 = scopeSnapshot({ review: 'Round record: 1\n\n## Round 1\n\nMust 1: the writer drops the header\nShould 2: the cell is not quoted\n' });
  expect(reviewSummary(v1, 'T-1')?.rounds).toEqual([{ n: 1, findings: { Must: tally(1, 0, 0), Should: tally(1, 0, 0), Nice: tally(0, 0, 0) } }]);

  const marks = scopeSnapshot({
    review: v2Review([[{ lines: ['Security: lens security ran'] }, { lines: ['Security: no pattern matched'] }, { lines: [] }]]),
  });
  const rounds = reviewSummary(marks, 'T-1')?.rounds ?? [];
  expect(rounds.map((r) => r.security)).toEqual(['ran', 'none', undefined]);
  expect(rounds[2]).not.toHaveProperty('security');
  expect(rounds.every((r) => !Object.hasOwn(r, 'final') && !Object.hasOwn(r, 'added'))).toBe(true);
});
