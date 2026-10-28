// ST-LN-6 task 2: `accord show <id> [--json]`, in-process through runCli on a fixture repository.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { cleanup, commitAll, commitMsg, copyRepo, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { approve, building, done, LANE_BODY, laneTicket, P, PLAN } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

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
      intent: ['Owners can export their report as CSV.'],
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
      intent: ['Owners can export their report as CSV.'],
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
