// Phase 8.2 group 3 (work hygiene): the pure gap builders and the open-work predicate they share with the dashboard. No git, no filesystem.
import { expect, it } from 'vitest';
import { branchGaps, draftAge, draftStaleGaps, isOpenWork, leftoverGaps, loadSnapshot, statusRows, ticketIdleGaps } from '../src/index.js';
import type { ClaimRefFact, StatusRow } from '../src/index.js';
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

it('risk:complex-branching an unclaimed draft past stale_draft_days is one draft-stale gap naming its creator (8.2-ac-2)', () => {
  const draft = { id: 'T-3', days: 100, creator: 'c@x.io' };
  expect(draftStaleGaps([draft], '90', same)).toEqual([
    { id: 'draft-stale', text: 'T-3 created by c@x.io has not been touched for 100 days (stale_draft_days 90)', fix: '/accord-pickup T-3, or accord drop T-3 --reason "<why>"' },
  ]);
  expect(draftStaleGaps([draft], '120', same)).toEqual([]);
  expect(draftStaleGaps([{ ...draft, days: 90 }], '90', same)).toEqual([]);
  expect(draftStaleGaps([{ ...draft, creator: undefined }], '90', same)[0].text).toBe('T-3 created by an unknown author has not been touched for 100 days (stale_draft_days 90)');
  expect(draftStaleGaps([draft], '90', () => 'CX')[0].text).toContain('created by CX');
  // a draft only a backlog branch holds cannot be dropped until that branch is merged
  expect(draftStaleGaps([{ ...draft, queued: 'backlog/t-3-2026-08-12' }], '90', same)).toEqual([
    {
      id: 'draft-stale',
      text: 'T-3 created by c@x.io has waited on backlog/t-3-2026-08-12, not merged, for 100 days (stale_draft_days 90)',
      fix: 'merge backlog/t-3-2026-08-12 into the default branch first, then /accord-pickup T-3 or accord drop T-3 --reason "<why>"',
    },
  ]);
  // an id or a branch a shell would read gets no command
  for (const odd of [{ ...draft, id: 'T 3' }, { ...draft, queued: 'backlog/t;3' }]) {
    const [gap] = draftStaleGaps([odd], '90', same);
    expect(gap.fix).toContain('no command is printed');
    expect(gap.fix).not.toContain('/accord-pickup');
    expect(gap.fix).not.toContain('merge backlog');
  }
});

it('risk:parsing a draft age comes from its last activity or its queued branch date (D-02)', () => {
  const base = loadSnapshot({ files: { 'accord/config.yml': CONFIG }, tree: [] });
  const now = Date.UTC(2026, 10, 20, 12) / 1000;
  const snap = { ...base, lastActivity: { 'T-3': now - 100 * 86400 - 3600 }, queued: { 'ST-9': { branch: 'backlog/st-9-2026-08-12' }, 'ST-8': { branch: 'backlog/st-8' }, 'ST-7': { branch: 'backlog/st-7-2026-13-45' } } };
  expect(draftAge(snap, 'T-3', now)).toBe(100);
  expect(draftAge(snap, 'ST-9', now)).toBe(100); // from UTC midnight of 2026-08-12
  expect(draftAge(snap, 'ST-8', now)).toBeUndefined(); // no date suffix: the loader reads the branch tip
  expect(draftAge(snap, 'ST-7', now)).toBeUndefined(); // not a calendar date
  expect(draftAge(snap, 'NONE', now)).toBeUndefined();
});

it('risk:parsing a would-be removal line becomes one worktree-leftover gap with its next action cut (8.2-ac-3)', () => {
  const lines = [
    'removed /x/a-st-9 - next: tell the owner',
    'deleted t/ST-9 (was abc1234) - next: tell the owner',
    'kept t/ST-10: checked out in /x - next: tell the owner',
    'pruned /x/gone: gitdir file points to non-existent location - next: tell the owner',
    'deleted backlog/x: merged into origin/main (was def5678)',
  ];
  const authors: Record<string, string> = { 'removed /x/a-st-9': 'a@x.io', 'deleted t/ST-9 (was abc1234)': 'b@x.io' };
  const gaps = leftoverGaps(lines, (line) => authors[line], same);
  expect(gaps).toEqual([
    { id: 'worktree-leftover', text: 'removed /x/a-st-9; branch tip by a@x.io', fix: 'accord worktree clean' },
    { id: 'worktree-leftover', text: 'deleted t/ST-9 (was abc1234); branch tip by b@x.io', fix: 'accord worktree clean' },
    { id: 'worktree-leftover', text: 'pruned /x/gone: gitdir file points to non-existent location', fix: 'accord worktree clean' },
    { id: 'worktree-leftover', text: 'deleted backlog/x: merged into origin/main (was def5678); branch tip by an unknown author', fix: 'accord worktree clean' },
  ]);
  // D-08: the person is shown through the function the caller passes
  expect(leftoverGaps([lines[0]], () => 'a@x.io', () => 'AX')[0].text).toBe('removed /x/a-st-9; branch tip by AX');
  expect(leftoverGaps(['kept t/ST-10: checked out in /x'], () => 'a@x.io', same)).toEqual([]);
});

const NOW = Date.UTC(2026, 10, 20, 12) / 1000;
const ref = (over: Partial<ClaimRefFact>): ClaimRefFact => ({ name: 't/T-1', local: true, id: 'T-1', tip: NOW - 20 * 86400 - 3600, author: 'a@x.io', ticketAnywhere: true, origin: false, merged: false, ...over });

it('risk:complex-branching orphan and unpushed claim branches are judged once each (8.2-ac-4)', () => {
  const orphan = branchGaps([ref({ name: 't/ZZ-9', id: 'ZZ-9', ticketAnywhere: false, tip: NOW - 3 * 86400 })], new Set(), '14', NOW, same, { defaultName: 'origin/main' });
  expect(orphan).toEqual([
    {
      id: 'branch-orphan',
      text: 't/ZZ-9 (local) names ticket ZZ-9, and no accord/tickets/ZZ-9.md is in the checkout, on origin/main or on the branch; tip by a@x.io',
      fix: 'git branch -D t/ZZ-9',
    },
  ]);
  const remote = branchGaps([ref({ name: 't/ZZ-9', id: 'ZZ-9', local: false, ticketAnywhere: false, origin: true })], new Set(), '14', NOW, same);
  expect(remote.map((g) => [g.id, g.fix])).toEqual([['branch-orphan', 'git push origin --delete t/ZZ-9']]);
  expect(remote[0].text).toContain('t/ZZ-9 (origin) names ticket ZZ-9');

  const unpushed = branchGaps([ref({})], new Set(), '14', NOW, same);
  expect(unpushed).toEqual([
    {
      id: 'claim-unpushed',
      text: 't/T-1 (ticket T-1) has no origin/t/T-1, and its tip is 20 days old (stale_days 14); tip by a@x.io',
      fix: 'git push -u origin t/T-1 to keep it, or git branch -D t/T-1 to delete it',
    },
  ]);

  // left out: a name the dry clean deletes (local and origin spelling), a merged ref, a ref with an origin counterpart, a 3 day old tip, exactly stale_days old
  expect(branchGaps([ref({}), ref({ name: 't/ZZ-9', id: 'ZZ-9', ticketAnywhere: false })], new Set(['t/T-1', 't/ZZ-9']), '14', NOW, same)).toEqual([]);
  expect(branchGaps([ref({ name: 't/ZZ-9', id: 'ZZ-9', local: false, ticketAnywhere: false, origin: true })], new Set(['origin/t/ZZ-9']), '14', NOW, same)).toEqual([]);
  expect(branchGaps([ref({ merged: true })], new Set(), '14', NOW, same)).toEqual([]);
  expect(branchGaps([ref({ origin: true })], new Set(), '14', NOW, same)).toEqual([]);
  expect(branchGaps([ref({ tip: NOW - 3 * 86400 })], new Set(), '14', NOW, same)).toEqual([]);
  expect(branchGaps([ref({ tip: NOW - 14 * 86400 - 3600 })], new Set(), '14', NOW, same)).toEqual([]);
  // an origin-only ref is never an unpushed local claim
  expect(branchGaps([ref({ local: false, origin: true })], new Set(), '14', NOW, same)).toEqual([]);
  // an unknown author is named as such
  expect(branchGaps([ref({ author: undefined })], new Set(), '14', NOW, same)[0].text).toContain('tip by an unknown author');
  // no origin remote: only the orphan check runs
  expect(branchGaps([ref({}), ref({ name: 't/ZZ-9', id: 'ZZ-9', ticketAnywhere: false })], new Set(), '14', NOW, same, { unpushed: false }).map((g) => g.id)).toEqual(['branch-orphan']);
  // D-08
  expect(branchGaps([ref({})], new Set(), '14', NOW, () => 'AX')[0].text).toContain('tip by AX');
});

it('risk:security a branch name a shell would read gets no command in its fix (T-08.2-07)', () => {
  for (const name of ['t/x y', 't/x;rm -rf', 't/$(x)', 't/`x`', "t/x'y"]) {
    const gaps = branchGaps([ref({ name, local: true, ticketAnywhere: false }), ref({ name, local: false, ticketAnywhere: false, origin: true })], new Set(), '14', NOW, same);
    expect(gaps.map((g) => g.id).sort()).toEqual(['branch-orphan', 'branch-orphan', 'claim-unpushed']);
    for (const g of gaps) {
      expect(g.fix, name).toBe('the branch name holds characters a command line would read, so no command is printed; push or delete it by hand');
      expect(g.fix).not.toContain('git branch');
      expect(g.fix).not.toContain('git push');
    }
  }
});
