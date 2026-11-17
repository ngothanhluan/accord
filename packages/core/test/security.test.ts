// ST-LN-36 (05-04): the default security patterns, the file that holds them and the reader that matches them against a package's diff text.
import { expect, it } from 'vitest';
import { DEFAULT_SECURITY, parseSecurityFile, securityTriggers, templates, triggerText } from '../src/index.js';

const DIFF = [
  'diff --git a/src/run.ts b/src/run.ts',
  'index 1111111..2222222 100644',
  '--- a/src/run.ts',
  '+++ b/src/run.ts',
  '@@ -1,3 +1,4 @@',
  " import { x } from './x.js';",
  ' const a = 1;',
  "+execFileSync('git', args);",
  ' export {};',
  'diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml',
  'index 3333333..4444444 100644',
  '--- a/.github/workflows/ci.yml',
  '+++ b/.github/workflows/ci.yml',
  '@@ -1,2 +1,2 @@',
  '-name: old',
  '+name: new',
  'diff --git a/package.json b/package.json',
  'index 5555555..6666666 100644',
  '--- a/package.json',
  '+++ b/package.json',
  '@@ -1,2 +1,2 @@',
  '-  "version": "1.0.0",',
  '+  "version": "1.0.1",',
  'diff --git a/README.md b/README.md',
  'index 7777777..8888888 100644',
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -1,1 +1,2 @@',
  ' # title',
  '+keep the token secret',
].join('\n');

it('ac-1 the default patterns match added and removed lines and changed paths of a diff (ST-LN-36 36-ac-1)', () => {
  const changed = ['src/run.ts', '.github/workflows/ci.yml', 'package.json', 'README.md'];
  const triggers = securityTriggers(DEFAULT_SECURITY, DIFF, changed, { generated: [] });
  expect(triggers.map(triggerText)).toEqual([
    '.github/workflows/ci.yml: ci-workflow (CI workflow files)',
    'package.json: manifest (dependency manifests)',
    'src/run.ts:3: spawn (process spawn)',
  ]);
  expect(securityTriggers(DEFAULT_SECURITY, '', [], { generated: [] })).toEqual([]);
});

it('risk:parsing the default security file reads into six patterns and eight checklist items (ST-LN-36 36-ac-1)', () => {
  const text = templates['security.md'];
  const spec = parseSecurityFile(text);
  expect(spec.problems).toEqual([]);
  expect(spec.removed).toEqual([]);
  expect(spec.patterns.map((p) => p.id)).toEqual(['spawn', 'file-write', 'built-path', 'ci-workflow', 'manifest', 'secret-name']);
  for (const p of spec.patterns.filter((x) => x.kind === 'line')) {
    expect(() => new RegExp(p.source ?? '', p.flags ?? '')).not.toThrow();
    expect(p.flags === undefined || p.flags === '' || p.flags === 'i').toBe(true);
  }
  expect(spec.checklist.map((c) => c.id)).toEqual([
    'injection',
    'path-traversal',
    'secrets',
    'untrusted-input',
    'ci-permissions',
    'new-dependencies',
    'hook-commands',
    'authorisation',
  ]);
  const crlf = String.fromCharCode(0xfeff) + text.replace(/\n/g, '\r\n');
  expect(parseSecurityFile(crlf)).toEqual(spec);
  expect(DEFAULT_SECURITY).toEqual(spec);
});

// ---- the trigger reader's spellings (05-04 task 2) ----

const SECTION = (path: string, hunk: string[], head: string[] = []): string[] => [
  `diff --git a/${path} b/${path}`,
  ...head,
  `--- a/${path}`,
  `+++ b/${path}`,
  ...hunk,
];
const texts = (diff: string, changed: string[], generated: string[] = []): string[] =>
  securityTriggers(DEFAULT_SECURITY, diff, changed, { generated }).map(triggerText);

it('risk:parsing the trigger reader places every diff spelling (ST-LN-36 36-ac-1)', () => {
  // a rename with a change: the new path's lines; the changed list holds both names (git diff --name-only --no-renames)
  const renamed = [
    'diff --git a/src/old.ts b/src/new.ts',
    'similarity index 80%',
    'rename from src/old.ts',
    'rename to src/new.ts',
    'index 1111111..2222222 100644',
    '--- a/src/old.ts',
    '+++ b/src/new.ts',
    '@@ -1,2 +1,2 @@',
    ' a',
    '-b',
    "+spawnSync('x');",
  ].join('\n');
  expect(texts(renamed, ['src/old.ts', 'src/new.ts'])).toEqual(['src/new.ts:2: spawn (process spawn)']);

  // a pure rename: a path pattern sees the old side
  const pure = ['diff --git a/package.json b/pkg/app.json', 'similarity index 100%', 'rename from package.json', 'rename to pkg/app.json'].join('\n');
  expect(texts(pure, ['package.json', 'pkg/app.json'])).toEqual(['package.json: manifest (dependency manifests)']);

  // a deletion: the removed lines carry the old numbers
  const deleted = [
    'diff --git a/src/gone.ts b/src/gone.ts',
    'deleted file mode 100644',
    'index 1111111..0000000',
    '--- a/src/gone.ts',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    "-execSync('rm');",
    '-x',
  ].join('\n');
  expect(texts(deleted, ['src/gone.ts'])).toEqual(['src/gone.ts:1 (removed): spawn (process spawn)']);

  // a new file
  const created = [
    'diff --git a/src/n.ts b/src/n.ts',
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    '+++ b/src/n.ts',
    '@@ -0,0 +1,2 @@',
    '+const a = 1;',
    '+fork();',
  ].join('\n');
  expect(texts(created, ['src/n.ts'])).toEqual(['src/n.ts:2: spawn (process spawn)']);

  // a binary file with no path pattern, and a mode change: no trigger and no "cannot"
  const binary = ['diff --git a/img/x.png b/img/x.png', 'new file mode 100644', 'index 0000000..1111111', 'Binary files /dev/null and b/img/x.png differ'].join('\n');
  expect(texts(binary, ['img/x.png'])).toEqual([]);
  const mode = ['diff --git a/scripts/run.sh b/scripts/run.sh', 'old mode 100644', 'new mode 100755'].join('\n');
  expect(texts(mode, ['scripts/run.sh'])).toEqual([]);
  // a binary file that a path pattern names is still a trigger
  const lock = ['diff --git a/yarn.lock b/yarn.lock', 'index 1111111..2222222 100644', 'Binary files a/yarn.lock and b/yarn.lock differ'].join('\n');
  expect(texts(lock, ['yarn.lock'])).toEqual(['yarn.lock: manifest (dependency manifests)']);

  // a path with a space: git ends its header paths with a tab
  const spaced = [
    'diff --git a/my dir/a b.ts b/my dir/a b.ts',
    'index 1111111..2222222 100644',
    '--- a/my dir/a b.ts\t',
    '+++ b/my dir/a b.ts\t',
    '@@ -1 +1,2 @@',
    ' x',
    '+spawn(y);',
  ].join('\n');
  expect(texts(spaced, ['my dir/a b.ts'])).toEqual(['my dir/a b.ts:2: spawn (process spawn)']);

  // CRLF line ends inside the diff text read the same as LF
  const four = ['src/run.ts', '.github/workflows/ci.yml', 'package.json', 'README.md'];
  expect(texts(DIFF.replace(/\n/g, '\r\n'), four)).toEqual(texts(DIFF, four));

  // a content line that looks like a header (`---`, `+++`) is a content line, read by the hunk's counts
  const looks = SECTION('src/q.ts', ['@@ -1,2 +1,2 @@', ' keep', '--- old comment', "+++ exec('x')"]).join('\n');
  expect(texts(looks, ['src/q.ts'])).toEqual(['src/q.ts:2: spawn (process spawn)']);

  // a context line holding exec( triggers nothing; a removed one triggers with its old number
  const context = SECTION('src/c.ts', ['@@ -5,3 +5,2 @@', ' exec(a)', '-exec(b)', ' tail']).join('\n');
  expect(texts(context, ['src/c.ts'])).toEqual(['src/c.ts:6 (removed): spawn (process spawn)']);

  // a line longer than 2000 characters is matched on its first 2000 only
  const farOut = SECTION('src/long.ts', ['@@ -1 +1,2 @@', ' a', '+' + 'a'.repeat(2500) + ' spawn(x)']).join('\n');
  expect(texts(farOut, ['src/long.ts'])).toEqual([]);
  const nearIn = SECTION('src/long.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(x) ' + 'a'.repeat(2500)]).join('\n');
  expect(texts(nearIn, ['src/long.ts'])).toEqual(['src/long.ts:2: spawn (process spawn)']);

  // the excluded-merge form: several sections of one path from `git log -p`, commit header lines between them
  const log = [
    '\x01abc1234 first',
    ...SECTION('src/a.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    '',
    '\x01def5678 second',
    ...SECTION('src/a.ts', ['@@ -3 +3,2 @@', ' c', '+exec(2);']),
  ].join('\n');
  expect(texts(log, ['src/a.ts'])).toEqual(['src/a.ts:2: spawn (process spawn)', 'src/a.ts:4: spawn (process spawn)']);

  // content patterns skip Markdown, test files and generated copies; an empty diff and a Markdown-only or test-only diff give nothing
  const skipped = [
    ...SECTION('docs/notes.md', ['@@ -1 +1,2 @@', ' a', '+spawn(1); token']),
    ...SECTION('packages/core/test/a.test.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    ...SECTION('src/b.spec.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    ...SECTION('src/__tests__/c.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    ...SECTION('.claude/skills/accord/x.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    ...SECTION('gen/out.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
  ].join('\n');
  const names = ['docs/notes.md', 'packages/core/test/a.test.ts', 'src/b.spec.ts', 'src/__tests__/c.ts', '.claude/skills/accord/x.ts', 'gen/out.ts'];
  expect(texts(skipped, names, ['gen/'])).toEqual([]);
  expect(texts('', [])).toEqual([]);
  expect(texts('(no changes)', [])).toEqual([]);

  // a changed path the diff text does not show is a trigger of its own, never a non-match (T-05-10)
  expect(texts(looks, ['src/q.ts', 'gone/other.ts'])).toEqual(['(cannot tell: gone/other.ts is not in the diff text)', 'src/q.ts:2: spawn (process spawn)']);
  const quoted = [
    'diff --git "a/\\303\\251.ts" "b/\\303\\251.ts"',
    'index 1111111..2222222 100644',
    '--- "a/\\303\\251.ts"',
    '+++ "b/\\303\\251.ts"',
    '@@ -1 +1,2 @@',
    ' a',
    '+spawn(1);',
  ].join('\n');
  expect(texts(quoted, ['é.ts'])).toEqual(['(cannot tell: é.ts is not in the diff text)']);
});

it('risk:regression the triggers are the same on every run and sorted (ST-LN-36 36-ac-1)', () => {
  const diff = [
    ...SECTION('src/z.ts', ['@@ -1 +1,3 @@', ' a', '+spawn(1);', '+exec(2);']),
    ...SECTION('Src/A.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    ...SECTION('src/z.ts', ['@@ -1 +1,3 @@', ' a', '+spawn(1);', '+exec(2);']),
    ...SECTION('package.json', ['@@ -1 +1,2 @@', ' a', '+b']),
  ].join('\n');
  const changed = ['src/z.ts', 'package.json', 'Src/A.ts', 'src/z.ts', 'extra/\u{1F600}.ts', 'extra/Ａ.ts'];
  const once = securityTriggers(DEFAULT_SECURITY, diff, changed, { generated: [] });
  expect(securityTriggers(DEFAULT_SECURITY, diff, changed, { generated: [] })).toEqual(once);
  const keys = once.map((t) => JSON.stringify([t.path, t.line ?? 0, t.pattern, t.removed ?? false]));
  expect(new Set(keys).size).toBe(keys.length);
  // code point order: 'S' (U+0053) before 's' (U+0073), and U+FF21 before U+1F600 (a UTF-16 compare would put the pair the other way round)
  expect(once.map((t) => [t.path, t.line ?? 0])).toEqual([
    ['Src/A.ts', 2],
    ['extra/Ａ.ts', 0],
    ['extra/\u{1F600}.ts', 0],
    ['package.json', 0],
    ['src/z.ts', 2],
    ['src/z.ts', 3],
  ]);
});
