// ST-LN-91 D-14: the planner's fix of plan.md is held to the tasks its open findings name; the owner's Ruling is the only way
// out. The host supplies the hunks (git diff -U0) and both texts as snapshot.planFix; core only places the hunks in tasks.
import { expect, it } from 'vitest';
import { GROUNDS_V2_FROM, loadSnapshot, nextRound } from '../src/index.js';
import type { PlanFix, RecordPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const OLD_LINES = [
  '---',
  'baseline: abc1234',
  'plan_hash: "fnv1a64:061c24200fe9bbf9"',
  '---',
  '',
  '# Plan',
  '',
  '## Task 1: Writer csv mode',
  'covers: @ac-1, D-01',
  'files: src/export.ts',
  'verify: export#writes-csv (@ac-1)',
  'Do one.',
  '',
  '## Task 2: Escaping',
  'covers: @ac-2',
  'files: src/export.ts',
  'verify: export#escapes-commas (@ac-2)',
  'Do two.',
  '',
  '## Task 3: Header row',
  'covers: D-01',
  'files: src/header.ts',
  'verify: header#first-row (@ac-1)',
  'Do three.',
  '',
];
const OLD = OLD_LINES.join('\n');
const at = (needle: string): number => OLD_LINES.indexOf(needle) + 1;

/** Replace `count` lines of the old plan from `start` with `lines`; the one hunk is what `git diff -U0` prints for it. */
function edit(start: number, count: number, ...lines: string[]): PlanFix {
  const all = OLD_LINES.slice();
  all.splice(start - 1, count, ...lines);
  const hunk =
    count === 0
      ? { oldStart: start - 1, oldCount: 0, newStart: start, newCount: lines.length }
      : lines.length === 0
        ? { oldStart: start, oldCount: count, newStart: start - 1, newCount: 0 }
        : { oldStart: start, oldCount: count, newStart: start, newCount: lines.length };
  return { base: 'abc1234', hunks: [hunk], old: OLD, new: all.join('\n') };
}

const R1 = (...lines: string[]): string => 'Round record: 1\n\n## Round 1 (whole)\n\n' + lines.join('\n') + '\n';
const named = (n: string, state = 'open'): string => `1. Should — ${n} lacks a verify line — ${state}`;
const RULING = (round: number, cycle: number, places: string, sentence = ' — "go on"'): string =>
  `Ruling: the owner allows the plan fix after round ${round} of cycle ${cycle} to change ${places}${sentence} — cost if wrong: a wider fix`;

interface Opts { first?: string[]; rulings?: string[]; fix?: PlanFix; pin?: RecordPin | null; approach?: boolean; tail?: string }

/** A lane M ticket whose plan-review.md holds round 1; `pin` is the host's recordPins fact (null: none), `fix` its planFix fact. */
function snap(o: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': CONFIG };
  building(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = ['## Rulings', '- task 1 done abc1234', ...(o.rulings ?? []).map((r) => '- ' + r)].join('\n') + '\n';
  files['accord/tickets/T-1/plan-review.md'] = R1(...(o.first ?? [named('Task 2')])) + (o.tail ?? '');
  if (o.approach === true) files['accord/tickets/T-1/approach-review.md'] = R1(named('Task 2'));
  const base = loadSnapshot({ files, tree: Object.keys(files) });
  const pin = o.pin === undefined ? { pin: GROUNDS_V2_FROM } : o.pin;
  return {
    ...base,
    ...(pin === null ? {} : { recordPins: { 'T-1': { plan: pin, ...(o.approach === true ? { approach: pin } : {}) } } }),
    ...(o.fix === undefined ? {} : { planFix: { 'T-1': o.fix } }),
  };
}
const plan = (o: Opts) => nextRound(snap(o), 'T-1', 'plan');
const why = (o: Opts): string => plan(o).reasons.join('\n');

it('risk:complex-branching a plan fix outside the tasks its open findings name is refused with its hunks (ST-LN-91 ac-3)', () => {
  // a changed line of Task 3, which no finding names: refused, with the git header, the task and the Ruling form
  const out = plan({ fix: edit(at('Do three.'), 1, 'Do three, twice.') });
  expect(out.kind).toBe('refused');
  const reason = out.reasons.join('\n');
  expect(reason).toContain(`@@ -${at('Do three.')} +${at('Do three.')} @@ (Task 3)`);
  expect(reason).toContain('Task 2');
  expect(reason).toContain('Ruling: the owner allows the plan fix after round 1 of cycle 1 to change Task 3 — "<the owner\'s sentence>" — <cost if wrong>');

  // inside the named task, the plan goes on
  const inside = plan({ fix: edit(at('Do two.'), 1, 'Do two, quoting commas.') });
  expect(inside.kind).toBe('next');
  expect(inside.round).toBe(2);

  // frontmatter is never a hunk's place
  expect(plan({ fix: edit(3, 1, 'plan_hash: "fnv1a64:0000000000000000"') }).kind).toBe('next');

  // a deleted line is placed by the old text; an added one by the new
  const gone = why({ fix: edit(at('Do three.'), 1) });
  expect(gone).toContain(`@@ -${at('Do three.')} +${at('Do three.') - 1},0 @@ (Task 3)`);
  expect(why({ fix: edit(at('Do three.') + 1, 0, 'Do four.') })).toContain('(Task 3)');

  // a hunk from the last line of Task 2 into Task 3's heading names Task 3 as well
  const across = edit(at('Do two.'), 3, 'Do two!', '', '## Task 3: Header row');
  expect(plan({ fix: across }).kind).toBe('refused');
  const spans = why({ fix: across });
  expect(spans).toContain('(Task 3)');
  expect(spans).not.toContain('(Task 2');
  expect(plan({ first: [named('Tasks 2 and 3')], fix: across }).kind).toBe('next');

  // the preamble is a place: refused unless an open finding names it
  const pre = edit(at('# Plan'), 1, '# Plan, revised');
  expect(why({ fix: pre })).toContain('(the preamble)');
  expect(plan({ first: [named('the preamble')], fix: pre }).kind).toBe('next');

  // the refusal lists every hunk in file order
  const two: PlanFix = {
    base: 'abc1234',
    hunks: [
      { oldStart: at('Do one.'), oldCount: 1, newStart: at('Do one.'), newCount: 1 },
      { oldStart: at('Do three.'), oldCount: 1, newStart: at('Do three.'), newCount: 1 },
    ],
    old: OLD,
    new: OLD,
  };
  const listed = why({ fix: two });
  expect(listed.indexOf('(Task 1)')).toBeGreaterThan(-1);
  expect(listed.indexOf('(Task 1)')).toBeLessThan(listed.indexOf('(Task 3)'));
});

it('risk:complex-branching which findings name a task and which Rulings allow a fix (ST-LN-91 ac-3)', () => {
  const three = edit(at('Do three.'), 1, 'Do three, twice.');

  // a fixed finding allows nothing; an unverified one allows its task
  expect(plan({ first: [named('Task 3', 'fixed')], fix: three }).kind).toBe('refused');
  expect(plan({ first: [named('Task 3', 'unverified: no citation')], fix: three }).kind).toBe('next');
  expect(plan({ first: [named('Tasks 2 and 3')], fix: three }).kind).toBe('next');
  expect(plan({ first: [named('Task 2, Task 3')], fix: three }).kind).toBe('next');
  // a task named only inside a quoted mark is not named by the finding
  expect(plan({ first: [named('Task 2') + ' — rests on: Intent "see Task 3 for more"'], fix: three }).kind).toBe('refused');

  // the Ruling of the latest round and cycle lets those places change
  expect(plan({ rulings: [RULING(1, 1, 'Task 3')], fix: three }).kind).toBe('next');
  expect(plan({ rulings: [RULING(1, 1, 'Task 2, Task 3')], fix: three }).kind).toBe('next');
  expect(plan({ rulings: [RULING(1, 1, 'the whole plan')], fix: three }).kind).toBe('next');
  expect(plan({ rulings: [RULING(1, 1, 'the whole plan')], fix: edit(at('# Plan'), 1, '# Plan, revised') }).kind).toBe('next');
  expect(plan({ rulings: [RULING(1, 1, 'the preamble')], fix: edit(at('# Plan'), 1, '# Plan, revised') }).kind).toBe('next');

  // near misses grant nothing: another round, another cycle, no quoted sentence, another place
  for (const ruling of [
    RULING(2, 1, 'Task 3'),
    RULING(1, 2, 'Task 3'),
    RULING(1, 1, 'Task 3', ''),
    RULING(1, 1, 'Task 3', ' — ""'),
    RULING(1, 1, 'Task 1'),
    RULING(1, 1, 'the preamble'),
  ]) {
    expect(plan({ rulings: [ruling], fix: three }).kind, ruling).toBe('refused');
  }
  expect(plan({ rulings: [RULING(1, 1, 'Task 3').replace('allows the plan fix', 'lets the plan fix')], fix: three }).kind).toBe('refused');

  // with no open finding every body hunk is refused; a frontmatter-only fix passes
  const none = [named('Task 2', 'fixed')];
  expect(why({ first: none, fix: edit(at('Do two.'), 1, 'Do two, twice.') })).toContain('(none)');
  expect(plan({ first: none, fix: edit(3, 1, 'plan_hash: "fnv1a64:1111111111111111"') }).kind).toBe('next');

  // an empty diff passes, and so does a cycle with no round
  expect(plan({ fix: { base: 'abc1234', hunks: [], old: OLD, new: OLD } }).kind).toBe('next');
  const closed = nextRound(snap({ tail: '\n## Closed\n', fix: three }), 'T-1', 'plan');
  expect(closed.kind).toBe('next');
  expect(closed.cycle).toBe(2);
});

it('risk:regression the fix-scope check waits for its cut-off and fails closed on git errors (ST-LN-91 ac-3)', () => {
  const three = edit(at('Do three.'), 1, 'Do three, twice.');

  // under 0.4.0, with no pin fact or with no plan fix fact the check does not run
  expect(plan({ pin: { pin: '0.4.0' }, fix: three }).kind).toBe('next');
  expect(plan({ pin: {}, fix: three }).kind).toBe('next');
  expect(plan({ pin: null, fix: three }).kind).toBe('next');
  expect(plan({}).kind).toBe('next');
  // a pin lowered on the branch below the default branch's pin counts as the cut-off
  expect(plan({ pin: { pin: '0.4.0', basePin: GROUNDS_V2_FROM }, fix: three }).kind).toBe('refused');

  // git could not read the diff: refused with its text
  const failed = plan({ fix: { error: 'git failed reading the plan fix: boom' } });
  expect(failed.kind).toBe('refused');
  expect(failed.reasons.join('\n')).toContain('boom');

  // an approach record is never checked for a plan fix
  const approach = nextRound(snap({ approach: true, fix: three }), 'T-1', 'approach');
  expect(approach.kind).toBe('next');
  expect(nextRound(snap({ fix: three }), 'T-1', 'review').kind).toBe('next');
});
