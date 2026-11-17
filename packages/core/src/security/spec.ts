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
const MAX_LINE = 2000;

const BOM = String.fromCharCode(0xfeff);

function sectionLines(sections: ReturnType<typeof scan>['sections'], name: string) {
  const s = sections.find((x) => x.heading.toLowerCase() === name);
  return s === undefined ? [] : stripHtmlComments(s.lines);
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
      seen.add(id);
      spec.patterns.push({ id, kind: 'path', entries, label: label.trim(), line });
      continue;
    }
    const r = LINE_SPEC.exec(spec_.trim());
    if (r === null) {
      problem(line, `"${id}": a line pattern is /<regex>/ with the optional flag i`);
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
      problem(line, 'not a check: write "- <id>: <check>"');
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
      problem(line, 'not a removal: write "- Removed: <id> — <reason>"');
      continue;
    }
    spec.removed.push({ id: m[1], reason: m[2].trim(), line });
  }
  return spec;
}

/** The defaults: the parse of the template `accord init` writes, so an absent file and an untouched file mean the same. */
export const DEFAULT_SECURITY: SecuritySpec = parseSecurityFile(templates['security.md']);

/** The spec a repository runs under: the defaults here (the repository's own file is read from plan 05-05 on). */
export function securitySpec(snapshot: RepoSnapshot): SecuritySpec {
  void snapshot;
  return DEFAULT_SECURITY;
}
