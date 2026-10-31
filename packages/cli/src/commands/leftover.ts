// ST-LN-55 D-04, D-08, D-12: what may be deleted from a worktree folder that git has already unregistered.
import { lstatSync, readdirSync, rmSync, rmdirSync, unlinkSync } from 'node:fs';

/** File and folder names, matched at any depth, that an ignored path may hold and still be deleted with its worktree. */
export const DEFAULT_DISPOSABLE: readonly string[] = ['node_modules', 'dist', '.DS_Store', 'Thumbs.db'];

/** True when a segment of `rel` (a `/`-separated path relative to the worktree root, a trailing `/` dropped) is in `names`. */
export function isDisposable(rel: string, names: readonly string[]): boolean {
  return rel.replace(/\/+$/, '').split('/').some((s) => names.includes(s));
}

/** Gone: nothing at all at the path. A dangling link is not gone, which `existsSync` would say. */
export const isGone = (p: string): boolean => lstatSync(p, { throwIfNoEntry: false }) === undefined;

/** UTF-8 byte order is code point order. */
const byCodePoint = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

/**
 * The walk after git unregistered `dir`: depth first, entries in code point order, each read with `lstatSync`.
 * A link is unlinked and never followed; a folder is walked and then removed when empty; a file with a disposable
 * path is deleted; any other file stays. Returns undefined when `dir` is gone, else the first relative path that
 * stays (or whose deletion failed), else the first name left in `dir`, else `.`.
 */
export function sweepRemoved(dir: string, names: readonly string[]): string | undefined {
  if (isGone(dir)) return undefined;
  let first: string | undefined;
  const keep = (rel: string): void => {
    first ??= rel;
  };
  const walk = (abs: string, rel: string): void => {
    let list: string[];
    try {
      list = readdirSync(abs).sort(byCodePoint);
    } catch {
      keep(rel === '' ? '.' : rel);
      return;
    }
    for (const name of list) {
      const r = rel === '' ? name : `${rel}/${name}`;
      const p = `${abs}/${name}`;
      let st;
      try {
        st = lstatSync(p);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) {
        try {
          unlinkSync(p);
        } catch {
          try {
            rmdirSync(p);
          } catch {
            keep(r);
          }
        }
      } else if (st.isDirectory()) {
        walk(p, r);
        try {
          rmdirSync(p);
        } catch {
          keep(r);
        }
      } else if (isDisposable(r, names)) {
        try {
          rmSync(p);
        } catch {
          keep(r);
        }
      } else keep(r);
    }
  };
  walk(dir, '');
  try {
    rmdirSync(dir);
  } catch {
    // not empty, or a failure: reported below
  }
  if (isGone(dir)) return undefined;
  if (first !== undefined) return first;
  try {
    return readdirSync(dir).sort(byCodePoint)[0] ?? '.';
  } catch {
    return '.';
  }
}
