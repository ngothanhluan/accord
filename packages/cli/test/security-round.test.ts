// ST-LN-36 36-ac-2: `accord round` holds each recorded review round against the security triggers its own package had, as `accord gate done` does, on real git. The CLI here runs as the
// cut-off release (0.7.0), so a repository pinned to 0.7.0 can be claimed under 0.7.0 and under 0.6.0 (the older answer).
import { expect, it, vi } from 'vitest';
import { parseSecurityFile } from '@accord-dev/accord-core';
import { counted } from './helpers/runs.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, writeFiles } from './helpers/repo.js';
import { LANE_S_BODY, laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.7.0' } };
});

const REVIEW = 'accord/tickets/T-1/review.md';
const RUN_BASE = 'export const one = 1;\nexport const two = 2;\nexport const three = 3;\n';
const RUN_NEW = "export const one = 1;\nexport const two = 2;\nspawnSync('git', ['status']);\nexport const three = 3;\n";
const record = (head: string, ...lines: string[]): string => `Round record: 2\n\n## Round 1 head ${head}\n\n${['No findings', ...lines].join('\n')}\n`;
const packageRead = (a: string[]): boolean => a.includes('-U10') || a.some((x) => x.includes('...'));

/** A ticket claimed under `claim` on its own branch: base, the claim commit, one code commit (`code`), then review.md headed by that code commit. */
function claimed(o: { lane?: 'M' | 'S'; claim?: string; base?: Record<string, string>; code: Record<string, string>; review: (head: string) => string }): { repo: string; head: string } {
  const lane = o.lane ?? 'M';
  const repo = makeEmptyRepo();
  writeFiles(repo, {
    'accord/config.yml': pinned(o.claim ?? '0.7.0'),
    'accord/tickets/T-1.md': lane === 'S' ? laneTicket('T-1', { lane: 'S', body: LANE_S_BODY }) : laneTicket('T-1'),
    'src/run.ts': RUN_BASE,
    'src/plain.ts': 'export const a = 0;\n',
    ...o.base,
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

it('risk:security accord round refuses a round whose package matched a pattern and records no security review, on real git (ST-LN-36 36-ac-2)', async () => {
  for (const lane of ['M', 'S'] as const) {
    const spawned = claimed({ lane, code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
    try {
      const refused = await counted(['round', 'T-1'], spawned.repo);
      expect(refused.code).toBe(1);
      expect(refused.out).toContain('refused:');
      expect(refused.out).toContain('src/run.ts');
      expect(refused.out).toContain('round 1');
      expect(refused.argv.filter(packageRead).length).toBeGreaterThanOrEqual(1);
      // the round records the lens, and the refusal is gone
      writeFiles(spawned.repo, { [REVIEW]: record(spawned.head, 'Security: lens security ran') });
      commitMsg(spawned.repo, 'security review');
      const next = await counted(['round', 'T-1'], spawned.repo);
      expect(next.code).toBe(0);
      expect(next.out).toContain('Round: 2');
    } finally {
      cleanup(spawned.repo);
    }
  }

  // a round whose package matched nothing needs the trace line (orchestrator Ruling, 2026-11-17)
  const plain = claimed({ code: { 'src/plain.ts': 'export const a = 1;\n' }, review: (h) => record(h) });
  try {
    const refused = await counted(['round', 'T-1'], plain.repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain('records no Security: line');
    expect(refused.out).not.toContain('spawn');
    writeFiles(plain.repo, { [REVIEW]: record(plain.head, 'Security: no pattern matched') });
    commitMsg(plain.repo, 'security trace');
    const next = await counted(['round', 'T-1'], plain.repo);
    expect(next.code).toBe(0);
    expect(next.out).toContain('Round: 2');
  } finally {
    cleanup(plain.repo);
  }
}, 240_000);

it('risk:security accord round keeps the older answer for a ticket claimed at 0.6.0, reading the cut-off through claimPinBefore (ST-LN-36 36-ac-2)', async () => {
  for (const lane of ['M', 'S'] as const) {
    const old = claimed({ lane, claim: '0.6.0', code: { 'src/run.ts': RUN_NEW }, review: (h) => record(h) });
    try {
      const r = await counted(['round', 'T-1'], old.repo);
      expect(r.out).not.toContain('refused:');
      expect(r.out).toContain('Round: 2');
      expect(r.code).toBe(0);
      expect(r.argv.filter(packageRead)).toEqual([]);
    } finally {
      cleanup(old.repo);
    }
  }
}, 240_000);

// 8-ac-3 (D-09): a hostile line of 40 `a` then `!` and a line of 100,000 characters end `accord round` promptly. The two team patterns below back-track on such a line, so the read
// refuses both and the round reports them as not in force; the line over 1000 characters is cut and says so.
const SECURITY_FILE = 'accord/product/security.md';
const SLOW_FILE = ['# Security review', '', '## Patterns', '', '- slow: line /(a+)+$/ — x', '- overlap: line /(a|a)*$/ — y', ''].join('\n');
const HOSTILE = `${'a'.repeat(40)}!\n${'a'.repeat(100_000)}!\n`;

it('risk:resource accord round ends promptly on 40 a then ! and on a 100,000-character line (8-ac-3)', async () => {
  // the read refuses both patterns first, so a guard regression fails here before any slow scan can run
  expect(parseSecurityFile(SLOW_FILE).problems.map((p) => p.line)).toEqual([5, 6]);
  const spawned = claimed({ base: { [SECURITY_FILE]: SLOW_FILE }, code: { 'src/hostile.ts': HOSTILE }, review: (h) => record(h, 'Security: no pattern matched') });
  try {
    const started = performance.now();
    const refused = await counted(['round', 'T-1'], spawned.repo);
    expect(performance.now() - started).toBeLessThan(120_000);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain(`${SECURITY_FILE}:5: `);
    expect(refused.out).toContain('"slow"');
    expect(refused.out).toContain(`${SECURITY_FILE}:6: `);
    expect(refused.out).toContain('"overlap"');
  } finally {
    cleanup(spawned.repo);
  }
}, 240_000);
