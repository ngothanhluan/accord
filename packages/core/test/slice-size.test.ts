// Phase 15 D-06, SC-3: the size of one slice counts every line a reviewer reads (code, tests, docs and skills), lines added plus deleted, and leaves out ticket records and what the host excludes.
import { describe, expect, it } from 'vitest';
import { sizeKind, sliceSizeOf, sliceSplit } from '../src/index.js';

const line = (path: string, added: number, deleted = 0) => ({ path, added, deleted });
const none = (): boolean => false;

describe('sliceSizeOf', () => {
  it('risk:parsing a path is code, a test or docs by where it sits and what it is named (D-06)', () => {
    expect(sizeKind('src/a.ts')).toBe('code');
    expect(sizeKind('packages/x/test/a.test.ts')).toBe('test');
    expect(sizeKind('packages/x/tests/helper.ts')).toBe('test');
    expect(sizeKind('src/__tests__/a.ts')).toBe('test');
    expect(sizeKind('src/a.spec.ts')).toBe('test');
    expect(sizeKind('docs/a.md')).toBe('docs');
    expect(sizeKind('docs/diagram.svg')).toBe('docs');
    expect(sizeKind('README.md')).toBe('docs');
    expect(sizeKind('packages/core/skills/accord/x.md')).toBe('docs');
    expect(sizeKind('.claude/agents/reviewer.md')).toBe('docs');
    expect(sizeKind('packages/x/agents/helper.ts')).toBe('docs');
    // a test is judged first: a fixture of Markdown under a test folder is a test, and a word that only contains "test" is not one
    expect(sizeKind('packages/x/test/fixtures/a.md')).toBe('test');
    expect(sizeKind('src/latest/a.ts')).toBe('code');
    expect(sizeKind('src/contest.ts')).toBe('code');
  });

  it('risk:parsing the total is the sum of lines added plus deleted, split into code, test and docs (D-06)', () => {
    const size = sliceSizeOf([line('src/a.ts', 100, 50), line('packages/x/test/a.test.ts', 600), line('docs/a.md', 100, 50)], none);
    expect(size).toEqual({ code: 150, test: 600, docs: 150, total: 900 });
    expect(sliceSplit(size)).toBe('code 150, test 600, docs 150');
    expect(sliceSizeOf([], none)).toEqual({ code: 0, test: 0, docs: 0, total: 0 });
  });

  it('risk:parsing ticket records are left out whatever the host says, and so is what the host excludes (D-06)', () => {
    const size = sliceSizeOf(
      [line('src/a.ts', 10), line('accord/tickets/T-1/ledger.md', 40), line('accord/tickets/T-1.md', 5), line('package-lock.json', 900), line('.claude/skills/accord/x.md', 300)],
      (path) => path === 'package-lock.json' || path === '.claude/skills/accord/x.md',
    );
    expect(size).toEqual({ code: 10, test: 0, docs: 0, total: 10 });
    // a path that only looks like a record is counted: the prefix is exact
    expect(sliceSizeOf([line('docs/accord/tickets/x.md', 7), line('accord/ticketsx/a.ts', 3)], none).total).toBe(10);
  });

  it('risk:parsing a binary file counts nothing (D-06)', () => {
    expect(sliceSizeOf([line('docs/logo.png', 0, 0), line('src/a.ts', 2)], none)).toEqual({ code: 2, test: 0, docs: 0, total: 2 });
  });
});
