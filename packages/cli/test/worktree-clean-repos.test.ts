// Phase 08.9.3 D-10, Pitfall 8, Decision 9: `accord worktree clean` cleans the other repository's worktree and `slice/<id>/<n>` branches of a done or dropped ticket, after the merge and under the same guards as this
// repository's claim branch, judged in that clone against its own default branch. Unmerged work and a dirty worktree of the other repository are never deleted, a recorded worktree of another repository is never
// judged by this repository's worktree list, and the person's own checkout of the other repository is never touched. Real git in two sibling clones (helpers/repos.ts).
import { existsSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync } from 'node:fs';
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

/** Everything a clean of this file may change, as text: both records, every local branch of tools with its sha, the tools remote's branches, the worktree folder with its branch and files, and tools' own worktree list. */
function stateOf(r: Repos): string {
  const wt = toolsWt(r);
  return [
    recordOf(r, 'worktrees'),
    recordOf(r, 'slices'),
    r.git(r.tools, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
    r.git(r.toolsRemote, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
    r.git(r.tools, 'worktree', 'list', '--porcelain'),
    existsSync(wt) ? [r.git(wt, 'rev-parse', 'HEAD'), r.git(wt, 'branch', '--show-current'), r.git(wt, 'status', '--porcelain'), readFileSync(join(wt, 'src/Tools.cs'), 'utf8')].join('|') : 'no folder',
  ].join('\n--\n');
}

it('risk:data-loss clean keeps the tools worktree and slice branch whose commit the tools default branch lacks, here and on the tools origin, and names tools (D-10)', async () => {
  const r = reposCopy();
  const tip = await pushedTools(r);
  doneOnSvc(r);
  const before = stateOf(r);
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const L = lines(res.out);
  expect(L).toContain(withAction(`kept ${toolsWt(r)}: its branch slice/ST-9/1 has changes not on origin/main (repository tools)`));
  expect(L).toContain(withAction('kept slice/ST-9/1 in tools: it has changes not on origin/main'));
  expect(L.filter((l) => l.startsWith('removed ') || l.startsWith('deleted ')).join('\n')).not.toContain('tools');
  expect(stateOf(r)).toBe(before);
  expect(r.git(r.tools, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
  expect(r.git(r.toolsRemote, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
  expect(readFileSync(join(toolsWt(r), 'src/Tools.cs'), 'utf8')).toBe('class Tools { int one; }\n');
}, 240_000);

it('risk:data-loss clean keeps a tools worktree with an uncommitted tracked change, and its branch, however merged the branch is (D-10)', async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r);
  doneOnSvc(r);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int unsaved; }\n' });
  const before = stateOf(r);
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const L = lines(res.out);
  expect(L).toContain(withAction(`kept ${toolsWt(r)}: uncommitted work (repository tools)`));
  expect(L).toContain(withAction(`kept slice/ST-9/1 in tools: checked out in ${toolsWt(r)}`));
  expect(stateOf(r)).toBe(before);
  expect(readFileSync(join(toolsWt(r), 'src/Tools.cs'), 'utf8')).toBe('class Tools { int unsaved; }\n');
}, 240_000);

it('risk:data-loss a ticket that is not done has nothing of tools judged or printed: tools is not even fetched (D-10)', async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r);
  const seen = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const before = stateOf(r);
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out + res.err).not.toContain('tools');
  expect(stateOf(r)).toBe(before);
  // the merge is on the tools remote, and no fetch of tools ran
  expect(r.git(r.toolsRemote, 'rev-parse', 'refs/heads/main').trim()).not.toBe(seen);
  expect(r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim()).toBe(seen);
}, 240_000);

it('risk:data-loss a recorded tools folder that tools does not list as a worktree is never swept as a forgotten one (Pitfall 8)', async () => {
  const r = reposCopy();
  const tip = await pushedTools(r);
  doneOnSvc(r);
  // the clone forgot the worktree (its administrative folder is gone) while the folder, with the work in it, is still there
  rmSync(join(r.tools, '.git', 'worktrees', 'tools-st-9'), { recursive: true, force: true });
  const files = readFileSync(join(toolsWt(r), 'src/Tools.cs'), 'utf8');
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const L = lines(res.out);
  expect(L).toContain(withAction(`kept ${toolsWt(r)}: tools does not list it as one of its worktrees`));
  expect(L.filter((l) => l.startsWith('removed '))).toEqual([]);
  expect(existsSync(toolsWt(r))).toBe(true);
  expect(readFileSync(join(toolsWt(r), 'src/Tools.cs'), 'utf8')).toBe(files);
  expect(recordOf(r, 'worktrees')).toBe(`ST-9\t${toolsWt(r)}\ttools\n`);
  expect(r.git(r.tools, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
  expect(r.git(r.toolsRemote, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
}, 240_000);

it("risk:data-loss with the tools folder deleted by hand, the record goes only after the clone's own worktree prune, and the unmerged branch stays (D-10)", async () => {
  const r = reposCopy();
  const tip = await pushedTools(r);
  doneOnSvc(r);
  cleanup(toolsWt(r));
  expect(r.git(r.tools, 'worktree', 'list', '--porcelain')).toContain('prunable');
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const L = lines(res.out);
  expect(L.some((l) => l.startsWith(`pruned ${toolsWt(r)}: `))).toBe(true);
  expect(r.git(r.tools, 'worktree', 'list', '--porcelain')).not.toContain('tools-st-9');
  expect(recordOf(r, 'worktrees')).toBe('');
  // nothing else was removed: the branch holds a commit tools' default branch lacks, locally and on origin, and its slice line stays
  expect(L).toContain(withAction('kept slice/ST-9/1 in tools: it has changes not on origin/main'));
  expect(r.git(r.tools, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
  expect(r.git(r.toolsRemote, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
  expect(recordOf(r, 'slices')).toContain('ST-9 1 ');
}, 240_000);

it('risk:data-loss a clone found by no stored path keeps the record and the work, says why, and is never searched for (D-10, Decision 9)', async () => {
  const gone = reposCopy();
  await pushedTools(gone);
  mergedOnTools(gone);
  doneOnSvc(gone);
  // the stored path is dropped: the tools clone still sits beside svc, where a scan would find it
  rmSync(join(gone.svc, '.git', 'accord', 'repos'));
  const before = stateOf(gone);
  const res = await run(['worktree', 'clean'], gone.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const L = lines(res.out);
  expect(L.find((l) => l.startsWith(`kept ${toolsWt(gone)}: repository tools is not found here: `))).toContain('clone it with git clone');
  expect(L.filter((l) => l.startsWith('removed ') || l.startsWith('deleted ')).join('\n')).not.toContain('tools');
  expect(stateOf(gone)).toBe(before);
  expect(existsSync(join(gone.svc, '.git', 'accord', 'repos'))).toBe(false);
  // the stored path names a clone whose origin is another repository
  const other = reposCopy();
  await pushedTools(other);
  mergedOnTools(other);
  doneOnSvc(other);
  other.git(other.tools, 'config', 'remote.origin.url', 'https://github.com/acme/other.git');
  const kept = stateOf(other);
  const res2 = await run(['worktree', 'clean'], other.svc);
  expect(res2.code, res2.out + res2.err).toBe(0);
  expect(lines(res2.out).find((l) => l.startsWith(`kept ${toolsWt(other)}: repository tools is not found here: `))).toContain('has origin https://github.com/acme/other.git');
  expect(stateOf(other)).toBe(kept);
}, 360_000);

it('risk:data-loss a merged local slice branch goes while its origin copy, which a teammate moved past the merge, is kept (D-10)', async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r);
  doneOnSvc(r);
  // a teammate pushed one more commit to the slice branch after the merge
  const other = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-repos-other-')));
  let moved: string;
  try {
    gitRun(other, 'clone', '-q', r.toolsRemote, '.');
    gitRun(other, 'switch', '-q', 'slice/ST-9/1');
    writeFiles(other, { 'src/Tools.cs': 'class Tools { int later; }\n' });
    moved = commitMsg(other, 'later work');
    gitRun(other, 'push', '-q', 'origin', 'slice/ST-9/1');
  } finally {
    cleanup(other);
  }
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const L = lines(res.out);
  expect(L).toContain(withAction(`removed ${toolsWt(r)} (repository tools)`));
  expect(L).toContain(withAction('deleted branch slice/ST-9/1 in tools'));
  expect(L).toContain(withAction('kept origin/slice/ST-9/1 in tools: it has changes not on origin/main'));
  expect(r.git(r.tools, 'for-each-ref', '--format=%(refname)', 'refs/heads').trim()).toBe('refs/heads/main');
  expect(r.git(r.toolsRemote, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(moved);
  // its record line stays while a copy of the branch does
  expect(recordOf(r, 'slices')).toContain('ST-9 1 ');
}, 240_000);

it('risk:data-loss a folder beside the main checkout that is the stored clone of tools is never judged as a forgotten ticket folder, even when a done ticket is named for it (Pitfall 8)', async () => {
  const r = reposCopy();
  // the tools clone lives where cleanSiblings looks: `<main>-<x>`, with a done ticket whose lower-cased id is the x
  const clone = posix(join(r.parent, 'svc-tools'));
  renameSync(r.tools, clone);
  const set = await run(['repos', 'set', 'tools', clone], r.svc);
  expect(set.code, set.out + set.err).toBe(0);
  r.git(r.svc, 'switch', '-q', 'main');
  verifyStage(r.svc, 'TOOLS');
  const verified = r.git(r.svc, 'rev-parse', 'HEAD').trim();
  writeFiles(r.svc, { 'accord/tickets/TOOLS.md': doneTicket('TOOLS', verified) });
  commitAll(r.svc, 'verify: TOOLS');
  r.git(r.svc, 'push', '-q', 'origin', 'main');
  const files = readFileSync(join(clone, 'src/Tools.cs'), 'utf8');
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out + res.err).not.toContain('svc-tools');
  expect(existsSync(join(clone, '.git'))).toBe(true);
  expect(readFileSync(join(clone, 'src/Tools.cs'), 'utf8')).toBe(files);
}, 240_000);

it('risk:data-loss --dry-run prints the removals and deletions a real clean prints for the tools worktree and changes nothing (D-10)', async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r);
  doneOnSvc(r);
  const before = stateOf(r);
  const res = await run(['worktree', 'clean', '--dry-run'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const L = lines(res.out);
  expect(L).toContain(withAction(`removed ${toolsWt(r)} (repository tools)`));
  expect(L).toContain(withAction('deleted branch slice/ST-9/1 in tools'));
  expect(L).toContain(withAction('deleted origin/slice/ST-9/1 in tools'));
  expect(stateOf(r)).toBe(before);
  expect(existsSync(toolsWt(r))).toBe(true);
  // and the real run prints the same three lines
  const real = await run(['worktree', 'clean'], r.svc);
  expect(real.code, real.out + real.err).toBe(0);
  for (const l of ['removed', 'deleted branch', 'deleted origin']) expect(lines(real.out).filter((x) => x.startsWith(l)).sort()).toEqual(L.filter((x) => x.startsWith(l)).sort());
}, 300_000);
