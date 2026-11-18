// ST-LN-70 6-ac-4: every rule line of every agent, skill and the shared ruleset is held in a golden.
import { describe, expect, it } from 'vitest';
import { agents, skills } from '../src/index.js';
import { RULE_GOLDEN_PATH, ruleDiff, ruleGolden, ruleLines, ruleSources } from './helpers/rule-lines.js';
import type { RuleLine, RuleSource } from './helpers/rule-lines.js';

const FENCE = '`'.repeat(3);

// The 22 lines of the planning fixture: which lines are rule lines and which are not.
const FIXTURE = [
  '---',
  'description: Never edits the ticket.',
  '---',
  '',
  'Intro with no rule word.',
  '- A list item that must hold,',
  '  wrapped onto a second line.',
  '- A list item with nothing to keep.',
  '  Its second line says always.',
  '1. A numbered item with no rule word.',
  'Never a plain line.',
  FENCE,
  'never inside a fence',
  FENCE,
  'A stopwatch and onlyness line.',
  'It refused, then it stops.',
  '~~~~',
  '~~~ only a shorter run, still fenced',
  '~~~~',
  '- Must after the tilde fence.',
  '',
  '  An indented line after a blank line, which must stand alone.',
].join('\n');

const EXECUTOR = 'packages/core/agents/executor.md';
const BUILD = 'packages/core/skills/build/SKILL.md';
const RULESET = 'packages/core/templates/ruleset.md';

describe('rule coverage (ST-LN-70)', () => {
  it('risk:parsing the rule extractor joins a wrapped list item and leaves out fenced lines and lines with no rule word (ST-LN-70 6-ac-4)', () => {
    const entries: RuleLine[] = [
      { line: 2, end: 2, text: 'description: Never edits the ticket.' },
      { line: 6, end: 7, text: '- A list item that must hold, wrapped onto a second line.' },
      { line: 8, end: 9, text: '- A list item with nothing to keep. Its second line says always.' },
      { line: 11, end: 11, text: 'Never a plain line.' },
      { line: 16, end: 16, text: 'It refused, then it stops.' },
      { line: 20, end: 20, text: '- Must after the tilde fence.' },
      { line: 22, end: 22, text: 'An indented line after a blank line, which must stand alone.' },
    ];
    expect(ruleLines(FIXTURE)).toEqual(entries);
    const numbered = [...entries];
    numbered.splice(3, 0, { line: 10, end: 10, text: '1. A numbered item with no rule word.' });
    expect(ruleLines(FIXTURE, true)).toEqual(numbered);
  });

  it('ac-4 rewording or removing or reordering one rule line names its file and line while a non-rule line change names nothing (ST-LN-70 6-ac-4)', () => {
    const sources = ruleSources();
    const paths = sources.map((s) => s.path);
    expect(paths).toEqual(
      [...Object.keys(agents).map((k) => `packages/core/agents/${k}`), ...Object.keys(skills).map((k) => `packages/core/skills/${k}`), RULESET].sort(),
    );
    const golden = ruleGolden(sources);
    expect(ruleDiff(golden, sources)).toEqual([]);

    const sourceOf = (path: string): RuleSource => {
      const found = sources.find((s) => s.path === path);
      if (!found) throw new Error(`no source ${path}`);
      return found;
    };
    const rulesOf = (path: string): RuleLine[] => ruleLines(sourceOf(path).text, sourceOf(path).numbered);
    const mutated = (path: string, edit: (lines: string[]) => void): RuleSource[] =>
      sources.map((s) => {
        if (s.path !== path) return s;
        const lines = s.text.split('\n');
        edit(lines);
        return { ...s, text: lines.join('\n') };
      });
    const diffOf = (path: string, edit: (lines: string[]) => void): string[] => ruleDiff(golden, mutated(path, edit));
    const shape = /^packages\/core\/\S+\.md:\d+: (new|removed) or reworded rule: /;

    // (a) a reworded first rule: the new text at its line, the old text at line 1 (no earlier rule).
    const e = rulesOf(EXECUTOR);
    const a = diffOf(EXECUTOR, (l) => {
      l[e[0].line - 1] += ' (reworded)';
    });
    expect(a.some((m) => m.startsWith(`${EXECUTOR}:${e[0].line}: new or reworded rule: `))).toBe(true);
    expect(a).toContain(`${EXECUTOR}:1: removed or reworded rule: ${e[0].text}`);
    for (const m of a) expect(m).toMatch(shape);

    // (b) a removed second rule alone: one message, at the line after the end of the rule above it.
    const b = rulesOf(BUILD);
    const bDiff = diffOf(BUILD, (l) => {
      l.splice(b[1].line - 1, b[1].end - b[1].line + 1);
    });
    expect(bDiff).toEqual([`${BUILD}:${b[0].end + 1}: removed or reworded rule: ${b[1].text}`]);

    // (c) a reworded fifth rule of the ruleset: new text at its line, old text after the fourth rule.
    const r = rulesOf(RULESET);
    const c = diffOf(RULESET, (l) => {
      l[r[4].line - 1] += ' (reworded)';
    });
    expect(c.some((m) => m.startsWith(`${RULESET}:${r[4].line}: new or reworded rule: `))).toBe(true);
    expect(c).toContain(`${RULESET}:${r[3].end + 1}: removed or reworded rule: ${r[4].text}`);
    for (const m of c) expect(m).toMatch(shape);

    // (d) a non-rule line and a blank line above every rule shift all lines and name nothing.
    expect(
      ruleDiff(
        golden,
        sources.map((s) => (s.path === EXECUTOR ? { ...s, text: `A line with no rule word.\n\n${s.text}` } : s)),
      ),
    ).toEqual([]);

    // (e) an edit of the first non-rule line after the frontmatter names nothing.
    const eLines = sourceOf(EXECUTOR).text.split('\n');
    const inRule = (n: number): boolean => e.some((x) => x.line <= n && n <= x.end);
    let target = -1;
    for (let i = eLines.indexOf('---', 1) + 1; i < eLines.length; i++) {
      if (eLines[i].trim() !== '' && !/^\s*(`{3,}|~{3,})/.test(eLines[i]) && !inRule(i + 1)) {
        target = i;
        break;
      }
    }
    expect(target).toBeGreaterThan(0);
    expect(
      diffOf(EXECUTOR, (l) => {
        l[target] += ' (edited)';
      }),
    ).toEqual([]);

    // (f) two swapped one-line rules on adjacent lines: one order message, at the first line out of place.
    const i = e.findIndex(
      (x, n) => n + 1 < e.length && x.line === x.end && e[n + 1].line === e[n + 1].end && e[n + 1].line === x.line + 1 && x.text.startsWith('- ') && e[n + 1].text.startsWith('- '),
    );
    expect(i).toBeGreaterThanOrEqual(0);
    const f = diffOf(EXECUTOR, (l) => {
      const first = e[i].line - 1;
      [l[first], l[first + 1]] = [l[first + 1], l[first]];
    });
    expect(f).toEqual([`${EXECUTOR}:${e[i].line}: rule order changed: ${e[i + 1].text}`]);
    expect(f[0]).toMatch(/^packages\/core\/\S+\.md:\d+: /);

    // (g) a blank line directly above every rule of the file names nothing.
    expect(
      diffOf(EXECUTOR, (l) => {
        for (const x of [...e].reverse()) l.splice(x.line - 1, 0, '');
      }),
    ).toEqual([]);

    // (h) golden-side messages: a layout-only difference and an unreadable line each name the golden and a line.
    const gLines = golden.split('\n');
    gLines.splice(1, 0, '');
    expect(ruleDiff(gLines.join('\n'), sources)).toEqual([`${RULE_GOLDEN_PATH}:2: rule golden layout differs from the generated rule lines; no rule changed`]);
    const count = golden.split('\n').length - 1;
    expect(ruleDiff(`${golden}garbage\n`, sources)).toEqual([`${RULE_GOLDEN_PATH}:${count + 1}: unreadable rule golden line: garbage`]);
  });
});
