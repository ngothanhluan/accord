// Phase 8.2 group 3 (D-01, D-02, D-06, D-07, D-08): `accord audit` reports claimed tickets idle past stale_days and unclaimed drafts untouched past stale_draft_days,
// naming the person, from the branches already in the clone. It reads git and files, writes nothing and calls no model.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

/** A moment `days` whole days and one hour ago: the hour keeps `Math.floor` of the age at `days` however slowly the test runs. */
const ago = (days: number): Date => new Date(Date.now() - (days * 24 + 1) * 3600 * 1000);
const CONVENTIONS = '# Conventions\n\n<!-- One rule per line. -->\n';

/** A sandbox on branch main with `a@x.io` as its git identity, holding `files` beside the config, committed `age` days ago. */
function sandbox(files: Record<string, string>, config: string, age: number): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', 'a@x.io');
  gitRun(repo, 'config', 'user.name', 'a');
  writeFiles(repo, { 'accord/config.yml': config, 'accord/product/conventions.md': CONVENTIONS, ...files });
  commitMsg(repo, 'add tickets', ago(age));
  return repo;
}

/** A local claim branch t/<id> whose tip is an empty `claim: <id>` commit `age` days old; the checkout goes back to main. */
function claim(repo: string, id: string, age: number): void {
  gitRun(repo, 'switch', '-q', '-c', `t/${id}`);
  commitMsg(repo, `claim: ${id}`, ago(age), true);
  gitRun(repo, 'switch', '-q', 'main');
}

const audit = async (repo: string): Promise<{ lines: string[]; out: string; code: number }> => {
  const r = await run(['audit'], repo);
  return { lines: r.out.split('\n').filter((l) => l !== ''), out: r.out + r.err, code: r.code };
};

const WITH_STALE = CONFIG + "stale_days: '14'\n";

/** T-1 claimed 20 days ago and T-2 claimed 3 days ago, both written 30 days ago, as `a@x.io`. */
function idleRepo(): string {
  const repo = sandbox({ 'accord/tickets/T-1.md': laneTicket('T-1'), 'accord/tickets/T-2.md': laneTicket('T-2') }, WITH_STALE, 30);
  claim(repo, 'T-1', 20);
  claim(repo, 'T-2', 3);
  return repo;
}

it('risk:complex-branching accord audit reports a ticket idle 20 days with its claimer and not one idle 3 days (8.2-ac-1)', async () => {
  const repo = idleRepo();
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  const idle = r.lines.filter((l) => l.startsWith('gap: ticket-idle:'));
  expect(idle, r.out).toHaveLength(1);
  for (const part of ['T-1', 'a@x.io', '20 days', '/accord-continue T-1', 'accord drop T-1 --reason']) expect(idle[0], r.out).toContain(part);
  expect(r.lines.filter((l) => l.startsWith('gap: ticket-idle:') && l.includes('T-2'))).toEqual([]);
  expect(r.lines).toContain('fact: who: email');
  expect(r.lines.filter((l) => l.startsWith('fact: work-ages:'))).toHaveLength(1);

  // D-01: the dashboard calls the same ticket claimed and open
  const board = await run(['dashboard', '--json'], repo);
  expect(board.code, board.err).toBe(0);
  const d = JSON.parse(board.out) as { yours: { rows: { id: string }[] } };
  expect(d.yours.rows.map((x) => x.id).sort()).toEqual(['T-1', 'T-2']);
});

it('risk:complex-branching group 3 says not checked instead of clean when it cannot read (D-01)', async () => {
  const broken = sandbox({ 'accord/tickets/T-1.md': laneTicket('T-1') }, CONFIG + "stale_days: 'soon'\n", 30);
  claim(broken, 'T-1', 20);
  const r = await audit(broken);
  expect(r.code, r.out).toBe(0);
  const line = r.lines.find((l) => l.startsWith('fact: work-ages:')) ?? '';
  expect(line, r.out).toContain('not checked (config.yml does not pass');
  expect(r.lines.filter((l) => l.startsWith('gap: ticket-idle:') || l.startsWith('gap: draft-stale:'))).toEqual([]);
  expect(r.lines).toContain('fact: who: email');

  // a repository with no commit yet: the claim branches read as an empty history
  const fresh = makeEmptyRepo();
  dirs.push(fresh);
  const init = await run(['init'], fresh);
  expect(init.code, init.out + init.err).toBe(0);
  const f = await audit(fresh);
  expect(f.code, f.out).toBe(0);
  expect(f.lines.filter((l) => l.startsWith('fact: work-ages:'))).toHaveLength(1);
  expect(f.lines.filter((l) => l.startsWith('gap: ticket-idle:') || l.startsWith('gap: draft-stale:'))).toEqual([]);
});

/** The git verbs this audit must never run: anything that writes a ref, the index, the working tree, the config or the network. */
const WRITING = new Set(['commit', 'update-ref', 'push', 'fetch', 'pull', 'gc', 'prune', 'reset', 'switch', 'checkout', 'stash', 'add', 'rm', 'tag', 'merge', 'clean', 'init', 'clone', 'rebase', 'cherry-pick', 'revert', 'mv', 'restore', 'apply', 'am', 'notes', 'replace', 'pack-refs', 'repack', 'maintenance']);
function verbOf(args: readonly string[]): { verb: string; rest: string[] } {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === '-c' || a === '-C') i++;
    else if (!a.startsWith('-')) return { verb: a, rest: args.slice(i + 1) as string[] };
  }
  return { verb: '', rest: [] };
}
/** True when `args` is a git call that may write (Ruling "AC-8 observation"). */
function writes(args: readonly string[]): boolean {
  const { verb, rest } = verbOf(args);
  if (WRITING.has(verb)) return true;
  if (verb === 'worktree') return rest[0] !== 'list';
  if (verb === 'remote') return rest[0] !== 'get-url';
  if (verb === 'branch') return rest.some((a) => /^(-d|-D|-m|-M|-c|-C|--delete|--move|--copy|-f|--force)$/.test(a)) || rest.some((a) => !a.startsWith('-'));
  if (verb === 'config') return !args.includes('--get');
  return false;
}

/** The four listings of Ruling "AC-8 observation": the same before and after the audit. */
function listings(repo: string): Record<string, string> {
  const common = resolve(repo, gitRun(repo, 'rev-parse', '--git-common-dir').trim());
  return {
    status: gitRun(repo, 'status', '--porcelain', '--untracked-files=all'),
    refs: gitRun(repo, 'for-each-ref'),
    worktrees: gitRun(repo, 'worktree', 'list', '--porcelain'),
    common: readdirSync(common).sort().join('\n'),
    commonAccord: (() => {
      try {
        return readdirSync(resolve(common, 'accord')).sort().join('\n');
      } catch {
        return 'none';
      }
    })(),
  };
}

it('risk:data-loss accord audit group 3 writes nothing and calls no model (8.2-ac-8)', async () => {
  const repo = idleRepo();
  const before = listings(repo);
  spawnLog.calls = [];
  spawnLog.on = true;
  const r = await audit(repo);
  spawnLog.on = false;
  expect(r.code, r.out).toBe(0);
  expect(r.lines.some((l) => l.startsWith('gap: ticket-idle:')), r.out).toBe(true);
  expect(listings(repo)).toEqual(before);
  expect(spawnLog.calls.length).toBeGreaterThan(0);
  const bad = spawnLog.calls.filter((c) => writes(c));
  expect(bad.map((c) => c.join(' '))).toEqual([]);

  // no network module and no fetch( in group 3's loaders and core module
  for (const file of ['../src/load/audit-hygiene.ts', '../src/load/who.ts', '../../core/src/audit/hygiene.ts']) {
    const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
    expect(text, file).not.toMatch(/node:http|node:https|node:net|undici/);
    expect(text, file).not.toMatch(/\bfetch\(/);
  }
});
