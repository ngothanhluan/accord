// ST-LN-25, ST-LN-30: `accord worktree merge`, the merge Continue makes, and the clean of done tickets judged by their merge into main, against real git in tmp sandboxes with a bare remote.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { BEHIND, clone, type Clone, conflictOnMain, copy, doneOnRemote, has, laneSBranch, lines, LIVE, mergeOnRemote, pushMain, setTable, sha, stopLines, tableOf, ticketWorktree, twoOnMain, useSandboxes, verifyStage, writeHolds } from './helpers/worktree.js';
import * as limit from '../src/commands/fetch-limit.js';

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
  { tickets: [] },
  { tickets: ['ST-9', 'ST-10', 'ST-11'] },
]);

it('ac-2 continue says the ticket branch is 2 commits behind the remote main and leaves the branch unchanged', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  verifyStage(c.sibling('ST-9'), 'ST-9');
  const before = sha(c, 't/ST-9');
  const o = c.otherClone();
  for (const f of ['a.txt', 'b.txt']) {
    writeFiles(o, { [f]: f + '\n' });
    gitRun(o, 'add', '-A');
    gitRun(o, 'commit', '-q', '-m', f);
  }
  gitRun(o, 'push', '-q', 'origin', 'main');
  expect(sha(c, 'origin/main')).not.toBe(gitRun(o, 'rev-parse', 'HEAD').trim());
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  const out = lines(r.out);
  expect(out[0]).toBe('behind: t/ST-9 is 2 commits behind origin/main; merge them with git merge origin/main');
  expect(out.slice(1, 4)).toEqual(stopLines(c.sibling('ST-9'), 'ST-9'));
  expect(out.filter((l) => l.startsWith('behind:'))).toHaveLength(1);
  expect(sha(c, 't/ST-9')).toBe(before);
  expect(gitRun(c.sibling('ST-9'), 'rev-parse', 'HEAD').trim()).toBe(before);
  expect(gitRun(c.sibling('ST-9'), 'status', '--porcelain')).toBe('');
}, 120_000);

it('ac-3 worktree merge at verify gives the ticket branch a merge commit of its head and the fetched main commit', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const rows = JSON.parse((await run(['status', '--json'], sib)).out) as { id: string; stage: string }[];
  expect(rows.find((r) => r.id === 'ST-9')?.stage).toBe('verify');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  const tip = pushMain(c, 'next.txt', 'next\n');
  const r = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(r.code).toBe(0);
  expect(gitRun(sib, 'rev-parse', 'HEAD^1').trim()).toBe(head);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
  expect(gitRun(sib, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ')).toHaveLength(3);
  expect(gitRun(sib, 'branch', '--show-current').trim()).toBe('t/ST-9');
  expect(gitRun(sib, 'status', '--porcelain')).toBe('');
  expect(existsSync(sib + '/next.txt')).toBe(true);
  expect(gitRun(sib, 'reflog', '-n', '10')).not.toContain('rebase');
  const merged = gitRun(sib, 'rev-parse', 'HEAD').trim();
  const again = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(again.code).toBe(0);
  expect(again.out).toBe('');
  expect(again.err).toBe('');
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(merged);
}, 120_000);

it('ac-4 a merge conflict is aborted names the file exits 2 and the next merge tries again', async () => {
  const c = copy();
  writeFiles(c.root, { 'shared.txt': 'base\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'shared');
  c.git('push', '-q', 'origin', 'main');
  ticketWorktree(c, 'ST-9', 'shared.txt');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  pushMain(c, 'shared.txt', 'main\n');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  for (let i = 0; i < 2; i++) {
    const r = await run(['worktree', 'merge', 'ST-9'], sib);
    expect(r.code).toBe(2);
    expect(r.err).toContain('conflict');
    expect(r.err).toContain('shared.txt');
    expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
    expect(gitRun(sib, 'status', '--porcelain')).toBe('');
    expect(readFileSync(sib + '/shared.txt', 'utf8').replace(/\r/g, '')).toBe('ST-9\n');
    expect(() => gitRun(sib, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')).toThrow();
  }
}, 120_000);

it('risk:complex-branching worktree merge merges the remote-tracking main when a local branch has its short name', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  gitRun(sib, 'branch', 'origin/main', 'HEAD');
  const tip = pushMain(c, 'next.txt', 'next\n');
  const r = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(r.code).toBe(0);
  expect(gitRun(sib, 'rev-parse', 'HEAD^1').trim()).toBe(head);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
  expect(gitRun(sib, 'rev-parse', 'refs/heads/origin/main').trim()).toBe(head);
}, 120_000);

it('risk:complex-branching worktree merge refuses a ticket before verify and merges nothing', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9', { review: false });
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  pushMain(c, 'next.txt', 'next\n');
  const main0 = sha(c, 'origin/main');
  const early = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(early.code).toBe(2);
  expect(early.err).toContain('only at verify');
  expect(early.err).toContain('nothing was merged');
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
  expect(sha(c, 'origin/main')).toBe(main0);
}, 120_000);

it("risk:complex-branching worktree merge refuses on a branch other than the ticket's and merges nothing", async () => {
  const d = copy();
  ticketWorktree(d, 'ST-9');
  verifyStage(d.sibling('ST-9'), 'ST-9');
  const dHead = gitRun(d.sibling('ST-9'), 'rev-parse', 'HEAD').trim();
  pushMain(d, 'next.txt', 'next\n');
  const away = await run(['worktree', 'merge', 'ST-9'], d.root);
  expect(away.code).toBe(2);
  expect(away.err).toContain('t/ST-9');
  expect(away.err).toContain('nothing was merged');
  expect(gitRun(d.sibling('ST-9'), 'rev-parse', 'HEAD').trim()).toBe(dHead);
}, 120_000);

it('risk:complex-branching worktree merge refuses over tracked changes and merges nothing', async () => {
  const e = copy();
  ticketWorktree(e, 'ST-9');
  const eSib = e.sibling('ST-9');
  verifyStage(eSib, 'ST-9');
  const eHead = gitRun(eSib, 'rev-parse', 'HEAD').trim();
  pushMain(e, 'next.txt', 'next\n');
  writeFiles(eSib, { 'ST-9.txt': 'changed\n' });
  const dirty = await run(['worktree', 'merge', 'ST-9'], eSib);
  expect(dirty.code).toBe(2);
  expect(dirty.err).toContain('uncommitted changes');
  expect(readFileSync(eSib + '/ST-9.txt', 'utf8').replace(/\r/g, '')).toBe('changed\n');
  expect(gitRun(eSib, 'rev-parse', 'HEAD').trim()).toBe(eHead);
}, 120_000);

it('risk:data-loss worktree merge never overwrites an ignored file and quotes the git error that stopped it', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  writeFiles(sib, { 'node_modules/keep.txt': 'mine\n' });
  const o = c.otherClone();
  writeFiles(o, { 'node_modules/keep.txt': 'theirs\n' });
  gitRun(o, 'add', '-f', 'node_modules/keep.txt');
  gitRun(o, 'commit', '-q', '-m', 'theirs');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const r = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(r.code).toBe(2);
  expect(r.err).toContain('merge of origin/main into t/ST-9 failed: ');
  expect(r.err).not.toContain('conflict');
  expect(readFileSync(sib + '/node_modules/keep.txt', 'utf8').replace(/\r/g, '')).toBe('mine\n');
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
  expect(() => gitRun(sib, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')).toThrow();
}, 120_000);

// a rename on main whose target is an ignored file present here
it('risk:data-loss worktree merge never overwrites an ignored file that a rename on main targets', async () => {
  const d = copy();
  pushMain(d, 'old.txt', 'old\n');
  ticketWorktree(d, 'ST-9');
  const dSib = d.sibling('ST-9');
  verifyStage(dSib, 'ST-9');
  const dHead = gitRun(dSib, 'rev-parse', 'HEAD').trim();
  writeFiles(dSib, { 'node_modules/moved.txt': 'mine\n' });
  const p = d.otherClone();
  mkdirSync(p + '/node_modules');
  gitRun(p, 'mv', 'old.txt', 'node_modules/moved.txt');
  gitRun(p, 'commit', '-q', '-m', 'rename');
  gitRun(p, 'push', '-q', 'origin', 'main');
  const rr = await run(['worktree', 'merge', 'ST-9'], dSib);
  expect(rr.code).toBe(2);
  expect(rr.err).toContain('node_modules/moved.txt');
  expect(readFileSync(dSib + '/node_modules/moved.txt', 'utf8').replace(/\r/g, '')).toBe('mine\n');
  expect(gitRun(dSib, 'rev-parse', 'HEAD').trim()).toBe(dHead);
}, 120_000);

// a non-ASCII path, which git quotes and octal-escapes by default
it('risk:data-loss worktree merge names a non-ASCII ignored file it would overwrite', async () => {
  const u = copy();
  ticketWorktree(u, 'ST-9');
  const uSib = u.sibling('ST-9');
  verifyStage(uSib, 'ST-9');
  const uHead = gitRun(uSib, 'rev-parse', 'HEAD').trim();
  writeFiles(uSib, { 'node_modules/é.txt': 'mine\n' });
  const q = u.otherClone();
  writeFiles(q, { 'node_modules/é.txt': 'theirs\n' });
  gitRun(q, 'add', '-f', 'node_modules/é.txt');
  gitRun(q, 'commit', '-q', '-m', 'theirs');
  gitRun(q, 'push', '-q', 'origin', 'main');
  const ur = await run(['worktree', 'merge', 'ST-9'], uSib);
  expect(ur.code).toBe(2);
  expect(ur.err).toContain('node_modules/é.txt');
  expect(readFileSync(uSib + '/node_modules/é.txt', 'utf8').replace(/\r/g, '')).toBe('mine\n');
  expect(gitRun(uSib, 'rev-parse', 'HEAD').trim()).toBe(uHead);
}, 120_000);

// a case-only rename on main of a file this branch tracks is no overwrite, on either kind of filesystem
it('risk:complex-branching worktree merge takes a case-only rename on main of a tracked file', async () => {
  const k = copy();
  pushMain(k, 'README.md', 'readme\n');
  k.git('fetch', '-q', 'origin');
  ticketWorktree(k, 'ST-9');
  const kSib = k.sibling('ST-9');
  verifyStage(kSib, 'ST-9');
  const kHead = gitRun(kSib, 'rev-parse', 'HEAD').trim();
  const w = k.otherClone();
  gitRun(w, 'mv', 'README.md', 'Readme.md');
  gitRun(w, 'commit', '-q', '-m', 'case rename');
  gitRun(w, 'push', '-q', 'origin', 'main');
  const kr = await run(['worktree', 'merge', 'ST-9'], kSib);
  expect(kr.err).toBe('');
  expect(kr.code).toBe(0);
  expect(gitRun(kSib, 'rev-parse', 'HEAD^1').trim()).toBe(kHead);
}, 120_000);

// a main that adds so many files that the pathspec list alone passes the Windows command-line limit of 32767 characters
it('risk:regression worktree merge of a main that adds 500 long paths passes the Windows command-line limit', async () => {
  const m = copy();
  ticketWorktree(m, 'ST-9');
  const mSib = m.sibling('ST-9');
  verifyStage(mSib, 'ST-9');
  const mHead = gitRun(mSib, 'rev-parse', 'HEAD').trim();
  const many: Record<string, string> = {};
  for (let i = 0; i < 500; i++) many[`big/${'n'.repeat(70)}-${i}.txt`] = 'x\n';
  const mo = m.otherClone();
  writeFiles(mo, many);
  gitRun(mo, 'add', '-A');
  gitRun(mo, 'commit', '-q', '-m', 'many');
  gitRun(mo, 'push', '-q', 'origin', 'main');
  const mr = await run(['worktree', 'merge', 'ST-9'], mSib);
  expect(mr.err).toBe('');
  expect(mr.code).toBe(0);
  expect(gitRun(mSib, 'rev-parse', 'HEAD^1').trim()).toBe(mHead);
}, 120_000);

it('risk:complex-branching a merge that changes the pinned accord version keeps the merge and names the pin', async () => {
  const c = clone();
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  verifyStage(sib, 'ST-9');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  const o = c.otherClone();
  const cfg = o + '/accord/config.yml';
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace('accord: "0.4.0"', 'accord: "9.9.9"'));
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', 'pin');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const tip = gitRun(o, 'rev-parse', 'HEAD').trim();
  const r = await run(['worktree', 'merge', 'ST-9'], sib);
  expect(r.code).toBe(2);
  expect(r.err).toContain('pins accord 9.9.9');
  expect(gitRun(sib, 'rev-parse', 'HEAD^1').trim()).toBe(head);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
}, 120_000);

it('ac-5 a failed or silent fetch is one accord line at pick up new ticket continue and merge and the work goes on', async () => {
  const P = 'fetch from origin failed, going on with the refs already in this clone: ';
  const one = (out: string, err: string) => {
    const all = lines(out + err);
    const f = all.filter((l) => l.includes('fetch'));
    expect(f).toHaveLength(1);
    expect(f[0].startsWith(P)).toBe(true);
    expect(f[0].length).toBeGreaterThan(P.length);
    expect(all.some((l) => l.startsWith('fatal:'))).toBe(false);
    return f[0];
  };
  const missing = (c: Clone) => c.git('remote', 'set-url', 'origin', c.remote + '-missing');

  const c = copy();
  missing(c);
  const base = sha(c, 'origin/main');
  const rc = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(rc.code).toBe(0);
  one(rc.out, rc.err);
  expect(sha(c, 't/ST-9^')).toBe(base);

  const d = copy({ tickets: [] });
  missing(d);
  d.git('remote', 'set-url', '--push', 'origin', d.remote);
  const rd = await run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], d.root);
  expect(rd.code).toBe(0);
  one(rd.out, rd.err);

  const e = copy();
  ticketWorktree(e, 'ST-9');
  missing(e);
  const re = await run(['worktree', 'open', 'ST-9', '--continue'], e.root);
  expect(re.code).toBe(0);
  one(re.out, re.err);
  expect(lines(re.out).slice(-3)).toEqual(stopLines(e.sibling('ST-9'), 'ST-9'));

  const f = copy();
  ticketWorktree(f, 'ST-9');
  verifyStage(f.sibling('ST-9'), 'ST-9');
  missing(f);
  const head = gitRun(f.sibling('ST-9'), 'rev-parse', 'HEAD').trim();
  const rf = await run(['worktree', 'merge', 'ST-9'], f.sibling('ST-9'));
  expect(rf.code).toBe(0);
  one(rf.out, rf.err);
  expect(gitRun(f.sibling('ST-9'), 'rev-parse', 'HEAD').trim()).toBe(head);

  const g = copy();
  const release = `${g.root}/.git/hang-release`;
  const ended = `${g.root}/.git/hang-ended`;
  // the remote stays silent until the test releases it, 60 s at most, then marks that it ended
  g.git('config', 'remote.origin.uploadpack', `cd / && i=0; while [ ! -f '${release}' ] && [ $i -lt 60 ]; do sleep 1; i=$((i+1)); done; : > '${ended}'; :`);
  vi.mocked(limit.fetchLimitMs).mockReturnValue(2000);
  try {
    const t0 = Date.now();
    const rg = await run(['worktree', 'open', 'ST-9'], g.root);
    expect(rg.code).toBe(0);
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(one(rg.out, rg.err)).toBe(P + 'no answer within 2 seconds');
    expect(sha(g, 't/ST-9^')).toBe(sha(g, 'origin/main'));
  } finally {
    writeFileSync(release, '');
    // the killed fetch leaves its upload-pack shell running, and on Windows it keeps the clone from being removed
    for (let i = 0; i < 100 && !existsSync(ended); i++) await new Promise((r) => setTimeout(r, 100));
  }
}, 120_000);

it('ac-4 continue merges the latest origin main into a ticket branch before verify runs setup on the merge and pushes it', async () => {
  const c = copy({ setup: ['node setup-step.js ci'] });
  ticketWorktree(c, 'ST-9');
  const sib = c.sibling('ST-9');
  const before = sha(c, 't/ST-9');
  const o = c.otherClone();
  writeFiles(o, { 'setup-step.js': "require('node:fs').appendFileSync('setup.log', 'merged ' + process.argv[2] + '\\n');\n", 'a.txt': 'a\n' });
  commitMsg(o, 'a');
  writeFiles(o, { 'b.txt': 'b\n' });
  const tip = commitMsg(o, 'b');
  gitRun(o, 'push', '-q', 'origin', 'main');
  expect(sha(c, 'origin/main')).not.toBe(tip);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(0);
  expect(gitRun(sib, 'rev-parse', 'HEAD^1').trim()).toBe(before);
  expect(gitRun(sib, 'rev-parse', 'HEAD^2').trim()).toBe(tip);
  expect(gitRun(sib, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ')).toHaveLength(3);
  expect(gitRun(sib, 'branch', '--show-current').trim()).toBe('t/ST-9');
  expect(gitRun(sib, 'reflog', '-n', '10')).not.toContain('rebase');
  const head = gitRun(sib, 'rev-parse', 'HEAD').trim();
  expect(sha(c, 't/ST-9')).toBe(head);
  expect(gitRun(c.remote, 'rev-parse', 't/ST-9').trim()).toBe(head);
  expect(readFileSync(sib + '/setup.log', 'utf8')).toBe('merged ci\n');
  const out = lines(r.out);
  expect(out).toContain('merged: 2 commits of origin/main into t/ST-9');
  expect(out.some((l) => l.startsWith('behind:'))).toBe(false);
  expect(out.slice(-3)).toEqual(stopLines(sib, 'ST-9'));

  const s = copy({ setup: ['node setup-step.js ci'] });
  ticketWorktree(s, 'ST-9');
  const ss = s.sibling('ST-9');
  const marker = gitRun(ss, 'rev-parse', '--path-format=absolute', '--git-dir').trim() + '/accord-setup-done';
  writeFileSync(marker, '');
  const so = s.otherClone();
  writeFiles(so, { 'setup-step.js': 'process.exit(3);\n' });
  commitMsg(so, 'break setup');
  gitRun(so, 'push', '-q', 'origin', 'main');
  const bad = await run(['worktree', 'open', 'ST-9', '--continue'], s.root);
  expect(bad.code).toBe(2);
  expect(bad.err).toContain('setup command failed');
  expect(existsSync(marker)).toBe(false);
  expect(gitRun(s.remote, 'rev-parse', 't/ST-9').trim()).toBe(gitRun(ss, 'rev-parse', 'HEAD').trim());
  const again = await run(['worktree', 'open', 'ST-9', '--continue'], ss);
  expect(again.code).toBe(2);
  expect(again.err).toContain('setup command failed');
}, 120_000);

it('risk:data-loss a continue merge that conflicts is aborted names the file and pushes nothing', async () => {
  const c = copy();
  writeFiles(c.root, { 'shared.txt': 'base\n' });
  commitMsg(c.root, 'shared');
  c.git('push', '-q', 'origin', 'main');
  ticketWorktree(c, 'ST-9', 'shared.txt');
  const sib = c.sibling('ST-9');
  const head = sha(c, 't/ST-9');
  const o = c.otherClone();
  writeFiles(o, { 'shared.txt': 'main\n' });
  commitMsg(o, 'shared main');
  gitRun(o, 'push', '-q', 'origin', 'main');
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('conflict');
  expect(r.err).toContain('shared.txt');
  expect(r.err).toContain(`git -C "${sib}" merge origin/main`);
  expect(gitRun(sib, 'rev-parse', 'HEAD').trim()).toBe(head);
  expect(gitRun(sib, 'status', '--porcelain', '--untracked-files=no')).toBe('');
  expect(readFileSync(sib + '/shared.txt', 'utf8').replaceAll('\r\n', '\n')).toBe('ST-9\n'); // autocrlf on Windows checks out CRLF
  expect(() => gitRun(sib, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')).toThrow();
  expect(gitRun(c.remote, 'rev-parse', 't/ST-9').trim()).toBe(head);
}, 180_000);

it('risk:data-loss continue does not merge into a worktree with uncommitted changes and says it is behind', async () => {
  const d = copy();
  ticketWorktree(d, 'ST-9');
  const dSib = d.sibling('ST-9');
  const dHead = gitRun(dSib, 'rev-parse', 'HEAD').trim();
  writeFiles(dSib, { 'ST-9.txt': 'changed\n' });
  twoOnMain(d);
  const rd = await run(['worktree', 'open', 'ST-9', '--continue'], d.root);
  expect(rd.code).toBe(0);
  expect(lines(rd.out)[0]).toBe(BEHIND);
  expect(lines(rd.out).some((l) => l.startsWith('merged:'))).toBe(false);
  expect(gitRun(dSib, 'rev-parse', 'HEAD').trim()).toBe(dHead);
  expect(readFileSync(dSib + '/ST-9.txt', 'utf8')).toBe('changed\n');
}, 180_000);

it('risk:data-loss continue does not merge into a worktree a live session holds and says it is behind', async () => {
  const h = copy();
  ticketWorktree(h, 'ST-9');
  const hHead = sha(h, 't/ST-9');
  writeHolds(h, { 'ST-9': LIVE });
  setTable(tableOf(LIVE));
  twoOnMain(h);
  const rh = await run(['worktree', 'open', 'ST-9', '--continue'], h.root, {});
  expect(rh.code).toBe(0);
  expect(lines(rh.out)[0]).toBe(BEHIND);
  expect(lines(rh.out).some((l) => l.startsWith('merged:'))).toBe(false);
  expect(sha(h, 't/ST-9')).toBe(hHead);
  expect(gitRun(h.remote, 'rev-parse', 't/ST-9').trim()).toBe(hHead);
}, 180_000);

// the remote branch has a commit this clone's branch lacks: no merge into the stale tip, nothing pushed
it('risk:data-loss continue does not merge into a branch whose origin copy has a teammate commit and pushes nothing', async () => {
  const m = copy();
  ticketWorktree(m, 'ST-9');
  const mHead = sha(m, 't/ST-9');
  twoOnMain(m);
  const mo = m.otherClone();
  gitRun(mo, 'checkout', '-q', 't/ST-9');
  writeFiles(mo, { 'mate.txt': 'mate\n' });
  const mate = commitMsg(mo, 'mate');
  gitRun(mo, 'push', '-q', 'origin', 't/ST-9');
  const rm = await run(['worktree', 'open', 'ST-9', '--continue'], m.root);
  expect(rm.code).toBe(0);
  expect(lines(rm.out)[0]).toBe(BEHIND);
  expect(lines(rm.out).some((l) => l.startsWith('merged:') || l.startsWith('push of'))).toBe(false);
  expect(sha(m, 't/ST-9')).toBe(mHead);
  expect(gitRun(m.remote, 'rev-parse', 't/ST-9').trim()).toBe(mate);
}, 180_000);

it('risk:data-loss clean removes only a done ticket and keeps a branch with a commit after its verified commit', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  for (const x of ['ST-9', 'ST-10', 'ST-11']) ticketWorktree(c, x);
  const t = doneOnRemote(c, ['ST-9', 'ST-11'], { squash: true, local: true });
  mergeOnRemote(c, 'ST-10');
  const sib9 = c.sibling('ST-9');
  writeFiles(sib9, { 'late.txt': 'late\n' });
  const late = commitMsg(sib9, 'late');
  const r1 = await run(['worktree', 'clean'], c.root);
  expect(r1.code).toBe(0);
  expect(lines(r1.out)).toEqual([
    `removed ${c.sibling('ST-11')}`,
    `deleted t/ST-11 (was ${t['ST-11']})`,
    `deleted origin/t/ST-11 (was ${t['ST-11']})`,
    'kept t/ST-9: it has commits after its verified commit',
  ]);
  expect(existsSync(c.sibling('ST-11'))).toBe(false);
  expect(has(c.root, 'refs/heads/t/ST-11')).toBe(false);
  expect(existsSync(sib9)).toBe(true);
  expect(existsSync(c.sibling('ST-10'))).toBe(true);
  expect(sha(c, 't/ST-9')).toBe(late);
  expect(has(c.root, 'refs/heads/t/ST-10')).toBe(true);
}, 240_000);

it('risk:data-loss clean keeps a done ticket branch that a stopped rebase in its worktree is rebuilding', async () => {
  const e = copy();
  ticketWorktree(e, 'ST-9');
  doneOnRemote(e, ['ST-9'], { squash: true });
  const esib = e.sibling('ST-9');
  try {
    gitRun(esib, 'rebase', '-q', '--force-rebase', '--exec', 'false', 'HEAD~1');
  } catch {
    // the exec line fails on purpose, leaving the rebase stopped
  }
  expect(gitRun(esib, 'branch', '--show-current').trim()).toBe('');
  const r2 = await run(['worktree', 'clean'], e.root);
  expect(r2.code).toBe(0);
  expect(lines(r2.out)).toEqual([`kept t/ST-9: being rebased in ${esib}`]);
  expect(existsSync(esib)).toBe(true);
  expect(has(e.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(e.remote, 'refs/heads/t/ST-9')).toBe(true);
  gitRun(esib, 'rebase', '--abort');
}, 240_000);

it('risk:data-loss clean deletes a done lane S branch with no verified commit only when its merge into main changes nothing', async () => {
  const f = copy();
  writeFiles(f.root, { 'shared.txt': Array.from({ length: 10 }, (_, i) => `l${i + 1}\n`).join('') });
  commitMsg(f.root, 'shared');
  gitRun(f.root, 'push', '-q', 'origin', 'main');
  const shared = (first: string, last: string) => Array.from({ length: 10 }, (_, i) => (i === 0 ? first : i === 9 ? last : `l${i + 1}`) + '\n').join('');
  const t12 = await laneSBranch(f, 'ST-12', undefined, () => writeFiles(f.sibling('ST-12'), { 'shared.txt': shared('ST-12', 'l10') }));
  await laneSBranch(f, 'ST-13');
  const fo = f.otherClone();
  gitRun(fo, 'fetch', '-q', 'origin');
  for (const x of ['ST-12', 'ST-13']) {
    gitRun(fo, 'merge', '--squash', '-q', `origin/t/${x}`);
    commitMsg(fo, 'merge ' + x);
  }
  writeFiles(fo, { 'shared.txt': shared('ST-12', 'main') });
  commitMsg(fo, 'main edit');
  gitRun(fo, 'push', '-q', 'origin', 'main');
  const rows = JSON.parse((await run(['status', '--json'], fo)).out) as { id: string; stage: string }[];
  for (const x of ['ST-12', 'ST-13']) expect(rows.find((r) => r.id === x)?.stage).toBe('done');
  expect(readFileSync(`${fo}/accord/tickets/ST-12.md`, 'utf8')).not.toContain('verified_commit:');
  expect(readFileSync(`${fo}/accord/tickets/ST-13.md`, 'utf8')).not.toContain('verified_commit:');
  expect(gitRun(fo, 'diff', '--name-only', 'origin/t/ST-12', 'main', '--', 'shared.txt').trim()).toBe('shared.txt');
  writeFiles(f.sibling('ST-13'), { 'late.txt': 'late\n' });
  commitMsg(f.sibling('ST-13'), 'late');
  const r3 = await run(['worktree', 'clean'], f.root);
  expect(r3.code).toBe(0);
  expect(lines(r3.out)).toEqual([
    `removed ${f.sibling('ST-12')}`,
    `deleted t/ST-12 (was ${t12})`,
    `deleted origin/t/ST-12 (was ${t12})`,
    'kept t/ST-13: it has changes not on origin/main',
  ]);
  expect(has(f.remote, 'refs/heads/t/ST-13')).toBe(true);
  expect(r3.out).not.toContain('verified commit');
  expect(existsSync(f.sibling('ST-13'))).toBe(true);
  expect(has(f.root, 'refs/heads/t/ST-13')).toBe(true);
  expect(has(f.root, 'refs/heads/t/ST-12')).toBe(false);
}, 240_000);

it('risk:data-loss clean keeps a done lane S branch whose merge into main conflicts', async () => {
  const g = copy();
  const t14 = await laneSBranch(g, 'ST-14', 'added.txt');
  const sg = g.sibling('ST-14');
  const go = conflictOnMain(g);
  const grows = JSON.parse((await run(['status', '--json'], go)).out) as { id: string; stage: string }[];
  expect(grows.find((r) => r.id === 'ST-14')?.stage).toBe('done');
  let status: unknown;
  try {
    execFileSync('git', ['merge-tree', '--write-tree', 'main', 'origin/t/ST-14'], { cwd: go, stdio: 'pipe' });
  } catch (err) {
    status = (err as { status?: number }).status;
  }
  expect(status).toBe(1);
  const r4 = await run(['worktree', 'clean'], g.root);
  expect(r4.code).toBe(0);
  expect(lines(r4.out)).toEqual(['kept t/ST-14: merging it into origin/main conflicts']);
  expect(existsSync(sg)).toBe(true);
  expect(sha(g, 't/ST-14')).toBe(t14);
  expect(has(g.remote, 'refs/heads/t/ST-14')).toBe(true);
}, 240_000);

it('risk:data-loss clean keeps a done lane S origin branch whose merge into main conflicts', async () => {
  const g = copy();
  const t14 = await laneSBranch(g, 'ST-14', 'added.txt');
  const sg = g.sibling('ST-14');
  conflictOnMain(g);
  gitRun(g.root, 'worktree', 'remove', '--force', sg);
  g.git('update-ref', '-d', 'refs/heads/t/ST-14');
  const r5 = await run(['worktree', 'clean'], g.root);
  expect(r5.code).toBe(0);
  expect(lines(r5.out)).toEqual(['kept origin/t/ST-14: merging it into origin/main conflicts']);
  expect(gitRun(g.remote, 'rev-parse', 't/ST-14').trim()).toBe(t14);
}, 240_000);

it('risk:data-loss clean keeps a done ticket branch whose commit after verify conflicts with main', async () => {
  const h = copy();
  ticketWorktree(h, 'ST-15');
  doneOnRemote(h, ['ST-15'], { squash: true, local: true });
  const sh = h.sibling('ST-15');
  writeFiles(sh, { 'accord/tickets/ST-15/ledger.md': 'Correction: not on main\n' });
  const owner = commitMsg(sh, 'owner correction');
  const r6 = await run(['worktree', 'clean'], h.root);
  expect(r6.code).toBe(0);
  expect(lines(r6.out)).toEqual(['kept t/ST-15: merging it into origin/main conflicts']);
  expect(existsSync(sh)).toBe(true);
  expect(sha(h, 't/ST-15')).toBe(owner);
  expect(has(h.remote, 'refs/heads/t/ST-15')).toBe(true);
}, 240_000);

it('risk:data-loss clean keeps an origin branch whose lease is stale and names the failed push', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9'], { squash: true, local: true });
  const tip = sha(c, 't/ST-9');
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', '-c', 'elsewhere');
  writeFiles(o, { 'e.txt': 'e\n' });
  const S2 = commitMsg(o, 'elsewhere');
  gitRun(o, 'push', '-q', 'origin', 'elsewhere');
  const hook = `${c.root}/.git/hooks/pre-push`;
  writeFileSync(hook, `#!/bin/sh\ngit --git-dir="${c.remote.replaceAll('\\', '/')}" update-ref refs/heads/t/ST-9 ${S2}\nexit 0\n`);
  chmodSync(hook, 0o755);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const l = lines(r.out);
  expect(l).toHaveLength(3);
  expect(l[0]).toBe(`removed ${c.sibling('ST-9')}`);
  expect(l[1]).toBe(`deleted t/ST-9 (was ${tip})`);
  expect(l[2].startsWith('kept origin/t/ST-9: git push failed: ')).toBe(true);
  expect(gitRun(c.remote, 'rev-parse', 't/ST-9').trim()).toBe(S2);
}, 240_000);

it('risk:data-loss clean after a failed fetch deletes the local branch and never the origin branch', async () => {
  const d = copy();
  ticketWorktree(d, 'ST-9');
  const tD = doneOnRemote(d, ['ST-9'], { squash: true, local: true });
  const tipD = sha(d, 't/ST-9');
  d.git('fetch', '-q', 'origin');
  d.git('remote', 'set-url', 'origin', d.remote + '-missing');
  const rd = lines((await run(['worktree', 'clean'], d.root)).out);
  expect(rd).toHaveLength(3);
  expect(rd[0].startsWith('fetch from origin failed')).toBe(true);
  expect(rd[1]).toBe(`removed ${d.sibling('ST-9')}`);
  expect(rd[2]).toBe(`deleted t/ST-9 (was ${tipD})`);
  expect(gitRun(d.remote, 'rev-parse', 't/ST-9').trim()).toBe(tD['ST-9']);
}, 240_000);

it('risk:data-loss clean deletes no origin branch that the prune already removed', async () => {
  const e = copy();
  ticketWorktree(e, 'ST-9');
  doneOnRemote(e, ['ST-9'], { squash: true, local: true });
  const tipE = sha(e, 't/ST-9');
  gitRun(e.remote, 'branch', '-D', 't/ST-9');
  const re = lines((await run(['worktree', 'clean'], e.root)).out);
  expect(re).toContain(`pruned refs/remotes/origin/t/ST-9 (was ${tipE})`);
  expect(re).toContain(`removed ${e.sibling('ST-9')}`);
  expect(re).toContain(`deleted t/ST-9 (was ${tipE})`);
  expect(re.some((x) => x.startsWith('kept origin/') || x.startsWith('deleted origin/'))).toBe(false);
}, 240_000);
