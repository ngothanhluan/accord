// Phase 11 plan 04 (11-ac-5, D-04, D-05): which team lenses a package's diff names. The lens file is data a team writes; matching is the security file's path-entry matcher, so there is one matcher.
import { describe, expect, it } from 'vitest';
import { BUILT_IN_LENS_NAMES, LENS_DIR, lensMatches, lensesFor, parseLens } from '../src/index.js';

const lens = (name: string, frontmatter: string[], body = '- A check.\n') => parseLens(`${LENS_DIR}${name}.md`, ['---', ...frontmatter, '---', '', body].join('\n'));

describe('lensMatches', () => {
  it('risk:regression a folder entry matches the paths under it, ignoring letter case, and not a sibling name (11-ac-5, D-05)', () => {
    const db = lens('db', ['paths: [src/db/]']);
    expect(lensMatches(db, ['src/db/x.ts'], [])).toBe(true);
    expect(lensMatches(db, ['SRC/DB/x.ts'], [])).toBe(true);
    expect(lensMatches(db, ['src/dbx.ts'], [])).toBe(false);
    expect(lensMatches(db, ['src/ui/a.ts'], [])).toBe(false);
    expect(lensMatches(db, [], [])).toBe(false);
  });

  it('risk:regression a bare entry matches a file of that name in any folder, and an entry with a slash matches that exact path (11-ac-5, D-05)', () => {
    const bare = lens('schema', ['paths: [schema.sql]']);
    expect(lensMatches(bare, ['a/b/schema.sql'], [])).toBe(true);
    expect(lensMatches(bare, ['schema.sql'], [])).toBe(true);
    expect(lensMatches(bare, ['a/b/myschema.sql'], [])).toBe(false);
    const exact = lens('one', ['paths: [db/schema.sql]']);
    expect(lensMatches(exact, ['db/schema.sql'], [])).toBe(true);
    expect(lensMatches(exact, ['x/db/schema.sql'], [])).toBe(false);
  });

  it('risk:regression a lens with no paths matches every package, even one with no changed file (11-ac-5, D-04)', () => {
    const every = lens('every', ['on_finding: warn']);
    expect(every.paths).toBeUndefined();
    expect(lensMatches(every, [], [])).toBe(true);
    expect(lensMatches(every, ['src/a.ts'], [])).toBe(true);
  });

  it('risk:regression a <name>:<path> entry matches only the changed paths of that repository, and a plain entry never matches another repository (11-ac-5, Lens Ruling)', () => {
    const tools = lens('tools', ['paths: [tools:src/]']);
    expect(lensMatches(tools, ['src/a.ts'], [{ name: 'tools', changed: ['src/Tools.cs'] }])).toBe(true);
    expect(lensMatches(tools, ['src/a.ts'], [{ name: 'tools', changed: ['docs/x.md'] }])).toBe(false);
    expect(lensMatches(tools, ['src/a.ts'], [{ name: 'other', changed: ['src/Tools.cs'] }])).toBe(false);
    expect(lensMatches(tools, ['src/a.ts'], [])).toBe(false);
    const plain = lens('plain', ['paths: [src/]']);
    expect(lensMatches(plain, [], [{ name: 'tools', changed: ['src/Tools.cs'] }])).toBe(false);
  });
});

describe('parseLens', () => {
  it('risk:parsing a lens file reads its paths, its on_finding mode (ask when absent) and its body, and takes its name from the file stem (11-ac-5, D-05, D-06)', () => {
    const a = parseLens('accord/lenses/db.md', '---\npaths: [src/db/, schema.sql]\non_finding: warn\n---\n\n- Every query uses parameters.\n');
    expect(a).toMatchObject({ name: 'db', paths: ['src/db/', 'schema.sql'], mode: 'warn', problems: [] });
    expect(a.body).toContain('- Every query uses parameters.');
    const b = parseLens('accord/lenses/a11y.md', '---\n---\n\n- Labels.\n');
    expect(b).toMatchObject({ name: 'a11y', mode: 'ask', problems: [] });
    expect(b.paths).toBeUndefined();
    // no frontmatter block at all is a lens with no paths
    const c = parseLens('accord/lenses/plain.md', '- Just a list.\n');
    expect(c).toMatchObject({ name: 'plain', mode: 'ask', problems: [] });
    expect(c.body).toBe('- Just a list.\n');
  });

  it('risk:parsing a lens whose frontmatter does not read keeps running (no paths, mode ask) and carries its problems (11-ac-5, D-05)', () => {
    const bad = parseLens('accord/lenses/x.md', '---\non_finding: stop\npaths: []\nextra: 1\n---\n\n- A.\n');
    expect(bad.problems.length).toBeGreaterThan(0);
    expect(bad.paths).toBeUndefined();
    expect(bad.mode).toBe('ask');
  });

  it('risk:parsing the built-in lens names are the six role lenses (D-04)', () => {
    expect([...BUILT_IN_LENS_NAMES]).toEqual(['intent', 'quality', 'security', 'integration', 'both', 'ui']);
  });
});

describe('lensesFor', () => {
  const lenses = [lens('zeta', []), lens('db', ['paths: [src/db/]']), lens('alpha', ['paths: [src/ui/]'])];

  it('risk:regression lane M, L and P get the matching lenses in name order, and lane S none (11-ac-5, D-04)', () => {
    for (const lane of ['M', 'L', 'P']) {
      expect(lensesFor(lenses, { lane, changed: ['src/db/x.ts'], others: [] }).map((l) => l.name)).toEqual(['db', 'zeta']);
    }
    expect(lensesFor(lenses, { lane: 'S', changed: ['src/db/x.ts'], others: [] })).toEqual([]);
    expect(lensesFor(lenses, { lane: undefined, changed: ['src/db/x.ts'], others: [] })).toEqual([]);
    expect(lensesFor(lenses, { lane: 'M', changed: ['src/other.ts'], others: [] }).map((l) => l.name)).toEqual(['zeta']);
  });
});
