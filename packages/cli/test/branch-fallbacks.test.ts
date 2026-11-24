// Issue #341 D-01, D-02: a local-only install (accord/config.yml git-excluded, so origin's default branch has none) still names a new claim by the checkout's
// `branch` and runs the checkout's `setup` in the new worktree; what origin's default branch holds still wins, and an invalid file there still refuses.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { gitRun, run } from './helpers/repo.js';
import { copy, has, pushMain, useSandboxes, type Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{ setup: ['node setup-step.js ci'] }, {}]);

/** Origin main loses accord/config.yml while this checkout keeps its file, untracked and git-excluded. */
function localOnly(c: Clone): void {
  c.git('rm', '-q', '--cached', 'accord/config.yml');
  appendFileSync(`${c.root}/.git/info/exclude`, 'accord/config.yml\n');
  c.git('commit', '-q', '-m', 'the config stays local');
  c.git('push', '-q', 'origin', 'main');
  expect(existsSync(`${c.root}/accord/config.yml`)).toBe(true);
}
const setLocal = (c: Clone, extra: string) => writeFileSync(`${c.root}/accord/config.yml`, readFileSync(`${c.root}/accord/config.yml`, 'utf8') + extra);

it("risk:regression a new claim is named by the checkout's branch when the default branch has no config (D-01)", async () => {
  const c = copy();
  localOnly(c);
  setLocal(c, 'branch: "feature/{id}"\n');
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/feature/ST-9')).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(false);
});

it("risk:regression the default branch's template still wins over the checkout's branch (D-01)", async () => {
  const c = copy();
  localOnly(c);
  setLocal(c, 'branch: "feature/{id}"\n');
  pushMain(c, 'accord/config.yml', CONFIG + 'branch: "team/{id}"\n');
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/team/ST-9')).toBe(true);
  expect(has(c.root, 'refs/heads/feature/ST-9')).toBe(false);
});

// WR-04, D-01a: a default branch whose accord/config.yml sets no `branch` means the team uses t/{id}; one person's unmerged `branch` must not rename only their claims.
it("risk:complex-branching a default-branch config without branch keeps t/{id}, whatever the checkout's branch says (D-01a)", async () => {
  const c = copy();
  setLocal(c, 'branch: "feature/{id}"\n');
  expect(gitRun(c.root, 'show', 'origin/main:accord/config.yml')).not.toContain('branch:');
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.root, 'refs/heads/feature/ST-9')).toBe(false);
});

it("risk:regression the checkout's setup runs in a new worktree that has no accord/config.yml, once (D-02)", async () => {
  const c = copy({ setup: ['node setup-step.js ci'] });
  localOnly(c);
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(existsSync(`${c.sibling('ST-9')}/accord/config.yml`)).toBe(false);
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
  const again = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(again.code, again.err).toBe(0);
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
});

it('risk:regression an invalid accord/config.yml in the new worktree still refuses and setup does not run (D-02)', async () => {
  const c = copy({ setup: ['node setup-step.js ci'] });
  pushMain(c, 'accord/config.yml', CONFIG + 'setup: npm ci\n');
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('accord/config.yml in the new worktree is invalid');
  expect(existsSync(`${c.sibling('ST-9')}/setup.log`)).toBe(false);
  expect(gitRun(c.sibling('ST-9'), 'rev-parse', '--is-inside-work-tree').trim()).toBe('true');
});
