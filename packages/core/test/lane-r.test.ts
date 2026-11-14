// ST-LN-94 94-ac-1, D-10, D-13: a lane R ticket holds a question, a timebox and a token budget, and gate ready passes it with no
// approval, Approach, discuss record or scenario. The config pins DISCUSS_FROM, so the discuss rules would apply to a lane M ticket here.
import { expect, it } from 'vitest';
import { DISCUSS_FROM, gateReady, laneRHash, loadSnapshot, readTimebox, readTokenBudget } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const QUOTE = '- D-01 Timebox 4 hours, token budget 800k weighted tokens — "four hours and 800k is enough"';
const body = (o: { question?: string; timebox?: string; budget?: string; decisions?: string } = {}) =>
  [
    ...(o.question === undefined ? ['## Question', 'Does the critic need a second round?', ''] : o.question === '-' ? [] : ['## Question', o.question, '']),
    ...(o.timebox === undefined ? ['## Timebox', '4 hours', ''] : o.timebox === '-' ? [] : ['## Timebox', o.timebox, '']),
    ...(o.budget === undefined ? ['## Token budget', '800k weighted tokens', ''] : o.budget === '-' ? [] : ['## Token budget', o.budget, '']),
    '## Decisions',
    ...(o.decisions === undefined ? [QUOTE] : o.decisions === '' ? [] : [o.decisions]),
    '',
  ].join('\n');
const config = CONFIG.replace('accord: "0.4.0"', `accord: "${DISCUSS_FROM}"`);
const snap = (b: string) => {
  const files = { 'accord/config.yml': config, 'accord/tickets/R-1.md': laneTicket('R-1', { lane: 'R', body: b }) };
  return loadSnapshot({ files, tree: Object.keys(files).sort() });
};
const ready = (b: string) => gateReady(snap(b), 'R-1');
const ruled = (r: GateResult, rule: string) => r.findings.filter((f) => f.rule === rule);

it('risk:complex-branching a lane R ticket with a question, a timebox and a token budget passes gate ready (ST-LN-94 94-ac-1)', () => {
  const s = snap(body());
  expect(s.tickets['R-1'].frontmatter?.lane).toBe('R');
  const r = gateReady(s, 'R-1');
  expect(r.findings).toEqual([]);
  expect(r.verdict).toBe('pass');
  expect(r.acHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  expect(r.acHash).toBe(laneRHash(s.tickets['R-1']));
  // The hash reads the three sections: a changed question moves it, a changed Decision does not.
  expect(laneRHash(snap(body({ question: 'Does the planner need a second round?' })).tickets['R-1'])).not.toBe(r.acHash);
  expect(laneRHash(snap(body({ decisions: QUOTE + '\n- D-02 Read the 2026 record — "yes"' })).tickets['R-1'])).toBe(r.acHash);
});

it('risk:complex-branching a lane R ticket missing its question, timebox or budget fails gate ready and names it (ST-LN-94 94-ac-1)', () => {
  const cases: [string, Parameters<typeof body>[0]][] = [
    ['Question', { question: '-' }],
    ['Question', { question: '<!-- the question -->' }],
    ['Timebox', { timebox: '-' }],
    ['Timebox', { timebox: '' }],
    ['Token budget', { budget: '-' }],
    ['Token budget', { budget: '<!-- n weighted tokens -->' }],
  ];
  for (const [name, o] of cases) {
    const r = ready(body(o));
    const f = ruled(r, 'gate.research-field-missing');
    expect(f, name + ' ' + JSON.stringify(o)).toHaveLength(1);
    expect(f[0].reason).toContain(`"## ${name}"`);
    expect(f[0].file).toBe('accord/tickets/R-1.md');
    expect(f[0].level).toBe('error');
    expect(r.verdict).toBe('fail');
  }
  const t = ruled(ready(body({ timebox: 'about a day' })), 'gate.research-field-missing');
  expect(t).toHaveLength(1);
  expect(t[0].reason).toContain('"## Timebox"');
  expect(t[0].reason).toContain('<n> minutes or <n> hours');
  const b = ruled(ready(body({ budget: 'lots' })), 'gate.research-field-missing');
  expect(b).toHaveLength(1);
  expect(b[0].reason).toContain('"## Token budget"');
  expect(b[0].reason).toContain('<n> weighted tokens');
  for (const o of [{ timebox: '90 minutes' }, { timebox: '1 hours' }, { budget: '250000 weighted tokens' }, { budget: '2M weighted tokens' }]) {
    expect(ruled(ready(body(o)), 'gate.research-field-missing'), JSON.stringify(o)).toEqual([]);
  }
  expect([readTimebox('90 minutes'), readTimebox('1 hours'), readTimebox('4 hours'), readTimebox('about a day')]).toEqual([90, 60, 240, undefined]);
  expect([readTokenBudget('250000 weighted tokens'), readTokenBudget('2M weighted tokens'), readTokenBudget('800k weighted tokens'), readTokenBudget('lots')]).toEqual([
    250000, 2000000, 800000, undefined,
  ]);
  expect([readTimebox('0 hours'), readTokenBudget('0 weighted tokens'), readTimebox('4 hours later')]).toEqual([undefined, undefined, undefined]);
});
