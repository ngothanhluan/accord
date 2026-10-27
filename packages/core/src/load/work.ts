// Workflow-layer records (docs/specs/2026-10-12-workflow-layer-design.md §7-§10): plan.md, ledger.md,
// review.md under accord/tickets/<id>/, and accord/tests-baseline.txt. Pure string work; every parser
// normalises BOM and CRLF itself (D-38), so every encoding variant parses to one value.
import type { LoadFinding } from '../model/finding.js';
import type { Ledger, Line, Plan, PlanTask, Review } from '../model/snapshot.js';
import { fnv1a64 } from '../gate/hash.js';
import { normaliseText, splitFrontmatter } from './frontmatter.js';
import { headingKey, LIST_MARKER, scan, stripHtmlComments } from './sections.js';
import { parseYamlMap } from './yaml.js';

const TASK = /^Task\s+([1-9][0-9]*)\s*:\s*(.*)$/;
export const FIELD = /^(covers|files|verify):(.*)$/;
const DONE = /^\s*[-*+]\s+task\s+([1-9][0-9]*)\s+done\s+([0-9a-fA-F]{7,})\s*$/;
export const RULING = /^\s*(?:[-*+]\s+)?(Ruling:.*\S)\s*$/;
// ST-LN-62: the path is everything up to the first ' — ', so a path may hold spaces.
const WORDING = /^\s*(?:[-*+]\s+)?Wording-only:\s+(\S.*?)\s+—\s+(.*\S)\s*$/;
const CONFIRMED = /^Confirmed wording-only:\s+(.+)$/;
const NOT_INTERFACE = /^Not an interface:\s+(\S.*?)\s+—\s+(.*\S)$/;
// Spec §10: the verdict is the first token; accepted-by-owner carries the owner's sentence after it.
const VERDICT = /^verdict:\s*(\S+)(?:\s.*)?$/;

const MARKER = /^\(@ac-[1-9][0-9]*\)$/;

/** A declared path, trimmed, with one pair of surrounding backticks removed. */
const declared = (t: string): string => {
  const x = t.trim();
  return x.length >= 2 && x.startsWith('`') && x.endsWith('`') ? x.slice(1, -1).trim() : x;
};

type Field = 'covers' | 'files' | 'verify';

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
  const section = scan(normaliseText(text), 0).sections.find((s) => headingKey(s.heading) === 'rulings');
  const extra = wordingOnly.length > 0 ? { wordingOnly } : {};
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

/** One report case id per line; blank lines and comments (`#` alone or `# ` plus text) are skipped; `#123-x` is an id; sorted and unique. */
export function parseBaseline(text: string): string[] {
  const ids = normaliseText(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && l !== '#' && !l.startsWith('# '));
  return [...new Set(ids)].sort();
}
