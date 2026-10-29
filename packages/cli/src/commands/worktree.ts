// ST-LN-7 `accord worktree`: each ticket works in its own git worktree, a sibling folder of the main checkout.
import { execFileSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { DEFAULT_BRANCH_TEMPLATE, forbiddenLines, isSha, loadConfig, loadSnapshot, statusRows, trailerReason } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { currentBranch, droppedOn, gitDefaultRef, gitUnpushedCommits, gitUserEmail, loadFromFs, snapshotAt, ticketOfBranch, UsageError } from '../load/fs.js';
import { fetchLimitMs } from './fetch-limit.js';
import { claudeEnv, describeSession, isLive, processTable, runSetup, sameSession, sessionIn } from '../load/proc.js';
import type { Session } from '../load/proc.js';
import type { CommandContext } from '../run.js';
import { repoRoot } from '../root.js';
import pkg from '../../package.json' with { type: 'json' };

export const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface WorktreeEntry {
  path: string;
  head: string;
  branch?: string;
}

export function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
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

export function listWorktrees(root: string): PrunableEntry[] {
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
  let text: string | undefined;
  try {
    text = readFileSync(path + '/accord/config.yml', 'utf8');
  } catch {
    // no config: nothing to run
  }
  let setup: string[] = [];
  if (text !== undefined) {
    const loaded = loadConfig('accord/config.yml', text);
    if (loaded.config === undefined) {
      throw new UsageError(
        `accord/config.yml in the new worktree is invalid, so setup did not run: ${loaded.findings[0]?.reason ?? 'unreadable'}\nthe worktree is kept; fix the file, then continue the ticket again`,
      );
    }
    setup = loaded.config.setup ?? [];
  }
  const failed = runSetup(setup, path).failed;
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
  folder?: string;
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

/** The holds file read without the lock (writes are a rename), so the works rule writes nothing. */
export function readHoldsFile(root: string): Record<string, Hold> {
  const file = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord/holds';
  if (!existsSync(file)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    parsed = undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UsageError(file + ' is not a JSON object - fix or delete it; accord does not rewrite it');
  }
  return parsed as Record<string, Hold>;
}

/** The worked record: one `<id>\t<marker>` line per ticket a session took a hold on or started in; never rewritten. */
export function recordWorked(root: string, id: string, marker: string): void {
  const dir = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord';
  const file = dir + '/worked';
  mkdirSync(dir, { recursive: true });
  const line = `${id}\t${marker}`;
  if (!(existsSync(file) ? readFileSync(file, 'utf8') : '').split('\n').includes(line)) appendFileSync(file, line + '\n');
}

/** The first ticket the record names for this marker; reads without a lock and writes nothing. */
export function workedBy(root: string, marker: string): string | undefined {
  const file = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/accord/worked';
  if (!existsSync(file)) return undefined;
  for (const l of readFileSync(file, 'utf8').split('\n')) {
    const t = l.indexOf('\t');
    if (t > 0 && l.slice(t + 1) === marker) return l.slice(0, t);
  }
  return undefined;
}

const norm = (p: string) => (process.platform === 'win32' ? p.replaceAll('\\', '/').toLowerCase() : p);

/** D-17: take (or keep) this session's hold on `id`; a live other session holding it refuses. Claude Code sessions only. */
export function takeHold(ctx: CommandContext, id: string, path: string): void {
  const claude = claudeEnv(ctx.env)!;
  const table = processTable();
  const session = sessionIn(claude, table, process.pid);
  withHolds(ctx.root, (holds) => {
    const h = Object.hasOwn(holds, id) ? holds[id] : undefined;
    if (h !== undefined && !sameSession(h, session) && isLive(h, table)) {
      throw new UsageError(`${id} is held by another session: ${describeSession(h)} - work it there, or close that session first`);
    }
    const same = h !== undefined && sameSession(h, session);
    const here = (isLinked(ctx.root) ? ctx.root : path).replaceAll('\\', '/');
    return { ...holds, [id]: { ...session, taken: same ? h.taken : new Date().toISOString(), folder: same ? (h.folder ?? here) : here } };
  });
  recordWorked(ctx.root, id, session.marker);
}

/** BUG-LN-14 D-02, D-06: drop the holds the claude process `session` took, except the one `marker` holds; the hold of `stay` moves to `marker`. */
export function releaseHolds(root: string, session: { pid: number; start: string }, marker: string, stay: string | undefined): void {
  withHolds(root, (holds) => {
    let changed = false;
    const next: Record<string, Hold> = {};
    for (const [id, h] of Object.entries(holds)) {
      if (h.pid !== session.pid || h.start !== session.start || h.marker === marker) next[id] = h;
      else if (id === stay) {
        next[id] = { ...h, marker };
        changed = true;
      } else changed = true;
    }
    return changed ? next : undefined;
  });
}

/** Inside the ticket's worktree: take the hold (Claude Code only, D-17), then make sure `setup` finished. */
function hold(ctx: CommandContext, id: string, path: string): number {
  if (claudeEnv(ctx.env) === undefined) {
    if (!existsSync(setupMarker(path))) prepare(path);
    ctx.stdout.write(`not held: ${id} - a second session in this worktree is not refused in this tool yet
`);
    return 0;
  }
  takeHold(ctx, id, path);
  if (!existsSync(setupMarker(path))) prepare(path);
  ctx.stdout.write(`held: ${id} by this session
`);
  return 0;
}

export function isLinked(root: string): boolean {
  return norm(git(root, ['rev-parse', '--path-format=absolute', '--git-dir']).trim()) !== norm(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
}

/** A Claude Code session in the main checkout can move into the worktree; a session missing its variables gets the stop lines. */
export function canEnter(ctx: CommandContext): boolean {
  let c;
  try {
    c = claudeEnv(ctx.env);
  } catch {
    return false;
  }
  return c !== undefined && !isLinked(ctx.root);
}

/** The session runs the launch folder's accord, so a worktree pinned to another version must be fixed before the session moves. */
export function checkPin(ctx: CommandContext, id: string, path: string, branch: string, mainPath: string): void {
  const file = path + '/accord/config.yml';
  if (!existsSync(file)) return;
  const pinned = loadConfig('accord/config.yml', readFileSync(file, 'utf8')).config?.accord;
  if (pinned === undefined || pinned === pkg.version) return;
  const ref = gitDefaultRef(ctx.root);
  const def = ref === undefined ? 'the default branch' : ref.replace('refs/remotes/', '');
  let defPin: string | undefined;
  if (ref !== undefined && gitOk(ctx.root, ['cat-file', '-e', `${ref}:accord/config.yml`])) {
    defPin = loadConfig('accord/config.yml', git(ctx.root, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${ref}:accord/config.yml`])).config?.accord;
  }
  throw new UsageError(
    defPin === pinned
      ? `${file} pins accord ${pinned} as ${def} does, but the main checkout ${mainPath} runs ${pkg.version} - update the main checkout to ${def} (git pull there), then type /accord continue ${id}; this session did not move`
      : `${file} pins accord ${pinned}, running ${pkg.version} - merge ${def} into ${branch}, then type /accord continue ${id}; this session did not move`,
  );
}

export function enterOrStop(ctx: CommandContext, id: string, path: string, branch: string, enter: boolean): void {
  if (!enter) return printStop(ctx, path, id);
  takeHold(ctx, id, path);
  if (!existsSync(setupMarker(path))) prepare(path);
  ctx.stdout.write(`enter: ${path}
`);
}

/** D-11, D-12: exactly three lines, naming no tool. */
export function printStop(ctx: CommandContext, path: string, id: string): void {
  ctx.stdout.write(`stop: open a session in this folder and type the line below it\n${path}\n/accord continue ${id}\n`);
}

/** Pick up reuses an existing branch only when its claim is the user's own (same email); otherwise exit 2, nothing created. */
function checkClaimant(ctx: CommandContext, id: string, ref: string): void {
  const def = gitDefaultRef(ctx.root);
  const log = git(ctx.root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--fixed-strings', '--grep=claim: ' + id, '--format=%ae%x00%s', ref, ...(def === undefined ? [] : ['--not', def])]);
  let claimant: string | undefined;
  for (const line of log.split('\n')) {
    const [email, subject] = line.split('\0');
    if (subject === 'claim: ' + id) {
      claimant = email;
      break;
    }
  }
  const claims = ctx.snapshot.claims;
  claimant ??= claims !== undefined && Object.hasOwn(claims, id) ? claims[id] : undefined;
  if (claimant === undefined) return;
  const me = gitUserEmail(ctx.root);
  if (me === '') throw new UsageError('git user.email is not set - set it with git config user.email <you@example.com>');
  if (claimant.trim().toLowerCase() !== me.trim().toLowerCase()) {
    throw new UsageError(`claimed: ${id} by ${claimant} - nothing was created; to work on it with them, type /accord continue ${id}`);
  }
}

/** D-04: the Claude Code session, or undefined for another runtime; never throws. */
export function inClaude(env: NodeJS.ProcessEnv): { marker: string | undefined } | undefined {
  try {
    const c = claudeEnv(env);
    return c === undefined ? undefined : { marker: c.marker };
  } catch {
    return { marker: env.CLAUDE_CODE_SESSION_ID || undefined };
  }
}

export type Works = { id: string | undefined; top: string };

/** D-04: the ticket this session works: its linked worktree's branch, else a hold carrying its marker. */
export function worksTicket(cwd: string, marker: string | undefined, snapshot: RepoSnapshot): Works | undefined {
  const top = repoRoot(cwd);
  if (isLinked(top)) {
    const b = currentBranch(top);
    if (b === undefined || b === '') return { id: undefined, top };
    const id = ticketOfBranch(b, snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (i) => Object.hasOwn(snapshot.tickets, i));
    if (id !== undefined) return { id, top };
  }
  if (marker !== undefined) {
    const holds = readHoldsFile(top);
    const key = Object.keys(holds).sort().find((k) => holds[k]?.marker === marker);
    if (key !== undefined) return { id: key, top };
    const id = workedBy(top, marker);
    if (id !== undefined) return { id, top };
  }
  return undefined;
}

export function worksMessage(w: Works, mainPath: string): string {
  return w.id === undefined
    ? `this session works the ticket worktree ${w.top}, whose branch cannot be read: open a new session in the main checkout ${mainPath} for other work, or type a request about that ticket without "/accord" - nothing was changed`
    : `this session works ${w.id}: open a new session in the main checkout ${mainPath} for other work, or type a request about ${w.id} without "/accord" - nothing was changed`;
}

/** The continue a session that works `w` may run: its own ticket, or, with no readable branch, the ticket whose sibling folder it is in. */
export function guardAllowsContinue(w: Works, mainPath: string, cont: string): boolean {
  return w.id === cont || (w.id === undefined && norm(siblingOf(mainPath, cont)) === norm(w.top));
}

/** D-02, D-06, D-09: a Claude Code session that works a ticket is refused any other; `cont` names the ticket a continue asks for. */
export function guardTicketSession(ctx: CommandContext, cont?: string): void {
  const s = inClaude(ctx.env);
  if (s === undefined) return;
  const w = worksTicket(ctx.root, s.marker, ctx.snapshot);
  if (w === undefined) return;
  const mainPath = listWorktrees(ctx.root)[0].path;
  if (cont !== undefined && guardAllowsContinue(w, mainPath, cont)) return;
  throw new UsageError(worksMessage(w, mainPath));
}

export function worktreeCheck(ctx: CommandContext): number {
  guardTicketSession(ctx);
  return 0;
}

export function worktreeOpen(ctx: CommandContext, id: string, opts: { continue?: boolean } = {}): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  guardTicketSession(ctx, opts.continue === true ? id : undefined);
  const f = fetchOrigin(ctx);
  ctx = f.ctx;
  cleanQuietly(ctx, f.fetched, id);
  const enter = canEnter(ctx);
  const pick = opts.continue !== true;
  const branch = branchOf(ctx.snapshot, id);
  const list = worktrees(ctx.root, ctx.stdout);
  const mainPath = list[0].path;
  const held = list.find((w) => w.branch === branch);
  const local = held !== undefined || gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]);
  const remote = gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + branch]);
  if (opts.continue !== true) {
    const def = gitDefaultRef(ctx.root);
    if (def !== undefined && droppedOn(ctx.root, def, [id]).has(id)) {
      throw new UsageError(`${id} is dropped on ${def.replace('refs/remotes/origin/', '')} - make a new ticket instead (the drop reason is in accord/tickets/${id}.md there); nothing was created`);
    }
    // judge every ref that exists: the dashboard credits the pushed claim too
    if (local) checkClaimant(ctx, id, 'refs/heads/' + branch);
    if (remote) checkClaimant(ctx, id, 'refs/remotes/origin/' + branch);
  }
  // D-15: a worktree already holding the branch is only found, nothing runs there (Continue merges and sets up, ST-LN-25).
  if (held !== undefined) {
    if (opts.continue === true) continueMerge(ctx, id, held.path, branch);
    if (norm(held.path) === norm(ctx.root)) return hold(ctx, id, held.path);
    if (enter) checkPin(ctx, id, held.path, branch, mainPath);
    enterOrStop(ctx, id, held.path, branch, enter);
    return 0;
  }
  if (local || remote) {
    const path = siblingOf(mainPath, id);
    git(ctx.root, local ? ['worktree', 'add', path, branch] : ['worktree', 'add', '--track', '-b', branch, path, 'origin/' + branch]);
    if (opts.continue === true) continueMerge(ctx, id, path, branch);
    if (enter) {
      if (pick) takeHold(ctx, id, path);
      checkPin(ctx, id, path, branch, mainPath);
    } else if (!existsSync(setupMarker(path))) prepare(path);
    enterOrStop(ctx, id, path, branch, enter);
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
  if (enter) {
    takeHold(ctx, id, path);
    checkPin(ctx, id, path, branch, mainPath);
  } else prepare(path);
  enterOrStop(ctx, id, path, branch, enter);
  return 0;
}

/** The first word of a shell command line, quotes removed. */
const firstWord = (cmd: string) => (/^\s*(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(cmd) ?? []).slice(1).find((w) => w !== undefined) ?? '';

/**
 * Run a network git command with prompts off. ssh gets BatchMode only when it is OpenSSH: git reads core.sshCommand before GIT_SSH, and
 * GIT_SSH_COMMAND before both, so the user's own program is never replaced and a non-OpenSSH command is passed through unchanged.
 */
export function gitNoPrompt(cwd: string, args: string[], timeout?: number): string {
  let configured = '';
  try {
    configured = execFileSync('git', ['config', '--get', 'core.sshCommand'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // not set
  }
  const fromEnv = (process.env.GIT_SSH_COMMAND ?? '') !== '';
  const cmd = fromEnv ? process.env.GIT_SSH_COMMAND! : configured;
  const base = firstWord(cmd).split(/[\\/]/).pop()!.toLowerCase();
  let ssh: string | undefined; // the core.sshCommand to inject
  if (cmd !== '') ssh = base === 'ssh' || base === 'ssh.exe' ? cmd + ' -o BatchMode=yes' : undefined;
  else if ((process.env.GIT_SSH ?? '') === '') ssh = 'ssh -o BatchMode=yes';
  return execFileSync('git', ['-c', 'credential.interactive=never', ...(ssh === undefined ? [] : ['-c', 'core.sshCommand=' + ssh]), ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(timeout === undefined ? {} : { timeout }),
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(ssh !== undefined && fromEnv ? { GIT_SSH_COMMAND: undefined } : {}) },
  });
}

const firstLine = (e: unknown) => String((e as { stderr?: string }).stderr ?? e).trim().split('\n')[0];

/** ST-LN-30 D-01, D-06: fetch origin so a branch is cut and a claim judged from the latest refs; a failed fetch prints one line and the work goes on. */
export function fetchOrigin(ctx: CommandContext): { ctx: CommandContext; fetched: 'ok' | 'failed' | 'none' } {
  if (!gitOk(ctx.root, ['remote', 'get-url', 'origin'])) return { ctx, fetched: 'none' };
  const ms = fetchLimitMs();
  try {
    gitNoPrompt(ctx.root, ['fetch', '--no-prune', 'origin'], ms);
  } catch (e) {
    const why = (e as NodeJS.ErrnoException).code === 'ETIMEDOUT' ? `no answer within ${ms / 1000} seconds` : firstLine(e);
    ctx.stdout.write(`fetch from origin failed, going on with the refs already in this clone: ${why}\n`);
    return { ctx, fetched: 'failed' };
  }
  return { ctx: { ...ctx, snapshot: loadSnapshot(loadFromFs(ctx.root)) }, fetched: 'ok' };
}

/** The merge of `ref` into the branch checked out in `root`, always `--no-ff`: a refused or conflicting merge is aborted, named, and leaves the branch as it was. */
export function mergeDefault(root: string, ref: string, branch: string, again: { conflict: string; clash: string }): void {
  const def = ref.replace('refs/remotes/', '');
  // git 2.56 ort ignores --no-overwrite-ignore: refuse by hand when the merge adds a path that is an untracked (ignored) file here
  const mine = git(root, ['diff', '--name-only', '--no-renames', '--diff-filter=A', '-z', 'HEAD', ref]).split('\0').filter((l) => l !== '');
  // git itself says which of those paths are untracked here, so a tracked file under another case is no clash; the pathspecs keep it from walking node_modules
  const here = mine.filter((f) => existsSync(root + '/' + f)); // keeps the command line short: a big merged PR adds hundreds of paths, none normally on disk
  const clash = here.length === 0 ? undefined : git(root, ['ls-files', '--others', '-z', '--', ...here.map((f) => ':(literal)' + f)]).split('\0').find((l) => l !== '');
  if (clash !== undefined) {
    throw new UsageError(`merge of ${def} into ${branch} failed: ${clash} is an ignored file here that the merge would overwrite - ${again.clash} - ${branch} is as it was`);
  }
  try {
    // the full ref: a short origin/main would resolve to a local branch or tag of that name first
    execFileSync('git', ['merge', '--no-ff', '--no-edit', '--no-overwrite-ignore', ref], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const files = git(root, ['diff', '--name-only', '-z', '--diff-filter=U']).split('\0').filter((l) => l !== '');
    if (gitOk(root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) git(root, ['merge', '--abort']);
    if (files.length > 0) {
      throw new UsageError(`merge of ${def} into ${branch} stopped on a conflict in ${files.join(', ')} - the merge was aborted and ${branch} is as it was; ${again.conflict}`);
    }
    throw new UsageError(`merge of ${def} into ${branch} failed: ${firstLine(e)} - ${branch} is as it was`);
  }
}

/** ST-LN-25 D-01, D-09: Continue merges the fetched default branch into a ticket branch that is behind and still before verify, then runs setup and pushes; any doubt leaves the branch alone and prints the behind line. */
function continueMerge(ctx: CommandContext, id: string, path: string, branch: string): void {
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) return;
  const n = Number(git(path, ['rev-list', '--count', 'HEAD..' + ref]).trim());
  if (n === 0) return;
  const def = ref.replace('refs/remotes/', '');
  const behind = (): void => void ctx.stdout.write(`behind: ${branch} is ${n} commit${n === 1 ? '' : 's'} behind ${def}; merge them with git merge ${def}\n`);
  // a remote branch with commits this clone lacks (a teammate pushed): the stage here may be stale, and the push would be refused
  const own = 'refs/remotes/origin/' + branch;
  if (gitOk(path, ['rev-parse', '-q', '--verify', own]) && !gitOk(path, ['merge-base', '--is-ancestor', own, 'HEAD'])) return behind();
  const stage = statusRows(snapshotAt(ctx.root, 'refs/heads/' + branch, [id])).find((r) => r.id === id)?.stage;
  if (stage === undefined || !['intent', 'plan', 'build', 'review'].includes(stage)) return behind();
  if (git(path, ['status', '--porcelain', '--untracked-files=no']).trim() !== '' || gitOk(path, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) return behind();
  try {
    if (claudeEnv(ctx.env) !== undefined) takeHold(ctx, id, path);
    else {
      const holds = readHoldsFile(ctx.root);
      const h = Object.hasOwn(holds, id) ? holds[id] : undefined;
      if (h !== undefined && isLive(h, processTable())) return behind();
    }
  } catch {
    return behind();
  }
  mergeDefault(path, ref, branch, {
    conflict: `merge it by hand with git -C "${path}" merge ${def}, resolve the conflict and commit, then type /accord continue ${id}`,
    clash: `move it, then type /accord continue ${id}`,
  });
  ctx.stdout.write(`merged: ${n} commit${n === 1 ? '' : 's'} of ${def} into ${branch}\n`);
  // the marker of the pre-merge setup never stands for the merge commit
  rmSync(setupMarker(path), { force: true });
  let failure: unknown;
  try {
    prepare(path);
  } catch (e) {
    failure = e;
  }
  try {
    gitNoPrompt(path, ['push', 'origin', 'HEAD:refs/heads/' + branch]);
  } catch (e) {
    ctx.stdout.write(`push of ${branch} failed: ${firstLine(e)} - push it with git -C "${path}" push origin ${branch}\n`);
  }
  if (failure !== undefined) throw failure;
}

/** BUG-LN-11: push the ticket's claim branch by its ref, so it works from any worktree; a failed push is named with git's message and exits 0. */
export function worktreePush(ctx: CommandContext, id: string, o: { lease?: boolean } = {}): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const branch = branchOf(ctx.snapshot, id);
  const kept = (why: string): number => {
    ctx.stdout.write(`push of ${branch} failed; its commits stay local until the next push\n${why}\n`);
    return 0;
  };
  if (ctx.snapshot.config?.commits?.trailers === 'forbid') {
    // a forbidden line on origin could only be removed by replacing history there, so nothing leaves this clone with one
    try {
      const hits = gitUnpushedCommits(ctx.root, branch).flatMap((c) => forbiddenLines(c.message).map((l) => trailerReason(c.sha, l)));
      if (hits.length > 0) return kept(`${hits.join('\n')}\nreword each commit named above to drop that line (it is not on origin yet), then run accord worktree push ${id} again`);
    } catch (e) {
      return kept(e instanceof UsageError ? e.message : firstLine(e));
    }
  }
  try {
    // after a reworded commit: the lease keeps a push from replacing what origin got since this clone last saw it, and --force-if-includes keeps it from replacing a commit a fetch brought in that this branch never held
    const force = o.lease === true ? ['--force-with-lease', '--force-if-includes'] : [];
    gitNoPrompt(ctx.root, ['push', ...force, 'origin', `refs/heads/${branch}:refs/heads/${branch}`]);
  } catch (e) {
    const why = String((e as { stderr?: string }).stderr ?? '').trim();
    return kept(why === '' ? String(e) : why);
  }
  ctx.stdout.write(`pushed: ${branch}\n`);
  return 0;
}

/** ST-LN-30 D-03, D-04, D-09: fetch, then merge the remote default branch into the ticket branch with a merge commit; a conflict is aborted, named, and exits 2. */
export function worktreeMerge(ctx: CommandContext, id: string): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const branch = branchOf(ctx.snapshot, id);
  // refusals first: a refused merge makes no network call
  const cur = ctx.branch === undefined ? currentBranch(ctx.root) : ctx.branch.name;
  if (cur !== branch) {
    throw new UsageError(`${id} is merged on its branch ${branch}, and this checkout is on ${cur ? cur : 'a detached HEAD'} - run accord worktree merge ${id} in the ticket's worktree; nothing was merged`);
  }
  if (git(ctx.root, ['status', '--porcelain', '--untracked-files=no']).trim() !== '') {
    throw new UsageError(`${ctx.root} has uncommitted changes to tracked files - commit them, then run accord worktree merge ${id} again; nothing was merged`);
  }
  const stage = statusRows(ctx.snapshot).find((r) => r.id === id)?.stage;
  if (stage !== 'verify') {
    throw new UsageError(`${id} is at stage ${stage ?? 'none'}, and accord worktree merge runs only at verify, after review - nothing was merged`);
  }
  if (!gitOk(ctx.root, ['remote', 'get-url', 'origin'])) return 0;
  fetchOrigin(ctx);
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) {
    ctx.stdout.write('no origin/HEAD, origin/main or origin/master in this clone - nothing was merged\n');
    return 0;
  }
  if (gitOk(ctx.root, ['merge-base', '--is-ancestor', ref, 'HEAD'])) return 0;
  mergeDefault(ctx.root, ref, branch, { conflict: 'resolve the conflict, then start verify again', clash: 'move it, then start verify again' });
  // preflight checked the pin before the merge, so this throws only when the merge changed it
  checkPin(ctx, id, ctx.root, branch, listWorktrees(ctx.root)[0].path);
  return 0;
}

/** ST-LN-20 D-05: after a good fetch, prune origin's stale refs (remote-tracking, and tags a fetch refspec maps), naming each with its full sha (it can be the last copy of an unmerged branch). */
function pruneStale(ctx: CommandContext): Map<string, string> {
  const refs = () => git(ctx.root, ['for-each-ref', '--format=%(objectname) %(refname)']).split('\n').filter((r) => r !== '');
  const before = refs();
  try {
    gitNoPrompt(ctx.root, ['remote', 'prune', 'origin']);
  } catch (e) {
    ctx.stdout.write(`prune of origin failed: ${firstLine(e)}
`);
  }
  const left = new Set(refs());
  const pruned = new Map<string, string>();
  for (const r of before) {
    if (left.has(r)) continue;
    const cut = r.indexOf(' ');
    ctx.stdout.write(`pruned ${r.slice(cut + 1)} (was ${r.slice(0, cut)})
`);
    pruned.set(r.slice(cut + 1), r.slice(0, cut));
  }
  return pruned;
}

interface GuardState {
  holds?: Record<string, Hold>;
  holdsError?: string;
  table?: ReturnType<typeof processTable>;
}

/** The guards every worktree removal passes; undefined (after a kept line) when one keeps the worktree, else the hold it may drop. */
function passGuards(ctx: CommandContext, w: WorktreeEntry, id: string, s: GuardState): { h: Hold | undefined } | undefined {
  if (norm(w.path) === norm(ctx.root)) {
    ctx.stdout.write(`kept ${w.path}: this session's worktree
`);
    return undefined;
  }
  if (git(w.path, ['status', '--porcelain', '--untracked-files=normal', '--ignore-submodules=none']).trim() !== '') {
    ctx.stdout.write(`kept ${w.path}: uncommitted work
`);
    return undefined;
  }
  if (s.holds === undefined && s.holdsError === undefined) {
    try {
      withHolds(ctx.root, (h) => ((s.holds = h), undefined));
    } catch (e) {
      s.holdsError = firstLine(e instanceof UsageError ? e.message : e);
    }
  }
  if (s.holds === undefined) {
    ctx.stdout.write(`kept ${w.path}: its hold could not be read: ${s.holdsError}
`);
    return undefined;
  }
  const h = Object.hasOwn(s.holds, id) ? s.holds[id] : undefined;
  if (h !== undefined) {
    let mine: Session | undefined;
    try {
      const claude = claudeEnv(ctx.env);
      if (claude !== undefined && h.marker === claude.marker) {
        ctx.stdout.write(`kept ${w.path}: this session's worktree\n`);
        return undefined;
      }
      s.table ??= processTable();
      if (claude !== undefined) mine = sessionIn(claude, s.table, process.pid);
    } catch {
      ctx.stdout.write(`kept ${w.path}: cannot tell whether the session holding it still runs
`);
      return undefined;
    }
    if (isLive(h, s.table) && !(mine !== undefined && sameSession(h, mine))) {
      ctx.stdout.write(`kept ${w.path}: held by another session
`);
      return undefined;
    }
  }
  return { h };
}

/** `git worktree remove` with its three printed outcomes; the hold goes with a worktree that is gone. `failed` means the folder is still a worktree. */
function removeWorktree(ctx: CommandContext, w: WorktreeEntry, id: string, h: Hold | undefined): { failed: boolean } {
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
  if (gone && h !== undefined) {
    try {
      withHolds(ctx.root, (all) => (Object.hasOwn(all, id) ? Object.fromEntries(Object.entries(all).filter(([k]) => k !== id)) : undefined));
    } catch (e) {
      ctx.stdout.write(`note ${id}: the hold of the removed worktree could not be dropped: ${firstLine(e instanceof UsageError ? e.message : e)}
`);
    }
  }
  return { failed: !gone };
}

/** D-05, D-16: fetch, prune stale remote refs, then (ST-LN-25 D-08) remove the worktree and delete the local branch of each ticket that is done on origin's main, then (ST-LN-34) those of dropped tickets, naming what is removed, deleted or kept. */
export function worktreeClean(ctx: CommandContext, opts: { fetched?: 'ok' | 'failed' | 'none'; skip?: string } = {}): number {
  worktrees(ctx.root, ctx.stdout);
  const templates = ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE];
  if (opts.fetched === 'none' || !gitOk(ctx.root, ['remote', 'get-url', 'origin'])) return 0;
  let pruned = new Map<string, string>();
  let fetchFailed = opts.fetched === 'failed';
  try {
    if (!fetchFailed) {
      if (opts.fetched === undefined) gitNoPrompt(ctx.root, ['fetch', '--no-prune', 'origin']);
      pruned = pruneStale(ctx);
    }
  } catch (e) {
    fetchFailed = true;
    ctx.stdout.write(`fetch from origin failed, judging against the refs already in this clone: ${firstLine(e)}
`);
  }
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) return 0;
  const state: GuardState = {};
  cleanDone(ctx, ref, templates, state, fetchFailed, opts.skip);
  cleanDropped(ctx, ref, templates, state, pruned, fetchFailed, opts.skip);
  return 0;
}

/** D-02: the clean a command runs on the side; a failure is named and never stops that command. */
export function cleanQuietly(ctx: CommandContext, fetched: 'ok' | 'failed' | 'none', skip?: string): void {
  try {
    worktreeClean(ctx, { fetched, skip });
  } catch (e) {
    ctx.stdout.write(`clean failed, nothing more was removed: ${firstLine(e instanceof UsageError ? e.message : e)}\n`);
  }
}

/** The branch a worktree's stopped rebase is rebuilding, or undefined. */
function rebaseBranch(path: string): string | undefined {
  const dir = git(path, ['rev-parse', '--path-format=absolute', '--git-dir']).trim();
  for (const d of ['rebase-merge', 'rebase-apply']) {
    try {
      const h = readFileSync(`${dir}/${d}/head-name`, 'utf8').trim();
      if (h.startsWith('refs/heads/')) return h.slice('refs/heads/'.length);
    } catch {
      // no rebase of this kind
    }
  }
  return undefined;
}

/** ST-LN-25 D-08: is every commit of `tip` either on `ref`, in the verified commit `vc`, or past `vc` touching only paths `ref` leaves alone, or else a branch whose merge into `ref` adds nothing? */
function safeTip(root: string, tip: string, vc: string | undefined, ref: string): 'safe' | 'conflict' | 'unsafe' {
  if (gitOk(root, ['merge-base', '--is-ancestor', tip, ref])) return 'safe';
  if (vc !== undefined) {
    if (gitOk(root, ['merge-base', '--is-ancestor', tip, vc])) return 'safe';
    if (!gitOk(root, ['merge-base', '--is-ancestor', vc, tip])) return 'unsafe';
    const names = (x: string, y: string) => git(root, ['diff', '--name-only', '-z', '--no-renames', x, y, '--']).split('\0').filter((n) => n !== '');
    const onMain = new Set(names(tip, ref));
    if (names(vc, tip).every((n) => !onMain.has(n))) return 'safe';
  }
  // Otherwise (no verified commit, or a later change main may hold): the branch goes only when merging it into main would change nothing; a conflict is never resolved.
  let out: string;
  try {
    out = execFileSync('git', ['merge-tree', '--write-tree', ref, tip], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return (e as { status?: number | null }).status === 1 ? 'conflict' : 'unsafe';
  }
  try {
    return out.split('\n')[0].trim() === git(root, ['rev-parse', ref + '^{tree}']).trim() ? 'safe' : 'unsafe';
  } catch {
    return 'unsafe';
  }
}

/** ST-LN-25 D-08: for each ticket branch whose ticket is done on `ref`, remove the worktree and delete the local branch when nothing beyond main is lost. */
function cleanDone(ctx: CommandContext, ref: string, templates: readonly string[], s: GuardState, fetchFailed: boolean, skip?: string): void {
  const known = (i: string) => Object.hasOwn(ctx.snapshot.tickets, i);
  const def = ref.replace('refs/remotes/', '');
  const tips = new Map<string, string | undefined>();
  const origin = new Map<string, string>();
  for (const row of git(ctx.root, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/remotes/origin']).split('\n')) {
    const cut = row.indexOf(' ');
    if (cut < 0) continue;
    const full = row.slice(cut + 1);
    const local = full.startsWith('refs/heads/');
    const name = full.slice(local ? 'refs/heads/'.length : 'refs/remotes/origin/'.length);
    if (name === 'HEAD' && !local) continue;
    tips.set(name, local ? row.slice(0, cut) : tips.get(name));
    if (!local) origin.set(name, row.slice(0, cut));
  }
  const ids = new Map<string, string>();
  for (const name of tips.keys()) {
    const id = ticketOfBranch(name, templates, known);
    if (id !== undefined && id !== skip) ids.set(name, id);
  }
  if (ids.size === 0) return;
  const snap = snapshotAt(ctx.root, ref, [...new Set(ids.values())]);
  const done = new Set(statusRows(snap).filter((r) => r.stage === 'done' && r.status !== 'dropped').map((r) => r.id));
  const after = worktrees(ctx.root, ctx.stdout);
  for (const b of [...ids.keys()].filter((n) => done.has(ids.get(n)!)).sort()) {
    const id = ids.get(b)!;
    try {
      // A worktree mid-rebase has a detached HEAD; its rebase still owns the branch.
      const rebasing = after.find((x) => x.branch === undefined && rebaseBranch(x.path) === b);
      if (rebasing !== undefined) {
        ctx.stdout.write(`kept ${b}: being rebased in ${rebasing.path}
`);
        continue;
      }
      const W = after.find((x) => x.branch === b);
      if (W !== undefined && W === after[0]) {
        ctx.stdout.write(`kept ${b}: checked out in ${W.path}
`);
        continue;
      }
      const raw = snap.tickets[id]?.frontmatter?.verified_commit;
      const vcArgs = ['rev-parse', '--verify', '-q', String(raw) + '^{commit}'];
      const vc = typeof raw === 'string' && isSha(raw) && gitOk(ctx.root, vcArgs) ? git(ctx.root, vcArgs).trim() : undefined;
      const tipArgs = ['rev-parse', '--verify', '-q', 'refs/heads/' + b];
      const reason = (t: string) => {
        const v = safeTip(ctx.root, t, vc, ref);
        if (v === 'safe') return undefined;
        return v === 'conflict' ? `merging it into ${def} conflicts` : vc !== undefined ? 'it has commits after its verified commit' : `it has changes not on ${def}`;
      };
      let L = gitOk(ctx.root, tipArgs) ? git(ctx.root, tipArgs).trim() : undefined;
      const why = L === undefined ? undefined : reason(L);
      if (why !== undefined) {
        ctx.stdout.write(`kept ${b}: ${why}
`);
        continue;
      }
      if (W !== undefined) {
        const g = passGuards(ctx, W, id, s);
        if (g === undefined || removeWorktree(ctx, W, id, g.h).failed) {
          ctx.stdout.write(`kept ${b}: checked out in ${W.path}
`);
          continue;
        }
      }
      if (L !== undefined) {
        // A commit made while the guards ran counts: the delete names the sha it checked.
        L = git(ctx.root, tipArgs).trim();
        const again = reason(L);
        if (again !== undefined) {
          ctx.stdout.write(`kept ${b}: ${again}
`);
          continue;
        }
        execFileSync('git', ['update-ref', '-d', 'refs/heads/' + b, L], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        ctx.stdout.write(`deleted ${b} (was ${L})
`);
      }
      // The origin branch goes with a lease on the fetched sha; after a failed fetch it is not judged.
      const R = origin.get(b);
      if (R === undefined || fetchFailed) continue;
      const why2 = reason(R);
      if (why2 !== undefined) {
        ctx.stdout.write(`kept origin/${b}: ${why2}
`);
        continue;
      }
      try {
        gitNoPrompt(ctx.root, ['push', `--force-with-lease=refs/heads/${b}:${R}`, 'origin', ':refs/heads/' + b]);
      } catch (e) {
        ctx.stdout.write(`kept origin/${b}: git push failed: ${firstLine(e)}
`);
        continue;
      }
      ctx.stdout.write(`deleted origin/${b} (was ${R})
`);
    } catch (e) {
      ctx.stdout.write(`kept ${b}: could not be judged: ${firstLine(e instanceof UsageError ? e.message : e)}
`);
    }
  }
}

/** ST-LN-34: for each ticket branch whose ticket is dropped on `ref`, delete the worktree, the origin branch and the local branch when nothing beyond origin is lost. */
function cleanDropped(ctx: CommandContext, ref: string, templates: readonly string[], s: GuardState, pruned: Map<string, string>, fetchFailed: boolean, skip?: string): void {
  const known = (i: string) => Object.hasOwn(ctx.snapshot.tickets, i);
  const tips = new Map<string, { L?: string; R?: string }>();
  for (const row of git(ctx.root, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/remotes/origin']).split('\n')) {
    const cut = row.indexOf(' ');
    if (cut < 0) continue;
    const sha = row.slice(0, cut);
    const full = row.slice(cut + 1);
    const local = full.startsWith('refs/heads/');
    const name = full.slice(local ? 'refs/heads/'.length : 'refs/remotes/origin/'.length);
    if (name === 'HEAD' && !local) continue;
    tips.set(name, { ...tips.get(name), [local ? 'L' : 'R']: sha });
  }
  // A merged ticket stays on the merged path above; a merged origin branch is left to the host.
  const ids = new Map<string, string>();
  for (const [name, t] of tips) {
    const id = ticketOfBranch(name, templates, known);
    if (id !== undefined && id !== skip && !gitOk(ctx.root, ['merge-base', '--is-ancestor', (t.L ?? t.R)!, ref])) ids.set(name, id);
  }
  if (ids.size === 0) return;
  const dropped = droppedOn(ctx.root, ref, [...new Set(ids.values())]);
  if (fetchFailed && [...ids.keys()].some((n) => dropped.has(ids.get(n)!))) {
    ctx.stdout.write('kept dropped tickets: fetch from origin failed\n');
    return;
  }
  const after = worktrees(ctx.root, ctx.stdout);
  for (const b of [...ids.keys()].filter((n) => dropped.has(ids.get(n)!)).sort()) {
    const id = ids.get(b)!;
    try {
      const W = after.find((x) => x.branch === b);
      // A worktree mid-rebase has a detached HEAD and shows no branch; its rebase still owns the branch.
      const rebasing = after.find((x) => x.branch === undefined && rebaseBranch(x.path) === b);
      if (rebasing !== undefined) {
        ctx.stdout.write(`kept ${b}: being rebased in ${rebasing.path}
`);
        continue;
      }
      if (W !== undefined && W === after[0]) {
        ctx.stdout.write(`kept ${b}: checked out in ${W.path}\n`);
        continue;
      }
      let g: { h: Hold | undefined } | undefined;
      if (W !== undefined) {
        g = passGuards(ctx, W, id, s);
        if (g === undefined) continue;
      }
      // Re-read the local tip: a commit made in the worktree while the guards ran counts, and the printed sha is the deleted one.
      const args = ['rev-parse', '--verify', '-q', 'refs/heads/' + b];
      const L = gitOk(ctx.root, args) ? git(ctx.root, args).trim() : undefined;
      const R = tips.get(b)!.R;
      if (L !== undefined && R !== undefined && L !== R) {
        if (gitOk(ctx.root, ['merge-base', '--is-ancestor', R, L])) {
          ctx.stdout.write(`kept ${b}: ${git(ctx.root, ['rev-list', '--count', `${R}..${L}`]).trim()} commits not on origin\n`);
        } else ctx.stdout.write(`kept ${b}: origin/${b} has commits not here\n`);
        continue;
      }
      if (L !== undefined && R === undefined && pruned.get('refs/remotes/origin/' + b) !== L) {
        const n = Number(git(ctx.root, ['rev-list', '--count', L, '--not', '--remotes=origin']).trim());
        if (n > 0) {
          ctx.stdout.write(`kept ${b}: ${n} commits not on origin\n`);
          continue;
        }
      }
      // git refuses to delete a branch checked out in a worktree, and a branch must not lose its folder after its origin copy is gone.
      if (W !== undefined && removeWorktree(ctx, W, id, g!.h).failed) continue;
      if (R !== undefined) {
        try {
          gitNoPrompt(ctx.root, ['push', `--force-with-lease=refs/heads/${b}:${R}`, 'origin', ':refs/heads/' + b]);
        } catch (e) {
          ctx.stdout.write(`kept origin/${b}: git push failed: ${firstLine(e)}
`);
          if (L !== undefined) ctx.stdout.write(`kept ${b}: its origin branch was not deleted
`);
          continue;
        }
        ctx.stdout.write(`deleted origin/${b} (was ${R})\n`);
      }
      if (L !== undefined) {
        try {
          execFileSync('git', ['update-ref', '-d', 'refs/heads/' + b, L], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          ctx.stdout.write(`deleted ${b} (was ${L})\n`);
        } catch (e) {
          ctx.stdout.write(`kept ${b}: git update-ref failed: ${firstLine(e)}\n`);
        }
      }
    } catch (e) {
      ctx.stdout.write(`kept ${b}: could not be judged: ${firstLine(e instanceof UsageError ? e.message : e)}\n`);
    }
  }
}

/** D-13: write the new ticket in its own worktree on its claim branch, commit and push it, then run setup there. */
export function newTicketWorktree(ctx: CommandContext, id: string, rel: string, text: string): void {
  const enter = canEnter(ctx);
  const branch = branchOf(ctx.snapshot, id);
  const list = worktrees(ctx.root, ctx.stdout);
  const exists =
    list.some((w) => w.branch === branch) ||
    gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]) ||
    gitOk(ctx.root, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/' + branch]);
  if (exists) throw new UsageError(`${branch} already exists - nothing was written`);
  const ref = gitDefaultRef(ctx.root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again');
  if (gitOk(ctx.root, ['cat-file', '-e', `${ref}:${rel}`])) {
    throw new UsageError(`${rel} already exists on ${ref.replace('refs/remotes/', '')} - nothing was written`);
  }
  const path = siblingOf(list[0].path, id);
  git(ctx.root, ['worktree', 'add', '--no-track', '-b', branch, path, ref]);
  mkdirSync(path + '/accord/tickets', { recursive: true });
  writeFileSync(path + '/' + rel, text);
  git(path, ['add', '--', rel]);
  git(path, ['commit', '-q', '-m', 'claim: ' + id]);
  let holdError: unknown;
  if (enter) {
    try {
      takeHold(ctx, id, path);
    } catch (e) {
      holdError = e; // push anyway so the claim is not stranded locally; rethrown below
    }
  }
  try {
    gitNoPrompt(path, ['push', '-u', 'origin', branch]);
  } catch (e) {
    throw new UsageError(`the ticket is committed in ${path} but the push failed: ${firstLine(e)} - push it with git -C "${path}" push -u origin ${branch}`);
  }
  if (holdError !== undefined) throw holdError;
  if (enter) checkPin(ctx, id, path, branch, list[0].path);
  prepare(path);
  ctx.stdout.write(rel + '\n');
  enterOrStop(ctx, id, path, branch, enter);
}
