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

const KINDS = [
  { flag: '--plan', file: 'accord/tickets/T-1/plan-review.md' },
  { flag: '--approach', file: 'accord/tickets/T-1/approach-review.md' },
] as const;
const ROUND_1 = 'Round record: 1\n\n## Round 1 (whole)\n\n1. Must — the plan drops a header — fixed\n\n';
const later = (finding: string): string => `${ROUND_1}## Round 2 (diff)\n\n${finding}\n`;
const unmarked = '1. Should — the impact list misses a caller — open';

/** A branch whose record's round 1 is committed under `pin` (main's config pins `base`) and whose HEAD config is CONFIG. */
function recordRepo(file: string, pin: string, base = '0.4.0'): { repo: string; write: (finding: string) => void } {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(base), 'accord/tickets/T-1.md': laneTicket('T-1') });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  writeFiles(repo, { 'accord/config.yml': pinned(pin), [file]: ROUND_1 });
  commitMsg(repo, 'record round 1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'src/b.ts': 'export const b = 1;\n' });
  commitMsg(repo, 'config back to the running version');
  return {
    repo,
    write: (finding: string): void => {
      writeFiles(repo, { [file]: later(finding) });
      commitMsg(repo, 'record round 2');
    },
  };
}

it("risk:complex-branching accord round --plan and --approach read the pin of the record's first round from git (ST-LN-91 ac-1)", async () => {
  for (const { flag, file } of KINDS) {
    const cut = recordRepo(file, GROUNDS_V2_FROM);
    try {
      cut.write(unmarked);
      const refused = await run(['round', 'T-1', flag], cut.repo);
      expect(refused.code, flag).toBe(1);
      expect(refused.out, flag).toContain('refused:');
      expect(refused.out, flag).toContain('round 2');
      expect(refused.out, flag).toContain('rests on');

      cut.write(unmarked + ' — rests on: ac-1');
      const grounded = await run(['round', 'T-1', flag], cut.repo);
      expect(grounded.out, flag).toContain('Round: 3 of 5');
      expect(grounded.code, flag).toBe(0);
    } finally {
      cleanup(cut.repo);
    }

    const older = recordRepo(file, '0.4.0');
    try {
      older.write(unmarked);
      const r = await run(['round', 'T-1', flag], older.repo);
      expect(r.out, flag).toContain('Round: 3 of 5');
      expect(r.code, flag).toBe(0);
    } finally {
      cleanup(older.repo);
    }
  }
}, 120_000);

it('risk:complex-branching a pin lowered on the branch below the default branch pin counts as the cut-off for plan and approach records (ST-LN-91 ac-1)', async () => {
  for (const { flag, file } of KINDS) {
    const lowered = recordRepo(file, '0.4.0', GROUNDS_V2_FROM);
    try {
      lowered.write(unmarked);
      const r = await run(['round', 'T-1', flag], lowered.repo);
      expect(r.code, flag).toBe(1);
      expect(r.out, flag).toContain('refused:');
      expect(r.out, flag).toContain('round 2');
    } finally {
      cleanup(lowered.repo);
    }
  }
}, 120_000);

// ST-LN-91 D-12: a round-2 finding without grounds deferred with its failing case does not block; a deferred risk finding does.
const LEDGER = 'accord/tickets/T-1/ledger.md';
const deferredShould = '1. Should — the impact list misses a caller — deferred';

it('risk:complex-branching accord round --plan and --approach let a deferred ungrounded finding pass and refuse a deferred risk finding (ST-LN-91 ac-1)', async () => {
  for (const { flag, file } of KINDS) {
    const kind = flag === '--plan' ? 'plan' : 'approach';
    const { repo, write } = recordRepo(file, GROUNDS_V2_FROM);
    try {
      // deferred with its line and failing case: round 3 is given
      writeFiles(repo, { [LEDGER]: `## Rulings\n\n## Deferred\n- ${kind} 2.1: impact list — failing case: a caller of export is not listed\n` });
      write(deferredShould);
      const passed = await run(['round', 'T-1', flag], repo);
      expect(passed.out, flag).toContain('Round: 3 of 5');
      expect(passed.code, flag).toBe(0);

      // without the failing case it is refused
      writeFiles(repo, { [LEDGER]: `## Rulings\n\n## Deferred\n- ${kind} 2.1: impact list\n` });
      const bare = await run(['round', 'T-1', flag], repo);
      expect(bare.code, flag).toBe(1);
      expect(bare.out, flag).toContain('refused:');
      expect(bare.out, flag).toContain('rests on');

      // a deferred data-loss finding is refused in the same round, with its line and failing case
      writeFiles(repo, { [LEDGER]: `## Rulings\n\n## Deferred\n- ${kind} 2.1: impact list — failing case: a caller of export is not listed\n` });
      write(deferredShould + ' — risk: data-loss');
      const risky = await run(['round', 'T-1', flag], repo);
      expect(risky.code, flag).toBe(1);
      expect(risky.out, flag).toContain('never deferred');
    } finally {
      cleanup(repo);
    }
  }
}, 120_000);
