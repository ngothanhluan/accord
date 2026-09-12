// D-36, D-39, D-40, D-41, D-42, STACK Decision 4: the fence-aware scanner pinned on inline bodies and the body-edges fixture.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import type { RepoSnapshot } from '../src/index.js';
import { d07Key, duplicateHeadings, headingKey, requirementLines, scan, stripHtmlComments } from '../src/load/sections.js';
import type { Section } from '../src/model/snapshot.js';
import { readFixture } from './helpers/fixture.js';

const body = (...lines: string[]) => lines.join('\n');
const section = (heading: string, ...lines: string[]): Section => ({
  heading,
  line: 1,
  lines: lines.map((text, i) => ({ line: i + 2, text })),
});

describe('headingKey (D-39)', () => {
  it('lower-cases and collapses whitespace', () => {
    expect(headingKey('Acceptance Criteria')).toBe('acceptance criteria');
    expect(headingKey('  Open   questions ')).toBe('open questions');
  });

  it('scan strips trailing # characters from a heading', () => {
    const { sections } = scan(body('## Plan ##', 'x'), 0);
    expect(sections.map((s) => s.heading)).toEqual(['Plan']);
  });
});

describe('scan fences (STACK Decision 4)', () => {
  const fenced = (mark: string) => body('## Intent', mark, '## Acceptance criteria', '- WHEN fake', mark, '## Plan');

  it.each(['```', '~~~'])('a heading and a bullet inside a %s fence are content, not a section', (mark) => {
    const { sections, fences } = scan(fenced(mark), 0);
    expect(sections.map((s) => [s.heading, s.line])).toEqual([
      ['Intent', 1],
      ['Plan', 6],
    ]);
    expect(fences).toHaveLength(1);
    expect(fences[0].open).toBe(2);
    expect(fences[0].close).toBe(5);
    expect(fences[0].content).toEqual([
      { line: 3, text: '## Acceptance criteria' },
      { line: 4, text: '- WHEN fake' },
    ]);
  });

  it('a ~~~ line does not close a backtick fence', () => {
    const { sections, fences } = scan(body('## Intent', '```', '~~~', '## Plan', '```', '## Open questions'), 0);
    expect(sections.map((s) => s.heading)).toEqual(['Intent', 'Open questions']);
    expect(fences[0].content.map((l) => l.text)).toEqual(['~~~', '## Plan']);
  });

  it('a closing fence must be at least as long as the opener', () => {
    const four = scan(body('## Intent', '```', '## Plan', '````', '## Open questions'), 0);
    expect(four.sections.map((s) => s.heading)).toEqual(['Intent', 'Open questions']);
    expect(four.fences[0].close).toBe(4);

    const two = scan(body('## Intent', '```', '## Plan', '``', '## Open questions'), 0);
    expect(two.sections.map((s) => s.heading)).toEqual(['Intent']);
    expect(two.fences[0].content.map((l) => l.text)).toEqual(['## Plan', '``', '## Open questions']);
  });

  it('an unterminated fence swallows every later line', () => {
    const { sections, fences } = scan(body('## Intent', '```', '## Requirements', '- WHEN a', '## Plan'), 0);
    expect(sections.map((s) => s.heading)).toEqual(['Intent']);
    expect(sections[0].lines.map((l) => l.line)).toEqual([2, 3, 4, 5]);
    expect(fences[0].close).toBe(5);
  });

  it('headings count only at column 0', () => {
    const { sections } = scan(body('## Intent', ' ## Plan', '### Sub'), 0);
    expect(sections.map((s) => s.heading)).toEqual(['Intent']);
    expect(sections[0].lines.map((l) => l.text)).toEqual([' ## Plan', '### Sub']);
  });

  it('numbers lines from bodyOffset + 1', () => {
    const { sections } = scan(body('## Intent', 'x'), 17);
    expect(sections[0].line).toBe(18);
    expect(sections[0].lines).toEqual([{ line: 19, text: 'x' }]);
  });
});

describe('stripHtmlComments (D-41)', () => {
  it('removes a single-line comment and keeps the surrounding text on its line', () => {
    expect(stripHtmlComments([{ line: 3, text: 'a <!-- hidden --> b' }])).toEqual([{ line: 3, text: 'a  b' }]);
  });

  it('removes the inner line of a three-line comment and keeps the line numbers', () => {
    const out = stripHtmlComments([
      { line: 5, text: 'before <!-- open' },
      { line: 6, text: '- WHEN hidden' },
      { line: 7, text: 'close --> after' },
    ]);
    expect(out).toEqual([
      { line: 5, text: 'before ' },
      { line: 6, text: '' },
      { line: 7, text: ' after' },
    ]);
  });
});

describe('requirementLines (D-41, FMT-05)', () => {
  it('strips one list marker of any kind and keeps plain lines', () => {
    const s = section('Requirements', '- a', '* b', '+ c', '1. d', 'e');
    expect(requirementLines(s, [])).toEqual([
      { line: 2, text: 'a' },
      { line: 3, text: 'b' },
      { line: 4, text: 'c' },
      { line: 5, text: 'd' },
      { line: 6, text: 'e' },
    ]);
  });

  it('drops sub-headings, fenced lines, blank lines, and whitespace-only bullets', () => {
    const s = section('Requirements', '### sub', '```', '- WHEN fenced', '```', '', '-   ', '- kept');
    const fences = [{ info: '', open: 3, close: 5, content: [{ line: 4, text: '- WHEN fenced' }] }];
    expect(requirementLines(s, fences)).toEqual([{ line: 8, text: 'kept' }]);
  });
});

describe('duplicateHeadings (D-40, D-42)', () => {
  const at = (heading: string, line: number): Section => ({ heading, line, lines: [] });

  it('reports the second D-07 heading and ignores untracked ones', () => {
    const dup = duplicateHeadings('f.md', [at('Requirements', 3), at('Requirements', 9)], d07Key);
    expect(dup).toHaveLength(1);
    expect(dup[0]).toMatchObject({ file: 'f.md', line: 9, rule: 'load.heading-duplicate' });
    expect(duplicateHeadings('f.md', [at('Notes', 3), at('Notes', 9)], d07Key)).toEqual([]);
  });

  it('matches by normalised key, so casing does not make a heading distinct', () => {
    const dup = duplicateHeadings('f.md', [at('Requirements', 3), at('requirements', 9)], d07Key);
    expect(dup.map((f) => f.line)).toEqual([9]);
  });

  it('dedupes verification blocks on the ac tag, not the heading text', () => {
    const tag = (s: Section) => /^@(ac-[1-9][0-9]*)\b/.exec(s.heading)?.[1];
    const same = duplicateHeadings('v.md', [at('@ac-1 Một', 3), at('@ac-1 Một lần nữa', 9)], tag);
    expect(same.map((f) => f.line)).toEqual([9]);
    expect(duplicateHeadings('v.md', [at('@ac-1 A', 3), at('@ac-2 A', 9)], tag)).toEqual([]);
  });
});

describe('body-edges fixture (D-36, D-39, D-40, D-41)', () => {
  let snap: RepoSnapshot;
  const T = (stem: string) => 'accord/tickets/' + stem + '.md';
  beforeAll(() => {
    snap = loadSnapshot(readFixture('body-edges'));
  });

  it('DUP: the second ## Requirements is an error at its line and the first section is used', () => {
    expect(snap.errors).toEqual([
      {
        file: T('DUP'),
        line: 13,
        rule: 'load.heading-duplicate',
        reason: 'duplicate heading "## Requirements"; the first occurrence is used',
      },
    ]);
    const t = snap.tickets.DUP;
    expect(t.frontmatter).toMatchObject({ id: 'DUP', type: 'story' });
    expect(t.requirements).toEqual([{ line: 11, text: 'WHEN a the system SHALL b' }]);
    expect(t.scenarios.map((s) => [s.acTag, s.line])).toEqual([['ac-1', 21]]);
  });

  it('CASE: casing, extra spaces, and trailing # match the D-07 headings; raw text is kept', () => {
    const t = snap.tickets.CASE;
    expect(t.sections.map((s) => [s.heading, s.line])).toEqual([
      ['INTENT', 7],
      ['requirements', 10],
      ['Acceptance Criteria', 13],
    ]);
    expect(t.requirements).toEqual([{ line: 11, text: 'WHEN a the system SHALL b' }]);
    expect(t.scenarios.map((s) => [s.acTag, s.line])).toEqual([['ac-1', 18]]);
  });

  it('FENCE: comments and fences hide nothing from the reader and add nothing to the model', () => {
    const t = snap.tickets.FENCE;
    expect(t.sections.map((s) => [s.heading, s.line])).toEqual([
      ['Requirements', 7],
      ['Acceptance criteria', 23],
      ['Plan', 32],
    ]);
    expect(t.requirements).toEqual([
      { line: 16, text: 'WHEN one' },
      { line: 17, text: 'WHEN two' },
      { line: 18, text: 'WHEN three' },
      { line: 19, text: 'WHEN four' },
      { line: 20, text: 'WHEN five' },
    ]);
    expect(t.scenarios.map((s) => [s.acTag, s.line])).toEqual([['ac-1', 28]]);
    const json = JSON.stringify({ requirements: t.requirements, scenarios: t.scenarios });
    expect(json).not.toContain('inside a fence');
    expect(json).not.toContain('inside a comment');
  });

  it('UNTERMINATED: an open fence is content to the end of the body, not an error', () => {
    const t = snap.tickets.UNTERMINATED;
    expect(t.sections.map((s) => [s.heading, s.line])).toEqual([['Intent', 7]]);
    expect(t.sections[0].lines.map((l) => l.line)).toEqual([8, 9, 10, 11]);
    expect(t.requirements).toEqual([]);
    expect(t.scenarios).toEqual([]);
  });

  it('TILDE: a ~~~ line inside a backtick gherkin fence is gherkin text', () => {
    expect(snap.tickets.TILDE.scenarios.map((s) => [s.acTag, s.line])).toEqual([['ac-1', 13]]);
  });

  it('NOREQ: a ticket without ## Requirements has no requirements and no finding', () => {
    const t = snap.tickets.NOREQ;
    expect(t.sections.map((s) => s.heading)).toEqual(['Intent']);
    expect(t.requirements).toEqual([]);
    expect(t.scenarios).toEqual([]);
  });
});
