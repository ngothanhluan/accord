// Phase 08.9.2 review CR-01: a repository with a test report. `gate.test-untraced` at Done reads the `@test:` tags of EVERY ticket, so a gate that loaded only the target's neighbourhood reported every case
// another ticket names as untraced. The fixture holds a report with a case only one ticket names, a case none names, and the two every lane ticket names; each command that runs on a narrow load
// (the three gates, the anchor, show) is compared, as the CLI runs it, with the same command function on the full load. Nothing is timed.
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { loadSnapshot } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { anchor } from '../src/commands/anchor.js';
import { gate } from '../src/commands/gate.js';
import { show } from '../src/commands/show.js';
import { loadClaimView, loadWithBranch, withDefaultRef } from '../src/load/fs.js';
import type { CommandContext } from '../src/run.js';
import { cleanup, run } from './helpers/repo.js';
import { narrowFixture, STORY, TRACED_ONLY_HERE, TRACER, UNTRACED_CASE } from './helpers/narrow-fixture.js';

const ENV = { CI: '1' }; // no gate log is written, so a run leaves nothing for the next one to read

type Made = { ctx: CommandContext; out: () => string };

function made(root: string, snapshot: RepoSnapshot, branch: { name: string | undefined } | undefined): Made {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const ctx: CommandContext = { root, snapshot, memo: new Map(), ...(branch === undefined ? {} : { branch }), stdout, stderr, env: ENV, ssh: new Map() };
  return { ctx, out: () => String(stdout.read() ?? '') };
}

/** The full load: what `preflight` read before the narrow load existed. `stage` is the anchor's mode. */
function fullContext(root: string, stage = false): Made {
  const { input, branch } = loadWithBranch(root, { stage });
  return made(root, loadSnapshot(input, { memo: new Map() }), branch);
}

/** The full claim view, the reference of `show`. */
function fullClaimContext(root: string): Made {
  const parts = loadClaimView(root);
  const memo = parts.memo ?? new Map<string, unknown>();
  const loaded = loadSnapshot(parts.view, { memo });
  const plain = parts.checkout === parts.view ? loaded : loadSnapshot(parts.checkout, { memo });
  const m = made(root, withDefaultRef(root, loaded, parts.refs, memo, undefined, parts.ids), parts.branch);
  m.ctx.plain = plain;
  return m;
}

function outcome(m: Made, call: (ctx: CommandContext) => number): { code: number | string; out: string } {
  let code: number | string;
  try {
    code = call(m.ctx);
  } catch (e) {
    code = 'threw: ' + (e as Error).message;
  }
  return { code, out: m.out() };
}

let repo = '';
let ids: string[] = [];
beforeAll(async () => {
  repo = narrowFixture(0, true);
  ids = [...Object.keys(fullContext(repo).ctx.snapshot.tickets), 'NOPE-9'].sort();
  // a passing Ready or Plan writes a hash into the ticket; written once here, so neither load of the compare meets a file the other one changed
  for (const which of ['ready', 'plan'] as const) {
    const settle = fullContext(repo);
    for (const id of ids) gate(made(repo, settle.ctx.snapshot, settle.ctx.branch).ctx, which, id, { json: true });
  }
});
afterAll(() => {
  if (repo !== '') cleanup(repo);
});

// Phase 08.9.2 review CR-01: Ready, Plan and Done print the same bytes through the CLI as on the full load, in a repository with a test report, and Done names the one case nothing traces.
it('risk:regression gate ready gate plan and gate done print the full-load findings in a repository with a test report (CR-01)', async () => {
  const reference = fullContext(repo);
  const mismatches: string[] = [];
  const untraced = new Set<string>();
  for (const id of ids) {
    for (const which of ['ready', 'plan', 'done'] as const) {
      const want = outcome(made(repo, reference.ctx.snapshot, reference.ctx.branch), (ctx) => gate(ctx, which, id, { json: true }));
      const got = await run(['gate', which, id, '--json'], repo, ENV);
      if (got.code !== want.code || got.out !== want.out) mismatches.push(which + ' ' + id);
      if (which === 'done') for (const m of want.out.matchAll(/test \\"([^"\\]+)\\" is named by no scenario/g)) untraced.add(id + ':' + m[1]);
    }
  }
  // the fixture bites: the reference names the case no scenario names for lane tickets, and never the case a ticket outside the neighbourhood names
  expect([...untraced].some((u) => u.endsWith(':' + UNTRACED_CASE)), 'the reference reports the case nothing traces').toBe(true);
  expect([...untraced].filter((u) => u.endsWith(':' + TRACED_ONLY_HERE)), 'the reference never reports a case another ticket names').toEqual([]);
  expect(ids).toContain(TRACER);
  expect(mismatches, 'gate runs whose output differs from the full load').toEqual([]);
}, 900_000);

// Phase 08.9.2 review CR-01: the anchor and show print the same bytes through the CLI as on the full load, in the same repository.
it('risk:regression anchor and show print the full-load output in a repository with a test report (CR-01)', async () => {
  const stageReference = fullContext(repo, true);
  const claimReference = fullClaimContext(repo);
  const mismatches: string[] = [];
  // an id nobody holds throws on the full load and exits 2 through the CLI, which is not what the compare reads
  for (const id of ids.filter((x) => x !== 'NOPE-9')) {
    const wantAnchor = outcome(made(repo, stageReference.ctx.snapshot, stageReference.ctx.branch), (ctx) => anchor(ctx, id));
    const gotAnchor = await run(['anchor', id], repo, ENV);
    if (gotAnchor.code !== wantAnchor.code || gotAnchor.out !== wantAnchor.out) mismatches.push('anchor ' + id);
    const wantShow = outcome(made(repo, claimReference.ctx.snapshot, claimReference.ctx.branch), (ctx) => show({ ...ctx, ...(claimReference.ctx.plain === undefined ? {} : { plain: claimReference.ctx.plain }) }, id, { json: true }));
    const gotShow = await run(['show', id, '--json'], repo, ENV);
    if (gotShow.code !== wantShow.code || gotShow.out !== wantShow.out) mismatches.push('show ' + id);
  }
  expect(ids).toContain(STORY);
  expect(mismatches, 'anchor and show outputs that differ from the full load').toEqual([]);
}, 900_000);
