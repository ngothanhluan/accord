// Phase 8.2 group 3 (D-01, D-02, D-06, D-07, D-08): `accord audit` reports claimed tickets idle past stale_days and unclaimed drafts untouched past stale_draft_days,
// naming the person, from the branches already in the clone. It reads git and files, writes nothing and calls no model.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { CONFIG, done, laneTicket, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { copy, doneOnRemote, has, makeClone, ticketWorktree, useSandboxes } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';
import * as limit from '../src/commands/fetch-limit.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

useSandboxes([{ tickets: ['ST-9'] }, { tickets: ['T-1'] }]);

const dirs: string[] = [];
const clones: Clone[] = [];
afterEach(() => {
  vi.mocked(limit.cleanBudgetMs).mockReset();
  while (dirs.length > 0) cleanup(dirs.pop() as string);
  while (clones.length > 0) (clones.pop() as Clone).cleanupAll();
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

/** A moment `days` whole days and one hour ago: the hour keeps `Math.floor` of the age at `days` however slowly the test runs. */
const ago = (days: number): Date => new Date(Date.now() - (days * 24 + 1) * 3600 * 1000);
const CONVENTIONS = '# Conventions\n\n<!-- One rule per line. -->\n';

/** A sandbox on branch main with `a@x.io` as its git identity, holding `files` beside the config, committed `age` days ago. */
function sandbox(files: Record<string, string>, config: string, age: number, email = 'a@x.io'): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', email);
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

const draftLines = (lines: string[]): string[] => lines.filter((l) => l.startsWith('gap: draft-stale:'));

it('risk:complex-branching accord audit reports a draft untouched 100 days with its creator and none when stale_draft_days is 120 (8.2-ac-2)', async () => {
  const files = { 'accord/tickets/T-3.md': laneTicket('T-3') };
  const repo = sandbox(files, CONFIG, 100, 'c@x.io');
  gitRun(repo, 'config', 'user.email', 'a@x.io'); // the viewer is not the creator
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  const old = draftLines(r.lines);
  expect(old, r.out).toHaveLength(1);
  for (const part of ['T-3', 'c@x.io', '100 days', '/accord-pickup T-3', 'accord drop T-3 --reason']) expect(old[0], r.out).toContain(part);
  expect(r.lines.find((l) => l.startsWith('fact: work-ages:')), r.out).toContain('stale_draft_days');

  const wide = sandbox(files, CONFIG + "stale_draft_days: '120'\n", 100, 'c@x.io');
  const w = await audit(wide);
  expect(w.code, w.out).toBe(0);
  expect(draftLines(w.lines), w.out).toEqual([]);
});

it('risk:regression a done ticket whose frontmatter reads status draft is never an old draft (8.2-ac-2)', async () => {
  const files: Files = {};
  done(files, 'D-1', { frontmatter: ['status: draft'] });
  expect(files[P('D-1')]).toContain('status: draft');
  const repo = sandbox(files, CONFIG, 200);
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  expect(draftLines(r.lines), r.out).toEqual([]);
  expect(r.lines.filter((l) => l.startsWith('gap: ticket-idle:')), r.out).toEqual([]);
});

it('risk:complex-branching a draft queued on an unmerged backlog branch is aged by its branch date (D-02)', async () => {
  const c = makeClone({ tickets: [] });
  clones.push(c);
  const date = ago(100).toISOString().slice(0, 10);
  const branch = `backlog/st-9-${date}`;
  gitRun(c.root, 'config', 'user.email', 'c@x.io');
  gitRun(c.root, 'switch', '-q', '-c', branch);
  writeFiles(c.root, { 'accord/tickets/ST-9.md': laneTicket('ST-9') });
  commitMsg(c.root, 'backlog: queue ST-9', ago(100));
  gitRun(c.root, 'switch', '-q', 'main');
  gitRun(c.root, 'config', 'user.email', 'a@x.io');
  const days = Math.floor((Date.now() / 1000 - Date.parse(date + 'T00:00:00Z') / 1000) / 86400);
  const r = await audit(c.root);
  expect(r.code, r.out).toBe(0);
  const old = draftLines(r.lines);
  expect(old, r.out).toHaveLength(1);
  for (const part of ['ST-9', 'c@x.io', branch, `${days} days`, `merge ${branch} into the default branch first`]) expect(old[0], r.out).toContain(part);
});

it('risk:resource the creator is read only for drafts past the threshold (D-02)', async () => {
  const repo = sandbox({ 'accord/tickets/OLD-1.md': laneTicket('OLD-1') }, CONFIG, 100);
  const fresh: Record<string, string> = {};
  for (let i = 1; i <= 10; i++) fresh[`accord/tickets/NEW-${i}.md`] = laneTicket(`NEW-${i}`);
  writeFiles(repo, fresh);
  commitMsg(repo, 'add ten drafts');
  spawnLog.calls = [];
  spawnLog.on = true;
  const r = await audit(repo);
  spawnLog.on = false;
  expect(r.code, r.out).toBe(0);
  expect(draftLines(r.lines), r.out).toHaveLength(1);
  const creatorReads = spawnLog.calls.filter((c) => verbOf(c).verb === 'log' && c.includes('--diff-filter=A'));
  expect(creatorReads.map((c) => c.join(' '))).toHaveLength(1);
});

// ---- 08.2-04 (D-03, D-06): what a clean would remove, and the branches no clean handles --------------------------------------------------

/** The 8.2-ac-3 sandbox: ST-9 done on the remote with its worktree here, after a fetch so every ref is already in the clone. */
function doneWorktree(): Clone {
  const c = copy({ tickets: ['ST-9'] });
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  c.git('fetch', '-q', 'origin');
  return c;
}

const gapsOf = (lines: string[], id: string): string[] => lines.filter((l) => l.startsWith(`gap: ${id}:`));

it("risk:data-loss accord audit lists a done ticket's worktree as worktree-leftover and deletes nothing (8.2-ac-3)", async () => {
  const c = doneWorktree();
  const tip = c.git('rev-parse', 't/ST-9').trim();
  const remoteTip = c.git('rev-parse', 'origin/t/ST-9').trim();
  spawnLog.calls = [];
  spawnLog.on = true;
  const r = await audit(c.root);
  spawnLog.on = false;
  expect(r.code, r.out).toBe(0);
  const left = gapsOf(r.lines, 'worktree-leftover');
  expect(left, r.out).toHaveLength(3);
  expect(left.some((l) => l.includes(`removed ${c.sibling('ST-9')}`)), r.out).toBe(true);
  expect(left.some((l) => l.includes(`deleted t/ST-9 (was ${tip})`)), r.out).toBe(true);
  expect(left.some((l) => l.includes(`deleted origin/t/ST-9 (was ${remoteTip})`)), r.out).toBe(true);
  for (const l of left) {
    expect(l, r.out).toContain('branch tip by fixture@example.invalid');
    expect(l, r.out).toContain('accord worktree clean');
    expect(l, r.out).not.toContain(' - next: ');
  }
  expect(r.lines, r.out).toContain('fact: worktree-refs: judged against the refs already in this clone; accord worktree clean --dry-run fetches first');
  // the branches the dry clean names are not listed a second time
  expect(gapsOf(r.lines, 'branch-orphan'), r.out).toEqual([]);
  expect(gapsOf(r.lines, 'claim-unpushed'), r.out).toEqual([]);

  // nothing was deleted, and nothing was asked of the remote
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.root, 'refs/remotes/origin/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);
  expect(spawnLog.calls.length).toBeGreaterThan(0);
  const asked = spawnLog.calls.filter((a) => ['fetch', 'push'].includes(verbOf(a).verb) || (verbOf(a).verb === 'remote' && verbOf(a).rest[0] === 'prune'));
  expect(asked.map((a) => a.join(' '))).toEqual([]);
});

it('risk:complex-branching accord audit lists an orphan branch and an old unpushed claim branch and deletes neither (8.2-ac-4)', async () => {
  const c = copy({ tickets: ['T-1'] });
  c.git('branch', 't/ZZ-9');
  c.git('switch', '-q', '-c', 't/T-1');
  commitMsg(c.root, 'claim: T-1', ago(20), true);
  c.git('switch', '-q', 'main');
  const r = await audit(c.root);
  expect(r.code, r.out).toBe(0);
  const orphan = gapsOf(r.lines, 'branch-orphan');
  expect(orphan, r.out).toHaveLength(1);
  for (const part of ['t/ZZ-9 (local)', 'ticket ZZ-9', 'tip by fixture@example.invalid', 'git branch -D t/ZZ-9']) expect(orphan[0], r.out).toContain(part);
  const unpushed = gapsOf(r.lines, 'claim-unpushed');
  expect(unpushed, r.out).toHaveLength(1);
  for (const part of ['t/T-1 (ticket T-1)', '20 days old', 'tip by fixture@example.invalid', 'git push -u origin t/T-1']) expect(unpushed[0], r.out).toContain(part);
  expect(r.lines.some((l) => l.startsWith('fact: claim-unpushed:')), r.out).toBe(false);
  expect(has(c.root, 'refs/heads/t/ZZ-9')).toBe(true);
  expect(has(c.root, 'refs/heads/t/T-1')).toBe(true);
});

it("risk:complex-branching a pushed claim branch and a team-mate's orphan on origin are judged from the refs in the clone (D-06)", async () => {
  const c = copy({ tickets: ['T-1'] });
  const other = c.otherClone();
  gitRun(other, 'switch', '-q', '-c', 't/YY-1');
  gitRun(other, 'config', 'user.email', 'mate@x.io');
  commitMsg(other, 'claim: YY-1', undefined, true);
  gitRun(other, 'push', '-q', 'origin', 't/YY-1');
  c.git('fetch', '-q', 'origin');
  c.git('switch', '-q', '-c', 't/T-1');
  commitMsg(c.root, 'claim: T-1', ago(20), true);
  c.git('push', '-q', '-u', 'origin', 't/T-1');
  c.git('switch', '-q', 'main');
  const r = await audit(c.root);
  expect(r.code, r.out).toBe(0);
  const orphan = gapsOf(r.lines, 'branch-orphan');
  expect(orphan, r.out).toHaveLength(1);
  for (const part of ['t/YY-1 (origin)', 'tip by mate@x.io', 'git push origin --delete t/YY-1']) expect(orphan[0], r.out).toContain(part);
  expect(gapsOf(r.lines, 'claim-unpushed'), r.out).toEqual([]);
  expect(has(c.remote, 'refs/heads/t/YY-1')).toBe(true);
});

it('risk:complex-branching with no origin remote claim-unpushed says no observation (D-03)', async () => {
  const repo = idleRepo();
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  expect(r.lines, r.out).toContain('fact: claim-unpushed: no observation (no origin remote)');
  expect(r.lines, r.out).toContain('fact: worktree-refs: no observation (no default branch in this clone)');
  expect(gapsOf(r.lines, 'claim-unpushed'), r.out).toEqual([]);
  expect(gapsOf(r.lines, 'worktree-leftover'), r.out).toEqual([]);
});

it("risk:data-loss accord audit with a done ticket's worktree writes nothing and fetches nothing (8.2-ac-8)", async () => {
  const c = doneWorktree();
  const before = listings(c.root);
  const dir = resolve(c.root, c.git('rev-parse', '--git-common-dir').trim(), 'accord');
  let locked = false;
  spawnLog.after = () => {
    if (existsSync(dir + '/clean.lock') || existsSync(dir + '/holds.lock')) locked = true;
  };
  spawnLog.calls = [];
  spawnLog.on = true;
  const r = await audit(c.root);
  spawnLog.on = false;
  expect(r.code, r.out).toBe(0);
  expect(gapsOf(r.lines, 'worktree-leftover'), r.out).toHaveLength(3);
  expect(listings(c.root)).toEqual(before);
  expect(locked).toBe(false);
  expect(existsSync(dir + '/clean.lock') || existsSync(dir + '/holds.lock')).toBe(false);
  expect(spawnLog.calls.length).toBeGreaterThan(0);
  expect(spawnLog.calls.filter((a) => writes(a)).map((a) => a.join(' '))).toEqual([]);
});
