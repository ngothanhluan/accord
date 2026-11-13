// ST-LN-91 91p-ac-1 and 91p-ac-2: from PLAN_FORMAT_FROM, gate plan asks each task for its `after:` line, refuses a fenced block that is not an
// interfaces block, and refuses a task of more than TASK_LINE_CAP non-blank lines. The claim pin decides (D-15), never the plan's baseline pin.
// The plan text is read structurally: fixed fields at fixed positions, fences by their opening line, comments by their delimiters.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot, PLAN_FORMAT_FROM, TASK_LINE_CAP, taskLength } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { PLAN_RULES } from '../src/gate/rules.js';
import { parsePlan } from '../src/load/work.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, REPORT } from '../../../test/helpers/lane.js';

// A release moves CONFIG's pin, so every case names the pin it means.
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const HEAD = ['---', 'baseline: abc1234', 'plan_hash: "fnv1a64:061c24200fe9bbf9"', '---', '', '# Plan', ''];

/** One task: the three fields the older rules read, then `lines`. */
const task = (n: number, lines: string[] = [], heading = `## Task ${n}: Step ${n}`): string =>
  [heading, 'covers: @ac-1, @ac-2, D-01', 'files: src/export.ts', `verify: export#writes-csv (@ac-1) export#escapes-commas (@ac-2)`, ...lines, ''].join('\n');
const planOf = (...tasks: string[]): string => [...HEAD, ...tasks].join('\n');
/** Three tasks; task 2 carries `lines` and the others a correct `after:` line. */
const three = (two: string[], eol = '\n'): string =>
  planOf(task(1, ['after: none']), task(2, two), task(3, ['after: 1'])).replace(/\n/g, eol);

type Claim = { pin?: string; basePin?: string } | { error: string };
interface Opts {
  plan?: string;
  claim?: Claim; // the host's claim fact; absent: no fact
  config?: string;
  lane?: string;
  planPins?: { pin?: string; basePin?: string };
}
const build = ({ plan = three(['after: none']), claim, config = CONFIG, lane, planPins }: Opts = {}) => {
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
  return { ...snapshot, ...(claim === undefined ? {} : { claimPins: { 'T-1': claim } }), ...(planPins === undefined ? {} : { planPins: { 'T-1': planPins } }) };
};
const check = (o: Opts = {}): GateResult => gatePlan(build(o), 'T-1');
const NEW_RULES = ['gate.task-after-missing', 'gate.task-after-unknown', 'gate.task-code-block', 'gate.task-too-long'];
const format = (r: GateResult) => r.findings.filter((f) => NEW_RULES.includes(f.rule));
const of = (r: GateResult, rule: string) => r.findings.filter((f) => f.rule === rule);
const NEW: Claim = { pin: PLAN_FORMAT_FROM };
const OLD: Claim = { pin: '0.4.0' };

describe('plan format: the after: line', () => {
  it('risk:complex-branching a task with no after: line or an unknown task fails gate plan from the cut-off (ST-LN-91 91p-ac-2)', () => {
    const plan = planOf(task(1, ['after: none']), task(2), task(3, ['after: 1, 4']));
    const r = check({ plan, claim: NEW });
    expect(r.verdict).toBe('fail');
    const missing = of(r, 'gate.task-after-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].level).toBe('error');
    expect(missing[0].file).toBe('accord/tickets/T-1/plan.md');
    expect(missing[0].reason).toContain('task 2');
    expect(missing[0].reason).toContain('after:');
    const unknown = of(r, 'gate.task-after-unknown');
    expect(unknown).toHaveLength(1);
    expect(unknown[0].reason).toContain('task 3');
    expect(unknown[0].reason).toContain('4');
    expect(unknown[0].line).toBeGreaterThan(missing[0].line as number);
    expect(of(check({ plan: three(['after: x']), claim: NEW }), 'gate.task-after-unknown')[0].reason).toContain('x');
  });

  it('risk:regression after: none holds no deferral word and reaches the task unchanged (ST-LN-91 91p-ac-2)', () => {
    const snapshot = build({ claim: NEW });
    const tasks = snapshot.work!['T-1'].plan!.tasks;
    expect(tasks[0].after).toMatchObject({ tasks: [], unread: [] });
    expect(tasks[0].after!.line).toBe(tasks[0].line + 4);
    expect(tasks[2].after).toMatchObject({ tasks: [1], unread: [] });
    const r = gatePlan(snapshot, 'T-1');
    expect(of(r, 'gate.plan-deferral')).toEqual([]);
    expect(format(r)).toEqual([]);
    expect(tasks[0].lines.some((l) => l.text === 'after: none')).toBe(true); // the line stays in the task, for accord brief
    // the two older per-task rules stay unconditional: a legacy claim still gets them
    const bare = planOf('## Task 1: Bare', 'after: none', '');
    const legacy = check({ plan: bare, claim: OLD });
    expect(of(legacy, 'gate.task-covers-missing')).toHaveLength(1);
    expect(of(legacy, 'gate.task-verify-missing')).toHaveLength(1);
  });

  // [name, lines of task 2, expected finding on task 2: 'ok' | 'missing' | the unknown tokens]
  const AFTER: [string, string[], 'ok' | 'missing' | string[]][] = [
    ['none', ['after: none'], 'ok'],
    ['one task', ['after: 1'], 'ok'],
    ['commas', ['after: 1, 3'], 'ok'],
    ['commas without spaces', ['after: 1,3'], 'ok'],
    ['spaces', ['after: 1 3'], 'ok'],
    ['mixed separators and a trailing comma', ['after: 1 , 3 ,'], 'ok'],
    ['list marker -', ['- after: 1,3'], 'ok'],
    ['list marker *', ['* after: none'], 'ok'],
    ['indented', ['  after: 1'], 'ok'],
    ['self reference is left to the wave builder', ['after: 2'], 'ok'],
    ['first line wins', ['after: 1', 'after: 9'], 'ok'],
    ['a comment above the line', ['<!-- after: 9 -->', 'after: 1'], 'ok'],
    ['no line', [], 'missing'],
    ['no value', ['after:'], 'missing'],
    ['blanks only', ['after:    '], 'missing'],
    ['only separators', ['after: ,'], 'missing'],
    ['capital A', ['After: 1'], 'missing'],
    ['another word', ['afterwards: 1'], 'missing'],
    ['space before the colon', ['after : 1'], 'missing'],
    ['only in a comment', ['<!-- after: 1 -->'], 'missing'],
    // A comment is text: `accord brief` prints it to the executor, so the format rules read it as written (WR-01).
    ['a multi-line comment holding the line', ['<!--', 'after: 1', '-->'], 'ok'],
    ['a comment on the same line is part of the value', ['after: 1 <!-- 9 -->'], ['-->', '9', '<!--']],
    ['a comment that is the value', ['after: <!-- 1 -->'], ['-->', '<!--']],
    ['an unclosed comment in inline code above the line', ['Strip the `<!--` marks first.', 'after: 1'], 'ok'],
    ['an unclosed comment above the line', ['<!-- the writer', 'after: 1'], 'ok'],
    ['quoted', ['> after: 1'], 'missing'],
    ['only in a fenced block', ['```interfaces', 'after: 1', '```'], 'missing'],
    ['a task number the plan lacks', ['after: 4'], ['4']],
    ['one of two lacking', ['after: 1, 4, 5'], ['4', '5']],
    ['a repeated unknown is named once', ['after: 4, 4'], ['4']],
    ['a word', ['after: x'], ['x']],
    ['a leading zero', ['after: 01'], ['01']],
    ['zero', ['after: 0'], ['0']],
    ['negative', ['after: -1'], ['-1']],
    ['the word task', ['after: task 1'], ['task']],
    ['a trailing full stop', ['after: 1.'], ['1.']],
    ['a semicolon', ['after: 1;3'], ['1;3']],
    ['a hash', ['after: #1'], ['#1']],
    ['none beside a task', ['after: none, 1'], ['none']],
    ['None is not none', ['after: None'], ['None']],
    ['a number too large to be exact', ['after: 99999999999999999999'], ['99999999999999999999']],
  ];
  it.each(AFTER)('risk:complex-branching corpus: after: %s (ST-LN-91 91p-ac-2)', (_name, lines, expected) => {
    for (const eol of ['\n', '\r\n']) {
      const r = check({ plan: three(lines, eol), claim: NEW });
      const missing = of(r, 'gate.task-after-missing');
      const unknown = of(r, 'gate.task-after-unknown');
      if (expected === 'ok') {
        expect(missing).toEqual([]);
        expect(unknown).toEqual([]);
      } else if (expected === 'missing') {
        expect(missing.map((f) => f.reason)).toEqual([expect.stringContaining('task 2 ')]);
        expect(unknown).toEqual([]);
      } else {
        expect(missing).toEqual([]);
        expect(unknown).toHaveLength(expected.length);
        for (const [i, token] of expected.entries()) {
          expect(unknown[i].reason).toContain('task 2 ');
          expect(unknown[i].reason).toContain(`names ${token},`);
        }
      }
    }
  });

  it('risk:complex-branching a byte order mark and CRLF do not hide the after: line (ST-LN-91 91p-ac-2)', () => {
    const bom = '﻿' + three(['after: 1'], '\r\n');
    expect(format(check({ plan: bom, claim: NEW }))).toEqual([]);
    expect(of(check({ plan: '﻿' + three([], '\r\n'), claim: NEW }), 'gate.task-after-missing')).toHaveLength(1);
  });

  it('risk:complex-branching task heading variants are read as the older rules read them (ST-LN-91 91p-ac-2)', () => {
    // `## Task 2 : x` is task 2; `## Task 02: x` and `### Task 2: x` are not task headings.
    const spaced = planOf(task(1, ['after: none']), task(2, [], '## Task 2 : Step two'), task(3, ['after: 2']));
    const r = check({ plan: spaced, claim: NEW });
    expect(of(r, 'gate.task-after-missing').map((f) => f.reason)).toEqual([expect.stringContaining('task 2 ')]);
    expect(of(r, 'gate.task-after-unknown')).toEqual([]);
    const zero = planOf(task(1, ['after: none']), task(2, ['after: 1'], '## Task 02: Step two'));
    const rz = check({ plan: zero, claim: NEW });
    expect(rz.findings.some((f) => f.rule === 'gate.task-after-missing')).toBe(false); // task 02 is not a task, so it has no line to ask
    const sub = planOf(task(1, ['after: none', '### Task 2: not a heading']));
    expect(format(check({ plan: sub, claim: NEW }))).toEqual([]);
    const tight = planOf(task(1, ['after: none']), task(2, [], '## Task 2:Step two'));
    expect(of(check({ plan: tight, claim: NEW }), 'gate.task-after-missing')).toHaveLength(1);
    const dup = planOf(task(1, ['after: none']), task(1, []), task(2, ['after: 1']));
    expect(format(check({ plan: dup, claim: NEW }))).toEqual([]); // the duplicate task 1 is dropped by the parser, which reports it
  });
});

const BLOCK = (rule: string, r: GateResult) => of(r, rule);
describe('plan format: fenced blocks', () => {
  // [name, lines of task 2 (after the after: line), number of refusals, text each refusal holds]
  const FENCES: [string, string[], number, string[]][] = [
    ['ts', ['```ts', 'const a = 1;', '```'], 1, ['task 2', '(ts)']],
    ['no info', ['```', 'x', '```'], 1, ['task 2']],
    ['tilde with text', ['~~~ text', 'x', '~~~'], 1, ['(text)']],
    ['interfaces', ['```interfaces', 'export function f(): void', '```'], 0, []],
    ['interfaces with a language', ['```interfaces ts', 'export function f(): void', '```'], 0, []],
    ['interfaces with a tab', ['```interfaces\tts', 'x', '```'], 0, []],
    ['interfaces in tildes', ['~~~interfaces', 'x', '~~~'], 0, []],
    ['a longer fence around an inner fence', ['````interfaces', '```ts', 'x', '```', '````'], 0, []],
    ['capital I', ['```Interfaces', 'x', '```'], 1, ['(Interfaces)']],
    ['a word that merely starts with interfaces', ['```interfaces-ts', 'x', '```'], 1, ['(interfaces-ts)']],
    ['an attribute', ['```{.interfaces}', 'x', '```'], 1, []],
    ['info after a space is not the first word', ['``` ts interfaces', 'x', '```'], 1, ['(ts interfaces)']],
    ['indented fence', ['  ```ts', '  x', '  ```'], 1, ['(ts)']],
    ['a list item holding a fence', ['- step', '  ```sh', '  npm test', '  ```'], 1, ['(sh)']],
    // The fence sits on the marker line (WR-02): an interfaces block is allowed there, any other block is refused at the line it opens on.
    ['an interfaces block on a list marker line', ['- ```interfaces', '  export function csv(): string', '  ```'], 0, []],
    ['an interfaces block on an ordered marker line', ['1. ```interfaces', '   export function csv(): string', '   ```'], 0, []],
    ['an interfaces block on a parenthesis marker line', ['1) ```interfaces ts', '   export function csv(): string', '   ```'], 0, []],
    ['an interfaces block on a nested marker line', ['- step', '  - ```interfaces', '    export function csv(): string', '    ```'], 0, []],
    ['a ts block on a list marker line', ['- ```ts', '  writer.csv = true;', '  ```'], 1, ['(ts)']],
    ['a ts block on an ordered marker line', ['1. ```ts', '   writer.csv = true;', '   ```'], 1, ['(ts)']],
    // The list item ends where CommonMark ends it, so a flush-left closing fence closes nothing: it opens a stray block of its own, which is refused too.
    ['a block on a list marker line closed flush left', ['- ```ts', '  x();', '```'], 2, ['task 2']],
    ['an interfaces block on a list marker line closed flush left', ['- ```interfaces', '  export function csv(): string', '```'], 1, ['task 2']],
    // ST-LN-91 g2 round 2 WR-01: a fence opened on a marker line, or indented under a list item, ends where the list item ends; the block that follows is read as a block.
    ['an unclosed interfaces block on a list marker line, then a ts block', ['- ```interfaces', '  export function csv(): string', '', 'Then the writer:', '', '```ts', 'writer.csv = true;', '```'], 1, ['(ts)']],
    ['an unclosed interfaces block on an ordered marker line, then a sh block', ['1. ```interfaces', '   export function csv(): string', 'Then the writer:', '```sh', 'npm test', '```'], 1, ['(sh)']],
    ['an unclosed interfaces block in tildes on a marker line, then a ts block', ['- ~~~interfaces', '  export function csv(): string', 'Then:', '```ts', 'x', '```'], 1, ['(ts)']],
    ['an unclosed interfaces block on a nested marker line, then a ts block', ['- step', '  - ```interfaces', '    export function csv(): string', '  then', '```ts', 'x', '```'], 1, ['(ts)']],
    ['an unclosed interfaces block indented under a list item, then a ts block', ['- Interfaces:', '  ```interfaces', '  export function csv(): string', '', 'Then the writer:', '', '```ts', 'writer.csv = true;', '```'], 1, ['(ts)']],
    ['an unclosed interfaces block indented under an ordered item, then a ts block', ['1. Interfaces:', '', '   ```interfaces', '   export function csv(): string', 'Then:', '```ts', 'x', '```'], 1, ['(ts)']],
    ['a ts block that opens on the line that ends the list item', ['- ```interfaces', '  export function csv(): string', '```ts', 'x', '```'], 1, ['(ts)']],
    ['an interfaces block on a marker line with blank and deeper lines, unclosed to the end of the task', ['- ```interfaces', '  export function csv(): string', '', '    deeper: string', '  more'], 0, []],
    ['an interfaces block indented under a list item, unclosed to the end of the task', ['- Interfaces:', '  ```interfaces', '  export function csv(): string'], 0, []],
    ['an interfaces block indented under a list item, closed at the same indent, then prose', ['- Interfaces:', '  ```interfaces', '  export function csv(): string', '  ```', 'Then the writer.'], 0, []],
    ['an interfaces block indented under a list item, closed flush left', ['- Interfaces:', '  ```interfaces', '  export function csv(): string', '```'], 1, ['task 2']],
    ['an indented interfaces block with flush-left lines and no list in the task', ['  ```interfaces', 'export function csv(): string', '  ```'], 0, []],
    ['an indented interfaces block with flush-left lines after a list item: the item may end, so the block is not trusted', ['- step', '  ```interfaces', 'export function csv(): string', '  ```'], 1, ['task 2']],
    ['a block in a blockquote', ['> ```ts', '> x', '> ```'], 1, ['(ts)', 'blockquote']],
    ['an interfaces block in a blockquote', ['> ```interfaces', '> export function csv(): string', '> ```'], 1, ['(interfaces)', 'blockquote']],
    ['an interfaces block in a blockquote without a space after the marker', ['>```interfaces', '>x', '>```'], 1, ['blockquote']],
    ['a block in a list item inside a blockquote', ['> - ```ts', '>   x', '>   ```'], 1, ['(ts)', 'blockquote']],
    ['a list marker line that is prose with inline code', ['- use ```ts``` here', '- and ``` too'], 0, []],
    ['unterminated', ['```ts', 'x'], 1, ['(ts)']],
    ['two blocks', ['```ts', 'x', '```', 'then', '```sh', 'y', '```'], 2, []],
    ['an interfaces block and a ts block', ['```interfaces', 'x', '```', '```ts', 'y', '```'], 1, ['(ts)']],
    // A comment hides nothing from the executor, so it hides nothing from the rule (WR-01).
    ['inside an HTML comment', ['<!--', '```ts', 'x', '```', '-->'], 1, ['(ts)']],
    ['after an unclosed comment in inline code', ['Strip the `<!--` marks first.', '```ts', 'x', '```'], 1, ['(ts)']],
    ['after an unclosed comment', ['<!-- the writer', '```ts', 'x', '```'], 1, ['(ts)']],
    ['inside a one-line comment', ['<!-- ```ts -->'], 0, []],
    ['an HTML comment inside an interfaces block does not hide its end', ['```interfaces', '<!-- x', '```', '```ts', 'y', '```'], 1, ['(ts)']],
    ['a backtick in the info string is not a fence', ['```ts`x`', 'text'], 0, []],
    ['only two backticks', ['``ts', 'x', '``'], 0, []],
  ];
  it.each(FENCES)('risk:complex-branching corpus: a task holding %s (ST-LN-91 91p-ac-1)', (_name, lines, count, texts) => {
    for (const eol of ['\n', '\r\n']) {
      const r = check({ plan: three(['after: 1', ...lines], eol), claim: NEW });
      const found = BLOCK('gate.task-code-block', r);
      expect(found).toHaveLength(count);
      for (const f of found) {
        expect(f.level).toBe('error');
        expect(f.file).toBe('accord/tickets/T-1/plan.md');
        expect(f.reason).toContain('task 2');
        expect(f.reason).toContain('interfaces');
        for (const t of texts) expect(f.reason).toContain(t);
      }
    }
  });

  it('risk:complex-branching the block rule names each block of a task with the line it opens on (ST-LN-91 91p-ac-1)', () => {
    const r = check({ plan: three(['after: 1', '```ts', 'a', '```', '```sh', 'b', '```']), claim: NEW });
    const found = of(r, 'gate.task-code-block');
    expect(found).toHaveLength(2);
    expect((found[1].line as number) - (found[0].line as number)).toBe(3);
    expect(found[0].reason).toContain(`line ${found[0].line}`);
    const text = three(['after: 1', '```ts', 'a', '```', '```sh', 'b', '```']).split('\n');
    expect(found.map((f) => f.line)).toEqual([text.indexOf('```ts') + 1, text.indexOf('```sh') + 1]);
  });

  // ST-LN-91 g2 round 2 WR-01: the block that follows a list item's unclosed fence is named at its own opening line, whichever way the fence was opened.
  it.each([
    ['a marker line', ['- ```interfaces', '  export function csv(): string', '', 'Then the writer:', '', '```ts', 'writer.csv = true;', '```']],
    ['an indented line', ['- Interfaces:', '  ```interfaces', '  export function csv(): string', '', 'Then the writer:', '', '```ts', 'writer.csv = true;', '```']],
  ])('risk:complex-branching the ts block after an interfaces block opened on %s is named at its own line (ST-LN-91 91p-ac-1)', (_name, lines) => {
    const plan = three(['after: 1', ...lines]);
    const found = of(check({ plan, claim: NEW }), 'gate.task-code-block');
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(plan.split('\n').indexOf('```ts') + 1);
    expect(check({ plan, claim: NEW }).verdict).toBe('fail');
    expect(format(check({ plan, claim: OLD }))).toEqual([]);
  });

  // ST-LN-91 g2 round 2 IN-02: the closing line of a quoted block is read through its quote marks, so the after: line below it is still read.
  it.each([
    ['backticks', ['> ```ts', '> x', '> ```']],
    ['tildes', ['> ~~~ts', '> x', '> ~~~']],
    ['two quote levels', ['> > ```ts', '> > x', '> > ```']],
  ])('risk:complex-branching a closed blockquote block in %s does not hold the after: line below it open (ST-LN-91 91p-ac-1)', (_name, quoted) => {
    const r = check({ plan: three([...quoted, 'after: 1']), claim: NEW });
    expect(format(r).map((f) => f.rule)).toEqual(['gate.task-code-block']);
  });
});

/** A task-2 body that holds exactly `n` non-blank lines under its heading: the three field lines, the after: line, and filler. */
const filler = (count: number, prefix = 'Step'): string[] => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}.`);
const withLength = (n: number): string[] => ['after: 1', ...filler(n - 4)];

describe('plan format: the task cap', () => {
  it('risk:complex-branching a task longer than the cap fails gate plan with its length (ST-LN-91 91p-ac-1)', () => {
    expect(TASK_LINE_CAP).toBe(120);
    for (const eol of ['\n', '\r\n']) {
      expect(of(check({ plan: three(withLength(TASK_LINE_CAP), eol), claim: NEW }), 'gate.task-too-long')).toEqual([]);
      const r = check({ plan: three(withLength(TASK_LINE_CAP + 1), eol), claim: NEW });
      expect(r.verdict).toBe('fail');
      const f = of(r, 'gate.task-too-long');
      expect(f).toHaveLength(1);
      expect(f[0].level).toBe('error');
      expect(f[0].reason).toContain('task 2');
      expect(f[0].reason).toContain('121');
      expect(f[0].reason).toContain('120');
      expect(f[0].file).toBe('accord/tickets/T-1/plan.md');
    }
  });

  const snapshotTask = (lines: string[], n = 2) => build({ plan: three(lines), claim: NEW }).work!['T-1'].plan!.tasks[n - 1];
  // [name, lines of task 2 after the after: line, extra non-blank lines they add to the 4 above]
  const COUNT: [string, string[], number][] = [
    ['plain lines', filler(3), 3],
    ['blank lines are not counted', ['', filler(1)[0], '', '', '   ', filler(1, 'B')[0]], 2],
    ['a comment line is counted', ['<!-- note -->', 'text'], 2],
    ['a multi-line comment is counted', ['<!--', 'a', 'b', '-->', 'text'], 5],
    ['an unclosed comment in inline code counts the lines after it', ['Strip the `<!--` marks first.', 'a', 'b'], 3],
    ['an unclosed comment counts the lines after it', ['<!-- the writer', 'a', 'b'], 3],
    ['text beside a comment is counted', ['text <!-- c -->', '<!-- c --> more'], 2],
    ['fenced lines are counted', ['```ts', 'a', '', 'b', '```'], 4],
    ['an interfaces block is counted', ['```interfaces', 'a', 'b', '```'], 4],
    ['a comment inside a fence is code and is counted', ['```interfaces', '<!-- a', 'b -->', '```'], 4],
    ['sub-headings are counted', ['### Notes', 'text'], 2],
    ['a list is counted line by line', ['- a', '- b', '  continued'], 3],
  ];
  it.each(COUNT)('risk:complex-branching corpus: taskLength counts %s (ST-LN-91 91p-ac-1)', (_name, lines, extra) => {
    expect(taskLength(snapshotTask(['after: 1', ...lines]))).toBe(4 + extra);
  });

  it('risk:complex-branching the heading and the next task are not part of a task length (ST-LN-91 91p-ac-1)', () => {
    expect(taskLength(snapshotTask(['after: 1']))).toBe(4);
    expect(taskLength(snapshotTask(['after: 1'], 3))).toBe(4);
  });

  it('risk:complex-branching 120 lines pass and 121 fail whichever way the lines are written (ST-LN-91 91p-ac-1)', () => {
    const shapes: [string, (n: number) => string[]][] = [
      ['plain', (n) => withLength(n)],
      ['blanks between', (n) => ['after: 1', ...filler(n - 4).flatMap((l) => [l, ''])]],
      ['comments between', (n) => ['after: 1', ...Array.from({ length: n - 4 }, (_, i) => (i % 2 === 0 ? `Step ${i}.` : '<!-- c -->'))]],
      ['inside an interfaces block', (n) => ['after: 1', '```interfaces', ...filler(n - 6), '```']],
    ];
    for (const [name, shape] of shapes) {
      expect(taskLength(snapshotTask(shape(120))), name).toBe(120);
      expect(of(check({ plan: three(shape(120)), claim: NEW }), 'gate.task-too-long'), name).toEqual([]);
      expect(taskLength(snapshotTask(shape(121))), name).toBe(121);
      expect(of(check({ plan: three(shape(121)), claim: NEW }), 'gate.task-too-long'), name).toHaveLength(1);
    }
  });
});

describe('plan format: the cut-off', () => {
  // A plan that breaks all four rules in task 2.
  const BROKEN = planOf(task(1, ['after: none']), task(2, ['```ts', 'x', '```', ...filler(130)]), task(3, ['after: 7']));
  const rules = (r: GateResult): string[] => [...new Set(format(r).map((f) => f.rule))].sort();
  const ALL = [...NEW_RULES].sort();

  it('risk:complex-branching the format rules keep the older answer for a ticket claimed under 0.4.0 (ST-LN-91 91p-ac-1)', () => {
    expect(rules(check({ plan: BROKEN, claim: NEW }))).toEqual(ALL);
    expect(rules(check({ plan: BROKEN, claim: OLD }))).toEqual([]);
    // a plan written and baselined after the upgrade, on a ticket claimed before it (D-15)
    expect(rules(check({ plan: BROKEN, claim: OLD, planPins: { pin: PLAN_FORMAT_FROM }, config: at(PLAN_FORMAT_FROM) }))).toEqual([]);
    expect(rules(check({ plan: BROKEN, claim: OLD, planPins: { pin: PLAN_FORMAT_FROM, basePin: PLAN_FORMAT_FROM } }))).toEqual([]);
    // the claim pin at the cut-off with a plan baselined under 0.4.0 gets all of them
    expect(rules(check({ plan: BROKEN, claim: NEW, planPins: { pin: '0.4.0' } }))).toEqual(ALL);
    // a pin above the cut-off is not below it
    expect(rules(check({ plan: BROKEN, claim: { pin: '0.5.0' } }))).toEqual(ALL);
  });

  it('risk:security a lowered, non-plain or unreadable claim pin applies the format rules (ST-LN-91 91p-ac-1, T-03-12)', () => {
    const ALL_BAD: [string, Opts][] = [
      ['claim 0.4.0 with a base pin at the cut-off', { claim: { pin: '0.4.0', basePin: PLAN_FORMAT_FROM } }],
      ['claim pin main', { claim: { pin: 'main' } }],
      ['claim pin with a suffix', { claim: { pin: '0.4.0-rc.1' } }],
      ['claim pin with a prefix', { claim: { pin: 'v0.4.0' } }],
      ['claim pin empty', { claim: { pin: '' } }],
      ['claim fact without a pin', { claim: {} }],
      ['claim fact with an error', { claim: { error: 'git: bad object' } }],
      ['no claim fact, working-tree pin at the cut-off', { config: at(PLAN_FORMAT_FROM) }],
      ['no claim fact, working-tree pin above the cut-off', { config: at('0.9.9') }],
    ];
    for (const [name, o] of ALL_BAD) expect(rules(check({ plan: BROKEN, ...o })), name).toEqual(ALL);
    const KEPT: [string, Opts][] = [
      ['claim 0.4.0, base pin 0.4.0', { claim: { pin: '0.4.0', basePin: '0.4.0' } }],
      ['claim 0.3.9, base pin 0.3.0', { claim: { pin: '0.3.9', basePin: '0.3.0' } }],
      ['no claim fact, working-tree pin 0.4.0', { config: at('0.4.0') }],
    ];
    for (const [name, o] of KEPT) expect(rules(check({ plan: BROKEN, ...o })), name).toEqual([]);
  });

  it('risk:regression a ticket claimed under 0.4.0 gets exactly the findings the older gate gave (ST-LN-91 91p-ac-1)', () => {
    const old = check({ plan: BROKEN, claim: OLD });
    const fresh = check({ plan: BROKEN, claim: NEW });
    expect(fresh.findings.filter((f) => !NEW_RULES.includes(f.rule))).toEqual(old.findings);
    expect(old.findings.map((f) => f.rule)).not.toEqual(expect.arrayContaining(NEW_RULES));
    // the four rows sit after gate.task-verify-missing and before gate.task-file-unknown
    const ids = PLAN_RULES.map((r) => r.id);
    const at4 = ids.indexOf('gate.task-verify-missing');
    expect(ids.slice(at4 + 1, at4 + 5)).toEqual(NEW_RULES);
    expect(ids[at4 + 5]).toBe('gate.task-file-unknown');
  });

  it('risk:complex-branching lane S gets none of the format rules and lanes L and P get them as lane M does (ST-LN-91 91p-ac-1, D-18)', () => {
    expect(rules(check({ plan: BROKEN, claim: NEW, lane: 'S' }))).toEqual([]);
    for (const lane of ['M', 'L', 'P']) expect(rules(check({ plan: BROKEN, claim: NEW, lane })), lane).toEqual(ALL);
  });

  it('risk:regression a ticket with no lane or no plan gets none of the format rules (ST-LN-91 91p-ac-1)', () => {
    const files = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1').replace(/^lane: M\n/m, ''), 'accord/tickets/T-1/plan.md': BROKEN };
    const r = gatePlan({ ...loadSnapshot({ files, tree: Object.keys(files).sort() }), claimPins: { 'T-1': NEW } }, 'T-1');
    expect(format(r)).toEqual([]);
  });
});

describe('plan format: a line starting after: is read for deferral words as before (ST-LN-91 CR-01)', () => {
  // The deferral rule reads an `after:` line as free text, as origin/main b057d135 did for every claim pin: a prose line that starts with `after:`
  // never escapes it, and a second `after:` line (the format reader keeps only the first) hides nothing.
  const DEFER: [string, string[], string][] = [
    ['a full stop after the word', ['after: none', 'after: the parser lands, wire it later.'], 'later'],
    ['the words for now', ['after: none', 'after: the writer lands we keep the flag for now'], 'for now'],
    ['the only after: line', ['after: none for now'], 'for now'],
    ['a second after: line', ['after: 1', 'after: the parser lands, wire it later.'], 'later'],
    ['a capital After: line', ['after: none', 'After: the parser lands, wire it later.'], 'later'],
    ['a list marker', ['after: none', '- after: wire it later.'], 'later'],
    ['TBD with a comma', ['after: none', 'after: TBD, once the parser lands'], 'TBD'],
  ];
  it.each(DEFER)('risk:regression corpus: %s is a deferral at every claim pin (ST-LN-91 mig-ac-1, CR-01)', (_name, lines, word) => {
    for (const claim of [OLD, NEW, { pin: '0.4.0', basePin: '0.4.0' }]) {
      const found = of(check({ plan: three(lines), claim }), 'gate.plan-deferral');
      expect(found.map((f) => f.reason), JSON.stringify(claim)).toEqual([`task 2 defers work: "${word}"`]);
    }
  });

  it('risk:regression an after: line with a task number holds no deferral word (ST-LN-91 91p-ac-2)', () => {
    for (const lines of [['after: none'], ['after: 1, 3'], ['after: 1 2'], ['- after: 1']]) expect(of(check({ plan: three(lines), claim: NEW }), 'gate.plan-deferral')).toEqual([]);
  });
});

describe('plan format: the rules read the text accord brief prints (ST-LN-91 WR-01, WR-02)', () => {
  const task2 = (lines: string[]) => build({ plan: three(lines), claim: NEW }).work!['T-1'].plan!.tasks[1];
  const nonBlank = (lines: string[]): number => task2(lines).lines.filter((l) => l.text.trim() !== '').length;

  it('risk:regression taskLength is the count of non-blank lines the executor receives, whatever comments the task holds (WR-01)', () => {
    const SHAPES: [string, string[]][] = [
      ['an unclosed comment in inline code', ['after: 1', 'Strip the `<!--` marks first.', ...filler(130)]],
      ['an unclosed comment', ['after: 1', '<!-- the writer', ...filler(130)]],
      ['a comment holding a fence', ['after: 1', '<!--', '```ts', 'x', '```', '-->', ...filler(120)]],
      ['a comment holding a long run', ['after: 1', '<!--', ...filler(125), '-->']],
      ['a closed comment', ['after: 1', '<!-- note -->', ...filler(3)]],
      ['a comment inside an interfaces block', ['after: 1', '```interfaces', '<!-- a', 'b -->', '```']],
    ];
    for (const [name, lines] of SHAPES) expect(taskLength(task2(lines)), name).toBe(nonBlank(lines));
    // The two probes of the review: 130 lines after the inline mark are 130 lines, and a fence in a comment is a fence.
    expect(of(check({ plan: three(SHAPES[0][1]), claim: NEW }), 'gate.task-too-long')).toHaveLength(1);
    expect(of(check({ plan: three(SHAPES[2][1]), claim: NEW }), 'gate.task-code-block')).toHaveLength(1);
  });

  it('risk:regression an unclosed comment mark does not hide the after: line below it (WR-01)', () => {
    expect(of(check({ plan: three(['Strip the `<!--` marks first.', 'after: 1']), claim: NEW }), 'gate.task-after-missing')).toEqual([]);
    expect(task2(['Strip the `<!--` marks first.', 'after: 1']).after).toMatchObject({ tasks: [1], unread: [] });
  });

  it('risk:regression every task of ST-LN-79/plan.md is measured by its raw non-blank lines: task 2 holds 98, not 53 (WR-01)', () => {
    const p = 'accord/tickets/ST-LN-79/plan.md';
    const tasks = parsePlan(p, readFileSync(new URL('../../../' + p, import.meta.url), 'utf8')).plan.tasks;
    expect(tasks).toHaveLength(15);
    for (const t of tasks) expect(taskLength(t), 'task ' + t.n).toBe(t.lines.filter((l) => l.text.trim() !== '').length);
    expect(taskLength(tasks[1])).toBe(98);
    expect(taskLength(tasks[11])).toBe(54);
  });

  it('risk:regression a block on a list marker line is named at the line it opens on and hides nothing below it (WR-02)', () => {
    const lines = ['after: 1', 'Interfaces:', '- ```ts', '  writer.csv = true;', '  ```', 'then more.'];
    const text = three(lines).split('\n');
    const found = of(check({ plan: three(lines), claim: NEW }), 'gate.task-code-block');
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(text.indexOf('- ```ts') + 1);
    expect(found[0].reason).toContain(`line ${found[0].line} `);
    // A valid interfaces block there is accepted, and an after: line below it is still read.
    const ok = ['Interfaces:', '- ```interfaces', '  export function csv(): string', '  ```', '', 'after: 1'];
    expect(format(check({ plan: three(ok), claim: NEW }))).toEqual([]);
    expect(of(check({ plan: three(['- ```interfaces', '  export function csv(): string', '  ```', 'after: none']), claim: NEW }), 'gate.task-after-missing')).toEqual([]);
  });

  it('risk:regression a code block in a blockquote is refused and says it is in a blockquote, at its opening line (WR-02)', () => {
    const lines = ['after: 1', '> ```ts', '> x', '> ```'];
    const found = of(check({ plan: three(lines), claim: NEW }), 'gate.task-code-block');
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(three(lines).split('\n').indexOf('> ```ts') + 1);
    expect(found[0].reason).toContain('blockquote');
  });
});

describe('plan format: a failed claim-pin read says why the rules apply (ST-LN-91 WR-04)', () => {
  const GIT = 'git failed reading the claim pin of T-1: bad object';
  const BROKEN = planOf(task(1, ['after: none']), task(2, ['```ts', 'x', '```', ...filler(130)]), task(3, ['after: 7']));

  it('risk:security each of the four format findings names the git error, and none of them does when the pin was read (WR-04)', () => {
    const failed = format(check({ plan: BROKEN, claim: { error: GIT } }));
    expect([...new Set(failed.map((f) => f.rule))].sort()).toEqual([...NEW_RULES].sort());
    for (const f of failed) {
      expect(f.reason, f.rule).toContain(GIT);
      expect(f.reason, f.rule).toContain('the claim pin could not be read');
      expect(f.level).toBe('error');
    }
    // Only the reason differs from the answer for a claim at the cut-off.
    const read = format(check({ plan: BROKEN, claim: NEW }));
    expect(failed.map((f) => ({ ...f, reason: f.reason.split('; ' + GIT)[0] }))).toEqual(read);
    for (const f of read) expect(f.reason).not.toContain('could not be read');
    for (const f of format(check({ plan: BROKEN, claim: OLD }))) expect(f.reason).not.toContain('could not be read');
  });
});

describe('plan format: the key is read in lowercase, as the other fields are (ST-LN-91 verifier Info 3)', () => {
  const fields = (lines: string[]) => parsePlan('plan.md', ['## Task 1: Step', ...lines, ''].join('\n')).plan.tasks[0];

  it('risk:regression covers:, files:, verify: and after: are read in lowercase only, so After: is no looser than Covers: (verifier Info 3)', () => {
    const lower = fields(['covers: @ac-1', 'files: src/a.ts', 'verify: a#b (@ac-1)', 'after: 1']);
    expect(lower).toMatchObject({ covers: ['@ac-1'], files: ['src/a.ts'], verify: ['a#b'] });
    expect(lower.after).toMatchObject({ tasks: [1] });
    const capital = fields(['Covers: @ac-1', 'Files: src/a.ts', 'Verify: a#b (@ac-1)', 'After: 1']);
    expect(capital).toMatchObject({ covers: [], files: [], verify: [] });
    expect(capital.after).toBeUndefined();
  });

  it('risk:regression a task whose after: line is not read says which line it skipped and why (verifier Info 3)', () => {
    const reason = (lines: string[]): string => of(check({ plan: three(lines), claim: NEW }), 'gate.task-after-missing')[0].reason;
    const base = 'task 2 has no after: line naming the tasks it follows (after: 1, 2), or after: none';
    const at = three(['After: 1']).split('\n').indexOf('After: 1') + 1;
    expect(reason(['After: 1'])).toBe(base + `; line ${at} starts with "After:", which is not read: write the key in lowercase, as covers:, files: and verify: are`);
    expect(reason(['- AFTER: none'])).toContain('starts with "AFTER:"');
    expect(reason(['after : 1'])).toContain('starts with "after :"');
    // No hint where no line looks like the key.
    expect(reason([])).toBe(base);
    expect(reason(['afterwards: 1'])).toBe(base);
    expect(reason(['```interfaces', 'After: 1', '```'])).toBe(base);
    // A correct line beside a capital one: the task has its line, so nothing is missing.
    expect(of(check({ plan: three(['After: 9', 'after: 1']), claim: NEW }), 'gate.task-after-missing')).toEqual([]);
  });
});
