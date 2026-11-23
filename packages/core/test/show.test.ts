// ST-LN-6 Task 1: the detail of one lane ticket and the label of each criterion.
import { expect, it } from 'vitest';
import { approvalShort, loadSnapshot, taskVerdict, ticketDetail, ticketWarnings } from '../src/index.js';
import { acHash } from '../src/gate/hash.js';
import { building, CONFIG, LANE_BODY, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const scenario = (n: number, test: boolean) =>
  [`  @ac-${n}${test ? ` @test:t#c${n}` : ''}`, `  Scenario: criterion ${n}`, '    Given a thing', '    Then it holds', ''].join('\n');
const body = (steps = 'Then it holds') =>
  [
    '## Intent',
    'Say why.',
    '',
    '## Acceptance criteria',
    '```gherkin',
    'Feature: T',
    '',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => scenario(n, n !== 8).replace(/Then it holds/, n === 4 ? steps : 'Then it holds')),
    '```',
    '',
  ].join('\n');
const xml = (inner: string) => `<testsuites><testsuite name="all">${inner}</testsuite></testsuites>\n`;
const tc = (n: number, inner = '') => `<testcase classname="t" name="c${n}">${inner}</testcase>`;
const REPORT_XML = xml(
  tc(1, '<failure/>') + tc(2) + tc(3) + tc(4) + tc(5) + tc(7, '<skipped/>') + tc(9, '<error/>'),
);
const VERIFICATION = [
  '---',
  'ticket: T-1',
  'commit: "abc1234"',
  'reviewed_on: "2026-10-16"',
  '---',
  '',
  '## @ac-2 two',
  'Result: fail',
  'Evidence: x',
  '',
  '## @ac-3 three',
  'Result: blocked',
  'Evidence: y',
  '',
].join('\n');

const files = (fm: string[], b: string, withReport = true, config = CONFIG) => ({
  'accord/config.yml': config,
  'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: fm, body: b }),
  'accord/tickets/T-1/verification.md': VERIFICATION,
  ...(withReport ? { [REPORT]: REPORT_XML } : {}),
});
const labels = (f: Record<string, string>) =>
  Object.fromEntries(ticketDetail(loadSnapshot({ files: f, tree: [] }), 'T-1')!.criteria.map((c) => [c.id, c.label]));

it('ac-3 each criterion takes the first label that matches top down', () => {
  const hash = acHash(loadSnapshot({ files: files([], body()), tree: [] }).tickets['T-1'].scenarios)!;
  const fm = ['verified: [ac-1, ac-3, ac-4]', `verified_hash: "${hash}"`];
  const f = files(fm, body());
  expect(labels(f)).toEqual({
    'ac-1': 'failing', 'ac-2': 'failing', 'ac-3': 'blocked', 'ac-4': 'verified', 'ac-5': 'passing',
    'ac-6': 'not run', 'ac-7': 'not run', 'ac-8': 'untested', 'ac-9': 'failing',
  });
  const c1 = ticketDetail(loadSnapshot({ files: f, tree: [] }), 'T-1')!.criteria[0];
  expect(c1).toMatchObject({ test: 't#c1', testResult: 'failed', ticked: true, verification: null });

  const noReport = {
    'ac-1': 'verified', 'ac-2': 'failing', 'ac-3': 'blocked', 'ac-4': 'verified', 'ac-5': 'not run',
    'ac-6': 'not run', 'ac-7': 'not run', 'ac-8': 'untested', 'ac-9': 'not run',
  };
  const noKey = files(fm, body(), true, CONFIG.replace(/tests:\n {2}report: .*\n/, ''));
  expect(CONFIG).not.toBe(noKey['accord/config.yml']);
  for (const g of [noKey, files(fm, body(), false)]) {
    expect(labels(g)).toEqual(noReport);
    const d = ticketDetail(loadSnapshot({ files: g, tree: [] }), 'T-1')!;
    expect(d.criteria.every((c) => c.testResult === null)).toBe(true);
  }

  // Both hashes set to the current criteria, then a step changes: the tick no longer binds.
  const stale = files(['verified: [ac-4]', `verified_hash: "${hash}"`, `ac_hash: "${hash}"`], body('Then it differs'));
  expect(labels(stale)['ac-4']).toBe('passing');
});

it('risk:complex-branching holder and blocking tickets come from the row and a non-lane ticket has no detail', () => {
  const base = { 'accord/config.yml': CONFIG, 'accord/tickets/T-2.md': laneTicket('T-2', { lane: '' }) };
  const withDep = { ...base, 'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: ['depends_on: [T-9]'] }) };
  const a = ticketDetail(loadSnapshot({ files: withDep, tree: [], claims: { 'T-1': 'bob@x' } }), 'T-1')!;
  expect([a.holder, a.blockedBy]).toEqual(['bob@x', ['T-9']]);
  const plain = { ...base, 'accord/tickets/T-1.md': laneTicket('T-1') };
  const s = loadSnapshot({ files: plain, tree: [] });
  const b = ticketDetail(s, 'T-1')!;
  expect([b.holder, b.blockedBy]).toEqual([null, []]);
  expect(ticketDetail(s, 'T-3')).toBeUndefined();
  expect(ticketDetail(s, 'T-2')).toBeUndefined();
  expect(ticketDetail(s, 'toString')).toBeUndefined();
});

it('risk:complex-branching the short approval view prints exactly the intent, one line per criterion, the decisions, the risks and the ticket path (ST-LN-91 91d-ac-3)', () => {
  const ticket = (b: string) => loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/X-1.md': laneTicket('X-1', { body: b }) }, tree: [] }).tickets['X-1'];
  expect(approvalShort(ticket(LANE_BODY), ['round 2: 1. Should — the cache can go stale — open']).split('\n')).toEqual([
    '## Intent',
    '',
    'Owners can export their report as CSV.',
    'Expected size: 5 tasks',
    '',
    '## Criteria',
    '',
    '- ac-1 export writes a csv',
    '- ac-2 commas are escaped',
    '',
    '## Decisions',
    '',
    '- D-01 Use the existing writer — "reuse what we have"',
    '',
    '## Risks',
    '',
    '- round 2: 1. Should — the cache can go stale — open',
    '',
    'Full ticket: accord/tickets/X-1.md',
    '',
  ]);
  // No risk: none. A commented-out Decision and blank lines are left out.
  const hidden = LANE_BODY.replace('## Corrections', '<!-- - D-02 hidden -->\n\n## Corrections');
  const out = approvalShort(ticket(hidden), []);
  expect(out).toContain('## Risks\n\nnone\n\nFull ticket: accord/tickets/X-1.md\n');
  expect(out).not.toContain('hidden');
  // An empty part prints none under its heading.
  const bare = approvalShort(ticket('## Intent\n\n## Acceptance criteria\n\n## Decisions\n<!-- none yet -->\n'), []);
  expect(bare.split('\n')).toEqual(['## Intent', '', 'none', '', '## Criteria', '', 'none', '', '## Decisions', '', 'none', '', '## Risks', '', 'none', '', 'Full ticket: accord/tickets/X-1.md', '']);
});

// Phase 08.8.1 D-05: a ticket whose plan.md is on disk but git does not hold it gets one not-committed warning; a committed one, and a ticket with no plan.md yet, get none.
it('risk:complex-branching ticketWarnings names a ticket whose records git does not hold and nothing for a committed one (D-05)', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  building(files, 'T-1');
  const planPath = 'accord/tickets/T-1/plan.md';
  const load = (f: Files, trackFacts?: Record<string, { state: 'ignored' | 'untracked'; path: string }>) =>
    loadSnapshot({ files: f, tree: [], ...(trackFacts === undefined ? {} : { trackFacts }) });
  expect(ticketWarnings(load(files, { 'T-1': { state: 'ignored', path: planPath } }), 'T-1')).toEqual([
    { kind: 'not-committed', text: 'accord/ is not committed in this repository: git ignores accord/tickets/T-1/plan.md, so accord cannot track the stage or the tasks' },
  ]);
  expect(ticketWarnings(load(files, { 'T-1': { state: 'untracked', path: planPath } }), 'T-1')).toEqual([
    { kind: 'not-committed', text: 'accord/tickets/T-1/plan.md is not committed yet: accord cannot track the stage or the tasks until it is' },
  ]);
  const ignored = ticketDetail(load(files, { 'T-1': { state: 'ignored', path: planPath } }), 'T-1');
  expect(ignored?.warnings?.map((w) => w.kind)).toEqual(['not-committed']);
  // No trackFacts entry: no warning, and the detail has no `warnings` key.
  expect(ticketWarnings(load(files), 'T-1')).toEqual([]);
  expect(Object.hasOwn(ticketDetail(load(files), 'T-1')!, 'warnings')).toBe(false);
  // The same entry for a ticket with no plan.md on disk (still at intent or approach): quiet.
  const early: Files = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') };
  expect(ticketWarnings(load(early, { 'T-1': { state: 'untracked', path: planPath } }), 'T-1')).toEqual([]);
  expect(Object.hasOwn(ticketDetail(load(early, { 'T-1': { state: 'untracked', path: planPath } }), 'T-1')!, 'warnings')).toBe(false);
});

// Phase 08.8.1 D-02: a gated plan the stage holds at plan (BUG-LN-2: dirty, or last committed under another subject) is named; a plan the stage reads at build never is, whatever its plan_hash says.
it('risk:complex-branching the plan-changed warning shows exactly when the stage holds a gated plan at plan and never at build (D-02)', () => {
  const TEXT =
    'plan.md changed after accord gate plan passed: the plan stage reviews the change, passes accord gate plan again and makes its plan-ready commit before the build goes on';
  const plan3 = PLAN + '## Task 3: Docs\ncovers: @ac-1\nfiles: src/export.ts\nverify: export#writes-csv (@ac-1)\nafter: 2\nDocument the csv mode.\n';
  const fixture = (plan: string, config = CONFIG): Files => {
    const files: Files = { 'accord/config.yml': config };
    building(files, 'T-1');
    files['accord/tickets/T-1/plan.md'] = plan;
    files['accord/tickets/T-1/ledger.md'] = '## Tasks\n- task 1 done abc1234\n';
    return files;
  };
  const load = (files: Files, extra: Record<string, unknown> = {}) => loadSnapshot({ files, tree: [], ...extra });
  const dirty = { planFacts: { 'T-1': { clean: false, subject: 'plan: T-1 ready' } } };
  const warned = { kind: 'plan-changed', text: TEXT };
  // (a) plan.md dirty: held at plan, the done task still counts.
  const a = load(fixture(plan3), dirty);
  expect(ticketWarnings(a, 'T-1')).toEqual([warned]);
  expect(ticketDetail(a, 'T-1')).toMatchObject({ stage: 'plan', tasksDone: 1, tasksTotal: 3, warnings: [warned] });
  // (b) clean, but its last commit subject is not the plan_ready subject.
  const b = load(fixture(plan3), { planFacts: { 'T-1': { clean: true, subject: 'feat: reword task 2' } } });
  expect(ticketWarnings(b, 'T-1')).toEqual([warned]);
  expect(ticketDetail(b, 'T-1')?.stage).toBe('plan');
  // (c) a body that differs from its plan_hash under a clean plan-ready commit: the stage reads build, no warning; task-done refuses.
  const c = load(fixture(plan3), { planFacts: { 'T-1': { clean: true, subject: 'plan: T-1 ready' } } });
  expect(ticketWarnings(c, 'T-1')).toEqual([]);
  expect(ticketDetail(c, 'T-1')?.stage).toBe('build');
  expect(Object.hasOwn(ticketDetail(c, 'T-1')!, 'warnings')).toBe(false);
  expect(taskVerdict(c, 'T-1', 2).reasons[0]).toMatch(/^plan\.md changed since its plan_hash was recorded/);
  // (d) the first plan, before gate plan ever passed (no plan_hash): held at plan, no warning.
  const first = load(fixture(plan3.replace(/^plan_hash:.*\n/m, '')), dirty);
  expect(ticketDetail(first, 'T-1')?.stage).toBe('plan');
  expect(ticketWarnings(first, 'T-1')).toEqual([]);
  // (e) the plan stage off for the lane: nothing holds the ticket at plan, no warning.
  const off = load(fixture(plan3, CONFIG + 'strictness:\n  stages:\n    M:\n      plan: off\n'), dirty);
  expect(ticketWarnings(off, 'T-1')).toEqual([]);
  // (f) a host that supplies no plan facts holds nothing at plan.
  expect(ticketWarnings(load(fixture(plan3)), 'T-1')).toEqual([]);
  // (g) a ticket whose records git does not hold gets the not-committed entry alone.
  const g = load(fixture(plan3), { ...dirty, trackFacts: { 'T-1': { state: 'ignored', path: 'accord/tickets/T-1/plan.md' } } });
  expect(ticketWarnings(g, 'T-1').map((w) => w.kind)).toEqual(['not-committed']);
});
