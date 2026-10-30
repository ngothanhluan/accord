import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, writeFiles } from './helpers/repo.js';

const KEYS = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM'] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};
const dirs: string[] = [];

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  const home = mkdtempSync(join(tmpdir(), 'accord-nohome-'));
  dirs.push(home);
  const empty = join(home, 'gitconfig');
  writeFileSync(empty, '');
  process.env.GIT_CONFIG_GLOBAL = empty;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  for (const d of dirs.splice(0)) cleanup(d);
});

it('risk:environment commitMsg and mergeMsg commit in a sandbox when the host has no git identity', () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'a.txt': 'a\n' });
    const first = commitMsg(repo, 'first');
    expect(first).toMatch(/^[0-9a-f]{40}$/);
    gitRun(repo, 'switch', '-q', '-c', 'side');
    writeFiles(repo, { 'b.txt': 'b\n' });
    commitMsg(repo, 'side');
    gitRun(repo, 'switch', '-q', '-');
    writeFiles(repo, { 'c.txt': 'c\n' });
    commitMsg(repo, 'main');
    expect(mergeMsg(repo, 'side', 'merge side')).toMatch(/^[0-9a-f]{40}$/);
  } finally {
    cleanup(repo);
  }
});
