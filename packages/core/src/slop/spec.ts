// Phase 8.1 D-15, D-16: the slop file (`accord/product/slop.md`) holds the patterns a reviewer is shown on every added line. It reuses the security file's list-line grammar, its backtracking guard
// (security/backtrack.ts) and its line bound, and adds an optional `for .<ext>[, .<ext>]` scope. Pure text in, a spec out; the defaults are the text of templates/slop.md, read from the generated record.
import { templates } from '../generated/templates.js';
import { scan, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { backtrackProblem } from '../security/backtrack.js';

export interface SlopPattern {
  /** the kind: a reviewer sees `slop:<id>`, and Phase 12 counts by this name. */
  id: string;
  /** the regular expression source and its flags (`''` or `'i'`), matched against one added line. */
  source: string;
  flags: string;
  /** the extensions the pattern is limited to, each lower case with its dot (`.ts`); absent means every scanned file. */
  exts?: string[];
  label: string;
  /** the line of the slop file the pattern was read from. */
  line: number;
}

export interface SlopSpec {
  patterns: SlopPattern[];
  /** the ids named by `- Removed: <id> — <reason>` lines. */
  removed: { id: string; reason: string; line: number }[];
  /** a list line that does not read; it is never a pattern or a removal. `pattern` marks a line of `## Patterns`: a team pattern that is not in force. */
  problems: { line: number; reason: string; pattern?: true }[];
}

const ID = '[a-z0-9][a-z0-9-]*';
// One anchored pattern, no nested quantifier; `.+` before the last ` — ` is greedy, so the label is the text after the last ` — `.
const PATTERN = new RegExp(`^- (${ID}): (path|line) (.+) — (.+)$`);
const ID_ONLY = new RegExp(`^${ID}$`);
const LEADING_ID = /^- ([^:\s]+): /;
const LINE_SPEC = /^\/(.+)\/(i?)$/;
const ANY_FLAGS = /^\/(.+)\/([A-Za-z]+)$/;
/** The scope suffix of a line pattern: ` for .ts, .tsx`, the extensions lower case with their dot. */
const FOR_LIST = / for (\.[a-z0-9]+(?:, \.[a-z0-9]+)*)$/;
const FOR_ANY = /^(\/.+\/i?) for (.*)$/;
/** The longest line of a slop file the reader takes: the security file's bound, 2000 (a team's file line, a different input from a changed line, SCAN_LINE_LIMIT in security/match.ts). */
const MAX_PATTERN_LINE = 2000;

const BOM = String.fromCharCode(0xfeff);

/** Why a list line is not read when its id is the fault (an upper-case or odd id); undefined when the id is fine or absent. */
function idProblem(t: string): string | undefined {
  const m = LEADING_ID.exec(t);
  return m === null || ID_ONLY.test(m[1]) ? undefined : `the id "${m[1]}" must be lower case and match ^[a-z0-9][a-z0-9-]*$`;
}

const NOT_A_PATTERN = 'not a pattern: write "- <id>: line /<regex>/[i][ for .<ext>[, .<ext>…]] — <what it flags>"';

/** Read a slop file. A list line of `## Patterns` that does not read is a problem naming its line and marks the pattern as not in force; text that is not a list line is prose and is ignored. */
export function parseSlop(text: string): SlopSpec {
  const body = (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');
  const { sections } = scan(body, 0);
  const spec: SlopSpec = { patterns: [], removed: [], problems: [] };
  const seen = new Set<string>();
  const patternProblem = (line: number, reason: string) => spec.problems.push({ line, reason, pattern: true });
  const section = sections.find((x) => x.heading.toLowerCase() === 'patterns');
  const lines = section === undefined ? [] : stripHtmlComments(section.lines);

  for (const { line, text: raw } of lines) {
    const t = raw.trimEnd();
    if (!t.startsWith('- ')) continue;
    if (t.length > MAX_PATTERN_LINE) {
      patternProblem(line, `a pattern line is longer than ${MAX_PATTERN_LINE} characters`);
      continue;
    }
    const m = PATTERN.exec(t);
    if (m === null) {
      patternProblem(line, idProblem(t) ?? NOT_A_PATTERN);
      continue;
    }
    const [, id, kind, spec_, label] = m;
    if (seen.has(id)) {
      patternProblem(line, `the id "${id}" is used twice`);
      continue;
    }
    if (kind === 'path') {
      patternProblem(line, `"${id}": a slop pattern is a line pattern, "- <id>: line /<regex>/[i][ for .<ext>…] — <what it flags>"; slop is about added code, never a path`);
      continue;
    }
    let rest = spec_.trim();
    let exts: string[] | undefined;
    const scope = FOR_LIST.exec(rest);
    if (scope !== null) {
      exts = scope[1].split(', ');
      rest = rest.slice(0, scope.index);
    }
    const r = LINE_SPEC.exec(rest);
    if (r === null) {
      const badScope = FOR_ANY.exec(rest);
      const f = ANY_FLAGS.exec(rest);
      patternProblem(
        line,
        badScope !== null && LINE_SPEC.test(badScope[1])
          ? `"${id}": the scope after for is .<ext>[, .<ext>…], each extension lower case with its dot, such as "for .ts, .tsx"`
          : f === null
            ? `"${id}": a line pattern is /<regex>/ with the optional flag i`
            : `"${id}": the flag "${f[2]}" is not allowed; the only flag is i`,
      );
      continue;
    }
    try {
      new RegExp(r[1], r[2]);
    } catch (e) {
      patternProblem(line, `"${id}": the regex does not compile: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const slow = backtrackProblem(r[1], r[2]);
    if (slow !== undefined) {
      patternProblem(line, `"${id}": the regex can be very slow on some lines: ${slow}`);
      continue;
    }
    seen.add(id);
    spec.patterns.push({ id, source: r[1], flags: r[2], ...(exts === undefined ? {} : { exts }), label: label.trim(), line });
  }
  return spec;
}

/** The defaults: the parse of templates/slop.md, so a repository without a slop file and one with an untouched file mean the same. */
export const DEFAULT_SLOP: SlopSpec = parseSlop(templates['slop.md']);

/** Where the repository's own file lives; an absent file means the defaults. */
export const SLOP_FILE = 'accord/product/slop.md';

/** The spec a repository runs under: the defaults (the repository's own file is merged in by the next change of this group). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function slopSpec(snapshot: RepoSnapshot): SlopSpec {
  return DEFAULT_SLOP;
}
