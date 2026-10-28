// BUG-LN-13 D-01: the epic counts, the priority lifts and the laneless count read done on the default ref.
import { expect, it } from 'vitest';
import { dashboard, loadSnapshot, setFrontmatterKey } from '../src/index.js';
import { AC, CONFIG, done, laneTicket, P, ready } from '../../../test/helpers/lane.js';
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
