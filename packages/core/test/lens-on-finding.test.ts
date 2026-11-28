// Phase 11 plan 08 (11-ac-7, D-06): a finding a team lens made carries ` — lens: <name>`; what it does follows the lens's `on_finding`: `warn` is listed and never blocks, `block` blocks as a built-in lens's finding
// does, `ask` (the default) is put to the owner at the end of the loop, and a `risk:` finding blocks under all three. The mark is honoured only for a lens the finding's own round printed, by the host's lens fact.
import { expect, it } from 'vitest';
import { LENSES_FROM, gateDone, lensAsks, lensDeferred, lensFindings, lensMarkProblems, nextRound, parseRounds, roundText } from '../src/index.js';
import type { LensFacts, LensMode, RepoSnapshot, RoundAnswer } from '../src/index.js';
import { claimedUnder, facts, H, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const REVIEW = 'accord/tickets/T-1/review.md';
const ran = 'Lens: db ran';
const reviewOf = (text: string) => parseRounds(REVIEW, `Round record: 2\n\n${text}`, 'review');

/** A review snapshot claimed under `pin`: `lenses[j - 1]` is what the package of the j-th round printed, `modes` the lens files' `on_finding`, `ledger` text added under ## Rulings and ## Deferred. */
function build(o: { cycles: RoundSpec[][]; lenses: string[][]; modes?: Record<string, LensMode>; pin?: string; fact?: LensFacts | null; ledger?: string; tail?: string }): RepoSnapshot {
  const count = o.cycles.flat().length;
  const snap = scopeSnapshot({ review: v2Review(o.cycles, o.tail), facts: facts(Array.from({ length: count }, () => [])), ...(o.ledger === undefined ? {} : { ledger: o.ledger }) });
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

// A lens's findings and a verdict line after the last round. The first round of a ticket prints the lens; a finding of its own is `Should 1` of round 1, the fix round after it records nothing.
const askRounds = (...first: string[]): RoundSpec[][] => [[{ lines: [...first, ran] }, { lines: ['No findings'] }]];
const ASK_LENSES = [['db'], []];
const quoted = '\nverdict: accepted-by-owner "ship it, the owner read the finding"\n';
const converged = '\nverdict: converged\n';
const deferredLine = '\n## Deferred\n- review 1.1: a query is built from a string — failing case: none yet\n';
const asDeferred = (line: string): string => line.replace(' — open', ' — deferred');

it('risk:regression a block lens stops the loop on its open Must as a built-in lens does, and Done needs the owner to accept it (11-ac-7, D-06)', () => {
  const cycles = withFinal([db('Must', 1)]);
  const block = build({ cycles, lenses: FINAL_LENSES, modes: { db: 'block' } });
  const answer = answerOf(block);
  expect(answer.kind).toBe('stop');
  expect(answer).not.toHaveProperty('ask');
  expect(answer).not.toHaveProperty('warn');
  expect(answer.reasons.join('\n')).toContain('still reports a Should or a Must');
  expect(lensDeferred(block, 'T-1', 0).size).toBe(0);
  const open = doneRounds(block);
  expect(open).toHaveLength(1);
  expect(open[0].reason).toContain('accepted-by-owner');
  // a built-in finding in the same place reads the same
  const builtIn = build({ cycles: withFinal(['Must 1: a query is built from a string — src/db/x.ts:3 — open']), lenses: FINAL_LENSES, modes: { db: 'block' } });
  expect(answerOf(builtIn).kind).toBe('stop');
  expect(doneRounds(builtIn).map((f) => f.reason)).toEqual(open.map((f) => f.reason));
  // the owner's quoted verdict passes Done
  expect(doneRounds(build({ cycles, lenses: FINAL_LENSES, modes: { db: 'block' }, tail: quoted }))).toEqual([]);
});

it('risk:regression an ask lens (the default) puts its open Should to the owner at the end of the loop: no executor, one ask line per finding (11-ac-7, D-06)', () => {
  const ask = build({ cycles: askRounds(db('Should', 1)), lenses: ASK_LENSES });
  const answer = answerOf(ask);
  expect(answer.kind).toBe('stop');
  expect(answer.ask).toEqual(['1.1 lens db']);
  expect(answer.reasons.join('\n')).toContain("lens db's, which asks the owner (on_finding: ask): put each to the owner");
  expect(answer.findings).toEqual([{ round: 1, lines: [expect.stringContaining('Should 1: a query is built from a string')] }]);
  expect(answer).not.toHaveProperty('model');
  const text = roundText(answer);
  expect(text).toContain('stop: report to owner');
  expect(text).toContain('ask: 1.1 lens db: the owner decides: fix, defer with a ## Deferred line, or accept with verdict: accepted-by-owner');
  expect(text).not.toContain('warn:');

  // another open Must or Should of the cycle goes on as before: a fix executor is sent for it, and the ask finding waits
  const mixed = build({ cycles: askRounds(db('Should', 1), 'Must 2: a plain finding — src/a.ts:9 — open'), lenses: ASK_LENSES });
  const next = answerOf(mixed);
  expect(next.kind).toBe('next');
  expect(next).not.toHaveProperty('ask');

  // a finding the owner no longer has to decide: fixed, and the loop's re-review round has answered it
  const fixedAsk = build({ cycles: askRounds('Should 1: a query is built from a string — src/db/x.ts:3 — fixed in abc1234 — checked: src/db/x.ts:3 — addressed: src/db/x.ts:3 — lens: db'), lenses: ASK_LENSES });
  expect(lensAsks(fixedAsk, 'T-1', 0)).toEqual([]);
  expect(answerOf(fixedAsk).kind).not.toBe('stop');
});

it('risk:regression an ask finding is decided by a fix, a deferral with its ledger line, or the quoted owner verdict, and Done refuses it otherwise (11-ac-7, D-06)', () => {
  const cycles = askRounds(db('Should', 1));
  const undecided = build({ cycles, lenses: ASK_LENSES, tail: converged });
  expect(lensAsks(undecided, 'T-1', 0)).toHaveLength(1);
  const refused = doneRounds(undecided);
  expect(refused).toHaveLength(1);
  expect(refused[0].reason).toContain('finding 1');
  expect(refused[0].reason).toContain('lens db asks the owner');
  expect(refused[0].reason).toContain('verdict: accepted-by-owner');
  expect(refused[0].reason).toContain('- review 1.1');

  // the owner's "defer": the finding written deferred and the ledger line naming 1.1 leave the stop, and Done passes after converged
  const deferred = build({ cycles: askRounds(asDeferred(db('Should', 1))), lenses: ASK_LENSES, ledger: deferredLine, tail: converged });
  expect(lensAsks(deferred, 'T-1', 0)).toEqual([]);
  expect(answerOf(deferred).kind).not.toBe('stop');
  expect(doneRounds(deferred)).toEqual([]);
  // written deferred without the ledger line is no deferral, and the ledger line of another finding does not decide this one
  const noLine = build({ cycles: askRounds(asDeferred(db('Should', 1))), lenses: ASK_LENSES, tail: converged });
  expect(lensAsks(noLine, 'T-1', 0)).toHaveLength(1);
  expect(doneRounds(noLine)).toHaveLength(1);
  const other = build({ cycles: askRounds(asDeferred(db('Should', 1))), lenses: ASK_LENSES, ledger: deferredLine.replace('1.1', '1.2'), tail: converged });
  expect(lensAsks(other, 'T-1', 0)).toHaveLength(1);

  // the owner's "accept": the quoted verdict passes Done, a bare one does not
  expect(doneRounds(build({ cycles, lenses: ASK_LENSES, tail: quoted }))).toEqual([]);
  expect(doneRounds(build({ cycles, lenses: ASK_LENSES, tail: '\nverdict: accepted-by-owner\n' }))).toHaveLength(1);
});

it('risk:security a finding marked risk: security or risk: data-loss blocks under warn, ask and block alike: never listed, never asked, never deferred (11-ac-7, D-06)', () => {
  for (const mode of ['warn', 'ask', 'block'] as const) {
    for (const kind of ['security', 'data-loss'] as const) {
      const what = `${mode} ${kind}`;
      const snap = build({ cycles: withFinal([db('Must', 1, `risk: ${kind}`, 'lens: db')]), lenses: FINAL_LENSES, modes: { db: mode } });
      const answer = answerOf(snap);
      expect(answer.kind, what).toBe('stop');
      expect(answer, what).not.toHaveProperty('warn');
      expect(answer, what).not.toHaveProperty('ask');
      expect(lensDeferred(snap, 'T-1', 0).size, what).toBe(0);
      expect(lensAsks(snap, 'T-1', 0), what).toEqual([]);
      expect(roundText(answer), what).not.toMatch(/^(?:warn|ask):/m);
      expect(doneRounds(snap), what).toHaveLength(1);
    }
  }
  // a finding that carries a risk finding of an earlier round reads the same
  const carried = build({
    cycles: [[{ lines: [db('Must', 1, 'risk: security', 'lens: db'), ran] }, { lines: ['No findings'] }, { lines: [db('Must', 1, 'carried from 1.1', 'lens: db'), ran], mark: 'final' }]],
    lenses: FINAL_LENSES,
    modes: { db: 'warn' },
  });
  expect(lensDeferred(carried, 'T-1', 0).size).toBe(0);
  expect(answerOf(carried).kind).toBe('stop');
  // written deferred, a risk finding is no deferral under any lens
  const deferred = build({ cycles: withFinal([asDeferred(db('Must', 1, 'risk: security', 'lens: db'))]), lenses: FINAL_LENSES, modes: { db: 'warn' }, ledger: deferredLine.replace('1.1', '3.1') });
  expect(answerOf(deferred).kind).toBe('stop');
  expect(lensAsks(deferred, 'T-1', 0)).toEqual([]);
});

/** The line of review.md that starts with `prefix`, from the record the snapshot was built from. */
const lineOf = (cycles: RoundSpec[][], prefix: string): number => v2Review(cycles).split('\n').findIndex((l) => l.startsWith(prefix)) + 1;
const marks = (snap: RepoSnapshot) => lensMarkProblems(snap, 'T-1');
/** Round 1 (prints the lenses) with nothing, then round 2, a fix round whose package printed none, holding `last`. */
const laterRound = (last: string): RoundSpec[][] => [[{ lines: ['No findings', ran] }, { lines: [last] }]];

it('risk:security a lens mark cannot turn a built-in finding into a warning: a later round, a built-in name and a lens with no file are record problems with their line (11-ac-7, D-06)', () => {
  // round 2 is a fix round: its package printed no lens, so the mark is forged or misplaced
  const cycles = laterRound(db('Must', 1));
  const snap = build({ cycles, lenses: [['db'], []], modes: { db: 'warn' } });
  const found = marks(snap);
  expect(found).toHaveLength(1);
  expect(found[0].line).toBe(lineOf(cycles, 'Must 1'));
  expect(found[0].reason).toContain('round 2 printed no team lens');
  // accord round refuses it with the line, and gate done reports it as a review-rounds finding at the same line
  const answer = answerOf(snap);
  expect(answer.kind).toBe('refused');
  expect(answer.reasons.join('\n')).toContain(`line ${found[0].line}: round 2 of cycle 1, finding 1: round 2 printed no team lens`);
  const done = doneRounds(snap);
  expect(done.some((f) => f.line === found[0].line && f.reason.includes('round 2 printed no team lens'))).toBe(true);
  // and the mark does nothing: the finding is no warning
  expect(lensDeferred(snap, 'T-1', 0).size).toBe(0);
  expect(answer).not.toHaveProperty('warn');

  // a built-in lens name: its finding carries no lens mark
  for (const name of ['quality', 'ui']) {
    const built = build({ cycles: [[{ lines: [db('Must', 1, `lens: ${name}`), ran] }]], lenses: [['db']], modes: { db: 'warn' } });
    const p = marks(built);
    expect(p, name).toHaveLength(1);
    expect(p[0].reason, name).toContain(`lens ${name} is a built-in lens`);
    expect(answerOf(built).kind, name).toBe('refused');
    expect(doneRounds(built).some((f) => f.reason.includes('built-in lens')), name).toBe(true);
  }

  // a lens with no file at the default branch is named
  const perf = build({ cycles: [[{ lines: [db('Must', 1, 'lens: perf'), ran] }]], lenses: [['db']], modes: { db: 'warn' } });
  expect(marks(perf)).toHaveLength(1);
  expect(marks(perf)[0].reason).toContain('no lens perf exists at the default branch (accord/lenses/perf.md)');
  expect(answerOf(perf).reasons.join('\n')).toContain('perf');

  // a lens the round's package did not print, though another did
  const other = build({ cycles: [[{ lines: [db('Must', 1, 'lens: api'), ran] }]], lenses: [['db']], modes: { db: 'warn', api: 'warn' } });
  expect(marks(other)[0].reason).toContain("round 1's review package printed lens db, not api");
});

it('risk:security a forged mark never lowers a finding: it is refused, honoured nowhere, and a lens the round did print is no problem (11-ac-7, D-06)', () => {
  // the honoured mark (round 1 printed db) is no problem
  expect(marks(build({ cycles: [[{ lines: [db('Must', 1), ran] }]], lenses: [['db']], modes: { db: 'warn' } }))).toEqual([]);
  expect(marks(build({ cycles: withFinal([db('Should', 1)]), lenses: FINAL_LENSES }))).toEqual([]);
  // a forged mark on the stopping round of a block-or-warn loop: round 3 is a plain fix round, so the mark is a problem and the finding stops the loop as a built-in one does
  const forged = build({ cycles: [[{ lines: ['No findings', ran] }, { lines: ['No findings'] }, { lines: [db('Must', 1)] }]], lenses: FINAL_LENSES.map((l, j) => (j === 2 ? [] : l)), modes: { db: 'warn' } });
  expect(marks(forged)).toHaveLength(1);
  expect(lensFindings(forged, 'T-1')).toEqual([]);
  expect(answerOf(forged).kind).toBe('refused');
  expect(doneRounds(forged).length).toBeGreaterThan(0);
  // a mark that names a lens, with a fact that says nothing about it, blocks and is refused only for what needs no fact (a built-in name)
  const nofact = build({ cycles: [[{ lines: [db('Must', 1, 'lens: perf'), ran] }]], lenses: [['db']], fact: null });
  expect(marks(nofact)).toEqual([]);
  expect(lensFindings(nofact, 'T-1')).toEqual([]);
  const builtinNoFact = build({ cycles: [[{ lines: [db('Must', 1, 'lens: security'), ran] }]], lenses: [['db']], fact: null });
  expect(marks(builtinNoFact)).toHaveLength(1);
  // a failed fact is "cannot be checked" from lensProblems, and no second problem is added here for a named lens
  const failed = build({ cycles: [[{ lines: [db('Must', 1), ran] }]], lenses: [['db']], fact: { error: 'git failed' } });
  expect(marks(failed)).toEqual([]);
});

it('risk:regression a ticket claimed before LENSES_FROM reads a lens mark as before: no problem, no effect (11-ac-7, D-06)', () => {
  const old = build({ cycles: laterRound(db('Must', 1)), lenses: [['db'], []], modes: { db: 'warn' }, pin: '0.22.0' });
  expect(marks(old)).toEqual([]);
  expect(lensFindings(old, 'T-1')).toEqual([]);
  expect(answerOf(old).reasons.join('\n')).not.toContain('lens');
  const oldBuiltIn = build({ cycles: [[{ lines: [db('Must', 1, 'lens: quality'), ran] }]], lenses: [['db']], pin: '0.22.0' });
  expect(marks(oldBuiltIn)).toEqual([]);
  expect(doneRounds(oldBuiltIn).some((f) => f.reason.includes('built-in lens'))).toBe(false);
});
