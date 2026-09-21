// CLI-01 scaffold plan (D-107, D-130, D-134): what `initFiles` decides, asserted in core and independently
// of any filesystem. Everything below iterates the whole returned list rather than a named path, so an entry
// a later plan adds inherits these gates the moment it lands — no plan has to restate a criterion to be
// covered.
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Tags } from 'yaml';
import { templates } from '../src/generated/templates.js';
import {
  initFiles,
  POINTER_END,
  POINTER_FILES,
  POINTER_START,
  pointerText,
  skillTargets,
  validate,
} from '../src/index.js';
import { deniedNames } from '../../../test/helpers/denied.js';
import { readDir } from './helpers/fixture.js';
import type { AccordConfig } from '../src/index.js';

// STACK.md Decision 2: core schema, numerics stay strings.
const stringNumerics = (tags: Tags) =>
  tags.filter((t) => !/int|float/.test(typeof t === 'string' ? t : t.tag));

// A pkg-shaped literal, never a real manifest read: core cannot reach the CLI's package.json, and a version
// that is not this repository's proves the value is carried through rather than hardcoded.
const PKG = { name: '@accord-dev/accord', version: '9.9.9' };

const output = initFiles(PKG);

describe('initFiles — the plan it returns', () => {
  // Guard the guard: an empty list would pass every loop below for free.
  it('has files to check', () => {
    expect(output.length).toBeGreaterThan(0);
  });

  it('no backslash in any path or any emitted line (D-51)', () => {
    for (const { path, text } of output) {
      expect(path, path).not.toContain('\\');
      // Report the offending line, not a bare boolean: this fails on a host the author does not have.
      const offender = text.split('\n').find((line) => line.includes('\\'));
      expect(offender, `${path}: ${String(offender)}`).toBeUndefined();
    }
  });

  // T-07-01: the CLI joins these onto a repository root without checking them again, so a path that could
  // climb out of the repository would be a write outside it. Every path is a source literal precisely so
  // this holds by construction — the assertion is what keeps it true when the list grows.
  it('every path is repo-relative: no root, no drive letter, no .. segment', () => {
    for (const { path } of output) {
      expect(path.startsWith('/'), path).toBe(false);
      expect(/^[A-Za-z]:/.test(path), path).toBe(false);
      expect(path.split('/').includes('..'), path).toBe(false);
    }
  });

  it('is deterministic: the same argument returns the same list', () => {
    expect(initFiles(PKG)).toEqual(initFiles(PKG));
  });

  it('is sorted by path in code-point order, on every host', () => {
    const paths = output.map((f) => f.path);
    expect(paths).toEqual([...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });
});

describe('initFiles — the config it plans', () => {
  const entry = output.find((f) => f.path === 'accord/config.yml');
  const config = parse(entry?.text ?? '', { schema: 'core', customTags: stringNumerics }) as Record<
    string,
    unknown
  >;

  // `toEqual` on the whole list, never `toContain`: a fourth entry appearing without a decision behind it
  // is exactly the drift this case exists to catch, and `toContain` would pass over it.
  it('plans exactly the workflow, the config and the two product documents', () => {
    expect(output.map((f) => f.path)).toEqual([
      '.github/workflows/accord.yml',
      'accord/config.yml',
      'accord/product/business-rules.md',
      'accord/product/glossary.md',
    ]);
  });

  // Worth more than all the others: a config that does not validate makes every later command in the
  // repository report schema findings, and only running the real validator proves it does.
  it('validates against config.schema.json with no finding', () => {
    expect(validate('config', config)).toEqual([]);
  });

  it('carries the version it was given, not one of its own (D-135)', () => {
    expect(config.accord).toBe(PKG.version);
  });

  // D-134 as amended 2026-09-17: both runtimes, so the skill copies resolve into .claude/skills and
  // .agents/skills alike; an empty tokens path, so a fresh repository carries no standing lint warning.
  it('declares both runtimes and an empty design.tokens (D-134 as amended)', () => {
    expect(config.runtimes).toEqual(['claude', 'codex']);
    expect((config.design as { tokens: string }).tokens).toBe('');
  });

  // WR-01, owner ruling: the tests: block ships commented, so a team meets the key while reading the file
  // rather than when CI goes red. That is only worth shipping if uncommenting it is the single edit the
  // block promises — a claim about bytes, so it is made by performing the edit rather than by reading it.
  // The substitution is anchored to the two key lines: a blanket strip of every '# ' would uncomment the
  // guidance prose above them and prove nothing about the key.
  it('is one anchored uncomment away from a config carrying tests.report (WR-01)', () => {
    const shipped = entry?.text ?? '';
    const uncommented = shipped.replace(/^# (tests:| {2}report: .+)$/gm, '$1');
    // Guard the guard: a substitution that matched nothing leaves every assertion below vacuously true.
    expect(uncommented, 'the uncomment step changed nothing').not.toBe(shipped);
    const turnedOn = parse(uncommented, { schema: 'core', customTags: stringNumerics }) as Record<
      string,
      unknown
    >;
    expect(validate('config', turnedOn)).toEqual([]);
    const report = (turnedOn.tests as { report?: unknown } | undefined)?.report;
    expect(typeof report, 'tests.report after uncommenting').toBe('string');
    expect((report as string).length).toBeGreaterThan(0);
  });

  // The other half of the same decision, and T-07-41: until a human turns it on there is no tests key at
  // all, so no default path can make the Done machine layer pass without a report a team actually produced.
  it('ships that block commented, so no tests key parses (T-07-41)', () => {
    expect(config).not.toHaveProperty('tests');
  });

  // A-33 / truth 5: the two copied comment lines are the examples' words, not a third wording of one idea.
  // Read from the example tree rather than restated as a literal here — restating it would make the third
  // copy IN-03 already counts two of, and would not go red when either surface is reworded alone.
  it("copies the example's two tests: comment lines word for word (A-33)", () => {
    // 'test/' -> 'core/' -> 'packages/' -> the repository root, where D-145 puts 'examples/'.
    const example = readDir(new URL('../../../examples/build/accord/', import.meta.url)).files[
      'config.yml'
    ];
    expect(example, 'examples/build/accord/config.yml read as empty').toBeTruthy();
    const lines = (entry?.text ?? '').split('\n');
    const exLines = example.split('\n');
    // Both sides are located relative to their own key line rather than at a fixed offset: the example
    // is the source and the generated config is the copy, so anchoring one on 'tests:' and the other on
    // '# tests:' is the same anchor on both. The distance from an anchor to the copied pair is a function
    // of the instruction text sitting between them, which is what the content guard below catches: a
    // reworded instruction has to fail naming the offset, not the claim.
    const key = lines.indexOf('# tests:');
    expect(key, 'no "# tests:" line in the generated config').toBeGreaterThan(2);
    const exKey = exLines.indexOf('tests:');
    expect(exKey, 'no "tests:" line in the example config').toBeGreaterThan(2);
    // key - 4 and key - 3 are the copied pair; key - 2 and key - 1 are this plan's two instruction lines.
    const copied = lines.slice(key - 4, key - 2);
    expect(copied[0], 'the extracted pair does not start at the copied comment block').toContain(
      'Where the test report lands',
    );
    expect(copied).toEqual(exLines.slice(exKey - 2, exKey));
  });
});

// A-05: the two product documents ship as-authored. Asserting strict equality against the generated record
// rather than against a copied literal is what keeps a template edit from needing a test edit — and what
// catches a rendering step being introduced here, which these two files must not have.
describe('initFiles — the product documents it plans', () => {
  const byPath = (path: string): string | undefined => output.find((f) => f.path === path)?.text;

  it('writes the shipped glossary template, byte for byte', () => {
    expect(byPath('accord/product/glossary.md')).toBe(templates['glossary.md']);
  });

  it('writes the shipped business-rules template, byte for byte', () => {
    expect(byPath('accord/product/business-rules.md')).toBe(templates['business-rules.md']);
  });

  // The five templates deliberately left out: each carries a TICKET-ID placeholder, so a copy at a fixed
  // path would be a document nobody can use unedited. If one of them ever gains a fixed home, this case is
  // what makes that a decision rather than a diff nobody reads.
  it('plans no template carrying a TICKET-ID placeholder', () => {
    const offender = output.find((f) => f.text.includes('TICKET-ID'));
    expect(offender?.path).toBeUndefined();
  });
});

// CLI-02: the emitted workflow is the first artifact accord produces that something other than accord
// executes, so it is parsed back and inspected as a document rather than grepped as a string — a substring
// that is present says nothing about whether it is present in the right key. Parsed with `parse`'s default
// (YAML 1.2 core) schema and deliberately NOT with `stringNumerics`: the core schema is what keeps the top
// level key `on` a string rather than the boolean `true`, and `fetch-depth`'s numeric-ness is the point of
// one of the cases below.
describe('initFiles — the CI workflow it plans (CLI-02)', () => {
  interface Step {
    uses?: string;
    name?: string;
    with?: Record<string, unknown>;
    env?: Record<string, string>;
    run?: string;
  }
  interface Workflow {
    on: Record<string, unknown>;
    permissions: Record<string, string>;
    jobs: Record<string, { 'runs-on': string; steps: Step[] }>;
  }

  const entry = output.find((f) => f.path === '.github/workflows/accord.yml');
  const text = entry?.text ?? '';
  const doc = parse(text) as unknown as Workflow;
  const job = Object.values(doc.jobs)[0];
  const steps = job.steps;
  const scripts = steps.filter((s) => s.run !== undefined);

  it('parses as YAML', () => {
    expect(() => parse(text)).not.toThrow();
    expect(doc).toBeTypeOf('object');
  });

  // D-136: `pull_request` and nothing else. A `push` trigger would run `gate done` on a branch that is
  // mid-implementation, and `workflow_dispatch` has no base sha for the diff to resolve against.
  it('triggers on pull_request and on nothing else (D-136)', () => {
    expect(Object.keys(doc.on)).toEqual(['pull_request']);
  });

  // T-07-13, deep equality rather than a `contents` lookup: an added write scope has to fail this case, and
  // `expect(doc.permissions.contents).toBe('read')` would pass beside one.
  it('requests read on contents and nothing more (T-07-13)', () => {
    expect(doc.permissions).toEqual({ contents: 'read' });
  });

  it('declares one job on one runner', () => {
    expect(Object.keys(doc.jobs)).toHaveLength(1);
    expect(job['runs-on']).toBe('ubuntu-latest');
  });

  // T-07-14: `toBe(0)` on the number, not `'0'`. On the default shallow checkout `git diff <base>...HEAD`
  // cannot resolve the base commit, so the ticket list comes back empty and every pull request reports a
  // green job having gated nothing — a gate that silently passes is worse than no gate.
  it('checks out deep enough for its own diff (T-07-14)', () => {
    expect(steps).toHaveLength(3);
    expect(steps[0].with?.['fetch-depth']).toBe(0);
  });

  // D-162: without an explicit `ref:`, checkout lands on GitHub's synthetic merge commit, `gate done` binds
  // the tick to that commit, and every author's `verified_commit` reads as stale — a gate that fails a
  // correct review reads to a user as a broken gate. The key count is asserted rather than the one key, for
  // the same reason the `permissions` case above uses `toEqual`: a third `with:` key that moves the checkout
  // somewhere else has to fail a case instead of slipping past one. The delimiter is concatenated, following
  // the split-literal convention the T-07-11 case below relies on.
  it('checks out the head of the pull request, not the merge commit (D-162)', () => {
    const delimiter = '$' + '{{';
    expect(steps[0].with?.ref).toBe(`${delimiter} github.event.pull_request.head.sha }}`);
    expect(Object.keys(steps[0].with ?? {})).toHaveLength(2);
  });

  it('carries exactly one script, and passes the diff base to it through env', () => {
    expect(scripts).toHaveLength(1);
    expect(scripts[0].env?.BASE).toBeTypeOf('string');
    expect(scripts[0].env?.BASE.length).toBeGreaterThan(0);
  });

  // T-07-11, the whole reason the base sha travels through `env:`. An Actions expression is substituted
  // into the script text before the shell parses it, so an attacker-influenced field there is code
  // execution on the runner. The delimiter is built by concatenation, following the split-literal
  // convention `skills.test.ts` uses, so this file does not contain the sequence it forbids.
  it('carries no Actions expression in any script body (T-07-11)', () => {
    const delimiter = '$' + '{{';
    for (const step of steps) {
      expect(step.run ?? '', step.name ?? step.uses ?? '').not.toContain(delimiter);
    }
  });

  // D-140, matching CLI-02 word for word: `gate ready` is what an agent passes before writing code, inside
  // a working session. Running it on a pull request would fail every branch that is mid-implementation.
  it('runs lint and gate done, never gate ready (D-140)', () => {
    const script = scripts[0].run as string;
    expect(script).toContain(' lint');
    expect(script).toContain(' gate done ');
    expect(script).not.toContain('gate ready');
  });

  // D-135, asserted structurally rather than restated: both strings come from the one `initFiles(PKG)` call
  // at the top of this file, so this proves the two pins cannot drift — which two separate calls, or a
  // hard-coded `'9.9.9'` on both sides, would not.
  it('pins the same version the config does, from one initFiles call (D-135)', () => {
    const config = parse(output.find((f) => f.path === 'accord/config.yml')?.text ?? '', {
      schema: 'core',
      customTags: stringNumerics,
    }) as Record<string, unknown>;
    const pinned = /npx --yes \S+@([^\s@]+) lint/.exec(text)?.[1];
    expect(pinned).toBeTypeOf('string');
    expect(pinned).toBe(config.accord);
  });

  // FMT-08 and D-51 over the one file in the list a reader will open in their own repository. The
  // whole-list backslash case above already covers the first half; this one adds the line endings, which
  // matter because a CRLF in a `run:` block scalar reaches `bash` on the runner as a stray carriage return.
  it('is LF, ends in exactly one newline, and carries no carriage return', () => {
    expect(text).not.toContain('\r');
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });
});

// CLI-03 (D-141 to D-144): the pointer is the one `init` artifact whose write is not a plain
// skip-if-exists, because the file it lands in belongs to a human. What it says and where its boundary
// falls are decided here, in core and with no filesystem; that the bytes reach a disk is `cli/test/init`.
describe('pointerText — the block it decides (CLI-03)', () => {
  const block = pointerText(undefined) as string;

  // Guard the guard: an empty block would pass most of the substring cases below for free.
  it('returns a block for a file that does not exist', () => {
    expect(block).toBeTypeOf('string');
    expect(block.length).toBeGreaterThan(0);
  });

  // D-144, and the note in it for the planner: a source literal, never `skillTargets(config)`'s filtering
  // rule. A list derived from `runtimes:` would drop one of the two files ROADMAP criterion 3 names.
  it('always targets both AGENTS.md and CLAUDE.md (D-144)', () => {
    expect(POINTER_FILES).toEqual(['AGENTS.md', 'CLAUDE.md']);
  });

  // D-141: the pair delimits the block, so `init` can recognise its own work later without a regex over
  // prose. One trailing newline, like every other text accord writes (FMT-08).
  it('is delimited by the marker pair and ends in exactly one newline (D-141)', () => {
    expect(block.startsWith(POINTER_START)).toBe(true);
    expect(block.endsWith(POINTER_END + '\n')).toBe(true);
    expect(block.endsWith('\n\n')).toBe(false);
  });

  // The CLI-03 empty edge: a zero-byte file is a file with nothing to separate from, so a leading blank
  // line would be a stray one. Strict equality with the created case is the whole claim.
  it('treats an empty file exactly like a missing one', () => {
    expect(pointerText('')).toBe(block);
  });

  // A-14, the separator, one case per shape the existing file can end in. The marker never lands on the
  // end of someone's last sentence, and a file that already ended well gains nothing.
  it('separates the block from what is already there, without over-separating (A-14)', () => {
    expect(pointerText('# T')).toBe('# T\n\n' + block);
    expect(pointerText('# T\n')).toBe('# T\n\n' + block);
    expect(pointerText('# T\n\n')).toBe('# T\n\n' + block);
    expect(pointerText('# T\n\n\n')).toBe('# T\n\n\n' + block);
  });

  // T-07-18, the prohibition this plan carries: `init` must never rewrite a byte that was in the file
  // before it ran. Asserted over every shape rather than over the one the CLI case happens to use.
  it('keeps the original text as a byte-exact prefix, for every input it rewrites', () => {
    for (const existing of ['# T', '# T\n', '# T\n\n', 'a\r\nb\r\n', '   ', '# T\n\n\n\n']) {
      const result = pointerText(existing) as string;
      expect(result, existing).toBeTypeOf('string');
      expect(result.startsWith(existing), existing).toBe(true);
      expect(result.endsWith(block), existing).toBe(true);
    }
  });

  // D-142 plus A-12: the START marker alone decides. A start marker with no end marker is a human's
  // half-finished edit, and appending a second block beside it is the overwrite D-130 exists to forbid.
  it('skips a file that already carries the start marker, whole block or half (D-142, A-12)', () => {
    expect(pointerText(POINTER_START)).toBeUndefined();
    expect(pointerText(POINTER_START + 'x' + POINTER_END)).toBeUndefined();
    expect(pointerText('# T\n\n' + POINTER_START + '\nhalf an edit\n')).toBeUndefined();
    expect(pointerText(block)).toBeUndefined();
    expect(pointerText(pointerText('# T') as string)).toBeUndefined();
  });

  // T-07-20 and D-143: a reader has to be able to take this in without scrolling, and a block that grew
  // would be a skill body arriving by instalments. The ceiling is a number so the prose cannot drift.
  it('is at most twelve lines and names both skill directories and the gate (D-143)', () => {
    expect(block.split('\n').length).toBeLessThanOrEqual(12);
    expect(block).toContain('.claude/skills/accord-');
    expect(block).toContain('.agents/skills/accord-');
    expect(block).toContain('accord gate ready');
  });

  // D-51 and FMT-08 over a file a reader opens in their own repository, and over one accord appends to on
  // a Windows host: a backslash here would be written into a human's document.
  it('carries no backslash and no carriage return', () => {
    expect(block).not.toContain(String.fromCharCode(92)); // the escape, built rather than written
    expect(block).not.toContain('\r');
  });

  // CLI-03's prohibition, asserted rather than trusted: a pointer, never a copy. A copied line would drift
  // from its definition with nothing detecting it, so both forms of copying are checked — a section heading
  // a skill body uses, and any line at all that appears in a rendered skill file.
  it('copies no part of a skill body (CLI-03)', () => {
    const config: AccordConfig = {
      accord: '0.1.0',
      profile: 'build',
      tracker: { adapter: 'none' },
      design: { tokens: '' },
      roles: ['ba', 'dev', 'designer'],
      runtimes: ['claude', 'codex'],
    };
    const rendered = skillTargets(config);
    expect(rendered.length, 'no skill rendered at all').toBeGreaterThan(0);
    const skillLines = new Set(rendered.flatMap((f) => f.text.split('\n').map((l) => l.trim())));
    const markers = [POINTER_START, POINTER_END];
    const copied = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !markers.includes(l) && skillLines.has(l));
    expect(copied).toEqual([]);
  });
});

// The CLAUDE.md hard constraint "nothing accord ships names another tool, plugin, harness, or planning
// system", over the text surfaces Phase 7 adds. Until now its only automated coverage was one case over the
// rendered skill bodies (`skills.test.ts`); the coverage widens in the same change that widens the surface,
// from the one list in `test/helpers/denied.ts`, at the repository root.
describe('shipped text names no other tool (CLAUDE.md)', () => {
  it('finds no denied name in the config, the workflow, or the pointer block', () => {
    // `initFiles` carries both the generated config.yml comments and the emitted workflow YAML, so listing
    // it covers two surfaces without naming either — and a fifth artifact added to it later is covered with
    // no edit here.
    const surfaces = [
      ...output,
      { path: 'AGENTS.md', text: pointerText(undefined) as string },
    ];
    // Guard the guard, twice, before the assertion that matters: a scan given nothing, or a scan that
    // silently stopped matching, would otherwise read as a pass.
    expect(surfaces.length).toBeGreaterThanOrEqual(4);
    const probe = [{ path: 'probe.md', text: 'first\nbuilt with ' + 'Fig' + 'ma\n' }];
    expect(deniedNames(probe)).toEqual(['probe.md:2: ' + 'Fig' + 'ma']);
    expect(deniedNames(surfaces)).toEqual([]);
  });
});
