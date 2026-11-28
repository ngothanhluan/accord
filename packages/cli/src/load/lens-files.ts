// Phase 11 D-04, D-05, Ruling R4: the one reader of team lens files (accord/lenses/<name>.md). The lenses of a review are the default branch's, as the conventions are (Phase 8.5 D-01, D-07), so a ticket
// branch that edits or deletes a lens cannot change its own review. A file is read only when git's tree lists it as mode 100644 or 100755, by the object id that listing gave: a link is never opened.
// With no default ref the checkout's own files are read (plain files only, a link or a junction never followed) and `note: 'no-default-ref'` says so. git only, literal arrays, no shell, nothing here writes.
import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LENS_DIR } from '@accord-dev/accord-core';

export interface LensRead {
  /** The lens files, `path` as `accord/lenses/<name>.md`, in path order. */
  lenses: { path: string; text: string }[];
  /** `no-default-ref` when the files are the checkout's because no default branch could be read. */
  note?: 'no-default-ref';
  /** Names of lens files the checkout holds that the default branch does not: they apply after the branch merges. */
  branchOnly: string[];
}

const git = (root: string, args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** git's listing of one tree entry: `<mode> <type> <oid>\t<path>`. */
const ENTRY = /^(\d{6}) (\w+) ([0-9a-f]{40,64})\t(.+)$/s;
const REGULAR_MODES = ['100644', '100755'];
/** A lens file directly under the folder: `accord/lenses/<name>.md`. */
const LENS_PATH = /^accord\/lenses\/[^/]+\.md$/;

const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * The lens files of the checkout: `accord/` and `accord/lenses/` must each be a plain folder (a link is never followed), and each `<name>.md` a plain file. Anything else is left out, never opened.
 * Folder missing or unreadable: none.
 */
function workingLenses(root: string): { path: string; text: string }[] {
  try {
    for (const part of ['accord', 'accord/lenses']) {
      const found = lstatSync(join(root, ...part.split('/')), { throwIfNoEntry: false });
      if (found === undefined || !found.isDirectory()) return [];
    }
    const out: { path: string; text: string }[] = [];
    for (const name of readdirSync(join(root, 'accord', 'lenses'))) {
      if (!name.endsWith('.md')) continue;
      const file = join(root, 'accord', 'lenses', name);
      const found = lstatSync(file, { throwIfNoEntry: false });
      if (found === undefined || !found.isFile()) continue;
      try {
        out.push({ path: LENS_DIR + name, text: readFileSync(file, 'utf8') });
      } catch {
        // gone between the listing and the read, or not readable: not a lens this run
      }
    }
    return out.sort(byPath);
  } catch {
    return [];
  }
}

/**
 * R4: the lens files at `defaultRef`'s tree (regular blobs only). `defaultRef` undefined, starting with `-`, or any git failure gives the checkout's files with note `no-default-ref` and never throws.
 * `branchOnly` names the checkout's lens files the default branch's tree does not list at all.
 */
export function readLensFiles(root: string, defaultRef: string | undefined): LensRead {
  const fallback = (): LensRead => ({ lenses: workingLenses(root), note: 'no-default-ref', branchOnly: [] });
  if (defaultRef === undefined || defaultRef.startsWith('-')) return fallback();
  let listing: string;
  try {
    listing = git(root, ['--literal-pathspecs', 'ls-tree', '-z', defaultRef, '--', LENS_DIR]);
  } catch {
    return fallback();
  }
  const lenses: { path: string; text: string }[] = [];
  // every lens-named entry of the default branch's tree, a link included: a link is never read, and it is not a file the branch added
  const listed = new Set<string>();
  for (const entry of listing.split('\0')) {
    if (entry === '') continue;
    const m = ENTRY.exec(entry);
    if (m === null || !LENS_PATH.test(m[4])) continue;
    listed.add(m[4]);
    if (m[2] !== 'blob' || !REGULAR_MODES.includes(m[1])) continue;
    try {
      lenses.push({ path: m[4], text: git(root, ['cat-file', 'blob', m[3]]) });
    } catch {
      // an object that cannot be read is not a lens this run
    }
  }
  lenses.sort(byPath);
  const branchOnly = workingLenses(root)
    .filter((l) => !listed.has(l.path))
    .map((l) => l.path.slice(LENS_DIR.length, -3));
  return { lenses, branchOnly };
}
