// CLI-01 `accord init` end to end, in-process through runCli with injected streams and an explicit cwd
// (STACK Decision 7). Two contracts carry the weight: what a first run puts in a repository that has
// nothing, and what a second run does to it — which under D-130 is nothing at all, for every path, whether
// accord wrote it or a human did. Every case runs in its own mkdtemp sandbox, so no test can reach the
// accord repository it runs in.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { POINTER_FILES, POINTER_START, skillTargets, validate } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { AccordConfig } from '@accord-dev/accord-core';
import type { Tags } from 'yaml';
import pkg from '../package.json' with { type: 'json' };
import { cleanup, makeEmptyRepo, run } from './helpers/repo.js';

const CONFIG = 'accord/config.yml';
const WORKFLOW = '.github/workflows/accord.yml';
// Code-point order, the order `initFiles` returns and the report prints: '.' sorts before 'a'.
const SCAFFOLD = [WORKFLOW, CONFIG, 'accord/product/business-rules.md', 'accord/product/glossary.md'];
const at = (repo: string, path: string): string => join(repo, ...path.split('/'));
const bytes = (file: string): string => readFileSync(file, 'latin1'); // byte-exact, no encoding fixups
/** The report as a list of lines, so a case can assert a slice of it without re-splitting. */
const lines = (out: string): string[] => out.split('\n').filter((l) => l !== '');
/** The exact stdout a list of report lines produces, for the two whole-report assertions (D-133). */
const report = (rows: string[]): string => rows.map((r) => r + '\n').join('');

// STACK.md Decision 2: core schema, numerics stay strings. A local copy — the CLI test tree has no import
// path to core's test helpers, and it is three lines.
const stringNumerics = (tags: Tags) =>
  tags.filter((t) => !/int|float/.test(typeof t === 'string' ? t : t.tag));

const parsed = (repo: string): Record<string, unknown> =>
  parse(readFileSync(at(repo, CONFIG), 'utf8'), {
    schema: 'core',
    customTags: stringNumerics,
  }) as Record<string, unknown>;

/**
 * A config a human wrote, not accord — modelled on this repository's own (Phase 6, `[ba, dev]` on
 * `[claude]`), which is the D-132 proving case. The pin is a parameter so one literal serves both the
 * accepted case and the refused one.
 */
const HAND_WRITTEN = (pin: string): string =>
  `# written by hand, not by accord\naccord: "${pin}"\nprofile: maintain\ntracker:\n  adapter: none\ndesign:\n  tokens: ""\nroles: [ba, dev]\nruntimes: [claude]\n`;

/**
 * Every path `init` writes a skill copy to, derived from the config it just wrote rather than listed as
 * literals: the roster is the config's to decide (D-131), so a case that re-listed the paths would be
 * asserting the test's opinion of the roster instead of the command's.
 */
const skillPaths = (repo: string): string[] =>
  skillTargets(parsed(repo) as unknown as AccordConfig).map((t) => t.path);

/**
 * Every path under both target directories, repo-relative and sorted — the whole of what a run may have
 * written there. A local copy of `skills-sync.test.ts`'s helper: the two files are peers, not a
 * shared-helper pair, and it is nine lines.
 */
function listing(repo: string): string[] {
  const out: string[] = [];
  for (const dir of ['.claude/skills', '.agents/skills']) {
    const abs = at(repo, dir);
    if (!existsSync(abs)) continue;
    for (const d of readdirSync(abs, { recursive: true, withFileTypes: true })) {
      out.push(relative(repo, join(d.parentPath, d.name)).split(sep).join('/'));
    }
  }
  return out.sort();
}

/**
 * Every repo-relative path in the sandbox except git's own, sorted — the whole of what a run may have put
 * anywhere, not only under the two skill directories. `refuses` compares this before and after, which is the
 * only assertion that can see a scaffold path written ahead of a refusal: an `existsSync` on
 * `.claude/skills` is blind to `.github/workflows/accord.yml`, and that blindness is how the CLI came to
 * write three files into a repository pinned to another release.
 */
function listAll(repo: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(repo, { recursive: true, withFileTypes: true })) {
    const path = relative(repo, join(d.parentPath, d.name)).split(sep).join('/');
    // git's own directory is the sandbox's plumbing, not the repository's text, and `git ls-files` may
    // touch it on any run.
    if (path === '.git' || path.startsWith('.git/')) continue;
    out.push(path);
  }
  return out.sort();
}

// Every case makes its own repository; this collects them so a failing assertion still cleans up.
const repos: string[] = [];
function sandbox(): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  return repo;
}
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

describe('accord init — the first run', () => {
  // The seam this whole plan exists to prove: every other command loads a snapshot first, and the loader
  // refuses a repository with no accord/ folder before the pin is even consulted.
  it('runs in a repository with no accord/ folder, writes the whole contract, and exits 0', async () => {
    const repo = sandbox();
    const { code, out, err } = await run(['init'], repo);
    expect(code).toBe(0);
    // The scaffold half as literals — four fixed paths, so a fifth appearing is a decision, not a diff —
    // then the skill half in `skillTargets` order, read off the config this run wrote, then the two pointer
    // files. `toBe` on the whole stdout string, never `toContain`: D-133 is a claim about the whole list.
    expect(out).toBe(
      report([...SCAFFOLD, ...skillPaths(repo), ...POINTER_FILES].map((p) => 'created ' + p)),
    );
    expect(err).toBe('');
  });

  // ROADMAP criterion 1, the whole of it: "skill copies in both paths", from one command with no config
  // edit first. Asserting `.claude/skills` alone would still pass on the pre-amendment single-runtime
  // default, which is precisely the gap D-134's amendment closed.
  it('puts all three role directories under BOTH runtime paths (D-134 as amended)', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    const found = listing(repo);
    for (const dir of ['.claude/skills', '.agents/skills']) {
      for (const role of ['accord-ba', 'accord-dev', 'accord-designer']) {
        expect(found, dir + '/' + role).toContain(dir + '/' + role);
      }
    }
  });

  it('writes both product templates where the folder convention puts them (A-05)', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    expect(readFileSync(at(repo, 'accord/product/glossary.md'), 'utf8')).toContain('# Glossary');
    expect(readFileSync(at(repo, 'accord/product/business-rules.md'), 'utf8')).toContain('# Business rules');
  });

  // The papercut this repository carries as WINDOWS.md entry 3, asserted against the command that would
  // otherwise hand it to everyone: a repository is clean on its first minute, or A-01's empty
  // `design.tokens` default has been changed to a path that does not exist.
  it('leaves a repository that accord lint reports clean, with no tokens warning', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    const { code, out } = await run(['lint'], repo);
    expect(code).toBe(0);
    expect(out).not.toContain('tokens-missing');
  });

  it('writes a config that validates against config.schema.json with no finding', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    expect(validate('config', parsed(repo))).toEqual([]);
  });

  // D-135, first half: the pin written here is the version that wrote it, so the next command run in this
  // repository agrees with itself.
  it('pins the running CLI version, exactly (D-135)', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    expect(parsed(repo).accord).toBe(pkg.version);
  });

  // D-134 as amended 2026-09-17: both runtimes, so `skills sync` resolves .claude/skills and .agents/skills
  // alike and neither directory's copies are reported as orphans; and an empty tokens path, so a fresh
  // repository does not carry a standing lint warning on its first minute.
  it('declares both runtimes and an empty design.tokens (D-134 as amended)', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    const config = parsed(repo);
    expect(config.runtimes).toEqual(['claude', 'codex']);
    expect((config.design as { tokens: string }).tokens).toBe('');
  });

  it('prints no backslash on either stream, on any host (D-51)', async () => {
    const repo = sandbox();
    const { out, err } = await run(['init'], repo);
    for (const [stream, text] of [
      ['stdout', out],
      ['stderr', err],
    ] as const) {
      // Report the offending line, not a bare boolean: this fails on a host the author does not have.
      const offender = text.split('\n').find((line) => line.includes('\\'));
      expect(offender, `accord init ${stream}: ${offender}`).toBeUndefined();
    }
  });
});

describe('accord init — running it again', () => {
  // `toBe` on the whole report, never `toContain`: D-133 is a claim about the whole list, and `toContain`
  // would pass on a report that also printed something else.
  it('reports every scaffold path skipped and every skill copy unchanged (D-130, D-112)', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    const before = bytes(at(repo, CONFIG));
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(out).toBe(
      report([
        ...SCAFFOLD.map((p) => 'skipped ' + p),
        ...skillPaths(repo).map((p) => 'unchanged ' + p),
        ...POINTER_FILES.map((p) => 'skipped ' + p),
      ]),
    );
    expect(bytes(at(repo, CONFIG))).toBe(before);
  });

  it('leaves the target directories holding exactly what the first run put there', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    const first = listing(repo);
    await run(['init'], repo);
    expect(listing(repo)).toEqual(first);
  });

  // The CLI-01 concurrency edge: an `init` killed halfway, or two run at once, leaves some paths written and
  // some not. Re-running must fill exactly the gap and touch nothing else.
  it('re-creates a deleted path byte-identically and skips the rest', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    const first = bytes(at(repo, 'accord/product/glossary.md'));
    rmSync(at(repo, 'accord/product/glossary.md'));
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out).slice(0, SCAFFOLD.length)).toEqual([
      'skipped ' + WORKFLOW,
      'skipped ' + CONFIG,
      'skipped accord/product/business-rules.md',
      'created accord/product/glossary.md',
    ]);
    expect(bytes(at(repo, 'accord/product/glossary.md'))).toBe(first);
  });

  // D-132: `init` fills in what is missing and keeps what is there. This repository is the proving case —
  // its own accord/config.yml was written by hand with a comment saying init must not overwrite it, and
  // rosters `[ba, dev]` on `[claude]` alone, so the skill half follows the human's roster rather than the
  // defaults `init` would have written.
  it('leaves a hand-written config.yml untouched and follows its roster (D-132)', async () => {
    const repo = sandbox();
    const sentinel = HAND_WRITTEN(pkg.version);
    mkdirSync(at(repo, 'accord'), { recursive: true });
    writeFileSync(at(repo, CONFIG), sentinel);
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(bytes(at(repo, CONFIG))).toBe(sentinel);
    expect(lines(out)).toContain('skipped ' + CONFIG);
    // `[claude]` alone: .agents/skills is not this repository's, so nothing may appear under it.
    expect(existsSync(at(repo, '.agents/skills'))).toBe(false);
    expect(listing(repo)).toContain('.claude/skills/accord-ba/SKILL.md');
  });
});

// A-06: `init` is repository-reading the moment a config exists, so a config it cannot act on is exit 2 —
// not a skipped line and a half-set-up repository with no signal. Each case asserts the refusal landed
// before the first skill byte, which is the whole of T-07-08: a stale CLI must not write a newer contract's
// text into a repository that has refused it.
describe('accord init — a config it cannot act on', () => {
  const refuses = async (repo: string): Promise<{ code: number; err: string }> => {
    const before = listAll(repo);
    const dirs = ['.claude/skills', '.agents/skills'].map((d) => [d, existsSync(at(repo, d))] as const);
    const { code, out, err } = await run(['init'], repo);
    // The whole tree, not two directories: a repository that has refused this release must receive no byte
    // from it, and the equality is what says so for every destination at once — the workflow, the two
    // product templates, the pointer files, and anything a later version adds to the scaffold list.
    expect(listAll(repo), 'init wrote before it refused').toEqual(before);
    // GC-WR-02: a repository that received no byte must also be told it received none, or a regression that
    // reported paths it had not written would pass every case in this describe.
    expect(out, 'a run that wrote nothing reported something').toBe('');
    // Narrower and kept: these two name the directories T-07-08 is specifically about, so a failure there
    // reads as itself rather than as one line of a tree diff. Against their own before-state rather than
    // against `false`, because the third case seeds a directory at a skill-copy path: what must hold is that
    // the run did not change it, not that the path was absent to begin with.
    for (const [dir, existed] of dirs) expect(existsSync(at(repo, dir)), dir).toBe(existed);
    return { code, err };
  };

  it('refuses a repository pinned to another version, before any skill write (D-95, T-07-08)', async () => {
    const repo = sandbox();
    mkdirSync(at(repo, 'accord'), { recursive: true });
    writeFileSync(at(repo, CONFIG), HAND_WRITTEN('0.0.1'));
    const { code, err } = await refuses(repo);
    expect(code).toBe(2);
    expect(err).toContain('0.0.1');
    expect(err).toContain(pkg.version);
  });

  it('refuses a config that is not valid YAML, naming lint (the skills sync precedent)', async () => {
    const repo = sandbox();
    mkdirSync(at(repo, 'accord'), { recursive: true });
    writeFileSync(at(repo, CONFIG), 'written by hand, not by accord\n');
    const { code, err } = await refuses(repo);
    expect(code).toBe(2);
    expect(err).toContain('run accord lint');
  });

  // The refusal 07-09 actually hoisted, and the one that had no case on this branch. The two above both come
  // from the loader and would have been caught wherever `refusals()` sat relative to the write loop; this one
  // is `assertNoLink` over `skillTargets(snapshot.config)`, whose position is what changed. Its pair is the
  // greenfield case in `accord init — a refusal that lands after a write`, which asserts the opposite outcome
  // through the same guard: four files written, and only then the refusal. No reorder satisfies both, so the
  // two together are what make the ordering claim falsifiable.
  it('refuses a skill-copy target that is not a regular file, before any write', async () => {
    const repo = sandbox();
    mkdirSync(at(repo, 'accord'), { recursive: true });
    // Pinned to the running version, so the pin check passes and this reaches the third refusal rather than
    // stopping at the second.
    writeFileSync(at(repo, CONFIG), HAND_WRITTEN(pkg.version));
    // A directory where a file belongs, at a path that roster really targets: HAND_WRITTEN is `[ba, dev]` on
    // `[claude]`, so `skillTargets` returns this exact path. Occupying one it does not name would prove
    // nothing about the ordering.
    mkdirSync(at(repo, '.claude/skills/accord-ba/SKILL.md'), { recursive: true });
    const { code, err } = await refuses(repo);
    expect(code).toBe(2);
    expect(err).toContain('is not a regular file');
  });
});

// The one write path that can still precede a refusal, and the reason the report is printed on the throw
// path at all: on a greenfield repository the skill roster is decided by the `config.yml` this run is about
// to write, so `skillTargets` cannot be consulted — and its `assertNoLink` pre-pass cannot run — until the
// scaffold loop has finished. That run legitimately writes and then refuses, so it belongs to neither
// `refuses` (which asserts nothing was written) nor the success cases; what it must not be is silent.
describe('accord init — a refusal that lands after a write', () => {
  it('prints what it wrote before the skill-target guard refuses (D-133)', async () => {
    const repo = sandbox();
    // A directory where a file belongs, at a path the default roster really targets — occupying an
    // invented path would prove nothing about the ordering.
    mkdirSync(at(repo, '.claude/skills/accord-ba/SKILL.md'), { recursive: true });
    const { code, out, err } = await run(['init'], repo);
    expect(code).toBe(2);
    expect(err).toContain('is not a regular file');
    // The four scaffold paths, in the order the success path prints them: one renderer, two call sites, so
    // a partial run's report cannot disagree with a complete one's.
    expect(lines(out)).toEqual(SCAFFOLD.map((p) => 'created ' + p));
  });
});

// CLI-02: the workflow is the deepest path `init` writes and the only one under a directory a repository
// may already own for other reasons, so it gets its own cases rather than riding on the scaffold list.
// What the document SAYS is asserted in core, where it is parsed back; what is asserted here is that the
// bytes reach the disk, survive a second run, and never displace a workflow a human wrote.
describe('accord init — the CI workflow (CLI-02)', () => {
  // Neither `.github` nor `.github/workflows` exists in a sandbox, so this is also the case that proves the
  // `mkdirSync(dirname(file), { recursive: true })` in the write loop creates two levels, not one.
  it('creates .github/workflows/accord.yml in a repository that has neither directory', async () => {
    const repo = sandbox();
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('created ' + WORKFLOW);
    expect(existsSync(at(repo, WORKFLOW))).toBe(true);
  });

  it('skips it on a second run and leaves the bytes alone (D-130)', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    const before = bytes(at(repo, WORKFLOW));
    const { out } = await run(['init'], repo);
    expect(lines(out)).toContain('skipped ' + WORKFLOW);
    expect(bytes(at(repo, WORKFLOW))).toBe(before);
  });

  // D-130 at the path most likely to be already tuned: a repository that has adjusted its own accord
  // workflow — a different runner, an extra step, a matrix — keeps exactly what it wrote.
  it('keeps a hand-written workflow byte for byte', async () => {
    const repo = sandbox();
    const sentinel = 'name: written by hand, not by accord\n';
    mkdirSync(at(repo, '.github/workflows'), { recursive: true });
    writeFileSync(at(repo, WORKFLOW), sentinel);
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('skipped ' + WORKFLOW);
    expect(bytes(at(repo, WORKFLOW))).toBe(sentinel);
  });

  // Read byte-exact and before git has touched the file: a CRLF inside the `run:` block scalar reaches
  // bash on the runner as a stray carriage return on every line of the script.
  it('writes LF on any host, with no carriage return in the file (FMT-08)', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    expect(bytes(at(repo, WORKFLOW))).not.toContain('\r');
  });
});

// CLI-03 (D-141 to D-144): the one `init` write that is not skip-if-exists. What the block SAYS and where
// its boundary falls is asserted in core, where it is pure; what is asserted here is that the right branch
// runs against a real file — created, appended, or skipped — and that an append never disturbs a byte that
// was already there. Every case runs in its own mkdtemp sandbox, so nothing here can reach the accord
// repository's own CLAUDE.md.
describe('accord init — the AGENTS.md and CLAUDE.md pointer (CLI-03)', () => {
  const AGENTS = 'AGENTS.md';
  const CLAUDE = 'CLAUDE.md';

  it('creates both files in a repository that has neither, holding the block and nothing else', async () => {
    const repo = sandbox();
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('created ' + AGENTS);
    expect(lines(out)).toContain('created ' + CLAUDE);
    const agents = readFileSync(at(repo, AGENTS), 'utf8');
    // One text in both files: the block takes no argument, so a difference here would mean something
    // reached it that should not have (T-07-20).
    expect(readFileSync(at(repo, CLAUDE), 'utf8')).toBe(agents);
    expect(agents.startsWith(POINTER_START)).toBe(true);
  });

  // T-07-18, the prohibition this plan carries: an append adds a suffix and touches nothing else. Read
  // byte-exact, so a re-encoding or a line-ending fixup fails this rather than passing as "equivalent".
  it('appends to a file a human wrote, keeping the original bytes as an exact prefix', async () => {
    const repo = sandbox();
    const original = '# House rules\n\nBe careful.\n';
    writeFileSync(at(repo, AGENTS), original);
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('appended ' + AGENTS);
    const after = bytes(at(repo, AGENTS));
    expect(after.startsWith(original)).toBe(true);
    expect(after.endsWith(bytes(at(repo, CLAUDE)))).toBe(true);
  });

  // Gap 1 (GC-CR-01): the case above feeds ASCII, so its byte-exact-prefix assertion holds under any codec
  // that round-trips ASCII — including the `utf8` read/write pair that substituted `EF BF BD` for every
  // byte a windows-1252 file holds. These twelve bytes are `café – dash` as an editor on this project's
  // primary platform writes it. Seeded as a Buffer and not a string, so the fixture cannot itself be
  // re-encoded on the way in, and decoded with the same codec `bytes()` reads, so fixture and assertion
  // cannot drift apart.
  it('keeps the bytes of a non-UTF-8 file it appends to', async () => {
    const repo = sandbox();
    const seeded = Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x96, 0x20, 0x64, 0x61, 0x73, 0x68, 0x0a]);
    const original = seeded.toString('latin1');
    writeFileSync(at(repo, AGENTS), seeded);
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('appended ' + AGENTS);
    const after = bytes(at(repo, AGENTS));
    expect(after.startsWith(original)).toBe(true);
    // And what it gained is exactly the block, nothing reflowed around it: the same run's CLAUDE.md holds
    // that block alone.
    expect(after.endsWith(bytes(at(repo, CLAUDE)))).toBe(true);
  });

  // The other direction, so the fix is a byte-for-byte codec rather than a different lossy one: a genuine
  // UTF-8 document with multi-byte characters survives the same round-trip byte for byte.
  it('keeps the bytes of a multi-byte UTF-8 file it appends to', async () => {
    const repo = sandbox();
    const seeded = Buffer.from('# Règles\n\nCafé — dash, naïve, 日本語\n', 'utf8');
    const original = seeded.toString('latin1');
    writeFileSync(at(repo, CLAUDE), seeded);
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('appended ' + CLAUDE);
    const after = bytes(at(repo, CLAUDE));
    expect(after.startsWith(original)).toBe(true);
    expect(after.endsWith(bytes(at(repo, AGENTS)))).toBe(true);
  });

  // The CLI-03 boundary edge: a file that ends mid-sentence. Without the blank line the start marker would
  // land on the end of someone's last sentence, which is both ugly and, in rendered Markdown, invisible.
  it('puts a blank line before the block when the file does not end in a newline', async () => {
    const repo = sandbox();
    writeFileSync(at(repo, CLAUDE), '# House rules');
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('appended ' + CLAUDE);
    const after = readFileSync(at(repo, CLAUDE), 'utf8');
    const start = after.indexOf(POINTER_START);
    expect(start).toBeGreaterThan(0);
    expect(after.slice(start - 2, start)).toBe('\n\n');
  });

  // The CLI-03 empty edge: a zero-byte file has nothing to separate from, so it must come out identical to
  // the created case — which this sandbox has beside it, in the CLAUDE.md the same run created.
  it('adds no leading blank line to a zero-byte file', async () => {
    const repo = sandbox();
    writeFileSync(at(repo, AGENTS), '');
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('appended ' + AGENTS);
    expect(bytes(at(repo, AGENTS))).toBe(bytes(at(repo, CLAUDE)));
  });

  // D-142: the block is there, so the file is left exactly as it is. A second block would be the duplicate
  // instruction a reader has to reconcile, and the overwrite D-130 exists to forbid.
  it('skips a file that already carries the block, byte for byte', async () => {
    const repo = sandbox();
    const sentinel = '# House rules\n\n' + POINTER_START + '\nsomething a human edited\n<!-- accord:end -->\n';
    writeFileSync(at(repo, CLAUDE), sentinel);
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('skipped ' + CLAUDE);
    expect(bytes(at(repo, CLAUDE))).toBe(sentinel);
  });

  // A-12: a start marker with no end marker is a human's half-finished edit, not accord's business. The
  // start marker alone decides, so this takes the skip branch rather than appending a second block beside it.
  it('skips a half-written block and leaves it for its owner to finish (A-12)', async () => {
    const repo = sandbox();
    const sentinel = '# House rules\n\n' + POINTER_START + '\nhalf an edit\n';
    writeFileSync(at(repo, AGENTS), sentinel);
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(lines(out)).toContain('skipped ' + AGENTS);
    expect(bytes(at(repo, AGENTS))).toBe(sentinel);
  });

  // The idempotency claim at the one path where it is not free: every other `init` write skips on the
  // existence of a path, this one skips on the contents of a file.
  it('leaves both files byte-identical on a second run', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    const before = POINTER_FILES.map((p) => bytes(at(repo, p)));
    const { out } = await run(['init'], repo);
    for (const path of POINTER_FILES) expect(lines(out)).toContain('skipped ' + path);
    expect(POINTER_FILES.map((p) => bytes(at(repo, p)))).toEqual(before);
  });

  // FMT-08 and D-51 at a path a human opens in an editor and commits: a carriage return here would arrive
  // in someone's repository as a mixed-ending file, and a backslash as a path that does not resolve.
  it('writes LF only, with no carriage return and no backslash (FMT-08, D-51)', async () => {
    const repo = sandbox();
    await run(['init'], repo);
    for (const path of POINTER_FILES) {
      const text = bytes(at(repo, path));
      expect(text, path).not.toContain('\r');
      expect(text, path).not.toContain(String.fromCharCode(92));
    }
  });
});
