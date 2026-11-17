// ST-LN-36 (05-04): the default security patterns, the file that holds them and the reader that matches them against a package's diff text.
import { expect, it } from 'vitest';
import { DEFAULT_SECURITY, LOCKED, lintSnapshot, loadSnapshot, parseSecurityFile, securitySpec, securityTriggers, templates, triggerText } from '../src/index.js';

const FILE = 'accord/product/security.md';
/** A snapshot holding only the security file (or none): securitySpec reads nothing else. */
const withFile = (text?: string) => loadSnapshot({ files: text === undefined ? {} : { [FILE]: text }, tree: text === undefined ? [] : [FILE] });
const DEFAULT_IDS = ['spawn', 'file-write', 'built-path', 'ci-workflow', 'manifest', 'secret-name'];
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

it('ac-1 the patterns in force are the defaults plus additions minus Removed lines (ST-LN-36 36-ac-1)', () => {
  const text = edit('Removed', '- Removed: secret-name — our design tokens are not secrets', '').replace(
    '- secret-name:',
    '- infra: path infra/ — infrastructure\n- secret-name:',
  );
  const spec = securitySpec(withFile(text));
  expect(spec.problems).toEqual([]);
  // the template names six defaults; one is removed and one is added, so six are in force, the team's after the defaults
  expect(ids(spec)).toEqual(['spawn', 'file-write', 'built-path', 'ci-workflow', 'manifest', 'infra']);
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
  expect(ids(s)).toEqual(['file-write', 'built-path', 'ci-workflow', 'manifest', 'secret-name', 'infra']);
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
