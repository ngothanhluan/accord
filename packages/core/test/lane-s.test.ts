// ST-LN-31 task 2: the lane S stage, status row and anchor read the ready record, the review record and the commits after it.
import { expect, it } from 'vitest';
import { loadSnapshot } from '../src/load/snapshot.js';
import { laneSHash } from '../src/gate/hash.js';
import { nextRows, statusRows } from '../src/status/rows.js';
import { isDone } from '../src/status/stage.js';
import { anchorText } from '../src/status/anchor.js';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';

const S = (body = LANE_S_BODY, fm: string[] = []) => laneTicket('S-1', { lane: 'S', body, frontmatter: fm });
const snap = (files: Record<string, string>, extra = {}) => loadSnapshot({ files: { 'accord/config.yml': CONFIG, ...files }, tree: [], ...extra });
const row = (s: ReturnType<typeof snap>) => statusRows(s).find((r) => r.id === 'S-1');
const H = laneSHash(snap({ 'accord/tickets/S-1.md': S() }).tickets['S-1']);
const R = 'accord/tickets/S-1/review.md';
const ready = { 'accord/tickets/S-1.md': S(LANE_S_BODY, ['ac_hash: "' + H + '"']) };
const conv = { ...ready, [R]: '## Round 1\n\nNo findings\n\nverdict: converged\n' };
const commit = (files: string[]) => ({ afterVerify: { 'S-1': [{ sha: 'a'.repeat(40), parents: ['b'.repeat(40)], files }] } });

it('risk:complex-branching the lane S stage and anchor follow the ready record the review record and the commits after it', () => {
  expect(row(snap({ 'accord/tickets/S-1.md': S() }))).toMatchObject({
    lane: 'S',
    stage: 'intent',
    ready: 'none',
    next: 'write ## Understood and ## Done when, then pass accord gate ready (lane-s.md)',
  });
  const r = row(snap(ready));
  expect(r).toMatchObject({ stage: 'build', ready: 'ok', tasksDone: 0, tasksTotal: 0 });
  expect(r?.next).toBeUndefined();
  expect(nextRows(statusRows(snap(ready))).map((x) => x.id)).toContain('S-1');

  expect(row(snap({ ...ready, [R]: '## Round 1\n\nMust 1: x — src/a.ts:1\n' }))).toMatchObject({
    stage: 'review',
    next: 'the next review round, numbered after the last ## Round in review.md (lane-s.md)',
  });
  const d = row(snap(conv));
  expect(d?.stage).toBe('done');
  expect(d?.next).toBeUndefined();
  expect(isDone(snap(conv), 'S-1')).toBe(true);
  expect(row(snap({ ...ready, [R]: '## Round 1\n\nNo findings\n\nverdict: accepted-by-owner "ship it"\n' }))?.stage).toBe('done');
  expect(row(snap({ ...ready, [R]: '## Round 1\n\nNo findings\n\nverdict: converged\nx\n' }))?.stage).toBe('review');
  expect(row(snap({ ...ready, [R]: '## Round 1\n\nMust 1: x\n\nverdict: open\n' }))?.stage).toBe('review');
  expect(row(snap(conv, commit(['src/a.ts'])))?.stage).toBe('review');
  expect(row(snap(conv, commit(['accord/tickets/S-1/ledger.md'])))?.stage).toBe('done');

  const edited = { ...conv, 'accord/tickets/S-1.md': S(LANE_S_BODY.replace('csv', 'tsv'), ['ac_hash: "' + H + '"']) };
  expect(row(snap(edited))).toMatchObject({ stage: 'intent', ready: 'stale' });

  const a = anchorText(snap(ready), 'S-1')!.split('\n');
  const want = ['Lane: S', 'Stage: build, next: the change and the tests.affected command (lane-s.md)', '## Understood', 'The export button writes a csv file.', '## Done when', 'Pressing export saves report.csv.', '## Rulings'];
  let at = -1;
  for (const w of want) {
    const i = a.indexOf(w, at + 1);
    expect(i, w).toBeGreaterThan(at);
    at = i;
  }
  expect(a).not.toContain('## Intent');
  expect(a).not.toContain('## Corrections');

  const withCorr = { 'accord/tickets/S-1.md': S(LANE_S_BODY + '\n## Corrections\n- "no, the tsv one"\n', ['ac_hash: "' + H + '"']) };
  const b = anchorText(snap(withCorr), 'S-1')!.split('\n');
  const i = b.indexOf('Pressing export saves report.csv.');
  expect(b.slice(i + 1).filter((l) => l !== '').slice(0, 3)).toEqual(['## Corrections', '- "no, the tsv one"', '## Rulings']);

  expect(anchorText(snap({ 'accord/tickets/T-1.md': laneTicket('T-1') }), 'T-1')!.split('\n').some((l) => l.startsWith('Lane:'))).toBe(false);
});
