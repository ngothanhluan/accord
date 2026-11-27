// Phase 15 D-07, D-31: the stacked slice branches of one ticket. A later slice n lives on `slice/<id>/<n>`, cut at the tip of the previous slice's branch. Phase 08.9.3 D-14: which slice the claim branch holds, and
// where each other slice lives, is `sliceHome` of core's say; `slice/<id>/1` now parses too, for slice 1 of another repository (this repository never gets one).
// A `slice/` name matches no claim template, so no reader takes it for a claim of another ticket (Pitfall 4); the readers that map a branch to its ticket ask `sliceOfBranch`.
// The CLI records each slice branch it opens in `<git common dir>/accord/slices`, one `<id> <n> <start sha>[ <repo>]` line (the optional fourth column names the repository whose clone holds the branch, Phase 08.9.3), beside `worktrees` and `holds` and under the same lock and atomic write.
// A leaf module (no import of load/fs.ts), so the loader and `accord worktree` both import it; a failed write throws a plain Error and the caller says what it was for.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { REPO_NAME, SAFE_ID, sliceBranchName } from '@accord-dev/accord-core';
import { gitDirsOf } from './gitdir.js';

/** The number a person types to `accord worktree slice <id> <n>`: 2 to 99, no sign, point or leading zero (plan 08.9.3-06 converts that command to `sliceHome`). */
const SLICE_ARG = /^([2-9]|[1-9][0-9])$/;
/** The slice number of a branch name: 1 to 99 (a `slice/<id>/1` is slice 1 of another repository's clone). */
const SLICE_BRANCH = /^slice\/([A-Za-z0-9][A-Za-z0-9._-]*)\/([1-9]|[1-9][0-9])$/;

/** The ticket id and slice number a `slice/<id>/<n>` branch name carries, or undefined for any other name. */
export function sliceOfBranch(name: string): { id: string; n: number } | undefined {
  const m = SLICE_BRANCH.exec(name);
  return m === null ? undefined : { id: m[1], n: Number(m[2]) };
}

/** The number of a typed slice argument when it is 2 to 99, else undefined. */
export const sliceNumber = (arg: string): number | undefined => (SLICE_ARG.test(arg) ? Number(arg) : undefined);

/** The branch of slice `n` of ticket `id` (core's `sliceBranchName`); throws when either could not name a slice branch (T-15-31: no name is built from anything else). */
export function sliceBranch(id: string, n: number): string {
  const name = sliceBranchName(id, n);
  if (name === undefined) throw new Error(`not a slice branch: ${id} ${n}`);
  return name;
}

export interface SliceRecord {
  id: string;
  n: number;
  start: string;
  repo?: string; // Phase 08.9.3 D-14: the repository whose clone holds the branch; absent for this repository and for every line Phase 15 wrote
}

const LINE = /^(\S+) ([1-9]|[1-9][0-9]) ([0-9a-f]{7,64})(?: ([a-z][a-z0-9-]+))?$/;

/** The record lines that read as `<id> <n> <start sha>` with an optional fourth column `<repo>`; any other line is skipped when read and kept when rewritten. */
function parse(text: string): SliceRecord[] {
  const out: SliceRecord[] = [];
  for (const l of text.split('\n')) {
    const m = LINE.exec(l);
    if (m !== null && SAFE_ID.test(m[1])) out.push({ id: m[1], n: Number(m[2]), start: m[3], ...(m[4] === undefined ? {} : { repo: m[4] }) });
  }
  return out;
}

const folderOf = (root: string): string => {
  const dirs = gitDirsOf(root);
  if (dirs === undefined) throw new Error(`${root} has no readable .git folder`);
  return dirs.commonDir + '/accord';
};

/** The record without a lock (it is written by rename); a missing file, or a checkout whose git folders cannot be read, gives `[]`. */
export function readSlices(root: string): SliceRecord[] {
  const dirs = gitDirsOf(root);
  if (dirs === undefined) return [];
  const file = dirs.commonDir + '/accord/slices';
  try {
    return existsSync(file) ? parse(readFileSync(file, 'utf8')) : [];
  } catch {
    return [];
  }
}

/** The same exclusive lock `accord worktree` takes for the holds file and the worktree record (`holds.lock`), so no two accord commands write the records at once. */
function withLock<T>(root: string, fn: (dir: string) => T): T {
  const dir = folderOf(root);
  const lock = dir + '/holds.lock';
  mkdirSync(dir, { recursive: true });
  const stop = Date.now() + 2000;
  let fd: number | undefined;
  while (fd === undefined) {
    try {
      fd = openSync(lock, 'wx');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (Date.now() > stop) throw new Error('the hold file is locked by another accord command: ' + lock + ' - if none is running, delete that file', { cause: e });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    return fn(dir);
  } finally {
    closeSync(fd);
    rmSync(lock, { force: true });
  }
}

function write(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** Record the slice branch accord opened, with the repository whose clone holds it when that is not this one; a line for the same id and number is not written twice. Throws a plain Error when the lock or the write fails. */
export function recordSlice(root: string, id: string, n: number, start: string, repo?: string): void {
  sliceBranch(id, n);
  if (!/^[0-9a-f]{7,64}$/.test(start)) throw new Error('not a commit: ' + start);
  if (repo !== undefined && !REPO_NAME.test(repo)) throw new Error('not a repository name: ' + repo);
  withLock(root, (dir) => {
    const file = dir + '/slices';
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (parse(text).some((e) => e.id === id && e.n === n)) return;
    write(file, (text === '' || text.endsWith('\n') ? text : text + '\n') + `${id} ${n} ${start}${repo === undefined ? '' : ' ' + repo}\n`);
  });
}

/** Drop the record lines of ticket `id` (all its slices, or only slice `n`); nothing is written when there are none. */
export function dropSlices(root: string, id: string, n?: number): void {
  const dirs = gitDirsOf(root);
  if (dirs === undefined || !existsSync(dirs.commonDir + '/accord/slices')) return;
  withLock(root, (dir) => {
    const file = dir + '/slices';
    if (!existsSync(file)) return;
    const lines = readFileSync(file, 'utf8').split('\n');
    const keep = lines.filter((l) => {
      const m = LINE.exec(l);
      return !(m !== null && m[1] === id && (n === undefined || Number(m[2]) === n));
    });
    if (keep.length !== lines.length) write(file, keep.join('\n'));
  });
}
