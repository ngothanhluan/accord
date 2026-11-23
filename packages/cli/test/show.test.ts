// ST-LN-6 task 2: `accord show <id> [--json]`, in-process through runCli on a fixture repository.
import { appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { cleanup, commitAll, commitMsg, copyRepo, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { laneRHash, loadSnapshot } from '@accord-dev/accord-core';
import { approve, building, CONFIG, done, LANE_BODY, laneTicket, P, PLAN } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { v2Review } from '../../../test/helpers/review-v2.js';

const LONG = 'Export every report of the month as one CSV file with quoted cells';
const STEP = 'And the file name is the report name followed by the month and the extension csv';
const ticket = (title: string): string =>
  laneTicket('T-1', { body: LANE_BODY.replace('    Then a csv file is written\n', '    Then a csv file is written\n    ' + STEP + '\n') }).replace(
    'title: "Export"',
    'title: "' + title + '"',
  );

it('ac-1 accord show prints the full detail as text', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': ticket(LONG) });
  try {
    const { code, out } = await run(['show', 'T-1'], repo);
    expect(code).toBe(0);
    expect(out).toBe(
      [
        'T-1 ' + LONG,
        'Stage: intent',
        'Lane: M',
        'Tasks: 0/2',
        'Branch: t/T-1',
        'Holder: none',
        'Blocked by: none',
        '',
        'Intent:',
        'Owners can export their report as CSV.',
        'Expected size: 5 tasks',
        '',
        'ac-1 export writes a csv',
        '  Given a report',
        '  When the owner exports it',
        '  Then a csv file is written',
        '  ' + STEP,
        '  State: passing',
        '  Test: export#writes-csv',
        '  Test result: passed',
        '  Ticked: no',
        '  Verification: none',
        '',
        'ac-2 commas are escaped',
        '  Given a cell with a comma',
        '  When the owner exports it',
        '  Then the cell is quoted',
        '  State: passing',
        '  Test: export#escapes-commas',
        '  Test result: passed',
        '  Ticked: no',
        '  Verification: none',
        '',
      ].join('\n'),
    );
    expect(out).not.toContain('...');
    expect(out).not.toContain('…');
  } finally {
    cleanup(repo);
  }
});

it('ac-2 accord show json gives the same detail as data', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': ticket(LONG) });
  try {
    const { code, out } = await run(['show', 'T-1', '--json'], repo);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({
      id: 'T-1', title: LONG, stage: 'intent', lane: 'M', tasksDone: 0, tasksTotal: 2, branch: 't/T-1', holder: null, blockedBy: [],
      intent: ['Owners can export their report as CSV.', 'Expected size: 5 tasks'],
      criteria: [
        { id: 'ac-1', title: 'export writes a csv', steps: ['Given a report', 'When the owner exports it', 'Then a csv file is written', STEP],
          label: 'passing', test: 'export#writes-csv', testResult: 'passed', ticked: false, verification: null },
        { id: 'ac-2', title: 'commas are escaped', steps: ['Given a cell with a comma', 'When the owner exports it', 'Then the cell is quoted'],
          label: 'passing', test: 'export#escapes-commas', testResult: 'passed', ticked: false, verification: null },
      ],
    });
  } finally {
    cleanup(repo);
  }
});

it('risk:security show text turns control and bidi characters into spaces', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': ticket('Bad\u001b[31m x\u202ey') });
  const noLane = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { lane: '' }) });
  try {
    expect((await run(['show', 'T-1'], repo)).out.split('\n')[0]).toBe('T-1 Bad [31m x y');
    expect(JSON.parse((await run(['show', 'T-1', '--json'], repo)).out).title).toBe('Bad\u001b[31m x\u202ey');
    const missing = await run(['show', 'NOPE'], repo);
    expect(missing.code).toBe(2);
    expect(missing.err).toContain('no ticket NOPE in accord/tickets/');
    expect((await run(['show', 'T-1'], noLane)).code).toBe(2);
  } finally {
    cleanup(repo);
    cleanup(noLane);
  }
});

// Claim-state templates (H1): built once, copied with copyRepo. Neither has a remote and neither is ever given
// one; the claim tip is only the ref refs/remotes/origin/t/<id>, and the checkout holds no claimed ticket.
const identity = (repo: string) => {
  gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
  gitRun(repo, 'config', 'user.name', 'fixture');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
};
let tplBlockers = '';
let tplClaimTip = '';
beforeAll(() => {
  // T-2 depends on T-1, and T-1 is done only on its claim ref; the viewer's identity is written after the last commit.
  tplBlockers = makeLaneRepo({ [P('T-1')]: laneTicket('T-1'), [P('T-2')]: laneTicket('T-2', { frontmatter: ['depends_on: ["T-1"]'] }) });
  identity(tplBlockers);
  commitMsg(tplBlockers, 'fixture');
  const files: Files = {};
  done(files, 'T-1');
  writeFiles(tplBlockers, files);
  commitMsg(tplBlockers, 'fixture');
  gitRun(tplBlockers, 'update-ref', 'refs/remotes/origin/t/T-1', 'HEAD');
  gitRun(tplBlockers, 'reset', '-q', '--hard', 'HEAD~1');
  gitRun(tplBlockers, 'config', 'user.email', 'an@example.com');
  // T-2 exists only on its claim tip: approved and planned in core, task 1 in its ledger, authored fixture@example.invalid.
  tplClaimTip = makeLaneRepo();
  identity(tplClaimTip);
  commitMsg(tplClaimTip, 'fixture');
  const claimed: Files = {};
  building(claimed, 'T-2');
  writeFiles(tplClaimTip, claimed);
  commitMsg(tplClaimTip, 'plan: T-2 ready');
  writeFiles(tplClaimTip, { 'accord/tickets/T-2/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
  const tip = commitMsg(tplClaimTip, 'task 1');
  gitRun(tplClaimTip, 'update-ref', 'refs/remotes/origin/t/T-2', tip);
  gitRun(tplClaimTip, 'reset', '-q', '--hard', 'HEAD~2');
});
afterAll(() => {
  for (const t of [tplBlockers, tplClaimTip]) if (t !== '') cleanup(t);
});

it('risk:regression show finds a ticket filed only on its claim branch at that branch stage', async () => {
  const repo = copyRepo(tplClaimTip);
  try {
    const j = await run(['show', 'T-2', '--json'], repo);
    expect(j.code).toBe(0);
    expect(JSON.parse(j.out)).toMatchObject({
      id: 'T-2', stage: 'build', tasksDone: 1, tasksTotal: 2, branch: 't/T-2', holder: 'fixture@example.invalid', blockedBy: [],
      intent: ['Owners can export their report as CSV.', 'Expected size: 5 tasks'],
    });
  } finally {
    cleanup(repo);
  }
});

it('risk:regression show text of a ticket filed only on its claim branch shows that branch stage', async () => {
  const repo = copyRepo(tplClaimTip);
  try {
    const t = await run(['show', 'T-2'], repo);
    expect(t.code).toBe(0);
    expect(t.out.split('\n')).toEqual(expect.arrayContaining(['Stage: build', 'Tasks: 1/2']));
  } finally {
    cleanup(repo);
  }
});

// T-1 is approved by core (the CLI approve run only set the test up); its plan is committed or not by each test.
const approved = (): Files => {
  const files: Files = { [P('T-1')]: laneTicket('T-1') };
  approve(files, 'T-1');
  return files;
};
const stage = async (repo: string) => {
  const d = JSON.parse((await run(['show', 'T-1', '--json'], repo)).out);
  const row = (JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; stage?: string }[]).find((r) => r.id === 'T-1');
  return { d, row };
};

it('risk:complex-branching show and status hold a plan at stage plan before its ready commit', async () => {
  const repo = makeLaneRepo(approved());
  try {
    commitAll(repo, 'plan: T-1 round 1, 1 Must, 0 Should');
    const first = await stage(repo);
    expect(first.d).toMatchObject({ stage: 'plan', tasksDone: 0, tasksTotal: 2 });
    expect(first.row?.stage).toBe('plan');
  } finally {
    cleanup(repo);
  }
});

it("risk:complex-branching show and status reach build at the plan's ready commit", async () => {
  const repo = makeLaneRepo(approved());
  try {
    commitAll(repo, 'plan: T-1 round 1, 1 Must, 0 Should');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN + '\n' });
    commitAll(repo, 'plan: T-1 ready');
    const second = await stage(repo);
    expect(second.d.stage).toBe('build');
    expect(second.row?.stage).toBe('build');
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching show takes blockers from the checkout not the claim branch', async () => {
  const repo = copyRepo(tplBlockers);
  try {
    expect(JSON.parse((await run(['show', 'T-2', '--json'], repo)).out).blockedBy).toEqual(['T-1']);
    expect((await run(['show', 'T-2'], repo)).out.split('\n')).toContain('Blocked by: T-1');
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching show takes the stage of a ticket done only on its claim branch', async () => {
  const repo = copyRepo(tplBlockers);
  try {
    expect(JSON.parse((await run(['show', 'T-1', '--json'], repo)).out).stage).toBe('done');
  } finally {
    cleanup(repo);
  }
});

// ST-LN-94 94-ac-5: a lane R ticket is shown as lane R, with its question in place of an empty Intent.
it("risk:regression accord show prints a lane R ticket's question (ST-LN-94 94-ac-5)", async () => {
  const body = ['## Question', 'Does the critic‮ need a second round?', '<!-- one question -->', 'And who reads the record?', '', '## Timebox', '4 hours', '', '## Token budget', '800k weighted tokens', '', '## Decisions', '- D-01 Timebox 4 hours, token budget 800k weighted tokens — "fine"', ''].join('\n');
  const r1 = (fm: string[]) => laneTicket('R-1', { lane: 'R', body, frontmatter: ['research: ["accord/research/2026-11-14-critic.md"]', ...fm] });
  const hash = laneRHash(loadSnapshot({ files: { [P('R-1')]: r1([]) }, tree: [] }).tickets['R-1']);
  const repo = makeLaneRepo({ [P('R-1')]: r1([`ac_hash: "${hash}"`]) });
  try {
    const text = await run(['show', 'R-1'], repo);
    expect(text.code).toBe(0);
    expect(text.out).toBe(
      ['R-1 Export', 'Stage: research', 'Lane: R', 'Tasks: 0/0', 'Branch: t/R-1', 'Holder: none', 'Blocked by: none', '', 'Question:', 'Does the critic  need a second round?', 'And who reads the record?', ''].join('\n'),
    );
    expect(text.out).not.toContain('Intent:');
    const j = JSON.parse((await run(['show', 'R-1', '--json'], repo)).out);
    expect(j).toMatchObject({ lane: 'R', stage: 'research', intent: [], criteria: [] });
    expect(j.question).toEqual(['Does the critic‮ need a second round?', 'And who reads the record?']);
    // A lane M ticket's detail carries no question field and keeps its Intent.
    const m = JSON.parse((await run(['show', 'T-1', '--json'], repo)).out);
    expect(Object.hasOwn(m, 'question')).toBe(false);
    expect((await run(['show', 'T-1'], repo)).out).toContain('\nIntent:\nOwners can export their report as CSV.\n');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.7 D-02 D-04 D-07: the pane's ticket tab reads the review rounds and the stages the team turned off from show --json; a ticket with neither keeps its JSON as it was.
it('risk:regression show json adds review and stagesOff only when the ticket has them (D-02 D-04 D-07)', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1/review.md': v2Review([[{ lines: ['Must 1 [patch]: the writer drops the header — src/export.ts:1 — open'] }]]) });
  try {
    const first = JSON.parse((await run(['show', 'T-1', '--json'], repo)).out);
    expect(first.review.round).toBe(1);
    expect(first.review.rounds[0].findings.Must.open).toBe(1);
    expect(Object.hasOwn(first, 'stagesOff')).toBe(false);
    writeFiles(repo, { 'accord/config.yml': CONFIG + 'strictness:\n  stages:\n    M:\n      plan: off\n' });
    const second = JSON.parse((await run(['show', 'T-1', '--json'], repo)).out);
    expect(second.stagesOff).toEqual(['plan']);
    const row = (JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; stagesOff?: string[] }[]).find((r) => r.id === 'T-1');
    expect(second.stagesOff).toEqual(row?.stagesOff);
  } finally {
    cleanup(repo);
  }
  const bare = makeLaneRepo();
  try {
    const none = JSON.parse((await run(['show', 'T-1', '--json'], bare)).out);
    expect(Object.hasOwn(none, 'review')).toBe(false);
    expect(Object.hasOwn(none, 'stagesOff')).toBe(false);
  } finally {
    cleanup(bare);
  }
});

// Phase 08.8.1 D-05 L-05: CSA-185's shape. accord/ is git-ignored, so plan.md has no ready commit and the ledger no done line: show --json and the anchor say why, in place of a wrong `plan 0/3`.
const THREE_TASKS =
  PLAN + '## Task 3: Docs\ncovers: @ac-1\nfiles: src/export.ts\nverify: export#writes-csv (@ac-1)\nafter: 2\nDocument the csv mode.\n';
const NOT_IGNORED = 'accord/ is not committed in this repository: git ignores accord/tickets/T-1/plan.md, so accord cannot track the stage or the tasks';
const NOT_COMMITTED = 'accord/tickets/T-1/plan.md is not committed yet: the plan stage ends with its plan-ready commit';

it('risk:regression show json and anchor say accord is not committed when git ignores it (D-05 L-05)', async () => {
  const repo = makeLaneRepo({ ...approved(), 'accord/tickets/T-1/plan.md': THREE_TASKS });
  try {
    commitAll(repo, 'plan: T-1 ready');
    // A tracked ticket: no warnings key, and the anchor keeps its Stage line.
    const tracked = JSON.parse((await run(['show', 'T-1', '--json'], repo)).out);
    expect(tracked).toMatchObject({ stage: 'build', tasksDone: 0, tasksTotal: 3 });
    expect(Object.hasOwn(tracked, 'warnings')).toBe(false);
    const trackedAnchor = (await run(['anchor', 'T-1'], repo)).out;
    expect(trackedAnchor).not.toContain('is not committed');
    expect(trackedAnchor.split('\n').some((l) => l.startsWith('Stage: build 0/3'))).toBe(true);
    // CSA-185: accord/ leaves the index and is git-excluded.
    appendFileSync(join(repo, '.git', 'info', 'exclude'), 'accord/\n');
    gitRun(repo, 'rm', '-r', '-q', '--cached', 'accord');
    commitMsg(repo, 'chore: stop tracking accord');
    const shown = await run(['show', 'T-1', '--json'], repo);
    expect(shown.code).toBe(0);
    const json = JSON.parse(shown.out);
    expect(json.stage).toBe('plan');
    expect(json.warnings).toHaveLength(1);
    expect(json.warnings[0].kind).toBe('not-committed');
    expect(json.warnings[0].text).toBe(NOT_IGNORED);
    expect(json.warnings[0].text).toContain('git ignores accord/');
    const anchored = await run(['anchor', 'T-1'], repo);
    expect(anchored.code).toBe(0);
    const lines = anchored.out.split('\n');
    expect(lines).toContain(json.warnings[0].text);
    expect(lines.some((l) => l.startsWith('Stage:'))).toBe(false);
    expect(anchored.out).not.toContain('build 0/3');
    expect(anchored.out).not.toContain('plan, next:');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1 D-05: the warning fires only when tracking matters: a ticket still at intent says nothing; a plan.md git lists as untracked is named.
it('risk:complex-branching an uncommitted plan is named and an uncommitted ticket still at intent says nothing (D-05)', async () => {
  const early = makeLaneRepo({ [P('T-2')]: laneTicket('T-2') });
  try {
    const j = JSON.parse((await run(['show', 'T-2', '--json'], early)).out);
    expect(Object.hasOwn(j, 'warnings')).toBe(false);
    const a = (await run(['anchor', 'T-2'], early)).out;
    expect(a).not.toContain('is not committed');
    expect(a.split('\n').some((l) => l.startsWith('Stage:'))).toBe(true);
  } finally {
    cleanup(early);
  }
  const repo = makeLaneRepo(approved());
  try {
    rmSync(join(repo, 'accord', 'tickets', 'T-1', 'plan.md'));
    commitAll(repo, 'claim: T-1');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN });
    const j = JSON.parse((await run(['show', 'T-1', '--json'], repo)).out);
    // Phase 08.8.1 review WR-01: an untracked plan.md is the normal plan stage, so the stage and its anchor line stay and the missing commit is named after them.
    expect(j.stage).toBe('plan');
    expect(j.warnings).toEqual([{ kind: 'plan-uncommitted', text: NOT_COMMITTED }]);
    const a = await run(['anchor', 'T-1'], repo);
    const lines = a.out.split('\n');
    const at = lines.findIndex((l) => l.startsWith('Stage: plan, next: '));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(lines[at + 1]).toBe(NOT_COMMITTED);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1 D-02: a gated plan that the stage holds at plan (dirty, or last committed under another subject) is named, with the done tasks still counted; at build nothing is said and task-done is what refuses.
it('risk:regression show json and anchor warn when a gated plan changed and is not committed as plan ready and say nothing at build (D-02)', async () => {
  const PLAN_TEXT = 'plan.md changed after accord gate plan passed: the plan stage reviews the change, passes accord gate plan again and makes its plan-ready commit before the build goes on';
  const EDITED = PLAN.replace('Quote cells that contain a comma.', 'Quote every cell that contains a comma.');
  const atBuild = (): string => {
    const repo = makeLaneRepo(approved());
    commitAll(repo, 'plan: T-1 ready');
    writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
    commitAll(repo, 'task 1 done');
    return repo;
  };
  // Committed under another subject.
  const other = atBuild();
  try {
    expect(JSON.parse((await run(['show', 'T-1', '--json'], other)).out)).toMatchObject({ stage: 'build', tasksDone: 1 });
    writeFiles(other,{ 'accord/tickets/T-1/plan.md': EDITED });
    commitAll(other, 'feat: reword task 2');
    const j = JSON.parse((await run(['show', 'T-1', '--json'], other)).out);
    expect(j).toMatchObject({ stage: 'plan', tasksDone: 1 });
    expect(j.warnings).toEqual([{ kind: 'plan-changed', text: PLAN_TEXT }]);
    const lines = (await run(['anchor', 'T-1'], other)).out.split('\n');
    const at = lines.findIndex((l) => l.startsWith('Stage: plan, next: '));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(lines[at + 1]).toBe(PLAN_TEXT);
  } finally {
    cleanup(other);
  }
  // Left uncommitted.
  const dirty = atBuild();
  try {
    writeFiles(dirty, { 'accord/tickets/T-1/plan.md': EDITED });
    const j = JSON.parse((await run(['show', 'T-1', '--json'], dirty)).out);
    expect(j).toMatchObject({ stage: 'plan', tasksDone: 1 });
    expect(j.warnings).toEqual([{ kind: 'plan-changed', text: PLAN_TEXT }]);
  } finally {
    cleanup(dirty);
  }
  // Re-committed under the plan_ready subject: the stage reads build, nothing is said, and task-done refuses.
  const ready = atBuild();
  try {
    writeFiles(ready, { 'accord/tickets/T-1/plan.md': EDITED });
    commitAll(ready, (await run(['subject', 'plan_ready', 'T-1'], ready)).out.trim());
    const j = JSON.parse((await run(['show', 'T-1', '--json'], ready)).out);
    expect(j.stage).toBe('build');
    expect(Object.hasOwn(j, 'warnings')).toBe(false);
    const refused = await run(['task-done', 'T-1', '2'], ready);
    expect(refused.code).not.toBe(0);
    expect(refused.out + refused.err).toContain('plan.md changed since its plan_hash was recorded');
  } finally {
    cleanup(ready);
  }
}, 120_000);

// Phase 08.8.1 review WR-01: gate plan writes plan_hash into a plan.md that is committed under another subject and not yet committed as ready; that is the first pass, not a change after the gate.
it('risk:regression the first gate plan pass writing plan_hash into a committed plan.md is not a plan change (WR-01)', async () => {
  const repo = makeLaneRepo(approved());
  try {
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('plan_hash: "fnv1a64:9225f0bf1d9c2674"\n', '') });
    commitAll(repo, 'plan: T-1 round 1, 1 Must, 0 Should');
    // What a passing gate plan does next: the hash lands in the frontmatter, uncommitted.
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN });
    const j = JSON.parse((await run(['show', 'T-1', '--json'], repo)).out);
    expect(j).toMatchObject({ stage: 'plan', tasksDone: 0, tasksTotal: 2 });
    expect(Object.hasOwn(j, 'warnings')).toBe(false);
    expect((await run(['anchor', 'T-1'], repo)).out).not.toContain('changed after accord gate plan');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// Phase 08.8.1 L-06 L-07: show --json names the task in flight (the one `accord anchor` calls next) and lists the plan's tasks; the text output of `accord show` does not change.
it('risk:regression show json adds now and tasks for a ticket at build and its text output is unchanged (L-06 L-07)', async () => {
  // A task title with a bidi override reaches the JSON as one space; the plan's own text is not touched.
  const plan = PLAN.replace('Escaping', 'Esc\u202eaping');
  const repo = makeLaneRepo({ ...approved(), 'accord/tickets/T-1/plan.md': plan });
  try {
    commitAll(repo, 'plan: T-1 ready');
    writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
    commitAll(repo, 'task 1 done');
    const j = JSON.parse((await run(['show', 'T-1', '--json'], repo)).out);
    expect(j.stage).toBe('build');
    const next = /next: task (\d+) /.exec((await run(['anchor', 'T-1'], repo)).out);
    expect(next).not.toBeNull();
    expect(j.now).toEqual({ task: Number(next?.[1]), title: 'Esc aping' });
    expect(j.tasks).toEqual([
      { n: 1, title: 'Writer csv mode', done: true, covers: ['ac-1'] },
      { n: 2, title: 'Esc aping', done: false, covers: ['ac-2'] },
    ]);
    // The new keys follow the keys the detail had; the log, when there is one, comes last.
    const keys = Object.keys(j);
    expect(keys.indexOf('now')).toBeGreaterThan(keys.indexOf('criteria'));
    // The text is what it was before the keys existed: no task, no `now`.
    const text = await run(['show', 'T-1'], repo);
    expect(text.code).toBe(0);
    expect(text.out).toBe(
      [
        'T-1 Export', 'Stage: build', 'Lane: M', 'Tasks: 1/2', 'Branch: t/T-1', 'Holder: none', 'Blocked by: none', '',
        'Intent:', 'Owners can export their report as CSV.', 'Expected size: 5 tasks', '',
        'ac-1 export writes a csv', '  Given a report', '  When the owner exports it', '  Then a csv file is written',
        '  State: passing', '  Test: export#writes-csv', '  Test result: passed', '  Ticked: no', '  Verification: none', '',
        'ac-2 commas are escaped', '  Given a cell with a comma', '  When the owner exports it', '  Then the cell is quoted',
        '  State: passing', '  Test: export#escapes-commas', '  Test result: passed', '  Ticked: no', '  Verification: none', '',
      ].join('\n'),
    );
  } finally {
    cleanup(repo);
  }
}, 120_000);
