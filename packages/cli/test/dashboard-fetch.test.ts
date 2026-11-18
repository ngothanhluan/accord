// ST-LN-16: `accord dashboard` makes one bounded fetch from origin before it reads, so a teammate's pushed claim and a draft queued on a backlog branch show without a manual fetch, and it stays usable offline. Real git in tmp sandboxes with a bare remote.
import { afterEach, expect, it, vi } from 'vitest';
import type { Dashboard } from '@accord-dev/accord-core';
import { laneTicket } from '../../../test/helpers/lane.js';
import * as limit from '../src/commands/fetch-limit.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { copy, has, useSandboxes } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), dashboardFetchLimitMs: vi.fn(real.dashboardFetchLimitMs) };
});

afterEach(() => {
  vi.mocked(limit.dashboardFetchLimitMs).mockReset();
});

useSandboxes([{}]);

const board = async (cwd: string): Promise<Dashboard> => JSON.parse((await run(['dashboard', '--json'], cwd)).out) as Dashboard;
const queued = (o: string, id: string, date = '2026-11-18'): string => {
  gitRun(o, 'fetch', '-q', 'origin');
  gitRun(o, 'switch', '-q', '-c', `backlog/${id.toLowerCase()}-${date}`, 'origin/main');
  writeFiles(o, { [`accord/tickets/${id}.md`]: laneTicket(id, { frontmatter: ['status: draft'] }) });
  const tip = commitMsg(o, `backlog: queue ${id}`);
  gitRun(o, 'push', '-q', 'origin', `HEAD:refs/heads/backlog/${id.toLowerCase()}-${date}`);
  gitRun(o, 'switch', '-q', 'main');
  return tip;
};

it('ac-12 the dashboard shows a teammate pushed claim without a manual fetch (ST-LN-16 7-ac-12)', async () => {
  const c = copy();
  // a teammate claims ST-9 after this clone last fetched
  const o = c.otherClone();
  gitRun(o, 'config', 'user.email', 'b@example.com');
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'origin/main');
  writeFiles(o, { 'ST-9.txt': 'ST-9\n' });
  commitMsg(o, 'claim: ST-9');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  expect(has(c.root, 'refs/remotes/origin/t/ST-9')).toBe(false);
  const d = await board(c.root);
  expect(d.team.rows.map((r) => [r.id, r.claimedBy])).toEqual([['ST-9', 'b@example.com']]);
  expect(has(c.root, 'refs/remotes/origin/t/ST-9')).toBe(true);
  const text = (await run(['dashboard'], c.root)).out;
  expect(text).toContain('ST-9');
  expect(text).not.toContain('fetch from origin');
}, 120_000);

it('ac-12 the dashboard shows a backlog draft and stays usable offline (ST-LN-16 7-ac-12)', async () => {
  const c = copy();
  const base = await board(c.root);
  expect(base.upNext.rows.map((r) => r.id)).toEqual(['ST-9']);
  // origin holds a draft queued on a backlog branch that main lacks
  const o = c.otherClone();
  queued(o, 'Q-9');
  const withDraft = await board(c.root);
  expect(withDraft.upNext.rows.map((r) => r.id).sort()).toEqual(['Q-9', 'ST-9']);
  expect(withDraft.summary.backlog).toBe(base.summary.backlog + 1);
  expect((await run(['dashboard'], c.root)).out).toContain('Q-9');
  // the branch is merged into main and this clone has pulled it: the ticket is listed once, from the working tree
  gitRun(o, 'merge', '-q', '--no-ff', '-m', 'merge Q-9', 'origin/backlog/q-9-2026-11-18');
  gitRun(o, 'push', '-q', 'origin', 'main');
  c.git('pull', '-q', '--ff-only');
  const merged = await board(c.root);
  expect(merged.upNext.rows.filter((r) => r.id === 'Q-9')).toHaveLength(1);
  expect(merged.summary.backlog).toBe(withDraft.summary.backlog);

  // origin unreachable: exit 0, one line before the sections, every local row still listed
  const down = copy();
  down.git('remote', 'set-url', 'origin', down.remote + '-missing');
  const text = await run(['dashboard'], down.root);
  expect(text.code).toBe(0);
  const first = text.out.split('\n').filter((l) => l !== '');
  expect(first[0].startsWith('fetch from origin failed')).toBe(true);
  expect(text.out.split('fetch from origin failed')).toHaveLength(2);
  expect(text.out).toContain('ST-9');
  const json = await run(['dashboard', '--json'], down.root);
  expect(json.code).toBe(0);
  const doc = JSON.parse(json.out) as Dashboard & { offline?: string };
  expect(typeof doc.offline).toBe('string');
  expect(doc.upNext.rows.map((r) => r.id)).toEqual(['ST-9']);

  // a fetch slower than the bound
  const slow = copy();
  vi.mocked(limit.dashboardFetchLimitMs).mockReturnValue(1);
  const late = await run(['dashboard'], slow.root);
  expect(late.code).toBe(0);
  expect(late.out.startsWith('fetch from origin failed')).toBe(true);
  expect(late.out).toContain('ST-9');
  const lateJson = JSON.parse((await run(['dashboard', '--json'], slow.root)).out) as Dashboard & { offline?: string };
  expect(lateJson.offline).toContain('no answer within');
  vi.mocked(limit.dashboardFetchLimitMs).mockReset();

  // no origin: nothing is fetched and nothing is said
  const alone = copy();
  alone.git('remote', 'remove', 'origin');
  const quiet = await run(['dashboard'], alone.root);
  expect(quiet.code).toBe(0);
  expect(quiet.out).not.toContain('fetch from origin');
  expect(quiet.out).toContain('ST-9');
  expect(Object.keys(JSON.parse((await run(['dashboard', '--json'], alone.root)).out) as object)).not.toContain('offline');
}, 240_000);
