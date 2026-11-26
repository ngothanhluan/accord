// Phase 15 D-23, D-25: the host half of "a done ticket is not edited". Reads, for the gated ticket, whether it is done at the merge base of HEAD with the default branch and the text of
// every record of its file and folder at that commit and at HEAD; the pure core rule (`gate.done-ticket-edited`) compares them. Never throws and never guesses: no default ref, no merge
// base, HEAD being the merge base itself, an unsafe id or any git failure supplies no fact, and `gate done` then runs today's Done rules. A-WR-04: when the fact is missing for a reason other
// than "nothing to compare" (no default ref found, no merge base, a git failure) one line says so (`done-ticket freeze not checked: <why>`), so the freeze is never switched off in silence.
import { execFileSync } from 'node:child_process';
import { isDone, normaliseText, SAFE_BRANCH, SAFE_ID } from '@accord-dev/accord-core';
import type { BaseRecords, RepoSnapshot } from '@accord-dev/accord-core';
import { defaultRefOf, gitFilesAt, mergeBaseOf, snapshotAt } from './fs.js';

/** Every path under `accord/tickets/<id>/` that `commit` holds, from one NUL-separated `git ls-tree`; the folder is matched literally. */
function folderAt(root: string, commit: string, id: string): string[] {
  const raw = execFileSync('git', ['--literal-pathspecs', 'ls-tree', '-r', '-z', '--name-only', commit, '--', 'accord/tickets/' + id + '/'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  return raw.split('\0').filter((p) => p !== '');
}

/** The texts of `paths` at `commit`, line endings normalised as the loader reads them. */
function textsAt(root: string, commit: string, paths: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(gitFilesAt(root, commit, paths))) out[path] = normaliseText(text);
  return out;
}

/** Whether `ref` names a commit in this clone. */
function resolves(root: string, ref: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', '-q', ref + '^{commit}'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * A-WR-04: the default ref the freeze is read against. The loader's `defaultRefOf` first (origin/HEAD when it is symbolic and resolves, origin/main, origin/master, a local main or master); when none
 * of those exists, as in the CI checkout of a repository whose default branch is `develop` or `trunk` (it makes no origin/HEAD), the pull request's target branch that GitHub Actions names in
 * `GITHUB_BASE_REF`, then git's configured `init.defaultBranch`, each as origin's copy first and a local branch second. A name that is not a plain branch name is never passed to git.
 */
function baseDefaultRef(root: string, env: NodeJS.ProcessEnv): string | undefined {
  const found = defaultRefOf(root);
  if (found !== undefined) return found;
  const names: string[] = [];
  const target = env.GITHUB_BASE_REF;
  if (target !== undefined) names.push(target);
  try {
    names.push(execFileSync('git', ['config', '--get', 'init.defaultBranch'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch {
    // no configured default
  }
  for (const name of names) {
    if (name === '' || name.startsWith('-') || name.includes('..') || !SAFE_BRANCH.test(name)) continue;
    for (const ref of ['refs/remotes/origin/' + name, 'refs/heads/' + name]) if (resolves(root, ref)) return ref;
  }
  return undefined;
}

/** What `gitBaseRecords` may be given: the environment to read `GITHUB_BASE_REF` from and where to print the one line that says the freeze was not checked. */
export interface BaseRecordsOptions {
  env?: NodeJS.ProcessEnv;
  warn?: (line: string) => void;
}

/**
 * The base fact of ticket `id` for `gate done`: `{ baseRecords: { [id]: ... } }`, or `{}` when git cannot say. `done` is read from the ticket's records at the merge base (the
 * same reading the dashboard makes of the default branch), and the record texts are read only for a ticket that is done there.
 */
export function gitBaseRecords(root: string, snapshot: RepoSnapshot, id: string, options: BaseRecordsOptions = {}): { baseRecords?: Record<string, BaseRecords> } {
  void snapshot;
  if (!SAFE_ID.test(id)) return {};
  const skipped = (why: string): Record<string, never> => {
    options.warn?.(`done-ticket freeze not checked: ${why}`);
    return {};
  };
  try {
    const def = baseDefaultRef(root, options.env ?? {});
    if (def === undefined) return skipped('no default branch found in this clone (no origin/HEAD, origin/main, origin/master, main, master, GITHUB_BASE_REF or init.defaultBranch that resolves); fetch origin or name the branch');
    let base: string;
    try {
      base = mergeBaseOf(root, def, 'HEAD');
    } catch {
      return skipped(`no merge base of HEAD with ${def.replace(/^refs\/(?:remotes\/|heads\/)?/, '')}; a shallow checkout needs the full history (fetch-depth: 0)`);
    }
    if (base === '') return skipped(`no merge base of HEAD with ${def.replace(/^refs\/(?:remotes\/|heads\/)?/, '')}`);
    // On the default branch itself, or a branch with no commit of its own, HEAD is the base: nothing was edited and nothing is frozen, so today's Done rules judge the ticket as they always did.
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (head === base) return {};
    const done = isDone(snapshotAt(root, base, [id]), id);
    if (!done) return { baseRecords: { [id]: { base, done, records: {}, head: {} } } };
    const file = 'accord/tickets/' + id + '.md';
    const paths = [...new Set([file, ...folderAt(root, base, id), ...folderAt(root, 'HEAD', id)])];
    return { baseRecords: { [id]: { base, done, records: textsAt(root, base, paths), head: textsAt(root, 'HEAD', paths) } } };
  } catch (err) {
    const said = String((err as { stderr?: unknown }).stderr ?? (err as { message?: unknown }).message ?? err).trim();
    return skipped('git failed: ' + ((said.split(/\r?\n/)[0] ?? '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, 160) || 'unknown error'));
  }
}
