// BUG-LN-22 (the four Warnings of the round-7 review of PR #172, 03-group1-REVIEW7.md WR-01, WR-02, WR-04; WR-03 is skill text): the approach record's risk slot. The owner's group-1
// decisions stand: a risk is read from the finding's mark slot only (structural reading), and a kind written wrong fails closed. What these cases add is what those decisions already
// require of a slot that holds a sentence, and a documented fix that keeps the risk.
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, approvalBlockers, approvalFindings, approvalProblems, loadSnapshot, nextRound, parseRounds, recordProblems } from '../src/index.js';
import type { RepoSnapshot } from '../src/index.js';
import { PLAN_ROWS } from '../../../test/helpers/approach-corpus.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const one = (...lines: string[]): string => HEAD + '## Round 1 (whole)\n\n' + lines.join('\n') + '\n\n';

function repoOf(file: 'approach-review.md' | 'plan-review.md', text: string): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  building(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = LEDGER;
  files['accord/tickets/T-1/' + file] = text;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return { ...snapshot, claimPins: { 'T-1': { pin: APPROACH_CAP_FROM } } };
}
const approach = (text: string): RepoSnapshot => repoOf('approach-review.md', text);
const risks = (text: string): (string | undefined)[] =>
  parseRounds('accord/tickets/T-1/approach-review.md', text, 'approach').cycles.flatMap((c) => c.rounds.flatMap((r) => r.findings.map((f) => f.risk)));

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// WR-01: a slot value that is a sentence which starts with a kind word is prose, as `risk: none` and `risk: a partial file is left on a crash` are. It is never a record problem and never a mark.
const SENTENCE_FORMS: { name: string; text: string; listed: boolean }[] = [
  { name: 'risk: security is unaffected by this change', text: one('1. Must — tokens reach the log — risk: security is unaffected by this change — fixed — rests on: ac-1'), listed: false },
  { name: 'risk: data loss is ruled out by Task 2, after the state', text: one('1. Must — tokens reach the log — fixed — rests on: ac-1 — risk: data loss is ruled out by Task 2'), listed: false },
  { name: 'an unverified reason followed by risk: security is handled by the proxy', text: one('1. Must — tokens reach the log — unverified: the planner says Task 2 covers it — risk: security is handled by the proxy — rests on: ac-1'), listed: true },
  { name: 'a column-0 line Risk: security was reviewed under a fixed finding', text: one('1. Must — tokens reach the log — fixed — rests on: ac-1', 'Risk: security was reviewed by the critic and nothing was found.'), listed: false },
];
for (const f of SENTENCE_FORMS) {
  it(`risk:parsing a slot holding a sentence that starts with a kind word is prose: ${f.name} (BUG-LN-22 WR-01)`, () => {
    const s = approach(f.text);
    expect(recordProblems(s, 'T-1', 'approach')).toEqual([]);
    expect(approvalProblems(s, 'T-1')).toEqual([]);
    expect(risks(f.text), 'no finding carries a mark').toEqual([undefined]);
    expect(approvalBlockers(s, 'T-1')).toEqual([]);
    // an open finding is the short view's ordinary risk, never a blocking one
    expect(approvalFindings(s, 'T-1').risks.length > 0).toBe(f.listed);
  });
}

it('risk:parsing the same column-0 sentence in a plan record does not refuse round --plan (BUG-LN-22 WR-01)', () => {
  const text = one('1. Should — Task 1: header twice — fixed — rests on: ac-1', 'Risk: security was reviewed by the critic and nothing was found.');
  const s = repoOf('plan-review.md', text);
  expect(recordProblems(s, 'T-1', 'plan')).toEqual([]);
  expect(nextRound(s, 'T-1', 'plan').kind).toBe('next');
});

it('risk:parsing the group-1 decisions stand: the kind alone is read, and a kind written wrong still fails closed (BUG-LN-22 WR-01)', () => {
  const alone = one('1. Must — tokens reach the log — open — risk: security');
  expect(risks(alone)).toEqual(['security']);
  expect(approvalBlockers(approach(alone), 'T-1')).toHaveLength(1);
  for (const wrong of ['risk: security.', 'risk: data_loss', 'risks: security', 'risk: secrity', 'risk: data loss', 'risk: `security`', 'risk: data-lost', 'risk: Security risk', 'risk: data-loss issue']) {
    const text = one('1. Must — tokens reach the log — open — ' + wrong);
    expect(approvalProblems(approach(text), 'T-1').length, wrong).toBeGreaterThan(0);
  }
  // the column-0 line holding the kind alone is a misplaced mark, a record problem, as before
  expect(approvalProblems(approach(one('1. Must — tokens reach the log — open', 'risk: security')), 'T-1').length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// WR-02: the fix the release notes give for a misplaced column-0 `risk: security` line keeps the risk, and the problem says what is wrong with it.
const MISPLACED = one('1. Must — tokens reach the log — open', 'risk: security');

it('risk:parsing a misplaced column-0 risk line is a record problem that says the mark is not under its finding and gives the two rewrites that keep it (BUG-LN-22 WR-02)', () => {
  const problems = approvalProblems(approach(MISPLACED), 'T-1');
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain('a mark not under its finding');
  expect(problems[0]).not.toContain('a mark accord cannot read');
  expect(problems[0]).toContain(' — risk: security');
  expect(problems[0]).toContain('rests on: risk: security');
});

it('risk:parsing after the documented fix the open Must still blocks accord approve: the mark on the finding line, or an indented rests on line under it (BUG-LN-22 WR-02)', () => {
  const onTheLine = approach(one('1. Must — tokens reach the log — open — risk: security'));
  const indented = approach(one('1. Must — tokens reach the log — open', '   rests on: risk: security'));
  expect(approvalProblems(onTheLine, 'T-1')).toEqual([]);
  expect(approvalProblems(indented, 'T-1')).toEqual([]);
  expect(approvalBlockers(onTheLine, 'T-1').flatMap((b) => b.lines)).toEqual(['1. Must — tokens reach the log — open — risk: security']);
  expect(approvalBlockers(indented, 'T-1').flatMap((b) => b.lines)).toEqual(['1. Must — tokens reach the log — open']);
});

it('risk:parsing an indented line with no rests on key, or one after a blank line, stays a note: prose that keeps no risk, as the group-1 decisions have it (BUG-LN-22 WR-02)', () => {
  for (const text of [one('1. Must — tokens reach the log — open', '   risk: security'), one('1. Must — tokens reach the log — open', '', 'risk: security')]) {
    const s = approach(text);
    expect(approvalProblems(s, 'T-1')).toEqual([]);
    expect(approvalBlockers(s, 'T-1')).toEqual([]);
    expect(approvalFindings(s, 'T-1').risks.flatMap((r) => r.lines)).toEqual(['1. Must — tokens reach the log — open']);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// WR-04: the corpus holds round 6's PL2 and a plan row states the gate.plan-rounds outcome it checks.
it('risk:parsing the approach corpus holds round 6 PL2 with the gate.plan-rounds outcome (BUG-LN-22 WR-04)', () => {
  const pl2 = PLAN_ROWS.find((r) => r.id === 'plan-r6-PL2-three-rounds-risks-plural');
  expect(pl2, 'PL2 is in the corpus').toBeDefined();
  expect(pl2!.rounds).toHaveLength(3);
  expect(pl2!.rounds.flat().some((l) => l.includes('risks: security'))).toBe(true);
  expect(pl2!.record ?? '0.4.1').toBe('0.4.1');
  expect(pl2!.gate).toBe('refused');
  expect(PLAN_ROWS.filter((r) => r.gate !== undefined).length, 'rows that state a gate outcome').toBeGreaterThan(1);
});
