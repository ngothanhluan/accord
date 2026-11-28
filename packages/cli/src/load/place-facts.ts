// Phase 10 D-14, 10-ac-21, T-10-07: whether each place a plan or approach finding answers `does not hold: <path>:<line>` exists in the working tree. The place comes from a record the planner writes, so it is read as untrusted: only
// a relative `/` path with no empty, `.` or `..` segment, no backslash and no control character, with no link on the way (every part is checked with `lstat`, so a link to a file or to a folder is neither a file nor a folder), that
// ends at a regular file with at least that many lines, exists. Reading stops after the cited line (and after PLACE_READ_CAP bytes), so a large file costs one line's worth of bytes. No git is spawned and nothing is written.
import { closeSync, fstatSync, lstatSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { DOES_NOT_HOLD_FROM, claimPinBefore, placeKey, workOf } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';

/** The most bytes read to find a cited line; a file whose cited line lies further in is a place that does not exist. */
const PLACE_READ_CAP = 16 * 1024 * 1024;
const CHUNK = 64 * 1024;

/** True when `path` is a relative `/` path of plain segments: no empty, `.` or `..` segment, no backslash, no control character, no drive letter. */
function plainPath(path: string): boolean {
  if (path === '' || path.includes('\\') || /^[A-Za-z]:/.test(path)) return false;
  for (let i = 0; i < path.length; i++) if (path.charCodeAt(i) < 0x20 || path.charCodeAt(i) === 0x7f) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** True when the file at `path` has a line `line` (1-based): `line` line breaks, or fewer and a last line with no break after it. Reads no further than that line. */
function hasLine(path: string, line: number): boolean {
  let fd: number;
  try {
    fd = openSync(path, 'r');
  } catch {
    return false;
  }
  try {
    if (!fstatSync(fd).isFile()) return false;
    const buffer = Buffer.alloc(CHUNK);
    let breaks = 0;
    let read = 0;
    let last = 0;
    for (;;) {
      const n = readSync(fd, buffer, 0, CHUNK, null);
      if (n === 0) break;
      for (let i = 0; i < n; i++) if (buffer[i] === 10 && ++breaks >= line) return true;
      last = buffer[n - 1];
      read += n;
      if (read >= PLACE_READ_CAP) return false;
    }
    return read > 0 && last !== 10 && breaks + 1 >= line;
  } catch {
    return false;
  } finally {
    closeSync(fd);
  }
}

/** True when `file:line` names a line of a regular file inside the working tree at `root`, by a plain path with no link on the way. */
export function placeExists(root: string, file: string, line: number): boolean {
  if (!plainPath(file) || !Number.isSafeInteger(line) || line < 1) return false;
  const parts = file.split('/');
  for (let i = 0; i < parts.length; i++) {
    let found;
    try {
      found = lstatSync(join(root, ...parts.slice(0, i + 1)));
    } catch {
      return false;
    }
    if (i === parts.length - 1 ? !found.isFile() : !found.isDirectory()) return false; // lstat: a link is neither a file nor a folder
  }
  return hasLine(join(root, ...parts), line);
}

/**
 * `snapshot` with `places[id]` set for every place the approach and plan records of ticket `id` cite in a `does not hold` answer, each `<path>:<line>` mapped to whether it exists in the working tree at `root`; or `snapshot` itself
 * for a ticket claimed before DOES_NOT_HOLD_FROM (it reads the segment as an open finding and needs no fact) and for a ticket whose records cite no place. Core reads the fact in round/answers.ts.
 */
export function withPlaceFacts(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  if (!Object.hasOwn(snapshot.tickets, id) || claimPinBefore(snapshot, id, DOES_NOT_HOLD_FROM)) return snapshot;
  const work = workOf(snapshot, id);
  const facts = new Map<string, boolean>();
  for (const rec of [work?.approachRounds, work?.planRounds]) {
    for (const cycle of rec?.cycles ?? []) {
      for (const round of cycle.rounds) {
        for (const f of round.findings) {
          if (f.state !== 'notHeld' || f.notHeld === undefined) continue;
          const key = placeKey(f.notHeld.file, f.notHeld.line);
          if (!facts.has(key)) facts.set(key, placeExists(root, f.notHeld.file, f.notHeld.line));
        }
      }
    }
  }
  if (facts.size === 0) return snapshot;
  return { ...snapshot, places: { ...snapshot.places, [id]: Object.fromEntries(facts) } };
}
