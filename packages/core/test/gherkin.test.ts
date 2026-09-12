// D-35, D-36, D-46 to D-50: the `steps` normalisation contract, the Markdown line remap, tag rules,
// dialects, parse errors, and determinism pinned on extractScenarios and the gherkin-shapes fixture.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import type { RepoSnapshot } from '../src/index.js';
import { extractScenarios } from '../src/load/gherkin.js';
import type { Fence } from '../src/load/sections.js';
import { readFixture } from './helpers/fixture.js';

/** A gherkin fence opened at Markdown line `open`; content lines are numbered `open + 1 ...`. */
const fence = (lines: string[], open = 10): Fence => ({
  info: 'gherkin',
  open,
  close: open + lines.length + 1,
  content: lines.map((text, i) => ({ line: open + 1 + i, text })),
});
const extract = (lines: string[], open = 10) => extractScenarios('accord/tickets/T.md', 'T', fence(lines, open));

describe('steps contract (D-47, D-48)', () => {
  it('collapses whitespace, wraps doc strings in triple quotes, and flattens table rows', () => {
    const { scenarios, findings } = extract([
      'Feature: F',
      '@ac-1',
      'Scenario: S',
      '  Given  a   thing',
      '  When a doc string',
      '    """',
      '    hello',
      '      world',
      '    """',
      '  Then a table',
      '    | x | y |',
      '    | 1 | 2 |',
    ]);
    expect(findings).toEqual([]);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].steps).toEqual([
      'Given a thing',
      'When a doc string """hello world"""',
      'Then a table | x | y | | 1 | 2 |',
    ]);
  });

  it('a Scenario Outline is one ref whose steps end with its Examples table (D-48, D-50)', () => {
    const { scenarios } = extract([
      'Feature: F',
      '@ac-1',
      'Scenario Outline: O',
      '  Given <a>',
      '  Examples:',
      '    | a |',
      '    | 1 |',
      '    | 2 |',
    ]);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].keyword).toBe('Scenario Outline');
    expect(scenarios[0].steps).toEqual(['Given <a>', 'Examples: | a | | 1 | | 2 |']);
  });

  it('feature and rule Backgrounds are prepended in order; the Rule name is absent (D-47, D-49)', () => {
    const result = extract([
      'Feature: F',
      'Background:',
      '  Given fb',
      'Rule: R',
      '  Background:',
      '    Given rb',
      '  @ac-1',
      '  Scenario: S',
      '    Given s',
    ]);
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].name).toBe('S');
    expect(result.scenarios[0].steps).toEqual(['Given fb', 'Given rb', 'Given s']);
    expect(JSON.stringify(result)).not.toContain('R');
  });
});

describe('Markdown line remap (D-35, D-36)', () => {
  it('without a prepended Feature line, line = open + parser line', () => {
    const { scenarios } = extract(['Feature: F', '', '', '', '', '@ac-1', 'Scenario: S', '  Given a'], 30);
    expect(scenarios[0].line).toBe(37);
  });

  it('with a prepended Feature line, the synthetic line is not counted and no finding is raised', () => {
    const { scenarios, findings } = extract(['@ac-1', 'Scenario: S', '  Given a'], 30);
    expect(findings).toEqual([]);
    expect(scenarios[0].line).toBe(32);
  });
});

describe('tags (D-46)', () => {
  it('acTag is the first @ac-n tag in order; every tag is kept', () => {
    const { scenarios } = extract(['Feature: F', '@ac-2 @ac-1 @smoke', 'Scenario: S', '  Given a']);
    expect(scenarios[0].acTag).toBe('ac-2');
    expect(scenarios[0].tags).toEqual(['@ac-2', '@ac-1', '@smoke']);
  });

  it('an untagged scenario has no acTag key and empty tags; a feature tag is never a scenario tag', () => {
    const { scenarios } = extract(['@feat', 'Feature: F', 'Scenario: S', '  Given a']);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].acTag).toBeUndefined();
    expect(JSON.stringify(scenarios[0])).not.toContain('acTag');
    expect(scenarios[0].tags).toEqual([]);
  });
});

describe('dialects (D-50)', () => {
  it('vi keywords normalise to English keyword values and step keywords stay Vietnamese', () => {
    const { scenarios, findings } = extract([
      '# language: vi',
      'Tính năng: T',
      '@ac-1',
      'Kịch bản: S',
      '  Cho a',
      '@ac-2',
      'Khung kịch bản: O',
      '  Cho <a>',
      '  Dữ liệu:',
      '    | a |',
      '    | 1 |',
    ]);
    expect(findings).toEqual([]);
    expect(scenarios.map((s) => s.keyword)).toEqual(['Scenario', 'Scenario Outline']);
    expect(scenarios[0].steps).toEqual(['Cho a']);
    expect(scenarios[0].line).toBe(14);
  });

  it('a vi fence without a feature line gets a Tính năng: line prepended', () => {
    const { scenarios, findings } = extract(['# language: vi', '@ac-1', 'Kịch bản: S', '  Cho a']);
    expect(findings).toEqual([]);
    expect(scenarios[0]).toMatchObject({ keyword: 'Scenario', line: 13, acTag: 'ac-1', steps: ['Cho a'] });
  });
});

describe('parse errors (D-35)', () => {
  it('a stray line after a step is one load.gherkin-parse finding at its Markdown line', () => {
    const { scenarios, findings } = extract(['Feature: F', 'Scenario: S', '  Given a', 'Bogus'], 20);
    expect(scenarios).toEqual([]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'accord/tickets/T.md', rule: 'load.gherkin-parse', line: 24 });
    expect(findings[0].reason.startsWith('(')).toBe(false);
  });

  it('an unknown # language: is reported at the language line', () => {
    const { scenarios, findings } = extract(['# language: xx', 'Feature: F'], 20);
    expect(scenarios).toEqual([]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'load.gherkin-parse', line: 21 });
    expect(findings[0].reason).toContain('Language not supported');
  });
});

describe('determinism (CORE-03)', () => {
  it('extracting the same fence twice is identical and leaves the fence untouched', () => {
    const f = fence(['@ac-1', 'Scenario: S', '  Given a']);
    const before = structuredClone(f);
    const first = JSON.stringify(extractScenarios('accord/tickets/T.md', 'T', f));
    const second = JSON.stringify(extractScenarios('accord/tickets/T.md', 'T', f));
    expect(second).toBe(first);
    expect(f).toEqual(before);
  });
});

describe('gherkin-shapes fixture', () => {
  let snap: RepoSnapshot;
  beforeAll(() => {
    snap = loadSnapshot(readFixture('gherkin-shapes'));
  });
  const scenarios = (id: string) => snap.tickets[id].scenarios;

  it('OUTLINE: one Scenario Outline with its Examples in steps', () => {
    expect(scenarios('OUTLINE')).toEqual([
      {
        name: 'Nhiều giá trị',
        keyword: 'Scenario Outline',
        line: 13,
        tags: ['@ac-1'],
        acTag: 'ac-1',
        steps: ['Given <a>', 'Examples: | a | | 1 | | 2 |'],
      },
    ]);
  });

  it('VI: English keyword values, Vietnamese step keywords, Background first in both', () => {
    const [a, b] = scenarios('VI');
    expect(scenarios('VI').map((s) => s.keyword)).toEqual(['Scenario', 'Scenario Outline']);
    expect(a).toEqual({
      name: 'Đăng nhập',
      keyword: 'Scenario',
      line: 17,
      tags: ['@ac-1'],
      acTag: 'ac-1',
      steps: ['Cho một người dùng', 'Khi họ đăng nhập', 'Thì thấy bảng điều khiển'],
    });
    expect(b).toMatchObject({ line: 22, acTag: 'ac-2', steps: ['Cho một người dùng', 'Cho <a>', 'Examples: | a | | 1 |'] });
  });

  it('RULE: both Backgrounds precede the step; the Rule name is not in the result', () => {
    expect(scenarios('RULE')).toHaveLength(1);
    expect(scenarios('RULE')[0]).toMatchObject({ line: 21, steps: ['Given fb', 'Given rb', 'Given s'] });
    // sections[].lines[] keep the raw body verbatim, so the Rule name is only absent from scenarios.
    expect(JSON.stringify(scenarios('RULE'))).not.toContain('Thanh toán');
  });

  it('PARSE-ERROR: frontmatter kept, scenarios empty, one finding at the bad line', () => {
    expect(snap.tickets['PARSE-ERROR'].frontmatter?.id).toBe('PARSE-ERROR');
    expect(scenarios('PARSE-ERROR')).toEqual([]);
    const own = snap.errors.filter((e) => e.file === 'accord/tickets/PARSE-ERROR.md');
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ rule: 'load.gherkin-parse', line: 15 });
  });

  it('TAGS: untagged kept, first @ac-n wins, feature tag ignored, duplicate @ac-1 kept', () => {
    const t = scenarios('TAGS');
    expect(t.map((s) => s.line)).toEqual([13, 17, 21, 25]);
    expect(t.map((s) => s.acTag ?? null)).toEqual([null, 'ac-1', 'ac-3', 'ac-1']);
    expect(t.map((s) => s.tags)).toEqual([[], ['@ac-1', '@ac-2', '@smoke'], ['@smoke', '@ac-3'], ['@ac-1']]);
    expect(snap.errors.some((e) => e.file === 'accord/tickets/TAGS.md')).toBe(false);
  });

  it('STEPS: the documented normalisation contract holds through loadSnapshot', () => {
    expect(scenarios('STEPS')).toHaveLength(1);
    expect(scenarios('STEPS')[0]).toMatchObject({
      line: 13,
      steps: ['Given a thing', 'When a doc string """hello world"""', 'Then a table | x | y | | 1 | 2 |'],
    });
  });

  it('MULTI: two fences concatenate in document order; a Feature-only fence adds nothing', () => {
    expect(scenarios('MULTI').map((s) => [s.acTag, s.line])).toEqual([
      ['ac-1', 13],
      ['ac-2', 19],
    ]);
    expect(snap.errors.some((e) => e.file === 'accord/tickets/MULTI.md')).toBe(false);
  });

  it('EMPTY-AC: no fence means no scenarios and no finding', () => {
    expect(scenarios('EMPTY-AC')).toEqual([]);
    expect(snap.errors.some((e) => e.file === 'accord/tickets/EMPTY-AC.md')).toBe(false);
  });

  it('BADLANG: unknown language is one finding at the language line', () => {
    expect(scenarios('BADLANG')).toEqual([]);
    const own = snap.errors.filter((e) => e.file === 'accord/tickets/BADLANG.md');
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ rule: 'load.gherkin-parse', line: 10 });
    expect(own[0].reason).toContain('Language not supported');
  });

  it('errors are exactly the two parse findings', () => {
    expect(snap.errors.map((e) => e.file)).toEqual(['accord/tickets/BADLANG.md', 'accord/tickets/PARSE-ERROR.md']);
  });
});
