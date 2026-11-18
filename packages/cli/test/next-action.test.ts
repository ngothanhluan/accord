// ST-LN-69 D-19: every `accord worktree` output line that worktree.md maps names its next action itself, from one table (NEXT_ACTIONS).
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { NEXT_ACTIONS, nextLine, withNext } from '../src/commands/next-action.js';
import type { LineKind } from '../src/commands/next-action.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { A, B, clone, copy, envOf, lines, pushMain, setTable, tableOf, teammate, ticketWorktree, twoOnMain, useSandboxes, verifyStage, writeHolds } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{}, { setup: ['node setup-step.js ci'] }, { tickets: ['ST-9', 'ST-10'] }, { setup: ['node setup-step.js ci', 'node setup-step.js fail'] }]);

// The kinds of output line (and exit-2 refusal) that worktree.md maps at acddb5f2, one name each:
// `pruned`, `fetch from origin failed`, `behind:` and its trust form, `merged:`/`rebased:`/`synced:`, both `push of` forms,
// `removed`/`deleted`/`kept`/`clean failed`/`clean skipped`/`clean stopped`, `note <id>:`, `stop:`, `enter:`, `held:`, `not held:`,
// and the exit-2 messages `not a ticket:`, `not claimed:`, `claimed:`, `this session works`, a setup command, a session that holds the ticket, `merge of`.
const MAPPED: LineKind[] = [
  'pruned',
  'fetch-failed',
  'behind',
  'trust',
  'synced',
  'push-after-sync',
  'push-failed',
  'removed',
  'deleted',
  'kept',
  'clean-failed',
  'clean-skipped',
  'clean-stopped',
  'note',
  'stop',
  'enter',
  'held',
  'not-held',
  'not-a-ticket',
  'not-claimed',
  'claimed',
  'session-works',
  'setup-failed',
  'held-by-other',
  'merge-of',
];

it('ac-12 every mapped worktree line kind has a next action (ST-LN-69 7-ac-12)', () => {
  for (const kind of MAPPED) {
    const action = NEXT_ACTIONS[kind];
    expect(typeof action, kind).toBe('string');
    expect(action.trim(), kind).not.toBe('');
    expect(action, kind).not.toContain('\n');
    expect(action, kind).not.toContain(' - next:');
  }
  expect(withNext('pruned', 'pruned /x: gone')).toBe(`pruned /x: gone - next: ${NEXT_ACTIONS.pruned}`);
  expect(nextLine('enter')).toBe(`next: ${NEXT_ACTIONS.enter}`);
});

// ---- the sweep over open, push, sync and session lines ----

// A kind of line of the sweep: its name and the pattern that marks it.
const SWEPT: Array<[string, RegExp]> = [
  ['pruned', /^pruned (?!refs\/)/],
  ['fetch from origin failed', /^fetch from origin failed, going on with/],
  ['behind', /^behind: /],
  ['merged rebased synced', /^(merged|rebased|synced): /],
  ['push of', /^push of /],
  ['note', /^note ST-\d+: /],
  ['held', /^(held|not held): /],
  ['not a ticket', /^not a ticket: /],
  ['not claimed', /^not claimed: /],
  ['claimed', /^claimed: /],
  ['this session works', /^this session works/],
  ['setup command', /^setup command failed/],
  ['held by another session', /^\S+ is held by another session/],
  ['merge of', /^(merge|rebase) of /],
  ['trust', /run accord trust in/],
  ['ticket push', /^the ticket is committed in /],
];

const seen = new Set<string>();

/** Every line of `texts` that a kind of the sweep marks ends with ` - next: ` and an action; an `enter:` or `stop:` line follows a `next: ` line. */
function sweep(label: string, ...texts: string[]): void {
  for (const text of texts) {
    const all = lines(text);
    all.forEach((l, i) => {
      if (l.startsWith('enter:') || l.startsWith('stop:')) {
        expect(all[i - 1] ?? '', `${label}: the line before ${l}`).toMatch(/^next: \S/);
        seen.add(l.startsWith('enter:') ? 'enter' : 'stop');
      }
      for (const [name, re] of SWEPT) {
        if (!re.test(l)) continue;
        expect(l, `${label}: ${name}`).toMatch(/ - next: \S/);
        seen.add(name);
      }
    });
  }
}

const go = async (label: string, argv: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<{ code: number; out: string; err: string }> => {
  const r = await run(argv, cwd, env);
  sweep(label, r.out, r.err);
  return r;
};

it('ac-12 open push and session lines name their next action (ST-LN-69 7-ac-12)', async () => {
  // pruned, fetch failure, stop and enter
  const p = copy({ setup: ['node setup-step.js ci'] });
  p.git('worktree', 'add', '-q', '-b', 't/ST-9', p.sibling('ST-9'), 'origin/main');
  rmSync(p.sibling('ST-9'), { recursive: true, force: true });
  expect((await go('pruned', ['worktree', 'open', 'ST-9', '--continue'], p.root)).code).toBe(0);
  const f = copy();
  f.git('remote', 'set-url', 'origin', f.remote + '-missing');
  expect((await go('fetch failed', ['worktree', 'open', 'ST-9'], f.root)).code).toBe(0);
  const e = copy({ setup: ['node setup-step.js ci'] });
  setTable(tableOf(A));
  expect((await go('enter', ['worktree', 'open', 'ST-9'], e.root, envOf(A))).code).toBe(0);

  // behind (uncommitted work stops the merge), then merged with a failed push
  const b = copy();
  ticketWorktree(b, 'ST-9');
  writeFiles(b.sibling('ST-9'), { 'ST-9.txt': 'changed\n' });
  twoOnMain(b);
  expect((await go('behind', ['worktree', 'open', 'ST-9', '--continue'], b.root)).code).toBe(0);
  const m = copy();
  ticketWorktree(m, 'ST-9');
  twoOnMain(m);
  m.git('remote', 'set-url', '--push', 'origin', m.remote + '-missing');
  expect((await go('merged', ['worktree', 'open', 'ST-9', '--continue'], m.root)).code).toBe(0);

  // a conflicting merge is a refusal that starts with merge of
  const x = copy();
  writeFiles(x.root, { 'shared.txt': 'base\n' });
  commitMsg(x.root, 'shared');
  x.git('push', '-q', 'origin', 'main');
  ticketWorktree(x, 'ST-9', 'shared.txt');
  pushMain(x, 'shared.txt', 'main\n');
  expect((await go('merge of', ['worktree', 'open', 'ST-9', '--continue'], x.root)).code).toBe(2);

  // rebased, and the refusal of a team sync script nobody allowed
  const r = copy();
  ticketWorktree(r, 'ST-9');
  const rs = r.sibling('ST-9');
  writeFiles(rs, { 'accord/config.yml': readFileSync(rs + '/accord/config.yml', 'utf8').replace(/\r\n/g, '\n') + 'git:\n  merge: rebase\n' });
  gitRun(rs, 'add', '-A');
  gitRun(rs, 'commit', '-q', '-m', 'config');
  verifyStage(rs, 'ST-9');
  gitRun(rs, 'push', '-q', 'origin', 't/ST-9');
  pushMain(r, 'next.txt', 'next\n');
  expect((await go('rebased', ['worktree', 'sync', 'ST-9'], rs)).code).toBe(0);
  const t = copy();
  ticketWorktree(t, 'ST-9');
  const ts = t.sibling('ST-9');
  writeFiles(ts, { 'accord/config.yml': readFileSync(ts + '/accord/config.yml', 'utf8').replace(/\r\n/g, '\n') + 'git:\n  sync: "node scripts/sync.mjs"\n', 'scripts/sync.mjs': 'process.exit(0);\n' });
  gitRun(ts, 'add', '-A');
  gitRun(ts, 'commit', '-q', '-m', 'config');
  verifyStage(ts, 'ST-9');
  gitRun(ts, 'push', '-q', 'origin', 't/ST-9');
  pushMain(t, 'next.txt', 'next\n');
  expect((await go('trust', ['worktree', 'sync', 'ST-9'], ts)).code).toBe(2);
  expect((await go('behind trust', ['worktree', 'open', 'ST-9', '--continue'], t.root)).code).toBe(0);

  // a failed push of accord worktree push
  const u = copy();
  ticketWorktree(u, 'ST-9');
  u.git('remote', 'set-url', '--push', 'origin', u.remote + '-missing');
  expect((await go('push', ['worktree', 'push', 'ST-9'], u.sibling('ST-9'))).code).toBe(0);

  // a record that cannot be written is a note
  const n = copy({ setup: ['node setup-step.js ci'] });
  mkdirSync(n.root + '/.git/accord/worktrees', { recursive: true });
  expect((await go('note', ['worktree', 'open', 'ST-9'], n.root)).code).toBe(0);

  // held and not held
  const h = copy();
  h.git('worktree', 'add', '-q', '-b', 't/ST-9', h.sibling('ST-9'), 'origin/main');
  h.git('remote', 'remove', 'origin');
  setTable(tableOf(A));
  expect((await go('held', ['worktree', 'open', 'ST-9', '--continue'], h.sibling('ST-9'), envOf(A))).code).toBe(0);
  expect((await go('not held', ['worktree', 'open', 'ST-9', '--continue'], h.sibling('ST-9'))).code).toBe(0);

  // the refusals: not a ticket, not claimed, claimed, this session works, held by another session, a failed setup command
  const q = copy();
  expect((await go('not a ticket', ['worktree', 'open', 'ST-99', '--continue'], q.root)).code).toBe(2);
  expect((await go('not claimed', ['worktree', 'open', 'ST-9', '--continue'], q.root)).code).toBe(2);
  const cl = copy();
  const o = teammate(cl);
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'main');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-9');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  expect((await go('claimed', ['worktree', 'open', 'ST-9'], cl.root)).code).toBe(2);
  const w = copy({ tickets: ['ST-9', 'ST-10'] });
  const ws = w.sibling('ST-9');
  w.git('worktree', 'add', '-q', '-b', 't/ST-9', ws, 'origin/main');
  setTable(tableOf(A));
  expect((await go('this session works', ['worktree', 'open', 'ST-10', '--continue'], ws, envOf(A))).code).toBe(2);
  const k = copy({ tickets: ['ST-9', 'ST-10'] });
  const ks = k.sibling('ST-9');
  k.git('worktree', 'add', '-q', '-b', 't/ST-9', ks, 'origin/main');
  k.git('remote', 'remove', 'origin');
  writeHolds(k, { 'ST-9': { tool: 'Claude Code', ...A, taken: '2026-10-27T03:03:00.000Z' } });
  setTable(tableOf(B, A));
  expect((await go('held by another session', ['worktree', 'open', 'ST-9', '--continue'], ks, envOf(B))).code).toBe(2);
  const s = copy({ setup: ['node setup-step.js ci', 'node setup-step.js fail'] });
  expect((await go('setup', ['worktree', 'open', 'ST-9'], s.root)).code).toBe(2);

  // new ticket --worktree whose push fails
  const v = clone({ setup: ['node setup-step.js ci'], tickets: [] });
  v.git('remote', 'set-url', '--push', 'origin', `${v.remote}-missing`);
  expect((await go('ticket push', ['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree', '--no-dup-check'], v.root)).code).toBe(2);

  // every kind of the sweep was produced by some run above
  for (const [name] of SWEPT) expect(seen.has(name), `no run produced a ${name} line`).toBe(true);
  expect(seen.has('enter')).toBe(true);
  expect(seen.has('stop')).toBe(true);
}, 600_000);
