// ST-LN-80 Task 1 (@ac-4): `accord round <id> --approach` counts approach-review.md as --plan counts plan-review.md.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, pinBefore, pinOf } from '@accord-dev/accord-core';
import { cleanup, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';

const rec = (...r: string[]) => 'Round record: 1\n\n' + r.join('');
const r = (n: number, mode: string, line: string) => '## Round ' + n + ' (' + mode + ')\n\n' + line + '\n\n';
const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const PLAN = join('accord', 'tickets', 'T-1', 'plan-review.md');
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

it('ac-4 accord round approach counts approach critique rounds with the plan cap and stop', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }) });
  try {
    commitMsg(repo, 'fixture');
    expect(await run(['round', 'T-1', '--approach'], repo)).toEqual({ code: 0, out: 'Round: 1 of 5\nCycle: 1\n', err: '' });

    const two = rec(r(1, 'whole', '1. Must — the option drops the header — fixed'), r(2, 'diff', '1. Should — the impact list misses a caller — fixed — rests on: ac-1'));
    writeFiles(repo, { [APPROACH]: two });
    expect(await run(['round', 'T-1', '--approach'], repo)).toEqual({ code: 0, out: 'Round: 3 of 5\nCycle: 1\n', err: '' });

    const three = two + r(3, 'diff', '1. Should — a risk has no undo — open — rests on: ac-1');
    writeFiles(repo, { [APPROACH]: three, [PLAN]: three });
    const a = await run(['round', 'T-1', '--approach'], repo);
    expect(a.code).toBe(1);
    expect(a.out.startsWith('stop: report to owner\n')).toBe(true);
    for (const part of [
      'Reason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop',
      'end approach-review.md with the line verdict: accepted-by-owner',
      'more approach critique rounds after round 3 of cycle 1',
    ]) {
      expect(a.out, part).toContain(part);
    }
    const p = await run(['round', 'T-1', '--plan'], repo);
    expect(p.code).toBe(1);
    expect(p.out.split('\n').slice(0, 2)).toEqual(a.out.split('\n').slice(0, 2));

    const five = rec(...[1, 2, 3, 4, 5].map((n) => r(n, n === 1 ? 'whole' : 'diff', '1. Nice — a wording — deferred')));
    writeFiles(repo, { [APPROACH]: five, [PLAN]: five });
    for (const flag of ['--approach', '--plan']) {
      const capped = await run(['round', 'T-1', flag], repo);
      expect(capped.code, flag).toBe(1);
      expect(capped.out.startsWith('stop: report to owner\n'), flag).toBe(true);
      expect(capped.out, flag).toContain('Reason: the cap of 5 rounds in cycle 1 is reached');
    }

    const s = await run(['round', 'S-1', '--approach'], repo);
    expect(s.code).toBe(2);
    expect(s.err).toContain('lane S has no approach critique');
    expect((await run(['round', 'T-1', '--plan', '--approach'], repo)).code).toBe(2);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching accord round --approach refuses a third round on real git from the cut-off (ST-LN-91 91d-ac-2)', async () => {
  // The claim commit holds the cut-off pin; HEAD holds CONFIG again, and both rounds are committed after it.
  const repo = makeLaneRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': pinned(APPROACH_CAP_FROM) });
    commitMsg(repo, 'claim: T-1');
    const two = rec(
      r(1, 'whole', '1. Must — the option drops the header — fixed\n2. Must — no rollback — unverified'),
      r(2, 'diff', '1. Should — the cache can go stale — open'),
    );
    writeFiles(repo, { 'accord/config.yml': CONFIG, [APPROACH]: two });
    commitMsg(repo, 'T-1 approach rounds');
    const a = await run(['round', 'T-1', '--approach'], repo);
    expect(a.code).toBe(1);
    expect(a.out.startsWith('refused:')).toBe(true);
    expect(a.out).toContain('Findings still open:');
    expect(a.out).toContain('2. Must — no rollback — unverified');
    expect(a.out).toContain('1. Should — the cache can go stale — open');
    expect(a.out).not.toContain('stop: report to owner');
    expect(a.out).not.toContain('To allow more rounds');
  } finally {
    cleanup(repo);
  }

  // A ticket with no claim commit and no approach record: its ticket-adding commit holds CONFIG, so the cap is the one CONFIG's pin gives.
  const fresh = makeLaneRepo();
  try {
    commitMsg(fresh, 'fixture');
    const n = pinBefore(APPROACH_CAP_FROM, pinOf(CONFIG)) ? 5 : 2;
    expect(await run(['round', 'T-1', '--approach'], fresh)).toEqual({ code: 0, out: `Round: 1 of ${n}\nCycle: 1\n`, err: '' });
  } finally {
    cleanup(fresh);
  }
}, 120_000);
