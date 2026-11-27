// Phase 08.9.3 D-04, D-05: `accord review-package <id>` of a ticket planned across repositories holds, after this repository's sections, one `## Repository <name>` section per other repository the plan names:
// the range read in that repository's clone (baseline_<name> for the final review, the slice's own start while the slice in work is a slice of that repository, the tip the newest slice branch there), the commits,
// the stat, the changed paths no task of that repository names, and the diff. Every git call that builds one runs in the clone (the spawn log), never in the folder a session works in. Real git in two sibling clones.
import { expect, it, vi } from 'vitest';
import { commitAll, run, writeFiles } from './helpers/repo.js';
import { builtInTools, ONE_TOOLS_TASK, plannedTools, posix, toolsWt } from './helpers/repos-build.js';
import { reposCopy, useRepoSandboxes } from './helpers/repos.js';
import { spawnLog } from './helpers/git-spawns.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

useRepoSandboxes();

/** The text of the `## <title>` or `### <title>` section of a package: from its heading to the next heading of the same or a higher level. */
function sectionOf(out: string, title: string): string {
  const level = title.startsWith('### ') ? '###' : '##';
  const at = out.indexOf('\n' + title + '\n');
  if (at < 0) return '';
  const rest = out.slice(at + 1);
  const next = rest.slice(title.length).search(level === '###' ? /\n#{2,3} / : /\n## /);
  return (next < 0 ? rest : rest.slice(0, title.length + next)).trimEnd();
}

it('risk:regression review-package holds the tools slice\'s diff under ## Repository tools, read by git in the tools clone and never in the folder under the session (D-04, D-05)', async () => {
  const r = reposCopy();
  const { toolsSha } = await plannedTools(r, ONE_TOOLS_TASK);
  await builtInTools(r, { message: 'tools task one' });
  writeFiles(toolsWt(r), { 'src/Stray.cs': 'class Stray {}\n' });
  const tip = commitAll(toolsWt(r), 'tools stray file');

  const cwds: string[] = [];
  spawnLog.calls = [];
  spawnLog.after = (_args, options) => {
    if (options?.cwd !== undefined) cwds.push(posix(options.cwd).toLowerCase());
  };
  spawnLog.on = true;
  let res: { code: number; out: string; err: string };
  try {
    res = await run(['review-package', 'ST-9'], r.svc);
  } finally {
    spawnLog.on = false;
    spawnLog.after = undefined;
  }
  expect(res.code, res.out + res.err).toBe(0);

  // this repository's sections come first, as before; the tools section follows them
  const at = res.out.indexOf('\n## Repository tools\n');
  expect(at).toBeGreaterThan(-1);
  expect(res.out.indexOf('\n## Commits\n')).toBeLessThan(at);
  expect(res.out.indexOf('\n## Diff\n')).toBeLessThan(at);
  const tools = res.out.slice(at + 1);
  expect(tools).toContain(`Range: ${toolsSha.slice(0, 12)}...${tip.slice(0, 12)} (slice 1, worktree ${toolsWt(r)})\n`);
  const commits = sectionOf(tools, '### Commits');
  expect(commits).toContain('tools task one');
  expect(commits).toContain('tools stray file');
  const stat = sectionOf(tools, '### Stat');
  expect(stat).toContain('src/Tools.cs');
  expect(stat).toContain('src/Stray.cs');
  // src/Tools.cs is a path of task 1; src/Stray.cs is named by no task of tools
  expect(sectionOf(tools, '### Undeclared files')).toBe('### Undeclared files\n\nsrc/Stray.cs');
  const diff = sectionOf(tools, '### Diff');
  expect(diff).toContain('+class Tools { int one; }');
  expect(diff).toContain('+class Stray {}');

  // every git call that read the tools change ran in the tools clone; none ran in a folder under the tools worktree
  expect(cwds).toContain(posix(r.tools).toLowerCase());
  expect(cwds.filter((c) => c.startsWith(toolsWt(r).toLowerCase()))).toEqual([]);
}, 120_000);
