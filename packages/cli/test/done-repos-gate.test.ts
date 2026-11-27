// Phase 08.9.3 Pitfall 9, D-07, Decision 9: `accord gate done <id>` on a machine whose STORED clone of the other repository verifies reads the tip of each of that repository's slice branches, so a push past the record's
// `Verified head` fails Done (`gate.repo-head-moved`); with `CI` set, with no stored clone, or for a ticket claimed before REPOS_FROM it reads nothing there and the record is what is trusted. Real git in two sibling clones
// (helpers/repos.ts) and the real command; `git` spawns are logged by an interception of node:child_process that passes every call through, so a process started in the tools clone shows.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { REPOS_FROM } from '@accord-dev/accord-core';
import { claimedUnder, commitAll, run, writeFiles } from './helpers/repo.js';
import { reposCopy, useRepoSandboxes, type Repos } from './helpers/repos.js';

/** Every `git` call: the folder it ran in. Cleared by a case before the command it watches. */
const spawned = vi.hoisted(() => ({ cwds: [] as string[] }));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: (file: string, args: string[], opts: { cwd?: string }) => {
      if (file === 'git') spawned.cwds.push(String(opts?.cwd ?? ''));
      return (actual.execFileSync as unknown as (...a: unknown[]) => unknown)(file, args, opts);
    },
  };
});

useRepoSandboxes();

const CLAIM = 't/ST-9';
const posix = (p: string): string => p.replace(/\\/g, '/');
const task = (n: number, files: string): string => `## Task ${n}: Step ${n}\ncovers: @ac-${n}\nfiles: ${files}\nverify: export#step-${n} (@ac-${n})\nafter: none\nDo step ${n}.\n`;
const slice = (n: number, repo?: string): string => `## Slice ${n}: Part ${n}\n${repo === undefined ? '' : `repo: ${repo}\n`}tasks: ${n}\ncovers: @ac-${n}\n`;
const MERGED = 'c'.repeat(40);
const TESTS = 'node -e "process.exit(0)"';

/** ST-9 claimed under `pin` on t/ST-9 of the svc clone, planned with slice 1 in tools and slice 2 here, the plan committed. */
async function planned(r: Repos, pin: string = REPOS_FROM): Promise<void> {
  r.git(r.svc, 'switch', '-q', '-c', CLAIM);
  claimedUnder(r.svc, pin, 'ST-9');
  expect((await run(['approve', 'ST-9'], r.svc)).code).toBe(0);
  writeFiles(r.svc, { 'src/svc.ts': 'export const svc = 1;\n' });
  const base = commitAll(r.svc);
  const toolsSha = r.git(r.tools, 'rev-parse', 'refs/remotes/origin/main').trim();
  const text = ['---', `baseline: ${base}`, `baseline_tools: ${toolsSha}`, '---', '', '# Plan', '', task(1, 'tools:src/Tools.cs'), task(2, 'src/svc.ts'), slice(1, 'tools'), slice(2)].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/plan.md': text });
  commitAll(r.svc);
}

const toolsWt = (r: Repos): string => posix(join(r.parent, 'tools-st-9'));

/** The tools worktree of ST-9 opened on slice 1 (it also stores the clone's path) with one commit on it; returns the commit. */
async function toolsOneCommitted(r: Repos): Promise<string> {
  const res = await run(['worktree', 'slice', 'ST-9', '1'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int one; }\n' });
  return commitAll(toolsWt(r), 'tools slice one');
}

/** verification.md with a complete record of tools slice 1 whose Verified head is `head`. */
function record(r: Repos, head: string): void {
  const text = [
    '---',
    'ticket: "ST-9"',
    `commit: "${'e'.repeat(40)}"`,
    'reviewed_on: "2026-11-27"',
    '---',
    '',
    '## @ac-1 step one',
    '',
    'Result: pass',
    '',
    'Evidence: the tools case passed.',
    '',
    '## Repository tools',
    `Suite: passed ${TESTS}`,
    'Slice: 1',
    'PR: #41',
    `Verified head: ${head}`,
    `Merged: ${MERGED}`,
    '',
  ].join('\n');
  writeFiles(r.svc, { 'accord/tickets/ST-9/verification.md': text });
}

interface Finding {
  rule: string;
  reason: string;
}
/** `gate done ST-9 --json`: its findings, stderr, exit code, and the folders of the git calls it made. */
async function done(r: Repos, env: NodeJS.ProcessEnv = {}): Promise<{ code: number; findings: Finding[]; err: string; cwds: string[] }> {
  spawned.cwds.length = 0;
  const res = await run(['gate', 'done', 'ST-9', '--json'], r.svc, env);
  const cwds = [...spawned.cwds];
  return { code: res.code, findings: (JSON.parse(res.out) as { findings: Finding[] }).findings, err: res.err, cwds };
}
const moved = (f: Finding[]): Finding[] => f.filter((x) => x.rule === 'gate.repo-head-moved');
/** The calls that ran in the tools clone or one of its worktrees. */
const inTools = (r: Repos, cwds: string[]): string[] => cwds.filter((c) => posix(c).toLowerCase().startsWith(posix(join(r.parent, 'tools')).toLowerCase()));

it('risk:security a slice branch that moved past the recorded Verified head fails Done where the stored clone is, naming tools slice 1 and both shas (Pitfall 9, D-07)', async () => {
  const r = reposCopy();
  await planned(r);
  const tip = await toolsOneCommitted(r);
  record(r, tip);
  const first = await done(r);
  expect(moved(first.findings), JSON.stringify(first.findings)).toEqual([]);
  // one more commit on the branch after the verifier looked
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int one; int two; }\n' });
  const next = commitAll(toolsWt(r), 'tools slice one again');
  const again = await done(r);
  expect(again.code, JSON.stringify(again.findings)).toBe(1);
  const hit = moved(again.findings);
  expect(hit).toHaveLength(1);
  expect(hit[0].reason).toContain('tools');
  expect(hit[0].reason).toContain('slice 1');
  expect(hit[0].reason).toContain(next);
  expect(hit[0].reason).toContain(tip);
}, 180_000);

it('risk:regression with CI set no git process starts in the tools clone and no gate.repo-head-moved is raised, whatever the branch did (D-07)', async () => {
  const r = reposCopy();
  await planned(r);
  const tip = await toolsOneCommitted(r);
  record(r, tip);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int moved; }\n' });
  commitAll(toolsWt(r), 'moved');
  const res = await done(r, { CI: 'true' });
  expect(moved(res.findings)).toEqual([]);
  expect(inTools(r, res.cwds)).toEqual([]);
  expect(res.err).not.toContain('was not checked on this machine');
}, 180_000);

it('risk:regression with no stored path for tools it says so on stderr, raises no finding, and never searches the parent folder although the clone is there (Decision 9)', async () => {
  const r = reposCopy();
  await planned(r);
  // the slice branch exists in the clone beside this checkout and moved past the record, but no path of it was ever stored
  r.git(r.tools, 'branch', 'slice/ST-9/1');
  r.git(r.tools, 'switch', '-q', 'slice/ST-9/1');
  writeFiles(r.tools, { 'src/Tools.cs': 'class Tools { int branch; }\n' });
  commitAll(r.tools, 'on the slice branch');
  r.git(r.tools, 'switch', '-q', 'main');
  record(r, 'a'.repeat(40));
  expect(existsSync(join(r.svc, '.git', 'accord', 'repos'))).toBe(false);
  const res = await done(r);
  expect(moved(res.findings)).toEqual([]);
  expect(res.err).toMatch(/^note: repository tools was not checked on this machine: not found - /m);
  expect(res.err.match(/was not checked on this machine/g)).toHaveLength(1);
  expect(existsSync(join(r.svc, '.git', 'accord', 'repos')), 'nothing was stored: a scan would have found and stored the clone').toBe(false);
  expect(inTools(r, res.cwds)).toEqual([]);
}, 180_000);

it('risk:regression a ticket claimed before REPOS_FROM makes no git call in the tools clone and raises no gate.repo-head-moved (D-13)', async () => {
  const r = reposCopy();
  await planned(r, '0.21.1');
  r.git(r.tools, 'branch', 'slice/ST-9/1');
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0); // the stored path is there: the cut-off, not the missing clone, is what keeps git out
  record(r, 'a'.repeat(40));
  const res = await done(r);
  expect(moved(res.findings)).toEqual([]);
  expect(inTools(r, res.cwds)).toEqual([]);
  expect(res.err).not.toContain('was not checked on this machine');
}, 180_000);
