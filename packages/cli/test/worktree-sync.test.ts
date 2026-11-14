// ST-LN-96 t1-ac-3: `git.merge` decides how `accord worktree sync` takes the remote main into a ticket branch, against real git in tmp sandboxes with a bare remote.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { BEHIND, copy, type Clone, lines, pushMain, ticketWorktree, twoOnMain, useSandboxes, verifyStage } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

// the real runner with a short timeout when a test sets one, so a hanging script is refused in seconds, not after the 600 s limit
const knob = vi.hoisted(() => ({ timeoutMs: undefined as number | undefined }));
vi.mock('../src/load/team-run.js', async (orig) => {
  const real = await orig<typeof import('../src/load/team-run.js')>();
  return { ...real, runTeamCommand: (c: string, o: Parameters<typeof real.runTeamCommand>[1]) => real.runTeamCommand(c, knob.timeoutMs === undefined ? o : { ...o, timeoutMs: knob.timeoutMs }) };
});

useSandboxes([{}]);

type Strategy = 'merge' | 'rebase' | 'squash' | undefined;

/** A ticket ST-9 at verify in its sibling worktree, three commits on top of the shared start, config carrying `git.merge` when a strategy is given; the branch is pushed. */
function atVerify(c: Clone, strategy: Strategy, file?: string, sync?: string): string {
  ticketWorktree(c, 'ST-9', file);
  const sib = c.sibling('ST-9');
  if (strategy !== undefined || sync !== undefined) {
    const path = sib + '/accord/config.yml';
    const keys = [...(strategy === undefined ? [] : [`  merge: ${strategy}`]), ...(sync === undefined ? [] : [`  sync: '${sync}'`])];
    writeFiles(sib, { 'accord/config.yml': readFileSync(path, 'utf8').replace(/\r\n/g, '\n') + 'git:\n' + keys.join('\n') + '\n' });
    gitRun(sib, 'add', '-A');
    gitRun(sib, 'commit', '-q', '-m', 'config: git ' + keys.join(' ').trim());
  }
  verifyStage(sib, 'ST-9');
  gitRun(sib, 'push', '-q', 'origin', 't/ST-9');
  return sib;
}

const parents = (dir: string) => gitRun(dir, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ').length - 1;
const rebasedLines = (out: string) => lines(out).filter((l) => l.startsWith('rebased:'));

it('risk:complex-branching git.merge decides how worktree sync takes main (ST-LN-96 t1-ac-3)', async () => {
  for (const strategy of [undefined, 'squash', 'rebase'] as const) {
    const c = copy();
    const sib = atVerify(c, strategy);
    const own = gitRun(sib, 'rev-list', '--count', 'origin/main..HEAD').trim();
    const tip = pushMain(c, 'next.txt', 'next\n');
    const r = await run(['worktree', 'sync', 'ST-9'], sib);
    expect(r.err, String(strategy)).toBe('');
    expect(r.code, String(strategy)).toBe(0);
    expect(existsSync(sib + '/next.txt'), String(strategy)).toBe(true);
    expect(gitRun(sib, 'status', '--porcelain'), String(strategy)).toBe('');
    if (strategy !== 'rebase') {
      expect(parents(sib), String(strategy)).toBe(2);
      expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim(), String(strategy)).toBe(tip);
      expect(rebasedLines(r.out), String(strategy)).toEqual([]);
    } else {
      expect(gitRun(sib, 'rev-list', '--merges', 'origin/main..HEAD').trim()).toBe('');
      expect(gitRun(sib, 'merge-base', '--is-ancestor', tip, 'HEAD').trim()).toBe('');
      const pairs = rebasedLines(r.out);
      expect(pairs).toHaveLength(Number(own));
      for (const l of pairs) expect(l).toMatch(/^rebased: [0-9a-f]{12} -> [0-9a-f]{12}$/);
      expect(gitRun(sib, 'rev-parse', 'refs/remotes/origin/t/ST-9').trim()).toBe(gitRun(sib, 'rev-parse', 'HEAD').trim());
      expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(gitRun(sib, 'rev-parse', 'HEAD').trim());
    }
    const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
    const again = await run(['worktree', 'sync', 'ST-9'], sib);
    expect(again.code, String(strategy)).toBe(0);
    expect(again.out, String(strategy)).toBe('');
    expect(again.err, String(strategy)).toBe('');
    expect(gitRun(sib, 'rev-parse', 'HEAD').trim(), String(strategy)).toBe(head);
  }
}, 240_000);

it('risk:data-loss a rebase conflict is aborted and named (ST-LN-96 t1-ac-3)', async () => {
  const c = copy();
  writeFiles(c.root, { 'shared.txt': 'base\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'shared');
  c.git('push', '-q', 'origin', 'main');
  const sib = atVerify(c, 'rebase', 'shared.txt');
  pushMain(c, 'shared.txt', 'main\n');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  for (let i = 0; i < 2; i++) {
    const r = await run(['worktree', 'sync', 'ST-9'], sib);
    expect(r.code).toBe(2);
    expect(r.err).toContain('shared.txt');
    expect(r.err).toContain('rebase');
    expect(r.err).toContain('aborted');
    expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
    expect(gitRun(sib, 'branch', '--show-current').trim()).toBe('t/ST-9');
    expect(gitRun(sib, 'status', '--porcelain')).toBe('');
    expect(readFileSync(sib + '/shared.txt', 'utf8').replace(/\r/g, '')).toBe('ST-9\n');
    const dir = (n: string) => gitRun(sib, 'rev-parse', '--git-path', n).trim();
    expect(existsSync(dir('rebase-merge')) || existsSync(dir('rebase-apply'))).toBe(false);
  }
}, 120_000);

it("risk:data-loss a lease push never overwrites a teammate's commit (ST-LN-96 t1-ac-3)", async () => {
  const c = copy();
  const sib = atVerify(c, 'rebase');
  pushMain(c, 'next.txt', 'next\n');
  // a teammate pushes a commit to the ticket branch that this clone has not fetched
  const o = c.otherClone();
  gitRun(o, 'fetch', '-q', 'origin');
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'origin/t/ST-9');
  writeFiles(o, { 'theirs.txt': 'theirs\n' });
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', 'theirs');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  const theirs = gitRun(o, 'rev-parse', 'HEAD').trim();
  const r = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(r.code).toBe(0);
  const out = lines(r.out);
  const failed = out.find((l) => l.startsWith('push of t/ST-9 failed'));
  expect(failed).toBeDefined();
  expect(failed).toContain('accord worktree push ST-9 --force-with-lease');
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(theirs);
  // the local branch was rebased all the same
  expect(gitRun(sib, 'rev-list', '--merges', 'origin/main..HEAD').trim()).toBe('');
}, 120_000);

it('risk:regression worktree merge is an alias of worktree sync (ST-LN-96 t1-ac-3)', async () => {
  for (const strategy of [undefined, 'squash', 'rebase'] as const) {
    const results: { out: string; shape: string }[] = [];
    for (const name of ['sync', 'merge']) {
      const c = copy();
      const sib = atVerify(c, strategy);
      pushMain(c, 'next.txt', 'next\n');
      const r = await run(['worktree', name, 'ST-9'], sib);
      expect(r.code, `${strategy} ${name}`).toBe(0);
      // shas differ between the two sandboxes, so compare the shape: the output with each 12-hex id blanked, the parents, the file list
      results.push({
        out: r.out.replace(/[0-9a-f]{12}/g, '<sha>'),
        shape: [parents(sib), gitRun(sib, 'ls-tree', '-r', '--name-only', 'HEAD').trim(), gitRun(sib, 'log', '--format=%s', 'origin/main..HEAD').trim()].join('|'),
      });
    }
    expect(results[1], String(strategy)).toEqual(results[0]);
  }
  // an early run is refused by both names with the same words
  const c = copy();
  ticketWorktree(c, 'ST-9');
  verifyStage(c.sibling('ST-9'), 'ST-9', { review: false });
  const a = await run(['worktree', 'sync', 'ST-9'], c.sibling('ST-9'));
  const b = await run(['worktree', 'merge', 'ST-9'], c.sibling('ST-9'));
  expect([a.code, a.err]).toEqual([2, expect.stringContaining('only at verify')]);
  expect(b).toEqual(a);
}, 360_000);

// ---- ST-LN-96 D-03: `git.sync` is a team command that runs instead of the built-in merge or rebase ----

const fx = mkdtempSync(join(tmpdir(), 'accord-sync-fx-'));
afterAll(() => rmSync(fx, { recursive: true, force: true }));
const fwd = (p: string) => p.replaceAll('\\', '/');
let count = 0;

/** A team script as a .mjs file run with `node <path>` (never `./x.sh`, Pitfall 7). It logs its folder and ACCORD_* env, then runs `body`. */
function script(body: string): { command: string; calls(): Array<Record<string, string>> } {
  const n = ++count;
  const log = fwd(join(fx, `calls-${n}.log`));
  const file = fwd(join(fx, `team-${n}.mjs`));
  writeFileSync(
    file,
    `import { appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ cwd: process.cwd(), ticket: process.env.ACCORD_TICKET, branch: process.env.ACCORD_BRANCH, ref: process.env.ACCORD_BASE_REF, root: process.env.ACCORD_ROOT }) + '\\n');
const git = (...a) => execFileSync('git', a, { stdio: 'pipe' });
${body}
`,
  );
  return {
    command: `node ${file}`,
    calls: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as Record<string, string>) : []),
  };
}
const MERGE = "git('merge', '--no-ff', '--no-edit', process.env.ACCORD_BASE_REF);";
const REBASE = "git('rebase', process.env.ACCORD_BASE_REF);";
const same = (a: string | undefined, b: string) => expect(fwd(a ?? '').toLowerCase()).toBe(fwd(b).toLowerCase());

it('risk:complex-branching git.sync replaces the built-in merge and rebase (ST-LN-96 t1-ac-3)', async () => {
  const c = copy();
  const s = script(MERGE);
  // git.merge: rebase is set too: the team command wins
  const sib = atVerify(c, 'rebase', undefined, s.command);
  const tip = pushMain(c, 'next.txt', 'next\n');
  const r = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain('synced: t/ST-9 by git.sync');
  expect(rebasedLines(r.out)).toEqual([]);
  expect(parents(sib)).toBe(2);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
  expect(gitRun(sib, 'reflog', '-n', '20')).not.toMatch(/rebase \(/);
  expect(existsSync(sib + '/next.txt')).toBe(true);
  // the ticket reached the script only in its environment, from the ticket's worktree
  const [call, ...more] = s.calls();
  expect(more).toEqual([]);
  expect([call.ticket, call.branch, call.ref]).toEqual(['ST-9', 't/ST-9', 'refs/remotes/origin/main']);
  same(call.root, sib);
  same(call.cwd, sib);
  expect(s.command).not.toMatch(/ST-9|t\/ST-9|origin/);
  // pushed: a merge leaves origin's branch an ancestor of HEAD
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(head);
  // synced already: nothing runs again
  const again = await run(['worktree', 'sync', 'ST-9'], sib);
  expect([again.code, again.out, again.err]).toEqual([0, '', '']);
  expect(s.calls()).toHaveLength(1);
}, 240_000);

it('risk:complex-branching a git.sync that rebases is pushed with the lease (ST-LN-96 t1-ac-3)', async () => {
  const c = copy();
  const s = script(REBASE);
  const sib = atVerify(c, undefined, undefined, s.command);
  pushMain(c, 'next.txt', 'next\n');
  const r = await run(['worktree', 'sync', 'ST-9'], sib);
  expect([r.code, r.err]).toEqual([0, '']);
  expect(lines(r.out)).toContain('synced: t/ST-9 by git.sync');
  expect(gitRun(sib, 'rev-list', '--merges', 'origin/main..HEAD').trim()).toBe('');
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(gitRun(sib, 'rev-parse', 'HEAD').trim());
}, 240_000);

it('risk:data-loss a git.sync that fails, hangs or leaves work half done is refused and nothing is pushed (ST-LN-96 t1-ac-3)', async () => {
  const cases: Array<{ name: string; body: string; says: string[]; conflict?: boolean; timeoutMs?: number }> = [
    { name: 'exit 3', body: "process.stderr.write('boom one\\nboom two\\n'); process.exit(3);", says: ['exited 3', 'boom two'] },
    { name: 'merge left', body: "git('merge', '--no-ff', '--no-commit', process.env.ACCORD_BASE_REF);", says: ['left a merge unfinished'] },
    { name: 'rebase left', body: "try { git('rebase', process.env.ACCORD_BASE_REF); } catch {}", says: ['left a rebase unfinished'], conflict: true },
    { name: 'dirty', body: "writeFileSync('ST-9.txt', 'changed by the script\\n');", says: ['uncommitted'] },
    { name: 'hang', body: 'setTimeout(() => {}, 3000);', says: ['timed out'], timeoutMs: 1500 },
  ];
  for (const k of cases) {
    const c = copy();
    if (k.conflict === true) {
      writeFiles(c.root, { 'shared.txt': 'base\n' });
      commitMsg(c.root, 'shared');
      c.git('push', '-q', 'origin', 'main');
    }
    const s = script(k.body);
    const sib = atVerify(c, undefined, k.conflict === true ? 'shared.txt' : undefined, s.command);
    if (k.conflict === true) pushMain(c, 'shared.txt', 'main\n');
    else pushMain(c, 'next.txt', 'next\n');
    const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
    const remote = gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim();
    knob.timeoutMs = k.timeoutMs;
    try {
      const r = await run(['worktree', 'sync', 'ST-9'], sib);
      expect(r.code, k.name).toBe(2);
      expect(r.err, k.name).toContain(`git.sync "${s.command}"`);
      for (const w of k.says) expect(r.err, k.name).toContain(w);
      expect(r.err, k.name).toContain('t/ST-9 was not pushed');
      expect(r.out, k.name).not.toContain('synced:');
      expect(s.calls(), k.name).toHaveLength(1);
      expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim(), k.name).toBe(remote);
      if (k.name === 'exit 3' || k.name === 'hang') expect(gitRun(sib, 'rev-parse', 'HEAD').trim(), k.name).toBe(head);
      // on Windows the killed shell leaves its node child running in the worktree: let it end before the sandbox is removed
      if (k.timeoutMs !== undefined) await new Promise((done) => setTimeout(done, 3500));
    } finally {
      knob.timeoutMs = undefined;
    }
  }
}, 360_000);

// ---- Continue syncs a behind branch the configured way, and its behind line names it ----

/** Commit `git:` keys into the main checkout's config and push, so a ticket branch cut afterwards carries them. */
function withGit(c: Clone, yaml: string): void {
  const path = c.root + '/accord/config.yml';
  writeFiles(c.root, { 'accord/config.yml': readFileSync(path, 'utf8').replace(/\r\n/g, '\n') + 'git:\n' + yaml });
  commitMsg(c.root, 'config: git');
  c.git('push', '-q', 'origin', 'main');
}

it('risk:complex-branching Continue rebases a behind branch under git.merge rebase and pushes with the lease (ST-LN-96 t1-ac-3)', async () => {
  const c = copy();
  withGit(c, '  merge: rebase\n');
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  twoOnMain(c);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect([r.code, r.err]).toEqual([0, '']);
  const out = lines(r.out);
  expect(rebasedLines(r.out)).toHaveLength(1);
  for (const l of rebasedLines(r.out)) expect(l).toMatch(/^rebased: [0-9a-f]{12} -> [0-9a-f]{12}$/);
  expect(out.some((l) => l.startsWith('merged:') || l.startsWith('behind:'))).toBe(false);
  expect(gitRun(sib, 'rev-list', '--merges', 'origin/main..HEAD').trim()).toBe('');
  expect(gitRun(sib, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD').trim()).toBe('');
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(gitRun(sib, 'rev-parse', 'HEAD').trim());
}, 240_000);

it('risk:complex-branching Continue runs git.sync instead of merging and pushes what it left (ST-LN-96 t1-ac-3)', async () => {
  const c = copy();
  const s = script(MERGE);
  withGit(c, `  merge: rebase\n  sync: '${s.command}'\n`);
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  twoOnMain(c);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect([r.code, r.err]).toEqual([0, '']);
  const out = lines(r.out);
  expect(out).toContain('synced: t/ST-9 by git.sync');
  expect(out.some((l) => l.startsWith('merged:') || l.startsWith('rebased:'))).toBe(false);
  expect(parents(sib)).toBe(2);
  const [call, ...more] = s.calls();
  expect(more).toEqual([]);
  expect([call.ticket, call.branch, call.ref]).toEqual(['ST-9', 't/ST-9', 'refs/remotes/origin/main']);
  same(call.cwd, sib);
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(gitRun(sib, 'rev-parse', 'HEAD').trim());
  // a failing script stops Continue with exit 2 and pushes nothing
  const f = copy();
  const bad = script('process.exit(4);');
  withGit(f, `  sync: '${bad.command}'\n`);
  ticketWorktree(f, 'ST-9');
  const before = gitRun(f.remote, 'rev-parse', 'refs/heads/t/ST-9').trim();
  twoOnMain(f);
  const rf = await run(['worktree', 'open', 'ST-9', '--continue'], f.root);
  expect(rf.code).toBe(2);
  expect(rf.err).toContain(`git.sync "${bad.command}" exited 4`);
  expect(gitRun(f.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(before);
}, 240_000);

it('risk:complex-branching the behind line of Continue names the configured way (ST-LN-96 t1-ac-3)', async () => {
  const s = script(MERGE);
  const ways: Array<{ yaml: string; line: string | RegExp }> = [
    { yaml: '', line: BEHIND },
    { yaml: '  merge: merge\n', line: BEHIND },
    { yaml: '  merge: squash\n', line: BEHIND },
    { yaml: '  merge: rebase\n', line: 'behind: t/ST-9 is 2 commits behind origin/main; rebase onto it with accord worktree sync ST-9' },
    { yaml: `  sync: '${s.command}'\n`, line: /^behind: t\/ST-9 is 2 commits behind origin\/main; .*git\.sync/ },
  ];
  for (const w of ways) {
    const c = copy();
    if (w.yaml !== '') withGit(c, w.yaml);
    ticketWorktree(c, 'ST-9');
    // an uncommitted tracked change: Continue does not sync and says it is behind
    writeFiles(c.sibling('ST-9'), { 'ST-9.txt': 'changed\n' });
    twoOnMain(c);
    const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
    expect(r.code, w.yaml).toBe(0);
    const behind = lines(r.out).filter((l) => l.startsWith('behind:'));
    expect(behind, w.yaml).toHaveLength(1);
    if (typeof w.line === 'string') expect(behind[0], w.yaml).toBe(w.line);
    else expect(behind[0], w.yaml).toMatch(w.line);
    expect(s.calls(), w.yaml).toEqual([]);
  }
}, 360_000);
