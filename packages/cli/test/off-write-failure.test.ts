// Phase 08.9.2 review WR-03: `accord off` and `accord on` write through a temp file and a rename. When the rename fails (on Windows, a file another process holds open) no `.tmp` file may be
// left behind, nothing may throw a raw stack, and `on` keeps the marker so the person can run it again.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const failing = { rename: false };

vi.mock('node:fs', async (orig) => {
  const actual = await orig<typeof import('node:fs')>();
  const renameSync = (...args: Parameters<typeof actual.renameSync>): void => {
    if (failing.rename) throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    actual.renameSync(...args);
  };
  return { ...actual, renameSync, default: { ...actual, renameSync } };
});

const dirs: string[] = [];
afterEach(() => {
  failing.rename = false;
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const strays = (folder: string): string[] => (existsSync(folder) ? readdirSync(folder).filter((n) => n.endsWith('.tmp')) : []);

it('risk:resource a failed rename leaves no temp file and one stderr line, in off and in on (review WR-03)', async () => {
  const repo = makeLaneRepo();
  dirs.push(repo);
  const git = join(repo, '.git');

  // off: no marker is made, no temp file stays
  failing.rename = true;
  const off = await run(['off'], repo);
  failing.rename = false;
  expect(off.code).toBe(2);
  expect(off.err.trim().split('\n')).toHaveLength(1);
  expect(off.err).toContain('cannot write the marker');
  expect(existsSync(join(git, 'accord-off'))).toBe(false);
  expect(strays(git)).toEqual([]);

  // on over a 0.20.x marker: the restore cannot be written, the marker stays so a second `on` can finish, and the settings file keeps its bytes
  const marker = JSON.stringify({ since: 'x', panel: { prior: 'absent', createdMap: true } }, null, 2) + '\n';
  const settings = JSON.stringify({ enabledPlugins: { 'accord-panel@accord': false } }, null, 2) + '\n';
  writeFiles(repo, { '.git/accord-off': marker, '.claude/settings.local.json': settings });
  failing.rename = true;
  const on = await run(['on'], repo);
  failing.rename = false;
  expect(on.code).toBe(2);
  expect(on.err.trim().split('\n')).toHaveLength(1);
  expect(on.err).toContain('the marker is left in place');
  expect(readFileSync(join(git, 'accord-off'), 'utf8')).toBe(marker);
  expect(readFileSync(join(repo, '.claude', 'settings.local.json'), 'utf8')).toBe(settings);
  expect(strays(join(repo, '.claude'))).toEqual([]);

  // and the retry works once the file is free
  const again = await run(['on'], repo);
  expect(again.code).toBe(0);
  expect(existsSync(join(git, 'accord-off'))).toBe(false);
  expect(readFileSync(join(repo, '.claude', 'settings.local.json'), 'utf8')).toBe('{}\n');
});
