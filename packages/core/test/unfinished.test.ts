// ST-LN-72 72-ac-1, plan half: a file still being written carries the fixed line `<!-- accord: unfinished -->`, and `accord gate plan` refuses a plan.md that carries it, naming the file,
// on every ticket whatever its claim pin (owner decision 2026-11-16, an exception to D-16). The marker is read on the raw text, so the HTML-comment stripping of the section readers cannot
// hide it, and it counts on any body line outside a fence (round 2: fail closed).
import { describe, expect, it } from 'vitest';
import { anchorText, gateDone, gatePlan, LOCKED, loadSnapshot, UNFINISHED_MARKER, unfinishedEpisode, unfinishedLine } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { parseVerification } from '../src/load/verification.js';
import { parsePlan } from '../src/load/work.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, LANE_S_BODY, laneTicket, REPORT } from '../../../test/helpers/lane.js';

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
const NEW: Claim = { pin: '0.6.0' };

describe('unfinished marker: read on the raw text', () => {
  it('risk:parsing the unfinished marker is read on the raw text, on any body line outside a fence (ST-LN-72 72-ac-1, review rounds 1 and 2)', () => {
    expect(UNFINISHED_MARKER).toBe('<!-- accord: unfinished -->');
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
    // blank lines between the closing --- and the marker do not hide it
    expect(read([...FRONT, '', '', UNFINISHED_MARKER, '# Plan', '', TASKS].join('\n'))).toBe(7);
    // ST-LN-72 review round 2: FAIL CLOSED. The marker counts on any body line outside a fence, so a heading or a paragraph before it cannot hide it
    expect(read([...FRONT, '# Plan', UNFINISHED_MARKER, '', TASKS].join('\n'))).toBe(6);
    expect(read([planWith(undefined), UNFINISHED_MARKER, UNFINISHED_MARKER].join('\n'))).toBe(planWith(undefined).split('\n').length + 1);
    expect(read(planWith(undefined) + `${UNFINISHED_MARKER}
`)).toBe(planWith(undefined).split('\n').length);
    // a frontmatter with nothing in it (`---` then `---`) is still a frontmatter: the marker below it is found, and the body is not swallowed into it
    expect(read(['---', '---', '# Plan', UNFINISHED_MARKER, '', 'text'].join('\n'))).toBe(4);
    expect(read(['---', '---', UNFINISHED_MARKER, ''].join('\n'))).toBe(3);
    expect(read(['---', '---', '# Plan', UNFINISHED_MARKER, '---', 'x', ''].join('\n'))).toBe(4);
    expect(read(['---', '---', '# Plan', '---', 'x', ''].join('\n'))).toBeUndefined();
    // a quote inside a fence (pasted test output, a plan's example) does not count, whatever the fence character
    expect(read(planWith(undefined) + ['```', UNFINISHED_MARKER, '```', ''].join('\n'))).toBeUndefined();
    expect(read(planWith(undefined) + ['~~~', UNFINISHED_MARKER, '~~~', ''].join('\n'))).toBeUndefined();
    expect(read(planWith(undefined) + ['```text', 'out', UNFINISHED_MARKER, '```', ''].join('\n'))).toBeUndefined();
    // an unterminated fence runs to the end of the file, so a marker in it is quoted too
    expect(read(planWith(undefined) + ['```', UNFINISHED_MARKER, ''].join('\n'))).toBeUndefined();
    // outside a fence again after one closes: it counts, at its own line
    const fenced = planWith(undefined) + ['```', UNFINISHED_MARKER, '```', UNFINISHED_MARKER, ''].join('\n');
    expect(read(fenced)).toBe(fenced.split('\n').length - 1);
    // in the frontmatter it is a YAML comment, never a body line
    expect(read(['---', UNFINISHED_MARKER, `baseline: ${BASELINE}`, '---', '', '# Plan', '', TASKS].join('\n'))).toBeUndefined();

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

    // the reader itself takes the body the loader already split and its offset; 1-based, pure on a string
    expect(unfinishedLine(`${UNFINISHED_MARKER}\nb`)).toBe(1);
    expect(unfinishedLine(`a\n${UNFINISHED_MARKER}\nb`)).toBe(2);
    expect(unfinishedLine(`a\n${UNFINISHED_MARKER}\nb`, 4)).toBe(6);
    expect(unfinishedLine('')).toBeUndefined();
  });
});

describe('unfinished marker: gate plan', () => {
  it('risk:complex-branching a plan quoting the marker inside a fence is not refused, and one carrying it under a heading is (ST-LN-72 review round 2)', () => {
    const quoting = planWith(undefined) + ['```', UNFINISHED_MARKER, '```', ''].join('\n');
    expect(unfinished(check({ plan: quoting, claim: NEW }))).toEqual([]);
  });

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

    // owner decision 2026-11-16 (an exception to D-16): the rule reads no claim pin, so a ticket claimed before 0.6.0 is refused too
    expect(unfinished(check({ claim: { pin: '0.5.1' } }))).toHaveLength(1);
    expect(unfinished(check({ claim: { pin: '0.5.1', basePin: '0.5.0' } }))).toHaveLength(1);
    expect(unfinished(check({}))).toHaveLength(1);
    // a failed claim read changes nothing: the rule never asks for the pin, so no note about it
    const failed = unfinished(check({ claim: { error: 'fatal: bad object 1234567' } }));
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).not.toContain('the claim pin could not be read');

    // lane S and a switched-off plan stage have no plan gate to refuse it
    expect(unfinished(check({ claim: NEW, lane: 'S' }))).toEqual([]);
    expect(unfinished(check({ claim: NEW, config: CONFIG + 'strictness:\n  stages:\n    M:\n      plan: off\n' }))).toEqual([]);
    // the answer is the same on every run
    expect(JSON.stringify(check({ claim: NEW }))).toBe(JSON.stringify(check({ claim: NEW })));
  });
});

// ST-LN-72 72-ac-1, verification half: `accord gate done` refuses a verification.md that carries the marker (LOCKED), and `accord anchor` prints the resume-or-restart fact.
const VERIFICATION = 'accord/tickets/T-1/verification.md';
/** A verification record whose first body line is `first` (the marker's place), then one evidence block. */
const verificationWith = (first: string | undefined, commit = 'abc1234def56'): string =>
  ['---', 'ticket: "T-1"', `commit: "${commit}"`, 'reviewed_on: "2026-11-16"', '---', ...(first === undefined ? [] : [first]), '', '## @ac-1 export writes a csv', '', 'Result: pass', '', 'Evidence: export#writes-csv passed', ''].join('\n');

interface DoneOpts {
  verification?: string;
  plan?: string;
  claim?: Claim;
  head?: string | null;
  config?: string;
}
const buildDone = ({ verification = verificationWith(UNFINISHED_MARKER), plan, claim, head = 'abc1234def56abc1234def56abc1234def56abcd', config = CONFIG }: DoneOpts = {}) => {
  const files: Record<string, string> = approved(
    {
      'accord/config.yml': config,
      'accord/tickets/T-1.md': laneTicket('T-1'),
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
      [VERIFICATION]: verification,
      ...(plan === undefined ? {} : { 'accord/tickets/T-1/plan.md': plan }),
    },
    'T-1',
  );
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  return { ...snapshot, ...(claim === undefined ? {} : { claimPins: { 'T-1': claim } }), ...(head === null ? {} : { git: { commit: head, authors: {} } }) };
};
const doneOf = (o: DoneOpts = {}): GateResult => gateDone(buildDone(o), 'T-1');
const verifUnfinished = (r: GateResult) => r.findings.filter((f) => f.rule === 'gate.verification-unfinished');
const anchor = (o: DoneOpts = {}): string[] => (anchorText(buildDone(o), 'T-1') ?? '').split('\n').filter((l) => l.startsWith('Unfinished:'));

describe('unfinished marker: gate done', () => {
  it('ac-1 gate done refuses a verification.md that carries the unfinished marker, naming the file (ST-LN-72 72-ac-1)', () => {
    expect(parseVerification(VERIFICATION, VERIFICATION, verificationWith(UNFINISHED_MARKER)).verification.unfinished).toBe(6);
    expect(Object.hasOwn(parseVerification(VERIFICATION, VERIFICATION, verificationWith(undefined)).verification, 'unfinished')).toBe(false);

    const got = verifUnfinished(doneOf({ claim: NEW }));
    expect(got).toHaveLength(1);
    expect(got[0].level).toBe('error');
    expect(got[0].file).toBe(VERIFICATION);
    expect(got[0].line).toBe(6);
    expect(got[0].reason).toContain(VERIFICATION);
    expect(got[0].reason).toContain(UNFINISHED_MARKER);
    expect(doneOf({ claim: NEW }).verdict).toBe('fail');

    // the same record once the verifier has removed the line: no finding
    expect(verifUnfinished(doneOf({ verification: verificationWith(undefined), claim: NEW }))).toEqual([]);
    // owner decision 2026-11-16 (an exception to D-16): no claim pin exempts a ticket, so one claimed before 0.6.0 is refused too
    expect(verifUnfinished(doneOf({ claim: { pin: '0.5.1' } }))).toHaveLength(1);
    expect(verifUnfinished(doneOf({ claim: { pin: '0.5.1', basePin: '0.5.0' } }))).toHaveLength(1);
    expect(verifUnfinished(doneOf({}))).toHaveLength(1);
    const failed = verifUnfinished(doneOf({ claim: { error: 'fatal: bad object 1234567' } }));
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).not.toContain('the claim pin could not be read');
    // the rule reads no runtimes: a repository that installs no accord agent is refused the same way (D-18)
    expect(verifUnfinished(doneOf({ claim: NEW, config: CONFIG.replace('runtimes: [claude]', 'runtimes: [codex, cursor, copilot]') }))).toHaveLength(1);

    // the rule is on the floor: no strictness key lowers it, so the refusal stands under a loosened config
    expect(LOCKED).toContain('gate.verification-unfinished');
    const loosened = CONFIG + 'strictness:\n  levels:\n    gate.verification-unfinished: off\n';
    expect(verifUnfinished(doneOf({ claim: NEW, config: loosened }))).toHaveLength(1);
    // the answer is the same on every run
    expect(JSON.stringify(doneOf({ claim: NEW }))).toBe(JSON.stringify(doneOf({ claim: NEW })));
  });

  it('risk:complex-branching a verification quoting the marker in a fenced evidence block is not refused, so it cannot be locked out of Done; one carrying it under a heading is (ST-LN-72 review round 2)', () => {
    const fence = '```';
    const quoting = verificationWith(undefined).replace('Evidence: export#writes-csv passed', `Evidence: the run printed\n${fence}\n${UNFINISHED_MARKER}\n${fence}\nexport#writes-csv passed`);
    expect(quoting).toContain(`\n${UNFINISHED_MARKER}\n`);
    expect(verifUnfinished(doneOf({ verification: quoting, claim: NEW }))).toEqual([]);
    expect(anchor({ verification: quoting })).toEqual([]);
    // a heading before the marker hides nothing
    const lowered = verificationWith('## @ac-1 export writes a csv\n' + UNFINISHED_MARKER);
    expect(verifUnfinished(doneOf({ verification: lowered, claim: NEW }))).toHaveLength(1);
  });
});

describe('unfinished marker: accord anchor', () => {
  const FULL = 'abc1234def56abc1234def56abc1234def56abcd';
  it('risk:complex-branching accord anchor tells the plan and verify stages to resume or start over (ST-LN-72 72-ac-1)', () => {
    // no marker, no line
    expect(anchor({ verification: verificationWith(undefined) })).toEqual([]);
    // a marked plan: resume the planner (the verification half is clean here)
    expect(anchor({ verification: verificationWith(undefined), plan: planWith(UNFINISHED_MARKER) })).toEqual([
      'Unfinished: accord/tickets/T-1/plan.md: resume the planner',
    ]);
    // a marked verification whose commit: is HEAD, in both abbreviation directions
    expect(anchor({ verification: verificationWith(UNFINISHED_MARKER, 'abc1234def56') })).toEqual([`Unfinished: ${VERIFICATION}: resume the verifier`]);
    expect(anchor({ verification: verificationWith(UNFINISHED_MARKER, FULL), head: 'abc1234def56' })).toEqual([`Unfinished: ${VERIFICATION}: resume the verifier`]);
    // another commit: start over, naming both
    expect(anchor({ verification: verificationWith(UNFINISHED_MARKER, '1111111aaaa') })).toEqual([
      `Unfinished: ${VERIFICATION}: written at 1111111aaaa, HEAD is ${FULL}: start the verifier over`,
    ]);
    // a commit shorter than 7 characters never counts as equal
    expect(anchor({ verification: verificationWith(UNFINISHED_MARKER, 'abc123') })[0]).toContain('start the verifier over');
    // no git: start over
    expect(anchor({ verification: verificationWith(UNFINISHED_MARKER), head: null })).toEqual([
      `Unfinished: ${VERIFICATION}: written at abc1234def56, HEAD is unknown: start the verifier over`,
    ]);
    // both files marked: the plan first
    const both = anchor({ plan: planWith(UNFINISHED_MARKER), verification: verificationWith(UNFINISHED_MARKER) });
    expect(both.map((l) => l.split(':')[1].trim())).toEqual(['accord/tickets/T-1/plan.md', VERIFICATION]);
    // the lines sit right after Stage:, before the owner's sections
    const text = anchorText(buildDone({ verification: verificationWith(UNFINISHED_MARKER) }), 'T-1') as string;
    expect(text.indexOf('Unfinished:')).toBeLessThan(text.indexOf('## Intent'));
  });
});

describe('unfinished marker: anchor and gates agree', () => {
  const planLines = (lane: string | undefined): string[] =>
    (anchorText(build({ plan: planWith(UNFINISHED_MARKER), ...(lane === undefined ? {} : { lane }) }), 'T-1') ?? '').split('\n').filter((l) => l.startsWith('Unfinished:'));

  it('risk:complex-branching anchor prints the plan line exactly where gate plan refuses it, and a claim pin changes neither (ST-LN-72 review round 1)', () => {
    // lane M: refused, printed
    expect(unfinished(check({}))).toHaveLength(1);
    expect(planLines(undefined)).toEqual(['Unfinished: accord/tickets/T-1/plan.md: resume the planner']);
    // lane S: gate plan does not read a plan, so the anchor does not tell anyone to resume one
    expect(unfinished(check({ lane: 'S' }))).toEqual([]);
    expect(planLines('S')).toEqual([]);
    // lane R: its own plan table refuses any plan and never reads the marker, so the anchor prints no resume line either
    expect(unfinished(check({ lane: 'R' }))).toEqual([]);
    expect(planLines('R')).toEqual([]);
    // the claim pin is in neither: a ticket claimed before 0.6.0 gets the line too (owner decision 2026-11-16)
    const old = build({ plan: planWith(UNFINISHED_MARKER), claim: { pin: '0.5.1' } });
    expect((anchorText(old, 'T-1') ?? '').split('\n').filter((l) => l.startsWith('Unfinished:'))).toHaveLength(1);
  });

  it.each(['S', 'R'])('risk:complex-branching anchor prints no verification line for lane %s, whose Done table has no such rule (ST-LN-72 review round 1)', (lane) => {
    const files: Record<string, string> = approved(
      {
        'accord/config.yml': CONFIG,
        'accord/tickets/T-1.md': laneTicket('T-1', { lane, ...(lane === 'S' ? { body: LANE_S_BODY } : {}) }),
        [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
        [VERIFICATION]: verificationWith(UNFINISHED_MARKER),
      },
      'T-1',
    );
    const snapshot = { ...loadSnapshot({ files, tree: Object.keys(files).sort() }), git: { commit: 'abc1234def56abc1234def56abc1234def56abcd', authors: {} } };
    expect(verifUnfinished(gateDone(snapshot, 'T-1'))).toEqual([]);
    expect((anchorText(snapshot, 'T-1') ?? '').split('\n').filter((l) => l.startsWith('Unfinished:'))).toEqual([]);
  });

  it('risk:complex-branching anchor prints the verification line for lane M, L and P, as gate done refuses it (ST-LN-72 review round 1)', () => {
    for (const lane of ['M', 'L', 'P']) {
      const snapshot = buildDone({ verification: verificationWith(UNFINISHED_MARKER), claim: { pin: '0.5.1' } });
      snapshot.tickets['T-1'] = { ...snapshot.tickets['T-1'], frontmatter: { ...snapshot.tickets['T-1'].frontmatter!, lane } as never };
      expect(verifUnfinished(gateDone(snapshot, 'T-1')), lane).toHaveLength(1);
      expect((anchorText(snapshot, 'T-1') ?? '').split('\n').filter((l) => l.startsWith('Unfinished:')), lane).toEqual([`Unfinished: ${VERIFICATION}: resume the verifier`]);
    }
  });
});

// ST-LN-72 review round 1, findings 5 and 6: debug.md keeps every episode, so its marker is the first line under the last `## Episode <n>` heading, and the anchor reports it.
const DEBUG = 'accord/tickets/T-1/debug.md';
const FINISHED = ['## Episode 1', '', '## Symptom', 'old failure', '', '## Root cause', 'a finished cause', ''];
const episode = (n: number, ...first: string[]): string[] => [`## Episode ${n}`, ...first, '## Symptom', 'the failing command', ''];

describe('unfinished marker: debug.md episodes', () => {
  it('risk:parsing an episode is unfinished when its first line is the marker, and only the last open episode is read (ST-LN-72 review round 1)', () => {
    const read = (...lines: string[]) => unfinishedEpisode(lines.join('\n'));
    // the marker directly under the last episode heading, earlier episodes kept above it
    expect(read(...FINISHED, ...episode(2, UNFINISHED_MARKER))).toBe(FINISHED.length + 2);
    expect(read(...episode(1, UNFINISHED_MARKER))).toBe(2);
    // blank lines under the heading do not hide it; CRLF and a BOM do not either
    expect(read(...episode(1, '', UNFINISHED_MARKER))).toBe(3);
    expect(unfinishedEpisode(`${BOM}${episode(1, UNFINISHED_MARKER).join('\r\n')}`)).toBe(2);
    // a finished earlier episode that still shows the marker is not the open one
    expect(read(...episode(1, UNFINISHED_MARKER), ...episode(2))).toBeUndefined();
    // the marker quoted lower down in the episode, or in a fence, is evidence
    expect(read(...episode(2), UNFINISHED_MARKER)).toBeUndefined();
    expect(read(...FINISHED, '## Episode 2', '```', UNFINISHED_MARKER, '```', '## Symptom', 'x')).toBeUndefined();
    // the marker on the first line of the file, above any heading, is not an episode's
    expect(read(UNFINISHED_MARKER, ...FINISHED)).toBeUndefined();
    // ST-LN-72 review round 2: ONE definition of open, the skill's and the code's: an episode is closed once a `## Resolved` heading follows its own heading
    expect(read(...episode(1, UNFINISHED_MARKER), '## Resolved', 'fixed in abc1234')).toBeUndefined();
    // a section after `## Resolved` (a later `## Fixes`) does not reopen it
    expect(read(...episode(1, UNFINISHED_MARKER), '## Resolved', 'fixed in abc1234', '## Fixes', 'x')).toBeUndefined();
    // a new `## Episode` after `## Resolved` opens a new episode, and its marker is read
    expect(read(...episode(1), '## Resolved', 'fixed in abc1234', ...episode(2, UNFINISHED_MARKER))).toBe(episode(1).length + 2 + 2);
    // `## Resolved` written before the episode heading closes nothing
    expect(read('## Resolved', 'x', ...episode(1, UNFINISHED_MARKER))).toBe(4);
    // no episode heading, no episode
    expect(read('# Debug', UNFINISHED_MARKER)).toBeUndefined();
    expect(read()).toBeUndefined();
  });

  it('ac-1 the anchor tells the debug stage to resume the debugger, and says nothing about a finished debug.md (ST-LN-72 review round 1)', () => {
    const withDebug = (debug: string | undefined, lane?: string) => {
      const files: Record<string, string> = approved(
        {
          'accord/config.yml': CONFIG,
          'accord/tickets/T-1.md': laneTicket('T-1', lane === undefined ? {} : { lane }),
          ...(debug === undefined ? {} : { [DEBUG]: debug }),
        },
        'T-1',
      );
      const text = anchorText(loadSnapshot({ files, tree: Object.keys(files).sort() }), 'T-1') ?? '';
      return text.split('\n').filter((l) => l.startsWith('Unfinished:'));
    };
    const marked = [...FINISHED, ...episode(2, UNFINISHED_MARKER)].join('\n');
    expect(withDebug(marked)).toEqual([`Unfinished: ${DEBUG}: resume the debugger`]);
    expect(withDebug([...FINISHED, ...episode(2)].join('\n'))).toEqual([]);
    expect(withDebug(undefined)).toEqual([]);
    // the same lanes the plan line reads: M, L and P, not S or R
    expect(withDebug(marked, 'S')).toEqual([]);
    expect(withDebug(marked, 'R')).toEqual([]);
  });
});
