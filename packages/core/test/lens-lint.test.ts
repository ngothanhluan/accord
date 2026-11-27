// Phase 11 plan 05 (11-ac-5, D-05, Lens Ruling): `accord lint` reports a malformed lens file before any review silently skips it. Each finding names the file, the line where it can and the fix.
import { describe, expect, it } from 'vitest';
import { LENS_DIR, LOCKED, lintSnapshot, loadSnapshot } from '../src/index.js';

const RULE = 'lint.lens-file';

/** A repository with the given files under `accord/lenses/` (and nothing else), all of them in the tree. */
const withLenses = (files: Record<string, string>) => loadSnapshot({ files, tree: Object.keys(files) });
const lensFindings = (files: Record<string, string>) => lintSnapshot(withLenses(files)).findings.filter((f) => f.rule === RULE);
const lens = (name: string, frontmatter: string[], body = '- A check.\n') => ({ [`${LENS_DIR}${name}.md`]: ['---', ...frontmatter, '---', '', body].join('\n') });

describe('lint.lens-file', () => {
  it('risk:parsing an unknown frontmatter key of a lens file is an error naming the file, the line of the key and the keys a lens may hold (11-ac-5, D-05 lens Ruling)', () => {
    const found = lensFindings(lens('db', ['paths: [src/db/]', 'trigger: src/']));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: RULE, level: 'error', file: 'accord/lenses/db.md', line: 3 });
    expect(found[0].reason).toContain('trigger');
    expect(found[0].reason).toContain('paths');
    expect(found[0].reason).toContain('on_finding');
  });

  it('risk:regression a well-formed lens file and a repository with no accord/lenses folder give no lens-file finding (11-ac-5, D-05 lens Ruling)', () => {
    expect(lensFindings(lens('db', ['paths: [src/db/, schema.sql, tools:src/]', 'on_finding: block']))).toEqual([]);
    expect(lensFindings(lens('everywhere', ['on_finding: warn']))).toEqual([]);
    expect(lensFindings({ 'accord/lenses/plain.md': '- A check with no frontmatter.\n' })).toEqual([]);
    expect(lensFindings({})).toEqual([]);
  });

  it('risk:security lint.lens-file is LOCKED: a malformed lens is a review check silently lost (11-ac-5, D-05 lens Ruling)', () => {
    expect(LOCKED).toContain(RULE);
  });
});
