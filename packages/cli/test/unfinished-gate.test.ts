// ST-LN-72 72-ac-1, plan half: `accord gate plan` on real git refuses a plan.md that still carries `<!-- accord: unfinished -->`, whatever the claim pin, naming the file.
// The CLI here runs as the cut-off release (0.6.0) while the package is still 0.5.1, so the new rule is read at the version that ships it.
import { readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { recordTaskDone, setFrontmatterKey, UNFINISHED_MARKER } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { approve, CONFIG, discussFiles, discussPath, gateReadyIn, laneTicket, P, PLAN } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

/** The orchestrator ran the suite after the last commit: task-done refuses a report older than HEAD. */
function freshReport(repo: string): void {
  const later = new Date(Date.now() + 5000);
  utimesSync(join(repo, 'reports', 'junit.xml'), later, later);
}

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.6.0' } };
});

interface Found { rule: string; level: string; reason?: string; file?: string; line?: number }
const gate = async (repo: string): Promise<{ code: number; found: Found[]; out: string }> => {
  const r = await run(['gate', 'plan', 'T-1', '--json'], repo);
  return { code: r.code, out: r.out, found: (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === 'gate.plan-unfinished') };
};
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

/** A plan that satisfies every other plan rule; `first` is its first body line, right after the frontmatter. */
const plan = (first: string | undefined): string =>
  [
    '---',
    'baseline: abc1234',
    '---',
    ...(first === undefined ? [] : [first]),
    '',
    '# Plan',
    '',
    '## Task 1: Writer csv mode',
    'covers: @ac-1, @ac-2, D-01',
    'files: src/export.ts',
    'verify: export#writes-csv (@ac-1) export#escapes-commas (@ac-2)',
    'after: none',
    'Add a csv branch to the writer.',
    '',
  ].join('\n');

/** An approved ticket claimed under `claimPin`, then its plan committed against the baseline commit. */
async function planned(text: string, claimPin = '0.6.0'): Promise<{ repo: string; baseline: string }> {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  await run(['approve', 'T-1'], repo);
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'notes.txt': 'work after the claim\n' });
  const baseline = commitAll(repo);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': text.replace('abc1234', baseline) });
  commitAll(repo);
  return { repo, baseline };
}

it('risk:regression gate plan on real git refuses a plan still being written and passes it once the marker is gone (ST-LN-72 72-ac-1)', async () => {
  const { repo, baseline } = await planned(plan(UNFINISHED_MARKER));
  try {
    const got = await gate(repo);
    expect(got.code).toBe(1);
    expect(got.found).toHaveLength(1);
    expect(got.found[0].level).toBe('error');
    expect(got.found[0].file).toBe('accord/tickets/T-1/plan.md');
    expect(got.found[0].line).toBe(4);
    expect(got.found[0].reason).toContain('accord/tickets/T-1/plan.md');
    expect(got.found[0].reason).toContain(UNFINISHED_MARKER);

    // the planner's last step: the line is removed and the plan committed; nothing else was wrong with it
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': plan(undefined).replace('abc1234', baseline) });
    commitAll(repo);
    const done = await gate(repo);
    expect(done.found).toEqual([]);
    expect(done.code).toBe(0);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression gate plan prints the same unfinished finding on every run, and a marker above the frontmatter is still refused (ST-LN-72 72-ac-1)', async () => {
  const { repo } = await planned(`${UNFINISHED_MARKER}\n${plan(undefined)}`);
  try {
    const first = await gate(repo);
    const second = await gate(repo);
    expect(first.code).toBe(1);
    expect(first.found.map((f) => f.line)).toEqual([1]);
    expect(second.out).toBe(first.out);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a ticket claimed before 0.6.0 is refused for its marked plan on real git, as owner decision 2026-11-16 says (ST-LN-72 72-ac-1)', async () => {
  const { repo } = await planned(plan(UNFINISHED_MARKER), '0.5.1');
  try {
    const got = await gate(repo);
    expect(got.code).toBe(1);
    expect(got.found.map((f) => f.line)).toEqual([4]);
  } finally {
    cleanup(repo);
  }
});

// Verification half: a ticket at done whose verification.md still carries the marker is refused by `accord gate done`, and `accord anchor` prints the resume fact.
const VERIFICATION = 'accord/tickets/T-1/verification.md';
const evidence = (sha: string, first?: string): string =>
  ['---', 'ticket: "T-1"', `commit: "${sha}"`, 'reviewed_on: "2026-11-16"', '---', ...(first === undefined ? [] : [first]), '', '## @ac-1 export writes a csv', '', 'Result: pass', '', 'Evidence: export#writes-csv passed in reports/junit.xml', '', '## @ac-2 commas are escaped', '', 'Result: pass', '', 'Evidence: export#escapes-commas passed in reports/junit.xml', ''].join('\n');

/** The repository lane-flow.test.ts walks to Done, with verification.md written by `evidence` at the gated commit and left uncommitted. */
function doneRepo(first: string | undefined, runtimes?: string): { repo: string; sha: string } {
  const repo = makeLaneRepo(discussFiles('T-1'));
  try {
    // the working-tree pin is the cut-off release itself (no claim commit here), and every file the gate reads is committed or written below
    writeFiles(repo, { 'accord/config.yml': pinned('0.6.0').replace('runtimes: [claude]', `runtimes: ${runtimes ?? '[claude]'}`) });
    gitRun(repo, 'config', 'user.email', 'fixture@example.invalid');
    gitRun(repo, 'config', 'user.name', 'fixture');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    commitMsg(repo, 'base');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    const files: Files = {};
    for (const rel of ['accord/config.yml', P('T-1'), 'accord/tickets/T-1/plan.md', 'src/export.ts', 'reports/junit.xml', discussPath('T-1')]) {
      files[rel] = readFileSync(join(repo, ...rel.split('/')), 'utf8');
    }
    approve(files, 'T-1');
    expect(gateReadyIn(files, 'T-1')).toBe('pass');
    writeFiles(repo, { [P('T-1')]: files[P('T-1')] });
    const baseline = commitMsg(repo, 'fixture');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseline) });
    const planned = commitMsg(repo, 'plan: T-1 ready');
    freshReport(repo);
    const ledger = 'accord/tickets/T-1/ledger.md';
    const one = recordTaskDone(undefined, 1, planned.slice(0, 12)) as string;
    writeFiles(repo, { [ledger]: one });
    const next = commitMsg(repo, 'fixture');
    freshReport(repo);
    writeFiles(repo, { [ledger]: recordTaskDone(one, 2, next.slice(0, 12)) as string });
    writeFiles(repo, { 'src/export.ts': readFileSync(join(repo, 'src', 'export.ts'), 'utf8') + '// task 2\n' });
    const head = commitMsg(repo, 'task 2: T-1');
    freshReport(repo);
    writeFiles(repo, { 'accord/tickets/T-1/review.md': `Round record: 2\n\n## Round 1 head ${head}\n\nNo findings\n\nverdict: converged\n` });
    const sha = commitAll(repo);
    const file = join(repo, 'accord', 'tickets', 'T-1.md');
    let ticket = readFileSync(file, 'utf8');
    const hash = /^ac_hash: "(.+)"$/m.exec(ticket)?.[1] as string;
    ticket = setFrontmatterKey(ticket, 'verified', ['ac-1', 'ac-2']);
    ticket = setFrontmatterKey(ticket, 'verified_hash', hash);
    ticket = setFrontmatterKey(ticket, 'verified_commit', sha);
    writeFileSync(file, ticket);
    writeFiles(repo, { [VERIFICATION]: evidence(sha, first) });
    return { repo, sha };
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}
const doneGate = async (repo: string): Promise<{ code: number; out: string; found: Found[] }> => {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return { code: r.code, out: r.out, found: (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === 'gate.verification-unfinished') };
};

it('risk:regression gate done on real git refuses a verification still being written and anchor prints the resume line (ST-LN-72 72-ac-1)', async () => {
  const { repo, sha } = doneRepo(UNFINISHED_MARKER);
  try {
    const got = await doneGate(repo);
    expect(got.code).toBe(1);
    expect(got.found).toHaveLength(1);
    expect(got.found[0].file).toBe(VERIFICATION);
    expect(got.found[0].line).toBe(6);
    expect(got.found[0].reason).toContain(VERIFICATION);
    expect(got.found[0].reason).toContain(UNFINISHED_MARKER);
    expect((await run(['anchor', 'T-1'], repo)).out).toContain(`Unfinished: ${VERIFICATION}: resume the verifier`);

    // the verifier's last step: the line is removed, nothing else was wrong with the record
    writeFiles(repo, { [VERIFICATION]: evidence(sha) });
    const clean = await doneGate(repo);
    expect(clean.found).toEqual([]);
    expect(clean.code).toBe(0);
    expect((await run(['anchor', 'T-1'], repo)).out).not.toContain('Unfinished:');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression the marker rules hold in a repository whose runtimes install no accord agent (ST-LN-72 72-ac-1)', async () => {
  const { repo } = doneRepo(UNFINISHED_MARKER, '[codex, cursor, copilot]');
  try {
    const got = await doneGate(repo);
    expect(got.code).toBe(1);
    expect(got.found.map((f) => f.file)).toEqual([VERIFICATION]);
  } finally {
    cleanup(repo);
  }
}, 120_000);

// ST-LN-72 review round 2: the verify stage commits everything (the partial verification.md too) before `accord worktree sync`, which refuses uncommitted changes to tracked files, so HEAD is no longer
// the commit the verifier began on. The anchor resumes when nothing outside accord/tickets/<id>/ changed since that commit, and tells the stage to start over when product code did.
it('risk:complex-branching a partial verification committed before the sync is resumed; one over changed product code is started over (ST-LN-72 review round 2)', async () => {
  const { repo, sha } = doneRepo(UNFINISHED_MARKER);
  try {
    const unfinished = async (): Promise<string[]> => (await run(['anchor', 'T-1'], repo)).out.split('\n').filter((l) => l.startsWith('Unfinished:'));
    expect(await unfinished()).toEqual([`Unfinished: ${VERIFICATION}: resume the verifier`]);

    // step 2: everything is committed, verification.md included, so the sync finds a clean tree. The owner's tick is written later in a real run, so it is dropped here.
    gitRun(repo, 'checkout', '--', 'accord/tickets/T-1.md');
    gitRun(repo, 'add', VERIFICATION);
    gitRun(repo, 'commit', '-q', '--no-verify', '-m', 'verify: T-1 partial');
    const committed = gitRun(repo, 'rev-parse', 'HEAD').trim();
    expect(committed).not.toBe(sha);
    const synced = await run(['worktree', 'sync', 'T-1'], repo);
    expect(synced.code).toBe(0);
    expect(gitRun(repo, 'rev-parse', 'HEAD').trim()).toBe(committed);
    // HEAD moved, only inside the ticket's folder: the verifier still resumes
    expect(await unfinished()).toEqual([`Unfinished: ${VERIFICATION}: resume the verifier`]);

    // product code changed after the verifier began: the blocks describe other work
    writeFiles(repo, { 'src/export.ts': readFileSync(join(repo, 'src', 'export.ts'), 'utf8') + '// changed after the blocks were written\n' });
    gitRun(repo, 'add', 'src/export.ts');
    gitRun(repo, 'commit', '-q', '--no-verify', '-m', 'fix: after verify began');
    const now = gitRun(repo, 'rev-parse', 'HEAD').trim();
    expect(await unfinished()).toEqual([`Unfinished: ${VERIFICATION}: written at ${sha}, HEAD is ${now}: start the verifier over`]);
  } finally {
    cleanup(repo);
  }
}, 120_000);
