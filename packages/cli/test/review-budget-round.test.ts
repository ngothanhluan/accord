// Phase 10 D-06 (as amended per slice), D-15, 10-ac-4, 10-ac-11, 10-ac-30, 10-ac-31: `accord round <id>` for the review loop of a lane M ticket on real git. A ticket whose claim commit holds 0.24.0 has
// a budget of three review rounds with a count-fall stop; a ticket claimed under 0.23.1 keeps the five rounds and the stop from round 3.
import { expect, it } from 'vitest';
import { cleanup, run } from './helpers/repo.js';
import { fixReport, must, reviewed, should, shoulds } from './helpers/review-budget.js';

const NONE: string[] = [];
const verdict = '\nverdict: accepted-by-owner "ship it with the comma issue open"\n';

interface Found { rule: string; level: string; reason: string }
const roundsGate = async (repo: string): Promise<{ code: number; found: Found[] }> => {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return { code: r.code, found: (JSON.parse(r.out) as { findings: Found[] }).findings.filter((f) => f.rule === 'gate.review-rounds') };
};

it('risk:regression accord round stops for the owner before a fourth review round, even when the count falls each round (10-ac-4, D-06)', async () => {
  const repo = reviewed('0.24.0', [{ lines: shoulds(3) }, { lines: shoulds(2) }, { lines: shoulds(1) }]);
  try {
    const answer = await run(['round', 'T-1'], repo);
    expect(answer.err).toBe('');
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(answer.out).toContain('budget of 3 review rounds');
    expect(answer.out).toContain('D-06');
    expect(answer.out).toContain(should(1));
    expect(answer.out).not.toContain('Round: 4');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round stops when the Must + Should count did not fall, and goes on when it fell (10-ac-4, D-06)', async () => {
  const flat = reviewed('0.24.0', [{ lines: shoulds(2) }, { lines: shoulds(2) }]);
  const falling = reviewed('0.24.0', [{ lines: shoulds(2) }, { lines: shoulds(1) }]);
  try {
    const stop = await run(['round', 'T-1'], flat);
    expect(stop.code).toBe(1);
    expect(stop.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(stop.out).toContain('the count did not fall');
    const next = await run(['round', 'T-1'], falling);
    expect(next.code).toBe(0);
    expect(next.out).toContain('Round: 3 of 3\n');
  } finally {
    cleanup(flat);
    cleanup(falling);
  }
}, 120_000);

it('risk:security an open data-loss or security finding at the budget stop makes gate done refuse after accepted-by-owner, and an ordinary one does not (10-ac-4, D-06, T-10-04)', async () => {
  const risky = reviewed('0.24.0', [{ lines: shoulds(3) }, { lines: [should(1), must(2, 'open', 'risk: security')] }, { lines: shoulds(1) }], { tail: verdict });
  const ordinary = reviewed('0.24.0', [{ lines: shoulds(3) }, { lines: shoulds(2) }, { lines: shoulds(1) }], { tail: verdict });
  try {
    const refused = await roundsGate(risky);
    expect(refused.code).toBe(1);
    expect(refused.found).toHaveLength(1);
    expect(refused.found[0].reason).toContain('risk: security');
    expect(refused.found[0].reason).toContain('2.2');
    expect(refused.found[0].reason).toContain('Ruling: the owner allows');
    expect((await roundsGate(ordinary)).found).toEqual([]);
  } finally {
    cleanup(risky);
    cleanup(ordinary);
  }
}, 120_000);

it('risk:regression a ticket claimed under 0.23.1 keeps the cap of 5 and the stop from round 3 byte for byte (10-ac-11)', async () => {
  const clean = reviewed('0.23.1', [{ lines: shoulds(2) }, { lines: shoulds(1) }, { lines: NONE }]);
  const stopped = reviewed('0.23.1', [{ lines: shoulds(3) }, { lines: shoulds(2) }, { lines: shoulds(1) }]);
  try {
    const next = await run(['round', 'T-1'], clean);
    expect(next.out).toContain('Round: 4 of 5\n');
    expect(next.code).toBe(0);
    const stop = await run(['round', 'T-1'], stopped);
    expect(stop.code).toBe(1);
    expect(stop.out.split('\n').slice(0, 2)).toEqual(['stop: report to owner', 'Reason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop']);
  } finally {
    cleanup(clean);
    cleanup(stopped);
  }
}, 120_000);

const asked = async (repo: string): Promise<{ code: number; out: string }> => {
  const r = await run(['round', 'T-1'], repo);
  expect(r.err).toBe('');
  return { code: r.code, out: r.out };
};

it('risk:regression the final review and its one re-check are outside the budget: a re-check that answers its fix gives the verdict answer and no stop (10-ac-30, D-15)', async () => {
  const repo = reviewed('0.24.0', [
    { lines: shoulds(1) },
    { lines: NONE },
    { final: true, lines: [should(1, 'fixed in <head> — checked: src/a.ts:1 — addressed: src/a.ts:1')] },
    { lines: NONE },
  ]);
  try {
    fixReport(repo, ['3.1']);
    const answer = await asked(repo);
    expect(answer.code).toBe(1);
    expect(answer.out).toContain('reported no findings');
    expect(answer.out).not.toContain('stop: report to owner');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression after a budget of three rounds the final review is a fourth round and its re-check a fifth, outside the budget; a sixth is past them (10-ac-30, D-15)', async () => {
  const used = [{ lines: shoulds(2) }, { lines: shoulds(1) }, { lines: NONE }];
  const finalReview = { final: true as const, lines: shoulds(1) };
  const afterBudget = reviewed('0.24.0', used);
  const recorded = reviewed('0.24.0', [...used, finalReview]);
  const rechecked = reviewed('0.24.0', [...used, finalReview, { lines: shoulds(1) }]);
  const past = reviewed('0.24.0', [...used, finalReview, { lines: NONE }, { lines: NONE }]);
  try {
    expect((await asked(afterBudget)).out).toContain('Round: 4 of 5\n');
    const next = await asked(recorded);
    expect(next.code).toBe(0);
    expect(next.out).toContain('Round: 5 of 5\n');
    // a Must or Should still open after that one re-check: a stop for the owner that names the final review's fix and re-check as used
    const stop = await asked(rechecked);
    expect(stop.code).toBe(1);
    expect(stop.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(stop.out).toContain("the final review's one fix and one re-check (D-15) are used");
    // a round 6 is past them, and no owner Ruling in the ledger allows it
    const sixth = await asked(past);
    expect(sixth.code).toBe(1);
    expect(sixth.out).toContain("past the final review's one fix and one re-check (D-15)");
  } finally {
    cleanup(afterBudget);
    cleanup(recorded);
    cleanup(rechecked);
    cleanup(past);
  }
}, 180_000);

it('risk:regression a budget stop names the round-1 findings still open as a possible intent problem, and none when they are a risk (10-ac-31, D-15)', async () => {
  const rounds = (risk: string[]) => [{ lines: [should(1, 'open', ...risk)] }, { lines: [should(1, 'open', 'carried from 1.1'), should(2)] }];
  const plain = reviewed('0.24.0', rounds([]));
  const risky = reviewed('0.24.0', rounds(['risk: security']));
  try {
    const stop = await asked(plain);
    expect(stop.code).toBe(1);
    expect(stop.out.split('\n').filter((l) => l.startsWith('Intent:'))).toEqual(['Intent: 1.1 raised in round 1 and still open: they may be an intent problem (the criterion or the approach), not a code fix; ask the owner']);
    // the findings keep their class: the stop lists them as findings, and 2.2, first raised in round 2, is not named
    expect(stop.out).toContain('Findings of round 2:');
    const hard = await asked(risky);
    expect(hard.code).toBe(1);
    expect(hard.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(hard.out).not.toContain('Intent:');
  } finally {
    cleanup(plain);
    cleanup(risky);
  }
}, 120_000);
