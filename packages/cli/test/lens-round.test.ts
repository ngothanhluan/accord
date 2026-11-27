// Phase 11 plan 06 (11-ac-6, D-05): `accord round` holds each recorded review round against the team lenses its own package printed, recomputed from git and the lens files at the default branch, on
// real git. The CLI here runs as the cut-off release (0.23.0), so a ticket claimed under it is judged.
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { loadSnapshot } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';
import { withClaimPins } from '../src/load/claim-facts.js';
import { loadFromFs } from '../src/load/fs.js';
import { withLensFacts } from '../src/load/lens-facts.js';
import { countedSync, spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { counted } from './helpers/runs.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.23.0' } };
});

const REVIEW = 'accord/tickets/T-1/review.md';
const DB = '---\npaths: [src/db/]\non_finding: block\n---\n\n- Every query uses parameters.\n';
const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const record = (head: string, ...lines: string[]): string => `Round record: 2\n\n## Round 1 head ${head}\n\n${['No findings', 'Security: no pattern matched', ...lines].join('\n')}\n`;

/** A lane M ticket claimed under 0.23.0 on its own branch: main holds the config, T-1 and the lenses; the branch has the claim, the plan and one code commit (`code`), then review.md headed by that commit. */
function claimed(o: { claim?: string; lenses?: Record<string, string>; code: Record<string, string>; plan?: (base: string) => string; review: (head: string) => string }): { repo: string; base: string; head: string } {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, {
    'accord/config.yml': pinned(o.claim ?? '0.23.0'),
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'src/run.ts': 'export const one = 1;\n',
    ...Object.fromEntries(Object.entries(o.lenses ?? {}).map(([name, text]) => [`accord/lenses/${name}.md`, text])),
  });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  // a ticket claimed under an older pin has the repository's current pin written after its claim commit, as the running accord needs (a pin mismatch is a hard refusal)
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': (o.plan ?? ((b: string) => PLAN.replace('abc1234', b)))(base), ...(o.claim === undefined ? {} : { 'accord/config.yml': pinned('0.23.0') }), ...o.code });
  const head = commitMsg(repo, 'code');
  writeFiles(repo, { [REVIEW]: o.review(head) });
  commitMsg(repo, 'round 1');
  return { repo, base, head };
}

it('risk:regression accord round refuses a round that skipped the printed db lens, naming the dispatch, and answers once the round records it, on real git (11-ac-6, D-05)', async () => {
  const box = claimed({ lenses: { db: DB }, code: { 'src/db/x.ts': 'export const q = 1;\n' }, review: (h) => record(h) });
  const refused = await run(['round', 'T-1'], box.repo);
  expect(refused.err).toBe('');
  expect(refused.code).toBe(1);
  expect(refused.out).toContain('refused:');
  expect(refused.out).toContain('round 1 of cycle 1');
  expect(refused.out).toContain('lens db (on_finding block)');
  expect(refused.out).toContain('accord review-package T-1 --lens db --round 1');

  // the round records the lens, and the refusal is gone
  writeFiles(box.repo, { [REVIEW]: record(box.head, 'Lens: db ran') });
  commitMsg(box.repo, 'lens review');
  const next = await run(['round', 'T-1'], box.repo);
  expect(next.out).not.toContain('refused:');
  expect(next.out).toContain('Round: 2');
  expect(next.code).toBe(0);
}, 240_000);

const EVERY = '---\non_finding: warn\n---\n\n- Every change names its rollback.\n';
const DB_SECTION = '## Team lenses\n\n### Lens db\non_finding: block; paths: src/db/; dispatch accord-reviewer with lens db\n\n- Every query uses parameters.';

/** The text of `## Team lenses` up to the next `## ` heading; undefined when the file has none. */
const section = (text: string): string | undefined => {
  const at = text.indexOf('## Team lenses');
  if (at < 0) return undefined;
  const next = text.indexOf('\n## ', at + 1);
  return text.slice(at, next < 0 ? undefined : next).trimEnd();
};

it("risk:regression the dispatch line a refusal prints runs as written: review-package rebuilds round 1's package for that one lens, and refuses what it cannot (11-ac-6, D-05)", async () => {
  // main holds two lenses: db (paths src/db/) and every (no paths); round 1 changed src/db/x.ts, a later fix changed src/db/y.ts
  const box = claimed({ lenses: { db: DB, every: EVERY }, code: { 'src/db/x.ts': 'export const q = 1;\n' }, review: (h) => record(h) });
  const fix = (() => {
    writeFiles(box.repo, { 'src/db/y.ts': 'export const r = 2;\n' });
    return commitMsg(box.repo, 'fix');
  })();
  // the refusal of a record that skipped both lenses names the exact command; it is run unchanged
  writeFiles(box.repo, { [REVIEW]: `${record(box.head)}\n## Round 2 head ${fix}\n\nNo findings\nSecurity: no pattern matched\n` });
  commitMsg(box.repo, 'round 2');
  const refused = await run(['round', 'T-1'], box.repo);
  expect(refused.code).toBe(1);
  const printed = /accord (review-package T-1 --lens db --round 1 --out \S+)/.exec(refused.out);
  expect(printed, refused.out).not.toBeNull();
  const ok = await run(printed![1].split(' '), box.repo);
  expect(ok.err).toBe('');
  expect(ok.code).toBe(0);
  expect(ok.out).toContain(`Head: ${box.head.slice(0, 12)}`);
  expect(ok.out).toContain('file: ');
  const text = readFileSync(join(box.repo, '.accord-reports', 'T-1', 'lens-db-1.md'), 'utf8');
  expect(section(text)).toBe(DB_SECTION);
  expect(text).not.toContain('### Lens every');
  expect(text).toContain(`${box.base.slice(0, 12)}...${box.head.slice(0, 12)}`);
  expect(text).toContain('src/db/x.ts');
  expect(text).not.toContain('src/db/y.ts'); // round 2's own fix is another range
  expect(text.indexOf('## Commits')).toBeGreaterThan(text.indexOf('## Team lenses'));
  expect(text).toContain('## Stat');
  expect(text).toContain('## Diff');

  // what it refuses is a usage error (exit 2) that names what to give
  const usage = async (argv: string[], needle: string) => {
    const r = await run(['review-package', 'T-1', ...argv], box.repo);
    expect(r.code, argv.join(' ') + ': ' + r.out + r.err).toBe(2);
    expect(r.err, argv.join(' ')).toContain(needle);
  };
  await usage(['--lens', 'db'], '--round');
  await usage(['--lens', 'db', '--round', '0'], '--round takes a round number');
  await usage(['--lens', 'db', '--round', '9'], 'records 2 rounds');
  await usage(['--lens', 'nope', '--round', '1'], 'accord/lenses/nope.md');
  await usage(['--lens', 'db', '--round', '2'], 'names no lens');
  await usage(['--lens', 'db', '--round', '1', '--security'], '--lens and --security');
  await usage(['--lens', 'db', '--round', '1', '--base', box.base], 'no --base');
  await usage(['--round', '1'], 'give --security too');
}, 300_000);

interface Found { rule: string; level: string; file?: string; line?: number; reason: string }
const RULE = 'gate.lens-unreviewed';
async function lensFindings(repo: string, env: NodeJS.ProcessEnv = {}): Promise<Found[]> {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo, env);
  return (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === RULE);
}

it('risk:regression accord gate done refuses the ticket whose round skipped the printed db lens, naming the round and the lens, on real git (11-ac-6, D-05)', async () => {
  const box = claimed({ lenses: { db: DB }, code: { 'src/db/x.ts': 'export const q = 1;\n' }, review: (h) => record(h) });
  const refused = await lensFindings(box.repo);
  expect(refused).toHaveLength(1);
  expect(refused[0]).toMatchObject({ level: 'error', file: REVIEW });
  expect(refused[0].reason).toContain('round 1 of cycle 1');
  expect(refused[0].reason).toContain('lens db (on_finding block)');
  expect(refused[0].reason).toContain('accord review-package T-1 --lens db --round 1');
  // the round records the lens, and the refusal is gone
  writeFiles(box.repo, { [REVIEW]: record(box.head, 'Lens: db ran') });
  commitMsg(box.repo, 'lens review');
  expect(await lensFindings(box.repo)).toEqual([]);
}, 240_000);

/** A git read of the lens files at the default branch: the one read the lens rule starts for a ticket it judges. */
const lensRead = (a: string[]): boolean => a.includes('ls-tree') && a.includes('accord/lenses/');
const CODE = { 'src/db/x.ts': 'export const q = 1;\n' };
const cannotBeChecked = 'the team lenses cannot be checked';

it('risk:complex-branching a ticket claimed before 0.23.0 is asked by neither command and starts no lens git read, while a fresh claim and a failed claim read do (11-ac-6, D-05)', async () => {
  const old = claimed({ claim: '0.22.0', lenses: { db: DB }, code: CODE, review: (h) => record(h) });
  const before = await counted(['gate', 'done', 'T-1', '--json'], old.repo);
  expect(before.argv.filter(lensRead)).toEqual([]);
  expect((JSON.parse(before.out).findings as Found[]).filter((f) => f.rule === RULE)).toEqual([]);
  const round = await counted(['round', 'T-1'], old.repo);
  expect(round.argv.filter(lensRead)).toEqual([]);
  // the round is refused for the config change of the pin rewrite (the security rule), never for a lens
  expect(round.out).not.toContain('team lens');
  expect(round.out).not.toContain('lens db');
  expect(round.out).not.toContain('--lens');

  // in process: the snapshot itself comes back and no git process starts for the old claim
  const s: RepoSnapshot = withClaimPins(old.repo, loadSnapshot(loadFromFs(old.repo)), 'T-1');
  const none = countedSync(() => withLensFacts(old.repo, s, 'T-1'));
  expect(none.value).toBe(s);
  expect(none.value.lensFacts).toBeUndefined();
  expect(none.argv).toEqual([]);

  // a failed claim read is not before the cut-off: the facts are read and the rule applies
  const failed: RepoSnapshot = { ...s, claimPins: { 'T-1': { error: 'git failed' } } };
  const read = countedSync(() => withLensFacts(old.repo, failed, 'T-1'));
  expect(read.value.lensFacts?.['T-1']).toMatchObject({ rounds: [{ lenses: ['db'] }] });
  expect(read.argv.filter(lensRead).length).toBeGreaterThanOrEqual(1);

  const fresh = claimed({ lenses: { db: DB }, code: CODE, review: (h) => record(h) });
  const asked = await counted(['gate', 'done', 'T-1', '--json'], fresh.repo);
  expect(asked.argv.filter(lensRead).length).toBeGreaterThanOrEqual(1);
  expect((JSON.parse(asked.out).findings as Found[]).filter((f) => f.rule === RULE)).toHaveLength(1);
}, 300_000);

it('risk:security a round whose head names no commit, and a plan with no baseline, are one "cannot be checked" finding in gate done and the same refusal from accord round (11-ac-6, D-05)', async () => {
  const unnamed = claimed({ lenses: { db: DB }, code: CODE, review: () => record('1234567') });
  const nohead = await lensFindings(unnamed.repo);
  expect(nohead).toHaveLength(1);
  expect(nohead[0]).toMatchObject({ level: 'error', file: REVIEW, line: 1 });
  expect(nohead[0].reason).toContain(cannotBeChecked);
  expect(nohead[0].reason).toContain('1234567');
  const refusedHead = await run(['round', 'T-1'], unnamed.repo);
  // accord round refuses it too: the head is read before the lens rule is reached, so the refusal is the round record's own
  expect(refusedHead.code).toBe(1);
  expect(refusedHead.out).toContain('1234567 names no commit');

  const noBase = claimed({ lenses: { db: DB }, code: CODE, plan: () => PLAN.replace('baseline: abc1234\n', ''), review: (h) => record(h) });
  const nobase = await lensFindings(noBase.repo);
  expect(nobase).toHaveLength(1);
  expect(nobase[0].reason).toContain(cannotBeChecked);
  expect(nobase[0].reason).toContain('no baseline');
  const refusedBase = await run(['round', 'T-1'], noBase.repo);
  // the security rule reads the same plan baseline first and refuses with its own "cannot be checked"; the lens refusal is the one that follows once the baseline is recorded
  expect(refusedBase.code).toBe(1);
  expect(refusedBase.out).toContain('cannot be checked');
  expect(refusedBase.out).toContain('no baseline');
}, 300_000);

it('risk:regression gate done spares no (final review) round the lens its package printed, and a later fix round needs none, on real git (11-ac-6, D-05)', async () => {
  const box = claimed({ lenses: { db: DB }, code: CODE, review: (h) => record(h, 'Lens: db ran') });
  writeFiles(box.repo, { 'src/db/y.ts': 'export const r = 2;\n' });
  const fix = commitMsg(box.repo, 'fix');
  const text = (finalLine: string): string =>
    `${record(box.head, 'Lens: db ran')}\n## Round 2 head ${fix} (final review)\n\nNo findings\nSecurity: no pattern matched\n${finalLine}\n\n` +
    `## Round 3 head ${fix}\n\nNo findings\nSecurity: no pattern matched\n`;
  writeFiles(box.repo, { [REVIEW]: text('') });
  commitMsg(box.repo, 'rounds');
  const refused = await lensFindings(box.repo);
  // the final review's package (the plan baseline to its head) printed db: it needs its line; round 3, a fix round, needs none
  expect(refused).toHaveLength(1);
  expect(refused[0].reason).toContain('round 2 of cycle 1');
  expect(refused[0].reason).toContain('accord review-package T-1 --lens db --round 2');
  writeFiles(box.repo, { [REVIEW]: text('Lens: db ran') });
  commitMsg(box.repo, 'final review lens');
  expect(await lensFindings(box.repo)).toEqual([]);
}, 300_000);

it('risk:parsing a Lens line that is not "Lens: <name> ran" is refused with its line by gate done and accord round, on real git (11-ac-6, D-05)', async () => {
  // the package touched no path db names, so no lens was printed and the three lines are the only problems
  const bad = ['Lens: db', 'Lens: DB ran', 'Lens: db ran twice'];
  const box = claimed({ lenses: { db: DB }, code: { 'src/plain.ts': 'export const a = 1;\n' }, review: (h) => record(h, ...bad) });
  const found = await lensFindings(box.repo);
  expect(found.map((f) => f.line)).toEqual([7, 8, 9]);
  for (const [k, line] of bad.entries()) expect(found[k].reason).toContain(`"${line}" is not read`);
  const refused = await run(['round', 'T-1'], box.repo);
  expect(refused.code).toBe(1);
  for (const line of bad) expect(refused.out).toContain(`"${line}" is not read`);
}, 300_000);

it("risk:security in CI, a lens that names only another repository's paths is not judged by gate done and no git process starts outside this clone (11-ac-6, Ruling R10)", async () => {
  const other = '---\npaths: ["tools:src/"]\non_finding: block\n---\n\n- Every tool call is logged.\n';
  const box = claimed({ lenses: { tools: other }, code: CODE, review: (h) => record(h) });
  const here = realpathSync.native(box.repo);
  const cwds: string[] = [];
  spawnLog.fail = (_args, options) => {
    cwds.push(options?.cwd === undefined ? '' : realpathSync.native(resolve(options.cwd)));
    return false;
  };
  try {
    for (const env of [{ CI: '1' }, {}]) {
      cwds.length = 0;
      const r = await counted(['gate', 'done', 'T-1', '--json'], box.repo, env);
      expect((JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === RULE), JSON.stringify(env)).toEqual([]);
      expect(r.argv.filter(lensRead).length, JSON.stringify(env)).toBeGreaterThanOrEqual(1);
      expect(cwds.filter((c) => c !== here), JSON.stringify(env)).toEqual([]);
    }
  } finally {
    spawnLog.fail = undefined;
  }
}, 300_000);
