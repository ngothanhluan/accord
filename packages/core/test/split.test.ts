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
