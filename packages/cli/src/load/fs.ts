// D-51 filesystem loader: a repository root becomes a SnapshotInput through `git ls-files` and readdir.
// Impure by design (node:fs, node:path, node:child_process are allowed in the CLI package).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { branchTemplateOf, CALL_SIGN, DEFAULT_BRANCH_TEMPLATE, isSha, loadSnapshot, normaliseText, peopleOf, scopeLines, workOf } from '@accord-dev/accord-core';
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
): { commit: string; authors: Record<string, string>; activity: Record<string, number>; planSubjects: Record<string, string> } | undefined {
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  let head: string;
  try {
    head = git(['-c', 'log.showSignature=false', 'show', '--no-show-signature', '-s', '--format=%H%x00%ae', 'HEAD']);
  } catch {
    // `gitTree` runs first, so a missing binary has already thrown the ENOENT UsageError; a failure
    // here means an unborn HEAD and nothing else.
    return undefined;
  }
  const [commit, commitAuthor] = head.trim().split('\0');
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
): { claims: Record<string, string>; branches: Record<string, string>; refs: Record<string, string>; activity: Record<string, number> } {
  const patterns = templates.flatMap((t) => {
    const parts = t.split('{id}');
    return parts.length === 2 ? ['refs/heads/' + parts[0] + '*' + parts[1], 'refs/remotes/*/' + parts[0] + '*' + parts[1]] : [];
  });
  let out: string;
  try {
    // for-each-ref globs with WM_PATHNAME, so `*` stays within one segment.
    // shortcut: a remote whose name contains `/` is not matched; widen the pattern if one ever must be.
    out = execFileSync('git', ['for-each-ref', '--format=%(refname)%00%(authoremail)%00%(committerdate:unix)', ...patterns], {
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
  for (const line of out.split('\n')) {
    const [ref, email, whenText] = line.split('\0');
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
  return { claims, branches, refs, activity };
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
  return (
    gitDefaultRef(root) ??
    ['refs/heads/main', 'refs/heads/master'].find((ref) => {
      try {
        execFileSync('git', ['rev-parse', '--verify', '-q', ref], { cwd: root, ...GIT_QUIET });
        return true;
      } catch {
        return false;
      }
    })
  );
}

/**
 * ST-LN-26: per ticket, the commits reachable from its tips and not from its start commit nor the default ref, oldest
 * first in graph order, with the paths each changes. A git failure drops the entry; it is never an environment error.
 * Layout of `log -z --format=%x01%H%x00%P --name-only`: `\x01sha NUL parents NUL`, then `\n` + first path NUL and the
 * other paths NUL-ended when the commit has any.
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
    const args = (remerge: boolean) => [
      '-c', 'core.quotePath=false', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z', '--topo-order', '--reverse', '--format=%x01%H%x00%P', '--name-only', '--no-renames',
      ...(remerge ? ['--remerge-diff'] : []), ...w.tips, '^' + w.commit, ...(def === undefined ? [] : ['^' + def]), '--',
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
        continue;
      }
    }
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
    out[id] = commits;
  }
  return out;
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
function reviewCommit(root: string, id: string): string | undefined {
  try {
    const sha = execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '-G', '^## Round ', '--format=%H', 'HEAD', '--', `:(literal)accord/tickets/${id}/review.md`], REVIEW_OPTS(root)).trim();
    return isSha(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

/** ST-LN-31: whether review.md is committed and unchanged, and the paths its review commit changes; a git failure is `clean: false`, so the gate fails closed. */
export function gitReviewFact(root: string, id: string): { clean: boolean; files?: string[] } {
  try {
    const o = REVIEW_OPTS(root);
    const dirty = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all', '--', `:(literal)accord/tickets/${id}/review.md`], o) !== '';
    const sha = reviewCommit(root, id);
    if (sha === undefined) return { clean: false };
    const raw = execFileSync('git', ['-c', 'log.showSignature=false', 'show', '--no-show-signature', '-z', '--format=', '--name-only', '--no-renames', sha], o);
    const files = raw.split('\0').map((t) => (t.startsWith('\n') ? t.slice(1) : t)).filter((t) => t !== '');
    return { clean: !dirty, files };
  } catch {
    return { clean: false };
  }
}

/** ST-LN-31: the commits on HEAD after the ticket's review commit; undefined when there is none, so the gate fails closed. */
export function gitAfterReview(root: string, id: string): AfterVerify | undefined {
  const commit = reviewCommit(root, id);
  if (commit === undefined) return undefined;
  const r = gitAfterVerify(root, { [id]: { commit, tips: ['HEAD'] } });
  return Object.hasOwn(r, id) ? r[id] : undefined;
}

/** A claim's tip: its ref, plus the local branch when that is another ref, since `gitClaims` prefers the pushed one. */
function claimTips(root: string, id: string, ref: string, claimBranches: Record<string, string>): string[] {
  const local = Object.hasOwn(claimBranches, id) ? 'refs/heads/' + claimBranches[id] : undefined;
  if (local === undefined || local === ref) return [ref];
  try {
    execFileSync('git', ['rev-parse', '--verify', '-q', local], { cwd: root, ...GIT_QUIET });
    return [ref, local];
  } catch {
    return [ref];
  }
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

/** D-07: the default branch is the first of origin/HEAD, origin/main, origin/master naming a commit; its valid `branch` is a template in force. */
function gitDefaultBranch(root: string): { exists: boolean; template?: string } {
  const refs = ['refs/remotes/origin/HEAD', 'refs/remotes/origin/main', 'refs/remotes/origin/master'];
  let out: Buffer;
  try {
    out = execFileSync('git', ['-c', 'credential.interactive=never', 'cat-file', '--batch'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
      input: refs.map((r) => r + '\n' + r + ':accord/config.yml\n').join(''),
    });
  } catch {
    return { exists: true };
  }
  let at = 0;
  const next = (): { type: string; body: string } | undefined => {
    const nl = out.indexOf(10, at);
    if (nl < 0) return undefined;
    const m = /^[0-9a-f]+ (\w+) (\d+)$/.exec(out.toString('utf8', at, nl));
    if (m === null) {
      at = nl + 1; // `<name> missing`
      return { type: 'missing', body: '' };
    }
    const size = Number(m[2]);
    const body = out.toString('utf8', nl + 1, nl + 1 + size);
    at = nl + 1 + size + 1;
    return { type: m[1] as string, body };
  };
  for (let i = 0; i < refs.length; i++) {
    const head = next();
    const config = next();
    if (head === undefined || config === undefined) break;
    if (head.type === 'commit') return { exists: true, ...(config.type === 'blob' && branchTemplateOf(config.body) !== undefined ? { template: branchTemplateOf(config.body) as string } : {}) };
  }
  return { exists: false };
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

function loadParts(root: string, stage = false, light = false): {
  input: SnapshotInput;
  claimRefs: Record<string, string>;
  templates: string[];
  known: (id: string) => boolean;
  statusOf: (id: string) => string | undefined;
} {
  const tree = gitTree(root);
  const files = accordFiles(root);
  // First pass reads the config; the tokens file and the test report are read the same way,
  // and a missing one is lint's concern (LINT-04, FMT-11).
  const first = loadSnapshot({ files, tree });
  const config = first.config;
  for (const value of [config?.design.tokens, config?.tests?.report]) {
    const key = containedPath(root, value);
    if (key !== undefined) files[key] = readFileSync(join(root, key), 'utf8');
  }
  const defaultBranch = gitDefaultBranch(root);
  const branchTemplates = [...new Set([DEFAULT_BRANCH_TEMPLATE, defaultBranch.template, config?.branch].filter((t): t is string => t !== undefined))];
  const known = (id: string) => Object.hasOwn(first.tickets, id);
  const statusOf = (id: string) => first.tickets[id]?.frontmatter?.status;
  // The prompt-expansion hook reads only the tickets, the config and the branch templates; each git spawn it skips is ~50 ms on Windows.
  if (light) return { input: { files, tree, ...(branchTemplates.length === 1 ? {} : { branchTemplates }) }, claimRefs: {}, templates: branchTemplates, known, statusOf };
  const facts = gitFacts(root);
  const git = facts === undefined ? undefined : { commit: facts.commit, authors: facts.authors };
  const { claims, branches: claimBranches, refs: claimRefs, activity: branchActivity } = gitClaims(root, branchTemplates, known);
  // D-09: a new claim is named by the default branch's template; only a repository with no default branch uses the working tree's.
  const claimTemplate = (defaultBranch.exists ? defaultBranch.template : config?.branch) ?? DEFAULT_BRANCH_TEMPLATE;
  const lastActivity: Record<string, number> = { ...facts?.activity };
  for (const [id, t] of Object.entries(branchActivity)) if (t > (lastActivity[id] ?? 0)) lastActivity[id] = t;
  // ST-LN-26: the commits after verify, for the ticket on this branch (HEAD) and for each claimed ticket (its tips).
  const afterWanted: Record<string, { commit: string; tips: string[] }> = {};
  // Only a ticket with a start commit or a review.md needs its tips, so the branch and the claim tips are read for those alone.
  const starts = Object.keys(first.tickets).flatMap((id) => {
    const start = startOf(first, id);
    return start === undefined && !Object.hasOwn(files, `accord/tickets/${id}/review.md`) ? [] : [{ id, start }];
  });
  const current = starts.length === 0 ? undefined : currentBranch(root);
  const own = current === undefined || current === '' ? undefined : ticketOfBranch(current, branchTemplates, known);
  for (const { id, start } of starts) {
    const tips = id === own ? ['HEAD'] : Object.hasOwn(claimRefs, id) ? claimTips(root, id, claimRefs[id], claimBranches) : undefined;
    if (tips === undefined) continue;
    const commit = start ?? reviewStartOf(root, id, tips);
    if (commit !== undefined) afterWanted[id] = { commit, tips };
  }
  const afterVerify = gitAfterVerify(root, afterWanted);
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
  return { input, claimRefs, templates: branchTemplates, known, statusOf };
}

export function loadFromFs(root: string, options: { stage?: boolean; light?: boolean } = {}): SnapshotInput {
  return loadParts(root, options.stage === true, options.light === true).input;
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
export function loadClaimView(root: string): { checkout: SnapshotInput; view: SnapshotInput } {
  const { input: checkout, claimRefs, templates, known, statusOf } = loadParts(root, true);
  const env = { ...process.env, GIT_NO_LAZY_FETCH: '1' };
  const current = currentBranch(root);
  const own = current === undefined || current === '' ? undefined : ticketOfBranch(current, templates, known);
  // One spawn for the merged set; a failure (an unborn HEAD) leaves it empty, as a non-ancestor.
  let merged = new Set<string>();
  const refNames = Object.values(claimRefs);
  if (refNames.length > 0) {
    try {
      const listed = execFileSync('git', ['for-each-ref', '--merged', 'HEAD', '--format=%(refname)', ...refNames], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env,
      });
      merged = new Set(listed.split('\n').filter((l) => l !== ''));
    } catch {
      // unborn HEAD or git failure: nothing is merged
    }
  }
  // A squash or rebase merge leaves the claim tip unmerged: a terminal checkout copy is never superseded.
  const terminal = (id: string) => ['archived', 'dropped'].includes(statusOf(id) ?? '');
  const candidates = Object.entries(claimRefs).filter(([id, ref]) => id !== own && !merged.has(ref) && !terminal(id));
  if (candidates.length === 0) return { checkout, view: checkout };
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
  const files = { ...checkout.files };
  const planFacts = { ...checkout.planFacts };
  for (const [id, ref] of candidates) {
    if (read.get(ref + ':' + recordPaths(id)[0]) === undefined) continue;
    const planPath = 'accord/tickets/' + id + '/plan.md';
    if (read.get(ref + ':' + planPath) === undefined) delete planFacts[id];
    else {
      let subject = '';
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
      planFacts[id] = { ...(subject === '' ? {} : { subject }), clean: true };
    }
    for (const path of recordPaths(id)) {
      const text = read.get(ref + ':' + path);
      if (text === undefined) delete files[path];
      else files[path] = text;
    }
  }
  // The start commit of a candidate is the one its own branch records, so it is read from the overlaid texts.
  const afterWanted: Record<string, { commit: string; tips: string[] }> = {};
  for (const [id, ref] of candidates) {
    const t = files[recordPaths(id)[0]];
    const v = files[recordPaths(id)[4]];
    if (t === undefined) continue;
    const tips = claimTips(root, id, ref, checkout.claimBranches ?? {});
    const commit =
      startOf(loadSnapshot({ files: { [recordPaths(id)[0]]: t, ...(v === undefined ? {} : { [recordPaths(id)[4]]: v }) }, tree: [] }), id) ??
      (files[recordPaths(id)[3]] === undefined ? undefined : reviewStartOf(root, id, tips));
    if (commit !== undefined) afterWanted[id] = { commit, tips };
  }
  const afterVerify: Record<string, AfterVerify> = { ...checkout.afterVerify };
  for (const [id] of candidates) delete afterVerify[id];
  Object.assign(afterVerify, gitAfterVerify(root, afterWanted));
  const rest: SnapshotInput = { ...checkout };
  delete rest.afterVerify;
  return { checkout, view: { ...rest, files, planFacts, ...(Object.keys(afterVerify).length === 0 ? {} : { afterVerify }) } };
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
  const opts = { cwd: root, encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'] };
  const resolves = (ref: string): boolean => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '-q', ref], opts);
      return true;
    } catch {
      return false;
    }
  };
  try {
    const head = execFileSync('git', ['symbolic-ref', '-q', 'refs/remotes/origin/HEAD'], opts).trim();
    if (resolves(head)) return head;
  } catch {
    // no origin/HEAD
  }
  return ['refs/remotes/origin/main', 'refs/remotes/origin/master'].find(resolves);
}

/** The utf8 text of each existing `<ref>:<path>`, read with one `git cat-file --batch`; a missing path is left out. */
export function gitFilesAt(root: string, ref: string, paths: readonly string[]): Record<string, string> {
  if (paths.length === 0) return {};
  let out: Buffer;
  try {
    out = execFileSync('git', ['cat-file', '--batch'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      input: paths.map((p) => ref + ':' + p + '\n').join(''),
    });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? '').trim();
    throw new UsageError('git cat-file failed reading ' + ref + (stderr === '' ? '' : '\n' + stderr));
  }
  const files: Record<string, string> = {};
  let at = 0;
  for (const path of paths) {
    const nl = out.indexOf(10, at);
    if (nl < 0) break;
    const m = /^[0-9a-f]+ blob (\d+)$/.exec(out.toString('utf8', at, nl));
    if (m === null) {
      at = nl + 1; // `<name> missing`
      continue;
    }
    const size = Number(m[1]);
    files[path] = out.toString('utf8', nl + 1, nl + 1 + size);
    at = nl + 1 + size + 1;
  }
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
  const filesAt = (ref: string, paths: readonly string[]): Record<string, string> => {
    try {
      return gitFilesAt(root, ref, paths);
    } catch (err) {
      const rest = (err as Error).message.split('\n').slice(1).join('\n');
      throw new Error(`git cat-file failed reading the branch diff: ${firstLine(rest === '' ? (err as Error).message : rest)}`, { cause: err });
    }
  };
  try {
    const def = defaultRefOf(root);
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
    const pkgBase = filesAt(base, pkgPaths.filter((c) => c.kind !== 'added').map((c) => c.path));
    const pkgHead = filesAt('HEAD', pkgPaths.filter((c) => c.kind !== 'deleted').map((c) => c.path));
    for (const c of pkgPaths) {
      c.pkg = { ...(pkgBase[c.path] === undefined ? {} : { base: pkgBase[c.path] }), ...(pkgHead[c.path] === undefined ? {} : { head: pkgHead[c.path] }) };
    }

    let scope: { commit: string; paths: string[] } | undefined;
    if (opts.scope) {
      const file = 'accord/tickets/' + id + '.md';
      const first = git('log -G ac_hash', [
        '-c', 'log.showSignature=false', 'log', '--no-show-signature', '--reverse', '--format=%H', '-G', '^ac_hash:', 'HEAD', '--', ':(literal)' + file,
      ])
        .split('\n')
        .find((l) => l.trim() !== '')
        ?.trim();
      if (first !== undefined && isSha(first)) {
        const text = filesAt(first, [file])[file];
        scope = { commit: first, paths: text === undefined ? [] : (scopeLines(text) ?? []) };
      }
    }

    const live = changes.filter((c) => c.kind !== 'deleted').map((c) => c.path);
    const rendered = opts.rendered.filter((r) => live.includes(r.path));
    const settingsPath = opts.settings !== undefined && live.includes(opts.settings.path) ? opts.settings.path : undefined;
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
  return { files: gitFilesAt(root, ref, kept), tree: kept };
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
