// Phase 11 plan 05 (11-ac-5, D-05, Lens Ruling): `accord lint` reports a malformed lens file before any review silently skips it. Each finding names the file, the line where it can and the fix.
import { describe, expect, it } from 'vitest';
import { LENS_DIR, LOCKED, lintSnapshot, loadSnapshot, parseLens } from '../src/index.js';

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

/** One lens file with an entry under `paths:` written as a block list, so the entry sits on its own line (file line 3). */
const withEntry = (entry: string) => lens('db', ['paths:', `  - ${entry}`]);

describe('lint.lens-file: every other malformed lens', () => {
  it('risk:parsing an on_finding outside block, ask and warn is an error at the line of the key, naming the three modes (11-ac-5, D-05 lens Ruling)', () => {
    const found = lensFindings(lens('db', ['paths: [src/db/]', 'on_finding: maybe']));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: RULE, level: 'error', file: 'accord/lenses/db.md', line: 3 });
    expect(found[0].reason).toContain('on_finding');
    expect(found[0].reason).toContain('block, ask or warn');
  });

  it('risk:parsing a lens name outside ^[a-z0-9][a-z0-9-]*$ is an error naming the file and the pattern (11-ac-5, D-05 lens Ruling)', () => {
    for (const name of ['DB', 'my_lens', '-db', 'a b']) {
      const found = lensFindings(lens(name, ['on_finding: warn']));
      expect(found, name).toHaveLength(1);
      expect(found[0], name).toMatchObject({ rule: RULE, level: 'error', file: `accord/lenses/${name}.md` });
      expect(found[0].reason, name).toContain('^[a-z0-9][a-z0-9-]*$');
    }
    for (const name of ['db', 'a11y', '9lives', 'data-model']) expect(lensFindings(lens(name, ['on_finding: warn'])), name).toEqual([]);
  });

  it("risk:parsing a lens named for one of accord's own review lenses is an error naming the built-in names (11-ac-5, D-05 lens Ruling)", () => {
    for (const name of ['intent', 'quality', 'security', 'integration', 'both', 'ui']) {
      const found = lensFindings(lens(name, ['on_finding: warn']));
      expect(found, name).toHaveLength(1);
      expect(found[0].file).toBe(`accord/lenses/${name}.md`);
      expect(found[0].reason).toContain('intent, quality, security, integration, both, ui');
    }
  });

  it('risk:security a path entry with a backslash, a leading / or ./, or a .. segment is an error at its own line, naming the entry and the fix (11-ac-5, T-11-10, D-05 lens Ruling)', () => {
    const cases: [string, string][] = [
      ['src\\db\\', 'backslash'],
      ['/src/db/', 'starts with / or ./'],
      ['./src/db/', 'starts with / or ./'],
      ['src/../db/', '..'],
      ['tools:../db/', '..'],
      ['tools:src\\db\\', 'backslash'],
    ];
    for (const [entry, why] of cases) {
      const found = lensFindings(withEntry(entry));
      expect(found, entry).toHaveLength(1);
      expect(found[0], entry).toMatchObject({ rule: RULE, level: 'error', file: 'accord/lenses/db.md', line: 3 });
      expect(found[0].reason, entry).toContain(`"${entry}"`);
      expect(found[0].reason, entry).toContain(why);
      expect(found[0].reason, entry).toContain('write ');
    }
  });

  it('risk:parsing a path entry holding a glob character is an error naming the entry and that an entry ending in / is a folder (11-ac-5, D-05 lens Ruling)', () => {
    for (const entry of ['src/*.ts', 'src/db?', 'src/[a]/']) {
      const found = lensFindings(withEntry(`"${entry}"`));
      expect(found, entry).toHaveLength(1);
      expect(found[0], entry).toMatchObject({ rule: RULE, file: 'accord/lenses/db.md', line: 3 });
      expect(found[0].reason, entry).toContain(`"${entry}"`);
      expect(found[0].reason, entry).toContain('an entry ending in / is a folder');
    }
  });

  it('risk:regression a path entry with no trailing / that names a folder of the tree is an error at its line, naming the entry and the entry to write; a file, a folder with the slash and another repository are not (WR-03, 11-ac-5, D-05)', () => {
    const tree = ['src/db/schema.sql', 'src/db/x.ts', 'migrations/001.sql', 'schema.sql', 'accord/lenses/db.md'];
    const found = (entry: string) => {
      const files = lens('db', ['paths:', `  - ${entry}`]);
      return lintSnapshot(loadSnapshot({ files, tree: [...tree, ...Object.keys(files)] })).findings.filter((f) => f.rule === RULE);
    };
    for (const [entry, fix] of [['src/db', 'src/db/'], ['migrations', 'migrations/'], ['SRC/DB', 'SRC/DB/']]) {
      const out = found(entry);
      expect(out, entry).toHaveLength(1);
      expect(out[0], entry).toMatchObject({ rule: RULE, level: 'error', file: 'accord/lenses/db.md', line: 3 });
      expect(out[0].reason, entry).toContain(`"${entry}"`);
      expect(out[0].reason, entry).toContain(`write ${fix}`);
    }
    // the entry the matcher reads as a folder, a file of the tree, a name with no such folder, and an entry of another repository (whose tree this snapshot does not hold)
    for (const entry of ['src/db/', 'schema.sql', 'src/db/x.ts', 'nothing-here', 'tools:src/db']) expect(found(entry), entry).toEqual([]);
  });

  it('risk:security a lens with a bad path entry runs on every package, so it is never silently skipped: its paths are not kept (11-ac-5, T-11-10, D-05 lens Ruling)', () => {
    const text = (entries: string[]) => ['---', 'paths:', ...entries.map((e) => `  - ${e}`), '---', '', '- A check.', ''].join('\n');
    const bad = parseLens('accord/lenses/db.md', text(['src/db/', '../db/']));
    expect(bad.paths).toBeUndefined();
    expect(bad.problems).toHaveLength(1);
    expect(parseLens('accord/lenses/db.md', text(['src/db/', 'schema.sql'])).paths).toEqual(['src/db/', 'schema.sql']);
  });

  it('risk:parsing a body line that starts with # is an error at its line, so a lens never opens a heading inside the package (11-ac-5, T-11-12, Ruling R8)', () => {
    const found = lensFindings(lens('db', ['on_finding: warn'], '- First check.\n## Extra\n  # indented\n- Last.\n'));
    expect(found.map((f) => [f.file, f.line])).toEqual([
      ['accord/lenses/db.md', 6],
      ['accord/lenses/db.md', 7],
    ]);
    for (const f of found) {
      expect(f.level).toBe('error');
      expect(f.reason).toContain('#');
      expect(f.reason).toContain('list item');
    }
    // a # inside a line is no heading
    expect(lensFindings(lens('db', ['on_finding: warn'], '- Closes issue #12.\n'))).toEqual([]);
  });

  it('risk:parsing an empty body is an error naming the file, with or without a frontmatter block (11-ac-5, D-05 lens Ruling)', () => {
    const cases = [lens('db', ['paths: [src/db/]'], ''), lens('db', [], '\n\n'), { 'accord/lenses/db.md': '' }, { 'accord/lenses/db.md': '---\npaths: [src/db/]\n---\n' }];
    for (const files of cases) {
      const found = lensFindings(files);
      expect(found, JSON.stringify(files)).toHaveLength(1);
      expect(found[0]).toMatchObject({ rule: RULE, level: 'error', file: 'accord/lenses/db.md' });
      expect(found[0].reason).toContain('empty');
      expect(found[0].reason).toContain('checklist');
    }
  });

  it('risk:parsing a file that is no lens (a file of another type, a file in a subfolder) is named as ignored, once each (11-ac-5, D-05 lens Ruling)', () => {
    const files = { ...lens('db', ['on_finding: warn']), 'accord/lenses/notes.txt': 'a note', 'accord/lenses/sub/x.md': '- A check.\n' };
    const found = lensFindings(files);
    expect(found.map((f) => f.file)).toEqual(['accord/lenses/notes.txt', 'accord/lenses/sub/x.md']);
    for (const f of found) {
      expect(f.level).toBe('error');
      expect(f.reason).toContain('ignored');
      expect(f.reason).toContain('<name>.md');
    }
    // a .gitkeep that keeps the empty folder in git is no mistake (Ruling R9)
    expect(lensFindings({ 'accord/lenses/.gitkeep': '' })).toEqual([]);
    // a path that only looks like the folder gives none
    expect(lensFindings({ ...lens('db', ['on_finding: warn']), 'accord/lensesx/a.txt': 'x', 'docs/lenses/a.txt': 'x' })).toEqual([]);
  });
});
