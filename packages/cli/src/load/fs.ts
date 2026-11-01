// D-51 filesystem loader: a repository root becomes a SnapshotInput through `git ls-files` and readdir.
// Impure by design (node:fs, node:path, node:child_process are allowed in the CLI package).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { branchTemplateOf, CALL_SIGN, DEFAULT_BRANCH_TEMPLATE, isResearchPath, isSha, loadSnapshot, normaliseText, peopleOf, scopeLines, workOf } from '@accord-dev/accord-core';
import type { BranchChange, BranchFact, RepoSnapshot, SnapshotInput } from '@accord-dev/accord-core';

/** Environment problem the user must fix (no git, not a repository, no accord/ folder); exit 2 in Phase 5. */
export class UsageError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Tracked plus untracked-but-not-ignored paths, forward slashes, sorted, de-duplicated (D-51). */
function gitTree(root: string): string[] {
  let out: string;
  try {
    out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { code?: string; stderr?: string };
    if (e.code === 'ENOENT') throw new UsageError('git is required but was not found on PATH');
    const stderr = String(e.stderr ?? '').trim();
    throw new UsageError('not a git repository (or git failed): ' + root + '\n' + stderr);
  }
  return [...new Set(out.split('\0').filter((p) => p !== ''))].sort();
}

/** Every regular file under `accord/`, keyed by its posix path relative to the root (D-30). */
function accordFiles(root: string): Record<string, string> {
  const accordDir = join(root, 'accord');
  if (!statSync(accordDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new UsageError('no accord/ folder in ' + root);
  }
  const files: Record<string, string> = {};
  for (const d of readdirSync(accordDir, { recursive: true, withFileTypes: true })) {
    if (!d.isFile()) continue;
    const abs = join(d.parentPath, d.name);
    files[relative(root, abs).split(sep).join('/')] = readFileSync(abs, 'utf8');
  }
  return files;
}

/** A configured path relative to the root, or undefined when unset, missing, or outside the root (T-02-20, T-03-02). */
function containedPath(root: string, rel: string | undefined): string | undefined {
  if (!rel) return undefined;
  rel = rel.replace(/\\/g, '/').replace(/^\.\//, '');
  const abs = resolve(root, rel);
  const back = relative(root, abs);
  if (back === '' || back.startsWith('..') || isAbsolute(back)) return undefined;
  if (!existsSync(abs) || !statSync(abs).isFile()) return undefined;
  return back.split(sep).join('/');
}

/**
 * D-78 host facts: the gated commit with its author, plus the author of every file under
 * `accord/tickets`. Two `git` invocations, spawned by name with a literal argument array — never a
 * Windows batch shim, never a package manager, and never through a shell (STACK "What NOT to Use",
 * D-51). Nothing beyond the author identity is read: no diff, no message body, no remote.
 *
 * Returns undefined when the repository has no commit, so `loadFromFs` omits the key rather than emit
 * `undefined` and move the D-54 goldens; Done then fails cleanly with `gate.commit-missing`.
 */
function gitFacts(
  root: string,
  headRead: { commit: string; author: string } | 'unborn' | undefined,
): { commit: string; authors: Record<string, string>; activity: Record<string, number>; planSubjects: Record<string, string> } | undefined {
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  // ST-LN-63: the HEAD commit and its author come from the object `gitDefaultBranch` already read; `git show` runs only when that read could not say.
  if (headRead === 'unborn') return undefined;
  let commit: string | undefined;
  let commitAuthor: string | undefined;
  if (headRead !== undefined) ({ commit, author: commitAuthor } = headRead);
  else {
    let head: string;
    try {
      head = git(['-c', 'log.showSignature=false', 'show', '--no-show-signature', '-s', '--format=%H%x00%ae', 'HEAD']);
    } catch {
      // `gitTree` runs first, so a missing binary has already thrown the ENOENT UsageError; a failure
      // here means an unborn HEAD and nothing else.
      return undefined;
    }
    [commit, commitAuthor] = head.trim().split('\0');
  }
  if (commit === undefined || commitAuthor === undefined) return undefined;
  const authors: Record<string, string> = {};
  // Ticket id -> newest committer time over its records; empty when the log fails, so nothing is idle.
  const activity: Record<string, number> = {};
  // Ticket id -> subject of the newest commit that touched its plan.md (BUG-LN-2).
  const planSubjects: Record<string, string> = {};
  let log: string;
  try {
    // One bounded walk over one subtree in one spawn (T-04-23).
    log = git(['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--format=%x01%ae%x00%ct%x00%s', '--name-only', '--', 'accord/tickets']);
  } catch {
    log = '';
  }
  let author: string | undefined;
  let time = 0;
  let subject = '';
  for (const line of log.split('\n')) {
    const text = line.trim();
    if (text === '') continue;
    if (text.startsWith('')) {
      // The subject is read from the untrimmed line: a trailing space must not make a subject match.
      const [email, ct, ...rest] = line.slice(line.indexOf(text[0] as string) + 1).split('\0');
      author = email;
      time = Number(ct);
      subject = rest.join('\0');
    }
    // git log emits the most recent commit first, so the first author seen for a path is the latest.
    else if (author !== undefined) {
      const key = text.split(sep).join('/');
      if (!Object.hasOwn(authors, key)) authors[key] = author;
      const planId = /^accord\/tickets\/([^/]+)\/plan\.md$/.exec(key)?.[1];
      if (planId !== undefined && !Object.hasOwn(planSubjects, planId)) planSubjects[planId] = subject;
      const id = /^accord\/tickets\/([^/]+?)(?:\.md$|\/)/.exec(key)?.[1];
      if (id !== undefined && time > (activity[id] ?? 0)) activity[id] = time;
    }
  }
  // D-78: the gated commit's author rides under a key equal to the sha, which cannot collide with a path.
  authors[commit] = commitAuthor;
  return { commit, authors, activity, planSubjects };
}

/** BUG-LN-2: the paths under accord/tickets with an uncommitted change: staged, unstaged or untracked. */
function gitDirty(root: string): Set<string> {
  let out: string;
  try {
    out = execFileSync('git', ['--no-optional-locks', 'status', '--porcelain', '-z', '-uall', '--', 'accord/tickets'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git status failed reading the plan files' + (stderr === '' ? '' : '\n' + stderr));
  }
  const dirty = new Set<string>();
  for (const token of out.split('\0')) {
    if (token === '') continue;
    dirty.add(/^.. /.test(token) ? token.slice(3) : token); // a rename's source is a bare path
  }
  return dirty;
}

/**
 * Spec §5: a branch named by a template in force (`t/{id}` always), local or on any remote, claims its ticket for
 * the author of its tip. One spawn, literal arguments, one narrow pattern pair per template. Per ticket the winner is
 * a pushed ref over a local one (the one teammates see), then the newest tip.
 *
 * A failure throws: `gitTree` has already proved git and the repository, so a failed for-each-ref is a
 * broken ref store, and silently dropping claims would offer held tickets as free. No match exits 0.
 */
function gitClaims(
  root: string,
  templates: readonly string[],
  known: (id: string) => boolean,
): {
  claims: Record<string, string>;
  branches: Record<string, string>;
  refs: Record<string, string>;
  activity: Record<string, number>;
  /** Every ref the listing printed, with its sha. */
  listed: Map<string, string>;
} {
  const patterns = templates.flatMap((t) => {
    const parts = t.split('{id}');
    return parts.length === 2 ? ['refs/heads/' + parts[0] + '*' + parts[1], 'refs/remotes/*/' + parts[0] + '*' + parts[1]] : [];
  });
  let out: string;
  try {
    // for-each-ref globs with WM_PATHNAME, so `*` stays within one segment.
    // shortcut: a remote whose name contains `/` is not matched; widen the pattern if one ever must be.
    out = execFileSync('git', ['for-each-ref', '--format=%(refname)%00%(authoremail)%00%(committerdate:unix)%00%(objectname)', ...patterns], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git for-each-ref failed reading the claim branches' + (stderr === '' ? '' : '\n' + stderr));
  }
  // A Map, so an inherited key such as `constructor` never counts as an earlier winner.
  const winners = new Map<string, { email: string; short: string; ref: string; pushed: boolean; when: number }>();
  const activity: Record<string, number> = {};
  const listed = new Map<string, string>();
  for (const line of out.split('\n')) {
    const [ref, email, whenText, sha] = line.split('\0');
    if (ref !== undefined && sha !== undefined) listed.set(ref, sha);
    const m = /^refs\/(?:(heads)|remotes\/[^/]+)\/(.+)$/.exec(ref ?? '');
    if (m === null || email === undefined) continue;
    const id = ticketOfBranch(m[2], templates, known);
    if (id === undefined) continue;
    const when = Number(whenText);
    // Local and remote-tracking tips both count towards activity.
    if (when > (activity[id] ?? 0)) activity[id] = when;
    const cur = { email: email.replace(/^<|>$/g, ''), short: m[2], ref: ref as string, pushed: m[1] === undefined, when };
    const prev = winners.get(id);
    if (prev === undefined || (cur.pushed && !prev.pushed) || (cur.pushed === prev.pushed && cur.when > prev.when)) winners.set(id, cur);
  }
  const claims: Record<string, string> = Object.create(null);
  const branches: Record<string, string> = Object.create(null);
  const refs: Record<string, string> = Object.create(null);
  for (const [id, w] of winners) {
    claims[id] = w.email;
    branches[id] = w.short;
    refs[id] = w.ref;
  }
  return { claims, branches, refs, activity, listed };
}
/**
 * Spec §7: is each lane plan's baseline an ancestor of HEAD? Per sha, `git merge-base --is-ancestor`:
 * exit 0 is true and every other outcome is false (an unknown sha exits 128, a spawn failure throws).
 * Never a UsageError: this runs for every command, so a typo'd baseline must not break `status` or
 * `lint`; false fails `gate plan` closed. `isSha` runs first, so a value cannot read as an option.
 */
function gitAncestors(root: string, shas: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const sha of shas) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: root, stdio: 'ignore' });
      out[sha] = true;
    } catch {
      out[sha] = false;
    }
  }
  return out;
}

/**
 * Spec §7: which of the plans' non-new `files:` paths exist at each baseline that is an ancestor of HEAD.
 * One `git ls-tree` per baseline; `--literal-pathspecs` keeps a path from reading as pathspec magic, `isSha`
 * keeps the sha from reading as an option. A git failure is an environment error, not a verdict.
 */
function gitBaselineFiles(root: string, wanted: Record<string, string[]>, ancestors: Record<string, boolean>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [sha, paths] of Object.entries(wanted)) {
    if (!ancestors[sha]) continue;
    // An absolute or escaping path cannot exist at the baseline, and git exits 128 on it: never pass it, so
    // it stays absent and gate.task-file-unknown reports it as a finding.
    const safe = paths.filter((p) => !/^([/\\]|[A-Za-z]:)/.test(p) && !p.split(/[/\\]/).includes('..'));
    if (safe.length === 0) {
      out[sha] = [];
      continue;
    }
    try {
      const raw = execFileSync('git', ['--literal-pathspecs', 'ls-tree', '--name-only', '-z', sha, '--', ...safe], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      });
      const listed = raw.split('\0').filter((p) => p !== '');
      // ls-tree lists a directory's children, not the directory: a token is present when git names it or anything under it.
      out[sha] = safe.filter((t) => {
        const bare = t.replace(/\/+$/, '');
        return listed.some((l) => l === bare || l.startsWith(bare + '/'));
      });
    } catch (err) {
      const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
      throw new UsageError(`git ls-tree failed at baseline ${sha}` + (stderr === '' ? '' : '\n' + stderr));
    }
  }
  return out;
}

/**
 * Spec §11: for each recorded commit that is an ancestor of HEAD, the paths changed from it to HEAD. The shas are
 * `isSha`-guarded so a value cannot read as an option; a non-ancestor is left out, and any other git failure is an
 * environment error naming the sha.
 */
function gitRecordsSince(root: string, shas: string[]): Record<string, string[]> {
  const ancestors = gitAncestors(root, shas);
  const out: Record<string, string[]> = {};
  for (const sha of shas) {
    if (!ancestors[sha]) continue;
    try {
      const raw = execFileSync('git', ['diff', '--name-only', '-z', '--no-renames', sha, 'HEAD', '--'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      });
      out[sha] = raw.split('\0').filter((p) => p !== '');
    } catch (err) {
      const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
      throw new UsageError(`git diff failed from recorded commit ${sha}` + (stderr === '' ? '' : '\n' + stderr));
    }
  }
  return out;
}

/**
 * ST-LN-63: the history `gate plan` reads for the gated ticket alone, never for every ticket at load: whether its plan's
 * baseline is an ancestor of HEAD, and which of its plan's non-new `files:` paths exist at that baseline. A baseline that is
 * not a sha gives `{}`, as the plan gate's own rule reports it.
 */
export function gitPlanHistory(
  root: string,
  snapshot: RepoSnapshot,
  id: string,
): { ancestors?: Record<string, boolean>; baselineFiles?: Record<string, string[]> } {
  const plan = workOf(snapshot, id)?.plan;
  const sha = plan?.baseline;
  if (plan === undefined || sha === undefined || !isSha(sha)) return {};
  const ancestors = gitAncestors(root, [sha]);
  const wanted = { [sha]: [...new Set(plan.tasks.flatMap((t) => t.files.filter((f) => !t.newFiles.includes(f))))] };
  const baselineFiles = gitBaselineFiles(root, wanted, ancestors);
  return { ancestors, ...(Object.keys(baselineFiles).length === 0 ? {} : { baselineFiles }) };
}

/**
 * ST-LN-63: the paths changed from each commit the gated ticket's ticks and review were made against to HEAD, read for
 * `gate done` and the gated ticket alone. A recorded sha equal to HEAD is included: its diff is empty and the rule never reads it.
 */
export function gitRecordsSinceFor(root: string, snapshot: RepoSnapshot, id: string): { recordsSince?: Record<string, string[]> } {
  const recorded = [
    ...new Set(
      [
        Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter?.verified_commit : undefined,
        Object.hasOwn(snapshot.verifications, id) ? snapshot.verifications[id].frontmatter?.commit : undefined,
      ].filter((c): c is string => c !== undefined && isSha(c)),
    ),
  ];
  if (recorded.length === 0) return {};
  const recordsSince = gitRecordsSince(root, recorded);
  return Object.keys(recordsSince).length === 0 ? {} : { recordsSince };
}

type AfterVerify = NonNullable<SnapshotInput['afterVerify']>[string];

const GIT_QUIET = { encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'] };

/** The default ref: origin's (`gitDefaultRef`), else the first local `main` or `master` that resolves. */
export function defaultRefOf(root: string): string | undefined {
  const refs = defaultRefs(root, true);
  return refs.origin ?? refs.local;
}

const ORIGIN_DEFAULTS = ['refs/remotes/origin/main', 'refs/remotes/origin/master'];
const LOCAL_DEFAULTS = ['refs/heads/main', 'refs/heads/master'];

/**
 * The default refs in one `for-each-ref`: `origin` is origin/HEAD's target when origin/HEAD is symbolic and resolves, else
 * the first resolving origin/main or origin/master; `local` (only when asked for) is the first resolving local main or master.
 * A ref whose target does not resolve is left out by git or has no object name, so it never counts.
 * Nothing is kept between calls: a caller that fetched or pruned reads again.
 */
export interface DefaultRefs {
  origin?: string;
  local?: string;
}

function defaultRefs(root: string, local: boolean): DefaultRefs {
  const patterns = ['refs/remotes/origin/HEAD', ...ORIGIN_DEFAULTS, ...(local ? LOCAL_DEFAULTS : [])];
  let raw: string;
  try {
    raw = execFileSync('git', ['for-each-ref', '--format=%(refname)%00%(symref)%00%(objectname)', ...patterns], { cwd: root, ...GIT_QUIET });
  } catch {
    return {};
  }
  // A pattern also matches the refs below it (`refs/remotes/origin/main/x`), so only an exact name counts.
  const found = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const [name, symref, object] = line.split('\0');
    if (name !== undefined && patterns.includes(name) && object !== undefined && object.trim() !== '') found.set(name, symref ?? '');
  }
  const head = found.get('refs/remotes/origin/HEAD');
  // A plain origin/HEAD has no symref: `symbolic-ref -q` fails on it, so it is not used.
  const origin = head !== undefined && head !== '' ? head : ORIGIN_DEFAULTS.find((ref) => found.has(ref));
  return { origin, local: LOCAL_DEFAULTS.find((ref) => found.has(ref)) };
}

/** What `log -z --format=%x01%H%x00%P --name-only` printed: `\x01sha NUL parents NUL`, then `\n` + first path NUL and the other paths NUL-ended when the commit has any. */
export function parseAfterLog(raw: string, remerged: boolean): AfterVerify {
  const tokens = raw.split('\0');
  const commits: AfterVerify = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].startsWith('\x01')) continue;
    const sha = tokens[i].slice(1);
    const parents = (tokens[i + 1] ?? '').split(' ').filter((p) => p !== '');
    const files: string[] = [];
    i += 2;
    if ((tokens[i] ?? '').startsWith('\n')) {
      files.push(tokens[i].slice(1));
      while (i + 1 < tokens.length && tokens[i + 1] !== '' && !tokens[i + 1].startsWith('\x01')) files.push(tokens[++i]);
    } else i -= 1; // no paths: the loop's own increment lands on the next commit
    commits.push({ sha, parents, ...(parents.length > 1 && !remerged ? {} : { files }) });
  }
  return commits;
}

/**
 * ST-LN-26: one ticket's commits reachable from its tips and not from its start commit nor the default ref, oldest first in
 * graph order, with the paths each changes. ST-LN-63: the body of the former per-ticket loop, one log with `--remerge-diff`
 * and once more without it when that fails; undefined when both fail.
 */
function ownAfterVerify(root: string, def: string | undefined, want: { commit: string; tips: string[] }): AfterVerify | undefined {
  const opts = { cwd: root, ...GIT_QUIET, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } };
  const args = (remerge: boolean) => [
    '-c', 'core.quotePath=false', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z', '--topo-order', '--reverse', '--format=%x01%H%x00%P', '--name-only', '--no-renames',
    ...(remerge ? ['--remerge-diff'] : []), ...want.tips, '^' + want.commit, ...(def === undefined ? [] : ['^' + def]), '--',
  ];
  let raw: string;
  let remerged = def !== undefined;
  try {
    raw = execFileSync('git', args(true), opts);
  } catch {
    remerged = false; // git before 2.36 has no --remerge-diff: a merge then counts as a change
    try {
      raw = execFileSync('git', args(false), opts);
    } catch {
      return undefined;
    }
  }
  return parseAfterLog(raw, remerged);
}

/**
 * ST-LN-26: per ticket, the commits reachable from its tips and not from its start commit nor the default ref, oldest
 * first in graph order, with the paths each changes. A git failure drops the entry; it is never an environment error.
 */
function gitAfterVerify(root: string, wanted: Record<string, { commit: string; tips: string[] }>): Record<string, AfterVerify> {
  const out: Record<string, AfterVerify> = {};
  let entries = Object.entries(wanted);
  if (entries.length === 0) return out;
  const opts = { cwd: root, ...GIT_QUIET, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } };
  const def = defaultRefOf(root);
  if (def !== undefined) {
    let listed: string[];
    try {
      listed = execFileSync('git', ['rev-list', '--ignore-missing', ...entries.map(([, w]) => w.commit), '^' + def, '--'], opts)
        .split('\n')
        .filter((l) => l !== '')
        .map((l) => l.toLowerCase());
    } catch {
      return out;
    }
    entries = entries.filter(([, w]) => listed.some((sha) => sha.startsWith(w.commit.toLowerCase())));
  }
  for (const [id, w] of entries) {
    const commits = ownAfterVerify(root, def, w);
    if (commits !== undefined) out[id] = commits;
  }
  return out;
}

type WalkCommit = { parents: string[]; files: string[]; subject: string };
type Walk = Map<string, WalkCommit>;

/**
 * ST-LN-63: false only for a ticket with a lane other than `S` and an open task. Core reads `afterVerify` for a lane S
 * ticket and for a ticket with no open task, so such a ticket gets neither a review start nor an after-verify read.
 */
function readsAfter(snapshot: RepoSnapshot, id: string): boolean {
  const lane = snapshot.tickets[id]?.frontmatter?.lane;
  return lane === undefined || lane === 'S' || !hasOpenTask(snapshot, id);
}

/** A task of the ticket's plan whose number is not a key of its ledger's `done` (stage.ts: `open`). */
function hasOpenTask(snapshot: RepoSnapshot, id: string): boolean {
  const work = workOf(snapshot, id);
  const done = work?.ledger?.done ?? {};
  return (work?.plan?.tasks ?? []).some((t) => !Object.hasOwn(done, String(t.n)));
}

/** ST-LN-63: true only for a ticket with a lane other than `S` and an open task, the one state core reads a plan subject in. */
function readsSubject(snapshot: RepoSnapshot, id: string): boolean {
  const lane = snapshot.tickets[id]?.frontmatter?.lane;
  return lane !== undefined && lane !== 'S' && hasOpenTask(snapshot, id);
}

/**
 * ST-LN-63: one `git log --stdin` over every positive and, when there is a default ref, `^<def>`: each commit reachable
 * from a positive and not from the default ref, keyed by its lower-case sha, with its parents, its subject and, for a
 * non-merge, its paths against its parent. A merge's paths are never read (D-10), so its `files` is empty. Any failure
 * (exit code, ENOBUFS, an option an old git rejects) gives undefined.
 */
function gitWalk(root: string, def: string | undefined, positives: string[]): Walk | undefined {
  let raw: string;
  try {
    raw = execFileSync(
      'git',
      ['-c', 'core.quotePath=false', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '--stdin', '--ignore-missing', '-z', '--format=%x01%H%x00%P%x00%s', '--name-only', '--no-renames', '--'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
        input: [...positives, ...(def === undefined ? [] : ['^' + def])].map((l) => l + '\n').join(''),
      },
    );
  } catch {
    return undefined;
  }
  const walk: Walk = new Map();
  const tokens = raw.split('\0');
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].startsWith('\x01')) continue;
    const sha = tokens[i].slice(1).toLowerCase();
    const parents = (tokens[i + 1] ?? '').split(' ').filter((p) => p !== '').map((p) => p.toLowerCase());
    const subject = tokens[i + 2] ?? '';
    const files: string[] = [];
    i += 3;
    if ((tokens[i] ?? '').startsWith('\n')) {
      files.push(tokens[i].slice(1));
      while (i + 1 < tokens.length && tokens[i + 1] !== '' && !tokens[i + 1].startsWith('\x01')) files.push(tokens[++i]);
    } else i -= 1;
    walk.set(sha, { parents, files: parents.length > 1 ? [] : files, subject });
  }
  return walk;
}

/**
 * ST-LN-63: what `ownAfterVerify` gives a ticket whose history after `start` is a chain of single-parent commits. `'drop'`:
 * the start is not in the walk, so it is on the default ref or missing, as the former `rev-list` filter drops it. `'own'`:
 * a merge, a root, the walk's edge or a tip off the chain stands between a tip and the start, so git answers (D-10).
 */
function walkAfter(walk: Walk, start: string, tips: string[]): AfterVerify | 'drop' | 'own' {
  const wanted = start.toLowerCase();
  const found = [...walk.keys()].filter((k) => k.startsWith(wanted));
  if (found.length === 0) return 'drop';
  if (found.length > 1) return 'own';
  const s = found[0] as string;
  const inside = [...new Set(tips.map((t) => t.toLowerCase()))].filter((t) => walk.has(t));
  if (inside.length === 0) return [];
  for (const top of inside) {
    const chain: string[] = [];
    let at = top;
    while (at !== s) {
      const c = walk.get(at);
      if (c === undefined || c.parents.length !== 1) break;
      chain.push(at);
      at = c.parents[0] as string;
    }
    if (at !== s) continue;
    const met = new Set([...chain, s]);
    if (!inside.every((t) => met.has(t))) continue;
    return chain.reverse().map((sha) => {
      const c = walk.get(sha) as WalkCommit;
      return { sha, parents: [...c.parents], files: [...c.files] };
    });
  }
  return 'own';
}

/**
 * ST-LN-63: what `git log -1 <tip> -- <path>` names, answered only on a chain of single-parent commits: the first commit
 * from the tip whose paths hold `path`, null when a root is reached without one, `'own'` when the chain leaves the walk or
 * meets a merge, since accord never steps through a merge (D-10).
 */
function walkPath(walk: Walk, tip: string, path: string): string | null | 'own' {
  let at = tip.toLowerCase();
  for (;;) {
    const c = walk.get(at);
    if (c === undefined || c.parents.length > 1) return 'own';
    if (c.files.includes(path)) return at;
    if (c.parents.length === 0) return null;
    at = c.parents[0] as string;
  }
}

/** X's start commit: its `verified_commit`, else the `commit:` of its verification.md, each kept only when a sha. */
function startOf(snapshot: { tickets: RepoSnapshot['tickets']; verifications: RepoSnapshot['verifications'] }, id: string): string | undefined {
  const own = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id]?.frontmatter?.verified_commit : undefined;
  const recorded = Object.hasOwn(snapshot.verifications, id) ? snapshot.verifications[id]?.frontmatter?.commit : undefined;
  return [own, recorded].find((c): c is string => typeof c === 'string' && isSha(c));
}

/** A ticket not yet verified starts at the last commit on the tip that touched its review.md; undefined when none. */
function reviewStartOf(root: string, id: string, tips: string[]): string | undefined {
  try {
    const sha = execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%H', ...tips, '--', `accord/tickets/${id}/review.md`], { cwd: root, ...GIT_QUIET, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).trim();
    return isSha(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

const REVIEW_OPTS = (root: string) => ({ cwd: root, encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** ST-LN-31: the last commit on HEAD whose change to the ticket's review.md adds or removes a `## Round ` line. */
export function gitReviewCommit(root: string, id: string): string | undefined {
  try {
    const sha = execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '-G', '^## Round ', '--format=%H', 'HEAD', '--', `:(literal)accord/tickets/${id}/review.md`], REVIEW_OPTS(root)).trim();
    return isSha(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

/**
 * ST-LN-31: whether review.md is committed and unchanged, and the paths its review commit changes; a git failure is `clean: false`, so the gate fails closed.
 * ST-LN-63: `sha` is the review commit the caller read once (`gitReviewCommit`); none means no review commit, so `clean: false` with no git process.
 */
export function gitReviewFact(root: string, id: string, sha: string | undefined): { clean: boolean; files?: string[] } {
  if (sha === undefined) return { clean: false };
  try {
    const o = REVIEW_OPTS(root);
    const dirty = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all', '--', `:(literal)accord/tickets/${id}/review.md`], o) !== '';
    const raw = execFileSync('git', ['-c', 'log.showSignature=false', 'show', '--no-show-signature', '-z', '--format=', '--name-only', '--no-renames', sha], o);
    const files = raw.split('\0').map((t) => (t.startsWith('\n') ? t.slice(1) : t)).filter((t) => t !== '');
    return { clean: !dirty, files };
  } catch {
    return { clean: false };
  }
}

/** ST-LN-31: the commits on HEAD after the ticket's review commit `commit` (read once by the caller); undefined when there is none, so the gate fails closed. */
export function gitAfterReview(root: string, id: string, commit: string | undefined): AfterVerify | undefined {
  if (commit === undefined) return undefined;
  const r = gitAfterVerify(root, { [id]: { commit, tips: ['HEAD'] } });
  return Object.hasOwn(r, id) ? r[id] : undefined;
}

/** ST-LN-17: each ## Return from verify sha of the ticket's review.md -> confirmed by git (the preamble Ruling on the marker). */
export function gitReturnFacts(root: string, id: string, shas: readonly string[]): Record<string, boolean> {
  const ancestor = gitAncestors(root, [...shas]);
  const path = 'accord/tickets/' + id + '/review.md';
  const out: Record<string, boolean> = {};
  for (const sha of shas) {
    out[sha] = false;
    if (!ancestor[sha]) continue;
    let text: string | undefined;
    try {
      text = gitFilesAt(root, sha, [path])[path];
    } catch {
      text = undefined;
    }
    if (text === undefined) continue;
    const last = normaliseText(text).split('\n').filter((l) => l.trim() !== '').pop() ?? '';
    out[sha] = /^verdict:\s*(converged|accepted-by-owner)(\s|$)/.test(last.trim());
  }
  return out;
}

/** `snapshot` with returnFacts[id] set when its review.md holds a marker; `snapshot` itself otherwise. */
export function withReturnFacts(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  const shas = (snapshot.work?.[id]?.rounds?.cycles ?? []).flatMap((c) => (c.marker === undefined ? [] : [c.marker]));
  if (shas.length === 0) return snapshot;
  return { ...snapshot, returnFacts: { ...snapshot.returnFacts, [id]: gitReturnFacts(root, id, shas) } };
}

/**
 * A claim's tip: its ref, plus the local branch when that is another ref, since `gitClaims` prefers the pushed one.
 * ST-LN-63: the local branch is there when the claim listing printed it, so no git process runs here.
 */
function claimTips(id: string, ref: string, claimBranches: Record<string, string>, listed: ReadonlyMap<string, string>): string[] {
  const local = Object.hasOwn(claimBranches, id) ? 'refs/heads/' + claimBranches[id] : undefined;
  return local === undefined || local === ref || !listed.has(local) ? [ref] : [ref, local];
}

/** A ticket the walk may answer: its start commit or, with none, its review.md, its tips and the sha of each (undefined when git named one of them no sha). */
type AfterEntry = { id: string; start: string | undefined; tips: string[]; shas: string[] | undefined };

/** The shas one walk starts from: every claim tip, HEAD's commit when the branch names a ticket, and every start commit. */
function claimPositives(
  claimRefs: Record<string, string>,
  claimBranches: Record<string, string>,
  listed: ReadonlyMap<string, string>,
  headCommit: string | undefined,
  entries: readonly AfterEntry[],
): string[] {
  const positives = new Set<string>();
  for (const id of Object.keys(claimRefs)) for (const t of claimTips(id, claimRefs[id], claimBranches, listed)) positives.add(listed.get(t) ?? '');
  if (headCommit !== undefined) positives.add(headCommit);
  for (const e of entries) if (e.start !== undefined) positives.add(e.start);
  positives.delete('');
  return [...positives];
}

/**
 * ST-LN-63: the positives no object of this repository holds, from one `cat-file --batch-check`; none when git failed. `git log
 * --stdin --ignore-missing` still exits 128 on a missing sha, so one start rewritten away or never fetched would fail the whole walk.
 */
function missingShas(root: string, positives: readonly string[]): string[] {
  try {
    const out = execFileSync('git', ['cat-file', '--batch-check'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      input: positives.map((p) => p + '\n').join(''),
    });
    const lines = out.split('\n');
    return positives.filter((_, i) => lines[i]?.endsWith(' missing') === true);
  } catch {
    return [];
  }
}

/**
 * The default ref and the walk over `positives`; neither when there is nothing to walk. A failed walk is tried once more
 * without the positives that are missing here, so a missing start costs two more git processes, not one read per ticket; its
 * ticket is dropped from the walk, as `rev-list --ignore-missing` drops it.
 */
function walkOver(root: string, positives: readonly string[]): { walk: Walk | undefined; def: string | undefined; refs?: DefaultRefs } {
  if (positives.length === 0) return { walk: undefined, def: undefined };
  const refs = defaultRefs(root, true);
  const def = refs.origin ?? refs.local;
  const walk = gitWalk(root, def, [...positives]);
  if (walk !== undefined) return { walk, def, refs };
  const missing = new Set(missingShas(root, positives));
  const rest = positives.filter((p) => !missing.has(p));
  return { walk: missing.size === 0 || rest.length === 0 ? undefined : gitWalk(root, def, rest), def, refs };
}

/**
 * ST-LN-63: each entry's commits after its start, answered from the walk for a straight history and by git alone for a merge,
 * an unresolvable start, a tip git named no sha for, or when the walk failed (D-08, D-10). Entries of one id with the same
 * start and tips are read once. The result is aligned with `entries`; undefined where the ticket has none.
 */
function resolveAfter(root: string, entries: readonly AfterEntry[], walk: Walk | undefined, def: string | undefined): (AfterVerify | undefined)[] {
  const unique: AfterEntry[] = [];
  const seen = new Map<string, number>();
  const slot = entries.map((e) => {
    const key = [e.id, e.start ?? '', ...e.tips].join('\0');
    let at = seen.get(key);
    if (at === undefined) {
      at = unique.length;
      unique.push(e);
      seen.set(key, at);
    }
    return at;
  });
  const resolved = new Map<number, AfterVerify>();
  const viaGit: Record<string, { commit: string; tips: string[] }> = {};
  const reviewPath = (id: string) => `accord/tickets/${id}/review.md`;
  unique.forEach((e, i) => {
    // Without a walk, or with a tip git has no sha for, the ticket is read by git alone, as before (D-08).
    if (walk === undefined || e.shas === undefined) {
      const commit = e.start ?? reviewStartOf(root, e.id, e.tips);
      if (commit !== undefined) viaGit[String(i)] = { commit, tips: e.tips };
      return;
    }
    let commit = e.start;
    if (commit === undefined) {
      // Every tip outside the walk is on the default ref, where a review commit is dropped.
      if (!e.shas.some((s) => walk.has(s.toLowerCase()))) return;
      const one = new Set(e.shas.map((s) => s.toLowerCase())).size === 1 && e.shas.every((s) => walk.has(s.toLowerCase()));
      const named = one ? walkPath(walk, e.shas[0] as string, reviewPath(e.id)) : 'own';
      if (named === null) return;
      commit = named === 'own' ? reviewStartOf(root, e.id, e.tips) : named;
      if (commit === undefined || !walk.has(commit.toLowerCase())) return; // a sha not in the walk is on the default ref
    }
    const after = walkAfter(walk, commit, e.shas);
    if (after === 'drop') return;
    const list = after === 'own' ? ownAfterVerify(root, def, { commit, tips: e.tips }) : after;
    if (list !== undefined) resolved.set(i, list);
  });
  const fromGit = gitAfterVerify(root, viaGit);
  return slot.map((i) => resolved.get(i) ?? (Object.hasOwn(fromGit, String(i)) ? fromGit[String(i)] : undefined));
}

/**
 * The ticket id a branch name carries under the templates in force, or undefined. A `t/` name is matched only by
 * `t/{id}`. Among matching templates the first whose id is `known` wins, else the first match in template order.
 */
export function ticketOfBranch(name: string, templates: readonly string[], known: (id: string) => boolean): string | undefined {
  const ids: string[] = [];
  for (const template of templates) {
    if (name.startsWith('t/') && template !== DEFAULT_BRANCH_TEMPLATE) continue;
    const parts = template.split('{id}');
    if (parts.length !== 2) continue;
    const [pre, suf] = parts;
    if (!name.startsWith(pre) || !name.endsWith(suf) || name.length <= pre.length + suf.length) continue;
    const id = name.slice(pre.length, name.length - suf.length);
    if (!id.includes('/')) ids.push(id);
  }
  return ids.find(known) ?? ids[0];
}

/** The author email of a commit object's headers; undefined with an `encoding` header or no author line, where `git show` decides. */
function headAuthorOf(body: string): string | undefined {
  const headers = body.split('\n\n', 1)[0] ?? '';
  const lines = headers.split('\n');
  if (lines.some((l) => l.startsWith('encoding '))) return undefined;
  const line = lines.find((l) => l.startsWith('author '));
  if (line === undefined) return undefined;
  const open = line.lastIndexOf('<');
  const close = line.indexOf('>', open);
  return open < 0 || close < 0 ? undefined : line.slice(open + 1, close);
}

type DefaultBranch = { exists: boolean; template?: string; head?: { commit: string; author: string } | 'unborn' };

/**
 * ST-LN-63: what the light load read (the tracked tree, the files under `accord/` with the tokens and the test report, and the default
 * branch), handed back to `loadFromFs` so finishing the full load reads none of them again. Callers outside this file only pass it back.
 */
export type LightLoad = { tree: string[]; files: Record<string, string>; defaultBranch: DefaultBranch };

/**
 * D-07: the default branch is the first of origin/HEAD, origin/main, origin/master naming a commit; its valid `branch` is a template in force.
 * ST-LN-63: the same `cat-file --batch` also reads HEAD, whose commit and author `head` carries ('unborn' when HEAD names nothing,
 * undefined when the batch failed or the commit needs `git show`).
 */
function gitDefaultBranch(root: string): DefaultBranch {
  const refs = ['refs/remotes/origin/HEAD', 'refs/remotes/origin/main', 'refs/remotes/origin/master'];
  let out: Buffer;
  try {
    out = execFileSync('git', ['-c', 'credential.interactive=never', 'cat-file', '--batch'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
      input: refs.map((r) => r + '\n' + r + ':accord/config.yml\n').join('') + 'HEAD\n',
    });
  } catch {
    return { exists: true };
  }
  let at = 0;
  const next = (): { type: string; body: string; sha?: string } | undefined => {
    const nl = out.indexOf(10, at);
    if (nl < 0) return undefined;
    const m = /^([0-9a-f]+) (\w+) (\d+)$/.exec(out.toString('utf8', at, nl));
    if (m === null) {
      at = nl + 1; // `<name> missing`
      return { type: 'missing', body: '' };
    }
    const size = Number(m[3]);
    const body = out.toString('utf8', nl + 1, nl + 1 + size);
    at = nl + 1 + size + 1;
    return { type: m[2] as string, body, sha: m[1] as string };
  };
  // All seven objects are read before deciding: the default branch is the first of the three refs, and HEAD comes last.
  const objects = Array.from({ length: refs.length * 2 + 1 }, next);
  const tip = objects[refs.length * 2];
  const author = tip?.type === 'commit' ? headAuthorOf(tip.body) : undefined;
  const head: { commit: string; author: string } | 'unborn' | undefined =
    tip === undefined ? undefined : tip.type === 'missing' ? 'unborn' : tip.sha === undefined || author === undefined ? undefined : { commit: tip.sha, author };
  for (let i = 0; i < refs.length; i++) {
    const commit = objects[i * 2];
    const config = objects[i * 2 + 1];
    if (commit === undefined || config === undefined) break;
    if (commit.type === 'commit') return { exists: true, ...(config.type === 'blob' && branchTemplateOf(config.body) !== undefined ? { template: branchTemplateOf(config.body) as string } : {}), ...(head === undefined ? {} : { head }) };
  }
  return { exists: false, ...(head === undefined ? {} : { head }) };
}

/** The branch name; '' for a detached HEAD; undefined when git could not say. */
export function currentBranch(root: string): string | undefined {
  try {
    // symbolic-ref answers on an unborn branch too, where rev-parse fails.
    return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    const { status, stdout } = e as { status?: number | null; stdout?: string };
    return status === 1 && (stdout ?? '').trim() === '' ? '' : undefined;
  }
}

function loadParts(root: string, stage = false, light = false, defer = false, from?: LightLoad): {
  input: SnapshotInput;
  /** In light mode only: what was read, for `loadFromFs(root, { from })` to finish the load with. */
  lightLoad?: LightLoad;
  claimRefs: Record<string, string>;
  listed: ReadonlyMap<string, string>;
  /** The current branch, read once outside light mode (ST-LN-63). */
  branch?: { name: string | undefined };
  /** With `defer` only: the entries no walk has answered yet, the HEAD commit when the branch names a ticket, and that ticket. */
  deferred?: { entries: AfterEntry[]; headCommit: string | undefined; own: string | undefined };
  templates: string[];
  known: (id: string) => boolean;
  statusOf: (id: string) => string | undefined;
} {
  // ST-LN-63: with `from`, the light load's reads are taken as they are: no ls-files, no file read, no default-branch read.
  const tree = from?.tree ?? gitTree(root);
  const files = from === undefined ? accordFiles(root) : { ...from.files };
  // First pass reads the config; the tokens file and the test report are read the same way,
  // and a missing one is lint's concern (LINT-04, FMT-11).
  const first = loadSnapshot({ files, tree });
  const config = first.config;
  if (from === undefined) {
    for (const value of [config?.design.tokens, config?.tests?.report]) {
      const key = containedPath(root, value);
      if (key !== undefined) files[key] = readFileSync(join(root, key), 'utf8');
    }
  }
  const defaultBranch = from?.defaultBranch ?? gitDefaultBranch(root);
  const branchTemplates = [...new Set([DEFAULT_BRANCH_TEMPLATE, defaultBranch.template, config?.branch].filter((t): t is string => t !== undefined))];
  const known = (id: string) => Object.hasOwn(first.tickets, id);
  const statusOf = (id: string) => first.tickets[id]?.frontmatter?.status;
  // The prompt-expansion hook reads only the tickets, the config and the branch templates; each git spawn it skips is ~50 ms on Windows.
  if (light) {
    return {
      input: { files, tree, ...(branchTemplates.length === 1 ? {} : { branchTemplates }) },
      lightLoad: { tree, files: { ...files }, defaultBranch },
      claimRefs: {},
      listed: new Map(),
      templates: branchTemplates,
      known,
      statusOf,
    };
  }
  const facts = gitFacts(root, defaultBranch.head);
  const git = facts === undefined ? undefined : { commit: facts.commit, authors: facts.authors };
  const { claims, branches: claimBranches, refs: claimRefs, activity: branchActivity, listed } = gitClaims(root, branchTemplates, known);
  // D-09: a new claim is named by the default branch's template; only a repository with no default branch uses the working tree's.
  const claimTemplate = (defaultBranch.exists ? defaultBranch.template : config?.branch) ?? DEFAULT_BRANCH_TEMPLATE;
  const lastActivity: Record<string, number> = { ...facts?.activity };
  for (const [id, t] of Object.entries(branchActivity)) if (t > (lastActivity[id] ?? 0)) lastActivity[id] = t;
  // ST-LN-26: the commits after verify, for the ticket on this branch (HEAD) and for each claimed ticket (its tips).
  // ST-LN-63: the branch is read once, here, and handed on.
  const branch = { name: currentBranch(root) };
  const own = branch.name === undefined || branch.name === '' ? undefined : ticketOfBranch(branch.name, branchTemplates, known);
  // An entry: a ticket with a start commit or a review.md, with tips, that core reads `afterVerify` for.
  const entries: AfterEntry[] = [];
  for (const id of Object.keys(first.tickets)) {
    const start = startOf(first, id);
    if (start === undefined && !Object.hasOwn(files, `accord/tickets/${id}/review.md`)) continue;
    if (!readsAfter(first, id)) continue;
    const tips = id === own ? ['HEAD'] : Object.hasOwn(claimRefs, id) ? claimTips(id, claimRefs[id], claimBranches, listed) : undefined;
    if (tips === undefined) continue;
    const shas = tips.map((t) => (t === 'HEAD' ? facts?.commit : listed.get(t)));
    entries.push({ id, start, tips, shas: shas.every((s): s is string => s !== undefined) ? shas : undefined });
  }
  const headCommit = own !== undefined && facts !== undefined ? facts.commit : undefined;
  const afterVerify: Record<string, AfterVerify> = {};
  if (!defer) {
    const { walk, def } = walkOver(root, claimPositives(claimRefs, claimBranches, listed, headCommit, entries));
    const lists = resolveAfter(root, entries, walk, def);
    entries.forEach((e, i) => {
      if (lists[i] !== undefined) afterVerify[e.id] = lists[i] as AfterVerify;
    });
  }
  let planFacts: Record<string, { subject?: string; clean: boolean }> | undefined;
  if (stage) {
    const dirty = gitDirty(root);
    planFacts = {};
    for (const path of Object.keys(files)) {
      const id = /^accord\/tickets\/([^/]+)\/plan\.md$/.exec(path)?.[1];
      if (id === undefined) continue;
      const subject = facts?.planSubjects[id];
      planFacts[id] = { ...(subject === undefined ? {} : { subject }), clean: !dirty.has(path) };
    }
  }
  const input: SnapshotInput = {
    files,
    tree,
    ...(planFacts === undefined ? {} : { planFacts }),
    ...(branchTemplates.length === 1 ? {} : { branchTemplates }),
    ...(git === undefined ? {} : { git }),
    // Omitted when empty, so a repository with no ticket branch loads exactly as before.
    ...(Object.keys(claims).length === 0 ? {} : { claims, claimBranches }),
    ...(claimTemplate === DEFAULT_BRANCH_TEMPLATE ? {} : { claimTemplate }),
    ...(Object.keys(lastActivity).length === 0 ? {} : { lastActivity }),
    ...(Object.keys(afterVerify).length === 0 ? {} : { afterVerify }),
  };
  return { input, claimRefs, listed, templates: branchTemplates, known, statusOf, branch, ...(defer ? { deferred: { entries, headCommit, own } } : {}) };
}

export function loadFromFs(root: string, options: { stage?: boolean; light?: boolean; from?: LightLoad } = {}): SnapshotInput {
  return loadWithBranch(root, options).input;
}

/** ST-LN-63: the load and the current branch it read (none in light mode), so a command asks git for the branch once. */
export function loadWithBranch(
  root: string,
  options: { stage?: boolean; light?: boolean; from?: LightLoad } = {},
): { input: SnapshotInput; branch?: { name: string | undefined } } {
  const { input, branch } = loadParts(root, options.stage === true, options.light === true, false, options.from);
  return { input, ...(branch === undefined ? {} : { branch }) };
}

/** ST-LN-63: the light load (what the prompt hook reads) and the parts it read, for `from` to finish a full load without reading them again. */
export function loadLight(root: string): { input: SnapshotInput; parts: LightLoad } {
  const { input, lightLoad } = loadParts(root, false, true);
  return { input, parts: lightLoad as LightLoad };
}

/** The five records of a ticket, as repository paths. */
const recordPaths = (id: string): string[] => [
  'accord/tickets/' + id + '.md',
  ...['plan', 'ledger', 'review', 'verification'].map((n) => 'accord/tickets/' + id + '/' + n + '.md'),
];

/**
 * BUG-LN-2: the claim view. `checkout` is the working tree alone; `view` overlays, for each claimed ticket that is not
 * the current branch's own and whose claim ref is not merged into HEAD, the ticket's five records as that ref holds them.
 * One `git cat-file --batch`, no network (`GIT_NO_LAZY_FETCH`). A blob not present locally reads as absent.
 */
export function loadClaimView(root: string): { checkout: SnapshotInput; view: SnapshotInput; branch: { name: string | undefined }; refs?: DefaultRefs } {
  // ST-LN-63: the branch is read once in loadParts, and the commits after each start come from one walk made here, over the
  // checkout's entries and the candidates' together.
  const parts = loadParts(root, true, false, true);
  const { input: bare, claimRefs, listed, statusOf } = parts;
  const branch = parts.branch as NonNullable<typeof parts.branch>;
  const { entries: checkoutEntries, headCommit, own } = parts.deferred as NonNullable<typeof parts.deferred>;
  const env = { ...process.env, GIT_NO_LAZY_FETCH: '1' };
  /** The input with the `afterVerify` of the lists, aligned with `entries`. */
  const withAfter = (entries: readonly AfterEntry[], lists: readonly (AfterVerify | undefined)[], only?: (id: string) => boolean): Record<string, AfterVerify> => {
    const out: Record<string, AfterVerify> = {};
    entries.forEach((e, i) => {
      const list = lists[i];
      if (list !== undefined && (only === undefined || only(e.id))) out[e.id] = list;
    });
    return out;
  };
  const walked = (entries: readonly AfterEntry[]) => walkOver(root, claimPositives(claimRefs, bare.claimBranches ?? {}, listed, headCommit, entries));
  // One spawn for the merged set; a failure (an unborn HEAD) leaves it empty, as a non-ancestor.
  let merged = new Set<string>();
  const refNames = Object.values(claimRefs);
  if (refNames.length > 0) {
    try {
      const mergedOut = execFileSync('git', ['for-each-ref', '--merged', 'HEAD', '--format=%(refname)', ...refNames], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env,
      });
      merged = new Set(mergedOut.split('\n').filter((l) => l !== ''));
    } catch {
      // unborn HEAD or git failure: nothing is merged
    }
  }
  // A squash or rebase merge leaves the claim tip unmerged: a terminal checkout copy is never superseded.
  const terminal = (id: string) => ['archived', 'dropped'].includes(statusOf(id) ?? '');
  const candidates = Object.entries(claimRefs).filter(([id, ref]) => id !== own && !merged.has(ref) && !terminal(id));
  if (candidates.length === 0) {
    const { walk, def, refs } = walked(checkoutEntries);
    const afterVerify = withAfter(checkoutEntries, resolveAfter(root, checkoutEntries, walk, def));
    const checkout: SnapshotInput = { ...bare, ...(Object.keys(afterVerify).length === 0 ? {} : { afterVerify }) };
    return { checkout, view: checkout, branch, ...(refs === undefined ? {} : { refs }) };
  }
  const wanted = candidates.flatMap(([id, ref]) => recordPaths(id).map((path) => ref + ':' + path));
  let out: Buffer;
  try {
    out = execFileSync('git', ['cat-file', '--batch'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env,
      input: wanted.map((spec) => spec + '\n').join(''),
    });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git cat-file failed reading the claim branches' + (stderr === '' ? '' : '\n' + stderr));
  }
  let at = 0;
  const read = new Map<string, string | undefined>();
  for (const spec of wanted) {
    const nl = out.indexOf(10, at);
    if (nl < 0) break;
    const m = /^[0-9a-f]+ blob (\d+)$/.exec(out.toString('utf8', at, nl));
    if (m === null) {
      at = nl + 1; // `<name> missing`
      continue;
    }
    const size = Number(m[1]);
    read.set(spec, out.toString('utf8', nl + 1, nl + 1 + size));
    at = nl + 1 + size + 1;
  }
  const files = { ...bare.files };
  const planFacts = { ...bare.planFacts };
  const planJobs: { id: string; ref: string; planPath: string }[] = [];
  const overlaid = new Set<string>();
  for (const [id, ref] of candidates) {
    if (read.get(ref + ':' + recordPaths(id)[0]) === undefined) continue;
    overlaid.add(id);
    const planPath = 'accord/tickets/' + id + '/plan.md';
    if (read.get(ref + ':' + planPath) === undefined) delete planFacts[id];
    else {
      planFacts[id] = { clean: true }; // the subject is filled in below, for the tickets whose state core reads it in
      planJobs.push({ id, ref, planPath });
    }
    for (const path of recordPaths(id)) {
      const text = read.get(ref + ':' + path);
      if (text === undefined) delete files[path];
      else files[path] = text;
    }
  }
  // A candidate is read from its overlaid texts: the start commit is the one its own branch records, and core reads its
  // `afterVerify` and its plan subject only in the states `readsAfter` and `readsSubject` name.
  const candidateEntries: AfterEntry[] = [];
  const subjectOf = new Set<string>();
  for (const [id, ref] of candidates) {
    const paths = recordPaths(id);
    if (files[paths[0]] === undefined) continue;
    const present: Record<string, string> = {};
    for (const p of paths) if (files[p] !== undefined) present[p] = files[p];
    const snap = loadSnapshot({ files: present, tree: [] });
    if (overlaid.has(id) && readsSubject(snap, id)) subjectOf.add(id);
    const start = startOf(snap, id);
    if (start === undefined && files[paths[3]] === undefined) continue;
    if (!readsAfter(snap, id)) continue;
    const tips = claimTips(id, ref, bare.claimBranches ?? {}, listed);
    const shas = tips.map((t) => listed.get(t));
    candidateEntries.push({ id, start, tips, shas: shas.every((s): s is string => s !== undefined) ? shas : undefined });
  }
  const all = [...checkoutEntries, ...candidateEntries];
  const { walk, def, refs } = walked(all);
  const lists = resolveAfter(root, all, walk, def);
  const fromCheckout = lists.slice(0, checkoutEntries.length);
  const checkoutAfter = withAfter(checkoutEntries, fromCheckout);
  const checkout: SnapshotInput = { ...bare, ...(Object.keys(checkoutAfter).length === 0 ? {} : { afterVerify: checkoutAfter }) };
  for (const { id, ref, planPath } of planJobs) {
    if (!subjectOf.has(id)) continue;
    const sha = listed.get(ref);
    const named = walk === undefined || sha === undefined ? 'own' : walkPath(walk, sha, planPath);
    let subject = '';
    if (named === 'own') {
      try {
        subject = execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%s', ref, '--', planPath], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          maxBuffer: 64 * 1024 * 1024,
          env,
        }).replace(/\r?\n$/, '');
      } catch {
        // a commit not present locally reads as no subject, so the plan is not ready
      }
    } else if (named !== null) subject = walk?.get(named)?.subject ?? '';
    planFacts[id] = { ...(subject === '' ? {} : { subject }), clean: true };
  }
  // ST-LN-13: a record the claim branch adds is read from that ref; a record the checkout or an earlier ref holds is kept.
  for (const [id, ref] of candidates) {
    const text = read.get(ref + ':' + recordPaths(id)[0]);
    if (text === undefined) continue;
    const mine = researchListed({ [recordPaths(id)[0]]: text }, []).filter((p) => !Object.hasOwn(checkout.files, p) && !Object.hasOwn(files, p));
    Object.assign(files, gitFilesAt(root, ref, mine));
  }
  const afterVerify: Record<string, AfterVerify> = {
    ...withAfter(checkoutEntries, fromCheckout, (id) => !candidates.some(([c]) => c === id)),
    ...withAfter(candidateEntries, lists.slice(checkoutEntries.length)),
  };
  return { checkout, view: { ...bare, files, planFacts, ...(Object.keys(afterVerify).length === 0 ? {} : { afterVerify }) }, branch, ...(refs === undefined ? {} : { refs }) };
}

/** IDS-1: `git config user.email`, trimmed; '' when unset (git exits 1). */
export function gitUserEmail(root: string): string {
  try {
    return execFileSync('git', ['config', 'user.email'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/** IDS-1 D-11: a shallow clone hides deleted tickets behind its boundary commit, so used numbers cannot be seen. */
export function gitIsShallow(root: string): boolean {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * IDS-1 D-10/D-11: every ticket id that ever appeared under accord/tickets in any ref already in the clone.
 * No fetch. --full-history keeps a side branch that added and deleted a ticket visible after a --no-ff merge.
 * Known limit: a treeless clone lacks the trees --name-only needs, so this throws.
 */
export function gitTicketIdsInHistory(root: string): string[] {
  const opts = { cwd: root, encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } };
  if (execFileSync('git', ['for-each-ref', '--count=1', '--format=%(refname)'], opts).trim() === '') return [];
  let raw: string;
  try {
    raw = execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--all', '--full-history', '--no-renames', '--format=', '--name-only', '--', 'accord/tickets'], opts);
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git log failed reading ticket ids' + (stderr === '' ? '' : '\n' + stderr));
  }
  const ids = new Set<string>();
  for (const line of raw.split('\n')) {
    const id = /^accord\/tickets\/([^/]+?)(?:\.md$|\/)/.exec(line.trim())?.[1];
    if (id !== undefined) ids.add(id);
  }
  return [...ids];
}

/** D-15: origin/HEAD's target when it resolves, else origin/main or origin/master; never fetched, never the local main. */
export function gitDefaultRef(root: string): string | undefined {
  return defaultRefs(root, false).origin;
}

/**
 * The utf8 text of each `<ref>:<path>` spec, in order, read with one `git cat-file --batch`; a missing one is `undefined`.
 * `what` names the ref in the error.
 */
export function catBatch(root: string, specs: readonly string[], what: string): (string | undefined)[] {
  let out: Buffer;
  try {
    out = execFileSync('git', ['cat-file', '--batch'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      input: specs.map((s) => s + '\n').join(''),
    });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git cat-file failed reading ' + what + (stderr === '' ? '' : '\n' + stderr));
  }
  const texts: (string | undefined)[] = [];
  let at = 0;
  for (let i = 0; i < specs.length; i++) {
    const nl = out.indexOf(10, at);
    if (nl < 0) break;
    const m = /^[0-9a-f]+ blob (\d+)$/.exec(out.toString('utf8', at, nl));
    if (m === null) {
      at = nl + 1; // `<name> missing`
      continue;
    }
    const size = Number(m[1]);
    texts[i] = out.toString('utf8', nl + 1, nl + 1 + size);
    at = nl + 1 + size + 1;
  }
  return texts;
}

/** The utf8 text of each existing `<ref>:<path>`, read with one `git cat-file --batch`; a missing path is left out. */
export function gitFilesAt(root: string, ref: string, paths: readonly string[]): Record<string, string> {
  if (paths.length === 0) return {};
  const texts = catBatch(root, paths.map((p) => ref + ':' + p), ref);
  const files: Record<string, string> = {};
  paths.forEach((path, i) => {
    const text = texts[i];
    if (text !== undefined) files[path] = text;
  });
  return files;
}

const firstLine = (text: string): string => text.trim().split('\n')[0];
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A path as `git diff` prints it: a value wrapped in `"` has C-style escapes and three-digit octal bytes; any other is returned as is. */
export function unquoteGitPath(v: string): string {
  if (v.length < 2 || !v.startsWith('"') || !v.endsWith('"')) return v;
  const escapes: Record<string, number> = { '\\': 92, '"': 34, a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13 };
  const bytes: number[] = [];
  const inner = v.slice(1, -1);
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    const oct = /^[0-7]{3}/.exec(inner.slice(i + 1, i + 4));
    if (ch !== '\\') bytes.push(...Buffer.from(ch + (inner.codePointAt(i)! > 0xffff ? inner[++i] : ''), 'utf8'));
    else if (oct !== null) {
      bytes.push(parseInt(oct[0], 8));
      i += 3;
    } else if (inner[i + 1] in escapes) bytes.push(escapes[inner[++i]]);
    else bytes.push(92);
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * ST-LN-62: the branch diff of one lane ticket, from its merge base with the default branch to HEAD, for the Done gate.
 * Never throws: each failure is an `{ error }` the gate turns into a finding. `-w` is never used, since it hides
 * whitespace removed inside a line; `--no-renames` makes a rename a deleted and an added path.
 */
export function gitBranchFact(
  root: string,
  id: string,
  opts: {
    rendered: readonly { path: string; text: string }[];
    scope: boolean;
    settings?: { path: string; expected: (base: string | undefined) => string | undefined };
    /** The default ref the caller just read, so it is not read again; absent means read it here. */
    known?: { defaultRef: string | undefined };
  },
): BranchFact {
  const git = (what: string, args: string[]): string => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      });
    } catch (err) {
      if ((err as { code?: unknown }).code === 'ENOBUFS') throw new Error('the branch diff is larger than 64 MiB', { cause: err });
      const stderr = String((err as { stderr?: unknown }).stderr ?? '');
      throw new Error(`git ${what} failed reading the branch diff: ${firstLine(stderr === '' ? (err as Error).message : stderr)}`, { cause: err });
    }
  };
  const readFilesAt = (ref: string, paths: readonly string[]): Record<string, string> => {
    try {
      return gitFilesAt(root, ref, paths);
    } catch (err) {
      const rest = (err as Error).message.split('\n').slice(1).join('\n');
      throw new Error(`git cat-file failed reading the branch diff: ${firstLine(rest === '' ? (err as Error).message : rest)}`, { cause: err });
    }
  };
  try {
    const def = opts.known === undefined ? defaultRefOf(root) : opts.known.defaultRef;
    if (def === undefined) {
      return { error: 'none of origin/HEAD, origin/main, origin/master, main or master resolves, so the branch diff cannot be read; run git fetch origin' };
    }
    const base = git('merge-base', ['merge-base', def, 'HEAD']).trim();
    const raw = git('diff', ['diff', '--raw', '-z', '--no-renames', '--no-ext-diff', base, 'HEAD', '--']).split('\0');
    const changes: BranchChange[] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const meta = raw[i].replace(/^:/, '').split(' ');
      const status = meta[4] ?? '';
      const kind: BranchChange['kind'] =
        status === 'A' ? 'added' : status === 'D' ? 'deleted' : status === 'M' ? (meta[0] === meta[1] ? 'modified' : 'mode') : 'type';
      changes.push({ path: raw[i + 1], kind, lines: 0 });
    }
    const counts = git('diff', [
      'diff', '--numstat', '-z', '--no-renames', '--no-ext-diff', '-b', '--ignore-blank-lines', '--ignore-cr-at-eol', base, 'HEAD', '--',
    ]).split('\0');
    for (const token of counts) {
      const m = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(token);
      const change = m === null ? undefined : changes.find((c) => c.path === m[3]);
      if (m === null || change === undefined) continue;
      if (m[1] === '-') change.binary = true;
      else change.lines = Math.max(Number(m[1]), Number(m[2]));
    }
    changes.sort((a, b) => byCodePoint(a.path, b.path));

    const patch = git('diff', [
      '-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '--no-ext-diff', '--no-textconv', '--no-renames', '-b', '--ignore-blank-lines',
      '--ignore-cr-at-eol', '--src-prefix=a/', '--dst-prefix=b/', base, 'HEAD', '--',
    ]).split('\n');
    let current: BranchChange | undefined;
    let inHunk = false;
    for (const line of patch) {
      if (line.startsWith('diff --git ')) {
        current = undefined;
        inHunk = false;
      } else if (!inHunk && line.startsWith('+++ ')) {
        const rest = line.slice(4).replace(/\t$/, '');
        const path = unquoteGitPath(rest).replace(/^b\//, '');
        if (rest === '/dev/null') continue;
        current = changes.find((c) => c.path === path);
        if (current === undefined) return { error: `git diff -U0 named ${path}, which the raw listing of the branch diff does not hold` };
      } else if (line.startsWith('@@')) {
        inHunk = true;
      } else if (inHunk && current !== undefined && line.startsWith('+') && CALL_SIGN.test(line.slice(1).replace(/\r$/, ''))) {
        (current.calls ??= []).push(line.slice(1));
      }
    }
    const pkgPaths = changes.filter((c) => c.path === 'package.json' || c.path.endsWith('/package.json'));
    const live = changes.filter((c) => c.kind !== 'deleted').map((c) => c.path);
    const rendered = opts.rendered.filter((r) => live.includes(r.path));
    const settingsPath = opts.settings !== undefined && live.includes(opts.settings.path) ? opts.settings.path : undefined;
    const scopeFile = 'accord/tickets/' + id + '.md';
    const firstOf = (): string | undefined =>
      git('log -G ac_hash', [
        '-c', 'log.showSignature=false', 'log', '--no-show-signature', '--reverse', '--format=%H', '-G', '^ac_hash:', 'HEAD', '--', ':(literal)' + scopeFile,
      ])
        .split('\n')
        .find((l) => l.trim() !== '')
        ?.trim();

    // ST-LN-63: the scope's commit and every blob read below come from one log and one cat-file. When either fails, the commit
    // stays unread or the cache stays empty, so each read below runs on its own as before and reports its own error.
    const cache = new Map<string, string | null>();
    let first: { value: string | undefined } | undefined;
    try {
      if (opts.scope) first = { value: firstOf() };
      const specs = new Map<string, [string, string]>();
      const want = (ref: string, path: string) => specs.set(ref + '\0' + path, [ref, path]);
      for (const c of pkgPaths) {
        if (c.kind !== 'added') want(base, c.path);
        if (c.kind !== 'deleted') want('HEAD', c.path);
      }
      if (first?.value !== undefined && isSha(first.value)) want(first.value, scopeFile);
      for (const r of rendered) want('HEAD', r.path);
      if (settingsPath !== undefined) {
        want('HEAD', settingsPath);
        want(base, settingsPath);
      }
      want(base, 'accord/config.yml');
      const keys = [...specs.keys()];
      const texts = catBatch(root, keys.map((k) => (specs.get(k) as [string, string]).join(':')), 'the branch diff');
      keys.forEach((k, i) => cache.set(k, texts[i] ?? null));
    } catch {
      cache.clear();
    }
    const filesAt = (ref: string, paths: readonly string[]): Record<string, string> => {
      if (!paths.every((p) => cache.has(ref + '\0' + p))) return readFilesAt(ref, paths);
      const files: Record<string, string> = {};
      for (const p of paths) {
        const text = cache.get(ref + '\0' + p);
        if (text !== null && text !== undefined) files[p] = text;
      }
      return files;
    };

    const pkgBase = filesAt(base, pkgPaths.filter((c) => c.kind !== 'added').map((c) => c.path));
    const pkgHead = filesAt('HEAD', pkgPaths.filter((c) => c.kind !== 'deleted').map((c) => c.path));
    for (const c of pkgPaths) {
      c.pkg = { ...(pkgBase[c.path] === undefined ? {} : { base: pkgBase[c.path] }), ...(pkgHead[c.path] === undefined ? {} : { head: pkgHead[c.path] }) };
    }

    let scope: { commit: string; paths: string[] } | undefined;
    if (opts.scope) {
      const found = first === undefined ? firstOf() : first.value;
      if (found !== undefined && isSha(found)) {
        const text = filesAt(found, [scopeFile])[scopeFile];
        scope = { commit: found, paths: text === undefined ? [] : (scopeLines(text) ?? []) };
      }
    }

    const head = filesAt('HEAD', [...rendered.map((r) => r.path), ...(settingsPath === undefined ? [] : [settingsPath])]);
    const synced = rendered.filter((r) => head[r.path] !== undefined && normaliseText(head[r.path]) === r.text).map((r) => r.path);
    if (opts.settings !== undefined && settingsPath !== undefined && head[settingsPath] !== undefined) {
      const want = opts.settings.expected(filesAt(base, [settingsPath])[settingsPath]);
      if (want !== undefined && normaliseText(head[settingsPath]) === normaliseText(want)) synced.push(settingsPath);
    }
    synced.sort(byCodePoint);

    const baseConfig = filesAt(base, ['accord/config.yml'])['accord/config.yml'];
    return { base, changes, synced, ...(baseConfig === undefined ? {} : { baseConfig }), ...(scope === undefined ? {} : { scope }) };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/** A SnapshotInput of `ref`'s config and tickets, read from the git tree with no checkout. */
export function loadRefInput(root: string, ref: string): SnapshotInput {
  let listed: string;
  try {
    listed = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', ref, '--', 'accord/config.yml', 'accord/tickets'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    throw new UsageError('git ls-tree failed reading ' + ref);
  }
  const kept = listed.split('\0').filter((p) => p === 'accord/config.yml' || /^accord\/tickets\/[^/]+\.md$/.test(p));
  const files = gitFilesAt(root, ref, kept);
  // ST-LN-13: lint reads the text of each research record a ticket lists, so they are read from the same ref.
  const records = researchListed(files, kept);
  if (records.length === 0) return { files, tree: kept };
  const texts = gitFilesAt(root, ref, records);
  return { files: { ...files, ...texts }, tree: [...kept, ...Object.keys(texts)] };
}

/** ST-LN-13: the unique research paths the tickets of `files` list, in code-point order. */
function researchListed(files: Record<string, string>, tree: string[]): string[] {
  const { tickets } = loadSnapshot({ files, tree });
  const listed = new Set<string>();
  for (const t of Object.values(tickets)) for (const p of t.frontmatter?.research ?? []) if (isResearchPath(p)) listed.add(p);
  return [...listed].sort(byCodePoint);
}

/** The ids of `ids` whose ticket file on `ref` has status dropped. */
export function droppedOn(root: string, ref: string, ids: readonly string[]): Set<string> {
  const files = gitFilesAt(root, ref, ids.map((i) => 'accord/tickets/' + i + '.md'));
  const { tickets } = loadSnapshot({ files, tree: [] });
  return new Set(ids.filter((id) => Object.hasOwn(tickets, id) && tickets[id]?.frontmatter?.status === 'dropped'));
}

/** ST-LN-25: a snapshot of `ref`'s config and the records of `ids`, read from the git tree with no checkout. */
export function snapshotAt(root: string, ref: string, ids: readonly string[]): RepoSnapshot {
  const paths = ['accord/config.yml', ...ids.flatMap((i) => ['accord/tickets/' + i + '.md', 'accord/tickets/' + i + '/plan.md', 'accord/tickets/' + i + '/ledger.md', 'accord/tickets/' + i + '/review.md'])];
  return loadSnapshot({ files: gitFilesAt(root, ref, paths), tree: [] });
}

/** BUG-LN-13 D-01: origin's default ref (gitDefaultRef); in a clone with no `origin` remote, the first of refs/heads/main and refs/heads/master that resolves; else undefined. Never fetches. */
export function doneRef(root: string, known?: DefaultRefs): string | undefined {
  // ST-LN-63: `known` is the one for-each-ref of the same command (`origin` is gitDefaultRef's answer, `local` the first resolving local main or master); without it the refs are read here.
  const found = known === undefined ? gitDefaultRef(root) : known.origin;
  if (found !== undefined) return found;
  try {
    execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, ...GIT_QUIET });
    return undefined; // an origin exists whose default branch this clone has not fetched
  } catch {
    // no origin remote
  }
  if (known !== undefined) return known.local;
  return ['refs/heads/main', 'refs/heads/master'].find((ref) => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '-q', ref], { cwd: root, ...GIT_QUIET });
      return true;
    } catch {
      return false;
    }
  });
}

/** BUG-LN-13: `snapshot` with `defaultRef` read by snapshotAt at doneRef, over the view's ticket ids and every depends_on entry; `snapshot` itself when no default ref resolves. */
export function withDefaultRef(root: string, snapshot: RepoSnapshot, known?: DefaultRefs): RepoSnapshot {
  const ref = doneRef(root, known);
  if (ref === undefined) return snapshot;
  const ids = new Set(Object.keys(snapshot.tickets));
  for (const t of Object.values(snapshot.tickets)) for (const dep of t.frontmatter?.depends_on ?? []) ids.add(dep);
  return { ...snapshot, defaultRef: { ref, snapshot: snapshotAt(root, ref, [...ids]) } };
}

/**
 * ST-LN-8 D-02: the first-parent commits of HEAD that are neither on the default ref nor reachable from `since`.
 * A `since` that does not resolve is left out, so the range falls back to the default ref alone.
 */
export function gitBranchCommits(root: string, since?: string): { sha: string; message: string }[] {
  const ref = gitDefaultRef(root);
  if (ref === undefined) {
    throw new UsageError('commits.trailers is forbid in accord/config.yml, but none of origin/HEAD, origin/main and origin/master exists here; run `git fetch origin`');
  }
  const stop = ['^' + ref];
  if (since !== undefined && isSha(since)) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '-q', since + '^{commit}'], { cwd: root, stdio: 'ignore' });
      stop.push('^' + since);
    } catch {
      // unresolved: default ref alone
    }
  }
  return logCommits(root, ['--first-parent', 'HEAD', ...stop]);
}

/** The commits `git log` prints for `args`, newest first, each with its full message. */
function logCommits(root: string, args: string[]): { sha: string; message: string }[] {
  let raw: string;
  try {
    raw = execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--format=%H%x00%B%x01', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git log failed reading the commits of this branch' + (stderr === '' ? '' : '\n' + stderr));
  }
  return raw
    .split('\x01')
    .map((r) => r.replace(/^\n+/, ''))
    .filter((r) => r.includes('\0'))
    .map((r) => ({ sha: r.slice(0, r.indexOf('\0')), message: r.slice(r.indexOf('\0') + 1) }));
}

/**
 * BUG-LN-11: the commits `git push` would send for `branch`: those neither on origin's branch as this clone last saw it nor on the default ref.
 * With neither ref to stop at, the range would be the whole history, so it throws instead.
 */
export function gitUnpushedCommits(root: string, branch: string): { sha: string; message: string }[] {
  const resolves = (ref: string): boolean => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '-q', ref], { cwd: root, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  const stop = ['refs/remotes/origin/' + branch, gitDefaultRef(root)].filter((r): r is string => r !== undefined && resolves(r)).map((r) => '^' + r);
  if (stop.length === 0) {
    throw new UsageError(`commits.trailers is forbid in accord/config.yml, but none of origin/${branch}, origin/HEAD, origin/main and origin/master exists here; run \`git fetch origin\``);
  }
  return logCommits(root, ['refs/heads/' + branch, ...stop]);
}

/**
 * IDS-1 D-17/D-18: `people` from accord/config.yml on every local and fetched branch, read without the network.
 * `defaultRef` is origin/HEAD's target, else origin/main or origin/master, whichever exists.
 */
export function gitPeopleOnRefs(root: string): { byRef: Record<string, Record<string, string>>; defaultRef?: string } {
  const opts = { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } };
  const fail = (what: string, err: unknown): never => {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git failed ' + what + (stderr === '' ? '' : '\n' + stderr));
  };
  let refs: string[] = [];
  try {
    refs = execFileSync('git', ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'], { ...opts, encoding: 'utf8' })
      .split('\n')
      .filter((r) => r !== '' && !r.endsWith('/HEAD'));
  } catch (err) {
    fail('listing refs to read people', err);
  }
  const byRef: Record<string, Record<string, string>> = {};
  if (refs.length === 0) return { byRef };
  let out: Buffer;
  try {
    out = execFileSync('git', ['cat-file', '--batch'], { ...opts, input: refs.map((r) => r + ':accord/config.yml\n').join('') });
  } catch (err) {
    return fail('reading accord/config.yml on every ref', err);
  }
  let at = 0;
  for (const ref of refs) {
    const nl = out.indexOf(10, at);
    if (nl < 0) break;
    const m = /^[0-9a-f]+ blob (\d+)$/.exec(out.toString('utf8', at, nl));
    if (m === null) {
      at = nl + 1; // `<name> missing`
      continue;
    }
    const size = Number(m[1]);
    const people = peopleOf(out.toString('utf8', nl + 1, nl + 1 + size));
    if (people !== undefined) byRef[ref] = people;
    at = nl + 1 + size + 1;
  }
  const found = gitDefaultRef(root);
  const defaultRef = found !== undefined && refs.includes(found) ? found : undefined;
  return defaultRef === undefined ? { byRef } : { byRef, defaultRef };
}
