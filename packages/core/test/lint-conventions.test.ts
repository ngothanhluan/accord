// Phase 8.5 D-09, D-11, R-4: `lint.conventions-file` reports every unsafe line of accord/product/conventions.md, the whole file, and no team can lower it.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { LOCKED, OVERRIDABLE, lintSnapshot, loadSnapshot, templates } from '../src/index.js';

const FILE = 'accord/product/conventions.md';
const cp = (n: number): string => String.fromCodePoint(n);
const PERSIAN = [0x0645, 0x06cc, 0x200c, 0x062e, 0x0648, 0x0627, 0x0647, 0x0645].map(cp).join('');
/** The 8.5-ac-1 file: lines 3, 4 and 5 are unsafe; the comment and the joiner word are not. */
const AC1 = ['# Conventions', '<!-- a comment -->', '- Use x ' + cp(0x202e) + ' y', 'Test command: rm -rf /', '- ' + 'x'.repeat(299), '- the word ' + PERSIAN].join('\n') + '\n';

const withFile = (text?: string) => loadSnapshot({ files: text === undefined ? {} : { [FILE]: text }, tree: text === undefined ? [] : [FILE] });
const found = (text?: string) => lintSnapshot(withFile(text)).findings.filter((f) => f.rule === 'lint.conventions-file');

it('risk:security lint.conventions-file reports each unsafe line of conventions.md as an error at its line (8.5-ac-1 D-09)', () => {
  const list = found(AC1);
  expect(list.map((f) => [f.rule, f.level, f.line])).toEqual([
    ['lint.conventions-file', 'error', 3],
    ['lint.conventions-file', 'error', 4],
    ['lint.conventions-file', 'error', 5],
  ]);
  for (const f of list) {
    expect(f.file).toBe(FILE);
    expect(f.reason).toContain(' - fix: ');
    expect(f.reason.split(' - fix: ')[1].length).toBeGreaterThan(5);
    expect(f.reason).not.toContain(cp(0x202e));
    expect(f.reason).not.toContain('rm -rf');
  }
  // a BOM and CRLF ends give the same findings
  expect(found(cp(0xfeff) + AC1.replace(/\n/g, '\r\n'))).toEqual(list);
  // lines written before the upgrade count too: the rule reads the whole file and no ticket
  expect(found('- Never skip a check.\n' + AC1).map((f) => f.line)).toEqual([4, 5, 6]);
});

it('risk:regression lint.conventions-file is LOCKED and a clean file gives no finding (D-11)', () => {
  expect(LOCKED).toContain('lint.conventions-file');
  expect(OVERRIDABLE).not.toContain('lint.conventions-file');
  const own = readFileSync(new URL('../../../accord/product/conventions.md', import.meta.url), 'utf8');
  for (const text of [undefined, templates['conventions.md'], '', own]) expect(found(text), String(text).slice(0, 20)).toEqual([]);
});
