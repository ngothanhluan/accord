// ST-LN-36 D-05: the security file (`accord/product/security.md`) holds the patterns that call for a security review and the reviewer's
// checklist. Pure text in, a spec out; the defaults are the text of templates/security.md, read from the generated record.
import { templates } from '../generated/templates.js';
import { scan, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot } from '../model/snapshot.js';

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
  /** a list line that does not read; it is never a pattern, a check or a removal. */
  problems: { line: number; reason: string }[];
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
const MAX_LINE = 2000;

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

/** Read a security file. A list line that does not read is a problem naming its line; text that is not a list line is prose and is ignored. */
export function parseSecurityFile(text: string): SecuritySpec {
  const body = (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');
  const { sections } = scan(body, 0);
  const spec: SecuritySpec = { patterns: [], checklist: [], removed: [], problems: [] };
  const seen = new Set<string>();
  const problem = (line: number, reason: string) => spec.problems.push({ line, reason });
  const isListLine = (t: string) => t.startsWith('- ');

  for (const { line, text: raw } of sectionLines(sections, 'patterns')) {
    const t = raw.trimEnd();
    if (!isListLine(t)) continue;
    if (t.length > MAX_LINE) {
      problem(line, `a pattern line is longer than ${MAX_LINE} characters`);
      continue;
    }
    const m = PATTERN.exec(t);
    if (m === null) {
      const bad = idProblem(t);
      if (bad !== undefined) {
        problem(line, bad);
        continue;
      }
      problem(line, 'not a pattern: write "- <id>: path <entry>[, <entry>…] — <what it guards>" or "- <id>: line /<regex>/[i] — <what it guards>"');
      continue;
    }
    const [, id, kind, spec_, label] = m;
    if (seen.has(id)) {
      problem(line, `the id "${id}" is used twice`);
      continue;
    }
    if (kind === 'path') {
      const entries = spec_.split(',').map((e) => e.trim());
      if (entries.some((e) => e === '' || /\s/.test(e))) {
        problem(line, `"${id}": a path entry is empty or holds a space`);
        continue;
      }
      if (entries.some((e) => /[*?[]/.test(e))) {
        problem(line, `"${id}": a path entry holds *, ? or [; there is no glob, an entry ending in / is a folder`);
        continue;
      }
      seen.add(id);
      spec.patterns.push({ id, kind: 'path', entries, label: label.trim(), line });
      continue;
    }
    const r = LINE_SPEC.exec(spec_.trim());
    if (r === null) {
      const f = ANY_FLAGS.exec(spec_.trim());
      problem(line, f === null ? `"${id}": a line pattern is /<regex>/ with the optional flag i` : `"${id}": the flag "${f[2]}" is not allowed; the only flag is i`);
      continue;
    }
    try {
      new RegExp(r[1], r[2]);
    } catch (e) {
      problem(line, `"${id}": the regex does not compile: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    seen.add(id);
    spec.patterns.push({ id, kind: 'line', source: r[1], flags: r[2], label: label.trim(), line });
  }

  const checked = new Set<string>();
  for (const { line, text: raw } of sectionLines(sections, 'checklist')) {
    const t = raw.trimEnd();
    if (!isListLine(t)) continue;
    const m = t.length > MAX_LINE ? null : CHECK.exec(t);
    if (m === null) {
      problem(line, (t.length > MAX_LINE ? undefined : idProblem(t)) ?? 'not a check: write "- <id>: <check>"');
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
    const m = t.length > MAX_LINE ? null : REMOVED.exec(t);
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
  return spec;
}

/** The defaults: the parse of the template `accord init` writes, so an absent file and an untouched file mean the same. */
export const DEFAULT_SECURITY: SecuritySpec = parseSecurityFile(templates['security.md']);

/** Where the repository's own file lives; `accord init` writes it, and an absent file means the defaults. */
export const SECURITY_FILE = 'accord/product/security.md';

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
    } else if (!sameValue(p, d)) {
      problems.push({ line: p.line, reason: `"${p.id}" is a default pattern with another kind or value, so the default applies; remove it with a "- Removed: ${p.id} — <reason>" line and add your own under a new id` });
    }
  }

  const removed: SecuritySpec['removed'] = [];
  const gone = new Set<string>();
  for (const r of file.removed) {
    if (gone.has(r.id)) problems.push({ line: r.line, reason: `"${r.id}" is removed twice` });
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
