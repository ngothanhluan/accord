// ST-LN-57 Task 6: `accord round` reads the round facts: a head git does not bind, the version cut-over and the added code line.
import { expect, it } from 'vitest';
import { RECORD_V2_FROM, nextRound, roundText } from '../src/index.js';
import { H, commit, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';

const V1 = 'Round record: 1\n\n## Round 1\n\nNo findings\n';

it('risk:complex-branching accord round refuses a record git does not bind and asks for the added code mark', () => {
  const two = v2Review([[{ lines: [] }, { lines: [] }]]);
  const merge = commit(['src/m.ts'], 'merge');

  // a head that is not between the previous head and the last code commit of its round
  const unbound = scopeSnapshot({
    review: two,
    facts: facts([[], []], { heads: [{ high: H(1), bound: true }, { high: H(2), low: H(1), bound: false }] }),
  });
  const refused = nextRound(unbound, 'T-1', 'review');
  expect(refused.kind).toBe('refused');
  expect(refused.reasons.join('\n')).toContain('is not between');

  // every head bound and a merge after the last round: round 3 is next and asks the mark
  const added = nextRound(scopeSnapshot({ review: two, facts: facts([[], [merge]]) }), 'T-1', 'review');
  expect(added.kind).toBe('next');
  expect(added.round).toBe(3);
  expect(roundText(added)).toContain('Added code: head round 3 as ## Round 3 head <sha> (added code round 1)');

  // no merge in any range, a merge round 2 already reviewed under its mark, or a clean merge: no Added code line
  const none = nextRound(scopeSnapshot({ review: two, facts: facts([[], []]) }), 'T-1', 'review');
  expect(roundText(none)).not.toContain('Added code:');
  const marked = v2Review([[{ lines: [] }, { lines: [], mark: 'added' }]]);
  const early = nextRound(scopeSnapshot({ review: marked, facts: facts([[merge], []]) }), 'T-1', 'review');
  expect(early.kind).toBe('next');
  expect(roundText(early)).not.toContain('Added code:');
  const clean = nextRound(scopeSnapshot({ review: two, facts: facts([[], [commit([], 'merge')]]) }), 'T-1', 'review');
  expect(roundText(clean)).not.toContain('Added code:');

  // a version 1 record at the cut-over is refused with the way to convert it; below it, it is answered as at the baseline
  const atCutOver = nextRound(scopeSnapshot({ review: V1, facts: { pin: RECORD_V2_FROM, heads: [{ high: H(1) }], ranges: [] } }), 'T-1', 'review');
  expect(atCutOver.kind).toBe('refused');
  expect(atCutOver.reasons.join('\n')).toContain('Round record: 2');
  const below = nextRound(scopeSnapshot({ review: V1, facts: { pin: '0.3.0', heads: [], ranges: [] } }), 'T-1', 'review');
  expect(below.kind).toBe('next');
  expect(below.round).toBe(2);
  expect(roundText(below)).toBe('Round: 2 of 5\nCycle: 1\nFix executor model: sonnet\n');
});
