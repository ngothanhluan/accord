// CLI-08 `accord skills sync` end to end, in-process through runCli with injected streams and an explicit
// cwd (STACK Decision 7). Two contracts carry the weight: what it writes on a first run, and what it refuses
// to touch on a second (D-112 — "a second run is a no-op" is a claim about writes, not only about bytes).
// Every case runs in its own mkdtemp sandbox, so no test can reach the fixture directory it was copied from
// or the accord repository it runs in.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { contentHash, normaliseText, withoutMarker } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { writeSkillFiles } from '../src/commands/skills.js';
import { cleanup, makeRepo, run } from './helpers/repo.js';
import type { ReportRow } from '../src/commands/skills.js';

const bytes = (file: string): string => readFileSync(file, 'latin1'); // byte-exact, no encoding fixups
const at = (repo: string, path: string): string => join(repo, ...path.split('/'));
/** The directory out of each orphan line, in the order they were printed. */
const orphanDirs = (err: string): string[] =>
  err.split('\n').filter((l) => l !== '').map((l) => l.split(' ')[1]);
const DESIGNER = ['.claude/skills/accord-designer/SKILL.md', '.agents/skills/accord-designer/SKILL.md'];

/** Every path under both target directories, sorted — the whole of what a run may have written. */
function listing(repo: string): string[] {
  const out: string[] = [];
  for (const dir of ['.claude/skills', '.agents/skills']) {
    const abs = at(repo, dir);
    if (!existsSync(abs)) continue;
    for (const d of readdirSync(abs, { recursive: true, withFileTypes: true })) {
      out.push(join(d.parentPath, d.name));
    }
  }
  return out.sort();
}

/** The `accord-*` entry names the sandbox actually holds, read back off disk rather than written as literals. */
function entryNames(repo: string): string[] {
  const out = new Set<string>();
  for (const dir of ['.claude/skills', '.agents/skills']) {
    const abs = at(repo, dir);
    if (!existsSync(abs)) continue;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory() && e.name.startsWith('accord-')) out.add(e.name);
    }
  }
  return [...out];
}

// Every case makes its own repository; this collects them so a failing assertion still cleans up.
const repos: string[] = [];
function sandbox(fixture = 'valid-build'): string {
  const repo = makeRepo(fixture);
  repos.push(repo);
  // The shared fixture rosters `[ba, dev]`; only `designer` has a definition in this plan.
  setConfig(repo, /^roles: .*$/m, 'roles: [ba, dev, designer]');
  setConfig(repo, /^runtimes: .*$/m, 'runtimes: [claude, codex]');
  return repo;
}
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/** Rewrite the sandbox copy's config.yml; the shared fixture is never touched. */
function setConfig(repo: string, find: RegExp, replace: string): void {
  const file = join(repo, 'accord', 'config.yml');
  writeFileSync(file, readFileSync(file, 'utf8').replace(find, replace));
}

describe('accord skills sync — what it writes', () => {
  it('creates one copy per runtime directory, prints a line each, and exits 0', async () => {
    const repo = sandbox();
    const { code, out } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    const lines = out.split('\n').filter((l) => l !== '');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line, line).toMatch(/^created /);
    for (const path of DESIGNER) expect(existsSync(at(repo, path)), path).toBe(true);
  });

  it('a second run reports unchanged on every line and leaves every byte alone', async () => {
    const repo = sandbox();
    await run(['skills', 'sync'], repo);
    const before = DESIGNER.map((p) => bytes(at(repo, p)));
    const { code, out } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    const lines = out.split('\n').filter((l) => l !== '');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line, line).toMatch(/^unchanged /);
    expect(DESIGNER.map((p) => bytes(at(repo, p)))).toEqual(before);
  });

  it('a second run performs no write at all, not merely the same bytes (D-112)', async () => {
    const repo = sandbox();
    await run(['skills', 'sync'], repo);
    // RESEARCH.md Pitfall 5: a "render, write, compare" implementation is byte-identical and still wrong —
    // the mtime moves, so the no-op is true to a reader and false to a watcher. An unchanged mtime is the
    // least flaky way to say "writeFileSync was not called" on Windows.
    const before = DESIGNER.map((p) => statSync(at(repo, p)).mtimeMs);
    expect(before.length).toBeGreaterThan(0);
    await run(['skills', 'sync'], repo);
    expect(DESIGNER.map((p) => statSync(at(repo, p)).mtimeMs)).toEqual(before);
  });

  it('prints no backslash and nothing outside ASCII on any host (D-51, PITFALLS section 12)', async () => {
    const repo = sandbox();
    const first = await run(['skills', 'sync'], repo);
    setConfig(repo, /^roles: .*$/m, 'roles: [ba, dev]'); // leaves accord-designer orphaned, so stderr is exercised too
    const second = await run(['skills', 'sync'], repo);
    const out = first.out + second.out;
    const err = first.err + second.err;
    expect(out).toContain(DESIGNER[0]);
    expect(err).toContain('accord-designer');
    // Unlike `lint` and `gate`, which quote ticket text and are therefore only as ASCII as the repository
    // they read, `sync` COMPOSES three things, and those are what this asserts: the status word, the
    // `DIRS`-rooted path prefix, and the orphan advisory text. The `accord-*` entry name inside an orphan
    // line is not one of them — it is read off the user's disk, and printing it verbatim is the point
    // (the case below), because that name is what removes the directory. So it is taken out of a stderr
    // line before the scan. What remains is the reason the marker and every status line use a hyphen
    // rather than a dash, asserted here rather than left to the convention holding.
    const offends = (line: string): boolean => line.includes('\\') || /[^\x20-\x7e]/.test(line);
    const names = entryNames(repo);
    expect(names).toContain('accord-designer');
    const composed = (line: string): string => names.reduce((l, n) => l.split(n).join(''), line);

    const onStdout = out.split('\n').find(offends); // whole line: every segment of it is accord's own
    expect(onStdout, `stdout: ${onStdout}`).toBeUndefined();
    const onStderr = err.split('\n').find((line) => offends(composed(line)));
    expect(onStderr, `stderr: ${onStderr}`).toBeUndefined();
  });

  it('prints an accord-* name from the disk verbatim, above U+007F and all (NF-02)', async () => {
    const repo = sandbox();
    // Undeclared, so the whole directory is the user's and so is the name accord reads out of it.
    setConfig(repo, /^runtimes: .*$/m, 'runtimes: [claude]');
    mkdirSync(at(repo, '.agents/skills/accord-café'), { recursive: true });

    const { code, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    // Read back, never the literal above: a host filesystem may normalise the name it stored, and the
    // claim is that whatever it stored is what the reader is shown.
    const planted = readdirSync(at(repo, '.agents/skills')).find((n) => /[^\x20-\x7e]/.test(n));
    expect(planted).toBeDefined();
    expect(err).toContain('.agents/skills/' + planted);
  });
});

describe('accord skills sync — the states a second run reports (D-112)', () => {
  const first = DESIGNER[0];

  it('rewrites an intact copy that is behind the definition, and calls it updated', async () => {
    const repo = sandbox();
    await run(['skills', 'sync'], repo);
    const fresh = readFileSync(at(repo, first), 'utf8');
    // The only way to reach `updated` by hand is to edit the file *and* re-hash it, because that is the
    // state a newer definition produces: text that differs from the render while its own marker still
    // describes it. So the marker is rewritten over the edited body, exactly as a render would.
    const lines = withoutMarker(normaliseText(fresh)).split('\n');
    const after = lines.indexOf('---', 1) + 1; // the marker sits just after the closing frontmatter fence
    lines.splice(after, 0, 'an older definition wrote this.');
    const marker = '<!-- generated by accord skills sync - do not edit - ' + contentHash(lines.join('\n')) + ' -->';
    writeFileSync(at(repo, first), [...lines.slice(0, after), marker, ...lines.slice(after)].join('\n'));

    const { code, out } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    const reported = out.split('\n').filter((l) => l !== '');
    expect(reported).toContain('updated ' + first);
    expect(readFileSync(at(repo, first), 'utf8')).toBe(fresh);
    for (const line of reported.filter((l) => !l.endsWith(first))) expect(line, line).toMatch(/^unchanged /);
  });

  it.each([
    ['an appended line and an untouched marker', (text: string): string => text + 'a hand edit\n'],
    ['no marker line at all', (text: string): string => withoutMarker(normaliseText(text))],
  ])('overwrites %s, says so, and still exits 0', async (_name, edit) => {
    const repo = sandbox();
    await run(['skills', 'sync'], repo);
    const fresh = readFileSync(at(repo, first), 'utf8');
    writeFileSync(at(repo, first), edit(fresh));

    const { code, out } = await run(['skills', 'sync'], repo);
    // An absent stored hash and a differing one are one state, not two: in both the file on disk is not
    // something accord wrote, and the report must say the edit was lost rather than lose it silently.
    expect(code).toBe(0);
    expect(out.split('\n')).toContain('overwrote local edits ' + first);
    expect(readFileSync(at(repo, first), 'utf8')).toBe(fresh);
    expect(readFileSync(at(repo, first), 'utf8')).not.toContain('a hand edit');
  });
});

describe('accord skills sync — the orphan report (D-113, D-123)', () => {
  it('names an undeclared accord-* directory on stderr, deletes nothing, and still exits 0', async () => {
    const repo = sandbox();
    await run(['skills', 'sync'], repo);
    const before = DESIGNER.map((p) => bytes(at(repo, p)));
    // A roster change is the whole point: designer's copies stay on disk, declared by nobody.
    setConfig(repo, /^roles: .*$/m, 'roles: [ba, dev]');

    const { code, out, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    for (const path of DESIGNER) expect(existsSync(at(repo, path)), path).toBe(true);
    expect(DESIGNER.map((p) => bytes(at(repo, p)))).toEqual(before);
    for (const dir of ['.claude/skills/accord-designer', '.agents/skills/accord-designer']) {
      expect(err, dir).toContain(dir);
    }
    expect(err).toMatch(/remove it with: \S+/);
    // The write report is about what was written; an orphan is not a file this run touched.
    expect(out).not.toContain('accord-designer');
  });

  it('reports nothing when every accord-* directory is still declared', async () => {
    const repo = sandbox();
    await run(['skills', 'sync'], repo);
    const { code, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    expect(err).toBe('');
  });

  it('names an accord-* directory a dropped runtime left behind, the same way (D-113)', async () => {
    const repo = sandbox();
    await run(['skills', 'sync'], repo);
    // `sandbox()` rosters all three roles, so dropping codex abandons three directories, not two.
    const abandoned = [
      '.agents/skills/accord-ba',
      '.agents/skills/accord-designer',
      '.agents/skills/accord-dev',
    ];
    const before = abandoned.map((d) => bytes(at(repo, d + '/SKILL.md')));
    setConfig(repo, /^runtimes: .*$/m, 'runtimes: [claude]');

    const { code, out, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    // An exact list, in order — not a `toContain` per line, so the sorted-order claim is itself asserted.
    expect(orphanDirs(err)).toEqual(abandoned);
    for (const d of abandoned) expect(existsSync(at(repo, d + '/SKILL.md')), d).toBe(true);
    expect(abandoned.map((d) => bytes(at(repo, d + '/SKILL.md')))).toEqual(before);
    expect(err).toMatch(/remove it with: \S+/);
    expect(out).not.toContain('.agents/');
  });

  it('reports nothing when the declared set is already the whole table (runtimes: [cursor])', async () => {
    const repo = sandbox();
    setConfig(repo, /^runtimes: .*$/m, 'runtimes: [cursor]');
    await run(['skills', 'sync'], repo);
    const { code, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    expect(err).toBe('');
  });

  it('leaves no accord-* directory unreported, whichever runtime is dropped', async () => {
    // The assumption this pins: while the scan iterated the DECLARED directories, an abandoned target
    // directory was never opened, so nothing under it could be reported and this difference was silently
    // non-empty. It goes red again the moment the scan narrows back to the declared subset.
    const repo = sandbox();
    await run(['skills', 'sync'], repo);
    const declaredRoles = new Set(['accord-ba', 'accord-dev', 'accord-designer']);
    for (const [line, declaredDir] of [
      ['runtimes: [claude]', '.claude/skills'],
      ['runtimes: [codex]', '.agents/skills'],
    ]) {
      setConfig(repo, /^runtimes: .*$/m, line);
      const { err } = await run(['skills', 'sync'], repo);
      const reported = new Set(orphanDirs(err));
      const unaccounted = listing(repo)
        .map((p) => relative(repo, p).split(sep).join('/'))
        .filter((p) => /^\.(?:claude|agents)\/skills\/accord-[^/]+$/.test(p))
        .filter((p) => {
          const declared =
            p.startsWith(declaredDir + '/') && declaredRoles.has(p.slice(p.lastIndexOf('/') + 1));
          return !declared && !reported.has(p);
        });
      expect(unaccounted, line).toEqual([]);
    }
  });

  it('never names a directory it did not generate (D-123)', async () => {
    const repo = sandbox();
    // Planted under both, with codex dropped, so the prefix filter is proven on the newly-scanned
    // directory too — the one the declared-subset scan never opened.
    const decoys = ['.claude/skills/some-other-tool', '.agents/skills/some-other-tool'];
    for (const dir of decoys) {
      mkdirSync(at(repo, dir), { recursive: true });
      writeFileSync(at(repo, dir + '/SKILL.md'), 'not accords business\n');
    }
    setConfig(repo, /^roles: .*$/m, 'roles: [ba, dev]');
    setConfig(repo, /^runtimes: .*$/m, 'runtimes: [claude]');

    const { code, out, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    expect(out + err).not.toContain('some-other-tool');
    for (const dir of decoys) expect(existsSync(at(repo, dir + '/SKILL.md')), dir).toBe(true);
  });
});

describe('accord skills sync — what it refuses before writing anything', () => {
  /** Every path under both target directories, sorted — the listing a refusal must leave untouched. */
  it('exits 2 on a pin mismatch and writes nothing at all (D-121, D-95)', async () => {
    const repo = sandbox();
    const before = listing(repo);
    expect(before).toEqual([]);
    setConfig(repo, /^accord: .*$/m, 'accord: "9.9.9"');

    const { code, out, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(2);
    expect(err).toContain('9.9.9');
    expect(err).toContain(pkg.version);
    expect(out).toBe('');
    // The pin is checked in preflight, before `skills` is ever called, so this holds by construction —
    // asserted anyway, because "no file was written" is the property the contract promises.
    expect(listing(repo)).toEqual(before);
  });

  it('exits 2 in a repository with no accord/ folder and writes nothing', async () => {
    const repo = sandbox();
    rmSync(join(repo, 'accord'), { recursive: true, force: true });
    const { code, out, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(2);
    expect(err).toContain('no accord/ folder');
    expect(out).toBe('');
    expect(listing(repo)).toEqual([]);
  });
});

describe('accord skills sync — what the config filters', () => {
  it('a roster without designer writes no accord-designer directory at all (D-113)', async () => {
    const repo = sandbox();
    setConfig(repo, /^roles: .*$/m, 'roles: [ba, dev]');
    const { code, out } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    expect(out).not.toContain('accord-designer');
    for (const dir of ['.claude/skills/accord-designer', '.agents/skills/accord-designer']) {
      expect(existsSync(at(repo, dir)), dir).toBe(false);
    }
  });

  it.each([
    ['runtimes: [claude]', '.claude/skills', '.agents/skills'],
    ['runtimes: [codex]', '.agents/skills', '.claude/skills'],
  ])('%s writes only its own directory', async (line, written, absent) => {
    const repo = sandbox();
    setConfig(repo, /^runtimes: .*$/m, line);
    const { code } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    expect(existsSync(at(repo, written + '/accord-designer/SKILL.md')), written).toBe(true);
    expect(existsSync(at(repo, absent)), absent).toBe(false);
  });

  it('a runtime that reads both directories gets both', async () => {
    const repo = sandbox();
    setConfig(repo, /^runtimes: .*$/m, 'runtimes: [cursor]');
    const { code } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    for (const path of DESIGNER) expect(existsSync(at(repo, path)), path).toBe(true);
  });
});

describe('accord skills sync — what it refuses', () => {
  // T-06-03, the phase's one high-severity threat. Without the lstat refusal, accord's bytes go wherever the
  // link points. `symlinkSync(..., 'junction')` needs no elevation on Windows and the type argument is
  // ignored on POSIX, so one code path covers both CI legs.
  it('refuses a destination that is not a regular file and writes nothing through it', async () => {
    const repo = sandbox();
    const decoy = join(repo, 'decoy');
    mkdirSync(decoy, { recursive: true });
    writeFileSync(join(decoy, 'keep.txt'), 'do not touch\n');
    const before = bytes(join(decoy, 'keep.txt'));

    const target = DESIGNER[0];
    mkdirSync(join(repo, ...target.split('/').slice(0, -1)), { recursive: true });
    symlinkSync(decoy, at(repo, target), 'junction');

    const { code, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(2);
    // The exact message, not merely a non-zero exit: dropping the guard also fails, on an EISDIR whose text
    // carries a native path — so only pinning the refusal itself makes this case fail when the guard goes.
    expect(err.trim()).toBe(target + ' is not a regular file - nothing was written');
    expect(bytes(join(decoy, 'keep.txt'))).toBe(before);
    expect(readdirSync(decoy)).toEqual(['keep.txt']);
  });

  // The leaf is not the only way in. `lstat` declines to follow only the FINAL component, so a junction at
  // the DIRECTORY sends every write inside it through the link while a leaf-only guard never fires. Same
  // threat, one level up; the guard walks every component for this reason.
  it('refuses a directory component that is a link, not only the leaf', async () => {
    const repo = sandbox();
    const decoy = join(repo, 'decoy');
    mkdirSync(decoy, { recursive: true });
    writeFileSync(join(decoy, 'keep.txt'), 'do not touch\n');

    const dir = '.claude/skills/accord-designer';
    mkdirSync(join(repo, '.claude', 'skills'), { recursive: true });
    symlinkSync(decoy, at(repo, dir), 'junction');

    const { code, out, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(2);
    expect(err.trim()).toBe(dir + ' is not a regular directory - nothing was written');
    expect(out).toBe('');
    expect(readdirSync(decoy)).toEqual(['keep.txt']);
  });

  // "nothing was written" is a factual claim to the user, so the refusal has to be a pre-pass over every
  // destination. Guarding inside the write loop fired only once `.agents/**` — which sorts ahead of
  // `.claude/**` — had already been written in full, leaving those files on disk under a message saying
  // none were, and discarding the report that would have named them.
  it('writes nothing anywhere when one destination is refused', async () => {
    const repo = sandbox();
    const decoy = join(repo, 'decoy');
    mkdirSync(decoy, { recursive: true });

    const target = DESIGNER[0]; // .claude/** — every .agents/** path is written before this one is reached
    mkdirSync(join(repo, ...target.split('/').slice(0, -1)), { recursive: true });
    symlinkSync(decoy, at(repo, target), 'junction');
    const before = listing(repo);

    const { code, out } = await run(['skills', 'sync'], repo);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(listing(repo)).toEqual(before);
  });

  /**
   * The read side of the same threat. `assertNoLink` guards the WRITE set, and 06-05 widened the SCAN set
   * past it, so an UNDECLARED target directory — one the write pre-pass never visits — reached the orphan
   * scan unguarded. `runtimes: [claude]` is what makes `.agents/skills` undeclared here. Returns the
   * outside directory, which a second mkdtemp puts genuinely outside the sandbox repository.
   */
  function linkOutside(repo: string): string {
    setConfig(repo, /^runtimes: .*$/m, 'runtimes: [claude]');
    const outside = mkdtempSync(join(tmpdir(), 'accord-outside-'));
    repos.push(outside); // the shared afterEach removes it, whether or not the case passes
    mkdirSync(join(outside, 'accord-victim'), { recursive: true });
    writeFileSync(join(outside, 'accord-victim', 'SKILL.md'), 'not accords repository\n');
    mkdirSync(join(repo, '.agents'), { recursive: true });
    symlinkSync(outside, at(repo, '.agents/skills'), 'junction');
    return outside;
  }

  it('reads nothing through a link at an undeclared target directory, and still exits 0', async () => {
    const repo = sandbox();
    const outside = linkOutside(repo);
    const victim = join(outside, 'accord-victim', 'SKILL.md');
    const before = bytes(victim);

    const { code, out, err } = await run(['skills', 'sync'], repo);
    // A skip, not a refusal: D-113 fixes that the orphan report never changes the exit code, and D-123
    // forbids reporting a directory accord did not generate — announcing the link would trade one breach
    // for a smaller one. A DECLARED directory that is linked never gets this far: `assertNoLink` over the
    // write set has already exited 2.
    expect(code).toBe(0);
    expect(out + err).not.toContain('accord-victim');
    expect(out + err).not.toContain(outside);
    expect(bytes(victim)).toBe(before);
  });

  it('narrows the scan by the linked directory and nothing else', async () => {
    // Without this case the guard could pass the one above by disabling the scan outright.
    const repo = sandbox();
    linkOutside(repo);
    await run(['skills', 'sync'], repo); // writes .claude/skills/accord-designer, under a DECLARED directory
    setConfig(repo, /^roles: .*$/m, 'roles: [ba, dev]'); // ... which nobody declares any more

    const { code, err } = await run(['skills', 'sync'], repo);
    expect(code).toBe(0);
    expect(orphanDirs(err)).toEqual(['.claude/skills/accord-designer']);
    expect(err).not.toContain('accord-victim');
  });
});

// GC-WR-01: D-112's report is the whole reason `overwrote local edits` is a status rather than a silent
// write, so a status that became true has to reach the reader even when a later target fails. The only way
// to reach the loop's interior is a direct call: both commands run the `assertNoLink` pre-pass the
// function's own docstring assigns to the caller, so no command-level invocation can carry a bad path this
// far.
describe('writeSkillFiles — a run that stops part-way', () => {
  it('records a copy it wrote before a later target throws', () => {
    const repo = sandbox();
    const first = { path: '.claude/skills/accord-ba/SKILL.md', text: 'one\n' };
    const second = { path: '.claude/skills/accord-ba/NESTED.md', text: 'two\n' };
    // A directory where a file belongs: `readFileSync` on it throws EISDIR on Windows and POSIX alike, with
    // no permission games and nothing that behaves differently for a CI container running as root.
    mkdirSync(at(repo, second.path), { recursive: true });
    const out: ReportRow[] = [];
    // That it throws, not which errno: the property under test is what `out` holds afterwards.
    expect(() => writeSkillFiles(repo, [first, second], out)).toThrow();
    expect(out).toEqual([{ status: 'created', path: first.path }]);
  });
});
