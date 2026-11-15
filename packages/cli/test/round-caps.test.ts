// ST-LN-50 t2-ac-4, D-07: `strictness.rounds.<record>` sets the round cap of that record from 1 to 99, on real git and through `accord config`. A cap of 1 ends
// the plan critique at round 1; 0 is a config error for the schema, for `accord lint` and for `accord config set`, and a refusal leaves the file as it was.
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { APPROACH_CAP_FROM, PLAN_CAP_FROM } from '@accord-dev/accord-core';
import { commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, pinned } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  // no retries: nothing here holds a handle on the folder, and one that did would be a bug to see
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

const PLAN = join('accord', 'tickets', 'T-1', 'plan-review.md');
const rec = (...rounds: string[][]): string =>
  'Round record: 1\n\n' + rounds.map((lines, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`).join('');
const shoulds = (k: number): string[] => Array.from({ length: k }, (_, i) => `${i + 1}. Should — task ${i + 1} drops a header — open — rests on: ac-1`);
const config = (repo: string): string => readFileSync(join(repo, 'accord', 'config.yml'), 'utf8');

/** A ticket claimed at the plan cap's cut-off, its plan record committed after the claim: round 1 holds two Shoulds. */
function claimed(): string {
  const repo = makeLaneRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': pinned(PLAN_CAP_FROM) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, [PLAN]: rec(shoulds(2)) });
  commitMsg(repo, 'T-1 plan critique');
  return repo;
}

it('risk:complex-branching accord round stops at a cap of 1 (ST-LN-50 t2-ac-4)', async () => {
  const repo = claimed();
  // today's cap: round 2 of 3
  expect(await run(['round', 'T-1', '--plan'], repo)).toEqual({ code: 0, out: 'Round: 2 of 3\nCycle: 1\n', err: '' });

  // the team sets the cap through accord config: round 1 is the last round
  const set = await run(['config', 'set', 'strictness.rounds.plan', '1'], repo);
  expect(set.err).toBe('');
  expect(set.code).toBe(0);
  expect(config(repo)).toBe(CONFIG + 'strictness:\n  rounds:\n    plan: "1"\n');
  const stop = await run(['round', 'T-1', '--plan'], repo);
  expect(stop.err).toBe('');
  expect(stop.code).toBe(1);
  expect(stop.out.startsWith('stop: report to owner\n')).toBe(true);
  expect(stop.out).toContain('Reason: the cap of 1 rounds in cycle 1 is reached and no owner Ruling in the ledger allows more');
  expect(stop.out).not.toContain('Round: 2');
  // the other records keep their caps: the approach critic still gives its two rounds, the review its five
  expect(await run(['round', 'T-1', '--approach'], repo)).toEqual({ code: 0, out: 'Round: 1 of 2\nCycle: 1\n', err: '' });
  expect((await run(['round', 'T-1'], repo)).out).toContain('Round: 1 of 5\n');

  // unset: today's cap again
  expect((await run(['config', 'unset', 'strictness.rounds.plan'], repo)).code).toBe(0);
  expect(config(repo)).toBe(CONFIG);
  expect(await run(['round', 'T-1', '--plan'], repo)).toEqual({ code: 0, out: 'Round: 2 of 3\nCycle: 1\n', err: '' });
}, 120_000);

it('risk:parsing a round cap of 0 is a config error for accord config and for accord lint (ST-LN-50 t2-ac-4)', async () => {
  const repo = claimed();
  const before = config(repo);
  for (const bad of ['0', '-1', '100', 'two']) {
    const refused = await run(['config', 'set', 'strictness.rounds.plan', bad], repo);
    expect(refused.code, bad).toBe(2);
    expect(refused.err, bad).toContain('strictness.rounds.plan');
    expect(refused.err, bad).toContain('accord/config.yml was not changed');
    expect(config(repo), bad).toBe(before);
  }
  // a hand-written 0: lint reports it at accord/config.yml
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'strictness:\n  rounds:\n    plan: "0"\n' });
  const lint = await run(['lint', '--json'], repo);
  expect(lint.code).toBe(1);
  const { findings } = JSON.parse(lint.out) as { findings: { file: string; rule: string; level: string; pointer?: string }[] };
  expect(findings.filter((f) => f.file === 'accord/config.yml' && f.level === 'error').map((f) => `${f.rule}@${f.pointer}`)).toEqual(['schema.pattern@/strictness/rounds/plan']);
}, 120_000);

// D-07: an open security or data-loss approach finding blocks `accord approve` at every cap, on real git.
const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const LOSS = '1. Must — the export overwrites the old file — open — risk: data-loss';
const SEC = '1. Must — tokens are written to the log — open — risk: security';

/** A ticket claimed at the approach cap's cut-off; HEAD holds `strictness.rounds.approach: cap` (none for undefined) and the approach record. */
function claimedApproach(cap: string | undefined, record: string): string {
  const repo = makeLaneRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': pinned(APPROACH_CAP_FROM) });
  commitMsg(repo, 'claim: T-1');
  const config = cap === undefined ? CONFIG : CONFIG + `strictness:\n  rounds:\n    approach: "${cap}"\n`;
  writeFiles(repo, { 'accord/config.yml': config, [APPROACH]: record });
  commitMsg(repo, 'T-1 approach rounds');
  return repo;
}

for (const [kind, finding] of [['data-loss', LOSS], ['security', SEC]] as const) {
  it(`risk:security accord approve refuses an open ${kind} finding at caps of 1, 2, 9 and the default (ST-LN-50 t2-ac-4)`, async () => {
    for (const cap of ['1', '2', '9', undefined]) {
      const record = 'Round record: 1\n\n## Round 1\n\n' + finding + '\n\n';
      const repo = claimedApproach(cap, record);
      const label = `cap ${cap ?? 'default'}`;
      const refused = await run(['approve', 'T-1'], repo);
      expect(refused.code, label).toBe(1);
      expect(refused.out, label).toContain('blocks the approval');
      expect(refused.out, label).toContain(finding);
      expect(refused.err, label).toBe('');
      const shown = await run(['show', 'T-1', '--approval', '--short'], repo);
      expect(shown.code, label).toBe(0);
      const lines = shown.out.split('\n');
      expect(lines, label).toContain('## Blocking findings');
      expect(lines, label).toContain('- round 1: ' + finding);
      // the owner never gets a yes to a ticket that still has the finding open; fixed, the same record is approved
      writeFiles(repo, { [APPROACH]: record.replace(' — open — ', ' — fixed — ') });
      const approved = await run(['approve', 'T-1'], repo);
      expect(approved.out, label).toMatch(/^approved /);
      expect(approved.code, label).toBe(0);
    }
  }, 120_000);
}
