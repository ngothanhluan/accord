// One lane ticket through the phase 1 contract, end to end: approve, Ready, plan, two task-done runs, a
// converged review, the reviewer's evidence and ticks at the gated commit, and the Done pass that reads them.
import { readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';
import { describe, expect, it } from 'vitest';
import { PLAN } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

/** The orchestrator ran the suite after the last commit: task-done refuses a report older than HEAD. */
function freshReport(repo: string): void {
  const later = new Date(Date.now() + 5000);
  utimesSync(join(repo, 'reports', 'junit.xml'), later, later);
}

const evidence = (sha: string) =>
  [
    '---',
    'ticket: "T-1"',
    `commit: "${sha}"`,
    'reviewed_on: "2026-10-12"',
    '---',
    '',
    '## @ac-1 export writes a csv',
    '',
    'Result: pass',
    '',
    'Evidence: export#writes-csv passed in reports/junit.xml',
    '',
    '## @ac-2 commas are escaped',
    '',
    'Result: pass',
    '',
    'Evidence: export#escapes-commas passed in reports/junit.xml',
    '',
  ].join('\n');

describe('lane ticket flow', () => {
  // About twenty CLI runs, each spawning git: under a full parallel run on Windows that passes 30s.
  it('walks one ticket from unapproved to done', async () => {
    const repo = makeLaneRepo();
    try {
      // The ticket is worked on its own branch: gate done reads the branch diff from the default branch.
      commitAll(repo, 'base');
      gitRun(repo, 'switch', '-q', '-c', 't/T-1');
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(1);
      expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(0);
      // The plan records the commit it was written against, which gate plan checks against HEAD.
      const baseline = commitAll(repo);
      writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseline) });
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
      commitAll(repo, 'plan: T-1 ready');
      freshReport(repo);
      expect((await run(['task-done', 'T-1', '1'], repo)).code).toBe(0);
      expect((await run(['task-done', 'T-1', '1'], repo)).out).toContain('already recorded');
      const rows = JSON.parse((await run(['status', '--json'], repo)).out) as Record<string, unknown>[];
      expect(rows[0]).toMatchObject({ id: 'T-1', lane: 'M', stage: 'build', tasksDone: 1, tasksTotal: 2 });
      expect((await run(['anchor', 'T-1'], repo)).out).toContain('Stage: build 1/2, next: task 2 "Escaping"');
      expect((await run(['gate', 'done', 'T-1'], repo)).code).toBe(1);

      // Task 2, then the review loop converges.
      commitAll(repo);
      freshReport(repo);
      expect((await run(['task-done', 'T-1', '2'], repo)).code).toBe(0);
      writeFiles(repo, { 'accord/tickets/T-1/review.md': '## Round 1\nverdict: converged\n' });

      // The reviewer verifies the committed tree: evidence and ticks bound to HEAD, left uncommitted.
      const sha = commitAll(repo);
      const file = join(repo, 'accord', 'tickets', 'T-1.md');
      let ticket = readFileSync(file, 'utf8');
      const hash = /^ac_hash: "(.+)"$/m.exec(ticket)?.[1] as string;
      ticket = setFrontmatterKey(ticket, 'verified', ['ac-1', 'ac-2']);
      ticket = setFrontmatterKey(ticket, 'verified_hash', hash);
      ticket = setFrontmatterKey(ticket, 'verified_commit', sha);
      writeFileSync(file, ticket);
      writeFiles(repo, { 'accord/tickets/T-1/verification.md': evidence(sha) });

      const done = await run(['gate', 'done', 'T-1'], repo);
      expect(done.out).not.toContain(' error ');
      expect(done.code).toBe(0);
      const after = JSON.parse((await run(['status', '--json'], repo)).out) as Record<string, unknown>[];
      expect(after[0]).toMatchObject({ id: 'T-1', stage: 'done', tasksDone: 2, tasksTotal: 2 });

      // Committing only the ticket's own records moves HEAD but not the reviewed code: the gate still passes.
      commitAll(repo);
      const committed = await run(['gate', 'done', 'T-1'], repo);
      expect(committed.out).not.toContain(' error ');
      expect(committed.code).toBe(0);
      // A product-file change after the review is stale.
      writeFiles(repo, { 'src/more.ts': 'export const more = 1;\n' });
      commitAll(repo);
      const stale = await run(['gate', 'done', 'T-1'], repo);
      expect(stale.code).toBe(1);
      expect(stale.out).toContain('gate.stale-review');
    } finally {
      cleanup(repo);
    }
  }, 120_000);
});
