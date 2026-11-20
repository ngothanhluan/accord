// ST-LN-36 (05-04): the default security patterns, the file that holds them and the reader that matches them against a package's diff text.
import { expect, it, vi } from 'vitest';
import { DEFAULT_SECURITY, LOCKED, lintSnapshot, loadSnapshot, matchedHunks, parseSecurityFile, securitySpec, securityTriggers, templates, triggerText } from '../src/index.js';
import { SCAN_LINE_LIMIT } from '../src/security/match.js';

const FILE = 'accord/product/security.md';
/** A snapshot holding only the security file (or none): securitySpec reads nothing else. */
const withFile = (text?: string) => loadSnapshot({ files: text === undefined ? {} : { [FILE]: text }, tree: text === undefined ? [] : [FILE] });
const DEFAULT_IDS = ['spawn', 'file-write', 'built-path', 'ci-workflow', 'manifest', 'secret-name', 'agent-config', 'security-config'];
const CHECK_IDS = DEFAULT_SECURITY.checklist.map((c) => c.id);

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

it('risk:security the default patterns match added and removed lines and changed paths of a diff (ST-LN-36 36-ac-1)', () => {
  const changed = ['src/run.ts', '.github/workflows/ci.yml', 'package.json', 'README.md'];
  const triggers = securityTriggers(DEFAULT_SECURITY, DIFF, changed, { generated: [] });
  expect(triggers.map(triggerText)).toEqual([
    '.github/workflows/ci.yml: ci-workflow (CI workflow files)',
    'package.json: manifest (dependency manifests)',
    'src/run.ts:3: spawn (process spawn)',
  ]);
  expect(securityTriggers(DEFAULT_SECURITY, '', [], { generated: [] })).toEqual([]);
});

it('risk:parsing the default security file reads into seven patterns and eight checklist items (ST-LN-36 36-ac-1)', () => {
  const text = templates['security.md'];
  const spec = parseSecurityFile(text);
  expect(spec.problems).toEqual([]);
  expect(spec.removed).toEqual([]);
  expect(spec.patterns.map((p) => p.id)).toEqual(DEFAULT_IDS);
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

  // a line longer than 1000 characters is matched on its first 1000, and says it was not scanned whole (WR-02)
  const farOut = SECTION('src/long.ts', ['@@ -1 +1,2 @@', ' a', '+' + 'a'.repeat(2500) + ' spawn(x)']).join('\n');
  expect(texts(farOut, ['src/long.ts'])).toEqual(['src/long.ts:2: (cannot tell: line longer than 1000 characters, not fully scanned)']);
  const nearIn = SECTION('src/long.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(x) ' + 'a'.repeat(2500)]).join('\n');
  expect(texts(nearIn, ['src/long.ts'])).toEqual(['src/long.ts:2: (cannot tell: line longer than 1000 characters, not fully scanned)', 'src/long.ts:2: spawn (process spawn)']);

  // the excluded-merge form: several sections of one path from `git log -p`, commit header lines between them
  const log = [
    '\x01abc1234 first',
    ...SECTION('src/a.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    '',
    '\x01def5678 second',
    ...SECTION('src/a.ts', ['@@ -3 +3,2 @@', ' c', '+exec(2);']),
  ].join('\n');
  expect(texts(log, ['src/a.ts'])).toEqual(['src/a.ts:2: spawn (process spawn)', 'src/a.ts:4: spawn (process spawn)']);

  // content patterns skip Markdown, test files and generated paths; an empty diff and a Markdown-only or test-only diff give nothing
  const skipped = [
    ...SECTION('docs/notes.md', ['@@ -1 +1,2 @@', ' a', '+spawn(1); token']),
    ...SECTION('packages/core/test/a.test.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    ...SECTION('src/b.spec.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    ...SECTION('src/__tests__/c.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
    ...SECTION('gen/out.ts', ['@@ -1 +1,2 @@', ' a', '+spawn(1);']),
  ].join('\n');
  const names = ['docs/notes.md', 'packages/core/test/a.test.ts', 'src/b.spec.ts', 'src/__tests__/c.ts', 'gen/out.ts'];
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

// ---- the repository's own file (05-05) ----

const tpl = templates['security.md'];
/** The template with a line added to the end of one section (`## Patterns`, `## Checklist` or `## Removed`). */
const edit = (section: 'Patterns' | 'Checklist' | 'Removed', ...add: string[]): string => {
  const at = tpl.indexOf(`\n## ${section}\n`); // the header comment also says "## Removed", so anchor on the line start
  const next = tpl.indexOf('\n## ', at + 1);
  const end = next < 0 ? tpl.length : next;
  return tpl.slice(0, end).trimEnd() + '\n' + add.join('\n') + '\n' + tpl.slice(end);
};
const ids = (s: ReturnType<typeof securitySpec>) => s.patterns.map((p) => p.id);

it('risk:security the patterns in force are the defaults plus additions minus Removed lines (ST-LN-36 36-ac-1)', () => {
  const text = edit('Removed', '- Removed: secret-name — our design tokens are not secrets', '').replace(
    '- secret-name:',
    '- infra: path infra/ — infrastructure\n- secret-name:',
  );
  const spec = securitySpec(withFile(text));
  expect(spec.problems).toEqual([]);
  // the template names eight defaults; one is removed and one is added, so eight are in force, the team's after the defaults
  expect(ids(spec)).toEqual(['spawn', 'file-write', 'built-path', 'ci-workflow', 'manifest', 'agent-config', 'security-config', 'infra']);
  expect(spec.checklist.map((c) => c.id)).toEqual(CHECK_IDS);
  expect(spec.checklist).toHaveLength(8);
  expect(spec.removed.map((r) => [r.id, r.reason])).toEqual([['secret-name', 'our design tokens are not secrets']]);
  // the team's pattern matches like a default
  const diff = ['diff --git a/infra/main.tf b/infra/main.tf', 'index 1..2 100644', '--- a/infra/main.tf', '+++ b/infra/main.tf', '@@ -1 +1,2 @@', ' a', '+token = 1'].join('\n');
  expect(securityTriggers(spec, diff, ['infra/main.tf'], { generated: [] }).map(triggerText)).toEqual(['infra/main.tf: infra (infrastructure)']);

  // a default line deleted from the file with no Removed line still applies
  const deleted = tpl.split('\n').filter((l) => !l.startsWith('- spawn:')).join('\n');
  const kept = securitySpec(withFile(deleted));
  expect(ids(kept)).toEqual(DEFAULT_IDS);
  expect(kept.problems).toEqual([]);

  // absent, empty and headings-only files all give the defaults and no problem
  for (const t of [undefined, '', '\n', '# Security review\n\n## Patterns\n\n## Checklist\n\n## Removed\n']) {
    const s = securitySpec(withFile(t));
    expect(ids(s), String(t)).toEqual(DEFAULT_IDS);
    expect(s.checklist, String(t)).toHaveLength(8);
    expect(s.problems, String(t)).toEqual([]);
    expect(s.removed, String(t)).toEqual([]);
  }
});

it('risk:parsing a rewritten default is not read, a Removed line for a team or unknown id removes nothing, and ids compare as written (ST-LN-36 36-ac-1)', () => {
  // a default id with another value: the default applies and the line is a problem
  const rewritten = tpl.replace(/^- spawn: .*$/m, '- spawn: line /nothing/ — process spawn');
  const r = securitySpec(withFile(rewritten));
  expect(ids(r)).toEqual(DEFAULT_IDS);
  expect(r.patterns[0].source).toBe(DEFAULT_SECURITY.patterns[0].source);
  expect(r.problems.map((p) => p.line)).toEqual([tpl.split('\n').findIndex((l) => l.startsWith('- spawn:')) + 1]);

  // a team line whose id and value equal a default is that default: no problem, no second pattern
  expect(securitySpec(withFile(tpl)).problems).toEqual([]);
  expect(ids(securitySpec(withFile(tpl)))).toEqual(DEFAULT_IDS);

  // a Removed line for a team id or an unknown id is a problem and removes nothing; a repeat is a problem too
  const text = edit('Removed', '- Removed: infra — gone', '- Removed: nope — gone', '- Removed: spawn — we use another tool', '- Removed: spawn — again', '').replace(
    '- secret-name:',
    '- infra: path infra/ — infrastructure\n- secret-name:',
  );
  const s = securitySpec(withFile(text));
  expect(ids(s)).toEqual(['file-write', 'built-path', 'ci-workflow', 'manifest', 'secret-name', 'agent-config', 'security-config', 'infra']);
  expect(s.removed.map((x) => x.id)).toEqual(['spawn']);
  expect(s.problems).toHaveLength(3);

  // the checklist keeps its eight defaults whatever the file says; a Removed line for a checklist item removes nothing
  const noList = tpl.replace(/## Checklist[\s\S]*?(?=## Removed)/, '## Checklist\n\n');
  expect(securitySpec(withFile(noList)).checklist.map((c) => c.id)).toEqual(CHECK_IDS);
  const noCheck = securitySpec(withFile(edit('Removed', '- Removed: secrets — no', '')));
  expect(noCheck.checklist.map((c) => c.id)).toEqual(CHECK_IDS);
  expect(noCheck.problems).toHaveLength(1);
  // a checklist addition with a new id joins; a default id with other text keeps the default and is a problem
  const added = securitySpec(withFile(edit('Checklist', '- logging: no request body is logged', '')));
  expect(added.checklist.map((c) => c.id)).toEqual([...CHECK_IDS, 'logging']);
  const reworded = securitySpec(withFile(tpl.replace(/^- injection: .*$/m, '- injection: be careful')));
  expect(reworded.checklist[0].text).toBe(DEFAULT_SECURITY.checklist[0].text);
  expect(reworded.problems).toHaveLength(1);

  // ids compare byte for byte as written: `Spawn` is not an id; CRLF and a BOM read as their LF form
  const upper = securitySpec(withFile(edit('Patterns', '- Spawn: line /x/ — x', '')));
  expect(ids(upper)).toEqual(DEFAULT_IDS);
  expect(upper.problems).toHaveLength(1);
  const crlf = String.fromCharCode(0xfeff) + text.replace(/\n/g, '\r\n');
  expect(securitySpec(withFile(crlf))).toEqual(s);
});

// ---- lint.security-file (05-05 task 2) ----

/** A security file written line by line; `bad` lines are the ones lint must name, at their own line numbers. */
const BAD_FILE: { text: string; bad?: true }[] = [
  { text: '# Security review' },
  { text: '' },
  { text: '## Patterns' },
  { text: '' },
  { text: '- flagged: line /x/g — a flag that is not i', bad: true },
  { text: '- broken: line /(/ — a regex that does not compile', bad: true },
  { text: '- glob: path src/*.ts — a glob', bad: true },
  { text: '- Spawn: line /x/ — an id in upper case', bad: true },
  { text: '- infra: path infra/ — fine' },
  { text: '- infra: path other/ — a second line with the id', bad: true },
  { text: '- spawn: line /exec/ — a default rewritten', bad: true },
  { text: '- this is no pattern', bad: true },
  { text: '' },
  { text: '## Checklist' },
  { text: '' },
  { text: '- a check with no id', bad: true },
  { text: '' },
  { text: '## Removed' },
  { text: '' },
  { text: '- Removed: secret-name', bad: true },
  { text: '- Removed: infra — a team id, not a default', bad: true },
  { text: '- Removed: nope — an unknown id', bad: true },
  { text: '- Removed: manifest — a real removal with a reason' },
];

it('risk:parsing every unread line of the security file is a lint error at its line (ST-LN-36 36-ac-4)', () => {
  const text = BAD_FILE.map((l) => l.text).join('\n') + '\n';
  const expected = BAD_FILE.flatMap((l, i) => (l.bad === true ? [i + 1] : []));
  const lint = (t: string) => lintSnapshot(withFile(t));
  const found = lint(text).findings.filter((f) => f.file === FILE);
  expect(found.map((f) => [f.rule, f.level, f.line])).toEqual(expected.map((n) => ['lint.security-file', 'error', n]));
  for (const f of found) expect(f.reason.length, String(f.line)).toBeGreaterThan(10);
  // the file also reads as problems of the spec, so the package and lint agree
  expect(securitySpec(withFile(text)).problems.map((p) => p.line)).toEqual(expected);
  // CRLF and a BOM give the same findings
  const crlf = String.fromCharCode(0xfeff) + text.replace(/\n/g, '\r\n');
  expect(lint(crlf).findings.filter((f) => f.file === FILE)).toEqual(found);
});

it('risk:regression lint.security-file is LOCKED and an absent or valid file gives no finding (ST-LN-36 36-ac-4)', () => {
  expect(LOCKED).toContain('lint.security-file');
  for (const t of [undefined, tpl, '', edit('Patterns', '- infra: path infra/ — infrastructure', '')]) {
    expect(lintSnapshot(withFile(t)).findings.filter((f) => f.rule === 'lint.security-file'), String(t)).toEqual([]);
  }
});

// ---- the security package: the matched hunks (05-07 task 2) ----

const HUNKS_DIFF = [
  ...SECTION('src/run.ts', [
    '@@ -1,3 +1,4 @@',
    ' const a = 1;',
    ' const b = 2;',
    "+spawnSync('git', ['status']);",
    ' export {};',
    '@@ -40,3 +41,3 @@',
    ' const c = 3;',
    '-const oldName = 4;',
    '+const newName = 4;',
    ' export {};',
  ]),
  ...SECTION('package-lock.json', [
    '@@ -1,200 +1,200 @@',
    ...Array.from({ length: 200 }, (_, i) => `-  "old${i}": 1,`),
    ...Array.from({ length: 200 }, (_, i) => `+  "new${i}": 1,`),
  ]),
].join('\n');

it('risk:security the matched hunks are the hunks that hold a match, whole, and a path match is capped (ST-LN-36 36-ac-3)', () => {
  const changed = ['src/run.ts', 'package-lock.json'];
  const blocks = matchedHunks(DEFAULT_SECURITY, HUNKS_DIFF, changed, { generated: [] });
  const run = blocks.find((b) => b.startsWith('diff --git a/src/run.ts'))!;
  expect(run.split('\n')).toEqual([
    'diff --git a/src/run.ts b/src/run.ts',
    '--- a/src/run.ts',
    '+++ b/src/run.ts',
    '@@ -1,3 +1,4 @@',
    ' const a = 1;',
    ' const b = 2;',
    "+spawnSync('git', ['status']);",
    ' export {};',
  ]);
  expect(run).not.toContain('newName');
  // a path match: every hunk of the file, cut at 300 lines, and the cut says how many lines it left out
  const lock = blocks.find((b) => b.startsWith('diff --git a/package-lock.json'))!.split('\n');
  expect(lock.slice(0, 3)).toEqual(['diff --git a/package-lock.json b/package-lock.json', '--- a/package-lock.json', '+++ b/package-lock.json']);
  expect(lock.slice(3, -1)).toHaveLength(300);
  expect(lock[lock.length - 1]).toBe('(truncated: 101 more lines in package-lock.json)');
  // paths come in order
  expect(blocks.map((b) => b.split('\n')[0])).toEqual(['diff --git a/package-lock.json b/package-lock.json', 'diff --git a/src/run.ts b/src/run.ts']);
  // no trigger, no hunk
  expect(matchedHunks(DEFAULT_SECURITY, SECTION('src/plain.ts', ['@@ -1 +1 @@', '-a', '+b']).join('\n'), ['src/plain.ts'], { generated: [] })).toEqual([]);
  expect(matchedHunks(DEFAULT_SECURITY, '', [], { generated: [] })).toEqual([]);
});

it('risk:security a matched hunk is never left out: a content hunk past the cap is whole, a path the diff does not show is said (ST-LN-36 36-ac-3)', () => {
  // a manifest whose first hunk fills the cap and whose second holds a content match: the second is printed whole
  const big = SECTION('package.json', [
    '@@ -1,300 +1,300 @@',
    ...Array.from({ length: 299 }, (_, i) => ` line${i}`),
    '+  "x": 1',
    '@@ -900,2 +900,3 @@',
    ' tail',
    "+token = 'abc'",
    ' end',
  ]).join('\n');
  const out = matchedHunks(DEFAULT_SECURITY, big, ['package.json'], { generated: [] });
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("+token = 'abc'");
  const cannot = matchedHunks(DEFAULT_SECURITY, '', ['Cargo.lock'], { generated: [] });
  expect(cannot.join('\n')).toContain('(cannot tell: Cargo.lock is not in the diff text)');
});

it('risk:security a change to the security file or the repository config is a trigger, so a branch cannot weaken its own review unseen (ST-LN-36 36-ac-1)', () => {
  // a Removed line in the security file and a generated: list in the config, each in the same package as a spawn change
  const removed = SECTION('accord/product/security.md', ['@@ -25,3 +25,4 @@', ' ## Removed', ' ', '+- Removed: spawn — x', ' end']);
  const config = SECTION('accord/config.yml', ['@@ -1,2 +1,3 @@', ' adapter: none', '+generated: [src/]', ' end']);
  const code = SECTION('src/run.ts', ['@@ -1,2 +1,3 @@', ' a', "+execFileSync('git', args);", ' b']);
  const diff = [...removed, ...config, ...code].join('\n');
  const changed = ['accord/config.yml', 'accord/product/security.md', 'src/run.ts'];
  const label = 'security-config (the security trigger list, the generated paths it skips and the diff attributes that can hide a file from the scan)';
  expect(texts(diff, changed, ['src/'])).toEqual([`accord/config.yml: ${label}`, `accord/product/security.md: ${label}`]);
  expect(texts(diff, changed)).toEqual([`accord/config.yml: ${label}`, `accord/product/security.md: ${label}`, 'src/run.ts:2: spawn (process spawn)']);
});

it('risk:security a change to .gitattributes, at the root or deeper, is a trigger, since a diff attribute can hide a file from the content scan', () => {
  const root = SECTION('.gitattributes', ['@@ -0,0 +1 @@', '+*.js -diff']);
  const deep = SECTION('vendor/.gitattributes', ['@@ -0,0 +1 @@', '+*.js binary']);
  const found = texts([...root, ...deep].join('\n'), ['.gitattributes', 'vendor/.gitattributes']);
  expect(found).toHaveLength(2);
  expect(found[0]).toMatch(/^\.gitattributes: security-config \(/);
  expect(found[1]).toMatch(/^vendor\/\.gitattributes: security-config \(/);
});

it('risk:security a Removed line for security-config takes no effect: the pattern stays in force and the line is a lint error (ST-LN-36 36-ac-1)', () => {
  // the same commit removes spawn and security-config and changes the security file and a spawn call
  const text = edit('Removed', '- Removed: security-config — x', '- Removed: spawn — x', '');
  const line = text.split('\n').findIndex((l) => l.startsWith('- Removed: security-config')) + 1;
  const spec = securitySpec(withFile(text));
  // (a) the pattern is in force, spawn is removed, and the diff of the security file is a trigger
  expect(ids(spec)).toContain('security-config');
  expect(ids(spec)).not.toContain('spawn');
  expect(spec.removed.map((r) => r.id)).toEqual(['spawn']);
  const sec = SECTION('accord/product/security.md', ['@@ -25,3 +25,5 @@', ' ## Removed', ' ', '+- Removed: security-config — x', '+- Removed: spawn — x', ' end']);
  const code = SECTION('src/run.ts', ['@@ -1,2 +1,3 @@', ' a', "+execFileSync('git', args);", ' b']);
  const triggers = securityTriggers(spec, [...sec, ...code].join('\n'), ['accord/product/security.md', 'src/run.ts'], { generated: [] });
  expect(triggers.map(triggerText)).toEqual(['accord/product/security.md: security-config (the security trigger list, the generated paths it skips and the diff attributes that can hide a file from the scan)']);
  // (b) lint names the line, with the reason
  const found = lintSnapshot(withFile(text)).findings.filter((f) => f.rule === 'lint.security-file');
  expect(found.map((f) => [f.level, f.line])).toEqual([['error', line]]);
  expect(found[0].reason).toContain('security-config cannot be removed: a change to the security file must always call the security reviewer');
  expect(spec.problems.map((p) => p.line)).toEqual([line]);
});

it('risk:parsing a file git reports as binary and the package diff then shows as text is one block of matched hunks, not two (CR-01)', () => {
  // package-diff.ts adds the --text section of a binary-reported file after the "Binary files differ" one
  const binary = ['diff --git a/package.json b/package.json', 'index 1111111..2222222 100644', 'Binary files a/package.json and b/package.json differ'];
  const text = SECTION('package.json', ['@@ -1,2 +1,2 @@', '-  "version": "1.0.0",', '+  "version": "1.0.1",']);
  const blocks = matchedHunks(DEFAULT_SECURITY, [...binary, ...text].join('\n'), ['package.json'], { generated: [] });
  expect(blocks).toHaveLength(1);
  expect(blocks[0]).toContain('+  "version": "1.0.1",');
  // a file that stays binary keeps its one block
  expect(matchedHunks(DEFAULT_SECURITY, binary.join('\n'), ['package.json'], { generated: [] })).toEqual([binary.join('\n')]);
});

// post-phase review WR-02, bound lowered to 1000 by 8-ac-3 (D-09): a line over the scan limit is never scanned past character 1000, so it is a trigger of its own.
it('risk:resource a changed line over 1000 characters is matched on its first 1000 and says so, in an added and a removed line (8-ac-3)', () => {
  expect(SCAN_LINE_LIMIT).toBe(1000);
  const tail = 'require("child_process").execSync(x);';
  const added = SECTION('x.js', ['@@ -0,0 +1 @@', '+' + ' '.repeat(2100) + tail]).join('\n');
  expect(texts(added, ['x.js'])).toEqual(['x.js:1: (cannot tell: line longer than 1000 characters, not fully scanned)']);
  const removed = SECTION('x.js', ['@@ -1 +0,0 @@', '-' + ' '.repeat(2100) + tail]).join('\n');
  expect(texts(removed, ['x.js'])).toEqual(['x.js:1 (removed): (cannot tell: line longer than 1000 characters, not fully scanned)']);
  // a match inside the first 1000 characters is still its own trigger, beside the long line one
  const both = SECTION('x.js', ['@@ -0,0 +1 @@', '+' + tail + ' '.repeat(2100)]).join('\n');
  expect(texts(both, ['x.js'])).toEqual(['x.js:1: (cannot tell: line longer than 1000 characters, not fully scanned)', 'x.js:1: spawn (process spawn)']);
  // a line of exactly 1000 characters is scanned whole: no extra trigger; one more character adds the cut trigger, and the match inside the first 1000 stays
  const exact = SECTION('x.js', ['@@ -0,0 +1 @@', '+' + 'a'.repeat(1000 - tail.length) + tail]).join('\n');
  expect(texts(exact, ['x.js'])).toEqual(['x.js:1: spawn (process spawn)']);
  const over = SECTION('x.js', ['@@ -0,0 +1 @@', '+' + 'a'.repeat(1001 - tail.length) + tail]).join('\n');
  expect(texts(over, ['x.js'])).toEqual(['x.js:1: (cannot tell: line longer than 1000 characters, not fully scanned)', 'x.js:1: spawn (process spawn)']);
  // a line of 1500 characters (inside the old 2000 bound) is cut now
  const middle = SECTION('x.js', ['@@ -0,0 +1 @@', '+' + ' '.repeat(1500 - tail.length) + tail]).join('\n');
  expect(texts(middle, ['x.js'])).toEqual(['x.js:1: (cannot tell: line longer than 1000 characters, not fully scanned)']);
  // the skips hold for a long line too: Markdown, a test file and a generated path are not scanned
  for (const path of ['notes.md', 'src/x.test.ts', 'dist/x.js']) {
    const text = SECTION(path, ['@@ -0,0 +1 @@', '+' + ' '.repeat(2100) + tail]).join('\n');
    expect(texts(text, [path], ['dist/']), path).toEqual([]);
  }
  // the matched hunk of a long line is printed whole and once
  const blocks = matchedHunks(DEFAULT_SECURITY, added, ['x.js'], { generated: [] });
  expect(blocks).toHaveLength(1);
  expect(blocks[0]).toContain(tail);
});

// 8-ac-3 (D-09): the scan bound is per changed line, so many long lines cost one run per line and pattern, on at most SCAN_LINE_LIMIT characters.
// The scan exposes no counter, so the test counts the work itself: a spy on RegExp.prototype.test records the input length of each line pattern's run, and
// refuses to run on an input over the limit (a lost cut then fails an assertion instead of hanging the fork).
const MANY_LINES = [
  '# Security review',
  '',
  '## Patterns',
  '',
  '- two-a: line /a+a+$/ — x',
  '- two-dot: line /.*.*=/ — y',
  '- two-group: line /(.*a){2}$/ — z',
  '',
  '## Checklist',
  '',
  '## Removed',
  '',
].join('\n');
const addedFile = (path: string, line: string, count: number): string => SECTION(path, [`@@ -0,0 +1,${count} @@`, ...Array.from({ length: count }, () => '+' + line)]).join('\n');

it('risk:resource many long changed lines run each line pattern once per line on at most 1000 characters (8-ac-3)', () => {
  const spec = securitySpec(withFile(MANY_LINES));
  // the guard of 08-08 accepts the three shapes, and the four defaults are line patterns beside them
  expect(spec.problems).toEqual([]);
  const lineIds = spec.patterns.filter((p) => p.kind === 'line').map((p) => p.id).sort();
  expect(lineIds).toEqual(['built-path', 'file-write', 'secret-name', 'spawn', 'two-a', 'two-dot', 'two-group']);
  const idOf = new Map<string, string>();
  for (const p of spec.patterns) if (p.kind === 'line' && p.source !== undefined) idOf.set(new RegExp(p.source, p.flags ?? '').source, p.id);
  expect(idOf.size).toBe(7);

  const LINES = 100;
  const line = ('x'.repeat(999) + '=').repeat(100);
  expect(line.length).toBe(100_000);
  const diff = addedFile('src/data.js', line, LINES);

  const original = RegExp.prototype.test;
  let lengths: Record<string, number[]> = {};
  const spy = vi.spyOn(RegExp.prototype, 'test').mockImplementation(function (this: RegExp, input: string): boolean {
    const id = idOf.get(this.source);
    if (id === undefined) return original.call(this, input);
    (lengths[id] ??= []).push(input.length);
    if (input.length > SCAN_LINE_LIMIT) return false;
    return original.call(this, input);
  });
  try {
    const triggers = securityTriggers(spec, diff, ['src/data.js'], { generated: [] });
    const scan = { ...lengths };
    lengths = {};
    const hunks = matchedHunks(spec, diff, ['src/data.js'], { generated: [] });
    const hunkRuns = { ...lengths };
    spy.mockRestore();

    // one pass: each of the seven patterns ran once per line, never on more than the limit, and every line got its cut trigger
    expect(Object.keys(scan).sort()).toEqual(lineIds);
    for (const id of lineIds) {
      expect(scan[id], id).toHaveLength(LINES);
      expect(Math.max(...scan[id]), id).toBeLessThanOrEqual(SCAN_LINE_LIMIT);
    }
    expect(triggers.filter((t) => t.cannot === true)).toHaveLength(LINES);
    // the other 100 are `two-dot`, which matches the `=` inside the first 1000 characters of each line; no other pattern matches
    expect(triggers.filter((t) => t.cannot !== true).map((t) => t.pattern)).toEqual(Array.from({ length: LINES }, () => 'two-dot'));

    // matchedHunks adds one more pass of its own (its trigger pass) and runs nothing on a cut line itself
    for (const id of lineIds) {
      expect(hunkRuns[id]?.length ?? 0, id).toBeLessThanOrEqual(LINES);
      expect(Math.max(0, ...(hunkRuns[id] ?? [])), id).toBeLessThanOrEqual(SCAN_LINE_LIMIT);
    }
    expect(hunks).toHaveLength(1);
  } finally {
    spy.mockRestore();
  }

  // the defaults alone take no time on many 100,000-character lines (the generous bound is 5,000 ms; the regex work measures under 1 ms)
  const joins = addedFile('src/paths.js', 'join('.repeat(20_000), LINES);
  const started = performance.now();
  securityTriggers(DEFAULT_SECURITY, joins, ['src/paths.js'], { generated: [] });
  matchedHunks(DEFAULT_SECURITY, joins, ['src/paths.js'], { generated: [] });
  expect(performance.now() - started).toBeLessThan(5000);
});

it('risk:regression a security file written by 0.7.0, with its older security-config line, still reads clean and the current default applies', () => {
  const current = templates['security.md'].split('\n').find((l) => l.startsWith('- security-config:')) as string;
  const older = '- security-config: path accord/product/security.md, accord/config.yml — the security trigger list and the generated paths it skips';
  const spec = securitySpec(withFile(templates['security.md'].replace(current, older)));
  expect(spec.problems).toEqual([]);
  expect(spec.patterns.find((p) => p.id === 'security-config')?.entries).toEqual(['accord/product/security.md', 'accord/config.yml', '.gitattributes']);
  // any other value of a default is still a problem
  const other = securitySpec(withFile(templates['security.md'].replace(current, '- security-config: path accord/config.yml — x')));
  expect(other.problems).toHaveLength(1);
});

it('risk:resource a path the host could not read as text is a trigger of its own, listed and printed once (CR-01)', () => {
  const binary = ['diff --git a/big.js b/big.js', 'new file mode 100644', 'index 0000000..1111111', 'Binary files /dev/null and b/big.js differ'].join('\n');
  const label = '(cannot tell: big.js: too large to read as text, so its lines were not scanned)';
  expect(securityTriggers(DEFAULT_SECURITY, binary, ['big.js'], { generated: [], unreadable: ['big.js'] }).map(triggerText)).toEqual([label]);
  expect(securityTriggers(DEFAULT_SECURITY, binary, ['big.js'], { generated: [] })).toEqual([]);
  expect(matchedHunks(DEFAULT_SECURITY, binary, ['big.js'], { generated: [], unreadable: ['big.js'] })).toEqual([label]);
});

it('ac-2 a file accord does not write in a copy folder is scanned (BUG-LN-25)', () => {
  const helper = '.claude/skills/accord/helper.js';
  const diff = SECTION(helper, ['@@ -0,0 +1 @@', '+spawn(1);'], ['new file mode 100644', 'index 0000000..1111111']).join('\n');
  const rendered = ['.claude/skills/accord/SKILL.md', '.claude/accord-panel/plugin/hooks/register.js'];
  expect(securityTriggers(DEFAULT_SECURITY, diff, [helper], { generated: [], exempt: rendered }).map(triggerText)).toEqual([`${helper}:1: spawn (process spawn)`]);
  expect(securityTriggers(DEFAULT_SECURITY, diff, [helper], { generated: [] }).map(triggerText)).toEqual([`${helper}:1: spawn (process spawn)`]);
  const hunks = matchedHunks(DEFAULT_SECURITY, diff, [helper], { generated: [], exempt: rendered });
  expect(hunks).toHaveLength(1);
  expect(hunks[0]).toContain('+spawn(1);');
  // the same path in the exempt list is an unmodified copy: no content trigger and no hunk
  expect(securityTriggers(DEFAULT_SECURITY, diff, [helper], { generated: [], exempt: [helper] })).toEqual([]);
  expect(matchedHunks(DEFAULT_SECURITY, diff, [helper], { generated: [], exempt: [helper] })).toEqual([]);
});

it('ac-4 a change to agent configuration raises agent-config under a team security file (BUG-LN-25)', () => {
  const team = ['# Security review', '', '## Patterns', '', '- infra: path infra/ — infrastructure', '', '## Checklist', '', '## Removed', ''].join('\n');
  const spec = securitySpec(withFile(team));
  expect(spec.problems).toEqual([]);
  expect(ids(spec)).toContain('agent-config');
  const label = 'agent-config (agent configuration that can start commands)';
  const run = (s: ReturnType<typeof securitySpec>, path: string, head: string[], hunk: string[]) => {
    const diff = SECTION(path, hunk, head).join('\n');
    return securityTriggers(s, diff, [path], { generated: [] }).map(triggerText);
  };
  const settings = '.claude/settings.json';
  const added = ['new file mode 100644', 'index 0000000..1111111'];
  // added, edited and deleted: each is a trigger of its own
  expect(run(spec, settings, added, ['@@ -0,0 +1 @@', '+{}'])).toEqual([`${settings}: ${label}`]);
  expect(run(spec, settings, ['index 1111111..2222222 100644'], ['@@ -1,2 +1,2 @@', ' {', '-  "a": 1', '+  "a": 2'])).toEqual([`${settings}: ${label}`]);
  const gone = ['diff --git a/.claude/settings.json b/.claude/settings.json', 'deleted file mode 100644', 'index 1111111..0000000', '--- a/.claude/settings.json', '+++ /dev/null', '@@ -1 +0,0 @@', '-{}'].join('\n');
  expect(securityTriggers(spec, gone, [settings], { generated: [] }).map(triggerText)).toEqual([`${settings}: ${label}`]);
  // .mcp.json at any depth
  for (const mcp of ['.mcp.json', 'sub/.mcp.json']) {
    expect(run(spec, mcp, added, ['@@ -0,0 +1 @@', '+{}'])).toEqual([`${mcp}: ${label}`]);
  }
  // .claude/settings.json is the root file only
  expect(run(spec, 'sub/.claude/settings.json', added, ['@@ -0,0 +1 @@', '+{}'])).toEqual([]);

  // a Removed line takes the pattern out, with no problem
  const removed = securitySpec(withFile(team.replace('## Removed\n', '## Removed\n\n- Removed: agent-config — we review these files by hand\n')));
  expect(removed.problems).toEqual([]);
  expect(ids(removed)).not.toContain('agent-config');
  expect(run(removed, settings, added, ['@@ -0,0 +1 @@', '+{}'])).toEqual([]);

  // a team line with the id agent-config is one problem and the default still applies
  const clash = securitySpec(withFile(team.replace('- infra:', '- agent-config: path other.json — x\n- infra:')));
  expect(clash.problems).toHaveLength(1);
  expect(clash.patterns.find((p) => p.id === 'agent-config')?.entries).toEqual(['.claude/settings.json', '.mcp.json']);

  // no new checklist item (D-13)
  expect(spec.checklist.map((c) => c.id)).toEqual(CHECK_IDS);
  expect(spec.checklist).toHaveLength(8);
});

it('risk:security path patterns match ignoring letter case, the copy exemption and the generated skip stay exact (BUG-LN-25)', () => {
  const added = ['new file mode 100644', 'index 0000000..1111111'];
  const run = (path: string, options: { generated: string[]; exempt?: string[] } = { generated: [] }, line = '+{}') =>
    securityTriggers(DEFAULT_SECURITY, SECTION(path, ['@@ -0,0 +1 @@', line], added).join('\n'), [path], options).map(triggerText);
  const cfg = 'agent-config (agent configuration that can start commands)';
  // a case-insensitive file system opens each of these as the agent's configuration; the trigger names the path as the diff spells it
  for (const path of ['.MCP.json', 'sub/.Mcp.JSON', '.Claude/Settings.json']) expect(run(path)).toEqual([`${path}: ${cfg}`]);
  // the root-only rule of .claude/settings.json holds in any case
  expect(run('sub/.claude/settings.json')).toEqual([]);
  expect(run('sub/.CLAUDE/Settings.json')).toEqual([]);
  // folder prefixes and manifests (bare names) compare ignoring case too
  expect(run('.GITHUB/workflows/x.yml')).toEqual(['.GITHUB/workflows/x.yml: ci-workflow (CI workflow files)']);
  expect(run('web/Package.JSON')).toEqual(['web/Package.JSON: manifest (dependency manifests)']);
  // a team pattern is case-insensitive as well
  const team = securitySpec(withFile(['# Security review', '', '## Patterns', '', '- infra: path infra/, Deploy.sh — infrastructure', '', '## Checklist', '', '## Removed', ''].join('\n')));
  const diff = (path: string) => SECTION(path, ['@@ -0,0 +1 @@', '+x'], added).join('\n');
  expect(securityTriggers(team, diff('INFRA/a.tf'), ['INFRA/a.tf'], { generated: [] }).map((t) => t.pattern)).toEqual(['infra']);
  expect(securityTriggers(team, diff('bin/deploy.SH'), ['bin/deploy.SH'], { generated: [] }).map((t) => t.pattern)).toEqual(['infra']);
  // generated and exempt keep exact matching: a path that differs in case is still content-scanned
  expect(run('src/Gen/x.ts', { generated: ['src/gen/'] }, '+spawn(1);')).toEqual(['src/Gen/x.ts:1: spawn (process spawn)']);
  expect(run('src/gen/x.ts', { generated: ['src/gen/'] }, '+spawn(1);')).toEqual([]);
  expect(run('src/Helper.js', { generated: [], exempt: ['src/helper.js'] }, '+spawn(1);')).toEqual(['src/Helper.js:1: spawn (process spawn)']);
  expect(run('src/helper.js', { generated: [], exempt: ['src/helper.js'] }, '+spawn(1);')).toEqual([]);
});

// 8-ac-3 (D-07): a team line pattern that can backtrack catastrophically is refused when the file is read, so it never reaches the scan. The test asserts only the read verdict
// and never runs a refused regex on any input.
it('risk:security a backtracking team line pattern is refused at read with its line and how to rewrite it (8-ac-3)', () => {
  const text = [
    '## Patterns',
    '',
    '- slow: line /(a+)+$/ — a pattern that can hang',
    '- back: line /(a+)\\1/ — a backreference',
    '- overlap: line /(a|a)*$/ — alternatives that match the same text under a repeat',
    '- optional: line /(a?b?)*$/ — optional parts under a repeat',
    '- fine: line /\\bfoo\\b/ — a safe pattern',
    '',
  ].join('\n');
  const spec = parseSecurityFile(text);
  // the refused lines are problems at their own lines, marked as pattern problems, and neither reaches the patterns
  expect(spec.problems.map((p) => [p.line, p.pattern])).toEqual([[3, true], [4, true], [5, true], [6, true]]);
  expect(spec.problems[0].reason).toContain('"slow"');
  expect(spec.problems[0].reason).toContain('very slow');
  expect(spec.problems[0].reason).toContain('a+');
  expect(spec.problems[1].reason).toContain('"back"');
  expect(spec.problems[1].reason).toContain('backreference');
  expect(spec.problems[2].reason).toContain('"overlap"');
  expect(spec.problems[3].reason).toContain('"optional"');
  expect(spec.patterns.map((p) => p.id)).toEqual(['fine']);
  // the same lines are lint.security-file errors at their lines, and the merged spec carries them
  const lint = lintSnapshot(withFile(text)).findings.filter((f) => f.file === FILE);
  expect(lint.map((f) => [f.rule, f.level, f.line])).toEqual([3, 4, 5, 6].map((n) => ['lint.security-file', 'error', n]));
  expect(securitySpec(withFile(text)).patterns.map((p) => p.id)).not.toContain('slow');
  // a line that does not compile is a pattern problem too (it is not in force either)
  const broken = parseSecurityFile('## Patterns\n\n- broken: line /(/ — x\n');
  expect(broken.problems.map((p) => [p.line, p.pattern])).toEqual([[3, true]]);
  // a checklist or removed problem is not a pattern problem
  const other = parseSecurityFile('## Checklist\n\n- a check with no id\n');
  expect(other.problems).toHaveLength(1);
  expect(other.problems[0]).not.toHaveProperty('pattern');
  // the four default line patterns and the 0.8.0 built-path source read with no problem
  const builtOld = String.raw`\b(join|resolve|normalize)\s*\(.*\b(input|argv|args?|params?|query|body|req|request)\b`;
  expect(parseSecurityFile(`## Patterns\n\n- built-path: line /${builtOld}/ — paths built from input\n`).problems).toEqual([]);
  expect(DEFAULT_SECURITY.problems).toEqual([]);
});
