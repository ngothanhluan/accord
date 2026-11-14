// ST-LN-94 94-ac-1, D-13: `accord new ticket --lane R` writes the research template, and `accord gate ready` gates it on real git.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixModel, loadSnapshot, nextRound } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';
import { CONFIG, gateReadyIn, laneTicket, P } from '../../../test/helpers/lane.js';

type F = { rule: string; reason: string; file: string; level: string };

const fill = (text: string) =>
  text
    .replace('## Question\n', '## Question\nDoes the critic need a second round?\n')
    .replace('## Timebox\n', '## Timebox\n4 hours\n')
    .replace('## Token budget\n', '## Token budget\n800k weighted tokens\n');
const DECISION = '- D-01 Timebox 4 hours, token budget 800k weighted tokens — "four hours and 800k is enough"\n';
const decide = (text: string) => text.replace(/(## Decisions\n(?:<!--[\s\S]*?-->\n)?)/, '$1' + DECISION);

it('risk:complex-branching accord new ticket --lane R writes the research template and gate ready gates it (ST-LN-94 94-ac-1)', async () => {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  try {
    const made = await run(['new', 'ticket', 'R-1', '--lane', 'R'], repo);
    expect(made.code).toBe(0);
    expect(made.out).toBe('accord/tickets/R-1.md\n');
    const file = join(repo, 'accord', 'tickets', 'R-1.md');
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('id: "R-1"');
    expect(text).toMatch(/^lane: "?R"?/m);
    const heads = text.split('\n').filter((l) => l.startsWith('## '));
    for (const h of ['## Question', '## Timebox', '## Token budget', '## Decisions']) expect(heads).toContain(h);
    expect(heads).not.toContain('## Approach');
    expect(heads).not.toContain('## Acceptance criteria');

    const first = await run(['gate', 'ready', 'R-1', '--json'], repo);
    expect(first.code).toBe(1);
    const missing = (JSON.parse(first.out).findings as F[]).filter((f) => f.rule === 'gate.research-field-missing');
    expect(missing).toHaveLength(3);
    for (const name of ['Question', 'Timebox', 'Token budget']) expect(missing.some((f) => f.reason.includes(`"## ${name}"`)), name).toBe(true);

    writeFileSync(file, decide(fill(text)));
    const done = await run(['gate', 'ready', 'R-1', '--json'], repo);
    expect(JSON.parse(done.out).findings).toEqual([]);
    expect(done.code).toBe(0);
    expect(done.err).toContain('wrote ac_hash');
    expect(readFileSync(file, 'utf8')).toMatch(/^ac_hash: "?fnv1a64:[0-9a-f]{16}"?/m);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord gate plan refuses a lane R ticket on real git (ST-LN-94 94-ac-1)', async () => {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  try {
    expect((await run(['new', 'ticket', 'R-1', '--lane', 'R'], repo)).code).toBe(0);
    const file = join(repo, 'accord', 'tickets', 'R-1.md');
    writeFileSync(file, decide(fill(readFileSync(file, 'utf8'))));
    expect((await run(['gate', 'ready', 'R-1', '--json'], repo)).code).toBe(0);
    const plan = await run(['gate', 'plan', 'R-1', '--json'], repo);
    expect(plan.code).toBe(1);
    const out = JSON.parse(plan.out) as { findings: F[]; planHash?: string };
    expect(out.findings.map((f) => f.rule)).toEqual(['gate.lane-r-plan']);
    expect(out.findings[0].reason).toContain('lane R has no plan');
    expect(out.planHash).toBeUndefined();
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching accord gate ready names the unanswered budget of a lane R ticket on real git (ST-LN-94 D-13)', async () => {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  try {
    expect((await run(['new', 'ticket', 'R-1', '--lane', 'R'], repo)).code).toBe(0);
    const file = join(repo, 'accord', 'tickets', 'R-1.md');
    const filled = fill(readFileSync(file, 'utf8'));
    writeFileSync(file, filled);
    const first = await run(['gate', 'ready', 'R-1', '--json'], repo);
    expect(first.code).toBe(1);
    const findings = JSON.parse(first.out).findings as F[];
    const open = findings.filter((f) => f.rule === 'gate.research-budget-unanswered');
    expect(open).toHaveLength(2);
    expect(open.some((f) => f.reason.includes('"## Timebox" 4 hours'))).toBe(true);
    expect(open.some((f) => f.reason.includes('"## Token budget" 800k weighted tokens'))).toBe(true);
    expect(findings.filter((f) => f.rule !== 'gate.research-budget-unanswered')).toEqual([]);
    expect(first.err).not.toContain('ac_hash');
    writeFileSync(file, decide(filled));
    const second = await run(['gate', 'ready', 'R-1', '--json'], repo);
    expect(second.code).toBe(0);
    expect(second.err).toContain('wrote ac_hash');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// ST-LN-94 94-ac-2, 94-ac-3: gate done on a lane R branch, on real git. The base commit holds the config on main; the ticket branch adds the
// ready R ticket (ac_hash recorded by gate ready's core) and its research record.
const RECORD = 'accord/research/2026-11-20-critic-rounds.md';
const R_BODY = [
  '## Question', 'Does the critic need a second round?', '',
  '## Timebox', '4 hours', '',
  '## Token budget', '800k weighted tokens', '',
  '## Decisions', DECISION,
].join('\n');
const recordText = (...lines: string[]) => ['# Critic rounds', '', 'Date: 2026-11-20', 'Repository at `1c5704ee`', '', 'The critic needs one round.', '', ...lines, ''].join('\n');

/**
 * A repository on branch t/R-1 whose empty claim commit (dated `claimedAt`, an hour ago by default) and research commit over main add the
 * ready R ticket, its record `record` (with `spent`) and `extra`; main's base commit holds the config and `base`.
 */
function rBranch(spent: string, extra: Record<string, string> = {}, claimedAt = new Date(Date.now() - 60 * 60_000), record = RECORD, base: Record<string, string> = {}): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG, ...base });
  commitMsg(repo, 'base', new Date(claimedAt.getTime() - 60_000));
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/R-1');
  // CR-01, CR-02: the research is counted from the ticket's claim commit, which changes no file.
  commitMsg(repo, 'claim: R-1', claimedAt, true);
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    [P('R-1')]: laneTicket('R-1', { lane: 'R', body: R_BODY, frontmatter: [`research: ["${record}"]`] }),
    [record]: recordText(spent),
  };
  expect(gateReadyIn(files, 'R-1')).toBe('pass');
  writeFiles(repo, { [P('R-1')]: files[P('R-1')], [record]: files[record], ...extra });
  commitMsg(repo, 'research: R-1');
  return repo;
}

// UAT decision 3 (2026-11-14): gate done refuses every path outside accord/ the lane R branch changes, a deletion included.
it('risk:security accord gate done refuses a lane R branch that changes anything outside accord/ on real git (ST-LN-94 94-ac-3)', async () => {
  const OUTSIDE = ['.github/workflows/ci.yml', 'package.json', 'scripts/count-rounds.mjs', 'src/x.ts'];
  const repo = rBranch('Spent: 2h 10m of 4 hours; 312000 of 800k weighted tokens', Object.fromEntries(OUTSIDE.map((p) => [p, 'x\n'])));
  try {
    const first = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(first.code).toBe(1);
    const findings = JSON.parse(first.out).findings as F[];
    expect(findings.map((f) => f.rule)).toEqual(OUTSIDE.map(() => 'gate.research-shipped'));
    expect(findings.map((f) => f.file).sort()).toEqual(OUTSIDE);
    for (const f of findings) expect(f.reason).toContain(f.file + ' is outside accord/');
    gitRun(repo, 'rm', '-q', ...OUTSIDE);
    // The research script lives under accord/research/, which the rule allows.
    writeFiles(repo, { 'accord/research/count-rounds.mjs': 'console.log(1);\n' });
    commitMsg(repo, 'research: R-1 moves the script under accord/research/');
    const second = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(JSON.parse(second.out).findings).toEqual([]);
    expect(second.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security accord gate done refuses a lane R branch that deletes a file outside accord/ on real git (ST-LN-94 94-ac-3)', async () => {
  const repo = rBranch('Spent: 2h 10m of 4 hours; 312000 of 800k weighted tokens', {}, undefined, RECORD, { 'README.md': '# Fixture\n' });
  try {
    expect((await run(['gate', 'done', 'R-1', '--json'], repo)).code).toBe(0);
    gitRun(repo, 'rm', '-q', 'README.md');
    commitMsg(repo, 'research: R-1 drops the readme');
    const r = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(r.code).toBe(1);
    const findings = JSON.parse(r.out).findings as F[];
    expect(findings.map((f) => [f.rule, f.file])).toEqual([['gate.research-shipped', 'README.md']]);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching accord gate done refuses an over-budget research record on real git (ST-LN-94 D-14)', async () => {
  const repo = rBranch('Spent: 5h 0m of 4 hours; not measured of 800k weighted tokens');
  try {
    const first = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(first.code).toBe(1);
    const findings = JSON.parse(first.out).findings as F[];
    expect(findings.map((f) => f.rule)).toEqual(['gate.research-over-budget']);
    expect(findings[0].file).toBe(RECORD);
    expect(findings[0].reason).toContain('5h 0m');
    const file = join(repo, ...RECORD.split('/'));
    writeFileSync(file, readFileSync(file, 'utf8') + 'Owner: write now — "write it now"\n');
    commitMsg(repo, 'research: R-1 owner answer');
    const second = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(JSON.parse(second.out).findings).toEqual([]);
    expect(second.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// CR-01: on real git, an older record listed as evidence is not the ticket's result; the record the branch adds after the claim is.
it('risk:security accord gate done and accord status count only a record the branch changed since the claim on real git (ST-LN-94 CR-01)', async () => {
  const PRIOR = 'accord/research/2026-11-01-prior.md';
  const repo = makeEmptyRepo();
  try {
    const files: Record<string, string> = {
      'accord/config.yml': CONFIG,
      [P('R-1')]: laneTicket('R-1', { lane: 'R', body: R_BODY, frontmatter: [`research: ["${PRIOR}"]`] }),
      [PRIOR]: recordText('Spent: 1h 10m of 4 hours; not measured of 800k weighted tokens'),
      [P('T-2')]: laneTicket('T-2', { frontmatter: ['depends_on: ["R-1"]'] }),
    };
    expect(gateReadyIn(files, 'R-1')).toBe('pass');
    // The evidence was on main before the ticket was written (REVIEW2 CR-01: a record added in the commit that adds the ticket file counts).
    writeFiles(repo, { 'accord/config.yml': CONFIG, [PRIOR]: files[PRIOR] });
    commitMsg(repo, 'evidence', new Date(Date.now() - 180_000));
    writeFiles(repo, files);
    commitMsg(repo, 'base', new Date(Date.now() - 120_000));
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/R-1');
    // A change under accord/ only, so the branch diff is not empty and gate.research-shipped stays silent.
    writeFiles(repo, { 'accord/config.yml': CONFIG + '# claimed\n' });
    commitMsg(repo, 'claim: R-1', new Date(Date.now() - 60_000));
    type Row = { id: string; stage?: string; blockedBy?: string[] };
    const rows = async () => JSON.parse((await run(['status', '--json'], repo)).out) as Row[];
    const stageOf = async () => (await rows()).find((r) => r.id === 'R-1')?.stage;
    const blocked = async () => (await rows()).find((r) => r.id === 'T-2')?.blockedBy;
    const first = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(first.code).toBe(1);
    expect((JSON.parse(first.out).findings as F[]).map((f) => f.rule)).toEqual(['gate.research-record-missing']);
    expect(await stageOf()).toBe('research');
    // The ticket's own record, added on the branch after the claim, is its result; the evidence stays listed.
    const ticket = readFileSync(join(repo, ...P('R-1').split('/')), 'utf8').replace(`research: ["${PRIOR}"]`, `research: ["${PRIOR}", "${RECORD}"]`);
    writeFiles(repo, { [P('R-1')]: ticket, [RECORD]: recordText('Spent: 0h 1m of 4 hours; not measured of 800k weighted tokens') });
    commitMsg(repo, 'research: R-1');
    const second = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(JSON.parse(second.out).findings).toEqual([]);
    expect(second.code).toBe(0);
    expect(await stageOf()).toBe('done');
    // Not yet on main: the dependant waits. Merged into main: done there too, read from main's tree and history.
    expect(await blocked()).toEqual(['R-1']);
    gitRun(repo, 'switch', '-q', 'main');
    mergeMsg(repo, 't/R-1', 'Merge t/R-1');
    expect(await stageOf()).toBe('done');
    expect(await blocked()).toEqual([]);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// CR-02: on real git, a Spent line lower than the time since the claim does not pass the timebox.
it('risk:security accord gate done judges the timebox by the time since the claim commit on real git (ST-LN-94 CR-02)', async () => {
  const repo = rBranch('Spent: 0h 30m of 4 hours; not measured of 800k weighted tokens', {}, new Date(Date.now() - 10 * 60 * 60_000));
  try {
    const first = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(first.code).toBe(1);
    const findings = JSON.parse(first.out).findings as F[];
    expect(findings.map((f) => f.rule)).toEqual(['gate.research-over-budget']);
    expect(findings[0].reason).toMatch(/1[01]h [0-9]+m since the claim/);
    const file = join(repo, ...RECORD.split('/'));
    writeFileSync(file, readFileSync(file, 'utf8') + 'Owner: write now — "write it now"\n');
    commitMsg(repo, 'research: R-1 owner answer');
    const second = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(JSON.parse(second.out).findings).toEqual([]);
    expect(second.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// ST-LN-94 D-10, 94-ac-2: a lane R ticket has no approval, rounds, plan tasks or review package. Each build-stage command refuses it with a
// usage error before any work; requireLaneTicket lets it through as a lane ticket, so the refusal is the command's own, never "lane tickets only".
it('risk:complex-branching the build-stage commands refuse a lane R ticket (ST-LN-94 94-ac-2)', async () => {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  try {
    expect((await run(['new', 'ticket', 'R-1', '--lane', 'R'], repo)).code).toBe(0);
    const file = join(repo, 'accord', 'tickets', 'R-1.md');
    writeFileSync(file, decide(fill(readFileSync(file, 'utf8'))));
    expect((await run(['gate', 'ready', 'R-1', '--json'], repo)).code).toBe(0);
    commitMsg(repo, 'R-1');
    const before = readFileSync(file, 'utf8');
    const commands: Array<[string[], string]> = [
      [['round', 'R-1'], 'review rounds'],
      [['round', 'R-1', '--plan'], 'plan critique'],
      [['round', 'R-1', '--approach'], 'approach critique'],
      [['approve', 'R-1'], 'approval'],
      [['review-package', 'R-1'], 'review package'],
      [['brief', 'R-1', '1'], 'plan tasks'],
      [['task-done', 'R-1', '1'], 'plan tasks'],
    ];
    for (const [argv, what] of commands) {
      const r = await run(argv, repo);
      expect(r.code, argv.join(' ') + ': ' + r.out + r.err).toBe(2);
      expect(r.err, argv.join(' ')).toContain('lane R has no ' + what);
      expect(r.err, argv.join(' ')).toContain('a research ticket ends in a record under accord/research/');
      expect(r.err, argv.join(' ')).not.toContain('lane tickets only');
      expect(r.out, argv.join(' ')).toBe('');
    }
    // Nothing was written: no approved_hash, no ledger, no round record.
    expect(readFileSync(file, 'utf8')).toBe(before);
    expect(gitRun(repo, 'status', '--porcelain')).toBe('');
    // The core answer the round command prints, refused for every record kind; and no fix executor model rule applies to R.
    const snapshot = loadSnapshot({ files: { 'accord/config.yml': CONFIG, [P('R-1')]: before }, tree: [] });
    for (const kind of ['review', 'plan', 'approach'] as const) {
      const answer = nextRound(snapshot, 'R-1', kind);
      expect(answer.kind, kind).toBe('refused');
      expect(answer.reasons.join(' '), kind).toContain('lane R has no');
    }
    expect(fixModel(snapshot, 'R-1', 4)).toBeUndefined();
  } finally {
    cleanup(repo);
  }
}, 120_000);

// D-10: an epic groups stories of lane L or P; a research question is never an epic.
it('risk:regression an epic is never lane R (ST-LN-94 D-10)', async () => {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  try {
    const r = await run(['new', 'ticket', 'E-1', '--type', 'epic', '--lane', 'R'], repo);
    expect(r.code).toBe(2);
    expect(r.err).toContain('an epic is lane L or P, not R');
    expect(gitRun(repo, 'status', '--porcelain', '--untracked-files=all')).not.toContain('E-1');
    const l = await run(['new', 'ticket', 'E-2', '--type', 'epic', '--lane', 'L'], repo);
    expect(l.code, l.err).toBe(0);
    expect(l.out).toBe('accord/tickets/E-2.md\n');
  } finally {
    cleanup(repo);
  }
}, 120_000);

type Row = { id: string; stage?: string; blockedBy?: string[] };
const rowsIn = async (repo: string) => JSON.parse((await run(['status', '--json'], repo)).out) as Row[];
const rowOf = async (repo: string, id: string) => (await rowsIn(repo)).find((r) => r.id === id);
const GIT_ID = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', '-c', 'commit.gpgsign=false'];

// REVIEW2 CR-01: a squash merge leaves main no claim commit. A listed record then counts when a commit from the one that added the ticket file
// on changed it, so the squash-merged ticket reads done on main and its dependant is unblocked; an older record listed as evidence still never counts.
it('risk:security a squash-merged lane R ticket reads done on main and unblocks its dependant on real git (ST-LN-94 REVIEW2 CR-01)', async () => {
  const PRIOR = 'accord/research/2026-11-01-prior.md';
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      [PRIOR]: recordText('Spent: 1h 10m of 4 hours; not measured of 800k weighted tokens'),
      [P('T-2')]: laneTicket('T-2', { frontmatter: ['depends_on: ["R-1"]'] }),
    });
    commitMsg(repo, 'base', new Date(Date.now() - 3 * 60 * 60_000));
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/R-1');
    // As accord new ticket --lane R --worktree does: the claim commit adds the ticket file, listing the evidence.
    const ready: Record<string, string> = { 'accord/config.yml': CONFIG, [P('R-1')]: laneTicket('R-1', { lane: 'R', body: R_BODY, frontmatter: [`research: ["${PRIOR}"]`] }), [PRIOR]: recordText() };
    expect(gateReadyIn(ready, 'R-1')).toBe('pass');
    const ticket = ready[P('R-1')];
    writeFiles(repo, { [P('R-1')]: ticket });
    commitMsg(repo, 'claim: R-1', new Date(Date.now() - 2 * 60 * 60_000));
    writeFiles(repo, {
      [P('R-1')]: ticket.replace(`research: ["${PRIOR}"]`, `research: ["${PRIOR}", "${RECORD}"]`),
      [RECORD]: recordText('Spent: 0h 40m of 4 hours; not measured of 800k weighted tokens'),
    });
    commitMsg(repo, 'research: R-1');
    const onBranch = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(JSON.parse(onBranch.out).findings).toEqual([]);
    expect(onBranch.code).toBe(0);
    gitRun(repo, 'switch', '-q', 'main');
    gitRun(repo, ...GIT_ID, 'merge', '--squash', '-q', 't/R-1');
    commitMsg(repo, 'R-1 research (#1)');
    // The branch still exists: the main checkout reads it from there; deleted, as GitHub does after the merge: read from main alone.
    expect((await rowOf(repo, 'R-1'))?.stage).toBe('done');
    gitRun(repo, 'branch', '-q', '-D', 't/R-1');
    expect((await rowOf(repo, 'R-1'))?.stage).toBe('done');
    expect((await rowOf(repo, 'T-2'))?.blockedBy ?? []).toEqual([]);
    // A later pull request's CI runs gate done on the ticket from a branch of main with no claim commit. gate done judges the branch it runs
    // on: the records still count there, and a change outside accord/ on that branch is refused (UAT decision 3).
    gitRun(repo, 'switch', '-q', '-c', 't/T-2');
    writeFiles(repo, { [P('T-2')]: laneTicket('T-2', { frontmatter: ['depends_on: ["R-1"]', 'priority: high'] }) });
    commitMsg(repo, 'T-2 work');
    const later = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(JSON.parse(later.out).findings).toEqual([]);
    expect(later.code).toBe(0);
    writeFiles(repo, { 'notes.txt': 'T-2 work\n' });
    commitMsg(repo, 'T-2 code');
    const coded = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect((JSON.parse(coded.out).findings as F[]).map((f) => [f.rule, f.file])).toEqual([['gate.research-shipped', 'notes.txt']]);
    gitRun(repo, 'switch', '-q', 'main');
    // An R ticket added to main later that lists only the older record: evidence, so it stays at research and gate done refuses it.
    const ready2: Record<string, string> = { 'accord/config.yml': CONFIG, [P('R-2')]: laneTicket('R-2', { lane: 'R', body: R_BODY, frontmatter: [`research: ["${PRIOR}"]`] }), [PRIOR]: recordText() };
    expect(gateReadyIn(ready2, 'R-2')).toBe('pass');
    writeFiles(repo, { [P('R-2')]: ready2[P('R-2')] });
    commitMsg(repo, 'backlog: queue R-2');
    expect((await rowOf(repo, 'R-2'))?.stage).toBe('research');
    const r2done = await run(['gate', 'done', 'R-2', '--json'], repo);
    expect(r2done.code).toBe(1);
    expect((JSON.parse(r2done.out).findings as F[]).map((f) => f.rule)).toContain('gate.research-record-missing');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// REVIEW2 WR-01: the main checkout reads a claimed R ticket from its branch, and its research from that branch's history.
it('risk:regression the main checkout shows a finished lane R ticket on its branch as done on real git (ST-LN-94 REVIEW2 WR-01)', async () => {
  const repo = rBranch('Spent: 0h 30m of 4 hours; not measured of 800k weighted tokens');
  try {
    expect((await rowOf(repo, 'R-1'))?.stage).toBe('done');
    gitRun(repo, 'switch', '-q', 'main');
    expect((await rowOf(repo, 'R-1'))?.stage).toBe('done');
    const board = await run(['dashboard'], repo);
    expect(board.out).not.toContain('next: the research');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// REVIEW2 WR-02: a record whose file name has a non-ASCII character is read from git unquoted, so it counts.
it('risk:regression a research record with a non-ASCII file name counts on real git (ST-LN-94 REVIEW2 WR-02)', async () => {
  const CAFE = 'accord/research/2026-11-20-café.md';
  const repo = rBranch('Spent: 0h 30m of 4 hours; not measured of 800k weighted tokens', {}, undefined, CAFE);
  try {
    const r = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(JSON.parse(r.out).findings).toEqual([]);
    expect(r.code).toBe(0);
    expect((await rowOf(repo, 'R-1'))?.stage).toBe('done');
  } finally {
    cleanup(repo);
  }
}, 120_000);

// REVIEW2 WR-03: a rebase rewrites committer times to now but keeps author times, so the clock reads the claim's author time.
it('risk:security a rebase of the lane R branch keeps the clock of accord budget and gate done on real git (ST-LN-94 REVIEW2 WR-03)', async () => {
  const repo = rBranch('Spent: 0h 30m of 4 hours; not measured of 800k weighted tokens', {}, new Date(Date.now() - 10 * 60 * 60_000));
  try {
    gitRun(repo, 'switch', '-q', 'main');
    writeFiles(repo, { 'other.txt': 'main moved\n' });
    commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 't/R-1');
    gitRun(repo, ...GIT_ID, 'rebase', '-q', 'main');
    const claimCt = Number(gitRun(repo, 'log', '-1', '--format=%ct', 'HEAD~1').trim());
    expect(Date.now() / 1000 - claimCt).toBeLessThan(60 * 60); // the rebase moved the committer time to now
    const budget = await run(['budget', 'R-1'], repo);
    expect(budget.code).toBe(1);
    expect(budget.out).toMatch(/1[01]h [0-9]+m of 4 hours/);
    const done = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(done.code).toBe(1);
    const findings = JSON.parse(done.out).findings as F[];
    expect(findings.map((f) => f.rule)).toEqual(['gate.research-over-budget']);
    expect(findings[0].reason).toMatch(/1[01]h [0-9]+m since the claim/);
  } finally {
    cleanup(repo);
  }
}, 120_000);
