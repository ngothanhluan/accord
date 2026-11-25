// Phase 08.9.2 D-08 (Ruling-oracle, L-04): one command builds up to three snapshots (the view, the checkout and the default ref) and each re-parsed
// mostly equal text, plan bodies hashed three times over. A per-command parse memo, handed down by `preflight`, parses each distinct file once. The proof is
// structural and by output: a counting Map shows every distinct file missing once, and `status`, `dashboard` and `show` print the same JSON with the
// memo and without it. The no-memo path stays in this file as the reference; nothing is timed.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { dashboard, loadSnapshot, statusRows, ticketDetail } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { loadClaimView, withDefaultRef } from '../src/load/fs.js';
import { cleanup, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { building, done, laneTicket, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const VIEWER = 'an@example.com';
const NOW = 1_800_000_000;

const identity = (repo: string): void => {
  gitRun(repo, 'config', 'user.email', VIEWER);
  gitRun(repo, 'config', 'user.name', 'fixture');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
};

/** A Map that records which keys were read and found nothing (a miss, then stored) and how many reads found something (a hit). */
class CountingMemo extends Map<string, unknown> {
  readonly misses = new Map<string, number>();
  hits = 0;
  override get(key: string): unknown {
    const value = super.get(key);
    if (value === undefined) this.misses.set(key, (this.misses.get(key) ?? 0) + 1);
    else this.hits += 1;
    return value;
  }
}

/** The snapshots `preflight('claims')` builds, by the same calls, with or without the memo handed to every load. */
function claimSnapshots(root: string, memo?: Map<string, unknown>): { snapshot: RepoSnapshot; plain: RepoSnapshot } {
  const options = memo === undefined ? undefined : { memo };
  const parts = loadClaimView(root);
  const loaded = loadSnapshot(parts.view, options);
  const plain = parts.checkout === parts.view ? loaded : loadSnapshot(parts.checkout, options);
  return { snapshot: withDefaultRef(root, loaded, parts.refs, memo), plain };
}

/** Everything the three commands read from those snapshots, as one string, plus the snapshot itself. */
function printed(root: string, memo?: Map<string, unknown>): string {
  const { snapshot, plain } = claimSnapshots(root, memo);
  return JSON.stringify({
    snapshot,
    status: statusRows(snapshot, NOW, plain),
    dashboard: dashboard(snapshot, VIEWER, NOW, plain),
    detail: ticketDetail(snapshot, 'T-1', plain),
  });
}

// (a) the view, the checkout and the default ref share every file: T-1 in build, T-2 done, T-3 a draft.
let shared = '';
// (b) T-1 is claimed on a pushed branch that is done there while the default ref still has it in build, so the three snapshots differ on T-1.
let claimed = '';
beforeAll(() => {
  const files: Files = {};
  building(files, 'T-1');
  done(files, 'T-2');
  files[P('T-3')] = laneTicket('T-3');
  shared = makeLaneRepo(files);
  identity(shared);
  commitMsg(shared, 'fixture');

  const base: Files = {};
  building(base, 'T-1');
  base[P('T-2')] = laneTicket('T-2', { frontmatter: ['depends_on: ["T-1"]'] });
  claimed = makeLaneRepo(base);
  identity(claimed);
  commitMsg(claimed, 'fixture');
  const onClaim: Files = {};
  done(onClaim, 'T-1');
  writeFiles(claimed, onClaim);
  commitMsg(claimed, 'fixture');
  gitRun(claimed, 'update-ref', 'refs/remotes/origin/t/T-1', 'HEAD');
  gitRun(claimed, 'reset', '-q', '--hard', 'HEAD~1');
});
afterAll(() => {
  for (const repo of [shared, claimed]) if (repo !== '') cleanup(repo);
});

// Phase 08.9.2 D-08: the output guard. It is green before the memo exists by design (both paths are the same code) and must stay green after.
it('risk:regression status dashboard and show print the same JSON with and without the shared parse memo (D-08)', async () => {
  for (const repo of [shared, claimed]) {
    const without = printed(repo);
    expect(printed(repo, new Map())).toBe(without);
    // A memo that already holds the files of an earlier command changes nothing either.
    const warm = new Map<string, unknown>();
    printed(repo, warm);
    expect(printed(repo, warm)).toBe(without);
    // Nothing is kept between two runs in one process.
    for (const argv of [['status', '--json'], ['dashboard', '--json'], ['show', 'T-1', '--json']]) {
      const first = await run(argv, repo);
      const second = await run(argv, repo);
      expect(first.code, argv.join(' ') + ' ' + first.err).toBe(0);
      expect(second.out).toBe(first.out);
    }
  }
});

// Phase 08.9.2 D-08: the structural proof. Each distinct kind, path and text is parsed once; the default-ref snapshot reuses the view's files.
it('risk:resource one command parses each distinct ticket and plan text once (D-08)', () => {
  const memo = new CountingMemo();
  const { snapshot } = claimSnapshots(shared, memo);
  expect(snapshot.defaultRef).toBeDefined();
  const tickets = Object.keys(snapshot.tickets).length;
  expect(tickets).toBe(3);
  expect(memo.size).toBeGreaterThan(0);
  expect([...memo.misses.values()].filter((n) => n !== 1)).toEqual([]);
  expect(memo.hits).toBeGreaterThanOrEqual(tickets);
});
