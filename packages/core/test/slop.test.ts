// Phase 8.1 G4a (D-14, D-15, D-20): the slop patterns, their file, and the scan that matches them against a package's diff text.
import { expect, it } from 'vitest';
import { DEFAULT_SECURITY, DEFAULT_SLOP, isLockfile, lintSnapshot, loadSnapshot, parseSlop, securityTriggers, slopHits, slopLine, SLOP_FILE, slopSpec, templates, triggerText } from '../src/index.js';

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

// ---- the default sets, the team file, its guard and lint (D-15, D-16, 8.1-ac-14) ----

/** Per default kind: a file name whose extension its scope must hold, lines it must match and lines it must not (prose, plain code, a commented-out line for the code kinds). */
const SAMPLES: Record<string, { file: string; pos: string[]; neg: string[] }> = {
  'empty-catch': { file: 'a.ts', pos: ['} catch {}', '} catch (e) { }', 'try { x(); } catch {}'], neg: ['// } catch {}', ' * catch {}', '} catch (e) { log(e); }', 'const caught = 1;'] },
  'empty-catch-cs': { file: 'A.cs', pos: ['catch { }', 'catch (Exception) { }', '} catch (IOException ex) {}'], neg: ['catch (Exception ex) { Log(ex); }', '// catch { }', 'var c = 1;'] },
  'empty-catch-py': { file: 'a.py', pos: ['except: pass', '    except ValueError: pass', 'except (A, B) as e: pass'], neg: ['except ValueError:', '# except: pass', 'x = 1'] },
  'any-type': {
    file: 'a.ts',
    pos: ['const a: any = x;', 'const b = y as any;', 'const c = d as unknown as Foo;', 'function f(a: any) {}', 'const e = <any>q;'],
    neg: ['const a: string = x;', '// the value may be any', 'claim: anything', 'const many = 1;'],
  },
  'any-type-cs': { file: 'A.cs', pos: ['dynamic x = 1;', 'public dynamic Foo()', 'var l = new List<dynamic>();', 'void F(dynamic a, int b)'], neg: ['// dynamic x = 1;', 'var dynamicRange = 1;', 'the dynamic range is large'] },
  'any-type-py': { file: 'a.py', pos: ['def f(x: Any) -> None:', 'def g() -> Any:', 'y = cast(Any, x)', 'd: Dict[str, Any] = {}'], neg: ['# x: Any', 'many: int = 1', 'x: Anything = 2'] },
  'commented-code': {
    file: 'a.ts',
    pos: ['// const x = foo(1);', '// if (a) {', '// return x;', '// import { a } from "b";', '// doThing(a, b);', '// }'],
    neg: ['// for the SessionStart hook', '// try on purpose', 'const a = 1; // note', '// a plain sentence about the code'],
  },
  'commented-code-cs': {
    file: 'A.cs',
    pos: ['// var x = Foo(1);', '// if (a) {', '// return x;', '// Foo(a, b);', '// }', '// using (var f = File.Open(p))'],
    neg: ['// for the hook', '/// <summary>', '// the value of x'],
  },
  'commented-code-py': {
    file: 'a.py',
    pos: ['# import os', '# from a import b', '# def f(x):', '# print(x)', '# x = foo(1)', '# return foo(x)'],
    neg: ['# for the SessionStart hook', '# if the user is root', '# return the value', '# import is needed for typing', 'x = 1  # note'],
  },
  'commented-code-html': { file: 'a.html', pos: ['<!-- <div class="a"> -->', '<!--<script src="x"></script>-->'], neg: ['<!-- the header -->', '<!-- TODO: fix -->'] },
  'commented-code-css': { file: 'a.css', pos: ['/* .a { color: red; } */', '/* #id{color:red} */'], neg: ['/* the header */', '/* colours */'] },
  'important-css': { file: 'a.css', pos: ['color: red !important;', 'a { margin: 0 ! IMPORTANT }'], neg: ['color: red;', '/* an important note */'] },
  'inline-style-html': { file: 'a.html', pos: ['<div style="color:red">', "<p style='x'>", '<p STYLE = "x">'], neg: ['<style>', '<div class="style">', 'lifestyle="x"'] },
};

it('risk:regression every default slop pattern parses and passes the guard with positive and negative samples (D-16)', () => {
  expect(DEFAULT_SLOP.problems).toEqual([]);
  expect(DEFAULT_SLOP.patterns.map((p) => p.id)).toEqual(Object.keys(SAMPLES));
  for (const p of DEFAULT_SLOP.patterns) {
    const s = SAMPLES[p.id];
    const re = new RegExp(p.source, p.flags);
    const ext = s.file.slice(s.file.lastIndexOf('.')).toLowerCase();
    expect(p.exts, p.id).toContain(ext);
    for (const line of s.pos) expect(re.test(line), `${p.id} must match: ${line}`).toBe(true);
    for (const line of s.neg) expect(re.test(line), `${p.id} must not match: ${line}`).toBe(false);
  }
  // each language row is limited to its own files: Python's except is no hit in TypeScript, a `!important` is no hit in C#
  expect(kinds(added('src/a.ts', ['except: pass', 'color: red !important;']))).toEqual([]);
  expect(kinds(added('src/A.cs', ['color: red !important;']))).toEqual([]);
  expect(kinds(added('web/a.css', ['color: red !important;']))).toEqual(['important-css web/a.css:1']);
  expect(kinds(added('app/a.py', ['try:', 'except: pass']))).toEqual(['empty-catch-py app/a.py:2']);
});

const withTeamFile = (text: string) => loadSnapshot({ files: { [SLOP_FILE]: text }, tree: [SLOP_FILE] });
const teamFile = (...lines: string[]) => ['# Slop patterns', '', '## Patterns', '', ...lines, '', '## Removed', ''].join('\n');

it('risk:security a team slop pattern that can backtrack catastrophically is refused at read (8.1-ac-14)', () => {
  const text = teamFile('- slow: line /(a+)+$/ — slow', '- fine: line /\\bpanic\\(/ for .go — panic in Go');
  const parsed = parseSlop(text);
  expect(parsed.patterns.map((p) => p.id)).toEqual(['fine']);
  expect(parsed.problems).toHaveLength(1);
  expect(parsed.problems[0]).toMatchObject({ line: 5, pattern: true });
  expect(parsed.problems[0].reason).toContain('"slow"');
  expect(parsed.problems[0].reason).toContain('very slow');
  // not in force: the merged spec has the defaults and the sound team pattern, not the refused one
  const merged = withTeamFile(text);
  expect(slopSpec(merged).patterns.map((p) => p.id)).not.toContain('slow');
  expect(slopSpec(merged).patterns.map((p) => p.id)).toContain('fine');
  // lint.slop-file reports it with the file and line
  const found = lintSnapshot(merged).findings.filter((f) => f.rule === 'lint.slop-file');
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ level: 'error', file: SLOP_FILE, line: 5 });
  expect(found[0].reason).toContain('very slow');
  // an absent file and an untouched template give no finding
  expect(lintSnapshot(loadSnapshot({ files: {}, tree: [] })).findings.filter((f) => f.rule === 'lint.slop-file')).toEqual([]);
  expect(lintSnapshot(withTeamFile(templates['slop.md'])).findings.filter((f) => f.rule === 'lint.slop-file')).toEqual([]);
});

it('risk:parsing a team slop pattern is limited by its for scope, replaces a default with the same id and is read only from its own sections (D-15)', () => {
  const go = withTeamFile(teamFile('- panic-go: line /\\bpanic\\(/ for .go — panic in Go'));
  const hits = (path: string) => slopHits(slopSpec(go), added(path, ['x', 'panic("boom")']), { generated: [] }).map((h) => `${h.kind} ${h.path}:${h.line}`);
  expect(hits('cmd/x.go')).toEqual(['panic-go cmd/x.go:2']);
  expect(hits('src/b.ts')).toEqual([]);
  // no `for`: every scanned file
  const all = withTeamFile(teamFile('- hack-marker: line /\\bHACK\\b/ — a hack marker'));
  expect(slopHits(slopSpec(all), added('x/y.rb', ['a', '# HACK']), { generated: [] }).map((h) => h.kind)).toEqual(['hack-marker']);
  // a team pattern with a default's id replaces the default
  const mine = withTeamFile(teamFile('- empty-catch: line /catch\\s*\\{\\}/ for .ts — my own wording'));
  const rule = slopSpec(mine).patterns.filter((p) => p.id === 'empty-catch');
  expect(rule).toHaveLength(1);
  expect(rule[0]).toMatchObject({ label: 'my own wording', exts: ['.ts'] });
  // problems: a path pattern, a bad scope, an upper-case extension, an id in upper case, a repeated id, an unknown heading, a repeated heading
  const bad = parseSlop(
    ['## Patterns', '- p1: path src/ — a path', '- p2: line /x/ for ts — no dot', '- p3: line /x/ for .TS — upper case', '- P4: line /x/ — upper id', '- p5: line /x/ — one', '- p5: line /y/ — twice', '## Checklist', '## Patterns'].join('\n'),
  );
  expect(bad.problems.map((p) => p.line)).toEqual([2, 3, 4, 5, 7, 8, 9]);
  expect(bad.problems[0].reason).toContain('line pattern');
  expect(bad.problems[1].reason).toContain('.<ext>');
  expect(bad.problems[5].reason).toContain('not a section');
  expect(bad.problems[6].reason).toContain('appears twice');
  // Removed: a default, a structural kind, an unknown id, a default removed twice
  const removed = slopSpec(
    withTeamFile(['## Patterns', '', '## Removed', '- Removed: any-type — we write generics', '- Removed: new-dependency — a lockfile review does it', '- Removed: nothing-here — oops', '- Removed: any-type — again'].join('\n')),
  );
  expect(removed.patterns.map((p) => p.id)).not.toContain('any-type');
  expect(removed.removed.map((r) => r.id)).toEqual(['any-type', 'new-dependency']);
  expect(removed.problems.map((p) => p.line)).toEqual([6, 7]);
});

// --- WR-02: a line over the scan limit and a binary code file are reported, not skipped, as the security scan reports them ---

it('risk:security a changed line over the scan limit in a scanned file is an unscanned hit, so padding cannot clear the gate (WR-02)', () => {
  const padded = ' '.repeat(1100) + 'try { x(); } catch {}';
  const diff = added('src/a.ts', ['const a = 1;', padded]);
  // the pattern still matches only the first 1000 characters, so the padded catch is not found, but the line is named
  expect(kinds(diff)).toEqual(['unscanned src/a.ts:2']);
  const hits = slopHits(slopSpec(snapshot()), diff, { generated: [] });
  expect(slopLine(hits[0])).toBe('- slop:unscanned src/a.ts:2 — line longer than 1000 characters, only its first 1000 were scanned');
  // a line of exactly the limit is scanned whole and names nothing
  expect(kinds(added('src/a.ts', ['x'.repeat(1000)]))).toEqual([]);
  // a file no pattern applies to, and a skipped file, hide nothing
  expect(kinds(added('data/a.csv', ['x'.repeat(1100)]))).toEqual([]);
  expect(kinds(added('docs/a.md', ['x'.repeat(1100)]))).toEqual([]);
  expect(kinds(added('gen/a.ts', ['x'.repeat(1100)]), { generated: ['gen/'] })).toEqual([]);
});

it('risk:security a binary code file with no text section is an unscanned hit and a known binary type is not (WR-02)', () => {
  const binary = (path: string) => ['diff --git a/' + path + ' b/' + path, 'new file mode 100644', 'index 0000000..1111111', 'Binary files /dev/null and b/' + path + ' differ'].join('\n');
  const hits = slopHits(slopSpec(snapshot()), binary('src/a.ts'), { generated: [] });
  expect(hits.map(slopLine)).toEqual(['- slop:unscanned src/a.ts:1 — binary file, its lines were not scanned']);
  expect(kinds(binary('img/a.png'))).toEqual([]);
  expect(kinds(binary('docs/a.pdf'))).toEqual([]);
  // the same path with a text section (package-diff adds one) is scanned as text
  expect(kinds(binary('src/a.ts') + '\n' + added('src/a.ts', THREE))).toEqual(['empty-catch src/a.ts:3']);
});

// Phase 08.8 D-12: the slop scan runs team patterns over the whole diff, so it carries the same per-package budget as the security scan (the budget is passed small to keep the case quick).
it('risk:resource the slop scan stops an overlapping team pattern at the budget with one unscanned hit (D-12)', { timeout: 120_000 }, () => {
  const spec = slopSpec(withTeamFile(teamFile('- slow: line /a*a*b/ — a hostile overlap')));
  expect(spec.patterns.map((p) => p.id)).toContain('slow');
  const hostile = added('src/x.ts', Array.from({ length: 100 }, () => 'a'.repeat(1000)));
  const start = performance.now();
  const hits = slopHits(spec, hostile, { generated: [], overlapBudget: 3_000_000 });
  expect(performance.now() - start).toBeLessThan(10_000);
  // four lines of 1000 characters pass the budget, so the fifth is the first one left unread
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({ kind: 'unscanned', path: 'src/x.ts', line: 5 });
  expect(hits[0].label).toContain('scan budget');
  // ordinary lines give the same hits as with the budget out of reach
  const ordinary = added('src/y.ts', Array.from({ length: 2000 }, (_, i) => (i % 7 === 0 ? 'try { run(); } catch {}' : `const value${i} = compute(${i}); // an ordinary line`)));
  const same = slopHits(slopSpec(snapshot()), ordinary, { generated: [] });
  expect(same.length).toBeGreaterThan(0);
  expect(slopHits(slopSpec(snapshot()), ordinary, { generated: [], overlapBudget: Infinity })).toEqual(same);
  // a shipped default is never budgeted, even at a budget of one: empty-catch reads all 100 lines
  const spaced = added('src/z.ts', Array.from({ length: 100 }, () => 'catch' + ' '.repeat(900)));
  expect(slopHits(slopSpec(snapshot()), spaced, { generated: [], overlapBudget: 1 })).toEqual([]);
});
