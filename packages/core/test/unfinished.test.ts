// ST-LN-72 72-ac-1, plan half: a file still being written carries the fixed line `<!-- accord: unfinished -->`, and from UNFINISHED_FROM `accord gate plan` refuses a plan.md
// that carries it, naming the file. The marker is read on the raw text, so the HTML-comment stripping of the section readers cannot hide it; the claim pin decides (D-16).
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot, UNFINISHED_FROM, UNFINISHED_MARKER, unfinishedLine } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { parsePlan } from '../src/load/work.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, REPORT } from '../../../test/helpers/lane.js';

const BASELINE = 'abc1234';
const BOM = String.fromCharCode(0xfeff);
const TASKS = [
  '## Task 1: Step 1',
  'covers: @ac-1, @ac-2, D-01',
  'files: src/export.ts',
  'verify: export#writes-csv (@ac-1) export#escapes-commas (@ac-2)',
  'after: none',
  '',
].join('\n');
const FRONT = ['---', `baseline: ${BASELINE}`, 'plan_hash: "fnv1a64:061c24200fe9bbf9"', '---'];

/** A plan whose first body line is `first` (the marker's place, RESEARCH Pitfall 5), then the tasks. */
const planWith = (first: string | undefined, eol = '\n'): string =>
  [...FRONT, ...(first === undefined ? [] : [first]), '', '# Plan', '', TASKS].join('\n').replace(/\n/g, eol);

type Claim = { pin?: string; basePin?: string } | { error: string };
interface Opts {
  plan?: string;
  claim?: Claim;
  lane?: string;
  config?: string;
}
const build = ({ plan = planWith(UNFINISHED_MARKER), claim, lane, config = CONFIG }: Opts = {}) => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1', lane === undefined ? {} : { lane }),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
      'accord/tickets/T-1/plan.md': plan,
    },
    'T-1',
  );
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  return { ...snapshot, ...(claim === undefined ? {} : { claimPins: { 'T-1': claim } }), baselineFiles: { [BASELINE]: ['src/export.ts'] } };
};
const check = (o: Opts = {}): GateResult => gatePlan(build(o), 'T-1');
const unfinished = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.plan-unfinished');
const NEW: Claim = { pin: UNFINISHED_FROM };

describe('unfinished marker: read on the raw text', () => {
  it('risk:parsing the unfinished marker is read on the raw text wherever it stands as a whole line (ST-LN-72 72-ac-1)', () => {
    expect(UNFINISHED_MARKER).toBe('<!-- accord: unfinished -->');
    expect(UNFINISHED_FROM).toBe('0.6.0');
    const read = (text: string) => parsePlan('accord/tickets/T-1/plan.md', text).plan.unfinished;

    // first body line, right after the frontmatter's closing ---: line 5 of the file
    expect(read(planWith(UNFINISHED_MARKER))).toBe(5);
    // the same with CRLF and with a BOM: the same line
    expect(read(planWith(UNFINISHED_MARKER, '\r\n'))).toBe(5);
    expect(read(BOM + planWith(UNFINISHED_MARKER))).toBe(5);
    expect(read(BOM + planWith(UNFINISHED_MARKER, '\r\n'))).toBe(5);
    // padded with spaces or a tab, still the whole line once trimmed
    expect(read(planWith(`  ${UNFINISHED_MARKER}\t`))).toBe(5);
    // above the frontmatter: detected too, although the frontmatter then no longer parses
    expect(read([UNFINISHED_MARKER, ...FRONT, '', '# Plan', '', TASKS].join('\n'))).toBe(1);
    // lower down in the file: still an unfinished file, the first such line is the one named
    expect(read([planWith(undefined), UNFINISHED_MARKER, UNFINISHED_MARKER].join('\n'))).toBe(planWith(undefined).split('\n').length + 1);
    // the HTML-comment stripping of the section readers cannot hide it: it stands inside a task section too
    expect(read(planWith(undefined) + `${UNFINISHED_MARKER}\n`)).toBeDefined();

    // quoted inside a sentence, or with other text on its line, it is not the marker
    expect(read(planWith(`The line \`${UNFINISHED_MARKER}\` marks a file still being written.`))).toBeUndefined();
    expect(read(planWith(`${UNFINISHED_MARKER} still writing`))).toBeUndefined();
    expect(read(planWith(`note ${UNFINISHED_MARKER}`))).toBeUndefined();
    expect(read(planWith('<!-- accord: unfinished -->  <!-- another -->'))).toBeUndefined();
    expect(read(planWith('<!-- accord: finished -->'))).toBeUndefined();
    // a plan without it has no `unfinished`, and the key is absent rather than set to a falsy value
    const clean = parsePlan('accord/tickets/T-1/plan.md', planWith(undefined)).plan;
    expect(clean.unfinished).toBeUndefined();
    expect(Object.hasOwn(clean, 'unfinished')).toBe(false);

    // the reader itself: 1-based, pure on a string
    expect(unfinishedLine(`a\n${UNFINISHED_MARKER}\nb`)).toBe(2);
    expect(unfinishedLine('')).toBeUndefined();
    expect(unfinishedLine(`${BOM}${UNFINISHED_MARKER}\r\nx`)).toBe(1);
  });
});

describe('unfinished marker: gate plan', () => {
  it('ac-1 gate plan refuses a plan.md that carries the unfinished marker, naming the file (ST-LN-72 72-ac-1)', () => {
    const got = unfinished(check({ claim: NEW }));
    expect(got).toHaveLength(1);
    expect(got[0].level).toBe('error');
    expect(got[0].file).toBe('accord/tickets/T-1/plan.md');
    expect(got[0].line).toBe(5);
    expect(got[0].reason).toContain('accord/tickets/T-1/plan.md');
    expect(got[0].reason).toContain(UNFINISHED_MARKER);
    expect(check({ claim: NEW }).verdict).toBe('fail');

    // the same plan once the planner has removed the line: no finding
    expect(unfinished(check({ plan: planWith(undefined), claim: NEW }))).toEqual([]);
    // a marker above the frontmatter is refused too, at line 1
    const above = unfinished(check({ plan: [UNFINISHED_MARKER, ...FRONT, '', '# Plan', '', TASKS].join('\n'), claim: NEW }));
    expect(above.map((f) => f.line)).toEqual([1]);

    // claimed before 0.6.0: answered as before
    expect(unfinished(check({ claim: { pin: '0.5.1' } }))).toEqual([]);
    expect(unfinished(check({ claim: { pin: '0.5.1', basePin: '0.5.0' } }))).toEqual([]);
    // a failed claim read fails closed, and the finding says why
    const failed = unfinished(check({ claim: { error: 'fatal: bad object 1234567' } }));
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toContain('fatal: bad object 1234567');
    expect(failed[0].reason).toContain('the claim pin could not be read');

    // lane S and a switched-off plan stage have no plan gate to refuse it
    expect(unfinished(check({ claim: NEW, lane: 'S' }))).toEqual([]);
    expect(unfinished(check({ claim: NEW, config: CONFIG + 'strictness:\n  stages:\n    M:\n      plan: off\n' }))).toEqual([]);
    // the answer is the same on every run
    expect(JSON.stringify(check({ claim: NEW }))).toBe(JSON.stringify(check({ claim: NEW })));
  });
});
