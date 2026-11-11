// ST-LN-91 D-11: `accord round` refuses a Must or Should of round 2 or later that cites no ticket line, read from the pin in
// accord/config.yml at the commit that recorded the record's first round, on real git.
import { expect, it } from 'vitest';
import { GROUNDS_V2_FROM } from '@accord-dev/accord-core';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const pinned = (v: string): string => CONFIG.replace('accord: "0.4.0"', `accord: "${v}"`);
const REVIEW = 'accord/tickets/T-1/review.md';
const should = (...marks: string[]): string => `Should 1 [patch]: the export drops a row — src/a.ts:1 — open${marks.map((m) => ' — ' + m).join('')}`;

/** A branch whose review.md round 1 is committed under `pin` and whose HEAD config is CONFIG; returns the repo and a writer of round 2. */
function reviewRepo(pin: string): { repo: string; write: (round2: string) => void } {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n' });
  const c1 = commitMsg(repo, 'code');
  writeFiles(repo, { 'accord/config.yml': pinned(pin), [REVIEW]: `Round record: 2\n\n## Round 1 head ${c1}\n\nNo findings\n` });
  commitMsg(repo, 'T-1 round 1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'src/b.ts': 'export const b = 1;\n' });
  const c2 = commitMsg(repo, 'the fix');
  const write = (round2: string): void => {
    writeFiles(repo, { [REVIEW]: `Round record: 2\n\n## Round 1 head ${c1}\n\nNo findings\n\n## Round 2 head ${c2}\n\n${round2}\n` });
    commitMsg(repo, 'T-1 round 2');
  };
  return { repo, write };
}

it('risk:complex-branching accord round refuses an ungrounded round 2 finding of review.md on real git from the cut-off pin (ST-LN-91 ac-1)', async () => {
  const { repo, write } = reviewRepo(GROUNDS_V2_FROM);
  try {
    write(should());
    const refused = await run(['round', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain('round 2');
    expect(refused.out).toContain('rests on');

    write(should('rests on: ac-1'));
    const grounded = await run(['round', 'T-1'], repo);
    expect(grounded.out).toContain('Round: 3 of 5');
    expect(grounded.code).toBe(0);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a record whose round 1 was committed under the older pin is not asked for grounds in round 2 (ST-LN-91 ac-1)', async () => {
  const { repo, write } = reviewRepo('0.4.0');
  try {
    write(should());
    const r = await run(['round', 'T-1'], repo);
    expect(r.out).toContain('Round: 3 of 5');
    expect(r.code).toBe(0);
  } finally {
    cleanup(repo);
  }
});
