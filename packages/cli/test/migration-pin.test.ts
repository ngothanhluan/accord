// ST-LN-91 mig-ac-1 and D-15 on real git: a ticket at approach whose history is pinned to 0.4.0 answers as before, whatever pin the working
// tree holds after an upgrade, for `accord gate ready`, `accord round --approach` and `accord gate plan`.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, DISCUSS_FROM } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

interface Found { rule: string; level: string; reason?: string; file?: string; line?: number }
const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
// The pin a commit holds decides its ticket's rules, so a CONFIG pin of the running version never decides here.
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const r = (n: number, mode: string, line: string) => '## Round ' + n + ' (' + mode + ')\n\n' + line + '\n\n';
const rec = (...rounds: string[]) => 'Round record: 1\n\n' + rounds.join('');
const R1 = r(1, 'whole', '1. Must — the option drops the header — fixed');
const R2 = r(2, 'diff', '1. Should — the cache can go stale — fixed — rests on: ac-1');
const R3 = r(3, 'diff', '1. Should — a risk has no undo — open — rests on: ac-1');

const findings = async (repo: string, gate: 'ready' | 'plan'): Promise<Found[]> => JSON.parse((await run(['gate', gate, 'T-1', '--json'], repo)).out).findings as Found[];
const discuss = (all: Found[]): Found[] => all.filter((f) => f.rule.startsWith('gate.discuss-'));

/**
 * A lane M ticket at approach: approved, claimed by a `claim: T-1` commit under `claimPin`, its approach-review.md rounds committed after
 * it (round 1 under `recordPin`, the rest under the pin of HEAD), and HEAD holding CONFIG again. `rounds` is the record as it ends.
 */
async function atApproach(claimPin: string, recordPin: string, rounds: string[]): Promise<string> {
  const repo = makeLaneRepo();
  await run(['approve', 'T-1'], repo);
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': pinned(recordPin), [APPROACH]: rec(rounds[0]) });
  commitMsg(repo, 'T-1 approach round 1');
  // notes.txt keeps the last commit from being empty when CONFIG already holds the pin of the record's first round.
  writeFiles(repo, { 'accord/config.yml': CONFIG, [APPROACH]: rec(...rounds), 'notes.txt': 'work after the rounds\n' });
  commitAll(repo, 'T-1 approach rounds');
  return repo;
}

it('risk:complex-branching accord on real git answers as before for a ticket at approach claimed under 0.4.0 (ST-LN-91 mig-ac-1)', async () => {
  // The ticket's whole history under 0.4.0; HEAD restores CONFIG, so the CLI's own pin check passes at the running version.
  const old = await atApproach('0.4.0', '0.4.0', [R1, R2, R3]);
  // The same ticket with every commit at CONFIG: the findings of gate plan, which no Phase 3 rule has changed yet, are the same.
  const same = await atApproach(CONFIG.match(/accord: "([^"]*)"/)![1], CONFIG.match(/accord: "([^"]*)"/)![1], [R1, R2, R3]);
  try {
    const ready = await run(['gate', 'ready', 'T-1', '--json'], old);
    expect(discuss(JSON.parse(ready.out).findings as Found[])).toEqual([]);

    const round = await run(['round', 'T-1', '--approach'], old);
    expect(round.code).toBe(1);
    expect(round.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(round.out).toContain('Reason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop');
    expect(round.out).toContain('more approach critique rounds after round 3 of cycle 1');
    expect(round.out).not.toContain('Findings still open:');

    expect(await findings(old, 'plan')).toEqual(await findings(same, 'plan'));
  } finally {
    cleanup(old);
    cleanup(same);
  }

  // D-15: claimed under 0.4.0, its approach record begun at the cap cut-off, HEAD holding the pin of the running version: the claim pin decides.
  const late = await atApproach('0.4.0', APPROACH_CAP_FROM, [R1, R2]);
  try {
    expect(discuss(await findings(late, 'ready'))).toEqual([]);
    const round = await run(['round', 'T-1', '--approach'], late);
    expect(round.code).toBe(0);
    expect(round.out).toBe('Round: 3 of 5\nCycle: 1\n');
  } finally {
    cleanup(late);
  }

  // The contrast: the same ticket claimed at the cut-off is asked for its discuss record and gets the cap of two.
  const fresh = await atApproach(DISCUSS_FROM, APPROACH_CAP_FROM, [R1]);
  try {
    expect(discuss(await findings(fresh, 'ready')).map((f) => f.rule)).toEqual(['gate.discuss-missing']);
    expect((await run(['round', 'T-1', '--approach'], fresh)).out).toBe('Round: 2 of 2\nCycle: 1\n');
  } finally {
    cleanup(fresh);
  }
}, 120_000);
