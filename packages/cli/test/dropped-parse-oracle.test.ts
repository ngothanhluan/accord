// Phase 08.9.2 D-08 (Ruling-oracle, L-04): `status` and `dashboard` read a dropped ticket for its frontmatter only, so its body is never scanned or parsed as gherkin.
// The output must not move: this file keeps the full parse as the reference (core `loadSnapshot` with no option, then `statusRows` and `dashboard`) and compares
// what the commands print with it, on a repository whose dropped and archived tickets carry a gherkin error and a lint warning in the body. Archived tickets are
// read in full (the fallback R-A of the plan, taken for them: a done archived ticket decides the `blockedBy` of the tickets that depend on it), and `status --all`
// reads every body in full (its rows carry them). A recording wrapper of core's `loadSnapshot` proves which commands pass the option. Nothing is timed.
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { dashboard, statusRows } from '@accord-dev/accord-core';
import type { RepoSnapshot, SnapshotInput } from '@accord-dev/accord-core';
import { loadSnapshot as coreLoad } from '@accord-dev/accord-core';
import { loadClaimView, withDefaultRef } from '../src/load/fs.js';
import { cleanup, commitMsg, gitRun, makeLaneRepo, run } from './helpers/repo.js';
import { building, done, laneTicket, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

type Load = { options: { memo?: unknown; frontmatterOnly?: readonly string[] } | undefined; snapshot: RepoSnapshot };
const loads: Load[] = [];

// Every load a command makes goes through core's `loadSnapshot`; the wrapper records the options it got and what it returned, and changes nothing.
vi.mock('@accord-dev/accord-core', async (orig) => {
  const actual = await orig<typeof import('@accord-dev/accord-core')>();
  return {
    ...actual,
    loadSnapshot: (input: SnapshotInput, options?: { memo?: unknown; frontmatterOnly?: readonly string[] }) => {
      const snapshot = actual.loadSnapshot(input, options as never);
      loads.push({ options, snapshot });
      return snapshot;
    },
  };
});

/** The loads the command itself made (`preflight`, the default ref, a reload): they carry the command's parse memo; the loaders' own small reads of a few files do not. Empties the record. */
const commandLoads = (): Load[] => loads.splice(0).filter((l) => l.options?.memo !== undefined);

const VIEWER = 'an@example.com';

// A body whose gherkin block is broken, so a full parse reports a load finding for the ticket.
const BROKEN = ['## Dropped', 'No longer wanted.', '', '## Intent', 'Gone.', '', '## Acceptance criteria', '```gherkin', 'this is not gherkin at all', '```', ''].join('\n');
// A body with a repeated heading, so a full parse reports a finding for the ticket.
const REPEATED = ['## Intent', 'Done long ago.', '', '## Intent', 'Said twice.', '', '## Closed', 'Finished.', ''].join('\n');

let repo = '';
beforeAll(() => {
  const files: Files = {};
  building(files, 'A-1');
  done(files, 'A-2');
  files[P('A-3')] = laneTicket('A-3', { frontmatter: ['status: draft'] });
  // a live ticket that depends on a dropped one, on an archived one that is done, and on an archived one that is not
  files[P('A-4')] = laneTicket('A-4', { frontmatter: ['depends_on: ["D-1", "X-1", "X-2"]'] });
  // the dropped ticket and the archived ones, with bodies a full parse would flag
  files[P('D-1')] = laneTicket('D-1', { frontmatter: ['status: dropped'], body: BROKEN });
  done(files, 'X-1', { frontmatter: ['status: archived'] });
  files[P('X-2')] = laneTicket('X-2', { frontmatter: ['status: archived'], body: REPEATED });
  // an epic with one done archived child, one dropped child and one live child
  files[P('E-1')] = laneTicket('E-1', { lane: 'L' }).replace('type: story', 'type: epic');
  done(files, 'C-1', { frontmatter: ['status: archived', 'parent: "E-1"'] });
  files[P('C-2')] = laneTicket('C-2', { frontmatter: ['status: dropped', 'parent: "E-1"'], body: BROKEN });
  files[P('C-3')] = laneTicket('C-3', { frontmatter: ['parent: "E-1"'] });
  repo = makeLaneRepo(files);
  gitRun(repo, 'config', 'user.email', VIEWER);
  gitRun(repo, 'config', 'user.name', 'fixture');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  commitMsg(repo, 'fixture');
});
afterAll(() => {
  if (repo !== '') cleanup(repo);
});

/** The snapshots `preflight('claims')` builds, by the same calls, with the full parse of every body (the reference). */
function reference(root: string): { snapshot: RepoSnapshot; plain: RepoSnapshot } {
  const parts = loadClaimView(root);
  const loaded = coreLoad(parts.view);
  const plain = parts.checkout === parts.view ? loaded : coreLoad(parts.checkout);
  return { snapshot: withDefaultRef(root, loaded, parts.refs), plain };
}

/** What `status --json` and `status --all --json` print, from the full parse. */
function statusReference(root: string, all: boolean): string {
  const { snapshot, plain } = reference(root);
  const rows = statusRows(snapshot, Math.floor(Date.now() / 1000), plain);
  return JSON.stringify(all ? rows : rows.filter((r) => r.status !== 'archived' && r.status !== 'dropped'), null, 2) + '\n';
}

const archivedBodiesRead = (snapshot: RepoSnapshot): boolean => ['X-1', 'X-2', 'C-1'].every((id) => snapshot.tickets[id] !== undefined && snapshot.tickets[id].sections.length > 0);

const droppedBodiesEmpty = (snapshot: RepoSnapshot): boolean =>
  ['D-1', 'C-2'].every((id) => snapshot.tickets[id] !== undefined && snapshot.tickets[id].sections.length === 0 && snapshot.tickets[id].scenarios.length === 0);

// Phase 08.9.2 D-08 (Ruling-oracle, L-04): the output guard and the proof that the path was taken, in one run of the commands.
it('risk:regression status and dashboard JSON are unchanged when dropped tickets are read for frontmatter only (D-08 Ruling-oracle)', async () => {
  // the fixture bites: a full parse sees a finding in a dropped ticket and in an archived one, and an epic with children exists
  const full = reference(repo).snapshot;
  const rows = statusRows(full, Math.floor(Date.now() / 1000));
  const flagged = (id: string): number => rows.filter((r) => r.id === id).reduce((n, r) => n + r.errors + r.warnings, 0);
  expect(flagged('D-1'), 'the dropped ticket draws a finding in a full parse').toBeGreaterThan(0);
  expect(flagged('X-2'), 'the archived ticket draws a finding in a full parse').toBeGreaterThan(0);
  expect(Object.keys(full.tickets).sort()).toEqual(['A-1', 'A-2', 'A-3', 'A-4', 'C-1', 'C-2', 'C-3', 'D-1', 'E-1', 'T-1', 'X-1', 'X-2']);

  // status: the same bytes, and every load of the command read the dropped and archived bodies for frontmatter only
  loads.length = 0;
  const status = await run(['status', '--json'], repo);
  const statusLoads = commandLoads();
  expect(status.code, status.err).toBe(0);
  expect(status.out).toBe(statusReference(repo, false));
  expect(statusLoads.length).toBeGreaterThan(0);
  for (const l of statusLoads) expect(l.options?.frontmatterOnly).toEqual(['dropped']);
  expect(droppedBodiesEmpty(statusLoads[0].snapshot)).toBe(true);
  // an archived ticket is read in full: its done state is what the tickets depending on it read
  expect(archivedBodiesRead(statusLoads[0].snapshot)).toBe(true);

  // status --all prints a row for each of them, and a row carries what the body says (findings, ready, ticks, stage), so every body is read in full
  loads.length = 0;
  const all = await run(['status', '--all', '--json'], repo);
  const allLoads = commandLoads();
  expect(all.code, all.err).toBe(0);
  expect(all.out).toBe(statusReference(repo, true));
  expect(allLoads.length).toBeGreaterThan(0);
  for (const l of allLoads) expect(l.options?.frontmatterOnly).toBeUndefined();

  // dashboard: the same bytes as the full parse, read for frontmatter only
  loads.length = 0;
  const board = await run(['dashboard', '--json', '--no-fetch'], repo);
  const boardLoads = commandLoads();
  expect(board.code, board.err).toBe(0);
  const ref = reference(repo);
  expect(board.out).toBe(JSON.stringify(dashboard(ref.snapshot, VIEWER, Math.floor(Date.now() / 1000), ref.plain), null, 2) + '\n');
  expect(boardLoads.length).toBeGreaterThan(0);
  for (const l of boardLoads) expect(l.options?.frontmatterOnly).toEqual(['dropped']);
  expect(droppedBodiesEmpty(boardLoads[0].snapshot)).toBe(true);
  expect(archivedBodiesRead(boardLoads[0].snapshot)).toBe(true);

  // no gate, lint or show load reads a body for its frontmatter only
  for (const argv of [['lint'], ['show', 'A-1', '--json'], ['gate', 'ready', 'A-1'], ['next', '--json']]) {
    loads.length = 0;
    await run(argv, repo);
    const seen = commandLoads();
    expect(seen.length, argv.join(' ') + ' loaded nothing').toBeGreaterThan(0);
    for (const l of seen) expect(l.options?.frontmatterOnly, argv.join(' ')).toBeUndefined();
  }
});
