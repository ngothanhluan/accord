// Phase 08.9.3 D-10, D-11, D-14, D-04: `accord worktree slice <id> <n>` follows the slice home for every slice. A slice of another repository opens in a linked worktree of that repository's clone, beside the
// clone (`<clone folder>-<id lower case>`), on `slice/<id>/<n>` cut at that repository's `baseline_<name>`; the worktree and the slice are recorded in this repository's git folder; the person's own checkout
// of the other repository is never switched or touched; and `accord worktree push <id> --repo <name>` pushes that branch to the clone's origin. Real git in two sibling clones (helpers/repos.ts).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

useRepoSandboxes();

const CLAIM = 't/ST-9';
const posix = (p: string): string => p.replace(/\\/g, '/');
const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${n}\ncovers: @ac-${n}\n`;

/** One slice of the plan: its number and the repository it is built in (absent: this repository). */
interface Part {
  n: number;
  repo?: string;
}
const ONE_TWO: Part[] = [{ n: 1, repo: 'tools' }, { n: 2 }];

/** ST-9 claimed at REPOS_FROM on t/ST-9 of the svc clone, planned with `parts` (task n is slice n's), the plan committed. `toolsSha` is the plan's `baseline_tools`: the tools tip. */
async function planned(r: Repos, parts: Part[]): Promise<{ toolsSha: string }> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const where = (p: Part): string => (p.repo === undefined ? 'src/svc.ts' : p.n === 1 ? 'tools:src/Tools.cs' : 'tools:src/Other.cs');
  const text = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', ...parts.map((p) => task(p.n, where(p))), ...parts.map((p) => slice(p.n, p.repo))].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
  return { toolsSha };
}

/** What a person would see of their own checkout of `dir`: HEAD, the branch, every local branch, the index, the status with untracked files and the content of the tracked files. */
function checkoutOf(r: Repos, dir: string): string {
  return [
    r.git(dir, 'rev-parse', 'HEAD'),
    r.git(dir, 'branch', '--show-current'),
    r.git(dir, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
    r.git(dir, 'ls-files', '--stage'),
    r.git(dir, 'status', '--porcelain', '--untracked-files=all'),
    r.git(dir, 'ls-files').split('\n').filter((f) => f !== '').map((f) => `${f}=${readFileSync(join(dir, f), 'utf8')}`).join('|'),
  ].join('\n--\n');
}

const toolsWt = (r: Repos): string => posix(join(r.parent, 'tools-st-9'));
const recordOf = (r: Repos, name: string): string => {
  const file = join(r.svc, '.git', 'accord', name);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

it('risk:data-loss accord worktree slice opens the first slice of tools in its own worktree at baseline_tools, and the person\'s tools checkout is as it was (D-10)', async () => {
  const r = reposCopy();
  const { toolsSha } = await planned(r, ONE_TWO);
  // work in progress in the person's own tools checkout: it must still be there afterwards
  writeFiles(r.tools, { 'src/Tools.cs': 'class Tools { int mine; }\n', 'notes.txt': 'untracked\n' });
  const before = checkoutOf(r, r.tools);
  const res = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toBe(`branch: slice/ST-9/1\nbase: ${toolsSha.slice(0, 12)}\nrepository: tools\nworktree: ${toolsWt(r)}\n`);
  // a linked worktree of the tools clone, on the new branch, at the baseline
  expect(r.git(r.tools, 'worktree', 'list', '--porcelain').replace(/\\/g, '/').toLowerCase()).toContain(toolsWt(r).toLowerCase());
  expect(r.git(toolsWt(r), 'branch', '--show-current').trim()).toBe('slice/ST-9/1');
  expect(r.git(toolsWt(r), 'rev-parse', 'HEAD').trim()).toBe(toolsSha);
  // recorded in this repository's git folder, with the repository column
  expect(recordOf(r, 'worktrees')).toBe(`ST-9\t${toolsWt(r)}\ttools\n`);
  expect(recordOf(r, 'slices')).toBe(`ST-9 1 ${toolsSha} tools\n`);
  // ST-9's own worktree is still on its claim branch
  expect(r.git(r.svc, 'branch', '--show-current').trim()).toBe(CLAIM);
  // the person's tools checkout: HEAD, branch, index, tree, the work in it and every local branch but the new one are unchanged
  const after = checkoutOf(r, r.tools);
  expect(after.replace('refs/heads/slice/ST-9/1 ' + toolsSha + '\n', '')).toBe(before);
  expect(r.git(r.tools, 'for-each-ref', '--format=%(refname)', 'refs/heads').split('\n')).toContain('refs/heads/slice/ST-9/1');
}, 120_000);

it('risk:regression the first slice here, when slice 1 is in tools, is the claim branch: the checkout is switched back to it and nothing is cut (D-14)', async () => {
  const r = reposCopy();
  await planned(r, ONE_TWO);
  const res = await run(['worktree', 'slice', 'ST-9', '2'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toMatch(new RegExp(`^branch: ${CLAIM}\\nbase: `));
  expect(r.git(r.svc, 'for-each-ref', '--format=%(refname)', 'refs/heads/slice').trim()).toBe('');
  expect(recordOf(r, 'slices')).toBe('');
}, 120_000);

