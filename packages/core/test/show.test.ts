// ST-LN-6 Task 1: the detail of one lane ticket and the label of each criterion.
import { expect, it } from 'vitest';
import { loadSnapshot, ticketDetail } from '../src/index.js';
import { acHash } from '../src/gate/hash.js';
import { CONFIG, laneTicket, REPORT } from '../../../test/helpers/lane.js';

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
