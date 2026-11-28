// Phase 10 D-01, 10-ac-3, 10-ac-11: `accord round <id> --approach` and `--plan` on real git. A ticket whose claim commit holds 0.24.0 gets one critique round of each kind, one scoped
// re-check round for a data-loss or security fix, and more rounds only from `strictness.rounds.<kind>`; a ticket claimed under 0.23.1 answers as it did at b4477211, byte for byte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const PLAN = join('accord', 'tickets', 'T-1', 'plan-review.md');
const TICKET = join('accord', 'tickets', 'T-1.md');
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const rec = (...rounds: string[][]): string =>
  'Round record: 1\n\n' + rounds.map((lines, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`).join('');
const shoulds = (k: number): string[] => Array.from({ length: k }, (_, i) => `${i + 1}. Should — task ${i + 1} drops a header — open — rests on: ac-1`);

/** The claim commit under `claimPin`, then the record (when given) committed under `config` (CONFIG unless a test gives a team's): the shape of a ticket claimed at one release and worked on at another. */
function claimed(claimPin: string, files: Record<string, string> = {}, config = CONFIG): string {
  const repo = makeLaneRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': config, ...(Object.keys(files).length === 0 ? { 'notes.txt': 'work after the claim\n' } : files) });
  commitMsg(repo, 'T-1 critique');
  return repo;
}
const TEAM_PLAN_3 = CONFIG + 'strictness:\n  rounds:\n    plan: "3"\n';

// Round 1 of each kind holding a fixed Should, and one holding a fixed data-loss Must as well. The plan checker's findings rest on a ticket line from round 1.
const AP_ONE = rec(['1. Should — the impact list misses a caller — fixed']);
const PL_ONE = rec(['1. Should — task 1 drops a header — fixed — rests on: ac-1']);
const LOSS = '2. Must — the export overwrites the old file — fixed — risk: data-loss';
const AP_RISK = rec(['1. Should — the impact list misses a caller — fixed', LOSS]);
const PL_RISK = rec(['1. Should — task 1 drops a header — fixed — rests on: ac-1', LOSS]);
const RECHECK = 'Re-check: 1.2: a fresh critic re-checks only these fixes (D-01)\n';

it('risk:regression accord round --approach gives round 1 of 1 to a ticket claimed at 0.24.0 (10-ac-3, D-01)', async () => {
  const repo = claimed('0.24.0');
  try {
    expect(await run(['round', 'T-1', '--approach'], repo)).toEqual({ code: 0, out: 'Round: 1 of 1\nCycle: 1\n', err: '' });
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --approach refuses an ordinary round 2 and names the one critique round of D-01 (10-ac-3, D-01)', async () => {
  const repo = claimed('0.24.0', { [APPROACH]: AP_ONE });
  try {
    const answer = await run(['round', 'T-1', '--approach'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out.split('\n')[0]).toContain('D-01');
    expect(answer.out).toContain('one approach critique round');
    expect(answer.out).toContain('Findings still open: none');
    expect(answer.out).not.toContain('stop: report to owner');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --approach keeps round 2 of 2 for a ticket claimed under 0.23.1 (10-ac-11)', async () => {
  const repo = claimed('0.23.1', { [APPROACH]: AP_ONE });
  try {
    expect(await run(['round', 'T-1', '--approach'], repo)).toEqual({ code: 0, out: 'Round: 2 of 2\nCycle: 1\n', err: '' });
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --plan gives round 1 of 1 with the plan checker to a ticket claimed at 0.24.0 (10-ac-3, D-01)', async () => {
  const repo = claimed('0.24.0');
  try {
    expect(await run(['round', 'T-1', '--plan'], repo)).toEqual({ code: 0, out: 'Round: 1 of 1\nCycle: 1\nCritics: plan checker\n', err: '' });
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --plan refuses an ordinary round 2: the loop ended after its one round and a finding still open goes to the plan approval (10-ac-3, D-01)', async () => {
  const repo = claimed('0.24.0', { [PLAN]: rec(['1. Should — task 1 drops a header — open — rests on: ac-1']) });
  try {
    const answer = await run(['round', 'T-1', '--plan'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out.split('\n')[0]).toContain('D-01');
    expect(answer.out).toContain('plan approval');
    expect(answer.out).toContain('1. Should — task 1 drops a header — open — rests on: ac-1');
    expect(answer.out).not.toContain('stop: report to owner');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a fixed data-loss finding in round 1 earns one scoped re-check round of either kind (10-ac-3, D-01)', async () => {
  const approach = claimed('0.24.0', { [APPROACH]: AP_RISK });
  const plan = claimed('0.24.0', { [PLAN]: PL_RISK });
  try {
    expect(await run(['round', 'T-1', '--approach'], approach)).toEqual({ code: 0, out: 'Round: 2 of 2\nCycle: 1\n' + RECHECK, err: '' });
    expect(await run(['round', 'T-1', '--plan'], plan)).toEqual({ code: 0, out: 'Round: 2 of 2\nCycle: 1\n' + RECHECK, err: '' });
  } finally {
    cleanup(approach);
    cleanup(plan);
  }
}, 120_000);

it('risk:regression a re-check round admits only the risk findings it names, and no round 3 follows it (10-ac-3, D-01)', async () => {
  const fresh = ['1. Should — a new wording question — open — rests on: ac-1'];
  const approach = claimed('0.24.0', { [APPROACH]: rec(['1. Should — the impact list misses a caller — fixed', LOSS], fresh) });
  const plan = claimed('0.24.0', { [PLAN]: rec(['1. Should — task 1 drops a header — fixed — rests on: ac-1', LOSS], fresh) });
  try {
    for (const [flag, repo] of [['--approach', approach], ['--plan', plan]] as const) {
      const answer = await run(['round', 'T-1', flag], repo);
      expect(answer.code, flag).toBe(1);
      expect(answer.out.startsWith('refused:'), flag).toBe(true);
      expect(answer.out, flag).toContain('2.1');
      expect(answer.out, flag).toContain('covers only the risk findings it names');
    }
    // A re-check that names the risk finding it repeats, or carries a mark of its own, is in scope; round 3 is not asked for.
    const inScope = ['1. Should — the overwrite still happens in one path — fixed — carried from 1.2 — rests on: ac-1', '2. Must — a second file is lost too — fixed — risk: data-loss'];
    writeFiles(approach, { [APPROACH]: rec(['1. Should — the impact list misses a caller — fixed', LOSS], inScope) });
    commitMsg(approach, 'T-1 re-check');
    const ended = await run(['round', 'T-1', '--approach'], approach);
    expect(ended.code).toBe(1);
    expect(ended.out.split('\n')[0]).toContain('D-01');
    expect(ended.out).not.toContain('Round: 3');
  } finally {
    cleanup(approach);
    cleanup(plan);
  }
}, 120_000);

it('risk:security a risk finding still open after the re-check blocks the approach approval and stops the plan loop (10-ac-3, D-01, D-22)', async () => {
  const open = ['1. Must — the overwrite still happens — open — risk: data-loss'];
  const approach = claimed('0.24.0', { [APPROACH]: rec(['1. Should — the impact list misses a caller — fixed', LOSS], open) });
  const plan = claimed('0.24.0', { [PLAN]: rec(['1. Should — task 1 drops a header — fixed — rests on: ac-1', LOSS], open) });
  try {
    const refused = await run(['round', 'T-1', '--approach'], approach);
    expect(refused.code).toBe(1);
    expect(refused.out.startsWith('refused:')).toBe(true);
    expect(refused.out).toContain('Blocking findings:');
    expect(refused.out).toContain('1. Must — the overwrite still happens — open — risk: data-loss');
    const stopped = await run(['round', 'T-1', '--plan'], plan);
    expect(stopped.code).toBe(1);
    expect(stopped.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(stopped.out).toContain('1. Must — the overwrite still happens — open — risk: data-loss');
  } finally {
    cleanup(approach);
    cleanup(plan);
  }
}, 120_000);

it('risk:regression strictness.rounds.plan "3" allows rounds 2 and 3 and stops when the Must + Should count does not fall (10-ac-3, D-01)', async () => {
  const flat = claimed('0.24.0', { [PLAN]: rec(shoulds(2), shoulds(2)) }, TEAM_PLAN_3);
  const falling = claimed('0.24.0', { [PLAN]: rec(shoulds(2), shoulds(1)) }, TEAM_PLAN_3);
  const first = claimed('0.24.0', { [PLAN]: rec(shoulds(2)) }, TEAM_PLAN_3);
  try {
    expect(await run(['round', 'T-1', '--plan'], first)).toEqual({ code: 0, out: 'Round: 2 of 3\nCycle: 1\n', err: '' });
    const stop = await run(['round', 'T-1', '--plan'], flat);
    expect(stop.code).toBe(1);
    expect(stop.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(stop.out).toContain('Reason: round 2 of cycle 1 reports 2 Must and Should, not fewer than the 2 of round 1: the count did not fall, so the loop stops');
    expect(await run(['round', 'T-1', '--plan'], falling)).toEqual({ code: 0, out: 'Round: 3 of 3\nCycle: 1\n', err: '' });
  } finally {
    cleanup(flat);
    cleanup(falling);
    cleanup(first);
  }
}, 120_000);

it('risk:regression at the end of the one round an open finding with no risk mark is listed as a risk, and an open security finding still blocks approve (D-01 Ruling, D-22)', async () => {
  const unmarked = claimed('0.24.0', { [APPROACH]: rec(['1. Should — the cache can go stale — open']) });
  const marked = claimed('0.24.0', { [APPROACH]: rec(['1. Must — tokens reach the log — open — risk: security']) });
  try {
    const view = await run(['show', 'T-1', '--approval', '--short'], unmarked);
    expect(view.code).toBe(0);
    expect(view.out).toContain('1. Should — the cache can go stale — open');
    const before = readFileSync(join(unmarked, TICKET), 'utf8');
    const approved = await run(['approve', 'T-1'], unmarked);
    expect(approved.code).toBe(0);
    expect(readFileSync(join(unmarked, TICKET), 'utf8')).not.toBe(before);

    const refused = await run(['approve', 'T-1'], marked);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('blocks the approval');
    expect(refused.out).toContain('1. Must — tokens reach the log — open — risk: security');
  } finally {
    cleanup(unmarked);
    cleanup(marked);
  }
}, 120_000);

// 10-ac-11: for a ticket claimed under 0.23.1 the answers are the bytes b4477211 (0.23.1) printed. The literals below were captured from `node packages/cli/dist/cli.js` built at b4477211 in
// a scratch clone (C:/Work/accord-p10-scratch/main-b4477211), never in this worktree, for the same fixtures. They are the CLI lines the Legacy lines of plan 10-13 cite.
const AP_TWO = rec(['1. Must — the option drops the header — fixed'], ['1. Should — the cache can go stale — open — rests on: ac-1']);
const PL_FALL = rec(shoulds(3), shoulds(1));
const PL_STOP = rec(shoulds(2), shoulds(2));
const B4477211: { name: string; flag: '--approach' | '--plan'; files: Record<string, string>; want: { code: number; out: string } }[] = [
  { name: 'approach, no record', flag: '--approach', files: {}, want: { code: 0, out: 'Round: 1 of 2\nCycle: 1\n' } },
  { name: 'approach, round 1 with a finding', flag: '--approach', files: { [APPROACH]: AP_ONE }, want: { code: 0, out: 'Round: 2 of 2\nCycle: 1\n' } },
  {
    name: 'approach, round 2 with a finding and round 3 asked',
    flag: '--approach',
    files: { [APPROACH]: AP_TWO },
    want: {
      code: 1,
      out: 'refused: round 3 of cycle 1 is past the cap of 2 approach critique rounds, which no Ruling raises; the loop has ended: write the findings still open into ## Approach as risks, and the owner decides at the approval\nFindings still open:\nRound 2:\n1. Should — the cache can go stale — open — rests on: ac-1\n',
    },
  },
  { name: 'plan, no record', flag: '--plan', files: {}, want: { code: 0, out: 'Round: 1 of 3\nCycle: 1\nCritics: plan checker\n' } },
  { name: 'plan, round 1 with a finding', flag: '--plan', files: { [PLAN]: PL_ONE }, want: { code: 0, out: 'Round: 2 of 3\nCycle: 1\n' } },
  { name: 'plan, round 2 with a falling count', flag: '--plan', files: { [PLAN]: PL_FALL }, want: { code: 0, out: 'Round: 3 of 3\nCycle: 1\n' } },
  {
    name: 'plan, the count did not fall',
    flag: '--plan',
    files: { [PLAN]: PL_STOP },
    want: {
      code: 1,
      out:
        'stop: report to owner\nReason: round 2 of cycle 1 reports 2 Must and Should, not fewer than the 2 of round 1: the count did not fall, so the loop stops\nFindings of round 2:\n1. Should — task 1 drops a header — open — rests on: ac-1\n2. Should — task 2 drops a header — open — rests on: ac-1\nApproach:\nExtend the existing report writer with a csv mode.\nAsk the owner whether to change course: weigh the options the Approach above rejected or held in reserve against going on.\nTo accept the open findings: end plan-review.md with the line verdict: accepted-by-owner "<the owner\'s sentence>"\nTo allow more rounds: add under ## Rulings in the ledger: Ruling: the owner allows <n> more plan critique rounds after round 2 of cycle 1 — "<the owner\'s sentence>" — <cost if wrong>\nTo change course: write that Ruling with <n> the rounds the owner gives the reworked plan, then re-plan through the plan stage (plan.md)\n',
    },
  },
];

it('risk:regression a ticket claimed under 0.23.1 answers byte for byte as b4477211 did, for both kinds (10-ac-11)', async () => {
  for (const c of B4477211) {
    const repo = claimed('0.23.1', c.files);
    try {
      expect(await run(['round', 'T-1', c.flag], repo), c.name).toEqual({ code: c.want.code, out: c.want.out, err: '' });
    } finally {
      cleanup(repo);
    }
  }
}, 300_000);
