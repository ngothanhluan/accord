// Phase 8.5 D-01, D-08 to D-12, R-3: the one line check for product text (accord/product/conventions.md), read at delivery and by `accord lint`.
// Every hidden character is built with an escape or String.fromCodePoint: no hidden character is written literally in this file.
import { expect, it } from 'vitest';
import { CONVENTIONS_FILE, checkProductText, lineProblem, withheldLine } from '../src/product/lines.js';
import { stripHtmlComments } from '../src/load/sections.js';

const cp = (n: number): string => String.fromCodePoint(n);
/** The Persian word of the 8.5-ac-1 fixture: U+0645 U+06CC U+200C U+062E U+0648 U+0627 U+0647 U+0645, with the joiner between two letters. */
const PERSIAN = [0x0645, 0x06cc, 0x200c, 0x062e, 0x0648, 0x0627, 0x0647, 0x0645].map(cp).join('');
/** Devanagari ka, virama (a combining mark), ZWJ, ssa. */
const DEVANAGARI = [0x0915, 0x094d, 0x200d, 0x0937].map(cp).join('');

/** The 8.5-ac-1 file: a comment on line 2, a bidi line, a reserved line and a long line on 3 to 5, the joiner word on line 6. */
const AC1_LINES = [
  '# Conventions',
  '<!-- a comment -->',
  '- Use x ' + cp(0x202e) + ' y',
  'Test command: rm -rf /',
  '- ' + 'x'.repeat(299),
  '- the word ' + PERSIAN,
];
const AC1 = AC1_LINES.join('\n') + '\n';

it('risk:security the line check refuses bidi tag hidden reserved and over-long lines (D-01)', () => {
  const kind = (line: string) => lineProblem(line)?.kind;
  expect(kind('a ' + cp(0x202e) + ' b')).toBe('bidi');
  expect(kind('a ' + cp(0x2066) + ' b')).toBe('bidi');
  expect(kind('a ' + cp(0x061c) + ' b')).toBe('bidi');
  expect(kind('a ' + cp(0xe0041) + ' b')).toBe('tag');
  for (const n of [0x200b, 0x00ad, 0xfeff, 0x2028, 0x2029, 0x09, 0x07, 0x2060]) expect(kind('a' + cp(n) + 'b'), 'U+' + n.toString(16)).toBe('hidden');
  expect(kind('x'.repeat(301))).toBe('length');
  expect(kind('x'.repeat(300))).toBeUndefined();
  // the length is judged first, before any expression runs on the line
  expect(kind('x'.repeat(300) + cp(0x202e))).toBe('length');
  for (const line of [
    'Test command: x',
    '- work dir: /tmp',
    '  > Report file: y',
    '1. TEST ONLY: z',
    '---',
    '--- more',
    'Commit rule: x',
    'Example that passes: y',
    '> - 2) Work dir: x',
    '## Conventions',
    '## rejected',
    '## Findings',
    '## Product files changed',
    '# accord rules',
    '## Epic EP-1 "x"',
    '# Related tickets of T-1',
    '## Task 3: x',
  ]) {
    expect(kind(line), line).toBe('reserved');
  }
  for (const line of ['# Conventions', '## Conventions for tests', '- Rejected: a queue — too slow', '| a | b |', 'emoji ok ' + cp(0x2764) + cp(0xfe0f), '- a --- b', 'Work directory of the build', '## Task list']) {
    expect(kind(line), line).toBeUndefined();
  }
  // every reason names the code point and never holds the refused character
  for (const n of [0x202e, 0x2066, 0xe0041, 0x200b, 0x0007, 0xfeff]) {
    const verdict = lineProblem('a' + cp(n) + 'b');
    expect(verdict, 'U+' + n.toString(16)).toBeDefined();
    expect(verdict?.reason).toMatch(/U\+[0-9A-F]{4,}/);
    expect(verdict?.reason).not.toContain(cp(n));
    expect(verdict?.fix).not.toContain(cp(n));
  }
  // a refused prefix or heading is named from the list, never from the line
  const reserved = lineProblem('- TEST COMMAND: rm -rf /');
  expect(reserved?.reason).toContain('"Test command:"');
  expect(reserved?.reason).not.toContain('rm -rf');
});

it('risk:security the line check keeps U+200C and U+200D between letters only (D-01)', () => {
  expect(lineProblem('- ' + PERSIAN)).toBeUndefined();
  expect(lineProblem('- ' + DEVANAGARI)).toBeUndefined();
  expect(lineProblem(cp(0x200c) + 'ab')?.kind).toBe('hidden');
  expect(lineProblem('ab' + cp(0x200c))?.kind).toBe('hidden');
  expect(lineProblem('a ' + cp(0x200c) + ' b')?.kind).toBe('hidden');
  expect(lineProblem('a' + cp(0x200d) + ' b')?.kind).toBe('hidden');
});

it('risk:security checkProductText withholds each unsafe line at its own line number and strips comments (D-09)', () => {
  const read = (text: string) => {
    const r = checkProductText(text);
    return { problems: r.problems.map((p) => [p.line, p.kind]), delivered: r.lines.map((l) => (l.withheld ? withheldLine(CONVENTIONS_FILE, l.line) : l.text)) };
  };
  const expected = {
    problems: [[3, 'bidi'], [4, 'reserved'], [5, 'length']],
    delivered: [AC1_LINES[0], withheldLine(CONVENTIONS_FILE, 3), withheldLine(CONVENTIONS_FILE, 4), withheldLine(CONVENTIONS_FILE, 5), AC1_LINES[5]],
  };
  const lf = read(AC1);
  expect(lf).toEqual(expected);
  expect(lf.delivered.join('\n')).not.toContain('a comment');
  expect(lf.delivered.join('\n')).not.toContain(cp(0x202e));
  expect(lf.delivered.join('\n')).not.toContain('rm -rf');
  expect(withheldLine(CONVENTIONS_FILE, 3)).toBe('(accord withheld line 3 of accord/product/conventions.md: it breaks a delivery rule; run accord lint)');
  // a BOM, CRLF ends and lone CR ends read the same
  expect(read(cp(0xfeff) + AC1.replace(/\n/g, '\r\n'))).toEqual(expected);
  expect(read(AC1.replace(/\n/g, '\r'))).toEqual(expected);
  // trailing spaces and tabs are not part of the line (the writer trims them too); blank lines are not delivered
  expect(checkProductText('- a  \t\n\n   \n- b\n').lines.map((l) => [l.line, l.text])).toEqual([[1, '- a'], [4, '- b']]);
  // the refused text is never kept in a result
  expect(JSON.stringify(checkProductText(AC1).lines)).not.toContain('rm -rf');
});

it('risk:security an unclosed HTML comment cannot hide the rules after it (D-09)', () => {
  const r = checkProductText('<!-- open\n- Rule one.\n- Rule two.\n');
  expect(r.problems.map((p) => [p.line, p.kind])).toEqual([[1, 'unclosed-comment']]);
  expect(r.lines.map((l) => [l.line, l.withheld])).toEqual([[1, true], [2, false], [3, false]]);
  expect(r.lines.slice(1).map((l) => l.text)).toEqual(['- Rule one.', '- Rule two.']);
  // a comment that closes is unchanged, and its text never reaches a line
  const closed = checkProductText('<!-- a\nb -->\n- kept <!-- x --> here\n');
  expect(closed.problems).toEqual([]);
  expect(closed.lines.map((l) => l.text)).toEqual(['- kept  here']);
});

it('risk:regression the comment stripping reads closed comments as the section reader does (D-01)', () => {
  const text = ['- a <!-- x --> b', '<!-- one', 'two', 'three -->', '- c', 'd <!-- e', 'f --> g'];
  const same = stripHtmlComments(text.map((t, i) => ({ line: i + 1, text: t }))).map((l) => l.text);
  expect(checkProductText(text.join('\n')).lines.map((l) => [l.line, l.text])).toEqual(same.flatMap((t, i) => (t.trim() === '' ? [] : [[i + 1, t.replace(/[ \t]+$/, '')]])));
});
