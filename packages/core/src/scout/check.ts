// ST-LN-81: the one function that judges a scout report against host facts it is given (a tracked path list and
// a read callback). Pure: no node import, no filesystem; the CLI hands it the working tree's or a commit's facts.
import { matches } from '../gate/scope.js';
import { configLists } from '../load/config.js';
import { normaliseText, splitFrontmatter } from '../load/frontmatter.js';
import { isResearchRecord } from '../load/research.js';
import { parseYamlMap } from '../load/yaml.js';
import { LINE_CAP, patternShape } from './pattern.js';
import { parseScoutReport } from './report.js';
import type { Citation } from './report.js';

export interface ScoutFacts {
  path?: string; // the report's repository path, when it lies inside the repository
  ticket?: string; // the id of the ticket the report is for; wins over the id a saved report's own path names
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
  expanded: { from: string; to: string }[]; // each shortened path the check read as the one tracked file it ends
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
function readAll(facts: Pick<ScoutFacts, 'read'>, paths: readonly string[]): (string | undefined)[] {
  const out: (string | undefined)[] = [];
  for (let i = 0; i < paths.length; i += SLICE) out.push(...facts.read(paths.slice(i, i + SLICE)));
  return out;
}

/**
 * The one tracked path that ends with `/` + `path`, so a shortened path reads as the file it names; undefined when no
 * tracked path or more than one does. The caller expands only a path git does not track as written.
 */
export function expandPath(path: string, tracked: readonly string[]): string | undefined {
  if (path === '') return undefined;
  const tail = '/' + path;
  const hits = tracked.filter((t) => t.endsWith(tail));
  return hits.length === 1 ? hits[0] : undefined;
}

const SAVED_REPORT = /^accord\/tickets\/([^/]+)\/scout\.md$/;

/**
 * The files no Absent row searches: the report itself and, for a report of a ticket (a saved report, or any report
 * checked with a ticket id), its ticket file, everything under the ticket's folder, and the research records its
 * ticket lists. A missing or unreadable ticket adds no record.
 */
function ownFiles(facts: ScoutFacts, tracked: readonly string[]): Set<string> {
  const own = new Set<string>();
  if (facts.path !== undefined) own.add(facts.path);
  const id = facts.ticket ?? (facts.path === undefined ? undefined : SAVED_REPORT.exec(facts.path)?.[1]);
  if (id === undefined) return own;
  const ticket = 'accord/tickets/' + id + '.md';
  own.add(ticket);
  for (const p of tracked) if (p.startsWith('accord/tickets/' + id + '/')) own.add(p);
  const text = facts.read([ticket])[0];
  if (text === undefined) return own;
  const yaml = splitFrontmatter(text).yaml;
  if (yaml === null) return own;
  const research = parseYamlMap(ticket, yaml, 1).map?.research;
  if (!Array.isArray(research)) return own;
  for (const entry of research) if (typeof entry === 'string' && isResearchRecord(entry)) own.add(entry);
  return own;
}

const TEST_FOLDER = new Set(['test', 'tests', '__tests__']);
const isTestFile = (path: string): boolean => {
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  return segments.slice(0, -1).some((s) => TEST_FOLDER.has(s)) || name.includes('.test.') || name.includes('.spec.');
};

/** The lane numbers of lane.md over the listed files: expected files, code areas, sensitive matches and the lifts. */
function laneOf(facts: ScoutFacts, listed: readonly string[]): ScoutLane {
  const lists = configLists(facts.config);
  const rendered = new Set(facts.rendered ?? []);
  const expected = listed.filter((p) => !isTestFile(p) && !rendered.has(p) && !lists.generated.some((e) => matches(e, p)));
  const areas = [...new Set(expected.map((p) => (p.includes('/') ? p.split('/').slice(0, -1).slice(0, 4).join('/') : '.')))].sort(byCodePoint);
  const sensitive = listed.flatMap((path) =>
    lists.sensitive.filter((e) => matches(e.path, path)).map((e) => ({ path, entry: e.path, area: e.area, line: e.line })),
  );
  const lifts = [
    ...(expected.length > 5 ? ['more than 5 expected files'] : []),
    ...(areas.length > 3 ? ['more than 3 code areas'] : []),
    ...(sensitive.length > 0 ? ['a listed sensitive area'] : []),
  ];
  return { expected, areas, sensitive, lifts };
}

/** The failures of citations whose path is already expanded: a path git does not track, one that cannot be read, a line beyond the file. Each tracked cited path is read once. */
function citationProblems(citations: readonly Citation[], trackedSet: ReadonlySet<string>, facts: Pick<ScoutFacts, 'read'>): string[] {
  const failures: string[] = [];
  const cited = [...new Set(citations.map((c) => c.path).filter((p) => trackedSet.has(p)))];
  const citedTexts = new Map<string, string | undefined>();
  readAll(facts, cited).forEach((text, i) => citedTexts.set(cited[i], text));
  for (const c of citations) {
    const where = 'citation ' + c.text + ' does not resolve: ';
    if (!trackedSet.has(c.path)) {
      failures.push(where + 'git does not track ' + c.path);
      continue;
    }
    const text = citedTexts.get(c.path);
    if (text === undefined) {
      failures.push(where + c.path + ' cannot be read');
      continue;
    }
    const count = linesOf(text).length;
    if (c.numbers.some((n) => n < 1 || n > count)) failures.push(where + c.path + ' has ' + count + ' lines');
  }
  return failures;
}

/**
 * The failures of the `path:line` citations in `evidence`, one line of text, and of nothing else: no section is read, so no `## Absent` row can exist and no pattern is ever run.
 * A path git does not track as written, but exactly one tracked path ends with, is that file, as in `scoutCheck`. A line break in `evidence` reads as a space.
 */
export function citationFailures(evidence: string, facts: Pick<ScoutFacts, 'tracked' | 'read'>): string[] {
  const tracked = [...facts.tracked].sort(byCodePoint);
  const trackedSet = new Set(tracked);
  const flat = evidence.replace(/[\r\n]/g, ' ');
  const citations = parseScoutReport('## Facts\n- ' + flat + '\n').citations.map((c) => ({ ...c, path: trackedSet.has(c.path) ? c.path : (expandPath(c.path, tracked) ?? c.path) }));
  return citationProblems(citations, trackedSet, facts);
}

export function scoutCheck(facts: ScoutFacts): ScoutResult {
  const report = parseScoutReport(facts.text);
  const tracked = [...facts.tracked].sort(byCodePoint);
  const trackedSet = new Set(tracked);
  const failures: string[] = [];
  // A path git does not track as written, but exactly one tracked path ends with, is that file; every expansion is
  // recorded so the caller can print what the check assumed. `## New files` is never expanded.
  const expanded: { from: string; to: string }[] = [];
  const expand = (path: string): string => {
    if (trackedSet.has(path)) return path;
    const to = expandPath(path, tracked);
    if (to === undefined) return path;
    if (!expanded.some((e) => e.from === path)) expanded.push({ from: path, to });
    return to;
  };
  const files = report.files?.map(expand);
  const citations = report.citations.map((c) => ({ ...c, path: expand(c.path) }));
  if (report.files === undefined) failures.push('the report has no ## Files section, so no lane numbers can be computed');
  failures.push(...report.faults);
  for (const path of files ?? []) {
    if (!trackedSet.has(path)) failures.push('## Files lists ' + path + ', which git does not track');
  }
  for (const path of report.newFiles) {
    if (trackedSet.has(path)) failures.push('## New files lists ' + path + ', which git already tracks');
  }

  failures.push(...citationProblems(citations, trackedSet, facts));

  const own = report.absent.length > 0 ? ownFiles(facts, tracked) : new Set<string>();
  for (const row of report.absent) {
    const where = 'absent claim "' + printedClaim(row.claim) + '" (row ' + row.line + '): ';
    // T-08.4-27: the pattern is read, not run, until its text proves it cheap; a pattern that is not fails its row and is never run
    const shape = patternShape(row.pattern);
    if (shape.problem !== undefined) {
      failures.push(where + 'its pattern is refused: ' + shape.problem);
      continue;
    }
    let pattern: RegExp;
    try {
      pattern = new RegExp(row.pattern);
    } catch {
      failures.push(where + 'its pattern is not a valid JavaScript regular expression');
      continue;
    }
    const covers = coverage(row.folders, tracked);
    const searched = tracked.filter((p) => covers(p) && !own.has(p) && !p.startsWith('.claude/') && !p.startsWith('.agents/'));
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
      const n = linesOf(text).findIndex((l) => (!shape.unbounded || l.length <= LINE_CAP) && pattern.test(l));
      if (n >= 0) failures.push(where + path + ':' + (n + 1) + ' matches its pattern outside its allowed hits');
    });
  }

  const result: ScoutResult = { failures, expanded };
  if (files !== undefined) result.lane = laneOf(facts, [...new Set([...files, ...report.newFiles])].sort(byCodePoint));
  if (report.skipped !== undefined) result.skipped = report.skipped;
  return result;
}
