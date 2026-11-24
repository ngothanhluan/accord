// Phase 08.9 D-07, split from worktree-clean.test.ts: what a done ticket worktree keeps and deletes when `accord worktree clean` removes it, the removal guards and the sibling sweep (ST-LN-7, ST-LN-20, ST-LN-55).
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import * as proc from '../src/load/proc.js';
import { ALIVE, exclude, forget, gone, link, listing, recorded } from './helpers/done.js';
import { spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, copy, DEAD, doneOnRemote, lines, readHolds, sha, useSandboxes, withAction, writeHolds } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

afterEach(() => {
  vi.mocked(limit.cleanBudgetMs).mockReset();
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

useSandboxes([
  {},
  { tickets: ['ST-9', 'ST-10'] },
  { tickets: ['ST-9', 'ST-10', 'ST-11'] },
]);

it('risk:data-loss clean keeps a worktree holding an ignored env file when status shows no untracked files', async () => {
  const c = copy();
  exclude(c, ['.env']);
  claimWorktree(c, 'ST-9');
  writeFiles(c.sibling('ST-9'), { '.env': 'SECRET=1\n' });
  doneOnRemote(c, ['ST-9']);
  c.git('config', 'status.showUntrackedFiles', 'no');
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(withAction(`kept ${c.sibling('ST-9')}: .env`));
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(readFileSync(`${c.sibling('ST-9')}/.env`, 'utf8')).toBe('SECRET=1\n');
}, 120_000);

it('risk:data-loss the disposable list in config.yml decides which ignored folders a done worktree may hold and still be removed', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  exclude(c, ['coverage/', 'dist/']);
  claimWorktree(c, 'ST-9');
  writeFiles(c.sibling('ST-9'), { 'coverage/x': 'x' });
  claimWorktree(c, 'ST-10');
  writeFiles(c.sibling('ST-10'), { 'dist/x': 'x' });
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const cfg = `${c.root}/accord/config.yml`;
  const text = readFileSync(cfg, 'utf8').trimEnd();
  writeFileSync(cfg, text + '\ndisposable: [node_modules]\n');
  const a = await run(['worktree', 'clean'], c.root);
  expect(a.code).toBe(0);
  const A = lines(a.out);
  expect(A.some((l) => l.startsWith(`kept ${c.sibling('ST-9')}: coverage/`))).toBe(true);
  expect(A.some((l) => l.startsWith(`kept ${c.sibling('ST-10')}: dist/`))).toBe(true);
  expect(A.some((l) => l.startsWith('removed'))).toBe(false);
  const listed = c.git('worktree', 'list', '--porcelain');
  expect(listed).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(listed).toContain(`worktree ${c.sibling('ST-10')}\n`);
  expect(readFileSync(`${c.sibling('ST-10')}/dist/x`, 'utf8')).toBe('x');
  writeFileSync(cfg, text + '\ndisposable: [node_modules, dist, coverage]\n');
  const b = await run(['worktree', 'clean'], c.root);
  expect(b.code).toBe(0);
  const B = lines(b.out);
  expect(B).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(B).toContain(withAction(`removed ${c.sibling('ST-10')}`));
  expect(gone(c.sibling('ST-9'))).toBe(true);
  expect(gone(c.sibling('ST-10'))).toBe(true);
}, 120_000);

it('risk:regression a done worktree holding only executor report folders is removed, with the default list and with a disposable list in config.yml', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  for (const id of ['ST-9', 'ST-10']) {
    claimWorktree(c, id);
    writeFiles(c.sibling(id), { '.accord-reports/.gitignore': '*\n', [`.accord-reports/${id}/task-1.md`]: 'red reason: x\n' });
  }
  doneOnRemote(c, ['ST-9']);
  const a = await run(['worktree', 'clean'], c.root);
  expect(a.code).toBe(0);
  expect(lines(a.out)).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(gone(c.sibling('ST-9'))).toBe(true);
  const cfg = `${c.root}/accord/config.yml`;
  writeFileSync(cfg, readFileSync(cfg, 'utf8').trimEnd() + '\ndisposable: [node_modules]\n');
  doneOnRemote(c, ['ST-10']);
  const b = await run(['worktree', 'clean'], c.root);
  expect(b.code).toBe(0);
  expect(lines(b.out)).toContain(withAction(`removed ${c.sibling('ST-10')}`));
  expect(gone(c.sibling('ST-10'))).toBe(true);
}, 120_000);

it('risk:regression a folder git reports removed but leaves links and disposable files in is deleted before removed is printed', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  spawnLog.after = (args) => {
    if (args[0] === 'worktree' && args[1] === 'remove') {
      const p = args[2]!;
      link(`${c.root}/accord`, `${p}/node_modules/@x/ws`);
      mkdirSync(`${p}/a/b`, { recursive: true });
      writeFiles(p, { 'dist/index.js': 'x' });
    }
  };
  spawnLog.on = true;
  const r = await run(['worktree', 'clean'], c.root);
  spawnLog.on = false;
  expect(r.code).toBe(0);
  expect(gone(c.sibling('ST-9'))).toBe(true);
  const L = lines(r.out);
  expect(L).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(L.some((l) => l.startsWith(`kept ${c.sibling('ST-9')}`))).toBe(false);
  expect(existsSync(`${c.root}/accord/config.yml`)).toBe(true);
}, 120_000);

it('risk:complex-branching a worktree remove that fails after git unregistered the folder keeps and names the file left in it', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  const t = doneOnRemote(c, ['ST-9']);
  const sha9 = sha(c, 't/ST-9');
  writeHolds(c, { 'ST-9': { ...DEAD, folder: c.sibling('ST-9') } });
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  spawnLog.fail = (args) => {
    if (args[0] !== 'worktree' || args[1] !== 'remove') return false;
    spawnLog.on = false;
    try {
      gitRun(c.root, ...args);
      writeFiles(args[2]!, { 'sub/f.txt': 'left\n' });
    } finally {
      spawnLog.on = true;
    }
    return true;
  };
  spawnLog.on = true;
  const r = await run(['worktree', 'clean'], c.root);
  spawnLog.on = false;
  expect(r.code).toBe(0);
  expect(lines(r.out)).toEqual([withAction(`kept ${c.sibling('ST-9')}: sub/f.txt`), withAction(`deleted t/ST-9 (was ${sha9})`), withAction(`deleted origin/t/ST-9 (was ${t['ST-9']})`)]);
  expect(readFileSync(`${c.sibling('ST-9')}/sub/f.txt`, 'utf8')).toBe('left\n');
  expect(c.git('worktree', 'list', '--porcelain')).not.toContain(c.sibling('ST-9'));
  expect(Object.keys(readHolds(c))).toEqual([]);
}, 120_000);

it('risk:data-loss a forgotten folder holding a dist file or a recorded path that is a link is kept unchanged and named', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  for (const id of ['ST-9', 'ST-10']) expect((await run(['worktree', 'open', id], c.root)).code).toBe(0);
  forget(c, 'ST-9');
  writeFiles(c.sibling('ST-9'), { 'dist/index.js': 'modified\n' });
  link(`${c.root}/accord`, `${c.sibling('ST-9')}/node_modules/outside`);
  mkdirSync(`${c.sibling('ST-9')}/empty`);
  c.git('worktree', 'remove', '--force', c.sibling('ST-10'));
  const t = c.sibling('ST-11');
  mkdirSync(`${t}/a/b`, { recursive: true });
  link(`${c.root}/accord`, `${t}/l`);
  link(t, c.sibling('ST-10'));
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const before = listing(c.sibling('ST-9'));
  const beforeT = listing(t);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(withAction(`kept ${c.sibling('ST-9')}: dist/index.js`));
  expect(L).toContain(withAction(`kept ${c.sibling('ST-10')}: it is a link`));
  expect(listing(c.sibling('ST-9'))).toEqual(before);
  expect(listing(t)).toEqual(beforeT);
  expect(lstatSync(c.sibling('ST-10')).isSymbolicLink()).toBe(true);
  expect(recorded(c).map((e) => e.path)).toEqual([c.sibling('ST-9'), c.sibling('ST-10')]);
}, 120_000);

it('risk:data-loss clean keeps a done worktree that holds another listed worktree', async () => {
  const c = copy();
  claimWorktree(c, 'ST-9');
  const n = c.sibling('ST-9') + '/node_modules/nested';
  c.git('worktree', 'add', '-q', '-b', 'scratch', n, 'origin/main');
  doneOnRemote(c, ['ST-9']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(withAction(`kept ${c.sibling('ST-9')}: it holds the worktree ${n}`));
  const listed = c.git('worktree', 'list', '--porcelain');
  expect(listed).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(listed).toContain(`worktree ${n}\n`);
  expect(existsSync(`${n}/accord/config.yml`)).toBe(true);
}, 120_000);

it('risk:data-loss clean keeps a done worktree whose disposable folder holds a nested repository', async () => {
  const c = copy();
  exclude(c, ['dist/']);
  claimWorktree(c, 'ST-9');
  const n = c.sibling('ST-9') + '/dist/pkg';
  mkdirSync(n, { recursive: true });
  gitRun(n, 'init', '-q');
  writeFiles(n, { 'a.txt': 'a\n' });
  const N = commitMsg(n, 'nested work');
  doneOnRemote(c, ['ST-9']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(withAction(`kept ${c.sibling('ST-9')}: holds a repository: dist/pkg/.git`));
  expect(L.some((l) => l.startsWith(`removed ${c.sibling('ST-9')}`))).toBe(false);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${c.sibling('ST-9')}\n`);
  expect(gitRun(n, 'rev-parse', 'HEAD').trim()).toBe(N);
}, 120_000);

it('risk:data-loss clean keeps a done worktree holding an edit in a skip-worktree or assume-unchanged file', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  claimWorktree(c, 'ST-9');
  claimWorktree(c, 'ST-10');
  const s9 = c.sibling('ST-9');
  gitRun(s9, 'update-index', '--skip-worktree', 'ST-9.txt');
  writeFileSync(`${s9}/ST-9.txt`, 'edited\n');
  const s10 = c.sibling('ST-10');
  gitRun(s10, 'update-index', '--assume-unchanged', 'ST-10.txt');
  writeFileSync(`${s10}/ST-10.txt`, 'edited\n');
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(withAction(`kept ${s9}: has an edit git status hides: ST-9.txt`));
  expect(L).toContain(withAction(`kept ${s10}: has an edit git status hides: ST-10.txt`));
  expect(L.some((l) => l.startsWith('removed'))).toBe(false);
  const listed = c.git('worktree', 'list', '--porcelain');
  expect(listed).toContain(`worktree ${s9}\n`);
  expect(listed).toContain(`worktree ${s10}\n`);
  expect(readFileSync(`${s9}/ST-9.txt`, 'utf8')).toBe('edited\n');
  expect(readFileSync(`${s10}/ST-10.txt`, 'utf8')).toBe('edited\n');
}, 120_000);

it('risk:data-loss a forgotten folder holding a listed worktree or a git folder is kept unchanged', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  for (const id of ['ST-9', 'ST-10']) {
    expect((await run(['worktree', 'open', id], c.root)).code).toBe(0);
    forget(c, id);
  }
  const inner = c.sibling('ST-9') + '/inner';
  c.git('worktree', 'add', '-q', '-b', 'scratch', inner, 'origin/main');
  mkdirSync(`${c.sibling('ST-9')}/empty`);
  mkdirSync(`${c.sibling('ST-10')}/sub/.git`, { recursive: true });
  link(`${c.root}/accord`, `${c.sibling('ST-10')}/l`);
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const before9 = listing(c.sibling('ST-9'));
  const before10 = listing(c.sibling('ST-10'));
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(L).toContain(withAction(`kept ${c.sibling('ST-9')}: inner`));
  expect(L).toContain(withAction(`kept ${c.sibling('ST-10')}: holds a repository: sub/.git`));
  expect(listing(c.sibling('ST-9'))).toEqual(before9);
  expect(listing(c.sibling('ST-10'))).toEqual(before10);
  expect(c.git('worktree', 'list', '--porcelain')).toContain(`worktree ${inner}\n`);
}, 120_000);

it('risk:data-loss the sibling sweep deletes an unrecorded leftover of a done ticket and keeps one holding a file', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] });
  mkdirSync(`${c.sibling('ST-9')}/a/b`, { recursive: true });
  link(`${c.root}/accord`, `${c.sibling('ST-9')}/node_modules/w`);
  mkdirSync(c.sibling('ST-10'));
  writeFileSync(`${c.sibling('ST-10')}/notes.txt`, 'keep me\n');
  mkdirSync(`${c.sibling('ST-11')}/a`, { recursive: true });
  mkdirSync(`${c.sibling('ST-99')}/a`, { recursive: true });
  doneOnRemote(c, ['ST-9', 'ST-10']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const L = lines(r.out);
  expect(gone(c.sibling('ST-9'))).toBe(true);
  expect(L).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(L.filter((l) => l === withAction(`kept ${c.sibling('ST-10')}: notes.txt`)).length).toBe(1);
  expect(readFileSync(`${c.sibling('ST-10')}/notes.txt`, 'utf8')).toBe('keep me\n');
  expect(existsSync(c.sibling('ST-11'))).toBe(true);
  expect(existsSync(c.sibling('ST-99'))).toBe(true);
  expect(existsSync(`${c.root}/accord/config.yml`)).toBe(true);
}, 120_000);
