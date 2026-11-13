// ST-LN-91 round 5 (owner decision 2026-11-13): a risk is read structurally. A risk is ONLY the finding's fixed mark slot: a ` — `-separated segment that is
// `risk: security|data-loss` or `rests on: risk: security|data-loss` (any letter case), or the `rests on:` line of the critic's multi-line block as critic.md prints it.
// A mark slot is a segment (after the finding's text) or a block line whose key is a mark key (`risk`, `risks`, `rests on`); a value that does not parse is a record problem.
// Prose is never scanned for risk words: the finding's own text, notes, reasons, owner words, `No findings` lines and test names.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, GROUNDS_V2_FROM, approvalBlockers, approvalFindings, approvalProblems, loadSnapshot, nextRound, recordProblems } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]) => '## Round ' + n + '\n\n' + lines.join('\n') + '\n\n';
const closed = "## Closed option B: the owner's no\n\n";
const R1_FIXED = '1. Must — the option drops a header — fixed';

function repo(approach: string, o: { claim?: ClaimPin; lane?: string } = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  building(files, 'T-1', o.lane === undefined ? undefined : { lane: o.lane });
  files['accord/tickets/T-1/ledger.md'] = LEDGER;
  files['accord/tickets/T-1/approach-review.md'] = approach;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  // The grounds rule reads the record pin: the record is written under 0.4.1, so round 2 needs grounds.
  return { ...snapshot, claimPins: { 'T-1': o.claim ?? { pin: APPROACH_CAP_FROM } }, recordPins: { 'T-1': { approach: { pin: GROUNDS_V2_FROM } } } };
}
const problemsOf = (approach: string): string[] => recordProblems(repo(approach), 'T-1', 'approach').map((p) => p.reason);
const blockedBy = (approach: string) => approvalBlockers(repo(approach), 'T-1');
const twoRounds = (line: string, ...more: string[]) => HEAD + round(1, line, ...more) + round(2, 'No findings');
const block = (risk: string, head = '1. Must — tokens reach the log — open') =>
  [head, '   failing case: a login with a bad password → the token is written to app.log', '   rests on: ' + risk].join('\n');

it('risk:security the critic block as critic.md prints it is read: its rests-on risk line marks the finding (ST-LN-91 CR-02 N1)', () => {
  for (const risk of ['risk: security', 'Risk: Security', 'RISK: SECURITY']) {
    expect(blockedBy(twoRounds(block(risk))), risk).toEqual([{ round: 1, lines: ['1. Must — tokens reach the log — open'] }]);
    expect(problemsOf(twoRounds(block(risk))), risk).toEqual([]);
  }
  expect(blockedBy(twoRounds(block('risk: data-loss').replace('Must', 'Should')))).toHaveLength(1);
  expect(blockedBy(twoRounds(block('risk: security').replace('open', 'fixed')))).toEqual([]);
  const twice = twoRounds(block('risk: security').replace('open', 'open — risk: security'));
  expect(blockedBy(twice)).toHaveLength(1);
  expect(problemsOf(twice)).toEqual([]);
  // A rests-on line that is a ground and no risk is no mark and no problem.
  expect(problemsOf(twoRounds(block('ac-1')))).toEqual([]);
  expect(blockedBy(twoRounds(block('ac-1')))).toEqual([]);
});

it("risk:security a block line at or above the finding's indent is no block line: it is prose, read as nothing (ST-LN-91 WR-05 M15)", () => {
  const same = ['1. Must — tokens reach the log — open', '   failing case: x → y', '1. Must — second — open', '   rests on: risk: security'];
  // The risk line belongs to finding 2 only (indented deeper than it); finding 1 stays unmarked.
  expect(blockedBy(twoRounds(same[0], ...same.slice(1)))).toEqual([{ round: 1, lines: ['1. Must — second — open'] }]);
  // After a blank line the line is a paragraph of its own, no part of the finding: prose, read as nothing.
  for (const flat of [
    ['  1. Must — tokens reach the log — open', '', '  rests on: risk: security'],
    ['  1. Must — tokens reach the log — open', '', ' rests on: risk: security'],
    ['1. Must — tokens reach the log — open', '', 'rests on: risk: security'],
    ['1. Must — tokens reach the log — open', '', 'risks: security'],
  ]) {
    const approach = twoRounds(flat[0], ...flat.slice(1));
    expect(blockedBy(approach), flat.join('|')).toEqual([]);
    expect(problemsOf(approach), flat.join('|')).toEqual([]);
    expect(approvalFindings(repo(approach), 'T-1').risks, flat.join('|')).toEqual([{ round: 1, lines: [flat[0].trim()] }]);
  }
});

it('risk:security a risk line directly under a finding at or above its indent is a record problem, never silently ignored (ST-LN-91 WR-02, round 6 Ruling)', () => {
  // Markdown reads such a line as a lazy continuation of the finding, so the rendered record shows the mark on it: accord refuses it instead of reading nothing.
  for (const flat of [
    ['  1. Must — tokens reach the log — open', '  rests on: risk: security'],
    ['  1. Must — tokens reach the log — open', ' rests on: risk: security'],
    ['1. Must — tokens reach the log — open', 'rests on: risk: security'],
    ['1. Must — tokens reach the log — open', 'risk: security'],
    ['1. Must — tokens reach the log — open', 'risks: security'],
    ['1. Must — tokens reach the log — open', '   failing case: x → y', 'rests on: risk: data-loss'],
    ['1. Must — tokens reach the log — open', 'a note', 'rests on: risk: security'],
  ]) {
    const approach = twoRounds(flat[0], ...flat.slice(1));
    const problems = problemsOf(approach);
    expect(problems, flat.join('|')).toHaveLength(1);
    expect(problems[0], flat.join('|')).toContain('line ' + (5 + flat.length - 1));
    expect(approvalProblems(repo(approach), 'T-1'), flat.join('|')).toEqual(problems);
  }
  // `rests on risk: security` with no colon is a mark slot that does not parse.
  expect(problemsOf(twoRounds('1. Must — tokens reach the log — open — rests on risk: security'))).toHaveLength(1);
  // A note that starts `Risk:` under the finding, indented, is prose (round 6 CR-02): only the critic block's `rests on:` line is a mark slot there.
  for (const note of ['   - Risk: a stale cache shows old rows for a minute', '   Risk: security headers are set by the proxy', '   risks: security', '   risk: data-loss']) {
    const approach = twoRounds('1. Must — tokens reach the log — open', note);
    expect(problemsOf(approach), note).toEqual([]);
    expect(blockedBy(approach), note).toEqual([]);
  }
});

it("risk:security the block's other rests-on lines are read as grounds: ac, D, quote, test and command (ST-LN-91 WR-03)", () => {
  const grounded = (ground: string) => {
    const approach = HEAD + round(1, R1_FIXED) + round(2, block(ground, '1. Must — the header row is written twice — open'));
    return nextRound(repo(approach), 'T-1', 'approach').reasons.join('\n');
  };
  for (const ground of ['ac-1', 'D-01', 'Intent "Owners can export their report"', 'test: export#writes-csv', 'command: npm test -- export', 'test: x']) {
    // Round 3 is refused by the cap; the grounds rule is what must not refuse it.
    expect(grounded(ground), ground).not.toContain('a ticket line it rests on');
    expect(grounded(ground), ground).toContain('cap of 2 approach critique rounds');
  }
  // A ground that holds nothing (ac-9 is no scenario of the ticket) is still refused by the grounds rule.
  expect(grounded('ac-9')).toContain('a ticket line it rests on');
  // The one-line form reads the same.
  const oneLine = HEAD + round(1, R1_FIXED) + round(2, '1. Must — the header row is written twice — open — rests on: ac-1');
  expect(nextRound(repo(oneLine), 'T-1', 'approach').reasons.join('\n')).not.toContain('a ticket line it rests on');
});

it('risk:security every rests-on ground of the critic block is read: any one that holds grounds the finding, and none of them is a record problem (ST-LN-91 round 7 CR-02)', () => {
  const head = '1. Must — the header row is written twice — open';
  const ofBlock = (...grounds: string[]) => HEAD + round(1, R1_FIXED) + round(2, head, '   failing case: x', ...grounds.map((g) => '   rests on: ' + g));
  const reasons = (approach: string) => nextRound(repo(approach), 'T-1', 'approach').reasons.join('\n');
  // The first ground holds nothing (ac-9 is no scenario) and the second does: the finding rests on a ticket line, and the cap is what refuses round 3.
  expect(reasons(ofBlock('ac-9', 'ac-1'))).not.toContain('a ticket line it rests on');
  expect(reasons(ofBlock('ac-1', 'D-01'))).not.toContain('a ticket line it rests on');
  // Two grounds that hold nothing are still refused for grounds; neither is a record problem.
  expect(reasons(ofBlock('ac-9', 'D-77'))).toContain('a ticket line it rests on');
  for (const grounds of [['ac-1', 'D-01'], ['ac-9', 'ac-1'], ['test: a#b', 'test: a#c'], ['command: npm test -- a', 'command: npm test -- b'], ['ac-1', 'test: a#b', 'D-01']]) {
    expect(problemsOf(ofBlock(...grounds)), grounds.join('|')).toEqual([]);
  }
  // A ground on the finding line stands beside one in the block.
  expect(problemsOf(HEAD + round(1, '1. Must — a — fixed — rests on: ac-1', '   rests on: D-01'))).toEqual([]);
  // A mis-written risk kind beside valid grounds is still the one thing that is a problem, and two different risks conflict.
  expect(problemsOf(ofBlock('ac-1', 'D-01', 'risk: secrity'))).toHaveLength(1);
  expect(problemsOf(HEAD + round(1, '1. Must — a — open — risk: security', '   rests on: risk: data-loss'))).toHaveLength(1);
});

// Each form: a mark slot whose value does not parse is a record problem (approve refuses), or it is prose (listed under Risks if open, blocks nothing).
const MARK_SLOT_PROBLEMS = [
  '1. Must — tokens reach the log — open — risks: security', // B1
  '1. Must — tokens reach the log — open — risk: data_loss', // B2
  '1. Must — tokens reach the log — open — risk; security', // B5
  '1. Must — tokens reach the log — open — risk: data‑loss', // B4: U+2011 hyphen
  '1. Must — tokens reach the log — open — risk: data‐loss',
  '1. Must — tokens reach the log — open — `risk: security`',
  '1. Must — tokens reach the log — open — "risk: security"',
  "1. Must — tokens reach the log — open — 'risk: security'",
  '1. Must — tokens reach the log — open — **risk: security**',
  '1. Must — tokens reach the log — open — rests on: `risk: security`',
  '1. Must — tokens reach the log — open — rests on: "risk: data-loss"',
  '1. Must — tokens reach the log — open — risk: security.',
  '1. Must — tokens reach the log — open — risk=security',
  '1. Must — tokens reach the log — open — risk: data loss',
  '1. Must — tokens reach the log — open — risk: Security risk',
  '1. Must — tokens reach the log — open — risk security',
  '1. Must — tokens reach the log — open — risk, security',
  '1. Must — tokens reach the log — open — Risks: security',
  '1. Must — tokens reach the log — open — rests on risk: security', // WR-02: no colon after rests on
  '1. Must — tokens reach the log — open — risk: secrity', // one letter off the kind
  '1. Must — tokens reach the log — open — risk: data-lost',
  '1. Must — tokens reach the log — risks: security — open', // before the state
];
const MARK_SLOT_BLOCKS = [
  ['1. Must — tokens reach the log — open', '   rests on: `risk: security`'],
  ['1. Must — tokens reach the log — open', '   rests on: risk: security.'],
  ['1. Must — tokens reach the log — open', '   rests on: risk: data_loss'],
  ['1. Must — tokens reach the log — open', '   rests on risk: security'],
  ['1. Must — tokens reach the log — open — risk: security', '   rests on: risk: data-loss'], // a second, different mark
];

it('risk:security a mark slot whose value does not parse is a record problem that stops the approval, in every form listed (ST-LN-91 CR-02 B1 B2 B4 B5)', () => {
  for (const line of MARK_SLOT_PROBLEMS) {
    const approach = twoRounds(line);
    const problems = problemsOf(approach);
    expect(problems, line).toHaveLength(1);
    expect(problems[0], line).toContain('line 5');
    expect(problems[0], line).toContain('a mark accord cannot read');
    expect(approvalProblems(repo(approach), 'T-1'), line).toEqual(problems);
    expect(nextRound(repo(approach), 'T-1', 'approach').kind, line).toBe('refused');
  }
  for (const lines of MARK_SLOT_BLOCKS) {
    const approach = twoRounds(lines[0], ...lines.slice(1));
    expect(problemsOf(approach).length, lines.join('|')).toBe(1);
    expect(approvalProblems(repo(approach), 'T-1').length, lines.join('|')).toBe(1);
  }
});

it('risk:security prose is never scanned for a risk word: the finding text, notes, reasons, owner words, No findings and test names refuse nothing (ST-LN-91 CR-01 CR-02 WR-02 B3 B6 B7 F5 F6 F7)', () => {
  // Unmarked findings: not blocking, and listed under Risks while open.
  const open = [
    '1. Must — tokens reach the log — open — security risk', // B3
    '1. Must — tokens reach the log — open — data-loss risk', // B6
    '1. Must — tokens reach the log — open, risk: security',
    '1. Must — tokens reach the log, risk: data-loss — open',
    '1. Must: tokens reach the log, risk: security',
    '1. Must - tokens reach the log - open - risk: security', // no em dash: one segment of text
    '1. Must — a fetch prunes early; add a `risk:data-loss` test — open',
    '1. Must — the risk of a leak is not stated — open',
    '1. Should — the risk: section is empty — open',
    '1. Should — the cache - risk: a stale read on reload — open — rests on: ac-1',
    '1. Must — tokens reach the log — unverified: the proxy sets them, so no risk: security issue',
    '1. Must — tokens reach the log — unverified: the proxy — no risk: security there — rests on: ac-1',
  ];
  open.push(
    '1. Must — tokens reach the log — open — risk: none',
    '1. Must — tokens reach the log — open — risk: low',
    '1. Must — tokens reach the log — open — risks: a partial file and a slow disk',
    '1. Must — tokens reach the log — open — rests on: ac1',
    '1. Must — tokens reach the log — risk: nothing — open',
  );
  for (const line of open) {
    const approach = twoRounds(line);
    expect(problemsOf(approach), line).toEqual([]);
    expect(approvalProblems(repo(approach), 'T-1'), line).toEqual([]);
    expect(blockedBy(approach), line).toEqual([]);
    expect(approvalFindings(repo(approach), 'T-1').risks, line).toEqual([{ round: 1, lines: [line] }]);
  }
  // Closed findings and other prose: nothing at all.
  const quiet = [
    '1. Should — headers are missing — withdrawn: no risk - security headers are set by the proxy — rests on: ac-1', // F6
    '1. Must — tokens reach the log — owner: "accept it, risk: security is handled by the proxy"',
    '1. Must — tokens reach the log — fixed',
  ];
  for (const line of quiet) {
    expect(problemsOf(twoRounds(line)), line).toEqual([]);
    expect(blockedBy(twoRounds(line)), line).toEqual([]);
  }
  const notes = [
    'Security lens: no risk: security path is touched.', // P3
    'The owner said: "there is no risk - security is handled by the proxy".', // F5
    'risk: security',
    'risks: security',
    '   an indented note: risk: data-loss',
    '- the main risk is data loss',
    'Fixed: 1.1',
  ];
  for (const note of notes) {
    const approach = HEAD + round(1, R1_FIXED, '', note) + round(2, 'No findings');
    expect(problemsOf(approach), note).toEqual([]);
    expect(blockedBy(approach), note).toEqual([]);
  }
  const noFindings = HEAD + round(1, R1_FIXED) + round(2, 'No findings — 1.1 aside, risk: security remains in the log path');
  expect(problemsOf(noFindings)).toEqual([]);
  expect(blockedBy(noFindings)).toEqual([]);
  // The state of a finding with a read mark is not changed by prose after it.
  expect(blockedBy(twoRounds('1. Must — tokens reach the log — open — risk: security', '', 'Note: risk: data_loss is meant here.'))).toHaveLength(1);
});

it('risk:regression the forms that are read marks still read (ST-LN-91 CR-02)', () => {
  for (const line of [
    '1. Must — tokens reach the log — open — risk: security',
    '1. Must — tokens reach the log — open — Risk: Security',
    '1. Must — tokens reach the log — open — rests on: risk: security',
    '1. Must — tokens reach the log — risk: security — open',
    '1. Must — an overwrite loses rows — open — risk: data-loss',
  ]) {
    expect(blockedBy(twoRounds(line)), line).toEqual([{ round: 1, lines: [line] }]);
    expect(problemsOf(twoRounds(line)), line).toEqual([]);
  }
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
  // Only a whole state segment closes: a longer state that starts with a closing word stays open (WR-05 M3).
  for (const state of ['fixed by redacting', 'fixedish', 'withdrawnly', 'withdrawn by the critic', 'withdrawn, see 2.1', 'Withdrawn', 'withdrawn - see 2.1']) {
    const line = `1. Must — tokens reach the log — ${state} — risk: security`;
    expect(blockedBy(twoRounds(line)), state).toEqual([{ round: 1, lines: [line] }]);
  }
  for (const state of ['fixed', 'withdrawn', 'withdrawn: the critic could not reproduce it', 'repeated as 2.1', 'owner: "ship it - risk: security accepted"']) {
    const line = `1. Must — tokens reach the log — ${state} — risk: security`;
    const approach = HEAD + round(1, line) + round(2, '1. Must — tokens reach the log — open — risk: security');
    expect(blockedBy(approach).map((b) => b.round), state).not.toContain(1);
  }
  // An unverified reason that holds ' — ' is cut into segments, and none of them closes the finding (WR-05 M1).
  for (const line of [
    '1. Must — tokens reach the log — unverified: the planner says — fixed — risk: security',
    '1. Must — tokens reach the log — unverified: no citation — withdrawn — risk: security',
  ]) {
    expect(blockedBy(twoRounds(line)), line).toEqual([{ round: 1, lines: [line] }]);
  }
});

it('risk:complex-branching a command holding -- does not make round 2 refuse the finding as ungrounded (ST-LN-91 CR-01 F2)', () => {
  const grounded = '1. Should — the csv drops a quoted comma — open — command: npm test -- packages/cli/test/export.test.ts';
  const refused = nextRound(repo(HEAD + round(1, R1_FIXED) + round(2, grounded)), 'T-1', 'approach');
  expect(refused.kind).toBe('refused');
  expect(refused.reasons.join('\n')).toContain('cap of 2 approach critique rounds');
  expect(refused.reasons.join('\n')).not.toContain('rests on');
});

it('risk:security an unreadable mark and an unreadable line stop the approval whichever cycle they sit in (ST-LN-91 IN-01)', () => {
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

it('risk:regression the release note describes the structural reading and no longer claims what the code does not do (ST-LN-91 WR-01, round 5)', () => {
  const note = readFileSync(fileURLToPath(new URL('../../../docs/releases.md', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
  for (const gone of [
    'in every written form',
    'while it is open the short view lists it under `## Risks`',
    '`rests on: ac1` are problems',
    'is read as `1. Must — <text> — risk: security — open` is)',
    'Three rules follow the record or the plan',
    'RECORD_V2_FROM',
    'a line under a `## Round` heading in which the word `risk` is followed',
    'a comma before the kind are problems',
    "the owner's quoted words are not searched",
    'A risk in any other form is a record problem',
  ]) expect(note, gone).not.toContain(gone);
  for (const p of [
    "A risk is read only from the finding's mark slot",
    'Prose is never searched for a risk word',
    'a mark slot whose value does not parse is a record problem',
    '`accord approve` refuses with exit 1',
    '`accord round --plan` and, once a cycle holds three rounds, `accord gate plan`',
    'Two rules follow the record or the plan',
    'while it is an open Must or Should the short view lists it under `## Risks`, and an open Nice is never listed',
    'whether the severity is followed by ` — `, a colon, a hyphen or an en dash',
    'Any other line under a finding, indented or not, is a note, and a note is prose',
    'A value that is no such kind is prose, not a problem',
    '`risk: none`, `risk: low`, `risk: a partial file is left on a crash` and `rests on: ac1` refuse nothing',
    'a kind one edit off the whole word, counted over its letters, the `data` part of `data-loss` included, and whatever up to three characters that are no letter separate the letters or come before them (`risk: secrity`, `risk: date-loss`, `risk: data-lost`, `risk: data/loss`, `risk: secu-rity`, `risk: .security`; a value two or more letters off is prose)',
    'a second ground, or a second `test:` or `command:`, is never a record problem',
    'is a record problem too, because Markdown renders it as part of the finding',
  ]) expect(note, p).toContain(p);
});

// ST-LN-91 round 6 WR-04: three mutations of the reader survived round 5's tests; each of these fails when its line is removed (see the commit that adds them).
it('risk:regression a ticket claimed under 0.4.0 is held to no mark check: a risks: security line still reads as the five-round loop (ST-LN-91 mig-ac-1, WR-04 MJ)', () => {
  const legacy = { claim: { pin: '0.4.0' } };
  for (const line of ['1. Must — tokens reach the log — open — risks: security', '1. Must — tokens reach the log — open — `risk: security`', '1. Must — tokens reach the log — risk: data_loss — open', '1. Must: tokens reach the log — risks: security — open']) {
    const approach = HEAD + round(1, line) + round(2, 'No findings');
    expect(recordProblems(repo(approach, legacy), 'T-1', 'approach'), line).toEqual([]);
    expect(approvalProblems(repo(approach, legacy), 'T-1'), line).toEqual([]);
    // The approach loop goes on: round 3 of five, no refusal over the mark.
    expect(nextRound(repo(approach, legacy), 'T-1', 'approach'), line).toMatchObject({ kind: 'next', round: 3, cap: 5 });
    // The same record on the capped rules is refused over the mark.
    expect(recordProblems(repo(approach), 'T-1', 'approach'), line).toHaveLength(1);
  }
});

it("risk:security the block ends at a line that is no deeper than the finding: an indented rests-on line after a note belongs to no finding (ST-LN-91 WR-04 MO)", () => {
  // Directly after the note (no blank line) the indented risk line is a lazy continuation of the note: a record problem, attached to nothing.
  const direct = twoRounds('1. Must — tokens reach the log — open', 'a note about the cache', '   rests on: risk: security');
  expect(blockedBy(direct)).toEqual([]);
  expect(problemsOf(direct)).toHaveLength(1);
  expect(problemsOf(direct)[0]).toContain('line 7');
  // After a blank line it is a paragraph of its own: prose, and the finding it follows is not marked.
  const apart = twoRounds('1. Must — tokens reach the log — open', 'a note about the cache', '', '   rests on: risk: security');
  expect(blockedBy(apart)).toEqual([]);
  expect(problemsOf(apart)).toEqual([]);
  expect(approvalFindings(repo(apart), 'T-1').risks).toEqual([{ round: 1, lines: ['1. Must — tokens reach the log — open'] }]);
  // A second finding starts its own block and the first one keeps none.
  const second = twoRounds('1. Must — tokens reach the log — open', '2. Should — the cache is stale — open', '   rests on: risk: data-loss');
  expect(blockedBy(second)).toEqual([{ round: 1, lines: ['2. Should — the cache is stale — open'] }]);
});

it('risk:security a bulleted block line is a block line: its bullet is stripped before its key is read (ST-LN-91 WR-04 MG)', () => {
  for (const bullet of ['-', '*', '+']) {
    const marked = twoRounds('1. Must — tokens reach the log — open', `   ${bullet} rests on: risk: security`);
    expect(blockedBy(marked), bullet).toEqual([{ round: 1, lines: ['1. Must — tokens reach the log — open'] }]);
    expect(problemsOf(marked), bullet).toEqual([]);
    // A bulleted line whose slot does not parse is a record problem, as an unbulleted one is.
    expect(problemsOf(twoRounds('1. Must — tokens reach the log — open', `   ${bullet} rests on: \`risk: security\``)), bullet).toHaveLength(1);
  }
  // A bulleted ground is read as a ground: round 2 is not refused for grounds.
  const grounded = HEAD + round(1, R1_FIXED) + round(2, '1. Must — the header row is written twice — open', '   - rests on: ac-1');
  expect(nextRound(repo(grounded), 'T-1', 'approach').reasons.join('\n')).not.toContain('a ticket line it rests on');
});
