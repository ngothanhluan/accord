// Phase 08.9.3 D-10, Pitfall 8, Decision 9: `accord worktree clean` cleans the other repository's worktree and `slice/<id>/<n>` branches of a done or dropped ticket, after the merge and under the same guards as this
// repository's claim branch, judged in that clone against its own default branch. Unmerged work and a dirty worktree of the other repository are never deleted, a recorded worktree of another repository is never
// judged by this repository's worktree list, and the person's own checkout of the other repository is never touched. The session-start clean finds a clone by its stored path only. Real git in two sibling clones (helpers/repos.ts).
import { existsSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { LANE_BODY, laneTicket } from '../../../test/helpers/lane.js';
import { countedOpens } from './helpers/fs-opens.js';
import { spawnLog } from './helpers/git-spawns.js';
import { claimedUnder, cleanup, commitAll, commitMsg, gitRun, mergeMsg, run, writeFiles } from './helpers/repo.js';
import { reposCopy, TOOLS_URL, useRepoSandboxes, type Repos } from './helpers/repos.js';
import { doneTicket, lines, verifyStage, withAction } from './helpers/worktree.js';

vi.mock('node:fs', async (orig) => (await import('./helpers/fs-opens.js')).wrapFs(await orig()));
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

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

/** ST-9 dropped on svc's default branch, as a teammate's clone leaves it. */
function droppedOnSvc(r: Repos): void {
  r.git(r.svc, 'switch', '-q', 'main');
  writeFiles(r.svc, { 'accord/tickets/ST-9.md': laneTicket('ST-9', { frontmatter: ['status: dropped'], body: LANE_BODY + '\n## Dropped\ngone\n' }) });
  commitAll(r.svc, 'drop ST-9');
  r.git(r.svc, 'push', '-q', 'origin', 'main');
}

/** The three lines a clean prints for a merged tools slice. */
const MERGED_LINES = (r: Repos): string[] => [withAction(`removed ${toolsWt(r)} (repository tools)`), withAction('deleted branch slice/ST-9/1 in tools'), withAction('deleted origin/slice/ST-9/1 in tools')];

it('risk:data-loss a tools slice squash-merged into the tools default branch (one commit, equal content) is cleaned as merged (D-10)', async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r, 'squash');
  doneOnSvc(r);
  // the branch tip is on no history of the default branch: only its content is
  expect(r.git(r.toolsRemote, 'rev-list', '--count', 'main', '--not', 'slice/ST-9/1').trim()).toBe('1');
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  for (const l of MERGED_LINES(r)) expect(lines(res.out)).toContain(l);
  expect(existsSync(toolsWt(r))).toBe(false);
  expect(r.git(r.tools, 'for-each-ref', '--format=%(refname)', 'refs/heads').trim()).toBe('refs/heads/main');
  expect(r.git(r.toolsRemote, 'for-each-ref', '--format=%(refname)', 'refs/heads').trim()).toBe('refs/heads/main');
  expect(recordOf(r, 'worktrees')).toBe('');
  expect(recordOf(r, 'slices')).toBe('');
}, 240_000);

it('risk:data-loss a dropped ticket has its merged tools slice cleaned and its unmerged one kept (D-10)', async () => {
  const merged = reposCopy();
  await pushedTools(merged);
  mergedOnTools(merged);
  droppedOnSvc(merged);
  const res = await run(['worktree', 'clean'], merged.svc);
  expect(res.code, res.out + res.err).toBe(0);
  for (const l of MERGED_LINES(merged)) expect(lines(res.out)).toContain(l);
  expect(existsSync(toolsWt(merged))).toBe(false);
  expect(recordOf(merged, 'worktrees')).toBe('');
  const unmerged = reposCopy();
  const tip = await pushedTools(unmerged);
  droppedOnSvc(unmerged);
  const before = stateOf(unmerged);
  const res2 = await run(['worktree', 'clean'], unmerged.svc);
  expect(res2.code, res2.out + res2.err).toBe(0);
  expect(lines(res2.out)).toContain(withAction(`kept ${toolsWt(unmerged)}: its branch slice/ST-9/1 has changes not on origin/main (repository tools)`));
  expect(stateOf(unmerged)).toBe(before);
  expect(unmerged.git(unmerged.toolsRemote, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
}, 360_000);

it('risk:regression worktree clean --after-merge from the main checkout also cleans the tools worktree (D-10)', async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r);
  doneOnSvc(r);
  const res = await run(['worktree', 'clean', '--after-merge', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  for (const l of MERGED_LINES(r)) expect(lines(res.out)).toContain(l);
  expect(existsSync(toolsWt(r))).toBe(false);
  expect(recordOf(r, 'worktrees')).toBe('');
}, 240_000);

/** Another clone of the tools origin beside svc, which a search of the parent folder would take for tools. */
function decoyClone(r: Repos): string {
  gitRun(r.parent, 'clone', '-q', r.toolsRemote, 'tools-copy');
  const d = posix(join(r.parent, 'tools-copy'));
  gitRun(d, 'remote', 'set-url', 'origin', TOOLS_URL);
  return d;
}

/** The session-start hook with git and file reads counted: the folders every git process ran in and every file that was read. */
async function sessionStart(r: Repos): Promise<{ out: string; cwds: string[]; reads: string[] }> {
  const input = JSON.stringify({ session_id: 'sess-M', cwd: r.svc, source: 'startup' });
  const cwds: string[] = [];
  spawnLog.calls = [];
  spawnLog.fail = (_args, options) => {
    cwds.push(posix(String(options?.cwd ?? '<none>')));
    return false;
  };
  spawnLog.on = true;
  try {
    const seen = await countedOpens(async () => run(['hook', 'session-start'], r.svc, {}, input));
    expect(seen.value.code, seen.value.out + seen.value.err).toBe(0);
    return { out: seen.value.out, cwds, reads: seen.paths };
  } finally {
    spawnLog.on = false;
    spawnLog.fail = undefined;
    spawnLog.calls = [];
  }
}

it('risk:regression the session-start clean resolves tools by its stored path only: no folder of the parent but svc, the stored clone and its worktree is read, and no git process runs elsewhere (Decision 9)', async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r);
  doneOnSvc(r);
  const decoy = decoyClone(r);
  const own = [posix(r.svc), posix(r.tools), toolsWt(r)].map((p) => p.toLowerCase());
  const inOwn = (p: string): boolean => own.some((o) => p.toLowerCase() === o || p.toLowerCase().startsWith(o + '/'));
  const seen = await sessionStart(r);
  for (const l of MERGED_LINES(r)) expect(lines(seen.out)).toContain(l);
  expect(seen.cwds.length).toBeGreaterThan(0);
  expect(seen.cwds.filter((c) => !inOwn(c))).toEqual([]);
  const parent = posix(r.parent).toLowerCase() + '/';
  expect(seen.reads.filter((p) => p.toLowerCase().startsWith(parent) && !inOwn(p))).toEqual([]);
  expect(seen.reads.some((p) => p.toLowerCase().startsWith(posix(decoy).toLowerCase() + '/'))).toBe(false);
  // guard the guard: the spy does see the reads under svc, and a read of the decoy would be seen
  expect(seen.reads.some((p) => p.toLowerCase().startsWith(posix(r.svc).toLowerCase() + '/'))).toBe(true);
  const on = await countedOpens(async () => readFileSync(join(decoy, '.git', 'config'), 'utf8'));
  expect(on.paths.map((p) => p.toLowerCase())).toContain(posix(join(decoy, '.git', 'config')).toLowerCase());
}, 300_000);

it('risk:regression the session-start clean of a clone with no stored path reads no other folder of the parent, keeps the record and says why (Decision 9)', async () => {
  const r = reposCopy();
  await pushedTools(r);
  mergedOnTools(r);
  doneOnSvc(r);
  const decoy = decoyClone(r);
  rmSync(join(r.svc, '.git', 'accord', 'repos'));
  const before = stateOf(r);
  const seen = await sessionStart(r);
  expect(lines(seen.out).some((l) => l.startsWith(`kept ${toolsWt(r)}: repository tools is not found here: `))).toBe(true);
  expect(stateOf(r)).toBe(before);
  const parent = posix(r.parent).toLowerCase() + '/';
  const svc = posix(r.svc).toLowerCase();
  expect(seen.reads.filter((p) => p.toLowerCase().startsWith(parent) && !(p.toLowerCase() === svc || p.toLowerCase().startsWith(svc + '/')))).toEqual([]);
  expect(seen.cwds.filter((c) => !(c.toLowerCase() === svc || c.toLowerCase().startsWith(svc + '/')))).toEqual([]);
  expect(existsSync(join(decoy, '.git', 'config'))).toBe(true);
}, 300_000);
