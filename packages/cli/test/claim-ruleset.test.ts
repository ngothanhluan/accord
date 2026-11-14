// ST-LN-96 t1-ac-1: the claim writes `ruleset: "<pin>"` into the ticket in the claim commit, and a ticket squash-merged or rebased onto main keeps
// the rules that field names. Real git in tmp sandboxes with a bare remote. The running version is mocked and every history pins its own version
// explicitly (`pinned(v)`), so the test does not move when a release moves CONFIG's pin.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { RULESET_FROM } from '@accord-dev/accord-core';
import { laneTicket, pinned } from '../../../test/helpers/lane.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { copy, type Clone, rebaseOnRemote, useSandboxes } from './helpers/worktree.js';

const running = vi.hoisted(() => ({ v: '0.5.0' }));
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  const mocked = { ...m.default };
  Object.defineProperty(mocked, 'version', { get: () => running.v, enumerable: true });
  return { default: mocked };
});
vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{}, { tickets: [] }]);

const CONFIG_REL = 'accord/config.yml';

/** Pin the sandbox's main to `v` (config and the running version both), in the clone and on the remote. */
function pinTo(c: Clone, v: string): void {
  running.v = v;
  writeFiles(c.root, { [CONFIG_REL]: pinned(v) });
  commitMsg(c.root, 'pin ' + v);
  c.git('push', '-q', 'origin', 'main');
}

/** The one-line change a commit made to a ticket, as `git diff --numstat` rows. */
const stat = (c: Clone, branch: string): string => c.git('diff', '--numstat', branch + '^', branch).trim();

it('risk:data-loss the claim commit writes ruleset and is never empty from RULESET_FROM (ST-LN-96 t1-ac-1)', async () => {
  expect(RULESET_FROM).toBe('0.5.0');
  const c = copy();
  pinTo(c, RULESET_FROM);
  const { code, err } = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(err).toBe('');
  expect(code).toBe(0);
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect(stat(c, 't/ST-9')).toBe('1\t0\taccord/tickets/ST-9.md');
  const added = c.git('diff', '-U0', 't/ST-9^', 't/ST-9', '--', 'accord/tickets/ST-9.md').split('\n').filter((l) => /^[+-][^+-]/.test(l));
  expect(added).toEqual(['+ruleset: "0.5.0"']);
  expect(readFileSync(`${c.sibling('ST-9')}/accord/tickets/ST-9.md`, 'utf8')).toContain('\nruleset: "0.5.0"\n');
});

it('risk:data-loss a pick-up claim below RULESET_FROM stays empty and the ticket has no ruleset (ST-LN-96 t1-ac-1)', async () => {
  const c = copy();
  pinTo(c, '0.4.1');
  const { code, err } = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(err).toBe('');
  expect(code).toBe(0);
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect(stat(c, 't/ST-9')).toBe('');
  expect(c.git('show', 't/ST-9:accord/tickets/ST-9.md')).not.toContain('ruleset');
});

it('risk:data-loss a ticket whose file already holds the pin keeps an empty claim commit (ST-LN-96 t1-ac-1)', async () => {
  const c = copy({ tickets: [] });
  writeFiles(c.root, { 'accord/tickets/ST-9.md': laneTicket('ST-9', { frontmatter: ['ruleset: "0.5.0"'] }) });
  commitMsg(c.root, 'add ST-9');
  c.git('push', '-q', 'origin', 'main');
  pinTo(c, RULESET_FROM);
  const { code, err } = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(err).toBe('');
  expect(code).toBe(0);
  expect(stat(c, 't/ST-9')).toBe('');
});

it('risk:data-loss new ticket --worktree commits the ticket with its ruleset from RULESET_FROM, and without it below (ST-LN-96 t1-ac-1)', async () => {
  const c = copy({ tickets: [] });
  pinTo(c, RULESET_FROM);
  const made = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root);
  expect(made.err).toBe('');
  expect(made.code).toBe(0);
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect(c.git('show', 't/ST-9:accord/tickets/ST-9.md')).toContain('\nruleset: "0.5.0"\n');

  const old = copy({ tickets: [] });
  pinTo(old, '0.4.1');
  const plain = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], old.root);
  expect(plain.err).toBe('');
  expect(plain.code).toBe(0);
  expect(old.git('show', 't/ST-9:accord/tickets/ST-9.md')).not.toContain('ruleset');
});

/**
 * A lane M ticket T-1 claimed under 0.4.0 on t/T-1 (field `ruleset` as given), then main upgraded to RULESET_FROM, then the ticket merged into main
 * the way `how` says from a teammate's clone; `c` ends on main at that merge, whose HEAD pin differs from the ticket's ruleset. The running version is
 * RULESET_FROM, so HEAD's pin is the one the pin check holds equal to it.
 */
function merged(how: 'squash' | 'rebase', ruleset: string | undefined): Clone {
  const c = copy({ tickets: [] });
  const o = c.otherClone();
  writeFiles(o, { [CONFIG_REL]: pinned('0.4.0') });
  commitMsg(o, 'pin 0.4.0');
  gitRun(o, 'push', '-q', 'origin', 'main');
  gitRun(o, 'switch', '-q', '-c', 't/T-1');
  writeFiles(o, { 'accord/tickets/T-1.md': laneTicket('T-1', ruleset === undefined ? {} : { frontmatter: [`ruleset: "${ruleset}"`] }) });
  commitMsg(o, 'claim: T-1');
  gitRun(o, 'push', '-q', 'origin', 't/T-1');
  gitRun(o, 'switch', '-q', 'main');
  writeFiles(o, { [CONFIG_REL]: pinned(RULESET_FROM) }); // main moved on: the upgrade
  commitMsg(o, 'upgrade: accord ' + RULESET_FROM);
  gitRun(o, 'push', '-q', 'origin', 'main');
  if (how === 'squash') {
    gitRun(o, 'merge', '--squash', '-q', 'origin/t/T-1');
    commitMsg(o, 'merge T-1');
    gitRun(o, 'push', '-q', 'origin', 'main');
  } else rebaseOnRemote(c, 'T-1');
  running.v = RULESET_FROM;
  c.git('pull', '-q', '--ff-only', 'origin', 'main');
  return c;
}
const discussMissing = async (c: Clone): Promise<number> => {
  const r = await run(['gate', 'ready', 'T-1', '--json'], c.root);
  return (JSON.parse(r.out).findings as { rule: string }[]).filter((f) => f.rule === 'gate.discuss-missing').length;
};

it('risk:complex-branching a squash-merged and a rebased ticket keep the rules their ruleset names (ST-LN-96 t1-ac-1)', async () => {
  for (const how of ['squash', 'rebase'] as const) {
    const withField = merged(how, '0.4.0');
    // no `claim:` commit reachable from a squash-merged main, and a rebased claim commit sits on a main pinned at the running version: HEAD's pin is not the ruleset
    expect(withField.git('show', 'HEAD:accord/config.yml')).toContain(`accord: "${RULESET_FROM}"`);
    expect(await discussMissing(withField), how + ' with ruleset 0.4.0').toBe(0);

    const without = merged(how, undefined);
    expect(await discussMissing(without), how + ' without ruleset').toBe(1);
  }
}, 120_000);
