// Phase 08.9.3 D-01, D-02: another repository is declared in accord/config.yml by its remote URL, and `accord repos set <name> <path>` stores, per clone, where its clone lives,
// only when that clone's configured origin names the declared repository; `accord repos status` reads it back. Real git in temporary sandboxes, no network.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { gitDirsOf } from '../src/load/gitdir.js';
import { gitRun, run } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes } from './helpers/repos.js';

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
