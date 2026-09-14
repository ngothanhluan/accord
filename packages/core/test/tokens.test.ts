// D-66 to D-68: token extraction, value classification, the prototype scanner, and the `Derived from:` header,
// pinned on the research probe (RESEARCH.md "Token Rule") so the heuristic's edges are visible in one file.
import { describe, expect, it } from 'vitest';
import { derivedFrom, offending, scanPrototype, tokenNames } from '../src/lint/tokens.js';

const body = (...lines: string[]) => lines.join('\n');
const known = new Set(['--color-primary', '--space-2']);

// The research tokens sample: @theme, @theme inline, :root, an attribute block, a wildcard reset, a comment.
const TOKENS_SAMPLE = body(
  '@theme {',
  '  --color-primary: #0055ff;',
  '  --spacing: 0.25rem;',
  '  --color-*: initial;',
  '}',
  '@theme inline {',
  '  --color-canvas: var(--acme-canvas);',
  '}',
  ':root { --acme-canvas: #fff; }',
  '[data-theme="dark"] { --acme-canvas: #000; }',
  '/* --color-old: red; */',
  '',
);

// The research prototype; line numbers are explicit so the eight findings can be read off the literal.
const PROTOTYPE_SAMPLE = body(
  /* 1 */ '<!--',
  /* 2 */ 'accord prototype for ticket PROTO-1',
  /* 3 */ 'Derived from: src/tokens.css',
  /* 4 */ 'Note: the colour #123456 in this comment is never reported',
  /* 5 */ '-->',
  /* 6 */ '<!doctype html>',
  /* 7 */ '<html lang="en">',
  /* 8 */ '<head><style>',
  /* 9 */ '.card { color: var(--color-primary); padding:',
  /* 10 */ '  12px; margin: 0 auto; gap: calc(var(--space-2) * 2);',
  /* 11 */ '  background: #fff; /* border: 1px solid #000; */ border-color: transparent;',
  /* 12 */ '  border: 1px solid var(--nope); outline-color: CurrentColor; caret-color: var(--color-primary, #fff);',
  /* 13 */ '}',
  /* 14 */ '</style></head>',
  /* 15 */ '<body>',
  /* 16 */ '<div class="bg-[#fff] p-[13px] hover:bg-[oklch(60%_0.15_50)]/50 mt-[var(--space-2)] bg-(--color-primary) text-[14px] w-[13px]">',
  /* 17 */ '<p style="color: white; border: 1px solid var(--color-primary)">x</p>',
  /* 18 */ "<p style='padding: 2rem;",
  /* 19 */ "  color: var(--color-primary)'>y</p>",
  /* 20 */ '<script>const c = "#000"; document.body.style.color = c;</script>',
  /* 21 */ '</div>',
  /* 22 */ '</body>',
  /* 23 */ '</html>',
  '',
);

describe('tokenNames (D-66)', () => {
  it('extracts every declared --name at any nesting, skipping wildcards, initial, and comments', () => {
    expect([...tokenNames(TOKENS_SAMPLE)].sort()).toEqual(['--acme-canvas', '--color-canvas', '--color-primary', '--spacing']);
  });
});

describe('offending (D-66)', () => {
  const why = (prop: string, value: string) => offending(prop, value, known).map((o) => o.why);

  it.each([
    ['#fff', ['hard-coded colour']],
    ['white', ['hard-coded colour']],
    ['oklch(60% 0.15 50)', ['hard-coded colour']],
    ['var(--color-primary)', []],
    ['var(--color-primary, #fff)', []],
    ['transparent', []],
    ['CurrentColor', []],
    ['inherit', []],
    ['linear-gradient(#fff, var(--color-primary))', ['hard-coded colour']],
  ])('color: %s -> %j', (value, expected) => {
    expect(why('color', value)).toEqual(expected);
  });

  it('color: var(--nope) is an unknown token', () => {
    expect(offending('color', 'var(--nope)', known)).toEqual([{ token: 'var(--nope)', why: 'unknown token' }]);
  });

  it.each([
    ['12px', ['hard-coded spacing']],
    ['0 auto', []],
    ['1px', []],
    ['100%', []],
    ['calc(var(--space-2) * 2)', []],
  ])('padding: %s -> %j', (value, expected) => {
    expect(why('padding', value)).toEqual(expected);
  });

  it('padding: 2rem !important reports 2rem only', () => {
    expect(offending('padding', '2rem !important', known)).toEqual([{ token: '2rem', why: 'hard-coded spacing' }]);
  });

  it('border: a literal colour is reported, a known var is not; 1px is exempt', () => {
    expect(why('border', '1px solid var(--color-primary)')).toEqual([]);
    expect(offending('border', '1px solid #000', known)).toEqual([{ token: '#000', why: 'hard-coded colour' }]);
  });

  it('unlisted properties are never spacing', () => {
    expect(why('width', '13px')).toEqual([]);
    expect(why('font-size', '14px')).toEqual([]);
  });
});

describe('scanPrototype (D-66, D-68)', () => {
  it('reports the eight research findings at their lines, sorted by line then reason, and nothing else', () => {
    expect(scanPrototype(PROTOTYPE_SAMPLE, known)).toEqual([
      { line: 10, reason: 'padding: hard-coded spacing 12px' },
      { line: 11, reason: 'background: hard-coded colour #fff' },
      { line: 12, reason: 'border: unknown token var(--nope); tokens are read from config.design.tokens only' },
      { line: 16, reason: 'class bg-[#fff]: hard-coded colour #fff' },
      { line: 16, reason: 'class hover:bg-[oklch(60%_0.15_50)]/50: hard-coded colour oklch(60% 0.15 50)' },
      { line: 16, reason: 'class p-[13px]: hard-coded spacing 13px' },
      { line: 17, reason: 'color: hard-coded colour white' },
      { line: 18, reason: 'padding: hard-coded spacing 2rem' },
    ]);
  });

  it('scans arbitrary-property classes as declarations (A10)', () => {
    expect(scanPrototype('<i class="[color:#fff] [padding:var(--space-2)]"></i>', known)).toEqual([
      { line: 1, reason: 'color: hard-coded colour #fff' },
    ]);
  });

  it('scans a 1 MB style block and a 20 000-token class attribute in linear time (T-03-01, Pitfall 10)', () => {
    const style = '<style>\n' + '.a { color: var(--color-primary); padding: var(--space-2); }\n'.repeat(17000) + '</style>\n';
    const classes = '<div class="' + 'mt-[var(--space-2)] '.repeat(20000) + '"></div>\n';
    expect(style.length).toBeGreaterThan(1_000_000);
    const t0 = performance.now();
    expect(scanPrototype(style + classes, known)).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});

describe('derivedFrom (D-67, A4)', () => {
  const header = (...middle: string[]) => body('<!--', 'accord prototype for ticket X', ...middle, 'Owner: designer', '-->', '<p>x</p>');

  it('treats the shipped placeholder as no path, at the Derived from: line', () => {
    const shipped = body(
      '<!--',
      'accord prototype for ticket TICKET-ID',
      'Derived from: <list the stylesheets or token files this prototype was built from, one per line>',
      'Rule: use only colours and spacing from those files; the token rule (lint) warns on hard-coded values',
      'Owner: designer (assets/<id>/ is designer-owned)',
      '-->',
      '<!doctype html>',
    );
    expect(derivedFrom(shipped)).toEqual({ line: 3, paths: [] });
  });

  it('reads one path on the same line', () => {
    expect(derivedFrom(header('Derived from: src/a.css'))).toEqual({ line: 3, paths: ['src/a.css'] });
  });

  it('reads a list up to the next Key: line, normalising separators', () => {
    expect(derivedFrom(header('Derived from:', '- .\\src\\a.css', '- ./src/b.css', 'Rule: none'))).toEqual({
      line: 3,
      paths: ['src/a.css', 'src/b.css'],
    });
  });

  it('is undefined without a comment or without the line', () => {
    expect(derivedFrom('<!doctype html>\n<p>x</p>')).toBeUndefined();
    expect(derivedFrom(header('Rule: none'))).toBeUndefined();
  });
});
