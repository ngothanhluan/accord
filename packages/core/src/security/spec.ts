// ST-LN-36 D-05: the security file (`accord/product/security.md`) holds the patterns that call for a security review and the reviewer's
// checklist. Pure text in, a spec out; the defaults are the text of templates/security.md, read from the generated record.
import { templates } from '../generated/templates.js';
import { headingKey, scan, stripHtmlComments } from '../load/sections.js';
import type { Finding } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { backtrackProblem } from './backtrack.js';
import { GLOB_ENTRY, GLOB_ENTRY_REASON, unmatchableEntry } from './entry.js';

export interface SecurityPattern {
  id: string;
  kind: 'path' | 'line';
  /** path patterns: the entries, each a folder prefix (ends in `/`), a file name at any depth (no `/`) or one exact path. */
  entries?: string[];
  /** line patterns: the regular expression source and its flags (`''` or `'i'`). */
  source?: string;
  flags?: string;
  label: string;
  /** the line of the security file the pattern was read from. */
  line: number;
}

export interface SecurityCheck {
  id: string;
  text: string;
  line: number;
}

export interface SecuritySpec {
  patterns: SecurityPattern[];
  checklist: SecurityCheck[];
  /** the ids named by `- Removed: <id> — <reason>` lines. */
  removed: { id: string; reason: string; line: number }[];
  /** a list line that does not read; it is never a pattern, a check or a removal. `pattern` marks a line of `## Patterns`: a team pattern that is not in force (D-10). */
  problems: { line: number; reason: string; pattern?: true }[];
}

const ID = '[a-z0-9][a-z0-9-]*';
// One anchored pattern per kind of line, no nested quantifier; `.+` before the last ` — ` is greedy, so the label is the text after the last ` — `.
const PATTERN = new RegExp(`^- (${ID}): (path|line) (.+) — (.+)$`);
const CHECK = new RegExp(`^- (${ID}): (.+)$`);
const REMOVED = new RegExp(`^- Removed: (${ID}) — (.+)$`);
const LINE_SPEC = /^\/(.+)\/(i?)$/;
const ANY_FLAGS = /^\/(.+)\/([A-Za-z]+)$/;
const ID_ONLY = new RegExp(`^${ID}$`);
const LEADING_ID = /^- ([^:\s]+): /;
const HAS_WORD = /[\p{L}\p{N}]/u;
/** The longest line of a security.md the reader takes (2000): a team's file line, a different input from a changed line (SCAN_LINE_LIMIT in match.ts). */
const MAX_PATTERN_LINE = 2000;

/** The sections of a security file the reader takes, by headingKey. */
const SECTIONS = new Set(['patterns', 'checklist', 'removed']);

const BOM = String.fromCharCode(0xfeff);

function sectionLines(sections: ReturnType<typeof scan>['sections'], name: string) {
  const s = sections.find((x) => x.heading.toLowerCase() === name);
  return s === undefined ? [] : stripHtmlComments(s.lines);
}

/** Why a list line is not read when its id is the fault (an upper-case or odd id); undefined when the id is fine or absent. */
function idProblem(t: string): string | undefined {
  const m = LEADING_ID.exec(t);
  return m === null || ID_ONLY.test(m[1]) ? undefined : `the id "${m[1]}" must be lower case and match ^[a-z0-9][a-z0-9-]*$`;
}

/** The number of single-character edits between two short strings, a swap of two neighbouring characters counting as one (optimal string alignment). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array.from({ length: b.length }, (_, j) => (i === 0 ? j + 1 : 0))]);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The words a team writes for one of the three reader headings: the names and their other forms. The short ones (`check`, `checks`, `remove`) count only when written exactly. */
const READER_WORDS = ['patterns', 'pattern', 'checklist', 'checklists', 'removed', 'removal', 'removals'];
const SHORT_READER_WORDS = ['check', 'checks', 'remove'];

/**
 * Phase 08.8 D-13, review WR-06: a heading key that looks like a misspelling of `patterns`, `checklist` or `removed`: with its spaces and hyphens taken out it is one of the reader words
 * (`## Check list`, `## Checks`), or it is one word and one edit, or one swap of neighbouring letters, from one of the longer ones (`## Paterns`, `## Chekclist`). A heading of more than one
 * word (`## Pattern library`, `## Checkout flow`) or a word further off (`## Revoked`, `## Remote`) is prose.
 */
function nearMiss(key: string): boolean {
  const joined = key.replace(/[\s-]+/g, '');
  if (READER_WORDS.includes(joined) || SHORT_READER_WORDS.includes(joined)) return true;
  return !/[\s-]/.test(key) && READER_WORDS.some((word) => editDistance(key, word) <= 1);
}

/**
 * Phase 08.8 D-13: a section of a heading the reader does not know holds a list line shaped like a pattern or a removal. Review WR-06: a check's shape (`- <id>: <text>`) is how any
 * list prose is written (`- owner: the platform team`), so it is not taken as a misplaced check.
 */
function holdsReaderLine(lines: ReturnType<typeof scan>['sections'][number]['lines']): boolean {
  return stripHtmlComments(lines).some(({ text }) => {
    const t = text.trimEnd();
    return t.startsWith('- ') && t.length <= MAX_PATTERN_LINE && (PATTERN.test(t) || REMOVED.test(t));
  });
}

/** Read a security file. A list line that does not read is a problem naming its line; text that is not a list line is prose and is ignored. */
export function parseSecurityFile(text: string): SecuritySpec {
  const body = (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');
  const { sections } = scan(body, 0);
  const spec: SecuritySpec = { patterns: [], checklist: [], removed: [], problems: [] };
  const seen = new Set<string>();
  const problem = (line: number, reason: string) => spec.problems.push({ line, reason });
  // a problem of a `## Patterns` line means a team pattern is not in force; the gate reads it (D-10)
  const patternProblem = (line: number, reason: string) => spec.problems.push({ line, reason, pattern: true });
  const isListLine = (t: string) => t.startsWith('- ');

  for (const { line, text: raw } of sectionLines(sections, 'patterns')) {
    const t = raw.trimEnd();
    if (!isListLine(t)) continue;
    if (t.length > MAX_PATTERN_LINE) {
      patternProblem(line, `a pattern line is longer than ${MAX_PATTERN_LINE} characters`);
      continue;
    }
    const m = PATTERN.exec(t);
    if (m === null) {
      const bad = idProblem(t);
      if (bad !== undefined) {
        patternProblem(line, bad);
        continue;
      }
      patternProblem(line, 'not a pattern: write "- <id>: path <entry>[, <entry>…] — <what it guards>" or "- <id>: line /<regex>/[i] — <what it guards>"');
      continue;
    }
    const [, id, kind, spec_, label] = m;
    if (seen.has(id)) {
      patternProblem(line, `the id "${id}" is used twice`);
      continue;
    }
    if (kind === 'path') {
      const entries = spec_.split(',').map((e) => e.trim());
      if (entries.some((e) => e === '' || /\s/.test(e))) {
        patternProblem(line, `"${id}": a path entry is empty or holds a space`);
        continue;
      }
      if (entries.some((e) => GLOB_ENTRY.test(e))) {
        patternProblem(line, `"${id}": a path entry ${GLOB_ENTRY_REASON}`);
        continue;
      }
      // D-21, lint only: an entry that can never match is a problem naming the fix, one per entry. It is not marked `pattern` and the line does not `continue`: the pattern stays in
      // force as 0.8.0 read it, so the gate behaves for it as before and no ticket in flight is refused for it.
      for (const e of entries) {
        const why = unmatchableEntry(e);
        if (why !== undefined) problem(line, `"${id}": ${why}`);
      }
      seen.add(id);
      spec.patterns.push({ id, kind: 'path', entries, label: label.trim(), line });
      continue;
    }
    const r = LINE_SPEC.exec(spec_.trim());
    if (r === null) {
      const f = ANY_FLAGS.exec(spec_.trim());
      patternProblem(line, f === null ? `"${id}": a line pattern is /<regex>/ with the optional flag i` : `"${id}": the flag "${f[2]}" is not allowed; the only flag is i`);
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
    spec.patterns.push({ id, kind: 'line', source: r[1], flags: r[2], label: label.trim(), line });
  }

  const checked = new Set<string>();
  for (const { line, text: raw } of sectionLines(sections, 'checklist')) {
    const t = raw.trimEnd();
    if (!isListLine(t)) continue;
    const m = t.length > MAX_PATTERN_LINE ? null : CHECK.exec(t);
    if (m === null) {
      problem(line, (t.length > MAX_PATTERN_LINE ? undefined : idProblem(t)) ?? 'not a check: write "- <id>: <check>"');
      continue;
    }
    if (checked.has(m[1])) {
      problem(line, `the id "${m[1]}" is used twice`);
      continue;
    }
    checked.add(m[1]);
    spec.checklist.push({ id: m[1], text: m[2].trim(), line });
  }

  for (const { line, text: raw } of sectionLines(sections, 'removed')) {
    const t = raw.trimEnd();
    if (!isListLine(t)) continue;
    const m = t.length > MAX_PATTERN_LINE ? null : REMOVED.exec(t);
    if (m === null) {
      problem(line, 'not a removal: write "- Removed: <id> — <reason>", the reason in words');
      continue;
    }
    if (!HAS_WORD.test(m[2])) {
      problem(line, `the removal of "${m[1]}" gives no reason in words`);
      continue;
    }
    spec.removed.push({ id: m[1], reason: m[2].trim(), line });
  }

  // D-21, lint only: the reader takes the first section of each of the three names, so a repeated heading is ignored and a heading it does not know (a misspelling such as
  // `## Pattern`) silently does nothing. Neither problem is marked `pattern`: the gate does not refuse for them.
  // Phase 08.8 D-13: lint.security-file is LOCKED at error, so a prose heading such as `## Notes` must not fail it. A heading the reader does not know is a problem only when it
  // looks like a misspelling of one it does (nearMiss) or when its section holds a list line one of the three readers would have taken, since that line silently does nothing.
  const headings = new Set<string>();
  for (const s of sections) {
    const key = headingKey(s.heading);
    if (headings.has(key)) problem(s.line, `the section "## ${s.heading}" appears twice; only the first is read, so move its lines into the first one`);
    else if (!SECTIONS.has(key) && (nearMiss(key) || holdsReaderLine(s.lines))) {
      problem(s.line, `"## ${s.heading}" is not a section accord reads; use ## Patterns, ## Checklist or ## Removed`);
    }
    headings.add(key);
  }
  return spec;
}

/** The defaults: the parse of the template `accord init` writes, so an absent file and an untouched file mean the same. */
export const DEFAULT_SECURITY: SecuritySpec = parseSecurityFile(templates['security.md']);

/** Where the repository's own file lives; `accord init` writes it, and an absent file means the defaults. */
export const SECURITY_FILE = 'accord/product/security.md';

/** The one default no `Removed:` line takes out: D-06's control, that removing a default is a visible, reviewed change, depends on it. */
const UNREMOVABLE = 'security-config';

/** The path entries an earlier release's template gave a default that has since changed, so a security.md `accord init` wrote under that release still reads clean (the current default applies). */
const EARLIER_ENTRIES: Record<string, string[][]> = { 'security-config': [['accord/product/security.md', 'accord/config.yml']] };

/**
 * The line sources an earlier release's template gave a default that has since changed, with the flags it carried, so a security.md `accord init` wrote under that release still reads clean (the
 * current default applies). `built-path` had one source in 0.7.0, 0.7.1 and 0.8.0; it ran in time quadratic in the length of a line of `join(`, and 0.8.1 replaced it with a linear one (D-08).
 * The default `agent-config` came after 0.8.0, so no released file holds an older value of it.
 */
const EARLIER_SOURCES: Record<string, { source: string; flags: string }[]> = {
  'built-path': [{ source: String.raw`\b(join|resolve|normalize)\s*\(.*\b(input|argv|args?|params?|query|body|req|request)\b`, flags: '' }],
};

const sameValue = (a: SecurityPattern, b: SecurityPattern): boolean =>
  a.kind === b.kind &&
  (a.kind === 'path'
    ? (a.entries ?? []).length === (b.entries ?? []).length && (a.entries ?? []).every((e, i) => e === (b.entries ?? [])[i])
    : a.source === b.source && (a.flags ?? '') === (b.flags ?? ''));

/**
 * ST-LN-36 D-06: the patterns in force are the defaults, plus each pattern of the file whose id is not a default id, minus each default a
 * `- Removed: <id> — <reason>` line names. A default line the file rewrote (another kind or value) is a problem and the default applies;
 * a default line the file deleted applies still. The checklist is the eight defaults plus the file's items with new ids, and a Removed line
 * never reaches it. `removed` holds the removals that took effect; every line that did not read, or read and changed nothing it claims to, is in `problems`.
 */
function mergeSecurity(file: SecuritySpec): SecuritySpec {
  const problems = [...file.problems];
  const defaultPattern = new Map(DEFAULT_SECURITY.patterns.map((p) => [p.id, p] as const));
  const teamIds = new Set<string>();
  const added: SecurityPattern[] = [];
  for (const p of file.patterns) {
    const d = defaultPattern.get(p.id);
    if (d === undefined) {
      teamIds.add(p.id);
      added.push(p);
    } else if (
      !sameValue(p, d) &&
      !(EARLIER_ENTRIES[p.id] ?? []).some((e) => sameValue(p, { ...d, entries: e })) &&
      !(EARLIER_SOURCES[p.id] ?? []).some((e) => sameValue(p, { ...d, source: e.source, flags: e.flags }))
    ) {
      problems.push({ line: p.line, reason: `"${p.id}" is a default pattern with another kind or value, so the default applies; remove it with a "- Removed: ${p.id} — <reason>" line and add your own under a new id` });
    }
  }

  const removed: SecuritySpec['removed'] = [];
  const gone = new Set<string>();
  for (const r of file.removed) {
    if (r.id === UNREMOVABLE) problems.push({ line: r.line, reason: `${UNREMOVABLE} cannot be removed: a change to the security file must always call the security reviewer` });
    else if (gone.has(r.id)) problems.push({ line: r.line, reason: `"${r.id}" is removed twice` });
    else if (defaultPattern.has(r.id)) {
      gone.add(r.id);
      removed.push(r);
    } else if (teamIds.has(r.id)) problems.push({ line: r.line, reason: `"${r.id}" is not a default pattern; delete its own line instead` });
    else if (DEFAULT_SECURITY.checklist.some((c) => c.id === r.id)) problems.push({ line: r.line, reason: `"${r.id}" is a checklist item; the default checklist always applies` });
    else problems.push({ line: r.line, reason: `"${r.id}" is not a default pattern, so nothing is removed` });
  }

  const defaultCheck = new Map(DEFAULT_SECURITY.checklist.map((c) => [c.id, c] as const));
  const addedChecks: SecurityCheck[] = [];
  for (const c of file.checklist) {
    const d = defaultCheck.get(c.id);
    if (d === undefined) addedChecks.push(c);
    else if (d.text !== c.text) problems.push({ line: c.line, reason: `"${c.id}" is a default check with other text, so the default applies; add your own under a new id` });
  }

  return {
    patterns: [...DEFAULT_SECURITY.patterns.filter((p) => !gone.has(p.id)), ...added],
    checklist: [...DEFAULT_SECURITY.checklist, ...addedChecks],
    removed,
    problems: problems.sort((a, b) => a.line - b.line),
  };
}

/** The spec a repository runs under: the defaults, merged with the repository's `accord/product/security.md` when it has one. */
export function securitySpec(snapshot: RepoSnapshot): SecuritySpec {
  const text = Object.hasOwn(snapshot.files, SECURITY_FILE) ? snapshot.files[SECURITY_FILE] : undefined;
  return text === undefined ? DEFAULT_SECURITY : mergeSecurity(parseSecurityFile(text));
}

/** The lint check of `lint.security-file`: one draft per line of the security file that does not read, at its line. An absent file has none. */
export function securityFile(snapshot: RepoSnapshot): Omit<Finding, 'level' | 'rule'>[] {
  if (!Object.hasOwn(snapshot.files, SECURITY_FILE)) return [];
  return securitySpec(snapshot).problems.map((p) => ({ file: SECURITY_FILE, line: p.line, reason: p.reason }));
}
