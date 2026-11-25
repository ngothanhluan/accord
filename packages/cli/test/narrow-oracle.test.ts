// Phase 08.9.2 Ruling-narrow, Ruling-oracle (L-04): a command for one ticket reads that ticket, its epic and its dependencies, and prints what it prints on the full load.
// The full load stays in this file as the reference: the same command function run on a context built from `loadWithBranch` (every file under accord/), against a context built from
// `loadNarrow` (the files outside accord/tickets/ and the target's neighbourhood). The fixture holds each cross-ticket read of RESEARCH F-6. Nothing is timed.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { loadSnapshot } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { anchor } from '../src/commands/anchor.js';
import { gate } from '../src/commands/gate.js';
import { show } from '../src/commands/show.js';
import { loadClaimView, loadNarrow, loadWithBranch, withDefaultRef } from '../src/load/fs.js';
import type { NarrowTarget } from '../src/load/fs.js';
import type { CommandContext } from '../src/run.js';
import { cleanup, gitRun, run } from './helpers/repo.js';
import { EPIC, narrowFixture, ORIGIN_ONLY, STORY } from './helpers/narrow-fixture.js';

const ENV = { CI: '1' }; // no gate log is written, so a run leaves nothing for the next one to read

type Made = { ctx: CommandContext; out: () => string; err: () => string };

/** The context `preflight('checkout')` builds, from a snapshot and the branch the load read. */
function made(root: string, snapshot: RepoSnapshot, branch: { name: string | undefined } | undefined, ids?: string[]): Made {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const ctx: CommandContext = { root, snapshot, memo: new Map(), ...(branch === undefined ? {} : { branch }), stdout, stderr, env: ENV, ssh: new Map(), ...(ids === undefined ? {} : { ids }) };
  return { ctx, out: () => String(stdout.read() ?? ''), err: () => String(stderr.read() ?? '') };
}

/** The full load: what `preflight` did before the narrow load existed. `stage` is the anchor's mode. */
function fullContext(root: string, stage = false): Made {
  const { input, branch } = loadWithBranch(root, { stage });
  return made(root, loadSnapshot(input, { memo: new Map() }), branch);
}

/** The narrow load of `target`, the way `preflight` builds it. */
function narrowContext(root: string, target: NarrowTarget, stage = false): Made {
  const n = loadNarrow(root, target, { stage });
  return made(root, loadSnapshot(n.input, { memo: new Map() }), n.branch, n.ids);
}

let repo = '';
let ids: string[] = [];
beforeAll(() => {
  repo = narrowFixture();
  // every ticket of the fixture, an id the fixture does not hold, and a dependency id nobody holds
  ids = [...Object.keys(fullContext(repo).ctx.snapshot.tickets), 'NOPE-9', 'NOPE-1'].sort();
  // a passing Ready writes ac_hash into the ticket; it is written once here, so neither load of the compare meets a file the other one changed
  const settle = fullContext(repo);
  for (const id of ids) gate(made(repo, settle.ctx.snapshot, settle.ctx.branch).ctx, 'ready', id, { json: true });
  // the same for the plan hash a passing Plan writes
  const settled = fullContext(repo);
  for (const id of ids) gate(made(repo, settled.ctx.snapshot, settled.ctx.branch).ctx, 'plan', id, { json: true });
});
afterAll(() => {
  for (const w of worktrees.splice(0)) rmSync(w, { recursive: true, force: true, maxRetries: 5 });
  if (repo !== '') cleanup(repo);
});

const worktrees: string[] = [];

/** A worktree of the fixture on a new or existing branch (or detached), in its own temporary folder; the folders go with the test, and the fixture repository's removal takes the worktree records. */
function worktreeOn(args: string[]): string {
  const folder = mkdtempSync(join(tmpdir(), 'accord-narrow-wt-'));
  const dir = join(folder, 'wt');
  gitRun(repo, 'worktree', 'add', '-q', ...args.map((a) => (a === '<dir>' ? dir : a)));
  worktrees.push(folder);
  return dir;
}

// Phase 08.9.2 Ruling-oracle (L-04): the verdict and the findings of Ready do not move when the other tickets are not read.
it('risk:regression gate ready on the narrow load prints what it prints on the full load (Ruling-oracle)', async () => {
  const reference = fullContext(repo);
  const verdicts = new Set<string>();
  const mismatches: string[] = [];
  for (const id of ids) {
    const want = made(repo, reference.ctx.snapshot, reference.ctx.branch);
    const wantCode = gate(want.ctx, 'ready', id, { json: true });
    const wantOut = want.out();
    const got = narrowContext(repo, id);
    const gotCode = gate(got.ctx, 'ready', id, { json: true });
    const gotOut = got.out();
    verdicts.add((JSON.parse(wantOut) as { verdict: string }).verdict);
    if (gotCode !== wantCode || gotOut !== wantOut) mismatches.push(id);
  }
  // the fixture bites: both verdicts occur, and the cross-ticket findings of a dependent ticket are in the reference
  expect([...verdicts].sort()).toEqual(['fail', 'pass']);
  const dependent = made(repo, reference.ctx.snapshot, reference.ctx.branch);
  gate(dependent.ctx, 'ready', 'W-1', { json: true });
  expect(dependent.out(), 'the reference sees the unknown and the dropped dependency of W-1').toMatch(/NOPE-1|DR-1/);
  expect(mismatches, 'tickets whose narrow Ready differs from the full one').toEqual([]);

  // the narrow load is narrow: a ticket holds itself, its epic and its dependencies, transitively, and a cycle ends
  const heldBy = (id: string): string[] => Object.keys(narrowContext(repo, id).ctx.snapshot.tickets).sort();
  expect(heldBy(STORY)).toEqual(['B-1', 'E-1']);
  expect(heldBy('W-1')).toEqual(['DR-1', 'F-1', 'U-1', 'W-1']);
  expect(heldBy('Z-1')).toEqual(['U-1', 'U-2', 'Z-1']);
  expect(heldBy('Y-1')).toEqual(['Y-1', 'Y-2']);
  expect(heldBy('NOPE-9')).toEqual([]);
  expect(Object.keys(reference.ctx.snapshot.tickets).length, 'the full load holds every ticket').toBeGreaterThan(15);

  // the command itself, through `preflight`: the same bytes as the reference, for a story with an epic, a ticket with dependencies and the epic
  for (const id of [STORY, 'W-1', EPIC]) {
    const want = made(repo, reference.ctx.snapshot, reference.ctx.branch);
    const wantCode = gate(want.ctx, 'ready', id, { json: true });
    const got = await run(['gate', 'ready', id, '--json'], repo, ENV);
    expect({ id, code: got.code, out: got.out }).toEqual({ id, code: wantCode, out: want.out() });
  }
}, 600_000);

/** What a command function prints and returns, or the words it threw: the same for both loads. */
function outcome(m: Made, call: (ctx: CommandContext) => number): { code: number | string; out: string } {
  let code: number | string;
  try {
    code = call(m.ctx);
  } catch (e) {
    code = 'threw: ' + (e as Error).message;
  }
  return { code, out: m.out() };
}

// Phase 08.9.2 Ruling-oracle (L-04): Plan, Done and the anchor print the same bytes on the narrow load as on the full one, for every ticket, and the anchor of the branch's own ticket in a worktree.
it('risk:regression gate plan gate done and anchor on the narrow load print what they print on the full load (Ruling-oracle)', async () => {
  const mismatches: string[] = [];
  const reference = fullContext(repo);
  const stageReference = fullContext(repo, true);
  const seen = new Set<string>();
  for (const id of ids) {
    for (const which of ['plan', 'done'] as const) {
      const want = outcome(made(repo, reference.ctx.snapshot, reference.ctx.branch), (ctx) => gate(ctx, which, id, { json: true }));
      const got = outcome(narrowContext(repo, id), (ctx) => gate(ctx, which, id, { json: true }));
      seen.add(which + ':' + (JSON.parse(want.out) as { verdict: string }).verdict);
      if (JSON.stringify(got) !== JSON.stringify(want)) mismatches.push(which + ' ' + id);
    }
    const wantAnchor = outcome(made(repo, stageReference.ctx.snapshot, stageReference.ctx.branch), (ctx) => anchor(ctx, id));
    const gotAnchor = outcome(narrowContext(repo, id, true), (ctx) => anchor(ctx, id));
    seen.add('anchor:' + (wantAnchor.out === '' ? 'empty' : 'text'));
    if (JSON.stringify(gotAnchor) !== JSON.stringify(wantAnchor)) mismatches.push('anchor ' + id);
  }
  // the fixture bites: Plan and Done print findings (no Plan or Done of the fixture passes, so the findings are what the compare reads) and some anchors print a ticket
  expect([...seen].sort()).toEqual(expect.arrayContaining(['anchor:text', 'done:fail', 'plan:fail']));
  expect(mismatches, 'commands whose narrow output differs from the full one').toEqual([]);

  // the commands themselves, through preflight: the story's Done, the epic's Plan, a story's anchor with its epic block
  for (const [argv, which, id] of [
    [['gate', 'done', STORY, '--json'], 'done', STORY],
    [['gate', 'plan', EPIC, '--json'], 'plan', EPIC],
  ] as const) {
    const want = outcome(made(repo, reference.ctx.snapshot, reference.ctx.branch), (ctx) => gate(ctx, which, id, { json: true }));
    const got = await run([...argv], repo, ENV);
    expect({ argv, code: got.code, out: got.out }).toEqual({ argv, code: want.code, out: want.out });
  }
  const wantStory = outcome(made(repo, stageReference.ctx.snapshot, stageReference.ctx.branch), (ctx) => anchor(ctx, STORY));
  expect(wantStory.out, 'the anchor of a story carries its epic').toContain('Epic E-1');
  expect(wantStory.out, 'and the lessons of its siblings, read from the default branch').toContain('- C-1: - Lesson: keep the cart on one page');
  const gotStory = await run(['anchor', STORY], repo, ENV);
  expect({ code: gotStory.code, out: gotStory.out }).toEqual(wantStory);

  // `anchor` with no id: the ticket the branch names, from the branch and the listing: the story's claim branch, a claim that exists on origin only, the default branch, a branch naming no ticket, a detached HEAD
  const checkouts: [string, string][] = [
    ['the story claim branch', worktreeOn(['<dir>', 't/' + STORY])],
    ['a claim on origin only', worktreeOn(['-b', 't/' + ORIGIN_ONLY, '<dir>', 'refs/remotes/origin/t/' + ORIGIN_ONLY])],
    ['the default branch', repo],
    ['a branch naming no ticket', worktreeOn(['-b', 'scratch/no-ticket', '<dir>', 'main'])],
    ['a detached HEAD', worktreeOn(['--detach', '<dir>', 'main'])],
  ];
  const texts: Record<string, string> = {};
  for (const [name, root] of checkouts) {
    const full = fullContext(root, true);
    const want = outcome(made(root, full.ctx.snapshot, full.ctx.branch), (ctx) => anchor(ctx, undefined));
    const got = outcome(narrowContext(root, { active: true }, true), (ctx) => anchor(ctx, undefined));
    expect({ name, ...got }).toEqual({ name, ...want });
    texts[name] = want.out;
    const viaRun = await run(['anchor'], root, ENV);
    expect({ name, code: viaRun.code, out: viaRun.out }).toEqual({ name, code: want.code, out: want.out });
  }
  expect(texts['the story claim branch'], 'the claim branch names the story').toContain('B-1');
  expect(texts['a claim on origin only'], 'the origin-only claim names its ticket').toContain('O-1');
  expect(texts['the default branch']).not.toContain('B-1');
}, 900_000);

/** The context `preflight('claims')` builds: the claim view (narrow with `only`), the checkout read beside it, and the default ref's records on the snapshot. */
function claimContext(root: string, only?: string): Made {
  const parts = loadClaimView(root, only === undefined ? undefined : { only });
  const memo = parts.memo ?? new Map<string, unknown>();
  const loaded = loadSnapshot(parts.view, { memo });
  const plain = parts.checkout === parts.view ? loaded : loadSnapshot(parts.checkout, { memo });
  const snapshot = withDefaultRef(root, loaded, parts.refs, memo, undefined, parts.ids);
  const m = made(root, snapshot, parts.branch, parts.ids);
  m.ctx.plain = plain;
  return m;
}

// Phase 08.9.2 Ruling-oracle (L-04): `show <id> --json` (with its log), `show <id>` text and `show <id> --approval` print the same bytes on the narrow claim view as on the full one, for every ticket,
// in the repository and in the worktrees of a claimed ticket and of an origin-only claim.
it('risk:regression show on the narrow claim view prints what it prints on the full one (Ruling-oracle)', async () => {
  const mismatches: string[] = [];
  const seen = new Set<string>();
  const compare = (root: string, where: string, targets: readonly string[]): void => {
    const reference = claimContext(root);
    for (const id of targets) {
      for (const [name, options] of [['json', { json: true }], ['text', {}]] as const) {
        const want = outcome(made(root, reference.ctx.snapshot, reference.ctx.branch), (ctx) => show({ ...ctx, ...(reference.ctx.plain === undefined ? {} : { plain: reference.ctx.plain }) }, id, options));
        const got = outcome(claimContext(root, id), (ctx) => show(ctx, id, options));
        seen.add(name + ':' + (typeof want.code === 'number' ? 'ok' + want.code : 'threw'));
        if (JSON.stringify(got) !== JSON.stringify(want)) mismatches.push(where + ' ' + name + ' ' + id);
      }
    }
  };
  compare(repo, 'repository', ids);
  for (const [name, root] of [
    ['the story claim worktree', worktreeOn(['<dir>', 't/' + STORY])],
    ['a claim on origin only', worktreeOn(['-b', 't/' + ORIGIN_ONLY, '<dir>', 'refs/remotes/origin/t/' + ORIGIN_ONLY])],
  ] as const) compare(root, name, [STORY, EPIC, 'C-1', ORIGIN_ONLY, 'V-1', 'W-1']);
  // the fixture bites: tickets with and without a lane, the story's claim copy, a dependent ticket
  expect([...seen].sort()).toEqual(expect.arrayContaining(['json:ok0', 'json:threw', 'text:ok0', 'text:threw']));
  const story = claimContext(repo, STORY);
  expect(Object.keys(story.ctx.snapshot.tickets).sort(), 'the narrow claim view holds the story and its epic').toEqual(['B-1', 'E-1']);
  const dependent = claimContext(repo, 'V-1');
  expect(Object.keys(dependent.ctx.snapshot.tickets).sort(), 'V-1 holds its claimed dependencies, read from their claim branches').toEqual(['B-1', 'E-1', 'O-1', 'V-1']);
  expect(mismatches, 'show outputs that differ between the narrow and the full claim view').toEqual([]);

  // the command itself, through preflight: --json, text and --approval, as the full load prints them
  const reference = claimContext(repo);
  for (const [argv, options] of [
    [['show', STORY, '--json'], { json: true }],
    [['show', STORY], {}],
    [['show', 'V-1', '--json'], { json: true }],
    [['show', EPIC, '--json'], { json: true }],
    [['show', STORY, '--approval'], { approval: true }],
    [['show', STORY, '--approval', '--short'], { approval: true, short: true }],
  ] as const) {
    const want = outcome(made(repo, reference.ctx.snapshot, reference.ctx.branch), (ctx) => show({ ...ctx, ...(reference.ctx.plain === undefined ? {} : { plain: reference.ctx.plain }) }, argv[1], options));
    const got = await run([...argv], repo, ENV);
    expect({ argv, code: got.code, out: got.out }).toEqual({ argv, code: want.code, out: want.out });
  }
}, 900_000);
