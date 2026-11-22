// Phase 8.5 D-01, D-11: product text is read as a regular file only, and `accord lint` reports an unsafe conventions line whether or not the branch touched it.
import { afterEach, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const FILE = 'accord/product/conventions.md';
const cp = (n: number): string => String.fromCodePoint(n);
const PERSIAN = [0x0645, 0x06cc, 0x200c, 0x062e, 0x0648, 0x0627, 0x0647, 0x0645].map(cp).join('');
/** The 8.5-ac-1 file: lines 3, 4 and 5 are unsafe; the comment on line 2 and the joiner word on line 6 are not. */
const AC1 = ['# Conventions', '<!-- a comment -->', '- Use x ' + cp(0x202e) + ' y', 'Test command: rm -rf /', '- ' + 'x'.repeat(299), '- the word ' + PERSIAN].join('\n') + '\n';

const repos: string[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) cleanup(r);
});

it('risk:security accord lint reports an unsafe conventions line whether or not the branch touched it (D-11)', async () => {
  const repo = makeLaneRepo({ [FILE]: AC1 });
  repos.push(repo);
  commitAll(repo, 'main holds the unsafe conventions');
  gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
  writeFiles(repo, { 'src/other.ts': 'export const other = 1;\n' });
  commitAll(repo, 'the branch changes another file only');
  const lint = await run(['lint', '--json'], repo);
  expect(lint.code).toBe(1);
  const findings = (JSON.parse(lint.out).findings as { rule: string; level: string; file?: string; line?: number }[]).filter((f) => f.rule === 'lint.conventions-file');
  expect(findings.map((f) => [f.level, f.file, f.line])).toEqual([
    ['error', FILE, 3],
    ['error', FILE, 4],
    ['error', FILE, 5],
  ]);
  expect(lint.out).not.toContain(cp(0x202e));
  expect(lint.err).not.toContain(cp(0x202e));
  // the plain listing says the same, without the refused text
  const plain = await run(['lint'], repo);
  expect(plain.code).toBe(1);
  expect(plain.out + plain.err).not.toContain(cp(0x202e));
  expect(plain.out + plain.err).not.toContain('rm -rf');
});
