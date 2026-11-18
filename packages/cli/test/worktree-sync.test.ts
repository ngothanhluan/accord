// ST-LN-96 t1-ac-3: `git.merge` decides how `accord worktree sync` takes the remote main into a ticket branch, against real git in tmp sandboxes with a bare remote.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';
import { commitMsg, gitRun, run, trustAllow, writeFiles } from './helpers/repo.js';
import { nextLine } from '../src/commands/next-action.js';
import { BEHIND, copy, type Clone, doneBranch, lines, pushMain, ticketWorktree, twoOnMain, useSandboxes, verifyStage } from './helpers/worktree.js';

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
    const keys = [...(strategy === undefined ? [] : [`  merge: ${strategy}`]), ...(sync === undefined ? [] : [`  sync: ${JSON.stringify(sync)}`])];
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
      for (const l of pairs) expect(l).toMatch(/^rebased: [0-9a-f]{12} -> [0-9a-f]{12} - next: \S/);
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

it('risk:regression worktree sync refuses stage done under merge (ST-LN-96 t1-ac-3)', async () => {
  // no git key, git.merge: merge and squash: a verified ticket whose PR fell behind main is refused with today's words; only built-in rebase runs at done
  for (const gitKeys of [undefined, ['  merge: merge'], ['  merge: squash']]) {
    const c = copy();
    const { sib } = doneBranch(c, gitKeys === undefined ? {} : { gitKeys });
    pushMain(c, 'next.txt', 'next\n');
    const before = gitRun(sib, 'rev-parse', 'HEAD').trim();
    const r = await run(['worktree', 'sync', 'ST-9'], sib);
    expect([r.code, r.out, r.err], String(gitKeys)).toEqual([2, '', 'ST-9 is at stage done, and accord worktree sync runs only at verify, after review - nothing was merged\n']);
    expect(gitRun(sib, 'rev-parse', 'HEAD').trim(), String(gitKeys)).toBe(before);
    expect(existsSync(sib + '/next.txt'), String(gitKeys)).toBe(false);
  }
}, 240_000);

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
/** The person's one `accord trust` in `dir`: a repository script (git.sync) runs only once it is allowed. */
const allow = async (dir: string): Promise<void> => expect((await trustAllow(dir, ['git.sync'])).code).toBe(0);
const MERGE = "git('merge', '--no-ff', '--no-edit', process.env.ACCORD_BASE_REF);";
const REBASE = "git('rebase', process.env.ACCORD_BASE_REF);";
const same = (a: string | undefined, b: string) => expect(fwd(a ?? '').toLowerCase()).toBe(fwd(b).toLowerCase());

it('risk:complex-branching git.sync replaces the built-in merge and rebase (ST-LN-96 t1-ac-3)', async () => {
  const c = copy();
  const s = script(MERGE);
  // git.merge: rebase is set too: the team command wins
  const sib = atVerify(c, 'rebase', undefined, s.command);
  await allow(sib);
  const tip = pushMain(c, 'next.txt', 'next\n');
  const r = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain('synced: t/ST-9 by git.sync - ' + nextLine('synced'));
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
  await allow(sib);
  pushMain(c, 'next.txt', 'next\n');
  const r = await run(['worktree', 'sync', 'ST-9'], sib);
  expect([r.code, r.err]).toEqual([0, '']);
  expect(lines(r.out)).toContain('synced: t/ST-9 by git.sync - ' + nextLine('synced'));
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
    await allow(sib);
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
  for (const l of rebasedLines(r.out)) expect(l).toMatch(/^rebased: [0-9a-f]{12} -> [0-9a-f]{12} - next: \S/);
  expect(out.some((l) => l.startsWith('merged:') || l.startsWith('behind:'))).toBe(false);
  expect(gitRun(sib, 'rev-list', '--merges', 'origin/main..HEAD').trim()).toBe('');
  expect(gitRun(sib, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD').trim()).toBe('');
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(gitRun(sib, 'rev-parse', 'HEAD').trim());
}, 240_000);

it('risk:complex-branching Continue runs git.sync instead of merging and pushes what it left (ST-LN-96 t1-ac-3)', async () => {
  const c = copy();
  const s = script(MERGE);
  withGit(c, `  merge: rebase\n  sync: '${s.command}'\n`);
  await allow(c.root);
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  twoOnMain(c);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect([r.code, r.err]).toEqual([0, '']);
  const out = lines(r.out);
  expect(out).toContain('synced: t/ST-9 by git.sync - ' + nextLine('synced'));
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
  await allow(f.root);
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
  // before verify `accord worktree sync` refuses, so the line says when it runs; at verify it is the command to run (WR-13)
  const ways: Array<{ yaml: string; line: string | RegExp; early?: string }> = [
    { yaml: '', line: BEHIND },
    { yaml: '  merge: merge\n', line: BEHIND },
    { yaml: '  merge: squash\n', line: BEHIND },
    {
      yaml: '  merge: rebase\n',
      line: 'behind: t/ST-9 is 2 commits behind origin/main; rebase onto it with accord worktree sync ST-9 - ' + nextLine('behind'),
      early: 'behind: t/ST-9 is 2 commits behind origin/main; rebase onto it, which accord worktree sync ST-9 does at verify - ' + nextLine('behind'),
    },
    {
      yaml: `  sync: '${s.command}'\n`,
      line: /^behind: t\/ST-9 is 2 commits behind origin\/main; .*git\.sync.*\(accord worktree sync ST-9 runs it\) - next: \S/,
      early: 'behind: t/ST-9 is 2 commits behind origin/main; sync them with git.sync, the team command, which accord worktree sync ST-9 runs at verify - ' + nextLine('behind'),
    },
  ];
  for (const atVerifyStage of [false, true]) {
    for (const w of ways) {
      const c = copy();
      if (w.yaml !== '') withGit(c, w.yaml);
      if (w.yaml.includes('sync')) await allow(c.root);
      ticketWorktree(c, 'ST-9');
      if (atVerifyStage) verifyStage(c.sibling('ST-9'), 'ST-9');
      // an uncommitted tracked change: Continue does not sync and says it is behind
      writeFiles(c.sibling('ST-9'), { 'ST-9.txt': 'changed\n' });
      twoOnMain(c);
      const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
      const where = w.yaml + (atVerifyStage ? ' at verify' : ' before verify');
      expect(r.code, where).toBe(0);
      const behind = lines(r.out).filter((l) => l.startsWith('behind:'));
      expect(behind, where).toHaveLength(1);
      const want = atVerifyStage ? w.line : (w.early ?? w.line);
      if (typeof want === 'string') expect(behind[0], where).toBe(want);
      else expect(behind[0], where).toMatch(want);
      expect(s.calls(), where).toEqual([]);
    }
  }
}, 600_000);

// ---- owner decision (2026-11-15): git.sync is a repository script, so it is not run until `accord trust` allowed it, and not again when its files changed ----

/** A sync script that is a committed file of the repository: it records its tag in the file named by SYNC_MARKER, then merges the fetched main. */
const inRepo = (tag: string): string => `import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
appendFileSync(process.env.SYNC_MARKER, '${tag}\\n');
execFileSync('git', ['merge', '--no-ff', '--no-edit', process.env.ACCORD_BASE_REF], { stdio: 'pipe' });
`;
const tags = (marker: string): string[] => (existsSync(marker) ? readFileSync(marker, 'utf8').split('\n').filter((l) => l !== '') : []);

it('risk:security git.sync is not run until accord trust allowed it, and not again when only its script file changed (owner decision, repository scripts trust)', async () => {
  const c = copy();
  const marker = fwd(join(fx, `trust-${++count}.log`));
  vi.stubEnv('SYNC_MARKER', marker);
  const sib = atVerify(c, undefined, 'scripts/sync.mjs', 'node scripts/sync.mjs');
  // each change of the script is committed with a new review verdict line, so the ticket stays at verify and `worktree sync` is what refuses
  const commitScript = (tag: string): void => {
    writeFiles(sib, { 'scripts/sync.mjs': inRepo(tag), 'accord/tickets/ST-9/review.md': `verdict: converged\n<!-- ${tag} -->\n` });
    gitRun(sib, 'add', '-A');
    gitRun(sib, 'commit', '-q', '-m', 'script ' + tag);
    gitRun(sib, 'push', '-q', 'origin', 't/ST-9');
  };
  commitScript('A');
  pushMain(c, 'next.txt', 'next\n');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();

  // never allowed: refused with one reason that names the command and the way to allow it; nothing ran, nothing moved
  const never = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(never.code).toBe(2);
  expect(never.err).toContain('git.sync "node scripts/sync.mjs"');
  expect(never.err).toContain('accord trust');
  expect(tags(marker)).toEqual([]);
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
  expect(gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()).toBe(head);

  // allowed, then a commit that changes only the script file (the command text is identical): refused again
  expect((await trustAllow(sib, ['git.sync'])).code).toBe(0);
  commitScript('B');
  const changed = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(changed.code).toBe(2);
  expect(changed.err).toContain('accord trust');
  expect(changed.err).toContain('changed');
  expect(tags(marker)).toEqual([]);

  // allowed again: it runs, and it is the changed script that ran
  expect((await trustAllow(sib, ['git.sync'])).code).toBe(0);
  const ok = await run(['worktree', 'sync', 'ST-9'], sib);
  expect([ok.code, ok.err]).toEqual([0, '']);
  expect(lines(ok.out)).toContain('synced: t/ST-9 by git.sync - ' + nextLine('synced'));
  expect(tags(marker)).toEqual(['B']);
}, 240_000);

it('risk:security a git.sync with terminal escapes in its text is printed with them escaped, in the refusal and in the failure line (round 3 WR-01, trust)', async () => {
  const c = copy();
  const s = script('process.exit(5);');
  const E = String.fromCharCode(27);
  const sib = atVerify(c, undefined, undefined, `${s.command} # ${E}[2K${E}[1Gnode scripts/sync.mjs`);
  pushMain(c, 'next.txt', 'next\n');
  const refused = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(refused.code).toBe(2);
  expect(refused.err).not.toContain(E);
  expect(refused.err).toContain('<U+001B>[2K<U+001B>[1Gnode scripts/sync.mjs');
  await allow(sib);
  const failed = await run(['worktree', 'sync', 'ST-9'], sib);
  expect(failed.code).toBe(2);
  expect(failed.err).toContain('exited 5');
  expect(failed.err).not.toContain(E);
  expect(failed.err).toContain('<U+001B>[2K');
}, 240_000);

it('risk:security Continue does not run an unallowed git.sync, leaves the branch alone and says how to allow it (owner decision, repository scripts trust)', async () => {
  const c = copy();
  const s = script(MERGE);
  withGit(c, `  sync: '${s.command}'\n`);
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  twoOnMain(c);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect([r.code, r.err]).toEqual([0, '']);
  expect(s.calls()).toEqual([]);
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
  const behind = lines(r.out).filter((l) => l.startsWith('behind:'));
  expect(behind).toHaveLength(1);
  expect(behind[0]).toContain('accord trust');
  // round 3 WR-03: Continue checks the ticket's worktree, so the line names it, not the checkout Continue runs from
  const sibName = (sib.replaceAll('\\', '/').split('/').pop() ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(behind[0]).toMatch(new RegExp(`git\\.sync is not allowed to run here yet - run accord trust in "[^"]*${sibName}" to see what it covers, then accord trust git\\.sync@<the digest it shows> there`));
}, 240_000);

it('risk:security Continue checks and runs the git.sync of the ticket worktree, so following its behind: hint lets the next Continue sync when the two texts differ (round 4 WR-05)', async () => {
  const c = copy();
  const s = script(MERGE);
  withGit(c, `  sync: '${s.command}'\n`);
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  // the ticket edits git.sync, so its text is not the one in the checkout Continue runs from
  const file = sib + '/accord/config.yml';
  writeFiles(sib, { 'accord/config.yml': readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(`sync: '${s.command}'`, `sync: '${s.command} --ticket'`) });
  commitMsg(sib, 'config: the ticket edits git.sync');
  twoOnMain(c);
  const first = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect([first.code, first.err]).toEqual([0, '']);
  expect(s.calls()).toEqual([]);
  expect(lines(first.out).find((l) => l.startsWith('behind:'))).toContain('accord trust');
  // follow the hint: show and allow in the worktree it names, then Continue again
  expect((await trustAllow(sib, ['git.sync'])).code).toBe(0);
  const second = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect([second.code, second.err]).toEqual([0, '']);
  expect(lines(second.out)).toContain('synced: t/ST-9 by git.sync - ' + nextLine('synced'));
  expect(s.calls()).toHaveLength(1);
}, 240_000);
