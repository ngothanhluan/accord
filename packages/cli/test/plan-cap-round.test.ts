// ST-LN-91 91p-ac-3, D-07, D-12, D-15: `accord round <id> --plan` on real git. A ticket whose claim commit holds the cut-off pin gets three rounds, the
// stop after a round whose Must + Should count did not fall, and the line `Critics: plan checker` at round 1; a ticket claimed under 0.4.0 keeps the
// 0.4.0 answer, whatever pin its plan-review.md round 1 was committed under.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { PLAN_CAP_FROM } from '@accord-dev/accord-core';
import { cleanup, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const PLAN = join('accord', 'tickets', 'T-1', 'plan-review.md');
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const rec = (...rounds: string[][]): string =>
  'Round record: 1\n\n' + rounds.map((lines, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`).join('');
const shoulds = (k: number): string[] => Array.from({ length: k }, (_, i) => `${i + 1}. Should — task ${i + 1} drops a header — open`);

/** The claim commit under `claimPin`, then the plan record committed under CONFIG: the shape of a ticket claimed at one release and worked on at another. */
function claimed(claimPin: string, text?: string): string {
  const repo = makeLaneRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, ...(text === undefined ? { 'notes.txt': 'work after the claim\n' } : { [PLAN]: text }) });
  commitMsg(repo, 'T-1 plan critique');
  return repo;
}

it('risk:complex-branching accord round --plan stops on real git when the count did not fall (ST-LN-91 91p-ac-3)', async () => {
  const repo = claimed(PLAN_CAP_FROM, rec(shoulds(2), shoulds(2)));
  try {
    const stop = await run(['round', 'T-1', '--plan'], repo);
    expect(stop.code).toBe(1);
    expect(stop.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(stop.out).toContain('Reason: round 2 of cycle 1 reports 2 Must and Should, not fewer than the 2 of round 1: the count did not fall, so the loop stops');
    expect(stop.err).toBe('');

    // A round that falls goes on, to round 3 of 3.
    writeFiles(repo, { [PLAN]: rec(shoulds(3), shoulds(1)) });
    commitMsg(repo, 'T-1 plan critique falls');
    expect(await run(['round', 'T-1', '--plan'], repo)).toEqual({ code: 0, out: 'Round: 3 of 3\nCycle: 1\n', err: '' });

    // Round 3 with a finding stops at the cap of three.
    writeFiles(repo, { [PLAN]: rec(shoulds(3), shoulds(1), shoulds(1)) });
    commitMsg(repo, 'T-1 plan critique round 3');
    const cap = await run(['round', 'T-1', '--plan'], repo);
    expect(cap.code).toBe(1);
    expect(cap.out).toContain('Reason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop');
    expect(cap.out).toContain('Reason: the cap of 3 rounds in cycle 1 is reached');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --plan on a ticket claimed under 0.4.0 answers as 0.4.0 did (ST-LN-91 91p-ac-3)', async () => {
  const repo = claimed('0.4.0', rec(shoulds(2), shoulds(2)));
  try {
    // The same record that stops a ticket claimed at the cut-off: round 3 of 5, no stop at round 2.
    expect(await run(['round', 'T-1', '--plan'], repo)).toEqual({ code: 0, out: 'Round: 3 of 5\nCycle: 1\n', err: '' });
    writeFiles(repo, { [PLAN]: rec(shoulds(2), shoulds(2), shoulds(1)) });
    commitMsg(repo, 'T-1 plan critique round 3');
    const stop = await run(['round', 'T-1', '--plan'], repo);
    expect(stop.code).toBe(1);
    expect(stop.out).toContain('Reason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop');
    expect(stop.out).not.toContain('did not fall');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching accord round --plan names the plan checker at round 1 only for a ticket claimed at the cut-off (ST-LN-91 D-12)', async () => {
  const cut = claimed(PLAN_CAP_FROM);
  try {
    expect(await run(['round', 'T-1', '--plan'], cut)).toEqual({ code: 0, out: 'Round: 1 of 3\nCycle: 1\nCritics: plan checker\n', err: '' });
  } finally {
    cleanup(cut);
  }
  const old = claimed('0.4.0');
  try {
    expect(await run(['round', 'T-1', '--plan'], old)).toEqual({ code: 0, out: 'Round: 1 of 5\nCycle: 1\n', err: '' });
  } finally {
    cleanup(old);
  }
}, 120_000);

it('risk:complex-branching accord round --plan keeps the 0.4.0 round 1 for a ticket claimed under 0.4.0 whose plan record began after the upgrade (ST-LN-91 D-12, D-15)', async () => {
  // Round 1 is committed under the cut-off pin (the Phase 2 grounds rule applies to the record), a `No findings` round 2 and ## Closed follow, HEAD is back on CONFIG.
  const history = (claimPin: string): string => {
    const repo = makeLaneRepo();
    writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
    commitMsg(repo, 'claim: T-1');
    const one = rec(['1. Must — task 1 drops a header — fixed — rests on: ac-1']);
    writeFiles(repo, { 'accord/config.yml': pinned(PLAN_CAP_FROM), [PLAN]: one });
    commitMsg(repo, 'T-1 plan critique round 1');
    writeFiles(repo, { 'accord/config.yml': CONFIG, [PLAN]: one + '## Round 2 (diff)\n\nNo findings\n\n## Closed\n\n' });
    commitMsg(repo, 'T-1 plan critique closed');
    return repo;
  };
  const old = history('0.4.0');
  try {
    expect(await run(['round', 'T-1', '--plan'], old)).toEqual({ code: 0, out: 'Round: 1 of 5\nCycle: 2\n', err: '' });
  } finally {
    cleanup(old);
  }
  const cut = history(PLAN_CAP_FROM);
  try {
    expect(await run(['round', 'T-1', '--plan'], cut)).toEqual({ code: 0, out: 'Round: 1 of 3\nCycle: 2\nCritics: plan checker\n', err: '' });
  } finally {
    cleanup(cut);
  }
}, 120_000);
