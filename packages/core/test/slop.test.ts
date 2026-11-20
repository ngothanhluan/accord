// Phase 8.1 G4a (D-14, D-15, D-20): the slop patterns, their file, and the scan that matches them against a package's diff text.
import { expect, it } from 'vitest';
import { DEFAULT_SECURITY, isLockfile, loadSnapshot, securityTriggers, slopHits, slopLine, slopSpec, triggerText } from '../src/index.js';

/** A snapshot with no slop file: the defaults apply. */
const snapshot = () => loadSnapshot({ files: {}, tree: [] });

/** A diff that adds `lines` as a new file at `path`; the first added line is line 1. */
const added = (path: string, lines: string[]): string =>
  [`diff --git a/${path} b/${path}`, 'new file mode 100644', 'index 0000000..1111111', '--- /dev/null', `+++ b/${path}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => '+' + l)].join('\n');

const THREE = ['const a = 1;', 'const b = 2;', 'try { x(); } catch {}'];
const kinds = (diff: string, options: { generated?: string[]; exempt?: string[] } = {}) =>
  slopHits(slopSpec(snapshot()), diff, { generated: options.generated ?? [], exempt: options.exempt }).map((h) => `${h.kind} ${h.path}:${h.line}`);

it('risk:parsing the built-in empty-catch pattern flags an added empty catch in TypeScript code (8.1-ac-12)', () => {
  const hits = slopHits(slopSpec(snapshot()), added('src/a.ts', THREE), { generated: [] });
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({ kind: 'empty-catch', path: 'src/a.ts', line: 3 });
  expect(slopLine(hits[0])).toMatch(/^- slop:empty-catch src\/a\.ts:3 — \S/);
  // the same text in Markdown is prose, and a commented-out catch is not a catch
  expect(kinds(added('README.md', THREE))).toEqual([]);
  expect(kinds(added('src/a.ts', ['const a = 1;', 'const b = 2;', '// } catch {}']))).toEqual([]);
  // a pattern scoped to TypeScript and JavaScript does not read a file of another language
  expect(kinds(added('app/a.go', THREE))).toEqual([]);
});

it('risk:regression the slop scan judges added lines in test files and skips only Markdown and generated files (D-20)', () => {
  const catchAt3 = ['x', 'y', '} catch {}'];
  expect(kinds(added('src/a.test.ts', catchAt3))).toEqual(['empty-catch src/a.test.ts:3']);
  expect(kinds(added('test/b.ts', catchAt3))).toEqual(['empty-catch test/b.ts:3']);
  expect(kinds(added('src/a.spec.js', catchAt3))).toEqual(['empty-catch src/a.spec.js:3']);
  // skipped: Markdown, a `generated:` path, an exact rendered copy
  expect(kinds(added('docs/x.md', catchAt3))).toEqual([]);
  expect(kinds(added('gen/out.ts', catchAt3), { generated: ['gen/'] })).toEqual([]);
  expect(kinds(added('.claude/accord-panel/x.js', catchAt3), { exempt: ['.claude/accord-panel/x.js'] })).toEqual([]);
  // a hand-edited copy is not exempt: the caller leaves it out of `exempt`, so it is scanned
  expect(kinds(added('.claude/accord-panel/x.js', catchAt3))).toEqual(['empty-catch .claude/accord-panel/x.js:3']);
  // dependency lockfiles, in any folder, are generated files for this scan
  for (const lock of ['package-lock.json', 'web/yarn.lock', 'go.sum', 'pnpm-lock.yaml', 'Cargo.lock', 'sub/packages.lock.json']) {
    expect(kinds(added(lock, catchAt3)), lock).toEqual([]);
  }
  expect(isLockfile('package.json')).toBe(false);
  expect(isLockfile('src/yarn.lock.ts')).toBe(false);
  expect(isLockfile('web/yarn.lock')).toBe(true);
  // the security triggers of the same diffs are unchanged: a test file is still skipped, a lockfile is still read
  const spawn = ["spawnSync('git', ['status']);"];
  expect(securityTriggers(DEFAULT_SECURITY, added('src/a.test.ts', spawn), ['src/a.test.ts'], { generated: [] }).map(triggerText)).toEqual([]);
  expect(securityTriggers(DEFAULT_SECURITY, added('web/yarn.lock', spawn), ['web/yarn.lock'], { generated: [] }).map(triggerText)).toEqual([
    'web/yarn.lock: manifest (dependency manifests)',
    'web/yarn.lock:1: spawn (process spawn)',
  ]);
});
