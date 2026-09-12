// D-42 evidence blocks, D-32/D-40 applied to records, D-37 folder convention: every shape pinned with exact lines.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import type { Finding, RepoSnapshot } from '../src/index.js';
import { parseVerification } from '../src/load/verification.js';
import { readFixture } from './helpers/fixture.js';

const A = 'accord/tickets/A/verification.md';
const B = 'accord/tickets/B/verification.md';
const ORPHAN = 'accord/tickets/ORPHAN/verification.md';

const where = (errors: Finding[], file: string, rule: string): Finding[] =>
  errors.filter((e) => e.file === file && e.rule === rule);

let snap: RepoSnapshot;
beforeAll(() => {
  snap = loadSnapshot(readFixture('verification-edges'));
});

describe('Result and Evidence edges on one record (D-42)', () => {
  it('a valid block keeps result and multi-line evidence with comments stripped and lines trimmed', () => {
    expect(snap.verifications.A.blocks[0]).toEqual({
      acTag: 'ac-1',
      name: 'Một',
      line: 7,
      result: 'pass',
      evidence: 'dòng một\ndòng hai\ndòng ba',
    });
  });

  it('a block without Result: is load.result-invalid at the heading line; evidence is still kept', () => {
    const block = snap.verifications.A.blocks[1];
    expect(block).toEqual({ acTag: 'ac-2', name: 'Hai', line: 16, evidence: 'chạy npm test' });
    expect(block).not.toHaveProperty('result');
    expect(where(snap.errors, A, 'load.result-invalid').map((e) => e.line)).toContain(16);
  });

  it('Result: PASS (wrong case) is load.result-invalid at the Result: line; result is absent', () => {
    const block = snap.verifications.A.blocks[2];
    expect(block).toEqual({ acTag: 'ac-3', name: 'Ba', line: 20, evidence: '' });
    expect(block).not.toHaveProperty('result');
    expect(where(snap.errors, A, 'load.result-invalid').map((e) => e.line)).toEqual([16, 22]);
  });

  it('Result: blocked with no Evidence: label gives evidence "" and no finding', () => {
    expect(snap.verifications.A.blocks[3]).toEqual({ acTag: 'ac-4', name: 'Bốn', line: 24, result: 'blocked', evidence: '' });
  });

  it('a non-tag heading is no block; a duplicated tag is load.heading-duplicate at the second heading (D-40)', () => {
    expect(snap.verifications.A.blocks.map((b) => b.acTag)).toEqual(['ac-1', 'ac-2', 'ac-3', 'ac-4']);
    expect(snap.verifications.A.blocks[0].result).toBe('pass'); // the first block is kept, not the `fail` one
    expect(where(snap.errors, A, 'load.heading-duplicate')).toEqual([
      { file: A, line: 31, rule: 'load.heading-duplicate', reason: 'duplicate heading "## @ac-1 Một lần nữa"; the first occurrence is used' },
    ]);
    expect(snap.errors.filter((e) => e.file === A)).toHaveLength(3);
  });

  it('a record with invalid frontmatter keeps its blocks and has frontmatter absent (D-32)', () => {
    expect(snap.verifications.B).not.toHaveProperty('frontmatter');
    expect(snap.verifications.B.blocks).toHaveLength(1);
    expect(snap.verifications.B.blocks[0].result).toBe('pass');
    expect(snap.errors.filter((e) => e.file === B)).toEqual([
      { file: B, line: 3, pointer: '/commit', rule: 'schema.pattern', reason: 'must match pattern "^[0-9a-f]{7,40}$"' },
    ]);
  });
});

describe('parseVerification on inline records (flagged assumptions)', () => {
  const head = '---\nticket: X\ncommit: 1234567\nreviewed_on: 2026-09-02\n---\n\n';

  it('trailing blank lines after a multi-line Evidence: are trimmed', () => {
    const r = parseVerification('X', 'accord/tickets/X/verification.md', head + '## @ac-1 X\n\nResult: pass\nEvidence: a\nb\nc\n\n\n\n');
    expect(r.findings).toEqual([]);
    expect(r.verification.blocks[0].evidence).toBe('a\nb\nc');
  });

  it('Result: after Evidence: still counts as the result; the evidence text runs to the block end', () => {
    const r = parseVerification('X', 'accord/tickets/X/verification.md', head + '## @ac-1 X\n\nEvidence: a\nResult: pass\n');
    expect(r.findings).toEqual([]);
    expect(r.verification.blocks[0]).toEqual({ acTag: 'ac-1', name: 'X', line: 7, result: 'pass', evidence: 'a\nResult: pass' });
  });
});

describe('folder convention (D-37)', () => {
  it('only tickets/*.md are tickets and only tickets/<id>/verification.md are records', () => {
    expect(Object.keys(snap.tickets).sort()).toEqual(['A', 'B', 'C']);
    expect(Object.keys(snap.verifications).sort()).toEqual(['A', 'B', 'C', 'ORPHAN']);
  });

  it('a record without a ticket is exactly one load.verification-orphan with no line; the record is still loaded', () => {
    const orphans = snap.errors.filter((e) => e.rule === 'load.verification-orphan');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].file).toBe(ORPHAN);
    expect(orphans[0]).not.toHaveProperty('line');
    expect(snap.verifications.ORPHAN.blocks[0].result).toBe('pass');
  });

  it('a record whose ticket exists but is broken is not an orphan (D-32)', () => {
    expect(snap.tickets.C).not.toHaveProperty('frontmatter');
    expect(where(snap.errors, 'accord/tickets/C.md', 'load.frontmatter-missing').map((e) => e.line)).toEqual([1]);
    expect(snap.errors.filter((e) => e.file.startsWith('accord/tickets/C/'))).toEqual([]);
  });

  it('stray files are in tree but produce no entry and no finding (D-30, D-37)', () => {
    const stray = ['accord/tickets/A/plan.md', 'accord/tickets/notes.txt', 'accord/assets/A/prototype.html'];
    for (const p of stray) expect(snap.tree).toContain(p);
    for (const e of snap.errors) expect(e.file).not.toMatch(/plan\.md$|notes\.txt$|prototype\.html$/);
  });
});
