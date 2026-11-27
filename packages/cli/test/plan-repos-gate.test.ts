// Phase 08.9.3 D-04, D-05: `accord gate plan` checks a task's path in another repository against that repository's own baseline, with git run by the CLI in that clone, on real git in two sibling clones
// (helpers/repos.ts). Only `gate plan` reads the other clone: gate done, lint and status never start a git process there, so CI's gate done needs no clone.
import { mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, cleanup, commitAll, run, writeFiles } from './helpers/repo.js';
import { spawnLog } from './helpers/git-spawns.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));

useRepoSandboxes();

const away: string[] = [];
afterEach(() => {
  spawnLog.on = false;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
  for (const d of away.splice(0)) cleanup(d);
});

interface Found { rule: string; level: string; reason?: string; file?: string }

const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, tasks: string, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${tasks}\ncovers: @ac-${n}\n`;

interface Setup {
  /** What task 1 (the tools slice) names in `files:`. */
  tools: string;
  /** Frontmatter lines for the tools baseline; the default is origin's tip of the tools clone. */
  baseline?: (toolsSha: string) => string[];
  /** The task of this repository (slice 2). */
  svc?: string;
}

/** ST-9 claimed at REPOS_FROM, approved, its plan committed: slice 1 is the tools slice, slice 2 this repository's. Returns the tools tip (origin's) the plan baselines on by default. */
async function planned(r: Repos, s: Setup): Promise<{ toolsSha: string }> {
  claimedUnder(r.svc, REPOS_FROM, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const fm = (s.baseline ?? ((sha: string) => [`baseline_tools: ${sha}`]))(toolsSha);
  const text = ['---', `baseline: ${base}`, ...fm, '---', '', '# Plan', '', task(1, s.tools), task(2, s.svc ?? 'src/svc.ts'), slice(1, '1', 'tools'), slice(2, '2')].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
  return { toolsSha };
}

const gate = async (r: Repos): Promise<{ code: number; found: Found[]; err: string; out: string }> => {
  const res = await run(['gate', 'plan', 'ST-9', '--json'], r.svc);
  return { code: res.code, err: res.err, out: res.out, found: res.out === '' ? [] : (JSON.parse(res.out).findings as Found[]) };
};
const only = (found: Found[], rule: string): Found[] => found.filter((f) => f.rule === rule);

/** A commit of the tools clone that origin's main does not hold: a side branch with one new file, the clone back on main afterwards. */
function sideCommit(r: Repos): string {
  r.git(r.tools, 'switch', '-q', '-c', 'side');
  writeFiles(r.tools, { 'src/Side.cs': 'class Side {}\n' });
  const sha = commitAll(r.tools, 'side');
  r.git(r.tools, 'switch', '-q', 'main');
  return sha;
}

it('risk:regression gate plan names a tools path that does not exist at the tools baseline, and passes one that does (D-05)', async () => {
  const r = reposCopy();
  const { toolsSha } = await planned(r, { tools: 'tools:src/Missing.cs' });
  const bad = await gate(r);
  expect(bad.err).toBe('');
  expect(bad.code).toBe(1);
  const unknown = only(bad.found, 'gate.task-file-unknown');
  expect(unknown).toHaveLength(1);
  expect(unknown[0].reason).toContain('tools:src/Missing.cs');
  expect(unknown[0].reason).toContain(`tools baseline ${toolsSha}`);
  // the text form prints that one finding too
  const text = await run(['gate', 'plan', 'ST-9'], r.svc);
  expect(text.out.split('\n').filter((l) => l.includes('gate.task-file-unknown'))).toHaveLength(1);
});

it('risk:regression gate plan reads no gate.task-file-unknown for a tools path that exists at the tools baseline (D-05)', async () => {
  const r = reposCopy();
  await planned(r, { tools: 'tools:src/Tools.cs' });
  const good = await gate(r);
  expect(good.err).toBe('');
  expect(only(good.found, 'gate.task-file-unknown')).toEqual([]);
  expect(only(good.found, 'gate.repo-baseline-unknown')).toEqual([]);
});

it('risk:complex-branching a baseline_tools on a side branch that origin\'s main does not hold is one gate.repo-baseline-unknown finding (D-05)', async () => {
  const r = reposCopy();
  const side = sideCommit(r);
  await planned(r, { tools: 'tools:src/Tools.cs', baseline: () => [`baseline_tools: ${side}`] });
  const res = await gate(r);
  expect(res.err).toBe('');
  expect(res.code).toBe(1);
  const unknown = only(res.found, 'gate.repo-baseline-unknown');
  expect(unknown).toHaveLength(1);
  expect(unknown[0].reason).toContain(side);
  expect(unknown[0].reason).toContain('tools');
  // the baseline is held, so the path is judged at it and passes
  expect(only(res.found, 'gate.task-file-unknown')).toEqual([]);
});

it('risk:complex-branching a baseline_tools sha the clone does not hold ends gate plan with exit 2 and one line, never a finding per path (D-05, Pitfall 5)', async () => {
  const r = reposCopy();
  const absent = '1'.repeat(40);
  await planned(r, { tools: 'tools:src/Missing.cs, tools:src/Gone.cs', baseline: () => [`baseline_tools: ${absent}`] });
  const res = await gate(r);
  expect(res.code).toBe(2);
  expect(res.out).toBe('');
  expect(res.err.trim().split('\n')).toHaveLength(1);
  expect(res.err).toContain(`repository tools has no commit ${absent}: fetch it (accord repos baseline tools --id ST-9 fetches) and run accord gate plan ST-9 again`);
});

it('risk:complex-branching a tools clone that is gone ends gate plan with exit 2 and the not-found line of the repository (D-02, Pitfall 5)', async () => {
  const r = reposCopy();
  await planned(r, { tools: 'tools:src/Tools.cs' });
  // moved out of the parent folder, so the scan beside the checkout finds no clone either
  const elsewhere = mkdtempSync(join(tmpdir(), 'accord-repos-gone-'));
  away.push(elsewhere);
  renameSync(r.tools, join(elsewhere, 'tools'));
  const res = await gate(r);
  expect(res.code).toBe(2);
  expect(res.out).toBe('');
  expect(res.err.trim().split('\n')).toHaveLength(1);
  expect(res.err).toContain('tools: not found - clone it with git clone');
  expect(res.err).toContain('accord repos set tools <path>');
});

it('risk:security a svc path that climbs to the tools folder stays one gate.task-file-unknown finding and never reaches git (D-05, T-08.9.3-11)', async () => {
  const r = reposCopy();
  await planned(r, { tools: 'tools:src/Tools.cs', svc: '../tools/src/Tools.cs' });
  spawnLog.calls = [];
  spawnLog.on = true;
  const res = await gate(r);
  spawnLog.on = false;
  expect(res.err).toBe('');
  const unknown = only(res.found, 'gate.task-file-unknown');
  expect(unknown).toHaveLength(1);
  expect(unknown[0].reason).toContain('../tools/src/Tools.cs');
  expect(spawnLog.calls.length).toBeGreaterThan(0);
  const climbs = spawnLog.calls.filter((c) => c.some((a) => /(^|[/\\])\.\.([/\\]|$)/.test(a)));
  expect(climbs).toEqual([]);
});

it('risk:parsing a tools file with non-ASCII letters is found at the baseline, and one with a space beside it does not disturb the listing (D-05, Pitfall 6)', async () => {
  const r = reposCopy();
  writeFiles(r.tools, { 'src/Ünï-ä.cs': 'class U {}\n', 'src/My Tools ä.cs': 'class M {}\n' });
  commitAll(r.tools, 'non-ascii names');
  r.git(r.tools, 'push', '-q', 'origin', 'main');
  await planned(r, { tools: 'tools:src/Ünï-ä.cs, tools:src/Tools.cs, tools:src/Ünï-missing.cs' });
  const res = await gate(r);
  expect(res.err).toBe('');
  const unknown = only(res.found, 'gate.task-file-unknown');
  expect(unknown).toHaveLength(1);
  expect(unknown[0].reason).toContain('tools:src/Ünï-missing.cs');
  expect(unknown[0].reason).not.toContain('Ünï-ä.cs');
});

it('risk:complex-branching the verdicts are the same while the tools checkout is on a feature branch with an unrelated HEAD (D-05)', async () => {
  const r = reposCopy();
  // an orphan branch: its HEAD shares no history with origin's main, and holds none of the baseline's files
  r.git(r.tools, 'switch', '-q', '--orphan', 'feature'); // switch --orphan empties the index and the working tree
  writeFiles(r.tools, { 'elsewhere.txt': 'unrelated\n' });
  commitAll(r.tools, 'unrelated');
  await planned(r, { tools: 'tools:src/Tools.cs, tools:src/Missing.cs' });
  const res = await gate(r);
  expect(res.err).toBe('');
  expect(only(res.found, 'gate.repo-baseline-unknown')).toEqual([]);
  const unknown = only(res.found, 'gate.task-file-unknown');
  expect(unknown).toHaveLength(1);
  expect(unknown[0].reason).toContain('tools:src/Missing.cs');
});
