// In-memory lane-ticket repositories for the workflow-layer tests (docs/specs/2026-10-12-workflow-layer-design.md).
// Strings rather than fixture folders: several values (approved_hash, ac_hash) are computed by the code
// under test, and a folder under packages/core/test/fixtures/ would also join the snapshot and lint
// directory scans and add goldens nobody asked for. Both test trees import DOWNWARDS from here.

export const REPORT = 'reports/junit.xml';

export const CONFIG = [
  'accord: "0.2.0"',
  'profile: build',
  'tracker:',
  '  adapter: none',
  'design:',
  '  tokens: ""',
  'roles: [ba, dev]',
  'runtimes: [claude]',
  'tests:',
  `  report: ${REPORT}`,
  'review:',
  '  mode: outcome',
  '',
].join('\n');

export const LANE_S_BODY = ['## Understood', 'The export button writes a csv file.', '', '## Done when', 'Pressing export saves report.csv.', ''].join('\n');

export const LANE_BODY = [
  '## Intent',
  'Owners can export their report as CSV.',
  '',
  '## Acceptance criteria',
  '```gherkin',
  'Feature: Export',
  '',
  '  @ac-1 @test:export#writes-csv',
  '  Scenario: export writes a csv',
  '    Given a report',
  '    When the owner exports it',
  '    Then a csv file is written',
  '',
  '  @ac-2 @test:export#escapes-commas',
  '  Scenario: commas are escaped',
  '    Given a cell with a comma',
  '    When the owner exports it',
  '    Then the cell is quoted',
  '```',
  '',
  '## Vetoes',
  '- No new dependency.',
  '',
  '## Decisions',
  '- D-01 Use the existing writer — "reuse what we have"',
  '',
  '## Corrections',
  '',
  '## Open questions',
  '- [x] Delimiter? Comma.',
  '',
  '## Approach',
  'Extend the existing report writer with a csv mode.',
  '',
].join('\n');

/** A ticket file. `lane: ''` omits the key, which makes a 0.1.0 ticket. `frontmatter` lines go before the closing ---. */
export function laneTicket(id: string, opts: { lane?: string; frontmatter?: string[]; body?: string } = {}): string {
  const lane = opts.lane ?? 'M';
  const extra = opts.frontmatter ?? [];
  const fm = [
    '---',
    `id: "${id}"`,
    'title: "Export"',
    'type: story',
    // A given `status:` replaces the default rather than adding a second key.
    ...(extra.some((l) => l.startsWith('status:')) ? [] : ['status: open']),
    ...(lane === '' ? [] : [`lane: ${lane}`]),
    'ui: false',
    ...extra,
    '---',
    '',
  ];
  return fm.join('\n') + (opts.body ?? LANE_BODY);
}

// plan_hash is the fnv1a64 of the body below the frontmatter; work.test.ts fails loudly when an edit moves it.
export const PLAN = [
  '---',
  'baseline: abc1234',
  'plan_hash: "fnv1a64:061c24200fe9bbf9"',
  '---',
  '',
  '# Plan',
  '',
  '## Task 1: Writer csv mode',
  'covers: @ac-1, D-01',
  'files: src/export.ts',
  'verify: export#writes-csv (@ac-1)',
  'Add a csv branch to the writer.',
  '',
  '## Task 2: Escaping',
  'covers: @ac-2',
  'files: src/export.ts',
  'verify: export#escapes-commas (@ac-2)',
  'Quote cells that contain a comma.',
  '',
].join('\n');

/** A JUnit report; a key 'cls#name' becomes classname="cls" name="name", which scanJUnit reads back as 'cls#name'. */
export function junit(cases: Record<string, 'passed' | 'failed' | 'skipped'>): string {
  const body = Object.entries(cases)
    .map(([id, status]) => {
      const [cls, name] = id.split('#');
      const inner = status === 'failed' ? '<failure/>' : status === 'skipped' ? '<skipped/>' : '';
      return `<testcase classname="${cls}" name="${name}">${inner}</testcase>`;
    })
    .join('');
  return `<testsuites><testsuite name="all">${body}</testsuite></testsuites>\n`;
}
