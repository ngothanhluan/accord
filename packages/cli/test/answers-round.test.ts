// Phase 10 D-15, 10-ac-29, 10-ac-31 (a), 10-ac-11: `accord round <id>` on real git. `accepted risk: <why>` closes a finding when the ledger holds its Ruling and is listed on an `accepted:` line; a review finding
// `ambiguous ac-<n>: built "<reading>"` opens no fix round and becomes a `warn:` line; neither is ever taken for a data-loss or security finding, nor an ambiguous answer where a Decision settles the reading. A ticket
// claimed under 0.23.1 answers as b4477211 did.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { reviewed } from './helpers/review-budget.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const PLAN = join('accord', 'tickets', 'T-1', 'plan-review.md');
const LEDGER = join('accord', 'tickets', 'T-1', 'ledger.md');
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const rec = (...rounds: string[][]): string =>
  'Round record: 1\n\n' + rounds.map((lines, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`).join('');
const WHY = 'the input comes only from our own config';
const CASE = 'a hand-edited config crashes the gate';
const ledgerOf = (record: string, at: string): string => `## Rulings\n- Ruling: accepted risk — ${record} ${at}: ${WHY} — ${CASE}\n`;
const planLine = (state: string, ...marks: string[]): string => `1. Should — task 1 drops a header — ${state}${['rests on: ac-1', ...marks].map((m) => ' — ' + m).join('')}`;
const approachLine = (state: string, ...marks: string[]): string => `1. Should — the impact list misses a caller — ${state}${marks.map((m) => ' — ' + m).join('')}`;
/** A review finding line of the version 2 sandbox record (round 1 needs no ground). */
const reviewLine = (n: number, state: string, ...marks: string[]): string =>
  `Should ${n} [patch]: a comma is not quoted — src/a.ts:1 — ${state}${marks.map((m) => ' — ' + m).join('')}`;
const READING = 'ambiguous ac-2: built "the count excludes drafts"';

/** The claim commit under `claimPin`, then the files committed under the running pin: the shape of a ticket claimed at one release and worked on at another. */
function claimed(claimPin: string, files: Record<string, string> = {}): string {
  const repo = makeLaneRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, ...files });
  commitMsg(repo, 'T-1 critique');
  return repo;
}

it('risk:regression accord round --plan counts an accepted risk with its ledger Ruling as closed and lists it on an accepted line (10-ac-29, D-15)', async () => {
  const repo = claimed('0.24.0', { [PLAN]: rec([planLine(`accepted risk: ${WHY}`)]), [LEDGER]: ledgerOf('plan', '1.1') });
  try {
    const answer = await run(['round', 'T-1', '--plan'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out).toContain('Findings still open: none');
    expect(answer.out).toContain(`accepted: plan 1.1: ${WHY}\n`);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --approach counts an accepted risk with its ledger Ruling as closed (10-ac-29, D-15)', async () => {
  const repo = claimed('0.24.0', { [APPROACH]: rec([approachLine(`accepted risk: ${WHY}`)]), [LEDGER]: ledgerOf('approach', '1.1') });
  try {
    const answer = await run(['round', 'T-1', '--approach'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out).toContain('Findings still open: none');
    expect(answer.out).toContain(`accepted: approach 1.1: ${WHY}\n`);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression an accepted risk with no Ruling is refused naming finding 1.1 and the Ruling form (10-ac-29, D-15, T-10-09)', async () => {
  const repo = claimed('0.24.0', { [PLAN]: rec([planLine(`accepted risk: ${WHY}`)]) });
  try {
    const answer = await run(['round', 'T-1', '--plan'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out).toContain('1.1');
    expect(answer.out).toContain('Ruling: accepted risk — plan 1.1: <why> — <failing case>');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security an accepted risk on a finding marked risk: security is refused naming finding 1.1, with its Ruling (10-ac-29, D-15, T-10-09)', async () => {
  const repo = claimed('0.24.0', { [PLAN]: rec([planLine(`accepted risk: ${WHY}`, 'risk: security')]), [LEDGER]: ledgerOf('plan', '1.1') });
  try {
    const answer = await run(['round', 'T-1', '--plan'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out).toContain('1.1');
    expect(answer.out).toContain('never taken for a data-loss or security finding');
    expect(answer.out).not.toContain('accepted: plan');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:data-loss an accepted risk on a finding that inherits a data-loss mark is refused naming finding 2.1 (10-ac-29, D-15, T-10-09)', async () => {
  const record = rec(['1. Must — the export overwrites the old file — fixed — risk: data-loss'], [`1. Must — repeats 1.1: the overwrite still happens — accepted risk: ${WHY} — risk: data-loss`]);
  const repo = claimed('0.24.0', { [APPROACH]: record, [LEDGER]: ledgerOf('approach', '2.1') });
  try {
    const answer = await run(['round', 'T-1', '--approach'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out).toContain('2.1');
    expect(answer.out).toContain('never taken for a data-loss or security finding');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a review accepted risk with its review Ruling is closed and listed on an accepted line (10-ac-29, D-15)', async () => {
  const repo = reviewed('0.24.0', [{ lines: [reviewLine(1, `accepted risk: ${WHY}`)] }], { extra: { [LEDGER]: ledgerOf('review', '1.1') } });
  try {
    const answer = await run(['round', 'T-1'], repo);
    expect(answer.err).toBe('');
    expect(answer.code).toBe(0);
    expect(answer.out).toContain(`accepted: review 1.1: ${WHY}\n`);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security a review accepted risk on a finding marked risk: data-loss is refused naming finding 1.1 (10-ac-29, D-15, T-10-09)', async () => {
  const repo = reviewed('0.24.0', [{ lines: [reviewLine(1, `accepted risk: ${WHY}`, 'risk: data-loss')] }], { extra: { [LEDGER]: ledgerOf('review', '1.1') } });
  try {
    const answer = await run(['round', 'T-1'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out).toContain('1.1');
    expect(answer.out).toContain('never taken for a data-loss or security finding');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a review finding answered ambiguous opens no fix round and prints a warn line naming the criterion and the reading (10-ac-31, D-15)', async () => {
  const repo = reviewed('0.24.0', [{ lines: [reviewLine(2, READING)] }]);
  try {
    const answer = await run(['round', 'T-1'], repo);
    expect(answer.err).toBe('');
    expect(answer.code).toBe(0);
    expect(answer.out).toContain('warn: 1.2 ambiguous ac-2, built "the count excludes drafts": listed in the verify report, never blocks\n');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security an ambiguous-criterion answer on a risk finding is refused naming finding 1.2 (10-ac-31, D-15, T-10-10)', async () => {
  const repo = reviewed('0.24.0', [{ lines: [reviewLine(2, READING, 'risk: security')] }]);
  try {
    const answer = await run(['round', 'T-1'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out).toContain('1.2');
    expect(answer.out).toContain('never taken for a data-loss or security finding');
    expect(answer.out).not.toContain('warn:');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression an ambiguous-criterion answer on a finding that rests on a Decision is refused naming finding 1.2 (10-ac-31, D-15, T-10-10)', async () => {
  const repo = reviewed('0.24.0', [{ lines: [reviewLine(2, READING, 'rests on: D-01')] }]);
  try {
    const answer = await run(['round', 'T-1'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out).toContain('1.2');
    expect(answer.out).toContain('a Decision settles the reading');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// 10-ac-11: for a ticket claimed under 0.23.1 the three forms answer as b4477211 (0.23.1) did. The literals below were captured from `node packages/cli/dist/cli.js` built at b4477211 in a scratch clone
// (C:/Work/accord-p10-scratch/main-b4477211), never in this worktree, for the same fixtures. They are the CLI lines the Legacy lines of plans 10-13 and 10-14 cite for a hand-written accepted-risk or ambiguous answer.
const AP_LEGACY = rec(['1. Must — the option drops the header — fixed'], [`1. Should — the cache can go stale — accepted risk: ${WHY} — rests on: ac-1`]);
const PL_LEGACY = rec(
  ['1. Should — task 1 drops a header — open — rests on: ac-1', '2. Should — task 2 drops a header — open — rests on: ac-1', '3. Should — task 3 drops a header — open — rests on: ac-1'],
  [`1. Should — task 1 drops a header — accepted risk: ${WHY} — rests on: ac-1`, `2. Should — task 2 drops a header — accepted risk: ${WHY} — rests on: ac-1`],
  [`1. Should — task 1 drops a header — accepted risk: ${WHY} — rests on: ac-1`],
);

it('risk:regression a ticket claimed under 0.23.1 answers an accepted risk at approach and plan byte for byte as b4477211 did (10-ac-11)', async () => {
  for (const [name, flag, files, want] of [
    ['approach', '--approach', { [APPROACH]: AP_LEGACY, [LEDGER]: ledgerOf('approach', '2.1') }, 'refused: round 3 of cycle 1 is past the cap of 2 approach critique rounds, which no Ruling raises; the loop has ended: write the findings still open into ## Approach as risks, and the owner decides at the approval\nFindings still open:\nRound 2:\n1. Should — the cache can go stale — accepted risk: the input comes only from our own config — rests on: ac-1\n'],
    ['plan', '--plan', { [PLAN]: PL_LEGACY, [LEDGER]: ledgerOf('plan', '3.1') }, 'stop: report to owner\nReason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop\nReason: the cap of 3 rounds in cycle 1 is reached\nFindings of round 3:\n1. Should — task 1 drops a header — accepted risk: the input comes only from our own config — rests on: ac-1\nApproach:\nExtend the existing report writer with a csv mode.\nAsk the owner whether to change course: weigh the options the Approach above rejected or held in reserve against going on.\nTo accept the open findings: end plan-review.md with the line verdict: accepted-by-owner "<the owner\'s sentence>"\nTo allow more rounds: add under ## Rulings in the ledger: Ruling: the owner allows <n> more plan critique rounds after round 3 of cycle 1 — "<the owner\'s sentence>" — <cost if wrong>\nTo change course: write that Ruling with <n> the rounds the owner gives the reworked plan, then re-plan through the plan stage (plan.md)\n'],
  ] as const) {
    const repo = claimed('0.23.1', files);
    try {
      expect(await run(['round', 'T-1', flag], repo), name).toEqual({ code: 1, out: want, err: '' });
    } finally {
      cleanup(repo);
    }
  }
}, 300_000);

it('risk:regression a ticket claimed under 0.23.1 answers an accepted-risk or ambiguous review line byte for byte as b4477211 did (10-ac-11)', async () => {
  for (const [name, state, want] of [
    ['accepted risk', `accepted risk: ${WHY}`, 'refused: round 1 at line 3 holds no finding and no "No findings" line\nrefused: line 5: a finding of a version 2 record reads <Severity> <n>[ [class]]: <finding> — <path>[:<line>] or none — open, fixed in <sha> or deferred, then its marks: "Should 1 [patch]: a comma is not quoted — src/a.ts:1 — accepted risk: the input comes only from our own config"\n'],
    ['ambiguous', READING, 'refused: round 1 at line 3 holds no finding and no "No findings" line\nrefused: line 5: a finding of a version 2 record reads <Severity> <n>[ [class]]: <finding> — <path>[:<line>] or none — open, fixed in <sha> or deferred, then its marks: "Should 1 [patch]: a comma is not quoted — src/a.ts:1 — ambiguous ac-2: built "the count excludes drafts""\n'],
  ] as const) {
    const repo = reviewed('0.23.1', [{ lines: [reviewLine(1, state)] }], { extra: { [LEDGER]: ledgerOf('review', '1.1') } });
    try {
      expect(await run(['round', 'T-1'], repo), name).toEqual({ code: 1, out: want, err: '' });
    } finally {
      cleanup(repo);
    }
  }
}, 300_000);
