// Phase 11 plan 06 (11-ac-6, D-05): `accord round` holds each recorded review round against the team lenses its own package printed, recomputed from git and the lens files at the default branch, on
// real git. The CLI here runs as the cut-off release (0.23.0), so a ticket claimed under it is judged.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

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
function claimed(o: { lenses?: Record<string, string>; code: Record<string, string>; review: (head: string) => string }): { repo: string; base: string; head: string } {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, {
    'accord/config.yml': pinned('0.23.0'),
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'src/run.ts': 'export const one = 1;\n',
    ...Object.fromEntries(Object.entries(o.lenses ?? {}).map(([name, text]) => [`accord/lenses/${name}.md`, text])),
  });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), ...o.code });
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
