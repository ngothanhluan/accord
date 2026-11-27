// Phase 08.9.3 D-10, Pitfall 8, Decision 9: `accord worktree clean` cleans the other repository's worktree and `slice/<id>/<n>` branches of a done or dropped ticket, after the merge and under the same guards as this
// repository's claim branch, judged in that clone against its own default branch. Unmerged work and a dirty worktree of the other repository are never deleted, a recorded worktree of another repository is never
// judged by this repository's worktree list, and the person's own checkout of the other repository is never touched. Real git in two sibling clones (helpers/repos.ts).
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, cleanup, commitAll, commitMsg, gitRun, mergeMsg, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';
import { doneTicket, lines, verifyStage, withAction } from './helpers/worktree.js';

useRepoSandboxes();

const CLAIM = 't/ST-9';
const posix = (p: string): string => p.replace(/\\/g, '/');
const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${n}\ncovers: @ac-${n}\n`;

const toolsWt = (r: Repos): string => posix(join(r.parent, 'tools-st-9'));
const recordOf = (r: Repos, name: string): string => {
  const file = join(r.svc, '.git', 'accord', name);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

/** ST-9 claimed on t/ST-9 of the svc clone, planned with slice 1 in tools and slice 2 here, the tools worktree of slice 1 opened, one commit made on it and pushed to the tools origin. Returns that commit. */
async function pushedTools(r: Repos): Promise<string> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const plan = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', task(1, 'tools:src/Tools.cs'), task(2, 'src/svc.ts'), slice(1, 'tools'), slice(2)].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': plan });
  commitAll(r.svc);
  const opened = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  expect(opened.code, opened.out + opened.err).toBe(0);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int one; }\n' });
  const tip = commitAll(toolsWt(r), 'tools slice one');
  const pushed = await run(['worktree', 'push', 'ST-9', '--repo', 'tools'], r.svc);
  expect(pushed.code, pushed.out + pushed.err).toBe(0);
  return tip;
}

/** The slice branch merged into the tools remote's main from a teammate's clone: a merge commit, or one squash commit with the same content. */
function mergedOnTools(r: Repos, how: 'merge' | 'squash' = 'merge'): void {
  const other = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-repos-other-')));
  try {
    gitRun(other, 'clone', '-q', r.toolsRemote, '.');
    if (how === 'merge') mergeMsg(other, 'origin/slice/ST-9/1', 'merge slice 1');
    else {
      gitRun(other, 'merge', '--squash', '-q', 'origin/slice/ST-9/1');
      commitMsg(other, 'squash slice 1');
    }
    gitRun(other, 'push', '-q', 'origin', 'main');
  } finally {
    cleanup(other);
  }
}

/** ST-9 done on svc's default branch: verified and merged, as a teammate's clone leaves it. */
function doneOnSvc(r: Repos): void {
  r.git(r.svc, 'switch', '-q', 'main');
  verifyStage(r.svc, 'ST-9');
  const verified = r.git(r.svc, 'rev-parse', 'HEAD').trim();
  writeFiles(r.svc, { 'accord/tickets/ST-9.md': doneTicket('ST-9', verified) });
  commitAll(r.svc, 'verify: ST-9');
  r.git(r.svc, 'push', '-q', 'origin', 'main');
}

/** What a person sees of their own checkout of tools that clean must not change: HEAD, the branch, every local branch but the slice ones, the index, the status with untracked files and the tracked files' content. */
function personsTools(r: Repos): string {
  return [
    r.git(r.tools, 'rev-parse', 'HEAD'),
    r.git(r.tools, 'branch', '--show-current'),
    r.git(r.tools, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads').split('\n').filter((l) => !l.includes('/slice/')).join('\n'),
    r.git(r.tools, 'ls-files', '--stage'),
    r.git(r.tools, 'status', '--porcelain', '--untracked-files=all'),
    r.git(r.tools, 'ls-files').split('\n').filter((f) => f !== '').map((f) => `${f}=${readFileSync(join(r.tools, f), 'utf8')}`).join('|'),
  ].join('\n--\n');
}

it("risk:data-loss clean removes the merged tools worktree of a done ticket, deletes its slice branch here and on the tools origin, drops both record lines, and leaves the person's tools checkout as it was (D-10)", async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r);
  doneOnSvc(r);
  // work in progress in the person's own tools checkout: it must still be there afterwards
  writeFiles(r.tools, { 'src/Other.cs': 'class Other { int mine; }\n', 'notes.txt': 'untracked\n' });
  const before = personsTools(r);
  expect(r.git(r.toolsRemote, 'for-each-ref', '--format=%(refname)', 'refs/heads').split('\n')).toContain('refs/heads/slice/ST-9/1');
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const L = lines(res.out);
  expect(L).toContain(withAction(`removed ${toolsWt(r)} (repository tools)`));
  expect(L).toContain(withAction('deleted branch slice/ST-9/1 in tools'));
  expect(L).toContain(withAction('deleted origin/slice/ST-9/1 in tools'));
  // no linked worktree, no slice branch in the clone, none on its origin, no record line here
  expect(existsSync(toolsWt(r))).toBe(false);
  expect(r.git(r.tools, 'worktree', 'list', '--porcelain').replace(/\\/g, '/').toLowerCase()).not.toContain('tools-st-9');
  expect(r.git(r.tools, 'for-each-ref', '--format=%(refname)', 'refs/heads').trim()).toBe('refs/heads/main');
  expect(r.git(r.toolsRemote, 'for-each-ref', '--format=%(refname)', 'refs/heads').trim()).toBe('refs/heads/main');
  expect(recordOf(r, 'worktrees')).toBe('');
  expect(recordOf(r, 'slices')).toBe('');
  // the person's tools checkout: HEAD, branch, index, tree, the work in it and every other local branch
  expect(personsTools(r)).toBe(before);
}, 240_000);
