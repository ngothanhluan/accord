// Workflow-layer records (docs/specs/2026-10-12-workflow-layer-design.md §7-§10): plan.md, ledger.md,
// review.md under accord/tickets/<id>/, and accord/tests-baseline.txt. Pure string work; every parser
// normalises BOM and CRLF itself (D-38), so every encoding variant parses to one value.
import type { LoadFinding } from '../model/finding.js';
import type { Ledger, Plan, PlanTask, Review } from '../model/snapshot.js';
import { normaliseText } from './frontmatter.js';
import { LIST_MARKER, scan } from './sections.js';

const TASK = /^Task\s+([1-9][0-9]*)\s*:\s*(.*)$/;
const FIELD = /^(covers|files|verify):(.*)$/;
const DONE = /^\s*[-*+]\s+task\s+([1-9][0-9]*)\s+done\s+([0-9a-fA-F]{7,})\s*$/;
const RULING = /^\s*(?:[-*+]\s+)?(Ruling:.*\S)\s*$/;
const VERDICT = /^verdict:\s*(\S+)\s*$/;

type Field = 'covers' | 'files' | 'verify';

/** A field value: tokens separated by whitespace or commas, empty tokens dropped. */
const tokens = (v: string): string[] => v.split(/[\s,]+/).filter((x) => x !== '');

/**
 * One task per `## Task <n>: <title>` section; any other section is prose and is skipped. A field is the
 * first `covers:`, `files:`, or `verify:` line in the section, outside a fence, with an optional list
 * marker. A repeated task number keeps the first section and reports the second.
 */
export function parsePlan(file: string, text: string): { plan: Plan; findings: LoadFinding[] } {
  const { sections, fences } = scan(normaliseText(text), 0);
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
    tasks.push({
      n,
      title: m[2].trim(),
      line: s.line,
      covers: fields.covers ?? [],
      files: fields.files ?? [],
      verify: fields.verify ?? [],
      lines: s.lines,
    });
  }
  return { plan: { file, tasks }, findings };
}

/** `- task <n> done <sha>` lines, the first per task winning, and every `Ruling:` line, anywhere in the file. */
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
  return { file, done, rulings };
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

/** One report case id per line; blank lines and `#` comments are skipped; sorted and unique. */
export function parseBaseline(text: string): string[] {
  const ids = normaliseText(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
  return [...new Set(ids)].sort();
}
