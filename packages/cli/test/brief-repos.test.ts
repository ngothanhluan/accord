// Phase 08.9.3 D-04, D-05, D-06, D-12: the build stage of a task in ANOTHER repository. `accord brief <id> <n>` sends the executor to that repository's recorded worktree (Repository:, Work dir:, the report there, the task's paths
// there) with the test command of `repos.<name>` from this repository's config, and `accord task-done` records the task in THIS repository's ledger at the other worktree's HEAD with the `@test:<name>:<case id>` tag. Real git
// in two sibling clones (helpers/repos.ts); the CLI runs no test command.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from './helpers/repo.js';
import { builtInTools, ONE_TOOLS_TASK, plannedTools, slice, task, TOOLS_AFFECTED, toolsWt } from './helpers/repos-build.js';
import { besides, reposCopy, useRepoSandboxes } from './helpers/repos.js';

useRepoSandboxes();

it('risk:regression accord brief for a task of tools names its repository, works in the tools worktree with its report there, and prints the tools test command over the task\'s tools paths (D-04, D-05, D-06)', async () => {
  const r = reposCopy();
  await plannedTools(r, ONE_TOOLS_TASK);
  expect((await run(['worktree', 'slice', 'ST-9', '1'], r.svc)).code).toBe(0);
  const res = await run(['brief', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const lines = res.out.split('\n');
  const at = lines.indexOf('Repository: tools');
  expect(at).toBeGreaterThan(-1);
  // Repository, then Work dir with its rule, then the report under the tools worktree, then tools' own test command
  expect(lines[at + 1]).toBe(`Work dir: ${toolsWt(r)}`);
  expect(lines[at + 2]).toMatch(/^Work only in this folder: /);
  expect(lines[at + 3]).toBe(`Report file: ${toolsWt(r)}/.accord-reports/ST-9/task-1.md`);
  expect(res.out).toContain('Test command: node -e "process.exit(0)" src/Tools.cs\n');
  expect(res.out).toContain('This is the only test command the executor runs for this task.');
  // the tools worktree holds the report folder's ignore file and stays clean
  expect(readFileSync(join(toolsWt(r), '.accord-reports', '.gitignore'), 'utf8')).toBe('*\n');
  expect(r.git(toolsWt(r), 'status', '--porcelain').trim()).toBe('');
}, 120_000);

it('risk:regression accord task-done records a task of tools at the tools worktree HEAD in this repository\'s ledger and tags the scenario @test:tools:<case id> (D-12)', async () => {
  const r = reposCopy();
  await plannedTools(r, ONE_TOOLS_TASK);
  const head = await builtInTools(r);
  const res = await run(['task-done', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain('wrote @test:tools:Tools.Tests#adds on @ac-1 in accord/tickets/ST-9.md\n');
  expect(res.out).toContain(`recorded task 1 done at ${head.slice(0, 12)} in accord/tickets/ST-9/ledger.md\n`);
  expect(res.out).toContain("note: repository tools declares no repos.tools.report, so task 1's verify cases were not read here; verify runs repos.tools.tests in full (D-06, D-12)\n");
  expect(readFileSync(join(r.svc, 'accord', 'tickets', 'ST-9', 'ledger.md'), 'utf8')).toContain(head.slice(0, 12));
  expect(readFileSync(join(r.svc, 'accord', 'tickets', 'ST-9.md'), 'utf8')).toMatch(/@ac-1 @test:tools:Tools\.Tests#adds/);
}, 120_000);

/** Slice 1 builds tasks 1 and 2 in tools (disjoint paths, no `after:` between them), slice 2 builds task 3 here. */
const TWO_TOOLS_TASKS = [
  task(1, 'tools:src/Tools.cs', 'Tools.Tests#adds'),
  task(2, 'tools:src/Other.cs', 'Tools.Tests#subtracts'),
  task(3, 'src/svc.ts', 'export#writes-csv'),
  slice(1, '1, 2', 'tools'),
  slice(2, '3'),
].join('\n');

it('risk:regression two tasks of tools with disjoint paths are two waves, never one: the one worktree of tools builds one task at a time (Decision 4)', async () => {
  const r = reposCopy();
  await plannedTools(r, TWO_TOOLS_TASKS);
  const res = await run(['waves', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain('Wave 1: 1\nWave 2: 2\n');
  expect(res.out).not.toContain('Wave 3');
}, 120_000);

it("risk:regression accord worktree task open refuses a task of tools, naming tools' worktree, and creates nothing (D-04, D-10)", async () => {
  const r = reposCopy();
  await plannedTools(r, TWO_TOOLS_TASKS);
  expect((await run(['worktree', 'slice', 'ST-9', '1'], r.svc)).code).toBe(0);
  const before = r.git(r.svc, 'worktree', 'list', '--porcelain');
  const res = await run(['worktree', 'task', 'open', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(2);
  expect(res.out + res.err).toContain(`task 1 is in repository tools: it is built in tools' worktree ${toolsWt(r)}, one task at a time; nothing was created`);
  expect(r.git(r.svc, 'worktree', 'list', '--porcelain')).toBe(before);
  expect(besides(r.svc)).toEqual([]);
  expect(r.git(r.svc, 'for-each-ref', '--format=%(refname)', 'refs/heads/accord-task').trim()).toBe('');
}, 120_000);

it("risk:regression accord brief --fix for a task of tools works in the tools worktree, runs tools' affected command over the task's tools paths, and prints no commit rule of this repository (D-04, D-06, Ruling R15)", async () => {
  const r = reposCopy();
  await plannedTools(r, TWO_TOOLS_TASKS, [TOOLS_AFFECTED], 'commits:\n  message:\n    preset: conventional\n');
  expect((await run(['worktree', 'slice', 'ST-9', '1'], r.svc)).code).toBe(0);
  const findings = join(r.parent, 'findings.md');
  writeFileSync(findings, '1. tools:src/Tools.cs:3 - the sum is off by one.\n');
  const res = await run(['brief', 'ST-9', '1', '--fix', findings], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const lines = res.out.split('\n');
  const at = lines.indexOf('Repository: tools');
  expect(at).toBeGreaterThan(-1);
  expect(lines[at + 1]).toBe(`Work dir: ${toolsWt(r)}`);
  expect(lines[at + 3]).toBe(`Report file: ${toolsWt(r)}/.accord-reports/ST-9/fix-1.md`);
  expect(res.out).toContain('Test command: node -e "process.exit(0)" src/Tools.cs\nThis is the only test command the executor runs for these findings.\n');
  expect(res.out).not.toContain('Commit rule:');
  // the same brief for a task of this repository still carries this repository's rule
  const own = await run(['brief', 'ST-9', '3', '--fix', findings], r.svc);
  expect(own.code, own.out + own.err).toBe(0);
  expect(own.out).toContain('Commit rule:');
  expect(own.out).not.toContain('Repository: tools');
}, 120_000);
