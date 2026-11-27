// Phase 08.9.3 D-04, D-05: `accord gate plan` checks a task's path in another repository against that repository's own baseline, with git run by the CLI in that clone, on real git in two sibling clones
// (helpers/repos.ts). Only `gate plan` reads the other clone: gate done, lint and status never start a git process there, so CI's gate done needs no clone.
import { expect, it } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

useRepoSandboxes();

interface Found { rule: string; level: string; reason?: string; file?: string }

const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, tasks: string, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${tasks}\ncovers: @ac-${n}\n`;

interface Setup {
  /** What task 1 (the tools slice) names in `files:`. */
  tools: string;
  /** Frontmatter lines for the tools baseline; the default is the tip of the tools clone. */
  baseline?: (toolsSha: string) => string[];
  /** The task of this repository (slice 2). */
  svc?: string;
}

/** ST-9 claimed at REPOS_FROM, approved, its plan committed: slice 1 is the tools slice, slice 2 this repository's. Returns the tools tip the plan baselines on. */
async function planned(r: Repos, s: Setup): Promise<{ toolsSha: string }> {
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'HEAD').trim();
  const fm = (s.baseline ?? ((sha: string) => [`baseline_tools: ${sha}`]))(toolsSha);
  const text = ['---', `baseline: ${base}`, ...fm, '---', '', '# Plan', '', task(1, s.tools), task(2, s.svc ?? 'src/svc.ts'), slice(1, '1', 'tools'), slice(2, '2')].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
  return { toolsSha };
}

const gate = async (r: Repos): Promise<{ code: number; found: Found[]; err: string }> => {
  const res = await run(['gate', 'plan', 'ST-9', '--json'], r.svc);
  return { code: res.code, err: res.err, found: res.out === '' ? [] : (JSON.parse(res.out).findings as Found[]) };
};
const only = (found: Found[], rule: string): Found[] => found.filter((f) => f.rule === rule);

it('risk:regression gate plan names a tools path that does not exist at the tools baseline, and passes one that does (D-05)', async () => {
  const r = reposCopy();
  const { toolsSha } = await planned(r, { tools: 'tools:src/Missing.cs' });
  const bad = await gate(r);
  expect(bad.err).toBe('');
  expect(bad.code).toBe(1);
  const unknown = only(bad.found, 'gate.task-file-unknown');
  expect(unknown).toHaveLength(1);
  expect(unknown[0].reason).toContain('tools:src/Missing.cs');
  expect(unknown[0].reason).toContain(`tools baseline ${toolsSha}`);
  // the text form prints that one finding too
  const text = await run(['gate', 'plan', 'ST-9'], r.svc);
  expect(text.out.split('\n').filter((l) => l.includes('gate.task-file-unknown'))).toHaveLength(1);
});

it('risk:regression gate plan reads no gate.task-file-unknown for a tools path that exists at the tools baseline (D-05)', async () => {
  const r = reposCopy();
  await planned(r, { tools: 'tools:src/Tools.cs' });
  const good = await gate(r);
  expect(good.err).toBe('');
  expect(only(good.found, 'gate.task-file-unknown')).toEqual([]);
  expect(only(good.found, 'gate.repo-baseline-unknown')).toEqual([]);
});
