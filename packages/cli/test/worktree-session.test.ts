// ST-LN-27, BUG-LN-14: Claude Code session holds, the session hooks and /clear, against real git in tmp sandboxes with a bare remote.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import * as proc from '../src/load/proc.js';
import { cleanup, commitMsg, gitRun, run } from './helpers/repo.js';
import { A, A2, B, C, C3, clearOf, clone, copy, DEAD, doneOnRemote, envOf, HELD, heldBy, holdsFile, lines, LIVE, mergeOnRemote, PIN, pinnedWorktree, readHolds, setTable, stopLines, T, tableOf, ticketWorktree, useSandboxes, verifyStage, WORKS, writeHolds } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([
  {},
  { setup: ['node setup-step.js ci'] },
  { tickets: ['ST-9', 'ST-10'] },
  { tickets: ['ST-10'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11'] },
  { setup: ['node setup-step.js fail'], tickets: ['ST-9', 'ST-10'] },
]);

it('ac-4 a live holder refuses a second session and a dead holder is taken over', async () => {
  const c = copy();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin'); // H7: no fetch in this scenario; the pick-up exit 0 is made by the ac-1 pick-up test
  const sib = c.sibling('ST-9');
  setTable(tableOf(A));
  const r1 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  expect(r1.code).toBe(0);
  expect(r1.out).toBe(HELD);
  const bytes = readFileSync(holdsFile(c), 'utf8');
  const taken = JSON.parse(bytes)['ST-9'].taken as string;
  expect(JSON.parse(bytes)['ST-9']).toMatchObject({ tool: 'Claude Code', marker: 'sess-A' });
  setTable(tableOf(B, A));
  const r2 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B));
  expect(r2.code).toBe(2);
  expect(r2.err).toContain('Claude Code');
  expect(r2.err).toContain('sess-A');
  expect(r2.err).toContain(`in ${sib}, since `);
  expect(r2.err).toMatch(/since \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC[+-]\d{2}:\d{2}\) - /);
  expect(r2.err).not.toContain(taken);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  setTable(tableOf(B));
  const r3 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B));
  expect(r3.code).toBe(0);
  expect(r3.out).toBe(HELD);
  expect(JSON.parse(readFileSync(holdsFile(c), 'utf8'))['ST-9'].marker).toBe('sess-B');
});

it('risk:complex-branching the holding session re-enters its own hold and a partial table refuses', async () => {
  const c = copy();
  const sib = await heldBy(c);
  const first = readFileSync(holdsFile(c), 'utf8');
  const taken = JSON.parse(first)['ST-9'].taken as string;
  const again = async (s: { marker: string; pid: number }, rows: ReturnType<typeof tableOf>) => {
    writeFileSync(holdsFile(c), first); // each case is judged against A's hold alone
    setTable(rows);
    const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(s));
    expect(r.code).toBe(0);
    expect(r.out).toBe(HELD);
    expect(JSON.parse(readFileSync(holdsFile(c), 'utf8'))['ST-9'].taken).toBe(taken);
  };
  await again(A, tableOf(A));
  await again({ ...A, marker: 'sess-A2' }, tableOf(A));
});

it('risk:complex-branching a session with the holding marker under another pid re-enters the hold', async () => {
  const c = copy();
  const sib = await heldBy(c);
  const first = readFileSync(holdsFile(c), 'utf8');
  const taken = JSON.parse(first)['ST-9'].taken as string;
  const again = async (s: { marker: string; pid: number }, rows: ReturnType<typeof tableOf>) => {
    writeFileSync(holdsFile(c), first); // each case is judged against A's hold alone
    setTable(rows);
    const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(s));
    expect(r.code).toBe(0);
    expect(r.out).toBe(HELD);
    expect(JSON.parse(readFileSync(holdsFile(c), 'utf8'))['ST-9'].taken).toBe(taken);
  };
  const C = { pid: 7003, start: 'S-C', marker: 'sess-A' };
  await again(C, tableOf(C, A));
});

it('risk:complex-branching a session that cannot see itself in the process table is refused and the hold is unchanged', async () => {
  const c = copy();
  const sib = await heldBy(c);
  // B takes over once A has stopped; a session that cannot see itself must then not judge
  setTable(tableOf(B));
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B))).code).toBe(0);
  const bytes = readFileSync(holdsFile(c), 'utf8');
  setTable([{ pid: process.pid, ppid: 1, start: 'self' }]);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  expect(r.code).toBe(2);
  expect(r.err).toContain('cannot see this Claude Code session');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
});

it('risk:complex-branching outside claude code no hold is taken and one line says so', async () => {
  const c = copy();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin');
  vi.mocked(proc.processTable).mockClear();
  const sib = c.sibling('ST-9');
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, {});
  expect(r.code).toBe(0);
  expect(r.out).toBe('not held: ST-9 - a second session in this worktree is not refused in this tool yet\n');
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
  const r2 = await run(['worktree', 'open', 'ST-9', '--continue'], sib, { CLAUDECODE: '1' });
  expect(r2.code).toBe(2);
  expect(r2.err).toContain('CLAUDE_CODE_SESSION_ID');
  expect(existsSync(holdsFile(c))).toBe(false);
});

it('risk:concurrency a locked hold file is never overwritten', async () => {
  const c = copy();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin');
  const sib = c.sibling('ST-9');
  const lock = `${holdsFile(c)}.lock`;
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(lock, '');
  setTable(tableOf(A));
  const t0 = Date.now();
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  // 2 s lock wait plus the fetch Continue now runs first; a hang never returns, so 15 s still proves it
  expect(Date.now() - t0).toBeLessThan(15000);
  expect(r.code).toBe(2);
  expect(r.err).toContain('holds.lock');
  expect(existsSync(holdsFile(c))).toBe(false);
  rmSync(lock);
  expect((await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A))).code).toBe(0);
});

it('ac-1 in claude code pick up from the main checkout takes the hold and prints enter instead of stop', async () => {
  const c = copy({ setup: ['node setup-step.js ci'] });
  setTable(tableOf(A));
  const { code, out } = await run(['worktree', 'open', 'ST-9'], c.root, envOf(A));
  expect(code).toBe(0);
  expect(lines(out)).toEqual([`enter: ${c.sibling('ST-9')}`]);
  expect(out).not.toContain('stop:');
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect(c.git('rev-parse', 't/ST-9^').trim()).toBe(c.git('rev-parse', 'origin/main').trim());
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
  expect(readHolds(c)['ST-9']).toMatchObject({ tool: 'Claude Code', marker: 'sess-A', pid: 7001, start: 'S-A' });
  expect(c.git('branch', '--show-current').trim()).toBe('main');
  const moved = await run(['anchor'], c.sibling('ST-9'));
  expect(moved.out.startsWith('# Anchor: ST-9')).toBe(true);
  expect(moved.out).toBe((await run(['anchor', 'ST-9'], c.root)).out);
});

it('ac-2 in claude code continue from the main checkout enters a claimed worktree whose session ended with or without a worktree here', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main'); // H3: the pick-up result was never asserted
  writeHolds(c, { 'ST-9': DEAD });
  setTable(tableOf(A));
  const a = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(a.code).toBe(0);
  expect(lines(a.out)).toEqual([`enter: ${c.sibling('ST-9')}`]);
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
  expect((await run(['anchor'], c.sibling('ST-9'))).out).toBe((await run(['anchor', 'ST-9'], c.root)).out);

  const o = c.otherClone();
  gitRun(o, 'config', 'user.email', 'y@example.invalid');
  gitRun(o, 'switch', '-q', '-c', 't/ST-10', 'main');
  gitRun(o, 'commit', '--allow-empty', '-q', '-m', 'claim: ST-10');
  gitRun(o, 'push', '-q', 'origin', 't/ST-10');
  c.git('fetch', '-q', 'origin');
  setTable(tableOf(C));
  const b = await run(['worktree', 'open', 'ST-10', '--continue'], c.root, envOf(C));
  expect(b.code).toBe(0);
  expect(lines(b.out)).toEqual([`enter: ${c.sibling('ST-10')}`]);
  expect(gitRun(c.sibling('ST-10'), 'rev-parse', 'HEAD').trim()).toBe(c.git('rev-parse', 'origin/t/ST-10').trim());
  expect((readHolds(c)['ST-10'] as { marker: string }).marker).toBe('sess-C');
});

it('risk:complex-branching in claude code a worktree pinned to another accord version refuses before setup and prints no enter', async () => {
  const c = copy();
  pinnedWorktree(c);
  const a = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(a.code).toBe(2);
  expect(a.err).toContain('pins accord 0.0.9');
  expect(a.err).toContain('merge origin/main into t/ST-9');
  expect(a.out).not.toContain('enter:');
  expect(existsSync(holdsFile(c))).toBe(false);
}, 120_000);

it('risk:complex-branching outside claude code a worktree pinned to another accord version still prints the stop lines', async () => {
  const c = copy();
  pinnedWorktree(c);
  const plain = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(plain.code).toBe(0);
  expect(lines(plain.out)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
}, 120_000);

it('risk:complex-branching in claude code a pick up whose origin main pins another version refuses and names the main checkout', async () => {
  const d = copy({ setup: ['node setup-step.js ci'] });
  const o = d.otherClone();
  gitRun(o, 'config', 'user.email', 'y@example.invalid');
  writeFileSync(`${o}/accord/config.yml`, readFileSync(`${o}/accord/config.yml`, 'utf8').replace(`accord: "${PIN}"`, 'accord: "0.0.9"'));
  gitRun(o, 'commit', '-q', '-am', 'pin');
  gitRun(o, 'push', '-q', 'origin', 'main');
  d.git('fetch', '-q', 'origin');
  setTable(tableOf(A));
  const b = await run(['worktree', 'open', 'ST-9'], d.root, envOf(A));
  expect(b.code).toBe(2);
  expect(b.err).toContain('pins accord 0.0.9');
  expect(b.err).toContain('update the main checkout');
  expect(b.err).not.toContain('merge');
  expect(b.out).not.toContain('enter:');
  expect(existsSync(`${d.sibling('ST-9')}/setup.log`)).toBe(false);
  expect((readHolds(d)['ST-9'] as { marker: string }).marker).toBe('sess-A');
}, 120_000);

it('risk:concurrency in claude code continue from the main checkout refuses a ticket another live session holds and prints no enter', async () => {
  const c = clone();
  await run(['worktree', 'open', 'ST-9'], c.root);
  writeHolds(c, { 'ST-9': LIVE });
  setTable(tableOf(A, { pid: 4242, start: 'S2' }));
  const before = readFileSync(holdsFile(c), 'utf8');
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(r.code).toBe(2);
  expect(r.err).toContain('sess-H');
  expect(r.out).not.toContain('enter:');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(before);
});

it('ac-3 in claude code a new lane m ticket is committed pushed and held and prints enter instead of stop', async () => {
  const c = clone({ setup: ['node setup-step.js ci'], tickets: [] });
  setTable(tableOf(A));
  const { code, out } = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root, envOf(A));
  expect(code).toBe(0);
  expect(lines(out)).toEqual(['accord/tickets/ST-9.md', `enter: ${c.sibling('ST-9')}`]);
  expect(out).not.toContain('stop:');
  expect(c.git('ls-remote', 'origin', 'refs/heads/t/ST-9').split('\t')[0]).toBe(gitRun(c.sibling('ST-9'), 'rev-parse', 'HEAD').trim());
  expect(gitRun(c.sibling('ST-9'), 'log', '-1', '--format=%s').trim()).toBe('claim: ST-9');
  expect(readFileSync(`${c.sibling('ST-9')}/setup.log`, 'utf8')).toBe('ci\n');
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
  expect(existsSync(`${c.root}/accord/tickets/ST-9.md`)).toBe(false);
  const a = await run(['anchor'], c.sibling('ST-9'));
  expect(a.code).toBe(0);
  expect(a.out.startsWith('# Anchor: ST-9')).toBe(true);
  expect(a.out).toContain('Stage: intent');
});

it('risk:data-loss in claude code a new ticket whose hold cannot be taken is still pushed and exits 2', async () => {
  const c = clone({ tickets: [] });
  setTable(tableOf(A));
  const { code, err } = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root, { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'sess-X', CLAUDE_PID: '1' });
  expect(code).toBe(2);
  expect(err).toContain('CLAUDE_PID 1');
  expect(c.git('ls-remote', 'origin', 'refs/heads/t/ST-9')).toContain('refs/heads/t/ST-9');
});

it('ac-4 in claude code a session that works a ticket refuses other tickets and new tickets and changes nothing', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  verifyStage(sib, 'ST-9');
  gitRun(sib, 'push', '-q', '-u', 'origin', 't/ST-9');
  mergeOnRemote(c, 'ST-9');
  c.git('fetch', '-q', 'origin');
  mkdirSync(`${sib}/sub`);
  const state = () =>
    [c.root, sib]
      .flatMap((d) => [
        gitRun(d, 'worktree', 'list', '--porcelain'),
        gitRun(d, 'for-each-ref', '--format=%(refname) %(objectname)'),
        gitRun(d, 'log', '--all', '--format=%H %s'),
        gitRun(d, 'status', '--porcelain', '--untracked-files=all'),
        readdirSync(`${d}/accord/tickets`).sort().join(','),
      ])
      .concat(readFileSync(holdsFile(c), 'utf8'));
  const before = state();
  const argvs = [
    ['worktree', 'open', 'ST-10'],
    ['worktree', 'open', 'ST-10', '--continue'],
    ['worktree', 'open', 'ST-9'],
    ['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'],
    ['new', 'ticket', 'ST-11', '--lane', 'M'],
    ['worktree', 'check'],
  ];
  for (const dir of [sib, `${sib}/sub`, c.root]) {
    for (const argv of argvs) {
      const r = await run(argv, dir, envOf(A));
      expect(r.code, `${dir} ${argv.join(' ')}`).toBe(2);
      for (const w of WORKS) expect(r.err).toContain(w);
    }
    expect(state()).toEqual(before);
    expect(existsSync(c.sibling('ST-10'))).toBe(false);
    expect(existsSync(c.sibling('ST-11'))).toBe(false);
  }
  setTable(tableOf(B, A));
  for (const argv of [['worktree', 'open', 'ST-10'], ['new', 'ticket', 'ST-11', '--lane', 'M']]) {
    const r = await run(argv, `${sib}/sub`, envOf(B));
    expect(r.code).toBe(2);
    expect(r.err).toContain('ST-9');
  }
  expect(state()).toEqual(before);
  setTable(tableOf(A));
  const same = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  const BEHIND = 'behind: t/ST-9 is 1 commit behind origin/main; merge them with git merge origin/main\n';
  expect([same.code, same.out]).toEqual([0, BEHIND + HELD]);
  const back = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(back.code).toBe(0);
  expect(lines(back.out)).toEqual([lines(BEHIND)[0], `enter: ${sib}`]);
}, 180_000);

it('ac-5 outside claude code pick up continue and new ticket print the stop lines and nothing is refused', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  vi.mocked(proc.processTable).mockClear();
  const outs: string[] = [];
  const go = async (argv: string[], dir: string) => {
    const r = await run(argv, dir, {});
    expect(r.code, argv.join(' ')).toBe(0);
    outs.push(r.out, r.err);
    return r;
  };
  expect((await go(['worktree', 'open', 'ST-9'], c.root)).out.split('\n').slice(0, 3)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
  expect((await go(['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'], c.root)).out.split('\n').slice(0, 4)).toEqual([
    'accord/tickets/ST-11.md',
    ...stopLines(c.sibling('ST-11'), 'ST-11'),
  ]);
  const s9 = c.sibling('ST-9');
  expect((await go(['worktree', 'open', 'ST-10'], s9)).out.split('\n').slice(0, 3)).toEqual(stopLines(c.sibling('ST-10'), 'ST-10'));
  expect((await go(['worktree', 'open', 'ST-9', '--continue'], s9)).out).toContain('not held:');
  const chk = await go(['worktree', 'check'], s9);
  expect([chk.out, chk.err]).toEqual(['', '']);
  const n = await go(['new', 'ticket', 'ST-12', '--lane', 'M', '--worktree'], s9);
  expect(n.out.trimEnd().split('\n').slice(-3)).toEqual(stopLines(c.sibling('ST-12'), 'ST-12'));
  for (const o of outs) expect(o).not.toMatch(/enter:|this session works/);
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
});

it('risk:complex-branching a linked worktree on a detached head refuses all but continue of its own ticket', async () => {
  const c = clone({ tickets: ['ST-9', 'ST-10'] });
  c.git('worktree', 'add', '-q', '--detach', c.sibling('ST-10'), 'origin/main');
  setTable(tableOf(A));
  for (const argv of [['worktree', 'open', 'ST-9', '--continue'], ['worktree', 'check']]) {
    const r = await run(argv, c.sibling('ST-10'), envOf(A));
    expect(r.code).toBe(2);
    expect(r.err).toContain('whose branch cannot be read');
    expect(r.err).toContain('open a new session in the main checkout');
  }
  const own = await run(['worktree', 'open', 'ST-10', '--continue'], c.sibling('ST-10'), envOf(A));
  expect(own.err).not.toContain('this session works');
});

it('risk:complex-branching a claude code session that sets no session variables keeps the main checkout flows and only the folder rule refuses it', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const E = { CLAUDECODE: '1' };
  vi.mocked(proc.processTable).mockClear();
  const chk = await run(['worktree', 'check'], c.root, E);
  expect([chk.code, chk.out, chk.err]).toEqual([0, '', '']);
  const o = await run(['worktree', 'open', 'ST-9'], c.root, E);
  expect(o.code).toBe(0);
  expect(o.out.split('\n').slice(0, 3)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
  const n = await run(['new', 'ticket', 'ST-11', '--lane', 'M'], c.root, E);
  expect(n.code).toBe(0);
  expect(existsSync(`${c.root}/accord/tickets/ST-11.md`)).toBe(true);
  for (const s of [chk.out, o.out, n.out]) expect(s).not.toContain('enter:');
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
  const r = await run(['worktree', 'open', 'ST-10'], c.sibling('ST-9'), E);
  expect(r.code).toBe(2);
  expect(r.err).toContain('this session works ST-9');
});

it('risk:complex-branching a claude code session without session variables gets the stop lines from a new worktree ticket', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const E = { CLAUDECODE: '1' };
  vi.mocked(proc.processTable).mockClear();
  const w = await run(['new', 'ticket', 'ST-12', '--lane', 'M', '--worktree'], c.root, E);
  expect(w.code).toBe(0);
  expect(w.out.trimEnd().split('\n').slice(-3)).toEqual(stopLines(c.sibling('ST-12'), 'ST-12'));
  for (const s of [w.out]) expect(s).not.toContain('enter:');
  expect(existsSync(holdsFile(c))).toBe(false);
  expect(proc.processTable).not.toHaveBeenCalled();
});

it('risk:complex-branching in claude code a pick up whose setup failed still holds its ticket and refuses a second one', async () => {
  const c = copy({ setup: ['node setup-step.js fail'], tickets: ['ST-9', 'ST-10'] });
  setTable(tableOf(A));
  const p = await run(['worktree', 'open', 'ST-9'], c.root, envOf(A));
  expect(p.code).toBe(2);
  expect(p.err).toContain('setup command failed');
  expect(p.out).not.toContain('enter:');
  expect(c.git('log', '-1', '--format=%s', 't/ST-9').trim()).toBe('claim: ST-9');
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
  for (const argv of [['worktree', 'open', 'ST-10'], ['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree']]) {
    const r = await run(argv, c.root, envOf(A));
    expect(r.code).toBe(2);
    expect(r.err).toContain('this session works ST-9');
  }
  expect(existsSync(c.sibling('ST-10'))).toBe(false);
  expect(existsSync(c.sibling('ST-11'))).toBe(false);
  expect(c.git('branch', '--list', 't/ST-10', 't/ST-11').trim()).toBe('');
}, 120_000);

it('risk:complex-branching in claude code a continue after a failed pick up setup reruns setup and is not refused', async () => {
  const c = copy({ setup: ['node setup-step.js fail'], tickets: ['ST-9', 'ST-10'] });
  // H3: the worktree and hold A the failed pick-up left, made by git and fs; H7: nothing here fetches or pushes.
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: '2026-10-18T00:00:00.000Z' } });
  c.git('remote', 'remove', 'origin');
  setTable(tableOf(A));
  const again = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(again.code).toBe(2);
  expect(again.err).toContain('setup command failed');
  expect(again.err).not.toContain('this session works');
}, 120_000);

it('risk:complex-branching in claude code a new ticket whose push failed still holds it and refuses a second one', async () => {
  const d = copy({ tickets: ['ST-10'] });
  d.git('remote', 'set-url', '--push', 'origin', `${d.remote}-missing`);
  setTable(tableOf(C3));
  const n = await run(['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'], d.root, envOf(C3));
  expect(n.code).toBe(2);
  expect(n.err).toContain('the push failed');
  expect(n.out).not.toContain('enter:');
  expect((readHolds(d)['ST-11'] as { marker: string }).marker).toBe('sess-C');
  const o = await run(['worktree', 'open', 'ST-10'], d.root, envOf(C3));
  expect(o.code).toBe(2);
  expect(o.err).toContain('this session works ST-11');
  expect(existsSync(d.sibling('ST-10'))).toBe(false);
}, 120_000);

it('risk:data-loss clean keeps a merged worktree this session holds when run from the main checkout', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: '2026-10-18T00:00:00.000Z' } });
  setTable(tableOf(A));
  vi.mocked(proc.processTable).mockClear();
  const { code, out } = await run(['worktree', 'clean'], c.root, envOf(A));
  expect(code).toBe(0);
  expect(lines(out)).toContain(`kept ${c.sibling('ST-9')}: this session's worktree`);
  expect(lines(out)).toContain('kept t/ST-9: checked out in ' + c.sibling('ST-9'));
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);
  expect(proc.processTable).not.toHaveBeenCalled();
}, 60_000);

it('risk:concurrency the session start hook takes a free hold in a ticket worktree and never a live one', async () => {
  const c = clone();
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const sib = c.sibling('ST-9');
  const start = (s: { marker: string; pid: number }, cwd: string, env: NodeJS.ProcessEnv = envOf(s)) =>
    run(['hook', 'session-start'], cwd, env, JSON.stringify({ session_id: s.marker, cwd, source: 'startup' }));
  setTable(tableOf(A));
  const a = await start(A, sib);
  expect(a.code).toBe(0);
  expect(a.out.startsWith('# accord rules\n')).toBe(true);
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
  const bytes = readFileSync(holdsFile(c), 'utf8');
  setTable(tableOf(B, A));
  const b = await start(B, sib);
  expect(b.code).toBe(0);
  expect(b.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(b.err)).toHaveLength(1);
  expect(b.err).toContain('sess-A');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  setTable(tableOf(B));
  await start(B, c.root);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  await start(B, sib, {});
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const n = await start(B, sib, { CLAUDECODE: '1' });
  expect(n.code).toBe(0);
  expect(n.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(n.err)).toHaveLength(1);
  expect(n.err).toContain('no hold taken on ST-9');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
}, 60_000);

it('risk:complex-branching the resume hook in the main checkout prints the enter line of the held worktree and no anchor from main', async () => {
  const c = clone();
  setTable(tableOf(A));
  expect((await run(['worktree', 'open', 'ST-9'], c.root, envOf(A))).code).toBe(0);
  const ticket = `${c.sibling('ST-9')}/accord/tickets/ST-9.md`;
  writeFileSync(ticket, readFileSync(ticket, 'utf8') + '\n## Corrections\n- branch-only correction\n');
  commitMsg(c.sibling('ST-9'), 'correction on the branch only');
  const resume = (s: { marker: string; pid: number }, cwd: string) =>
    run(['hook', 'session-resume'], c.root, envOf(s), JSON.stringify({ session_id: s.marker, cwd, source: 'resume' }));
  const a = await resume(A, c.root);
  expect(a.out).not.toContain('# Anchor:');
  expect(a.out).not.toContain('branch-only correction');
  const al = lines(a.out);
  expect(al.at(-1)).toBe(`enter: ${c.sibling('ST-9')}`);
  expect(al.at(-2)).toContain('EnterWorktree');
  const b = await resume(B, c.root);
  expect(b.out).not.toContain('enter:');
  expect(b.out).toMatch(/\naccord: \d+ in progress, \d+ ready to pick up · type \/accord\n$/);
  const s = await resume(A, c.sibling('ST-9'));
  expect(s.out).toContain('# Anchor: ST-9');
  expect(s.out).not.toContain('enter:');
}, 60_000);


it('risk:data-loss clean removes a held done worktree and its hold and keeps the worked record', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  const sib = c.sibling('ST-9');
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  // H3: what the pick-up and the continue left, by git and fs: the worktree, hold A, and the worked record.
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: '2026-10-18T00:00:00.000Z' } });
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-A\n');

  gitRun(sib, 'push', '-q', '-u', 'origin', 't/ST-9');
  doneOnRemote(c, ['ST-9']);
  setTable(tableOf(B));
  const cl = await run(['worktree', 'clean'], c.root, envOf(B));
  expect(cl.code).toBe(0);
  expect(cl.out).toContain(`removed ${sib}`);
  expect(existsSync(sib)).toBe(false);
  expect(Object.hasOwn(readHolds(c), 'ST-9')).toBe(false);
  expect(worked()).toBe('ST-9\tsess-A\n');
}, 120_000);

it('risk:complex-branching a session whose hold was cleaned or taken over still works its ticket when resumed in the main checkout', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  const hook = (s: { marker: string }, args: string) =>
    run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker, command_name: 'accord', command_args: args, cwd: c.root }));
  // H3, H7: the state a clean left (no hold on ST-9, no worktree, A recorded as working it); nothing here fetches or pushes.
  writeHolds(c, {});
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-A\n');
  c.git('remote', 'remove', 'origin');
  setTable(tableOf(A));
  for (const args of [['worktree', 'open', 'ST-10'], ['worktree', 'check']]) {
    const r = await run(args, c.root, envOf(A));
    expect(r.code).toBe(2);
    expect(r.err).toContain('this session works ST-9');
  }
  const h = await hook(A, 'pick-up ST-10');
  expect(h.code).toBe(0);
  expect(JSON.parse(h.out)).toMatchObject({ decision: 'block', reason: expect.stringContaining('this session works ST-9') });
  expect(existsSync(c.sibling('ST-10'))).toBe(false);
}, 120_000);

it('risk:complex-branching a session whose hold was taken over still works its ticket when resumed in the main checkout', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  const hook = (s: { marker: string }, args: string) =>
    run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker, command_name: 'accord', command_args: args, cwd: c.root }));
  // H3, H7: the ST-10 worktree and hold C that C's pick-up left, by git and fs; the continue of B that takes it over is the case.
  c.git('worktree', 'add', '-q', '-b', 't/ST-10', c.sibling('ST-10'), 'origin/main');
  writeHolds(c, { 'ST-10': { tool: 'Claude Code', ...C, taken: '2026-10-18T00:00:00.000Z' } });
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-10\tsess-C\n');
  c.git('remote', 'remove', 'origin');
  setTable(tableOf(B));
  const tk = await run(['worktree', 'open', 'ST-10', '--continue'], c.root, envOf(B));
  expect(tk.code).toBe(0);
  expect(lines(tk.out)).toEqual([`enter: ${c.sibling('ST-10')}`]);
  expect((readHolds(c)['ST-10'] as { marker: string }).marker).toBe('sess-B');
  expect(Object.values(readHolds(c)).some((x) => (x as { marker: string }).marker === 'sess-C')).toBe(false);
  setTable(tableOf(C));
  const w = worked();
  for (const args of [['worktree', 'open', 'ST-11'], ['new', 'ticket', 'ST-12', '--lane', 'M']]) {
    const r = await run(args, c.root, envOf(C));
    expect(r.code).toBe(2);
    expect(r.err).toContain('this session works ST-10');
  }
  const hc = await hook(C, 'pick-up ST-11');
  expect(JSON.parse(hc.out)).toMatchObject({ decision: 'block', reason: expect.stringContaining('this session works ST-10') });
  expect(existsSync(c.sibling('ST-11'))).toBe(false);
  expect(existsSync(`${c.root}/accord/tickets/ST-12.md`)).toBe(false);
  expect(worked()).toBe(w);
  expect((await run(['worktree', 'open', 'ST-10', '--continue'], c.root, envOf(C))).err).not.toContain('this session works');
}, 120_000);

it('risk:complex-branching in claude code a pick up records the session as working its ticket', async () => {
  const c = copy();
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  setTable(tableOf(A));
  await run(['worktree', 'open', 'ST-9'], c.root, envOf(A)); // its exit and enter line are checked by the ac-1 pick-up test
  expect(worked()).toBe('ST-9\tsess-A\n');
}, 120_000);

it('risk:complex-branching a session started in a ticket worktree is recorded as working it when the start hook takes no hold', async () => {
  // The hooks read the per-machine cache folder: point it at a temp folder (`requestLatest` and `cachePath` are mocked in setup.ts).
  const cache = mkdtempSync(join(tmpdir(), 'accord-cache-'));
  vi.stubEnv('LOCALAPPDATA', cache);
  vi.stubEnv('XDG_CACHE_HOME', cache);
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  const worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8');
  const start = (env: NodeJS.ProcessEnv, marker: string) =>
    run(['hook', 'session-start'], sib, env, JSON.stringify({ session_id: marker, cwd: sib, source: 'startup' }));
  writeHolds(c, { 'ST-9': LIVE });
  setTable(tableOf(B, { pid: 4242, start: 'S2' }));
  const b = await start(envOf(B), 'sess-B');
  expect(b.code).toBe(0);
  expect(b.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(b.err)).toHaveLength(1);
  expect(b.err).toContain('sess-H');
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-H');
  expect(lines(worked())).toContain('ST-9\tsess-B');

  const e = await start({ CLAUDECODE: '1' }, 'sess-E');
  expect(e.code).toBe(0);
  expect(e.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(e.err)).toHaveLength(1);
  expect(e.err).toContain('no hold taken on ST-9');
  expect(lines(worked())).toContain('ST-9\tsess-E');

  expect((await start({}, 'sess-O')).code).toBe(0);
  expect(lines(worked()).some((l) => l.endsWith('sess-O'))).toBe(false);

  const resume = (env: NodeJS.ProcessEnv, marker: string) =>
    run(['hook', 'session-resume'], sib, env, JSON.stringify({ session_id: marker, cwd: sib, source: 'resume' }));
  setTable(tableOf(C));
  const bytes = readFileSync(holdsFile(c), 'utf8');
  const r = await resume(envOf(C), 'sess-C');
  expect(r.code).toBe(0);
  expect(r.out).toContain('# Anchor: ST-9');
  expect(r.out).not.toContain('enter:');
  expect(r.err).toBe('');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  expect(lines(worked())).toContain('ST-9\tsess-C');
  expect((await resume({}, 'sess-P')).code).toBe(0);
  expect(lines(worked()).some((l) => l.endsWith('sess-P'))).toBe(false);
  vi.unstubAllEnvs();
  cleanup(cache);
}, 120_000);

it('risk:complex-branching a session recorded as working a ticket whose worktree is gone is refused other tickets in the main checkout', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const hook = (s: { marker: string }, args: string) =>
    run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker, command_name: 'accord', command_args: args, cwd: c.root }));
  // H4: the state the first test leaves once the ST-9 worktree is removed: B, E and C recorded as working ST-9, a live hold on it, no worktree.
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-B\nST-9\tsess-E\nST-9\tsess-C\n');
  writeHolds(c, { 'ST-9': LIVE });
  setTable(tableOf(C));
  const o = await run(['worktree', 'open', 'ST-10'], c.root, envOf(C));
  expect(o.code).toBe(2);
  expect(o.err).toContain('this session works ST-9');
  setTable(tableOf(B));
  const k = await run(['worktree', 'check'], c.root, envOf(B));
  expect(k.code).toBe(2);
  expect(k.err).toContain('this session works ST-9');
  const oe = await run(['worktree', 'open', 'ST-10'], c.root, { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'sess-E' });
  expect(oe.code).toBe(2);
  expect(oe.err).toContain('this session works ST-9');
  expect(existsSync(c.sibling('ST-10'))).toBe(false);
  const h = await hook({ marker: 'sess-E' }, 'pick-up ST-10');
  expect(h.code).toBe(0);
  expect(JSON.parse(h.out)).toMatchObject({ decision: 'block', reason: expect.stringContaining('this session works ST-9') });
}, 120_000);

it('ac-1 a clear in a window outside the ticket worktree removes the hold its old conversation took and another session continues the ticket', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': DEAD });
  setTable(tableOf(A));
  const k = await clearOf(c.root, A2);
  expect(k.code).toBe(0);
  expect(k.out.startsWith('# accord rules\n')).toBe(true);
  expect(Object.hasOwn(readHolds(c), 'ST-9')).toBe(false);
  expect(readHolds(c)['ST-10']).toEqual(DEAD);
  setTable(tableOf(B, A));
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B));
  expect(r.code).toBe(0);
  expect(r.err).not.toContain('held by another session');
  expect(lines(r.out)).toEqual([`enter: ${sib}`]);
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-B');
}, 120_000);

it('risk:data-loss a clear whose window the process table does not show releases nothing and says so on stdout', async () => {
  const c = copy();
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } });
  const bytes = readFileSync(holdsFile(c), 'utf8');
  setTable([{ pid: process.pid, ppid: 1, start: 'self' }]);
  const a = await clearOf(c.root, A2);
  expect(a.code).toBe(0);
  expect(a.err).toBe('');
  expect(a.out.startsWith('# accord rules\n')).toBe(true);
  expect(lines(a.out).some((l) => l.startsWith('accord: no hold released: cannot see this Claude Code session'))).toBe(true);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const stdin = JSON.stringify({ session_id: 'sess-A2', cwd: c.root, source: 'clear' });
  const b = await run(['hook', 'session-resume'], c.root, { CLAUDECODE: '1' }, stdin);
  expect(b.code).toBe(0);
  expect(lines(b.out).some((l) => l.startsWith('accord: no hold released: this Claude Code session sets no'))).toBe(true);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const o = await run(['hook', 'session-resume'], c.root, {}, stdin);
  expect(o.code).toBe(0);
  expect(o.out).not.toContain('no hold released');
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
}, 60_000);

it('ac-2 after a clear the window claims one other ticket and holds only that one', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } });
  writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-A\n');
  setTable(tableOf(A));
  const k = await clearOf(c.root, A2);
  expect(k.code).toBe(0);
  const r = await run(['worktree', 'open', 'ST-10'], c.root, envOf(A2));
  expect(r.code).toBe(0);
  expect(r.err).not.toContain('this session works');
  expect(r.err).not.toContain('held by another session');
  expect(lines(r.out).at(-1)).toBe(`enter: ${c.sibling('ST-10')}`);
  expect(Object.keys(readHolds(c))).toEqual(['ST-10']);
  expect((readHolds(c)['ST-10'] as { marker: string }).marker).toBe('sess-A2');
}, 120_000);

it('ac-3 a start or a clear in a second window in the ticket worktree leaves the first window hold in place', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  mkdirSync(`${sib}/sub`);
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } });
  const bytes = readFileSync(holdsFile(c), 'utf8');
  setTable(tableOf(B, A));
  const s = await run(['hook', 'session-start'], sib, envOf(B), JSON.stringify({ session_id: 'sess-B', cwd: sib, source: 'startup' }));
  expect(s.code).toBe(0);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const B2 = { ...B, marker: 'sess-B2' };
  const k = await run(['hook', 'session-resume'], sib, envOf(B2), JSON.stringify({ session_id: 'sess-B2', cwd: `${sib}/sub`, source: 'clear' }));
  expect(k.code).toBe(0);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B2));
  expect(r.code).toBe(2);
  expect(r.err).toContain('ST-9 is held by another session');
  expect(r.err).toContain('sess-A');
  expect((readHolds(c)['ST-9'] as { marker: string }).marker).toBe('sess-A');
}, 120_000);

it('ac-5 a clear in the held ticket worktree moves its hold to the new conversation and releases the window other holds', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  mkdirSync(`${sib}/sub`);
  writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': { tool: 'Claude Code', ...A, taken: T } });
  setTable(tableOf(A));
  const k = await run(['hook', 'session-resume'], sib, envOf(A2), JSON.stringify({ session_id: 'sess-A2', cwd: `${sib}/sub`, source: 'clear' }));
  expect(k.code).toBe(0);
  expect(Object.keys(readHolds(c))).toEqual(['ST-9']);
  expect(readHolds(c)['ST-9']).toMatchObject({ marker: 'sess-A2', pid: 7001, start: 'S-A', taken: T });
  const same = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A2));
  expect(same.code).toBe(0);
  expect(same.out).toBe(HELD);
  setTable(tableOf(B, A));
  const other = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B));
  expect(other.code).toBe(2);
  expect(other.err).toContain('ST-9 is held by another session');
  expect(other.err).toContain('sess-A2');
}, 120_000);

it('risk:complex-branching a resume to another conversation keeps only the hold that conversation took and a compact releases nothing', async () => {
  const c = copy();
  const A3 = { ...A, marker: 'sess-A3' };
  const both = { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': { tool: 'Claude Code', ...A3, taken: T } };
  setTable(tableOf(A));
  const resumeTo = (s: { marker: string; pid: number }, source: string) =>
    run(['hook', 'session-resume'], c.root, envOf(s), JSON.stringify({ session_id: s.marker, cwd: c.root, source }));
  writeHolds(c, both);
  const a = await resumeTo(A3, 'resume');
  expect(a.code).toBe(0);
  expect(Object.keys(readHolds(c))).toEqual(['ST-10']);
  expect((readHolds(c)['ST-10'] as { marker: string }).marker).toBe('sess-A3');
  writeHolds(c, both);
  const bytes = readFileSync(holdsFile(c), 'utf8');
  const b = await resumeTo(A, 'compact');
  expect(b.code).toBe(0);
  expect(readFileSync(holdsFile(c), 'utf8')).toBe(bytes);
}, 60_000);

it('ac-4 a refusal names the folder and the local time with its offset of the hold', async () => {
  vi.stubEnv('TZ', 'Asia/Ho_Chi_Minh');
  expect(new Date(T).getTimezoneOffset()).toBe(-420);
  const c = copy();
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  setTable(tableOf(A));
  const first = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A));
  expect(first.code).toBe(0);
  expect(lines(first.out)).toEqual([`enter: ${sib}`]);
  expect((readHolds(c)['ST-9'] as { folder: string }).folder).toBe(sib);
  writeHolds(c, { 'ST-9': { ...(readHolds(c)['ST-9'] as object), taken: T } });
  setTable(tableOf(B, A));
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B));
  expect(r.code).toBe(2);
  expect(r.err).toContain(`ST-9 is held by another session: Claude Code session sess-A (pid 7001) in ${sib}, since 2026-10-27 10:03 (UTC+07:00) - work it there, or close that session first`);
  expect(r.err).not.toContain('\\');
  vi.stubEnv('TZ', 'America/Bogota');
  const west = await run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B));
  expect(west.code).toBe(2);
  expect(west.err).toContain('since 2026-10-26 22:03 (UTC-05:00)');
}, 120_000);

it('risk:parsing a hold written without a folder is refused as folder not recorded with its local time', async () => {
  vi.stubEnv('TZ', 'Asia/Ho_Chi_Minh');
  const c = copy();
  const sib = c.sibling('ST-9');
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main');
  c.git('remote', 'remove', 'origin');
  writeHolds(c, { 'ST-9': LIVE });
  setTable(tableOf(B, { pid: 4242, start: 'S2' }));
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B));
  expect(r.code).toBe(2);
  expect(r.err).toContain('Claude Code session sess-H (pid 4242), folder not recorded, since 2026-10-18 07:00 (UTC+07:00) - work it there');
}, 120_000);
