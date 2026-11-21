// Phase 08.4 security T-08.4-27: `scoutCheck` compiled each `## Absent` row's pattern with `new RegExp` and ran it over every
// tracked line, so a pattern such as `([a-z]*)*!` over a 60-letter line hung the CLI. The check now refuses a pattern that is not
// provably cheap, as a failure that names the row, and never runs it. None of these cases runs a catastrophic pattern here: a
// refused pattern is exactly the case a hang would freeze this process on, so the hostile run lives in a child process
// (packages/cli/test/scout-check.test.ts).
import { expect, it } from 'vitest';
import { scoutCheck } from '../src/index.js';

const HEAD = '## Files\n- src/a.ts\n\n## Absent\n| Claim | Pattern | Folders | Allowed hits |\n|---|---|---|---|\n';

/** The failures of one `## Absent` row whose pattern cell is `cell` (written as the reply writes it), over the given tracked files. */
function failuresOf(cell: string, files: Record<string, string> = { 'src/a.ts': 'one\ntwo needle three\nfour\n' }): string[] {
  const tracked = Object.keys(files);
  return scoutCheck({
    text: HEAD + '| the claim | ' + cell.replace(/\|/g, '\\|') + ' | src | |\n', // a pipe in a table cell is written \|
    tracked,
    read: (paths) => paths.map((p) => files[p]),
  }).failures;
}

const REFUSED = 'absent claim "the claim" (row 7): its pattern is refused: ';

it('risk:security accord scout check accepts the cheap pattern shapes a scout writes (D-07)', () => {
  const accepted = [
    'two', // a literal word
    'foo\\(', // an escaped paren
    '\\bTODO\\b', // word boundaries
    'two.*three', // one unbounded quantifier
    '[a-z]+ three', // a character class with one quantifier
    'foo|bar', // an alternation of literals
    '(foo|bar)\\(', // a group with an alternation, not quantified
    'colou?r', // an optional character
    'gate plan.{0,40}again', // one bounded quantifier
    '(ab)+', // a quantified group of plain atoms
    'needle[(]', // a bracketed paren
    '^import ', // an anchor
    'changed after accord gate plan', // a literal sentence
  ];
  for (const cell of accepted) {
    const failures = failuresOf('`' + cell + '`', { 'src/a.ts': 'alpha\nbeta\ngamma\n' });
    expect(failures, cell).toEqual([]);
  }
  // and an accepted pattern still finds what it searches for, outside the allowed hits
  expect(failuresOf('`two.*three`')).toEqual(['absent claim "the claim" (row 7): src/a.ts:2 matches its pattern outside its allowed hits']);
});

it('risk:security accord scout check refuses a nested quantifier or a quantified group that holds a quantifier or an alternation, naming the row (D-07)', () => {
  const nested = ['([a-z]*)*!', '(a+)+', '(a*)*', '(.*)*', '(a|aa)+', '(a|a)*b', '(\\w+\\s?)*$', '(a?){2,}', '((a))+', '(a{1,2})+', '(?:a+)+'];
  for (const cell of nested) {
    const failures = failuresOf('`' + cell + '`');
    expect(failures.length, cell).toBe(1);
    expect(failures[0], cell).toContain(REFUSED);
  }
  expect(failuresOf('`([a-z]*)*!`')[0]).toContain('inside a quantified group');
});

it('risk:security accord scout check refuses a backreference and every lookaround, naming the row (D-07)', () => {
  const cells = ['(a)\\1', '(?<x>a)\\k<x>', '(?=a)b', '(?!a)b', '(?<=a)b', '(?<!a)b', 'a(?=b)'];
  for (const cell of cells) {
    const failures = failuresOf('`' + cell + '`');
    expect(failures.length, cell).toBe(1);
    expect(failures[0], cell).toContain(REFUSED);
  }
  expect(failuresOf('`(a)\\1`')[0]).toContain('a backreference');
  expect(failuresOf('`(?=a)b`')[0]).toContain('a lookaround');
});

it('risk:security accord scout check refuses a pattern that is too long or holds too many quantifiers or branches (D-07)', () => {
  const tooLong = 'a'.repeat(201);
  const fine = 'a'.repeat(200);
  expect(failuresOf('`' + tooLong + '`')).toEqual([REFUSED + 'it is 201 characters, over the 200-character limit']);
  expect(failuresOf('`' + fine + '`')).toEqual([]);

  const dear = [
    'a.*b.*c', // two unbounded quantifiers
    '.*.*x', // adjacent unbounded quantifiers
    'a+b+', // two unbounded quantifiers
    'a{2,}b*', // a counted open range and a star
    'a?a?a?a?a?a?a?a?a?x', // nine optional parts: 512 ways to match
    '.{0,100}.{0,100}x', // two wide bounded ranges
    'a{0,101}', // a bounded range over the limit of 100
    '(a|a)(a|a)(a|a)(a|a)(a|a)(a|a)(a|a)(a|a)(a|a)x', // nine overlapping alternations: 512 ways
  ];
  for (const cell of dear) {
    const failures = failuresOf('`' + cell + '`');
    expect(failures.length, cell).toBe(1);
    expect(failures[0], cell).toContain(REFUSED);
  }
});

it('risk:security accord scout check still reports a pattern that is no regular expression, and refuses nothing for a refused row but that row (D-07)', () => {
  expect(failuresOf('`run(`')).toEqual(['absent claim "the claim" (row 7): its pattern is not a valid JavaScript regular expression']);
  // a refused row does not stop the next row from running
  const tracked = ['src/a.ts'];
  const result = scoutCheck({
    text: HEAD + '| first | `(a+)+` | src | |\n| second | `needle` | src | |\n',
    tracked,
    read: (paths) => paths.map(() => 'a needle\n'),
  });
  expect(result.failures).toEqual([
    'absent claim "first" (row 7): its pattern is refused: a quantifier sits inside a quantified group',
    'absent claim "second" (row 8): src/a.ts:1 matches its pattern outside its allowed hits',
  ]);
});

it('risk:resource accord scout check runs a pattern with a quantifier only over a line of at most 2000 characters, and a plain pattern over any line (D-07)', () => {
  const deep = 'x'.repeat(3000) + ' needle ' + 'y'.repeat(100);
  const files = { 'src/a.ts': 'short\n' + deep + '\n' };
  // no quantifier: searched at any length, so the match 3000 characters in is found
  expect(failuresOf('`needle`', files)).toEqual(['absent claim "the claim" (row 7): src/a.ts:2 matches its pattern outside its allowed hits']);
  // a quantifier: the long line is not run, the short one still is
  expect(failuresOf('`nee+dle`', files)).toEqual([]);
  expect(failuresOf('`sho+rt`', files)).toEqual(['absent claim "the claim" (row 7): src/a.ts:1 matches its pattern outside its allowed hits']);
  // exactly 2000 characters is still run; 2001 is not
  const edge = 'x'.repeat(1993) + ' needle';
  expect(edge.length).toBe(2000);
  expect(failuresOf('`nee+dle`', { 'src/a.ts': edge + '\n' })).toEqual(['absent claim "the claim" (row 7): src/a.ts:1 matches its pattern outside its allowed hits']);
  expect(failuresOf('`nee+dle`', { 'src/a.ts': 'x' + edge + '\n' })).toEqual([]);
});
