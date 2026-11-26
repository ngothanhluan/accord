// ST-LN-28 D-14 (7-ac-9): the split file an approved epic is written from. Pure: `parseSplit` reads the text and returns the
// split or one problem per fault, so the CLI can refuse a bad split before it writes any file.
import { expect, it } from 'vitest';
import { parseSplit } from '../src/index.js';

const HEAD = ['title: Checkout redesign', 'intent:', '  - Buyers pay faster.', '  - Success is two taps fewer.', 'vetoes:', '  - No new dependency.'];
const story = (title: string | undefined, extra: string[] = ['intent: [Show it.]']): string[] => [
  ...(title === undefined ? ['  -'] : ['  - title: ' + title]),
  ...extra.map((l) => "    " + l),
];
/** A split text: the epic head, then the stories (each a block of lines from `story`). */
const split = (...stories: string[][]): string => [...HEAD, 'stories:', ...stories.flat(), ''].join('\n');
const THREE = split(story('Cart summary'), story('Payment form', ['intent: [Collect the card.]', 'after: [1]']), story('Receipt email', ['intent: [Send a receipt.]', 'after: [1, 2]']));

it('risk:data-loss a split is checked whole before anything is written (ST-LN-28 7-ac-9)', () => {
  // a valid split: the epic, then the stories in file order, `after` as numbers
  const ok = parseSplit(THREE);
  expect(ok.problems).toEqual([]);
  expect(ok.split).toEqual({
    title: 'Checkout redesign',
    intent: ['Buyers pay faster.', 'Success is two taps fewer.'],
    vetoes: ['No new dependency.'],
    decisions: [],
    stories: [
      { title: 'Cart summary', intent: ['Show it.'], after: [] },
      { title: 'Payment form', intent: ['Collect the card.'], after: [1] },
      { title: 'Receipt email', intent: ['Send a receipt.'], after: [1, 2] },
    ],
  });

  // numbers stay strings when read: an id or a title that looks like a number keeps its spelling
  const numeric = parseSplit(['id: 0123', 'title: 1e3', 'intent: [Why.]', 'stories:', '  - id: 0456', '    title: Alpha', '    intent: [A.]', '  - title: Beta', '    intent: [B.]', ''].join('\n'));
  expect(numeric.problems).toEqual([]);
  expect(numeric.split?.id).toBe('0123');
  expect(numeric.split?.title).toBe('1e3');
  expect(numeric.split?.stories[0].id).toBe('0456');
  expect(numeric.split?.vetoes).toEqual([]);
  expect(numeric.split?.decisions).toEqual([]);

  // one problem each, and no split, for every fault the plan names
  const bad = (text: string, ...words: string[]): void => {
    const r = parseSplit(text);
    expect(r.split, text).toBeUndefined();
    expect(r.problems, text).toHaveLength(1);
    for (const w of words) expect(r.problems[0], text).toContain(w);
  };
  bad(split(story('Only one')), 'two to ten stories');
  bad(split(...Array.from({ length: 11 }, (_, i) => story('Story ' + String.fromCharCode(97 + i)))), 'two to ten stories');
  bad(split(story('First', ['intent: []']), story('Second')), 'story 1', 'intent');
  bad(split(story('First', ['intent: [a, b, c, d, e, f]']), story('Second')), 'story 1', 'at most five');
  bad(split(story('First', ['intent: ["one\\ntwo"]']), story('Second')), 'story 1', 'one line');
  bad(split(story('First'), story('Second', ['intent: [Go.]', 'after: [2]'])), 'story 2', 'after 2');
  bad(split(story('First', ['intent: [Go.]', 'after: [3]']), story('Second'), story('Third')), 'story 1', 'after 3');
  bad(split(story('First'), story('Second', ['intent: [Go.]', 'after: [7]'])), 'story 2', 'after 7');
  bad(split(story('First'), story('Second', ['intent: [Go.]', 'after: [0]'])), 'story 2', 'after 0');
  bad(split(story('First'), story(undefined)), 'story 2', 'title');
  bad(THREE.replace('title: Checkout redesign', 'title: ""'), 'epic', 'title');
  bad(THREE.replace('vetoes:\n  - No new dependency.', 'vetoes:\n  - "a\\nb"'), 'epic', 'one line');
  bad(THREE.replace(/stories:[\s\S]*/, 'stories: nope\n'), 'stories');
  bad('title: [unclosed', 'YAML');
});

const D1 = 'Card payments only — "only cards at launch"';
const D2 = 'Guests can pay — "no account is needed"';

it('risk:parsing a split carries the epic decisions and refuses a numbered one (ST-LN-28 7-ac-8)', () => {
  const decided = THREE.replace('stories:', 'decisions:\n  - ' + D1 + '\n  - ' + D2 + '\nstories:');
  const ok = parseSplit(decided);
  expect(ok.problems).toEqual([]);
  expect(ok.split?.decisions).toEqual([D1, D2]);

  // backward compatible: no key, a null and an empty list all read as no decisions
  for (const text of [THREE, THREE.replace('stories:', 'decisions:\nstories:'), THREE.replace('stories:', 'decisions: []\nstories:')]) {
    const r = parseSplit(text);
    expect(r.problems, text).toEqual([]);
    expect(r.split?.decisions, text).toEqual([]);
  }

  const bad = (text: string, ...words: string[]): void => {
    const r = parseSplit(text);
    expect(r.split, text).toBeUndefined();
    expect(r.problems, text).toHaveLength(1);
    for (const w of words) expect(r.problems[0], text).toContain(w);
  };
  bad(THREE.replace('stories:', 'decisions: nope\nstories:'), 'epic decisions', 'list');
  bad(THREE.replace('stories:', 'decisions:\n  - D-01 One cart — "x"\nstories:'), 'decision 1', 'D- number');
});

// 999.60 decision 3, D-02 (15-19): a story may list the files and folders the scout found it likely to edit; stories that touch the same code
// are chained through `after`, or the split is refused before anything is written.
const touching = (...stories: string[][]): string => split(...stories);
const withTouches = (title: string, touches: string, after?: string): string[] =>
  story(title, ['intent: [Go.]', ...(after === undefined ? [] : ['after: ' + after]), 'touches: ' + touches]);

it('risk:data-loss two stories that touch one file and do not wait for each other are refused (D-02, 15-19)', () => {
  const r = parseSplit(touching(withTouches('Cart', '[src/cart.ts]'), withTouches('Export', '[src/export.ts]'), withTouches('Report', '[src/export.ts]')));
  expect(r.split).toBeUndefined();
  expect(r.problems).toEqual(['stories 2 and 3 both touch src/export.ts and neither waits for the other: add after: [2] to story 3, or split the shared piece out']);

  // the same file with the order stated is accepted, and the list is kept in the story
  const ok = parseSplit(touching(withTouches('Cart', '[src/cart.ts]'), withTouches('Export', '[src/export.ts]'), withTouches('Report', '[src/export.ts]', '[2]')));
  expect(ok.problems).toEqual([]);
  expect(ok.split?.stories.map((s) => s.touches)).toEqual([['src/cart.ts'], ['src/export.ts'], ['src/export.ts']]);
  expect(ok.split?.stories[2].after).toEqual([2]);
});

it('risk:complex-branching a folder holds the other story\'s path and the chain may run through other stories (D-02, 15-19)', () => {
  const stories = (second: string): string[][] => [withTouches('Base', '[src/report/]'), withTouches('Middle', '[src/other.ts]', second), withTouches('Csv', '[src/report/csv.ts]', '[2]')];
  // story 3 waits for 2, 2 waits for 1: story 3 reaches the folder's story through 2
  const chained = parseSplit(touching(...stories('[1]')));
  expect(chained.problems).toEqual([]);
  // without the link from 2 to 1 the folder and its file are unchained
  const loose = parseSplit(touching(...stories('[]')));
  expect(loose.split).toBeUndefined();
  expect(loose.problems).toHaveLength(1);
  expect(loose.problems[0]).toContain('stories 1 and 3 both touch src/report/csv.ts');
  // two stories that name the same folder, and a folder that is only a prefix of a name (src/rep is not src/report/)
  expect(parseSplit(touching(withTouches('A', '[src/a/]'), withTouches('B', '[src/a/]'))).problems[0]).toContain('both touch src/a/');
  expect(parseSplit(touching(withTouches('A', '[src/rep/]'), withTouches('B', '[src/report/x.ts]'))).problems).toEqual([]);
  expect(parseSplit(touching(withTouches('A', '[src/rep.ts]'), withTouches('B', '[src/rep.tsx]'))).problems).toEqual([]);
});

it('risk:security a touches entry that is absolute, climbs out, has a backslash or is not text is a problem line (T-15-41, 15-19)', () => {
  const one = (touches: string): string[] => parseSplit(touching(withTouches('A', touches), story('B'))).problems;
  expect(one('[/etc/passwd]')).toEqual(['story 1: touches entry "/etc/passwd" must be a path inside the repository: no leading slash, no drive letter, no .. segment, no backslash']);
  for (const bad of ['[../x]', '[src/../x.ts]', '[C:/x.ts]', '["src\\\\a.ts"]', '["a\\nb"]', '[""]', '[[a]]']) {
    const problems = one(bad);
    expect(problems, bad).toHaveLength(1);
    expect(problems[0], bad).toContain('story 1: touches');
  }
  expect(one('nope')[0]).toContain('story 1: touches must be a list of paths');
  expect(one('[' + Array.from({ length: 31 }, (_, i) => 'src/f' + i + '.ts').join(', ') + ']')).toEqual(['story 1: touches holds 31 entries: at most 30']);
  // thirty entries pass
  expect(one('[' + Array.from({ length: 30 }, (_, i) => 'src/f' + i + '.ts').join(', ') + ']')).toEqual([]);
});

it('risk:regression a split with no touches anywhere parses as before (D-02, 15-19)', () => {
  const r = parseSplit(THREE);
  expect(r.problems).toEqual([]);
  for (const s of r.split?.stories ?? []) expect('touches' in s).toBe(false);
  // an empty or null touches is no list at all, and stories without touches never conflict
  expect(parseSplit(touching(withTouches('A', '[]'), withTouches('B', '[]'))).problems).toEqual([]);
  expect(parseSplit(touching(withTouches('A', '[src/a.ts]'), story('B'))).problems).toEqual([]);
});
