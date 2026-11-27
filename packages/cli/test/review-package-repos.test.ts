// Phase 08.9.3 D-04, D-05: `accord review-package <id>` of a ticket planned across repositories holds, after this repository's sections, one `## Repository <name>` section per other repository the plan names:
// the range read in that repository's clone (baseline_<name> for the final review, the slice's own start while the slice in work is a slice of that repository, the tip the newest slice branch there), the commits,
// the stat, the changed paths no task of that repository names, and the diff. Every git call that builds one runs in the clone (the spawn log), never in the folder a session works in. Real git in two sibling clones.
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { commitAll, run, writeFiles } from './helpers/repo.js';
import { builtInTools, ONE_TOOLS_TASK, plannedTools, posix, slice, task, toolsWt } from './helpers/repos-build.js';
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

/** Tasks 1 and 3 are built in tools (slices 1 and 3), task 2 here (slice 2): the deploy order interleaves the repositories. */
const INTERLEAVED = [
  task(1, 'tools:src/Tools.cs', 'Tools.Tests#adds'),
  task(2, 'src/svc.ts', 'export#writes-csv'),
  task(3, 'tools:src/Other.cs', 'Tools.Tests#subtracts'),
  slice(1, '1', 'tools'),
  slice(2, '2'),
  slice(3, '3', 'tools'),
].join('\n');

it('risk:complex-branching the tools range starts at the start of the slice in work while that slice is built in tools, and at baseline_tools for the final review (D-05)', async () => {
  const r = reposCopy();
  const { toolsSha } = await plannedTools(r, INTERLEAVED);
  const slice1 = await builtInTools(r, { executorReport: false });
  // slice 3 is cut in tools at the tip of slice 1, the same tools worktree is switched to it, and one commit is made there
  const open = await run(['worktree', 'slice', 'ST-9', '3'], r.svc);
  expect(open.code, open.out + open.err).toBe(0);
  writeFiles(toolsWt(r), { 'src/Other.cs': 'class Other { int three; }\n' });
  const slice3 = commitAll(toolsWt(r), 'tools task three');
  // slices 1 and 2 are verified, so slice 3 is the slice in work
  writeFiles(r.svc, { 'accord/tickets/ST-9.md': readFileSync(join(r.svc, 'accord', 'tickets', 'ST-9.md'), 'utf8').replace('ui: false\n', 'ui: false\nverified: [ac-1, ac-2]\n') });
  commitAll(r.svc, 'verify slices 1 and 2');

  const inWork = await run(['review-package', 'ST-9'], r.svc);
  expect(inWork.code, inWork.out + inWork.err).toBe(0);
  const here = inWork.out.slice(inWork.out.indexOf('\n## Repository tools\n') + 1);
  expect(here).toContain(`Range: ${slice1.slice(0, 12)}...${slice3.slice(0, 12)} (slice 3, worktree ${toolsWt(r)})\n`);
  expect(sectionOf(here, '### Diff')).toContain('+class Other { int three; }');
  expect(sectionOf(here, '### Diff')).not.toContain('int one');

  // the final review: this repository's package is over the plan's baseline, the tools one over baseline_tools
  const baseline = /^baseline: (\S+)$/m.exec(readFileSync(join(r.svc, 'accord', 'tickets', 'ST-9', 'plan.md'), 'utf8'))?.[1];
  expect(baseline).toBeDefined();
  const final = await run(['review-package', 'ST-9', '--base', baseline as string], r.svc);
  expect(final.code, final.out + final.err).toBe(0);
  const whole = final.out.slice(final.out.indexOf('\n## Repository tools\n') + 1);
  expect(whole).toContain(`Range: ${toolsSha.slice(0, 12)}...${slice3.slice(0, 12)} (slice 3, worktree ${toolsWt(r)})\n`);
  expect(sectionOf(whole, '### Diff')).toContain('int one');
  expect(sectionOf(whole, '### Diff')).toContain('int three');
}, 180_000);

it('risk:security the security triggers and the --security package read the tools diff, its paths named with the tools: prefix and its path patterns judged over its own paths (D-04)', async () => {
  const r = reposCopy();
  await plannedTools(r, ONE_TOOLS_TASK);
  await builtInTools(r, { executorReport: false });
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { string password = "x"; }\n', '.github/workflows/ci.yml': 'name: ci\n' });
  commitAll(toolsWt(r), 'tools adds a secret and a workflow');

  const res = await run(['review-package', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  const triggers = sectionOf(res.out, '## Security triggers');
  expect(triggers).toContain('tools:src/Tools.cs:1: secret-name (auth and secret or token names)');
  // a path pattern of this repository's list (ci-workflow) is a path of tools here, not of the prefixed name
  expect(triggers).toContain('tools:.github/workflows/ci.yml: ci-workflow (CI workflow files)');

  const sec = await run(['review-package', 'ST-9', '--security'], r.svc);
  expect(sec.code, sec.out + sec.err).toBe(0);
  expect(sectionOf(sec.out, '## Security triggers')).toContain('tools:src/Tools.cs:1: secret-name');
  const hunks = sec.out.slice(sec.out.indexOf('\n## Matched hunks\n') + 1);
  const at = hunks.indexOf('\n### Repository tools\n');
  expect(at).toBeGreaterThan(-1);
  expect(hunks.slice(at)).toContain('+class Tools { string password = "x"; }');
  // the hunk of the other repository sits only under its own heading: this repository's change has none
  expect(hunks.slice(0, at)).not.toContain('password');
}, 120_000);

it('risk:regression the package names the listing accord repos baseline wrote, and no Files line when there is none (research question 4)', async () => {
  const r = reposCopy();
  await plannedTools(r, ONE_TOOLS_TASK);
  await builtInTools(r, { executorReport: false });
  const without = await run(['review-package', 'ST-9'], r.svc);
  expect(without.code, without.out + without.err).toBe(0);
  expect(without.out).not.toContain('\nFiles: ');

  const baseline = await run(['repos', 'baseline', 'tools', '--id', 'ST-9'], r.svc);
  expect(baseline.code, baseline.out + baseline.err).toBe(0);
  const listing = /^files: (.+)$/m.exec(baseline.out)?.[1];
  expect(listing).toBeDefined();
  const withListing = await run(['review-package', 'ST-9'], r.svc);
  expect(withListing.code, withListing.out + withListing.err).toBe(0);
  expect(withListing.out).toContain(`\nFiles: ${listing}\n`);
  // the line sits in the tools section, under its Range line
  const tools = withListing.out.slice(withListing.out.indexOf('\n## Repository tools\n'));
  expect(tools.indexOf('\nRange: ')).toBeLessThan(tools.indexOf('\nFiles: '));
  expect(tools.indexOf('\nFiles: ')).toBeLessThan(tools.indexOf('\n### Commits\n'));
}, 120_000);

it('risk:regression a tools clone that is not there stops the package with the D-02 line, exit 2, and writes nothing (D-02, D-04)', async () => {
  const r = reposCopy();
  await plannedTools(r, ONE_TOOLS_TASK);
  await builtInTools(r, { executorReport: false });
  renameSync(r.tools, r.tools + '-moved');
  const res = await run(['review-package', 'ST-9', '--out', 'package.md'], r.svc);
  expect(res.code, res.out + res.err).toBe(2);
  expect(res.out + res.err).toContain("git clone 'https://github.com/acme/tools.git'");
  expect(res.out + res.err).toContain('tools: not found');
  expect(res.out).toBe('');
  expect(existsSync(join(r.svc, '.accord-reports', 'ST-9', 'package.md'))).toBe(false);
}, 120_000);

it('risk:security text of the tools repository is data: a commit subject that reads ## Diff stays inside the tools ### Commits and changes nothing of this repository\'s package (T-08.9.3-24)', async () => {
  const r = reposCopy();
  await plannedTools(r, ONE_TOOLS_TASK);
  await builtInTools(r, { executorReport: false });
  const before = await run(['review-package', 'ST-9'], r.svc);
  expect(before.code, before.out + before.err).toBe(0);
  writeFiles(toolsWt(r), { 'src/Tools.cs': 'class Tools { int two; }\n' });
  commitAll(toolsWt(r), '## Diff');
  const after = await run(['review-package', 'ST-9'], r.svc);
  expect(after.code, after.out + after.err).toBe(0);
  const tools = after.out.slice(after.out.indexOf('\n## Repository tools\n') + 1);
  expect(sectionOf(tools, '### Commits')).toMatch(/^[0-9a-f]+ ## Diff$/m);
  // no line of the package is the heading `## Diff` more than once: this repository's own
  expect(after.out.split('\n').filter((l) => l === '## Diff')).toHaveLength(1);
  const own = (text: string): string => text.slice(0, text.indexOf('\n## Repository tools\n'));
  expect(own(after.out)).toBe(own(before.out));
}, 120_000);
