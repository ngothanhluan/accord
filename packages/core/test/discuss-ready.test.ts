// ST-LN-91 91d-ac-1: gate ready asks a lane M ticket claimed from DISCUSS_FROM on for accord/tickets/<id>/discuss.md.
import { describe, expect, it } from 'vitest';
import { claimPinBefore, DISCUSS_FROM, gateReady, loadSnapshot } from '../src/index.js';
import type { GateResult, RepoSnapshot } from '../src/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, LANE_S_BODY, laneTicket, REPORT } from '../../../test/helpers/lane.js';

const DISCUSS = 'accord/tickets/T-1/discuss.md';
const GRAY = '## Gray areas\n- behaviour — what export prints for an empty report — D-01\n';
// A release moves CONFIG's pin, so every case names the pin it means.
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

interface Opts {
  discuss?: string; // text of discuss.md; absent: no file
  pin?: string; // claim pin; absent: no claim fact
  basePin?: string;
  fact?: { error: string }; // a failed claim read
  config?: string;
  lane?: string;
  body?: string;
}
const build = ({ discuss, pin, basePin, fact, config = CONFIG, lane, body }: Opts = {}): RepoSnapshot => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1', { ...(lane === undefined ? {} : { lane }), ...(body === undefined ? {} : { body }) }),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    },
    'T-1',
  );
  if (discuss !== undefined) files[DISCUSS] = discuss;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  const claimed = fact ?? (pin === undefined ? undefined : { pin, ...(basePin === undefined ? {} : { basePin }) });
  return claimed === undefined ? snapshot : { ...snapshot, claimPins: { 'T-1': claimed } };
};
const check = (o: Opts = {}): GateResult => gateReady(build(o), 'T-1');
const missing = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.discuss-missing');
const unmapped = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.discuss-unmapped');
const discussFindings = (r: GateResult) => r.findings.filter((f) => f.rule.startsWith('gate.discuss-'));

describe('discuss record at gate ready', () => {
  it('risk:complex-branching a lane M ticket claimed at the cut-off with no discuss.md fails gate ready (ST-LN-91 91d-ac-1)', () => {
    const r = check({ pin: '0.4.1' });
    expect(r.verdict).toBe('fail');
    const f = missing(r);
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].file).toBe(DISCUSS);
    expect(f[0].reason).toContain(DISCUSS);
    expect(f[0].reason).toContain('0.4.1');
    expect(missing(check({ pin: '0.4.1', discuss: GRAY }))).toEqual([]);
  });

  it('risk:complex-branching a gray area that maps to no Decision fails gate ready and is named (ST-LN-91 91d-ac-1)', () => {
    const text = '## Gray areas\n- scope — whether totals are exported\n- tests — which layer proves ac-2 — D-09\n- behaviour — what export prints for an empty report — D-01\n';
    const r = check({ pin: '0.4.1', discuss: text });
    expect(r.verdict).toBe('fail');
    const f = unmapped(r);
    expect(f).toHaveLength(2);
    expect(f.every((x) => x.level === 'error' && x.file === DISCUSS)).toBe(true);
    expect(f[0].line).toBe(2);
    expect(f[0].reason).toContain('whether totals are exported');
    expect(f[1].line).toBe(3);
    expect(f[1].reason).toContain('which layer proves ac-2');
    expect(f[1].reason).toContain('D-09');
    expect(missing(r)).toEqual([]);
    // `— D-01` passes; `— D-01, D-09` fails and names D-09.
    expect(discussFindings(check({ pin: '0.4.1', discuss: GRAY }))).toEqual([]);
    const two = unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n- failure — a missing cell — D-01, D-09\n' }));
    expect(two).toHaveLength(1);
    expect(two[0].reason).toContain('a missing cell');
    expect(two[0].reason).toContain('D-09');
    expect(two[0].reason).not.toContain('D-01,');
  });

  it('risk:complex-branching an empty discuss record fails gate ready (ST-LN-91 91d-ac-1)', () => {
    const fenced = ['## Gray areas', '```text', '- scope — in a fence — D-01', '```', '<!-- - scope — in a comment — D-01 -->', ''].join('\n');
    for (const discuss of ['## Gray areas\n', '# Discuss\n\nNothing to ask.\n', fenced]) {
      const r = check({ pin: '0.4.1', discuss });
      const f = missing(r);
      expect(f, discuss).toHaveLength(1);
      expect(f[0].file).toBe(DISCUSS);
      expect(f[0].reason).toContain('lists no gray area');
      expect(unmapped(r)).toEqual([]);
    }
  });

  it('risk:complex-branching the claim pin decides the discuss rule on both sides of the cut-off (ST-LN-91 91d-ac-1)', () => {
    const cases: { name: string; opts: Opts; finding: boolean }[] = [
      { name: 'claimed under 0.4.0', opts: { pin: '0.4.0' }, finding: false },
      { name: 'claimed under 0.4.0, working tree upgraded to the cut-off', opts: { pin: '0.4.0', config: at(DISCUSS_FROM) }, finding: false },
      { name: 'claimed at the cut-off', opts: { pin: DISCUSS_FROM }, finding: true },
      { name: 'claimed at 0.4.10', opts: { pin: '0.4.10' }, finding: true },
      { name: 'claim pin below its merge base pin', opts: { pin: '0.4.0', basePin: DISCUSS_FROM }, finding: true },
      { name: 'a pin that is not plain x.y.z', opts: { pin: 'main' }, finding: true },
      { name: 'a failed claim read', opts: { fact: { error: 'git failed' } }, finding: true },
      { name: 'no claim fact, working tree at 0.4.0', opts: { config: at('0.4.0') }, finding: false },
      { name: 'no claim fact, working tree at the cut-off', opts: { config: at(DISCUSS_FROM) }, finding: true },
    ];
    for (const { name, opts, finding } of cases) {
      const s = build(opts);
      expect(missing(gateReady(s, 'T-1')), name).toHaveLength(finding ? 1 : 0);
      // claimPinBefore is the one reader: true in exactly the cases that give no finding.
      expect(claimPinBefore(s, 'T-1', DISCUSS_FROM), name).toBe(!finding);
    }
    // A lane S ticket and a ticket with no lane get no discuss finding at any pin.
    for (const pin of ['0.4.0', DISCUSS_FROM, '0.4.10', 'main']) {
      expect(discussFindings(check({ pin, lane: 'S', body: LANE_S_BODY })), 'lane S at ' + pin).toEqual([]);
      expect(discussFindings(check({ pin, lane: '' })), 'no lane at ' + pin).toEqual([]);
    }
    expect(discussFindings(check({ fact: { error: 'git failed' }, lane: 'S', body: LANE_S_BODY }))).toEqual([]);
  });

  it('risk:parsing the gray areas of every ## Gray areas section count, and a repeated heading fails the gate (ST-LN-91 WR-03)', () => {
    const second = '## Gray areas\n- direction — pick one — D-01\n\n## Gray areas\n- scope — never mapped —\n';
    const r = check({ pin: '0.4.1', discuss: second });
    expect(r.verdict).toBe('fail');
    const f = unmapped(r);
    // The area of the second section is read and named on its own line; the repeated heading is a finding of its own.
    expect(f.map((x) => x.line)).toEqual([4, 5]);
    expect(f[0].reason).toContain('put every gray area under the one "## Gray areas" heading');
    expect(f[1].reason).toContain('never mapped');
    // Every area mapped, the repeated heading still fails.
    const mapped = check({ pin: '0.4.1', discuss: '## Gray areas\n- a — first — D-01\n\n## Gray areas\n- b — second — D-01\n' });
    expect(mapped.verdict).toBe('fail');
    expect(unmapped(mapped)).toHaveLength(1);
    expect(unmapped(mapped)[0].reason).toContain('put every gray area under the one');
    // Another section with another name is no gray-areas section and its items are no areas.
    expect(discussFindings(check({ pin: '0.4.1', discuss: GRAY + '\n## Notes\n- scope — a note\n' }))).toEqual([]);
    // A ticket the discuss stage does not apply to gets no finding for it.
    expect(unmapped(check({ pin: '0.4.0', discuss: second }))).toEqual([]);
  });

  it('risk:parsing a heading that continues "Gray areas" is read too, and flagged (ST-LN-91 RR-WR-03)', () => {
    for (const heading of ['## Gray areas (cont.)', '## Gray areas, continued', '## gray  areas 2']) {
      const r = check({ pin: '0.4.1', discuss: '## Gray areas\n- direction — pick one — D-01\n\n' + heading + '\n- scope — never mapped\n' });
      expect(r.verdict, heading).toBe('fail');
      const f = unmapped(r);
      expect(f.map((x) => x.line), heading).toEqual([4, 5]);
      expect(f[0].reason, heading).toContain('put every gray area under the one "## Gray areas" heading');
      expect(f[1].reason, heading).toContain('never mapped');
    }
    // Mapped, the continued heading alone still fails; with no plain heading at all the one heading present is flagged.
    const mapped = unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n- a — first — D-01\n\n## Gray areas (cont.)\n- b — second — D-01\n' }));
    expect(mapped).toHaveLength(1);
    expect(mapped[0].line).toBe(4);
    const lone = unmapped(check({ pin: '0.4.1', discuss: '## Gray areas (cont.)\n- b — second — D-01\n' }));
    expect(lone.map((x) => x.line)).toEqual([1]);
  });

  it('risk:parsing a sibling area indented by one to three spaces is an area, a deeper one a note (ST-LN-91 RR-WR-03, IN-01, WR-02)', () => {
    // After a "- " item (its text starts at column 2) a line indented by 1 is a sibling; after a "1. " item (column 3) a line indented by 1 or 2 is.
    const sibling = (first: string, indent: string): (number | undefined)[] =>
      unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n' + first + '\n' + indent + '- scope — never mapped\n' })).map((x) => x.line);
    expect(sibling('- direction — pick one — D-01', ' ')).toEqual([3]);
    expect(sibling('* direction — pick one — D-01', ' ')).toEqual([3]);
    expect(sibling('1. direction — pick one — D-01', ' ')).toEqual([3]);
    expect(sibling('1. direction — pick one — D-01', '  ')).toEqual([3]);
    // A sibling after a sub-bullet is still a sibling.
    const after = unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n- direction — pick one — D-01\n  - option A\n - scope — never mapped\n' }));
    expect(after.map((x) => x.line)).toEqual([4]);
    // Four spaces or a tab is a sub-bullet; a numbered item with a closing parenthesis is an item.
    expect(discussFindings(check({ pin: '0.4.1', discuss: GRAY + '    - option A\n\t- option B\n' }))).toEqual([]);
    expect(unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n 1) a — one\n' })).map((x) => x.line)).toEqual([2]);
  });

  it('risk:parsing a sub-bullet indented as far as its item text is a note, not a gray area (ST-LN-91 WR-02)', () => {
    // Round 1 IN-01's example: two spaces under "- ".
    const nested = '## Gray areas\n\n- behaviour — what export prints for an empty report — D-01\n  - option A — cheap\n';
    expect(discussFindings(check({ pin: '0.4.1', discuss: nested }))).toEqual([]);
    // Two and three spaces under "- ", "* " and "+ " items, three under "1. ", four under "10. ", any depth below.
    const firsts = [
      '- a — x — D-01\n   - note',
      '- a — x — D-01\n  * note\n    + deeper',
      '1. a — x — D-01\n   - note\n   1. note',
      '* a — x — D-01\n  - note',
      '+ a — x — D-01\n  - note',
      '10. a — x — D-01\n    - note',
    ];
    for (const first of firsts) expect(discussFindings(check({ pin: '0.4.1', discuss: '## Gray areas\n' + first + '\n' })), first).toEqual([]);
    // A nested item alone is no area: the item before it is the area.
    expect(unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n- a — x\n  - note — D-01\n' })).map((x) => x.line)).toEqual([2]);
    // The offset starts again under a new heading: the first item of a later section is an area at any indent up to three.
    const later = unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n- a — x — D-01\n\n## Gray areas\n  - b — y\n' }));
    expect(later.map((x) => x.line)).toEqual([4, 5]);
  });

  it('risk:parsing a paragraph or a blank line that ends the list starts the offset again, so a later unmapped area is caught (ST-LN-91 WR-02 round 4)', () => {
    const after = (between: string, item = '  - scope — never mapped'): (number | undefined)[] =>
      unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n\n- behaviour — what export prints — D-01\n' + between + item + '\n' })).map((x) => x.line);
    // W2e: a paragraph at column 0 after a blank line ends the list; the indented item after it is a new top-level list.
    expect(after('\nThe planner also raised:\n\n')).toEqual([7]);
    expect(after('\nThe planner also raised:\n')).toEqual([6]);
    expect(after('\nA note.\n\nAnother note.\n\n')).toEqual([9]);
    // A line that continues the item's paragraph (no blank line before it) does not end the list: the sub-bullet stays a note.
    expect(after('continued text of the item\n')).toEqual([]);
    expect(after('\n  more of the item, indented\n')).toEqual([]);
    expect(after('\n')).toEqual([]);
    // Five or more spaces after the marker: the text starts one column after it, so a sub-bullet two (or three) spaces in is nested in it.
    expect(unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n-     behaviour — what export prints — D-01\n  - option A\n' })).map((x) => x.line)).toEqual([]);
    expect(unmapped(check({ pin: '0.4.1', discuss: '## Gray areas\n1.     behaviour — what export prints — D-01\n   - option A\n' })).map((x) => x.line)).toEqual([]);
  });

  it('risk:parsing a list item indented by four spaces or a tab is a note, never a gray area (ST-LN-91 IN-01)', () => {
    const nested = '## Gray areas\n- behaviour — what export prints for an empty report — D-01\n    - option A — cheap\n\t- option B — dear\n        * option C\n';
    expect(discussFindings(check({ pin: '0.4.1', discuss: nested }))).toEqual([]);
    // An item indented by four spaces alone is no area at all.
    const only = missing(check({ pin: '0.4.1', discuss: '## Gray areas\n    - scope — indented — D-01\n' }));
    expect(only).toHaveLength(1);
    expect(only[0].reason).toContain('lists no gray area');
    // Numbered items and every bullet mark still count.
    const marks = check({ pin: '0.4.1', discuss: '## Gray areas\n1. a — one\n* b — two\n+ c — three\n' });
    expect(unmapped(marks).map((x) => x.line)).toEqual([2, 3, 4]);
  });

  it('risk:parsing an area with no gray area text counts as unmapped (ST-LN-91 IN-02)', () => {
    for (const line of ['- scope — D-01', '- x — D-01', '- scope —  — D-01']) {
      const r = check({ pin: '0.4.1', discuss: '## Gray areas\n' + line + '\n' });
      expect(r.verdict, line).toBe('fail');
      const f = unmapped(r);
      expect(f, line).toHaveLength(1);
      expect(f[0].line).toBe(2);
      expect(f[0].reason).toContain('names no gray area');
    }
    // With its words the same line passes.
    expect(discussFindings(check({ pin: '0.4.1', discuss: '## Gray areas\n- scope — whether totals are exported — D-01\n' }))).toEqual([]);
  });

  it('risk:complex-branching a failed claim read is named in the discuss finding and still fails closed (ST-LN-91 WR-01)', () => {
    const fact = { error: 'git failed reading the claim pin of T-1: unable to read the index' };
    const none = missing(check({ fact }));
    expect(none).toHaveLength(1);
    expect(none[0].reason).toContain(DISCUSS);
    expect(none[0].reason).toContain(fact.error);
    const empty = missing(check({ fact, discuss: '## Gray areas\n' }));
    expect(empty).toHaveLength(1);
    expect(empty[0].reason).toContain('lists no gray area');
    expect(empty[0].reason).toContain(fact.error);
    // A readable claim fact adds no such text.
    expect(missing(check({ pin: '0.4.1' }))[0].reason).not.toContain('git failed');
    // Mapped, the failed read adds no finding at all.
    expect(discussFindings(check({ fact, discuss: GRAY }))).toEqual([]);
  });

  it('risk:complex-branching a lane L or lane P ticket claimed at the cut-off takes the discuss rule (ST-LN-91 D-18)', () => {
    for (const lane of ['L', 'P']) {
      const f = missing(check({ pin: DISCUSS_FROM, lane }));
      expect(f, lane).toHaveLength(1);
      expect(f[0].reason).toContain(DISCUSS);
      expect(missing(check({ pin: '0.4.0', lane })), lane + ' claimed under 0.4.0').toEqual([]);
    }
  });

  it('risk:dos a long hostile discuss line is read in bounded time (ST-LN-91 91d-ac-1)', () => {
    const lines = ['## Gray areas', '- scope' + ' — D-'.repeat(40_000), '- tests — ' + 'x'.repeat(100_000) + ' — ' + 'D-1, '.repeat(20_000) + 'x', ''];
    const started = Date.now();
    const r = check({ pin: DISCUSS_FROM, discuss: lines.join('\n') });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(unmapped(r).length).toBeGreaterThan(0);
  });
});
