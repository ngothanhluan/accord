// One lane ticket through the phase 1 contract, end to end: approve, Ready, plan, two task-done runs, a
// converged review, the reviewer's evidence and ticks at the gated commit, and the Done pass that reads them.
import { readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordTaskDone, setFrontmatterKey } from '@accord-dev/accord-core';
import { describe, expect, it } from 'vitest';
import { approve, gateReadyIn, P, PLAN, type Files } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

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

/** A lane repository brought to the state the old walk had at the start of stage `stage`, with no CLI run. */
function stageRepo(stage: 2 | 3 | 4): string {
  const repo = makeLaneRepo();
  try {
    // makeLaneRepo sets no identity: commitMsg needs one, and the walk's commits were authored by this one.
    gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    // The ticket is worked on its own branch: gate done reads the branch diff from the default branch.
    commitMsg(repo, 'base');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    // accord approve and accord gate ready, run in core on the repository's own files.
    const files: Files = {};
    for (const rel of ['accord/config.yml', P('T-1'), 'accord/tickets/T-1/plan.md', 'src/export.ts', 'reports/junit.xml']) {
      files[rel] = readFileSync(join(repo, ...rel.split('/')), 'utf8');
    }
    approve(files, 'T-1');
    expect(gateReadyIn(files, 'T-1')).toBe('pass');
    writeFiles(repo, { [P('T-1')]: files[P('T-1')] });
    const baseline = commitMsg(repo, 'fixture');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseline) });
    const planned = commitMsg(repo, 'plan: T-1 ready');
    freshReport(repo);
    if (stage === 2) return repo;
    // The ledger line task-done 1 wrote, left uncommitted as the command leaves it.
    const ledger = 'accord/tickets/T-1/ledger.md';
    const one = recordTaskDone(undefined, 1, planned.slice(0, 12)) as string;
    writeFiles(repo, { [ledger]: one });
    if (stage === 3) return repo;
    const next = commitMsg(repo, 'fixture');
    freshReport(repo);
    writeFiles(repo, { [ledger]: recordTaskDone(one, 2, next.slice(0, 12)) as string });
    return repo;
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}

describe('lane ticket flow', () => {
  // Each stage starts from core-ready files, so a test spawns only the CLI runs its title names.
  it('risk:complex-branching gate ready passes only after approve and gate plan passes on a plan against HEAD', async () => {
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
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:complex-branching task-done records task 1 once and status shows build 1/2', async () => {
    const repo = stageRepo(2);
    try {
      expect((await run(['task-done', 'T-1', '1'], repo)).code).toBe(0);
      expect((await run(['task-done', 'T-1', '1'], repo)).out).toContain('already recorded');
      const rows = JSON.parse((await run(['status', '--json'], repo)).out) as Record<string, unknown>[];
      expect(rows[0]).toMatchObject({ id: 'T-1', lane: 'M', stage: 'build', tasksDone: 1, tasksTotal: 2 });
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:complex-branching anchor names task 2 next, Done fails before task 2, and task-done records task 2', async () => {
    const repo = stageRepo(3);
    try {
      expect((await run(['anchor', 'T-1'], repo)).out).toContain('Stage: build 1/2, next: task 2 "Escaping"');
      expect((await run(['gate', 'done', 'T-1'], repo)).code).toBe(1);

      // Task 2, then the review loop converges.
      commitAll(repo);
      freshReport(repo);
      expect((await run(['task-done', 'T-1', '2'], repo)).code).toBe(0);
    } finally {
      cleanup(repo);
    }
  }, 120_000);

  it('risk:complex-branching Done passes on ticks at HEAD, still passes after the records are committed, and fails on a later product change', async () => {
    const repo = stageRepo(4);
    try {
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
