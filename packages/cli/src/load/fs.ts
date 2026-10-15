// D-51 filesystem loader: a repository root becomes a SnapshotInput through `git ls-files` and readdir.
// Impure by design (node:fs, node:path, node:child_process are allowed in the CLI package).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { branchTemplateOf, DEFAULT_BRANCH_TEMPLATE, isSha, loadSnapshot, peopleOf } from '@accord-dev/accord-core';
import type { SnapshotInput } from '@accord-dev/accord-core';

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
function gitFacts(root: string): { commit: string; authors: Record<string, string>; activity: Record<string, number> } | undefined {
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let head: string;
  try {
    head = git(['show', '-s', '--format=%H%x00%ae', 'HEAD']);
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
  let log: string;
  try {
    // One bounded walk over one subtree in one spawn (T-04-23).
    log = git(['log', '--format=%x01%ae%x00%ct','--name-only', '--', 'accord/tickets']);
  } catch {
    log = '';
  }
  let author: string | undefined;
  let time = 0;
  for (const line of log.split('\n')) {
    const text = line.trim();
    if (text === '') continue;
    if (text.startsWith('')) {
      const [email, ct] = text.slice(1).split('\0');
      author = email;
      time = Number(ct);
    }
    // git log emits the most recent commit first, so the first author seen for a path is the latest.
    else if (author !== undefined) {
      const key = text.split(sep).join('/');
      if (!Object.hasOwn(authors, key)) authors[key] = author;
      const id = /^accord\/tickets\/([^/]+?)(?:\.md$|\/)/.exec(key)?.[1];
      if (id !== undefined && time > (activity[id] ?? 0)) activity[id] = time;
    }
  }
  // D-78: the gated commit's author rides under a key equal to the sha, which cannot collide with a path.
  authors[commit] = commitAuthor;
  return { commit, authors, activity };
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
): { claims: Record<string, string>; branches: Record<string, string>; activity: Record<string, number> } {
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
  const winners = new Map<string, { email: string; short: string; pushed: boolean; when: number }>();
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
    const cur = { email: email.replace(/^<|>$/g, ''), short: m[2], pushed: m[1] === undefined, when };
    const prev = winners.get(id);
    if (prev === undefined || (cur.pushed && !prev.pushed) || (cur.pushed === prev.pushed && cur.when > prev.when)) winners.set(id, cur);
  }
  const claims: Record<string, string> = Object.create(null);
  const branches: Record<string, string> = Object.create(null);
  for (const [id, w] of winners) {
    claims[id] = w.email;
    branches[id] = w.short;
  }
  return { claims, branches, activity };
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

export function loadFromFs(root: string): SnapshotInput {
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
  const facts = gitFacts(root);
  const git = facts === undefined ? undefined : { commit: facts.commit, authors: facts.authors };
  const shas = [
    ...new Set(Object.values(first.work ?? {}).flatMap((w) => (w.plan?.baseline !== undefined && isSha(w.plan.baseline) ? [w.plan.baseline] : []))),
  ];
  const defaultBranch = gitDefaultBranch(root);
  const branchTemplates = [...new Set([DEFAULT_BRANCH_TEMPLATE, defaultBranch.template, config?.branch].filter((t): t is string => t !== undefined))];
  const { claims, branches: claimBranches, activity: branchActivity } = gitClaims(root, branchTemplates, (id) => Object.hasOwn(first.tickets, id));
  // D-09: a new claim is named by the default branch's template; only a repository with no default branch uses the working tree's.
  const claimTemplate = (defaultBranch.exists ? defaultBranch.template : config?.branch) ?? DEFAULT_BRANCH_TEMPLATE;
  const lastActivity: Record<string, number> = { ...facts?.activity };
  for (const [id, t] of Object.entries(branchActivity)) if (t > (lastActivity[id] ?? 0)) lastActivity[id] = t;
  const ancestors = shas.length === 0 ? undefined : gitAncestors(root, shas);
  const wanted: Record<string, string[]> = {};
  for (const plan of Object.values(first.work ?? {}).flatMap((w) => (w.plan === undefined ? [] : [w.plan]))) {
    const sha = plan.baseline;
    if (sha === undefined || !isSha(sha)) continue;
    const mine = plan.tasks.flatMap((t) => t.files.filter((f) => !t.newFiles.includes(f)));
    wanted[sha] = [...new Set([...(wanted[sha] ?? []), ...mine])];
  }
  const baselineFiles = ancestors === undefined ? {} : gitBaselineFiles(root, wanted, ancestors);
  // A recorded sha equal to HEAD is included: its diff is empty and the rule never reads it.
  const recorded = [
    ...new Set(
      [
        ...Object.values(first.tickets).map((t) => t.frontmatter?.verified_commit),
        ...Object.values(first.verifications).map((v) => v.frontmatter?.commit),
      ].filter((c): c is string => c !== undefined && isSha(c)),
    ),
  ];
  const recordsSince = recorded.length === 0 ? {} : gitRecordsSince(root, recorded);
  return {
    files,
    tree,
    ...(branchTemplates.length === 1 ? {} : { branchTemplates }),
    ...(git === undefined ? {} : { git }),
    // Omitted when empty, so a repository with no ticket branch loads exactly as before.
    ...(Object.keys(claims).length === 0 ? {} : { claims, claimBranches }),
    ...(claimTemplate === DEFAULT_BRANCH_TEMPLATE ? {} : { claimTemplate }),
    ...(Object.keys(lastActivity).length === 0 ? {} : { lastActivity }),
    ...(ancestors === undefined ? {} : { ancestors }),
    ...(Object.keys(baselineFiles).length === 0 ? {} : { baselineFiles }),
    ...(Object.keys(recordsSince).length === 0 ? {} : { recordsSince }),
  };
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
    raw = execFileSync('git', ['log', '--all', '--full-history', '--no-renames', '--format=', '--name-only', '--', 'accord/tickets'], opts);
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
  let defaultRef: string | undefined;
  try {
    const head = execFileSync('git', ['symbolic-ref', '-q', 'refs/remotes/origin/HEAD'], { ...opts, encoding: 'utf8' }).trim();
    if (refs.includes(head)) defaultRef = head;
  } catch {
    // no origin/HEAD
  }
  defaultRef ??= ['refs/remotes/origin/main', 'refs/remotes/origin/master'].find((r) => refs.includes(r));
  return defaultRef === undefined ? { byRef } : { byRef, defaultRef };
}
