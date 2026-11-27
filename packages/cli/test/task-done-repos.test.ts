// Phase 08.9.3 D-06, D-12, D-04: `accord task-done` for a task built in ANOTHER repository joins the task's verify cases against `repos.<name>.report`, read in that repository's worktree and fresh against that worktree's HEAD, on the
// evidence rules of a task of this repository: a failed, missing or stale case, a missing executor report, a worktree that is not open on the slice holding the task, each refuse and record nothing. This repository's
// commit rules are not applied to the other repository's commits (Ruling R15). Real git in two sibling clones (helpers/repos.ts).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from './helpers/repo.js';
import { builtInTools, junitInTools, ONE_TOOLS_TASK, plannedTools, TOOLS_AFFECTED, toolsWt } from './helpers/repos-build.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

useRepoSandboxes();

const REPORT_LINE = '    report: build/junit.xml';
const ledgerOf = (r: Repos): string => join(r.svc, 'accord', 'tickets', 'ST-9', 'ledger.md');
const ticketOf = (r: Repos): string => readFileSync(join(r.svc, 'accord', 'tickets', 'ST-9.md'), 'utf8');

/** ST-9 planned with one tools task, `repos.tools.report` declared, the tools worktree built in. */
async function withReport(r: Repos, o: { executorReport?: boolean; message?: string; top?: string } = {}): Promise<string> {
  await plannedTools(r, ONE_TOOLS_TASK, [TOOLS_AFFECTED, REPORT_LINE], o.top);
  return builtInTools(r, o);
}

it('risk:regression task-done joins the tools report read in the tools worktree: a passed case records the task with no note (D-06, D-12)', async () => {
  const r = reposCopy();
  const head = await withReport(r);
  junitInTools(r, { 'Tools.Tests#adds': 'passed' });
  const res = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain(`recorded task 1 done at ${head.slice(0, 12)} in accord/tickets/ST-9/ledger.md\n`);
  expect(res.out).not.toContain('note:');
  expect(ticketOf(r)).toMatch(/@ac-1 @test:tools:Tools\.Tests#adds/);
}, 120_000);

it('risk:regression a case recorded failed in the tools report refuses the task and records nothing (D-06)', async () => {
  const r = reposCopy();
  await withReport(r);
  junitInTools(r, { 'Tools.Tests#adds': 'failed' });
  const res = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(1);
  expect(res.out).toContain('task 1 of ST-9 is not done:\n');
  expect(res.out).toContain('Tools.Tests#adds is recorded failed in tools:build/junit.xml');
  expect(existsSync(ledgerOf(r))).toBe(false);
  expect(ticketOf(r)).not.toContain('@test:tools');
}, 120_000);

it('risk:regression a tools report written before the last commit of the tools worktree is stale, and a case missing from it or a report that is not there refuses too (D-06)', async () => {
  const r = reposCopy();
  await withReport(r);
  // written an hour before the tools HEAD commit
  junitInTools(r, { 'Tools.Tests#adds': 'passed' }, -3600);
  const stale = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(stale.code, stale.out + stale.err).toBe(1);
  expect(stale.out).toContain('tools:build/junit.xml was written before the last commit of the tools worktree; run the tests again');
  junitInTools(r, { 'Other#case': 'passed' });
  const missing = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(missing.code, missing.out + missing.err).toBe(1);
  expect(missing.out).toContain('Tools.Tests#adds is not in tools:build/junit.xml');
  expect(existsSync(ledgerOf(r))).toBe(false);
  // the declared report is not in the worktree at all
  const r2 = reposCopy();
  await withReport(r2);
  const none = await run(['task-done', 'ST-9', '1'], r2.svc);
  expect(none.code, none.out + none.err).toBe(1);
  expect(none.out).toContain('tools:build/junit.xml is not a file in the tools worktree');
  expect(existsSync(ledgerOf(r2))).toBe(false);
}, 180_000);

it('risk:regression a task of tools with no executor report in the tools worktree is refused, naming its path there (D-04)', async () => {
  const r = reposCopy();
  await withReport(r, { executorReport: false });
  junitInTools(r, { 'Tools.Tests#adds': 'passed' });
  const res = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(1);
  expect(res.out).toContain(`the executor report ${toolsWt(r)}/.accord-reports/ST-9/task-1.md is missing`);
  expect(existsSync(ledgerOf(r))).toBe(false);
}, 120_000);

it('risk:regression task-done refuses with exit 2, naming accord worktree slice ST-9 1, when the tools worktree is not open or is on another branch (D-04)', async () => {
  const r = reposCopy();
  await plannedTools(r, ONE_TOOLS_TASK, [TOOLS_AFFECTED, REPORT_LINE]);
  const closed = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(closed.code, closed.out + closed.err).toBe(2);
  expect(closed.out + closed.err).toContain('accord worktree slice ST-9 1');
  await builtInTools(r);
  junitInTools(r, { 'Tools.Tests#adds': 'passed' });
  r.git(toolsWt(r), 'switch', '-q', '-c', 'elsewhere');
  const other = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(other.code, other.out + other.err).toBe(2);
  expect(other.out + other.err).toContain('is on elsewhere, not on slice/ST-9/1');
  expect(other.out + other.err).toContain('accord worktree slice ST-9 1');
  expect(existsSync(ledgerOf(r))).toBe(false);
}, 120_000);

it("risk:regression this repository's commit rules are not applied to the tools commits: a tools commit with a trailer and no conventional subject is still recorded (D-12, Ruling R15)", async () => {
  const r = reposCopy();
  const top = 'commits:\n  trailers: forbid\n  message:\n    preset: conventional\n';
  const head = await withReport(r, { top, message: 'tools task one\n\nCo-Authored-By: someone <someone@example.invalid>' });
  junitInTools(r, { 'Tools.Tests#adds': 'passed' });
  const res = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain(`recorded task 1 done at ${head.slice(0, 12)} in accord/tickets/ST-9/ledger.md\n`);
}, 120_000);
