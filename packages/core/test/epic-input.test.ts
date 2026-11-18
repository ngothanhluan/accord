// ST-LN-28 D-13: the epic's Vetoes and Decisions reach a story as CLI-built input, read from the default branch.
import { describe, expect, it } from 'vitest';
import { anchorText, epicBlock, loadSnapshot } from '../src/index.js';
import { parseLedger } from '../src/load/work.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import type { RepoSnapshot } from '../src/index.js';

const snap = (files: Record<string, string>): RepoSnapshot => loadSnapshot({ files, tree: [] });
const P = (id: string): string => 'accord/tickets/' + id + '.md';

/** An epic ticket: type epic, lane L, its own Vetoes and Decisions sections. */
function epic(id: string, o: { vetoes?: string[]; decisions?: string[] } = {}): string {
  const body = ['## Intent', 'Group the checkout stories.', '', '## Vetoes', ...(o.vetoes ?? []), '', '## Decisions', ...(o.decisions ?? []), '', '## Corrections', ''].join('\n');
  return laneTicket(id, { lane: 'L', body }).replace('type: story', 'type: epic').replace('title: "Export"', 'title: "Checkout epic"');
}
const story = (id: string, parent?: string): string => laneTicket(id, { frontmatter: parent === undefined ? [] : [`parent: "${parent}"`] });

const VETOES = ['- No new dependency.', '- No emoji.'];
const D1 = '- D-01 One cart — "one cart per user"';
const D2 = '- D-02 Guest checkout stays — "guests must be able to pay"';
const BLOCK = (decisions: string[]): string =>
  ['## Epic E-1 "Checkout epic"', '### Vetoes', ...VETOES, '### Decisions', ...decisions, '### Epic lessons', '(none)'].join('\n');

const BLOCK_NONE = ['## Epic E-1 "Checkout epic"', '### Vetoes', '(none)', '### Decisions', '(none)', '### Epic lessons', '(none)'].join('\n');

/** The working tree holds `tree` and the default branch holds `def`. */
function withDefault(tree: Record<string, string>, def: Record<string, string>): RepoSnapshot {
  return { ...snap(tree), defaultRef: { ref: 'refs/remotes/origin/main', snapshot: snap(def) } };
}

describe('epicBlock', () => {
  it('ac-8 a story\'s epic vetoes and decisions are built from the default branch (ST-LN-28 7-ac-8)', () => {
    const old = { 'accord/config.yml': CONFIG, [P('E-1')]: epic('E-1', { vetoes: VETOES, decisions: [D1] }), [P('S-1')]: story('S-1', 'E-1') };
    const current = { ...old, [P('E-1')]: epic('E-1', { vetoes: VETOES, decisions: [D1, D2] }) };
    // the working tree's copy of the epic is the older one: the default branch's copy wins
    expect(epicBlock(withDefault(old, current), 'S-1')).toBe(BLOCK([D1, D2]));
    // no default branch read: the working tree's copy
    expect(epicBlock(snap(old), 'S-1')).toBe(BLOCK([D1]));
    // the default branch holds no copy of the epic: the working tree's copy
    expect(epicBlock(withDefault(old, { 'accord/config.yml': CONFIG }), 'S-1')).toBe(BLOCK([D1]));
    // the anchor prints it after the story's own sections and before the Rulings
    const text = anchorText(withDefault(old, current), 'S-1') ?? '';
    expect(text).toContain('## Corrections\n(none)\n\n' + BLOCK([D1, D2]) + '\n\n## Rulings\n(none)\n');
  });

  it('ac-8 a story without parent has no epic block and an unchanged anchor (ST-LN-28 7-ac-8)', () => {
    const files = { 'accord/config.yml': CONFIG, [P('S-1')]: story('S-1'), [P('E-1')]: epic('E-1', { vetoes: VETOES }) };
    expect(epicBlock(snap(files), 'S-1')).toBeUndefined();
    expect(epicBlock(snap(files), 'NOPE-1')).toBeUndefined();
    expect(anchorText(snap(files), 'S-1')).not.toContain('Epic');
  });

  it('ac-8 a parent that is no ticket or no epic gives one line and no sections (ST-LN-28 7-ac-8)', () => {
    const files = { 'accord/config.yml': CONFIG, [P('S-1')]: story('S-1', 'GONE-1'), [P('S-2')]: story('S-2', 'S-3'), [P('S-3')]: story('S-3') };
    expect(epicBlock(snap(files), 'S-1')).toBe('parent GONE-1 is not an epic in this clone');
    expect(epicBlock(snap(files), 'S-2')).toBe('parent S-3 is not an epic in this clone');
    const text = anchorText(snap(files), 'S-2') ?? '';
    expect(text).toContain('## Corrections\n(none)\n\nparent S-3 is not an epic in this clone\n\n## Rulings');
    expect(text).not.toContain('### Vetoes');
  });

  it('ac-8 an epic with empty sections prints none under each (ST-LN-28 7-ac-8)', () => {
    const files = { 'accord/config.yml': CONFIG, [P('E-1')]: epic('E-1'), [P('S-1')]: story('S-1', 'E-1') };
    expect(epicBlock(snap(files), 'S-1')).toBe(BLOCK_NONE);
  });
});

/** A story's ledger file as a story writes it at verify: the lesson lines under `## Epic lessons`. */
const ledgerOf = (id: string, lines: string[]): Record<string, string> => ({
  ['accord/tickets/' + id + '/ledger.md']: ['## Rulings', '- none', '', '## Epic lessons', '<!-- one per line -->', ...lines, '', '## Deferred', ''].join('\n'),
});
const lesson = (what: string): string => `- Lesson: ${what} — "owner words about ${what}"`;

describe('epic lessons', () => {
  it('ac-10 parseLedger returns the epic lessons in order and none without the section (ST-LN-28 7-ac-10)', () => {
    const text = ['## Rulings', '- Lesson: not here — "x"', '', '## Epic lessons', '<!-- a comment -->', lesson('one'), '', lesson('two'), '', '## Deferred', lesson('three')].join('\n');
    expect(parseLedger('l.md', text).epicLessons).toEqual([lesson('one'), lesson('two')]);
    expect('epicLessons' in parseLedger('l.md', '## Rulings\n- Ruling: x\n')).toBe(false);
    expect('epicLessons' in parseLedger('l.md', '## Epic lessons\n<!-- nothing -->\n\n')).toBe(false);
  });

  it('ac-10 epicBlock lists the siblings lessons from the default branch by id then ledger order (ST-LN-28 7-ac-10)', () => {
    const base = { 'accord/config.yml': CONFIG, [P('E-1')]: epic('E-1'), [P('S-1')]: story('S-1', 'E-1') };
    const tree = { ...base, [P('S-2')]: story('S-2', 'E-1'), [P('S-10')]: story('S-10', 'E-1') };
    // the story's own ledger on the default branch, a ticket of another parent and a ticket with no parent are never read
    const def = {
      ...tree,
      ...ledgerOf('S-10', [lesson('ten')]),
      ...ledgerOf('S-2', [lesson('two a'), lesson('two b')]),
      ...ledgerOf('S-1', [lesson('mine')]),
      [P('T-1')]: story('T-1', 'E-2'),
      ...ledgerOf('T-1', [lesson('other epic')]),
    };
    const block = epicBlock(withDefault(tree, def), 'S-1') ?? '';
    expect(block.endsWith(['### Epic lessons', '- S-2: ' + lesson('two a'), '- S-2: ' + lesson('two b'), '- S-10: ' + lesson('ten')].join('\n'))).toBe(true);
    expect(block).not.toContain('mine');
    expect(block).not.toContain('other epic');
    // a lesson only in the working tree (an unmerged sibling branch, or this branch's copy) is not shown
    const local = { ...tree, ...ledgerOf('S-2', [lesson('unmerged')]) };
    expect(epicBlock(withDefault(local, tree), 'S-1')).toBe(BLOCK_NONE);
    // no default branch read: nothing is shown
    expect(epicBlock(snap(local), 'S-1')).toBe(BLOCK_NONE);
  });
});
