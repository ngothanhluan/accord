// Workflow-layer records (docs/specs/2026-10-12-workflow-layer-design.md §7-§10): plan.md, ledger.md,
// review.md under accord/tickets/<id>/, and accord/tests-baseline.txt. Pure string work; every parser
// normalises BOM and CRLF itself (D-38), so every encoding variant parses to one value.
import type { LoadFinding } from '../model/finding.js';
import type { Discuss, DiscussArea, Ledger, Line, Plan, PlanTask, Review } from '../model/snapshot.js';
import { fnv1a64 } from '../gate/hash.js';
import { normaliseText, splitFrontmatter } from './frontmatter.js';
import { commentFreeLines, headingKey, LIST_MARKER, scan, stripHtmlComments } from './sections.js';
import { parseYamlMap } from './yaml.js';

const TASK = /^Task\s+([1-9][0-9]*)\s*:\s*(.*)$/;
export const FIELD = /^(covers|files|verify|after):(.*)$/;
const DONE = /^\s*[-*+]\s+task\s+([1-9][0-9]*)\s+done\s+([0-9a-fA-F]{7,})\s*$/;
export const RULING = /^\s*(?:[-*+]\s+)?(Ruling:.*\S)\s*$/;
// ST-LN-62: the path is everything up to the first ' — ', so a path may hold spaces.
const WORDING = /^\s*(?:[-*+]\s+)?Wording-only:\s+(\S.*?)\s+—\s+(.*\S)\s*$/;
const CONFIRMED = /^Confirmed wording-only:\s+(.+)$/;
const NOT_INTERFACE = /^Not an interface:\s+(\S.*?)\s+—\s+(.*\S)$/;
// Spec §10: the verdict is the first token; accepted-by-owner carries the owner's sentence after it.
const VERDICT = /^verdict:\s*(\S+)(?:\s.*)?$/;

const MARKER = /^\(@ac-[1-9][0-9]*\)$/;
// ST-LN-57, ST-LN-91 D-12: `- <review|plan|approach> <round>.<n>[ cycle <k>]: <text>[ — failing case: <case>]` under the ledger's first `## Deferred` section.
const DEFERRED = /^\s*[-*+]\s+(review|plan|approach) ([1-9][0-9]*)\.([1-9][0-9]*)(?: cycle ([1-9][0-9]*))?:\s*\S/;
const FAILING_CASE = / — failing case:\s*\S/;

/** A declared path, trimmed, with one pair of surrounding backticks removed. */
const declared = (t: string): string => {
  const x = t.trim();
  return x.length >= 2 && x.startsWith('`') && x.endsWith('`') ? x.slice(1, -1).trim() : x;
};

type Field = 'covers' | 'files' | 'verify' | 'after';

/** A field value: tokens separated by whitespace or commas, empty tokens dropped. */
export const tokens = (v: string): string[] => v.split(/[\s,]+/).filter((x) => x !== '');

/** The parser's own field rule: first `covers:`/`files:`/`verify:` line per field, outside a fence, list marker stripped. */
export function fieldLines(lines: Line[]): Partial<Record<Field, { line: number; value: string }>> {
  if (lines.length === 0) return {};
  const { fences } = scan(lines.map((l) => l.text).join('\n'), lines[0].line - 1);
  const out: Partial<Record<Field, { line: number; value: string }>> = {};
  for (const l of lines) {
    if (fences.some((f) => l.line >= f.open && l.line <= f.close)) continue;
    const f = FIELD.exec(l.text.replace(LIST_MARKER, '').trim());
    if (f === null) continue;
    const key = f[1] as Field;
    if (out[key] === undefined) out[key] = { line: l.line, value: f[2] };
  }
  return out;
}

const TASK_NUMBER = /^[1-9][0-9]*$/;

/**
 * ST-LN-91 D-09: the first `after:` line of a task outside a fence and a comment, list marker stripped, as `{ line, tasks, unread }`: each token that is a
 * task number goes to `tasks`, `none` is skipped, anything else (and `none` beside another token, which says two things) to `unread`. Undefined with no
 * such line, and when the first one holds no token, so the rule that asks for the line names it.
 */
function afterField(lines: Line[]): PlanTask['after'] {
  const { lines: free, fences } = commentFreeLines(lines);
  for (const l of free) {
    if (fences.some((f) => l.line >= f.open && l.line <= f.close)) continue;
    const m = /^after:(.*)$/.exec(l.text.replace(LIST_MARKER, '').trim());
    if (m === null) continue;
    const found = tokens(m[1]);
    if (found.length === 0) return undefined;
    const named = found.filter((t) => t !== 'none');
    const nums: number[] = [];
    const unread: string[] = [];
    for (const t of new Set(named)) {
      if (TASK_NUMBER.test(t) && Number.isSafeInteger(Number(t))) nums.push(Number(t));
      else unread.push(t);
    }
    if (named.length > 0 && named.length < found.length) unread.push('none');
    return { line: l.line, tasks: nums, unread };
  }
  return undefined;
}

// The body lines above the first task heading (1-based Markdown line), or the whole body when there is none.
function preamble(body: string, bodyOffset: number, taskLine: number | undefined): string {
  if (taskLine === undefined) return body;
  const above = body.split('\n').slice(0, taskLine - bodyOffset - 1);
  return above.length > 0 ? above.join('\n') + '\n' : '';
}

/**
 * One task per `## Task <n>: <title>` section; any other section is prose and is skipped. `preamble` is the
 * body above the first task heading, verbatim. A field is the
 * first `covers:`, `files:`, or `verify:` line in the section, outside a fence, with an optional list
 * marker. `baseline:` in the frontmatter names the commit the plan was written against. A repeated task number keeps the first section and reports the second.
 */
export function parsePlan(file: string, text: string): { plan: Plan; findings: LoadFinding[] } {
  const { yaml, body, bodyOffset } = splitFrontmatter(text);
  const { sections } = scan(body, bodyOffset);
  const findings: LoadFinding[] = [];
  const tasks: PlanTask[] = [];
  for (const s of sections) {
    const m = TASK.exec(s.heading);
    if (!m) continue;
    const n = Number(m[1]);
    if (tasks.some((t) => t.n === n)) {
      findings.push({
        file,
        line: s.line,
        rule: 'load.task-duplicate',
        reason: `duplicate "## Task ${n}"; the first occurrence is used`,
      });
      continue;
    }
    const found = fieldLines(s.lines);
    const fields: Partial<Record<Field, string[]>> = {};
    for (const k of ['covers', 'files', 'verify'] as const) {
      const v = found[k];
      if (v !== undefined) fields[k] = tokens(v.value);
    }
    // `(new)` marks the path before it; a leading one marks nothing.
    const files: string[] = [];
    const newFiles: string[] = [];
    for (const t of fields.files ?? []) {
      if (t !== '(new)') files.push(t);
      else if (files.length > 0) newFiles.push(files[files.length - 1]);
    }
    // `(@ac-n)` maps the test id before it to that scenario; a leading one maps nothing.
    const verify: string[] = [];
    const maps: PlanTask['maps'] = [];
    for (const t of fields.verify ?? []) {
      if (!MARKER.test(t)) verify.push(t);
      else if (verify.length > 0) maps.push({ test: verify[verify.length - 1], ac: t.slice(1, -1) });
    }
    const after = afterField(s.lines);
    tasks.push({
      n,
      title: m[2].trim(),
      line: s.line,
      covers: fields.covers ?? [],
      files,
      newFiles,
      verify,
      maps,
      lines: s.lines,
      ...(after === undefined ? {} : { after }),
    });
  }
  // A broken or non-string baseline is simply absent; gate.plan-baseline-missing says what to write.
  const map = yaml === null ? undefined : parseYamlMap(file, yaml, 1).map;
  const { baseline, plan_hash: planHash } = map ?? {};
  const plan: Plan = {
    file,
    tasks,
    preamble: preamble(body, bodyOffset, sections.find((s) => TASK.test(s.heading))?.line),
    bodyHash: fnv1a64(body),
    ...(typeof baseline === 'string' ? { baseline } : {}),
    ...(typeof planHash === 'string' ? { planHash } : {}),
  };
  return { plan, findings };
}

/**
 * `- task <n> done <sha>` lines, the first per task winning, every `Ruling:` line anywhere in the file, and
 * the first `## Rulings` section as written, comments and blank lines dropped, when the file has one.
 */
export function parseLedger(file: string, text: string): Ledger {
  const done: Record<string, string> = {};
  const rulings: string[] = [];
  const wordingOnly: { path: string; reason: string }[] = [];
  for (const line of normaliseText(text).split('\n')) {
    const w = WORDING.exec(line);
    if (w) wordingOnly.push({ path: declared(w[1]), reason: w[2] });
    const d = DONE.exec(line);
    if (d) {
      if (!Object.hasOwn(done, d[1])) done[d[1]] = d[2];
      continue;
    }
    const r = RULING.exec(line);
    if (r) rulings.push(r[1]);
  }
  const { sections, fences } = scan(normaliseText(text), 0);
  const section = sections.find((s) => headingKey(s.heading) === 'rulings');
  const deferred: NonNullable<Ledger['deferred']> = [];
  const deferredSection = sections.find((s) => headingKey(s.heading) === 'deferred');
  const unfenced = (deferredSection?.lines ?? []).filter((l) => !fences.some((f) => l.line >= f.open && l.line <= f.close));
  for (const l of stripHtmlComments(unfenced)) {
    const d = DEFERRED.exec(l.text);
    if (d) {
      deferred.push({
        kind: d[1] as 'review' | 'plan' | 'approach',
        round: Number(d[2]),
        n: Number(d[3]),
        cycle: d[4] === undefined ? 1 : Number(d[4]),
        ...(FAILING_CASE.test(l.text) ? { failingCase: true as const } : {}),
      });
    }
  }
  const extra = {
    ...(wordingOnly.length > 0 ? { wordingOnly } : {}),
    ...(deferred.length > 0 ? { deferred } : {}),
  };
  if (section === undefined) return { file, done, rulings, ...extra };
  const written = stripHtmlComments(section.lines).map((l) => l.text).filter((t) => t.trim() !== '');
  return { file, done, rulings, rulingsSection: written, ...extra };
}

/** The last `verdict:` line decides; a record with none has no verdict. The last `## Round` also yields its declaration lines. */
export function parseReview(file: string, text: string): Review {
  let review: Review = { file };
  const normal = normaliseText(text);
  normal
    .split('\n')
    .forEach((line, i) => {
      const m = VERDICT.exec(line.trim());
      if (m) review = { file, verdict: m[1], line: i + 1 };
      else if (review.verdict !== undefined && line.trim() !== '') review = { ...review, trailing: true };
    });
  const rounds = scan(normal, 0).sections.filter((s) => headingKey(s.heading).startsWith('round '));
  const confirmed: string[] = [];
  const notInterface: string[] = [];
  for (const l of rounds[rounds.length - 1]?.lines ?? []) {
    const t = l.text.replace(LIST_MARKER, '').trim();
    const c = CONFIRMED.exec(t);
    if (c) confirmed.push(declared(c[1]));
    const n = NOT_INTERFACE.exec(t);
    if (n) notInterface.push(declared(n[1]));
  }
  if (confirmed.length > 0) review = { ...review, confirmed };
  if (notInterface.length > 0) review = { ...review, notInterface };
  return review;
}

// ST-LN-91 D-04: the last part of a gray-area item: `D-07` or `D-07, D-08`. Anchored, and the alternatives cannot overlap, so no input backtracks.
const DISCUSS_DECISIONS = /^D-[0-9]+(?:\s*,\s*D-[0-9]+)*$/;
const DISCUSS_SEPARATOR = ' — ';
// An area is a list item at the top level of its line (ST-LN-91 IN-01, RR-WR-03, WR-02): up to three leading spaces, and, as CommonMark reads a list, not indented
// as far as the text of the area before it (a sub-bullet under `- ` starts at column 2, under `1. ` at column 3). Four or more spaces and a tab are never an area.
const AREA_MARKER = /^( {0,3})([-*+]|\d+[.)])(\s+)/;

/** The columns of white space at the start of a line (a tab to the next multiple of 4). */
function leadingColumns(text: string): number {
  let col = 0;
  for (const c of text) {
    if (c === ' ') col++;
    else if (c === '\t') col += 4 - (col % 4);
    else break;
  }
  return col;
}

/** The column at which the text of a list item starts: its indent, its marker and the spaces after it (a tab to the next multiple of 4; five or more columns of space count as one). */
function textColumn(indent: number, marker: string, gap: string): number {
  let col = indent + marker.length;
  const start = col;
  for (const c of gap) col = c === '\t' ? col + 4 - (col % 4) : col + 1;
  return col - start > 4 ? start + 1 : col;
}

/**
 * ST-LN-91 D-04: `accord/tickets/<id>/discuss.md`. The areas are the list items at the top level of a line (up to three spaces of indent, and indented less than the text
 * of the area before it: a sub-bullet two spaces under `- ` is a note, WR-02) under every
 * `## Gray areas` heading and every heading whose key starts with `gray areas`, such as `## Gray areas (cont.)` (WR-03, RR-WR-03: the headings other than the one
 * exact `## Gray areas` are listed in `extraHeadings`, which the gate reports), outside fences and HTML comments: `- <group> — <gray area in plain words> — D-07` or `— D-07, D-08`. The text between the first and the last
 * ` — ` is the gray area; with no `D-nn` last part the text is everything after the group, and an item with no separator is all text.
 * Plain `split` on a fixed separator and one anchored pattern, so a long hostile line is read in linear time.
 */
export function parseDiscuss(file: string, text: string): Discuss {
  const { sections, fences } = scan(normaliseText(text), 0);
  const grays = sections.filter((s) => headingKey(s.heading).startsWith('gray areas'));
  const unfenced = grays.flatMap((s) => s.lines).filter((l) => !fences.some((f) => l.line >= f.open && l.line <= f.close));
  const sectionOf = new Map(grays.flatMap((s, i) => s.lines.map((l) => [l.line, i] as const)));
  const areas: DiscussArea[] = [];
  let column = 0; // where the text of the last top-level item of the section starts: a line indented to it or beyond is nested in it
  let inSection = -1;
  let blank = true; // the line before is blank (or this is the first of the section)
  for (const l of stripHtmlComments(unfenced)) {
    if (sectionOf.get(l.line) !== inSection) {
      inSection = sectionOf.get(l.line)!;
      column = 0;
      blank = true;
    }
    const after = blank;
    blank = l.text.trim() === '';
    const marker = AREA_MARKER.exec(l.text);
    if (marker === null) {
      // WR-02 (round 4): as CommonMark reads it, a paragraph after a blank line, indented less than the text of the item, ends the list: a list item after it is top-level again.
      // A line with no blank line before it continues the item's paragraph and ends nothing.
      if (after && !blank && column > 0 && leadingColumns(l.text) < column) column = 0;
      continue;
    }
    if (column > 0 && marker[1].length >= column) continue;
    column = textColumn(marker[1].length, marker[2], marker[3]);
    const item = l.text.slice(marker[0].length).trim();
    if (item === '') continue;
    const parts = item.split(DISCUSS_SEPARATOR).map((p) => p.trim());
    if (parts.length === 1) {
      areas.push({ line: l.line, group: '', text: item, decisions: [] });
      continue;
    }
    const last = parts[parts.length - 1];
    const named = DISCUSS_DECISIONS.test(last);
    areas.push({
      line: l.line,
      group: parts[0],
      text: parts.slice(1, named ? -1 : undefined).join(DISCUSS_SEPARATOR),
      decisions: named ? last.split(',').map((d) => d.trim()) : [],
    });
  }
  const plain = grays.findIndex((s) => headingKey(s.heading) === 'gray areas');
  const extraHeadings = grays.filter((_, i) => i !== plain).map((s) => s.line);
  return { file, areas, ...(extraHeadings.length > 0 ? { extraHeadings } : {}) };
}

/** One report case id per line; blank lines and comments (`#` alone or `# ` plus text) are skipped; `#123-x` is an id; sorted and unique. */
export function parseBaseline(text: string): string[] {
  const ids = normaliseText(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && l !== '#' && !l.startsWith('# '));
  return [...new Set(ids)].sort();
}
