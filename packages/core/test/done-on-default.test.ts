// BUG-LN-13 D-01: the epic counts, the priority lifts and the laneless count read done on the default ref.
import { expect, it } from 'vitest';
import { dashboard, gateReady, loadSnapshot, setFrontmatterKey } from '../src/index.js';
import { AC, approve, CONFIG, done, LANE_BODY, laneTicket, P, ready } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

it('risk:complex-branching epic counts priority lifts and laneless tickets read done on the default ref', () => {
  const files: Files = {
    'accord/config.yml': CONFIG,
    [P('EP-1')]: laneTicket('EP-1', { lane: '' }).replace('type: story', 'type: epic'),
  };
  done(files, 'C-1', { frontmatter: ['parent: "EP-1"'] });
  files[P('L-1')] = setFrontmatterKey(setFrontmatterKey(laneTicket('L-1', { lane: '' }), 'verified', ['ac-1', 'ac-2']), 'verified_hash', AC);
  ready(files, 'P-1', { frontmatter: ['priority: low'] });
  ready(files, 'Q-1');
  done(files, 'D-1', { frontmatter: ['priority: high', 'depends_on: ["P-1"]'] });
  const snap = loadSnapshot({ files, tree: [] });
  const ref = loadSnapshot({
    files: {
      'accord/config.yml': CONFIG,
      [P('C-1')]: laneTicket('C-1'),
      [P('L-1')]: laneTicket('L-1', { lane: '' }),
      [P('D-1')]: laneTicket('D-1'),
    },
    tree: [],
  });
  const checkout = dashboard(snap, 'an@example.com');
  expect(checkout.epics.rows[0]).toMatchObject({ done: 1, total: 1 });
  expect(checkout.summary.withoutLane).toBe(0);
  expect(checkout.ready.rows.map((r) => r.id)).toEqual(['Q-1', 'P-1']);
  expect(checkout.summary.done).toBe(2);

  const onRef = dashboard({ ...snap, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: ref } }, 'an@example.com');
  expect(onRef.epics.rows[0].done).toBe(0);
  expect(onRef.summary.withoutLane).toBe(1);
  expect(onRef.ready.rows.map((r) => r.id)).toEqual(['P-1', 'Q-1']);
  expect(onRef.summary.done).toBe(0);
  expect(onRef.upNext.rows.map((r) => r.id).sort()).toEqual(['C-1', 'D-1']);
  for (const r of onRef.upNext.rows) expect(r.next).toBe('the pull request; run accord gate done');
  expect(onRef.upNext.suggest).toBeUndefined();
});

it('risk:complex-branching gate ready waits on each prerequisite not done on the default ref and asks to re-plan without one dropped there', () => {
  const dropped = { frontmatter: ['status: dropped'], body: LANE_BODY + '\n## Dropped\nNot needed.\n' };
  const files: Files = { 'accord/config.yml': CONFIG, [P('A')]: laneTicket('A') };
  done(files, 'C');
  files[P('D')] = laneTicket('D', dropped);
  files[P('B')] = laneTicket('B', { frontmatter: ['depends_on: ["A", "C", "D", "NOPE"]'] });
  approve(files, 'B');
  const snap = loadSnapshot({ files, tree: [] });
  const unmerged = (r: ReturnType<typeof gateReady>) => r.findings.filter((f) => f.rule === 'gate.depends-unmerged');
  const onRef = (refFiles: Files) => ({ ...snap, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: loadSnapshot({ files: refFiles, tree: [] }) } });

  const r = gateReady(snap, 'B');
  expect(r.verdict).toBe('fail');
  expect(unmerged(r)).toHaveLength(1);
  expect(unmerged(r)[0].pointer).toBe('/depends_on/0');
  expect(unmerged(r)[0].reason).toContain('"A"');
  expect(unmerged(r)[0].reason).toContain('in this checkout');
  expect(unmerged(r)[0].reason).toContain('never remove it from depends_on');
  expect(r.findings.find((f) => f.rule === 'lint.depends-dropped')?.pointer).toBe('/depends_on/2');
  expect(r.findings.find((f) => f.rule === 'lint.depends-unknown')?.pointer).toBe('/depends_on/3');
  expect(unmerged(r).some((f) => f.reason.includes('"D"') || f.reason.includes('"NOPE"'))).toBe(false);

  const refFiles: Files = { 'accord/config.yml': CONFIG };
  done(refFiles, 'A');
  refFiles[P('C')] = laneTicket('C');
  const r2 = gateReady(onRef(refFiles), 'B');
  expect(unmerged(r2)).toHaveLength(1);
  expect(unmerged(r2)[0].pointer).toBe('/depends_on/1');
  expect(unmerged(r2)[0].reason).toContain('"C"');
  expect(unmerged(r2)[0].reason).toContain('on origin/main');

  const droppedFiles: Files = { 'accord/config.yml': CONFIG };
  done(droppedFiles, 'C');
  droppedFiles[P('A')] = laneTicket('A', dropped);
  const r3 = gateReady(onRef(droppedFiles), 'B');
  expect(r3.verdict).toBe('fail');
  expect(unmerged(r3)).toHaveLength(1);
  expect(unmerged(r3)[0].pointer).toBe('/depends_on/0');
  expect(unmerged(r3)[0].reason).toContain('"A"');
  expect(unmerged(r3)[0].reason).toContain('dropped on origin/main');
  expect(unmerged(r3)[0].reason).toContain('re-plan this ticket without it');
  expect(unmerged(r3)[0].reason).not.toContain('wait');
  expect(unmerged(r3)[0].reason).not.toContain('never remove it from depends_on');
  expect(r3.findings.some((f) => f.rule === 'lint.depends-dropped' && f.pointer === '/depends_on/0')).toBe(false);
});
