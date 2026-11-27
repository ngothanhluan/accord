// Phase 08.9.3 D-06 (Ruling R20): onboarding proposes `repos.<name>.tests` when it can tell the other repository's suite from the files its clone tracks at its default tip.
// `accord config areas git --json` lists the proposal with its evidence; it is read-only: nothing is stored, no git process writes to the other clone, and no test command runs.
// Real git in temporary sandboxes (the helpers/repos.ts pair of clones), no network.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { gitDirsOf } from '../src/load/gitdir.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, run, writeFiles } from './helpers/repo.js';
import { reposCopy, TOOLS_URL, useRepoSandboxes } from './helpers/repos.js';
import type { Repos } from './helpers/repos.js';

// the spy of helpers/git-spawns.ts: the git processes accord starts and the folder each ran in
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));
useRepoSandboxes();

const posix = (p: string): string => p.replace(/\\/g, '/');
const NO_TESTS = CONFIG + ['repos:', '  tools:', `    remote: ${TOOLS_URL}`, ''].join('\n');
const WITH_TESTS = CONFIG + ['repos:', '  tools:', `    remote: ${TOOLS_URL}`, '    tests: dotnet test', ''].join('\n');

interface Found {
  key: string;
  value: unknown;
  evidence: string;
}

/** A copy of the pair whose main checkout declares `tools` with the given config, and whose tools clone tracks `files` at its default tip (committed and pushed to its remote). */
function pair(files: Record<string, string>, config: string = NO_TESTS): Repos {
  const r = reposCopy();
  writeFileSync(join(r.svc, 'accord', 'config.yml'), config);
  if (Object.keys(files).length > 0) {
    writeFiles(r.tools, files);
    r.git(r.tools, 'add', '-A');
    r.git(r.tools, 'commit', '-q', '-m', 'build files');
    r.git(r.tools, 'push', '-q', 'origin', 'main');
  }
  return r;
}

/** The proposals `accord config areas git --json` lists for the `repos` key. */
async function proposals(r: Repos): Promise<Found[]> {
  const out = await run(['config', 'areas', 'git', '--json'], r.svc);
  expect([out.code, out.err]).toEqual([0, '']);
  const areas = (JSON.parse(out.out) as { areas: { id: string; keys: { key: string; proposals: Found[] }[] }[] }).areas;
  const git = areas.find((a) => a.id === 'git');
  return git?.keys.find((k) => k.key === 'repos')?.proposals ?? [];
}

const storeOf = (svc: string): string => join((gitDirsOf(svc) as NonNullable<ReturnType<typeof gitDirsOf>>).commonDir, 'accord', 'repos');

// the tracer: the issue's own example, a C# tool server
it('risk:regression the tools clone tracking Tools.sln is offered dotnet test, with its evidence, in the git area (D-06)', async () => {
  const r = pair({ 'Tools.sln': 'Microsoft Visual Studio Solution File\n' });
  expect(await proposals(r)).toEqual([{ key: 'repos.tools.tests', value: 'dotnet test', evidence: 'tools tracks Tools.sln' }]);
});

const TABLE: [string, Record<string, string>, string, string][] = [
  ['a .csproj', { 'Tools.csproj': '<Project />\n' }, 'dotnet test', 'Tools.csproj'],
  ['a package.json with a test script', { 'package.json': JSON.stringify({ scripts: { test: 'vitest run' } }) }, 'npm test', 'package.json'],
  ['go.mod', { 'go.mod': 'module example.com/tools\n' }, 'go test ./...', 'go.mod'],
  ['Cargo.toml', { 'Cargo.toml': '[package]\nname = "tools"\n' }, 'cargo test', 'Cargo.toml'],
  ['pyproject.toml', { 'pyproject.toml': '[project]\nname = "tools"\n' }, 'pytest', 'pyproject.toml'],
  ['pytest.ini', { 'pytest.ini': '[pytest]\n' }, 'pytest', 'pytest.ini'],
  ['pom.xml', { 'pom.xml': '<project />\n' }, 'mvn test', 'pom.xml'],
  ['build.gradle', { 'build.gradle': 'plugins {}\n' }, 'gradle test', 'build.gradle'],
  ['build.gradle.kts', { 'build.gradle.kts': 'plugins {}\n' }, 'gradle test', 'build.gradle.kts'],
];
for (const [name, files, value, file] of TABLE) {
  it(`risk:regression ${name} is offered ${value} (D-06)`, async () => {
    const r = pair(files);
    expect(await proposals(r)).toEqual([{ key: 'repos.tools.tests', value, evidence: `tools tracks ${file}` }]);
  });
}

it('risk:regression the first match of the table wins, in the order of the table (D-06, R20)', async () => {
  const r = pair({ 'package.json': JSON.stringify({ scripts: { test: 'jest' } }), 'go.mod': 'module x\n', 'Tools.sln': 'sln\n' });
  expect(await proposals(r)).toEqual([{ key: 'repos.tools.tests', value: 'dotnet test', evidence: 'tools tracks Tools.sln' }]);
  const second = pair({ 'package.json': JSON.stringify({ scripts: { test: 'jest' } }), 'go.mod': 'module x\n' });
  expect(await proposals(second)).toEqual([{ key: 'repos.tools.tests', value: 'npm test', evidence: 'tools tracks package.json' }]);
});

it('risk:regression a package.json with no test script, or npm init\'s placeholder script, proposes nothing and the table goes on (D-06)', async () => {
  expect(await proposals(pair({ 'package.json': JSON.stringify({ scripts: { build: 'tsc' } }) }))).toEqual([]);
  expect(await proposals(pair({ 'package.json': JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }) }))).toEqual([]);
  expect(await proposals(pair({ 'package.json': '{ not json', 'go.mod': 'module x\n' }))).toEqual([{ key: 'repos.tools.tests', value: 'go test ./...', evidence: 'tools tracks go.mod' }]);
});

it('risk:regression no proposal when repos.tools.tests is set, when no build file is tracked, when one sits only in a folder, or when the clone is not found (D-06)', async () => {
  // set
  expect(await proposals(pair({ 'Tools.sln': 'sln\n' }, WITH_TESTS))).toEqual([]);
  // no build file: the fixture's tools clone tracks only .cs files
  expect(await proposals(pair({}))).toEqual([]);
  // a build file below the root is not where a test command runs
  expect(await proposals(pair({ 'src/go.mod': 'module x\n', 'web/package.json': JSON.stringify({ scripts: { test: 'jest' } }) }))).toEqual([]);
  // tracked only in the working tree, never committed
  const untracked = pair({});
  writeFiles(untracked.tools, { 'go.mod': 'module x\n' });
  expect(await proposals(untracked)).toEqual([]);
  // no clone beside the main checkout
  const gone = pair({ 'Tools.sln': 'sln\n' });
  cleanup(gone.tools);
  expect(await proposals(gone)).toEqual([]);
});

it('risk:security the detection stores no clone path and no git process writes to the other clone (D-06, T-08.9.3-35)', async () => {
  const r = pair({ 'Tools.sln': 'sln\n', 'package.json': JSON.stringify({ scripts: { test: 'jest' } }) });
  const refsBefore = r.git(r.tools, 'for-each-ref');
  const statusBefore = r.git(r.tools, 'status', '--porcelain');
  const calls: { args: string[]; cwd: string }[] = [];
  spawnLog.calls = [];
  spawnLog.on = true;
  spawnLog.fail = (args, options) => {
    calls.push({ args: [...args], cwd: posix(options?.cwd ?? '').toLowerCase() });
    return false;
  };
  let found: Found[];
  try {
    found = await proposals(r);
  } finally {
    spawnLog.on = false;
    spawnLog.fail = undefined;
  }
  expect(found).toHaveLength(1);
  // nothing is stored: the per-clone repos file is never written
  expect(existsSync(storeOf(r.svc))).toBe(false);
  // the other clone is read only through read-only git commands
  const tools = posix(r.tools).toLowerCase();
  const inTools = calls.filter((c) => c.cwd === tools || c.cwd.startsWith(tools + '/'));
  expect(inTools.length).toBeGreaterThan(0);
  const READ_ONLY = new Set(['ls-tree', 'cat-file', 'for-each-ref', 'rev-parse', 'config']);
  expect(inTools.filter((c) => !READ_ONLY.has(c.args[0]) || (c.args[0] === 'config' && !c.args.includes('--get'))).map((c) => c.args)).toEqual([]);
  // the clone itself is unchanged, and no test command ran (the proposal is text)
  expect(r.git(r.tools, 'for-each-ref')).toBe(refsBefore);
  expect(r.git(r.tools, 'status', '--porcelain')).toBe(statusBefore);
});

// the owner's one yes: the proposal is text the owner confirms with `accord config set`, which has to reach the key under the repository's name
it('risk:regression the proposal is confirmed with accord config set repos.<name>.tests, which writes it under the repository and ends the proposal (D-06)', async () => {
  const r = pair({ 'Tools.sln': 'sln\n' });
  const [proposal] = await proposals(r);
  const set = await run(['config', 'set', proposal.key, String(proposal.value)], r.svc);
  expect([set.code, set.err]).toEqual([0, '']);
  const text = readFileSync(join(r.svc, 'accord', 'config.yml'), 'utf8');
  expect(text).toContain(`repos:\n  tools:\n    remote: ${TOOLS_URL}\n    tests: dotnet test\n`);
  expect(await proposals(r)).toEqual([]);
  // a key the repository's object does not have is not resolved
  const bad = await run(['config', 'set', 'repos.tools.nope', 'x'], r.svc);
  expect(bad.code).not.toBe(0);
});
