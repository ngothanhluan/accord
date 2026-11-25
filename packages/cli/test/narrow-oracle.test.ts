// Phase 08.9.2 Ruling-narrow, Ruling-oracle (L-04): a command for one ticket reads that ticket, its epic and its dependencies, and prints what it prints on the full load.
// The full load stays in this file as the reference: the same command function run on a context built from `loadWithBranch` (every file under accord/), against a context built from
// `loadNarrow` (the files outside accord/tickets/ and the target's neighbourhood). The fixture holds each cross-ticket read of RESEARCH F-6. Nothing is timed.
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { loadSnapshot } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { gate } from '../src/commands/gate.js';
import { loadNarrow, loadWithBranch } from '../src/load/fs.js';
import type { CommandContext } from '../src/run.js';
import { cleanup, run } from './helpers/repo.js';
import { EPIC, narrowFixture, STORY } from './helpers/narrow-fixture.js';

const ENV = { CI: '1' }; // no gate log is written, so a run leaves nothing for the next one to read

type Made = { ctx: CommandContext; out: () => string; err: () => string };

/** The context `preflight('checkout')` builds, from a snapshot and the branch the load read. */
function made(root: string, snapshot: RepoSnapshot, branch: { name: string | undefined } | undefined, ids?: string[]): Made {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const ctx: CommandContext = { root, snapshot, memo: new Map(), ...(branch === undefined ? {} : { branch }), stdout, stderr, env: ENV, ssh: new Map(), ...(ids === undefined ? {} : { ids }) };
  return { ctx, out: () => String(stdout.read() ?? ''), err: () => String(stderr.read() ?? '') };
}

/** The full load: what `preflight` did before the narrow load existed. */
function fullContext(root: string): Made {
  const { input, branch } = loadWithBranch(root);
  return made(root, loadSnapshot(input, { memo: new Map() }), branch);
}

/** The narrow load of `target`, the way `preflight` builds it. */
function narrowContext(root: string, target: string): Made {
  const n = loadNarrow(root, target, {});
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
});
afterAll(() => {
  if (repo !== '') cleanup(repo);
});

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

  // the command itself, through `preflight`: the same bytes as the reference, for a story with an epic, a ticket with dependencies and the epic
  for (const id of [STORY, 'W-1', EPIC]) {
    const want = made(repo, reference.ctx.snapshot, reference.ctx.branch);
    const wantCode = gate(want.ctx, 'ready', id, { json: true });
    const got = await run(['gate', 'ready', id, '--json'], repo, ENV);
    expect({ id, code: got.code, out: got.out }).toEqual({ id, code: wantCode, out: want.out() });
  }
}, 600_000);
