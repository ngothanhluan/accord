// Phase 8.3 D-06 (Ruling 10): `accord debug path` names the state file of /accord-debug outside any ticket, in a private folder of the system temp directory.
// The temp directory is stubbed to a folder of this file's own (as queue.test.ts does), so no test reaches the real one and none writes in the repository.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { debugStatePath, readDebugState } from '../src/commands/debug.js';
import { makePrivate } from '../src/load/debug-folder.js';
import { cleanup, commitAll, gitRun, makeRepo, run } from './helpers/repo.js';

// Phase 08.8 review WR-01: on Windows another account can write in the folder between `mkdir` and the `icacls` run that makes it private. `plant` stands for that account:
// when set, the folder is made private as usual and then a file of that name appears in it, on every OS (makePrivate is a no-op off Windows, so the window is the same call).
const race = vi.hoisted(() => ({ plant: undefined as string | undefined }));
vi.mock('../src/load/debug-folder.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/load/debug-folder.js')>();
  return {
    ...real,
    makePrivate: (dir: string, ...rest: unknown[]) => {
      (real.makePrivate as (d: string, ...r: unknown[]) => void)(dir, ...rest);
      if (race.plant !== undefined) writeFileSync(join(dir, race.plant), '## Episode 1\n\nplanted by another account\n');
    },
  };
});

// vitest forks one process per file, so the stub reaches no other file; `tmpdir()` reads TMPDIR, TEMP and TMP when it is called.
let own = '';
const stubTmp = (): void => {
  vi.stubEnv('TMPDIR', own);
  vi.stubEnv('TEMP', own);
  vi.stubEnv('TMP', own);
};
beforeAll(() => {
  own = mkdtempSync(join(tmpdir(), 'p83-debug-tmp-'));
  stubTmp();
});
beforeEach(stubTmp);
afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(own, { recursive: true, force: true, maxRetries: 5 });
});

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
  // each case starts from a temp directory holding nothing of accord's
  for (const name of readdirSync(own)) if (name.startsWith('accord-debug-')) rmSync(join(own, name), { recursive: true, force: true, maxRetries: 5 });
});

function sandbox(): string {
  const repo = makeRepo('valid-build');
  repos.push(repo);
  return repo;
}
const slashed = (p: string): string => p.replace(/\\/g, '/');
const pathOf = (out: string): string => /^path: (.*)$/m.exec(out)?.[1] ?? '';
const episodeOf = (out: string): string => /^episode: (.*)$/m.exec(out)?.[1] ?? '';
const status = (repo: string): string => gitRun(repo, 'status', '--porcelain', '--untracked-files=all');

it('risk:regression accord debug path prints one stable path per repository and writes nothing in it (D-06)', async () => {
  const repo = sandbox();
  const before = status(repo);
  const first = await run(['debug', 'path'], repo);
  expect(first.code, first.err).toBe(0);
  const file = pathOf(first.out);
  expect(file.startsWith(slashed(own) + '/accord-debug-'), file).toBe(true);
  expect(first.out).not.toContain('\\');
  expect(episodeOf(first.out)).toBe('none');
  expect(existsSync(file)).toBe(true);
  expect(readFileSync(file, 'utf8')).toBe('');

  // the same repository gives the same path
  const second = await run(['debug', 'path'], repo);
  expect(pathOf(second.out)).toBe(file);
  expect(status(repo)).toBe(before);

  // a linked worktree of the repository shares it
  commitAll(repo);
  const tree = join(own, 'p83-linked-' + Date.now());
  gitRun(repo, 'worktree', 'add', '--detach', tree);
  const linked = await run(['debug', 'path'], tree);
  expect(linked.code, linked.err).toBe(0);
  expect(pathOf(linked.out)).toBe(file);

  // another repository does not
  const other = sandbox();
  expect(pathOf((await run(['debug', 'path'], other)).out)).not.toBe(file);

  // the JSON form carries the same two facts
  const json = await run(['debug', 'path', '--json'], repo);
  expect(JSON.parse(json.out)).toEqual({ path: file, episode: 'none' });
  expect(debugStatePath(repo)).toBe(file);
});

it('risk:complex-branching accord debug path reads an open episode as open and a resolved one as none (D-06)', async () => {
  const repo = sandbox();
  const file = pathOf((await run(['debug', 'path'], repo)).out);
  writeFileSync(file, '## Episode 1\n\nthe export drops a row\n');
  expect(episodeOf((await run(['debug', 'path'], repo)).out)).toBe('open');
  expect(readDebugState(file)).toContain('the export drops a row');
  appendFileSync(file, '\n## Resolved\n\nroot cause named, no fix made\n');
  const closed = await run(['debug', 'path'], repo);
  expect(episodeOf(closed.out)).toBe('none');
  expect(JSON.parse((await run(['debug', 'path', '--json'], repo)).out).episode).toBe('none');
  // the file's text is data: it is never printed
  expect(closed.out).not.toContain('export drops');
});

it.skipIf(process.platform === 'win32')('risk:security accord debug path refuses a link at the state file and follows nothing (D-06)', async () => {
  const repo = sandbox();
  const file = debugStatePath(repo);
  const folder = file.slice(0, file.lastIndexOf('/'));
  const outside = join(own, 'p83-outside.txt');
  writeFileSync(outside, 'keep me\n');
  mkdirSync(folder, { mode: 0o700 });
  symlinkSync(outside, file);
  const out = await run(['debug', 'path'], repo);
  expect(out.code).toBe(2);
  expect(out.err).toContain(file);
  expect(readFileSync(outside, 'utf8')).toBe('keep me\n');
  expect(lstatSync(file).isSymbolicLink()).toBe(true);

  // a link in place of the folder is refused too, and its target gets nothing
  rmSync(file);
  rmSync(folder, { recursive: true });
  const target = join(own, 'p83-target');
  mkdirSync(target, { mode: 0o700 });
  symlinkSync(target, folder);
  const viaFolder = await run(['debug', 'path'], repo);
  expect(viaFolder.code).toBe(2);
  expect(readdirSync(target)).toEqual([]);
});

it.skipIf(process.platform === 'win32')('risk:security accord debug path refuses a state folder others can write (D-06)', async () => {
  const repo = sandbox();
  const file = debugStatePath(repo);
  const folder = file.slice(0, file.lastIndexOf('/'));
  mkdirSync(folder, { mode: 0o777 });
  chmodSync(folder, 0o777);
  const open = await run(['debug', 'path'], repo);
  expect(open.code).toBe(2);
  expect(open.err).toContain(folder);
  expect(readdirSync(folder)).toEqual([]);

  // an empty temp directory: the folder is created private and the file readable by its owner alone
  rmSync(folder, { recursive: true });
  const fresh = await run(['debug', 'path'], repo);
  expect(fresh.code, fresh.err).toBe(0);
  expect(lstatSync(folder).mode & 0o777).toBe(0o700);
  expect(lstatSync(file).mode & 0o777).toBe(0o600);
});

// Phase 08.8 D-14 (WR-01, IN-02): Node reports no owner and mode 666 on Windows, so the folder's access list is the check: the folder accord makes holds only SYSTEM,
// Administrators and the person; one more account (here the Users group) makes accord refuse it, name the account and name TEMP as the way to use another folder.
it.runIf(process.platform === 'win32')('risk:security on Windows debug path refuses a folder open to the Users group (D-14)', async () => {
  const repo = sandbox();
  const first = await run(['debug', 'path'], repo);
  expect(first.code, first.err).toBe(0);
  const file = pathOf(first.out);
  const folder = file.slice(0, file.lastIndexOf('/'));
  writeFileSync(file, '## Episode 1\n\nthe export drops a row\n');

  execFileSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'icacls.exe'), [folder.replace(/\//g, '\\'), '/grant', '*S-1-5-32-545:(OI)(CI)(R)'], { windowsHide: true });
  const refused = await run(['debug', 'path'], repo);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain(folder);
  expect(refused.err).toContain('S-1-5-32-545');
  expect(refused.err).toContain('TEMP');
  expect(readFileSync(file, 'utf8')).toBe('## Episode 1\n\nthe export drops a row\n');
  expect(readdirSync(folder)).toEqual([file.slice(file.lastIndexOf('/') + 1)]);
});

// Phase 08.8 review WR-01: a folder accord made this run is empty after makePrivate or refused, and the state file in it is created with the exclusive flag, never adopted.
it('risk:security accord debug path refuses a folder it just made when a file appears in it before it was private (08.8 REVIEW WR-01)', async () => {
  const repo = sandbox();
  const file = debugStatePath(repo);
  const folder = file.slice(0, file.lastIndexOf('/'));
  const name = file.slice(file.lastIndexOf('/') + 1);
  try {
    for (const plant of [name, 'other.md']) {
      race.plant = plant;
      const out = await run(['debug', 'path'], repo);
      expect(out.code, plant).toBe(2);
      expect(out.err).toContain(folder);
      expect(out.out).toBe('');
      expect(readFileSync(join(folder, plant), 'utf8'), 'the planted file is left as it was').toContain('planted by another account');
      rmSync(folder, { recursive: true, force: true });
    }
  } finally {
    race.plant = undefined;
  }
  // with nothing planted the same run makes the folder and the file
  const fresh = await run(['debug', 'path'], repo);
  expect(fresh.code, fresh.err).toBe(0);
  expect(readFileSync(file, 'utf8')).toBe('');
});

// Phase 08.8 D-14 (WR-02): a state file over DEBUG_STATE_MAX (1 MiB) is refused, naming the size, and is never read.
it('risk:resource accord debug path refuses a state file over the size limit (D-14)', async () => {
  const repo = sandbox();
  const file = pathOf((await run(['debug', 'path'], repo)).out);
  writeFileSync(file, 'x'.repeat(1024 * 1024 + 1));
  const out = await run(['debug', 'path'], repo);
  expect(out.code).toBe(2);
  expect(out.err).toContain(file);
  expect(out.err).toContain('1048577');
  expect(out.out).toBe('');
  expect(lstatSync(file).size).toBe(1024 * 1024 + 1);
});

it('risk:security accord debug path refuses a state file that is not a regular file (D-06)', async () => {
  const repo = sandbox();
  const file = debugStatePath(repo);
  const folder = file.slice(0, file.lastIndexOf('/'));
  mkdirSync(folder, { mode: 0o700 });
  makePrivate(folder); // Windows ignores the mode: a plain folder in a shared TEMP inherits the Users group, and the folder check would refuse the folder before the file
  mkdirSync(file); // a directory where the file belongs
  const out = await run(['debug', 'path'], repo);
  expect(out.code).toBe(2);
  expect(out.err).toContain(file);
  expect(readDebugState(file)).toBeUndefined();
  expect(readDebugState(join(own, 'p83-no-such-file.md'))).toBeUndefined();
});
