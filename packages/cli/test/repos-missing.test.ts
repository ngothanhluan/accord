// Phase 08.9.3 D-01, D-02, Decision 9: the clone of another repository is looked for beside the main checkout, by its origin, and only by the commands that need it. Nothing found ends in one line that
// names the `git clone` to run; two found are refused; a symlink, a junction and a linked worktree are never taken for the clone; a crowded folder is searched only to its first 200 entries; and
// `accord status`, `accord dashboard` and `accord hook session-start` never look for the clone at all. Real git in temporary sandboxes, no network.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { gitDirsOf } from '../src/load/gitdir.js';
import { openLog } from './helpers/fs-opens.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, gitRun, run } from './helpers/repo.js';
import { reposCopy, TOOLS_URL, useRepoSandboxes } from './helpers/repos.js';

// the spies of helpers/git-spawns.ts and helpers/fs-opens.ts: the git processes accord starts and the files it reads
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));
vi.mock('node:fs', async (orig) => (await import('./helpers/fs-opens.js')).wrapFs(await orig()));
useRepoSandboxes();

const away: string[] = [];
afterEach(() => {
  for (const d of away.splice(0)) cleanup(d);
});

const posix = (p: string): string => p.replace(/\\/g, '/');
const storeOf = (svc: string): string => join((gitDirsOf(svc) as NonNullable<ReturnType<typeof gitDirsOf>>).commonDir, 'accord', 'repos');
/** The line `repos status` prints for a repository with no clone anywhere: D-02, the exact `git clone` and the `accord repos set` lines, and nothing cloned. */
const notFound = (parent: string): string =>
  `tools: not found - clone it with git clone '${TOOLS_URL}' '${posix(parent)}/tools', or give an existing clone with accord repos set tools <path>; nothing was cloned`;

/** Moves the clone out of the parent folder into a folder of its own and returns where it went. */
function moveAway(tools: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'accord-repos-away-'));
  away.push(folder);
  const to = join(folder, 'tools');
  renameSync(tools, to);
  return to;
}

interface Traced<T> {
  value: T;
  /** The files accord read with `readFileSync`, posix slashes. */
  opens: string[];
  /** Every git process accord started: its arguments and the folder it ran in, posix slashes. */
  git: { args: string[]; cwd: string }[];
}

/** Runs `fn` with both spies on. */
async function traced<T>(fn: () => Promise<T>): Promise<Traced<T>> {
  const git: Traced<T>['git'] = [];
  spawnLog.calls = [];
  spawnLog.on = true;
  spawnLog.fail = (args, options) => {
    git.push({ args: [...args], cwd: posix(options?.cwd ?? '') });
    return false;
  };
  openLog.paths = [];
  openLog.on = true;
  try {
    const value = await fn();
    return { value, opens: [...openLog.paths], git };
  } finally {
    spawnLog.on = false;
    spawnLog.fail = undefined;
    openLog.on = false;
  }
}

/** Whether `path` is the folder `dir` or something inside it (case does not count on Windows). */
const under = (path: string, dir: string): boolean => {
  const p = posix(path).toLowerCase();
  const d = posix(dir).toLowerCase();
  return p === d || p.startsWith(d + '/');
};

it('risk:security no clone beside the main checkout: exit 2 with the exact git clone and accord repos set lines, and no git call clones (D-02)', async () => {
  const r = reposCopy();
  cleanup(r.tools);
  const { value, git } = await traced(() => run(['repos', 'status'], r.svc));
  expect(value.code).toBe(2);
  expect(value.out.trim()).toBe(notFound(r.parent));
  // nothing is stored for a repository that was not found
  expect(existsSync(storeOf(r.svc))).toBe(false);
  // the check is not vacuous: accord did start git processes, and none of them clones
  expect(git.length).toBeGreaterThan(0);
  expect(git.filter((c) => c.args.includes('clone'))).toEqual([]);
});

it('risk:security two clones beside the main checkout that both name the repository are refused naming both, and neither is used or stored (D-01)', async () => {
  const r = reposCopy();
  cpSync(r.tools, join(r.parent, 'tools-copy'), { recursive: true });
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(2);
  expect(status.out.trim()).toBe(
    `repository tools has two clones beside this checkout: ${posix(r.parent)}/tools and ${posix(r.parent)}/tools-copy - choose one with accord repos set tools <path>; nothing was used`,
  );
  expect(status.out).not.toContain('(found)');
  expect(existsSync(storeOf(r.svc))).toBe(false);
});

it('risk:security a symlink or junction to the clone, and a linked worktree of it, are not taken for the clone (D-01)', async () => {
  const r = reposCopy();
  gitRun(r.tools, 'worktree', 'add', '-q', '-b', 'wt', join(r.parent, 'tools-wt'));
  const real = moveAway(r.tools);
  // a junction is the link a person can make on Windows without a privilege, and an ordinary symlink on every other system
  symlinkSync(real, join(r.parent, 'tools'), 'junction');
  expect(existsSync(join(r.parent, 'tools', '.git', 'config'))).toBe(true);
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(2);
  expect(status.out.trim()).toBe(notFound(r.parent));
  expect(existsSync(storeOf(r.svc))).toBe(false);
});

it('risk:security a folder whose .git config cannot be read is skipped and never stops the search (D-01)', async () => {
  const r = reposCopy();
  // `.git/config` that is a folder: reading it fails, and it sorts before the real clone
  mkdirSync(join(r.parent, 'aaa-broken', '.git', 'config'), { recursive: true });
  const status = await run(['repos', 'status'], r.svc);
  expect(status.err).toBe('');
  expect(status.code).toBe(0);
  expect(status.out.trim()).toBe(`tools: ${posix(r.tools)} (found)`);
});

it('risk:regression the search stops at the first 200 entries in name order and says so (D-01)', async () => {
  const r = reposCopy();
  const far = join(r.parent, 'zz-tools');
  renameSync(r.tools, far);
  for (let i = 0; i < 205; i++) mkdirSync(join(r.parent, 'a' + String(i).padStart(3, '0')));
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(2);
  expect(status.out.trim()).toBe(`${notFound(r.parent)}; the folder ${posix(r.parent)} holds more than 200 entries, so it was not searched to the end`);
  expect(existsSync(storeOf(r.svc))).toBe(false);
});

it('risk:regression the same clone is found when the folder holds fewer entries than the cap (D-01)', async () => {
  const r = reposCopy();
  renameSync(r.tools, join(r.parent, 'zz-tools'));
  for (let i = 0; i < 150; i++) mkdirSync(join(r.parent, 'a' + String(i).padStart(3, '0')));
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(0);
  expect(status.out.trim()).toBe(`tools: ${posix(r.parent)}/zz-tools (found)`);
  expect(readFileSync(storeOf(r.svc), 'utf8')).toBe(`tools\t${posix(r.parent)}/zz-tools\n`);
});

/** The commands that never search: what each of them reads and runs while `repos.tools` is declared and no path is stored. */
const EVERYDAY: [string, string[]][] = [
  ['accord status', ['status']],
  ['accord dashboard', ['dashboard']],
  ['accord hook session-start', ['hook', 'session-start']],
];

it('risk:regression status, dashboard and the session-start hook never search for another repository: no file read and no git process under its folder (Decision 9)', async () => {
  const r = reposCopy();
  expect(existsSync(storeOf(r.svc))).toBe(false);
  for (const [label, argv] of EVERYDAY) {
    const { value, opens, git } = await traced(() => run(argv, r.svc));
    expect(value.code, label).toBeLessThan(2);
    expect(git.length, label + ' did start git processes in the main checkout').toBeGreaterThan(0);
    expect(opens.filter((p) => under(p, r.tools)), label + ' read a file of the other clone').toEqual([]);
    expect(git.filter((c) => under(c.cwd, r.tools)), label + ' ran git in the other clone').toEqual([]);
  }
  // nothing was found or stored by any of them
  expect(existsSync(storeOf(r.svc))).toBe(false);
});

it('risk:regression guard the guard: the same spies see the other clone read and run in when accord repos status searches for it (Decision 9)', async () => {
  const r = reposCopy();
  const { value, opens, git } = await traced(() => run(['repos', 'status'], r.svc));
  expect(value.code).toBe(0);
  expect(opens.filter((p) => under(p, r.tools)).length).toBeGreaterThan(0);
  expect(git.filter((c) => under(c.cwd, r.tools)).length).toBeGreaterThan(0);
});
