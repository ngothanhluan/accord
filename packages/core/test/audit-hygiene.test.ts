// Phase 8.2 group 3 (work hygiene): the pure gap builders and the open-work predicate they share with the dashboard. No git, no filesystem.
import { expect, it } from 'vitest';
import { BASELINE_LISTED, baselineGap, branchGaps, deferredGaps, draftAge, draftStaleGaps, isOpenWork, leftoverGaps, loadSnapshot, removableBaseline, statusRows, ticketIdleGaps } from '../src/index.js';
import type { ClaimRefFact, StatusRow } from '../src/index.js';
import { NO_COMMAND_GUESS, NO_COMMAND_TIP } from '../src/audit/hygiene.js';
import { CONFIG, done, junit, LANE_BODY, laneTicket, P, building, REPORT } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const row = (over: Partial<StatusRow>): StatusRow => ({ id: 'T-1', ui: false, errors: 0, warnings: 0, ready: 'none', ticksVerified: 0, ticksTagged: 0, ticksBinding: 'none', ...over });
const same = (email: string): string => email;

it('risk:complex-branching a claimed ticket idle past stale_days is one ticket-idle gap naming its claimer and days (8.2-ac-1)', () => {
  const gaps = ticketIdleGaps([row({ id: 'T-1', claimedBy: 'a@x.io', idleDays: 20 })], '14', same);
  expect(gaps).toEqual([
    { id: 'ticket-idle', text: 'T-1 claimed by a@x.io has had no activity for 20 days (stale_days 14)', fix: 'ask to continue T-1, or accord drop T-1 --reason "<why>"' },
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
    expect(gap.fix).not.toContain('/accord continue');
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
    { id: 'draft-stale', text: 'T-3 created by c@x.io has not been touched for 100 days (stale_draft_days 90)', fix: 'ask to pick up T-3, or accord drop T-3 --reason "<why>"' },
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
      fix: 'the owner merges the pull request of backlog/t-3-2026-08-12 first, then ask to pick up T-3 or accord drop T-3 --reason "<why>"',
    },
  ]);
  // an id or a branch a shell would read gets no command
  for (const odd of [{ ...draft, id: 'T 3' }, { ...draft, queued: 'backlog/t;3' }]) {
    const [gap] = draftStaleGaps([odd], '90', same);
    expect(gap.fix).toContain('no command is printed');
    expect(gap.fix).not.toContain('ask to pick up');
    expect(gap.fix).not.toContain('merges the pull request');
  }
});

// Phase 08.8 D-15, D-17: the idle and stale fixes tell a person what to ask, in words, and leave the merge of a queued draft's pull request to the owner
it('risk:regression the idle and stale fixes say what to ask and leave merging to the owner (D-15 D-17)', () => {
  const fixes = [
    ...ticketIdleGaps([row({ id: 'T-1', claimedBy: 'a@x.io', idleDays: 20 })], '14', same),
    ...draftStaleGaps([{ id: 'T-3', days: 100, creator: 'c@x.io' }, { id: 'T-4', days: 100, creator: 'c@x.io', queued: 'backlog/t-4-2026-08-12' }], '90', same),
  ].map((g) => g.fix);
  expect(fixes).toEqual([
    'ask to continue T-1, or accord drop T-1 --reason "<why>"',
    'ask to pick up T-3, or accord drop T-3 --reason "<why>"',
    'the owner merges the pull request of backlog/t-4-2026-08-12 first, then ask to pick up T-4 or accord drop T-4 --reason "<why>"',
  ]);
  for (const fix of fixes) {
    expect(fix).not.toContain('/accord continue');
    expect(fix).not.toContain('/accord pick-up');
    expect(fix).not.toMatch(/(^|[ ,])merge [a-z]/);
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
const TIP = '1234567890abcdef1234567890abcdef12345678';
const ref = (over: Partial<ClaimRefFact>): ClaimRefFact => ({ name: 't/T-1', sha: TIP, local: true, id: 'T-1', tip: NOW - 20 * 86400 - 3600, author: 'a@x.io', ticketAnywhere: true, origin: false, merged: false, ...over });

it('risk:complex-branching orphan and unpushed claim branches are judged once each (8.2-ac-4)', () => {
  const orphan = branchGaps([ref({ name: 't/ZZ-9', id: 'ZZ-9', ticketAnywhere: false, tip: NOW - 3 * 86400 })], new Set(), '14', NOW, same, { defaultName: 'origin/main' });
  expect(orphan).toEqual([
    {
      id: 'branch-orphan',
      text: 't/ZZ-9 (local) names ticket ZZ-9, and no accord/tickets/ZZ-9.md is in the checkout, on origin/main or on the branch; tip by a@x.io',
      fix: 'git update-ref -d refs/heads/t/ZZ-9 ' + TIP,
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
      fix: 'git push -u origin t/T-1 to keep it, or git update-ref -d refs/heads/t/T-1 ' + TIP + ' to delete it',
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

// Issue #341 D-07c: an id guessed among several candidates (none known) never gets a delete command, so a wrong guess cannot hand the owner a delete of a live claim.
it('risk:data-loss a claim branch whose id was guessed among several candidates gets no delete command (D-07c)', () => {
  const guessed = { name: 'feature/ST-12-export', id: 'ST-12', ticketAnywhere: false, ambiguous: true };
  for (const r of [ref({ ...guessed, tip: NOW - 3 * 86400 }), ref({ ...guessed, local: false, origin: true })]) {
    const [gap] = branchGaps([r], new Set(), '14', NOW, same);
    expect(gap.id).toBe('branch-orphan');
    expect(gap.text).toContain('names ticket ST-12 by a guess');
    expect(gap.fix).toBe(NO_COMMAND_GUESS);
    expect(gap.fix).not.toContain('git push origin --delete');
    expect(gap.fix).not.toContain('update-ref');
  }
  const [unpushed] = branchGaps([ref({ ...guessed, ticketAnywhere: true })], new Set(), '14', NOW, same);
  expect(unpushed.id).toBe('claim-unpushed');
  expect(unpushed.fix).toBe('git push -u origin feature/ST-12-export to keep it; ' + NO_COMMAND_GUESS);
  expect(unpushed.fix).not.toContain('update-ref');
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

// ---- 08.2-05 (D-04, D-10): deferred items nobody decided ---------------------------------------------------------------------------------

it('risk:complex-branching each undecided Must or Should item of a judged ticket is one deferred-undecided gap (8.2-ac-5)', () => {
  const gaps = deferredGaps([{ id: 'D-1', items: [{ rating: 'Must', text: 'review 1.3: a lock (Must)' }] }]);
  expect(gaps).toEqual([
    {
      id: 'deferred-undecided',
      text: 'D-1 has an undecided Must item: review 1.3: a lock (Must)',
      fix: 'queue it with /accord queue <idea> and append " → <new id>" to its line in accord/tickets/D-1/ledger.md, or append " → declined" there; a pull request that changes only that ledger',
    },
  ]);
  // D-10: no lane is read, so neither the text nor the fix holds one
  for (const g of gaps) expect(`${g.text} ${g.fix}`).not.toMatch(/lane/i);
  // an empty item list gives none; tickets come in id code-point order and items in the order given
  expect(deferredGaps([{ id: 'D-1', items: [] }])).toEqual([]);
  expect(deferredGaps([])).toEqual([]);
  const many = deferredGaps([
    { id: 'B-2', items: [{ rating: 'Should', text: 'b (Should)' }] },
    { id: 'A-10', items: [{ rating: 'Must', text: 'a (Must)' }, { rating: 'Should', text: 'c (Should)' }] },
  ]);
  expect(many.map((g) => g.text)).toEqual(['A-10 has an undecided Must item: a (Must)', 'A-10 has an undecided Should item: c (Should)', 'B-2 has an undecided Should item: b (Should)']);
});

it('risk:security a ticket id a shell would read gets no command in a deferred-undecided fix (D-04)', () => {
  for (const id of ['T 1', 'T;1', 'T$(x)', '-T1']) {
    const [gap] = deferredGaps([{ id, items: [{ rating: 'Must', text: 'a (Must)' }] }]);
    expect(gap.id).toBe('deferred-undecided');
    expect(gap.fix).toBe('the ticket id holds characters a command line would read, so no command is printed: rename its ticket file to a plain id first');
    expect(gap.fix).not.toContain('/accord queue');
  }
});

// ---- 08.2-05 (D-05, D-11): the tests baseline -------------------------------------------------------------------------------------------

/** A repository whose one ticket names `a.test.ts#one`, with a baseline of five ids and, when `report` is given, a report holding those cases. */
function baselineSnapshot(report: Record<string, 'passed' | 'failed' | 'skipped'> | undefined) {
  const files: Files = {
    'accord/config.yml': CONFIG,
    [P('T-1')]: laneTicket('T-1', { body: LANE_BODY.replace('export#writes-csv', 'a.test.ts#one') }),
    'accord/tests-baseline.txt': ['# a comment', 'a.test.ts#one', 'c.test.ts#risk:parsing-x', 'a.test.ts#gone', 'b.test.ts#kept', 'a.test.ts#other', ''].join('\n'),
  };
  if (report !== undefined) files[REPORT] = junit(report);
  return loadSnapshot({ files, tree: Object.keys(files) });
}

it('risk:complex-branching removable baseline ids are the named the risk ones and the ones absent while their file is in the report (8.2-ac-6)', () => {
  const found = removableBaseline(baselineSnapshot({ 'a.test.ts#other': 'passed', 'a.test.ts#one': 'passed' }));
  expect(found).toEqual({
    removable: [
      { id: 'a.test.ts#gone', why: 'absent' },
      { id: 'a.test.ts#one', why: 'test' },
      { id: 'c.test.ts#risk:parsing-x', why: 'risk' },
    ],
    // D-11: b.test.ts has no case in the report, so its id is not judged; a.test.ts#other is in the report and stays
    notJudged: 1,
  });
  // a snapshot with no report, and one with no baseline, give nothing to judge
  expect(removableBaseline(baselineSnapshot(undefined))).toBeUndefined();
  const none = loadSnapshot({ files: { 'accord/config.yml': CONFIG, [REPORT]: junit({ 'a.test.ts#one': 'passed' }) }, tree: [REPORT] });
  expect(removableBaseline(none)).toBeUndefined();
  // an id that holds no # names no file, so an absent one is not judged
  const bare = loadSnapshot({ files: { 'accord/config.yml': CONFIG, [REPORT]: junit({ 'a.test.ts#one': 'passed' }), 'accord/tests-baseline.txt': 'nohash\n' }, tree: [REPORT] });
  expect(removableBaseline(bare)).toEqual({ removable: [], notJudged: 1 });
});

it('risk:parsing the baseline gap names at most ten ids with their lines and the fix names the lines (8.2-ac-6)', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => ({ id: `f.test.ts#case-${i}`, why: 'absent' as const, line: 3 + i }));
  const gap = baselineGap(twelve, 40);
  expect(gap?.id).toBe('baseline-removable');
  expect(BASELINE_LISTED).toBe(10);
  expect(gap?.text).toBe(
    '12 of 40 ids in accord/tests-baseline.txt can be removed: ' + twelve.slice(0, 10).map((f) => `${f.id} (line ${f.line}: not in the report)`).join(', ') + ', (+2 more)',
  );
  expect(gap?.fix).toBe('delete lines 12, 11, 10, 9, 8, 7, 6, 5, 4, 3 of accord/tests-baseline.txt, from the bottom up, (the baseline only shrinks, so deleting is allowed); run accord audit again for the rest');
  // three ids, one of each reason, come out in line order with no more and no again
  const three = baselineGap(
    [
      { id: 'b#risk:x', why: 'risk', line: 9 },
      { id: 'a#one', why: 'test', line: 3 },
      { id: 'a#gone', why: 'absent', line: 5 },
    ],
    5,
  );
  expect(three?.text).toBe('3 of 5 ids in accord/tests-baseline.txt can be removed: a#one (line 3: named by @test:), a#gone (line 5: not in the report), b#risk:x (line 9: carries risk:)');
  expect(three?.fix).toBe('delete lines 9, 5, 3 of accord/tests-baseline.txt, from the bottom up, (the baseline only shrinks, so deleting is allowed)');
  expect(baselineGap([], 5)).toBeUndefined();
});

// Phase 08.8 D-17 (IN-03): deleting the printed lines one by one must never shift a later number, and an id on two lines must go from both.
it('risk:data-loss the baseline fix lists every line of a duplicated id from the bottom up (D-17)', () => {
  const gap = baselineGap(
    [
      { id: 'a#one', why: 'test', line: 3 },
      { id: 'b#gone', why: 'absent', line: 5 },
      { id: 'a#one', why: 'test', line: 9 },
    ],
    6,
  );
  expect(gap?.fix).toBe('delete lines 9, 5, 3 of accord/tests-baseline.txt, from the bottom up, (the baseline only shrinks, so deleting is allowed)');
  expect(gap?.text).toBe('2 of 6 ids in accord/tests-baseline.txt can be removed: a#one (line 3 and line 9: named by @test:), b#gone (line 5: not in the report)');
});

// Review WR-03: a local delete is printed tip-pinned, and no command is printed for a tip git did not give as a hash.
it('risk:data-loss a printed local branch delete is the tip-pinned update-ref and never git branch -D (8.2-ac-4)', () => {
  const gaps = branchGaps([ref({ name: 't/ZZ-9', id: 'ZZ-9', ticketAnywhere: false }), ref({})], new Set(), '14', NOW, same);
  expect(gaps.map((g) => g.fix).join('\n')).not.toContain('git branch -D');
  const odd = branchGaps([ref({ name: 't/ZZ-9', id: 'ZZ-9', ticketAnywhere: false, tip: NOW - 3 * 86400, sha: '--force; rm' })], new Set(), '14', NOW, same);
  expect(odd.map((g) => g.fix)).toEqual([NO_COMMAND_TIP]);
  // an origin ref is deleted with the push, which needs no tip
  const remote = branchGaps([ref({ name: 't/ZZ-9', id: 'ZZ-9', local: false, ticketAnywhere: false, sha: '--force; rm' })], new Set(), '14', NOW, same);
  expect(remote.map((g) => g.fix)).toEqual(['git push origin --delete t/ZZ-9']);
});
