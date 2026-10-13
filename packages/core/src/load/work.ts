// Workflow-layer records (docs/specs/2026-10-12-workflow-layer-design.md §7-§10): plan.md, ledger.md,
// review.md under accord/tickets/<id>/, and accord/tests-baseline.txt. Pure string work; every parser
// normalises BOM and CRLF itself (D-38), so every encoding variant parses to one value.
import type { LoadFinding } from '../model/finding.js';
import type { Ledger, Plan, PlanTask, Review } from '../model/snapshot.js';
import { fnv1a64 } from '../gate/hash.js';
import { normaliseText, splitFrontmatter } from './frontmatter.js';
import { headingKey, LIST_MARKER, scan, stripHtmlComments } from './sections.js';
import { parseYamlMap } from './yaml.js';

const TASK = /^Task\s+([1-9][0-9]*)\s*:\s*(.*)$/;
export const FIELD = /^(covers|files|verify):(.*)$/;
const DONE = /^\s*[-*+]\s+task\s+([1-9][0-9]*)\s+done\s+([0-9a-fA-F]{7,})\s*$/;
export const RULING = /^\s*(?:[-*+]\s+)?(Ruling:.*\S)\s*$/;
// Spec §10: the verdict is the first token; accepted-by-owner carries the owner's sentence after it.
const VERDICT = /^verdict:\s*(\S+)(?:\s.*)?$/;

const MARKER = /^\(@ac-[1-9][0-9]*\)$/;

type Field = 'covers' | 'files' | 'verify';

/** A field value: tokens separated by whitespace or commas, empty tokens dropped. */
export const tokens = (v: string): string[] => v.split(/[\s,]+/).filter((x) => x !== '');

/**
 * One task per `## Task <n>: <title>` section; any other section is prose and is skipped. A field is the
 * first `covers:`, `files:`, or `verify:` line in the section, outside a fence, with an optional list
 * marker. `baseline:` in the frontmatter names the commit the plan was written against. A repeated task number keeps the first section and reports the second.
 */
export function parsePlan(file: string, text: string): { plan: Plan; findings: LoadFinding[] } {
  const { yaml, body, bodyOffset } = splitFrontmatter(text);
  const { sections, fences } = scan(body, bodyOffset);
  const inFence = (n: number) => fences.some((f) => n >= f.open && n <= f.close);
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
    const fields: Partial<Record<Field, string[]>> = {};
    for (const l of s.lines) {
      if (inFence(l.line)) continue;
      const f = FIELD.exec(l.text.replace(LIST_MARKER, '').trim());
      if (f === null) continue;
      const key = f[1] as Field;
      if (fields[key] === undefined) fields[key] = tokens(f[2]);
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
  for (const line of normaliseText(text).split('\n')) {
    const d = DONE.exec(line);
    if (d) {
      if (!Object.hasOwn(done, d[1])) done[d[1]] = d[2];
      continue;
    }
    const r = RULING.exec(line);
    if (r) rulings.push(r[1]);
  }
  const section = scan(normaliseText(text), 0).sections.find((s) => headingKey(s.heading) === 'rulings');
  if (section === undefined) return { file, done, rulings };
  const written = stripHtmlComments(section.lines).map((l) => l.text).filter((t) => t.trim() !== '');
  return { file, done, rulings, rulingsSection: written };
}

/** The last `verdict:` line decides; a record with none has no verdict. */
export function parseReview(file: string, text: string): Review {
  let review: Review = { file };
  normaliseText(text)
    .split('\n')
    .forEach((line, i) => {
      const m = VERDICT.exec(line.trim());
      if (m) review = { file, verdict: m[1], line: i + 1 };
    });
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
