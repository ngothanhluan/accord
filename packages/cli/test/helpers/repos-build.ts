// Phase 08.9.3 D-04, D-05, D-06, D-12: the fixtures of the build-stage tests of another repository's tasks (brief-repos, task-done-repos): ST-9 claimed at REPOS_FROM in svc, planned with tasks in tools, the tools worktree
// opened, built in and given the executor's report. Real git in two sibling clones (helpers/repos.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { loadSnapshot, REPOS_FROM, workOf } from '@accord-dev/accord-core';
import { writeReport } from '../../../../test/helpers/lane.js';
import { claimedUnder, commitAll, run, writeFiles } from './repo.js';
import { REPOS_CONFIG, type Repos } from './repos.js';

export const CLAIM = 't/ST-9';
export const posix = (p: string): string => p.replace(/\\/g, '/');
export const TOOLS_AFFECTED = '    affected: node -e "process.exit(0)" {files}';
const SHELL = '    tests: node -e "process.exit(0)"';

/** The ticket as the template holds it, with its `@test:` tags taken off, so `accord task-done` has a scenario to tag. */
const untagged = (text: string): string => text.replace(/ @test:\S+/g, '');

/** A task of the plan: `files` as written (`tools:src/Tools.cs`), one verify case mapped to `@ac-<n>`. */
export const task = (n: number, files: string, verify: string, after = 'none'): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: ${verify} (@ac-${n})\nafter: ${after}\nDo step ${n}.\n`;
export const slice = (n: number, tasks: string, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${tasks}\ncovers: @ac-${n}\n`;

export interface Planned {
  toolsSha: string;
}

/**
 * ST-9 claimed at REPOS_FROM on t/ST-9 of the svc clone, its config declaring `repos.tools` with `extra` lines after `tests:`, its scenarios untagged, approved and planned with `tasks` and `slices` (the plan's text below
 * the frontmatter), the plan hash recorded, everything committed.
 */
export async function plannedTools(r: Repos, body: string, extra: string[] = [TOOLS_AFFECTED]): Promise<Planned> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  const config = REPOS_CONFIG.replace(SHELL, [SHELL, ...extra].join('\n'));
  const ticket = untagged(readFileSync(join(r.svc, 'accord', 'tickets', 'ST-9.md'), 'utf8'));
  writeFiles(r.svc, { 'accord/config.yml': config, 'accord/tickets/ST-9.md': ticket });
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const plan = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', body].join('\n');
  const snap = loadSnapshot({ files: { 'accord/config.yml': config, 'accord/tickets/ST-9.md': ticket, 'accord/tickets/ST-9/plan.md': plan }, tree: [] });
  const hash = workOf(snap, 'ST-9')?.plan?.bodyHash;
  expect(hash).toBeDefined();
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': plan.replace('---\n', `---\nplan_hash: "${hash}"\n`) });
  commitAll(r.svc);
  return { toolsSha };
}

/** One tools task in slice 1, the plan `accord worktree slice` and `accord brief` read. */
export const ONE_TOOLS_TASK = [task(1, 'tools:src/Tools.cs', 'Tools.Tests#adds'), slice(1, '1', 'tools')].join('\n');

export const toolsWt = (r: Repos): string => posix(join(r.parent, 'tools-st-9'));

/** The tools worktree of ST-9 opened on slice 1, one commit on it and the executor's report written after it. Returns the worktree's HEAD. */
export async function builtInTools(r: Repos): Promise<string> {
  const open = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  expect(open.code, open.out + open.err).toBe(0);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int one; }\n' });
  const head = commitAll(toolsWt(r), 'tools task one');
  writeReport(toolsWt(r), 'ST-9', 1);
  return head;
}

