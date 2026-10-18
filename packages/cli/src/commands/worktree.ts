// ST-LN-7 `accord worktree`: each ticket works in its own git worktree, a sibling folder of the main checkout.
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { DEFAULT_BRANCH_TEMPLATE, loadConfig } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { gitDefaultRef, ticketOfBranch, UsageError } from '../load/fs.js';
import { claudeEnv, describeSession, isLive, processTable, runSetup, sameSession, sessionIn } from '../load/proc.js';
import type { Session } from '../load/proc.js';
import type { CommandContext } from '../run.js';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface WorktreeEntry {
  path: string;
  head: string;
  branch?: string;
}

export function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new UsageError('git ' + args.join(' ') + ' failed\n' + String((err as { stderr?: string }).stderr ?? '').trim());
  }
}

export function gitOk(cwd: string, args: string[]): boolean {
  try {
    execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/** The ticket's branch: the claim branch git already shows, else the template, as `accord status` prints it. */
export function branchOf(snapshot: RepoSnapshot, id: string): string {
  return snapshot.claimBranches !== undefined && Object.hasOwn(snapshot.claimBranches, id)
    ? snapshot.claimBranches[id]
    : (snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE).replace('{id}', id);
}

export interface PrunableEntry extends WorktreeEntry {
  prunable?: string;
}

function listWorktrees(root: string): PrunableEntry[] {
  return git(root, ['worktree', 'list', '--porcelain'])
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const entry: PrunableEntry = { path: '', head: '' };
      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) entry.path = line.slice(9);
        else if (line.startsWith('HEAD ')) entry.head = line.slice(5);
        else if (line.startsWith('branch refs/heads/')) entry.branch = line.slice(18);
        else if (line === 'prunable' || line.startsWith('prunable ')) entry.prunable = line.slice(9) || 'no reason given';
      }
      return entry;
    });
}

/** `git worktree list --porcelain` in git's order (the first is the main worktree), after pruning records of folders deleted by hand, each named on `out`. */
export function worktrees(root: string, out: NodeJS.WritableStream): WorktreeEntry[] {
  let list = listWorktrees(root);
  const stale = list.filter((w) => w.prunable !== undefined);
  if (stale.length === 0) return list;
  git(root, ['worktree', 'prune']);
  list = listWorktrees(root);
  for (const w of stale) if (!list.some((x) => x.path === w.path)) out.write(`pruned ${w.path}: ${w.prunable}\n`);
  return list.filter((w) => w.prunable === undefined);
}

/** D-06: the main checkout's folder name, a hyphen, the id in lower case, beside the main checkout. */
export function siblingOf(mainPath: string, id: string): string {
  const cut = mainPath.lastIndexOf('/');
  return mainPath.slice(0, cut + 1) + mainPath.slice(cut + 1) + '-' + id.toLowerCase();
}

/** D-07: run the worktree's own `setup`; a failing command keeps the worktree and exits 2. */
export function prepare(path: string): void {
  let text = '';
  try {
    text = readFileSync(path + '/accord/config.yml', 'utf8');
  } catch {
    // no config: nothing to run
  }
  const failed = runSetup(loadConfig('accord/config.yml', text).config?.setup ?? [], path).failed;
  if (failed !== undefined) {
    throw new UsageError(
      `setup command failed in the new worktree: ${failed.command} (exit ${failed.code})\n${failed.tail}\nthe worktree is kept; fix the command, then continue the ticket again`,
    );
  }
  writeFileSync(setupMarker(path), '');
}

/** D-15: the file in the worktree's own git dir that says `setup` finished there. */
function setupMarker(path: string): string {
  return git(path, ['rev-parse', '--path-format=absolute', '--git-dir']).trim() + '/accord-setup-done';
}

interface Hold extends Session {
  taken: string;
}

/** D-14: run `fn` on the holds file under an exclusive lock; `fn` returns the new object or undefined for no write. */
export function withHolds(root: string, fn: (holds: Record<string, Hold>) => Record<string, Hold> | undefined): void {
  const dir = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord';
  const file = dir + '/holds';
  const lock = file + '.lock';
  mkdirSync(dir, { recursive: true });
  const stop = Date.now() + 2000;
  let fd: number | undefined;
  while (fd === undefined) {
    try {
      fd = openSync(lock, 'wx');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (Date.now() > stop) {
        throw new UsageError('the hold file is locked by another accord command: ' + lock + ' - if none is running, delete that file');
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    let holds: Record<string, Hold> = {};
    if (existsSync(file)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        parsed = undefined;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new UsageError(file + ' is not a JSON object - fix or delete it; accord does not rewrite it');
      }
      holds = parsed as Record<string, Hold>;
    }
    const next = fn(holds);
    if (next !== undefined) {
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
      renameSync(tmp, file);
    }
  } finally {
    closeSync(fd);
    rmSync(lock, { force: true });
  }
}

const norm = (p: string) => (process.platform === 'win32' ? p.replaceAll('\\', '/').toLowerCase() : p);

/** Inside the ticket's worktree: take the hold (Claude Code only, D-17), then make sure `setup` finished. */
function hold(ctx: CommandContext, id: string, path: string): number {
  const claude = claudeEnv(ctx.env);
  if (claude === undefined) {
    if (!existsSync(setupMarker(path))) prepare(path);
    ctx.stdout.write(`not held: ${id} - a second session in this worktree is not refused in this tool yet\n`);
    return 0;
  }
  const table = processTable();
  const session = sessionIn(claude, table, process.pid);
  withHolds(path, (holds) => {
    const h = Object.hasOwn(holds, id) ? holds[id] : undefined;
    if (h !== undefined && !sameSession(h, session) && isLive(h, table)) {
      throw new UsageError(`${id} is held by another session: ${describeSession(h)} since ${h.taken} - work it there, or close that session first`);
    }
    const same = h !== undefined && sameSession(h, session);
    return { ...holds, [id]: { ...session, taken: same ? h.taken : new Date().toISOString() } };
  });
  if (!existsSync(setupMarker(path))) prepare(path);
  ctx.stdout.write(`held: ${id} by this session\n`);
  return 0;
}

/** D-11, D-12: exactly three lines, naming no tool. */
export function printStop(ctx: CommandContext, path: string, id: string): void {
  ctx.stdout.write(`stop: open a session in this folder and type the line below it\n${path}\n/accord continue ${id}\n`);
}

export function worktreeOpen(ctx: CommandContext, id: string, opts: { continue?: boolean } = {}): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const branch = branchOf(ctx.snapshot, id);
  const list = worktrees(ctx.root, ctx.stdout);
  const mainPath = list[0].path;
  // D-15: a worktree already holding the branch is only found, nothing runs there.
  const held = list.find((w) => w.branch === branch);
  if (held !== undefined) {
    if (norm(held.path) === norm(ctx.root)) return hold(ctx, id, held.path);
    printStop(ctx, held.path, id);
    return 0;
  }
  const local = gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]);
  const remote = gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + branch]);
  if (local || remote) {
    const path = siblingOf(mainPath, id);
    git(ctx.root, local ? ['worktree', 'add', path, branch] : ['worktree', 'add', '--track', '-b', branch, path, 'origin/' + branch]);
    prepare(path);
    printStop(ctx, path, id);
    return 0;
  }
  const isTicket = Object.hasOwn(ctx.snapshot.tickets, id);
  if (opts.continue === true) {
    throw new UsageError(
      isTicket
        ? `not claimed: ${id} has no branch ${branch} here or on origin - nothing was created; pick it up first`
        : `not a ticket: ${id} is not in accord/tickets and has no branch ${branch} here or on origin - nothing was created`,
    );
  }
  if (!isTicket) throw new UsageError('no ticket ' + id + ' in accord/tickets - nothing was created');
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again');
  if (!gitOk(ctx.root, ['cat-file', '-e', `${ref}:accord/tickets/${id}.md`])) {
    throw new UsageError(
      `${id} is not on ${ref.replace('refs/remotes/', '')} - merge accord/tickets/${id}.md into the main branch, run git fetch origin, then try again; nothing was created`,
    );
  }
  const path = siblingOf(mainPath, id);
  git(ctx.root, ['worktree', 'add', '--no-track', '-b', branch, path, ref]);
  git(path, ['commit', '--allow-empty', '-q', '-m', 'claim: ' + id]);
  prepare(path);
  printStop(ctx, path, id);
  return 0;
}

const firstLine = (e: unknown) => String((e as { stderr?: string }).stderr ?? e).trim().split('\n')[0];

/** D-05, D-16: fetch, then remove each merged ticket worktree with plain `git worktree remove`, naming what is removed or kept. */
export function worktreeClean(ctx: CommandContext): number {
  const list = worktrees(ctx.root, ctx.stdout);
  const templates = ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE];
  const cands = list.slice(1).flatMap((w) => {
    const id = w.branch === undefined ? undefined : ticketOfBranch(w.branch, templates, (i) => Object.hasOwn(ctx.snapshot.tickets, i));
    return id === undefined ? [] : [{ w, id }];
  });
  if (cands.length === 0 || !gitOk(ctx.root, ['remote', 'get-url', 'origin'])) return 0;
  try {
    execFileSync('git', ['-c', 'credential.interactive=never', '-c', 'core.sshCommand=ssh -o BatchMode=yes', 'fetch', 'origin'], {
      cwd: ctx.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch (e) {
    ctx.stdout.write(`fetch from origin failed, judging against the refs already in this clone: ${firstLine(e)}
`);
  }
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) return 0;
  let holds: Record<string, Hold> | undefined;
  let table: ReturnType<typeof processTable> | undefined;
  for (const { w, id } of cands) {
    if (!gitOk(ctx.root, ['merge-base', '--is-ancestor', w.head, ref])) continue;
    if (norm(w.path) === norm(ctx.root)) {
      ctx.stdout.write(`kept ${w.path}: this session's worktree
`);
      continue;
    }
    if (git(w.path, ['status', '--porcelain', '--untracked-files=normal', '--ignore-submodules=none']).trim() !== '') {
      ctx.stdout.write(`kept ${w.path}: uncommitted work
`);
      continue;
    }
    if (holds === undefined) withHolds(ctx.root, (h) => ((holds = h), undefined));
    const h = holds !== undefined && Object.hasOwn(holds, id) ? holds[id] : undefined;
    if (h !== undefined) {
      let mine: Session | undefined;
      try {
        table ??= processTable();
        const claude = claudeEnv(ctx.env);
        if (claude !== undefined) mine = sessionIn(claude, table, process.pid);
      } catch {
        ctx.stdout.write(`kept ${w.path}: cannot tell whether the session holding it still runs
`);
        continue;
      }
      if (isLive(h, table) && !(mine !== undefined && sameSession(h, mine))) {
        ctx.stdout.write(`kept ${w.path}: held by another session
`);
        continue;
      }
    }
    let failure: string | undefined;
    try {
      execFileSync('git', ['worktree', 'remove', w.path], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      failure = firstLine(e);
    }
    const gone = failure === undefined || !worktrees(ctx.root, ctx.stdout).some((x) => x.path === w.path);
    if (failure === undefined) ctx.stdout.write(`removed ${w.path}
`);
    else if (gone) ctx.stdout.write(`removed ${w.path} in part: git worktree remove failed: ${failure} - delete what is left of the folder by hand
`);
    else ctx.stdout.write(`kept ${w.path}: git worktree remove failed: ${failure}
`);
    if (gone && h !== undefined) withHolds(ctx.root, (all) => (Object.hasOwn(all, id) ? Object.fromEntries(Object.entries(all).filter(([k]) => k !== id)) : undefined));
  }
  return 0;
}

/** D-13: write the new ticket in its own worktree on its claim branch, commit and push it, then run setup there. */
export function newTicketWorktree(ctx: CommandContext, id: string, rel: string, text: string): void {
  const branch = branchOf(ctx.snapshot, id);
  const list = worktrees(ctx.root, ctx.stdout);
  const exists =
    list.some((w) => w.branch === branch) ||
    gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]) ||
    gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + branch]);
  if (exists) throw new UsageError(`${branch} already exists - nothing was written`);
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again');
  const path = siblingOf(list[0].path, id);
  git(ctx.root, ['worktree', 'add', '--no-track', '-b', branch, path, ref]);
  mkdirSync(path + '/accord/tickets', { recursive: true });
  writeFileSync(path + '/' + rel, text);
  git(path, ['add', '--', rel]);
  git(path, ['commit', '-q', '-m', 'claim: ' + id]);
  try {
    execFileSync('git', ['-c', 'credential.interactive=never', '-c', 'core.sshCommand=ssh -o BatchMode=yes', 'push', '-u', 'origin', branch], {
      cwd: path,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch (e) {
    throw new UsageError(`the ticket is committed in ${path} but the push failed: ${firstLine(e)} - push it with git -C "${path}" push -u origin ${branch}`);
  }
  prepare(path);
  ctx.stdout.write(rel + '\n');
  printStop(ctx, path, id);
}
