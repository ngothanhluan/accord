// ST-LN-36 36-ac-2: `accord gate done` holds each recorded review round against the security triggers its own package had, on real git. The CLI here runs as the
// cut-off release (0.7.0), so a repository pinned to 0.7.0 can be claimed under 0.7.0 and under 0.6.0 (the older answer).
import { expect, it, vi } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { LANE_S_BODY, laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';

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
