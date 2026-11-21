// Phase 8.3 D-06 (Ruling 10): `accord debug path` names the state file of /accord-debug outside any ticket, in a private folder of the system temp directory.
// The temp directory is stubbed to a folder of this file's own (as queue.test.ts does), so no test reaches the real one and none writes in the repository.
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { debugStatePath, readDebugState } from '../src/commands/debug.js';
import { cleanup, commitAll, gitRun, makeRepo, run } from './helpers/repo.js';

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

it('risk:security accord debug path refuses a state file that is not a regular file (D-06)', async () => {
  const repo = sandbox();
  const file = debugStatePath(repo);
  const folder = file.slice(0, file.lastIndexOf('/'));
  mkdirSync(folder, { mode: 0o700 });
  mkdirSync(file); // a directory where the file belongs
  const out = await run(['debug', 'path'], repo);
  expect(out.code).toBe(2);
  expect(out.err).toContain(file);
  expect(readDebugState(file)).toBeUndefined();
  expect(readDebugState(join(own, 'p83-no-such-file.md'))).toBeUndefined();
});
