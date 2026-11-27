// Phase 08.9.3 D-05, D-04, D-10: `accord repos baseline <name> --id <id>` fetches the other clone's origin without a prompt, prints the commit its default branch stands at on origin, and writes the list
// of that commit's tracked files under the ticket's report folder in the checkout, so the planner and the scout read the other repository's paths while no session runs git there. Real git in temporary
// sandboxes, no network: the bare remote of the tools clone stands for the origin.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { cleanup, gitRun, run } from './helpers/repo.js';
import { reposCopy, TOOLS_URL, useRepoSandboxes, type Repos } from './helpers/repos.js';

useRepoSandboxes();

const away: string[] = [];
afterEach(() => {
  for (const d of away.splice(0)) cleanup(d);
});

const posix = (p: string): string => p.replace(/\\/g, '/');
const reportsOf = (svc: string): string => join(svc, '.accord-reports');
const listingOf = (svc: string): string => join(reportsOf(svc), 'ST-9', 'repos', 'tools.files');

/** A teammate's clone of the tools remote: pushes `src/New.cs` to its main and returns the commit that is now origin's tip. */
function teammatePushes(r: Repos): string {
  const folder = mkdtempSync(join(tmpdir(), 'accord-repos-mate-'));
  away.push(folder);
  gitRun(folder, 'clone', '-q', r.toolsRemote, 'mate');
  const mate = join(folder, 'mate');
  for (const [k, v] of [['user.email', 'mate@example.invalid'], ['user.name', 'mate'], ['commit.gpgsign', 'false']]) gitRun(mate, 'config', k, v);
  mkdirSync(join(mate, 'src'), { recursive: true });
  writeFileSync(join(mate, 'src', 'New.cs'), 'class New {}\n');
  gitRun(mate, 'add', 'src/New.cs');
  gitRun(mate, 'commit', '-q', '-m', 'add New.cs');
  gitRun(mate, 'push', '-q', 'origin', 'main');
  return gitRun(mate, 'rev-parse', 'HEAD').trim();
}

it('risk:regression baseline prints origin\'s default tip including a commit pushed after the clone, the count, and the listing path (D-05)', async () => {
  const r = reposCopy();
  const tip = teammatePushes(r);
  const before = gitRun(r.tools, 'rev-parse', 'origin/main').trim();
  expect(before).not.toBe(tip);
  const base = await run(['repos', 'baseline', 'tools', '--id', 'ST-9'], r.svc);
  expect(base.err).toBe('');
  expect(base.code).toBe(0);
  expect(base.out.trim().split('\n')).toEqual([`baseline_tools: ${tip}`, `files: ${posix(r.svc)}/.accord-reports/ST-9/repos/tools.files`, 'count: 4']);
  expect(tip).toMatch(/^[0-9a-f]{40}$/);
});

it('risk:regression the listing holds the tracked paths of that commit, one per line, in a git-ignored report folder (D-05)', async () => {
  const r = reposCopy();
  teammatePushes(r);
  expect((await run(['repos', 'baseline', 'tools', '--id', 'ST-9'], r.svc)).code).toBe(0);
  expect(readFileSync(listingOf(r.svc), 'utf8')).toBe('src/New.cs\nsrc/Other.cs\nsrc/Tools.cs\ntests/ToolsTests.cs\n');
  expect(readFileSync(join(reportsOf(r.svc), '.gitignore'), 'utf8')).toBe('*\n');
  // the report folder is ignored, so the main checkout stays clean
  expect(gitRun(r.svc, 'status', '--porcelain').trim()).toBe('');
});

it('risk:data-loss the fetch leaves the other clone\'s HEAD, local branches, index and working tree as they were (D-10)', async () => {
  const r = reposCopy();
  teammatePushes(r);
  const state = (): string[] => [
    gitRun(r.tools, 'rev-parse', 'HEAD'),
    gitRun(r.tools, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
    gitRun(r.tools, 'ls-files', '--stage'),
    gitRun(r.tools, 'status', '--porcelain'),
    gitRun(r.tools, 'symbolic-ref', 'HEAD'),
  ];
  const before = state();
  expect((await run(['repos', 'baseline', 'tools', '--id', 'ST-9'], r.svc)).code).toBe(0);
  expect(state()).toEqual(before);
  // only the remote-tracking ref moved
  expect(gitRun(r.tools, 'rev-parse', 'origin/main').trim()).not.toBe(before[0].trim());
});

/** Every refusal: exit 2, a line that says why, and not a byte of the report folder written. */
async function refused(r: Repos, argv: string[]): Promise<{ code: number; err: string; out: string }> {
  const result = await run(argv, r.svc);
  expect(result.code, argv.join(' ')).toBe(2);
  expect(existsSync(reportsOf(r.svc)), argv.join(' ') + ' wrote the report folder').toBe(false);
  return result;
}

it('risk:regression baseline refuses a missing --id, an id that is no ticket of this checkout, and a name no repos: entry declares, writing nothing (D-05)', async () => {
  const r = reposCopy();
  expect((await refused(r, ['repos', 'baseline', 'tools'])).err).toContain('--id');
  expect((await refused(r, ['repos', 'baseline', 'tools', '--id', 'ST-404'])).err).toContain('no ticket ST-404');
  expect((await refused(r, ['repos', 'baseline', 'tools', '--id', '../x'])).err).toContain('not a ticket id');
  expect((await refused(r, ['repos', 'baseline', 'nope', '--id', 'ST-9'])).err).toContain('nope');
});

it('risk:security baseline with no clone anywhere ends in the git clone line and starts no git clone, writing nothing (D-02)', async () => {
  const r = reposCopy();
  cleanup(r.tools);
  const result = await refused(r, ['repos', 'baseline', 'tools', '--id', 'ST-9']);
  expect(result.err).toContain(`git clone '${TOOLS_URL}' '${posix(r.parent)}/tools'`);
  expect(result.err).toContain('accord repos set tools <path>');
});

it('risk:regression a fetch that fails names git\'s first line and writes nothing (D-05)', async () => {
  const r = reposCopy();
  cleanup(r.toolsRemote);
  const result = await refused(r, ['repos', 'baseline', 'tools', '--id', 'ST-9']);
  expect(result.err).toContain('fetch');
  expect(result.err).toMatch(/fatal|error/i);
});

it('risk:security a report folder that is a link is refused before anything is fetched or written (D-05)', async () => {
  const r = reposCopy();
  const elsewhere = mkdtempSync(join(tmpdir(), 'accord-repos-link-'));
  away.push(elsewhere);
  mkdirSync(join(reportsOf(r.svc), 'ST-9'), { recursive: true });
  symlinkSync(elsewhere, join(reportsOf(r.svc), 'ST-9', 'repos'), 'junction');
  const result = await run(['repos', 'baseline', 'tools', '--id', 'ST-9'], r.svc);
  expect(result.code).toBe(2);
  expect(result.err).toContain('nothing was written');
  expect(readdirSync(elsewhere)).toEqual([]);
});
