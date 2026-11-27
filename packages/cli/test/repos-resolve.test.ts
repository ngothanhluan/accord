// Phase 08.9.3 D-01, D-02: another repository is declared in accord/config.yml by its remote URL, and `accord repos set <name> <path>` stores, per clone, where its clone lives,
// only when that clone's configured origin names the declared repository; `accord repos status` reads it back. Real git in temporary sandboxes, no network.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { norm } from '../src/commands/leftover.js';
import { gitDirsOf } from '../src/load/gitdir.js';
import { openLog } from './helpers/fs-opens.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, gitRun, run } from './helpers/repo.js';
import { reposCopy, SVC_URL, TOOLS_URL, useRepoSandboxes } from './helpers/repos.js';

// D-02: the not-found case counts the git processes accord starts, to show none of them clones
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));
// D-01: the scan reads a candidate's `.git/config` as a file, so the test asks which files accord read
vi.mock('node:fs', async (orig) => (await import('./helpers/fs-opens.js')).wrapFs(await orig()));
useRepoSandboxes();

const posix = (p: string): string => p.replace(/\\/g, '/');
/** `<git common dir>/accord/repos` of the main checkout `svc`. */
const storeOf = (svc: string): string => join((gitDirsOf(svc) as NonNullable<ReturnType<typeof gitDirsOf>>).commonDir, 'accord', 'repos');

it('risk:regression repos set stores the tools clone and prints where (D-01)', async () => {
  const r = reposCopy();
  const set = await run(['repos', 'set', 'tools', r.tools], r.svc);
  expect(set.err).toBe('');
  expect(set.code).toBe(0);
  expect(set.out.trim()).toBe(`repos: tools -> ${posix(r.tools)}`);
});

it('risk:regression the per-clone file holds exactly one tab-separated line with the absolute posix path (D-01)', async () => {
  const r = reposCopy();
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  expect(existsSync(storeOf(r.svc))).toBe(true);
  expect(readFileSync(storeOf(r.svc), 'utf8')).toBe(`tools\t${posix(r.tools)}\n`);
  // never committed: it lives in the git folder, so the working tree of the main checkout stays clean
  expect(gitRun(r.svc, 'status', '--porcelain').trim()).toBe('');
});

it('risk:regression repos status reads the stored path back and names it stored (D-01)', async () => {
  const r = reposCopy();
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  const status = await run(['repos', 'status'], r.svc);
  expect(status.err).toBe('');
  expect(status.code).toBe(0);
  expect(status.out.trim()).toBe(`tools: ${posix(r.tools)} (stored)`);
});

it('risk:data-loss storing and reading a clone leaves its branch, index and working tree as they were (D-01)', async () => {
  const r = reposCopy();
  const before = { branch: gitRun(r.tools, 'branch', '--show-current'), head: gitRun(r.tools, 'rev-parse', 'HEAD'), index: gitRun(r.tools, 'ls-files', '--stage') };
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  expect((await run(['repos', 'status'], r.svc)).code).toBe(0);
  expect(gitRun(r.tools, 'status', '--porcelain').trim()).toBe('');
  expect(gitRun(r.tools, 'branch', '--show-current')).toBe(before.branch);
  expect(gitRun(r.tools, 'rev-parse', 'HEAD')).toBe(before.head);
  expect(gitRun(r.tools, 'ls-files', '--stage')).toBe(before.index);
});

const OTHER_URL = 'https://github.com/acme/other.git';

it('risk:security a stored path is refused on every use once its origin no longer names the repository, and the stored line stays (D-01)', async () => {
  const r = reposCopy();
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  const stored = readFileSync(storeOf(r.svc), 'utf8');
  gitRun(r.tools, 'config', 'remote.origin.url', OTHER_URL);
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(2);
  expect(status.out).toContain(TOOLS_URL);
  expect(status.out).toContain(OTHER_URL);
  expect(status.out).toContain('the stored path was not used');
  expect(status.out).toContain('accord repos set tools <path>');
  expect(status.out).not.toContain('(stored)');
  expect(readFileSync(storeOf(r.svc), 'utf8')).toBe(stored);
});

it('risk:security repos set refuses a clone of another repository, naming both URLs, and stores nothing (D-01)', async () => {
  const r = reposCopy();
  const set = await run(['repos', 'set', 'tools', r.svc], r.svc);
  expect(set.code).toBe(2);
  expect(set.err).toContain(SVC_URL);
  expect(set.err).toContain(TOOLS_URL);
  expect(existsSync(storeOf(r.svc))).toBe(false);
});

it('risk:security repos set refuses a linked worktree, a plain folder and a name nobody declared, and stores nothing (D-01)', async () => {
  const r = reposCopy();
  const linked = join(r.parent, 'tools-wt');
  gitRun(r.tools, 'worktree', 'add', '-q', '-b', 'wt', linked);
  const plain = join(r.parent, 'plain');
  mkdirSync(plain);
  for (const path of [linked, plain, join(r.parent, 'missing')]) {
    const set = await run(['repos', 'set', 'tools', path], r.svc);
    expect(set.code, path).toBe(2);
    expect(set.err, path).toContain('nothing was stored');
  }
  const nope = await run(['repos', 'set', 'nope', r.tools], r.svc);
  expect(nope.code).toBe(2);
  expect(nope.err).toContain('tools');
  expect(existsSync(storeOf(r.svc))).toBe(false);
});

/** One body for both forms of the path: what is stored and printed is posix, and norm says it is the clone. */
async function storedAs(given: (tools: string) => string): Promise<void> {
  const r = reposCopy();
  const set = await run(['repos', 'set', 'tools', given(r.tools)], r.svc);
  expect(set.code).toBe(0);
  const line = readFileSync(storeOf(r.svc), 'utf8').trim();
  expect(line).not.toContain('\\');
  expect(norm(line.split('\t')[1])).toBe(norm(r.tools));
  const status = await run(['repos', 'status'], r.svc);
  expect(status.out).not.toContain('\\');
  expect(status.code).toBe(0);
}

it('risk:parsing a path given with forward slashes is stored and printed as it is, and matches the clone with norm (D-01)', async () => {
  await storedAs((tools) => tools.replace(/\\/g, '/'));
});

it.runIf(process.platform === 'win32')('risk:parsing a path given with backslashes is stored and printed with forward slashes, and matches the clone with norm (D-01)', async () => {
  await storedAs((tools) => tools.replace(/\//g, '\\'));
});

it('risk:parsing a clone whose origin is an ssh alias of the declared repository is accepted (D-01)', async () => {
  const r = reposCopy();
  gitRun(r.tools, 'config', 'remote.origin.url', 'git@github.com-work:acme/tools');
  const set = await run(['repos', 'set', 'tools', r.tools], r.svc);
  expect(set.err).toBe('');
  expect(set.code).toBe(0);
  expect((await run(['repos', 'status'], r.svc)).out.trim()).toBe(`tools: ${posix(r.tools)} (stored)`);
});

it('risk:data-loss setting a repository twice leaves one line, and a line the file holds that is no record is kept (D-01)', async () => {
  const r = reposCopy();
  const file = storeOf(r.svc);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'junk\n');
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  expect(readFileSync(file, 'utf8')).toBe(`junk\ntools\t${posix(r.tools)}\n`);
});

it('risk:data-loss a stored path whose folder is no longer a clone is reported as not found with the clone line (D-02)', async () => {
  const r = reposCopy();
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  cleanup(r.tools);
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(2);
  expect(status.out).toContain('is no longer a clone');
  expect(status.out).toContain(`git clone '${TOOLS_URL}' '${posix(r.parent)}/tools'`);
});

it('risk:data-loss no clone is stored or found: the not-found line names the exact git clone and accord repos set lines, and no git call clones (D-02)', async () => {
  const r = reposCopy();
  cleanup(r.tools); // D-01: a clone beside the main checkout is found by its origin, so the case needs none there
  spawnLog.calls = [];
  spawnLog.on = true;
  let status: { code: number; out: string; err: string };
  try {
    status = await run(['repos', 'status'], r.svc);
  } finally {
    spawnLog.on = false;
  }
  expect(status.code).toBe(2);
  expect(status.out.trim()).toBe(
    `tools: not found - clone it with git clone '${TOOLS_URL}' '${posix(r.parent)}/tools', or give an existing clone with accord repos set tools <path>; nothing was cloned`,
  );
  // the check is not vacuous: accord did start git processes, and none of them clones
  expect(spawnLog.calls.length).toBeGreaterThan(0);
  expect(spawnLog.calls.filter((args) => args.includes('clone'))).toEqual([]);
});

// D-01: no path is stored; the CLI finds the clone itself in the parent folder of the main checkout, by its origin
it('risk:regression a clone beside the main checkout is found by its origin, stored, and the scan starts one git process in it (D-01)', async () => {
  const r = reposCopy();
  expect(existsSync(storeOf(r.svc))).toBe(false);
  const calls: { args: string[]; cwd: string }[] = [];
  spawnLog.calls = [];
  spawnLog.on = true;
  spawnLog.fail = (args, options) => {
    calls.push({ args: [...args], cwd: posix(options?.cwd ?? '') });
    return false;
  };
  openLog.paths = [];
  openLog.on = true;
  let first: { code: number; out: string; err: string };
  try {
    first = await run(['repos', 'status'], r.svc);
  } finally {
    spawnLog.on = false;
    spawnLog.fail = undefined;
    openLog.on = false;
  }
  expect(first.err).toBe('');
  expect(first.code).toBe(0);
  expect(first.out.trim()).toBe(`tools: ${posix(r.tools)} (found)`);
  // stored as if `accord repos set` had been run
  expect(readFileSync(storeOf(r.svc), 'utf8')).toBe(`tools	${posix(r.tools)}
`);
  // the candidate's own config was read as a file, and the one match was confirmed with one `git config --get remote.origin.url` in it; no other git process ran outside the main checkout
  expect(openLog.paths.map((p) => p.toLowerCase())).toContain(posix(r.tools).toLowerCase() + '/.git/config');
  const outside = calls.filter((c) => !c.cwd.toLowerCase().startsWith(posix(r.svc).toLowerCase()));
  expect(outside.map((c) => c.args)).toEqual([['config', '--local', '--get', 'remote.origin.url']]);
  expect(outside[0].cwd.toLowerCase()).toBe(posix(r.tools).toLowerCase());
  const second = await run(['repos', 'status'], r.svc);
  expect(second.code).toBe(0);
  expect(second.out.trim()).toBe(`tools: ${posix(r.tools)} (stored)`);
});
