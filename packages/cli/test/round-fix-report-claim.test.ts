// Review 08.5 WR-04: `accord round` refuses a fix for a missing fix report only on a ticket whose claim commit git can read at 0.13.0 or later. A ticket with no claim commit to read (a squash
// or rebase dropped it) keeps the rules it had, so an upgrade does not turn a ticket in flight into one refused for a report it could never have. The CLI runs as 0.13.0.
import { expect, it, vi } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.13.0' } };
});

const REVIEW = 'accord/tickets/T-1/review.md';

/** A ticket in flight at the 0.13.0 pin with one fixed and checked review finding; `claimSubject` is the subject of the commit that claims it. */
function inFlight(claimSubject: string): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': pinned('0.13.0'), 'accord/tickets/T-1.md': laneTicket('T-1') });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  const base = commitMsg(repo, claimSubject, undefined, true);
  writeFiles(repo, { 'src/a.ts': 'export const a = 1;\n', 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) });
  const code = commitMsg(repo, 'code');
  writeFiles(repo, { 'src/a.ts': 'export const a = 2;\n' });
  const fix = commitMsg(repo, 'the fix');
  writeFiles(repo, { [REVIEW]: `Round record: 2\n\n## Round 1 head ${code}\n\nMust 1 [patch]: the export drops a row — src/a.ts:1 — fixed in ${fix} — checked: src/a.ts:3\n\nSecurity: no pattern matched\n` });
  commitMsg(repo, 'T-1 round 1');
  return repo;
}

it('risk:regression a ticket with no claim commit to read is not refused for a fix report (review WR-04)', async () => {
  const claimed = inFlight('claim: T-1');
  try {
    const r = await run(['round', 'T-1'], claimed);
    expect(r.code, 'a ticket claimed at 0.13.0 keeps the refusal').toBe(1);
    expect(r.out).toContain('accord brief T-1 --fix');
  } finally {
    cleanup(claimed);
  }
  const unclaimed = inFlight('start T-1');
  try {
    const r = await run(['round', 'T-1'], unclaimed);
    expect(r.out).not.toContain('accord brief');
    expect(r.out).toContain('Round: 2 of');
    expect(r.code).toBe(0);
  } finally {
    cleanup(unclaimed);
  }
}, 120_000);
