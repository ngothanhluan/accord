// ST-LN-91 D-19, D-12, D-15: `accord round <id> --plan` on real git. A ticket whose claim commit holds the cut-off pin is asked for grounds from the plan checker's
// round 1; a ticket claimed under 0.4.0 keeps the Phase 2 rule (asked from round 2, by the record's round-1 pin), whatever pin the record was committed under.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { PLAN_GROUNDS_FROM } from '@accord-dev/accord-core';
import { cleanup, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const PLAN = join('accord', 'tickets', 'T-1', 'plan-review.md');
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const rec = (...rounds: string[][]): string =>
  'Round record: 1\n\n' + rounds.map((lines, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`).join('');
const BARE = '1. Should — task 1 drops a header — open';

/** The claim commit under `claimPin`, then plan.md and the plan record committed under CONFIG: a ticket claimed at one release and worked on at another. */
function claimed(claimPin: string, text: string): string {
  const repo = makeLaneRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, [PLAN]: text });
  commitMsg(repo, 'T-1 plan critique');
  return repo;
}

it('risk:complex-branching accord round --plan refuses an ungrounded round-1 finding on real git for a ticket claimed at the cut-off (ST-LN-91 D-19)', async () => {
  const cut = claimed(PLAN_GROUNDS_FROM, rec([BARE]));
  try {
    const refused = await run(['round', 'T-1', '--plan'], cut);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain('round 1 of cycle 1, finding 1');
    expect(refused.out).toContain('from round 1 a Must or Should needs');

    // grounded: round 2 of 3 runs
    writeFiles(cut, { [PLAN]: rec([BARE + ' — rests on: ac-1']) });
    commitMsg(cut, 'T-1 plan critique grounded');
    expect(await run(['round', 'T-1', '--plan'], cut)).toEqual({ code: 0, out: 'Round: 2 of 3\nCycle: 1\n', err: '' });

    // deferred with its failing case in the ledger: round 2 runs
    writeFiles(cut, {
      [PLAN]: rec(['1. Should — task 1 drops a header — deferred']),
      'accord/tickets/T-1/ledger.md': '## Rulings\n- task 1 done abc1234\n\n## Deferred\n- plan 1.1: task 1 drops a header — failing case: an empty cell gives no quote\n',
    });
    commitMsg(cut, 'T-1 plan critique deferred');
    expect((await run(['round', 'T-1', '--plan'], cut)).out).toBe('Round: 2 of 3\nCycle: 1\n');
  } finally {
    cleanup(cut);
  }
  // the same history with the claim commit under 0.4.0: round 1 is not asked, the five-round rule holds
  const old = claimed('0.4.0', rec([BARE]));
  try {
    expect(await run(['round', 'T-1', '--plan'], old)).toEqual({ code: 0, out: 'Round: 2 of 5\nCycle: 1\n', err: '' });
  } finally {
    cleanup(old);
  }
}, 120_000);

it('risk:regression a plan record committed under the cut-off pin on a ticket claimed under 0.4.0 is asked from round 2 only (ST-LN-91 D-19)', async () => {
  const history = (claimPin: string): string => {
    const repo = makeLaneRepo();
    writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
    commitMsg(repo, 'claim: T-1');
    writeFiles(repo, { 'accord/config.yml': pinned(PLAN_GROUNDS_FROM), [PLAN]: rec([BARE]) });
    commitMsg(repo, 'T-1 plan critique round 1');
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'notes.txt': 'work after the record\n' });
    commitMsg(repo, 'T-1 back to the older pin');
    return repo;
  };
  const old = history('0.4.0');
  try {
    expect((await run(['round', 'T-1', '--plan'], old)).out).toBe('Round: 2 of 5\nCycle: 1\n');
    writeFiles(old, { [PLAN]: rec([BARE], [BARE]) });
    commitMsg(old, 'T-1 plan critique round 2');
    const refused = await run(['round', 'T-1', '--plan'], old);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('from round 2 a Must or Should needs');
  } finally {
    cleanup(old);
  }
}, 120_000);
