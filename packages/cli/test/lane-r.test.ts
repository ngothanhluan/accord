// ST-LN-94 94-ac-1, D-13: `accord new ticket --lane R` writes the research template, and `accord gate ready` gates it on real git.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** A repository on branch t/R-1 whose one commit over main adds the ready R ticket, its record (with `spent`) and `extra`. */
function rBranch(spent: string, extra: Record<string, string> = {}): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/R-1');
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
