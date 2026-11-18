// ST-LN-70 6-ac-4 rule extractor and diff; test-only, pure (no file, no clock).
import { agents, skills, templates } from '../../src/index.js';

/** A rule word, as a whole word, case-insensitive (06-CONTEXT Ruling "Rule line definition"). */
export const RULE_WORD = /\b(never|always|only|must|refuse[sd]?|stops?)\b/i;

/** The golden's own path, named by every message that is about the golden file itself. */
export const RULE_GOLDEN_PATH = 'packages/core/test/__golden__/rule-lines.txt';

export interface RuleLine {
  /** 1-based first source line of the entry. */
  line: number;
  /** 1-based last source line of the entry. */
  end: number;
  /** The entry's trimmed lines, joined by one space. */
  text: string;
}

export interface RuleSource {
  path: string;
  text: string;
  numbered: boolean;
}

const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;
const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s/;
const NUMBERED_FIRST = /^\d+\.\s/;
const GOLDEN_LINE = /^(packages\/core\/\S*?\.md): (.*)$/;

/**
 * Every rule entry of a text. A fence (three or more backticks or tildes) is left out, fence lines
 * included. A blank line is skipped. A list item absorbs the lines directly below it that are indented,
 * not blank, not a list item and not a fence; the first line that is not ends it, so a blank line ends
 * an item. Any other line is an entry of its own. An entry is a rule when it holds a rule word or, when
 * `numbered`, when its first line is a numbered item at column 0.
 */
export function ruleLines(text: string, numbered = false): RuleLine[] {
  const lines = text.split('\n');
  const out: RuleLine[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const fence = FENCE_OPEN.exec(raw);
    if (fence) {
      const run = fence[1];
      i++;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t.length >= run.length && [...t].every((c) => c === run[0])) break;
        i++;
      }
      i++;
      continue;
    }
    if (raw.trim() === '') {
      i++;
      continue;
    }
    const first = i;
    const parts = [raw.trim()];
    if (LIST_ITEM.test(raw)) {
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.trim() === '' || !/^\s/.test(next) || LIST_ITEM.test(next) || FENCE_OPEN.test(next)) break;
        parts.push(next.trim());
        i++;
      }
    }
    const entry = parts.join(' ');
    if (RULE_WORD.test(entry) || (numbered && NUMBERED_FIRST.test(raw))) out.push({ line: first + 1, end: i + 1, text: entry });
    i++;
  }
  return out;
}

/** The text accord ships: every agent, every skill file and the shared ruleset, sorted by source path. */
export function ruleSources(): RuleSource[] {
  const out: RuleSource[] = [];
  for (const [key, text] of Object.entries(agents)) out.push({ path: `packages/core/agents/${key}`, text, numbered: false });
  for (const [key, text] of Object.entries(skills)) out.push({ path: `packages/core/skills/${key}`, text, numbered: false });
  out.push({ path: 'packages/core/templates/ruleset.md', text: templates['ruleset.md'], numbered: true });
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** One `<source path>: <rule text>` line per rule, sources in the given order, rules in line order. */
export function ruleGolden(sources: readonly RuleSource[]): string {
  const lines: string[] = [];
  for (const s of sources) for (const r of ruleLines(s.text, s.numbered)) lines.push(`${s.path}: ${r.text}`);
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

interface Message {
  path: string;
  line: number;
  text: string;
}

const compare = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Messages for every difference between the golden and the sources, each `<path>:<line>: ...`; empty
 * exactly when `golden` equals `ruleGolden(sources)`. A message about a source names that source's file
 * and a line computed from its current text; a message about the golden names the golden's own path.
 */
export function ruleDiff(golden: string, sources: readonly RuleSource[]): string[] {
  const found: Message[] = [];
  const add = (path: string, line: number, text: string): number => found.push({ path, line, text: `${path}:${line}: ${text}` });

  const goldenOf = new Map<string, string[]>();
  golden.split('\n').forEach((raw, n) => {
    if (raw === '') return;
    const m = GOLDEN_LINE.exec(raw);
    if (!m) {
      add(RULE_GOLDEN_PATH, n + 1, `unreadable rule golden line: ${raw}`);
      return;
    }
    goldenOf.set(m[1], [...(goldenOf.get(m[1]) ?? []), m[2]]);
  });

  const sourceOf = new Map(sources.map((s) => [s.path, s]));
  for (const path of new Set([...goldenOf.keys(), ...sourceOf.keys()])) {
    const source = sourceOf.get(path);
    const current = source ? ruleLines(source.text, source.numbered) : [];
    const taken = new Set<number>();
    const keptInGoldenOrder: number[] = [];
    let lastKept = -1;
    for (const text of goldenOf.get(path) ?? []) {
      const at = current.findIndex((r, j) => !taken.has(j) && r.text === text);
      if (at < 0) {
        add(path, lastKept < 0 ? 1 : current[lastKept].end + 1, `removed or reworded rule: ${text}`);
        continue;
      }
      taken.add(at);
      keptInGoldenOrder.push(at);
      lastKept = at;
    }
    current.forEach((r, j) => {
      if (!taken.has(j)) add(path, r.line, `new or reworded rule: ${r.text}`);
    });
    const inLineOrder = [...keptInGoldenOrder].sort((a, b) => a - b);
    const out = inLineOrder.findIndex((j, k) => j !== keptInGoldenOrder[k]);
    if (out >= 0) add(path, current[inLineOrder[out]].line, `rule order changed: ${current[inLineOrder[out]].text}`);
  }

  if (found.length === 0) {
    const expected = ruleGolden(sources);
    if (golden !== expected) {
      const a = golden.split('\n');
      const b = expected.split('\n');
      let n = 0;
      while (n < a.length && n < b.length && a[n] === b[n]) n++;
      add(RULE_GOLDEN_PATH, n + 1, 'rule golden layout differs from the generated rule lines; no rule changed');
    }
  }

  return found.sort((x, y) => compare(x.path, y.path) || compare(x.line, y.line) || compare(x.text, y.text)).map((m) => m.text);
}
