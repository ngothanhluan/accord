// Phase 08.9.3 D-05: `accord scout check <file> --ticket <id>` reads `<name>:<path>:<line>` citations and `<name>:<path>` rows of `## Files`, and judges them against that repository's tracked files and text at its default-branch
// tip in the clone the resolver verified (the CLI runs the git there, D-04). A report citing no such path makes no git call outside this repository. Real git in two sibling clones.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { parseScoutReport, scoutRepoNames } from '@accord-dev/accord-core';
import { cleanup, commitAll, run, writeFiles } from './helpers/repo.js';
import { posix } from './helpers/repos-build.js';
import { reposCopy, useRepoSandboxes } from './helpers/repos.js';
import type { Repos } from './helpers/repos.js';
import { spawnLog } from './helpers/git-spawns.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

useRepoSandboxes();

/** This repository holds `src/svc.ts` (3 lines); tools holds `src/Tools.cs` (3 lines) at the tip of its default branch on origin. */
function twoRepos(): Repos {
  const r = reposCopy();
  writeFiles(r.svc, { 'src/svc.ts': 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n' });
  commitAll(r.svc, 'svc source');
  writeFiles(r.tools, { 'src/Tools.cs': 'class Tools {\n  int one;\n}\n' });
  commitAll(r.tools, 'tools source');
  r.git(r.tools, 'push', '-q', 'origin', 'main');
  return r;
}

const report = (r: Repos, lines: string[]): string => {
  writeFileSync(join(r.svc, 'report.md'), lines.join('\n') + '\n');
  return 'report.md';
};

const check = (r: Repos, file: string) => run(['scout', 'check', file, '--ticket', 'ST-9'], r.svc);

it('risk:parsing a report that lists and cites a file of tools as <name>:<path> passes, and the lane numbers count both files (D-05)', async () => {
  const r = twoRepos();
  const file = report(r, ['## Files', '- `src/svc.ts`', '- `tools:src/Tools.cs`', '', '## Facts', '- the writer sits at src/svc.ts:1 and the other side at tools:src/Tools.cs:2', '- and `tools:src/Tools.cs:1-3` is the class']);
  const res = await check(r, file);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain('expected files: 2 (src/svc.ts, tools:src/Tools.cs)\n');
  expect(res.out).toContain('code areas: 2 (src, tools:src)\n');
  expect(res.out.endsWith('scout check passed\n')).toBe(true);
}, 120_000);

it('risk:parsing a tools citation of a missing file, of a line past the end and of a repository config does not declare each fail, naming the path or the repository (D-05)', async () => {
  const r = twoRepos();
  const file = report(r, [
    '## Files',
    '- `src/svc.ts`',
    '',
    '## Facts',
    '- gone at tools:src/Missing.cs:1',
    '- past the end at tools:src/Tools.cs:999',
    '- unknown at docs:x.md:1',
  ]);
  const res = await check(r, file);
  expect(res.code, res.out + res.err).toBe(1);
  expect(res.out).toContain('fail: citation tools:src/Missing.cs:1 does not resolve: git does not track tools:src/Missing.cs\n');
  expect(res.out).toContain('fail: citation tools:src/Tools.cs:999 does not resolve: tools:src/Tools.cs has 3 lines\n');
  expect(res.out).toMatch(/fail: citation docs:x\.md:1 does not resolve: .*repository docs.*repos\.docs/);
  expect(res.out).toContain('scout check failed: 3 failures\n');

  // a ## Files row follows the same rules
  const rows = report(r, ['## Files', '- `src/svc.ts`', '- `tools:src/Missing.cs`', '- `docs:x.md`']);
  const listed = await check(r, rows);
  expect(listed.code, listed.out + listed.err).toBe(1);
  expect(listed.out).toContain('fail: ## Files lists tools:src/Missing.cs, which git does not track in repository tools\n');
  expect(listed.out).toMatch(/fail: ## Files lists docs:x\.md: .*repository docs.*repos\.docs/);

  // a file listed as new that the other repository already tracks fails; one it does not track passes
  const fresh = report(r, ['## Files', '- `src/svc.ts`', '', '## New files', '- `tools:src/Tools.cs`', '- `tools:src/Brand.cs`']);
  const made = await check(r, fresh);
  expect(made.code, made.out + made.err).toBe(1);
  expect(made.out).toContain('fail: ## New files lists tools:src/Tools.cs, which git already tracks in repository tools\n');
  expect(made.out).not.toMatch(/fail: .*Brand/);
}, 120_000);

it('risk:regression a report that cites tools while its clone is not there exits 2 with the D-02 line instead of leaving the repository out (D-02, D-05)', async () => {
  const r = twoRepos();
  const file = report(r, ['## Files', '- `src/svc.ts`', '- `tools:src/Tools.cs`', '']);
  cleanup(r.tools);
  const res = await check(r, file);
  expect(res.code, res.out + res.err).toBe(2);
  expect(res.out + res.err).toContain("git clone 'https://github.com/acme/tools.git'");
  expect(res.out + res.err).toContain('tools: not found');
}, 120_000);

it('risk:regression a report that names no <name>: path makes no git call outside this repository, and a drive path or a URL with a line number is still no citation (D-05)', async () => {
  const r = twoRepos();
  const file = report(r, ['## Files', '- `src/svc.ts`', '', '## Facts', '- the rule sits at src/svc.ts:2', '- see C:/x.ts:3 and https://host/a.ts:3 for the story']);
  expect(scoutRepoNames(file)).toEqual([]);
  const cwds: string[] = [];
  spawnLog.calls = [];
  spawnLog.after = (_args, options) => {
    if (options?.cwd !== undefined) cwds.push(posix(options.cwd).toLowerCase());
  };
  spawnLog.on = true;
  let res: { code: number; out: string; err: string };
  try {
    res = await check(r, file);
  } finally {
    spawnLog.on = false;
    spawnLog.after = undefined;
  }
  expect(res.code, res.out + res.err).toBe(0);
  expect(cwds.length).toBeGreaterThan(0);
  expect(cwds.filter((c) => !c.startsWith(posix(r.svc).toLowerCase()))).toEqual([]);
}, 120_000);

it('risk:parsing the plain parse of a scout report reads no <name>: citation, so the evidence of a config proposal and a finding keeps its meaning (D-05)', () => {
  const text = '## Files\n\n## Facts\n- at tools:src/Tools.cs:2\n';
  expect(parseScoutReport(text).citations).toEqual([]);
  expect(parseScoutReport(text, { repos: true }).citations.map((c) => c.path)).toEqual(['tools:src/Tools.cs']);
});
