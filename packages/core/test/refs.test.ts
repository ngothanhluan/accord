// D-82 to D-85: the one extraction-and-resolution rule GATE-04 and GATE-10 share, pinned here so every
// later change to the extension set, the segment-boundary suffix, or the normaliser moves a case in this
// file rather than a golden. The two CONTEXT non-English notes are Test 7.
import { describe, expect, it } from 'vitest';
import { candidates, noteBlocks, normalise, resolves, stripRefs, unresolvedRefs } from '../src/gate/refs.js';
import { scan } from '../src/load/sections.js';
import type { RepoSnapshot, Ticket } from '../src/index.js';

const body = (...lines: string[]) => lines.join('\n');

/** A snapshot carrying nothing but the two fields resolution reads. */
const snap = (tree: string[], tests?: Record<string, 'passed' | 'failed' | 'skipped'>): RepoSnapshot => ({
  tickets: {},
  verifications: {},
  tree,
  errors: [],
  files: {},
  ...(tests === undefined ? {} : { tests }),
});

const TREE = ['README.md', 'src/auth/login.ts', 'test/login.spec.ts'];
const S = snap(TREE, { 'test/login.spec.ts#ok1': 'passed' });

/** A ticket with only the field noteBlocks reads, built through the real section scanner. */
const ticket = (text: string): Ticket => ({
  id: 'T',
  file: 'accord/tickets/T.md',
  sections: scan(text, 0).sections,
  requirements: [],
  scenarios: [],
});

describe('candidates (D-82 extraction)', () => {
  it('picks the file out of a command and ignores npm, test, and --', () => {
    expect(candidates('npm test -- login.spec.ts', S)).toEqual(['login.spec.ts']);
  });

  it('picks a slashed path out of prose', () => {
    expect(candidates('test/login.spec.ts covers the happy path', S)).toEqual(['test/login.spec.ts']);
  });

  it('strips surrounding backticks and a trailing comma', () => {
    expect(candidates('see `src/auth/login.ts`, line 12', S)).toEqual(['src/auth/login.ts']);
  });

  it('strips an editor-style :line and :line:col suffix', () => {
    expect(candidates('src/auth/login.ts:42', S)).toEqual(['src/auth/login.ts']);
    expect(candidates('src/auth/login.ts:42:7', S)).toEqual(['src/auth/login.ts']);
    expect(candidates('src/auth/login.ts:12-14', S)).toEqual(['src/auth/login.ts']);
  });

  it('never accepts an identifier-shaped word (D-84)', () => {
    expect(candidates('AuthService hashPassword', S)).toEqual([]);
  });

  it('accepts a token with a slash and no extension', () => {
    expect(candidates('a/b', S)).toEqual(['a/b']);
  });

  it('accepts a key of snapshot.tests that is neither slashed nor extensioned', () => {
    expect(candidates('ok-1 ran', snap([], { 'ok-1': 'passed' }))).toEqual(['ok-1']);
  });

  it('de-duplicates, keeping first-appearance order', () => {
    expect(candidates('src/nope.ts then test/login.spec.ts then src/nope.ts', S)).toEqual([
      'src/nope.ts',
      'test/login.spec.ts',
    ]);
  });
});

describe('resolves (D-82 segment-boundary resolution)', () => {
  it('resolves an exact tree path', () => {
    expect(resolves('test/login.spec.ts', S)).toBe(true);
  });

  it('resolves a segment-boundary suffix', () => {
    expect(resolves('login.spec.ts', S)).toBe(true);
  });

  it('refuses a suffix that does not begin at a segment boundary (T-04-15)', () => {
    expect(resolves('ogin.spec.ts', S)).toBe(false);
  });

  it('refuses a longer path that merely ends with a tree path', () => {
    expect(resolves('xtest/login.spec.ts', S)).toBe(false);
  });

  it('compares code points, never case-folded', () => {
    expect(resolves('Test/login.spec.ts', S)).toBe(false);
  });

  it('resolves a key of snapshot.tests that is not in the tree', () => {
    expect(resolves('test/login.spec.ts#ok1', S)).toBe(true);
  });

  it('never resolves through the prototype chain (T-04-17)', () => {
    expect(resolves('toString', S)).toBe(false);
    expect(resolves('constructor', S)).toBe(false);
  });

  it('resolves a backslash path, because the candidate goes through normaliseKey', () => {
    expect(resolves('.\\src\\auth\\login.ts', S)).toBe(true);
  });

  it('never resolves a traversal or absolute path (T-04-13)', () => {
    expect(resolves('../../etc/passwd', S)).toBe(false);
    expect(resolves('/etc/passwd', S)).toBe(false);
  });
});

describe('unresolvedRefs', () => {
  it('returns only the non-resolving candidate', () => {
    expect(unresolvedRefs('test/login.spec.ts and src/nope.ts', S)).toEqual(['src/nope.ts']);
  });

  it('returns nothing when there is no candidate at all', () => {
    expect(unresolvedRefs('run npm test', S)).toEqual([]);
  });

  it('raises one entry for a token repeated twice (D-83)', () => {
    expect(unresolvedRefs('src/nope.ts and src/nope.ts', S)).toEqual(['src/nope.ts']);
  });
});

describe('stripRefs', () => {
  it('removes the whole token, surrounding punctuation with it', () => {
    expect(normalise(stripRefs('see `src/auth/login.ts`, line 12', S))).toBe('see line 12');
  });

  it('leaves a non-resolving token in place', () => {
    expect(stripRefs('src/nope.ts is missing', S)).toBe('src/nope.ts is missing');
  });

  it('leaves the prose of an evidence line behind', () => {
    expect(normalise(stripRefs('test/login.spec.ts covers the happy path', S))).toBe('covers the happy path');
  });
});

describe('normalise (D-85 encoding)', () => {
  it('risk:parsing lower-cases and keeps French diacritics', () => {
    expect(normalise('Où')).toBe('où');
    expect(normalise('Où')).not.toBe('ou');
  });

  it('turns punctuation and symbols into a space and collapses whitespace', () => {
    expect(normalise('  a,  b—c  (d)  ')).toBe('a b c d');
  });

  it('returns the empty string for punctuation only', () => {
    expect(normalise('... --- !!!')).toBe('');
  });
});

describe('noteBlocks', () => {
  const T = ticket(
    body(
      '## Plan',
      '- Build the login screen @ac-1',
      '',
      '## Verification notes',
      '### @ac-1',
      'src/auth/login.ts opens a new session. <!-- skip this -->',
      'second line',
      '',
      '### @ac-2',
      'src/auth/login.ts stops before creating a session.',
    ),
  );

  it('keys each block by its tag, carrying the 1-based heading line', () => {
    expect(Object.keys(noteBlocks(T))).toEqual(['ac-1', 'ac-2']);
    expect(noteBlocks(T)['ac-1'].line).toBe(5);
    expect(noteBlocks(T)['ac-2'].line).toBe(9);
  });

  it('carries the lines up to the next ### with HTML comments stripped', () => {
    expect(noteBlocks(T)['ac-1'].text).toBe('src/auth/login.ts opens a new session. \nsecond line');
  });

  it('returns an empty record when there is no ## Verification notes section', () => {
    expect(noteBlocks(ticket(body('## Intent', 'intent only')))).toEqual({});
  });

  it('returns an orphan block; a tag matching no scenario is lint.note-orphan business', () => {
    const orphan = ticket(body('## Verification notes', '### @ac-3', 'a note'));
    expect(Object.keys(noteBlocks(orphan))).toEqual(['ac-3']);
  });

  it('keeps the first of two blocks carrying the same tag (D-40)', () => {
    const dupe = ticket(body('## Verification notes', '### @ac-1', 'the first', '### @ac-1', 'the second'));
    expect(noteBlocks(dupe)['ac-1'].text).toBe('the first');
  });
});

describe('the two CONTEXT non-English cases (D-85)', () => {
  // The scenario the note is about, exactly as 04-CONTEXT states it.
  const name = 'Connexion réussie';
  const steps = ['il envoie un e-mail et un mot de passe valides', 'il voit le tableau de bord'];
  const scenario = normalise(name + ' ' + steps.join(' '));
  const remainder = (note: string) => normalise(stripRefs(note, S));

  it('a note that says something of its own passes', () => {
    const r = remainder('src/auth/login.ts renvoie 401 avant le hachage');
    expect(r).toBe('renvoie 401 avant le hachage');
    expect(scenario.includes(r)).toBe(false);
  });

  it('the same scenario pasted back with a path appended fails', () => {
    const r = remainder(name + ' ' + steps.join(' ') + ' src/auth/login.ts');
    expect(r).not.toBe('');
    expect(scenario.includes(r)).toBe(true);
  });

  it('a note that quotes the scenario and then explains passes (GATE-10 adjacency)', () => {
    const r = remainder(name + ' ' + steps.join(' ') + ' mais la session expire après 15 minutes');
    expect(scenario.includes(r)).toBe(false);
  });

  it('one character decides both ways, and length never enters it (GATE-10 boundary)', () => {
    expect(scenario.includes(remainder('src/auth/login.ts z'))).toBe(false);
    expect(scenario.includes(remainder('src/auth/login.ts x'))).toBe(true);
  });
});

describe('linear time (T-04-16)', () => {
  it('resolves a 200 kB evidence text against a 5 000-path tree in under 2 s', () => {
    const tree = Array.from({ length: 5000 }, (_, i) => `src/mod${i}/file${i}.ts`);
    const line = 'ran src/mod4999/file4999.ts and src/gone/missing.ts after a very long line of ordinary prose\n';
    const text = line.repeat(Math.ceil(200_000 / line.length));
    expect(text.length).toBeGreaterThan(200_000);
    const big = snap(tree);
    const started = performance.now();
    expect(unresolvedRefs(text, big)).toEqual(['src/gone/missing.ts']);
    expect(normalise(stripRefs(text, big))).not.toBe('');
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

it('risk:parsing a dot extension word in prose is not a candidate', () => {
  expect(candidates('the .md file and the .ts one', snap([]))).toEqual([]);
  expect(candidates('.eslintrc.json', snap([]))).toEqual(['.eslintrc.json']);
});
it('risk:parsing a run of three dots before a path is stripped', () => {
  expect(candidates('...packages/x.ts', snap([]))).toEqual(['packages/x.ts']);
});
it('risk:parsing a dot before a quote is stripped with the quote', () => {
  expect(candidates('."packages/x.ts"', snap([]))).toEqual(['packages/x.ts']);
});
it('risk:parsing a backslash parent path is named as written', () => {
  expect(unresolvedRefs('..\\x.md', snap([]))).toEqual(['..\\x.md']);
});
it('risk:parsing a dotted directory in the tree draws no warning', () => {
  expect(unresolvedRefs('config/app.d and src/nope.ts', snap(['config/app.d/x.conf']))).toEqual(['src/nope.ts']);
});
it('risk:parsing a line anchor on a real file draws no warning and a heading anchor still does', () => {
  expect(
    unresolvedRefs('src/auth/login.ts#L12 src/auth/login.ts#L3-L9 src/auth/login.ts#intro src/nope.ts#L3', S),
  ).toEqual(['src/auth/login.ts#intro', 'src/nope.ts#L3']);
});
it('risk:parsing a URL with a scheme draws no warning', () => {
  expect(unresolvedRefs('https://example.com/docs/x.md', snap([]))).toEqual([]);
  expect(unresolvedRefs('example.com/docs/x.md', snap([]))).toEqual(['example.com/docs/x.md']);
});
