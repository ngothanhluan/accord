// Phase 15 D-29, D-17: the dashboard group "merged, waiting for verify". The host says which tickets merged (`snapshot.mergedClaims`); core only groups. A merged ticket that is not done on the
// default ref leaves yours, team, ready and upNext and the pick-up suggestion; one that is done there, or is not named, is as it was. Pure: hand-built snapshots, no git.
import { expect, it } from 'vitest';
import { dashboard, loadSnapshot } from '../src/index.js';
import { building, CONFIG, done, ready } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import type { RepoSnapshot } from '../src/index.js';

const VIEWER = 'v@x.io';
const REF = 'refs/remotes/origin/main';

/** M-1 built and reviewed (stage verify), claimed by `by`; R-1 ready and unclaimed; U-1 built and reviewed, claimed by someone else; B-1 ready, unclaimed, behind R-1 in the backlog. */
function repo(by: string): { files: Files; claims: Record<string, string> } {
  const files: Files = { 'accord/config.yml': CONFIG };
  building(files, 'M-1');
  files['accord/tickets/M-1/ledger.md'] = '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n';
  files['accord/tickets/M-1/review.md'] = 'verdict: converged\n';
  ready(files, 'R-1');
  building(files, 'U-1');
  files['accord/tickets/U-1/ledger.md'] = '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n';
  files['accord/tickets/U-1/review.md'] = 'verdict: converged\n';
  return { files, claims: { 'M-1': by, 'U-1': 'a@x.io' } };
}

const snapshotOf = (by: string, merged?: string[], onRef?: RepoSnapshot): RepoSnapshot => {
  const { files, claims } = repo(by);
  const base = loadSnapshot({ files, tree: [], claims, ...(merged === undefined ? {} : { mergedClaims: merged }) });
  return onRef === undefined ? base : { ...base, defaultRef: { ref: REF, snapshot: onRef } };
};
const ids = (rows: { id: string }[]): string[] => rows.map((r) => r.id);

it('risk:complex-branching a merged ticket not done on the default ref is under mergedWaiting and in no other group nor the pick-up suggestion (D-29)', () => {
  const plain = dashboard(snapshotOf('a@x.io'), VIEWER);
  expect(ids(plain.team.rows)).toContain('M-1');
  expect(plain.mergedWaiting).toEqual({ rows: [], more: 0 });
  expect(plain.summary.mergedWaiting).toBe(0);

  const d = dashboard(snapshotOf('a@x.io', ['M-1']), VIEWER);
  expect(ids(d.mergedWaiting.rows)).toEqual(['M-1']);
  expect(d.mergedWaiting.rows[0]).toMatchObject({ stage: 'verify', next: "verification and the owner's tick" });
  for (const section of [d.yours, d.team, d.ready, d.upNext]) expect(ids(section.rows)).not.toContain('M-1');
  expect(ids(d.team.rows)).toEqual(['U-1']);
  expect(d.upNext.suggest?.id).not.toBe('M-1');
  expect(d.summary.mergedWaiting).toBe(1);
  expect(d.summary.inProgress).toBe(plain.summary.inProgress - 1);
  expect(ids(d.ready.rows)).toEqual(['R-1']);
});

it('risk:complex-branching a merged ticket that is the viewer\'s own is not under yours, and an unclaimed merged ticket is not a pick-up (D-29)', () => {
  const mine = dashboard(snapshotOf(VIEWER, ['M-1']), VIEWER);
  expect(ids(mine.yours.rows)).toEqual([]);
  expect(ids(mine.mergedWaiting.rows)).toEqual(['M-1']);

  // a merged ticket whose claim branch is gone has no claimant: it is the fault of the owner's report when it lands in upNext as the suggestion
  const { files } = repo('a@x.io');
  const gone = loadSnapshot({ files, tree: [], mergedClaims: ['M-1'] });
  const before = dashboard(loadSnapshot({ files, tree: [] }), VIEWER);
  expect(before.upNext.suggest).toBeDefined();
  const d = dashboard(gone, VIEWER);
  expect(ids(d.mergedWaiting.rows)).toEqual(['M-1']);
  expect(ids(d.upNext.rows)).not.toContain('M-1');
  expect(d.upNext.suggest?.id).not.toBe('M-1');
});

it('risk:regression a merged ticket that is done on the default ref is in neither mergedWaiting nor open work, and a ticket not named is untouched (D-29)', () => {
  const onRef: Files = { 'accord/config.yml': CONFIG };
  done(onRef, 'M-1');
  const refSnap = loadSnapshot({ files: onRef, tree: [] });
  const d = dashboard(snapshotOf('a@x.io', ['M-1'], refSnap), VIEWER);
  expect(ids(d.mergedWaiting.rows)).toEqual([]);
  for (const section of [d.yours, d.team, d.ready, d.upNext]) expect(ids(section.rows)).not.toContain('M-1');
  expect(d.summary.mergedWaiting).toBe(0);
  expect(d.summary.done).toBe(1);

  // U-1 is built, reviewed and claimed by a teammate and is not named: it stays where it was, whatever else is merged
  expect(ids(d.team.rows)).toEqual(['U-1']);
  const without = dashboard(snapshotOf('a@x.io', undefined, refSnap), VIEWER);
  expect(without.team).toEqual(d.team);
  expect(without.ready).toEqual(d.ready);
});
