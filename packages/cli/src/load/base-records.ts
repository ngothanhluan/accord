// Phase 15 D-23, D-25: the host half of "a done ticket is not edited". Reads, for the gated ticket, whether it is done at the merge base of HEAD with the default branch and the text of
// every record of its file and folder at that commit and at HEAD; the pure core rule (`gate.done-ticket-edited`) compares them. Never throws and never guesses: no default ref, no merge
// base, HEAD being the merge base itself, an unsafe id or any git failure supplies no fact, and `gate done` then runs today's Done rules.
import { execFileSync } from 'node:child_process';
import { isDone, normaliseText, SAFE_ID } from '@accord-dev/accord-core';
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

/**
 * The base fact of ticket `id` for `gate done`: `{ baseRecords: { [id]: ... } }`, or `{}` when git cannot say. `done` is read from the ticket's records at the merge base (the
 * same reading the dashboard makes of the default branch), and the record texts are read only for a ticket that is done there.
 */
export function gitBaseRecords(root: string, snapshot: RepoSnapshot, id: string): { baseRecords?: Record<string, BaseRecords> } {
  void snapshot;
  if (!SAFE_ID.test(id)) return {};
  try {
    const def = defaultRefOf(root);
    if (def === undefined) return {};
    const base = mergeBaseOf(root, def, 'HEAD');
    if (base === '') return {};
    // On the default branch itself, or a branch with no commit of its own, HEAD is the base: nothing was edited and nothing is frozen, so today's Done rules judge the ticket as they always did.
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (head === base) return {};
    const done = isDone(snapshotAt(root, base, [id]), id);
    if (!done) return { baseRecords: { [id]: { base, done, records: {}, head: {} } } };
    const file = 'accord/tickets/' + id + '.md';
    const paths = [...new Set([file, ...folderAt(root, base, id), ...folderAt(root, 'HEAD', id)])];
    return { baseRecords: { [id]: { base, done, records: textsAt(root, base, paths), head: textsAt(root, 'HEAD', paths) } } };
  } catch {
    return {};
  }
}
