// Phase 10 D-14, 10-ac-21, 10-ac-11: `accord round <id> --plan` and `--approach` on real git. A planner's `does not hold: <path>:<line>` closes a finding when that place exists in the working tree
// (a relative path inside it, no `..`, no link, a regular file with at least that many lines); a place that does not exist is refused; a risk finding answered so waits for the owner; a ticket claimed
// under 0.23.1 reads the segment as an open finding and answers as b4477211 did.
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const PLAN = join('accord', 'tickets', 'T-1', 'plan-review.md');
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const rec = (...rounds: string[][]): string =>
  'Round record: 1\n\n' + rounds.map((lines, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`).join('');
const SOURCE = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';

/** The claim commit under `claimPin`, then the files committed under the running pin: the shape of a ticket claimed at one release and worked on at another. */
function claimed(claimPin: string, files: Record<string, string> = {}): string {
  const repo = makeLaneRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'src/a.ts': SOURCE, ...files });
  commitMsg(repo, 'T-1 critique');
  return repo;
}
const PLAN_ONE = (state: string): string => rec([`1. Should — task 1 drops a header — ${state} — rests on: ac-1`]);
const APPROACH_ONE = (state: string): string => rec([`1. Should — the impact list misses a caller — ${state}`]);

it('risk:regression accord round --plan counts a finding answered does not hold with a line that exists as closed (10-ac-21, D-14)', async () => {
  const repo = claimed('0.24.0', { [PLAN]: PLAN_ONE('does not hold: src/a.ts:12') });
  try {
    const answer = await run(['round', 'T-1', '--plan'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out).toContain('Findings still open: none');
    expect(answer.out).not.toContain('does not hold');
    expect(answer.out).not.toContain('stop: report to owner');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --approach counts a finding answered does not hold with a line that exists as closed (10-ac-21, D-14)', async () => {
  const repo = claimed('0.24.0', { [APPROACH]: APPROACH_ONE('does not hold: src/a.ts:20') });
  try {
    const answer = await run(['round', 'T-1', '--approach'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out).toContain('Findings still open: none');
    expect(answer.out).not.toContain('Blocking findings:');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security a does-not-hold place past the end of the file, in no file or outside the tree is refused naming finding 1.1 and the place (10-ac-21, D-14, T-10-07)', async () => {
  for (const place of ['src/a.ts:99', 'src/missing.ts:3', '../outside.ts:1', 'src/../src/a.ts:2', '/etc/hosts:1', 'src:1']) {
    const repo = claimed('0.24.0', { [PLAN]: PLAN_ONE(`does not hold: ${place}`) });
    try {
      const answer = await run(['round', 'T-1', '--plan'], repo);
      expect(answer.code, place).toBe(1);
      expect(answer.out.startsWith('refused:'), place).toBe(true);
      expect(answer.out, place).toContain('1.1');
      expect(answer.out, place).toContain(place);
      expect(answer.out, place).toContain('does not exist');
    } finally {
      cleanup(repo);
    }
  }
}, 300_000);

it('risk:security a does-not-hold place through a link is refused, a link to a file and a link to a folder alike (10-ac-21, D-14, T-10-07)', async () => {
  const repo = claimed('0.24.0', { 'outside/target.ts': SOURCE });
  const places: string[] = [];
  try {
    mkdirSync(join(repo, 'src'), { recursive: true });
    // each link on its own: a Windows account that may not create file links can still make a folder junction, and the loader's lstat checks are the same code on every platform
    try {
      symlinkSync(join(repo, 'outside', 'target.ts'), join(repo, 'src', 'l.ts'), 'file');
      places.push('src/l.ts:3');
    } catch {
      /* no file links here */
    }
    try {
      symlinkSync(join(repo, 'outside'), join(repo, 'src', 'd'), 'junction');
      places.push('src/d/target.ts:3');
    } catch {
      /* no folder links here */
    }
    for (const place of places) {
      writeFiles(repo, { [PLAN]: PLAN_ONE(`does not hold: ${place}`) });
      commitMsg(repo, `T-1 ${place}`);
      const answer = await run(['round', 'T-1', '--plan'], repo);
      expect(answer.code, place).toBe(1);
      expect(answer.out, place).toContain('1.1');
      expect(answer.out, place).toContain(place);
      expect(answer.out, place).toContain('does not exist');
    }
  } finally {
    cleanup(repo);
  }
}, 300_000);

it('risk:parsing accord round --approach refuses a does-not-hold answer with no readable place and names its line (10-ac-21, D-14)', async () => {
  const repo = claimed('0.24.0', { [APPROACH]: APPROACH_ONE('does not hold: <path>:<line>') });
  try {
    const answer = await run(['round', 'T-1', '--approach'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused: line 5:')).toBe(true);
    expect(answer.out).toContain('<path>:<line>');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// 10-ac-11: for a ticket claimed under 0.23.1 a does-not-hold segment is not a state accord reads: the finding reads open and the answers are the bytes b4477211 (0.23.1) printed. The literals
// below were captured from `node packages/cli/dist/cli.js` built at b4477211 in a scratch clone (C:/Work/accord-p10-scratch/main-b4477211), never in this worktree, for the same fixtures. They are the CLI
// lines the Legacy lines of plans 10-13 and 10-14 cite for a hand-written does-not-hold answer.
const AP_LEGACY = rec(['1. Must — the option drops the header — fixed'], ['1. Should — the cache can go stale — does not hold: src/a.ts:12 — rests on: ac-1']);
const PL_LEGACY = rec(
  ['1. Should — task 1 drops a header — open — rests on: ac-1', '2. Should — task 2 drops a header — open — rests on: ac-1', '3. Should — task 3 drops a header — open — rests on: ac-1'],
  ['1. Should — task 1 drops a header — does not hold: src/a.ts:12 — rests on: ac-1', '2. Should — task 2 drops a header — does not hold: src/a.ts:13 — rests on: ac-1'],
  ['1. Should — task 1 drops a header — does not hold: src/a.ts:12 — rests on: ac-1'],
);
const B4477211: { name: string; flag: '--approach' | '--plan'; files: Record<string, string>; want: { code: number; out: string } }[] = [
  {
    name: 'approach, round 2 with a does-not-hold finding and round 3 asked',
    flag: '--approach',
    files: { [APPROACH]: AP_LEGACY },
    want: { code: 1, out: 'refused: round 3 of cycle 1 is past the cap of 2 approach critique rounds, which no Ruling raises; the loop has ended: write the findings still open into ## Approach as risks, and the owner decides at the approval\nFindings still open:\nRound 2:\n1. Should — the cache can go stale — does not hold: src/a.ts:12 — rests on: ac-1\n' },
  },
  {
    name: 'plan, round 3 with a does-not-hold finding',
    flag: '--plan',
    files: { [PLAN]: PL_LEGACY },
    want: { code: 1, out: 'stop: report to owner\nReason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop\nReason: the cap of 3 rounds in cycle 1 is reached\nFindings of round 3:\n1. Should — task 1 drops a header — does not hold: src/a.ts:12 — rests on: ac-1\nApproach:\nExtend the existing report writer with a csv mode.\nAsk the owner whether to change course: weigh the options the Approach above rejected or held in reserve against going on.\nTo accept the open findings: end plan-review.md with the line verdict: accepted-by-owner "<the owner\'s sentence>"\nTo allow more rounds: add under ## Rulings in the ledger: Ruling: the owner allows <n> more plan critique rounds after round 3 of cycle 1 — "<the owner\'s sentence>" — <cost if wrong>\nTo change course: write that Ruling with <n> the rounds the owner gives the reworked plan, then re-plan through the plan stage (plan.md)\n' },
  },
];

it('risk:regression a ticket claimed under 0.23.1 reads a does-not-hold finding as open and answers byte for byte as b4477211 did (10-ac-11)', async () => {
  for (const c of B4477211) {
    const repo = claimed('0.23.1', c.files);
    try {
      expect(await run(['round', 'T-1', c.flag], repo), c.name).toEqual({ code: c.want.code, out: c.want.out, err: '' });
    } finally {
      cleanup(repo);
    }
  }
}, 300_000);

// Task 2: a data-loss or security finding the planner answered `does not hold` is never closed by the place: it waits for the owner (D-14, T-10-08).
const OWNED = (kind: 'security' | 'data-loss'): string => `1. Must — the export overwrites the old file — owner: "the owner accepts the overwrite as it is" — risk: ${kind}`;

it('risk:security a risk finding answered does not hold blocks the approach and the approval until the owner closes it (10-ac-21, D-14, T-10-08)', async () => {
  const risk = '1. Must — the export overwrites the old file — does not hold: src/a.ts:3 — risk: security';
  const repo = claimed('0.24.0', { [APPROACH]: rec([risk]) });
  try {
    const refused = await run(['round', 'T-1', '--approach'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out.startsWith('refused:')).toBe(true);
    expect(refused.out).toContain('Blocking findings:');
    expect(refused.out).toContain(risk);
    expect(refused.out).toContain('1.1 does not hold');
    expect(refused.out).toContain('waits for the owner');
    const approval = await run(['approve', 'T-1'], repo);
    expect(approval.code).toBe(1);
    expect(approval.out).toContain('blocks the approval');
    expect(approval.out).toContain(risk);
    expect(approval.out).toContain('1.1 does not hold');

    writeFiles(repo, { [APPROACH]: rec([OWNED('security')]) });
    commitMsg(repo, 'T-1 the owner decides');
    const after = await run(['round', 'T-1', '--approach'], repo);
    expect(after.code).toBe(1);
    expect(after.out).not.toContain('Blocking findings:');
    expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 300_000);

it('risk:security a risk plan finding answered does not hold stops the plan loop for the owner until the owner closes it (10-ac-21, D-14, T-10-08)', async () => {
  const risk = '1. Must — the export overwrites the old file — does not hold: src/a.ts:3 — risk: data-loss';
  const repo = claimed('0.24.0', { [PLAN]: rec([risk]) });
  try {
    const stopped = await run(['round', 'T-1', '--plan'], repo);
    expect(stopped.code).toBe(1);
    expect(stopped.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(stopped.out).toContain(risk);
    expect(stopped.out).toContain('1.1 does not hold');
    expect(stopped.out).toContain('waits for the owner');

    writeFiles(repo, { [PLAN]: rec([OWNED('data-loss')]) });
    commitMsg(repo, 'T-1 the owner decides');
    const after = await run(['round', 'T-1', '--plan'], repo);
    expect(after.code).toBe(1);
    expect(after.out.startsWith('refused:')).toBe(true);
    expect(after.out).toContain('Findings still open: none');
  } finally {
    cleanup(repo);
  }
}, 300_000);
