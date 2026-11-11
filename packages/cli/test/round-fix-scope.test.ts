// ST-LN-91 D-14: `accord round --plan` holds the planner's fix of plan.md to the tasks its open findings name, read from
// `git diff -U0` between the last commit that changed plan-review.md and the working tree, on real git.
import { expect, it } from 'vitest';
import { GROUNDS_V2_FROM } from '@accord-dev/accord-core';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const PLAN_LINES = [
  '---',
  'baseline: abc1234',
  '---',
  '',
  '# Plan',
  '',
  '## Task 1: Writer csv mode',
  'covers: @ac-1',
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
const PLAN = PLAN_LINES.join('\n');
const withLine = (from: string, to: string): string => PLAN.replace(from, to);

const PLAN_FILE = 'accord/tickets/T-1/plan.md';
const REVIEW_FILE = 'accord/tickets/T-1/plan-review.md';
const LEDGER_FILE = 'accord/tickets/T-1/ledger.md';
const ROUND_1 = 'Round record: 1\n\n## Round 1 (whole)\n\n1. Should — Task 2 lacks a verify line — open\n';
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]+"/, `accord: "${v}"`);

/** A branch whose plan-review.md round 1 is committed with plan.md under `pin`, then HEAD's config goes back to the running version. */
function planRepo(pin: string): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': pinned('0.4.0'), 'accord/tickets/T-1.md': laneTicket('T-1') });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  writeFiles(repo, { 'accord/config.yml': pinned(pin), [PLAN_FILE]: PLAN, [REVIEW_FILE]: ROUND_1 });
  commitMsg(repo, 'plan: T-1 round 1, the plan and its critique');
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'src/b.ts': 'export const b = 1;\n' });
  commitMsg(repo, 'config back to the running version');
  return repo;
}

it('risk:complex-branching accord round --plan lists and refuses the hunks of a fix outside the named tasks on real git (ST-LN-91 ac-3)', async () => {
  const repo = planRepo(GROUNDS_V2_FROM);
  try {
    // a fix inside Task 2, which the finding names, and a frontmatter-only change pass
    writeFiles(repo, { [PLAN_FILE]: withLine('Do two.', 'Do two, quoting commas.').replace('baseline: abc1234', 'baseline: def5678') });
    const inside = await run(['round', 'T-1', '--plan'], repo);
    expect(inside.out).toContain('Round: 2 of 5');
    expect(inside.code).toBe(0);

    // a changed line of Task 3, which no finding names: refused with git's header and the task
    writeFiles(repo, { [PLAN_FILE]: withLine('Do three.', 'Do three, twice.') });
    const refused = await run(['round', 'T-1', '--plan'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain('@@ -23 +23 @@ (Task 3)');
    expect(refused.out).toContain('Ruling: the owner allows the plan fix after round 1 of cycle 1 to change Task 3');

    // the owner's Ruling lets Task 3 change
    writeFiles(repo, {
      [LEDGER_FILE]:
        '## Rulings\n- Ruling: the owner allows the plan fix after round 1 of cycle 1 to change Task 3 — "yes, fix the header too" — cost if wrong: a wider fix\n',
    });
    commitMsg(repo, 'the owner allows Task 3');
    const allowed = await run(['round', 'T-1', '--plan'], repo);
    expect(allowed.out).toContain('Round: 2 of 5');
    expect(allowed.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression the plan fix check does not run under the older pin on real git (ST-LN-91 ac-3)', async () => {
  const repo = planRepo('0.4.0');
  try {
    writeFiles(repo, { [PLAN_FILE]: withLine('Do three.', 'Do three, twice.') });
    const r = await run(['round', 'T-1', '--plan'], repo);
    expect(r.out).toContain('Round: 2 of 5');
    expect(r.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);
