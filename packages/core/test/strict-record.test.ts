// ST-LN-91 round-4 CR-01, CR-02, WR-01, IN-01 (owner decision 2026-11-13): the approach record is read strictly and fails closed.
// Only the forms critic.md and critique.md tell a writer to produce are read: the ` — ` separator, `risk: security` / `risk: data-loss` as a mark or as
// `rests on: risk: ...`, the critic's block with `rests on: risk: ...` on its own line, in any letter case. A line on the capped rules that names a risk
// (the word `risk`, then only spaces and `: = - " ' ` * _ ( ) [ ]`, then `security` or `data-loss`) in any other form is a record problem.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, approvalBlockers, approvalProblems, loadSnapshot, nextRound, recordProblems } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]) => '## Round ' + n + '\n\n' + lines.join('\n') + '\n\n';
const closed = '## Closed option B: the owner\'s no\n\n';
const R1_FIXED = '1. Must — the option drops a header — fixed';

function repo(approach: string, o: { claim?: ClaimPin; lane?: string } = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  building(files, 'T-1', o.lane === undefined ? undefined : { lane: o.lane });
  files['accord/tickets/T-1/ledger.md'] = LEDGER;
  files['accord/tickets/T-1/approach-review.md'] = approach;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return { ...snapshot, claimPins: { 'T-1': o.claim ?? { pin: APPROACH_CAP_FROM } } };
}
const problemsOf = (approach: string): string[] => recordProblems(repo(approach), 'T-1', 'approach').map((p) => p.reason);
const blockedBy = (approach: string) => approvalBlockers(repo(approach), 'T-1');
const twoRounds = (line: string, ...more: string[]) => HEAD + round(1, line, ...more) + round(2, 'No findings');

it('risk:security the critic block as critic.md prints it is read: its rests-on risk line marks the finding (ST-LN-91 CR-02 N1)', () => {
  const block = (risk: string) => ['1. Must — tokens reach the log — open', '   failing case: a login with a bad password → the token is written to app.log', '   rests on: ' + risk].join('\n');
  for (const risk of ['risk: security', 'Risk: Security', 'RISK: SECURITY']) {
    expect(blockedBy(twoRounds(block(risk))), risk).toEqual([{ round: 1, lines: ['1. Must — tokens reach the log — open'] }]);
    expect(problemsOf(twoRounds(block(risk))), risk).toEqual([]);
  }
  expect(blockedBy(twoRounds(block('risk: data-loss').replace('Must', 'Should')))).toHaveLength(1);
  // Fixed, the block closes; the mark on the line and in the block is read once.
  expect(blockedBy(twoRounds(block('risk: security').replace('open', 'fixed')))).toEqual([]);
  const twice = twoRounds(block('risk: security').replace('open', 'open — risk: security'));
  expect(blockedBy(twice)).toHaveLength(1);
  expect(problemsOf(twice)).toEqual([]);
  // A rests-on line that is not a risk form is no mark and no problem.
  expect(problemsOf(twoRounds(block('ac-1')))).toEqual([]);
  expect(blockedBy(twoRounds(block('ac-1')))).toEqual([]);
});

it('risk:security a risk named in any form accord does not read is a record problem that stops the approval (ST-LN-91 CR-02 N1 N2 N3)', () => {
  const forms = [
    '1. Must — tokens reach the log — open — `risk: security`',
    '1. Must — tokens reach the log — open — "risk: security"',
    '1. Must — tokens reach the log — open — rests on: `risk: security`',
    '1. Must — tokens reach the log — open — rests on: "risk: data-loss"',
    "1. Must — tokens reach the log — open — 'risk: security'",
    '1. Must - tokens reach the log - open - risk: security',
    '1. Must -- tokens reach the log -- open -- risk: data-loss',
    '1. Must – tokens reach the log – open – risk: security',
    '1. Must — tokens reach the log — open — risk: security.',
    '1. Must — tokens reach the log — open, risk: security',
    '1. Must — tokens reach the log — open — risk=security',
    '1. Must — tokens reach the log — open — risk - security',
    '1. Must — tokens reach the log — open — risk: data loss',
    '1. Must — tokens reach the log — open — **risk: security**',
    '1. Must — a `risk: security` in the words — open',
    '1. Must — tokens reach the log — unverified: risk: security is not shown',
    '1. Must — tokens reach the log — open — risk: security — risk: data-loss',
  ];
  for (const line of forms) {
    const approach = twoRounds(line);
    const problems = problemsOf(approach);
    expect(problems, line).toHaveLength(1);
    expect(problems[0], line).toContain('line 5');
    expect(problems[0], line).toMatch(/risk/);
    expect(approvalProblems(repo(approach), 'T-1'), line).toEqual(problems);
    expect(nextRound(repo(approach), 'T-1', 'approach').kind, line).toBe('refused');
  }
  const blocks = [
    ['1. Must — tokens reach the log — open', '   rests on: `risk: security`'],
    ['1. Must — tokens reach the log — open', '   rests on: risk: security.'],
    ['1. Must — tokens reach the log — open', '   failing case: a login → the token is logged, risk: security'],
    ['1. Must — tokens reach the log — open', 'risk: security'], // not indented: not the block
    ['1. Must — tokens reach the log — open — risk: security', '   rests on: risk: data-loss'], // a second, different mark
    ['1. Must — tokens reach the log — open', '', 'The critic called this risk: security.'],
  ];
  for (const lines of blocks) {
    const approach = twoRounds(lines[0], ...lines.slice(1));
    expect(problemsOf(approach).length, lines.join('|')).toBe(1);
    expect(approvalProblems(repo(approach), 'T-1').length, lines.join('|')).toBe(1);
  }
});

it('risk:regression a text with no risk word, a risk word with no risk kind, and the words of a read mark are no record problem (ST-LN-91 WR-01)', () => {
  const fine = [
    '1. Should — the cache - risk: a stale read on reload — open — rests on: ac-1',
    '1. Should — the cache -- risk: a stale read — open — rests on: ac-1',
    '1. Must — the risk of a leak is not stated — open',
    '2. Should — the risk: section is empty — open',
    '3. Should — the security review is missing and data is lost — open',
    '4. Should — a high risk, security of the cache aside — open',
    '5. Must — the log shows tokens — open — rests on: Intent "never write a token"',
    '6. Must — the export is wrong — fixed — command: npm test -- packages/cli/test/export.test.ts',
    '7. Must — the export is wrong — open — command: grep "risk: security" notes.md',
    '8. Must — the export is wrong — open — test: export - fixed width rows survive',
    '9. Must — tokens reach the log — owner: "accept it, risk: security is handled by the proxy" — risk: security',
  ];
  for (const line of fine) expect(problemsOf(HEAD + round(1, line)), line).toEqual([]);
  // On the older rules and on a lane S ticket nothing is asked.
  const bad = HEAD + round(1, '1. Must — tokens reach the log — open — `risk: security`');
  expect(approvalProblems(repo(bad, { claim: { pin: '0.4.0' } }), 'T-1')).toEqual([]);
  expect(approvalProblems(repo(bad, { lane: 'S' }), 'T-1')).toEqual([]);
});

it('risk:security a state, a reason, a test or a command holding a hyphen or two never changes what the finding is (ST-LN-91 CR-01 X1 X2 X3 F1b)', () => {
  for (const line of [
    '1. Must — tokens reach the log — unverified: the planner says - fixed by redacting, no citation — risk: security',
    '1. Must — tokens reach the log — unverified: the redaction - withdrawn from the plan — risk: security',
    '1. Must — an overwrite loses rows — open — risk: data-loss — test: export - fixed width rows survive',
    '1. Must — an overwrite loses rows — open — risk: data-loss — command: npm run x -- --fixed',
    '1. Must — tokens reach the log — unverified: a -- withdrawn -- reason — risk: security',
  ]) {
    expect(blockedBy(twoRounds(line)), line).toEqual([{ round: 1, lines: [line] }]);
    expect(problemsOf(twoRounds(line)), line).toEqual([]);
  }
  const f1b = '1. Must — tokens reach the log — fixed — risk: security — command: npm test -- packages/core/test/log.test.ts';
  expect(blockedBy(twoRounds(f1b))).toEqual([]);
  expect(problemsOf(twoRounds(f1b))).toEqual([]);
  expect(approvalProblems(repo(twoRounds(f1b)), 'T-1')).toEqual([]);
  // Only a whole state segment closes: a longer state that starts with a closing word stays open.
  for (const state of ['fixed by redacting', 'fixedish', 'withdrawnly']) {
    const line = `1. Must — tokens reach the log — ${state} — risk: security`;
    expect(blockedBy(twoRounds(line)), state).toEqual([{ round: 1, lines: [line] }]);
  }
  for (const state of ['fixed', 'withdrawn', 'withdrawn: the critic could not reproduce it', 'repeated as 2.1', 'owner: "ship it - risk: security accepted"']) {
    const line = `1. Must — tokens reach the log — ${state} — risk: security`;
    const approach = HEAD + round(1, line) + round(2, '1. Must — tokens reach the log — open — risk: security');
    expect(blockedBy(approach).map((b) => b.round), state).not.toContain(1);
  }
});

it('risk:complex-branching a command holding -- does not make round 2 refuse the finding as ungrounded (ST-LN-91 CR-01 F2)', () => {
  const grounded = '1. Should — the csv drops a quoted comma — open — command: npm test -- packages/cli/test/export.test.ts';
  const refused = nextRound(repo(HEAD + round(1, R1_FIXED) + round(2, grounded)), 'T-1', 'approach');
  expect(refused.kind).toBe('refused');
  expect(refused.reasons.join('\n')).toContain('cap of 2 approach critique rounds');
  expect(refused.reasons.join('\n')).not.toContain('rests on');
});

it('risk:security an unreadable risk mark and an unreadable line stop the approval whichever cycle they sit in (ST-LN-91 IN-01)', () => {
  const clean = closed + round(1, R1_FIXED) + round(2, 'No findings');
  for (const line of ['1. Must — tokens reach the log — open — `risk: security`', '1. Must/Should — tokens reach the log — open']) {
    const older = HEAD + round(1, line) + round(2, 'No findings') + clean;
    const problems = problemsOf(older);
    expect(problems.length, line).toBeGreaterThan(0);
    expect(problems.join('\n'), line).toContain('line 5');
    expect(approvalProblems(repo(older), 'T-1'), line).toEqual(problems);
    expect(nextRound(repo(older), 'T-1', 'approach').kind, line).toBe('refused');
  }
});

it('risk:regression the release note describes the strict forms and no longer claims what the code does not do (ST-LN-91 WR-03, round 4)', () => {
  const note = readFileSync(fileURLToPath(new URL('../../../docs/releases.md', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
  expect(note).not.toContain('in every written form');
  expect(note).not.toContain('` - `, ` -- ` or ` – ` between the parts');
  expect(note).not.toContain('Three rules follow the record or the plan');
  expect(note).not.toContain('RECORD_V2_FROM');
  for (const p of [
    'The approach record is read strictly',
    'A risk in any other form is a record problem',
    '`accord approve` refuses with exit 1',
    'Two rules follow the record or the plan',
    'the same record problem refuses `accord round --plan` on a plan record',
  ]) expect(note, p).toContain(p);
});
