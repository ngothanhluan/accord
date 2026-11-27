// Phase 08.9.3 D-10, D-11, D-14, D-04: `accord worktree slice <id> <n>` follows the slice home for every slice. A slice of another repository opens in a linked worktree of that repository's clone, beside the
// clone (`<clone folder>-<id lower case>`), on `slice/<id>/<n>` cut at that repository's `baseline_<name>`; the worktree and the slice are recorded in this repository's git folder; the person's own checkout
// of the other repository is never switched or touched; and `accord worktree push <id> --repo <name>` pushes that branch to the clone's origin. Real git in two sibling clones (helpers/repos.ts).
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { spawnLog } from './helpers/git-spawns.js';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { besides, reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

// WR-05: the fetches accord starts in the other clone are read from the spawn log
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));
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
const FOUR: Part[] = [{ n: 1, repo: 'tools' }, { n: 2 }, { n: 3 }, { n: 4, repo: 'tools' }];

/** ST-9 claimed at REPOS_FROM on t/ST-9 of the svc clone, planned with `parts` (task n is slice n's), the plan committed. `toolsSha` is the plan's `baseline_tools`: the tools tip, or `baseline` when given. */
async function planned(r: Repos, parts: Part[], baseline?: string): Promise<{ toolsSha: string }> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = baseline ?? r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
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

/** Everything a command of this file may change, as text: the two records, every local branch of both clones, and the branch each folder is on. */
function stateOf(r: Repos): string {
  const wt = toolsWt(r);
  return [
    recordOf(r, 'worktrees'),
    recordOf(r, 'slices'),
    r.git(r.svc, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
    r.git(r.tools, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
    r.git(r.svc, 'branch', '--show-current'),
    existsSync(wt) ? r.git(wt, 'branch', '--show-current') : 'no worktree',
  ].join('\n--\n');
}

/** The tools worktree of ST-9 after slice 1 is open, with one commit on it. Returns the commit. */
async function toolsOneCommitted(r: Repos): Promise<string> {
  const res = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int one; }\n' });
  return commitAll(toolsWt(r), 'tools slice one');
}

it('risk:complex-branching every slice opens where its home says: the first one here is the claim branch, a later one here is cut from the claim branch, and a later one in tools is cut from slice 1 in the tools worktree (D-10, D-14)', async () => {
  const r = reposCopy();
  await planned(r, FOUR);
  const claimTip = r.git(r.svc, 'rev-parse', 'HEAD').trim();
  const two = await run(['worktree', 'slice', 'ST-9', '2'], r.svc);
  expect(two.code, two.out + two.err).toBe(0);
  expect(two.out).toMatch(new RegExp(`^branch: ${CLAIM}\\nbase: `));
  const three = await run(['worktree', 'slice', 'ST-9', '3'], r.svc);
  expect(three.code, three.out + three.err).toBe(0);
  expect(three.out).toBe(`branch: slice/ST-9/3\nbase: ${CLAIM}\n`);
  expect(r.git(r.svc, 'branch', '--show-current').trim()).toBe('slice/ST-9/3');
  expect(r.git(r.svc, 'rev-parse', 'slice/ST-9/3').trim()).toBe(claimTip);
  const oneTip = await toolsOneCommitted(r);
  const four = await run(['worktree', 'slice', 'ST-9', '4'], r.svc);
  expect(four.code, four.out + four.err).toBe(0);
  expect(four.out).toBe(`branch: slice/ST-9/4\nbase: slice/ST-9/1\nrepository: tools\nworktree: ${toolsWt(r)}\n`);
  // cut at the tip of slice 1 in the tools worktree, which is switched to it; this repository's checkout stays where it was
  expect(r.git(toolsWt(r), 'branch', '--show-current').trim()).toBe('slice/ST-9/4');
  expect(r.git(toolsWt(r), 'rev-parse', 'HEAD').trim()).toBe(oneTip);
  expect(r.git(r.svc, 'branch', '--show-current').trim()).toBe('slice/ST-9/3');
  expect(recordOf(r, 'worktrees')).toBe(`ST-9\t${toolsWt(r)}\ttools\n`);
  expect(recordOf(r, 'slices')).toContain(`ST-9 4 ${oneTip} tools\n`);
  expect(recordOf(r, 'slices')).toContain(`ST-9 3 ${claimTip}\n`);
  // this repository's later slices are no slice of tools: no branch of the plan's slice 2 or 3 exists in the tools clone
  expect(r.git(r.tools, 'for-each-ref', '--format=%(refname)', 'refs/heads').split('\n').filter((b) => b !== '')).toEqual(['refs/heads/main', 'refs/heads/slice/ST-9/1', 'refs/heads/slice/ST-9/4']);
}, 180_000);

it('risk:regression running any slice again prints the same lines and changes nothing (D-10, D-14)', async () => {
  const r = reposCopy();
  await planned(r, FOUR);
  await toolsOneCommitted(r);
  for (const n of ['2', '3', '4', '1']) {
    const first = await run(['worktree', 'slice', 'ST-9', n], r.svc);
    expect(first.code, first.out + first.err).toBe(0);
    const state = stateOf(r);
    const again = await run(['worktree', 'slice', 'ST-9', n], r.svc);
    expect(again.code, again.out + again.err).toBe(0);
    expect(again.out).toBe(first.out);
    expect(stateOf(r)).toBe(state);
  }
}, 180_000);

it('risk:data-loss a later slice of tools is refused while its worktree has uncommitted tracked changes, and creates nothing (D-10)', async () => {
  const r = reposCopy();
  await planned(r, FOUR);
  await toolsOneCommitted(r);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int unsaved; }\n' });
  const before = stateOf(r);
  const res = await run(['worktree', 'slice', 'ST-9', '4'], r.svc);
  expect(res.code).toBe(2);
  expect(res.err).toContain('uncommitted changes to tracked files');
  expect(res.err).toContain('nothing was created');
  expect(stateOf(r)).toBe(before);
  expect(readFileSync(join(toolsWt(r), 'src/Tools.cs'), 'utf8')).toBe('class Tools { int unsaved; }\n');
}, 180_000);

it('risk:complex-branching a refused slice creates nothing: the previous slice of tools not open, a baseline the clone lacks, a number past the plan, a bad id (D-10)', async () => {
  const r = reposCopy();
  await planned(r, FOUR);
  const notOpen = await run(['worktree', 'slice', 'ST-9', '4'], r.svc);
  expect(notOpen.code).toBe(2);
  expect(notOpen.err).toContain('slice 1 of ST-9 is not open yet in tools');
  const past = await run(['worktree', 'slice', 'ST-9', '5'], r.svc);
  expect(past.code).toBe(2);
  expect(past.err).toContain('so there is no slice 5');
  const bad = await run(['worktree', 'slice', 'bad id', '1'], r.svc);
  expect(bad.code).toBe(2);
  expect(besides(r.tools)).toEqual([]);
  expect(recordOf(r, 'worktrees')).toBe('');
  expect(r.git(r.tools, 'for-each-ref', '--format=%(refname)', 'refs/heads').trim()).toBe('refs/heads/main');
  // a baseline_tools that is no commit of the clone
  const lacking = reposCopy();
  await planned(lacking, FOUR, 'a'.repeat(40));
  const none = await run(['worktree', 'slice', 'ST-9', '1'], lacking.svc);
  expect(none.code).toBe(2);
  expect(none.err).toContain('baseline_tools');
  expect(besides(lacking.tools)).toEqual([]);
  expect(recordOf(lacking, 'worktrees')).toBe('');
}, 180_000);

it('risk:complex-branching a slice branch that exists only on the tools origin is checked out into the new worktree at its pushed tip, never cut again (D-10, Ruling R13)', async () => {
  const r = reposCopy();
  const { toolsSha } = await planned(r, ONE_TWO);
  // pushed from another machine: on origin, in no local branch of this clone and in none of its remote-tracking refs
  r.git(r.tools, 'switch', '-q', '-c', 'slice/ST-9/1');
  writeFiles(r.tools, { 'src/Tools.cs': 'class Tools { int pushed; }\n' });
  const pushed = commitAll(r.tools, 'pushed from elsewhere');
  r.git(r.tools, 'push', '-q', 'origin', 'slice/ST-9/1');
  r.git(r.tools, 'switch', '-q', 'main');
  r.git(r.tools, 'branch', '-q', '-D', 'slice/ST-9/1');
  r.git(r.tools, 'update-ref', '-d', 'refs/remotes/origin/slice/ST-9/1');
  const res = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toBe(`branch: slice/ST-9/1\nbase: ${toolsSha.slice(0, 12)}\nrepository: tools\nworktree: ${toolsWt(r)}\n`);
  expect(r.git(toolsWt(r), 'rev-parse', 'HEAD').trim()).toBe(pushed);
  expect(r.git(toolsWt(r), 'config', '--get', 'branch.slice/ST-9/1.remote').trim()).toBe('origin');
  expect(r.git(r.tools, 'branch', '--show-current').trim()).toBe('main');
}, 180_000);

it('risk:data-loss WR-05 the fetch that looks for a slice branch on the tools origin is --no-tags and --no-recurse-submodules, and brings in no tag (D-10, Ruling R13)', async () => {
  const r = reposCopy();
  await planned(r, ONE_TWO);
  r.git(r.tools, 'switch', '-q', '-c', 'slice/ST-9/1');
  writeFiles(r.tools, { 'src/Tools.cs': 'class Tools { int pushed; }\n' });
  commitAll(r.tools, 'pushed from elsewhere');
  r.git(r.tools, 'tag', 'v-from-elsewhere');
  r.git(r.tools, 'push', '-q', 'origin', 'slice/ST-9/1', 'v-from-elsewhere');
  r.git(r.tools, 'switch', '-q', 'main');
  r.git(r.tools, 'branch', '-q', '-D', 'slice/ST-9/1');
  r.git(r.tools, 'tag', '-d', 'v-from-elsewhere');
  r.git(r.tools, 'update-ref', '-d', 'refs/remotes/origin/slice/ST-9/1');
  const toolsDir = posix(r.tools).toLowerCase();
  const fetches: string[][] = [];
  spawnLog.calls = [];
  spawnLog.on = true;
  spawnLog.fail = (args, options) => {
    const cwd = posix(options?.cwd ?? '').toLowerCase();
    if (args.includes('fetch') && (cwd === toolsDir || cwd.startsWith(toolsDir + '/'))) fetches.push([...args]);
    return false;
  };
  let res: Awaited<ReturnType<typeof run>>;
  try {
    res = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  } finally {
    spawnLog.on = false;
    spawnLog.fail = undefined;
  }
  expect(res.code, res.out + res.err).toBe(0);
  // the check is not vacuous: the branch was looked for, and fetched, on the tools origin
  expect(fetches.length).toBeGreaterThan(0);
  for (const args of fetches) {
    expect(args, args.join(' ')).toContain('--no-tags');
    expect(args, args.join(' ')).toContain('--no-recurse-submodules');
  }
  // git follows a tag that points into what a fetch brings, unless told not to: none was added to the person's clone
  expect(r.git(r.tools, 'tag', '--list').trim()).toBe('');
}, 180_000);

it('risk:complex-branching WR-02 a clone given through a link is stored by its real path, so its worktree is recognised on the next run, by push and by clean (D-10)', async (ctx) => {
  const r = reposCopy();
  await planned(r, ONE_TWO);
  // the parent folder reached through a link (a junction is the one a person can make on Windows without a privilege; elsewhere it is an ordinary symlink)
  const aliasHome = mkdtempSync(join(tmpdir(), 'accord-repos-alias-'));
  const alias = join(aliasHome, 'work');
  try {
    symlinkSync(r.parent, alias, 'junction');
  } catch (e) {
    rmSync(aliasHome, { recursive: true, force: true });
    ctx.skip('this system refuses to create a link: ' + (e as NodeJS.ErrnoException).code);
  }
  try {
    const set = await run(['repos', 'set', 'tools', join(alias, 'tools')], r.svc);
    expect(set.code, set.out + set.err).toBe(0);
    // the stored path is where the folder really is
    expect(recordOf(r, 'repos')).toBe(`tools\t${posix(realpathSync.native(r.tools))}\n`);
    const first = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
    expect(first.code, first.out + first.err).toBe(0);
    // the second run is the documented idempotent one: it finds the worktree it made, where git lists it
    const second = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
    expect(second.code, second.out + second.err).toBe(0);
    expect(second.out).toBe(first.out);
    writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int one; }\n' });
    const tip = commitAll(toolsWt(r), 'tools slice one');
    const pushed = await run(['worktree', 'push', 'ST-9', '--repo', 'tools'], r.svc);
    expect(pushed.code, pushed.out + pushed.err).toBe(0);
    expect(r.git(r.toolsRemote, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
    // a store written before this fix holds the link form: it is read by its real path as well
    writeFileSync(join(r.svc, '.git', 'accord', 'repos'), `tools\t${posix(join(alias, 'tools'))}\n`);
    const again = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
    expect(again.code, again.out + again.err).toBe(0);
    expect(again.out).toBe(first.out);
  } finally {
    rmSync(aliasHome, { recursive: true, force: true });
  }
}, 180_000);

it("risk:regression accord worktree push --repo pushes the slice branch of the recorded tools worktree to the clone's origin, and refuses a name that is not declared or a flag that does not go with it (D-04)", async () => {
  const r = reposCopy();
  await planned(r, ONE_TWO);
  const tip = await toolsOneCommitted(r);
  const res = await run(['worktree', 'push', 'ST-9', '--repo', 'tools'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toBe("pushed: slice/ST-9/1 to tools's origin\n");
  expect(r.git(r.toolsRemote, 'rev-parse', 'refs/heads/slice/ST-9/1').trim()).toBe(tip);
  // the svc remote got nothing, and the person's tools checkout is still on main
  expect(r.git(r.svcRemote, 'for-each-ref', '--format=%(refname)', 'refs/heads').trim()).toBe('refs/heads/main');
  expect(r.git(r.tools, 'branch', '--show-current').trim()).toBe('main');
  const nope = await run(['worktree', 'push', 'ST-9', '--repo', 'nope'], r.svc);
  expect(nope.code).toBe(2);
  expect(nope.err).toContain('nope');
  for (const flag of ['--branch', '--force-with-lease']) {
    const both = await run(['worktree', 'push', 'ST-9', '--repo', 'tools', flag], r.svc);
    expect(both.code).toBe(2);
    expect(both.err).toContain('--repo');
  }
}, 180_000);
