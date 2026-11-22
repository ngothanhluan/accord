// Phase 8.5 D-01, D-11: product text is read as a regular file only, and `accord lint` reports an unsafe conventions line whether or not the branch touched it.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { conventionsBlock, notReadLine } from '@accord-dev/accord-core';
import { defaultRefOf } from '../src/load/fs.js';
import { productChange, readProductText } from '../src/load/product.js';
import { cleanup, commitAll, gitRun, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

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

const SECRET = 'SECRET-TOKEN-0451';
/** A folder outside every sandbox holding the secret a link would point at. */
function outside(): { dir: string; secret: string } {
  const dir = mkdtempSync(join(tmpdir(), 'accord-outside-'));
  repos.push(dir);
  const secret = join(dir, 'secret.txt');
  writeFileSync(secret, SECRET + '\n');
  return { dir, secret };
}
/** A git sandbox holding a README and `extra`; line endings are left as written, so a CRLF file reads back byte for byte. */
const sandbox = (extra: Record<string, string> = {}): string => {
  const repo = makeEmptyRepo();
  repos.push(repo);
  gitRun(repo, 'config', 'core.autocrlf', 'false');
  writeFiles(repo, { 'README.md': 'x\n', ...extra });
  return repo;
};

it.skipIf(process.platform === 'win32')('risk:security a conventions.md that is a link is not read and no byte of its target is printed (8.5-ac-2 D-01)', () => {
  const { secret, dir } = outside();
  // the file itself is a link to a file outside the sandbox
  const repo = sandbox();
  mkdirSync(join(repo, 'accord', 'product'), { recursive: true });
  symlinkSync(secret, join(repo, 'accord', 'product', 'conventions.md'));
  const read = readProductText(repo, { from: 'working' });
  expect(read).toEqual({ kind: 'not-regular', copy: 'working' });
  const block = conventionsBlock(read, 'executor');
  expect(block).toContain(notReadLine(FILE));
  expect(block).not.toContain(SECRET);
  expect(block).not.toContain(secret);
  // the folder above it is a link to a folder holding a real file
  const viaFolder = sandbox();
  writeFileSync(join(dir, 'conventions.md'), '- ' + SECRET + '\n');
  mkdirSync(join(viaFolder, 'accord'), { recursive: true });
  symlinkSync(dir, join(viaFolder, 'accord', 'product'), 'dir');
  const folderRead = readProductText(viaFolder, { from: 'working' });
  expect(folderRead).toEqual({ kind: 'not-regular', copy: 'working' });
  expect(conventionsBlock(folderRead, 'reviewer')).not.toContain(SECRET);
});

it.skipIf(process.platform !== 'win32')('risk:security a junction above conventions.md is not followed and no byte behind it is printed (8.5-ac-2 D-01)', () => {
  const { dir } = outside();
  writeFileSync(join(dir, 'conventions.md'), '- ' + SECRET + '\n');
  const repo = sandbox();
  mkdirSync(join(repo, 'accord'), { recursive: true });
  symlinkSync(dir, join(repo, 'accord', 'product'), 'junction');
  const read = readProductText(repo, { from: 'working' });
  expect(read).toEqual({ kind: 'not-regular', copy: 'working' });
  expect(conventionsBlock(read, 'executor')).not.toContain(SECRET);
});

it('risk:security a mode 120000 conventions.md on the default branch is not read and its link path is not printed (8.5-ac-2 D-01)', () => {
  const repo = sandbox();
  commitAll(repo, 'main without conventions');
  // the entry is a symbolic link in git's tree (mode 120000) whose target is a path outside the repository; built with plumbing so it works on every OS
  const target = join(repo, 'link-target.tmp');
  writeFileSync(target, '../secret.txt');
  const oid = gitRun(repo, 'hash-object', '-w', 'link-target.tmp').trim();
  rmSync(target);
  gitRun(repo, 'update-index', '--add', '--cacheinfo', `120000,${oid},accord/product/conventions.md`);
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  repos.push(folder);
  writeFileSync(join(folder, 'msg.txt'), 'the default branch holds a link\n');
  gitRun(repo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-F', join(folder, 'msg.txt'), '--cleanup=verbatim');
  const ref = defaultRefOf(repo);
  expect(ref).toBeDefined();
  const read = readProductText(repo, { from: 'default', ref });
  expect(read).toEqual({ kind: 'not-regular', copy: 'default' });
  const block = conventionsBlock(read, 'reviewer');
  expect(block).toContain(notReadLine(FILE));
  expect(block).not.toContain('../secret.txt');
  expect(block).not.toContain('secret');
});

it('risk:complex-branching the default copy and the working copy differ on a branch that deleted a line (D-05 D-06)', () => {
  const text = '# Conventions\r\n\r\n- L1 first rule.\r\n- L2 second rule.\r\n';
  const repo = sandbox({ [FILE]: text });
  commitAll(repo, 'main holds L1 and L2');
  const ref = defaultRefOf(repo) as string;
  gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
  writeFiles(repo, { [FILE]: '# Conventions\r\n\r\n- L1 first rule.\r\n' });
  commitAll(repo, 'the branch deletes L2');
  const onDefault = readProductText(repo, { from: 'default', ref });
  const here = readProductText(repo, { from: 'working' });
  // the bytes come back unchanged, a CRLF file included
  expect(onDefault).toEqual({ kind: 'text', copy: 'default', text });
  expect(here).toEqual({ kind: 'text', copy: 'working', text: '# Conventions\r\n\r\n- L1 first rule.\r\n' });
  const change = productChange(repo, ref, 'HEAD');
  expect(change.kind).toBe('diff');
  expect(change.kind === 'diff' ? change.text : '').toContain('-- L2 second rule.');
  // a branch that did not touch the file has an empty change, and a file nobody wrote reads as absent
  gitRun(repo, 'checkout', '-q', '-b', 't/T-2', ref);
  expect(productChange(repo, ref, 'HEAD')).toEqual({ kind: 'diff', text: '' });
  expect(readProductText(repo, { from: 'working' }, 'accord/product/nothing.md')).toEqual({ kind: 'absent', copy: 'working' });
  expect(readProductText(repo, { from: 'default', ref }, 'accord/product/nothing.md')).toEqual({ kind: 'absent', copy: 'default' });
});

it('risk:regression with no default ref the default read gives the working copy and a note and never throws (D-07)', () => {
  const repo = sandbox({ [FILE]: '- Only rule.\n' });
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/trunk');
  commitAll(repo, 'trunk is the only branch');
  expect(defaultRefOf(repo)).toBeUndefined();
  const working = { kind: 'text', copy: 'working', text: '- Only rule.\n', note: 'no-default-ref' };
  expect(readProductText(repo, { from: 'default', ref: defaultRefOf(repo) })).toEqual(working);
  // a ref git cannot read gives the same, and so does a ref that could be read as a git option
  expect(readProductText(repo, { from: 'default', ref: 'refs/remotes/origin/nope' })).toEqual(working);
  expect(readProductText(repo, { from: 'default', ref: '--output=x' })).toEqual(working);
  expect(readProductText(repo, { from: 'default', ref: undefined }, 'accord/product/nothing.md')).toEqual({ kind: 'absent', copy: 'working', note: 'no-default-ref' });
  expect(productChange(repo, undefined, 'HEAD')).toEqual({ kind: 'unknown', why: 'no default branch in this clone' });
  expect(productChange(repo, '--output=x', 'HEAD')).toEqual({ kind: 'unknown', why: 'not a git ref' });
  expect(productChange(repo, 'trunk', '--help')).toEqual({ kind: 'unknown', why: 'not a git ref' });
  const unreadable = productChange(repo, 'refs/heads/nope', 'HEAD');
  expect(unreadable.kind).toBe('unknown');
  expect(JSON.stringify(unreadable)).not.toContain('\\\\');
});
