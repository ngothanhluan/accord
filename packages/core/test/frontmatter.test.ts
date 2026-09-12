// D-31..D-35, D-38: every frontmatter and config.yml failure class pinned with an exact file and line.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import type { Finding, RepoSnapshot } from '../src/index.js';
import { loadConfig } from '../src/load/config.js';
import { normaliseText, splitFrontmatter } from '../src/load/frontmatter.js';
import { readFixture, variants } from './helpers/fixture.js';

const BOM = String.fromCharCode(0xfeff);

const has = (errors: Finding[], file: string, rule: string, line: number, pointer?: string): boolean =>
  errors.some((e) => e.file === file && e.rule === rule && e.line === line && e.pointer === pointer);

const forFile = (errors: Finding[], file: string): Finding[] => errors.filter((e) => e.file === file);

describe('ticket frontmatter errors (D-32, D-33)', () => {
  let snap: RepoSnapshot;
  const T = (stem: string) => 'accord/tickets/' + stem + '.md';
  beforeAll(() => {
    snap = loadSnapshot(readFixture('frontmatter-errors'));
  });

  it('every broken ticket still has an entry keyed by its file stem (D-32)', () => {
    expect(Object.keys(snap.tickets).sort()).toEqual([
      'EMPTY',
      'EMPTYFM',
      'MISMATCH',
      'NOFM',
      'NOTMAP',
      'SCHEMA',
      'SYNTAX',
      'TYPING',
      'UNTERMINATED',
    ]);
  });

  it('NOFM: no block is reported at line 1 and the body still parses', () => {
    expect(forFile(snap.errors, T('NOFM'))).toHaveLength(1);
    expect(has(snap.errors, T('NOFM'), 'load.frontmatter-missing', 1)).toBe(true);
    expect(snap.tickets.NOFM.frontmatter).toBeUndefined();
    expect(snap.tickets.NOFM.sections[0]).toMatchObject({ heading: 'Intent', line: 1 });
  });

  it('UNTERMINATED: an unclosed block counts as no frontmatter; the whole text is the body', () => {
    expect(forFile(snap.errors, T('UNTERMINATED'))).toHaveLength(1);
    expect(has(snap.errors, T('UNTERMINATED'), 'load.frontmatter-missing', 1)).toBe(true);
    expect(snap.tickets.UNTERMINATED.frontmatter).toBeUndefined();
    expect(snap.tickets.UNTERMINATED.sections[0]).toMatchObject({ heading: 'Intent', line: 4 });
  });

  it('SYNTAX: a duplicate key is one load.yaml-syntax finding at the line yaml reports plus the --- line', () => {
    const found = forFile(snap.errors, T('SYNTAX'));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: 'load.yaml-syntax', line: 4 });
    expect(snap.tickets.SYNTAX.frontmatter).toBeUndefined();
  });

  it('NOTMAP: a sequence document is load.yaml-not-map at line 2', () => {
    expect(forFile(snap.errors, T('NOTMAP'))).toHaveLength(1);
    expect(has(snap.errors, T('NOTMAP'), 'load.yaml-not-map', 2)).toBe(true);
    expect(snap.tickets.NOTMAP.frontmatter).toBeUndefined();
  });

  it('EMPTYFM: an empty block is load.yaml-not-map at line 2; the body still parses', () => {
    expect(forFile(snap.errors, T('EMPTYFM'))).toHaveLength(1);
    expect(has(snap.errors, T('EMPTYFM'), 'load.yaml-not-map', 2)).toBe(true);
    expect(snap.tickets.EMPTYFM.frontmatter).toBeUndefined();
    expect(snap.tickets.EMPTYFM.sections[0]).toMatchObject({ heading: 'Intent', line: 4 });
  });

  it('SCHEMA: five schema findings at the key or value line; no partial frontmatter; body survives (D-35)', () => {
    const f = T('SCHEMA');
    expect(forFile(snap.errors, f)).toHaveLength(5);
    expect(has(snap.errors, f, 'schema.required', 2, '')).toBe(true); // title missing -> root -> first YAML line
    expect(has(snap.errors, f, 'schema.additionalProperties', 5, '')).toBe(true); // the `owner` key
    expect(has(snap.errors, f, 'schema.enum', 3, '/type')).toBe(true);
    expect(has(snap.errors, f, 'schema.type', 7, '/assumptions/0/confirmed')).toBe(true); // `confirmed: no` stays a string
    expect(has(snap.errors, f, 'schema.pattern', 9, '/verified/0')).toBe(true);
    expect(snap.tickets.SCHEMA.frontmatter).toBeUndefined();
    expect(snap.tickets.SCHEMA.sections[0]).toMatchObject({ heading: 'Intent', line: 12 });
  });

  it('TYPING: 007, 0x1F, 0123, 1e3, and 2026-01-01 stay strings (CORE-02, PITFALLS §8)', () => {
    expect(forFile(snap.errors, T('TYPING'))).toEqual([]);
    expect(snap.tickets.TYPING.frontmatter?.title).toBe('007');
    expect(snap.tickets.TYPING.frontmatter?.tracker).toEqual({
      hex: '0x1F',
      oct: '0123',
      exp: '1e3',
      date: '2026-01-01',
    });
  });

  it('MISMATCH: an id that differs from the file name is kept verbatim with no finding (D-34)', () => {
    expect(forFile(snap.errors, T('MISMATCH'))).toEqual([]);
    expect(snap.tickets.MISMATCH.frontmatter?.id).toBe('OTHER');
  });

  it('EMPTY: a zero-byte file is load.frontmatter-missing at line 1 with empty sections (FMT-08 empty edge)', () => {
    expect(forFile(snap.errors, T('EMPTY'))).toHaveLength(1);
    expect(has(snap.errors, T('EMPTY'), 'load.frontmatter-missing', 1)).toBe(true);
    expect(snap.tickets.EMPTY).toMatchObject({ sections: [], requirements: [], scenarios: [] });
    expect(snap.tickets.EMPTY.frontmatter).toBeUndefined();
  });

  it('BOM+CRLF input produces the same findings as LF and is never reported (D-38)', () => {
    const v = variants(readFixture('frontmatter-errors'));
    expect(loadSnapshot(v.bomCrlf).errors).toEqual(snap.errors);
  });
});

describe('splitFrontmatter / normaliseText', () => {
  it('bodyOffset counts both --- lines: 17 for LOGIN-1, 0 when there is no block', () => {
    const login = readFixture('valid-build').files['accord/tickets/LOGIN-1.md'];
    expect(splitFrontmatter(login).bodyOffset).toBe(17);
    expect(splitFrontmatter('## Intent\n')).toEqual({ yaml: null, body: '## Intent\n', bodyOffset: 0 });
  });

  it('strips only a leading BOM; a BOM later in the text is kept', () => {
    expect(normaliseText(BOM + 'abc')).toBe('abc');
    expect(normaliseText('abcde' + BOM + 'f')).toBe('abcde' + BOM + 'f');
    expect(normaliseText(BOM + BOM + 'a')).toBe(BOM + 'a');
  });

  it('turns CRLF into LF and leaves a lone CR alone', () => {
    expect(normaliseText('a\r\nb\r\n')).toBe('a\nb\n');
    expect(normaliseText('a\rb\n')).toBe('a\rb\n');
  });
});

describe('config.yml (D-31)', () => {
  const CONFIG = 'accord/config.yml';

  it('missing: config is undefined and load.config-missing has no line; tickets still load', () => {
    const snap = loadSnapshot(readFixture('no-config'));
    expect(snap.config).toBeUndefined();
    expect(snap.errors).toEqual([{ file: CONFIG, rule: 'load.config-missing', reason: expect.any(String) }]);
    expect(snap.tickets.ONLY.frontmatter?.id).toBe('ONLY');
  });

  it('invalid: config is undefined and every schema finding names the file and its line (no --- offset)', () => {
    const snap = loadSnapshot(readFixture('bad-config'));
    expect(snap.config).toBeUndefined();
    expect(snap.errors.every((e) => e.file === CONFIG)).toBe(true);
    expect(snap.errors).toHaveLength(6);
    expect(has(snap.errors, CONFIG, 'schema.additionalProperties', 9, '')).toBe(true); // sprint
    expect(has(snap.errors, CONFIG, 'schema.enum', 2, '/profile')).toBe(true);
    expect(has(snap.errors, CONFIG, 'schema.required', 3, '/tracker')).toBe(true); // repo missing -> parent key line
    expect(has(snap.errors, CONFIG, 'schema.if', 3, '/tracker')).toBe(true); // ajv wrapper, kept as in Phase 1
    expect(has(snap.errors, CONFIG, 'schema.const', 7, '/roles/0')).toBe(true);
    expect(has(snap.errors, CONFIG, 'schema.contains', 7, '/roles')).toBe(true);
  });

  it('unparsable: one load.yaml-syntax at the line yaml reports; config is undefined', () => {
    const snap = loadSnapshot(readFixture('config-syntax'));
    expect(snap.config).toBeUndefined();
    const found = forFile(snap.errors, CONFIG);
    expect(found).toHaveLength(1);
    // `accord: [` is closed by end of input, which yaml places on line 2 (past the file's single line).
    expect(found[0]).toMatchObject({ rule: 'load.yaml-syntax', line: 2 });
  });

  it('empty: a zero-byte config.yml is load.yaml-not-map at line 1 (FMT-08 empty edge)', () => {
    const r = loadConfig(CONFIG, '');
    expect(r.config).toBeUndefined();
    expect(r.findings).toEqual([{ file: CONFIG, line: 1, rule: 'load.yaml-not-map', reason: expect.any(String) }]);
  });
});
