// D-60 and CORE-05: one result object renders to text and to JSON with identical content, pinned on
// inline results and snapshot literals (no fixtures), plus the engine's merge, sort, and adjacency edges.
import { describe, expect, it } from 'vitest';
import { lintSnapshot } from '../src/index.js';
import type { LintResult, LoadFinding, RepoSnapshot } from '../src/index.js';
import { renderText } from '../src/lint/render.js';

const result: LintResult = {
  findings: [
    { file: 'accord/config.yml', rule: 'load.config-missing', reason: 'accord/config.yml not found in snapshot', level: 'error' },
    { file: 'accord/tickets/LOGIN-1.md', line: 12, rule: 'lint.ears-unclassified', reason: "has WHEN but no 'the system shall'", level: 'warning' },
    { file: 'accord/tickets/VI.md', line: 3, rule: 'lint.sentinel', reason: 'chứa TODO', level: 'warning' },
  ],
  errors: 1,
  warnings: 2,
};

// The D-60 line shape; `pointer` is JSON-only by design.
const LINE = /^(.+?)(?::(\d+))?: (error|warning) (\S+) (.*)$/;
const snapshot = (errors: LoadFinding[] = []): RepoSnapshot => ({ tickets: {}, verifications: {}, tree: [], errors, files: {} });

describe('renderText (D-60)', () => {
  it('prints file:line: level rule reason per finding, omits :line without a line, then the literal-plural summary', () => {
    expect(renderText(result)).toBe(
      'accord/config.yml: error load.config-missing accord/config.yml not found in snapshot\n' +
        "accord/tickets/LOGIN-1.md:12: warning lint.ears-unclassified has WHEN but no 'the system shall'\n" +
        'accord/tickets/VI.md:3: warning lint.sentinel chứa TODO\n' +
        '1 errors, 2 warnings\n',
    );
  });

  it('an empty result is only the summary line', () => {
    expect(renderText({ findings: [], errors: 0, warnings: 0 })).toBe('0 errors, 0 warnings\n');
  });

  it('JSON and text carry the same content: JSON round-trips and every text line parses back (CORE-05)', () => {
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    const lines = renderText(result).split('\n').slice(0, -2); // drop the summary line and the trailing empty string
    const parsed = lines.map((l) => {
      const m = LINE.exec(l);
      if (m === null) throw new Error('unparsable line: ' + l);
      const [, file, line, level, rule, reason] = m;
      return { file, line: line === undefined ? undefined : Number(line), level, rule, reason };
    });
    expect(parsed).toEqual(
      result.findings.map((f) => ({ file: f.file, line: f.line, level: f.level, rule: f.rule, reason: f.reason })),
    );
    const pointed: LintResult = {
      findings: [{ file: 'a.md', rule: 'schema.required', reason: 'r', pointer: '/tracker', level: 'error' }],
      errors: 1,
      warnings: 0,
    };
    expect(renderText(pointed)).toBe('a.md: error schema.required r\n1 errors, 0 warnings\n');
  });
});

describe('lintSnapshot edges (CORE-05)', () => {
  it('an empty snapshot without config yields no findings and zero counts', () => {
    expect(lintSnapshot(snapshot())).toEqual({ findings: [], errors: 0, warnings: 0 });
  });

  it('drops schema.if and stamps every other loader finding error (D-58)', () => {
    const r = lintSnapshot(
      snapshot([
        { file: 'a.md', rule: 'schema.if', reason: 'x' },
        { file: 'a.md', rule: 'schema.required', reason: 'y', pointer: '/tracker' },
      ]),
    );
    expect(r).toEqual({
      findings: [{ file: 'a.md', rule: 'schema.required', reason: 'y', pointer: '/tracker', level: 'error' }],
      errors: 1,
      warnings: 0,
    });
  });

  it('sorts by file, then line with line-less first, then rule, in code-point order (D-58, A8)', () => {
    const r = lintSnapshot(
      snapshot([
        { file: 'b.md', line: 2, rule: 'load.x', reason: 'r' },
        { file: 'a.md', rule: 'load.x', reason: 'r' },
        { file: 'a.md', line: 10, rule: 'load.x', reason: 'r' },
        { file: 'a.md', line: 2, rule: 'load.z', reason: 'r' },
        { file: 'a.md', line: 2, rule: 'load.a', reason: 'r' },
      ]),
    );
    expect(r.findings.map((f) => `${f.file}:${f.line ?? '-'}:${f.rule}`)).toEqual([
      'a.md:-:load.x',
      'a.md:2:load.a',
      'a.md:2:load.z',
      'a.md:10:load.x',
      'b.md:2:load.x',
    ]);
    const upper = lintSnapshot(
      snapshot([
        { file: 'a.md', rule: 'load.x', reason: 'r' },
        { file: 'Z.md', rule: 'load.x', reason: 'r' },
      ]),
    );
    expect(upper.findings.map((f) => f.file)).toEqual(['Z.md', 'a.md']);
  });

  it('keeps two identical loader findings; nothing is merged', () => {
    const dup: LoadFinding = { file: 'a.md', line: 4, rule: 'load.x', reason: 'same' };
    const r = lintSnapshot(snapshot([dup, { ...dup }]));
    expect(r.findings).toEqual([
      { ...dup, level: 'error' },
      { ...dup, level: 'error' },
    ]);
    expect(r.errors).toBe(2);
  });
});
