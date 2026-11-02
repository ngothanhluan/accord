// ST-LN-81: the one function that judges a scout report against host facts it is given (a tracked path list and
// a read callback). Pure: no node import, no filesystem; the CLI hands it the working tree's or a commit's facts.
import { normaliseText } from '../load/frontmatter.js';
import { parseScoutReport } from './report.js';

export interface ScoutFacts {
  path?: string; // the report's repository path, when it lies inside the repository
  text: string; // the report
  tracked: readonly string[]; // every path git tracks, posix
  read: (paths: readonly string[]) => (string | undefined)[]; // text of each tracked path, undefined when unreadable
  config?: string; // the working tree's accord/config.yml text
  rendered?: readonly string[]; // the paths accord skills sync writes
}
export interface ScoutLane {
  expected: string[];
  areas: string[];
  sensitive: { path: string; entry: string; area: string; line: number }[];
  lifts: string[];
}
export interface ScoutResult {
  failures: string[];
  lane?: ScoutLane;
  skipped?: string;
}

const SLICE = 100;
const CLAIM_CAP = 80;

/** A claim as printed: backslashes to slashes, whitespace runs to one space, cut at 80 characters with `...`. */
export function printedClaim(claim: string): string {
  const flat = claim.replace(/\\/g, '/').replace(/\s+/g, ' ');
  return flat.length > CLAIM_CAP ? flat.slice(0, CLAIM_CAP) + '...' : flat;
}

const byCodePoint = (a: string, b: string): number => {
  const x = Array.from(a);
  const y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i].codePointAt(0)! - y[i].codePointAt(0)!;
  }
  return x.length - y.length;
};

/** The lines of a file's text after BOM and CRLF normalisation, one trailing empty element dropped. */
function linesOf(text: string): string[] {
  const lines = normaliseText(text).split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Which tracked paths a list of folder or file entries covers: `\` becomes `/`, a leading `./` goes, and `.`, `/`
 * and the empty string mean the root. An entry covers a path when it is the root, ends in `/` and the path starts
 * with it, is a folder (some tracked path sits below it) the path is below, or is the path itself.
 */
function coverage(entries: readonly string[], tracked: readonly string[]): (path: string) => boolean {
  const tests = entries.map((raw) => {
    const e = raw.replace(/\\/g, '/').replace(/^\.\//, '');
    if (e === '.' || e === '/' || e === '') return (): boolean => true;
    const folder = !e.endsWith('/') && tracked.some((t) => t.startsWith(e + '/'));
    return (p: string): boolean => (e.endsWith('/') && p.startsWith(e)) || (folder && p.startsWith(e + '/')) || p === e;
  });
  return (p) => tests.some((t) => t(p));
}

/** The text of each path, read in slices of at most 100; undefined where a file cannot be read. */
function readAll(facts: ScoutFacts, paths: readonly string[]): (string | undefined)[] {
  const out: (string | undefined)[] = [];
  for (let i = 0; i < paths.length; i += SLICE) out.push(...facts.read(paths.slice(i, i + SLICE)));
  return out;
}

export function scoutCheck(facts: ScoutFacts): ScoutResult {
  const report = parseScoutReport(facts.text);
  const tracked = [...facts.tracked].sort(byCodePoint);
  const failures: string[] = [...report.faults];

  for (const row of report.absent) {
    const where = 'absent claim "' + printedClaim(row.claim) + '" (row ' + row.line + '): ';
    let pattern: RegExp;
    try {
      pattern = new RegExp(row.pattern);
    } catch {
      failures.push(where + 'its pattern is not a valid JavaScript regular expression');
      continue;
    }
    const covers = coverage(row.folders, tracked);
    const searched = tracked.filter(covers);
    if (searched.length === 0) {
      failures.push(where + 'its folders cover no tracked file');
      continue;
    }
    const allowed = coverage(row.allowed, tracked);
    const unallowed = searched.filter((p) => !allowed(p));
    const texts = readAll(facts, unallowed);
    unallowed.forEach((path, i) => {
      const text = texts[i];
      if (text === undefined) return;
      const n = linesOf(text).findIndex((l) => pattern.test(l));
      if (n >= 0) failures.push(where + path + ':' + (n + 1) + ' matches its pattern outside its allowed hits');
    });
  }

  const result: ScoutResult = { failures };
  if (report.skipped !== undefined) result.skipped = report.skipped;
  return result;
}
