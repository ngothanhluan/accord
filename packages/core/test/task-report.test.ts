// ST-LN-59 59-ac-1 (D-07): the report checker reads one line each of `red reason:` and `self-review:`, whatever their spacing and line endings, and the contract the brief prints
// names only keys it reads.
import { expect, it } from 'vitest';
import { REPORT_CONTRACT, reportReasons } from '../src/index.js';

const RED = 'red reason: the export wrote nothing, so no csv file existed';
const SELF = 'self-review: missing: none; extra: none; misread: none';
const FULL = RED + '\n' + SELF + '\n';

it('risk:parsing the report lines read one way whatever their spacing and line endings (ST-LN-59 59-ac-1)', () => {
  expect(reportReasons(FULL)).toEqual([]);

  // every key the contract names is a key the checker reads: take it out and the checker names it
  const keys = ['red reason:', 'self-review:', 'missing:', 'extra:', 'misread:'];
  for (const key of keys) {
    expect(REPORT_CONTRACT, key).toContain(key);
    const without = FULL.split(key).join('gone:');
    const reasons = reportReasons(without);
    expect(reasons.length, key).toBeGreaterThan(0);
    expect(reasons.join('\n'), key).toContain(key.replace(/:$/, ''));
  }

  // spacing, line endings and a byte order mark change nothing
  expect(reportReasons('   ' + RED + '\n\t' + SELF + '\n')).toEqual([]);
  expect(reportReasons(FULL.replace(/\n/g, '\r\n'))).toEqual([]);
  expect(reportReasons('﻿' + FULL)).toEqual([]);
  expect(reportReasons('﻿' + FULL.replace(/\n/g, '\r\n'))).toEqual([]);
  expect(reportReasons('notes\n\n' + FULL + 'concerns: none\n')).toEqual([]);
  expect(reportReasons('red reason:the export wrote nothing\nself-review: missing:none;extra:none;misread:none')).toEqual([]);
  expect(reportReasons(RED + '\nself-review: misread: a; extra: b; missing: c\n')).toEqual([]);

  // another case is not the key
  expect(reportReasons(FULL.replace('red reason:', 'Red reason:'))).toHaveLength(1);
  expect(reportReasons(FULL.replace('self-review:', 'Self-review:'))).toEqual(['the executor report has no "self-review:" line']);
  expect(reportReasons(FULL.replace('missing:', 'Missing:'))).toEqual(['the executor report\'s "self-review:" line lacks "missing:"']);
  // a word that ends in a key is not the key
  expect(reportReasons(RED + '\nself-review: dismissing: a; extra: b; misread: c\n')).toEqual(['the executor report\'s "self-review:" line lacks "missing:"']);

  // the template's own placeholder, and nothing, name no behaviour
  for (const value of ['', '   ', '<the behaviour the failing test showed missing>', '<...>', 'none', 'None.', 'n/a', 'N/A', '-', 'TBD', 'tbd.']) {
    expect(reportReasons('red reason: ' + value + '\n' + SELF + '\n'), JSON.stringify(value)).toEqual([
      'the executor report has no "red reason:" line naming the behaviour the red test showed missing',
    ]);
  }
  expect(reportReasons(SELF + '\n')).toEqual(['the executor report has no "red reason:" line naming the behaviour the red test showed missing']);
  // a task with honestly no red test (its test came with an earlier task, or every scenario is @ui) says so with its reason; the contract and the executor are told how
  for (const value of ['no red test — the test was written in task 1', 'No red test: every scenario of this ticket is @ui']) {
    expect(reportReasons('red reason: ' + value + '\n' + SELF + '\n'), value).toEqual([]);
  }
  expect(REPORT_CONTRACT).toContain('red reason: no red test — <why>');
  // the contract's own lines, pasted unchanged, pass nothing
  expect(reportReasons(REPORT_CONTRACT)).toHaveLength(4);

  // `none` is text in a self-review part; a part with no text, or a placeholder, is named
  expect(reportReasons(RED + '\nself-review: missing: none; extra: none; misread: none\n')).toEqual([]);
  expect(reportReasons(RED + '\nself-review: missing: none; extra: none; misread:\n')).toEqual(['the executor report\'s "self-review:" line has no text after "misread:"']);
  expect(reportReasons(RED + '\nself-review: missing: ; extra: none; misread: none\n')).toEqual(['the executor report\'s "self-review:" line has no text after "missing:"']);
  expect(reportReasons(RED + '\nself-review: missing: none; extra: <...>; misread: none\n')).toEqual(['the executor report\'s "self-review:" line has no text after "extra:"']);
  expect(reportReasons(RED + '\nself-review: missing: none; extra: none\n')).toEqual(['the executor report\'s "self-review:" line lacks "misread:"']);
  expect(reportReasons(RED + '\nself-review:\n')).toHaveLength(3);

  // the first line of a key is the one read
  expect(reportReasons('red reason: <...>\n' + FULL)).toHaveLength(1);
  expect(reportReasons(FULL + 'red reason: <...>\n')).toEqual([]);

  // one linear pass: a very long line is read in well under 200 ms, whatever it holds
  const big = 100000;
  const lines = [
    'red reason: ' + 'x'.repeat(big),
    'red reason: ' + ' '.repeat(big) + 'x',
    'red reason: ' + '.'.repeat(big) + 'x',
    'red reason: ' + '<'.repeat(big),
    RED + '\nself-review: ' + 'missing:'.repeat(big / 8),
    RED + '\nself-review: missing: ' + ';'.repeat(big) + 'x; extra: y; misread: z',
    RED + '\nself-review: missing: ' + ' '.repeat(big) + ' extra: y; misread: z',
    ' '.repeat(big) + 'red reason: x',
    'x'.repeat(big),
  ];
  for (const text of lines) {
    const started = performance.now();
    reportReasons(text);
    expect(performance.now() - started, text.slice(0, 40)).toBeLessThan(200);
  }
});
