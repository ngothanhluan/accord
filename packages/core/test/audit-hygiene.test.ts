// Phase 8.2 group 3 (work hygiene): the pure gap builders and the open-work predicate they share with the dashboard. No git, no filesystem.
import { expect, it } from 'vitest';
import { isOpenWork, loadSnapshot, statusRows, ticketIdleGaps } from '../src/index.js';
import type { StatusRow } from '../src/index.js';
import { CONFIG, done, laneTicket, P, building } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const row = (over: Partial<StatusRow>): StatusRow => ({ id: 'T-1', ui: false, errors: 0, warnings: 0, ready: 'none', ticksVerified: 0, ticksTagged: 0, ticksBinding: 'none', ...over });
const same = (email: string): string => email;

it('risk:complex-branching a claimed ticket idle past stale_days is one ticket-idle gap naming its claimer and days (8.2-ac-1)', () => {
  const gaps = ticketIdleGaps([row({ id: 'T-1', claimedBy: 'a@x.io', idleDays: 20 })], '14', same);
  expect(gaps).toEqual([
    { id: 'ticket-idle', text: 'T-1 claimed by a@x.io has had no activity for 20 days (stale_days 14)', fix: '/accord-continue T-1, or accord drop T-1 --reason "<why>"' },
  ]);
  // a claimed row with no idleDays, and an unclaimed row with idleDays, are not idle claims
  expect(ticketIdleGaps([row({ claimedBy: 'a@x.io' }), row({ id: 'T-2', idleDays: 40 })], '14', same)).toEqual([]);
  // D-08: the person is shown through the function the caller passes
  const shownAs = ticketIdleGaps([row({ claimedBy: 'a@x.io', idleDays: 20 })], '14', (email) => (email === 'a@x.io' ? 'AX' : email));
  expect(shownAs[0].text).toContain('claimed by AX');
  expect(shownAs[0].text).not.toContain('a@x.io');
  // gaps come out in id code-point order
  const many = ticketIdleGaps([row({ id: 'B-2', claimedBy: 'a@x.io', idleDays: 20 }), row({ id: 'A-10', claimedBy: 'a@x.io', idleDays: 20 }), row({ id: 'A-2', claimedBy: 'a@x.io', idleDays: 20 })], '14', same);
  expect(many.map((g) => g.text.split(' ')[0])).toEqual(['A-10', 'A-2', 'B-2']);
});

it('risk:security a ticket id a shell would read gets no command in its fix (D-01)', () => {
  for (const id of ['T 1', 'T;1', 'T$(x)', '-T1']) {
    const [gap] = ticketIdleGaps([row({ id, claimedBy: 'a@x.io', idleDays: 20 })], '14', same);
    expect(gap.id).toBe('ticket-idle');
    expect(gap.fix).toBe('the ticket id holds characters a command line would read, so no command is printed: rename its ticket file to a plain id first');
    expect(gap.fix).not.toContain('/accord-continue');
    expect(gap.fix).not.toContain('accord drop');
  }
});

it('risk:regression isOpenWork is the dashboard open definition (D-01)', () => {
  const files: Files = { 'accord/config.yml': CONFIG };
  files[P('INT-1')] = laneTicket('INT-1');
  building(files, 'BLD-1');
  files[P('EP-1')] = laneTicket('EP-1', { lane: '' }).replace('type: story', 'type: epic');
  files[P('EPL-1')] = laneTicket('EPL-1').replace('type: story', 'type: epic');
  files[P('ARC-1')] = laneTicket('ARC-1', { frontmatter: ['status: archived'] });
  files[P('DRP-1')] = laneTicket('DRP-1', { frontmatter: ['status: dropped'] });
  done(files, 'DON-1', { frontmatter: ['status: draft'] });
  const snap = loadSnapshot({ files, tree: [] });
  const open = statusRows(snap).filter(isOpenWork(snap)).map((r) => r.id);
  expect(open.sort()).toEqual(['BLD-1', 'INT-1']);

  // with a default ref, a ticket is done exactly when that ref holds it done: BLD-1 is done there, DON-1 is not
  const onRef: Files = { 'accord/config.yml': CONFIG };
  done(onRef, 'BLD-1');
  const withRef = { ...snap, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: loadSnapshot({ files: onRef, tree: [] }) } };
  const openOnRef = statusRows(withRef).filter(isOpenWork(withRef)).map((r) => r.id);
  expect(openOnRef.sort()).toEqual(['DON-1', 'INT-1']);
});
