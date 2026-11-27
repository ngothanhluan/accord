// Phase 11 plan 08 (11-ac-7, D-06): a finding a team lens made carries ` — lens: <name>`; what it does follows the lens's `on_finding`: `warn` is listed and never blocks, `block` blocks as a built-in lens's finding
// does, `ask` (the default) is put to the owner at the end of the loop, and a `risk:` finding blocks under all three. The mark is honoured only for a lens the finding's own round printed, by the host's lens fact.
import { expect, it } from 'vitest';
import { LENSES_FROM, gateDone, lensDeferred, nextRound, parseRounds, roundText } from '../src/index.js';
import type { LensFacts, LensMode, RepoSnapshot, RoundAnswer } from '../src/index.js';
import { claimedUnder, facts, H, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const REVIEW = 'accord/tickets/T-1/review.md';
const ran = 'Lens: db ran';
const reviewOf = (text: string) => parseRounds(REVIEW, `Round record: 2\n\n${text}`, 'review');

/** A review snapshot claimed under `pin`: `lenses[j - 1]` is what the package of the j-th round printed, `modes` the lens files' `on_finding`, `ledger` text added under ## Rulings and ## Deferred. */
function build(o: { cycles: RoundSpec[][]; lenses: string[][]; modes?: Record<string, LensMode>; pin?: string; fact?: LensFacts | null; ledger?: string }): RepoSnapshot {
  const count = o.cycles.flat().length;
  const snap = scopeSnapshot({ review: v2Review(o.cycles), facts: facts(Array.from({ length: count }, () => [])), ...(o.ledger === undefined ? {} : { ledger: o.ledger }) });
  const claimed = claimedUnder(snap, o.pin ?? LENSES_FROM);
  if (o.fact === null) return claimed;
  const fact: LensFacts = o.fact ?? { rounds: Array.from({ length: count }, (_, j) => ({ head: H(j + 1), lenses: o.lenses[j] ?? [] })), modes: o.modes ?? { db: 'ask' } };
  return { ...claimed, lensFacts: { 'T-1': fact } } as RepoSnapshot;
}

/** The finding line of a lens `db` finding: a Must or a Should in `src/db/x.ts`, open, marked. */
const db = (severity: 'Must' | 'Should', n: number, ...tail: string[]): string => `${severity} ${n}: a query is built from a string — src/db/x.ts:3 — open${tail.length === 0 ? ' — lens: db' : ' — ' + tail.join(' — ')}`;

/** One cycle: a first round with nothing, a fix round with nothing, and a `(final review)` round (which prints the lenses again) holding `last`. */
const withFinal = (last: string[]): RoundSpec[][] => [[{ lines: ['No findings', ran] }, { lines: ['No findings'] }, { lines: [...last, ran], mark: 'final' }]];
const FINAL_LENSES = [['db'], [], ['db']];

const answerOf = (snap: RepoSnapshot): RoundAnswer => nextRound(snap, 'T-1', 'review');
const doneRounds = (snap: RepoSnapshot) => gateDone(snap, 'T-1').findings.filter((f) => f.rule === 'gate.review-rounds');

it('risk:parsing the review finding mark `lens: <name>` is read with the other marks in any order, and a second one makes the line unreadable (11-ac-7, D-06)', () => {
  const round = (line: string) => reviewOf(`## Round 1 head abc1234\n\n${line}\n`).cycles[0].rounds[0];
  const at = round(db('Must', 1));
  expect(at.findings[0]).toMatchObject({ severity: 'Must', n: 1, state: 'open', lens: 'db' });
  expect(round(db('Should', 2, 'lens: db', 'risk: security')).findings[0]).toMatchObject({ lens: 'db', risk: 'security' });
  expect(round(db('Should', 2, 'risk: data-loss', 'lens: db')).findings[0]).toMatchObject({ lens: 'db', risk: 'data-loss' });
  expect(round('Must 1: text — src/a.ts:3 — open').findings[0]).not.toHaveProperty('lens');
  // a second lens mark on one line, and a name that is no lens name, leave the line unreadable
  for (const line of [db('Must', 1, 'lens: db', 'lens: api'), 'Must 1: text — src/a.ts:3 — open — lens: DB', 'Must 1: text — src/a.ts:3 — open — lens:']) {
    const r = reviewOf(`## Round 1 head abc1234\n\n${line}\n`);
    expect(r.unreadable.length, line).toBeGreaterThan(0);
    expect(r.cycles[0].rounds[0].findings, line).toEqual([]);
  }
  // a version 1 record, a plan record and an approach record read no lens mark
  const plan = parseRounds('accord/tickets/T-1/plan-review.md', 'Round record: 1\n\n## Round 1\n\nMust 1. text — open — lens: db\n', 'plan').cycles[0].rounds[0].findings[0];
  expect(plan).not.toHaveProperty('lens');
});

it('risk:regression a warn lens leaves the loop: its open Must of the final review is no stop, no Done finding, and a warn line for the verify report (11-ac-7, D-06)', () => {
  const cycles = withFinal([db('Must', 1)]);
  const warn = build({ cycles, lenses: FINAL_LENSES, modes: { db: 'warn' } });
  const answer = answerOf(warn);
  expect(answer.kind).toBe('next');
  expect(answer.round).toBe(4);
  expect(answer.warn).toEqual(['3.1 lens db']);
  expect(roundText(answer)).toContain('warn: 3.1 lens db: listed in the verify report, never blocks');
  expect(doneRounds(warn)).toEqual([]);
  expect(lensDeferred(warn, 'T-1', 0).size).toBe(1);

  // fail safe: no lens fact, a ticket claimed before LENSES_FROM, and a failed fact all read the same record as blocking, as today
  for (const [what, snap] of [
    ['no fact', build({ cycles, lenses: FINAL_LENSES, fact: null })],
    ['claimed before', build({ cycles, lenses: FINAL_LENSES, modes: { db: 'warn' }, pin: '0.22.0' })],
    ['failed fact', build({ cycles, lenses: FINAL_LENSES, fact: { error: 'git failed' } })],
  ] as const) {
    const a = answerOf(snap);
    expect(a.kind === 'stop' || a.kind === 'refused', what).toBe(true);
    expect(a, what).not.toHaveProperty('warn');
    expect(lensDeferred(snap, 'T-1', 0).size, what).toBe(0);
  }
  const blocked = build({ cycles, lenses: FINAL_LENSES, fact: null });
  expect(answerOf(blocked).kind).toBe('stop');
  expect(doneRounds(blocked)).toHaveLength(1);
});

it('risk:regression only a Must or Should that is open counts for the warn line, and a fixed one or a Nice is not listed (11-ac-7, D-06)', () => {
  const warn = build({
    cycles: withFinal([db('Must', 1), `Should 2: another — src/db/y.ts:4 — fixed in abc1234 — checked: src/db/y.ts:4 — lens: db`, `Nice 3: tidy — src/db/z.ts:1 — open — lens: db`]),
    lenses: FINAL_LENSES,
    modes: { db: 'warn' },
  });
  expect(answerOf(warn).warn).toEqual(['3.1 lens db']);
});
