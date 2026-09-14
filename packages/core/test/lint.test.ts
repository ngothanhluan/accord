// Phase 3 lint goldens: one per fixture folder under test/fixtures/ that has an accord/ directory,
// mirroring snapshot.test.ts. Regenerate one with `npm test -- --project core lint -u -t "fixture <name>"`.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { lintSnapshot, loadSnapshot, renderText } from '../src/index.js';
import type { Finding, LintResult, RepoSnapshot } from '../src/index.js';
import { RULES } from '../src/lint/rules.js';
import { readFixture, stableJson, variants } from './helpers/fixture.js';
import type { Variants } from './helpers/fixture.js';

const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url));
const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(fixturesDir, d.name, 'accord')))
  .map((d) => d.name)
  .sort();

// D-60 line shape; `pointer` is JSON-only by design.
const LINE = /^(.+?)(?::(\d+))?: (error|warning) (\S+) (.*)$/;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const order = (a: Finding, b: Finding) =>
  cmp(a.file, b.file) ||
  (a.line ?? 0) - (b.line ?? 0) ||
  cmp(a.rule, b.rule) ||
  cmp(a.reason, b.reason) ||
  cmp(a.pointer ?? '', b.pointer ?? '');
const textFields = (f: Finding) => ({
  file: f.file,
  ...(f.line === undefined ? {} : { line: f.line }),
  level: f.level,
  rule: f.rule,
  reason: f.reason,
});

for (const name of fixtures) {
  describe('fixture ' + name, () => {
    let v: Variants;
    let result: LintResult;
    // Read inside the hook, never at collection time, so a `-t` filter never touches sibling fixtures.
    beforeAll(() => {
      v = variants(readFixture(name));
      result = lintSnapshot(loadSnapshot(v.lf));
    });

    it('CRLF, BOM+CRLF, mixed endings, and backslash keys lint identically to LF (D-29, D-38, D-65)', () => {
      const lf = stableJson(result);
      expect(stableJson(lintSnapshot(loadSnapshot(v.crlf)))).toBe(lf);
      expect(stableJson(lintSnapshot(loadSnapshot(v.bomCrlf)))).toBe(lf);
      expect(stableJson(lintSnapshot(loadSnapshot(v.mixed)))).toBe(lf);
      expect(stableJson(lintSnapshot(loadSnapshot(v.backslash)))).toBe(lf);
    });

    it('matches the golden', async () => {
      await expect(stableJson(result)).toMatchFileSnapshot('./__golden__/' + name + '.lint.json');
    });

    it('every lint rule and level comes from the table; loader findings are errors; schema.if is dropped (D-57, D-58)', () => {
      for (const f of result.findings) {
        if (f.rule.startsWith('lint.')) {
          const row = RULES.find((r) => r.id === f.rule);
          expect(row, f.rule).toBeDefined();
          expect(f.level).toBe(row?.level);
        } else {
          expect(f.level).toBe('error');
          expect(f.rule).not.toBe('schema.if');
        }
      }
    });

    it('renderText parses back to the findings and ends with the summary line (D-60, CORE-05)', () => {
      const lines = renderText(result).split('\n');
      expect(lines.at(-1)).toBe(''); // exactly one trailing newline
      expect(lines.at(-2)).toBe(`${result.errors} errors, ${result.warnings} warnings`);
      const parsed = lines.slice(0, -2).map((l) => {
        const m = LINE.exec(l);
        if (m === null) throw new Error('unparsable line: ' + l);
        const [, file, line, level, rule, reason] = m;
        return { file, ...(line === undefined ? {} : { line: Number(line) }), level, rule, reason };
      });
      expect(parsed).toEqual(result.findings.map(textFields));
    });

    it('is sorted, deterministic, and leaves the snapshot untouched (D-58, T-03-12)', () => {
      expect([...result.findings].sort(order)).toEqual(result.findings);
      const snapshot = loadSnapshot(v.lf);
      const before = structuredClone(snapshot);
      const first = stableJson(lintSnapshot(snapshot));
      const second = stableJson(lintSnapshot(snapshot));
      expect(second).toBe(first);
      expect(snapshot).toEqual(before);
    });
  });
}

describe('fixture valid-build: pinned lint values', () => {
  let snapshot: RepoSnapshot;
  let result: LintResult;
  beforeAll(() => {
    snapshot = loadSnapshot(readFixture('valid-build'));
    result = lintSnapshot(snapshot);
  });

  it('has no errors; warns per scenario without a @test: tag at the Scenario line (D-69) and once for the empty plan (D-74)', () => {
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(3);
    expect(result.findings.map((f) => [f.file, f.line, f.rule, f.level])).toEqual([
      ['accord/tickets/LOGIN-1.md', 37, 'lint.test-tag-missing', 'warning'],
      ['accord/tickets/LOGIN-1.md', 42, 'lint.test-tag-missing', 'warning'],
      ['accord/tickets/LOGIN-1.md', 50, 'lint.plan-empty', 'warning'],
    ]);
  });

  it('files holds exactly the normalised prototype and tokens file (D-65)', () => {
    expect(snapshot.files).toEqual({
      'accord/assets/LOGIN-1/prototype.html': readFixture('valid-build').files['accord/assets/LOGIN-1/prototype.html'],
      'src/styles/tokens.css': ':root { --color-primary: #0055ff; --space-2: 0.5rem; }\n',
    });
  });

  it('a token-clean prototype with a header raises no token or derivation finding (D-66, D-67)', () => {
    expect(result.findings.some((f) => f.rule.startsWith('lint.token') || f.rule.startsWith('lint.prototype'))).toBe(false);
  });
});

describe('fixture lint-tokens: pinned lint values', () => {
  it('PROTO-1 (no ticket file, D-68): exactly the eight research findings, all warnings at their lines (D-66)', () => {
    const result = lintSnapshot(loadSnapshot(readFixture('lint-tokens')));
    expect(result.errors).toBe(0);
    expect(result.findings.every((f) => f.rule === 'lint.token-hardcoded' && f.level === 'warning')).toBe(true);
    expect(result.findings.map((f) => [f.file, f.line, f.reason])).toEqual([
      ['accord/assets/PROTO-1/prototype.html', 10, 'padding: hard-coded spacing 12px'],
      ['accord/assets/PROTO-1/prototype.html', 11, 'background: hard-coded colour #fff'],
      ['accord/assets/PROTO-1/prototype.html', 12, 'border: unknown token var(--nope); tokens are read from config.design.tokens only'],
      ['accord/assets/PROTO-1/prototype.html', 16, 'class bg-[#fff]: hard-coded colour #fff'],
      ['accord/assets/PROTO-1/prototype.html', 16, 'class hover:bg-[oklch(60%_0.15_50)]/50: hard-coded colour oklch(60% 0.15 50)'],
      ['accord/assets/PROTO-1/prototype.html', 16, 'class p-[13px]: hard-coded spacing 13px'],
      ['accord/assets/PROTO-1/prototype.html', 17, 'color: hard-coded colour white'],
      ['accord/assets/PROTO-1/prototype.html', 18, 'padding: hard-coded spacing 2rem'],
    ]);
  });
});

describe('fixture lint-no-tokens: pinned lint values', () => {
  it('A, C, D need a derivation; B is silent; hard-coded colours are not checked without a tokens file (D-67)', () => {
    const result = lintSnapshot(loadSnapshot(readFixture('lint-no-tokens')));
    expect(result.findings.every((f) => f.rule === 'lint.prototype-derivation' && f.level === 'warning')).toBe(true);
    expect(result.findings.map((f) => [f.file, f.line, f.reason])).toEqual([
      ['accord/assets/A/prototype.html', 3, '"Derived from:" lists no path'],
      ['accord/assets/C/prototype.html', 3, '"Derived from:" path "src/nope.css" is not in the repository'],
      ['accord/assets/D/prototype.html', 1, 'prototype has no "Derived from:" line in its header comment'],
    ]);
  });
});

describe('fixture verification-edges: pinned lint values', () => {
  it('a prototype with no comment and empty design.tokens gets one derivation warning at line 1 (D-67)', () => {
    const result = lintSnapshot(loadSnapshot(readFixture('verification-edges')));
    expect(result.findings.filter((f) => f.rule === 'lint.prototype-derivation').map((f) => [f.file, f.line])).toEqual([
      ['accord/assets/A/prototype.html', 1],
    ]);
  });
});

describe('fixture frontmatter-errors: pinned lint values', () => {
  let result: LintResult;
  beforeAll(() => {
    result = lintSnapshot(loadSnapshot(readFixture('frontmatter-errors')));
  });

  it('MISMATCH: a frontmatter id differing from the file name is an error at pointer /id with no line (D-34)', () => {
    const mismatch = result.findings.filter((f) => f.rule === 'lint.id-mismatch');
    expect(mismatch).toEqual([
      {
        file: 'accord/tickets/MISMATCH.md',
        pointer: '/id',
        rule: 'lint.id-mismatch',
        level: 'error',
        reason: 'frontmatter id "OTHER" differs from the file name "MISMATCH"',
      },
    ]);
    expect(mismatch[0]).not.toHaveProperty('line');
  });

  it('schema.required surfaces with its pointer and line; schema.if never does (LINT-01, D-58)', () => {
    expect(result.findings.some((f) => f.rule === 'schema.if')).toBe(false);
    expect(result.findings.filter((f) => f.rule === 'schema.required')).toEqual([
      {
        file: 'accord/tickets/SCHEMA.md',
        line: 2,
        pointer: '',
        rule: 'schema.required',
        reason: "must have required property 'title'",
        level: 'error',
      },
    ]);
  });
});

describe('fixture lint-hygiene: pinned lint values', () => {
  let result: LintResult;
  const rulesOf = (file: string) =>
    result.findings.filter((f) => f.file === 'accord/tickets/' + file).map((f) => f.rule).sort();
  const reasonsOf = (file: string) => result.findings.filter((f) => f.file === 'accord/tickets/' + file).map((f) => f.reason);
  beforeAll(() => {
    result = lintSnapshot(loadSnapshot(readFixture('lint-hygiene')));
  });

  it('HYGIENE: sentinels, vague wording, open question, orphan tick, unconfirmed assumption, empty tracker (LINT-05, LINT-06, D-73)', () => {
    expect(rulesOf('HYGIENE.md')).toEqual([
      'lint.assumption-unconfirmed',
      'lint.open-question',
      'lint.plan-step-untagged',
      'lint.plan-tags-differ',
      'lint.sentinel',
      'lint.sentinel',
      'lint.sentinel',
      'lint.sentinel',
      'lint.sentinel',
      'lint.sentinel',
      'lint.tick-orphan',
      'lint.tracker-empty',
      'lint.vague-wording',
      'lint.vague-wording',
      'lint.vague-wording',
      'lint.vague-wording',
    ]);
    expect(reasonsOf('HYGIENE.md')).toContain('contains sentinel "TODO"');
    expect(reasonsOf('HYGIENE.md')).toContain('vague wording "depends"');
    expect(reasonsOf('HYGIENE.md').some((r) => r.includes('placeholder text'))).toBe(false);
    expect(result.findings.find((f) => f.rule === 'lint.tick-orphan')?.pointer).toBe('/verified/1');
    expect(result.findings.find((f) => f.rule === 'lint.assumption-unconfirmed')?.pointer).toBe('/assumptions/0/confirmed');
  });

  it('HEADINGS: one error per required heading absent for a bug, with no line (D-71)', () => {
    const missing = result.findings.filter((f) => f.file === 'accord/tickets/HEADINGS.md');
    expect(missing.map((f) => f.rule)).toEqual(['lint.heading-missing', 'lint.heading-missing', 'lint.heading-missing']);
    expect(missing.map((f) => f.reason).sort()).toEqual(['missing "## Open questions"', 'missing "## Plan"', 'missing "## Requirements"']);
    expect(missing.every((f) => f.line === undefined)).toBe(true);
  });

  it('SIZE and EPIC: oversize warnings at the heading line; limits apply to epics (LINT-07)', () => {
    expect(rulesOf('SIZE.md')).toEqual(['lint.intent-oversize', 'lint.requirements-oversize', 'lint.scenarios-oversize']);
    expect(reasonsOf('SIZE.md')).toContain('## Requirements has 16 EARS lines; the limit is 15');
    expect(rulesOf('EPIC.md')).toEqual(['lint.intent-oversize']);
  });

  it('HYGIENE, NOTES, PLAN-EMPTY, CLEAN: plan tags, notes placement, and a clean ticket (D-70, D-74)', () => {
    expect(reasonsOf('HYGIENE.md')).toContain('plan lacks nothing; scenarios lack @ac-2');
    expect(rulesOf('HYGIENE.md')).toContain('lint.plan-step-untagged');
    expect(rulesOf('NOTES.md')).toEqual(['lint.note-orphan', 'lint.notes-not-last']);
    expect(rulesOf('PLAN-EMPTY.md')).toEqual(['lint.plan-empty']);
    expect(rulesOf('CLEAN.md')).toEqual([]);
  });
});

describe('fixture lint-ears: pinned lint values', () => {
  let result: LintResult;
  beforeAll(() => {
    result = lintSnapshot(loadSnapshot(readFixture('lint-ears')));
  });

  it('EARS: ten diagnoses in file order on the unclassified lines, silence on the nine that classify (D-61 to D-64)', () => {
    const ears = result.findings.filter((f) => f.rule === 'lint.ears-unclassified');
    expect(ears.map((f) => f.line)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    expect(ears.map((f) => f.reason)).toEqual([
      "has WHEN but no 'the system shall'",
      "no EARS keyword and no 'the system shall'",
      "has 'the system must' but the verb must be 'shall'",
      "has 'the system shall' but no response after it",
      "has 'the system shall' but the line starts with prose and no keyword",
      'has WHEN twice',
      "has WHEN but no trigger before 'the system shall'",
      "has IF but no THEN before 'the system shall'",
      'has THEN but no IF',
      "THEN must come last before 'the system shall'",
    ]);
    expect(ears.every((f) => f.level === 'warning' && f.file === 'accord/tickets/EARS.md')).toBe(true);
    expect(result.findings.filter((f) => f.rule !== 'lint.ears-unclassified').map((f) => f.rule)).toEqual([
      'lint.requirements-oversize',
    ]);
    expect(result.errors).toBe(0);
  });
});

describe('fixture lint-gherkin: pinned lint values', () => {
  let result: LintResult;
  const of = (file: string) => result.findings.filter((f) => f.file === 'accord/tickets/' + file);
  const rulesOf = (file: string) => of(file).map((f) => f.rule).sort();
  beforeAll(() => {
    result = lintSnapshot(loadSnapshot(readFixture('lint-gherkin')));
  });

  it('STEPS: a keyword-only step and a step-less scenario are step-empty; a `...` step is a sentinel (LINT-03)', () => {
    expect(rulesOf('STEPS.md')).toEqual(['lint.sentinel', 'lint.step-empty', 'lint.step-empty']);
    expect(of('STEPS.md').map((f) => f.reason)).toEqual([
      'scenario "Trống" step 1 "Given" has no text',
      'scenario "Không bước" has no steps',
      'scenario "Mẫu" has a placeholder step "Given ..."',
    ]);
  });

  it('ACTAGS: missing, multiple, and duplicate @ac-n each have their own error (LINT-03, D-46)', () => {
    expect(rulesOf('ACTAGS.md')).toEqual(['lint.ac-tag-duplicate', 'lint.ac-tag-missing', 'lint.ac-tag-multiple']);
    expect(of('ACTAGS.md').find((f) => f.rule === 'lint.ac-tag-duplicate')?.reason).toBe('@ac-1 is already used by scenario "Hai thẻ"');
    expect(of('ACTAGS.md').every((f) => f.level === 'error')).toBe(true);
  });

  it('TESTTAGS: duplicate @test: is an error, @test: on @ui a warning, @ui alone silent (D-69)', () => {
    expect(rulesOf('TESTTAGS.md')).toEqual(['lint.test-tag-duplicate', 'lint.test-tag-missing', 'lint.test-tag-on-ui']);
    expect(of('TESTTAGS.md').map((f) => f.level)).toEqual(['error', 'warning', 'warning']);
  });

  it('NOSCEN: a story without a scenario errors at the Acceptance criteria heading; no report, so no test-id-unknown (LINT-03, D-72)', () => {
    expect(of('NOSCEN.md')).toEqual([
      { file: 'accord/tickets/NOSCEN.md', line: 14, level: 'error', rule: 'lint.no-scenarios', reason: 'a story needs at least one tagged scenario' },
    ]);
    expect(result.findings.some((f) => f.rule === 'lint.test-id-unknown')).toBe(false);
    expect(result.errors).toBe(7);
    expect(result.warnings).toBe(3);
  });
});

describe('fixture lint-missing-files: pinned lint values', () => {
  it('a configured report absent from the snapshot warns at /tests/report; test-id-unknown stays silent (D-72)', () => {
    const result = lintSnapshot(loadSnapshot(readFixture('lint-missing-files')));
    expect(result.findings.filter((f) => f.rule === 'lint.report-missing')).toEqual([
      {
        file: 'accord/config.yml',
        pointer: '/tests/report',
        level: 'warning',
        rule: 'lint.report-missing',
        reason: 'tests.report "reports/missing.xml" is not in the snapshot',
      },
    ]);
    expect(result.findings.some((f) => f.rule === 'lint.test-id-unknown')).toBe(false);
  });

  it('a configured tokens file absent from the snapshot warns at /design/tokens; the token rule is skipped (D-67)', () => {
    const result = lintSnapshot(loadSnapshot(readFixture('lint-missing-files')));
    expect(result.findings.filter((f) => f.rule === 'lint.tokens-missing')).toEqual([
      {
        file: 'accord/config.yml',
        pointer: '/design/tokens',
        level: 'warning',
        rule: 'lint.tokens-missing',
        reason: 'design.tokens "src/missing.css" is not in the snapshot; tokens are read from config.design.tokens only, so the token rule is skipped',
      },
    ]);
    expect(result.findings.map((f) => f.rule).sort()).toEqual(['lint.report-missing', 'lint.tokens-missing']);
  });
});

describe('fixture lint-report: pinned lint values', () => {
  it('exactly one test-id-unknown, naming the report path and the id shape (D-72, Pitfall 6)', () => {
    const result = lintSnapshot(loadSnapshot(readFixture('lint-report')));
    expect(result.findings.map((f) => f.rule)).toEqual(['lint.test-id-unknown']);
    const [f] = result.findings;
    expect(f.level).toBe('warning');
    expect(f.line).toBe(29);
    expect(f.reason).toContain('reports/junit.xml');
    expect(f.reason).toContain('classname#name');
    expect(f.reason).toContain('@test:nope#missing');
  });
});

describe('fixture gherkin-shapes: pinned lint values', () => {
  let result: LintResult;
  const of = (file: string) => result.findings.filter((f) => f.file === 'accord/tickets/' + file);
  beforeAll(() => {
    result = lintSnapshot(loadSnapshot(readFixture('gherkin-shapes')));
  });

  it('PARSE-ERROR: the parse finding and no-scenarios both fire (owner decision on Open Question 3)', () => {
    const rules = of('PARSE-ERROR.md').map((f) => f.rule);
    expect(rules).toContain('load.gherkin-parse');
    expect(rules).toContain('lint.no-scenarios');
    expect(of('PARSE-ERROR.md').find((f) => f.rule === 'lint.no-scenarios')?.line).toBe(7);
  });

  it('TAGS: the three @ac-n errors at the scenario lines (LINT-03)', () => {
    const ac = of('TAGS.md').filter((f) => f.rule.startsWith('lint.ac-tag-'));
    expect(ac.map((f) => [f.rule, f.line, f.level])).toEqual([
      ['lint.ac-tag-missing', 13, 'error'],
      ['lint.ac-tag-multiple', 17, 'error'],
      ['lint.ac-tag-duplicate', 25, 'error'],
    ]);
    expect(ac[2].reason).toBe('@ac-1 is already used by scenario "Hai thẻ"');
  });
});

describe('RULES table (CORE-04, D-57, D-59)', () => {
  it('every row applies to both profiles, ids are unique, and ids match lint.<kebab>', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) {
      expect(r.id).toMatch(/^lint\.[a-z-]+$/);
      expect(r.profiles).toEqual(['build', 'maintain']);
    }
  });
});

// `id in tests` consulted Object.prototype, so an id named after one of its members read as known
// and the rule stayed silent. Object.hasOwn closes it (UAT 03, test 3).
describe('fixture lint-report: prototype-chain ids', () => {
  it('an unknown @test id named after an Object.prototype member still warns (D-72)', () => {
    const input = readFixture('lint-report');
    const path = 'accord/tickets/REPORT.md';
    input.files[path] = input.files[path].replace('@test:nope#missing', '@test:toString');
    const result = lintSnapshot(loadSnapshot(input));
    expect(result.findings.map((f) => f.rule)).toEqual(['lint.test-id-unknown']);
    expect(result.findings[0].reason).toContain('@test:toString');
  });
});
