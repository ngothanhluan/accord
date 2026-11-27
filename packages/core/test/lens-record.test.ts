// Phase 11 plan 06 (11-ac-6, D-05): a version 2 review round records `Lens: <name> ran` for each team lens its own package printed; `accord round` refuses a round that does not, naming the
// dispatch to run. The rule reads one host fact (lensFacts), recomputed from git and the lens files, never the record's own lines.
import { expect, it } from 'vitest';
import { LENSES_FROM, lensOn, lensProblems, nextRound, parseRounds } from '../src/index.js';
import type { LensFacts, RepoSnapshot } from '../src/index.js';
import { claimedUnder, facts, H, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const REVIEW = 'accord/tickets/T-1/review.md';
const reviewOf = (text: string, head = 'Round record: 2') => parseRounds(REVIEW, `${head}\n\n${text}`, 'review');
const ran = 'Lens: db ran';

/** A review snapshot claimed under `pin`; `fact` is the host's lens fact, by default one entry per recorded round that lists `lenses[j - 1]`. */
function build(o: { cycles: RoundSpec[][]; lenses?: string[][]; pin?: string; fact?: LensFacts }): RepoSnapshot {
  const count = o.cycles.flat().length;
  const snap = scopeSnapshot({ review: v2Review(o.cycles), facts: facts(Array.from({ length: count }, () => [])) });
  const claimed = claimedUnder(snap, o.pin ?? LENSES_FROM);
  const fact: LensFacts = o.fact ?? { rounds: Array.from({ length: count }, (_, j) => ({ head: H(j + 1), lenses: o.lenses?.[j] ?? [] })), modes: { db: 'ask' } };
  return { ...claimed, lensFacts: { 'T-1': fact } } as RepoSnapshot;
}
const problems = (snap: RepoSnapshot) => lensProblems(snap, 'T-1');

it("risk:parsing a version 2 review round's Lens line reads one way, and any other form is kept as unread with its line (11-ac-6, D-05)", () => {
  const at = (line: string, head = 'Round record: 2') => reviewOf(`## Round 1 head abc1234\n\nNo findings\n${line}\n`, head).cycles[0].rounds[0];
  expect(at(ran)).toMatchObject({ lenses: ['db'] });
  expect(at('- ' + ran)).toMatchObject({ lenses: ['db'] });
  expect(at('LENS: api-v2 ran')).toMatchObject({ lenses: ['api-v2'] });
  // several lines are kept in order, and a lens named twice is kept once
  const two = reviewOf(`## Round 1 head abc1234\n\nNo findings\nLens: db ran\nLens: ui2 ran\nLens: db ran\n`).cycles[0].rounds[0];
  expect(two.lenses).toEqual(['db', 'ui2']);
  expect(two).not.toHaveProperty('lensUnread');
  // a line that is not `Lens: <name> ran` with a lens name is unread, with its line
  for (const bad of ['Lens: db', 'Lens: DB ran', 'Lens: db ran twice', 'Lens:', 'Lens: -db ran', 'Lens: db ran.']) {
    const round = at(bad);
    expect(round.lenses, bad).toBeUndefined();
    expect(round.lensUnread, bad).toEqual([{ line: 6, text: bad }]);
  }
  // the line is no record problem, and a round without it holds neither field
  expect(reviewOf(`## Round 1 head abc1234\n\nNo findings\n${ran}\n`).unreadable).toEqual([]);
  expect(at('prose')).not.toHaveProperty('lenses');
  // a version 1 record and a plan or approach record read every such line as prose
  expect(at(ran, 'Round record: 1')).not.toHaveProperty('lenses');
  for (const kind of ['plan', 'approach'] as const) {
    const r = parseRounds('accord/tickets/T-1/' + kind + '-review.md', `Round record: 1\n\n## Round 1\n\nNo findings\n${ran}\nLens: db\n`, kind).cycles[0].rounds[0];
    expect(r, kind).not.toHaveProperty('lenses');
    expect(r, kind).not.toHaveProperty('lensUnread');
  }
});

it('risk:regression a round whose package printed lens db and records no "Lens: db ran" is refused by accord round, naming the dispatch (11-ac-6, D-05)', () => {
  expect(LENSES_FROM).toBe('0.23.0');
  const skipped = build({ cycles: [[{ lines: ['No findings'] }]], lenses: [['db']] });
  expect(lensOn(skipped, 'T-1')).toBe(true);
  const found = problems(skipped);
  expect(found).toHaveLength(1);
  expect(found[0].line).toBe(3);
  expect(found[0].reason).toContain('round 1 of cycle 1');
  expect(found[0].reason).toContain('lens db (on_finding ask)');
  expect(found[0].reason).toContain('accord review-package T-1 --lens db --round 1 --out lens-db-1.md');
  expect(found[0].reason).toContain('dispatch accord-reviewer with lens db');
  expect(found[0].reason).toContain('"Lens: db ran"');
  const answer = nextRound(skipped, 'T-1', 'review');
  expect(answer.kind).toBe('refused');
  expect(answer.reasons.join('\n')).toContain('accord review-package T-1 --lens db --round 1');

  // the same record with the line is not refused for the lens
  const withLine = build({ cycles: [[{ lines: ['No findings', ran] }]], lenses: [['db']] });
  expect(problems(withLine)).toEqual([]);
  expect(nextRound(withLine, 'T-1', 'review').reasons.join('\n')).not.toContain('lens');

  // a round whose package printed no lens needs no line; a line for a lens the package did not print is not a problem
  expect(problems(build({ cycles: [[{ lines: ['No findings'] }]], lenses: [[]] }))).toEqual([]);
  expect(problems(build({ cycles: [[{ lines: ['No findings', ran] }]], lenses: [[]] }))).toEqual([]);
});

it('risk:regression the required list is the host fact, never the record: a (final review) round needs its line, a later fix round none, and a fact that does not fit the record cannot be checked (11-ac-6, D-05)', () => {
  // round 1 printed db and ran it; round 2 is a fix round (no lens); round 3 is the final review, which printed db and is not exempt
  const cycles: RoundSpec[][] = [[{ lines: ['No findings', ran] }, { lines: ['No findings'] }, { lines: ['No findings'], mark: 'final' }]];
  const open = problems(build({ cycles, lenses: [['db'], [], ['db']] }));
  expect(open).toHaveLength(1);
  expect(open[0].reason).toContain('round 3 of cycle 1');
  expect(open[0].reason).toContain('--round 3');
  expect(problems(build({ cycles: [[{ lines: ['No findings', ran] }, { lines: ['No findings'] }, { lines: ['No findings', ran], mark: 'final' }]], lenses: [['db'], [], ['db']] }))).toEqual([]);

  // the record's own lines never decide which lenses were required: a fact with no lens needs none, whatever the record says
  expect(problems(build({ cycles: [[{ lines: ['No findings', 'Lens: other ran'] }]], lenses: [[]] }))).toEqual([]);

  // a fact whose rounds count differs from the record's, and a fact that failed, are one "cannot be checked" problem each
  const mismatch = problems(build({ cycles: [[{ lines: ['No findings'] }]], fact: { rounds: [], modes: {} } }));
  expect(mismatch).toHaveLength(1);
  expect(mismatch[0].reason).toContain('cannot be checked');
  const failed = problems(build({ cycles: [[{ lines: ['No findings'] }]], fact: { error: 'git failed' } }));
  expect(failed).toHaveLength(1);
  expect(failed[0].reason).toContain('cannot be checked: git failed');

  // an unread Lens line is a problem naming its line
  const unread = problems(build({ cycles: [[{ lines: ['No findings', 'Lens: db'] }]], lenses: [[]] }));
  expect(unread).toHaveLength(1);
  expect(unread[0]).toMatchObject({ line: 6 });
  expect(unread[0].reason).toContain('"Lens: db" is not read');
});

it('risk:regression a ticket claimed before LENSES_FROM, or a record with no fact, is not asked for a Lens line (11-ac-6, D-05)', () => {
  const old = build({ cycles: [[{ lines: ['No findings'] }]], lenses: [['db']], pin: '0.22.0' });
  expect(lensOn(old, 'T-1')).toBe(false);
  expect(problems(old)).toEqual([]);
  const none = { ...build({ cycles: [[{ lines: ['No findings'] }]], lenses: [['db']] }), lensFacts: undefined } as RepoSnapshot;
  expect(problems(none)).toEqual([]);
});
