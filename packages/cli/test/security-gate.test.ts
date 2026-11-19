// ST-LN-36 36-ac-2: `accord gate done` holds each recorded review round against the security triggers its own package had, on real git. The CLI here runs as the
// cut-off release (0.7.0), so a repository pinned to 0.7.0 can be claimed under 0.7.0 and under 0.6.0 (the older answer).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { loadSnapshot } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { withClaimPins } from '../src/load/claim-facts.js';
import { loadFromFs } from '../src/load/fs.js';
import { withSecurityFacts } from '../src/load/security-facts.js';
import { countedSync } from './helpers/git-spawns.js';
import { counted } from './helpers/runs.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { LANE_S_BODY, laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.7.0' } };
});

const REVIEW = 'accord/tickets/T-1/review.md';
const RULE = 'gate.security-unreviewed';
const RUN_BASE = 'export const one = 1;\nexport const two = 2;\nexport const three = 3;\n';
const RUN_NEW = "export const one = 1;\nexport const two = 2;\nspawnSync('git', ['status']);\nexport const three = 3;\n";
const record = (head: string, ...lines: string[]): string => `Round record: 2\n\n## Round 1 head ${head}\n\n${['No findings', ...lines].join('\n')}\n`;

interface Found { rule: string; level: string; file?: string; line?: number; reason: string }
async function security(repo: string): Promise<Found[]> {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === RULE);
}

/** A ticket claimed under `claim` on its own branch: base, the claim commit, one code commit (`code`), then review.md headed by that code commit. */
function claimed(o: { lane?: 'M' | 'S'; claim?: string; code: Record<string, string>; review: (head: string) => string }): { repo: string; head: string } {
  const lane = o.lane ?? 'M';
  const repo = makeEmptyRepo();
  writeFiles(repo, {
    'accord/config.yml': pinned(o.claim ?? '0.7.0'),
    'accord/tickets/T-1.md': lane === 'S' ? laneTicket('T-1', { lane: 'S', body: LANE_S_BODY }) : laneTicket('T-1'),
    'src/run.ts': RUN_BASE,
    'src/plain.ts': 'export const a = 0;\n',
  });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/config.yml': pinned('0.7.0'), ...(lane === 'M' ? { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) } : {}), ...o.code });
  const head = commitMsg(repo, 'code');
  writeFiles(repo, { [REVIEW]: o.review(head) });
  commitMsg(repo, 'round 1');
  return { repo, head };
}

it('ac-2 gate done refuses a lane M round whose package matched a pattern and records no security review, on real git (ST-LN-36 36-ac-2)', async () => {
  const spawned = claimed({ code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    const refused = await security(spawned.repo);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ level: 'error', file: REVIEW });
    expect(refused[0].reason).toContain('round 1');
    expect(refused[0].reason).toContain('src/run.ts:3: spawn');
    // the round records the lens, and the refusal is gone
    writeFiles(spawned.repo, { [REVIEW]: record(spawned.head, 'Security: lens security ran') });
    commitMsg(spawned.repo, 'security review');
    expect(await security(spawned.repo)).toEqual([]);
  } finally {
    cleanup(spawned.repo);
  }

  // a round whose package matched nothing needs the trace line
  const plain = claimed({ code: { 'src/plain.ts': 'export const a = 1;\n' }, review: (h) => record(h) });
  try {
    const refused = await security(plain.repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toContain('records no Security: line');
    expect(refused[0].reason).toContain('Security: no pattern matched');
    expect(refused[0].reason).not.toContain('spawn');
    writeFiles(plain.repo, { [REVIEW]: record(plain.head, 'Security: no pattern matched') });
    commitMsg(plain.repo, 'security trace');
    expect(await security(plain.repo)).toEqual([]);
  } finally {
    cleanup(plain.repo);
  }
}, 180_000);

it('ac-2 gate done refuses an unreviewed security trigger in lane S and keeps the older answer for a ticket claimed at 0.6.0, on real git (ST-LN-36 36-ac-2)', async () => {
  const s = claimed({ lane: 'S', code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    const refused = await security(s.repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toContain('src/run.ts:3: spawn');
    // two runs on the same commit print the same bytes
    const first = await run(['gate', 'done', 'T-1', '--json'], s.repo);
    const second = await run(['gate', 'done', 'T-1', '--json'], s.repo);
    expect(second.out).toBe(first.out);
    expect(first.out).toContain(RULE);
  } finally {
    cleanup(s.repo);
  }

  const old = claimed({ claim: '0.6.0', code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    expect(await security(old.repo)).toEqual([]);
  } finally {
    cleanup(old.repo);
  }
}, 180_000);

it('ac-2 gate done asks the re-review round after a final review whose fix matched a pattern, and never the final review, on real git (ST-LN-36 36-ac-2)', async () => {
  const final = '## Round 2 head %1 (final review)\n\nMust 1 [patch]: the runner takes a shell — src/run.ts:3 — open\n\n';
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': pinned('0.7.0'),
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'src/run.ts': RUN_BASE,
    });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    commitMsg(repo, 'claim: T-1', undefined, true);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), 'src/run.ts': RUN_NEW });
    const c1 = commitMsg(repo, 'code');
    writeFiles(repo, { 'src/fix.ts': "spawnSync('git', ['status']);\n" });
    const c2 = commitMsg(repo, 'fix');
    const text = (third: string): string =>
      `Round record: 2\n\n## Round 1 head ${c1}\n\nNo findings\nSecurity: lens security ran\n\n${final.replace('%1', c1)}## Round 3 head ${c2}\n\nNo findings\n${third}\n`;
    writeFiles(repo, { [REVIEW]: text('Security: no pattern matched') });
    commitMsg(repo, 'rounds');
    const refused = await security(repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toContain('round 3 of cycle 1');
    expect(refused[0].reason).toContain('src/fix.ts');
    expect(refused.some((f) => f.reason.includes('round 2'))).toBe(false);
    writeFiles(repo, { [REVIEW]: text('Security: lens security ran') });
    commitMsg(repo, 'security review');
    expect(await security(repo)).toEqual([]);
  } finally {
    cleanup(repo);
  }
}, 180_000);

const packageRead = (a: string[]): boolean => a.includes('-U10') || a.some((x) => x.includes('...'));

it('risk:complex-branching gate done starts no security-fact git read for a ticket claimed before 0.7.0 and reads them when the rule applies, a failed claim read included (ST-LN-36 36-ac-2)', async () => {
  const old = claimed({ claim: '0.6.0', code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    const before = await counted(['gate', 'done', 'T-1', '--json'], old.repo);
    expect(before.argv.filter(packageRead)).toEqual([]);
    expect((JSON.parse(before.out).findings as Found[]).filter((f) => f.rule === RULE)).toEqual([]);

    // in process: the loader returns the snapshot itself and starts no git process for a claim before the cut-off
    const s: RepoSnapshot = withClaimPins(old.repo, loadSnapshot(loadFromFs(old.repo)), 'T-1');
    const none = countedSync(() => withSecurityFacts(old.repo, s, 'T-1'));
    expect(none.value).toBe(s);
    expect(none.value.securityFacts).toBeUndefined();
    expect(none.argv).toEqual([]);

    // a failed claim read is false in claimPinBefore, so the facts are read and the rule applies
    const failedClaim: RepoSnapshot = { ...s, claimPins: { 'T-1': { error: 'git failed' } } };
    const read = countedSync(() => withSecurityFacts(old.repo, failedClaim, 'T-1'));
    expect(read.value.securityFacts?.['T-1']).toBeDefined();
    expect(read.argv.filter(packageRead).length).toBeGreaterThanOrEqual(1);
  } finally {
    cleanup(old.repo);
  }

  const fresh = claimed({ code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
  try {
    const run1 = await counted(['gate', 'done', 'T-1', '--json'], fresh.repo);
    expect(run1.argv.filter(packageRead).length).toBeGreaterThanOrEqual(1);
    expect((JSON.parse(run1.out).findings as Found[]).filter((f) => f.rule === RULE)).toHaveLength(1);
  } finally {
    cleanup(fresh.repo);
  }
}, 180_000);

it('ac-1 gate done scans a hand-edited accord panel copy on real git (BUG-LN-25)', async () => {
  const REGISTER = '.claude/accord-panel/plugin/hooks/register.js';
  const added = "spawnSync('git', ['status']);";
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': pinned('0.7.0'), 'accord/tickets/T-1.md': laneTicket('T-1'), 'src/plain.ts': 'export const a = 0;\n' });
    const synced = await run(['skills', 'sync'], repo);
    expect(synced.code).toBe(0);
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    commitMsg(repo, 'claim: T-1', undefined, true);
    const copy = readFileSync(join(repo, REGISTER), 'utf8');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), [REGISTER]: `${copy.replace(/\n$/, '')}\n${added}\n` });
    const head = commitMsg(repo, 'code');
    const line = readFileSync(join(repo, REGISTER), 'utf8').split('\n').indexOf(added) + 1;
    writeFiles(repo, { [REVIEW]: record(head) });
    commitMsg(repo, 'round 1');
    const refused = await security(repo);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toContain(`${REGISTER}:${line}: spawn`);
  } finally {
    cleanup(repo);
  }
}, 180_000);
