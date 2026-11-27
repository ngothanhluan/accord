// Phase 08.9.3 D-03, D-10, D-11: the branch accord cuts in another repository, `slice/<id>/<n>`, is never read as a claim (a session whose folder is that worktree works no ticket, and an other repository that
// uses accord itself does not take the branch for one of its own tickets); no command reads or writes any file under the other repository's `accord/` folder, also when it has one with its own pin; the
// worktree record reads and keeps a line with and without its repository column; and `accord worktree clean` leaves a record line with a repository column, and its folder, as they are until plan 08.9.3-07
// judges them in their own clone. Real git in two sibling clones (helpers/repos.ts).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { loadSnapshot, REPOS_FROM } from '@accord-dev/accord-core';
import { dropRecorded, readRecorded, recordWorktree, worksTicket } from '../src/commands/worktree.js';
import { loadFromFs } from '../src/load/fs.js';
import { countedOpens } from './helpers/fs-opens.js';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { copyRepos, makeReposTemplate, type Repos } from './helpers/repos.js';
import { A, doneTicket, envOf, setTable, tableOf, verifyStage } from './helpers/worktree.js';

vi.mock('node:fs', async (orig) => (await import('./helpers/fs-opens.js')).wrapFs(await orig()));
vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});

// two templates: tools with no accord install, and tools with its own (a pin that is not the running release, and a ticket)
let plain: Repos;
let accorded: Repos;
const copies: Repos[] = [];
beforeAll(() => {
  plain = makeReposTemplate();
  accorded = makeReposTemplate({ toolsAccord: true });
}, 240_000);
afterAll(() => {
  plain?.cleanupAll();
  accorded?.cleanupAll();
});
afterEach(() => {
  for (const c of copies.splice(0)) c.cleanupAll();
});
const copyOf = (template: Repos): Repos => {
  const c = copyRepos(template);
  copies.push(c);
  return c;
};

const CLAIM = 't/ST-9';
const posix = (p: string): string => p.replace(/\\/g, '/');
const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${n}\ncovers: @ac-${n}\n`;

/** ST-9 claimed on t/ST-9 of the svc clone, planned with slice 1 in tools and slice 2 here, the plan committed; the tools worktree of slice 1 opened and one commit made on it. Returns that commit. */
async function openedTools(r: Repos): Promise<string> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const plan = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', task(1, 'tools:src/Tools.cs'), task(2, 'src/svc.ts'), slice(1, 'tools'), slice(2)].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': plan });
  commitAll(r.svc);
  const opened = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  expect(opened.code, opened.out + opened.err).toBe(0);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int one; }\n' });
  return commitAll(toolsWt(r), 'tools slice one');
}

const toolsWt = (r: Repos): string => posix(join(r.parent, 'tools-st-9'));
const recordFile = (r: Repos): string => join(r.svc, '.git', 'accord', 'worktrees');

/** Every file under `dir` with its size and modification time, in name order: what a command that touched the folder would change. */
function inventory(dir: string): string[] {
  return (readdirSync(dir, { recursive: true, withFileTypes: true }))
    .filter((e) => e.isFile())
    .map((e) => {
      const file = join(e.parentPath, e.name);
      const s = statSync(file);
      return `${posix(file)} ${s.size} ${s.mtimeMs}`;
    })
    .sort();
}

it('risk:security a session whose folder is the tools worktree works no ticket: tools has no accord folder, so the check refuses for it and names no ticket (D-11)', async () => {
  const r = copyOf(plain);
  await openedTools(r);
  setTable(tableOf(A));
  const res = await run(['worktree', 'check'], toolsWt(r), envOf(A));
  expect(res.code).toBe(2);
  expect(res.out + res.err).not.toContain('this session works');
  expect(res.out + res.err).not.toContain('ST-9');
  // the ticket's own checkout, by contrast, is a session that works nothing either: it holds no hold and is not a linked worktree
  const own = await run(['worktree', 'check'], r.svc, envOf(A));
  expect(own.code, own.out + own.err).toBe(0);
}, 180_000);

it('risk:security with its own accord install, tools reads slice/ST-9/1 as no claim and ST-9 is not one of its tickets, so a session in the worktree works none (D-11, D-03)', async () => {
  const r = copyOf(accorded);
  await openedTools(r);
  const snapshot = loadSnapshot(loadFromFs(toolsWt(r)));
  expect(Object.keys(snapshot.tickets)).toEqual(['TL-1']);
  expect(snapshot.claimBranches?.['ST-9']).toBeUndefined();
  expect(snapshot.claimBranches?.['TL-1']).toBeUndefined();
  expect(worksTicket(toolsWt(r), 'sess-A', snapshot)).toBeUndefined();
}, 180_000);

it('risk:security no command of the slice and push set reads or writes a file under the other repository\'s accord folder, whatever pin it holds (D-03)', async () => {
  const r = copyOf(accorded);
  const folders = [join(r.parent, 'tools', 'accord'), join(toolsWt(r), 'accord')];
  const tracked = [join(r.parent, 'tools', 'accord', 'config.yml'), join(r.parent, 'tools', 'accord', 'tickets', 'TL-1.md')];
  const before = inventory(folders[0]);
  expect(before).toHaveLength(2);
  const reads = await countedOpens(async () => {
    const tip = await openedTools(r);
    const out: string[] = [];
    for (const argv of [['worktree', 'slice', 'ST-9', '1'], ['worktree', 'slice', 'ST-9', '2'], ['worktree', 'push', 'ST-9', '--repo', 'tools'], ['worktree', 'slice', 'ST-9', '1']]) {
      const res = await run(argv, r.svc);
      out.push(`${argv.join(' ')} -> ${res.code} ${res.out}${res.err}`);
      expect(res.code, out.at(-1)).toBe(0);
    }
    return { tip, out };
  });
  // the spy sees this repository's own files, so its silence about the other repository's accord folder means something
  expect(reads.paths.some((p) => p.toLowerCase().endsWith('/svc/accord/config.yml'))).toBe(true);
  const inside = reads.paths.filter((p) => folders.some((f) => p.toLowerCase().startsWith(posix(f).toLowerCase() + '/')));
  expect(inside).toEqual([]);
  // and the person's tools clone holds its accord folder exactly as it was, the worktree's copy as it was cut
  expect(inventory(folders[0])).toEqual(before);
  expect(tracked.every((f) => existsSync(f))).toBe(true);
  expect(readFileSync(tracked[0], 'utf8')).toContain('accord: "0.0.1"');
  // guard the guard: the spy does record a read of a tools file when a test reads it on purpose
  const on = await countedOpens(async () => readFileSync(join(r.parent, 'tools', 'src', 'Tools.cs'), 'utf8'));
  expect(on.paths.map((p) => p.toLowerCase())).toContain(posix(join(r.parent, 'tools', 'src', 'Tools.cs')).toLowerCase());
}, 240_000);

it('risk:regression the worktree record reads a line with and without its repository column, and a rewrite keeps a line whose third column is no repository name (D-10)', () => {
  const r = copyOf(plain);
  const dir = join(r.svc, '.git', 'accord');
  mkdirSync(dir, { recursive: true });
  const bad = 'ST-3\t/p/c\tNotARepo';
  writeFileSync(recordFile(r), ['ST-1\t/p/a', 'ST-2\t/p/b\ttools', bad, ''].join('\n'));
  expect(readRecorded(r.svc)).toEqual([{ id: 'ST-1', path: '/p/a' }, { id: 'ST-2', path: '/p/b', repo: 'tools' }]);
  recordWorktree(r.svc, 'ST-4', '/p/d', 'tools');
  recordWorktree(r.svc, 'ST-5', '/p/e');
  recordWorktree(r.svc, 'ST-4', '/p/d', 'tools'); // a path already there is not written twice
  expect(readFileSync(recordFile(r), 'utf8')).toBe(['ST-1\t/p/a', 'ST-2\t/p/b\ttools', bad, 'ST-4\t/p/d\ttools', 'ST-5\t/p/e', ''].join('\n'));
  expect(() => recordWorktree(r.svc, 'ST-6', '/p/f', 'Tools')).toThrow('not a repository name');
  // dropping compares the path column only, and the line it could not read stays
  dropRecorded(r.svc, '/p/b');
  expect(readFileSync(recordFile(r), 'utf8')).toBe(['ST-1\t/p/a', bad, 'ST-4\t/p/d\ttools', 'ST-5\t/p/e', ''].join('\n'));
  dropRecorded(r.svc, '/p/c');
  expect(readFileSync(recordFile(r), 'utf8')).toContain(bad);
});

it('risk:data-loss accord worktree clean leaves a recorded tools worktree and its record line as they are, while the ticket is done, until plan 07 judges them in their own clone (D-10)', async () => {
  const r = copyOf(plain);
  await openedTools(r);
  const folder = toolsWt(r);
  const line = `ST-9\t${folder}\ttools`;
  expect(readFileSync(recordFile(r), 'utf8')).toContain(line);
  // ST-9 is done on svc's default branch: the ticket verified and merged, as a teammate's clone leaves it
  r.git(r.svc, 'switch', '-q', 'main');
  verifyStage(r.svc, 'ST-9');
  const verified = r.git(r.svc, 'rev-parse', 'HEAD').trim();
  writeFiles(r.svc, { 'accord/tickets/ST-9.md': doneTicket('ST-9', verified) });
  commitAll(r.svc, 'verify: ST-9');
  r.git(r.svc, 'push', '-q', 'origin', 'main');
  const files = inventory(folder);
  const res = await run(['worktree', 'clean'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out + res.err).not.toContain('tools-st-9');
  expect(existsSync(folder)).toBe(true);
  expect(inventory(folder)).toEqual(files);
  expect(readFileSync(recordFile(r), 'utf8')).toContain(line);
  expect(r.git(r.tools, 'worktree', 'list', '--porcelain').replace(/\\/g, '/').toLowerCase()).toContain(folder.toLowerCase());
  expect(r.git(folder, 'branch', '--show-current').trim()).toBe('slice/ST-9/1');
  // the ticket is done on the default branch, so clean did judge ST-9 (its own branch is the line it names) and the entry was one it could have swept
  expect(res.out).toContain('kept t/ST-9');
}, 240_000);
