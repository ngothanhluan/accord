// Phase 08.9.3 D-01, D-02, Decision 9: the clone of another repository is looked for beside the main checkout, by its origin, and only by the commands that need it. Nothing found ends in one line that
// names the `git clone` to run; two found are refused; a symlink, a junction and a linked worktree are never taken for the clone; a crowded folder is searched only to its first 200 entries; and
// `accord status`, `accord dashboard` and `accord hook session-start` never look for the clone at all. Real git in temporary sandboxes, no network.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { gitDirsOf } from '../src/load/gitdir.js';
import { scanParent } from '../src/load/repos.js';
import { openLog } from './helpers/fs-opens.js';
import { spawnLog } from './helpers/git-spawns.js';
import { claimedUnder, cleanup, commitAll, gitRun, run, writeFiles } from './helpers/repo.js';
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

const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const sliceOf = (n: number, tasks: string, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${tasks}\ncovers: @ac-${n}\n`;

/** ST-9 claimed on t/ST-9 of the svc clone, its plan of slice 1 in tools and slice 2 here committed; no clone path is stored, so the slice in work (slice 1) is built in another repository. */
async function activeInTools(off = false): Promise<ReturnType<typeof reposCopy>> {
  const r = reposCopy();
  r.git(r.svc, 'switch', '-q', '-c', 't/ST-9');
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const text = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', task(1, 'tools:src/Tools.cs'), task(2, 'src/svc.ts'), sliceOf(1, '1', 'tools'), sliceOf(2, '2')].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
  // the wake hook answers a typed /accord only for a person who switched accord off (or in a quiet session off a ticket branch)
  if (off) expect((await run(['off'], r.svc)).code).toBe(0);
  expect(existsSync(storeOf(r.svc))).toBe(false);
  return r;
}

/** The hooks that print the anchor of the active ticket: the session-resume hook and the wake hook of a typed /accord (its stdin names a plain session id). */
const ANCHORING: [string, string[], string | undefined][] = [
  ['accord hook session-resume', ['hook', 'session-resume'], undefined],
  ['accord hook prompt-expansion (the wake)', ['hook', 'prompt-expansion'], 's-t0'],
];

it('risk:security T-08.9.3-06 the resume and wake hooks of a ticket whose slice in work is in another repository never search for its clone: no file read and no git process under its folder, nothing stored (Decision 9)', async () => {
  for (const [label, argv, session] of ANCHORING) {
    const r = await activeInTools(session !== undefined);
    const stdin = session === undefined ? undefined : JSON.stringify({ cwd: r.svc, session_id: session, hook_event_name: 'UserPromptExpansion', command_name: 'accord', command_args: '' });
    const { value, opens, git } = await traced(() => run(argv, r.svc, {}, stdin));
    expect(value.code, label + value.err).toBe(0);
    // the anchor still names the slice and its repository; only the start, which needs the clone, is left out
    expect(value.out, label).toContain('Slice: 1 of 2 in repository tools');
    expect(value.out, label).not.toContain('Slice: 1 of 2 in repository tools, from');
    expect(git.length, label + ' did start git processes in the main checkout').toBeGreaterThan(0);
    expect(opens.filter((p) => under(p, r.tools)), label + ' read a file of the other clone').toEqual([]);
    expect(git.filter((c) => under(c.cwd, r.tools)), label + ' ran git in the other clone').toEqual([]);
    expect(existsSync(storeOf(r.svc)), label + ' stored a clone path').toBe(false);
  }
}, 120_000);

it('risk:regression guard the guard: accord anchor, typed by a person, does search for the clone of the slice in work and stores it (Decision 9)', async () => {
  const r = await activeInTools();
  const { value, opens, git } = await traced(() => run(['anchor'], r.svc));
  expect(value.code, value.out + value.err).toBe(0);
  expect(value.out).toContain('Slice: 1 of 2 in repository tools, from');
  expect(opens.filter((p) => under(p, r.tools)).length).toBeGreaterThan(0);
  expect(git.filter((c) => under(c.cwd, r.tools)).length).toBeGreaterThan(0);
}, 120_000);

/** A sibling folder that looks like a clone: its `.git/config` holds `text`. */
function fakeClone(parent: string, name: string, text: string): string {
  const dir = join(parent, name);
  mkdirSync(join(dir, '.git'), { recursive: true });
  writeFileSync(join(dir, '.git', 'config'), text);
  return dir;
}
const DECLARED = { repos: { tools: { remote: TOOLS_URL } } } as unknown as Parameters<typeof scanParent>[1];

it('risk:resource W-2 a hostile .git/config line of a sibling folder is read in linear time, and the real clone beside it is still found', () => {
  const r = reposCopy();
  // `url = a`, about a mebibyte of blanks and a last character: a lazy `(.*?)\s*$` backtracks over every blank for each shorter value (80,000 blanks took 2.6 s, a mebibyte takes minutes)
  const hostile = '[remote "origin"]\n\turl = a' + ' '.repeat(1024 * 1024 - 4096) + 'x\n';
  fakeClone(r.parent, 'aaa-hostile', hostile);
  const started = performance.now();
  const scan = scanParent(r.svc, DECLARED, 'tools');
  const took = performance.now() - started;
  // wide enough for a loaded machine, far below the stall it guards
  expect(took, 'the scan of one hostile line took ' + Math.round(took) + ' ms').toBeLessThan(1000);
  expect(scan.found.map(posix)).toEqual([posix(r.tools)]);
});

it('risk:regression the origin of a sibling config is read as before: blanks around the key and the value, a quoted value, the last url of the section, and no other section (W-2)', () => {
  const r = reposCopy();
  cleanup(r.tools);
  const foundWith = (name: string, text: string): string[] => {
    fakeClone(r.parent, name, text);
    const found = scanParent(r.svc, DECLARED, 'tools').found.map(posix);
    cleanup(join(r.parent, name));
    return found;
  };
  const at = (name: string): string[] => [posix(join(r.parent, name))];
  expect(foundWith('c1', `[remote "origin"]\n  URL\t=\t ${TOOLS_URL}  \n`)).toEqual(at('c1'));
  expect(foundWith('c2', `[remote "origin"]\n\turl = "${TOOLS_URL}"\r\n`)).toEqual(at('c2'));
  expect(foundWith('c3', `[remote "origin"]\n\turl = https://github.com/acme/other.git\n\turl = ${TOOLS_URL}\n`)).toEqual(at('c3'));
  expect(foundWith('c4', `[remote "upstream"]\n\turl = ${TOOLS_URL}\n`)).toEqual([]);
  expect(foundWith('c5', `[remote "origin"]\n\turlx = ${TOOLS_URL}\n`)).toEqual([]);
});

it('risk:security W-2 a .git/config that is a link is skipped, not read: the folder is no candidate (D-01)', (ctx) => {
  const r = reposCopy();
  const real = moveAway(r.tools);
  const dir = join(r.parent, 'tools');
  mkdirSync(join(dir, '.git'), { recursive: true });
  try {
    symlinkSync(join(real, '.git', 'config'), join(dir, '.git', 'config'), 'file');
  } catch (e) {
    // Windows refuses a file link without the privilege or developer mode; there is nothing to test without one
    ctx.skip('this system refuses to create a file symlink: ' + (e as NodeJS.ErrnoException).code);
  }
  expect(readFileSync(join(dir, '.git', 'config'), 'utf8')).toContain(TOOLS_URL);
  expect(scanParent(r.svc, DECLARED, 'tools').found).toEqual([]);
});
