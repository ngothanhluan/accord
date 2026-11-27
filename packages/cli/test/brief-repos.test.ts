// Phase 08.9.3 D-04, D-05, D-06, D-12: the build stage of a task in ANOTHER repository. `accord brief <id> <n>` sends the executor to that repository's recorded worktree (Repository:, Work dir:, the report there, the task's paths
// there) with the test command of `repos.<name>` from this repository's config, and `accord task-done` records the task in THIS repository's ledger at the other worktree's HEAD with the `@test:<name>:<case id>` tag. Real git
// in two sibling clones (helpers/repos.ts); the CLI runs no test command.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from './helpers/repo.js';
import { builtInTools, ONE_TOOLS_TASK, plannedTools, toolsWt } from './helpers/repos-build.js';
import { reposCopy, useRepoSandboxes } from './helpers/repos.js';

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
