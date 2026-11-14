// ST-LN-94 94-ac-1, D-13: `accord new ticket --lane R` writes the research template, and `accord gate ready` gates it on real git.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixModel, loadSnapshot, nextRound } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
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

/** A repository on branch t/R-1 whose claim commit (dated `claimedAt`, an hour ago by default) and research commit over main add the ready R ticket, its record (with `spent`) and `extra`. */
function rBranch(spent: string, extra: Record<string, string> = {}, claimedAt = new Date(Date.now() - 60 * 60_000)): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  commitMsg(repo, 'base', new Date(claimedAt.getTime() - 60_000));
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/R-1');
  // CR-01, CR-02: the research is counted from the ticket's claim commit.
  writeFiles(repo, { 'notes.txt': 'claimed\n' });
  commitMsg(repo, 'claim: R-1', claimedAt);
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    [P('R-1')]: laneTicket('R-1', { lane: 'R', body: R_BODY, frontmatter: [`research: ["${RECORD}"]`] }),
    [RECORD]: recordText(spent),
  };
  expect(gateReadyIn(files, 'R-1')).toBe('pass');
  writeFiles(repo, { [P('R-1')]: files[P('R-1')], [RECORD]: files[RECORD], ...extra });
  commitMsg(repo, 'research: R-1');
  return repo;
}

it('risk:security accord gate done refuses a lane R branch that changes packages/ on real git (ST-LN-94 94-ac-3)', async () => {
  const repo = rBranch('Spent: 2h 10m of 4 hours; 312000 of 800k weighted tokens', { 'packages/core/src/x.ts': 'export const x = 1;\n' });
  try {
    const first = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(first.code).toBe(1);
    const findings = JSON.parse(first.out).findings as F[];
    expect(findings.map((f) => f.rule)).toEqual(['gate.research-shipped']);
    expect(findings[0].file).toBe('packages/core/src/x.ts');
    expect(findings[0].reason).toContain('packages/core/src/x.ts is under packages/');
    gitRun(repo, 'rm', '-q', 'packages/core/src/x.ts');
    commitMsg(repo, 'research: R-1 drops the script');
    const second = await run(['gate', 'done', 'R-1', '--json'], repo);
    expect(JSON.parse(second.out).findings).toEqual([]);
    expect(second.code).toBe(0);
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
    };
    expect(gateReadyIn(files, 'R-1')).toBe('pass');
    writeFiles(repo, files);
    commitMsg(repo, 'base', new Date(Date.now() - 120_000));
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/R-1');
    writeFiles(repo, { 'notes.txt': 'claimed\n' });
    commitMsg(repo, 'claim: R-1', new Date(Date.now() - 60_000));
    const stageOf = async () => (JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; stage?: string }[]).find((r) => r.id === 'R-1')?.stage;
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
